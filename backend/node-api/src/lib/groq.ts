import Groq from "groq-sdk";

// Single Groq client for both chat completions and Whisper STT — same API key,
// same OpenAI-compatible endpoint style. Ported from ai-service/app/services/llm.py
// and stt.py (Python/LangChain) — see backend/CLAUDE.md for why this moved to Node.
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export default groq;

export const GROQ_CHAT_MODEL = process.env.GROQ_CHAT_MODEL || "openai/gpt-oss-120b";
export const GROQ_STT_MODEL = process.env.GROQ_STT_MODEL || "whisper-large-v3";
