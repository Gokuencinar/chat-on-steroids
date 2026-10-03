# Published upstream 2.1.26 integration

## Observed baseline

Fork main: aed78b89a647adaa37b43712cabc7e524b93f646 (2.1.31). Official v2.1.26: b581135. Shared upstream base: 14f7586b5ca9c663348e9d74ccae58532b2f42cf (official 2.1.21 history). Both remotes and their tags were fetched before edits; official tags are separately namespaced as upstream/v*.

Fork 2.1.30 tag points exactly at 8f88dc00c67aaf06ec44ea33efee51123e60eaf9; Publish release run 36544869785 succeeded in all five jobs and published all four expected assets. Fork 2.1.31 was also already published with an additional double-click updater. Its separate CI run 36766672129 failed; the successful release build is distinct evidence.

## Selection and conflicts

- Already present: official 2.1.21 UI/recovery work and fork 2.1.28–2.1.30 Core fixes. Preserved without replaying old changes.
- New useful published changes: all app, extension, shared model and focused tests through official v2.1.26, plus release verification, dependency pins, and CI flake reporting.
- Conflicts: resetConversation keeps Temporary Chat state reset and new resume/stream cleanup; activity keeps structured connector identity and new preferences. Both recovery tests are retained. Fork versions, historical release notes, Windows-only packaging and fork release routing win over official release metadata.
- Official release metadata automation is retained where applicable. Multi-platform canary publishing is excluded; the release manifest and checker are restricted to Windows x64 plus extension, native sources and updater.
- The existing manual interceptor now honors the ordinary-message Core preference. Its selected-token and exact unchanged-draft fallback paths remain intact. Managed workers, Goal, Loop and Continue use official structured mention attachment, never invented plain @ text.
- No new macOS-specific feature work or PR #309/#345 is selected. Existing shared platform branches remain available to avoid unrelated removals.
- Post-release changes are deferred, including new strict chat trust, additional project folders, global admission/session lineage and titlebar changes.

## Preservation audit

Fork-only update/download URLs; exec-protection.ts and runtime-marker.ts; ports 8765–8769; per-conversation repair maps and observations; non-destructive responsive-page recovery; awaitingReturn reload/reopen semantics; Temporary Chat DOM/Fiber proof, temporaryChatId, /temporary-state, pruning protection and manual-close-only cleanup; connector refresh processRearmed and Core priority; Goal durable mutations and session ownership; Compact & Resume lineage; protocol 14; extension build stamps and self-update; user-data preservation in NSIS/updater.

## Validation

- Production build, typecheck, public-history privacy, generated third-party notices, 730 pinned native-source archives and PowerShell updater syntax passed.
- Initial broad-test timing failures in execution custody, Continue delivery and stale ownership passed isolated before any behavior change. One repeat per test remains visible in the inherited flaky reporter.
- Combining the fork's protection guidance with official capability reporting exceeded the Core instruction budget by 80 characters. Redundant wording was shortened without removing protection, authority or ownership guidance; the budget regression test passed.
- Windows UI fixtures now wait for rendered state, use offscreen composition for hidden windows, provide the pet performance mock's releaseFocus method, allow only 0.001 CSS px of floating-point width noise, and test actual hover activation rather than the outdated non-focusable configuration. Production pet behavior is unchanged.
- Published plugin tests passed for Blender, Unity, Memory, the Plugins HTTP proxy and Python Fetch. Downloaded Chromium cannot spawn on this local machine even directly; the unchanged navigation/DOM assertions pass with installed Chrome and an isolated profile via COS_CHROME. CI retains downloaded Chromium by default.
- The last local verify:ci unit pass had 6,874 passing tests, 48 expected skips and one PID-reuse timing failure. Its whole MCP suite was then rerun after holding the real exec response at the publication boundary: all 177 tests passed (six expected skips). No ownership assertion or production guard was removed. The serial computer/shutdown suites passed all 26 tests. This validates all 6,901 enabled tests across the final suite and targeted repair; the hosted pipeline runs verify:ci end to end again at the final commit/tag.
- Final verify:ui passed all 38 real Electron/browser checks, without skips or retries. Post-fixture typecheck and diff whitespace checks passed. Hosted release packaging and asset validation follow at the tag.

