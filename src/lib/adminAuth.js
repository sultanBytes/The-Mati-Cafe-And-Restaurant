import { signInFirebaseStaff, signOutFirebaseStaff, updateFirebaseStaffPassword } from "./firebaseMenu.js";

const USERNAME = "maati";
const DEFAULT_PASSWORD_HASH = "698f009ebe952425662e225de2682bb2dc79709f3efa1a5843c663678781d754";
const HASH_KEY = "tmc.admin.passwordHash.v1";
const SESSION_KEY = "tmc.admin.session.v1";

export const ADMIN_USERNAME = USERNAME;

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function storedHash() {
  try {
    return localStorage.getItem(HASH_KEY) || DEFAULT_PASSWORD_HASH;
  } catch {
    return DEFAULT_PASSWORD_HASH;
  }
}

export function isAdminSignedIn() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function signOutAdmin() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
  signOutFirebaseStaff();
}

export async function signInAdmin(username, password) {
  if (String(username || "").trim().toLowerCase() !== USERNAME) {
    return { ok: false, error: "The ID or password is incorrect." };
  }
  const hash = await sha256Hex(String(password || ""));
  if (hash !== storedHash()) {
    return { ok: false, error: "The ID or password is incorrect." };
  }
  const firebase = await signInFirebaseStaff(password);
  if (!firebase.ok) {
    return firebase;
  }
  try {
    sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    return { ok: false, error: "This browser blocked the sign-in session." };
  }
  return { ok: true };
}

export async function changeAdminPassword(currentPassword, nextPassword) {
  if (!String(nextPassword || "").trim() || String(nextPassword).length < 8) {
    return { ok: false, error: "Use a new password with at least 8 characters." };
  }
  if (String(nextPassword) === String(currentPassword)) {
    return { ok: false, error: "The new password must be different." };
  }
  const currentHash = await sha256Hex(String(currentPassword || ""));
  if (currentHash !== storedHash()) {
    return { ok: false, error: "The current password is incorrect." };
  }
  try {
    localStorage.setItem(HASH_KEY, await sha256Hex(String(nextPassword)));
  } catch {
    return { ok: false, error: "The new password could not be saved on this browser." };
  }
  const firebase = await updateFirebaseStaffPassword(nextPassword);
  if (!firebase.ok) {
    return {
      ok: false,
      error: `Local password updated, but Firebase still uses the old one. ${firebase.error}`,
    };
  }
  return { ok: true };
}
