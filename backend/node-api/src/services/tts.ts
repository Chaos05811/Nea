import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// Ported from ai-service/app/services/tts.py (Python edge-tts) to Node (msedge-tts) —
// see backend/CLAUDE.md. Same underlying free Microsoft Edge "Read Aloud" service, no
// API key/signup needed either way. Verified against the live service before wiring in.
const VOICE_ALIASES: Record<string, string> = {
  "en-in-female": "en-IN-NeerjaNeural",
  "en-in-male": "en-IN-PrabhatNeural",
  "hi-in-female": "hi-IN-SwaraNeural",
  "hi-in-male": "hi-IN-MadhurNeural",
};

const DEFAULT_VOICE = process.env.TTS_DEFAULT_VOICE || "en-IN-NeerjaNeural";

export async function synthesize(text: string, voice?: string | null): Promise<Buffer> {
  const resolvedVoice = (voice && VOICE_ALIASES[voice.toLowerCase()]) || voice || DEFAULT_VOICE;

  const tts = new MsEdgeTTS();
  await tts.setMetadata(resolvedVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);

  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    audioStream.on("end", () => resolve(Buffer.concat(chunks)));
    audioStream.on("error", reject);
  });
}
