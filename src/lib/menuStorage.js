import { DRAFT_STORAGE_KEY } from "./constants.js";
import { cloneJson } from "./ids.js";
import { validateMenu } from "./menuValidation.js";
import { withBase } from "./urls.js";

export function loadDraftRecord() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.menu) return null;
    return parsed;
  } catch {
    return { error: "The saved draft could not be read from this browser." };
  }
}

export function saveDraftRecord(menu, extra = {}) {
  const record = {
    version: 1,
    savedAt: new Date().toISOString(),
    menu: cloneJson(menu),
    ...extra,
  };
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(record));
    return { ok: true, record };
  } catch (error) {
    const quota = error?.name === "QuotaExceededError" || /quota/i.test(String(error?.message));
    return {
      ok: false,
      quota,
      error: quota
        ? "This browser is out of storage space. Keep editing in this session and export the draft."
        : "The draft could not be saved in this browser.",
    };
  }
}

export function clearDraftRecord() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return { ok: true };
  } catch {
    return { ok: false, error: "The local draft could not be cleared." };
  }
}

export function parseImportedJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["The file is not valid JSON."] };
  }
  const result = validateMenu(data);
  if (!result.ok) return { ok: false, errors: result.errors, warnings: result.warnings };
  return { ok: true, menu: data, warnings: result.warnings };
}

export async function persistPublishedMenu(menu) {
  const response = await fetch("/api/save-menu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(menu),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Could not write public/data/menu.json.");
  }
  return payload;
}

export async function fetchPublishedMenu() {
  const response = await fetch(withBase("/data/menu.json"), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load the published menu (${response.status}).`);
  }
  const data = await response.json();
  const result = validateMenu(data);
  if (!result.ok) {
    throw new Error(result.errors[0] || "Published menu.json failed validation.");
  }
  return data;
}

export async function fetchImageSources() {
  try {
    const response = await fetch(withBase("/data/image-sources.json"), { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : data.images || [];
  } catch {
    return [];
  }
}
