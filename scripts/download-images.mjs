/**
 * Development-only Wikimedia Commons image acquisition.
 * One request at a time, 429 backoff, title-relevance filter, licence check.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const menuPath = path.join(root, "public", "data", "menu.json");
const sourcesPath = path.join(root, "public", "data", "image-sources.json");
const cachePath = path.join(root, "scripts", ".image-cache.json");
const outDir = path.join(root, "public", "images", "menu");
const USER_AGENT = "TheMatiCafeMenu/1.0 (vegetarian cafe menu; local development)";
const TIMEOUT_MS = 25000;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_LICENSES = /cc-by|cc0|public domain|pdm|pd-|cc-zero/i;
const REJECT = /\b(chicken|mutton|fish|prawn|shrimp|pork|bacon|sausage|beef|lamb|egg omelette|omelet|river|cliff|landscape|portrait|person|people|map)\b/i;

const SEARCH_FOR = {
  "bread-butter": "buttered toast bread vegetarian",
  poha: "kanda poha flattened rice",
  upma: "rava upma south indian",
  "plain-paratha": "plain paratha indian bread",
  "aloo-paratha": "aloo paratha",
  "paneer-paratha": "paneer paratha",
  "mix-veg-paratha": "vegetable paratha",
  "bread-pakora": "bread pakora",
  "cheese-pakora": "paneer pakora",
  "veg-sandwich": "vegetable sandwich indian",
  "veg-grilled-sandwich": "grilled vegetable sandwich",
  "paneer-sandwich": "paneer sandwich",
  "plain-maggi": "cooked maggi noodles bowl",
  "classic-french-fries": "french fries potato",
  "classic-cheese-pizza": "pizza margherita vegetarian",
  "onion-pizza": "onion vegetarian pizza",
  "paneer-pizza": "paneer pizza",
  "indian-masala-pasta": "masala macaroni pasta indian",
  "red-sauce-pasta": "spaghetti tomato sauce",
  "white-sauce-pasta": "pasta white sauce vegetarian",
  "plain-chowmein": "vegetable hakka noodles",
  "veg-chowmein": "veg chow mein",
  "chilli-paneer-dry": "chilli paneer",
  "chilli-paneer-gravy": "chilli paneer gravy",
  "chilli-potato": "chilli potato",
  "veg-manchurian-dry": "veg manchurian",
  "veg-manchurian-gravy": "veg manchurian gravy",
  tea: "masala chai indian tea",
  "black-tea": "cup of black tea",
  "hot-coffee": "cup of coffee",
  "black-coffee": "black coffee cup",
  "hot-milk": "glass of milk",
  "classic-cold-coffee": "iced coffee",
  "mango-shake": "mango milkshake",
  "chocolate-shake": "chocolate milkshake",
  "pineapple-shake": "pineapple juice",
  "vanilla-ice-cream": "vanilla ice cream scoop",
  "chocolate-ice-cream": "chocolate ice cream scoop",
  "fresh-lemon-water": "nimbu pani lemonade",
  "fresh-lime-soda": "fresh lime soda india",
  "packaged-drinking-water": "bottled drinking water",
  "shahi-paneer": "shahi paneer",
  "kadai-paneer": "kadai paneer",
  "paneer-butter-masala": "paneer butter masala",
  "palak-paneer": "palak paneer",
  "mix-veg": "indian mixed vegetable curry",
  "malai-kofta": "malai kofta",
  "dal-tadka": "dal tadka",
  "dal-fry": "dal fry",
  "dal-makhani": "dal makhani",
  "masala-dosa": "masala dosa",
  "butter-naan": "butter naan",
  "jeera-rice": "jeera rice cumin",
  "chana-masala": "chana masala chole",
};

const REQUIRED_TOKEN = {
  "bread-butter": ["bread", "toast", "butterbrot"],
  poha: ["poha"],
  upma: ["upma"],
  "plain-paratha": ["paratha"],
  "aloo-paratha": ["paratha", "aloo"],
  "paneer-paratha": ["paratha", "paneer"],
  "mix-veg-paratha": ["paratha"],
  "bread-pakora": ["pakora", "pakoda"],
  "cheese-pakora": ["pakora", "pakoda", "paneer"],
  "veg-sandwich": ["sandwich"],
  "veg-grilled-sandwich": ["sandwich"],
  "paneer-sandwich": ["sandwich", "paneer"],
  "plain-maggi": ["maggi", "noodle"],
  "classic-french-fries": ["fries", "frites", "chips"],
  "classic-cheese-pizza": ["pizza", "margherita"],
  "onion-pizza": ["pizza"],
  "paneer-pizza": ["pizza", "paneer"],
  "indian-masala-pasta": ["pasta", "macaroni"],
  "red-sauce-pasta": ["pasta", "spaghetti"],
  "white-sauce-pasta": ["pasta", "alfredo", "spaghetti"],
  "plain-chowmein": ["noodle", "chow", "hakka"],
  "veg-chowmein": ["noodle", "chow", "hakka"],
  "chilli-paneer-dry": ["paneer", "chilli", "chili"],
  "chilli-paneer-gravy": ["paneer", "chilli", "chili"],
  "chilli-potato": ["potato", "aloo"],
  "veg-manchurian-dry": ["manchurian"],
  "veg-manchurian-gravy": ["manchurian"],
  tea: ["chai", "tea"],
  "black-tea": ["tea"],
  "hot-coffee": ["coffee"],
  "black-coffee": ["coffee"],
  "hot-milk": ["milk"],
  "classic-cold-coffee": ["coffee"],
  "mango-shake": ["mango"],
  "chocolate-shake": ["chocolate"],
  "pineapple-shake": ["pineapple"],
  "vanilla-ice-cream": ["ice cream", "icecream", "vanilla"],
  "chocolate-ice-cream": ["ice cream", "icecream", "chocolate"],
  "fresh-lemon-water": ["lemon", "nimbu", "lemonade"],
  "fresh-lime-soda": ["lime", "lemon", "nimbu", "soda"],
  "packaged-drinking-water": ["water", "bottle"],
  "shahi-paneer": ["paneer"],
  "kadai-paneer": ["paneer"],
  "paneer-butter-masala": ["paneer"],
  "palak-paneer": ["paneer", "palak", "saag"],
  "mix-veg": ["vegetable", "curry", "sabzi"],
  "malai-kofta": ["kofta"],
  "dal-tadka": ["dal"],
  "dal-fry": ["dal"],
  "dal-makhani": ["dal"],
  "masala-dosa": ["dosa"],
  "butter-naan": ["naan"],
  "jeera-rice": ["rice"],
  "chana-masala": ["chana", "chole", "chickpea"],
};

const SHARED_FROM = {
  "veg-maggi": "plain-maggi",
  "cheese-maggi": "plain-maggi",
  "paneer-maggi": "plain-maggi",
  "special-maggi": "plain-maggi",
  "peri-peri-fries": "classic-french-fries",
  "cheesy-peri-peri-fries": "classic-french-fries",
  "special-cold-coffee": "classic-cold-coffee",
  "cold-coffee-with-ice-cream": "classic-cold-coffee",
};

fs.mkdirSync(outDir, { recursive: true });
const menu = JSON.parse(fs.readFileSync(menuPath, "utf8"));
const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf8")) : { files: {} };
cache.files = cache.files || {};
const sources = [];
const sharp = (await import("sharp")).default;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: accept },
      signal: controller.signal,
    });
    if (response.status === 429) {
      const wait = Number(response.headers.get("retry-after") || 20) * 1000;
      await sleep(Math.min(Math.max(wait, 15000), 60000));
      throw new Error("HTTP 429");
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function withRetry(task) {
  let lastError;
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      await sleep(error.message.includes("429") ? 20000 : 800 * 2 ** attempt);
    }
  }
  throw lastError;
}

async function searchCommons(term) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", `filetype:bitmap ${term}`);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "12");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|size|extmetadata");
  url.searchParams.set("iiurlwidth", "1280");
  const response = await request(url, "application/json");
  const data = await response.json();
  return Object.values(data?.query?.pages || {});
}

function relevant(itemId, page) {
  const title = String(page.title || "").toLowerCase();
  if (REJECT.test(title)) return false;
  const tokens = REQUIRED_TOKEN[itemId] || [];
  return tokens.some((token) => title.includes(token));
}

function pickPage(itemId, pages) {
  for (const page of pages) {
    if (!relevant(itemId, page)) continue;
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const mime = (info.mime || "").toLowerCase();
    if (mime && !ALLOWED_MIME.has(mime)) continue;
    const license = info.extmetadata?.LicenseShortName?.value || info.extmetadata?.UsageTerms?.value || "";
    if (license && !ALLOWED_LICENSES.test(license) && !/public domain/i.test(license)) continue;
    if (REJECT.test(`${page.title} ${info.extmetadata?.ImageDescription?.value || ""}`)) continue;
    if (info.size && info.size > 15_000_000) continue;
    return { page, info, license, artist: info.extmetadata?.Artist?.value || "" };
  }
  return null;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function saveWebp(id, bytes) {
  const dest = path.join(outDir, `${id}.webp`);
  await sharp(bytes).rotate().resize(960, 720, { fit: "cover" }).webp({ quality: 80 }).toFile(dest);
  return `/images/menu/${id}.webp`;
}

async function downloadOne(itemId) {
  const dest = path.join(outDir, `${itemId}.webp`);
  if (cache.files[itemId]?.ok && fs.existsSync(dest)) {
    sources.push(cache.files[itemId].source);
    return "cached";
  }
  const term = SEARCH_FOR[itemId];
  if (!term) {
    cache.files[itemId] = { ok: false, reason: "not-in-search-map" };
    return "fallback";
  }
  const picked = pickPage(itemId, await withRetry(() => searchCommons(term)));
  if (!picked) {
    cache.files[itemId] = { ok: false, reason: "no-relevant-licensed-file" };
    return "fallback";
  }
  const assetUrl = picked.info.thumburl || picked.info.url;
  const imageResponse = await withRetry(() => request(assetUrl, "image/*,*/*"));
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  const ascii = bytes.subarray(0, 24).toString("utf8");
  if (ascii.includes("<html") || ascii.includes("<!DOCTYPE")) throw new Error("HTML instead of image");
  const localPath = await saveWebp(itemId, bytes);
  const source = {
    localFilename: `${itemId}.webp`,
    localPath,
    itemId,
    originalPage: picked.info.descriptionurl,
    originalAssetUrl: picked.info.url,
    creator: stripHtml(picked.artist) || "Wikimedia Commons contributor",
    licence: stripHtml(picked.license) || "See source page",
    requiredAttribution: Boolean(picked.license && /cc-by/i.test(picked.license)),
    requiresAttribution: Boolean(picked.license && /cc-by/i.test(picked.license)),
    modifications: "Resized and converted to WebP for the local menu.",
    reusedFrom: null,
  };
  cache.files[itemId] = { ok: true, localPath, source };
  sources.push(source);
  await sleep(1200);
  return "downloaded";
}

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const ids = Object.keys(SEARCH_FOR);
const summary = { downloaded: 0, cached: 0, fallback: 0, failed: 0 };
console.log(`Downloading relevant photos for ${ids.length} dishes...`);
for (const id of ids) {
  try {
    const result = await downloadOne(id);
    summary[result] += 1;
    process.stdout.write(result === "downloaded" ? "+" : result === "cached" ? "." : "-");
  } catch (error) {
    summary.failed += 1;
    cache.files[id] = { ok: false, reason: error.message };
    process.stdout.write("x");
    if (String(error.message).includes("429")) await sleep(25000);
  }
}
console.log("");

