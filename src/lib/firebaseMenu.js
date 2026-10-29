import { onAuthStateChanged, signInWithEmailAndPassword, signOut, updatePassword } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { FIREBASE_STAFF_EMAIL, firebaseAuth, firebaseDb, isFirebaseConfigured } from "./firebase.js";

export const FIRESTORE_MENU_PATH = ["tmc", "liveMenu"];
export const FIRESTORE_IMAGE_PREFIX = "fbimg:";

const imageCache = new Map();

export function waitForFirebaseAuth(timeoutMs = 8000) {
  if (!firebaseAuth) return Promise.resolve(null);
  if (firebaseAuth.currentUser) return Promise.resolve(firebaseAuth.currentUser);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsub();
      resolve(firebaseAuth.currentUser);
    }, timeoutMs);
    const unsub = onAuthStateChanged(firebaseAuth, (user) => {
      clearTimeout(timer);
      unsub();
      resolve(user);
    });
  });
}

async function requireAuth() {
  const user = await waitForFirebaseAuth();
  if (!user) {
    throw new Error("Sign in again so the live menu can be saved to Firebase.");
  }
  return user;
}

function toFirestoreMenu(menu) {
  return JSON.parse(JSON.stringify(menu));
}

export function isFirestoreImageRef(value) {
  return typeof value === "string" && value.startsWith(FIRESTORE_IMAGE_PREFIX);
}

export function firestoreImageId(value) {
  return isFirestoreImageRef(value) ? value.slice(FIRESTORE_IMAGE_PREFIX.length) : null;
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

export function subscribeFirebaseMenu(onMenu, onError) {
  if (!isFirebaseConfigured() || !firebaseDb) return () => {};
  return onSnapshot(
    doc(firebaseDb, ...FIRESTORE_MENU_PATH),
    (snapshot) => {
      if (!snapshot.exists()) {
        onMenu(null);
        return;
      }
      const data = snapshot.data();
      if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
        onMenu(null);
        return;
      }
      onMenu(data);
    },
    (error) => onError?.(error),
  );
}

export async function persistFirebaseMenu(menu) {
  if (!isFirebaseConfigured() || !firebaseDb) {
    return { ok: false, skipped: true };
  }
  await requireAuth();
  const payload = toFirestoreMenu(menu);
  await setDoc(doc(firebaseDb, ...FIRESTORE_MENU_PATH), payload);
  return { ok: true, via: "firebase", revision: menu.revision };
}

export async function saveFirebaseImageDataUrl(filename, dataUrl) {
  if (!isFirebaseConfigured() || !firebaseDb) {
    return { ok: false, skipped: true };
  }
  await requireAuth();
  const id = String(filename || "photo")
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9._-]/g, "-")
    .slice(0, 80) || "photo";
  await setDoc(doc(firebaseDb, "tmcImages", id), {
    dataUrl,
    filename,
    updatedAt: new Date().toISOString(),
  });
  imageCache.set(id, dataUrl);
  return { ok: true, ref: `${FIRESTORE_IMAGE_PREFIX}${id}` };
}

export async function fetchFirebaseImage(refValue) {
  const id = firestoreImageId(refValue);
  if (!id || !firebaseDb) return null;
  if (imageCache.has(id)) return imageCache.get(id);
  try {
    const snapshot = await getDoc(doc(firebaseDb, "tmcImages", id));
    const dataUrl = snapshot.exists() ? snapshot.data()?.dataUrl : null;
    if (dataUrl) imageCache.set(id, dataUrl);
    return dataUrl || null;
  } catch {
    return null;
  }
}
