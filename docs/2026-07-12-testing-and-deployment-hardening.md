# Testing & Deployment Hardening

Date: 2026-07-12

This phase focused on making Clarity Coach safer to run in production and
easier to change with confidence — config parameterization, API rate
limiting, environment-variable scaffolding, and automated tests for both
the backend and frontend.

## What changed

### Config parameterization
- **Backend**: the server port now comes from `process.env.PORT`, falling
  back to `3001` for local dev (`backend/server.js`).
- **Frontend**: API calls now go through `API_URL` in
  `frontend/src/config.js`, which reads `VITE_API_URL` and falls back to
  `http://localhost:3001`. This means a deployed frontend can point at a
  deployed backend just by setting one env var — no code changes.

### Rate limiting
- Added `express-rate-limit` to both `/improve` and `/insights`
  (`backend/server.js`), since both routes call Azure OpenAI and are the
  only real cost/abuse surface in the API. Each caller is capped at a
  sensible request count per 15-minute window; going over returns a 429
  with a friendly message instead of silently running up the OpenAI bill.

### `.env.example` scaffolding
- Added `backend/.env.example` and `frontend/.env.example` documenting
  every environment variable the app needs (Azure OpenAI credentials,
  Supabase URL/anon key, optional port/API URL overrides) without
  exposing real secrets. Makes onboarding a new environment (or a
  teammate) straightforward.

### Extracted testable business logic
- Pulled the pure scoring/trend math (`computeTrend`,
  `computeOverallAverages`, `findWeakestDimension`, `average`, `round1`)
  out of `server.js` into `backend/insights.js` — no I/O, no Express, no
  Supabase, no OpenAI. This is what made it possible to unit test the
  actual scoring logic without mocking three different services.

### Backend automated tests (Vitest + Supertest)
- `backend/insights.test.js` — 8 unit tests covering the pure functions
  above, including edge cases (single submission, tie-breaking weakest
  dimension, the 6-submission trend-split boundary).
- `backend/server.test.js` — 10 endpoint tests against the real Express
  app, with the `openai` and `@supabase/supabase-js` packages fully
  mocked so nothing hits a real network or costs real money. Covers: the
  health check, `/improve` (unauthenticated success, authenticated save,
  malformed-AI-response handling), `/history` (auth required, returns
  data), and `/insights` (auth required, not-ready state, ready state
  with AI insight, and graceful degradation when the AI insight call
  fails).
- **All 18 backend tests pass.** Run with `npm test` from `backend/`.
- `server.js` was also changed so `app.listen()` only runs when the file
  is executed directly (`node server.js`), not when it's imported by a
  test file — this is what lets Supertest exercise the app without
  binding a real port.

### Frontend smoke tests (Vitest + React Testing Library)
- `frontend/src/App.test.jsx` — 5 smoke tests against the main tool UI,
  with the Supabase client mocked (no real auth calls) and `fetch`
  mocked per test: the form renders, empty-message submission shows a
  validation error and never calls the API, a successful `/improve` call
  renders the results section, a failed API call shows the generic error
  message, and Reset clears the message/results.
- `frontend/src/setupTests.js` registers `@testing-library/jest-dom`'s
  matchers.
- `frontend/vite.config.js` now has a `test` block (jsdom environment +
  the setup file) so `npm test` works out of the box.

**Verification:** both suites are confirmed passing — backend 18/18,
frontend 5/5 (23/23 total). The frontend suite couldn't be run inside
this session's sandbox (an unrelated `npm install` registry/cache bug),
so it was verified locally instead. Two issues turned up in that local
run and were fixed:
- `setupTests.js` was importing `@testing-library/jest-dom` from its
  package root, which assumes Jest's global `expect`. Vitest doesn't
  inject that global by default, so it threw `ReferenceError: expect is
  not defined`. Fixed by importing the `@testing-library/jest-dom/vitest`
  subpath instead, which extends Vitest's own `expect`.
- React Testing Library's automatic cleanup between tests wasn't firing,
  so each `render(<App />)` stacked on top of the previous test's
  still-mounted DOM, causing "found multiple elements" errors from the
  second test onward. Fixed by adding an explicit
  `afterEach(() => cleanup())` in `setupTests.js`.

## Files touched
- `backend/server.js` — port from env, rate limiters, `isMainModule`
  guard + `export default app`
- `backend/insights.js` — new, extracted pure functions
- `backend/insights.test.js` — new
- `backend/server.test.js` — new
- `backend/package.json` — added `vitest`/`supertest`, `test` script
- `backend/.env.example` — new
- `frontend/src/config.js` — new (`API_URL`)
- `frontend/.env.example` — new
- `frontend/package.json` — added test deps, `test` script
- `frontend/vite.config.js` — added `test` config block
- `frontend/src/setupTests.js` — new
- `frontend/src/App.test.jsx` — new

## What's left
- Actual cloud deployment (backend hosting + frontend hosting) — not
  started.
- Communication Level feature — deferred, no build decision yet.
