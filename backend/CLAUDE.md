# Nea — project context for Claude Code

Drop this file at the root of the `backend` folder (same level as `node-api/`,
`ai-service/`, `README.md`). Claude Code reads `CLAUDE.md` automatically, so this
is what re-establishes context in a fresh session. Everything below is accurate
as of 2026-09-16.

## What this project is

SIH 2026 (Smart India Hackathon), PSID 198, team **Fremen**, app name **Nea**.
An emotionally intelligent AI companion app — more emotionally present than a
generic chatbot — with age-adaptive persona, cross-session memory, and
accessibility via Indian Sign Language (ISL), voice, and text. Core, load-bearing
design principle carried through every layer: **the AI is a bridge to real human
help, never a replacement, and never tries to handle a crisis alone.**

Frontend is a separate Expo/React Native app at `../frontend` (sibling folder,
own git repo — see the top-level `.gitignore`). Wired to this backend's real API
(`frontend/src/api/`) — not a mocked demo.

## Repo layout

```
backend/
├── README.md              # setup instructions, API table — some of it now stale post-migration, this file is authoritative
├── package.json            # root: `npm start` runs node-api + the risk classifier together
├── node-api/                # Express + TypeScript + Prisma — owns EVERYTHING except the ML risk model
│   ├── prisma/schema.prisma # owns the DB schema — migrate from here only
│   ├── e2e_test.mjs         # real end-to-end test against the live running stack — rerun anytime
│   └── src/
│       ├── server.ts        # also hosts the node-cron daily consolidation job
│       ├── routes/          # auth.ts, sessions.ts, chat.ts, voice.ts, memory.ts
│       ├── services/        # llm.ts, memory.ts, risk.ts, riskClassifier.ts, stt.ts, tts.ts, capsule.ts
│       ├── middleware/auth.ts
│       └── lib/              # prisma.ts, groq.ts, aiClient.ts (→ risk classifier only now), firebase.ts, s3.ts
└── ai-service/               # FastAPI (Python) — ONLY the ML risk classifier now, nothing else
    ├── requirements.txt      # trimmed: fastapi, scikit-learn, xgboost, joblib — no DB, no Groq, no edge-tts
    ├── scripts/               # train_risk_classifier.py, risk_seed_data.py
    └── app/
        ├── main.py            # mounts one router
        ├── core/               # config.py (internal_api_key, port only), security.py
        ├── routes/risk.py      # POST /risk/classify — the entire API surface
        ├── services/ml_risk.py # unchanged classifier logic
        └── models/             # risk_classifier.joblib + _meta.json — already trained, checked in
```

