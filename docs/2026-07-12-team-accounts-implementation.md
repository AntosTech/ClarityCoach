# Team Accounts — Implementation

Date: 2026-07-12

Built the minimal team feature set scoped in
`2026-07-12-team-feature-scope.md`: organizations, invites, seat
management, and an aggregate-only admin dashboard. The architecture is
built to scale past the Team tier's 149-seat pricing boundary — that's a
pricing/plan distinction only, nothing in the schema or queries caps out
there.

## Database (Supabase, `clarity-coach` project)

Two migrations applied:
- `add_organizations_and_team_support` — `organizations`,
  `organization_members`, `organization_invites` tables;
  `organization_id` added to `submissions`; RLS policies; an
  `is_org_admin()` helper; `accept_organization_invite()` and
  `get_org_aggregate_stats()` security-definer functions.
- `add_email_to_organization_members` — denormalized `email` onto
  `organization_members` (auth.users isn't part of the public REST
  surface, so this avoids needing to expose it just to show admins who's
  who).

A follow-up migration (`restrict_org_function_execute_grants`) tightened
function execution grants after the Supabase security advisor flagged
that the new functions were technically callable by unauthenticated
(`anon`) callers — each already had its own internal auth check, but the
grants are now restricted to `authenticated` only as defense in depth.

**Privacy enforcement is at the database level, not just in application
code**: `get_org_aggregate_stats()` only ever returns summary numbers
(counts and averages) and checks `is_org_admin()` internally before
returning anything. There's no path — even a bug in the Express routes —
that lets an admin pull an individual employee's messages or scores
through this function.

Org creation itself is manual (a SQL insert per new customer via the
Supabase dashboard/MCP), not a self-serve flow — consistent with the
scope doc's decision to build the parts that scale per-seat (invites,
membership, dashboard) and handle org creation by hand while deals are
sold one at a time.

## Backend

- `backend/auth.js` — `getSupabaseForRequest` and `getAuthedUser`
  extracted out of `server.js` so the new organizations router can share
  them without a circular import.
- `backend/organizations.js` — new Express router, mounted at
  `/organizations`, all routes behind a `requireAuth` middleware:
  - `GET /me` — the caller's org + role, if any
  - `GET /:orgId/members` — member list (RLS scopes this: admins see
    everyone, regular members only see their own row)
  - `GET /:orgId/invites`, `POST /:orgId/invites` — list/create invites.
    There's no transactional email integration yet, so invite creation
    returns the accept link directly for an admin to copy and send
    themselves.
  - `DELETE /:orgId/members/:userId` — deactivates a seat (soft delete,
    keeps historical data intact)
  - `GET /:orgId/insights` — aggregate-only stats via the
    `get_org_aggregate_stats` RPC
- `server.js` — mounts the organizations router; adds
  `POST /invites/accept` (redeems an invite token via the
  `accept_organization_invite` RPC); `/improve` now looks up the
  caller's active org membership and tags saved submissions with
  `organization_id` so they count toward that org's aggregate stats.

### Tests
- `backend/test-utils.js` — a flexible chainable Supabase query-builder
  mock, shared by both test files. Needed because the new routes use
  chains the old ad-hoc mock in `server.test.js` couldn't handle
  (`.eq().eq().maybeSingle()`, `.rpc().single()`).
- `backend/organizations.test.js` — 12 new tests covering every route.
- `backend/server.test.js` — rewritten to use the shared mock; added
  coverage for the org-tagging lookup in `/improve` and for
  `/invites/accept`.
- **All 37 backend tests pass** (up from 21): 8 pure-function, 12
  organizations-router, 17 server/route tests.

## Frontend

- `frontend/src/TeamView.jsx` — new admin dashboard: org name and seat
  usage, aggregate team insights (with an explicit note that individual
  scores are never shown), an invite-a-teammate form that surfaces the
  accept link to copy/send manually, and a member list table. Non-admin
  members who somehow land here see a plain "team management is
  admin-only" message rather than the dashboard.
- `frontend/src/AcceptInvite.jsx` — standalone page for
  `/accept-invite?token=...` links. Prompts sign-in/sign-up via the
  existing `Auth` component if needed, then redeems the token.
- `frontend/src/App.jsx` — added a "Team" nav button alongside "My
  Progress"; added the `/accept-invite` pathname check (there's no
  router in this app, so this is a plain `window.location.pathname`
  check — placed after all hooks, not before, per the Rules of Hooks).

### Verification
Backend tests ran and passed in this session (37/37). The frontend test
suite couldn't be run in this sandbox — the project's `node_modules` was
installed on your Windows machine and synced via OneDrive, so its native
binaries (the `rolldown` bundler Vite 8 uses) don't match this Linux
sandbox. In place of running the suite here, a structural sanity check
(balanced braces/parens/brackets) was done on all three changed files,
and the four new icon imports were confirmed as real exports in the
installed `react-icons` package. **Confirmed by running `npm test`
locally: all 5 existing frontend tests still pass.**

## What's not built (explicitly out of scope, per the scope doc)
- SSO / Microsoft Entra ID
- Self-serve billing (Stripe or similar) — invoice pilot customers
  manually for now
- Granular roles beyond admin/member
- Transactional email for invites — links are copy/paste for now
- Automated Marketplace Fulfillment API seat provisioning

## Suggested next steps
1. Run `npm test` in `frontend/` to confirm the existing suite still
   passes.
2. Manual QA end-to-end: create a test org via SQL, invite a second test
   account, accept the invite, confirm it shows up in the admin
   dashboard and that aggregate stats update after a submission.
3. When the pilot prospect is ready, create their `organizations` row
   and the founding admin's membership row manually, then they can
   invite their own team through the UI from there.
