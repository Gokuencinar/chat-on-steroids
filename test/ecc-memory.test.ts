import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { listEccMemories, readEccMemory, saveEccMemory, searchEccMemories } from '../src/main/ecc-memory.js';
import { ECC_MEMORY_LIMITS, type EccMemoryProject } from '../src/shared/ecc-memory.js';

let sandbox = '';
let a: EccMemoryProject;
let b: EccMemoryProject;

beforeEach(async () => {
  sandbox = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'cos-ecc-memory-')));
  await fs.mkdir(path.join(sandbox, 'project-a'));
  await fs.mkdir(path.join(sandbox, 'project-b'));
  a = { approvedRootDirectory: sandbox, projectDirectory: await fs.realpath(path.join(sandbox, 'project-a')) };
  b = { approvedRootDirectory: sandbox, projectDirectory: await fs.realpath(path.join(sandbox, 'project-b')) };
});

afterEach(async () => {
  if (sandbox) await fs.rm(sandbox, { recursive: true, force: true });
});

const lesson = { kind: 'lesson' as const, title: 'Prefer bounded reads', body: 'Use a bounded index for log searches.', tags: ['search', 'safety'] };

describe('native ECC project memory', () => {
  it('keeps immutable Markdown documents as source of truth and returns inert metadata', async () => {
    expect(await listEccMemories(a)).toEqual([]);
    const saved = await saveEccMemory(a, lesson);
    expect(saved).toMatchObject({ kind: 'lesson', title: lesson.title, body: lesson.body, tags: lesson.tags, trust: 'unreviewed', status: 'active' });
    expect(saved.id).toMatch(/^mem_[0-9a-f]{32}$/);
    const filename = path.join(a.projectDirectory, '.ecc', 'memory', 'project', 'lessons', `${saved.id}.md`);
    const text = await fs.readFile(filename, 'utf8');
    expect(text).toContain('schema: "ecc.memory.v1"');
    expect(text).toContain('scope: "project"');
    expect(text).toContain('target_harnesses: ["cos"]');
    expect(text).toContain('links: []');
    expect(text).toContain('trust: "unreviewed"');
    expect(text).toContain(`\n\n${lesson.body}\n`);
    expect(await fs.readFile(path.join(a.projectDirectory, '.ecc', 'memory', 'project', '.gitignore'), 'utf8')).toBe('*\n!.gitignore\n');
    expect(await readEccMemory(a, { kind: 'lesson', id: saved.id })).toEqual(saved);
    const listed = await listEccMemories(a);
    expect(listed).toHaveLength(1);
    expect(listed[0]).not.toHaveProperty('body');
    expect(listed[0]).toMatchObject({ kind: 'lesson', id: saved.id, title: lesson.title });
  });

  it('isolates sibling projects, including identical memory IDs', async () => {
    const saved = await saveEccMemory(a, lesson);
    expect(await listEccMemories(b)).toEqual([]);
    expect(await searchEccMemories(b, { query: 'bounded' })).toEqual([]);
    expect(await readEccMemory(b, { kind: 'lesson', id: saved.id })).toBeNull();
    const other = await saveEccMemory(b, { ...lesson, title: 'Other project' });
    expect((await listEccMemories(a)).map(entry => entry.id)).toEqual([saved.id]);
    expect((await listEccMemories(b)).map(entry => entry.id)).toEqual([other.id]);
  });

  it('searches titles, tags and bodies lexically, with AND matching and bounded results', async () => {
    const title = await saveEccMemory(a, { kind: 'decision', title: 'Use PostgreSQL for history', body: 'Schema decision.' });
    const body = await saveEccMemory(a, { kind: 'lesson', title: 'Database notes', body: 'PostgreSQL has a robust WAL.', tags: ['postgresql'] });
    await saveEccMemory(a, { kind: 'handoff', title: 'Next deployment', body: 'Kubernetes cluster upgrade.' });
    expect((await searchEccMemories(a, { query: 'postgresql' })).map(entry => entry.id)).toEqual([title.id, body.id]);
    expect((await searchEccMemories(a, { query: 'postgresql history' })).map(entry => entry.id)).toEqual([title.id]);
    expect((await searchEccMemories(a, { query: 'postgresql', kind: 'lesson' })).map(entry => entry.id)).toEqual([body.id]);
    expect(await searchEccMemories(a, { query: 'postgresql', limit: 1 })).toHaveLength(1);
    expect(await listEccMemories(a, { kind: 'handoff' })).toHaveLength(1);
    await expect(searchEccMemories(a, { query: 'postgresql', limit: 31 })).rejects.toMatchObject({ code: 'INVALID' });
    await expect(searchEccMemories(a, { query: '' })).rejects.toMatchObject({ code: 'INVALID' });
  });

  it('rejects credential-like values without persisting them', async () => {
    const secrets = [
      'ghp_0123456789abcdefghijklmnopqrstuvwxyz',
      'AKIAIOSFODNN7EXAMPLE',
      'sk-proj-0123456789abcdefghijklmnopqrstuvwxyz',
      'client_secret=012345678901234567890',
      'Authorization: Bearer eyJhbGciOiJub25lIn0.abcd123456789'
    ];
    for (const secret of secrets) {
      await expect(saveEccMemory(a, { ...lesson, body: `Never store ${secret}` }))
        .rejects.toMatchObject({ code: 'SECRET' });
    }
    expect(await listEccMemories(a)).toEqual([]);
    await expect(fs.stat(path.join(a.projectDirectory, '.ecc'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rejects malformed IDs, traversal, kinds, tags and oversized bodies', async () => {
    await expect(readEccMemory(a, { kind: 'lesson', id: '../secrets' })).rejects.toMatchObject({ code: 'INVALID' });
    await expect(readEccMemory(a, { kind: '../project-b' as 'lesson', id: `mem_${'a'.repeat(32)}` })).rejects.toMatchObject({ code: 'INVALID' });
    await expect(saveEccMemory(a, { ...lesson, kind: '../../b' as 'lesson' })).rejects.toMatchObject({ code: 'INVALID' });
    await expect(saveEccMemory(a, { ...lesson, tags: ['a/b'] })).rejects.toMatchObject({ code: 'INVALID' });
    await expect(saveEccMemory(a, { ...lesson, body: 'x'.repeat(ECC_MEMORY_LIMITS.maxBodyBytes + 1) })).rejects.toMatchObject({ code: 'INVALID' });
    await expect(saveEccMemory(a, { ...lesson, title: 'Bad\nfrontmatter' })).rejects.toMatchObject({ code: 'INVALID' });
  });

  it('requires canonical explicit directories and a current approved root containing the project', async () => {
    await expect(listEccMemories({ ...a, approvedRootDirectory: b.projectDirectory })).rejects.toMatchObject({ code: 'ACCESS' });
    await expect(listEccMemories({ ...a, projectDirectory: '../project-a' })).rejects.toMatchObject({ code: 'ACCESS' });
    await expect(listEccMemories({ ...a, projectDirectory: `${a.projectDirectory}${path.sep}..${path.sep}project-a` }))
      .rejects.toMatchObject({ code: 'ACCESS' });
  });

  it('rejects vault directory junctions and symbolic links pointing into another project', async () => {
    await fs.mkdir(path.join(b.projectDirectory, '.ecc'));
    const link = path.join(a.projectDirectory, '.ecc');
    try { await fs.symlink(path.join(b.projectDirectory, '.ecc'), link, process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) {
      if (['EPERM', 'ENOTSUP', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) return;
      throw error;
    }
    await expect(saveEccMemory(a, lesson)).rejects.toMatchObject({ code: 'UNSAFE_PATH' });
    await expect(listEccMemories(a)).rejects.toMatchObject({ code: 'UNSAFE_PATH' });
  });

  it('rejects a linked project root even if its target is inside the approved root', async () => {
    const alias = path.join(sandbox, 'alias');
    try { await fs.symlink(a.projectDirectory, alias, process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) {
      if (['EPERM', 'ENOTSUP', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) return;
      throw error;
    }
    await expect(listEccMemories({ ...a, projectDirectory: alias })).rejects.toMatchObject({ code: 'ACCESS' });
  });

  it('refuses edited/corrupt documents and follows neither file symlinks nor arbitrary Markdown', async () => {
    const saved = await saveEccMemory(a, lesson);
    const file = path.join(a.projectDirectory, '.ecc', 'memory', 'project', 'lessons', `${saved.id}.md`);
    await fs.writeFile(file, (await fs.readFile(file, 'utf8')).replace('trust: "unreviewed"', 'trust: "verified"'));
    await expect(readEccMemory(a, { kind: 'lesson', id: saved.id })).rejects.toMatchObject({ code: 'CORRUPT' });
    await expect(listEccMemories(a)).rejects.toMatchObject({ code: 'CORRUPT' });
    await fs.rm(file);
    try { await fs.symlink(path.join(b.projectDirectory, 'elsewhere.md'), file, 'file'); }
    catch (error) {
      if (['EPERM', 'ENOTSUP', 'EACCES'].includes((error as NodeJS.ErrnoException).code ?? '')) return;
      throw error;
    }
    await expect(readEccMemory(a, { kind: 'lesson', id: saved.id })).rejects.toMatchObject({ code: 'UNSAFE_PATH' });
  });

  it('creates unique records concurrently and never overwrites an earlier entry', async () => {
    const entries = await Promise.all(Array.from({ length: 12 }, (_, i) => saveEccMemory(a, { ...lesson, title: `Lesson ${i}` })));
    expect(new Set(entries.map(entry => entry.id)).size).toBe(12);
    expect(await listEccMemories(a)).toHaveLength(12);
    for (const entry of entries) expect(await readEccMemory(a, { kind: 'lesson', id: entry.id })).toEqual(entry);
  });

  it('reports oversized or unexpected directory inventories instead of pretending a complete search', async () => {
    const entry = await saveEccMemory(a, lesson);
    const folder = path.join(a.projectDirectory, '.ecc', 'memory', 'project', 'lessons');
    await fs.writeFile(path.join(folder, 'unexpected.md'), '# Unreviewed');
    await expect(listEccMemories(a)).rejects.toMatchObject({ code: 'CORRUPT' });
    await expect(searchEccMemories(a, { query: entry.title })).rejects.toMatchObject({ code: 'CORRUPT' });
  });

  it('refuses to overwrite a changed ignore rule that would accidentally publish memories into git', async () => {
    await saveEccMemory(a, lesson);
    const ignore = path.join(a.projectDirectory, '.ecc', 'memory', 'project', '.gitignore');
    await fs.writeFile(ignore, '# deliberately changed\n');
    await expect(saveEccMemory(a, lesson)).rejects.toMatchObject({ code: 'UNSAFE_PATH' });
    expect(await listEccMemories(a)).toHaveLength(1);
  });
});
