# Cyberpunk appearance

The user requested an intense neon gaming design. Appearance now has a Cyberpunk preset with
cyan/magenta highlights, dark blue surfaces, a static grid/atmospheric wash, HUD borders, a
neon composer and visible focus rings. Text retains the user's font and size. No continuous
decorative animation or external font/image dependency is introduced.

The existing Appearance config owns the optional skin, validation and queued saves. Legacy
settings remain classic; old clients saving only colors preserve a concurrent skin selection.
The preset switches to dark, retains the light palette and typography, and Reset restores the
original palettes/skin without changing language or setup profile. Session, bridge, provider,
Core attachment and permission behavior are untouched.

Validation: production build and typecheck passed; 131 targeted appearance/config/layout/i18n
tests passed. Full `verify:ci` passed: 6,876 parallel tests plus 26 serial desktop/shutdown tests,
6,902 passed in total, 48 intentionally skipped. Privacy, notices and typecheck gates passed.
All 38 real-Electron UI checks passed; message reactions passed on the configured retry.
The appearance probe was rerun after extending Cyberpunk geometry coverage at 640/800/1100
pixels and 100/117/150% zoom. It verifies selection, persistence, reload, reset, normal palette
edits and queued saves. Its cleanup now lets assertion errors reach the exit-code handler;
Chromium zoom is allowed to settle after native resize. Screenshots use isolated IPC fixtures,
never installed user data. `git diff --check` passed.

The initial source review was completed on top of published v2.1.32 without touching the
installed app. The user subsequently authorized publication and installation. Release 2.1.33
synchronizes app/package/extension versions and keeps bridge protocol 14; the version-pinned
PowerShell updater retains SHA-256 verification and the existing user-data preservation path.
