# Multi-chat reliability audit — 2026-09-26

Compared fork `7a787847cb829aecc0c6d8715ba9ba4fbcbbf3c2` with upstream
`750fad9378a0cf9e37791916b11f7ed9add645dd`. Upstream is an ancestor of the fork:
42 additional commits, 142 changed files. No provider conversations or private runtime
data are included in this worklog or the regression fixtures.

## Repairs

- Bridge observation custody was one global counter. A pending batch in conversation B
  prevented a valid repair claim for conversation A. Track pending counts by conversation
  for repair claims, Goal activation and silence-input filing. Keep aggregate guards for
  family-wide cleanup. No new scheduler, retry loop, wire format or send permission.
- Session ownership lookup returned null after an incomplete catalog scan. The recorder
  interprets null as permission to create a session, potentially splitting an existing
  conversation's history. Throw on unresolved ownership caused by unreadable storage so
  normal observation retry retains custody. Preserve successful readable-owner lookups.

Both defects originate in upstream logic. The fork had already improved failed-read
handling and catalog invalidation, but still returned null on this path.

## Evidence

Regression tests first failed on the unmodified fork: an unrelated held observation
refused the repair claim, and an unreadable ownership lookup returned null. Both now pass;
the same-chat pending observation still refuses the claim until committed. The storage
regression also checks that recorder admission cannot create a replacement directory.

Typecheck, diff whitespace, production license notices and native-source inventory passed.
The six adjacent suites (session, bridge, session-input, input-delivery-integration,
bridge-done-repair-silence and extension) passed all 1,427 tests using Vitest threads with
temporary in-process TypeScript transformation. Standard verification stopped at its Git
history subprocess; production build was blocked by esbuild spawn EPERM. No installer was built.
Validation details are recorded in the accompanying audit report.
These source fixes are not an installed-runtime or signed-in ChatGPT acceptance
claim. The installed app, live ledgers, browser extension and remote repositories are unchanged.
