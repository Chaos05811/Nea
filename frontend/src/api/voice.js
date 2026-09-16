import { File, Paths } from 'expo-file-system';
import { API_BASE_URL } from './config';
import { getUserId } from './client';

function audioMetaFromUri(uri) {
  const clean = (uri || '').split('?')[0].toLowerCase();
  if (clean.endsWith('.webm')) return { filename: 'recording.webm', mimeType: 'audio/webm' };
  if (clean.endsWith('.wav') || clean.endsWith('.wave')) return { filename: 'recording.wav', mimeType: 'audio/wav' };
  if (clean.endsWith('.mp3')) return { filename: 'recording.mp3', mimeType: 'audio/mpeg' };
  if (clean.endsWith('.amr') || clean.endsWith('.3gp')) return { filename: 'recording.amr', mimeType: 'audio/amr' };
  if (clean.endsWith('.ogg') || clean.endsWith('.opus')) return { filename: 'recording.ogg', mimeType: 'audio/ogg' };
  return { filename: 'recording.m4a', mimeType: 'audio/m4a' };
}

// Speech -> text.
// Sends JSON + base64 (same transport as TTS). Multipart FormData through the
// Expo Metro proxy often fails on device even when small JSON POSTs work.
export async function transcribeAudio(uri) {
  const userId = await getUserId();
  const meta = audioMetaFromUri(uri);
  const file = new File(uri);
  const audioBase64 = await file.base64();

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/voice/stt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        filename: meta.filename,
        mimeType: meta.mimeType,
        userId: userId || undefined,
      }),
    });
  } catch (err) {
    throw new Error(`Can't reach Nea's server for speech-to-text at ${API_BASE_URL}. ${err?.message || ''}`.trim());
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Speech-to-text failed (${response.status})`);
  }
  return data; // { transcript, language }
}

// Text -> speech. Downloads the synthesized MP3 to a local cache file and
// returns its URI, ready to hand to expo-audio's createAudioPlayer().
export async function synthesizeSpeechToFile(text, voice) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/voice/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice }),
    });
  } catch (err) {
    throw new Error(`Can't reach Nea's server for text-to-speech at ${API_BASE_URL}.`);
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Text-to-speech failed (${response.status})`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const out = new File(Paths.cache, `nea-reply-${Date.now()}.mp3`);
  out.create({ overwrite: true });
  out.write(bytes);
  return out.uri;
}
