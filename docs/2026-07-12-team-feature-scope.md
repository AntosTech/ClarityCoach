# Minimal Team Feature Set — Scope

Date: 2026-07-12

To sell and deliver a Team-tier deal (see the companion pricing doc,
`2026-07-12-pricing-tiers-and-100-seat-proposal.md`), Clarity Coach needs
an organization/team layer that doesn't exist today. Right now there's
only individual accounts — one Supabase user, one private set of
submissions, no concept of "these 100 people belong to one company."
This scopes the minimal version needed to actually deliver a Team deal.

## Core idea

One organization, many member seats, one or more admins who can see
**aggregate** team patterns — without seeing any individual employee's
actual messages or personal scores. That last part is a product/trust
decision as much as a technical one, and it's the one open question in
this doc that most needs your input before building anything.

## The privacy decision (needs your input)

Current Row Level Security is strict per-user (`auth.uid() = user_id`) —
nobody but the individual can see their own submissions, which is a big
part of why people would trust this tool with real workplace messages.
For an admin dashboard, there are two ways to go:

- **Aggregate-only (recommended)**: admins see org-wide numbers only —
  average scores across the team, what fraction of seats are actively
  using the tool, an org-wide Coach's Insight pattern. Never an
  individual employee's actual message text or personal score history.
- **Individual visibility**: admins can see each employee's scores and
  history directly.

Aggregate-only is the safer default. A tool that reports individual
employees' communication scores to their boss is the kind of thing that
kills adoption fast — people won't use it honestly if they know it's
being watched. I'd build aggregate-only first and only reconsider if a
specific customer asks for opt-in individual visibility (and even then,
it should be opt-in per employee, not admin-default).

## Data model additions

- **`organizations`** — `id`, `name`, `seat_limit`, `billing_email`,
  `plan_tier`, `created_at`
- **`organization_members`** — `org_id`, `user_id`, `role`
  (`admin` | `member`), `status` (`invited` | `active`), `joined_at`
- **`organization_invites`** — `org_id`, `email`, `token`, `status`,
  `expires_at`
- **`submissions`** gets an optional `organization_id` column so
  org-scoped aggregate queries can run without changing how individual
  (non-org) accounts behave today

## Feature breakdown

1. **Invite flow** (small–medium) — admin enters employee emails, an
   invite record is created per email, invited employees get a signup
   link that ties their account to the org on signup.
2. **Seat management** (small) — admin view of seats used vs. seat
   limit, ability to deactivate a member's seat.
3. **Admin dashboard** (medium, frontend) — new view: member list
   (name, email, status, last active date — no message content or
   individual scores), org-wide average scores, adoption rate (% of
   seats with at least one submission in the last 30 days), and an
   org-wide Coach's Insight (same underlying insight-generation logic
   already built, fed aggregate/anonymized data instead of one person's
   history).
4. **Org-scoped aggregate insights endpoint** (medium, backend) — a new
   `/org/insights` route, backed by a Postgres aggregate query (or
   security-definer view) that returns only summary numbers, never raw
   rows, to keep the privacy boundary enforced at the database level and
   not just in application code.
5. **Billing** (none needed yet) — invoice the pilot/first deal manually
   outside the app. Not worth building Stripe or any billing automation
   until there's a second or third paying org.

## Rough estimate

Comparable in size to the Phase 1 persistence/accounts build already
completed in this project — roughly **1–2 weeks of solo, part-time
work** to cover items 1–4 above. This is a scope estimate, not a firm
commitment; the admin dashboard (item 3) is the largest single piece.

## Explicitly out of scope for "minimal"

- SSO / Microsoft Entra ID login
- Self-serve billing (Stripe or similar)
- Granular roles beyond admin/member
- Automated seat provisioning via the Microsoft Marketplace Fulfillment
  API — that's tied to the separate decision about going transactable
  on the marketplace, not needed for a direct-sold pilot like this one

## What this unlocks

Once items 1–4 exist, the 100-seat pilot proposed in the pricing doc
becomes something you can actually run end-to-end: invite the pilot
group, they use the tool normally, and you (and the customer's admin)
can see real adoption and aggregate improvement data to make the case
for converting to the full contract.
