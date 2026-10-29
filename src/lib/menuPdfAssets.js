import { fetchFirebaseImage, isFirestoreImageRef } from "./firebaseMenu.js";
import { MENU_THEMES, themePhotoPath } from "./menuThemes.js";
import { publicAssetUrl, withBase } from "./urls.js";

const FONT_FILES = [
  { family: "Playfair Display", weight: 800, file: "playfair-display-latin-800.woff2" },
  { family: "Rozha One", weight: 400, file: "rozha-one-latin-400.woff2" },
  { family: "Yatra One", weight: 400, file: "yatra-one-latin-400.woff2" },
  { family: "Cormorant Garamond", weight: 700, file: "cormorant-garamond-latin-700.woff2" },
  { family: "Lato", weight: 400, file: "lato-latin-400.woff2" },
  { family: "Lato", weight: 700, file: "lato-latin-700.woff2" },
  { family: "Poppins", weight: 400, file: "poppins-latin-400.woff2" },
  { family: "Poppins", weight: 600, file: "poppins-latin-600.woff2" },
];

const cache = new Map();

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(blob);
  });
}

export async function fetchAsDataUrl(url) {
  if (!url) return "";
  if (String(url).startsWith("data:")) return url;
  if (cache.has(url)) return cache.get(url);
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Could not load ${url}`);
  const dataUrl = await blobToDataUrl(await response.blob());
  cache.set(url, dataUrl);
  return dataUrl;
}

function hasDishPhoto(path) {
  if (!path) return false;
  if (isFirestoreImageRef(path)) return true;
  if (String(path).startsWith("data:image/")) return true;
  if (String(path).startsWith("/images/menu/")) return true;
  return false;
}

export async function loadMenuPdfFonts() {
  const fonts = [];
  for (const font of FONT_FILES) {
    const url = withBase(`/fonts/${font.file}`);
    try {
      fonts.push({ ...font, dataUrl: await fetchAsDataUrl(url) });
    } catch {
      /* preview still works with fallbacks */
    }
  }
  return fonts;
}

export async function loadThemePhotos(theme) {
  const names = [...new Set([theme.hero, theme.watermark, ...theme.gallery])];
  const photos = {};
  await Promise.all(
    names.map(async (name) => {
      photos[name] = await fetchAsDataUrl(withBase(themePhotoPath(name)));
    }),
  );
  return photos;
}

export async function loadItemImages(items) {
  const map = new Map();
  const queue = items.filter((item) => hasDishPhoto(item.image));
  let index = 0;

  async function worker() {
    while (index < queue.length) {
      const item = queue[index];
      index += 1;
      try {
        if (isFirestoreImageRef(item.image)) {
          const dataUrl = await fetchFirebaseImage(item.image);
          if (dataUrl) map.set(item.id, dataUrl);
          continue;
        }
        map.set(item.id, await fetchAsDataUrl(publicAssetUrl(item.image)));
      } catch {
        /* category icon is used instead */
      }
    }
  }

  await Promise.all([worker(), worker(), worker(), worker()]);
  return map;
}

export function allThemePhotoNames() {
  return [...new Set(MENU_THEMES.flatMap((theme) => [theme.hero, theme.watermark, ...theme.gallery]))];
}
