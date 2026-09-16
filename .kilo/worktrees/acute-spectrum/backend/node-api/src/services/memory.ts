import prisma from "../lib/prisma";

// Context-injection reads for the chat brain — ported from ai-service/app/services/memory.py.
// Three tiers: live/session context (recent messages), fact memory (permanent, versioned),
// capsule memory (long-term weekly/5-conversation summaries). See buildSystemPrompt in llm.ts.

const RECENT_MESSAGE_LIMIT = 12;
const RECENT_FACT_LIMIT = 20;
const RECENT_CAPSULE_LIMIT = 3;

export async function getUser(userId: string) {
  return prisma.user.findUnique({ where: { id: userId } });
}

export async function getRecentMessages(sessionId: string, limit = RECENT_MESSAGE_LIMIT) {
  const rows = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { role: true, content: true, createdAt: true },
  });
  return rows.reverse(); // chronological order
}

export async function getCurrentFacts(userId: string, limit = RECENT_FACT_LIMIT) {
  return prisma.factMemory.findMany({
    where: { userId, validTo: null },
    orderBy: { validFrom: "desc" },
    take: limit,
    select: { factKey: true, factValue: true },
  });
}

export async function getRecentCapsules(userId: string, limit = RECENT_CAPSULE_LIMIT) {
  return prisma.capsule.findMany({
    where: { userId },
    orderBy: { periodStart: "desc" },
    take: limit,
    select: { periodStart: true, periodEnd: true, summary: true },
  });
}
