import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { DICTATION_AUDIO_LIMITS } from '../src/shared/dictation.js';

type Handler = (event: { sender: EventEmitter }, payload?: unknown) => Promise<unknown>;
const mock = vi.hoisted(() => ({
  handlers: new Map<string, Handler>(),
  key: vi.fn(async () => 'test-fixture-key'),
  config: vi.fn(() => ({ tunnel: { profileId: 'voice-profile' } }))
}));
vi.mock('electron', () => ({
  app: { once: vi.fn() },
  ipcMain: { handle: (channel: string, handler: Handler) => mock.handlers.set(channel, handler) }
}));
vi.mock('../src/main/secrets.js', () => ({ getSecret: mock.key }));
vi.mock('../src/main/config.js', () => ({ getConfig: mock.config }));
vi.mock('node:child_process', async original => ({
  ...(await original<typeof import('node:child_process')>()), spawn: vi.fn()
}));

const { registerDictationIpc, transcribeOpenAIDictation } = await import('../src/main/dictation.js');
const audio = () => ({
  audio: new Uint8Array(1024).fill(1), mimeType: 'audio/webm' as const, durationMs: 3_000
});
function handlers() {
  const sender = Object.assign(new EventEmitter(), { isDestroyed: () => false, send: vi.fn() });
  const window = { isDestroyed: () => false, webContents: sender };
  registerDictationIpc(() => window as never);
  return { sender, wrong: Object.assign(new EventEmitter(), { isDestroyed: () => false }) };
}

beforeEach(() => {
  mock.handlers.clear();
  mock.key.mockClear();
  mock.key.mockResolvedValue('test-fixture-key');
  mock.config.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

it('uses only official multipart gpt-transcribe and returns final JSON text without exposing API key', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({
    text: '  Hola, mundo.  ', languages: [{ code: 'es' }]
  }), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  const result = await transcribeOpenAIDictation(audio().audio, 'audio/webm', 'private-key', new AbortController().signal);
  expect(result).toBe('Hola, mundo.');
  const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
  expect(options.method).toBe('POST');
  expect(options.redirect).toBe('error');
  const form = options.body as FormData;
  expect(form.get('model')).toBe('gpt-transcribe');
  expect(form.get('response_format')).toBe('json');
  expect((form.get('file') as File).name).toBe('dictation.webm');
  expect(JSON.stringify({ result })).not.toContain('private-key');
});

it('requires the trusted window and strict binary/time limits before accessing credentials', async () => {
  const { sender, wrong } = handlers();
  const key = mock.handlers.get('dictation:keyStatus')!;
  const upload = mock.handlers.get('dictation:transcribe')!;
  expect(await key({ sender: wrong })).toMatchObject({ ok: false });
  expect(await upload({ sender: wrong }, audio())).toMatchObject({ ok: false });
  expect(await upload({ sender }, { ...audio(), durationMs: 46_000 })).toMatchObject({ ok: false });
  expect(await upload({ sender }, { ...audio(), audio: new Uint8Array(DICTATION_AUDIO_LIMITS.maxBytes + 1) })).toMatchObject({ ok: false });
  expect(await upload({ sender }, { ...audio(), mimeType: 'audio/unsafe' })).toMatchObject({ ok: false });
  expect(mock.key).not.toHaveBeenCalled();
  expect(await key({ sender })).toEqual({ ok: true, data: { available: true } });
  expect(mock.key).toHaveBeenCalledWith('setup:voice-profile');
});

it('accepts safe cross-realm Uint8Array microphone bytes while rejecting arbitrary objects', async () => {
  const { sender } = handlers();
  const upload = mock.handlers.get('dictation:transcribe')!;
  // Renderer/contextBridge and the main world can have different Uint8Array
  // constructors. instanceof Uint8Array is not a valid binary IPC boundary.
  const realmAudio = runInNewContext('new Uint8Array(1024).fill(1)') as Uint8Array;
  expect(ArrayBuffer.isView(realmAudio)).toBe(true);
  expect(realmAudio instanceof Uint8Array).toBe(false);
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ text: 'ok' }), { status: 200 }));
  vi.stubGlobal('fetch', fetcher);
  expect(await upload({ sender }, { ...audio(), audio: realmAudio }))
    .toEqual({ ok: true, data: { text: 'ok' } });
  expect(fetcher).toHaveBeenCalledTimes(1);
  for (const untrusted of [new DataView(new ArrayBuffer(1024)), Array(1024).fill(1), { byteLength: 1024 }]) {
    expect(await upload({ sender }, { ...audio(), audio: untrusted }))
      .toMatchObject({ ok: false, error: 'Invalid or oversized microphone recording' });
  }
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('requires an existing safeStorage key, without making a network request', async () => {
  const { sender } = handlers();
  mock.key.mockResolvedValue(null as never);
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  expect(await mock.handlers.get('dictation:transcribe')!({ sender }, audio()))
    .toMatchObject({ ok: false, error: expect.stringContaining('own OpenAI API key') });
  expect(fetcher).not.toHaveBeenCalled();
});

