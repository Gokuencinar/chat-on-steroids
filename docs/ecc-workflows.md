# ECC 2.2.3 workflows in Chat On Steroids

This integration adapts eight practical workflows from
[Everything Claude Code (ECC)](https://github.com/affaan-m/ECC), release v2.2.3,
for CoS's existing managed Skills. The source is MIT licensed, copyright
Affaan Mustafa, 2026; see `docs/licenses/ecc-LICENSE`.

## Verified ECC skills available in CoS

ECC v2.2.3 contains 293 original Skills. The upstream `pi/core` subset contains
123 (122 of the original names plus `ecc-council`). **Twenty-five individually
reviewed, source-SHA-pinned Skills are bundled and eligible for explicit ECC
import** in this customized CoS release. Twenty-one are in upstream Pi's original
subset and four were independently reviewed outside that subset.

The first five are preserved byte-for-byte. Fourteen additional upstream
one-file Skills are also preserved byte-for-byte (including `living-docs-governance`).
Six have **minimal, deterministic, text-only CoS adaptations**:
`i18n-sync` removes links to
unbundled sibling/hook files and explains existing Core tools; `ai-regression-testing`
replaces the illustrative Claude `.claude/commands/bug-check.md` command with
an explicit CoS review workflow; `agent-introspection-debugging` replaces
unbundled ECC workflow references with existing CoS evidence/verification;
`click-path-audit` replaces the eight-agent example and unavailable Superpowers
commands with CoS's actual worker limits and tools; `benchmark-optimization-loop`
removes Claude-specific Bash tool metadata and constrains benchmark execution
to permitted environments; `accessibility` clarifies WCAG criteria and the
limits of a text-guided audit. For these six, the catalog records **both**
the vetted upstream `sourceSha256` and the actual bundled `sha256`. No hook,
CLI, model router or executable from ECC is installed.

| Verified original Skill | Compatibility finding |
| --- | --- |
| `agent-harness-construction` | Tool-contract and debugging guidance using current CoS tools |
| `ai-first-engineering` | Offline engineering, evaluation and review guidance |
| `architecture-decision-records` | Repository-local Markdown ADR templates and approval-aware capture |
| `content-hash-cache-pattern` | Self-contained Python standard-library examples for caching |
| `hexagonal-architecture` | Framework-independent architecture and testing guidance |
| `ai-regression-testing` | Bug-specific regression and sandbox/production contract checks; CoS review adaptation |
| `api-design` | REST URL, pagination, validation, authentication, errors and versioning |
| `backend-patterns` | API, data access, caching and background-job patterns |
| `benchmark-methodology` | Evidence-based competitor comparison and explicit weighted scoring |
| `coding-standards` | Readability, naming, quality principles and project conventions |
| `contract-first` | Single authoritative API/event contract and consumer compatibility |
| `error-handling` | Typed error, recovery and result patterns across languages |
| `frontend-a11y` | Semantic HTML, ARIA, form accessibility and keyboard use |
| `frontend-patterns` | Frontend composition, state and rendering patterns |
| `i18n-sync` | JSON localization with placeholder and diff checks; CoS guidance adaptation |
| `intent-driven-development` | Scoped observable acceptance criteria and blocking decisions |
| `iterative-retrieval` | Targeted search, evaluation and refinement before editing |
| `kotlin-patterns` | Idiomatic Kotlin language and coroutine patterns |
| `production-audit` | Local evidence and release-readiness review without remote scanner |
| `python-patterns` | Idiomatic Python types, modules, validation and error handling |
| `agent-introspection-debugging` | Capture, diagnose and recover a failed agent run; CoS workflow references |
| `click-path-audit` | Trace UI handlers and state transitions; CoS-limited delegation |
| `living-docs-governance` | Maintain authoritative project map, status, decisions and instruction links |
| `accessibility` | Review Web/iOS/Android accessibility with qualified WCAG 2.2 guidance |
| `benchmark-optimization-loop` | Bounded baseline, correctness gate and measured variants; permitted tools only |

**268 skills are excluded before the searchable catalog and bundled resources.**
Among them, 167 are outside upstream `pi/core` and 101 are present there but
have **not** passed the separate CoS review. The upstream Pi distribution
criteria are informational, not the decision rule for a positively reviewed
CoS candidate. Exclusion does not mean every remaining Skill is broken. Examples include
`continuous-learning-v2` (Claude hooks), `verification-loop` (POSIX shell),
`agentic-engineering` (hard-coded model families) and `security-review` (requires
additional platform-specific review before import).

The managed Skills library currently supports **64 installed Skills at once**.
This cap applies to managed imports, not the separately bounded discovery of
project/user/external Skills. Each vetted ECC Skill is imported manually
into the same managed library as other CoS Skills. Its source index is generated
with `scripts/generate-ecc-catalog.mjs` from the exact v2.2.3 checkout, with
SHA-256 checks **before** adaptations and independent bundle digest checks.
The packaged folder includes only these 25 approved `SKILL.md` files. The
import path rejects unknown IDs, extra files, symlinked packages and changed
bundled bytes. To audit a checkout and existing staged content without changing
anything, run `node scripts/generate-ecc-catalog.mjs ../ECC-2.2.3-source --check`.
An intentional source or adaptation revision needs independent review, a new
pinned source digest, regenerated assets and passing catalog tests.

Compatibility means the workflow is **expressible with ordinary CoS tools**,
not that every example can execute on every project or that an optional tool is
installed. Package manager commands, specialized languages and third-party
utilities in examples remain inert until the user requests the appropriate
work in an authorized project with those dependencies already present. No
scheduled inspection, automatic browser probe, translation service or new
permission is enabled merely by installing a Skill. Where a full environment
is absent, the assistant must report which check could not run.

## Native project features

Open the dedicated **ECC** page from the CoS sidebar, choose a local project
and use the **Continuous learning**, **Project memory**, **Security** or
**ECC Skills** sections independently. If the project selector is empty,
choose **Add project folder**; approved filesystem roots do not automatically
become project entries. Project creation uses CoS's existing folder picker and
permission checks. You can record a decision, lesson or handoff, search notes
and perform a static security scan of selected configuration files.
Notes are stored under the project's `.ecc/memory/project/` directory; they
are unreviewed data and never silently inserted into conversation prompts.
The native Core connector also offers `ecc_memory` and `ecc_security_audit`
for chats already bound to a local CoS project, using the current approved
roots and live permissions. Neither function runs Claude hooks or grants
extra file/command permissions. See `docs/ecc-memory.md` and
`docs/ecc-security.md` for the precise filesystem and scan boundaries.

## Install and use

### Windows 2.1.45 command-line updater

The Windows CMD `Actualizar-CoS-ECC-Skills-Apariencias-2.1.45.cmd` compiles and
validates the nine built-in appearance presets and complete ECC release
resources. After the installer completes, it **offers**, but never silently
installs, the 25 verified ECC Skills, eight native workflows and separate
`/ecc-all` orchestrator. Previously installed Skills remain intact, even if
edited by the user. To apply only missing optional Skills after an upgrade
while CoS is closed, run this same CMD with `/skills-only`.

The app's existing full-pack action stays **33** (eight workflows + 25 reviewed
Skills), while the CMD can add `/ecc-all` as a separate 34th convenience Skill.
The CMD changes no personal appearance setting; use Settings → Appearance to
select among the nine shipped styles.

