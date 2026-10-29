import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC3BXSTesF1I0ru_pUNqZWiNXWRF487lpk",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "the-maati-cafe.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "the-maati-cafe",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "the-maati-cafe.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "303270616378",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:303270616378:web:3cde66f0ee03b3bf680403",
};

export const FIREBASE_STAFF_EMAIL = import.meta.env.VITE_FIREBASE_STAFF_EMAIL || "maati@themaaticafe.com";

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

const app = isFirebaseConfigured() ? initializeApp(firebaseConfig) : null;

export const firebaseApp = app;
export const firebaseAuth = app ? getAuth(app) : null;
export const firebaseDb = app ? getFirestore(app) : null;
