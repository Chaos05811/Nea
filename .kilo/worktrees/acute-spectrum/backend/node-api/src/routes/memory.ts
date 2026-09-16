import express, { Request, Response } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { consolidateUser, decayTraits } from "../services/capsule";

const router = express.Router();
router.use(requireAuth);

// Manually runs capsule consolidation (+ trait decay) for the calling user only.
// Also runs automatically every night for all users (see server.ts's node-cron job) —
// this exists so you can demo/force it without waiting 7 days or 5 conversations.
router.post("/consolidate", async (req: Request, res: Response) => {
  const capsule = await consolidateUser(req.user!.id);
  const decayed = await decayTraits();
  res.json({ capsule, traitsDecayed: decayed });
});

// Currently-valid facts (validTo IS NULL) — what the assistant "knows" about the user right now.
// MVP scope: fact_value is stored in plaintext. Field-level AES-256-GCM encryption was cut for
// the hackathon timeline — see README's "Cut for MVP" section for how to add it back.
router.get("/facts", async (req: Request, res: Response) => {
  const facts = await prisma.factMemory.findMany({
    where: { userId: req.user!.id, validTo: null },
    orderBy: { validFrom: "desc" },
  });
  res.json({ facts });
});

const upsertFactSchema = z.object({
  factKey: z.string().min(1).max(100),
  factValue: z.string().min(1).max(2000),
  sourceMessageId: z.string().uuid().optional(),
});

// Create/update a fact. Versioned, per the memory design: the previous value for this
// fact_key (if any) is closed with validTo=now rather than overwritten, so the fact log
// stays a permanent, auditable history — never a silent overwrite.
router.post("/facts", async (req: Request, res: Response) => {
  const parsed = upsertFactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const { factKey, factValue, sourceMessageId } = parsed.data;
  const userId = req.user!.id;

  const now = new Date();
  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.factMemory.updateMany({
      where: { userId, factKey, validTo: null },
      data: { validTo: now },
    });
    return tx.factMemory.create({
      data: {
        userId,
        factKey,
        factValue,
        sourceMessageId,
        validFrom: now,
      },
    });
  });

  res.status(201).json({ fact: created });
});

// Weekly/5-conversation capsule summaries — powers the mood/insight dashboard.
router.get("/capsules", async (req: Request, res: Response) => {
  const capsules = await prisma.capsule.findMany({
    where: { userId: req.user!.id },
    orderBy: { periodStart: "desc" },
    take: 26, // ~6 months of weekly capsules
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      summary: true,
      conversationCount: true,
      closedReason: true,
      createdAt: true,
      // embedding intentionally excluded — large and not needed client-side
    },
  });
  res.json({ capsules });
});

router.get("/traits", async (req: Request, res: Response) => {
  const traits = await prisma.userTrait.findMany({ where: { userId: req.user!.id } });
  res.json({ traits });
});

// A user's own risk-event history (for transparency / the "why did you suggest this" ask).
router.get("/risk-events", async (req: Request, res: Response) => {
  const events = await prisma.riskEvent.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ events });
});

// ---------------------------------------------------------------------------
// Daily mood check-in — real, user-entered data backing the dashboard (no mock state).
// ---------------------------------------------------------------------------

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const checkInSchema = z.object({
  mood: z.enum(["good", "okay", "low", "stressed"]),
});

// Upsert today's check-in (calling this again the same day overwrites today's mood).
router.post("/checkin", async (req: Request, res: Response) => {
  const parsed = checkInSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const userId = req.user!.id;
  const day = todayDateOnly();

  const checkIn = await prisma.checkIn.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, mood: parsed.data.mood },
    update: { mood: parsed.data.mood },
  });
  res.json({ checkIn });
});

// Last 7 calendar days of check-ins (oldest first) — powers the dashboard's weekly pattern.
router.get("/checkin/week", async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const since = new Date(todayDateOnly());
  since.setUTCDate(since.getUTCDate() - 6);

  const checkIns = await prisma.checkIn.findMany({
    where: { userId, day: { gte: since } },
    orderBy: { day: "asc" },
  });
  res.json({ checkIns });
});

export default router;
