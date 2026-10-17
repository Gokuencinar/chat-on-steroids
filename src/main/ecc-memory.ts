/**
 * ECC-inspired project memory vault. Markdown files are authoritative; entries are untrusted
 * data, never instructions. This module owns NO approval, project selection or prompt injection.
 * Callers must resolve the explicit project against live approved roots before EACH operation.
 *
 * The module additionally checks canonical containment and rejects symlinks/junctions throughout
 * its own storage paths. Like other Node filesystem operations, this cannot secure against a
 * hostile process running concurrently as the same OS user swapping parent directories.
 */
import { randomBytes } from 'node:crypto';
import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';
import {
  ECC_MEMORY_KINDS,
  ECC_MEMORY_LIMITS,
  type EccMemoryEntry,
  type EccMemoryFilter,
  type EccMemoryKey,
  type EccMemoryKind,
  type EccMemoryProject,
  type EccMemorySave,
  type EccMemorySearch,
  type EccMemorySummary
} from '../shared/ecc-memory.js';

export class EccMemoryError extends Error {
  constructor(readonly code: 'ACCESS' | 'INVALID' | 'SECRET' | 'UNSAFE_PATH' | 'CORRUPT' | 'LIMIT', message: string) {
    super(message);
    this.name = 'EccMemoryError';
  }
}

const KIND_SET: ReadonlySet<string> = new Set(ECC_MEMORY_KINDS);
const ID = /^mem_[a-f0-9]{32}$/;
const TAG = /^[a-z0-9][a-z0-9._-]{0,31}$/;
const FIELD_NAMES = [
  'schema', 'id', 'title', 'kind', 'scope', 'trust', 'status', 'source_harness',
  'target_harnesses', 'tags', 'links', 'created_at', 'updated_at'
] as const;
const decoder = new TextDecoder('utf-8', { fatal: true });
const ROOT_PARTS = ['.ecc', 'memory', 'project'] as const;
const MEMORY_GITIGNORE = '*\n!.gitignore\n';
const KIND_DIRECTORY: Record<EccMemoryKind, string> = {
  decision: 'decisions', lesson: 'lessons', handoff: 'handoffs'
};
const MAX_SCAN_FILES = ECC_MEMORY_KINDS.length * ECC_MEMORY_LIMITS.maxEntriesPerKind;

function invalid(message: string): never { throw new EccMemoryError('INVALID', message); }
function unsafe(message: string): never { throw new EccMemoryError('UNSAFE_PATH', message); }
function corrupt(message: string): never { throw new EccMemoryError('CORRUPT', message); }

async function safely<T>(operation: () => Promise<T>): Promise<T> {
  try { return await operation(); }
  catch (error) {
    if (error instanceof EccMemoryError) throw error;
    // Node's raw EACCES/ENOENT messages include the user's private host path.
    if (typeof (error as NodeJS.ErrnoException)?.code === 'string')
      throw new EccMemoryError('ACCESS', 'Project memory filesystem operation failed');
    throw error;
  }
}

