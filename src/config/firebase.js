import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// TODO: Replace with your Firebase project configuration
// from the Firebase Console (Project Settings > General)
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSy_PLACEHOLDER_KEY",
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || "your-app.firebaseapp.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || "your-app-id",
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || "your-app.appspot.com",
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.VITE_FIREBASE_APP_ID || "1:123456:web:abcd",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
