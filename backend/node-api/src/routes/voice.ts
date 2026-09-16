import express, { Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { uploadAudio } from "../lib/s3";
import { requireAuth } from "../middleware/auth";
import { transcribe } from "../services/stt";
import { synthesize } from "../services/tts";

const router = express.Router();
router.use(requireAuth);

// Keep audio in memory — MVP clips are short (a few seconds), no need to touch disk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Speech -> text. Accepts whatever format the phone recorded (m4a/mp4/webm/wav) —
// Groq's Whisper endpoint takes these directly, no client-side conversion needed.
router.post("/stt", upload.single("audio"), async (req: Request, res: Response) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No audio file provided (field name: 'audio')" });

  const sessionId = (req.body.sessionId as string) || "unassigned";

  // Best-effort archival to S3 — no-op unless AWS_S3_BUCKET is configured (see lib/s3.ts).
  const extension = (file.originalname?.split(".").pop() || "m4a").toLowerCase();
  uploadAudio(req.user!.id, sessionId, file.buffer, file.mimetype || "audio/mp4", extension).catch(() => {});

  try {
    const result = await transcribe(file.buffer, file.originalname || "recording.m4a");
    res.json(result);
  } catch (err) {
    console.error("Speech-to-text failed:", (err as Error).message);
    res.status(502).json({ error: "Speech-to-text is unavailable right now" });
  }
});

const ttsSchema = z.object({
  text: z.string().min(1).max(2000),
  voice: z.string().optional(), // e.g. "en-IN-NeerjaNeural" — see src/services/tts.ts
});

// Text -> speech. Returns the synthesized audio (mp3) straight to the client.
router.post("/tts", async (req: Request, res: Response) => {
  const parsed = ttsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  try {
    const audioBuffer = await synthesize(parsed.data.text, parsed.data.voice);
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (err) {
    console.error("Text-to-speech failed:", (err as Error).message);
    res.status(502).json({ error: "Text-to-speech is unavailable right now" });
  }
});

export default router;
