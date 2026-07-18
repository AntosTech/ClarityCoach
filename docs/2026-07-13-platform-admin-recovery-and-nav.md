# Platform-Admin Recovery Actions + Left-Nav Redesign

Date: 2026-07-13

Follow-up to `2026-07-13-platform-admin-layer.md`. That build gave the
platform admin read-only visibility into orgs and subscribers, but a
concrete question exposed a real gap: if a customer's only org admin
leaves, there was no way — in the app — for you to add a new one. This
round fixes that and reshapes the platform view into the left-nav
layout you described (Dashboard, Organizations, Customers, Analytics,
Settings, Help).

## The gap, and the fix

`is_org_admin()` gates every admin action in `organizations.js` on
`role = 'admin' AND status = 'active'` for that specific org. If the
sole admin leaves, *nobody* — not even other members — passes that
check anymore, and there was no `promote` route anywhere (org-level or
platform-level) and no `role` column on invites. The only fix available
was hand-written SQL.

Added `promote_platform_org_member(org_id, user_id)` — a security
definer function, gated on `is_platform_admin()`, that flips an
existing active member to admin. Deliberately doesn't also reactivate a
deactivated member; those stay separate operations. Wired to
`POST /platform/organizations/:orgId/members/:userId/promote` and a
"Promote to admin" button on each eligible member in the new
Organizations drill-down.

## What else was built

### Database (new security-definer functions, all gated on `is_platform_admin()`)
- `get_platform_org_members(org_id)` / `get_platform_org_invites(org_id)`
  — the drill-down data. A deliberate, narrow exception to the
  "aggregate only" rule used elsewhere on the platform routes, since
  fixing a missing admin requires seeing who's actually in the org.
- `get_platform_dashboard()` — KPI totals (orgs, seats used/capacity,
  subscribers) plus a needs-attention payload: orgs with zero active
  admins, and a count of expired-but-still-pending invites.
- `get_platform_admins()`, `add_platform_admin(email)`,
  `remove_platform_admin(user_id)` — manage who has platform-admin
  access. `remove_platform_admin` blocks removing the last remaining
  admin so nobody can lock everyone out.
- Also tightened `anon`'s execute grants on the earlier platform
  functions (`is_platform_admin`, `get_platform_org_summary`) — a
  leftover from `revoke ... from public` not covering Supabase's
  automatic default-privilege grant to `anon`. Not a live bug, but no
  reason to leave it.
- All seven new/changed functions were verified directly against the
  database with a simulated JWT (`set_config('request.jwt.claims', ...)`)
  before any backend code was written, including a live promote/revert
  and an add/remove admin round-trip, so test data ended up unchanged.

### Backend (`backend/platform.js`)
New routes: `GET /platform/dashboard`, `GET /platform/organizations/:orgId/members`,
`GET /platform/organizations/:orgId/invites`,
`POST /platform/organizations/:orgId/members/:userId/promote`,
`GET/POST/DELETE /platform/admins`. All behind the existing
`requirePlatformAdmin` middleware (a friendly 403; the real boundary is
the database check).

### Frontend (`frontend/src/PlatformView.jsx`, rebuilt)
Left-nav shell with six sections, per your spec:
- **Dashboard** — KPI cards + needs-attention list, with a "Fix now"
  button per flagged org that jumps straight to its detail page.
- **Organizations** — list → click "View" → member roster (with
  Promote) + invite list.
- **Customers** — the individual-subscriber table, relabeled.
- **Analytics** — placeholder; real trend charts need historical
  tracking that doesn't exist yet, so this is flagged rather than
  faked.
- **Settings** — add/remove platform admins.
- **Help** — static explanation of each section.

### Tests
`backend/platform.test.js` grew from 8 to 24 tests — dashboard,
drill-down members/invites, promote (success + no-eligible-member),
and admin management (list, add, remove, last-admin guard). **71/71
backend tests passing** (up from 47 at the start of today).

## Not yet live-tested
Same sandbox limitation as before: the frontend dev/test server can't
run here (missing native Linux binding for Vite). `PlatformView.jsx`
was verified with esbuild (compiles clean) but not clicked through.
Recommend testing: load the Platform tab, confirm the Dashboard shows
2 orgs / 3 seats used / 105 capacity with nothing flagged, click into
an org, and — if you want to try the actual fix — pick a member and
hit "Promote to admin."

## Files changed
- `backend/platform.js` (modified — 7 new routes)
- `backend/platform.test.js` (modified — 16 new tests)
- `frontend/src/PlatformView.jsx` (rebuilt)
- Database migration `add_platform_org_management_and_admin_mgmt`
  (Supabase project `udxcpdjcwvfllsfepfle`)
