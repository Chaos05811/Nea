import express, { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";

const router = express.Router();

const userIdSchema = z.string().uuid();

const createSchema = z.object({
  userId: userIdSchema,
  modality: z.enum(["text", "voice", "video", "isl"]).default("text"),
  title: z.string().max(200).optional(),
});

function parseUserId(raw: unknown): string | null {
  const parsed = userIdSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

router.post("/", async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const session = await prisma.session.create({
    data: {
      userId: parsed.data.userId,
      modality: parsed.data.modality,
      title: parsed.data.title,
    },
  });
  res.status(201).json({ session });
});

router.get("/", async (req: Request, res: Response) => {
  const userId = parseUserId(req.query.userId);
  if (!userId) {
    return res.status(400).json({ error: "userId query param (uuid) is required" });
  }
  const sessions = await prisma.session.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  res.json({ sessions });
});

router.get("/:id/messages", async (req: Request, res: Response) => {
  const userId = parseUserId(req.query.userId);
  if (!userId) {
    return res.status(400).json({ error: "userId query param (uuid) is required" });
  }
  const session = await prisma.session.findFirst({
    where: { id: req.params.id as string, userId },
  });
  if (!session) return res.status(404).json({ error: "Session not found" });

  const messages = await prisma.message.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
  });
  res.json({ session, messages });
});

router.post("/:id/end", async (req: Request, res: Response) => {
  const userId = parseUserId(req.body?.userId ?? req.query.userId);
  if (!userId) {
    return res.status(400).json({ error: "userId (uuid) is required" });
  }
  const session = await prisma.session.findFirst({
    where: { id: req.params.id as string, userId },
  });
  if (!session) return res.status(404).json({ error: "Session not found" });

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { endedAt: new Date() },
  });
  res.json({ session: updated });
});

export default router;
