import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const menu = JSON.parse(fs.readFileSync(path.join(root, "public", "data", "menu.json"), "utf8"));
const outDir = path.join(root, "public", "images", "fallbacks");
fs.mkdirSync(outDir, { recursive: true });

const palette = [
  ["#994126", "#f1ede7"],
  ["#b9583b", "#f7f3ed"],
  ["#3d6b4f", "#e7efe8"],
  ["#7a3b2e", "#fdf9f3"],
];

function svgFor(id, name, index) {
  const [ink, paper] = palette[index % palette.length];
  const label = escapeXml(name);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480" role="img" aria-label="${label} illustration">
  <rect width="640" height="480" rx="48" fill="${paper}"/>
  <circle cx="170" cy="160" r="86" fill="${ink}" fill-opacity="0.12"/>
  <circle cx="490" cy="340" r="110" fill="${ink}" fill-opacity="0.1"/>
  <rect x="210" y="150" width="220" height="150" rx="28" fill="${ink}" fill-opacity="0.18"/>
  <circle cx="320" cy="210" r="46" fill="${ink}" fill-opacity="0.35"/>
  <text x="320" y="370" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="${ink}">${label}</text>
  <text x="320" y="404" text-anchor="middle" font-family="system-ui, sans-serif" font-size="14" fill="${ink}" fill-opacity="0.7">Illustrated category fallback</text>
</svg>
`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const categories = menu.categories || [];
for (const [index, category] of categories.entries()) {
  const file = path.join(outDir, `${category.id}.svg`);
  fs.writeFileSync(file, svgFor(category.id, category.name, index), "utf8");
}
fs.writeFileSync(path.join(outDir, "menu.svg"), svgFor("menu", "The Mati Cafe", 0), "utf8");

let webpCount = 0;
try {
  const sharp = (await import("sharp")).default;
  for (const category of categories) {
    const svgPath = path.join(outDir, `${category.id}.svg`);
    await sharp(svgPath).resize(640, 480).webp({ quality: 78 }).toFile(path.join(outDir, `${category.id}.webp`));
    webpCount += 1;
  }
  await sharp(path.join(outDir, "menu.svg")).resize(640, 480).webp({ quality: 78 }).toFile(path.join(outDir, "menu.webp"));
} catch (error) {
  console.warn("WebP fallback conversion skipped:", error.message);
}

console.log(`Wrote ${categories.length + 1} SVG fallbacks and ${webpCount} WebP fallbacks.`);
