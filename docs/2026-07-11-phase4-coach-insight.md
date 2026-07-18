# Phase 4: Personalized Coaching Intelligence

## Goal

Move beyond per-message tips (which only ever see one message at a time) to insights that look across a user's history — the differentiator identified in the original concept discussion as the thing nothing in the competitive landscape (Grammarly, Wordtune, Sapling, etc.) does well.

## What Was Built

### Backend (`backend/server.js`)
- New `GET /insights` endpoint, auth-required, requiring at least 3 saved submissions before returning anything substantive (`ready: false` with a count below that, so the frontend can show a "keep going" state instead of an error).
- Two layers of insight, computed together:
  - **Computed stats (no AI call, deterministic):** average score per dimension across all history, the weakest-scoring dimension, and a trend comparison — the last 5 messages (or half of history, whichever is smaller/relevant) against the messages before that, per dimension, expressed as a delta.
  - **AI-generated Coach's Insight:** a second Azure OpenAI call, separate from the per-message `/improve` prompt, that receives up to the user's last 10 messages with their scores and is explicitly instructed to find ONE recurring pattern across them — not a generic tip, and not something a single-message view could catch. If this call fails, the endpoint still returns the computed stats rather than failing the whole request — the qualitative insight is a bonus on top of numbers that always work.

### Frontend (`frontend/src/ProgressView.jsx`)
- New "Coach's Insight" card, shown above the score-trend chart:
  - Not-enough-data state: tells the user exactly how many more messages unlock the feature.
  - Ready state: the AI-generated insight text, plus per-dimension cards showing the running average, the weakest dimension highlighted in red as "(focus area)," and a colored trend arrow (up/down/flat) per dimension.

## Verified

Tested against 3 real saved messages, all short, direct, low-context requests. The AI insight correctly identified the actual cross-message pattern (consistent brevity reading as curt) rather than restating a generic tip. Weakest-dimension flagging (Politeness) and trend deltas matched the underlying score data.

## Cost Note

This adds one Azure OpenAI call per progress-view load (not per message submitted), separate from the per-message `/improve` cost. Worth watching if progress-view traffic grows — a caching layer (e.g., only regenerate the insight when new submissions have been added since the last one) would be the natural next optimization if that becomes relevant.

## What's Left

Per the original roadmap: productization — tests, parameterized backend URL/port (currently hardcoded to `localhost:3001`), and eventual Teams integration / deployment work (Module 10 from the original course scope).
