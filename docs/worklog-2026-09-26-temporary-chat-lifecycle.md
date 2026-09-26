# Interrupted and temporary chat lifecycle

An interrupted chat could become eligible for browser reuse and closure five minutes after its
last recorded activity. The policy checked for a null active turn and *any* prior turn end or
assistant final, so an older successful answer could qualify a chat whose latest turn ended
with a connection or provider failure. The policy now requires the latest turn to have completed.
The browser's live draft/generation/document checks remain in force.

ChatGPT Temporary Chats do not appear in its history unless saved, but CoS previously kept its
local recording after the user left the final browser view. The page-model helper now publishes
positive temporary or regular mode evidence for the current route. The companion sends that
fact only from the exact live document; the app persists it on the currently bound session.
Temporary sessions are excluded from automatic tab cleanup. When the final view departs,
the app removes a still-temporary local session; a chat converted to regular mode stays.
Unknown mode and old recordings are left alone rather than inferred temporary from a URL.

Validation: TypeScript typecheck, JavaScript syntax checks, 10 focused bridge/DOM tests,
985 extension/content-script tests, and a focused companion ownership test passed using an
in-process TypeScript test runner because this Windows sandbox blocks subprocess startup.
The full ordinary release verification and a signed-in ChatGPT browser run remain unverified.
