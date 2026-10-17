/** Stable, presentation-safe results of an explicitly requested static project audit. */
export type EccSecuritySeverity = 'high' | 'medium' | 'low';
export type EccSecurityRule =
  | 'broad-permission'
  | 'literal-credential'
  | 'private-key'
  | 'remote-shell'
  | 'tls-disabled'
  | 'instruction-override';

export interface EccSecurityFinding {
  severity: EccSecuritySeverity;
  rule: EccSecurityRule;
  /** Project-relative forward-slash path. Never a source-text excerpt. */
  path: string;
  /** One-based source line. */
  line: number;
  /** Fixed explanation; values and matching source lines are never returned. */
  explanation: string;
}

export interface EccSecurityAudit {
  /** Canonical CoS virtual path for the explicitly selected project. */
  project: string;
  findings: EccSecurityFinding[];
  filesScanned: number;
  bytesScanned: number;
  /** True when a budget, unsafe link or unreadable candidate limited coverage. */
  partial: boolean;
  /** Number of files or directories omitted; omitted names and source bytes are not echoed. */
  skipped: number;
  limits: { files: number; bytes: number; fileBytes: number; findings: number };
}
