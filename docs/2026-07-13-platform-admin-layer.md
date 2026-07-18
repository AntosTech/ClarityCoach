# Platform-Admin Layer

Date: 2026-07-13

Prompted by a genuinely good question during Test Org 2 setup: with team
admins, team members, and individual subscribers already modeled, there
was no fourth tier for the SaaS operator (you) to see or manage across
every customer. Until now, that role was filled by me running raw SQL
by hand. This bumps Phase 2 of `2026-07-12-scaling-gaps-roadmap.md`
("replace manual org/seat provisioning" + "a basic internal ops view")
ahead of schedule, since it became the active bottleneck the moment a
second org existed.

## What was built

### Database
- `platform_admins` table (`user_id` FK to `auth.users`, unique) — no
  RLS policies grant it to anon/authenticated directly. It's only ever
  read through:
- `is_platform_admin(target_user_id uuid default auth.uid())` — a
  SECURITY DEFINER function, same pattern as `is_org_admin`.
- `get_platform_org_summary()` — cross-org aggregate summary (seat
  limit, active member count, pending invite count, plan tier) for
  every organization. Gated on `is_platform_admin()`; aggregate-only,
  same principle as `get_org_aggregate_stats` — no individual member
  emails or message content.
- `get_platform_subscribers()` — individual (non-team) subscriber list
  with plan tier and status, joined against `auth.users` for email.
  Also gated on `is_platform_admin()`.
- Seeded **akishaanthony@yahoo.com** as the first platform admin.

### Backend (`backend/platform.js`, new)
- `GET /platform/me` — answers `{ isPlatformAdmin: bool }` for any
  signed-in user (doesn't itself require being an admin — that would
  make it useless for the one case it exists to answer).
- `GET /platform/organizations` and `GET /platform/subscribers` — both
  behind a `requirePlatformAdmin` middleware that 403s non-admins. The
  middleware is a fast, friendly rejection; the real security boundary
  is the database function's own `is_platform_admin()` check.
- Mounted at `/platform` in `server.js`.

### Frontend
- New `PlatformView.jsx` — two tables: Organizations (name, plan, seat
  usage, pending invites) and Individual Subscribers (email, plan,
  status, renewal date).
- `App.jsx` checks `/platform/me` once signed in and shows a "Platform"
  nav button only for platform admins, alongside "My Progress" and
  "Team".

### Tests
`backend/platform.test.js` — 8 new tests covering `/me` (both outcomes),
`/organizations` (401, 403, 200), and `/subscribers` (403, 200).
**55/55 backend tests passing** (up from 47).

## Also done in this session
- Created **Test Org 2** (100 seats, `team` plan) and added
  akishaanthony@yahoo.com as its admin, alongside the existing 5-seat
  QA Test Org — giving two live test orgs to exercise the new platform
  view against.

## Not yet live-tested
Same caveat as Phase 1: this sandbox can't run the frontend dev/test
server (missing native Linux binding for Vite's toolchain). `App.jsx`
and `PlatformView.jsx` were verified with esbuild (no syntax errors)
but not clicked through. Recommend testing on your machine: sign in as
akishaanthony@yahoo.com, confirm the "Platform" nav button appears, and
confirm both Test Org 2 and QA Test Org show up with correct seat
counts.

## Files changed
- `backend/platform.js` (new)
- `backend/platform.test.js` (new)
- `backend/server.js` (modified — mounted platform router)
- `frontend/src/PlatformView.jsx` (new)
- `frontend/src/App.jsx` (modified — platform-admin check + nav item)
- Database migration `add_platform_admins` (Supabase project
  `udxcpdjcwvfllsfepfle`)
