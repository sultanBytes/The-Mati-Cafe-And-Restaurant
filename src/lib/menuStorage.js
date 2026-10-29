import { DRAFT_STORAGE_KEY } from "./constants.js";
import { cloneJson } from "./ids.js";
import {
  LIVE_PUBLISH_NEEDED,
  fetchLiveGithubMenu,
  isMenuNewer,
  loadPublishToken,
  publishMenuToGitHub,
} from "./liveMenu.js";
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

function shouldTryLocalSave() {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

async function tryLocalSave(menu) {
  if (!shouldTryLocalSave()) return { ok: false };
  try {
    const response = await fetch("/api/save-menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(menu),
    });
    const isJson = (response.headers.get("content-type") || "").includes("application/json");
    if (response.ok && isJson) {
      const payload = await response.json().catch(() => ({}));
      return { ok: true, payload: { via: "local", ...payload } };
    }
    if (isJson) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || "Could not write public/data/menu.json.");
    }
    return { ok: false };
  } catch (error) {
    if (error instanceof TypeError) return { ok: false };
    throw error;
  }
}

export async function persistPublishedMenu(menu) {
  menu.revision = `admin-${new Date().toISOString()}`;

  const local = await tryLocalSave(menu);
  if (local.ok && local.payload?.revision) {
    menu.revision = local.payload.revision;
  }

  const token = loadPublishToken();
  let github = null;
  if (token) {
    try {
      github = await publishMenuToGitHub(menu, token);
    } catch (error) {
      if (!local.ok) throw error;
      return {
        ok: true,
        ...local.payload,
        via: "local",
        revision: menu.revision,
        warning: error.message,
      };
    }
  }

  if (local.ok && github) {
    return { ok: true, via: "local+github", revision: menu.revision };
  }
  if (local.ok) {
    return { ok: true, via: "local", revision: menu.revision, ...local.payload };
  }
  if (github) {
    return { ok: true, via: "github", revision: menu.revision };
  }

  const error = new Error(LIVE_PUBLISH_NEEDED);
  error.code = "LIVE_PUBLISH_NEEDED";
  throw error;
}

async function fetchBundledMenu() {
  const response = await fetch(withBase("/data/menu.json"), { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Could not load the published menu (${response.status}).`);
  }
  return response.json();
}

export async function fetchPublishedMenu() {
  const bundledPromise = fetchBundledMenu().catch(() => null);
  const livePromise = import.meta.env.DEV ? Promise.resolve(null) : fetchLiveGithubMenu();
  const [bundled, live] = await Promise.all([bundledPromise, livePromise]);

  let data = bundled;
  if (!import.meta.env.DEV && live && (!bundled || isMenuNewer(live, bundled))) {
    data = live;
  }
  if (!data) {
    throw new Error("Could not load the published menu.");
  }
  const result = validateMenu(data);
  if (!result.ok) {
    if (bundled && bundled !== data && validateMenu(bundled).ok) return bundled;
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
