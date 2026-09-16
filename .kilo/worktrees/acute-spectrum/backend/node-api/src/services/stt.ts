import groq, { GROQ_STT_MODEL } from "../lib/groq";
import { toFile } from "groq-sdk";

// Ported from ai-service/app/services/stt.py (Python) to Node — see backend/CLAUDE.md.
// Groq's Whisper endpoint accepts common phone-recorded formats directly (m4a, mp4,
// webm, wav, mp3...) up to 25MB — no ffmpeg/PCM conversion needed.
export interface TranscribeResult {
  transcript: string;
  language: string | null;
}

export async function transcribe(audioBuffer: Buffer, filename: string): Promise<TranscribeResult> {
  const transcription = await groq.audio.transcriptions.create({
    file: await toFile(audioBuffer, filename),
    model: GROQ_STT_MODEL,
    response_format: "verbose_json",
  });
  return {
    transcript: transcription.text,
    language: (transcription as unknown as { language?: string }).language || null,
  };
}
