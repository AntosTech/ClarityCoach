# Seat Management and Final Team QA

Date: 2026-07-12

Closed out the three untested pieces flagged at the end of the earlier
invite QA (`2026-07-12-team-invite-qa-and-bugfixes.md`), and along the way
surfaced and fixed a real gap: there was no way to undo a member removal.

## What was built

### Seat-limit enforcement
`POST /organizations/:orgId/invites` previously let an admin invite past
their plan's `seat_limit` with no resistance. Added a shared
`checkSeatAvailability()` helper in `backend/organizations.js` that counts
active members **plus pending invites** (a pending invite reserves a seat
too, otherwise an admin could invite well past capacity before anyone
accepts) and rejects the request with a clear error if the org is at
capacity.

### Member reactivation
Deactivating a member (the "Remove" button) had no inverse — once removed,
an admin had no way to undo it short of a direct database edit. Added:
- `POST /organizations/:orgId/members/:userId/reactivate` — flips a
  deactivated member back to active, re-checking the seat limit first so
  reactivating can't silently blow past capacity either.
- A "Reactivate" button in `TeamView.jsx`'s members table, shown only for
  deactivated members (mirroring the existing "Remove" button, shown only
  for active, non-self members).

### Remove button (frontend)
`TeamView.jsx`'s members table previously had no way to trigger the
existing deactivation endpoint at all. Added the button, a confirmation
prompt, and error handling.

## Tests
`backend/organizations.test.js` — added coverage for seat-limit rejection
on invite creation, and three new tests for the reactivate route (success,
seat-limit rejection, update failure). **42/42 backend tests passing**
(up from 39).

## Live verification (all three confirmed working)
1. **Aggregate stats update** — submitted a message as a regular member;
   admin's Team Insights updated from all-zero to real numbers (1 total
   message, real clarity/politeness/professionalism averages).
2. **Seat-limit enforcement** — temporarily set the test org's seat limit
   to match its actual reserved-seat count, confirmed a new invite was
   rejected with "You've used all N seats on your plan...", then restored
   the limit to 5.
3. **Deactivation and reactivation** — removed a member via the UI,
   confirmed their status flipped to `deactivated` and the seat count
   dropped; reactivated them via the new button, confirmed status and
   seat count both returned to normal.

## Current state of the team feature set
Invite → sign-up/confirm → auto-redeem → seat-limited invites → dashboard
→ deactivate → reactivate is now a fully working, tested loop. Nothing
outstanding from the original minimal-team-feature scope remains
unverified.
