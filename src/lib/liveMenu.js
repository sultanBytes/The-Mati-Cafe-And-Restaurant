const TOKEN_KEY = "tmc.github.publishToken";

export const GITHUB_MENU_REPO = "sultanBytes/The-Mati-Cafe-And-Restaurant";
export const GITHUB_MENU_BRANCH = "main";
export const GITHUB_MENU_PATH = "public/data/menu.json";
export const GITHUB_TOKEN_HELP_URL = "https://github.com/settings/personal-access-tokens/new";

export const LIVE_PUBLISH_NEEDED =
  "This live website cannot write files by itself. Paste a GitHub token once on Dashboard, then Save again. After that, guest phones pick up price changes without rebuilding the site.";

function githubHeaders(token, extra = {}) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function loadPublishToken() {
  try {
    return String(localStorage.getItem(TOKEN_KEY) || "").trim();
  } catch {
    return "";
  }
}

export function savePublishToken(token) {
  const value = String(token || "").trim();
  localStorage.setItem(TOKEN_KEY, value);
  return value;
}

export function clearPublishToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function hasPublishToken() {
  return Boolean(loadPublishToken());
}

export function utf8ToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function menuTimestamp(menu, fallback) {
  const fromRevision = Date.parse(String(menu?.revision || "").replace(/^admin-/, ""));
  if (Number.isFinite(fromRevision)) return fromRevision;
  const fromFallback = Date.parse(fallback || "");
  return Number.isFinite(fromFallback) ? fromFallback : 0;
}

export function isMenuNewer(candidate, baseline, candidateSavedAt) {
  if (!candidate) return false;
  if (!baseline) return true;
  return menuTimestamp(candidate, candidateSavedAt) > menuTimestamp(baseline);
}

function contentsUrl() {
  return `https://api.github.com/repos/${GITHUB_MENU_REPO}/contents/${GITHUB_MENU_PATH}`;
}

function rawUrl() {
  return `https://raw.githubusercontent.com/${GITHUB_MENU_REPO}/${GITHUB_MENU_BRANCH}/${GITHUB_MENU_PATH}?t=${Date.now()}`;
}

async function readGithubError(response) {
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401 || response.status === 403) {
    return payload.message || "This GitHub token cannot write the menu. Use Contents: Read and write on this repository.";
  }
  if (response.status === 409) {
    return "The live menu changed while saving. Try Save once more.";
  }
  if (response.status === 422) {
    return payload.message || "GitHub rejected the menu file. It may be too large.";
  }
  return payload.message || `GitHub could not publish the menu (${response.status}).`;
}

export async function fetchLiveGithubMenu() {
  try {
    const response = await fetch(rawUrl(), { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data || typeof data !== "object" || !Array.isArray(data.items)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function verifyPublishToken(token) {
  const value = String(token || "").trim();
  if (!value) return { ok: false, error: "Paste a GitHub token first." };
  const response = await fetch(`${contentsUrl()}?ref=${GITHUB_MENU_BRANCH}`, {
    headers: githubHeaders(value),
  });
  if (!response.ok) {
    return { ok: false, error: await readGithubError(response) };
  }
  return { ok: true };
}

async function readCurrentFileSha(token) {
  const response = await fetch(`${contentsUrl()}?ref=${GITHUB_MENU_BRANCH}`, {
    headers: githubHeaders(token),
  });
  if (!response.ok) {
    throw new Error(await readGithubError(response));
  }
  const payload = await response.json();
  if (!payload.sha) {
    throw new Error("GitHub did not return the current menu file.");
  }
  return payload.sha;
}

export async function publishMenuToGitHub(menu, token = loadPublishToken()) {
  if (!token) {
    const error = new Error(LIVE_PUBLISH_NEEDED);
    error.code = "LIVE_PUBLISH_NEEDED";
    throw error;
  }

  const body = `${JSON.stringify(menu, null, 2)}\n`;
  const content = utf8ToBase64(body);

  async function put(sha) {
    return fetch(contentsUrl(), {
      method: "PUT",
      headers: githubHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        message: `Publish live menu ${menu.revision || new Date().toISOString()}`,
        content,
        sha,
        branch: GITHUB_MENU_BRANCH,
      }),
    });
  }

  let sha = await readCurrentFileSha(token);
  let response = await put(sha);
  if (response.status === 409) {
    sha = await readCurrentFileSha(token);
    response = await put(sha);
  }
  if (!response.ok) {
    throw new Error(await readGithubError(response));
  }

  return {
    ok: true,
    via: "github",
    revision: menu.revision,
  };
}
