/**
 * Local, disabled-by-default learning engine inspired by ECC continuous-learning-v2.
 * The recorder must provide exact project binding and already classified safe signals.
 * This is NOT a Claude hook or LLM observer. No raw content is inspected, no prompts
 * are augmented and no generated skill/command is installed automatically.
 *
 * Security boundary: caller verifies the live project and current sandbox capabilities;
 * this module ALSO revalidates project containment, storage links, formats and limits.
 * In-process serialized atomic renames do not protect against a malicious external
 * same-user filesystem writer swapping directories during filesystem syscalls.
 */
import { createHash, randomBytes } from 'node:crypto';
import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';
import { effectiveCapabilities, getConfig } from './config.js';
import {
  ECC_LEARNING_LIMITS,
  type EccLearningAccess, type EccLearningBundle, type EccLearningConfig,
  type EccLearningCorrection, type EccLearningInstinct, type EccLearningObservation,
  type EccLearningPromotionCandidate, type EccLearningProposal,
  type EccLearningReceipt, type EccLearningStatus, type EccLearningTool
} from '../shared/ecc-learning.js';

export class EccLearningError extends Error {
  constructor(readonly code: 'ACCESS' | 'UNSAFE_PATH' | 'INVALID' | 'CORRUPT' | 'LIMIT' | 'DISABLED', message: string) {
    super(message);
    this.name = 'EccLearningError';
  }
}

interface JournalEvent {
  digest: string;
  run: string;
  at: string;
  type: EccLearningObservation['type'];
  tool?: EccLearningTool;
  outcome?: 'ok' | 'error';
  preference?: EccLearningCorrection;
  instinctId?: string;
  verdict?: 'confirm' | 'contradict';
}
interface LearningState {
  schema: 'cos.ecc-learning.project.v1';
  projectId: string;
  config: EccLearningConfig;
  observations: JournalEvent[];
  instincts: EccLearningInstinct[];
  /** Unprocessed local journal IDs; not raw tool data. */
  pending: string[];
  lastAnalyzedAt: string | null;
}
interface Pattern { trigger: string; action: string; domain: EccLearningInstinct['domain'] }

