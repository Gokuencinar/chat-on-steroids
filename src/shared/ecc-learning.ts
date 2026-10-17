/** Native, offline, strictly opt-in ECC-inspired continuous learning. */
export const ECC_LEARNING_LIMITS = {
  maxJournal: 256,
  maxInstincts: 64,
  maxStateBytes: 192 * 1024,
  maxBundleBytes: 32 * 1024,
  maxBatch: 64,
  maxProjectsForPromotion: 12
} as const;

/** A project catalog ID and paths resolved against CURRENT approved roots by main. */
export interface EccLearningAccess {
  projectId: string;
  projectDirectory: string;
  approvedRootDirectory: string;
}

export type EccLearningTool = 'search' | 'read' | 'edit' | 'test' | 'build';
export type EccLearningCorrection =
  | 'search-before-edit' | 'read-before-edit' | 'test-after-edit'
  | 'test-before-fix' | 'confirm-before-delete' | 'bounded-retries';

/**
 * Only structured, sanitized events. sessionId, chat text, commands, code,
 * tool arguments/results, file paths, URLs, tokens and arbitrary notes are NOT accepted.
 * Caller must derive eventId from durable *exactly owned* recorder evidence, not page timing.
 */
export type EccLearningObservation =
  | { eventId: string; type: 'tool'; tool: EccLearningTool; outcome: 'ok' | 'error'; runKey?: string }
  | { eventId: string; type: 'correction'; preference: EccLearningCorrection }
  | { eventId: string; type: 'feedback'; instinctId: string; verdict: 'confirm' | 'contradict' };

export interface EccLearningConfig { enabled: boolean }
export type EccLearningDomain = 'workflow' | 'debugging' | 'user-correction';

export interface EccLearningInstinct {
  id: string;
  trigger: string;
  action: string;
  domain: EccLearningDomain;
  confidence: number;
  supports: number;
  contradictions: number;
  lastSeenAt: string;
  source: 'observed' | 'imported';
  scope: 'project';
  /** Only an explicit affirmative review enables context applicability. */
  approved: boolean;
}

export interface EccLearningStatus {
  config: EccLearningConfig;
  observationCount: number;
  instinctCount: number;
  proposalCount: number;
  pendingObservations: number;
}

export interface EccLearningReceipt {
  accepted: boolean;
  reason: 'disabled' | 'duplicate' | 'recorded';
  observationCount: number;
}

export interface EccLearningProposal {
  id: string;
  kind: 'skill' | 'command';
  title: string;
  confidence: number;
  instinctIds: string[];
  /** INERT Markdown draft for review, not an executable or installed Skill. */
  markdown: string;
  status: 'review-required';
}

export interface EccLearningPromotionCandidate {
  instinctId: string;
  projectCount: number;
  averageConfidence: number;
  projectIds: string[];
  status: 'review-required';
}

/** Import/export contains intentionally no journal, path, chat, session or evidence IDs. */
export interface EccLearningBundle {
  schema: 'cos.ecc-learning.export.v1';
  instincts: Array<Pick<EccLearningInstinct, 'id' | 'trigger' | 'action' | 'domain' | 'confidence'>>;
}
