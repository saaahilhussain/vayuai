import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin SDK
let app;
try {
  if (getApps().length === 0) {
    const serviceAccountPath = join(__dirname, "serviceAccountKey.json");

    if (existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));
      app = initializeApp({ credential: cert(serviceAccount) });
      console.log("🔥 Firebase Admin SDK initialized (serviceAccountKey.json)");
    } else {
      app = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        }),
      });
      console.log("🔥 Firebase Admin SDK initialized (env vars)");
    }
  } else {
    app = getApp();
  }
} catch (error) {
  console.error("Firebase Admin SDK initialization error:", error.message);
}

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
