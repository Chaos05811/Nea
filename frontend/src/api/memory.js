import { apiRequest } from './client';

export async function submitCheckIn(mood) {
  const { checkIn } = await apiRequest('/api/memory/checkin', { method: 'POST', body: { mood } });
  return checkIn;
}

export async function fetchWeekCheckIns() {
  const { checkIns } = await apiRequest('/api/memory/checkin/week');
  return checkIns;
}

export async function fetchCapsules() {
  const { capsules } = await apiRequest('/api/memory/capsules');
  return capsules;
}

export async function fetchTraits() {
  const { traits } = await apiRequest('/api/memory/traits');
  return traits;
}

export async function fetchSessions() {
  const { sessions } = await apiRequest('/api/sessions');
  return sessions;
}

export async function fetchSessionMessages(sessionId) {
  const { session, messages } = await apiRequest(`/api/sessions/${sessionId}/messages`);
  return { session, messages };
}