Note: `node-api/src/lib/redis.ts` and `crypto.ts` **used to exist** and are
deleted (MVP scope cut — see README's "Cut for MVP"). Recoverable from git
history if needed.

## Architecture, in one paragraph

```
frontend (Expo)  →  node-api (:4000, Node/Express+Prisma — auth, chat/Groq, TTS/STT, memory)  →  ai-service (:8000, Python — ML risk classifier ONLY)
```

**This is a major change from earlier in the project.** node-api used to be a
thin proxy in front of a full Python FastAPI "ai-service" that owned the LLM,
TTS/STT, and memory consolidation. As of 2026-09-16 (explicit user request:
"convert my backend into node.js", with the ML classifier staying in Python by
deliberate choice — see below), **node-api now does all of that itself in
Node/TypeScript.** ai-service is a single-purpose microservice: it loads one
scikit-learn/XGBoost `.joblib` model and serves `POST /risk/classify`. Nothing
else. node-api still calls it over HTTP with the same `INTERNAL_API_KEY`
header pattern as before — that trust boundary is unchanged, just narrower.

**Why the ML classifier stayed in Python**: it's a trained scikit-learn/XGBoost
pipeline (vectorizer + model + label encoder) saved via `joblib`. There's no
practical way to load that in Node without retraining — porting would mean
either exporting to ONNX (not done) or retraining with a JS-native library
(would change model behavior). The user explicitly chose to keep this one
piece in Python rather than either of those — see `app/services/ml_risk.py`,
completely unchanged from before the migration.

## What moved to Node, and how (read this before touching chat/voice/memory code)

- **Chat/LLM** (`node-api/src/services/llm.ts`): direct `groq-sdk` calls, not
  LangChain. The Python version used LangChain's `ChatGroq` to set up future
  multi-"brain" routing that was never built past one brain — a raw SDK call
  is simpler and equally capable today. `buildSystemPrompt()` (persona by age
  group, facts, capsule summaries) is a faithful line-for-line port.
- **STT** (`src/services/stt.ts`): `groq-sdk`'s `audio.transcriptions.create()`,
  same Whisper large-v3 model, same verbose_json response format.
- **TTS** (`src/services/tts.ts`): `msedge-tts` npm package instead of Python's
  `edge-tts` — same underlying free Microsoft Edge "Read Aloud" service, same
  voices (`en-IN-NeerjaNeural` etc.), verified against the live service
  (produces real MP3 bytes) before wiring in.
- **Keyword risk screen + crisis-bridge reply** (`src/services/risk.ts`):
  direct port, same phrase list, same scripted reply.
- **Memory consolidation** (`src/services/capsule.ts`): capsule
  open/close-window logic, the LLM summarization pass, trait-delta
  application, and daily trait decay — all ported to Prisma queries. Runs on
  a `node-cron` job in `server.ts` (`0 3 * * *`, same schedule as the old
  Python APScheduler job) instead of FastAPI's `@app.on_event("startup")`.
  A manual trigger also exists at `POST /api/memory/consolidate` (scoped to
  the calling user only — the old Python `/internal/consolidate` ran for
  every user, which felt like too broad a blast radius for an
  authenticated-user-triggered endpoint).
- **ML risk classifier call** (`src/services/riskClassifier.ts`): the only
  remaining cross-service HTTP call, replacing what used to be an in-process
  Python function call within ai-service's own `/chat` route. Same
  "advisory only, never downgrades, never triggers the crisis-bridge by
  itself" merge logic, now living in `src/routes/chat.ts`.

**Gesture detection is gone from both services entirely** — not because it
moved to Node, but because a separate change (before this migration) moved
ISL's hand/face detection filter to run client-side in the frontend, in a
WebView running MediaPipe's JS/WASM build directly on the camera stream (see
`frontend/src/components/islFilterHtml.js`). The old
`ai-service/app/services/gesture_detector.py` (Python MediaPipe) and
`node-api/src/routes/gesture.ts` (proxy) were both unused dead code by the
time this migration happened, and were deleted rather than ported. The
`hand_landmarker.task`/`face_landmarker.task` model files that used to live
in `ai-service/` were deleted too (they were only ever used by that dead
code) — the frontend's WebView filter loads MediaPipe's models from CDN
itself, no backend involvement.

## MVP scope cuts (do not silently re-add without asking)

