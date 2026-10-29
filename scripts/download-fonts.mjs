import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dest = path.join(root, "public", "fonts");
fs.mkdirSync(dest, { recursive: true });

const copies = [
  ["node_modules/@fontsource/playfair-display/files/playfair-display-latin-600-normal.woff2", "playfair-display-latin-600.woff2"],
  ["node_modules/@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2", "playfair-display-latin-700.woff2"],
  ["node_modules/@fontsource/playfair-display/files/playfair-display-latin-800-normal.woff2", "playfair-display-latin-800.woff2"],
  ["node_modules/@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2", "dm-sans-latin-400.woff2"],
  ["node_modules/@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2", "dm-sans-latin-500.woff2"],
  ["node_modules/@fontsource/dm-sans/files/dm-sans-latin-600-normal.woff2", "dm-sans-latin-600.woff2"],
  ["node_modules/@fontsource/rozha-one/files/rozha-one-latin-400-normal.woff2", "rozha-one-latin-400.woff2"],
  ["node_modules/@fontsource/yatra-one/files/yatra-one-latin-400-normal.woff2", "yatra-one-latin-400.woff2"],
  ["node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff2", "cormorant-garamond-latin-700.woff2"],
  ["node_modules/@fontsource/lato/files/lato-latin-400-normal.woff2", "lato-latin-400.woff2"],
  ["node_modules/@fontsource/lato/files/lato-latin-700-normal.woff2", "lato-latin-700.woff2"],
  ["node_modules/@fontsource/poppins/files/poppins-latin-400-normal.woff2", "poppins-latin-400.woff2"],
  ["node_modules/@fontsource/poppins/files/poppins-latin-600-normal.woff2", "poppins-latin-600.woff2"],
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
