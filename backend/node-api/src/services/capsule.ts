import prisma from "../lib/prisma";
import { plainCompletion } from "./llm";

// Capsule memory consolidation — ported from ai-service/app/services/capsule.py (Python)
// to Node. The hierarchical memory design (H-MEM-inspired, arXiv:2507.22925): a capsule
// closes when EITHER 7 days have passed since the last capsule (or account creation), OR
// 5 conversations have happened since then, whichever comes first. On close, one LLM call
// over the window's messages produces a capsule summary + 0-3 trait-score deltas.
//
// MVP scope (unchanged from the Python version — see backend/CLAUDE.md "Cut for MVP"):
// fact auto-extraction and capsule embeddings are both cut.

const CAPSULE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CAPSULE_MAX_CONVERSATIONS = 5;
const DEFAULT_DECAY_RATE = 0.02;

const CONSOLIDATION_PROMPT = `Summarize this conversation history and extract structured memory updates.
Respond with ONLY a JSON object, no markdown fences, in exactly this shape:
{{
  "summary": "<one short paragraph, 3-5 sentences: recurring topics, emotional tone/trends, anything important>",
  "trait_deltas": [{{"trait": "<short trait name e.g. openness, optimism, anxiety_tendency>", "delta": <float between -0.2 and 0.2>}}]
}}
Rules: summary is a memory note for yourself (an AI companion), not addressed to the user. trait_deltas
is OPTIONAL (use an empty array if nothing clear stands out) — up to 3, only include what's clearly
supported by the transcript, never invent details.

Transcript:
{transcript}`;

interface TraitDelta {
  trait: string;
  delta: number;
}

interface ConsolidationResult {
  summary: string;
  traitDeltas: TraitDelta[];
}

async function windowStart(userId: string): Promise<Date> {
  const lastCapsule = await prisma.capsule.findFirst({
    where: { userId },
    orderBy: { periodEnd: "desc" },
    select: { periodEnd: true },
  });
  if (lastCapsule) return lastCapsule.periodEnd;

  const firstSession = await prisma.session.findFirst({
    where: { userId },
    orderBy: { startedAt: "asc" },
    select: { startedAt: true },
  });
  return firstSession?.startedAt || new Date();
}

async function sessionsInWindow(userId: string, start: Date) {
  return prisma.session.findMany({
    where: { userId, startedAt: { gte: start } },
    orderBy: { startedAt: "asc" },
    select: { id: true, startedAt: true },
  });
}

async function consolidateLlmPass(sessionIds: string[]): Promise<ConsolidationResult> {
  const fallback: ConsolidationResult = { summary: "No conversations in this period.", traitDeltas: [] };
  if (!sessionIds.length) return fallback;

  const rows = await prisma.message.findMany({
    where: { sessionId: { in: sessionIds } },
    orderBy: { createdAt: "asc" },
    take: 400, // hard cap so one huge week can't blow the context window
    select: { role: true, content: true },
  });
  const transcript = rows.map((r) => `${r.role}: ${r.content}`).join("\n");
  if (!transcript.trim()) return fallback;

  const prompt = CONSOLIDATION_PROMPT.replace("{transcript}", transcript.slice(0, 12000));
  const raw = await plainCompletion(prompt, 0.3, 300);

  try {
    const cleaned = raw.trim().replace(/^```json/, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    const traitDeltas: TraitDelta[] = (parsed.trait_deltas || []).slice(0, 3);
    return {
      summary: (parsed.summary || "").trim() || fallback.summary,
      traitDeltas,
    };
  } catch {
    return { summary: raw.trim() || fallback.summary, traitDeltas: [] };
  }
}

async function applyTraitDeltas(userId: string, traitDeltas: TraitDelta[]): Promise<void> {
  for (const item of traitDeltas) {
    const trait = String(item.trait || "").trim().slice(0, 100);
    const delta = Number(item.delta);
    if (!trait || !Number.isFinite(delta) || delta === 0) continue;

    const existing = await prisma.userTrait.findUnique({
      where: { userId_trait: { userId, trait } },
    });
    if (existing) {
      const newScore = Math.max(-1, Math.min(1, existing.score + delta));
      await prisma.userTrait.update({ where: { id: existing.id }, data: { score: newScore } });
    } else {
      const newScore = Math.max(-1, Math.min(1, delta));
      await prisma.userTrait.create({
        data: { userId, trait, score: newScore, decayRate: DEFAULT_DECAY_RATE },
      });
    }
  }
}

export async function consolidateUser(userId: string) {
  const start = await windowStart(userId);
  const now = new Date();
  const windowSessions = await sessionsInWindow(userId, start);

  const ageTriggered = now.getTime() - start.getTime() >= CAPSULE_MAX_AGE_MS;
  const countTriggered = windowSessions.length >= CAPSULE_MAX_CONVERSATIONS;

  if ((!ageTriggered && !countTriggered) || windowSessions.length === 0) return null;

  const sessionIds = windowSessions.map((s) => s.id);
  const result = await consolidateLlmPass(sessionIds);

  const newCapsule = await prisma.capsule.create({
    data: {
      userId,
      periodStart: start,
      periodEnd: now,
      summary: result.summary,
      conversationCount: windowSessions.length,
      closedReason: ageTriggered ? "7_days" : "5_conversations",
    },
  });
  await applyTraitDeltas(userId, result.traitDeltas);
  return newCapsule;
}

export async function consolidateAllDueUsers() {
  const distinctUsers = await prisma.session.findMany({
    distinct: ["userId"],
    select: { userId: true },
  });
  const created = [];
  for (const { userId } of distinctUsers) {
    const result = await consolidateUser(userId);
    if (result) created.push(result);
  }
  return created;
}

export async function decayTraits(): Promise<number> {
  const traits = await prisma.userTrait.findMany({ select: { id: true, score: true, decayRate: true } });
  let updated = 0;
  for (const t of traits) {
    let newScore = t.score * (1 - t.decayRate);
    if (Math.abs(newScore) < 0.005) newScore = 0;
    if (newScore !== t.score) {
      await prisma.userTrait.update({ where: { id: t.id }, data: { score: newScore } });
      updated++;
    }
  }
  return updated;
}
