import fs from "fs";
import path from "path";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

// Service account key is gitignored — place it at node-api/serviceAccountKey.json.
// Never commit this file or paste its contents anywhere it could leak.
const serviceAccountPath = path.join(__dirname, "..", "..", "serviceAccountKey.json");

let app: App | null = null;
let auth: Auth | null = null;
let initError: string | null = null;

function ensureFirebase(): Auth {
  if (auth) return auth;
  if (initError) {
    throw new Error(initError);
  }

  if (!fs.existsSync(serviceAccountPath)) {
    initError =
      "Firebase is not configured — missing node-api/serviceAccountKey.json. " +
      "Download a service account key from the Firebase console and place it there.";
    throw new Error(initError);
  }

  if (getApps().length === 0) {
    app = initializeApp({
      credential: cert(serviceAccountPath),
    });
  } else {
    app = getApps()[0]!;
  }
  auth = getAuth(app);
  return auth;
}

/** Lazy Firebase Auth — only loads the service account when /api/auth/firebase is hit. */
export const firebaseAuth = {
  verifyIdToken(idToken: string) {
    return ensureFirebase().verifyIdToken(idToken);
  },
};
