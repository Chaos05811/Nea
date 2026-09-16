// Google Cloud Text-to-Speech (REST). Uses GOOGLE_API_KEY from backend/.env.

const VOICE_ALIASES: Record<string, string> = {
  "en-in-female": "en-IN-Wavenet-A",
  "en-in-male": "en-IN-Wavenet-B",
  "hi-in-female": "hi-IN-Wavenet-A",
  "hi-in-male": "hi-IN-Wavenet-B",
  // Keep old edge-tts style names mapping to the closest WaveNet voices.
  "en-IN-NeerjaNeural": "en-IN-Wavenet-A",
  "en-IN-PrabhatNeural": "en-IN-Wavenet-B",
  "hi-IN-SwaraNeural": "hi-IN-Wavenet-A",
  "hi-IN-MadhurNeural": "hi-IN-Wavenet-B",
};

const DEFAULT_VOICE = process.env.TTS_DEFAULT_VOICE || "en-IN-Wavenet-A";

function languageFromVoice(voiceName: string): string {
  const match = /^([a-z]{2}-[A-Z]{2})/.exec(voiceName);
  return match?.[1] || "en-IN";
}

export async function synthesize(text: string, voice?: string | null): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set in backend/.env");
  }

  const resolvedVoice =
    (voice && VOICE_ALIASES[voice]) ||
    (voice && VOICE_ALIASES[voice.toLowerCase()]) ||
    voice ||
    DEFAULT_VOICE;

  const body = {
    input: { text },
    voice: {
      languageCode: languageFromVoice(resolvedVoice),
      name: resolvedVoice,
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: 1.0,
      pitch: 0,
    },
  };

  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    audioContent?: string;
  };

  if (!response.ok || !data.audioContent) {
    throw new Error(data.error?.message || `Google TTS failed (${response.status})`);
  }

  return Buffer.from(data.audioContent, "base64");
}
