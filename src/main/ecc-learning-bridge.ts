/**
 * Safe adapter from CoS's proven, durably recorded tool events to ECC's opt-in
 * learning engine. Never hands the observer prompts, code, paths, command lines,
 * tool arguments, results, or model credentials.
 */
import { createHash } from 'node:crypto';
import { getConfig, effectiveCapabilities } from './config.js';
import { getSessionProject } from './projects.js';
import { getSession } from './session/store.js';
import { resolvePath } from './sandbox.js';
import { observeEccLearning } from './ecc-learning.js';
import type { EccLearningAccess, EccLearningTool } from '../shared/ecc-learning.js';
import type { ToolCallInput } from './session/recorder.js';

const TEST_COMMAND = /^(?:npm(?:\.cmd)?\s+(?:run\s+)?(?:test|typecheck)|npx\s+(?:vitest|jest)|pnpm\s+(?:test|vitest)|yarn\s+test|pytest|python(?:3)?\s+-m\s+pytest|go\s+test|cargo\s+test|gradlew(?:\.bat)?\s+test|dotnet\s+test)(?:\s|$)/i;
const BUILD_COMMAND = /^(?:npm(?:\.cmd)?\s+run\s+(?:build|dist(?::[\w-]+)?)|pnpm\s+(?:run\s+)?build|yarn\s+build|cargo\s+build|go\s+build|dotnet\s+build)(?:\s|$)/i;

export function eccLearningToolCategory(tool: string, args: unknown): EccLearningTool | null {
  if (tool === 'find') return 'search';
  if (tool === 'read') return 'read';
  if (tool === 'apply_patch') return 'edit';
  if (tool !== 'exec_command' || !args || typeof args !== 'object') return null;
  const arg = args as { cmd?: unknown; cmds?: unknown };
  const commands = typeof arg.cmd === 'string' ? [arg.cmd] :
    Array.isArray(arg.cmds) && arg.cmds.length === 1 && typeof arg.cmds[0] === 'string'
      ? [arg.cmds[0] as string] : [];
  if (commands.length !== 1) return null;
  const command = (commands[0] ?? '').trim();
  // No split of pipelines/compound scripts: never infer a successful verification
  // from the first command of a script that did something else afterwards.
  if (/[;&|`\r\n]/.test(command) || command.length > 256) return null;
  if (TEST_COMMAND.test(command)) return 'test';
  if (BUILD_COMMAND.test(command)) return 'build';
  return null;
}

export async function eccLearningAccessForSession(sessionId: string): Promise<EccLearningAccess | null> {
  const config = getConfig();
  const caps = effectiveCapabilities(config);
  if (!config.sessions.record || !caps.read || !caps.create || config.readOnly) return null;
  const saved = await getSession(sessionId);
  if (!saved?.projectId) return null;
  // The project binding and its root are revalidated on every signal, so an
  // unlinked, deleted, moved or revoked project never receives observations.
  const project = await getSessionProject(sessionId);
  if (!project) return null;
  const resolved = await resolvePath(config.roots, project.real);
  return {
    projectId: saved.projectId,
    projectDirectory: resolved.real,
    approvedRootDirectory: resolved.root.path
  };
}

/** Best effort; learning can never delay/fail a normal tool call. */
export async function observeRecordedToolForEcc(sessionId: string, callId: string, input: ToolCallInput, turnId: string | null): Promise<void> {
  const category = eccLearningToolCategory(input.tool, input.args);
  if (!category || !callId) return;
  try {
    const access = await eccLearningAccessForSession(sessionId);
    if (!access) return;
    const eventId = createHash('sha256').update(`${sessionId}:${callId}`).digest('hex');
    const runKey = createHash('sha256').update(`${sessionId}:${turnId ?? input.requestId ?? callId}`).digest('hex');
    await observeEccLearning(access, {
      type: 'tool',
      eventId,
      runKey,
      tool: category,
      outcome: input.outcome === 'ok' ? 'ok' : 'error'
    });
  } catch {
    // No user content or sensitive native paths enter the main application log.
  }
}
