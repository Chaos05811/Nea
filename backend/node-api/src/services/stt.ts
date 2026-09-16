// Google Cloud Speech-to-Text (REST). Uses GOOGLE_API_KEY from backend/.env.
// Accepts phone-friendly formats we record as: wav (LINEAR16), webm (opus),
// amr, mp3. m4a/mp4 is best-effort (not officially supported by sync recognize).

export interface TranscribeResult {
  transcript: string;
  language: string | null;
}

function encodingFor(filename: string): { encoding?: string; sampleRateHertz?: number } {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  switch (ext) {
    case "wav":
    case "wave":
    case "lpcm":
      return { encoding: "LINEAR16", sampleRateHertz: 16000 };
    case "webm":
      return { encoding: "WEBM_OPUS" };
    case "ogg":
    case "opus":
      return { encoding: "OGG_OPUS" };
    case "mp3":
    case "mpeg":
      return { encoding: "MP3", sampleRateHertz: 16000 };
    case "amr":
      return { encoding: "AMR_WB", sampleRateHertz: 16000 };
    case "3gp":
      return { encoding: "AMR", sampleRateHertz: 8000 };
    case "flac":
      return { encoding: "FLAC" };
    // AAC-in-MP4 is not a first-class sync encoding; try MP3 decode path as last resort.
    case "m4a":
    case "mp4":
    case "aac":
      return { encoding: "MP3", sampleRateHertz: 44100 };
    default:
      return { encoding: "LINEAR16", sampleRateHertz: 16000 };
  }
}

export async function transcribe(audioBuffer: Buffer, filename: string): Promise<TranscribeResult> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set in backend/.env");
  }

  const format = encodingFor(filename);
  const languageCode = process.env.GOOGLE_STT_LANGUAGE || "en-IN";

  const config: Record<string, unknown> = {
    languageCode,
    enableAutomaticPunctuation: true,
    model: "latest_short",
  };
  // Only add Hindi as an alternate when explicitly configured for bilingual.
  if ((process.env.GOOGLE_STT_ALTERNATES || "").trim()) {
    config.alternativeLanguageCodes = process.env.GOOGLE_STT_ALTERNATES.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (format.encoding) config.encoding = format.encoding;
  if (format.sampleRateHertz) config.sampleRateHertz = format.sampleRateHertz;

  const body = {
    config,
    audio: { content: audioBuffer.toString("base64") },
  };

  const url = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    results?: Array<{
      alternatives?: Array<{ transcript?: string }>;
      languageCode?: string;
    }>;
  };

  if (!response.ok) {
    throw new Error(data.error?.message || `Google STT failed (${response.status})`);
  }

  const transcript = (data.results || [])
    .map((r) => r.alternatives?.[0]?.transcript || "")
    .filter(Boolean)
    .join(" ")
    .trim();

  const language = data.results?.[0]?.languageCode || languageCode;

  return { transcript, language };
}
