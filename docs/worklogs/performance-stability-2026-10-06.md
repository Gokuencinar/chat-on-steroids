# Performance and stability audit, 2026-10-06

## Scope and baseline

Base: released fork 2.1.36, bd8b3eb7c58d42654d5eb84ddfe39d96a55ed7fb, clean and matching origin/main. Work is on optimize/stability-search-files-20261006. This is an unreleased source candidate; the existing version, tag and installed app remain separate from this work.

The review inventoried 322 implementation/assets files and followed the ownership map across startup/connection, MCP/kernel and tool boundaries, filesystem/process permissions, journal/history/search, input/attachments, bridge/extension observations, Goal/continuation/agents, plugins/Skills, renderer/timeline/Files, update and packaging. It examined selected owners and existing bounds/coalescing/epoch contracts, then concentrated edits on reproducible failures. This is not a claim that every source line was manually verified or that all defects have been eliminated. No installed userData, secrets, native UI or signed-in browser was accessed.

## Reproduced and repaired

1. Full readEvents loaded the entire JSONL file and split it before filtering. Background search indexing, Goal legacy-history reads and explicit historical reads could allocate and parse a tool-heavy journal in one main-thread burst. The existing reader now scans the captured file extent in 256 KiB blocks, retains requested rows and applies the canonical overlay after the asynchronous scan. Line carry is capped at the existing 512 KiB storage limit; oversized/torn lines are skipped through the next real newline. The incremental cache path, chronology, sequence cursors, overflow assets and canonical message custody remain intact. File growth cannot extend an admitted read indefinitely.
2. A text-result cutoff could hide an older title match despite the title-first ranking contract. Rank the whole title catalog first and retain at most limit+1 matches, avoiding needless text reads for saturated title results. A cached index with an old stamp also returned superseded words while rebuilding. Require the matching summary stamp and recheck it after disk reads before publishing into the cache.
3. A native Files watcher error removed the handle, then scheduled a notification whose live-watch guard always rejected it. Files also retained its unchanged admission signature. Retire the exact handle/debounce and signal watchLost once; the renderer invalidates the signature and re-admits visible directories through the existing sandbox. Ordinary changes retain signature coalescing and retired handles cannot schedule replacement notifications.
4. Failed asynchronous path validation had no generation fence on its catch path. An A-B-A project switch could let the obsolete A operation delete the new A watch. Check generation and exact entry before retiring; removal/retargeting also clears that handle's pending debounce.

Regression tests failed against the earlier implementations before repair. One initial renderer fixture used an incorrect panel method; it was corrected, then its real rearm assertion independently failed before the source fix. No production assertion was relaxed.

## Measurement

A synthetic 41,501,640-byte journal with 5,120 valid note events and one canonical user message was read by the released store and candidate store in the same isolated test environment. Warm-up followed by three alternating trials each; explicit GC was available before each trial. Results must not be extrapolated to overall app performance or live ChatGPT latency.

- Median total read: 70.57 ms released, 53.21 ms candidate (about 25% less in this fixture).
- Median maximum observed event-loop delay: 37.85 ms released, 14.20 ms candidate.
- Median heap delta measured immediately after each call: 119.48 MiB released, 29.46 MiB candidate. This is post-call allocation evidence, not peak RSS or an app-wide memory guarantee.

The initial 64 KiB candidate reduced stalls but took longer overall. The final 256 KiB block balances bounded buffers and I/O overhead. No timing threshold was added to CI. Raw benchmark data and the local harness are kept outside public source; the synthetic fixture and baseline commit describe reproduction without exposing user recordings.

## Validation and preservation

Typecheck and production build passed. Before the final block-size/watch-race adjustment, 31 adjacent suites passed 1,016 tests (session, Goal, continuation/resume, chronology, input/attachments, project Git/Files and renderer). Final focused suites passed 78 tests, including actual before/after regressions, large legacy UTF-8 across blocks, canonical supersession, damaged lines, bounded I/O, journal growth, watcher replacement and another-project negative cases. Full hosted CI and UI acceptance are recorded separately when complete.

The work does not edit Cyberpunk/appearance, exec-protection/runtime-marker, secrets, app updater, extension bytes, bridge or Goal/Loop owners. App/extension base declarations remain 2.1.36 and protocol 14. Existing attachment/Core fallback, Temporary Chat and durable execution/continuation contracts remain protected by the adjacent and full suites. Known Goal cross-ledger publication gaps in AGENTS remain recorded; no claim of a full transactional redesign is made.

GitHub runner checks use isolated fixtures. Native provider acceptance and behavior with the user's installed CoS remain untested in this Git-only task.
