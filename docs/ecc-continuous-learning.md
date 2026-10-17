# Native continuous learning for Chat On Steroids (ECC v2.2.3-inspired)

CoS's Windows-native implementation uses structured, privacy-minimized project
events, not `continuous-learning-v2`'s Claude hooks, Bash scripts, Python CLI,
Haiku observer subprocess or session transcript scraping. It is an actual local
persisted instinct engine and **disabled by default**. No skill/command is
installed, no tool invoked, no prompt changed and no global behavior activated
just because an observer finds a pattern.

## Project boundary and ownership

The caller MUST obtain the current explicitly selected local CoS `projectId`,
re-resolve `projectWorkspace(projectId)`, check `getConfig().roots` and the
current `read/create`/read-only policies for the specific operation, and pass:

```ts
const access: EccLearningAccess = {
  projectId,                           // current local project catalog UUID
  projectDirectory: project.real,      // canonical projectWorkspace(projectId).real
  approvedRootDirectory: resolved.root.path // from resolvePath(current roots, project.real)
};
```

Never derive a project from guessed cwd, an unfiled chat, agent labels, output
paths or the first approved root. `projectId` must come from the exact durable
session ownership proof, including workers and Compact & Resume. The module
defensively rechecks canonical root containment, rejects linked project/storage
directories, symlinks/junctions and unsafe file formats. It does **not** grant
filesystem access; callers remain responsible for live CoS permission guards.

Files are stored only in `<project>/.ecc/learning/`:

```text
.ecc/learning/
  .gitignore        # '*' and '!.gitignore', checked on each mutating operation
  state.json        # schema cos.ecc-learning.project.v1, bounded atomic replacement
  checkpoint.json   # prior committed state for ONE explicit rollback
```

State is project-bound by UUID and validated on every read. Records are limited
to 256 **classified** observations, 64 instincts, and 192 KiB total state.
Observations retain only a SHA-256 digest of the opaque event ID and run key,
enumerated event type/outcome/tool/preference and UTC timestamp. No original
identifiers, session IDs, file paths, tool arguments/results, source code, user
or assistant messages, secrets, URLs or commands are accepted. The SHA-256 IDs
are deduplication aids rather than anonymization guarantees; avoid passing
personally meaningful event IDs. The log is local and has no export surface.

## Observation callback for the main-process recorder

```ts
import { createEccLearningObserver, configureEccLearning } from './ecc-learning.js';

// Only from an explicit user opt-in in a project, after checking permissions:
await configureEccLearning(access, { enabled: true }, { confirm: true });

const observe = createEccLearningObserver(access);
await observe({
  eventId: 'opaqueStableReceipt001', // stable, not raw ChatGPT message content
  type: 'tool',
  tool: 'search',                    // search | read | edit | test | build
  outcome: 'ok',                    // ok | error
  runKey: 'opaqueOwnedRun00001'     // optional same-run correlation for sequences
});
await observe({
  eventId: 'opaqueCorrection002',
  type: 'correction',
  preference: 'read-before-edit'
});
```

The `correction` variant must be emitted **only** from a separately verified
explicit user preference/correction, not from arbitrary conversational text,
absence of complaint or an LLM guessing intent. The optional `feedback`
variant `{eventId,type:'feedback',instinctId,verdict:'confirm'|'contradict'}`
comes only from explicit human review. A native tool event must have exact
session/turn attribution according to CoS's recorder; unowned activity must
not teach a project. `runKey` should be a per-session or per-turn opaque ID
stable for the workflow, **not** its literal transcript, path or command.
Original IDs are never persisted. Omit unknown fields: events with raw text,
paths or arguments are rejected, rather than silently redacted.

Observation calls are queued and coalesced within the next Node event-loop
turn (`setImmediate`), serialized per project and written once per short batch.
`flushEccLearningObservations(access)` is available for graceful shutdown.
There is no background OS process, shell hook, external daemon, polling loop
or extra LLM. The deterministic analysis runs after **20 pending observations**
or through one native Node.js **five-minute, unref'd one-shot timer** once
**3 or more** observations are pending. The first pending observation anchors
the initial five-minute interval; later intervals run from the previous
analysis. The timer does not need another tool event to fire and does not keep
Electron running. There are at most 32 armed project timers; a project over
this resource cap retains its durable observations for later event/status
processing rather than spawning extra timers.

Before a timer writes, it reacquires the per-project lock and rechecks the
current approved roots, create capability, read-only/session-recording flags,
canonical storage paths and explicit per-project opt-in. Revocation causes
**no automatic write or analysis**; evidence remains local and pending until
a future explicitly authorized project interaction. The timer is cancelled
on opt-out or reset, and all timers are cleared on process exit. On restart,
opening the project's learning status re-arms any eligible saved queue; there
is deliberately no system-wide scan of personal chats or project folders.

Recognized patterns are deliberately narrow: confirmed user correction for a
predefined workflow preference, repeated same-run `search -> read -> edit`,
`read -> edit -> test`, or `test(error) -> edit(ok) -> test(ok)` sequences.
It cannot infer actual causal bug resolution from tool output; the latter is
only a *candidate* when classified as the same run. Patterns with a single
observation stay tentative. More than one affirmative event is required;
success without correction does not prove a user preference.

