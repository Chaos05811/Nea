import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { firebaseAuth } from './firebase';
import { apiRequest, setUserId, clearUserId, getUserId } from './client';

const USER_KEY = 'nea_user';

// Sign up: creates the account in Firebase Auth (real signup, real password check),
// then hands the resulting ID token to our backend, which verifies it server-side
// and creates/links a User row — see backend/node-api's POST /api/auth/firebase.
// The backend has no JWT/session layer of its own: every subsequent API call just
// passes this user's id explicitly (see client.js), the same as every other route.
export async function signUp({ email, password, displayName, ageGroup, language }) {
  const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }
  const idToken = await credential.user.getIdToken();
  const { user } = await apiRequest('/api/auth/firebase', {
    method: 'POST',
    withUserId: false,
    body: { idToken, displayName, ageGroup, language },
  });
  await setUserId(user.id);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function signIn({ email, password }) {
  const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
  const idToken = await credential.user.getIdToken();
  const { user } = await apiRequest('/api/auth/firebase', {
    method: 'POST',
    withUserId: false,
    body: { idToken },
  });
  await setUserId(user.id);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function signOut() {
  await firebaseSignOut(firebaseAuth).catch(() => {});
  await clearUserId();
  await AsyncStorage.removeItem(USER_KEY);
}

// Restores a session on app launch: if we already have a stored userId, trust it
// (fast path, no network) and return the cached profile.
export async function restoreSession() {
  const userId = await getUserId();
  if (!userId) return null;
  const cached = await AsyncStorage.getItem(USER_KEY);
  return cached ? JSON.parse(cached) : null;
}

export async function fetchCurrentUser() {
  const { user } = await apiRequest('/api/auth/me');
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export async function updateProfileDetails({ displayName, ageGroup, language }) {
  const { user } = await apiRequest('/api/auth/me', {
    method: 'PATCH',
    body: { displayName, ageGroup, language },
  });
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  // Keep Firebase display name in sync when possible (best-effort).
  if (displayName && firebaseAuth.currentUser) {
    await updateProfile(firebaseAuth.currentUser, { displayName }).catch(() => {});
  }
  return user;
}
