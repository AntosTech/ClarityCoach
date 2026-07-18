# Phase 1 — Pending Invite Visibility + Resend

Date: 2026-07-13

Implements Phase 1 of `2026-07-12-scaling-gaps-roadmap.md`: an admin
previously had no way to see who'd been invited but hadn't joined, or to
recover from an expired invite link.

## What was built

### Backend (`backend/organizations.js`)
- `GET /:orgId/invites` — unchanged, already existed.
- New `POST /:orgId/invites/:inviteId/resend` — regenerates the invite's
  token (`crypto.randomUUID()`) and resets `status` to `'pending'` and
  `expires_at` to +14 days. This **updates** the existing row rather than
  inserting a new one, because `organization_invites` has a full unique
  constraint on `(organization_id, email)` regardless of status — a second
  insert for the same email would violate it (confirmed via a direct
  `pg_constraint`/`pg_indexes` query against the database). Blocked via a
  `.neq("status", "accepted")` guard so an admin can't "resend" an invite
  whose email is already an active member. No new RLS policy was needed —
  the existing `"admin manages invites"` policy (`cmd ALL`) already covers
  UPDATE for admins.

### Frontend (`frontend/src/TeamView.jsx`)
- Fetches `GET /organizations/:orgId/invites` alongside members/insights
  for admins, filtering out `'accepted'` invites (those are just regular
  members now, already shown in the Members table).
- New "Pending Invites" card: email, status (Pending / Expired / Revoked
  — "Expired" is computed client-side by comparing `expires_at` to now,
  since the stored status doesn't auto-flip), sent date, expiration, and
  a "Resend" button. On success, shows the fresh accept link with a copy
  button (same pattern as the "Invite a teammate" card).

### Tests (`backend/organizations.test.js`)
- 2 new cases for the resend route: success (returns a fresh accept
  link), and 400 when the invite can't be resent (not found, already
  accepted, or not permitted).
- `backend/test-utils.js` gained `neq` as a chainable mock method to
  support the new query.

**47/47 backend tests passing** (up from 45 — also includes the
`GET /subscription` tests added just before this phase).

## Not yet live-tested
Backend tests pass in the sandbox; the frontend test runner itself
couldn't execute in this sandbox (missing a native Linux binding for the
Vite/Rolldown toolchain — an environment limitation, not a code issue).
The UI has been visually verified by compiling it with esbuild
(no syntax errors), but hasn't been clicked through in a real browser
yet. Recommend testing on your machine: invite someone, let the link
sit, confirm it shows up under "Pending Invites," then hit Resend and
confirm the new link works and the old one doesn't.

## Files changed
- `backend/organizations.js` — new resend route
- `backend/organizations.test.js` — 2 new tests
- `backend/test-utils.js` — added `neq` to the mock's chainable methods
- `frontend/src/TeamView.jsx` — Pending Invites section + resend flow
