/**
 * Optional, deterministic static audit of one explicitly selected, approved project.
 * No commands, network requests, executable hooks, fixes, or recursive repository walk.
 */
import path from 'node:path';
import { constants } from 'node:fs';
import { rawPromises as fs, rawRealpathNative } from './rawfs.js';
import { effectiveCapabilities, getConfig } from './config.js';
import { isContained, nativePathIdentity, resolvePath } from './sandbox.js';
import type { EccSecurityAudit, EccSecurityRule, EccSecuritySeverity } from '../shared/ecc-security.js';

export const ECC_SECURITY_LIMITS = Object.freeze({
  files: 80, bytes: 1_048_576, fileBytes: 65_536, findings: 60
});
const MAX_DIRECTORY_ENTRIES = 128;
const MAX_LINES = 2_000;
const MAX_PATH_LENGTH = 400;

const STATIC_FILES = [
  'AGENTS.md', 'CLAUDE.md', '.cursorrules', '.mcp.json', 'package.json',
  '.claude/settings.json', '.claude/settings.local.json',
  '.codex/config.toml', '.github/copilot-instructions.md'
] as const;
const DYNAMIC_FOLDERS: ReadonlyArray<{ directory: string; accept: (name: string) => boolean }> = [
  { directory: '.github/workflows', accept: name => /\.ya?ml$/i.test(name) },
  { directory: '.cursor/rules', accept: name => /\.mdc$/i.test(name) },
  { directory: '.husky', accept: name => !name.startsWith('.') && name !== '_' },
  { directory: '.githooks', accept: name => !name.startsWith('.') },
  { directory: '.git/hooks', accept: name => !name.endsWith('.sample') && !name.startsWith('.') },
  { directory: '.claude/hooks', accept: name => /\.(?:sh|ps1|cmd|bat|js|mjs|cjs)$/i.test(name) }
];

const definitions: Record<EccSecurityRule, { severity: EccSecuritySeverity; explanation: string }> = {
  'broad-permission': {
    severity: 'high',
    explanation: 'An explicit broad tool or workflow permission bypasses normal per-operation limits. Review its intended scope.'
  },
  'literal-credential': {
    severity: 'high',
    explanation: 'A credential-named setting appears to contain a literal value. Move real credentials to a protected secret store.'
  },
  'private-key': {
    severity: 'high',
    explanation: 'A private-key block starts in this configuration file. Verify that no private key is committed or shared.'
  },
  'remote-shell': {
    severity: 'medium',
    explanation: 'A command appears to pipe downloaded content to a shell. Inspect the source and pin or verify the code before execution.'
  },
  'tls-disabled': {
    severity: 'high',
    explanation: 'This configuration explicitly disables TLS certificate validation.'
  },
  'instruction-override': {
    severity: 'low',
    explanation: 'An instruction file contains a direct override of higher-priority instructions or safety checks; review its provenance.'
  }
};

const less = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException)?.code === 'ENOENT';
const sameStat = (a: { dev: number; ino: number; size: number; mtimeMs: number; ctimeMs: number },
                  b: { dev: number; ino: number; size: number; mtimeMs: number; ctimeMs: number }): boolean =>
  a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
const canonical = (file: string): Promise<string> =>
  process.platform === 'win32' ? rawRealpathNative(file) : fs.realpath(file);

