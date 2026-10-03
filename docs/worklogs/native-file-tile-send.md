# Native file tile send readiness

A live signed-in ChatGPT fresh-chat input retained the app-authored draft and a ZIP attachment
while its native Spanish Send control was enabled. The outbox remained in browser custody
without send authorization. The observed upload tile is a span containing a filename-labelled
open button, a filename leaf and a translated remove button; it has no role/group/default-action
attributes used by the old attachment reader. Upload readiness could therefore never acknowledge
the file, and delivery waited for the file-upload deadline before reaching native Send.

`chatgpt-dom.js` now identifies only the exact remove control in that two-button tile under
`data-composer-attachments`. It requires matching filename evidence and refuses extra actions,
different names or controls outside that host. Existing attachment/draft custody, authorization,
single native Send and exact acceptance receipts remain the owners. Core attachment fallback
and all fork safeguards are unchanged.

Regression evidence: three current-tile tests failed before the fix, while three neighboring
negative cases passed. After the change, 150 DOM-input checks passed, including upload readiness,
draft custody and one authorized Send for Spanish/English/Japanese removal labels. All 1,264
focused DOM-input, content-script and input-delivery integration tests passed. Full `verify:ci`
passed: 6,882 parallel tests plus 26 serial desktop/shutdown tests, 6,908 passed overall and
48 intentionally skipped. Privacy, notices, typecheck and `git diff --check` passed.
The user authorized publication and installation as 2.1.34. Release and installed-byte verification are recorded separately; existing ChatGPT drafts and the durable outbox are preserved.