Same five as before this migration (files moved, decisions unchanged — see
README's "Cut for MVP" section for exact pointers): Redis/context cache,
Kafka/event bus (never built), fact auto-extraction during consolidation,
capsule embeddings/pgvector, field-level encryption of `fact_memory.fact_value`
(**this is the one that matters before any real deployment** — `fact_memory`
can hold sensitive personal facts, currently plaintext in the DB).

## Provider/tech decisions (and why — don't relitigate these without a reason)

- **LLM**: Groq (`openai/gpt-oss-120b`, see `GROQ_CHAT_MODEL`), raw `groq-sdk`
  in Node now (see "What moved to Node" above for why LangChain was dropped).
- **STT**: Groq Whisper large-v3, same as before.
- **TTS**: `msedge-tts` (Node) — free, no key, no signup.
- **DB**: Supabase Postgres via the **connection pooler**
  (`aws-0-<region>.pooler.supabase.com:6543`, `?pgbouncer=true`), NOT the
  direct `db.<ref>.supabase.co:5432` host. That direct host is IPv6-only, and
  this was a real, repeated blocker in this session: some dev environments
  have no outbound IPv6 route at all, so the direct host is simply
  unreachable there (fails as `P1001` from Prisma). The pooler resolves to
  IPv4 AWS load balancers and works from IPv4-only networks. Two other
  things that turned out to matter when debugging this, in case it recurs:
  (1) **Supabase's Network Restrictions** (Settings → Database → Network
  Restrictions) can silently drop connections from non-allowlisted IPs —
  this presents as a *hang/timeout*, not a clean rejection, which is a good
  diagnostic signal to tell it apart from a routing problem. For a
  hackathon-stage project, removing all restrictions (or allowlisting
  `0.0.0.0/0`) is the practical fix, since app-level auth is the real
  security boundary anyway, not network IP filtering. (2) `prisma db push`/
  `migrate` over the pooler can throw `prepared statement "sX" already
  exists` — a known Prisma+PgBouncer-transaction-mode quirk. It doesn't
  block normal query traffic (the Prisma Client's regular query engine
  handles `pgbouncer=true` fine); it only affects the schema/migration CLI
  commands. If you need to run a migration, expect to possibly retry, or use
  a direct connection for that one operation if IPv6 is reachable from
  wherever you're running it.
- **OAuth**: Google Sign-In (`POST /api/auth/oauth/google`) and Firebase
  Authentication (`POST /api/auth/firebase`) both exist alongside
  email/password + JWT — see the Firebase section below.
- **ML risk classifier**: unchanged from before — RandomForest/XGBoost on a
  ~180-example seed dataset, demo-quality, advisory-only third safety
  signal. Still in Python, by deliberate choice (see "Why the ML classifier
  stayed in Python" above).
- **Kafka/Kubernetes**: still deliberately not implemented — unchanged
  reasoning from earlier in the project (operational risk vs. a 36-hour
  build timeline).

## Safety layer (do not weaken this without an explicit, deliberate decision)

Same three layers, same ordering, same guarantee — just relocated:

1. **Keyword screen** (`node-api/src/services/risk.ts`, `keywordScreen()`) —
   deterministic English + Hindi/Hinglish crisis-phrase list, runs before any
   model call, in-process now (used to be a Python call). The ONLY layer that
   can trigger the scripted crisis-bridge reply by itself.
2. **LLM self-report** (`node-api/src/services/llm.ts`) — every normal reply
   also carries the model's own `risk_level` via structured JSON output.
3. **ML classifier** (`ai-service/app/services/ml_risk.py`, called via
   `node-api/src/services/riskClassifier.ts` over HTTP) — advisory only. Can
   only push the final risk level **up** (severity-merge logic now in
   `node-api/src/routes/chat.ts`), never down, never triggers the
   crisis-bridge reply by itself.

Every non-"none" result gets logged as an auditable `RiskEvent` row.
**If you touch this pipeline, preserve the "deterministic layer wins, ML
layer only escalates" property** — that's the actual safety guarantee, not
the ML model's accuracy (which is weak — see the classifier's own docstring).

## Environment variables

`node-api/.env` now holds everything: `DATABASE_URL` (pooler string — see
above), `JWT_SECRET`, `GOOGLE_OAUTH_CLIENT_ID`, `GROQ_API_KEY`/
`GROQ_CHAT_MODEL`/`GROQ_STT_MODEL` (moved here from ai-service),
`TTS_DEFAULT_VOICE`, `AWS_S3_*` (optional), `AI_SERVICE_URL` +
`INTERNAL_API_KEY` (for the risk-classifier call).

