/**
 * Opt-in speech-to-text for Windows. System.Speech uses the locally installed
 * desktop speech recognizer. No audio recordings are saved or forwarded to a
 * remote service by CoS; only recognition text is sent to our own renderer.
 *
 * This process is spawned only when the user clicks the microphone. The child
 * event loop never reads stdin (a synchronous Windows Console reader can block
 * recognition events). The child also checks the owning app PID so a forced
 * quit or main-process crash cannot leave the microphone listening; only an
 * explicit Stop click retains the short final-result grace.
 */
import { app, ipcMain, type BrowserWindow, type WebContents } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { DictationAudioRequest, DictationAudioResult, DictationEvent } from '../shared/dictation.js';
import { DICTATION_AUDIO_LIMITS, parseDictationEvent } from '../shared/dictation.js';
import { getSecret } from './secrets.js';
import { getConfig } from './config.js';
import { setupApiKeySlot } from '../shared/setup-profile.js';

const AUDIO_ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions';
const AUDIO_MODEL = 'gpt-transcribe';
const AUDIO_TIMEOUT_MS = 35_000;
const AUDIO_MIME = new Map([
  ['audio/webm', 'webm'],
  ['audio/ogg', 'ogg'],
  ['audio/mp4', 'mp4']
]);

function validatedAudio(value: unknown): { request: DictationAudioRequest; data: Uint8Array } | null {
  if (!value || typeof value !== 'object') return null;
  const payload = value as Partial<DictationAudioRequest>;
  // Electron's renderer, isolated preload and main may use different JS realms.
  // An authentic Uint8Array stays an ArrayBuffer view across realms but may not
  // pass main's `instanceof Uint8Array` check. Reject DataView/plain objects.
  const bytes = payload.audio;
  const isByteArray = ArrayBuffer.isView(bytes) &&
    Object.prototype.toString.call(bytes) === '[object Uint8Array]';
  if (!AUDIO_MIME.has(String(payload.mimeType)) ||
    !Number.isInteger(payload.durationMs) || (payload.durationMs ?? 0) < 250 ||
    (payload.durationMs ?? 0) > DICTATION_AUDIO_LIMITS.maxDurationMs ||
    !isByteArray || !bytes ||
    bytes.byteLength < 256 || bytes.byteLength > DICTATION_AUDIO_LIMITS.maxBytes) return null;
  // Own the bytes before awaiting secureStorage; caller mutation cannot alter the upload.
  const data = Uint8Array.from(bytes);
  return { request: payload as DictationAudioRequest, data };
}

/** API failures must never surface returned bodies, authentication headers, or captured audio. */
const TRANSCRIPTION_ERRORS = {
  auth: 'OpenAI API key was rejected. Configure your own API key in CoS Setup.',
  credits: 'OpenAI API credits are exhausted. ChatGPT subscriptions do not include API transcription credits. Select Windows dictation or use the microphone on ChatGPT.com.',
  spending: 'OpenAI API spending limit reached. Check your API project or organization budget; or select Windows dictation.',
  usage: 'OpenAI API organization usage limit reached. Check the API usage limits or select Windows dictation.',
  rate: 'OpenAI API transcription rate limit reached. Try again after the API cooldown, or select Windows dictation.',
  quota: 'OpenAI API quota exceeded. Check API billing and limits, or select Windows dictation.',
  size: 'Recording is too large for transcription.',
  unavailable: 'OpenAI transcription was unavailable. Try again or select Windows dictation.'
} as const;

function transcriptionFailure(status: number, code?: string, type?: string): string {
  if (status === 401 || status === 403)
    return TRANSCRIPTION_ERRORS.auth;
  if (status === 429) {
    if (code === 'credit_balance_exhausted') return TRANSCRIPTION_ERRORS.credits;
    if (code === 'organization_spend_limit_exceeded' || code === 'project_spend_limit_exceeded') return TRANSCRIPTION_ERRORS.spending;
    if (code === 'organization_usage_limit_exceeded') return TRANSCRIPTION_ERRORS.usage;
    if (code === 'rate_limit_exceeded') return TRANSCRIPTION_ERRORS.rate;
    if (code === 'insufficient_quota' || type === 'insufficient_quota') return TRANSCRIPTION_ERRORS.quota;
    return TRANSCRIPTION_ERRORS.quota; // Unknown 429: never promise an automatic retry will help.
  }
  if (status === 413) return TRANSCRIPTION_ERRORS.size;
  return TRANSCRIPTION_ERRORS.unavailable;
}

