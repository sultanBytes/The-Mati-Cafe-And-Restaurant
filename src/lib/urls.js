import { GITHUB_MENU_BRANCH, GITHUB_MENU_REPO } from "./liveMenu.js";

export function withBase(path) {
  if (!path) return path;
  if (/^(https?:|blob:|data:|draft:)/i.test(path)) return path;
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${String(path).replace(/^\//, "")}`;
}

export function isLocalDevHost() {
  if (typeof window === "undefined") return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}

export function githubRawPublicUrl(path) {
  const clean = String(path || "").replace(/^\//, "");
  return `https://raw.githubusercontent.com/${GITHUB_MENU_REPO}/${GITHUB_MENU_BRANCH}/public/${clean}`;
}

export function publicAssetUrl(path) {
  if (!path) return path;
  if (/^(https?:|blob:|data:|draft:)/i.test(path)) return path;
  if (!import.meta.env.DEV && String(path).startsWith("/images/")) {
    return githubRawPublicUrl(path);
  }
  return withBase(path);
}
