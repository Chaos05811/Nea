import express, { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { uploadAudio } from "../lib/s3";
import { transcribe } from "../services/stt";
import { synthesize } from "../services/tts";
import { logger } from "../lib/logger";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post("/stt", upload.single("audio"), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No audio file provided (field name: 'audio')" });

  // userId is optional here — only used for optional S3 archival, not for auth.
  const userId = typeof req.body.userId === "string" && req.body.userId ? req.body.userId : "anonymous";
  const sessionId = (req.body.sessionId as string) || "unassigned";

  const extension = (file.originalname?.split(".").pop() || "m4a").toLowerCase();
  uploadAudio(userId, sessionId, file.buffer, file.mimetype || "audio/mp4", extension).catch((err) => {
    logger.error("S3 audio archival failed", { userId, sessionId, message: (err as Error).message });
  });

  try {
    const result = await transcribe(file.buffer, file.originalname || "recording.m4a");
    logger.info("STT ok", { userId, sessionId, bytes: file.size, language: result.language });
    res.json(result);
  } catch (err) {
    logger.error("Speech-to-text failed", { userId, sessionId, message: (err as Error).message });
    res.status(502).json({ error: "Speech-to-text is unavailable right now" });
  }
});

const ttsSchema = z.object({
  text: z.string().min(1).max(2000),
  voice: z.string().optional(),
});

router.post("/tts", async (req: Request, res: Response) => {
  const parsed = ttsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  try {
    const audioBuffer = await synthesize(parsed.data.text, parsed.data.voice);
    logger.info("TTS ok", { bytes: audioBuffer.length, voice: parsed.data.voice || "default" });
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (err) {
    logger.error("Text-to-speech failed", { message: (err as Error).message });
    res.status(502).json({ error: "Text-to-speech is unavailable right now" });
  }
});

export default router;
