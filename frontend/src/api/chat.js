import { apiRequest } from './client';

const MODALITY_BY_MODE = { Text: 'text', Voice: 'voice', ISL: 'isl' };

export function modalityForMode(mode) {
  return MODALITY_BY_MODE[mode] || 'text';
}

export async function createSession(mode) {
  const { session } = await apiRequest('/api/sessions', {
    method: 'POST',
    body: { modality: modalityForMode(mode) },
  });
  return session.id;
}

// Every mode (Text/Voice/Video/ISL) funnels its recognised text into this one
// call — see backend/README.md's API table.
export async function sendChatMessage(sessionId, content, mode) {
  return apiRequest('/api/chat', {
    method: 'POST',
    body: { sessionId, content, modality: modalityForMode(mode) },
  });
}
