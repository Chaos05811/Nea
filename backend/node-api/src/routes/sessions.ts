import express, { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware/auth";

const router = express.Router();
router.use(requireAuth);

const createSchema = z.object({
  modality: z.enum(["text", "voice", "video", "isl"]).default("text"),
  title: z.string().max(200).optional(),
});

// Start a new conversation session (frontend calls this once per "new conversation")
router.post("/", async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const session = await prisma.session.create({
    data: { userId: req.user!.id, modality: parsed.data.modality, title: parsed.data.title },
  });
  res.status(201).json({ session });
});

// List the user's sessions (most recent first)
router.get("/", async (req: Request, res: Response) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.user!.id },
    orderBy: { startedAt: "desc" },
    take: 50,
  });
  res.json({ sessions });
});

// Full message history for one session
router.get("/:id/messages", async (req: Request, res: Response) => {
  const session = await prisma.session.findFirst({
    where: { id: req.params.id as string, userId: req.user!.id },
  });
  if (!session) return res.status(404).json({ error: "Session not found" });

  const messages = await prisma.message.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
  });
  res.json({ session, messages });
});

// End a session (closes it; capsule consolidation picks it up on its own schedule)
router.post("/:id/end", async (req: Request, res: Response) => {
  const session = await prisma.session.findFirst({
    where: { id: req.params.id as string, userId: req.user!.id },
  });
  if (!session) return res.status(404).json({ error: "Session not found" });

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: { endedAt: new Date() },
  });
  res.json({ session: updated });
});

export default router;
