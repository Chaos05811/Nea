# Nea backend — MVP

SIH 2026, PSID 198, team Fremen.

Two services:

- **`node-api/`** — Express + **TypeScript** + Prisma. Owns the Postgres schema,
  auth (JWT + Google OAuth), users/sessions/messages, and the memory tables
  (facts, capsules, traits, risk events). This is what you `npm start`. The
  frontend talks to **only this service** — it never calls `ai-service` directly.
- **`ai-service/`** — FastAPI (Python). Owns the LLM "brain" (via **LangChain** +
  Groq/Llama 3.3 70B), speech-to-text (Groq Whisper), text-to-speech (edge-tts),
  the 3-layer crisis/risk detector (keyword screen + **RandomForest/XGBoost** ML
  classifier + LLM self-report), and capsule memory consolidation (summary +
  trait deltas, in one pass). Called internally by `node-api`, authenticated
  with a shared internal key.

```
frontend (Expo)  →  node-api (:4000, TS/Express+Prisma, owns Postgres)  →  ai-service (:8000, FastAPI, owns Groq/edge-tts/ML)
```

This is a deliberately trimmed MVP — see **"Cut for MVP"** below for the five
things pulled out to fit the hackathon timeline and exactly where to add each
one back.

## Tech-stack alignment (Technical Approach slide)

| Slide item | Status |
|---|---|
| Expo Go | Frontend, unchanged — not part of this backend |
| Node.js | `node-api`, TypeScript throughout |
| TypeScript | `node-api` — all of `src/` |
| FastAPI | `ai-service` |
| PostgreSQL | Supabase, via Prisma (schema) + SQLAlchemy (ai-service reads) |
| JWT | `node-api/src/middleware/auth.ts` |
| OAuth | Google Sign-In: `POST /api/auth/oauth/google` (verifies the Google ID token server-side, issues our own JWT) |
| LangChain | `ai-service/app/services/llm.py` — `ChatGroq` + message types own the brain's prompt assembly, the seam for adding more "brains" later |
| XGBoost / Random Forest | `ai-service/app/services/ml_risk.py` — a 3rd, advisory risk-detection layer. `scripts/train_risk_classifier.py` trains both and keeps whichever cross-validates better (currently XGBoost) — see the big caveat below, the training set is a ~180-example seed set, not clinical data |
| Amazon S3 | Optional voice-recording archival, `node-api/src/lib/s3.ts` — fully feature-flagged, no-ops until `AWS_S3_BUCKET` is set |
| Redis | **Cut for MVP** — see below |
| pgvector | **Cut for MVP** — see below |
| AES-256 | **Cut for MVP** — see below |
| Kafka | **Not wired**, by decision — see "Cut by decision" below |
| Kubernetes | **Not wired**, by decision — see "Cut by decision" below |
| Next.js | Not built yet — the natural home for it is the mood/capsule dashboard (`GET /api/memory/capsules` + `/traits` already serve the data). Backend is ready for it whenever you want it |

## Cut for MVP (all noted in code with where to add each back)

Five things were deliberately left out to fit the hackathon timeline. None of
them are load-bearing for a demo — the app works fully without them, just a
little slower / a little simpler. Each is called out with a comment at its
old call site in the code, so grepping for "MVP scope" or "Cut for MVP" finds
every spot.

- **Redis / context cache** — was a write-through cache of the last ~30 turns
  per session (`node-api/src/lib/redis.ts` write side, `ai-service/app/core/redis_client.py`
  read side), so `ai-service` didn't have to hit Postgres for every chat turn.
  Cut entirely; `ai-service/app/services/memory.py`'s `get_recent_messages()`
  now always reads Postgres directly — functionally identical, just not
  cache-fast. **To add back**: recreate those two files (git history has the
  originals), reintroduce the `pushContextMessage` write-through calls in
  `node-api/src/routes/chat.ts`, and restore the Redis-first read in
  `memory.py`. Both were designed to fail open (missing/down Redis = fall back
  to Postgres), so it's a safe, additive change.
- **Kafka / event bus** — was never implemented (a scoping decision, not a
  cut mid-build) — see "Cut by decision" below, unchanged from before.