No installed-app or signed-in ChatGPT live behavior is claimed by unit or package checks; no updater was executed and no user profile/data was changed.

## Published official commits selected (first-parent inventory)

```text
5fa382c Merge pull request #810 from Maximapple/docs/release-notes-2.1.21-polish
5527ee2 Merge pull request #812 from Maximapple/ci/verify-published-release
e8d17c1 Merge pull request #813 from Maximapple/ci/ui-checks
197ffe1 Merge pull request #814 from Maximapple/ci/retry-flaky-tests
ab99c10 Merge pull request #815 from Maximapple/ci/draft-release-notes
3b783aa Merge pull request #816 from Maximapple/ci/release-checklist
1c49608 Merge pull request #817 from Maximapple/ci/label-and-size-note
0eb982b Merge pull request #818 from Maximapple/ci/similar-issues
69ee43f Merge pull request #819 from Maximapple/ci/waiting-prs
e648afe Merge pull request #822 from Maximapple/ci/welcome
45aa5c7 Merge pull request #824 from Maximapple/ci/weekly-digest
98bfd25 Merge pull request #826 from Haz4rdovisk/fix/space-entity-readback
d8df086 Merge pull request #823 from Maximapple/ci/dependabot-codeql
8b622e9 Merge pull request #827 from Maximapple/fix/log-why-repair-held
b7e0687 Merge pull request #828 from Maximapple/fix/auto-compaction-waits-for-poll-gap
7c90010 Merge pull request #829 from Haz4rdovisk/fix/unconfirmed-send-release
167b4fa Merge pull request #835 from Maximapple/ci/ui-check-retry
c5ffda2 Merge pull request #836 from Maximapple/release/2.1.22
2524773 Merge pull request #837 from Maximapple/ci/quieter-dependabot
f35b214 Merge pull request #834 from totec448-spec/dependabot/github_actions/actions-4bbf514f12
5eee9c4 Merge pull request #841 from Maximapple/ci/publish-calls-verification
f43b116 Merge pull request #840 from Maximapple/ci/dependabot-skip-native-review
c6c0c15 Merge pull request #839 from Maximapple/ci/triage-without-pull-request-target
9cf53f4 Merge pull request #848 from AcureroAdrian/fix/windows-wsl-roots
d6ae07f Merge pull request #850 from AcureroAdrian/fix/recovery-notice-ready
01799f1 Merge pull request #851 from AcureroAdrian/fix/resume-stream-gone-ready
f12b874 Merge pull request #853 from Maximapple/fix/explicit-compaction-after-closed-tab
e98c430 Merge pull request #854 from Maximapple/test/type-readfile-mocks
8a55827 Merge pull request #856 from Maximapple/test/type-wsl-mocks
cb76a14 Merge pull request #857 from Maximapple/ci/dependabot-ignore-electron
849e54c Merge pull request #859 from totec448-spec/dependabot/github_actions/actions-901392d03b
d624114 Merge pull request #858 from totec448-spec/dependabot/npm_and_yarn/minor-and-patch-a387bca876
7580143 Merge pull request #860 from Maximapple/fix/compaction-turn-ended-receipt
3e27ed0 Merge pull request #862 from Maximapple/fix/windows-hide-own-windows
dda9706 Merge pull request #865 from Maximapple/fix/stop-after-idle-turn
a49fd01 Merge pull request #869 from lavalava45/fix/model-catalog-command-custody
26d46e0 Merge pull request #866 from Maximapple/release/2.1.23
6eeb426 Merge pull request #876 from Maximapple/feat/core-mention
83f1925 Merge pull request #877 from Maximapple/fix/clear-failed-bootstrap
34fe169 Merge pull request #879 from Maximapple/fix/plugin-refresh-budget
d19b235 Merge pull request #872 from lavalava45/fix/pinned-managed-tab-safety
644c0ef Merge pull request #867 from sumit171204/fix/issue-842-loop-pause-message
9162c73 Merge pull request #880 from Maximapple/fix/core-mention-lists
fdcf6ce Merge pull request #883 from Maximapple/fix/project-link-without-icon
e911ece Merge pull request #885 from Maximapple/fix/mention-never-blocks-send
5047fdd Merge pull request #888 from Maximapple/fix/mention-settle
0c63ab6 Merge pull request #890 from Maximapple/release/2.1.24
3cd31e1 Merge pull request #849 from AcureroAdrian/fix/localized-retry-ready
fec63a6 Merge pull request #874 from redzrush101/test/remove-low-value-source-assertions
a3b8b31 Merge pull request #894 from Maximapple/feat/continue-lost-answer
c93ffaa Merge pull request #896 from Maximapple/fix/localized-stop-notices
d734274 Merge pull request #895 from lavalava45/fix/withdraw-stale-recovery-draft
e5f9227 Merge pull request #897 from Maximapple/fix/goal-field-optional
bfa35eb Merge pull request #898 from Maximapple/fix/continue-veto-reasons
9b0fd54 Merge pull request #901 from Maximapple/fix/fiber-kept-pages
d7d65fd Merge pull request #902 from Maximapple/fix/receipt-without-mention
3c0578f Merge pull request #903 from Maximapple/release/2.1.25
5fb6d75 Merge pull request #904 from Maximapple/test/release-runner-timing
4f22766 Merge pull request #899 from xuan2261/fix/892-exec-session-reassociation
338ea96 Merge pull request #911 from Maximapple/fix/continue-page-final-veto
6d592f2 Merge pull request #912 from Maximapple/fix/shell-unmounted-question
3929c96 Merge pull request #913 from Maximapple/fix/agents-former-run-id
a187960 Merge pull request #915 from Maximapple/fix/steered-run-progress
c2081e2 Merge pull request #916 from Maximapple/ci/canary-builds
232a17f Merge pull request #918 from xuan2261/feat/skills-installed-revision
83abf93 Merge pull request #907 from xuan2261/feat/core-capability-preflight
cf79650 Merge pull request #923 from Maximapple/fix/compaction-resume-broken-page
6709657 Merge pull request #887 from lavalava45/contrib/ru-localization
b229ca2 Merge pull request #909 from xuan2261/feat/agent-health-worker-overview
147ef7a Merge pull request #921 from xuan2261/docs/plugin-publication-budget
25ce8f2 Merge pull request #926 from xuan2261/fix/ru-worker-health-labels
301174c Merge pull request #928 from Maximapple/fix/unrendered-user-receipt
f7d7a46 Merge pull request #929 from Maximapple/chore/pr-issue-link-optional
e91d5c6 Merge pull request #930 from Maximapple/feat/follow-new-output
aebcc41 Merge pull request #919 from xuan2261/feat/sleeping-worker-runtime-gc
eaa4de5 Merge pull request #933 from Maximapple/fix/helper-answer-without-user
4aa5966 Merge pull request #934 from Maximapple/fix/goal-retry-after-confirmed-helper
b632428 Merge pull request #935 from Maximapple/fix/settings-clarity
7a623d2 Merge pull request #932 from xuan2261/feat/vi-localization
ed74bed Merge pull request #939 from Maximapple/fix/redeem-retry-window
c795865 Merge pull request #938 from Maximapple/fix/narrow-window-polish
56b754c Merge pull request #937 from xuan2261/docs/language-list
32f5834 Merge pull request #941 from Maximapple/fix/helper-no-tools
fb64cb0 Merge pull request #940 from Maximapple/fix/numbers-follow-language
18cf5f1 Merge pull request #943 from Maximapple/fix/first-turn-without-question
953a288 Merge pull request #945 from Maximapple/i18n/extension-ko-pt
e45f95b Merge pull request #944 from Maximapple/feat/extension-follows-app
2801b5a Merge pull request #954 from Maximapple/fix/main-red-missing-catalog-test
4fecc9b Merge pull request #946 from Maximapple/ci/canary-common-platforms
fd964a5 Merge pull request #947 from Maximapple/fix/helper-tabs-remember-themselves
1b607e5 Merge pull request #955 from Maximapple/fix/compaction-pickup-broken-stream
d5dfdf0 Merge pull request #956 from Maximapple/fix/open-writing-block
11f7db8 Merge pull request #953 from Haz4rdovisk/fix/browser-presence-wake
2937e1c Merge pull request #950 from xuan2261/docs/capability-parity-audit
a9be054 Merge pull request #948 from xuan2261/feature/remember-window-bounds
a55e025 Merge pull request #957 from Maximapple/feat/core-mention-setting
e2ab2e8 Merge pull request #958 from Maximapple/fix/first-turn-live-narration
ac49753 Merge pull request #959 from Maximapple/fix/continuation-timing-labels
b518d65 Merge pull request #960 from Maximapple/fix/repair-wait-for-stream
306fbad Merge pull request #967 from Haz4rdovisk/fix/first-send-request-receipt
70ed21e Merge pull request #963 from redzrush101/fix/exact-model-confirmation
a5dc80a Merge pull request #964 from redzrush101/fix/dev-tunnel-resources
a357e75 Merge pull request #968 from Haz4rdovisk/feat/connection-popover-pr
d7f565f Merge pull request #949 from xuan2261/feature/openrouter-model-search
ab783f8 Merge pull request #965 from Haz4rdovisk/fix/reply-sources-budget
f981282 Merge pull request #970 from Maximapple/fix/deep-react-tree
dd5feeb Merge pull request #951 from Haz4rdovisk/fix/timeline-round-recaps
8a65252 Merge pull request #971 from Maximapple/fix/model-search-label
c540b9c Merge pull request #973 from xuan2261/feature/default-chat-reasoning
2246cc1 Merge pull request #975 from Maximapple/fix/follow-ignores-rounding
1c1efbb Merge pull request #980 from Maximapple/fix/plain-setting-words
31d4ad2 Merge pull request #974 from Maximapple/release/2.1.26
c197d4c Merge pull request #981 from Maximapple/fix/extension-update-when-idle
b581135 Merge pull request #982 from Maximapple/fix/read-only-tooltip
```