// Intentionally NO free-form agent- or user-provided prose and no external commands.
const PATTERNS: Readonly<Record<string, Pattern>> = {
  'correction-search-before-edit': { trigger: 'Before changing code', action: 'Search for existing implementations first', domain: 'user-correction' },
  'correction-read-before-edit': { trigger: 'Before editing an existing file', action: 'Read the current source before making changes', domain: 'user-correction' },
  'correction-test-after-edit': { trigger: 'After changing program behavior', action: 'Run relevant tests and report the result', domain: 'user-correction' },
  'correction-test-before-fix': { trigger: 'When addressing a reported defect', action: 'Create or run a reproducing test first', domain: 'user-correction' },
  'correction-confirm-before-delete': { trigger: 'Before destructive operations', action: 'Seek explicit approval and verify target paths', domain: 'user-correction' },
  'correction-bounded-retries': { trigger: 'When a tool operation repeatedly fails', action: 'Diagnose the cause instead of retrying indefinitely', domain: 'user-correction' },
  'workflow-search-read-edit': { trigger: 'When implementing an existing feature', action: 'Search then read the implementation before editing', domain: 'workflow' },
  'workflow-read-edit-test': { trigger: 'When modifying code in an existing project', action: 'Read, edit, then run the relevant tests', domain: 'workflow' },
  'error-resolution-test-edit-test': { trigger: 'When a test fails before an attempted fix', action: 'Apply a focused edit and rerun the same class of test', domain: 'debugging' }
} as const;
const ID_SET = new Set(Object.keys(PATTERNS));
const TOOLS = new Set(['search', 'read', 'edit', 'test', 'build']);
const CORRECTIONS = new Set(['search-before-edit', 'read-before-edit', 'test-after-edit', 'test-before-fix', 'confirm-before-delete', 'bounded-retries']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN = /^[a-zA-Z0-9_-]{8,96}$/;
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const DECODER = new TextDecoder('utf-8', { fatal: true });
const locks = new Map<string, Promise<unknown>>();
interface Pending { access: EccLearningAccess; events: Array<{ event: EccLearningObservation; resolve: (value: EccLearningReceipt) => void; reject: (error: unknown) => void }> }
const batches = new Map<string, Pending>();
const ANALYSIS_INTERVAL_MS = 5 * 60_000;
const MAX_ARMED_TIMERS = 32;
/** At most one unref'd, one-shot timer per active project. No timer holds Node open. */
const analysisTimers = new Map<string, NodeJS.Timeout>();

function cancelAnalysisTimer(key: string): void {
  const timer = analysisTimers.get(key);
  if (timer) clearTimeout(timer);
  analysisTimers.delete(key);
}
// A normal Node process exit needs no async writes; already-committed pending
// evidence survives on disk and can be rearmed on the next project status/read.
process.once('exit', () => {
  for (const key of analysisTimers.keys()) cancelAnalysisTimer(key);
});

function fail(code: EccLearningError['code'], message: string): never { throw new EccLearningError(code, message); }
function validKeys(value: object, keys: readonly string[]): boolean { return Object.keys(value).every(key => keys.includes(key)); }
function isInside(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}
function equalsPath(a: string, b: string): boolean {
  return process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b);
}
function pathInput(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 32768 || !path.isAbsolute(value) || value.includes('\0') ||
      value.split(/[\\/]/).includes('..') || !equalsPath(value, path.normalize(value)))
    fail('ACCESS', 'Learning requires an explicitly approved canonical project path');
  return value;
}
function accessId(access: EccLearningAccess): string {
  if (!access || typeof access !== 'object' || !UUID.test(access.projectId || ''))
    fail('ACCESS', 'Learning requires a selected CoS project UUID');
  return access.projectId.toLowerCase();
}
function storageKey(access: EccLearningAccess): string {
  const id = accessId(access);
  const project = pathInput(access.projectDirectory);
  pathInput(access.approvedRootDirectory);
  return `${id}:${process.platform === 'win32' ? project.toLowerCase() : project}`;
}
async function ensureAccess(access: EccLearningAccess): Promise<string> {
  accessId(access);
  const project = pathInput(access.projectDirectory);
  const approved = pathInput(access.approvedRootDirectory);
  let realProject: string;
  let realRoot: string;
  try {
    realProject = await fs.realpath(project);
    realRoot = await fs.realpath(approved);
    if (!(await fs.stat(realProject)).isDirectory() || !(await fs.stat(realRoot)).isDirectory())
      throw new Error('not directory');
  } catch { return fail('ACCESS', 'Selected project or approved root no longer exists'); }
  if (!equalsPath(realProject, project) || !isInside(realRoot, realProject) ||
      (await fs.lstat(project)).isSymbolicLink())
    fail('ACCESS', 'Selected learning project is not canonical or approved');
  return realProject;
}
async function folder(parent: string, candidate: string, create: boolean): Promise<boolean> {
  if (!isInside(parent, candidate)) fail('UNSAFE_PATH', 'Learning path escaped its project');
  let stat;
  try { stat = await fs.lstat(candidate); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    if (!create) return false;
    try { await fs.mkdir(candidate, { mode: 0o700 }); }
    catch (race) { if ((race as NodeJS.ErrnoException).code !== 'EEXIST') throw race; }
    stat = await fs.lstat(candidate);
  }
  if (!stat.isDirectory() || stat.isSymbolicLink() || !equalsPath(await fs.realpath(candidate), candidate))
    fail('UNSAFE_PATH', 'Learning storage contains a linked or invalid directory');
  return true;
}
async function learningDir(project: string, create: boolean): Promise<string | null> {
  const ecc = path.join(project, '.ecc');
  if (!(await folder(project, ecc, create))) return null;
  const learning = path.join(ecc, 'learning');
  return (await folder(project, learning, create)) ? learning : null;
}
async function safeFile(file: string): Promise<boolean> {
  let stat;
  try { stat = await fs.lstat(file); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || !equalsPath(await fs.realpath(file), file))
    fail('UNSAFE_PATH', 'Learning data file is linked or unsafe');
  return true;
}
async function readBounded(file: string, limit = ECC_LEARNING_LIMITS.maxStateBytes): Promise<string | null> {
  if (!(await safeFile(file))) return null;
  const h = await fs.open(file, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const stat = await h.stat();
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > limit) fail('LIMIT', 'Learning data exceeds its storage limit');
    const data = await h.readFile();
    if (data.length > limit) fail('LIMIT', 'Learning data exceeds its storage limit');
    try { return DECODER.decode(data); }
    catch { return fail('CORRUPT', 'Learning data is not valid UTF-8'); }
  } finally { await h.close(); }
}
async function atomic(file: string, body: string): Promise<void> {
  if (Buffer.byteLength(body, 'utf8') > ECC_LEARNING_LIMITS.maxStateBytes) fail('LIMIT', 'Learning state is too large');
  await safeFile(file);
  const temp = path.join(path.dirname(file), `.learning-${randomBytes(12).toString('hex')}.tmp`);
  const handle = await fs.open(temp, 'wx', 0o600);
  try { await handle.writeFile(body, 'utf8'); await handle.sync(); }
  finally { await handle.close(); }
  try { await safeFile(file); await fs.rename(temp, file); }
  finally { await fs.rm(temp, { force: true }); }
}
async function privacyIgnore(dir: string): Promise<void> {
  const ignore = path.join(dir, '.gitignore');
  if (!(await safeFile(ignore))) {
    try { const h = await fs.open(ignore, 'wx', 0o600);
      try { await h.writeFile('*\n!.gitignore\n'); await h.sync(); } finally { await h.close(); }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  }
  if ((await readBounded(ignore, 100)) !== '*\n!.gitignore\n')
    fail('UNSAFE_PATH', 'Learning .gitignore protection was changed');
}
function blank(id: string): LearningState {
  return { schema: 'cos.ecc-learning.project.v1', projectId: id, config: { enabled: false }, observations: [],
    instincts: [], pending: [], lastAnalyzedAt: null };
}
function finiteConfidence(value: unknown): value is number { return typeof value === 'number' && Number.isFinite(value) && value >= 0.3 && value <= 0.9; }
function validateInstinct(value: unknown): value is EccLearningInstinct {
  if (!value || typeof value !== 'object') return false;
  const v = value as EccLearningInstinct;
  const p = PATTERNS[v.id];
  return !!p && v.trigger === p.trigger && v.action === p.action && v.domain === p.domain &&
    finiteConfidence(v.confidence) && Number.isSafeInteger(v.supports) && v.supports >= 0 && v.supports <= 1_000_000 &&
    Number.isSafeInteger(v.contradictions) && v.contradictions >= 0 && v.contradictions <= 1_000_000 &&
    typeof v.lastSeenAt === 'string' && ISO.test(v.lastSeenAt) && !Number.isNaN(Date.parse(v.lastSeenAt)) &&
    (v.source === 'observed' || v.source === 'imported') && v.scope === 'project' && typeof v.approved === 'boolean' &&
    validKeys(v, ['id', 'trigger', 'action', 'domain', 'confidence', 'supports', 'contradictions', 'lastSeenAt', 'source', 'scope', 'approved']);
}
function validateStored(value: unknown, id: string): LearningState {
  if (!value || typeof value !== 'object') return fail('CORRUPT', 'Learning state is malformed');
  const v = value as LearningState;
  if (v.schema !== 'cos.ecc-learning.project.v1' || v.projectId !== id || !v.config ||
    typeof v.config.enabled !== 'boolean' || !validKeys(v.config, ['enabled']) ||
    !Array.isArray(v.observations) || !Array.isArray(v.instincts) || !Array.isArray(v.pending) ||
    v.observations.length > ECC_LEARNING_LIMITS.maxJournal || v.instincts.length > ECC_LEARNING_LIMITS.maxInstincts ||
    v.pending.length > ECC_LEARNING_LIMITS.maxJournal ||
    (v.lastAnalyzedAt !== null && (typeof v.lastAnalyzedAt !== 'string' || !ISO.test(v.lastAnalyzedAt))) ||
    !validKeys(v, ['schema', 'projectId', 'config', 'observations', 'instincts', 'pending', 'lastAnalyzedAt']))
    return fail('CORRUPT', 'Learning state has invalid schema, scope or bounds');
  const seen = new Set<string>();
  const seenInstinct = new Set<string>();
  for (const row of v.observations) {
    const permitted = row?.type === 'tool'
      ? ['digest', 'run', 'at', 'type', 'tool', 'outcome']
      : row?.type === 'correction'
        ? ['digest', 'run', 'at', 'type', 'preference']
        : ['digest', 'run', 'at', 'type', 'instinctId', 'verdict'];
    if (!row || typeof row !== 'object' || !/^[a-f0-9]{64}$/.test(row.digest) ||
      !/^[a-f0-9]{64}$/.test(row.run) || !ISO.test(row.at) || Number.isNaN(Date.parse(row.at)) ||
      !['tool', 'correction', 'feedback'].includes(row.type) ||
      !validKeys(row, permitted) ||
      (row.type === 'tool' && (!TOOLS.has(row.tool ?? '') || !['ok', 'error'].includes(row.outcome ?? ''))) ||
      (row.type === 'correction' && !CORRECTIONS.has(row.preference ?? '')) ||
      (row.type === 'feedback' && (!ID_SET.has(row.instinctId ?? '') || !['confirm', 'contradict'].includes(row.verdict ?? ''))) ||
      seen.has(row.digest)) return fail('CORRUPT', 'Learning journal contains invalid or duplicate data');
    seen.add(row.digest);
  }
  for (const instinct of v.instincts) {
    if (!validateInstinct(instinct) || seenInstinct.has(instinct.id))
      return fail('CORRUPT', 'Learning contains an invalid instinct');
    seenInstinct.add(instinct.id);
  }
  if (new Set(v.pending).size !== v.pending.length || v.pending.some(digest => !seen.has(digest)))
    return fail('CORRUPT', 'Learning analysis queue contains missing or duplicated event IDs');
  return v;
}
async function load(access: EccLearningAccess, create: boolean): Promise<{ dir: string | null; state: LearningState }> {
  const root = await ensureAccess(access);
  const dir = await learningDir(root, create);
  if (create && dir) await privacyIgnore(dir);
  const value = dir ? await readBounded(path.join(dir, 'state.json')) : null;
  let decoded: unknown;
  if (value !== null) {
    try { decoded = JSON.parse(value) as unknown; }
    catch { return fail('CORRUPT', 'Learning state is not valid JSON'); }
  }
  return { dir, state: value === null ? blank(accessId(access)) : validateStored(decoded, accessId(access)) };
}
async function save(dir: string, state: LearningState): Promise<void> {
  await privacyIgnore(dir);
  const file = path.join(dir, 'state.json');
  const prior = await readBounded(file);
  // One recoverable checkpoint of the previous committed state, before publication.
  if (prior !== null) await atomic(path.join(dir, 'checkpoint.json'), prior);
  await atomic(file, `${JSON.stringify(state)}\n`);
}
function lock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const tail = locks.get(key) ?? Promise.resolve();
  const next = tail.catch(() => undefined).then(work);
  const barrier = next.then(() => undefined, () => undefined);
  locks.set(key, barrier);
  void barrier.then(() => { if (locks.get(key) === barrier) locks.delete(key); });
  return next;
}
async function protectedOperation<T>(work: () => Promise<T>): Promise<T> {
  try { return await work(); }
  catch (e) {
    if (e instanceof EccLearningError) throw e;
    // Do not leak native paths through raw Node filesystem exception messages.
    if (typeof (e as NodeJS.ErrnoException)?.code === 'string')
      return fail('ACCESS', 'Learning filesystem operation failed');
    throw e;
  }
}
function validateEvent(input: EccLearningObservation): void {
  if (!input || typeof input !== 'object' || typeof input.eventId !== 'string' || !TOKEN.test(input.eventId))
    fail('INVALID', 'Learning requires a short opaque event ID');
  if (input.type === 'tool') {
    if (!validKeys(input, ['eventId', 'type', 'tool', 'outcome', 'runKey']) || !TOOLS.has(input.tool) ||
        !['ok', 'error'].includes(input.outcome) || (input.runKey !== undefined && !TOKEN.test(input.runKey)))
      fail('INVALID', 'Learning tool observation is not a safe classified signal');
  } else if (input.type === 'correction') {
    if (!validKeys(input, ['eventId', 'type', 'preference']) || !CORRECTIONS.has(input.preference))
      fail('INVALID', 'Learning correction must be a verified predefined preference');
  } else if (input.type === 'feedback') {
    if (!validKeys(input, ['eventId', 'type', 'instinctId', 'verdict']) || !ID_SET.has(input.instinctId) ||
        !['confirm', 'contradict'].includes(input.verdict)) fail('INVALID', 'Learning feedback is invalid');
  } else fail('INVALID', 'Unknown learning observation type');
}
function hash(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex'); }
function baseConfidence(supports: number, contradictions: number): number {
  const base = supports >= 11 ? Math.min(0.9, 0.85 + (supports - 11) * 0.01)
    : supports >= 6 ? 0.7 : supports >= 3 ? 0.5 : 0.3;
  return Math.max(0.3, Math.min(0.9, Math.round((base - contradictions * 0.1) * 100) / 100));
}
function decayed(entry: EccLearningInstinct, now = Date.now()): EccLearningInstinct {
  const weeks = Math.max(0, Math.floor((now - Date.parse(entry.lastSeenAt)) / (7 * 86_400_000)));
  return { ...entry, confidence: Math.max(0.3, Math.round((entry.confidence - weeks * 0.02) * 100) / 100) };
}
function recordPattern(state: LearningState, id: string, at: string, verdict: 'confirm' | 'contradict' = 'confirm'): void {
  const pattern = PATTERNS[id];
  if (!pattern) return;
  const current = state.instincts.find(item => item.id === id);
  if (!current && verdict === 'contradict') return;
  if (!current && state.instincts.length >= ECC_LEARNING_LIMITS.maxInstincts)
    fail('LIMIT', 'Learning instinct limit reached');
  const prior = current ?? {
    id, ...pattern, supports: 0, contradictions: 0, confidence: 0.3, lastSeenAt: at,
    source: 'observed' as const, scope: 'project' as const, approved: false
  };
  if (current?.source === 'imported') return; // Imported text is never silently converted into observed evidence.
  const supports = prior.supports + (verdict === 'confirm' ? 1 : 0);
  const contradictions = prior.contradictions + (verdict === 'contradict' ? 1 : 0);
  const updated: EccLearningInstinct = { ...prior, supports, contradictions, confidence: baseConfidence(supports, contradictions), lastSeenAt: at };
  if (current) state.instincts[state.instincts.indexOf(current)] = updated;
  else state.instincts.push(updated);
}
function recognize(state: LearningState, row: JournalEvent, index: number): void {
  if (row.type === 'correction') { recordPattern(state, `correction-${row.preference}`, row.at); return; }
  if (row.type === 'feedback') { recordPattern(state, row.instinctId!, row.at, row.verdict); return; }
  const previous = state.observations.slice(0, index + 1).filter(event => event.type === 'tool' && event.run === row.run).slice(-3);
  if (previous.length !== 3 || previous[2] !== row) return;
  const tools = previous.map(event => event.tool).join('-');
  const outcomes = previous.map(event => event.outcome).join('-');
  if (tools === 'search-read-edit' && outcomes === 'ok-ok-ok') recordPattern(state, 'workflow-search-read-edit', row.at);
  if (tools === 'read-edit-test' && outcomes === 'ok-ok-ok') recordPattern(state, 'workflow-read-edit-test', row.at);
  if (tools === 'test-edit-test' && outcomes === 'error-ok-ok') recordPattern(state, 'error-resolution-test-edit-test', row.at);
}
/** The first pending event starts the first interval; later rounds start at
 * the previous completed analysis. All timestamps are from the private journal.
 */
function analysisDueAt(state: LearningState): number | null {
  if (state.pending.length < 3) return null;
  const first = state.observations.find(row => state.pending.includes(row.digest));
  if (!first) return null;
  const anchor = state.lastAnalyzedAt ?? first.at;
  return Date.parse(anchor) + ANALYSIS_INTERVAL_MS;
}
/** Deterministic, in-memory pattern analysis. No chat, tool results, API or LLM. */
function analyze(state: LearningState, now: string): boolean {
  const due = state.pending.length >= 20 ||
    (state.pending.length >= 3 && (analysisDueAt(state) ?? Infinity) <= Date.parse(now));
  if (!due) return false;
  const pending = new Set(state.pending);
  state.observations.forEach((row, index) => { if (pending.has(row.digest)) recognize(state, row, index); });
  state.pending = [];
  state.lastAnalyzedAt = now;
  return true;
}

/** Fail closed if the user's roots, recording setting or write grant changed. */
async function permittedForTimedWrite(access: EccLearningAccess): Promise<boolean> {
  const live = getConfig();
  if (live.readOnly || !live.sessions.record || !effectiveCapabilities(live).create) return false;
  const targetRoot = await fs.realpath(access.approvedRootDirectory);
  for (const root of live.roots) {
    try {
      if (equalsPath(await fs.realpath(root.path), targetRoot)) return true;
    } catch { /* Removed root is not permission; check the remaining roots. */ }
  }
  return false;
}

/** Independent 5-minute in-process timer, not dependent on another tool event.
 * A fired timer reacquires the project lock, revalidates live permission +
 * canonical paths and opt-in, and analyzes ONLY already committed local signals.
 */
function armAnalysisTimer(access: EccLearningAccess, state: LearningState): void {
  const key = storageKey(access);
  cancelAnalysisTimer(key);
  if (!state.config.enabled || state.pending.length < 3 ||
      analysisTimers.size >= MAX_ARMED_TIMERS) return;
  const due = analysisDueAt(state);
  if (due === null) return;
  const timer = setTimeout(() => {
    // Timer is one-shot: state changes always re-arm from the committed state.
    if (analysisTimers.get(key) !== timer) return;
    analysisTimers.delete(key);
    void protectedOperation(() => lock(key, async () => {
      if (!(await permittedForTimedWrite(access))) return;
      const { dir, state: latest } = await load(access, false);
      if (!dir || !latest.config.enabled || latest.pending.length < 3) return;
      if (analyze(latest, new Date().toISOString())) {
        await save(dir, latest);
      } else {
        armAnalysisTimer(access, latest);
      }
    })).catch(() => {
      // Background work never throws into the event loop. Persisted pending
      // signals remain untouched and will retry on a later explicit event/status.
    });
  }, Math.max(1, due - Date.now()));
  timer.unref();
  analysisTimers.set(key, timer);
}
function count(state: LearningState): number { return state.observations.length; }
async function apply(access: EccLearningAccess, events: EccLearningObservation[]): Promise<EccLearningReceipt[]> {
  return protectedOperation(() => lock(storageKey(access), async () => {
    if (events.length > ECC_LEARNING_LIMITS.maxBatch) fail('LIMIT', 'Too many learning events in one batch');
    const { state } = await load(access, false);
    if (!state.config.enabled) return events.map(() => ({ accepted: false, reason: 'disabled', observationCount: count(state) }));
    const now = new Date().toISOString();
    const receipts: EccLearningReceipt[] = [];
    let changed = false;
    for (const event of events) {
      validateEvent(event);
      const digest = hash(`${state.projectId}:${event.eventId}`);
      if (state.observations.some(item => item.digest === digest)) {
        receipts.push({ accepted: false, reason: 'duplicate', observationCount: count(state) });
        continue;
      }
      const run = event.type === 'tool' && event.runKey ? hash(`${state.projectId}:${event.runKey}`) : hash(`${state.projectId}:${event.eventId}`);
      const row: JournalEvent = { digest, run, at: now, type: event.type };
      if (event.type === 'tool') { row.tool = event.tool; row.outcome = event.outcome; }
      if (event.type === 'correction') row.preference = event.preference;
      if (event.type === 'feedback') { row.instinctId = event.instinctId; row.verdict = event.verdict; }
      state.observations.push(row);
      state.pending.push(digest);
      if (state.observations.length > ECC_LEARNING_LIMITS.maxJournal) {
        const evicted = state.observations.shift()!;
        state.pending = state.pending.filter(item => item !== evicted.digest);
      }
      analyze(state, now);
      changed = true;
      receipts.push({ accepted: true, reason: 'recorded', observationCount: count(state) });
    }
    if (changed) {
      const { dir } = await load(access, true);
      if (!dir) fail('ACCESS', 'Learning directory unavailable');
      await save(dir, state);
      armAnalysisTimer(access, state);
    }
    return receipts;
  }));
}

/** Coalesces same-tick recorder callbacks without starting a separate process on Windows. */
export function observeEccLearning(access: EccLearningAccess, event: EccLearningObservation): Promise<EccLearningReceipt> {
  validateEvent(event);
  const key = storageKey(access);
  return new Promise((resolve, reject) => {
    let pending = batches.get(key);
    if (!pending) {
      pending = { access, events: [] };
      batches.set(key, pending);
      setImmediate(() => {
        const batch = batches.get(key);
        if (!batch) return;
        batches.delete(key);
        const events = batch.events;
        // Groups of <= maxBatch preserve bounds even under bursts.
        void (async () => {
          for (let i = 0; i < events.length; i += ECC_LEARNING_LIMITS.maxBatch) {
            const slice = events.slice(i, i + ECC_LEARNING_LIMITS.maxBatch);
            try {
              const results = await apply(batch.access, slice.map(item => item.event));
              slice.forEach((item, index) => item.resolve(results[index]!));
            } catch (e) { slice.forEach(item => item.reject(e)); }
          }
        })();
      });
    }
    pending.events.push({ event, resolve, reject });
  });
}

/** Explicit adapter for native CoS recorder events; no automatic attachment. */
export function createEccLearningObserver(access: EccLearningAccess): (event: EccLearningObservation) => Promise<EccLearningReceipt> {
  return event => observeEccLearning(access, event);
}

/** Await all previously queued observations for this exact project; used on shutdown. */
export async function flushEccLearningObservations(access: EccLearningAccess): Promise<void> {
  const key = storageKey(access);
  // Wait for a pending scheduled batch to be enqueued and its individual results.
  const pending = batches.get(key);
  if (pending) await Promise.all(pending.events.map(item => new Promise<void>((resolve, reject) => {
    const priorResolve = item.resolve;
    const priorReject = item.reject;
    item.resolve = value => { priorResolve(value); resolve(); };
    item.reject = error => { priorReject(error); reject(error); };
  })));
  const tail = locks.get(key);
  if (tail) await tail;
}

export async function configureEccLearning(access: EccLearningAccess, config: EccLearningConfig, intent: { confirm: true }): Promise<EccLearningStatus> {
  if (!config || typeof config.enabled !== 'boolean' || !validKeys(config, ['enabled']) || intent?.confirm !== true)
    fail('INVALID', 'Learning opt-in/out requires an explicit confirmed action');
  return protectedOperation(() => lock(storageKey(access), async () => {
    const { state } = await load(access, false);
    const { dir } = await load(access, true);
    if (!dir) fail('ACCESS', 'Learning directory unavailable');
    state.config = { enabled: config.enabled };
    await save(dir, state);
    armAnalysisTimer(access, state);
    return statusOf(state);
  }));
}

function statusOf(state: LearningState): EccLearningStatus {
  return { config: { ...state.config }, observationCount: count(state), instinctCount: state.instincts.length,
    proposalCount: proposals(state).length, pendingObservations: state.pending.length };
}
export async function getEccLearningStatus(access: EccLearningAccess): Promise<EccLearningStatus> {
  return protectedOperation(async () => {
    const { state } = await load(access, false);
    // Re-arm a persisted partial analysis on project re-open after app restart.
    if (state.config.enabled && state.pending.length >= 3 && !analysisTimers.has(storageKey(access)))
      armAnalysisTimer(access, state);
    return statusOf(state);
  });
}
export async function listEccLearningInstincts(access: EccLearningAccess): Promise<EccLearningInstinct[]> {
  return protectedOperation(async () => (await load(access, false)).state.instincts.map(instinct => decayed(instinct))
    .sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id)));
}

