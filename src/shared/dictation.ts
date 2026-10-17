/** Speech-to-text events from the opt-in Windows recognizer. */
export type DictationEvent =
  | { type: 'status'; status: 'starting' | 'listening' | 'stopped' }
  | { type: 'partial' | 'final'; text: string }
  | { type: 'error'; message: string };

/** OpenAI is a separate, explicit provider; it is never silently enabled. */
export type DictationProvider = 'windows' | 'openai' | 'chatgpt';
export const DICTATION_AUDIO_LIMITS = {
  maxBytes: 8 * 1024 * 1024,
  maxDurationMs: 45_000,
  maxTranscriptChars: 4_000
} as const;

/** Raw microphone data crosses IPC only for the explicitly opted-in OpenAI provider. */
export interface DictationAudioRequest {
  audio: Uint8Array;
  mimeType: 'audio/webm' | 'audio/ogg' | 'audio/mp4';
  durationMs: number;
}
export type DictationAudioResult =
  | { ok: true; data: { text: string } }
  | { ok: false; error: string };

/** Ignore untrusted child stdout, malformed JSON and implausibly large transcripts. */
export function parseDictationEvent(line: string): DictationEvent | null {
  if (!line || line.length > 16_384) return null;
  let value: unknown;
  try { value = JSON.parse(line); } catch { return null; }
  if (!value || typeof value !== 'object') return null;
  const event = value as Record<string, unknown>;
  if (event.type === 'status' && ['starting', 'listening', 'stopped'].includes(String(event.status))) {
    return { type: 'status', status: event.status as 'starting' | 'listening' | 'stopped' };
  }
  if ((event.type === 'partial' || event.type === 'final') && typeof event.text === 'string') {
    const text = event.text.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, 4_000).trim();
    return text ? { type: event.type, text } : null;
  }
  if (event.type === 'error' && typeof event.message === 'string') {
    const message = event.message.replace(/[\u0000-\u001f]/g, ' ').slice(0, 240).trim();
    return { type: 'error', message: message || 'Speech recognition failed' };
  }
  return null;
}
