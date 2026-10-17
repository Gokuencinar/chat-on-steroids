---
name: "ECC: Verification loop"
description: "Verify a completed change through build, static checks, relevant tests, security and diff review."
---

Adapted from ECC v2.2.3 by Affaan Mustafa (MIT): https://github.com/affaan-m/ECC. This CoS adaptation uses only the tools available in the current conversation.

# Verification loop

1. Read package scripts or the repository's documented checks. Never assume commands exist.
2. Run a suitable build and typecheck, then lint/static analysis when configured.
3. Execute targeted tests, followed by broader tests when the change warrants them. Record exact failures and skipped checks.
4. Review changed code for unsafe input handling, leaked secrets, permissions, race conditions and unexpected file changes. Use established scanners only when available.
5. Inspect git diff and git status; do not reset or clean unrelated work.
6. Summarize evidence as build / types / tests / security / diff, each with PASS, FAIL or NOT RUN plus the reason.

Only call work ready if the relevant gates passed. A command's launch or a summary from another agent is not a passing test result.
