import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MENU_DIR = path.join(ROOT, "public", "images", "menu");
const MENU_JSON = path.join(ROOT, "public", "data", "menu.json");

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function timestampName(originalName) {
  const base = slugify(String(originalName).replace(/\.[^.]+$/, "")) || "upload";
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  let filename = `${base}-${stamp}.webp`;
  let extra = 1;
  while (fs.existsSync(path.join(MENU_DIR, filename))) {
    filename = `${base}-${stamp}-${extra}.webp`;
    extra += 1;
  }
  return filename;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(body);
}

async function handleUpload(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, { error: "Use POST to upload an image." });
    return;
  }

  try {
    const raw = await readBody(req);
    const payload = JSON.parse(raw.toString("utf8"));
    const type = String(payload.type || "");
    if (!ALLOWED.has(type)) {
      send(res, 400, { error: "Use a JPEG, PNG, WebP or GIF image." });
      return;
    }
    const buffer = Buffer.from(String(payload.data || ""), "base64");
    if (!buffer.length) {
      send(res, 400, { error: "The image file was empty." });
      return;
    }
    if (buffer.length > MAX_BYTES) {
      send(res, 400, { error: "Images must be 4 MB or smaller." });
      return;
    }

    fs.mkdirSync(MENU_DIR, { recursive: true });
    const filename = timestampName(payload.filename || "upload");
    const dest = path.join(MENU_DIR, filename);

    const sharp = (await import("sharp")).default;
    await sharp(buffer).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toFile(dest);

    send(res, 200, { path: `/images/menu/${filename}`, filename });
  } catch (error) {
    send(res, 500, { error: error.message || "The image could not be saved." });
  }
}

async function handleSaveMenu(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, { error: "Use POST to save the menu." });
    return;
  }

  try {
    const raw = await readBody(req);
    const menu = JSON.parse(raw.toString("utf8"));
    const { validateMenu } = await import("../src/lib/menuValidation.js");
    const result = validateMenu(menu);
    if (!result.ok) {
      send(res, 400, { error: result.errors[0] || "The menu failed validation.", errors: result.errors });
      return;
    }

    menu.revision = `admin-${new Date().toISOString()}`;
    fs.mkdirSync(path.dirname(MENU_JSON), { recursive: true });
    fs.writeFileSync(MENU_JSON, `${JSON.stringify(menu, null, 2)}\n`, "utf8");
    send(res, 200, { ok: true, path: "/data/menu.json", revision: menu.revision });
  } catch (error) {
    send(res, 500, { error: error.message || "menu.json could not be saved." });
  }
}

function attachAdminRoutes(server) {
  server.middlewares.use("/api/upload-menu-image", (req, res) => {
    handleUpload(req, res);
  });
  server.middlewares.use("/api/save-menu", (req, res) => {
    handleSaveMenu(req, res);
  });
}

export function menuImageUploadPlugin() {
  return {
    name: "tmc-menu-image-upload",
    configureServer(server) {
      attachAdminRoutes(server);
    },
    configurePreviewServer(server) {
      attachAdminRoutes(server);
    },
  };
}
