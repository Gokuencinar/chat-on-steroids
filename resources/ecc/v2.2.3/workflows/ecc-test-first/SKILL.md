---
name: "ECC: Test-first development"
description: "Use a failing regression test, a minimal fix and focused verification for behavior changes."
---

Adapted from ECC v2.2.3 by Affaan Mustafa (MIT): https://github.com/affaan-m/ECC. This CoS adaptation uses only the tools available in the current conversation.

# Test-first development

1. Identify a meaningful externally observable behavior, a concrete failure and the public interface that exercises it.
2. Choose a small test that would fail on the existing defect for the correct reason. Run the test and capture that failure.
3. Implement the simplest change that makes it pass; preserve the project's design and existing changes.
4. Run the focused test, relevant neighboring tests and the type checker or build. Check empty, invalid and concurrent paths when applicable.
5. Inspect the diff for unnecessary changes, brittle tests and behavior that the test still misses.

For purely cosmetic or very small reversible edits, apply the project's testing guidance instead of writing a test that only mirrors the implementation. Report what actually ran.
