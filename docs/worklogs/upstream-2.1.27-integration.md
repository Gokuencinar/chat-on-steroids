# Published upstream 2.1.27 integration

Fork baseline: d8e19c9046fde37bdd2d3564a83cb9014f89841b (2.1.34), matching origin/main before edits. Published official tag: 911b5d56fef2bf99d3af358e42dff290ba2e567a. Shared upstream base: b5811358e953cbe7805635e09893768b083b2678 (2.1.26). Integrate the immutable stable tag, preserving its original Git authors and CONTRIBUTORS credits; post-release main/Canary and open PRs are excluded. Fork version 2.1.35, protocol 14.

## Selection and preservation

Published app/extension changes include worker liveness and waking, ownership/restart and Compact & Resume recovery, held Setup queueing, provider rate-limit waits, reading-position preservation, Automatic model choices, background commands, General settings, project colors, diagnostics, inline edit diffs and round sub-agent inspection, optional exact-name Skill routing and installed plugin Skills. Published optional chat trust, worker admission and session lineage are integrated while preserving the fork ownership boundaries.

Conflicts preserve fork release versions/history and Windows x64-only packaging. Official release notes are archived under docs/upstream/v2.1.27.md. Native file-tile readiness and exact unchanged-draft Core fallback survive the merge. Both the fork responsive-silence test and upstream no-tab wake test remain; the real execution publication-custody test takes upstream bounded synchronization. Composer geometry retains the 0.001 CSS-pixel floating-point tolerance while adding the official narrow-column assertions.

The new macOS-only Keychain notice and its dedicated IPC/renderer wiring are excluded. Hosted focused recovery and Plan checks use PowerShell with the bundled Electron and pinned English locale on Windows. Firefox staging remains isolated tooling, not a distributed fork asset.

Directly unchanged protection/update/appearance owners: `src/main/exec-protection.ts`, `src/main/runtime-marker.ts`, `src/main/plugin-refresh.ts`, `src/main/update.ts`, `src/renderer/cyberpunk.css`, `src/renderer/appearance.ts`, `src/main/appearance-schema.ts`, `src/shared/appearance.ts`, `Actualizar-ChatOnSteroids.cmd`. Temporary Chat DOM/Fiber identity, /temporary-state, pruning custody, per-conversation observations, non-destructive silence recovery, real-reload awaitingReturn semantics, structured connector identity, Goal/Loop durable mutations and Compact & Resume ownership are retained and covered by the combined suites. Default connector names remain exact; optional per-computer names use explicit configured identity.

The source and delivered PowerShell updater are pinned to 2.1.35; this is a version-only change to the previous verified updater and retains `${TargetVersion}:`. Its syntax and 51 focused packaging/update tests passed.

## Validation

Typecheck and production build passed. The 16 focused suites passed 2,553 tests with six intentional skips. Both new timeline fixtures exposed Windows rounding (native width 761 when requesting 760); their exact CSS viewport now belongs to CDP after document load, preserving all existing assertions. All 42 real-Electron UI checks now have passing outcomes: the initial complete run passed 37, both corrected viewport fixtures passed, and reaction/PDF workspace/real-PTY terminal checks passed isolated on retry. No production behavior or acceptance assertion was weakened. The initial unbounded full run passed 7,250 tests with 48 intentional skips and seven load-sensitive failures in code-mode runtime, content-script and MCP. All seven (plus the neighboring fresh-helper case) passed isolated without code changes. The complete verify:ci rerun passed under the same three-worker/one-visible-retry policy as the fork publication workflow: 7,257 parallel tests plus 28 serial Windows tests (7,285 total), 48 intentional skips, and all 289 active files passed. No retry failures were reported in this successful run. Public-history privacy and the pinned third-party notices also passed. No installed-app or signed-in provider behavior is inferred from source or fixture checks.

## Official first-parent inventory

