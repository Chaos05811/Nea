import express, { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import * as memory from "../services/memory";
import { buildSystemPrompt, chatCompletion } from "../services/llm";
import { keywordScreen, crisisBridgeReply, CRISIS_RESOURCES } from "../services/risk";
import { classifyRisk } from "../services/riskClassifier";
import { logger } from "../lib/logger";

const router = express.Router();

const chatSchema = z.object({
  userId: z.string().uuid(),
  sessionId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  modality: z.enum(["text", "voice", "video", "isl"]).default("text"),
});

const RISK_LEVELS_NEEDING_RESOURCES = new Set(["medium", "high", "critical"]);
const SEVERITY_ORDER = ["none", "low", "medium", "high", "critical"];
function severity(level: string): number {
  const idx = SEVERITY_ORDER.indexOf(level);
  return idx === -1 ? 0 : idx;
}

interface AiResult {
  reply: string;
  riskLevel: string;
  riskSignal: string;
  resources: typeof CRISIS_RESOURCES | null;
  humanHandoffOffered: boolean;
  brain: string;
}

async function runChatBrain(userId: string, sessionId: string, message: string): Promise<AiResult> {
  const matchedPhrase = keywordScreen(message);
  if (matchedPhrase) {
    const user = await memory.getUser(userId);
    return {
      reply: crisisBridgeReply(user?.displayName),
      riskLevel: "critical",
      riskSignal: `keyword match: ${matchedPhrase}`,
      resources: CRISIS_RESOURCES,
      humanHandoffOffered: true,
      brain: "safety",
    };
  }

  const [user, history, facts, recentCapsules] = await Promise.all([
    memory.getUser(userId),
    memory.getRecentMessages(sessionId),
    memory.getCurrentFacts(userId),
    memory.getRecentCapsules(userId),
  ]);
  const systemPrompt = buildSystemPrompt(user, facts, recentCapsules);
  const result = await chatCompletion(systemPrompt, history, message);

  const mlResult = await classifyRisk(message);
  let finalRiskLevel = result.riskLevel;
  let riskSignal = result.riskSignal;
  if (mlResult.available) {
    if (mlResult.level === "critical" && severity(finalRiskLevel) < severity("medium")) {
      finalRiskLevel = "medium";
      riskSignal = riskSignal || `ml classifier flagged critical (confidence ${mlResult.confidence.toFixed(2)})`;
    } else if (mlResult.level === "medium" && severity(finalRiskLevel) < severity("low")) {
      finalRiskLevel = "low";
      riskSignal = riskSignal || `ml classifier flagged medium (confidence ${mlResult.confidence.toFixed(2)})`;
    }
  }

  return {
    reply: result.reply,
    riskLevel: finalRiskLevel,
    riskSignal,
    resources: RISK_LEVELS_NEEDING_RESOURCES.has(finalRiskLevel) ? CRISIS_RESOURCES : null,
    humanHandoffOffered: finalRiskLevel === "high" || finalRiskLevel === "critical",
    brain: "conversation",
  };
}

router.post("/", async (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const { userId, sessionId, content, modality } = parsed.data;

  const session = await prisma.session.findFirst({ where: { id: sessionId, userId } });
  if (!session) return res.status(404).json({ error: "Session not found" });

  const userMessage = await prisma.message.create({
    data: { sessionId, userId, role: "user", content, modality },
  });

  let aiResult: AiResult;
  try {
    aiResult = await runChatBrain(userId, sessionId, content);
  } catch (err) {
    logger.error("Chat brain failed", {
      userId,
      sessionId,
      message: (err as Error).message,
    });
    return res.status(502).json({
      error: "The AI is unavailable right now",
      userMessage,
    });
  }

  const assistantMessage = await prisma.message.create({
    data: {
      sessionId,
      userId,
      role: "assistant",
      content: aiResult.reply,
      modality: "text",
      riskLevel: aiResult.riskLevel as any,
      brain: aiResult.brain,
    },
  });

  if (aiResult.riskLevel && aiResult.riskLevel !== "none") {
    await prisma.riskEvent.create({
      data: {
        userId,
        messageId: userMessage.id,
        riskLevel: aiResult.riskLevel as any,
        signal: aiResult.riskSignal || "unspecified",
        resourcesOffered: aiResult.resources ?? undefined,
        humanHandoffOffered: Boolean(aiResult.humanHandoffOffered),
      },
    });
  }

  res.json({
    userMessage,
    assistantMessage,
    riskLevel: aiResult.riskLevel || "none",
    resources: aiResult.resources || null,
  });
  logger.info("Chat turn ok", {
    userId,
    sessionId,
    modality,
    riskLevel: aiResult.riskLevel || "none",
    brain: aiResult.brain,
  });
});

export default router;
