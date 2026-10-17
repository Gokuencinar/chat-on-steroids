import { JSDOM } from 'jsdom';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let dom: JSDOM;
let input: HTMLTextAreaElement;
let mic: HTMLButtonElement;
let provider: HTMLSelectElement;
let resolveText: (result: unknown) => void;
const sendAudio = vi.fn((_request: unknown) => new Promise<unknown>(resolve => { resolveText = resolve; }));
const cancelAudio = vi.fn(async () => ({ ok: true }));
const keyStatus = vi.fn(async () => ({ ok: true, data: { available: true } }));
const openChatGpt = vi.fn(async () => ({ ok: true, data: true }));
const openSessionChat = vi.fn(async (_id: string) => ({ ok: true, data: true }));
const trackStop = vi.fn();
class FakeRecorder {
  static latest: FakeRecorder | null = null;
  static isTypeSupported(type: string): boolean { return type === 'audio/webm;codecs=opus'; }
  readonly mimeType = 'audio/webm;codecs=opus';
  state: RecordingState = 'inactive';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_stream: MediaStream, _options: MediaRecorderOptions) { FakeRecorder.latest = this; }
  start(): void { this.state = 'recording'; }
  stop(): void {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.ondataavailable?.({ data: new Blob([new Uint8Array(2048).fill(1)], { type: this.mimeType }) });
      this.onstop?.();
    });
  }
}

beforeAll(async () => {
  dom = new JSDOM('<!doctype html><html><body><form id="composer">' +
    '<textarea id="chatInput"></textarea>' +
    '<select id="dictationProvider"><option value="windows">Windows</option><option value="openai">OpenAI</option><option value="chatgpt">ChatGPT browser</option></select>' +
    '<button id="dictationButton" type="button" aria-pressed="false"></button>' +
    '<p id="dictationStatus" hidden></p></form></body></html>', { url: 'https://local.test/' });
  dom.window.HTMLCanvasElement.prototype.getContext = (() => null) as typeof dom.window.HTMLCanvasElement.prototype.getContext;
  Object.defineProperty(dom.window.navigator, 'mediaDevices', {
    configurable: true, value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: trackStop }] })) }
  });
  Object.defineProperty(dom.window, 'MediaRecorder', { configurable: true, value: FakeRecorder });
  Object.defineProperty(dom.window, 'api', { value: {
    dictationSupported: true,
    startDictation: vi.fn(),
    stopDictation: vi.fn(),
    onDictationEvent: vi.fn(() => () => undefined),
    dictationOpenAIKeyStatus: keyStatus,
    openChatGpt,
    openSessionChat,
    transcribeDictationAudio: sendAudio,
    cancelDictationTranscription: cancelAudio
  } });
  vi.stubGlobal('navigator', dom.window.navigator);
  Object.assign(globalThis, {
    window: dom.window, document: dom.window.document,
    HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node,
    Event: dom.window.Event, MediaRecorder: FakeRecorder
  });
  const { initComposerDictation } = await import('../src/renderer/chat.js');
  input = dom.window.document.getElementById('chatInput') as HTMLTextAreaElement;
  mic = dom.window.document.getElementById('dictationButton') as HTMLButtonElement;
  provider = dom.window.document.getElementById('dictationProvider') as HTMLSelectElement;
  initComposerDictation();
});
afterAll(() => {
  dom?.window.dispatchEvent(new dom.window.Event('beforeunload'));
  dom?.window.close();
  vi.restoreAllMocks();
});

async function selectCloud(): Promise<void> {
  provider.value = 'openai';
  provider.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  expect(dom.window.document.getElementById('dictationStatus')?.textContent).toContain('API credits');
  expect(mic.disabled).toBe(false);
}