/** Safely scoped, explicit user review. Imported claims cannot be approved as locally verified. */
export async function approveEccLearningInstinct(
  access: EccLearningAccess, instinctId: string, intent: { approved: boolean; confirm: true }
): Promise<EccLearningInstinct> {
  if (!ID_SET.has(instinctId) || intent?.confirm !== true || typeof intent.approved !== 'boolean')
    fail('INVALID', 'Instinct review requires an explicit confirmed decision');
  return protectedOperation(() => lock(storageKey(access), async () => {
    const { state } = await load(access, false);
    const entry = state.instincts.find(item => item.id === instinctId);
    if (!entry) fail('INVALID', 'Unknown project instinct');
    if (intent.approved && (entry.source !== 'observed' || entry.supports < 6 || decayed(entry).confidence < 0.7))
      fail('INVALID', 'Instinct lacks repeated, high-confidence local evidence');
    entry.approved = intent.approved;
    const { dir } = await load(access, true);
    if (!dir) fail('ACCESS', 'Learning directory unavailable');
    await save(dir, state);
    return decayed(entry);
  }));
}

/** Explicit read-only integration point for CoS main prompt context / native MCP. */
export async function listApplicableEccLearningInstincts(access: EccLearningAccess): Promise<EccLearningInstinct[]> {
  return (await listEccLearningInstincts(access)).filter(item => item.approved && item.source === 'observed' &&
    item.supports >= 6 && item.confidence >= 0.7);
}

