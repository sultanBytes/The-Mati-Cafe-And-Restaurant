import JSZip from "jszip";
import { getAllImageRecords, isDraftImageRef, draftImageId } from "./imageStorage.js";
import { fetchFirebaseImage, isFirestoreImageRef } from "./firebaseMenu.js";
import { isDataImageUrl } from "./menuValidation.js";
import { publicAssetUrl, withBase } from "./urls.js";

function referencedPaths(menu) {
  return [...new Set((menu.items || []).map((item) => item.image).filter(Boolean))];
}

export function menuToJson(menu) {
  const exported = structuredClone(menu);
  exported.revision = `export-${new Date().toISOString().slice(0, 10)}`;
  for (const item of exported.items || []) {
    if (isDraftImageRef(item.image)) {
      const id = draftImageId(item.image);
      item.image = `/images/menu/${id}`;
    }
  }
  return `${JSON.stringify(exported, null, 2)}\n`;
}

export function downloadTextFile(filename, text, type = "application/json") {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const header = dataUrl.slice(0, comma);
  const mime = /data:(.*?);/i.exec(header)?.[1] || "image/webp";
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mime });
}

async function fetchPublicAsset(path) {
  if (isDataImageUrl(path)) {
    return dataUrlToBlob(path);
  }
  if (isFirestoreImageRef(path)) {
    const dataUrl = await fetchFirebaseImage(path);
    return dataUrl ? dataUrlToBlob(dataUrl) : null;
  }
  for (const url of [publicAssetUrl(path), withBase(path)]) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.blob();
    } catch {
      /* try the next source */
    }
  }
  return null;
}

export async function buildPublicationZip(menu, imageSources = []) {
  const zip = new JSZip();
  const json = menuToJson(menu);
  zip.file("data/menu.json", json);
  if (imageSources?.length) {
    zip.file("data/image-sources.json", `${JSON.stringify(imageSources, null, 2)}\n`);
  }

  const parsed = JSON.parse(json);
  const records = await getAllImageRecords();
  const recordMap = new Map(records.map((record) => [record.id, record]));
  const missing = [];

  let embedded = 0;
  for (const path of referencedPaths(parsed)) {
    if (isDataImageUrl(path)) {
      embedded += 1;
      const extension = path.includes("image/jpeg") || path.includes("image/jpg") ? "jpg" : "webp";
      zip.file(`images/menu/embedded-${embedded}.${extension}`, dataUrlToBlob(path));
      continue;
    }
    const relative = path.replace(/^\//, "");
    const filename = path.split("/").pop();
    const uploaded = recordMap.get(filename) || recordMap.get(path);
    if (uploaded?.blob) {
      zip.file(relative, uploaded.blob);
      continue;
    }
    const blob = await fetchPublicAsset(path);
    if (blob) {
      zip.file(relative, blob);
    } else {
      missing.push(path);
    }
  }

  const bytes = await zip.generateAsync({ type: "blob" });
  return { blob: bytes, missing, json };
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