describe('opt-in OpenAI microphone recording and composer isolation', () => {
  it('opens native ChatGPT browser dictation by user action without recording or using the billed API', async () => {
    const before = sendAudio.mock.calls.length;
    const capture = FakeRecorder.latest;
    const keyReads = keyStatus.mock.calls.length;
    const selected = provider.value;
    provider.value = 'chatgpt';
    provider.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    expect(mic.disabled).toBe(false);
    expect(openChatGpt).not.toHaveBeenCalled();
    const draft = 'Never upload this message';
    input.value = draft;
    mic.click();
    await vi.waitFor(() => expect(openChatGpt).toHaveBeenCalledTimes(1));
    expect(sendAudio).toHaveBeenCalledTimes(before);
    expect(keyStatus).toHaveBeenCalledTimes(keyReads);
    expect(FakeRecorder.latest).toBe(capture);
    expect(input.value).toBe(draft);
    expect(dom.window.document.getElementById('dictationStatus')?.textContent).toContain('ChatGPT');
    provider.value = selected;
    provider.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  it('does not transcribe until Stop and inserts only final text without submitting', async () => {
    const actualNow = Date.now.bind(Date);
    const now = vi.spyOn(Date, 'now');
    let extraMs = 0;
    now.mockImplementation(() => actualNow() + extraMs);
    let submits = 0;
    dom.window.document.getElementById('composer')!.addEventListener('submit', () => submits++);
    input.value = 'Hello  friend';
    input.setSelectionRange(6, 6);
    await selectCloud();
    mic.click();
    await vi.waitFor(() => expect(mic.dataset.state).toBe('listening'));
    expect(dom.window.document.getElementById('dictationStatus')?.textContent).toContain('automatically at 45 seconds');
    expect(sendAudio).not.toHaveBeenCalled();
    expect(input.value).toBe('Hello  friend');
    extraMs = 1_000;
    mic.click();
    await vi.waitFor(() => expect(sendAudio).toHaveBeenCalledTimes(1));
    const payload = sendAudio.mock.calls[0]![0] as { audio: Uint8Array; durationMs: number; mimeType: string };
    expect(payload.audio).toBeInstanceOf(Uint8Array);
    expect(payload.audio.byteLength).toBe(2048);
    expect(payload.durationMs).toBeGreaterThanOrEqual(250);
    expect(payload.mimeType).toBe('audio/webm');
    expect(input.value).toBe('Hello  friend');
    resolveText({ ok: true, data: { text: 'Hola, mundo' } });
    await vi.waitFor(() => expect(input.value).toBe('Hello Hola, mundo friend'));
    expect(submits).toBe(0);
    expect(mic.dataset.state).toBe('idle');
    expect(trackStop).toHaveBeenCalled();
    now.mockRestore();
  });

  it('cancels pending uploads when the user edits and ignores a late API result', async () => {
    const actualNow = Date.now.bind(Date);
    const now = vi.spyOn(Date, 'now');
    let extraMs = 0;
    now.mockImplementation(() => actualNow() + extraMs);
    input.value = 'Manual';
    input.setSelectionRange(6, 6);
    mic.click();
    await vi.waitFor(() => expect(mic.dataset.state).toBe('listening'));
    extraMs = 1_000;
    mic.click();
    await vi.waitFor(() => expect(sendAudio).toHaveBeenCalledTimes(1));
    input.value = 'Edited manually';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(cancelAudio).toHaveBeenCalled();
    resolveText({ ok: true, data: { text: 'MUST NEVER APPEAR' } });
    await Promise.resolve();
    await Promise.resolve();
    expect(input.value).toBe('Edited manually');
    now.mockRestore();
  });
  it('lets the user cancel a transcription after recording stops', async () => {
    const actualNow = Date.now.bind(Date);
    const now = vi.spyOn(Date, 'now');
    let extraMs = 0;
    now.mockImplementation(() => actualNow() + extraMs);
    input.value = 'Keep this';
    input.setSelectionRange(input.value.length, input.value.length);
    mic.click();
    await vi.waitFor(() => expect(mic.dataset.state).toBe('listening'));
    extraMs = 1_000;
    mic.click();
    await vi.waitFor(() => expect(sendAudio).toHaveBeenCalledTimes(1));
    expect(mic.disabled).toBe(false);
    expect(mic.getAttribute('aria-label')).toBe('Cancel transcription');
    mic.click();
    expect(cancelAudio).toHaveBeenCalled();
    resolveText({ ok: true, data: { text: 'late transcript' } });
    await Promise.resolve();
    expect(input.value).toBe('Keep this');
    expect(mic.dataset.state).toBe('idle');
    now.mockRestore();
  });

  it('never uploads audio if the recorder stops without user authorization', async () => {
    const originalNow = Date.now.bind(Date);
    const now = vi.spyOn(Date, 'now');
    let extraMs = 0;
    now.mockImplementation(() => originalNow() + extraMs);
    try {
      const uploadedBefore = sendAudio.mock.calls.length;
      await selectCloud();
      mic.click();
      await vi.waitFor(() => expect(mic.dataset.state).toBe('listening'));
      extraMs = 1_000;
      // MediaRecorder also fires stop when its MediaStream ends unexpectedly.
      FakeRecorder.latest!.stop();
      await vi.waitFor(() => expect(mic.dataset.state).toBe('error'));
      expect(sendAudio).toHaveBeenCalledTimes(uploadedBefore);
      expect(dom.window.document.getElementById('dictationStatus')?.textContent).toContain('No audio was sent');
    } finally {
      now.mockRestore();
    }
  });

  it('uploads once at the disclosed 45-second limit, without submitting the draft', async () => {
    const originalNow = Date.now.bind(Date);
    const now = vi.spyOn(Date, 'now');
    const actualSetTimeout = dom.window.setTimeout.bind(dom.window);
    const actualClearTimeout = dom.window.clearTimeout.bind(dom.window);
    let elapsed = 0;
    let due: (() => void) | null = null;
    now.mockImplementation(() => originalNow() + elapsed);
    vi.spyOn(dom.window, 'setTimeout').mockImplementation(((fn: TimerHandler, delay?: number, ...args: unknown[]) => {
      if (delay === 45_000 && typeof fn === 'function') { due = fn as () => void; return 987654; }
      return actualSetTimeout(fn, delay, ...args);
    }) as typeof dom.window.setTimeout);
    vi.spyOn(dom.window, 'clearTimeout').mockImplementation(((id?: number) => {
      if (id !== 987654) actualClearTimeout(id);
    }) as typeof dom.window.clearTimeout);
    try {
      let submits = 0;
      const form = dom.window.document.getElementById('composer')!;
      const onSubmit = () => { submits++; };
      form.addEventListener('submit', onSubmit);
      const before = sendAudio.mock.calls.length;
      await selectCloud();
      expect(dom.window.document.getElementById('dictationStatus')?.textContent).toContain('45 seconds');
      mic.click();
      await vi.waitFor(() => expect(mic.dataset.state).toBe('listening'));
      expect(due).toBeTypeOf('function');
      elapsed = 45_000;
      due!();
      await vi.waitFor(() => expect(sendAudio).toHaveBeenCalledTimes(before + 1));
      expect((sendAudio.mock.calls[before]![0] as { durationMs: number }).durationMs).toBe(45_000);
      expect(submits).toBe(0);
      mic.click(); // cancel pending transcription, without sending the draft
      form.removeEventListener('submit', onSubmit);
    } finally {
      now.mockRestore();
      vi.mocked(dom.window.setTimeout).mockRestore();
      vi.mocked(dom.window.clearTimeout).mockRestore();
    }
  });
});
