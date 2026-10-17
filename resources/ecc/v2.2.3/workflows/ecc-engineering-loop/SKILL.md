---
name: "ECC: Engineering loop"
description: "Plan, test, implement, review, verify and capture lessons in a repeatable engineering workflow."
---

Adapted from ECC v2.2.3 by Affaan Mustafa (MIT): https://github.com/affaan-m/ECC. This CoS adaptation uses only the tools available in the current conversation.

# Engineering loop

1. Establish the requested outcome, acceptance criteria and constraints. Inspect the actual project and its instructions.
2. For substantial changes, publish a plan using the available CoS update_plan tool. Keep one step active.
3. Search the existing project and relevant tools before adding a dependency or a new abstraction.
4. Reproduce defects and write meaningful regression tests when the change warrants them. Implement the smallest correct design.
5. Inspect the diff and test evidence. For independent reviews, delegate a bounded task through CoS agents when enabled.
6. Run build, typecheck, tests and security checks appropriate to the repository. Report which checks passed, failed or were unavailable.
7. Record durable, reusable discoveries in a project document or Skill only when the user wants them retained. Close with changed files and limitations.

Use /ecc-search-first, /ecc-test-first, /ecc-verification, /ecc-security-review and /ecc-lessons-learned for detailed phases. Never claim a check passed without running it.