for (const [targetId, fromId] of Object.entries(SHARED_FROM)) {
  const from = cache.files[fromId];
  const destFile = path.join(outDir, `${fromId}.webp`);
  if (!from?.ok || !fs.existsSync(destFile)) continue;
  fs.copyFileSync(destFile, path.join(outDir, `${targetId}.webp`));
  const source = {
    ...from.source,
    localFilename: `${targetId}.webp`,
    localPath: `/images/menu/${targetId}.webp`,
    itemId: targetId,
    reusedFrom: fromId,
    modifications: `Accurate variation reuse of ${fromId}; local WebP copy.`,
  };
  cache.files[targetId] = { ok: true, localPath: source.localPath, source };
  sources.push(source);
}

let photoItems = 0;
let sharedItems = 0;
for (const item of menu.items) {
  const cached = cache.files[item.id];
  if (cached?.ok) {
    item.image = cached.localPath;
    photoItems += 1;
    if (cached.source?.reusedFrom) sharedItems += 1;
    continue;
  }
  const webp = `/images/fallbacks/${item.categoryId}.webp`;
  const svg = `/images/fallbacks/${item.categoryId}.svg`;
  item.image = fs.existsSync(path.join(root, "public", webp.slice(1))) ? webp : svg;
}

fs.writeFileSync(menuPath, `${JSON.stringify(menu, null, 2)}\n`, "utf8");
fs.writeFileSync(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`, "utf8");
fs.writeFileSync(cachePath, `${JSON.stringify(cache, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      ...summary,
      uniquePhotoFiles: fs.readdirSync(outDir).filter((name) => name.endsWith(".webp")).length,
      itemsWithDishPhotos: photoItems,
      itemsSharingPhotos: sharedItems,
      itemsWithFallbacks: menu.items.length - photoItems,
    },
    null,
    2,
  ),
);
