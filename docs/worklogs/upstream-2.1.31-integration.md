# Official 2.1.30–2.1.31 integration into fork 2.1.39

Base fork: 148810bce5d00f1dc0108ddb3721dfdd2649e3b8 (2.1.38). Stable upstream: 7933265bed6faa239b6d6a35e009748b85a348b2. Canary/main changes after that tag are excluded. Original history is preserved by a two-parent merge.

## Resolution

- Preserve fork release automation, paired version 2.1.39, protocol 14, updater URLs/fallback/checksums, Cyberpunk CSS and attachment/Core-send/security safeguards.
- Preserve historical fork 2.1.30/2.1.31 notes; retain the official notes separately under docs/upstream.
- Adopt the new turn-trace IPC/preload/renderer contract and remove the obsolete livePreview IPC/import, matching upstream's removed module.
- Keep the fork's removed macOS Keychain notice removed, including its IPC entry; the Windows fork has no corresponding module or preload API.
- Keep the upstream attachment comment and file-open spy naming; their underlying fixes already existed in the fork.
- Map the current localized What's New highlights to fork 2.1.39.
- Keep What's New release-note links on the fork and align its real-Electron fixture expectation.

## Validation

- `npm ci` and `npm run build` passed.
- `npm run verify` passed: 313 general suites, 8,088 tests; 5 suites / 48 tests deliberately skipped by the existing platform/opt-in test configuration. Privacy, notices/native-source archives and TypeScript checks passed.
- The two native suites passed (28 tests), then passed again with `VITEST_MAX_WORKERS=1` and `--maxWorkers=1` to prove serial execution.
- `npm run verify:tunnel-current` confirmed the pinned v0.0.16 is still current.
- All 50 real-Electron UI checks passed across the initial run and focused reruns: 47 initially passed; sign-in passed with Git's bundled OpenSSL on the test process PATH; pet overlay passed after allowing less than 0.001px float noise while retaining the dimensions contract; the full setup guide passed in 356 seconds with a dedicated 10-minute harness limit (the first run exceeded six minutes while still capturing layouts). All locale/size/zoom cases remain covered.
- Cyberpunk persistence/reset/layout checks passed; its new chat screenshot was visually inspected. The math/font assets, timeline rounds, worker briefs, Goal/Loop, attachment/send protections and updater selection are covered by the passing full test suite.
- Final test-harness changes passed `node --check` and their affected Electron checks; no production code changed after the full suite/build.
- No installed app or user data has been changed. Source/build/fixture checks do not prove live signed-in ChatGPT behavior or a published installer.
