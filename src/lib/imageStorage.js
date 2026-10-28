import { ALLOWED_IMAGE_TYPES, IMAGE_DB_NAME, IMAGE_STORE_NAME, MAX_IMAGE_BYTES } from "./constants.js";
import { slugify } from "./ids.js";

let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IMAGE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        db.createObjectStore(IMAGE_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB is unavailable."));
  });
  return dbPromise;
}

export function validateImageFile(file) {
  if (!file) return "Choose an image file.";
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Use a JPEG, PNG, WebP or GIF image.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "Images must be 4 MB or smaller.";
  }
  return null;
}

export function makeUploadFilename(originalName) {
  const base = slugify(originalName.replace(/\.[^.]+$/, "")) || "upload";
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${base}-${stamp}.webp`;
}

export async function fileToBase64(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export async function uploadMenuImage(file) {
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);
  const response = await fetch("/api/upload-menu-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      type: file.type,
      data: await fileToBase64(file),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "The image could not be saved to public/images/menu.");
  }
  if (!payload.path || !payload.path.startsWith("/images/menu/")) {
    throw new Error("Upload did not return a local menu image path.");
  }
  return payload.path;
}

export async function putImageBlob(id, blob, meta = {}) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
    tx.objectStore(IMAGE_STORE_NAME).put({
      id,
      blob,
      type: blob.type || "image/webp",
      createdAt: new Date().toISOString(),
      ...meta,
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getImageRecord(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readonly");
    const request = tx.objectStore(IMAGE_STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllImageRecords() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readonly");
    const request = tx.objectStore(IMAGE_STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteImageRecord(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE_NAME, "readwrite");
    tx.objectStore(IMAGE_STORE_NAME).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

const objectUrls = new Map();

export function objectUrlFor(id, blob) {
  const existing = objectUrls.get(id);
  if (existing) URL.revokeObjectURL(existing);
  const url = URL.createObjectURL(blob);
  objectUrls.set(id, url);
  return url;
}

export function revokeObjectUrl(id) {
  const existing = objectUrls.get(id);
  if (existing) {
    URL.revokeObjectURL(existing);
    objectUrls.delete(id);
  }
}

export function revokeAllObjectUrls() {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}

export function publishedImagePath(filename) {
  return `/images/menu/${filename}`;
}

export function isDraftImageRef(path) {
  return typeof path === "string" && path.startsWith("draft:");
}

export function draftImageId(path) {
  return isDraftImageRef(path) ? path.slice("draft:".length) : null;
}
