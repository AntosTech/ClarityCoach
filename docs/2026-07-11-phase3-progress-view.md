# Phase 3: The Progress View (Coaching Loop)

## Goal

Turn the saved history from Phase 1 into something a user can actually see and act on — the piece that makes Clarity Coach a coach rather than a one-off rewrite tool.

## What Was Built

### Backend (`backend/server.js`)
- New `GET /history` endpoint, auth-required (returns 401 without a valid session token — there's nothing to show an anonymous caller).
- Returns the signed-in user's submissions (`id`, `original_message`, three score columns, `tip`, `created_at`), ordered oldest to newest, scoped by RLS via the caller's own token (same pattern as the `/improve` save — no service-role key involved).
- Refactored the token-resolution logic that `/improve` already had into a shared `getAuthedUser()` helper, now used by both routes.

### Frontend (`frontend/`)
- Added `recharts` for charting.
- New `src/ProgressView.jsx`:
  - Line chart plotting Clarity, Politeness, and Professionalism scores over time (fixed 1–10 y-axis so the scale doesn't visually distort as data accumulates).
  - Reverse-chronological list below the chart showing each past message with its scores and the tip that was given.
  - Handles the empty state (no history yet) and fetch errors distinctly from a loading state.
- `App.jsx`: added a "My Progress" toggle button, visible only when signed in, that swaps the main tool view for `ProgressView` without navigating away from the page (no router — simple state toggle, consistent with the app's existing single-page structure).

## Verified

Loaded the view against two real saved submissions from Phase 1 testing — chart rendered both data points with correct values, legend, and axis scaling; history list showed both messages with matching scores and tips in the right order.

## Where This Leaves the Roadmap

The three phases from the original plan (persistence + accounts, wiring the frontend to accounts, and the progress view) are now all in place. What's not built yet, per the original discussion:

- **Personalized coaching intelligence** (Phase 4): surfacing patterns across history instead of generic per-message tips — e.g., flagging a recurring weakness rather than repeating advice already given.
- **Productization** (Module 10 from the original course scope): Teams integration, deployment, hardening (tests, parameterized URLs/ports instead of hardcoded `localhost:3001`).
