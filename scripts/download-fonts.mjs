import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, "public", "fonts");
fs.mkdirSync(dest, { recursive: true });

const copies = [
  ["node_modules/@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff2", "playfair-display-latin-600.woff2"],
  ["node_modules/@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2", "playfair-display-latin-700.woff2"],
  ["node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2", "dm-sans-latin-400.woff2"],
  ["node_modules/@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2", "dm-sans-latin-500.woff2"],
  ["node_modules/@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff2", "dm-sans-latin-600.woff2"],
];

for (const [from, to] of copies) {
  const source = path.join(root, from);
  if (!fs.existsSync(source)) {
    console.warn(`Missing ${from}`);
    continue;
  }
  fs.copyFileSync(source, path.join(dest, to));
  console.log(`copied ${to}`);
}
