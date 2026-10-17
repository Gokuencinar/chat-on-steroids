/** Durable, inert project knowledge. No memory is automatically injected into a prompt. */
export const ECC_MEMORY_KINDS = ['decision', 'lesson', 'handoff'] as const;
export type EccMemoryKind = (typeof ECC_MEMORY_KINDS)[number];

/** Both paths must come from the caller's CURRENT approved sandbox/project resolution. */
export interface EccMemoryProject {
  /** Absolute, canonical existing project directory, e.g. projectWorkspace(projectId).real. */
  projectDirectory: string;
  /** Absolute directory of the CURRENT approved root containing that project. */
  approvedRootDirectory: string;
}

export interface EccMemorySave {
  kind: EccMemoryKind;
  title: string;
  body: string;
  tags?: string[];
}

export interface EccMemoryKey {
  kind: EccMemoryKind;
  id: string;
}

export interface EccMemorySummary extends EccMemoryKey {
  title: string;
  tags: string[];
  createdAt: string;
  trust: 'unreviewed';
  status: 'active';
}

export interface EccMemoryEntry extends EccMemorySummary {
  body: string;
}

export interface EccMemoryFilter {
  kind?: EccMemoryKind;
  limit?: number;
}

export interface EccMemorySearch extends EccMemoryFilter {
  query: string;
}

/** Deliberate closed set; no deletion or automatic recall/promotion is exposed. */
export const ECC_MEMORY_LIMITS = {
  maxTitleChars: 160,
  maxBodyBytes: 16 * 1024,
  maxDocumentBytes: 24 * 1024,
  maxTags: 8,
  maxEntriesPerKind: 256,
  maxResults: 30,
  maxQueryChars: 160
} as const;
