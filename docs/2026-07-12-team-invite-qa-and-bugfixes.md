# Team Invite Flow — Manual QA and Bugs Found

Date: 2026-07-12

Manual end-to-end QA of the team/invite feature built earlier today
(see `2026-07-12-team-accounts-implementation.md`). Created a test
organization, invited a second account, and walked the full
sign-up → email confirmation → invite-redemption path. Found and fixed
three real bugs along the way — two of them would have blocked every
future real customer, not just this test.

## Test setup
- Org: "QA Test Org" (id `8080369b-acca-4197-be73-3f8e3e217b9f`), 5 seats
- Admin: `akishaanthony@yahoo.com`
- Invited member: `akishaanthony@gmail.com`

## Bugs found and fixed

### 1. Raw error messages shown to users (frontend polish)
`ProgressView.jsx` and `AcceptInvite.jsx` displayed `err.message` directly,
including a raw Supabase clock-skew error ("JWT issued at future") the
first time it came up. Fixed by showing generic, friendly messages while
still logging the real error to the console for debugging.

### 2. Server silently failed to start on Windows (backend, was blocking everything)
`server.js` decided whether to call `app.listen()` with:
```js
const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
```
On Windows, `process.argv[1]` is a raw OS path (`C:\Users\...`, backslashes,
no leading slash) while `import.meta.url` is always a properly encoded
file URL (`file:///C:/Users/...`). The two never matched reliably, so
`app.listen()` sometimes silently never ran — the process loaded, had
nothing keeping it alive, and exited with no error at all. This looked
like random, unexplained backend flakiness with no crash log.

Fixed by using Node's own path-to-URL conversion instead of a hand-built
string:
```js
const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
```
This is now reliable cross-platform.

### 3. Invite confirmation email lost the token (would break every real invite)
`Auth.jsx`'s sign-up call didn't pass `emailRedirectTo`, so Supabase's
confirmation email sent new invitees to the project's default Site URL
instead of back to `/accept-invite?token=...` — losing the token every
time someone without an existing account accepted an invite. Fixed by:
- Adding an optional `emailRedirectTo` prop to `Auth.jsx`
- `AcceptInvite.jsx` passing `window.location.href` so the confirmation
  link returns the user to the exact invite URL

This also required adding `http://localhost:5173/**` to the Supabase
project's **Redirect URLs** allow-list (Authentication → URL
Configuration) — Supabase ignores `emailRedirectTo` for any URL not on
that list and falls back to the Site URL silently, no error surfaced.
This is a one-time dashboard setting; production URLs will need to be
added the same way when deployed.

## Verified end state
```
organization_members (org: QA Test Org)
  akishaanthony@yahoo.com  — admin  — active
  akishaanthony@gmail.com  — member — active
```
2 of 5 seats used, both active. Full invite → confirm → redeem → dashboard
update path confirmed working.

## Not yet tested
- Aggregate stats updating after a new submission from the invited member
- Seat-limit enforcement (inviting past `seat_limit`)
- Member deactivation (`DELETE /:orgId/members/:userId`)
