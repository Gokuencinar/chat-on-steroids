# CoS project memory vault (ECC-inspired)

This is a native Electron main-process vault. It follows the useful, local-first
ideas of [ECC v2.2.3's memory design](https://github.com/affaan-m/ECC/blob/v2.2.3/docs/design/ecc-memory-vault.md),
with a deliberately smaller schema (`ecc.memory.v1`) and no ECC runtime dependency.
It is **not** an ECC plugin or a second conversation recorder.

## Ownership and scope

Each selected local project's files live only under:

```text
<selected-project>/.ecc/memory/project/
  .gitignore                       # prevents accidental git tracking
  decisions/mem_<32-hex>.md
  lessons/mem_<32-hex>.md
  handoffs/mem_<32-hex>.md
```

Markdown files are authoritative. Each contains fixed JSON-valued YAML
frontmatter (`schema`, `id`, `title`, `kind`, `scope`, `trust`, `status`,
`source_harness`, `target_harnesses`, `tags`, `links`, `created_at`, `updated_at`)
followed by arbitrary Markdown body. The only trust
value is `unreviewed`; no text is automatically recalled, appended to AGENTS.md,
promoted into rules or inserted into any prompt. `save` only creates a new
document and never edits existing documents. There is no delete operation.
The **singular** API kinds `decision`, `lesson` and `handoff` map to the
**plural** storage folders `decisions/`, `lessons/` and `handoffs/` in
`src/main/ecc-memory.ts` (`KIND_DIRECTORY`). The current native writer sets
`scope: "project"`, `source_harness: "cos"`, `target_harnesses: ["cos"]`,
`links: []` and identical `created_at`/`updated_at` timestamps; those fields
are validated on subsequent reads. The schema is deliberately restricted to
these locally supported values.
Users may review/delete project files via their ordinary filesystem workflows.
On first save, the module creates a protective `project/.gitignore` containing
`*` and `!.gitignore`. It refuses further saves if that protection is modified.

Unlike ECC's cross-harness vault, this first native CoS vault has only **project**
scope. `team` and `user` scopes, session hook integration, auto-learning,
embedding search and auto-recall are intentionally absent.

## Contract for main-process callers

Import the functions from `src/main/ecc-memory.ts` and types from
`src/shared/ecc-memory.ts`. All functions are asynchronous:

```ts
const access: EccMemoryProject = {
  projectDirectory: resolved.real,
  approvedRootDirectory: resolved.root.path,
};

const saved = await saveEccMemory(access, {
  kind: 'decision',
  title: 'Keep one session owner',
  body: 'Exact local session identity survives browser chat replacement.',
  tags: ['architecture'],
});
const summaries = await listEccMemories(access, { kind: 'decision', limit: 10 });
const matches = await searchEccMemories(access, { query: 'session owner', limit: 10 });
const exact = await readEccMemory(access, { kind: saved.kind, id: saved.id });
```

The `resolved` value in the example MUST be obtained by re-resolving the
**explicitly selected project's** canonical `project.path` against the **current**
`getConfig().roots` through `resolvePath`, as `src/main/projects.ts` does in
`projectWorkspace`. The caller should verify project ID/session ownership,
recheck current `read`/`create` capability and read-only mode, and resolve paths
again on every request. **Passing a caller-supplied string as an approved root is
not authorization.** An unfiled chat must not fall back to the first workspace.

This vault also checks that the project is an existing canonical absolute
directory contained in the approved root and validates paths before every file
operation. It rejects linked/junction storage components and files, hard-linked
files, traversals, non-canonical roots, malformed frontmatter, invalid UTF-8,
and unexpected files in its inventory. These checks protect against common
filesystem redirections; they are not a guarantee against a malicious OS-level
process running under the same user and racing directory replacements.

Return types:

| Function | Return |
| --- | --- |
| `saveEccMemory(access, {kind,title,body,tags?})` | `Promise<EccMemoryEntry>` including body |
| `readEccMemory(access, {kind,id})` | `Promise<EccMemoryEntry \| null>` |
| `listEccMemories(access, {kind?,limit?})` | `Promise<EccMemorySummary[]>` without body |
| `searchEccMemories(access, {query,kind?,limit?})` | `Promise<EccMemorySummary[]>` without body |

The error `EccMemoryError` has `code` `ACCESS`, `INVALID`, `SECRET`,
`UNSAFE_PATH`, `CORRUPT`, or `LIMIT`. Expose sanitized errors to UI rather than
leaking native paths. Search is local lexical AND-match ranking over titles,
tags and bodies; no external service, model calls or network.

## Bounds and trust

Titles: 160 characters; body: 16 KiB UTF-8; complete document: 24 KiB; tags:
8; documents per kind: 256; list/search results: 30; query: 160 characters
and 8 words. Saving rejects known key/token/password/private-key patterns,
which is a best-effort backstop rather than exhaustive secret detection. If a
stored document is edited or corrupt, listing/search fails visibly rather than
inventing a complete/clean inventory. Calls never evaluate Markdown as commands.

To verify: `npx vitest run test/ecc-memory.test.ts` and `npm run typecheck`.
