import { BROWSER_BRIDGE_PORTS } from '../shared/browser-bridge.js';

/**
 * Commands run through Core share the host process' user token. That is useful, but it also
 * means a cleanup command can accidentally terminate the very Chat On Steroids process that is
 * executing it. This happened in a real session when a temporary HTTP server was bound to the
 * LAN address on port 8765, CoS was bound to loopback on the same port, and a later cleanup
 * selected both listener PIDs for forced termination.
 *
 * This is deliberately a narrow self-preservation fence, not a general command filter. The
 * optional user allow/deny policy remains the authority for ordinary programs. These checks only
 * refuse obvious attempts to kill this process/name or to derive kill targets from the bridge's
 * reserved ports. A user who actually wants to close CoS should use the app/tray/OS rather than
 * making the app kill itself mid-write.
 */

const TERMINATION_INVOCATION =
  /(?:^|[;|&{}()\r\n]\s*)(?:&\s*)?(?:stop-process|taskkill(?:\.exe)?|kill(?:\.exe)?|pkill|killall)\b/i;
const WRAPPED_TASKKILL = /\b(?:cmd(?:\.exe)?\s+\/(?:c|k)\s+)?taskkill(?:\.exe)?\s+\/(?:pid|im)\b/i;
const PROCESS_DISCOVERY =
  /\b(?:get-nettcpconnection|netstat|lsof|fuser|owningprocess|localport|processid|pid)\b/i;
const COS_PROCESS_NAME = /\bchat\s+on\s+steroids(?:\.exe)?\b/i;

export interface ExecSelfProtectionFailure {
  commandIndex: number;
  reason: 'self-pid' | 'self-name' | 'bridge-port-sweep';
  detail: string;
}

function hasTerminationInvocation(command: string): boolean {
  return TERMINATION_INVOCATION.test(command) || WRAPPED_TASKKILL.test(command);
}

function containsIntegerToken(command: string, value: number): boolean {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\D)${escaped}(?:\\D|$)`).test(command);
}

function containsReservedPort(command: string, ports: readonly number[]): boolean {
  return ports.some((port) => containsIntegerToken(command, port));
}

export function execSelfProtectionFailure(
  commands: readonly string[],
  options: {
    selfPid?: number;
    reservedPorts?: readonly number[];
  } = {}
): ExecSelfProtectionFailure | null {
  const selfPid = options.selfPid ?? process.pid;
  const reservedPorts = options.reservedPorts ?? BROWSER_BRIDGE_PORTS;

  for (const [commandIndex, command] of commands.entries()) {
    if (!hasTerminationInvocation(command)) continue;
    if (containsIntegerToken(command, selfPid)) {
      return {
        commandIndex,
        reason: 'self-pid',
        detail: `the command targets Chat On Steroids' own process id (${selfPid})`
      };
    }
    if (COS_PROCESS_NAME.test(command)) {
      return {
        commandIndex,
        reason: 'self-name',
        detail: 'the command targets the Chat On Steroids process by name'
      };
    }
  }

  // `cmds` is one persistent shell, so discovery in command 1 can populate a variable that a
  // later command kills. Scan the complete authored batch as one program for this one invariant.
  const batch = commands.join('\n');
  if (hasTerminationInvocation(batch) && PROCESS_DISCOVERY.test(batch) && containsReservedPort(batch, reservedPorts)) {
    const commandIndex = commands.findIndex((command) => hasTerminationInvocation(command));
    return {
      commandIndex: Math.max(0, commandIndex),
      reason: 'bridge-port-sweep',
      detail: `the command derives a process-kill target from a Chat On Steroids companion bridge port (${reservedPorts.join(', ')})`
    };
  }

  return null;
}

/**
 * `write_stdin` continues a shell that was admitted earlier, so a later line cannot be checked
 * against the original command's process-discovery context. Process termination through that
 * channel is therefore intentionally refused: use a fresh `exec_command`, where the target can
 * be preflighted as one complete command. Control bytes such as Ctrl+C do not match this rule.
 */
export function writeStdinSelfProtectionFailure(input: string): string | null {
  if (!input || !hasTerminationInvocation(input)) return null;
  return 'process-termination commands cannot be sent through write_stdin because their target provenance cannot be validated';
}
