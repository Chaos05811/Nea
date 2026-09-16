import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import path from "path";

// Service account key is gitignored — see node-api/serviceAccountKey.json.
// Never commit this file or paste its contents anywhere it could leak.
const serviceAccountPath = path.join(__dirname, "..", "..", "serviceAccountKey.json");

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccountPath),
  });
}

export const firebaseAuth = getAuth();
