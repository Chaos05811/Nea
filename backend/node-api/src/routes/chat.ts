import express, { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import * as memory from "../services/memory";
import { buildSystemPrompt, chatCompletion } from "../services/llm";
import { keywordScreen, crisisBridgeReply, CRISIS_RESOURCES } from "../services/risk";
import { classifyRisk } from "../services/riskClassifier";

const router = express.Router();
router.use(requireAuth);

const chatSchema = z.object({
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

// Everything ai-service's /chat route used to do, now in-process. Same three-layer
// safety pipeline, same "deterministic layer wins, ML layer only escalates" guarantee
// — see backend/CLAUDE.md. Only the ML classifier call crosses a network boundary now
// (to the Python risk-classifier service); everything else is local.
async function runChatBrain(userId: string, sessionId: string, message: string): Promise<AiResult> {
  // Layer 1: deterministic keyword screen — the only layer that can trigger the
  // scripted crisis-bridge reply by itself, runs before any model call.
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

  // Layer 2: normal conversation brain, with memory context injected.
  const [user, history, facts, recentCapsules] = await Promise.all([
    memory.getUser(userId),
    memory.getRecentMessages(sessionId),
    memory.getCurrentFacts(userId),
    memory.getRecentCapsules(userId),
  ]);
  const systemPrompt = buildSystemPrompt(user, facts, recentCapsules);
  const result = await chatCompletion(systemPrompt, history, message);

  // Layer 3: ML classifier, advisory only — can only push risk level UP, never down,
  // and never triggers the crisis-bridge reply by itself.
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

// The single endpoint the frontend calls for every message, regardless of mode.
router.post("/", async (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const { sessionId, content, modality } = parsed.data;
  const userId = req.user!.id;

  const session = await prisma.session.findFirst({ where: { id: sessionId, userId } });
  if (!session) return res.status(404).json({ error: "Session not found" });

  // 1. Persist the user's message first — so it's never lost even if the AI call fails.
  const userMessage = await prisma.message.create({
    data: { sessionId, userId, role: "user", content, modality },
  });

  // 2. Run the chat brain.
  let aiResult: AiResult;
  try {
    aiResult = await runChatBrain(userId, sessionId, content);
  } catch (err) {
    console.error("Chat brain failed:", (err as Error).message);
    return res.status(502).json({
      error: "The AI is unavailable right now",
      userMessage,
    });
  }

  // 3. Persist the assistant's reply, tagged with whatever risk level was detected.
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

  // 4. If a risk was detected, log it as its own auditable event.
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
});

export default router;