function validSegment(name: string): boolean {
  return name.length > 0 && name.length <= 120 && name !== '.' && name !== '..' &&
    !/[\\/:*?"<>|\u0000-\u001f\u007f]/.test(name) && !/[. ]$/.test(name);
}

/** Never emit a source line, captured key, matched value, exception or arbitrary file name. */
function inspectText(relative: string, content: string, emit: (line: number, rule: EccSecurityRule) => void): void {
  const lines = content.split(/\r\n?|\n/);
  const instructionFile = relative === 'AGENTS.md' || relative === 'CLAUDE.md' ||
    relative === '.cursorrules' || relative === '.github/copilot-instructions.md' ||
    relative.startsWith('.cursor/rules/');
  const configFile = relative === '.mcp.json' || relative === 'package.json' ||
    relative === '.codex/config.toml' || relative.startsWith('.claude/settings') ||
    relative.startsWith('.github/workflows/');
  const runnableFile = relative === 'package.json' || relative.startsWith('.github/workflows/') ||
    relative.startsWith('.husky/') || relative.startsWith('.githooks/') ||
    relative.startsWith('.git/hooks/') || relative.startsWith('.claude/hooks/');
  let permissionsUntil = -1;
  const count = Math.min(lines.length, MAX_LINES);
  for (let i = 0; i < count; i++) {
    const source = lines[i]!;
    const line = source.trim();
    if (!line || /^(?:#(?!\s*permissions\b)|\/\/|\/\*|\*|<!--)/.test(line)) continue;

    if (configFile) {
      if (/(?:["']?(?:permissions|allowedTools|alwaysAllow|autoApprove|allow)["']?)\s*[:=]/i.test(line))
        permissionsUntil = i + 12;
      if (/(?:["']?permissions["']?\s*:\s*["']?write-all\b|["']?defaultMode["']?\s*:\s*["']bypassPermissions["']|["']?skipDangerousModePermissionPrompt["']?\s*:\s*true\b)/i.test(line) ||
          (i <= permissionsUntil &&
            /(?:["']\s*(?:\*|Bash\(\*\)|mcp__\*|Read\(\*\*\)|Write\(\*\*\)|Edit\(\*\*\))\s*["'])/.test(line))) {
        emit(i + 1, 'broad-permission');
      }
      if (/^\s*-{5}BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-{5}\s*$/.test(line))
        emit(i + 1, 'private-key');
      // Match object members and leading YAML/TOML/shell assignments, including compact JSON.
      // Do not look for key=value in arbitrary text within a script or prompt.
      const assignments = /(?:^|[,{])\s*(?:export\s+)?["']?([A-Za-z][A-Za-z0-9_.-]{0,100})["']?\s*[:=]\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^,}\s]+)/g;
      for (const assigned of line.matchAll(assignments)) {
        if (!/(?:^|[_\-.])(?:api[_-]?key|token|secret|password|private[_-]?key|client[_-]?secret|access[_-]?key)(?:$|[_\-.])/i.test(assigned[1]!)) continue;
        const unquoted = assigned[2]!.trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim();
        if (unquoted.length >= 8 && !/^(?:\$\{|\$[A-Z_][A-Z0-9_]*$|\$env:[A-Z_][A-Z0-9_]*$|process\.env\b|env:|<|[*]+$|x{8,}$|REDACTED|PLACEHOLDER|YOUR_|CHANGEME|DUMMY|EXAMPLE|TEST_|null$|undefined$)/i.test(unquoted) &&
            !/^\$\{\{\s*(?:secrets|vars|env)\./i.test(unquoted) && !/^%[A-Z_][A-Z0-9_]*%$/i.test(unquoted))
          emit(i + 1, 'literal-credential');
      }
      if (/\bNODE_TLS_REJECT_UNAUTHORIZED\s*[:=]\s*['"]?0(?:['"]|[,;\s]|$)/.test(line) ||
          /["']?NODE_TLS_REJECT_UNAUTHORIZED["']?\s*:\s*["']0["']/.test(line))
        emit(i + 1, 'tls-disabled');
    }
    if (runnableFile && /\b(?:curl|wget)(?:\s|(?:\.exe\b))[^\r\n]{0,400}\|\s*(?:(?:sudo|env)\s+)*(?:ba)?sh\b/i.test(line))
      emit(i + 1, 'remote-shell');
    if (instructionFile && /^(?:[-*]\s+|\d+[.)]\s+)?(?:ignore (?:all |any )?(?:previous|prior|system|developer) (?:instructions|rules)|reveal (?:the |your )?(?:system|developer) prompt|disable (?:all )?(?:safety|security) (?:checks|protections|rules))\b/i.test(line))
      emit(i + 1, 'instruction-override');
  }
}

/**
 * Main-process API for an IPC owner. The caller MUST supply the project directory explicitly.
 * Roots and effective read permission come from live CoS config, never request parameters.
 */
export async function auditEccProjectSecurity(projectRoot: string): Promise<EccSecurityAudit> {
  if (typeof projectRoot !== 'string' || !projectRoot || projectRoot.length > 4096)
    throw new Error('Select one project directory to audit');
  const ensureRead = (): void => {
    if (!effectiveCapabilities(getConfig()).read)
      throw new Error('Read files permission is required for the ECC security audit');
  };
  ensureRead();
  const project = await resolvePath(getConfig().roots, projectRoot);
  const stat = await fs.lstat(project.real);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Select a real approved project directory');
  const originalIdentity = nativePathIdentity(project.real);
  const assertScope = async (): Promise<void> => {
    ensureRead();
    const current = await resolvePath(getConfig().roots, projectRoot);
    if (nativePathIdentity(current.real) !== originalIdentity)
      throw new Error('The selected project or its approval changed during the audit');
    const currentStat = await fs.lstat(current.real);
    if (!currentStat.isDirectory() || currentStat.isSymbolicLink() || currentStat.dev !== stat.dev || currentStat.ino !== stat.ino)
      throw new Error('The selected project changed during the audit');
  };
  const result: EccSecurityAudit = {
    project: project.virtual, findings: [], filesScanned: 0, bytesScanned: 0,
    partial: false, skipped: 0, limits: { ...ECC_SECURITY_LIMITS }
  };
  const skip = (): void => { result.partial = true; result.skipped++; };
  const checked = async (relative: string, directory = false): Promise<string | null> => {
    await assertScope();
    const segments = relative.split('/');
    if (!segments.every(validSegment) || relative.length > MAX_PATH_LENGTH) { skip(); return null; }
    let target = project.real;
    try {
      for (const segment of segments) {
        target = path.join(target, segment);
        const step = await fs.lstat(target);
        if (step.isSymbolicLink()) { skip(); return null; } // Junction/reparse points fail closed.
      }
      const targetStat = await fs.lstat(target);
      if (directory ? !targetStat.isDirectory() : !targetStat.isFile()) { skip(); return null; }
      const resolved = await resolvePath(getConfig().roots, relative, { base: project.virtual });
      if (!isContained(project.real, resolved.real) ||
          nativePathIdentity(resolved.real) !== nativePathIdentity(target) ||
          nativePathIdentity(await canonical(target)) !== nativePathIdentity(target)) {
        skip(); return null;
      }
      return target;
    } catch (error) {
      if (missing(error) || (error as NodeJS.ErrnoException)?.code === 'ENOTDIR') return null;
      // A path that vanishes or becomes unreadable is omitted, never used as evidence.
      skip(); return null;
    }
  };

  const candidates: string[] = [...STATIC_FILES];
  for (const { directory, accept } of DYNAMIC_FOLDERS) {
    const folder = await checked(directory, true);
    if (!folder) continue;
    try {
      const names: string[] = [];
      const iterator = await fs.opendir(folder);
      try {
        for await (const item of iterator) {
          if (names.length === MAX_DIRECTORY_ENTRIES) { names.length = 0; skip(); break; }
          names.push(item.name);
        }
      } finally { await iterator.close().catch(() => undefined); }
      for (const name of names.sort(less)) {
        if (!validSegment(name)) { skip(); continue; }
        if (accept(name)) candidates.push(directory + '/' + name);
      }
    } catch { skip(); }
  }
  for (const relative of [...new Set(candidates)].sort(less)) {
    if (result.filesScanned === ECC_SECURITY_LIMITS.files || result.findings.length >= ECC_SECURITY_LIMITS.findings) {
      skip(); continue;
    }
    const filename = await checked(relative);
    if (!filename) continue;
    const handle = await fs.open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)).catch(() => null);
    if (!handle) { skip(); continue; }
    let buffer: Buffer | null = null;
    let tooLarge = false;
    try {
      const before = await handle.stat();
      if (!before.isFile() || before.size <= 0) continue;
      if (before.size > ECC_SECURITY_LIMITS.fileBytes ||
          result.bytesScanned + before.size > ECC_SECURITY_LIMITS.bytes) {
        tooLarge = true;
      } else {
        const original = await fs.lstat(filename);
        if (original.isSymbolicLink() || !sameStat(before, original)) { skip(); continue; }
        buffer = Buffer.alloc(before.size);
        let offset = 0;
        while (offset < buffer.length) {
          const next = await handle.read(buffer, offset, buffer.length - offset, offset);
          if (!next.bytesRead) throw new Error('The file changed while reading');
          offset += next.bytesRead;
        }
        if (!sameStat(before, await handle.stat()) || !sameStat(before, await fs.lstat(filename))) {
          skip(); buffer = null; continue;
        }
      }
    } catch { skip(); buffer = null; }
    finally { await handle.close().catch(() => undefined); }
    if (tooLarge) { skip(); continue; }
    if (!buffer) continue;
    if (buffer.includes(0)) { skip(); continue; }
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { skip(); continue; }
    if (text.split(/\r\n?|\n/).length > MAX_LINES) { skip(); continue; }
    // Re-resolve authorization and target identity after the async read, before returning findings.
    await assertScope();
    if (!await checked(relative)) { skip(); continue; }
    result.filesScanned++;
    result.bytesScanned += buffer.length;
    inspectText(relative, text, (line, rule) => {
      if (result.findings.length >= ECC_SECURITY_LIMITS.findings) { result.partial = true; return; }
      const definition = definitions[rule];
      if (result.findings.some(found => found.path === relative && found.line === line && found.rule === rule)) return;
      result.findings.push({ path: relative, line, rule, ...definition });
    });
  }
  await assertScope();
  result.findings.sort((a, b) => less(a.path, b.path) || a.line - b.line || less(a.rule, b.rule));
  return result;
}