function proposals(state: LearningState): EccLearningProposal[] {
  const confident = state.instincts.map(instinct => decayed(instinct))
    .filter(instinct => instinct.source === 'observed' && instinct.supports >= 3 && instinct.confidence >= 0.7);
  const results: EccLearningProposal[] = [];
  const workflows = confident.filter(item => item.domain === 'workflow');
  for (const entry of workflows) {
    const name = entry.id.replace(/^workflow-/, '');
    results.push({ id: `command-${entry.id}`, kind: 'command', title: `Review workflow: ${name}`,
      confidence: entry.confidence, instinctIds: [entry.id], status: 'review-required',
      markdown: `# Draft command: ${name}\n\nWhen: ${entry.trigger}.\n\nSuggested: ${entry.action}.\n\nReview against current CoS project permissions before installing.\n` });
  }
  // Do not assert that unrelated weak patterns combine into a trustworthy skill.
  for (const domain of ['workflow', 'debugging', 'user-correction'] as const) {
    const entries = confident.filter(item => item.domain === domain);
    if (entries.length < 2) continue;
    results.push({ id: `skill-${domain}`, kind: 'skill', title: `Review ${domain} patterns`,
      confidence: Math.round((entries.reduce((sum, entry) => sum + entry.confidence, 0) / entries.length) * 100) / 100,
      instinctIds: entries.map(entry => entry.id), status: 'review-required',
      markdown: `# Draft Skill: ${domain}\n\n${entries.map(item => `- When ${item.trigger.toLowerCase()}: ${item.action}.`).join('\n')}\n\nReview before importing as a CoS Skill.\n` });
  }
  return results;
}
/** Preview-only, inert proposals. Never writes to the CoS managed Skills registry. */
export async function reviewEccLearningProposals(access: EccLearningAccess): Promise<EccLearningProposal[]> {
  return protectedOperation(async () => proposals((await load(access, false)).state));
}

