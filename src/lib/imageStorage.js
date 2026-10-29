import { ALLOWED_IMAGE_TYPES, IMAGE_DB_NAME, IMAGE_STORE_NAME, MAX_DATA_IMAGE_CHARS, MAX_IMAGE_BYTES } from "./constants.js";
import { slugify } from "./ids.js";
import { loadPublishToken, publishRepoFile } from "./liveMenu.js";
import { isLocalDevHost } from "./urls.js";

const MAX_IMAGE_EDGE = 1200;
const GITHUB_IMAGE_BYTES = 420 * 1024;
const EMBEDDED_IMAGE_BYTES = 72 * 1024;

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
  const dataUrl = await blobToDataUrl(file);
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(blob);
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function loadImageBitmap(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("The image could not be opened."));
      element.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressMenuImage(file, { maxBytes = GITHUB_IMAGE_BYTES } = {}) {
  const source = await loadImageBitmap(file);
  const width = source.width || source.naturalWidth || 1;
  const height = source.height || source.naturalHeight || 1;
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  source.close?.();

  let type = "image/webp";
  let quality = 0.82;
  let blob = await canvasToBlob(canvas, type, quality);
  if (!blob || blob.size === 0) {
    type = "image/jpeg";
    blob = await canvasToBlob(canvas, type, quality);
  }
  while (blob && blob.size > maxBytes && quality > 0.42) {
    quality -= 0.12;
    blob = await canvasToBlob(canvas, type, quality);
  }
  if (!blob) {
    throw new Error("The photo could not be compressed.");
  }

  const dataUrl = await blobToDataUrl(blob);
  const filename = makeUploadFilename(file.name).replace(/\.webp$/, type === "image/jpeg" ? ".jpg" : ".webp");
  return {
    blob,
    type,
    filename,
    dataUrl,
    base64: dataUrl.slice(dataUrl.indexOf(",") + 1),
  };
}

async function uploadLocalMenuImage(file) {
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

export async function uploadMenuImage(file) {
  const invalid = validateImageFile(file);
  if (invalid) throw new Error(invalid);

  if (isLocalDevHost()) {
    try {
      return await uploadLocalMenuImage(file);
    } catch {
      /* Live GitHub Pages has no local upload API. */
    }
  }

  const token = loadPublishToken();
  const compressed = await compressMenuImage(file, {
    maxBytes: token ? GITHUB_IMAGE_BYTES : EMBEDDED_IMAGE_BYTES,
  });

  if (token) {
    try {
      await publishRepoFile({
        repoPath: `public/images/menu/${compressed.filename}`,
        base64: compressed.base64,
        message: `Add menu photo ${compressed.filename}`,
      });
      return publishedImagePath(compressed.filename);
    } catch (error) {
      if (compressed.dataUrl.length <= MAX_DATA_IMAGE_CHARS) {
        return compressed.dataUrl;
      }
      throw error;
    }
  }

  if (compressed.dataUrl.length <= MAX_DATA_IMAGE_CHARS) {
    return compressed.dataUrl;
  }
  throw new Error("Paste a GitHub token on Dashboard so this photo can publish without a rebuild.");
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
