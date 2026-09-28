import { promises as fs, rmSync } from 'node:fs';
import path from 'node:path';

const MARKER_NAME = '.runtime-active.json';

export interface RuntimeMarker {
  pid: number;
  startedAt: string;
}

export type PreviousRuntimeMarker = RuntimeMarker | 'unreadable' | null;

let activeMarkerPath: string | null = null;

function validMarker(value: unknown): value is RuntimeMarker {
  if (!value || typeof value !== 'object') return false;
  const marker = value as Partial<RuntimeMarker>;
  return Number.isInteger(marker.pid) && (marker.pid ?? 0) > 0 && typeof marker.startedAt === 'string' && marker.startedAt.length > 0;
}

/**
 * Leaves one tiny process-lifetime marker in userData. Normal shutdown removes it only after the
 * ordered teardown has completed; if the main process is killed or crashes natively, the next
 * start can report that the previous run ended without the normal shutdown path.
 */
export async function beginRuntimeMarker(
  userData: string,
  current: RuntimeMarker = { pid: process.pid, startedAt: new Date().toISOString() }
): Promise<PreviousRuntimeMarker> {
  activeMarkerPath = path.join(userData, MARKER_NAME);
  let previous: PreviousRuntimeMarker = null;
  try {
    const raw = await fs.readFile(activeMarkerPath, 'utf8');
    try {
      const parsed: unknown = JSON.parse(raw);
      previous = validMarker(parsed) ? parsed : 'unreadable';
    } catch {
      previous = 'unreadable';
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') previous = 'unreadable';
  }

  await fs.writeFile(activeMarkerPath, `${JSON.stringify(current)}\n`, 'utf8');
  return previous;
}

/** Best-effort synchronous removal at the exact completed-shutdown boundary. */
export function clearRuntimeMarkerSync(): string | null {
  if (!activeMarkerPath) return null;
  try {
    rmSync(activeMarkerPath, { force: true });
    activeMarkerPath = null;
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
