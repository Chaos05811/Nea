import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Public web client config — safe to ship in the app. Real security comes from
// backend-side ID token verification (see backend/node-api/src/lib/firebase.ts),
// not from keeping this value secret. Generated via the Firebase Management API
// for project "neaa-a5632" (see backend/node-api/serviceAccountKey.json, gitignored).
const firebaseConfig = {
  apiKey: 'AIzaSyD7zkwGRFXYEQl2FmkWbOwIu8qDa49kaJg',
  authDomain: 'neaa-a5632.firebaseapp.com',
  projectId: 'neaa-a5632',
  storageBucket: 'neaa-a5632.firebasestorage.app',
  messagingSenderId: '758560764376',
  appId: '1:758560764376:web:6a3b227536320935e402ad',
};

const app = initializeApp(firebaseConfig);

export const firebaseAuth =
  Platform.OS === 'web'
    ? getAuth(app)
    : initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
