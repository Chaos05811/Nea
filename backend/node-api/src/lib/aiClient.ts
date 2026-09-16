import axios from "axios";

// HTTP client for the internal ai-service (Python/FastAPI) — now ONLY the ML risk
// classifier (see src/services/riskClassifier.ts). Chat/TTS/STT/memory all moved to
// Node — see backend/CLAUDE.md. Not exposed to the frontend directly — every call
// here is made by node-api on the user's behalf, after auth has already passed.
const aiClient = axios.create({
  baseURL: process.env.AI_SERVICE_URL || "http://localhost:8000",
  timeout: 30_000,
  headers: {
    "X-Internal-Key": process.env.INTERNAL_API_KEY || "",
  },
});

export default aiClient;
