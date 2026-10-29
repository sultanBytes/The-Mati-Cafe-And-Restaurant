import { signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  FIREBASE_STAFF_EMAIL,
  firebaseAuth,
  firebaseDb,
  firebaseStorage,
  isFirebaseConfigured,
} from "./firebase.js";

export const FIRESTORE_MENU_PATH = ["tmc", "liveMenu"];

function requireAuth() {
  const user = firebaseAuth?.currentUser;
  if (!user) {
    throw new Error("Sign in again so the live menu can be saved to Firebase.");
  }
  return user;
}

function toFirestoreMenu(menu) {
  return JSON.parse(JSON.stringify(menu));
}

export async function signInFirebaseStaff(password) {
  if (!isFirebaseConfigured() || !firebaseAuth) {
    return { ok: true, skipped: true };
  }
  try {
    await signInWithEmailAndPassword(firebaseAuth, FIREBASE_STAFF_EMAIL, password);
    return { ok: true };
  } catch (error) {
    const code = error?.code || "";
    if (code === "auth/user-not-found" || code === "auth/invalid-credential" || code === "auth/wrong-password") {
      return {
        ok: false,
        error: `Firebase login failed. Add user ${FIREBASE_STAFF_EMAIL} in Authentication → Users with this staff password.`,
      };
    }
    if (code === "auth/unauthorized-domain") {
      return {
        ok: false,
        error: "Add sultanbytes.github.io in Firebase Authentication → Settings → Authorized domains.",
      };
    }
    return { ok: false, error: error.message || "Firebase sign-in failed." };
  }
}

export async function signOutFirebaseStaff() {
  if (!firebaseAuth?.currentUser) return;
  try {
    await signOut(firebaseAuth);
  } catch {
    /* ignore */
  }
}

export async function updateFirebaseStaffPassword(nextPassword) {
  if (!firebaseAuth?.currentUser) return { ok: true, skipped: true };
  try {
    await updatePassword(firebaseAuth.currentUser, nextPassword);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message || "The Firebase password could not be updated." };
  }
}

export async function fetchFirebaseMenu() {
  if (!isFirebaseConfigured() || !firebaseDb) return null;
  try {
    const snapshot = await getDoc(doc(firebaseDb, ...FIRESTORE_MENU_PATH));
    if (!snapshot.exists()) return null;
    const data = snapshot.data();
    if (!data || typeof data !== "object" || !Array.isArray(data.items)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function persistFirebaseMenu(menu) {
  if (!isFirebaseConfigured() || !firebaseDb) {
    return { ok: false, skipped: true };
  }
  requireAuth();
  const payload = toFirestoreMenu(menu);
  await setDoc(doc(firebaseDb, ...FIRESTORE_MENU_PATH), payload);
  return { ok: true, via: "firebase", revision: menu.revision };
}

export async function uploadFirebaseImage(file, filename) {
  if (!isFirebaseConfigured() || !firebaseStorage) {
    return { ok: false, skipped: true };
  }
  requireAuth();
  const storageRef = ref(firebaseStorage, `menu/${filename}`);
  await uploadBytes(storageRef, file, { contentType: file.type || "image/webp" });
  const url = await getDownloadURL(storageRef);
  return { ok: true, url };
}
