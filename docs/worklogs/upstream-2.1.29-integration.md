# Official 2.1.29 and follow-up integration

This candidate starts from fork 2.1.37 (`a0c2fc6`) and merges the official repository through `upstream/main` (`27ee321c`, 2026-10-07). The stable 2.1.29 release is `upstream/v2.1.29` (`bd90b376`). The merge retains the original upstream commits and authorship as its second parent.

## Included

- Official 2.1.29: chat pins and row menus, full chat search and message jumps, settings search, approval-wait and connection-loss notices, long-run recovery, Compact & Resume fixes, and UI polish.
- Official follow-up commits through `27ee321c`: What's New, bounded browser recovery, View menu, config backup BOM handling, project-entry diagnostics, worker redemption/revival fixes, and related input/search recovery corrections.
- The official locale, UI, integration, and regression-test changes that accompany those features.

## Fork-specific resolution

- Set the paired app/extension candidate version to 2.1.38; keep bridge protocol 14.
- Preserve the connector mention and native-send behavior in `extension/chatgpt-dom.js`, the runtime marker and connection-loss notifier initialization, and per-conversation observation ownership in bridge recovery.
- Keep fork updater URLs, 403/429 fallback and checksum verification, Cyberpunk styling, Windows x64 packaging, attachment safeguards, and local execution protections.
- Retain the Windows-specific UI-check exclusions and longer headless-browser startup window while preserving startup diagnostics.

## Validation

No build, test suite, package, release, or installation was run for this source integration. The workspace diff and conflict resolutions were inspected; behavioral validation remains outstanding.
