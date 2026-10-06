# Official 2.1.28 integration into fork 2.1.36

## Scope and provenance

Fork baseline bb80cd018cb52b2964ea8e2083ac388414da5496 (2.1.35, clean and matching origin/main). Published official stable tag 096cac815ea4dab2f83c18d2a411fd53051b7de2 (v2.1.28), shared official baseline 911b5d56fef2bf99d3af358e42dff290ba2e567a. Stable was confirmed against the official latest-release API on 2026-10-06. Later official main/Canary and open PRs are excluded. The immutable tag is merged with its original author history. Original notes are archived in docs/upstream/v2.1.28.md; existing fork v2.1.28 notes and changelog history are retained.

## Integration decisions

Include full-history chat search/local rename; personal/Claude/Codex Skills with bounded read-only virtual Skill roots and fair source indexing; guided Setup and per-browser/connector proof; optional built-in browser with explicit session transfer; native image-request routing and save_image; Goal settlement and reload-baseline fixes. App and extension 2.1.36, protocol 14.

Version conflicts select the fork sequence. The final lockfile audit compares every dependency node against the fork baseline; only the two root version declarations differ. A broad version substitution affecting the unrelated mime-types entry was caught and corrected before main/tag/publication. Canary remains excluded, including canary-only packaging assertions; the new welcome workflow assertion remains. Windows x64 CI retains lazy Electron initialization and its focused recovery/Plan gates. The new built-in sign-in UI fixture is enabled on Windows (the official skip describes macOS only). plugin-refresh unpublication retains Core presence-cache invalidation while adding enrolled surface proof, and both enrollment paths retain the existing exact cached Core identity.

Directly byte-unchanged owners: `src/main/exec-protection.ts`, `src/main/runtime-marker.ts`, `src/main/update.ts`, `src/main/secrets.ts`, `src/renderer/cyberpunk.css`, `src/renderer/appearance.ts`, `src/main/appearance-schema.ts`, `src/shared/appearance.ts`, `Actualizar-ChatOnSteroids.cmd`, `extension/fiber.js`, `extension/chatgpt-dom.js`. Core unchanged-draft fallback, attachment filename/tile readiness, Temporary Chat identity/state and deletion custody remain in their existing owners. Modified bridge/store/extension files retain the fork changes on top of the official stable merge. Normal send paths keep exact Core identity; only explicit native image requests use the official one-message Core omission. Workers, helpers, recovery and combined checkpoints retain their existing policies.

Personal Skill access is read-only and restricted to Skill trees, not general credentials/settings/history. Built-in browser defaults remain Chrome; optional cookies permission is requested by the explicit session transfer button. No macOS-only notice or non-Windows publication target is restored. No production userData, installed app or signed-in provider is touched. This task is Git-only; validation of isolated windows and package runtime belongs to GitHub runners.

## Validation

Typecheck, production build, public-history privacy and third-party notices/native source checks passed. The first 9 focused suites passed 127 tests; the 16 new-browser/image and preserved-owner suites passed 1,075 tests (1,202 total). Full test, hosted UI, plugin and package/public download checks will be recorded after GitHub Actions completes. No live signed-in browser acceptance is inferred from fixtures, source or packaging.

## Official first-parent inventory

```text
9d5497a5 Merge pull request #1049 from Haz4rdovisk/feat/cos-series-1-plugin-proof
51f2684e Merge pull request #1050 from Haz4rdovisk/feat/cos-series-2-tab-model
1ed5adc0 Merge pull request #1051 from Haz4rdovisk/feat/cos-series-3-extension-worker
c1562440 Merge pull request #1052 from Haz4rdovisk/feat/cos-series-4-built-in-browser-setup
cf8bafd6 Merge pull request #1105 from xuan2261/fix/canary-stale-main-publish
d902fdf5 Merge pull request #1106 from Maximapple/fix/plugins-proof-tunnel
5fd8ef48 Merge pull request #1108 from Maximapple/polish/new-chat-log-line
792a479b Merge pull request #1109 from Maximapple/feat/claude-plugin-skills
d8b69c94 Merge pull request #1110 from Maximapple/feat/export-generated-images
aedd428e Merge pull request #1111 from Maximapple/fix/setup-text-plural
e5d3c9f9 Merge pull request #1113 from Maximapple/fix/reload-calls-not-progress
7c1dbeb7 Merge pull request #1114 from xuan2261/fix/welcome-required-pr-message
2703873d Merge pull request #1115 from Maximapple/feat/chat-rename
e1bb8423 Merge pull request #1116 from Maximapple/fix/macos-browser-icon-crash
6f14061b Merge pull request #1117 from Maximapple/feat/chat-search
b7bfb44c Merge pull request #1118 from Maximapple/fix/save-image-names-core
bb3e7927 Merge pull request #1119 from Maximapple/fix/goal-met-settles-turn
cf0b9b7e Merge pull request #1120 from Maximapple/polish/search-shortcuts
ec379ce8 Merge pull request #1121 from Maximapple/feat/user-skills-readonly
a8161d63 Merge pull request #1122 from Maximapple/feat/image-requests-without-mention
fc16a07c Merge pull request #1123 from Maximapple/fix/image-edit-after-failed-try
e34a111f Merge pull request #1124 from Maximapple/fix/skills-index-fair-share
32432c1f Merge pull request #1126 from Maximapple/fix/save-image-file-id
1efe32d2 Merge pull request #1127 from Maximapple/fix/goal-reply-turn-open
096cac81 Merge pull request #1134 from Maximapple/release/2.1.28
```
