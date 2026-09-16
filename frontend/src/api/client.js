import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './config';

// Backend no longer uses JWT/bearer tokens — every request identifies the
// user by passing `userId` explicitly (query param on GET, body field on
// POST/PATCH). We persist just the userId locally instead of a token.
const USER_ID_KEY = 'nea_user_id';

let cachedUserId = null;

export async function getUserId() {
  if (cachedUserId !== null) return cachedUserId;
  cachedUserId = await AsyncStorage.getItem(USER_ID_KEY);
  return cachedUserId;
}

export async function setUserId(userId) {
  cachedUserId = userId;
  await AsyncStorage.setItem(USER_ID_KEY, userId);
}

export async function clearUserId() {
  cachedUserId = null;
  await AsyncStorage.removeItem(USER_ID_KEY);
}

// Thin wrapper around fetch for the node-api. Throws with the server's own
// error message (or a network-failure message) so callers can show it.
// `withUserId: true` (default) attaches the current userId automatically —
// as a query param for GET, merged into the JSON body otherwise.
export async function apiRequest(path, { method = 'GET', body, withUserId = true } = {}) {
  let finalPath = path;
  let finalBody = body;

  if (withUserId) {
    const userId = await getUserId();
    if (userId) {
      if (method === 'GET') {
        const separator = path.includes('?') ? '&' : '?';
        finalPath = `${path}${separator}userId=${encodeURIComponent(userId)}`;
      } else {
        finalBody = { userId, ...(body || {}) };
      }
    }
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${finalPath}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: finalBody ? JSON.stringify(finalBody) : undefined,
    });
  } catch (err) {
    throw new Error(`Can't reach Nea's server at ${API_BASE_URL}. Is the backend running and is API_BASE_URL set correctly in src/api/config.js?`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}
