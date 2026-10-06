import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { expect, it } from 'vitest';

it.skipIf(process.platform !== 'win32')('selects stable fork releases through API throttling without hiding other failures or executing updater main', () => {
  const output = execFileSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
    '-File', path.resolve('test/fixtures/updater-release-selection.ps1'), '-Root', process.cwd()], { encoding: 'utf8', windowsHide: true, timeout: 20_000 });
  expect(output).toContain('Release selection assertions passed; no installer or application code executed.');
});