Open CoS's **ECC → ECC Skills → ECC All Workflows** card. Choose one of two
explicit installation modes:

- **Install 8 workflows:** the established `ecc-core-pack` action keeps its
  original scope and installs only the eight CoS-native commands below.
- **Install complete ECC pack (33 Skills):** the new `ecc-complete-pack` action
  displays a confirmation dialog before installing the eight workflows **plus
  all 25 source-pinned compatible ECC Skills** listed above. The dialog shows
  how many Skills are missing and the available slots in the 64-Skill library.
  It does not silently install anything when merely opening the ECC page.

These are the eight native CoS workflow commands:

| Skill | Purpose |
| --- | --- |
| `/ecc-engineering-loop` | Plan → research → implement → review → verify → learn. |
| `/ecc-search-first` | Search and assess existing solutions before coding. |
| `/ecc-test-first` | Reproduce the bug and write meaningful tests before fixing it. |
| `/ecc-verification` | Build, typecheck, test, review the diff, report evidence. |
| `/ecc-security-review` | Inspect agents, prompts, shell hooks, configs and permissions. |
| `/ecc-agent-review` | Coordinate bounded reviews using CoS's own agent workers. |
| `/ecc-lessons-learned` | Promote verified lessons into explicit scoped project Skills. |
| `/ecc-context-handoff` | Preserve evidence across CoS Compact & Resume. |

Type the slash command in the CoS prompt. Skills remain optional, individually
removable and usable with existing project/user Skills. Both installation modes
reuse already installed IDs **without replacing or rewriting user-customized
contents**. The complete mode validates the exact SHA-256 of every included
ECC Skill and checks all 33 candidate package documents, orphan folders and
capacity under the shared serialized Skills import owner **before the first
write**. Simultaneous single imports and basic/complete installs cannot silently
overwrite one another. Normal repeat installs are idempotent. If an unexpected
I/O error interrupts a batch after the preflight, previously published Skills
are retained rather than destructively rolled back; a later retry picks up the
remaining items. Read-only/disabled creation permissions must still be honored.

## Scope and compatibility

This is an **ECC-inspired CoS workflow pack**, not the complete upstream ECC
runtime. The workflows use CoS's existing `agents`, `update_plan`, terminal,
Skills and session functionality. No external CLI, extra background service,
automatic observation hook, AgentShield binary or network dependency is added.
In particular, `ecc-lessons-learned` guides deliberate knowledge capture; it
does not silently collect sessions, and `ecc-security-review` is a guided
review, not a claimed native AgentShield scan. Claude Code-specific hooks and
the other 268 upstream skills are neither included in this ECC catalog nor
packaged as ECC resources. The normal general-purpose CoS GitHub import feature
is separate from this strictly verified ECC selection.