function samePath(left: string, right: string): boolean {
  const a = path.resolve(left);
  const b = path.resolve(right);
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

function within(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function validatePathInput(input: unknown): string {
  if (typeof input !== 'string' || !input || input.length > 32768 || !path.isAbsolute(input) || input.includes('\0'))
    throw new EccMemoryError('ACCESS', 'Memory requires an explicit approved absolute project path');
  // Explicit canonical absolute strings: do not silently turn traversal into another project.
  if (!samePath(path.normalize(input), input) || input.split(/[\\/]/).includes('..'))
    throw new EccMemoryError('ACCESS', 'Memory path must be normalized and contain no traversal');
  return input;
}

/** Revalidate the approval and actual project binding at the point of use. */
async function projectRoot(access: EccMemoryProject): Promise<string> {
  if (!access || typeof access !== 'object')
    throw new EccMemoryError('ACCESS', 'Memory requires an explicitly selected project');
  const approved = validatePathInput(access.approvedRootDirectory);
  const project = validatePathInput(access.projectDirectory);
  let approvedReal: string, projectReal: string;
  try {
    approvedReal = await fs.realpath(approved);
    projectReal = await fs.realpath(project);
    if (!(await fs.stat(approvedReal)).isDirectory() || !(await fs.stat(projectReal)).isDirectory())
      throw new Error('not a directory');
  } catch {
    throw new EccMemoryError('ACCESS', 'Approved root or selected project is unavailable');
  }
  if (!samePath(projectReal, project) || !within(approvedReal, projectReal))
    throw new EccMemoryError('ACCESS', 'Project is not canonical or is outside the approved root');
  if ((await fs.lstat(project)).isSymbolicLink())
    unsafe('A project memory root cannot be a junction or symbolic link');
  return projectReal;
}

async function directory(root: string, candidate: string, create: boolean): Promise<boolean> {
  if (!within(root, candidate)) unsafe('Memory directory would leave the selected project');
  let stat;
  try {
    stat = await fs.lstat(candidate);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (!create) return false;
    try { await fs.mkdir(candidate, { mode: 0o700 }); }
    catch (race) { if ((race as NodeJS.ErrnoException).code !== 'EEXIST') throw race; }
    stat = await fs.lstat(candidate);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) unsafe('Memory directory is a file, link or junction');
  const real = await fs.realpath(candidate);
  if (!samePath(candidate, real) || !within(root, real)) unsafe('Memory directory resolves outside the selected project');
  return true;
}

/** All relative segments here are compile-time constants or a validated kind. */
async function kindDirectory(root: string, kind: EccMemoryKind, create: boolean): Promise<string | null> {
  let next = root;
  for (const segment of [...ROOT_PARTS, KIND_DIRECTORY[kind]]) {
    next = path.join(next, segment);
    if (!(await directory(root, next, create))) return null;
  }
  return next;
}

/** Prevent accidental commits of local session knowledge, as ECC does for project vaults. */
async function ensureGitIgnore(root: string): Promise<void> {
  const folder = path.join(root, ...ROOT_PARTS);
  if (!(await directory(root, folder, false))) unsafe('Memory vault directory is unavailable');
  const ignore = path.join(folder, '.gitignore');
  let handle;
  try { handle = await fs.open(ignore, 'wx', 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  if (handle) {
    try { await handle.writeFile(MEMORY_GITIGNORE); await handle.sync(); }
    finally { await handle.close(); }
  }
  const stat = await fs.lstat(ignore);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 ||
      !samePath(await fs.realpath(ignore), ignore) ||
      (await fs.readFile(ignore, 'utf8')) !== MEMORY_GITIGNORE)
    unsafe('Project memory requires its unchanged private .gitignore');
}

function requireKind(value: unknown): asserts value is EccMemoryKind {
  if (typeof value !== 'string' || !KIND_SET.has(value)) invalid('Unknown memory kind');
}

function requireKey(key: EccMemoryKey): void {
  if (!key || typeof key !== 'object') invalid('Memory key is required');
  requireKind(key.kind);
  if (typeof key.id !== 'string' || !ID.test(key.id)) invalid('Invalid memory ID');
}

function assertInertText(value: string): void {
  // Prevent storage of common credential shapes; conservative by design, not a DLP guarantee.
  const suspect = [
    /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i,
    /\b(?:gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,})\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\b(?:sk-(?:proj-|live-|test-)?[a-zA-Z0-9_-]{16,}|sk-ant-[a-zA-Z0-9_-]{16,})\b/,
    /\b(?:api[_-]?key|access[_-]?token|secret|password|passwd|client[_-]?secret)\s*[:=]\s*["']?\S{12,}/i,
    /\b(?:authorization\s*:\s*bearer\s+)[a-z0-9._~+/-]{12,}/i
  ];
  if (suspect.some(pattern => pattern.test(value)))
    throw new EccMemoryError('SECRET', 'Memory cannot store a possible credential or private key');
}

function validatedSave(input: EccMemorySave): EccMemorySave & { tags: string[] } {
  if (!input || typeof input !== 'object') invalid('Memory content is required');
  requireKind(input.kind);
  if (typeof input.title !== 'string' || input.title.trim().length === 0 ||
      input.title.length > ECC_MEMORY_LIMITS.maxTitleChars || /[\r\n\x00-\x1f\x7f]/.test(input.title)) invalid('Invalid memory title');
  if (typeof input.body !== 'string' || !input.body.trim() ||
      Buffer.byteLength(input.body, 'utf8') > ECC_MEMORY_LIMITS.maxBodyBytes ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input.body)) invalid('Invalid or oversized memory body');
  const tags = input.tags ?? [];
  if (!Array.isArray(tags) || tags.length > ECC_MEMORY_LIMITS.maxTags ||
      tags.some(tag => typeof tag !== 'string' || !TAG.test(tag)) || new Set(tags).size !== tags.length)
    invalid('Invalid memory tags');
  assertInertText(`${input.title}\n${input.body}\n${tags.join(' ')}`);
  return { kind: input.kind, title: input.title.trim(), body: input.body, tags };
}

function markdown(entry: EccMemoryEntry): string {
  const fields = [
    ['schema', 'ecc.memory.v1'],
    ['id', entry.id], ['title', entry.title], ['kind', entry.kind],
    ['scope', 'project'], ['trust', 'unreviewed'], ['status', 'active'],
    ['source_harness', 'cos'], ['target_harnesses', ['cos']],
    ['tags', entry.tags], ['links', []],
    ['created_at', entry.createdAt], ['updated_at', entry.createdAt]
  ] as const;
  return `---\n${fields.map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n${entry.body}\n`;
}

function parseDocument(source: string, key: EccMemoryKey): EccMemoryEntry {
  const marker = '\n---\n\n';
  const last = source.indexOf(marker, 4);
  if (!source.startsWith('---\n') || last < 0) corrupt('Memory has invalid Markdown frontmatter');
  const lines = source.slice(4, last).split('\n');
  if (lines.length !== FIELD_NAMES.length) corrupt('Memory metadata fields have changed');
  const fields: Record<string, unknown> = {};
  for (let i = 0; i < FIELD_NAMES.length; i++) {
    const keyName = FIELD_NAMES[i]!;
    const prefix = `${keyName}: `;
    if (!lines[i]!.startsWith(prefix)) corrupt('Memory metadata is not in canonical format');
    try { fields[keyName] = JSON.parse(lines[i]!.slice(prefix.length)) as unknown; }
    catch { corrupt('Memory metadata is not valid JSON-valued YAML'); }
  }
  const bodyWithTrailingNewline = source.slice(last + marker.length);
  if (!bodyWithTrailingNewline.endsWith('\n')) corrupt('Memory document is truncated');
  const body = bodyWithTrailingNewline.slice(0, -1);
  if (fields.schema !== 'ecc.memory.v1' || fields.id !== key.id || fields.kind !== key.kind ||
      fields.scope !== 'project' || fields.trust !== 'unreviewed' ||
      fields.status !== 'active' || fields.source_harness !== 'cos' ||
      JSON.stringify(fields.target_harnesses) !== '["cos"]' || JSON.stringify(fields.links) !== '[]' ||
      fields.updated_at !== fields.created_at ||
      typeof fields.created_at !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(fields.created_at))
    corrupt('Memory identity or schema is invalid');
  try {
    const checked = validatedSave({ kind: key.kind, title: fields.title as string, tags: fields.tags as string[], body });
    if (checked.title !== fields.title) corrupt('Memory title was changed');
    return { id: key.id, kind: key.kind, title: checked.title, body: checked.body,
      tags: checked.tags, createdAt: fields.created_at, trust: 'unreviewed', status: 'active' };
  } catch (error) {
    if (error instanceof EccMemoryError) corrupt('Stored memory failed validation');
    throw error;
  }
}

async function readFile(root: string, folder: string, key: EccMemoryKey): Promise<EccMemoryEntry | null> {
  const name = `${key.id}.md`;
  const file = path.join(folder, name);
  if (!within(root, file)) unsafe('Memory file would leave the selected project');
  let stat;
  try { stat = await fs.lstat(file); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > ECC_MEMORY_LIMITS.maxDocumentBytes)
    unsafe('Memory file is unsafe or oversized');
  if (!samePath(await fs.realpath(file), file)) unsafe('Memory file resolves through a link');
  const handle = await fs.open(file, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const current = await handle.stat();
    if (!current.isFile() || current.nlink !== 1 || current.size > ECC_MEMORY_LIMITS.maxDocumentBytes ||
        (stat.ino && current.ino && stat.ino !== current.ino)) unsafe('Memory file changed before reading');
    const bytes = await handle.readFile();
    if (bytes.length > ECC_MEMORY_LIMITS.maxDocumentBytes) unsafe('Memory file exceeded its size limit');
    let value: string;
    try { value = decoder.decode(bytes); }
    catch { return corrupt('Memory document contains invalid UTF-8'); }
    return parseDocument(value, key);
  } finally { await handle.close(); }
}

async function allEntries(root: string, kind?: EccMemoryKind): Promise<EccMemoryEntry[]> {
  const result: EccMemoryEntry[] = [];
  for (const selected of kind ? [kind] : ECC_MEMORY_KINDS) {
    const folder = await kindDirectory(root, selected, false);
    if (!folder) continue;
    const files = await fs.readdir(folder);
    if (files.length > ECC_MEMORY_LIMITS.maxEntriesPerKind)
      throw new EccMemoryError('LIMIT', 'Project memory directory reached its scan limit');
    for (const name of files) {
      if (!ID.test(name.replace(/\.md$/, '')) || !name.endsWith('.md')) corrupt('Unexpected item in project memory directory');
      const entry = await readFile(root, folder, { kind: selected, id: name.slice(0, -3) });
      if (!entry) corrupt('Memory file disappeared during scan');
      result.push(entry);
    }
  }
  if (result.length > MAX_SCAN_FILES) throw new EccMemoryError('LIMIT', 'Memory scan limit exceeded');
  return result;
}

function limitOf(filter: EccMemoryFilter): number {
  const limit = filter.limit ?? ECC_MEMORY_LIMITS.maxResults;
  if (!Number.isInteger(limit) || limit < 1 || limit > ECC_MEMORY_LIMITS.maxResults) invalid('Invalid memory result limit');
  if (filter.kind !== undefined) requireKind(filter.kind);
  return limit;
}

function summary(entry: EccMemoryEntry): EccMemorySummary {
  const { body: _body, ...metadata } = entry;
  return metadata;
}

/** Save exactly one new, immutable entry; never update or silently promote memories. */
export async function saveEccMemory(access: EccMemoryProject, input: EccMemorySave): Promise<EccMemoryEntry> {
  return safely(async () => {
  const data = validatedSave(input);
  const root = await projectRoot(access);
  const folder = await kindDirectory(root, data.kind, true);
  if (!folder) throw new EccMemoryError('ACCESS', 'Memory directory unavailable');
  await ensureGitIgnore(root);
  const files = await fs.readdir(folder);
  if (files.length >= ECC_MEMORY_LIMITS.maxEntriesPerKind)
    throw new EccMemoryError('LIMIT', 'Project memory kind is full');
  const entry: EccMemoryEntry = {
    id: `mem_${randomBytes(16).toString('hex')}`, kind: data.kind, title: data.title,
    body: data.body, tags: data.tags, createdAt: new Date().toISOString(),
    status: 'active', trust: 'unreviewed'
  };
  const file = path.join(folder, `${entry.id}.md`);
  const contents = markdown(entry);
  if (Buffer.byteLength(contents, 'utf8') > ECC_MEMORY_LIMITS.maxDocumentBytes) invalid('Memory document is too large');
  // Exclusive create protects existing IDs. A failed/interrupted write may leave an invalid
  // document, which readers reject visibly instead of treating it as trusted knowledge.
  await directory(root, folder, false);
  const handle = await fs.open(file, 'wx', 0o600);
  try { await handle.writeFile(contents, 'utf8'); await handle.sync(); }
  finally { await handle.close(); }
  return entry;
  });
}

/** Read by explicit kind+ID; missing vaults are empty, damaged vaults fail visibly. */
export async function readEccMemory(access: EccMemoryProject, key: EccMemoryKey): Promise<EccMemoryEntry | null> {
  return safely(async () => {
  requireKey(key);
  const root = await projectRoot(access);
  const folder = await kindDirectory(root, key.kind, false);
  return folder ? readFile(root, folder, key) : null;
  });
}

/** List metadata only; never return stored bodies in incidental UI projections. */
export async function listEccMemories(access: EccMemoryProject, filter: EccMemoryFilter = {}): Promise<EccMemorySummary[]> {
  return safely(async () => {
  const count = limitOf(filter);
  const root = await projectRoot(access);
  return (await allEntries(root, filter.kind))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .slice(0, count).map(summary);
  });
}

/** Bounded, deterministic lexical search; no network, embeddings or implicit context recall. */
export async function searchEccMemories(access: EccMemoryProject, filter: EccMemorySearch): Promise<EccMemorySummary[]> {
  return safely(async () => {
  if (!filter || typeof filter.query !== 'string' || !filter.query.trim() ||
      filter.query.length > ECC_MEMORY_LIMITS.maxQueryChars) invalid('A bounded non-empty search query is required');
  const count = limitOf(filter);
  const tokens = [...new Set(filter.query.toLocaleLowerCase().trim().split(/\s+/u))];
  if (tokens.length > 8) invalid('Too many memory search terms');
  const root = await projectRoot(access);
  return (await allEntries(root, filter.kind)).map(entry => {
    const title = entry.title.toLocaleLowerCase();
    const tags = entry.tags.join(' ').toLocaleLowerCase();
    const body = entry.body.toLocaleLowerCase();
    const score = tokens.every(token => title.includes(token) || tags.includes(token) || body.includes(token))
      ? tokens.reduce((total, token) => total + (title.includes(token) ? 6 : 0) +
          (tags.includes(token) ? 3 : 0) + (body.includes(token) ? 1 : 0), 0)
      : 0;
    return { entry, score };
  }).filter(hit => hit.score > 0)
    .sort((a, b) => b.score - a.score || b.entry.createdAt.localeCompare(a.entry.createdAt) || b.entry.id.localeCompare(a.entry.id))
    .slice(0, count).map(hit => summary(hit.entry));
  });
}
