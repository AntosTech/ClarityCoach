# Phase 1: Persistence and Accounts

## Goal

Turn Clarity Coach from a stateless rewrite tool into an app that can remember a user's history — the foundation for the coaching loop (progress tracking over time) planned for Phase 3.

## What Was Built

### Supabase project
- New dedicated Supabase project (`clarity-coach`, region `us-east-1`, free tier) created under the Avantgarde Consulting Group organization — kept separate from unrelated existing projects on the account.

### Database
- `public.submissions` table: stores each improved message per user.
  - Columns: `user_id` (FK to `auth.users`), `original_message`, four rewrite columns (`rewrite_professional`, `rewrite_friendly`, `rewrite_concise`, `rewrite_executive`), `explanation`, three score columns (`clarity_score`, `politeness_score`, `professionalism_score`, each constrained 1–10), `tip`, `created_at`.
  - Scores are separate integer columns (not nested JSON) specifically so Phase 3's trend charts can aggregate them directly with SQL (`avg(clarity_score) group by week`, etc.).
  - Row Level Security (RLS) enabled, with `select`/`insert` policies scoped to `auth.uid() = user_id` — users can only ever read or write their own rows. No `update`/`delete` policies were added on purpose: history is an immutable log, matching the "coach" framing (a real record of how someone actually wrote over time, not an editable scratchpad).
  - Security advisor scan came back clean (no lint warnings) after creation.

### Backend (`backend/server.js`)
- Added `@supabase/supabase-js`.
- `/improve` now optionally reads a `Bearer` token from the `Authorization` header. If present, it resolves the calling user via Supabase Auth and, after generating the AI response, saves the result to `submissions`.
- The backend never uses a service-role key. It creates a Supabase client scoped to the caller's own access token, so the same RLS policies that protect the database from the browser also protect it here — least-privilege by construction, not by convention.
- Saving is best-effort: if the insert fails, the error is logged server-side but the `/improve` response still returns normally. A history-save failure should never break the core rewrite feature.
- No user is required to use the tool — an unauthenticated request still works exactly as before, it just isn't saved.

### Frontend (`frontend/`)
- Added `@supabase/supabase-js`.
- `src/supabaseClient.js`: single shared Supabase client, configured from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- `src/Auth.jsx`: email/password sign-up and sign-in form.
- `App.jsx`: tracks the current session via `supabase.auth.getSession()` and `onAuthStateChange`; shows the sign-in form when logged out and a "Signed in as ___ / Sign Out" bar when logged in; attaches the session's access token to `/improve` requests when present.

### Environment
- `backend/.env`: added `SUPABASE_URL`, `SUPABASE_ANON_KEY` (alongside existing Azure OpenAI keys).
- `frontend/.env`: new file, added `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Both files are covered by the root `.gitignore`.

## Verified

- Account creation and email confirmation via Supabase Auth — confirmed directly against `auth.users`.
- Sign-in flow in the running app.
- End-to-end save: submitted messages while signed in produced rows in `public.submissions` with the correct `user_id`, rewrites, scores, and tip.

## What's Next (Phase 3 in the original roadmap)

Build the "My Progress" view: a history list of past submissions plus trend charts (clarity/politeness/professionalism over time) using the score columns now being captured. This is the piece that turns the app from "rewrite tool with login" into an actual coaching loop.