- **Fact auto-extraction** — capsule consolidation's one LLM call used to
  return a 3rd field (`facts: [...]`) that got written into `fact_memory`
  automatically alongside the summary and trait deltas. Cut; the consolidation
  call now only returns `summary` + `trait_deltas` (see
  `ai-service/app/services/capsule.py`'s `CONSOLIDATION_PROMPT`). **fact_memory
  itself is fully functional** — it's just written explicitly now, via
  `POST /api/memory/facts`, instead of inferred from conversation. **To add
  back**: restore the `facts` field in `CONSOLIDATION_PROMPT`'s JSON shape and
  the `_apply_facts()` function (removed from `capsule.py`, git history has it),
  and call it alongside `_apply_trait_deltas()` in `consolidate_user()`.
- **Capsule embeddings** — `capsules.embedding vector(384)` plus the pgvector
  Postgres extension were reserved but never written to, so they're removed
  entirely now (from `schema.prisma`'s `Capsule` model and the `datasource`/
  `generator` blocks, and from `ai-service/app/core/db_models.py`'s comment).
  **To add back**: re-add `extensions = [vector]` to the Prisma `datasource`
  block and `previewFeatures = ["postgresqlExtensions"]` to `generator`, add
  back `embedding Unsupported("vector(384)")?` to the `Capsule` model, run a
  new migration, enable the `vector` extension on Supabase, and wire an actual
  embedding call into `capsule.py` for semantic search over past capsules.
- **Field-level encryption of `fact_memory.fact_value`** — was AES-256-GCM,
  implemented identically in both languages (`node-api/src/lib/crypto.ts` /
  `ai-service/app/core/crypto.py`). Cut; `fact_value` is now stored and read
  as **plaintext**. This is the one cut worth flagging before any real
  deployment (`fact_memory` can hold sensitive personal facts) — treat
  re-adding encryption as a pre-launch requirement, not an optional polish
  item. **To add back**: restore both crypto files (git history has them,
  byte-for-byte compatible on purpose), re-wrap `factValue` with
  `encryptField`/`decryptField` in `node-api/src/routes/memory.ts`'s
  `GET`/`POST /facts` handlers, and set the same `ENCRYPTION_KEY` in both
  `.env` files.

### Cut by decision (not oversights)

You decided to skip **Kafka** and **Kubernetes** for the hackathon build — both add
real operational weight (a broker/cluster that has to stay alive) for a 36-hour
build, and neither changes what a judge can see working in a demo. If it comes up:
this architecture calls `ai-service` directly over HTTP instead of through an event
bus, and runs as two plain processes (`npm start`) instead of a cluster — a
legitimate, common scoping choice for an MVP, not a gap in understanding of when
you'd want them at real scale (async event fan-out, independent horizontal scaling
of the AI worker under real load).

## Why Groq + edge-tts

- **Conversation brain**: Groq's hosted Llama 3.3 70B via LangChain. Free-tier,
  currently the fastest LLM inference available — fixes "Gemini answers but very
  late."
- **STT**: Groq Whisper large-v3, same key as the brain. Accepts whatever format
  the phone recorded (m4a/mp4/webm/wav) directly — no ffmpeg/PCM conversion step.
- **TTS**: `edge-tts` — **completely free, no signup, no API key of any kind.**
  It's an open-source wrapper around the same TTS service Microsoft Edge's
  "Read aloud" feature uses. `pip install edge-tts` (already in
  `requirements.txt`) is the entire setup step — nothing to configure beyond
  picking a voice (`TTS_DEFAULT_VOICE`, already set to a good `en-IN` voice).
  Run `edge-tts --list-voices` to see every available voice/language.
- Anthropic's API isn't used here — that key is billed to a different account,
  not meant to be embedded in another product.

## 1. Set up the database connection

Your Supabase host (`db.<ref>.supabase.co:5432`) is **IPv6-only** on new Supabase
projects. Fine on your laptop, but if you hit a mysterious timeout on some
network or an IPv4-only host (Render, Railway, some CI), switch to the
**connection pooler** string — Supabase dashboard → Settings → Database →
Connection Pooling → "Transaction" mode:

```
postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true
```

## 2. Install & configure

```bash
npm run install:all          # installs node-api's npm deps + ai-service's pip deps
```

`.env` files already exist in both `node-api/` and `ai-service/` (gitignored,
not committed) with a Groq key filled in and random `JWT_SECRET`/
`INTERNAL_API_KEY` values generated. **You still need to fill in
`DATABASE_URL`** (identical value in both files) with your real Supabase
connection string — everything else is ready to go. `.env.example` next to
each documents every variable if you need to regenerate from scratch.

- `GOOGLE_OAUTH_CLIENT_ID` (node-api, optional) — leave unset to disable Google
  Sign-In only; email/password auth works regardless.
- `AWS_S3_BUCKET` + AWS credentials (node-api, optional) — leave unset to skip
  voice-recording archival entirely.

## 3. Create the database tables

```bash
npm run migrate
```

Runs `prisma migrate dev` from `node-api/`.

## 4. (Optional) retrain the risk classifier

A trained model is already checked in at
`ai-service/app/models/risk_classifier.joblib` (XGBoost, picked over RandomForest
by cross-validated F1 on the seed dataset). Only re-run this if you grow
`ai-service/scripts/risk_seed_data.py` with more examples:

```bash
cd ai-service && python3 scripts/train_risk_classifier.py
```

## 5. Run both services

```bash
npm start
```

Runs `node-api` (TypeScript, compiled then run) on `:4000` and `ai-service` on
`:8000` together via `concurrently`. For hot-reload during development:
`npm run dev:node` (tsx watch) / `npm run dev:python` (uvicorn --reload).

```bash
curl http://localhost:4000/health
curl http://localhost:8000/health
```

## API the frontend should call (all on `:4000`)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{email, password, displayName?, ageGroup?, language?}` → `{token, user}` |
| POST | `/api/auth/login` | `{email, password}` → `{token, user}` |
| POST | `/api/auth/oauth/google` | `{idToken}` (from Expo Google Sign-In) → `{token, user}`. 501 if `GOOGLE_OAUTH_CLIENT_ID` isn't set |
| GET | `/api/auth/me` | Bearer token → current user |
| POST | `/api/sessions` | `{modality: "text"\|"voice"\|"video"\|"isl"}` → new session |
| GET | `/api/sessions` | List the user's sessions |
| GET | `/api/sessions/:id/messages` | Full history for one session |
| POST | `/api/chat` | `{sessionId, content, modality}` → persists both turns, runs 3-layer risk detection, returns `{assistantMessage, riskLevel, resources}` |
| POST | `/api/voice/stt` | multipart `audio` field (+ optional `sessionId` field for S3 archival) → `{transcript, language}` |
| POST | `/api/voice/tts` | `{text, voice?}` → streams back an MP3 |
| GET | `/api/memory/facts` | Currently-valid facts about the user (plaintext — see "Cut for MVP") |
| POST | `/api/memory/facts` | `{factKey, factValue, sourceMessageId?}` → versioned upsert |
| GET | `/api/memory/capsules` | Weekly/5-conversation memory summaries (dashboard data source) |
| GET | `/api/memory/traits` | Decaying personality/mood trait scores |
| GET | `/api/memory/risk-events` | The user's own risk-event history |

Every route except `/register`, `/login`, and `/oauth/google` needs
`Authorization: Bearer <token>`.

**The ISL gesture classifier's output plugs straight into `POST /api/chat`** —
once it recognises a sentence, send it as `{sessionId, content: "<recognised text>", modality: "isl"}`.
No separate ISL endpoint needed on the backend side; that work is on-device
(OpenCV/mediapipe landmark → gesture classification), next once this loop is
confirmed working end-to-end.

## Safety layer — 3 layers (unaffected by the MVP cuts above)

1. **Deterministic keyword screen** (`ai-service/app/services/risk.py`) — runs on
   *every* message before anything else. The only layer that can trigger the
   scripted crisis-bridge reply by itself (names what it heard, doesn't argue,
   surfaces Tele-MANAS 14416 + iCall 9152987821). Logged as an auditable
   `RiskEvent` row by node-api.
2. **LLM self-report** — every normal reply also carries the model's own
   risk_level assessment.
3. **ML classifier** (`ai-service/app/services/ml_risk.py`, RandomForest/XGBoost)
   — a third, advisory signal. It can only nudge the final risk level **up**,
   never down, and never triggers the crisis-bridge by itself — only layer 1
   does that. Its recall on "critical" is weak on the current ~180-example seed
   dataset (see the warning baked into `risk_classifier_meta.json`); treat it as
   a bonus signal, not a safety guarantee, until it's retrained on real data.

All three are demo-scoped. Before any real deployment: proper clinical review of
the keyword list and prompt, a real labeled dataset for the ML layer (thousands
of examples, ideally clinician-reviewed), and testing of the whole pipeline
against known crisis-language corpora.

## What's intentionally NOT in this MVP (scope cuts, not oversights)

- **Redis, capsule embeddings, fact auto-extraction, field encryption** — see
  "Cut for MVP" above, each with where/how to add it back.
- **Kafka / Kubernetes** — cut by decision, see above.
- **Next.js dashboard** — not built; the API it would consume already exists
  (`/api/memory/capsules`, `/traits`).
- **Real-time streaming replies** — `/api/chat` is request/response, not
  token-streamed. Fine for a hackathon demo; add SSE/WebSocket later if the
  perceived latency matters.

## A note on testing this

Every file is syntax-checked (`tsc --noEmit` passes for every file touched by
the MVP trim — two pre-existing, unrelated type errors in `sessions.ts` are
not part of this pass), and both services boot-tested locally. A live
end-to-end run against your actual Supabase database has **not** been done —
run `npm run migrate` locally as the first real test once `DATABASE_URL` is
filled in; if it fails on something other than a wrong password, that's worth
digging into before anything else.