## Post-release commits deferred (observed upstream main)

```text
917b63a Merge pull request #983 from Maximapple/docs/release-notes-2126
7102cef Merge pull request #984 from Maximapple/fix/bridge-prefs-flake
3ea82ad Merge pull request #985 from Maximapple/feat/settings-general
fa3f4fe Merge pull request #994 from Maximapple/fix/plugin-remove-locked-folder
d64bb3b Merge pull request #996 from Maximapple/fix/worker-send-reason
219c735 Merge pull request #993 from Maximapple/feat/keychain-notice
fa5155a Merge pull request #1000 from Maximapple/feat/handoff-length
ff9c9bd Merge pull request #1001 from Maximapple/fix/no-tab-repair-keeps-open-tab
6170e31 Merge pull request #1002 from Maximapple/ci/checks-finetune
21e7b8c Merge pull request #987 from xuan2261/feature/live-agent-monitor
1b6ceb1 Merge pull request #997 from xuan2261/feature/global-session-limit
17328f2 Merge pull request #1003 from Maximapple/fix/hand-out-every-wake
c077779 Merge pull request #1004 from Maximapple/ci/auto-canary
7d7c726 Merge pull request #1009 from Maximapple/polish/round-1
d2f662f Merge pull request #1013 from Maximapple/fix/exec-ack-test-race
5ca0d4c Merge pull request #1014 from Maximapple/fix/resumed-chat-keeps-tab
cee24d7 Merge pull request #1011 from m1d0e1/fix/resume-shadow-session
3e099b9 Merge pull request #1010 from m1d0e1/fix/worker-bootstrap-lease
41a834f Merge pull request #998 from xuan2261/feature/compact-titlebar
8b791f1 Merge pull request #986 from xuan2261/feature/project-additional-folders
d8e6aea Merge pull request #972 from xuan2261/feature/strict-chat-allowlist
8a40bc3 Merge pull request #1015 from Maximapple/fix/confirm-clear-workers
a7f7b14 Merge pull request #1016 from Maximapple/feat/translate-tray-and-notices
0b36a68 Merge pull request #1017 from Maximapple/docs/macos-keychain-note
f867320 Merge pull request #1018 from Akilaydin/fix/issue-template-version-location
2154637 Merge pull request #1019 from Maximapple/fix/thinking-worker-awake
c535875 Merge pull request #1020 from Maximapple/polish/round-3-words
200710c Merge pull request #1025 from Maximapple/fix/ipc-trust-delete-flake
e484dd6 Merge pull request #1024 from xuan2261/feature/durable-session-lineage
4748fa2 Merge pull request #1027 from xuan2261/feature/global-prompt-admission
```
