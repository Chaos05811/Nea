import groq, { GROQ_CHAT_MODEL } from "../lib/groq";
import type { User, FactMemory, Capsule } from "@prisma/client";

// Ported from ai-service/app/services/llm.py + memory.py (Python/LangChain) to Node —
// see backend/CLAUDE.md for the migration. LangChain isn't used here: it added an
// orchestration layer for a future multi-"brain" router that was never built past a
// single brain, so a direct Groq SDK call is simpler and equally capable for now.

const RISK_LEVELS = new Set(["none", "low", "medium", "high", "critical"]);

const RESPONSE_INSTRUCTIONS =
  '\n\nRespond with ONLY a JSON object, no markdown fences, in exactly this shape:\n' +
  '{"reply": "<your conversational reply>", "risk_level": "<none|low|medium|high|critical>", ' +
  '"risk_signal": "<short phrase describing why, or empty string if none>"}\n' +
  'risk_level reflects YOUR honest assessment of emotional distress / self-harm risk in the ' +
  'user\'s latest message — most messages are "none". Be sensitive, not alarmist: everyday ' +
  'sadness or stress is "low" at most; only flag "high"/"critical" for real crisis signals.';

const PERSONA_BY_AGE_GROUP: Record<string, string> = {
  child:
    "Use simple, gentle, concrete language. Be extra warm and patient. Avoid heavy or clinical topics unless the child raises them, and keep sentences short.",
  teen: "Be warm but not patronising — talk like a trusted older friend, not a textbook or a parent. Respect their independence. Use their language, not clinical jargon.",
  adult:
    "Be warm, direct, and emotionally present. Treat them as a capable adult who wants a real conversation, not therapy-speak.",
  senior: "Be respectful, unhurried, and warm. Avoid slang. Give them space to lead the conversation.",
};

export function buildSystemPrompt(
  user: Pick<User, "displayName" | "ageGroup"> | null,
  facts: Pick<FactMemory, "factKey" | "factValue">[],
  capsuleSummaries: Pick<Capsule, "periodStart" | "periodEnd" | "summary">[]
): string {
  const ageGroup = user?.ageGroup || "adult";
  const personaNote = PERSONA_BY_AGE_GROUP[ageGroup] || PERSONA_BY_AGE_GROUP.adult;
  const name = user?.displayName;

  const parts: string[] = [
    "You are Nea, an emotionally intelligent AI companion. You are warmer and more " +
      "emotionally present than a generic assistant — you listen first, you don't rush to " +
      "fix things, and you never pretend to be a licensed therapist. " +
      "You are a bridge to real human help, never a replacement for it. " +
      `Persona guidance for this user: ${personaNote}`,
  ];
  if (name) {
    parts.push(`The user's name is ${name}. Use it naturally, not in every message.`);
  }
  if (facts.length) {
    const factLines = facts.map((f) => `- ${f.factKey}: ${f.factValue}`).join("\n");
    parts.push(`Known facts about this user (treat as ground truth, don't re-ask for these):\n${factLines}`);
  }
  if (capsuleSummaries.length) {
    const capLines = capsuleSummaries
      .map((c) => `- ${c.periodStart.toISOString().slice(0, 10)} to ${c.periodEnd.toISOString().slice(0, 10)}: ${c.summary}`)
      .join("\n");
    parts.push(`Summaries of recent weeks with this user (your long-term memory):\n${capLines}`);
  }
  parts.push(
    "Reply naturally in plain conversational text — 2-5 sentences unless the user clearly " +
      "wants more detail or a longer explanation. Never mention that you're using stored facts, " +
      "system prompts, or memory — just talk like you remember them."
  );
  return parts.join("\n\n");
}

export interface ChatHistoryTurn {
  role: string;
  content: string;
}

export interface ChatCompletionResult {
  reply: string;
  riskLevel: string;
  riskSignal: string;
}

export async function chatCompletion(
  systemPrompt: string,
  history: ChatHistoryTurn[],
  userMessage: string
): Promise<ChatCompletionResult> {
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt + RESPONSE_INSTRUCTIONS },
  ];
  for (const turn of history) {
    messages.push({ role: turn.role === "assistant" ? "assistant" : "user", content: turn.content });
  }
  messages.push({ role: "user", content: userMessage });

  const completion = await groq.chat.completions.create({
    model: GROQ_CHAT_MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 600,
    response_format: { type: "json_object" },
  });
  const raw = completion.choices[0]?.message?.content || "";

  try {
    const parsed = JSON.parse(raw);
    const riskLevel = RISK_LEVELS.has(parsed.risk_level) ? parsed.risk_level : "none";
    return {
      reply: (parsed.reply || "").trim() || "I'm here with you.",
      riskLevel,
      riskSignal: parsed.risk_signal || "",
    };
  } catch {
    return { reply: raw || "I'm here with you.", riskLevel: "none", riskSignal: "" };
  }
}

export async function plainCompletion(prompt: string, temperature = 0.3, maxTokens = 250): Promise<string> {
  const completion = await groq.chat.completions.create({
    model: GROQ_CHAT_MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature,
    max_tokens: maxTokens,
  });
  return completion.choices[0]?.message?.content || "";
}