/** Read only documented error identifiers; never show untrusted API error bodies to the user. */
async function safeTranscriptionFailure(response: Response): Promise<string> {
  if (response.status !== 429) return transcriptionFailure(response.status);
  try {
    if (Number(response.headers.get('content-length')) > 4096) return transcriptionFailure(429);
    const body = await response.text();
    if (body.length > 4096) return transcriptionFailure(429);
    const error = JSON.parse(body) as { error?: { code?: unknown; type?: unknown } };
    const code = typeof error?.error?.code === 'string' ? error.error.code : undefined;
    const type = typeof error?.error?.type === 'string' ? error.error.type : undefined;
    return transcriptionFailure(429, code, type);
  } catch { return transcriptionFailure(429); }
}

type OpenAIRequest = { owner: WebContents; controller: AbortController };

/** Network is main-only; renderer receives text, never the API credential. */
export async function transcribeOpenAIDictation(
  bytes: Uint8Array, mimeType: DictationAudioRequest['mimeType'],
  apiKey: string, signal: AbortSignal
): Promise<string> {
  const extension = AUDIO_MIME.get(mimeType);
  if (!extension || bytes.byteLength < 256 || bytes.byteLength > DICTATION_AUDIO_LIMITS.maxBytes)
    throw new Error('Unsupported or oversized microphone recording');
  const form = new FormData();
  form.set('model', AUDIO_MODEL);
  form.set('response_format', 'json');
  form.set('file', new Blob([Uint8Array.from(bytes)], { type: mimeType }), 'dictation.' + extension);
  const response = await fetch(AUDIO_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey },
    body: form,
    signal,
    redirect: 'error',
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(await safeTranscriptionFailure(response));
  const raw = await response.text();
  if (raw.length > 32_768) throw new Error('Transcription response was too large');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('OpenAI returned an invalid transcription'); }
  const text = value && typeof value === 'object' && 'text' in value && typeof value.text === 'string'
    ? value.text.replace(/[\u0000-\u001f]/g, ' ').trim() : '';
  if (!text || text.length > DICTATION_AUDIO_LIMITS.maxTranscriptChars)
    throw new Error('OpenAI returned an empty or oversized transcription');
  return text;
}

const SCRIPT = [
  "$ErrorActionPreference='Stop'",
  '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)',
  '$cosParentPid = __COS_PARENT_PID__',
  "function Send([string]$type,[string]$value) {",
  "  $data = if($type -eq 'status') { @{type='status';status=$value} } elseif($type -eq 'error') { @{type='error';message=$value} } else { @{type=$type;text=$value} }",
  '  [Console]::Out.WriteLine(($data | ConvertTo-Json -Compress -Depth 3))',
  '  [Console]::Out.Flush()',
  '}',
  '$recognizer = $null',
  '$subFinal = $null',
  '$subPartial = $null',
  'try {',
  "  if(-not (Get-Process -Id $cosParentPid -ErrorAction SilentlyContinue)) { exit 0 }",
  '  Add-Type -AssemblyName System.Speech',
  '  $available = @([System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers())',
  "  if($available.Count -eq 0) { throw 'No Windows speech recognizer is installed. Install a Windows speech language pack.' }",
  '  $culture = [System.Globalization.CultureInfo]::CurrentUICulture',
  '  $choice = $available | Where-Object { $_.Culture.Name -eq $culture.Name } | Select-Object -First 1',
  '  if(-not $choice) { $choice = $available | Where-Object { $_.Culture.TwoLetterISOLanguageName -eq $culture.TwoLetterISOLanguageName } | Select-Object -First 1 }',
  '  if(-not $choice) { $choice = $available[0] }',
  '  $recognizer = [System.Speech.Recognition.SpeechRecognitionEngine]::new($choice)',
  '  $recognizer.LoadGrammar([System.Speech.Recognition.DictationGrammar]::new())',
  '  $recognizer.SetInputToDefaultAudioDevice()',
  "  $subFinal = Register-ObjectEvent -InputObject $recognizer -EventName SpeechRecognized -SourceIdentifier 'CoSDictationFinal'",
  "  $subPartial = Register-ObjectEvent -InputObject $recognizer -EventName SpeechHypothesized -SourceIdentifier 'CoSDictationPartial'",
  '  $recognizer.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)',
  "  Send 'status' 'listening'",
  '  while($true) {',
  '    $item = Wait-Event -Timeout 1',
  '    if(-not (Get-Process -Id $cosParentPid -ErrorAction SilentlyContinue)) { break }',
  '    if(-not $item) { continue }',
  '    try {',
  '      $result = $item.SourceEventArgs.Result',
  '      if($result -and -not [string]::IsNullOrWhiteSpace($result.Text)) {',
  "        if($item.SourceIdentifier -eq 'CoSDictationFinal') { Send 'final' $result.Text }",
  "        elseif($item.SourceIdentifier -eq 'CoSDictationPartial') { Send 'partial' $result.Text }",
  '      }',
  '    } finally { Remove-Event -EventIdentifier $item.EventIdentifier -ErrorAction SilentlyContinue }',
  '  }',
  "  $recognizer.RecognizeAsyncCancel()",
  "} catch { Send 'error' $_.Exception.Message }",
  'finally {',
  '  if($subFinal) { Unregister-Event -SourceIdentifier CoSDictationFinal -ErrorAction SilentlyContinue }',
  '  if($subPartial) { Unregister-Event -SourceIdentifier CoSDictationPartial -ErrorAction SilentlyContinue }',
  '  if($recognizer) { $recognizer.Dispose() }',
  "  Send 'status' 'stopped'",
  '}',
  'exit 0'
].join('\r\n');

