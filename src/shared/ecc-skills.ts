/**
 * Optional engineering workflows adapted for Chat On Steroids from ECC v2.2.3.
 * ECC is MIT licensed: https://github.com/affaan-m/ECC (Affaan Mustafa, 2026).
 * These are plain, inert Skills. Claude Code hooks, scripts and privileges are not imported.
 */
import type { RecommendedSkill } from './recommended-skills.js';

function workflow(id: string, name: string, description: string, body: string): RecommendedSkill {
  const attribution = 'Adapted from ECC v2.2.3 by Affaan Mustafa (MIT): https://github.com/affaan-m/ECC. This CoS adaptation uses only the tools available in the current conversation.\n';
  return {
    id, name, description,
    markdown: `---\nname: ${JSON.stringify(name)}\ndescription: ${JSON.stringify(description)}\n---\n\n${attribution}\n${body.trim()}\n`
  };
}

/** A deliberately bounded subset: each skill works without Claude Code or background hooks. */
export const ECC_SKILLS: readonly RecommendedSkill[] = [
  workflow('ecc-engineering-loop', 'ECC: Engineering loop',
    'Plan, test, implement, review, verify and capture lessons in a repeatable engineering workflow.', `
# Engineering loop

1. Establish the requested outcome, acceptance criteria and constraints. Inspect the actual project and its instructions.
2. For substantial changes, publish a plan using the available CoS update_plan tool. Keep one step active.
3. Search the existing project and relevant tools before adding a dependency or a new abstraction.
4. Reproduce defects and write meaningful regression tests when the change warrants them. Implement the smallest correct design.
5. Inspect the diff and test evidence. For independent reviews, delegate a bounded task through CoS agents when enabled.
6. Run build, typecheck, tests and security checks appropriate to the repository. Report which checks passed, failed or were unavailable.
7. Record durable, reusable discoveries in a project document or Skill only when the user wants them retained. Close with changed files and limitations.

Use /ecc-search-first, /ecc-test-first, /ecc-verification, /ecc-security-review and /ecc-lessons-learned for detailed phases. Never claim a check passed without running it.
`),
  workflow('ecc-search-first', 'ECC: Search first',
    'Research existing implementations and dependencies before building new functionality.', `
# Research before implementation

1. Describe the specific missing capability, its inputs, outputs, constraints and supported platforms.
2. Search the current repository and callers first. Then inspect installed dependencies, official documentation, package registries and established open-source alternatives where accessible.
3. Compare candidates on licensing, maintenance, dependency size, security, API fit, testability and integration cost. Confirm versions and licenses from sources.
4. Choose reuse, adaptation or a small custom implementation. Explain the choice in terms of observable requirements.
5. Implement and verify with the project's normal tools. Do not download or execute third-party installers without a reason and the applicable authorization.

If a search channel is unavailable, name the missing evidence and continue from verified local facts. A README claim is not proof that an API works in this environment.
`),
  workflow('ecc-test-first', 'ECC: Test-first development',
    'Use a failing regression test, a minimal fix and focused verification for behavior changes.', `
# Test-first development

1. Identify a meaningful externally observable behavior, a concrete failure and the public interface that exercises it.
2. Choose a small test that would fail on the existing defect for the correct reason. Run the test and capture that failure.
3. Implement the simplest change that makes it pass; preserve the project's design and existing changes.
4. Run the focused test, relevant neighboring tests and the type checker or build. Check empty, invalid and concurrent paths when applicable.
5. Inspect the diff for unnecessary changes, brittle tests and behavior that the test still misses.

For purely cosmetic or very small reversible edits, apply the project's testing guidance instead of writing a test that only mirrors the implementation. Report what actually ran.
`),
  workflow('ecc-verification', 'ECC: Verification loop',
    'Verify a completed change through build, static checks, relevant tests, security and diff review.', `
# Verification loop

1. Read package scripts or the repository's documented checks. Never assume commands exist.
2. Run a suitable build and typecheck, then lint/static analysis when configured.
3. Execute targeted tests, followed by broader tests when the change warrants them. Record exact failures and skipped checks.
4. Review changed code for unsafe input handling, leaked secrets, permissions, race conditions and unexpected file changes. Use established scanners only when available.
5. Inspect git diff and git status; do not reset or clean unrelated work.
6. Summarize evidence as build / types / tests / security / diff, each with PASS, FAIL or NOT RUN plus the reason.

Only call work ready if the relevant gates passed. A command's launch or a summary from another agent is not a passing test result.
`),
  workflow('ecc-security-review', 'ECC: Agent security review',
    'Audit agent prompts, tool configuration, secrets, permissions and shell hooks with concrete evidence.', `
# Agent and repository security review

Review only files and systems within the approved scope. Identify the active instruction files, MCP/plugin configuration, generated scripts and tool permissions. Trace untrusted text that may reach a shell, URL, filesystem path or privileged tool. Check for hardcoded secrets without disclosing values, dangerous wildcard grants, silent failures, unaudited downloads and prompt-injection escalation paths.

For each verified problem, provide severity, file/line, a concrete exploit or failure path and the smallest safe mitigation. Prefer static review first. If a trusted AgentShield installation is already available, it may supplement the review; do not treat it as integrated into CoS or run a remote npx command automatically. Never make security-sensitive edits without checking what they break.

Finish by identifying what was inspected, what was skipped and whether any issue is confirmed or only suspected.
`),
  workflow('ecc-agent-review', 'ECC: Parallel agent review',
    'Delegate bounded independent reviews to CoS workers and reconcile their evidence before completion.', `
# Parallel agent review

1. Split independent research, tests or review into tasks with explicit files, constraints and finish criteria. Keep only one owner for each edited file.
2. Check whether CoS agents are enabled. Reuse sleeping workers when possible; never invent their identities or spawn beyond the available capacity.
3. Send the exact task context and file ownership through agents. Do your own independent implementation while workers run.
4. Read actual worker reports and inspect resulting changes or tests yourself before accepting conclusions. Resolve conflicts in the main worktree deliberately.
5. Report confirmed results and anything that remains pending. A worker saying it is done does not prove a merge, test result or successful delivery.

Use update_plan for meaningful multi-step coordination. Follow the active CoS instructions for plan, worktree and agent lifecycle details.
`),
  workflow('ecc-lessons-learned', 'ECC: Lessons learned',
    'Turn verified recurring engineering lessons into a small, scoped project Skill or decision note.', `
# Evidence-based continuous learning

1. Extract a specific verified lesson: trigger, observed failure, root cause, successful response and evidence.
2. Search existing project documentation and Skills for a duplicate. Prefer updating the established authority.
3. Choose scope explicitly: project-specific rules belong in that project; general guidance may be proposed as a managed Skill. Keep private project paths and secrets out of shared guidance.
4. Draft a compact Skill with a concrete activation description, examples, boundaries and validation steps. Use the available /skills import route only if authorized.
5. Reassess the lesson after new evidence contradicts it, and remove obsolete directions rather than stacking exceptions.

This workflow does not run passive session observation or automatically modify memory. CoS session history and Compact & Resume handle continuity; any persistent rule change is deliberate and reviewable.
`),
  workflow('ecc-context-handoff', 'ECC: Context handoff',
    'Preserve decisions, evidence and remaining work when moving a long CoS conversation to a new chat.', `
# Strategic context handoff

At a meaningful milestone or when the conversation approaches its context limit, prepare a handoff containing: objective and user constraints; verified files/commits and test output; decisions with reasons; current worktree state; unresolved problems and the exact next action. Distinguish evidence from intentions.

Use CoS Compact & Resume when available so the durable local session and its ownership survive the provider-chat switch. Do not run a generic Claude Code /compact command or create unrelated browser conversations. Keep the handoff concise, precise, and sufficient for a fresh coding agent to continue without repeating completed work.
`)
];

export const ECC_PACK = {
  id: 'ecc-core-pack',
  name: 'ECC 2.2.3 — Engineering workflows',
  description: 'Install 8 ECC-inspired CoS Skills for planning, research, tests, security, verification, agent review, learning and handoff.'
} as const;

/** Separate explicit action; the eight-workflow pack keeps its historical behavior. */
export const ECC_COMPLETE_PACK = {
  id: 'ecc-complete-pack',
  name: 'ECC — All workflows and verified Skills',
  description: 'Install 8 CoS workflows and all 25 individually verified ECC Skills. Existing Skills are kept unchanged.'
} as const;