function toBundle(state: LearningState): EccLearningBundle {
  return { schema: 'cos.ecc-learning.export.v1', instincts: state.instincts.map(entry => ({
    id: entry.id, trigger: entry.trigger, action: entry.action, domain: entry.domain,
    confidence: decayed(entry).confidence
  })) };
}
/** Returns only abstract reviewed instincts, NEVER observations or session evidence. */
export async function exportEccLearning(access: EccLearningAccess): Promise<string> {
  return protectedOperation(async () => {
    const payload = JSON.stringify(toBundle((await load(access, false)).state), null, 2);
    if (Buffer.byteLength(payload, 'utf8') > ECC_LEARNING_LIMITS.maxBundleBytes)
      fail('LIMIT', 'Instinct export exceeds the allowed size');
    return payload;
  });
}
function readBundle(text: string): EccLearningBundle {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > ECC_LEARNING_LIMITS.maxBundleBytes)
    fail('LIMIT', 'Instinct import exceeds the allowed size');
  let parsed: unknown;
  try { parsed = JSON.parse(text) as unknown; } catch { return fail('INVALID', 'Instinct import is invalid JSON'); }
  if (!parsed || typeof parsed !== 'object' || !validKeys(parsed, ['schema', 'instincts']))
    fail('INVALID', 'Instinct import has unexpected metadata');
  const bundle = parsed as EccLearningBundle;
  if (bundle.schema !== 'cos.ecc-learning.export.v1' || !Array.isArray(bundle.instincts) ||
      bundle.instincts.length > ECC_LEARNING_LIMITS.maxInstincts) fail('INVALID', 'Unrecognized instinct import schema');
  const unique = new Set<string>();
  for (const item of bundle.instincts) {
    const canonical = PATTERNS[item?.id];
    if (!canonical || !validKeys(item, ['id', 'trigger', 'action', 'domain', 'confidence']) ||
      item.trigger !== canonical.trigger || item.action !== canonical.action || item.domain !== canonical.domain ||
      !finiteConfidence(item.confidence) || unique.has(item.id)) fail('INVALID', 'Unreviewed or duplicated instinct in import');
    unique.add(item.id);
  }
  return bundle;
}

