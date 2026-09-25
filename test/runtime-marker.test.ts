import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { beginRuntimeMarker, clearRuntimeMarkerSync } from '../src/main/runtime-marker.js';
import { makeTempDir, removeTempDir } from './helpers.js';

let temp: string | null = null;

afterEach(async () => {
  clearRuntimeMarkerSync();
  if (temp) await removeTempDir(temp);
  temp = null;
});

describe('runtime marker', () => {
  it('distinguishes a previous unclean run and clears only at the explicit shutdown boundary', async () => {
    temp = await makeTempDir('clf-runtime-marker-');
    const first = { pid: 101, startedAt: '2026-09-25T00:00:00.000Z' };
    const second = { pid: 202, startedAt: '2026-09-25T00:01:00.000Z' };

    expect(await beginRuntimeMarker(temp, first)).toBeNull();
    expect(await beginRuntimeMarker(temp, second)).toEqual(first);

    const markerPath = path.join(temp, '.runtime-active.json');
    expect(JSON.parse(await fs.readFile(markerPath, 'utf8'))).toEqual(second);
    expect(clearRuntimeMarkerSync()).toBeNull();
    await expect(fs.stat(markerPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('reports an unreadable leftover while replacing it with a valid current marker', async () => {
    temp = await makeTempDir('clf-runtime-marker-invalid-');
    const markerPath = path.join(temp, '.runtime-active.json');
    await fs.writeFile(markerPath, '{broken', 'utf8');

    const current = { pid: 303, startedAt: '2026-09-25T00:02:00.000Z' };
    expect(await beginRuntimeMarker(temp, current)).toBe('unreadable');
    expect(JSON.parse(await fs.readFile(markerPath, 'utf8'))).toEqual(current);
  });
});