`ai-service/.env` is now tiny: just `INTERNAL_API_KEY` (must match node-api's)
and `PORT`. No `DATABASE_URL`, no `GROQ_API_KEY` — it doesn't touch either.

`node-api/serviceAccountKey.json` (Firebase Admin service account, gitignored)
is required for `POST /api/auth/firebase` to work — see Firebase section.

**Do not commit `.env` files or `serviceAccountKey.json`, or paste real
credentials into chat/code.**

## Firebase Authentication (see node-api/src/lib/firebase.ts)

`node-api` verifies Firebase ID tokens server-side via `firebase-admin`,
keyed by the service account at `node-api/serviceAccountKey.json`
(gitignored). The frontend's Firebase **client** config
(`frontend/src/api/firebase.js`) uses a public web API key — fine to be
visible client-side, Firebase's security model doesn't treat it as a secret;
the real access control is the server-side ID-token verification.
`User.firebaseUid` coexists with `googleId`/`passwordHash` — same
account-linking pattern for all three (same email → same User row).

## Daily check-ins (see node-api/src/routes/memory.ts)

`CheckIn` model (`POST /api/memory/checkin`, `GET /api/memory/checkin/week`)
— one mood per user per day, upserted. Backs the dashboard's check-in row and
weekly pattern with real persisted data, not local component state.

## Current status / what's verified

- **Verified live, end-to-end, against the real running stack, post-Node-
  migration** (see `node-api/e2e_test.mjs` — rerun it any time as a
  regression check): real Firebase sign-up → `POST /api/auth/firebase` token
  exchange → JWT → session create → real Groq chat reply (now fully
  in-process in Node) → TTS via `msedge-tts` (real audio bytes) → STT via
  Groq SDK (fed the TTS output back in, got a matching transcript) → ML risk
  classifier service reachable → check-in persistence → crisis-phrase
  message correctly triggers the safety bridge reply with Tele-MANAS/iCall
  resources → manual consolidation endpoint runs without error. All 12
  checks passed.
- `tsc --noEmit` is clean in `node-api/`.
- Frontend UI was verified end-to-end (sign up/in/out, real chat reply
  rendered, check-in updates dashboard) **before** this migration, against
  the old Python-backed chat/voice routes — the API contracts
  (`POST /api/chat`, `/api/voice/stt`, `/api/voice/tts`) are unchanged by
  this migration, so the frontend needs no changes and that verification
  should still hold, but hasn't been re-run in-browser since the migration.
- **NOT verified**: physical Expo Go device testing (only Expo web preview +
  direct API calls so far, across the whole project).

## Prioritized next steps

1. Re-verify the frontend against the migrated backend in-browser (the API
   contracts didn't change, but worth confirming nothing else did).
2. Test on a physical device via Expo Go.
3. If a real launch is ever discussed: rotate the Firebase service account
   key (a copy was pasted in plaintext in chat earlier this project) and the
   Supabase DB password (also pasted in plaintext while debugging the
   pooler connection this session) — Supabase dashboard → Settings →
   Database → Database password → Reset. Also revisit
   `fact_memory.fact_value` plaintext storage.
4. Real ISL sign-to-text translation (a trained gesture-sequence classifier)
   — the detection/landmark filter is real and working; translation is
   intentionally still a manual "type what you signed" step.
5. Optional: retrain/export the ML risk classifier to ONNX if Python is ever
   worth removing entirely — not attempted, since the user chose to keep it
   in Python rather than take on that conversion risk.

## A note on how this backend was built

Originally built across two passes in a separate Claude (Cowork) session
(initial MVP scaffold, then a revision adding TypeScript/Redis/OAuth/AES-256/
LangChain/XGBoost to match the team's "Technical Approach" slide), then
trimmed for the hackathon timeline (Redis, AES-256, embeddings, fact
auto-extraction cut). Later, in a separate coding session: Firebase auth
added, real MediaPipe gesture detection added then moved client-side to a
WebView filter, and — most recently — the whole Python `ai-service` was
converted to Node.js except the ML risk classifier, by explicit user
request. If continuing work here raises a question that revisits one of
these decisions, it's worth surfacing that explicitly rather than silently
overriding it — most of these were deliberate trade-offs, not defaults.