/** Import is manual and untrusted; imported claims never count as observed evidence. */
export async function importEccLearning(access: EccLearningAccess, bundleText: string, intent: { confirm: true }): Promise<EccLearningStatus> {
  if (intent?.confirm !== true) fail('INVALID', 'Instinct import requires explicit approval');
  const bundle = readBundle(bundleText);
  return protectedOperation(() => lock(storageKey(access), async () => {
    const { state } = await load(access, false);
    const now = new Date().toISOString();
    for (const item of bundle.instincts) {
      if (state.instincts.some(instinct => instinct.id === item.id)) continue;
      if (state.instincts.length >= ECC_LEARNING_LIMITS.maxInstincts) fail('LIMIT', 'Too many imported instincts');
      state.instincts.push({ ...item, supports: 0, contradictions: 0, lastSeenAt: now,
        source: 'imported', scope: 'project', approved: false });
    }
    const { dir } = await load(access, true);
    if (!dir) fail('ACCESS', 'Learning directory unavailable');
    await save(dir, state);
    return statusOf(state);
  }));
}

/** Preview-only candidates from DISTINCT explicitly selected, live-approved projects. */
export async function listEccLearningPromotionCandidates(accesses: readonly EccLearningAccess[]): Promise<EccLearningPromotionCandidate[]> {
  if (!Array.isArray(accesses) || accesses.length < 2 || accesses.length > ECC_LEARNING_LIMITS.maxProjectsForPromotion)
    fail('INVALID', 'Global review requires 2–12 explicitly approved projects');
  const ids = accesses.map(accessId);
  if (new Set(ids).size !== ids.length) fail('INVALID', 'Global review requires distinct project identities');
  return protectedOperation(async () => {
    const stores = await Promise.all(accesses.map(async access => (await load(access, false)).state));
    const groups = new Map<string, Array<{ projectId: string; confidence: number }>>();
    for (const state of stores) for (const instinct of state.instincts) {
      const view = decayed(instinct);
      if (view.source !== 'observed' || view.supports < 11 || view.domain !== 'workflow') continue;
      const group = groups.get(view.id) ?? [];
      group.push({ projectId: state.projectId, confidence: view.confidence });
      groups.set(view.id, group);
    }
    return [...groups.entries()].flatMap(([instinctId, group]) => {
      const average = group.reduce((sum, item) => sum + item.confidence, 0) / group.length;
      return group.length >= 2 && average >= 0.8 ? [{ instinctId, projectCount: group.length,
        averageConfidence: Math.round(average * 100) / 100, projectIds: group.map(item => item.projectId),
        status: 'review-required' as const }] : [];
    }).sort((a, b) => b.averageConfidence - a.averageConfidence || a.instinctId.localeCompare(b.instinctId));
  });
}