```text
917b63a5 Merge pull request #983 from Maximapple/docs/release-notes-2126
7102cef1 Merge pull request #984 from Maximapple/fix/bridge-prefs-flake
3ea82ad7 Merge pull request #985 from Maximapple/feat/settings-general
fa3f4fe6 Merge pull request #994 from Maximapple/fix/plugin-remove-locked-folder
d64bb3b7 Merge pull request #996 from Maximapple/fix/worker-send-reason
219c7357 Merge pull request #993 from Maximapple/feat/keychain-notice
fa5155a3 Merge pull request #1000 from Maximapple/feat/handoff-length
ff9c9bde Merge pull request #1001 from Maximapple/fix/no-tab-repair-keeps-open-tab
6170e314 Merge pull request #1002 from Maximapple/ci/checks-finetune
21e7b8c4 Merge pull request #987 from xuan2261/feature/live-agent-monitor
1b6ceb14 Merge pull request #997 from xuan2261/feature/global-session-limit
17328f22 Merge pull request #1003 from Maximapple/fix/hand-out-every-wake
c077779f Merge pull request #1004 from Maximapple/ci/auto-canary
7d7c726b Merge pull request #1009 from Maximapple/polish/round-1
d2f662f5 Merge pull request #1013 from Maximapple/fix/exec-ack-test-race
5ca0d4cb Merge pull request #1014 from Maximapple/fix/resumed-chat-keeps-tab
cee24d7a Merge pull request #1011 from m1d0e1/fix/resume-shadow-session
3e099b9c Merge pull request #1010 from m1d0e1/fix/worker-bootstrap-lease
41a834fd Merge pull request #998 from xuan2261/feature/compact-titlebar
8b791f19 Merge pull request #986 from xuan2261/feature/project-additional-folders
d8e6aeab Merge pull request #972 from xuan2261/feature/strict-chat-allowlist
8a40bc32 Merge pull request #1015 from Maximapple/fix/confirm-clear-workers
a7f7b149 Merge pull request #1016 from Maximapple/feat/translate-tray-and-notices
0b36a687 Merge pull request #1017 from Maximapple/docs/macos-keychain-note
f867320f Merge pull request #1018 from Akilaydin/fix/issue-template-version-location
2154637e Merge pull request #1019 from Maximapple/fix/thinking-worker-awake
c5358752 Merge pull request #1020 from Maximapple/polish/round-3-words
200710c0 Merge pull request #1025 from Maximapple/fix/ipc-trust-delete-flake
e484dd6d Merge pull request #1024 from xuan2261/feature/durable-session-lineage
4748fa27 Merge pull request #1027 from xuan2261/feature/global-prompt-admission
d2c20b76 Merge pull request #1029 from Maximapple/fix/ui-check-flakes
601809c2 Merge pull request #1030 from Maximapple/fix/pet-drag-flake
18ebc12a Merge pull request #1031 from Maximapple/polish/round-4
61d6bb31 Merge pull request #1033 from Maximapple/polish/popup-hint
152127c3 Merge pull request #1034 from Maximapple/polish/korean-wrap
14bb4814 Merge pull request #1035 from Maximapple/feat/cancel-interrupted-reload
9d1c033b Merge pull request #1028 from xuan2261/feature/agent-monitor-activity
3d57b391 Merge pull request #1045 from xuan2261/fix/skill-catalog-yaml-metadata
5f402d5e Merge pull request #1046 from 27mfp/feat/composer-one-line-pr
82c00117 Merge pull request #1047 from 27mfp/feat/background-exec-process-dock
14c6abde Merge pull request #1026 from xuan2261/feature/project-colors
02ac84fc Merge pull request #1054 from Maximapple/revert/hold-998-986
92b9f703 Merge pull request #1056 from Maximapple/fix/revival-draft-residue
37d4881d Merge pull request #1036 from xuan2261/feature/prime-to-prime-message
a4fcc078 Merge pull request #1040 from xuan2261/feature/codex-plugin-skill-discovery
5f71559e Merge pull request #1041 from xuan2261/feature/firefox-release-staging
ac3de5fa Merge pull request #1057 from Maximapple/polish/round-5
c770e939 Merge pull request #1058 from Maximapple/fix/open-chat-in-extension-browser
bf4b549f Merge pull request #1059 from Maximapple/diag/command-steps
a99501b6 Merge pull request #1060 from Maximapple/diag/report
d93e0df5 Merge pull request #1022 from xuan2261/feature/auto-skill-routing
fb5790a3 Merge pull request #962 from Haz4rdovisk/feat/model-picker-effort-first
63a81ae3 Merge pull request #1062 from Maximapple/fix/readonly-on-contrast
555468a8 Merge pull request #1067 from Maximapple/diag/revival-wait-reason
7c7b7aab Merge pull request #1068 from Maximapple/fix/approval-reminder-after-tunnel
cee35d7d Merge pull request #1069 from Maximapple/fix/send-setup-message
2a14a88b Merge pull request #1070 from Maximapple/feat/system-language
362a362c Merge pull request #1072 from Maximapple/ci/windows-package-retry
ca669c49 Merge pull request #1073 from Maximapple/fix/report-json-paths
8b4ce26b Merge pull request #1037 from xuan2261/fix/project-link-shell
40a2bdec Merge pull request #1044 from xuan2261/fix/windows-exec-test-contract
5a03836e Merge pull request #1048 from xuan2261/fix/windows-capture-diagnostics
87a53d46 Merge pull request #1071 from Maximapple/fix/codex-plugin-env
41fd688e Merge pull request #1074 from Maximapple/fix/tray-language-background
bd52df69 Merge pull request #1075 from Maximapple/fix/project-color-a11y
b397307a Merge pull request #1077 from Maximapple/fix/auto-skills-keep-catalog
3da480ea Merge pull request #1079 from Maximapple/diag/pickup-withdraw-reason
222bf5fa Merge pull request #1080 from Maximapple/fix/group-title-skips-repair-notes
123bbe1d Merge pull request #1081 from Maximapple/fix/shell-runtime-windows-chrome
464cc55a Merge pull request #1076 from xuan2261/fix/project-color-save-focus
65af8554 Merge pull request #1078 from xuan2261/feature/control-agent-retained-history
7a48d8ba Merge pull request #1061 from redzrush101/refactor/simplify-core-2026-10-04
8ca87879 Merge pull request #1082 from Maximapple/fix/activity-log-startup-duplicates
6aa73b8d Merge pull request #1084 from Maximapple/chore/pr-wait-three-days
a7729955 Merge pull request #1085 from Maximapple/fix/handoff-stalled-step-release
51c6a2c3 Merge pull request #1083 from Maximapple/fix/project-controls-keep-focus
eedafeaf Merge pull request #1063 from Maximapple/test/accessibility-checks
617ea997 Merge pull request #1087 from Maximapple/fix/held-input-keeps-queued
b1f38d3d Merge pull request #1065 from redzrush101/feat/inline-recorded-diffs
9ba2722c Merge pull request #1088 from xuan2261/fix/timeline-reading-refresh
8da41f5e Merge pull request #1042 from xuan2261/feature/worker-connection-provenance
149abfe7 Merge pull request #1090 from xuan2261/fix/plan-verifier-motion-preferences
1848acb1 Merge pull request #1091 from Maximapple/feat/connector-name-suffix
292bf9f4 Merge pull request #1093 from Maximapple/fix/repair-change-reason
168fd8f7 Merge pull request #1094 from Maximapple/feat/auto-model
d1a82b32 Merge pull request #1066 from redzrush101/feat/inline-subagent-cards
284b6d24 Merge pull request #1095 from Maximapple/fix/goal-reached-row
5accdda8 Merge pull request #1096 from Maximapple/fix/read-root-lists-folders
ad8a16f4 Merge pull request #1097 from Maximapple/fix/worker-names-own-core
d4018953 Merge pull request #1098 from Maximapple/fix/subagent-count-singular
9c2df5ff Merge pull request #1092 from xuan2261/fix/ui-offscreen-paint
2b96bb73 Merge pull request #1101 from Maximapple/fix/fast-final-after-redraw
89e45e07 Merge pull request #1103 from xuan2261/fix/canary-checksum-manifest
911b5d56 Merge pull request #1055 from Maximapple/release/2.1.27
```
