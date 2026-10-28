import JSZip from "jszip";
import { getAllImageRecords, isDraftImageRef, draftImageId } from "./imageStorage.js";
import { withBase } from "./urls.js";

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

async function fetchPublicAsset(path) {
  try {
    const response = await fetch(withBase(path));
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
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

  for (const path of referencedPaths(parsed)) {
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