it('cancels active network transcription and prevents late text becoming a success', async () => {
  const { sender } = handlers();
  let pendingSignal: AbortSignal | undefined;
  const fetcher = vi.fn((_url: string, opts: RequestInit) => new Promise<Response>((_resolve, reject) => {
    pendingSignal = opts.signal as AbortSignal;
    pendingSignal.addEventListener('abort', () => reject(new Error('test abort')));
  }));
  vi.stubGlobal('fetch', fetcher);
  const upload = mock.handlers.get('dictation:transcribe')!({ sender }, audio());
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(pendingSignal?.aborted).toBe(false);
  expect(await mock.handlers.get('dictation:transcribe')!({ sender }, audio()))
    .toMatchObject({ ok: false, error: 'Another dictation is already active' });
  expect(await mock.handlers.get('dictation:cancelTranscription')!({ sender }))
    .toMatchObject({ ok: true });
  expect(pendingSignal?.aborted).toBe(true);
  expect(await upload).toMatchObject({ ok: false, error: expect.stringContaining('cancelled') });
});

it('redacts server-provided error body and responds with a fixed user-facing message', async () => {
  const leak = 'secret-and-personal-content-not-for-logs';
  vi.stubGlobal('fetch', vi.fn(async () => new Response(leak, { status: 502 })));
  await expect(transcribeOpenAIDictation(audio().audio, 'audio/webm', 'fixture', new AbortController().signal))
    .rejects.toThrow('OpenAI transcription was unavailable');
  vi.stubGlobal('fetch', vi.fn(async () => new Response('not json ' + leak, { status: 200 })));
  await expect(transcribeOpenAIDictation(audio().audio, 'audio/webm', 'fixture', new AbortController().signal))
    .rejects.toThrow('OpenAI returned an invalid transcription');
});

it('distinguishes exhausted API billing from temporary transcription rate limiting without leaking server errors', async () => {
  const input = audio();
  const cases: Array<{ code: string; status: number; fragment: string }> = [
    { code: 'credit_balance_exhausted', status: 429, fragment: 'credits' },
    { code: 'project_spend_limit_exceeded', status: 429, fragment: 'spending limit' },
    { code: 'organization_usage_limit_exceeded', status: 429, fragment: 'usage limit' },
    { code: 'rate_limit_exceeded', status: 429, fragment: 'rate limit' }
  ];
  for (const row of cases) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: {
      code: row.code, message: 'private-api-error-secret', type: row.code
    } }), { status: row.status })));
    await expect(transcribeOpenAIDictation(input.audio, input.mimeType, 'fixture', new AbortController().signal))
      .rejects.toThrow(row.fragment);
    try { await transcribeOpenAIDictation(input.audio, input.mimeType, 'fixture', new AbortController().signal); }
    catch (error) { expect(String(error)).not.toContain('private-api-error-secret'); }
  }
});

it('returns actionable quota guidance through the trusted IPC without exposing the HTTP body', async () => {
  const { sender } = handlers();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: {
    code: 'credit_balance_exhausted', message: 'PRIVATE_USER_DETAILS', type: 'insufficient_quota'
  } }), { status: 429 })));
  const reply = await mock.handlers.get('dictation:transcribe')!({ sender }, audio());
  expect(reply).toMatchObject({ ok: false, error: expect.stringContaining('credits') });
  expect(JSON.stringify(reply)).not.toContain('PRIVATE_USER_DETAILS');
  expect(JSON.stringify(reply)).toContain('Windows dictation');
});

it('releases the window-destroy abort listener after a completed cloud request', async () => {
  const { sender } = handlers();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ text: 'done' }), { status: 200 })));
  const upload = mock.handlers.get('dictation:transcribe')!;
  for (let i = 0; i < 3; i++) {
    expect(await upload({ sender }, audio())).toMatchObject({ ok: true, data: { text: 'done' } });
    expect(sender.listenerCount('destroyed'), 'must not accumulate listeners after recording').toBe(0);
  }
});