/** Deliberate global promotion exports a REVIEWABLE artifact; never installs/persists global behavior. */
export async function promoteEccLearningGlobal(
  accesses: readonly EccLearningAccess[], instinctId: string, intent: { confirm: true }
): Promise<{ scope: 'global'; candidate: EccLearningPromotionCandidate; bundle: string }> {
  if (intent?.confirm !== true) fail('INVALID', 'Global promotion requires explicit confirmation');
  const candidate = (await listEccLearningPromotionCandidates(accesses)).find(item => item.instinctId === instinctId);
  if (!candidate) fail('INVALID', 'Instinct has not met cross-project global promotion criteria');
  const pattern = PATTERNS[instinctId]!;
  return { scope: 'global', candidate, bundle: JSON.stringify({
    schema: 'cos.ecc-learning.export.v1',
    instincts: [{ id: instinctId, ...pattern, confidence: candidate.averageConfidence }]
  } satisfies EccLearningBundle) };
}

/** Clears scoped evidence, optionally all instincts; requires explicit user action. */
export async function resetEccLearning(
  access: EccLearningAccess, intent: { confirm: true; scope: 'observations' | 'all' }
): Promise<EccLearningStatus> {
  if (intent?.confirm !== true || !['observations', 'all'].includes(intent.scope))
    fail('INVALID', 'Reset requires explicit scope and approval');
  return protectedOperation(() => lock(storageKey(access), async () => {
    const { state } = await load(access, false);
    state.observations = [];
    state.pending = [];
    state.lastAnalyzedAt = null;
    if (intent.scope === 'all') state.instincts = [];
    const { dir } = await load(access, true);
    if (!dir) fail('ACCESS', 'Learning directory unavailable');
    await save(dir, state);
    armAnalysisTimer(access, state);
    return statusOf(state);
  }));
}

/** Reverts exactly one committed transaction using the local checkpoint. */
export async function rollbackEccLearning(access: EccLearningAccess, intent: { confirm: true }): Promise<EccLearningStatus> {
  if (intent?.confirm !== true) fail('INVALID', 'Learning rollback requires explicit approval');
  return protectedOperation(() => lock(storageKey(access), async () => {
    const { dir } = await load(access, false);
    if (!dir) fail('INVALID', 'No learning checkpoint');
    const snapshot = await readBounded(path.join(dir, 'checkpoint.json'));
    if (snapshot === null) fail('INVALID', 'No learning checkpoint');
    let parsed: unknown;
    try { parsed = JSON.parse(snapshot) as unknown; }
    catch { return fail('CORRUPT', 'Learning checkpoint is malformed'); }
    const restored = validateStored(parsed, accessId(access));
    // The checkpoint is intentionally consumed to stop accidental toggle loops.
    await privacyIgnore(dir);
    await atomic(path.join(dir, 'state.json'), `${JSON.stringify(restored)}\n`);
    await fs.rm(path.join(dir, 'checkpoint.json'));
    armAnalysisTimer(access, restored);
    return statusOf(restored);
  }));
}
