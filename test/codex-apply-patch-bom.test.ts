import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { executeApplyPatch } from '../src/main/codex/apply-patch/index.js';

const roots: string[] = [];
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'cos-apply-patch-bom-'));
  roots.push(root);
  return root;
}

describe('apply_patch preserves a UTF-8 BOM', () => {
  afterEach(async () => {
    await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })));
  });

  it('keeps the mark when updating a later line in a Windows PowerShell script', async () => {
    const root = await tempRoot();
    const file = path.join(root, 'greet.ps1');
    const input = Buffer.from('$name = "Zoë"\nWrite-Host "Hi $name"\n');
    await writeFile(file, Buffer.concat([BOM, input]));
    const result = await executeApplyPatch({ cwd: root, patch: `*** Begin Patch
*** Update File: greet.ps1
@@
-Write-Host "Hi $name"
+Write-Host "Hello $name"
*** End Patch` });
    expect(result.exitCode).toBe(0);
    expect(await readFile(file)).toEqual(Buffer.concat([BOM, Buffer.from('$name = "Zoë"\nWrite-Host "Hello $name"\n')]));
  });

  it('keeps the mark even when updating the first line', async () => {
    const root = await tempRoot();
    const file = path.join(root, 'Program.cs');
    await writeFile(file, Buffer.concat([BOM, Buffer.from('using System;\nclass Program {}\n')]));
    const result = await executeApplyPatch({ cwd: root, patch: `*** Begin Patch
*** Update File: Program.cs
@@
-using System;
+using System.Text;
 class Program {}
*** End Patch` });
    expect(result.exitCode).toBe(0);
    expect(await readFile(file)).toEqual(Buffer.concat([BOM, Buffer.from('using System.Text;\nclass Program {}\n')]));
  });

  it('does not introduce a mark when the input has none', async () => {
    const root = await tempRoot();
    const file = path.join(root, 'plain.txt');
    await writeFile(file, 'one\ntwo\n');
    const result = await executeApplyPatch({ cwd: root, patch: `*** Begin Patch
*** Update File: plain.txt
@@
-two
+three
*** End Patch` });
    expect(result.exitCode).toBe(0);
    expect(await readFile(file)).toEqual(Buffer.from('one\nthree\n'));
  });
});
