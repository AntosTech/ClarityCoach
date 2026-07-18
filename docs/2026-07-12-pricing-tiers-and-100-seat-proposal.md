# Pricing Tiers & 100-Seat Team Proposal

Date: 2026-07-12

This lays out a full pricing ladder for Clarity Coach and a concrete deal
structure for the 100-employee prospect. The exact numbers below are a
reasoned starting point based on comparable products (Grammarly Business)
and current B2B SaaS discounting benchmarks — not locked-in facts. Treat
anything in the "what's not decided yet" section as genuinely open.

## Pricing ladder

| Tier | Audience | Price | What's included |
|---|---|---|---|
| Free | Individual, trial | $0 | 10 coaching requests/month, no saved history |
| Pro | Individual, paid | $14/month ($140/year, ~17% off) | High/unlimited coaching requests, full history, Coach's Insight |
| Team | Companies, 10–149 seats | $12/seat/month list | Everything in Pro + admin dashboard, org-wide aggregate insights, centralized invoicing, seat management |
| Enterprise | Companies, 150+ seats | Custom / negotiated | Everything in Team + SSO, DPA/security-review support, dedicated onboarding, custom SLA |

The Team/Enterprise split at 150 seats mirrors Grammarly's own Pro
(up to 149 seats) vs. Enterprise (150+, quote-based) boundary — a
reasonable line to borrow rather than invent from scratch.

## This prospect: 100 seats

100 employees sits inside the Team tier, not Enterprise — this is good
news: it means a standard, defensible quote works, not a fully custom
negotiation.

### Deal math

| | Rate | Notes |
|---|---|---|
| List price | $12/seat/month | Team tier list, billed monthly |
| 100-seat volume discount | −12% | Modest — the steeper 15–30% discount band is typical for 200+ seat deals, not 100 |
| Effective monthly rate | $10.56/seat/month | If billed monthly, no annual commitment |
| Annual prepay discount | additional −15% | Standard incentive for a year paid upfront |
| **Effective annual rate** | **~$9.00/seat/month** | **25% off list overall** |
| **Total annual contract value** | **~$10,800/year** | 100 seats × $9/seat/month × 12 months |

### Usage allowance

Each seat should include a reasonable monthly coaching-request allowance
(suggest starting at 150 requests/seat/month — generous for daily
individual use) with metered overage beyond that. This protects margin
if a handful of employees use the tool heavily, since your underlying
cost (Azure OpenAI calls) scales with usage even though the seat price
doesn't. The exact allowance and overage rate should be tuned once
there's real per-request cost data from Azure OpenAI usage.

### Recommended approach for this specific deal: start with a paid pilot

The app doesn't have any team/organization features yet (see the
companion scope doc). Rather than promise a 100-seat rollout you can't
yet deliver, propose:

- **Pilot**: 15–20 seats, 60–90 days, at the same ~$9/seat/month
  effective rate (prorated) — small enough to support manually if
  needed, real enough to prove value.
- **Conversion**: if the pilot lands, convert to the full 100-seat
  annual contract (~$10,800/year) with the team features built out by
  then.

This is honest about where the product actually is, de-risks the sale
for both sides, and buys the time needed to build the minimal team
features scoped separately.

## What's not decided yet
- Exact list price — $10–14/seat/month is all defensible based on the
  Grammarly comp; $12 is a starting point, not a fixed number.
- Whether the Team tier needs a seat minimum (e.g., 10 seats) so a
  handful of employees can't undercut the point of having a Team tier
  at all.
- Usage allowance and overage pricing — needs real Azure OpenAI cost
  data before finalizing.
- Whether to offer month-to-month Team pricing at all, or require an
  annual commitment for anything above the Pro tier.
