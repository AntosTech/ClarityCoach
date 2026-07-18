# Security Hardening

Date: 2026-07-12

Follow-up to the testing/deployment hardening phase. Closed three gaps
identified in a security review of `backend/server.js`.

## What changed

### 1. CORS restricted to known origins
`app.use(cors())` previously had no `origin` restriction, so any website
could call the API directly from a browser — a real risk given
`/improve` works unauthenticated and calls (paid) Azure OpenAI. Now:

```js
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : ["http://localhost:5173"];

app.use(cors({ origin: allowedOrigins }));
```

Defaults to the local Vite dev server so nothing breaks locally. Set
`ALLOWED_ORIGINS` (comma-separated) in production to your deployed
frontend URL(s) — documented in `backend/.env.example`.

### 2. Server-side input validation on `/improve`
The frontend's 1000-character limit is client-side only and trivially
bypassed by calling the API directly. `/improve` now rejects, before
ever calling Azure OpenAI:
- a missing, non-string, or empty/whitespace-only `message` → 400
- a `message` longer than 2000 characters → 400

This closes a cost-abuse angle: previously, rate limiting capped *how
often* someone could call the endpoint, but not *how much* each
individual call could cost.

### 3. No more raw error messages sent to clients
All five `res.status(500).json({ error: error.message })` sites in
`server.js` (the `/improve` catch block, both `/history` error paths,
and both `/insights` error paths) now log the real error server-side via
`console.error` but return a generic, user-facing message instead of
whatever the underlying library (Supabase, OpenAI, etc.) happened to
say. Prevents leaking internal implementation details to callers.

### Tests
Added three new cases to `backend/server.test.js` covering the new
`/improve` validation (missing message, whitespace-only message,
over-length message), each asserting a 400 and that the AI is never
called. Confirmed the existing malformed-AI-response test still passes
with the new generic error message.

**All 21 backend tests pass** (13 endpoint tests + 8 pure-function
tests). Run with `npm test` from `backend/`.

## Files touched
- `backend/server.js` — CORS allowlist, `/improve` input validation,
  generic error responses (5 sites)
- `backend/server.test.js` — 3 new validation test cases
- `backend/.env.example` — documented `ALLOWED_ORIGINS`

## Not done in this pass (lower priority, flagged but not requested)
- `helmet` middleware for standard security headers — cheap to add,
  low risk either way, wasn't part of the approved scope for this pass.
- HTTPS enforcement, `trust proxy` configuration for accurate rate-limit
  IP detection — these are deployment-topology concerns, worth revisiting
  once actual hosting is chosen.