type OwnedProcess = {
  child: ChildProcessWithoutNullStreams;
  owner: WebContents;
  stopping: boolean;
  lineBuffer: string;
  killTimeout: NodeJS.Timeout | null;
};

/** Separate registration to keep the main IPC allowlist fixed and narrow. */
export function registerDictationIpc(getWindow: () => BrowserWindow | null): void {
  let active: OwnedProcess | null = null;
  let openAI: OpenAIRequest | null = null;
  const owned = (sender: WebContents): boolean => {
    const window = getWindow();
    return !!window && !window.isDestroyed() && !sender.isDestroyed() && window.webContents === sender;
  };

  const send = (row: OwnedProcess, event: DictationEvent): void => {
    const window = getWindow();
    if (active !== row || !window || window.isDestroyed() || window.webContents !== row.owner ||
      row.owner.isDestroyed()) return;
    row.owner.send('dictation:event', event);
  };
  const stop = (row: OwnedProcess): void => {
    if (row.stopping) return;
    row.stopping = true;
    row.killTimeout = setTimeout(() => {
      if (active === row) row.child.kill();
    }, 1_500);
    row.killTimeout.unref();
  };

  // Quit cannot await a delayed stop: terminate the helper synchronously so a
  // tray quit never leaves a microphone-owning PowerShell process orphaned.
  app.once('before-quit', () => {
    if (openAI) {
      openAI.controller.abort();
      openAI = null;
    }
    if (active) {
      active.stopping = true;
      if (active.killTimeout) clearTimeout(active.killTimeout);
      active.killTimeout = null;
      active.child.kill();
      active = null;
    }
  });
  ipcMain.handle('dictation:keyStatus', async event => {
    if (!owned(event.sender)) return { ok: false as const, error: 'Dictation requires the CoS window' };
    try {
      const profileId = getConfig().tunnel.profileId ?? 'default';
      return { ok: true as const, data: { available: !!(await getSecret(setupApiKeySlot(profileId))) } };
    } catch {
      return { ok: true as const, data: { available: false } };
    }
  });
  ipcMain.handle('dictation:cancelTranscription', async event => {
    if (!owned(event.sender)) return { ok: false as const, error: 'Dictation requires the CoS window' };
    if (openAI?.owner === event.sender) {
      openAI.controller.abort();
      openAI = null;
    }
    return { ok: true as const, data: undefined };
  });
  ipcMain.handle('dictation:transcribe', async (event, payload: unknown): Promise<DictationAudioResult> => {
    if (!owned(event.sender)) return { ok: false, error: 'Dictation requires the CoS window' };
    const audio = validatedAudio(payload);
    if (!audio) return { ok: false, error: 'Invalid or oversized microphone recording' };
    if (openAI || active) return { ok: false, error: 'Another dictation is already active' };
    const row: OpenAIRequest = { owner: event.sender, controller: new AbortController() };
    openAI = row; // Admit synchronously before waiting for safeStorage.
    const timeout = setTimeout(() => row.controller.abort(), AUDIO_TIMEOUT_MS);
    timeout.unref();
    const onOwnerDestroyed = (): void => row.controller.abort();
    event.sender.once('destroyed', onOwnerDestroyed);
    try {
      const profileId = getConfig().tunnel.profileId ?? 'default';
      const key = await getSecret(setupApiKeySlot(profileId));
      if (openAI !== row || row.controller.signal.aborted) return { ok: false, error: 'Transcription cancelled' };
      if (!key) return { ok: false, error: 'Set your own OpenAI API key in CoS Setup to enable cloud dictation' };
      const text = await transcribeOpenAIDictation(audio.data, audio.request.mimeType, key, row.controller.signal);
      if (openAI !== row || row.controller.signal.aborted || !owned(event.sender))
        return { ok: false, error: 'Transcription cancelled' };
      return { ok: true, data: { text } };
    } catch (error) {
      if (row.controller.signal.aborted || openAI !== row)
        return { ok: false, error: 'Transcription cancelled or timed out' };
      return { ok: false, error: error instanceof Error && [
        ...Object.values(TRANSCRIPTION_ERRORS),
        'Transcription response was too large', 'OpenAI returned an invalid transcription',
        'OpenAI returned an empty or oversized transcription'
      ].includes(error.message) ? error.message : 'OpenAI transcription failed. Check network access and retry.' };
    } finally {
      clearTimeout(timeout);
      event.sender.off('destroyed', onOwnerDestroyed);
      if (openAI === row) openAI = null;
    }
  });
  ipcMain.handle('dictation:start', async event => {
    const window = getWindow();
    if (!window || window.isDestroyed() || event.sender !== window.webContents)
      return { ok: false as const, error: 'Dictation can only start from the CoS window' };
    if (process.platform !== 'win32')
      return { ok: false as const, error: 'Microphone dictation currently requires Windows' };
    if (active || openAI)
      return { ok: false as const, error: 'Dictation is already running' };
    const script = SCRIPT.replace('__COS_PARENT_PID__', String(process.pid));
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive',
        '-EncodedCommand', encoded], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      return { ok: false as const, error: 'Could not launch the Windows speech recognizer' };
    }
    const row: OwnedProcess = { child, owner: event.sender, stopping: false, lineBuffer: '', killTimeout: null };
    active = row;
    send(row, { type: 'status', status: 'starting' });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (active !== row) return;
      row.lineBuffer += chunk;
      if (row.lineBuffer.length > 32_768) { stop(row); return; }
      let index = row.lineBuffer.indexOf('\n');
      while (index >= 0) {
        const line = row.lineBuffer.slice(0, index).trim();
        row.lineBuffer = row.lineBuffer.slice(index + 1);
        const parsed = parseDictationEvent(line);
        if (parsed) send(row, parsed);
        index = row.lineBuffer.indexOf('\n');
      }
    });
    child.stderr.resume(); // Avoid a blocked stdout pipe; never log spoken text.
    child.once('error', () => {
      if (!row.stopping) send(row, { type: 'error', message: 'Windows speech recognition could not start' });
      if (active === row) {
        if (row.killTimeout) clearTimeout(row.killTimeout);
        send(row, { type: 'status', status: 'stopped' });
        active = null;
      }
    });
    child.once('exit', (code, signal) => {
      if (row.killTimeout) clearTimeout(row.killTimeout);
      if (active !== row) return;
      if (!row.stopping && code !== 0 && signal !== 'SIGTERM')
        send(row, { type: 'error', message: 'Windows speech recognition exited unexpectedly' });
      send(row, { type: 'status', status: 'stopped' });
      active = null;
    });
    event.sender.once('destroyed', () => { if (active === row) stop(row); });
    return { ok: true as const, data: { status: 'starting' as const } };
  });
  ipcMain.handle('dictation:stop', async event => {
    const window = getWindow();
    if (!window || window.isDestroyed() || event.sender !== window.webContents)
      return { ok: false as const, error: 'Dictation is not owned by this window' };
    if (active) stop(active);
    return { ok: true as const, data: undefined };
  });
}
