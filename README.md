# Nea

SIH 2026 · PSID 198 · Team **Fremen**

Emotionally intelligent AI companion with text, voice, and ISL (Indian Sign Language) input. The AI is a bridge to real human help — never a crisis replacement.

```
Expo app (frontend/)  →  node-api :4000  →  risk-classifier :8000
                              ↓
                     Supabase Postgres
```

| Folder | Role |
|---|---|
| `frontend/` | Expo / React Native app (Expo Go) |
| `backend/node-api/` | Express + TypeScript + Prisma — auth, chat (Groq), STT/TTS, memory |
| `backend/ai-service/` | FastAPI — ML risk classifier only (XGBoost/RF) |

Auth is plain HTTP: register/login/Firebase return `{ user }`. Later calls pass `userId` (no JWT / no Bearer middleware).

---

## Prerequisites

- **Node.js** 20+ (22 LTS recommended)
- **Python** 3.11+ (`python3` on macOS)
- **Supabase** Postgres project (or any Postgres)
- **Groq** API key — https://console.groq.com
- **Expo Go** on your phone (optional, for device testing)
- **Firebase** project + service account JSON (for the app’s Firebase sign-in flow)

---

## 1. Backend setup

```bash
cd backend
npm install
npm run install:all
```

### Environment

One file for both services:

```bash
cp .env.example .env
```

Edit **`backend/.env`**. Minimum required:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Supabase **pooler** URL (port `6543`, `?pgbouncer=true`) — not the IPv6-only direct host |
| `GROQ_API_KEY` | Chat + Whisper STT |
| `INTERNAL_API_KEY` | Shared secret between node-api and ai-service |

Useful defaults already in `.env.example`:

- `NODE_API_PORT=4000`
- `RISK_SERVICE_PORT=8000`
- `AI_SERVICE_URL=http://localhost:8000`
- `TTS_DEFAULT_VOICE=en-IN-NeerjaNeural`

Optional:

- `GOOGLE_OAUTH_CLIENT_ID` — Google Sign-In
- `AWS_S3_*` — voice recording archival
- Firebase: place `backend/node-api/serviceAccountKey.json` (gitignored)

Prisma expects `node-api/.env`. Keep it as a symlink to the root env:

```bash
ln -sfn ../.env node-api/.env
ln -sfn ../.env ai-service/.env
```

### Database

```bash
npm run migrate
```

### Run

```bash
npm start
```

Starts:

- **node-api** on `http://localhost:4000`
- **ai-service** on `http://localhost:8000`

Check:

```bash
curl http://localhost:4000/health
curl http://localhost:8000/health
```

You should see request logs like `api ok POST /api/chat → 200 (…ms)`.

Separate processes if needed:

```bash
npm run dev:node   # API only
npm run dev:risk   # risk classifier only
```

More detail: [`backend/README.md`](backend/README.md) · architecture notes: [`backend/CLAUDE.md`](backend/CLAUDE.md)

---

## 2. Frontend setup

Keep the backend running, then:

```bash
cd frontend
npm install
```

Point the app at your machine:

```js
// frontend/src/api/config.js
export const API_BASE_URL = Platform.select({
  web: 'http://localhost:4000',
  default: 'http://YOUR_LAN_IP:4000', // phone cannot use localhost
});
```

Find your LAN IP: `ipconfig getifaddr en0` (macOS) or `ipconfig` (Windows). Phone and laptop must be on the same Wi‑Fi.

```bash
npm start
# or: npx expo start --go
```

Scan the QR code with **Expo Go**. For browser preview: `npm run web`.

### Auth flow (app)

1. Sign up / sign in via Firebase on the client  
2. App calls `POST /api/auth/firebase` with the Firebase ID token → gets `{ user }`  
3. App stores `user` locally and sends `userId` on chat / sessions / memory calls  

No `Authorization: Bearer` header.

---

## 3. Quick smoke test (API)

```bash
# Register (email/password — no Firebase required)
curl -s http://localhost:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@nea.local","password":"password123","displayName":"Demo"}'

# Copy user.id from the response, then:
USER_ID="<paste-user-id>"

curl -s http://localhost:4000/api/sessions \
  -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$USER_ID\",\"modality\":\"text\"}"

# Copy session.id, then:
SESSION_ID="<paste-session-id>"

curl -s http://localhost:4000/api/chat \
  -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$USER_ID\",\"sessionId\":\"$SESSION_ID\",\"content\":\"Hello Nea\",\"modality\":\"text\"}"
```

Full regression script (needs Firebase + running stack):

```bash
cd backend/node-api && node e2e_test.mjs
```

---

## API surface (frontend → `:4000` only)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{email, password, …}` → `{user}` |
| POST | `/api/auth/login` | → `{user}` |
| POST | `/api/auth/firebase` | `{idToken, …}` → `{user}` |
| POST | `/api/auth/oauth/google` | `{idToken}` → `{user}` (optional) |
| GET | `/api/auth/me?userId=` | Profile |
| POST | `/api/sessions` | `{userId, modality}` |
| POST | `/api/chat` | `{userId, sessionId, content, modality}` |
| POST | `/api/voice/stt` | multipart `audio` |
| POST | `/api/voice/tts` | `{text}` → MP3 |
| GET/POST | `/api/memory/*` | facts, capsules, traits, check-ins |

Always pass `userId` in body or query. Never call `:8000` from the app.

---

## Safety (chat)

1. **Keyword screen** — can trigger crisis-bridge reply alone (Tele-MANAS / iCall)  
2. **LLM self-report** — risk level on normal replies  
3. **ML classifier** (`ai-service`) — advisory; can only raise severity, never lower it  

---

## Common issues

| Problem | Fix |
|---|---|
| `GROQ_API_KEY … missing` | Set `GROQ_API_KEY` in `backend/.env` (not `GROQ_Y`) |
| `python: command not found` | Use `python3` (scripts already do) |
| `serviceAccountKey.json` missing | Add Firebase key under `backend/node-api/`, or use `/api/auth/register` |
| Prisma / DB timeout | Use Supabase **pooler** URL on port **6543** |
| Phone can’t reach API | Set LAN IP in `frontend/src/api/config.js`; same Wi‑Fi |
| Risk service down | Chat still works; ML layer fails open (keyword + LLM remain) |

---

## Repo layout

```text
misc-ps/
├── README.md                 ← you are here
├── frontend/                 Expo app
│   ├── App.js
│   └── src/api/              client, auth, chat, voice, memory
└── backend/
    ├── .env.example          single env template
    ├── .env                  your secrets (gitignored)
    ├── package.json          npm start → both services
    ├── README.md             backend depth + API + MVP cuts
    ├── CLAUDE.md             architecture decisions
    ├── node-api/             Express API
    ├── ai-service/           ML risk classifier
    └── scripts/dev-risk.sh
```

Do not commit `.env` or `serviceAccountKey.json`.
