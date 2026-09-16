import express, { Request, Response } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { consolidateUser, decayTraits } from "../services/capsule";

const router = express.Router();

function requireUserId(req: Request): string | null {
  if (typeof req.body?.userId === "string" && req.body.userId) return req.body.userId;
  if (typeof req.query.userId === "string" && req.query.userId) return req.query.userId;
  return null;
}

router.post("/consolidate", async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const capsule = await consolidateUser(userId);
  const decayed = await decayTraits();
  res.json({ capsule, traitsDecayed: decayed });
});

router.get("/facts", async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const facts = await prisma.factMemory.findMany({
    where: { userId, validTo: null },
    orderBy: { validFrom: "desc" },
  });
  res.json({ facts });
});

const upsertFactSchema = z.object({
  userId: z.string().uuid(),
  factKey: z.string().min(1).max(100),
  factValue: z.string().min(1).max(2000),
  sourceMessageId: z.string().uuid().optional(),
});

router.post("/facts", async (req: Request, res: Response) => {
  const parsed = upsertFactSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const { userId, factKey, factValue, sourceMessageId } = parsed.data;

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

router.get("/capsules", async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const capsules = await prisma.capsule.findMany({
    where: { userId },
    orderBy: { periodStart: "desc" },
    take: 26,
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      summary: true,
      conversationCount: true,
      closedReason: true,
      createdAt: true,
    },
  });
  res.json({ capsules });
});

router.get("/traits", async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const traits = await prisma.userTrait.findMany({ where: { userId } });
  res.json({ traits });
});

router.get("/risk-events", async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const events = await prisma.riskEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ events });
});

function todayDateOnly(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const checkInSchema = z.object({
  userId: z.string().uuid(),
  mood: z.enum(["good", "okay", "low", "stressed"]),
});

router.post("/checkin", async (req: Request, res: Response) => {
  const parsed = checkInSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const { userId, mood } = parsed.data;
  const day = todayDateOnly();

  const checkIn = await prisma.checkIn.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, mood },
    update: { mood },
  });
  res.json({ checkIn });
});

router.get("/checkin/week", async (req: Request, res: Response) => {
  const userId = requireUserId(req);
  if (!userId) return res.status(400).json({ error: "userId is required" });
  const since = new Date(todayDateOnly());
  since.setUTCDate(since.getUTCDate() - 6);

  const checkIns = await prisma.checkIn.findMany({
    where: { userId, day: { gte: since } },
    orderBy: { day: "asc" },
  });
  res.json({ checkIns });
});

export default router;
