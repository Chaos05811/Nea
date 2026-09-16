# Nea backend

Express (`node-api`) + FastAPI risk classifier (`ai-service`).

**Full setup for the whole repo (frontend + backend):** see [`../README.md`](../README.md).

## Quick start

```bash
cd backend
npm install
npm run install:all
cp .env.example .env
# edit .env → DATABASE_URL, GROQ_API_KEY, INTERNAL_API_KEY
ln -sfn ../.env node-api/.env
ln -sfn ../.env ai-service/.env
npm run migrate
npm start
```

| Service | URL |
|---|---|
| node-api | http://localhost:4000 |
| ai-service | http://localhost:8000 |

```bash
curl http://localhost:4000/health
curl http://localhost:8000/health
```

## Architecture

```
frontend  →  node-api (:NODE_API_PORT, default 4000)
                ├─ Groq chat + Whisper STT + msedge-tts
                ├─ Prisma / Supabase Postgres
                └─ HTTP → ai-service (:RISK_SERVICE_PORT, default 8000)  # ML risk only
```

- **One env file:** `backend/.env` (see `.env.example`)
- **No JWT:** callers pass `userId` on each request
- **Logs:** every request logs `api ok` / `api fail` with status + latency

## Env (required)

| Variable | Used by |
|---|---|
| `DATABASE_URL` | node-api (prefer Supabase pooler `:6543`) |
| `GROQ_API_KEY` | node-api |
| `INTERNAL_API_KEY` | both (must match) |
| `NODE_API_PORT` | node-api (default `4000`) |
| `RISK_SERVICE_PORT` | ai-service (default `8000`) |
| `AI_SERVICE_URL` | node-api → risk service |

Optional: `GOOGLE_OAUTH_CLIENT_ID`, `AWS_S3_*`, Firebase `node-api/serviceAccountKey.json`.

## Scripts

| Command | What it does |
|---|---|
| `npm run install:all` | node-api deps + Python deps |
| `npm run migrate` | Prisma migrate |
| `npm start` | both services (concurrently) |
| `npm run dev:node` | node-api only |
| `npm run dev:risk` | ai-service only |

## API (all on `:4000`)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | → `{user}` |
| POST | `/api/auth/login` | → `{user}` |
| POST | `/api/auth/firebase` | `{idToken}` → `{user}` |
| POST | `/api/auth/oauth/google` | optional |
| GET | `/api/auth/me?userId=` | |
| POST | `/api/sessions` | `{userId, modality}` |
| GET | `/api/sessions?userId=` | |
| GET | `/api/sessions/:id/messages?userId=` | |
| POST | `/api/chat` | `{userId, sessionId, content, modality}` |
| POST | `/api/voice/stt` | multipart `audio` |
| POST | `/api/voice/tts` | `{text}` → MP3 |
| GET/POST | `/api/memory/*` | facts, capsules, traits, check-ins, consolidate |

Pass `userId` in body or query. No `Authorization` header.

ISL text goes to `POST /api/chat` with `modality: "isl"`.

## Safety layers (chat)

1. Keyword screen — only layer that can force the crisis-bridge reply alone  
2. LLM self-report — risk on normal replies  
3. ML classifier (`ai-service`) — advisory; severity only goes up  

## MVP scope cuts

Redis cache, Kafka, capsule embeddings/pgvector, fact auto-extraction during consolidation, and AES field encryption were cut for the hackathon. See [`CLAUDE.md`](CLAUDE.md) for where to restore each.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Groq key missing | `GROQ_API_KEY` in `backend/.env` |
| DB hang / P1001 | Use pooler URL on port 6543 |
| Firebase 501 | Add `node-api/serviceAccountKey.json` |
| `python` not found | Scripts use `python3` |
| Ports clash | `NODE_API_PORT` vs `RISK_SERVICE_PORT` (not a shared `PORT`) |
