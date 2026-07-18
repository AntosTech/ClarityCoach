# Scaling Gaps — Prioritized Roadmap

Date: 2026-07-12

Follow-up to the 3-client scenario discussion (one 5-seat team, one
100-seat team, one individual subscriber). That conversation surfaced
several gaps between what's built (`2026-07-12-team-accounts-implementation.md`,
`2026-07-12-seat-management-and-final-qa.md`) and what's needed to
actually run this as a business with real customers. This doc
prioritizes those gaps against your actual situation — a solo operator
with roughly three live-or-near-live accounts — rather than against a
generic SaaS scaling checklist.

## How priority was decided

Two questions per gap: does it affect a customer you already have (or
are about to close), and is it cheap or expensive to fix? Cheap fixes
that affect an existing customer go first. Expensive fixes that only
matter for a hypothetical future customer go last, and some are flagged
as "don't build until a real deal requires it" rather than scheduled at
all — building SSO speculatively, for example, would be effort spent on
a customer that doesn't exist yet.

## Phase 0 — Fix now (affects a customer you already have)

**Track plan/tier for individual subscribers.** Right now every
individual user looks identical in the database whether they're paying
for Pro or not — there's no `plan_tier`, `subscription_status`, or
equivalent field for a solo account (only `organizations.plan_tier`
exists, and that's team-only). This means your one individual client
isn't actually distinguishable from a free signup today. This is the
highest-priority item because it affects billing correctness for a
customer who's already paying you, not a future one.

Minimal fix: a small `user_subscriptions` (or similar) table —
`user_id`, `plan_tier` ('free' | 'pro'), `status`, `current_period_end`
— populated manually for now (no Stripe integration needed yet), and
checked wherever it matters (e.g. could eventually gate the `/improve`
rate limit by tier, but that's a later refinement, not part of this
fix).

## Phase 1 — Fix before the next team onboarding wave

**Pending-invite visibility in the admin dashboard.**
`GET /organizations/:orgId/invites` already exists on the backend, but
`TeamView.jsx` never calls it — an admin has no way to see who's been
invited but hasn't accepted, or which invites have expired. This is
cheap (the hard part, the endpoint, is already built) and becomes
actively painful the moment a 100-seat customer invites people in
batches, which is exactly the scenario you're planning for.

Scope: a "Pending Invites" section in `TeamView.jsx` showing email,
sent date, expiration, and status; a resend action (create a fresh
invite token, since there's no update-in-place for a `token` column
today).

## Phase 2 — Fix before signing a 4th or 5th team account

**Replace manual org/seat provisioning with a lightweight internal
tool.** Creating an org and adjusting `seat_limit` today means you
running SQL by hand (as we did all night). That's fine for three
customers you know personally; it stops being fine once you can't hold
every account's state in your head. This doesn't need to be a polished
admin panel — a small internal page or even a documented, parameterized
script that creates an org + founding admin membership in one step
would remove most of the manual-SQL risk.

**A basic internal ops view.** One place to see all customers — org
name, plan, seat usage, individual subscribers and their tier (once
Phase 0 exists) — instead of querying the database fresh each time
support comes up.

## Phase 3 — Only build when a real deal requires it

**SSO / Microsoft Entra ID.** This is the single biggest blocker to
closing a genuine large enterprise deal — procurement and IT will
often require it outright, especially for anything DOD-adjacent. It's
also the most expensive item on this list (Entra ID app registration,
SAML/OIDC flow, per-tenant configuration). Don't build this
speculatively for a 100-seat prospect that hasn't asked for it yet;
build it the moment it's the specific thing standing between you and a
signed contract, and scope it against that customer's actual identity
provider.

**Granular roles beyond admin/member.** Only worth building once an
actual customer asks for it (e.g. an HR contact who should invite
people but never see aggregate stats). Speculative role design without
a real requirement tends to guess wrong.

## Not on this roadmap — explicitly deferred, revisit only if it becomes a problem

- **Audit trail on seat-limit/billing changes** — matters for
  compliance-heavy enterprise contracts, not for three known customers
  you're managing by hand.
- **Usage-based overage billing** — an edge case until a customer
  specifically asks to go over their seat count temporarily.
- **Backfilling an individual's pre-existing history into a team's
  aggregate stats when they join** — current behavior (only
  post-join submissions count toward team stats) is arguably correct,
  not a bug. No action unless a customer complains.

## Suggested next action

Phase 0 (individual plan tracking) is the smallest, cheapest, and most
directly tied to money already changing hands. Recommend starting
there.
