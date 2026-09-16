import express, { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { uploadAudio } from "../lib/s3";
import { transcribe } from "../services/stt";
import { synthesize } from "../services/tts";
import { logger } from "../lib/logger";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const sttJsonSchema = z.object({
  audioBase64: z.string().min(1),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
});

async function runStt(
  res: Response,
  opts: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
    userId: string;
    sessionId: string;
  }
) {
  const { buffer, filename, mimeType, userId, sessionId } = opts;
  const extension = (filename.split(".").pop() || "wav").toLowerCase();

  uploadAudio(userId, sessionId, buffer, mimeType, extension).catch((err) => {
    logger.error("S3 audio archival failed", { userId, sessionId, message: (err as Error).message });
  });

  try {
    const result = await transcribe(buffer, filename);
    logger.info("STT ok", { userId, sessionId, bytes: buffer.length, language: result.language });
    res.json(result);
  } catch (err) {
    logger.error("Speech-to-text failed", { userId, sessionId, message: (err as Error).message });
    res.status(502).json({ error: (err as Error).message || "Speech-to-text is unavailable right now" });
  }
}

// Preferred by Expo Go: JSON + base64 (multipart often fails through the Metro proxy).
router.post("/stt", upload.single("audio"), async (req: Request, res: Response) => {
  if (req.file) {
    const userId = typeof req.body.userId === "string" && req.body.userId ? req.body.userId : "anonymous";
    const sessionId = (req.body.sessionId as string) || "unassigned";
    return runStt(res, {
      buffer: req.file.buffer,
      filename: req.file.originalname || "recording.wav",
      mimeType: req.file.mimetype || "audio/wav",
      userId,
      sessionId,
    });
  }

  // JSON body path (Content-Type: application/json)
  const parsed = sttJsonSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "No audio provided. Send multipart 'audio' or JSON { audioBase64, filename }" });
  }

  const filename = parsed.data.filename || "recording.wav";
  const mimeType = parsed.data.mimeType || "audio/wav";
  const userId = parsed.data.userId || "anonymous";
  const sessionId = parsed.data.sessionId || "unassigned";
  const buffer = Buffer.from(parsed.data.audioBase64, "base64");
  if (!buffer.length) {
    return res.status(400).json({ error: "audioBase64 decoded to empty buffer" });
  }

  return runStt(res, { buffer, filename, mimeType, userId, sessionId });
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
    res.status(502).json({ error: (err as Error).message || "Text-to-speech is unavailable right now" });
  }
});

export default router;