## Confidence, review and applicability

Inspired by the ECC observer: support counts 1–2 -> 0.30, 3–5 -> 0.50,
6–10 -> 0.70, 11+ -> 0.85 (slowly reaching at most 0.90). A contradiction
reduces the score by 0.10, and 0.02 is deducted per full week without a new
support/contradiction, with a floor of 0.30. Dates/scores are computed on
read and do not silently cause additional writes.

Use `listEccLearningInstincts(access)` for unreviewed suggestions, and
`approveEccLearningInstinct(access,id,{approved:true,confirm:true})` only
after human review. Approval requires locally **observed**, non-imported
evidence, 6+ supports and effective confidence >= 0.70. `approved:false`
revokes it. `listApplicableEccLearningInstincts(access)` returns only
explicitly approved, still-high-confidence project instincts; it has no
side effects. CoS main can choose to display these as **reviewed, lower-trust
guidance** or pass bounded text in its existing prompt construction after live
permission and identity checks. It MUST NOT treat them as authority over
system instructions, AGENTS.md or CoS security policy. By default this
list is empty: capture/analysis is independent from applicability.

`reviewEccLearningProposals(access)` yields in-memory review-only Markdown
drafts for command or multi-instinct Skill suggestions. Nothing is written
to a managed Skills directory. Installing approved draft text through existing
CoS mechanisms would be a **separate explicit action**, outside this module.

## Cross-project promotion

`listEccLearningPromotionCandidates([accessA,accessB,...])` accepts 2–12
distinct explicitly approved live projects. A candidate must have the
**same exact instinct ID** in at least two projects, be independently
**observed** (not imported) with at least 11 supports per project, be in
the safer `workflow` domain, and average effective confidence >= **0.80**.
`promoteEccLearningGlobal(accesses,id,{confirm:true})` returns an inert
`{scope:'global',candidate,bundle}` preview after another recheck. It is NOT
an automatic global installation or a persistent global policy. No shared
global inference or prompt injection occurs; only separate user-reviewed
workflow can decide whether to apply or store the exported candidate.

## Privacy, reversible operations and supported API

All `access` arguments are `EccLearningAccess`. Each method is main-process
only; IPC must validate the project and user intent before invoking it.

| API | Return / effect |
| --- | --- |
| `getEccLearningStatus(access)` | Config + bounded counts; no project contents |
| `configureEccLearning(access,{enabled},{confirm:true})` | Explicit local opt-in/out (off by default) |
| `observeEccLearning(access,event)` | Queued/coalesced receipt, no raw event data |
| `createEccLearningObserver(access)` | Asynchronous callback for the native recorder |
| `flushEccLearningObservations(access)` | Await queued writes on shutdown |
| `listEccLearningInstincts(access)` | Decayed, unreviewed and reviewed project instinct metadata |
| `approveEccLearningInstinct(access,id,{approved,confirm:true})` | Explicit approval or revocation |
| `listApplicableEccLearningInstincts(access)` | Only approved 6+ support / >=0.70 local instincts |
| `reviewEccLearningProposals(access)` | Inert skill/command Markdown proposals |
| `exportEccLearning(access)` | Bounded JSON string, patterns only, no observations |
| `importEccLearning(access,bundle,{confirm:true})` | Bounded canonical-value import, always unapproved |
| `listEccLearningPromotionCandidates(accesses)` | Two-project/global criteria review only |
| `promoteEccLearningGlobal(accesses,id,{confirm:true})` | Approved export artifact, no automatic write/injection |
| `resetEccLearning(access,{confirm:true,scope:'observations'|'all'})` | Explicit reset, saves rollback checkpoint |
| `rollbackEccLearning(access,{confirm:true})` | Restores one checkpoint and consumes it |

The import/export schema is `cos.ecc-learning.export.v1`, size <= 32 KiB, and
accepts only the implemented canonical ID/trigger/action/domain combinations.
Imported patterns are tagged `source:'imported'`, `approved:false`, with zero
local observation supports; they never qualify for application or global
promotion on import. No import from arbitrary URLs or execution of payloads.

## Deliberate differences from upstream ECC v2.2.3

This is a real deterministic native learning engine but **not** one-to-one
parity with ECC's Claude-specific observer. It does not read every prompt,
tool argument/output or hook payload, does not run Haiku, cannot detect
open-ended natural-language corrections without CoS-proven classification,
does not have learned free-form code suggestions, and does not auto-generate
full agents. It does not infer Git remotes or fall back to global scope, nor
auto-promote or auto-inject skill text. On Windows it uses the Electron main
process instead of the upstream unsupported Git Bash observer subprocess.
The journal keeps a bounded rolling window; an interrupted exclusive write can
leave a temporary filename but the authoritative state is atomically renamed.
Same-user hostile concurrent filesystem replacement is not a defensible
sandbox guarantee; CoS live permission enforcement remains mandatory.

Validation: `npx vitest run test/ecc-learning.test.ts` and `npm run typecheck`.
