import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import convert from "heic-convert";
import sharp from "sharp";

const execFileAsync = promisify(execFile);
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "scripts", "source-images");
const destDir = path.join(root, "public", "menu-themes");

const MAP = [
  ["IMG_1560.HEIC", "corner-ludo.jpg"],
  ["IMG_1561.HEIC", "lamps-neon.jpg"],
  ["IMG_1562.HEIC", "niche-mandana.jpg"],
  ["IMG_1563.HEIC", "mud-wall.jpg"],
  ["IMG_1564.HEIC", "entrance.jpg"],
  ["IMG_1565.HEIC", "ring-light.jpg"],
  ["IMG_1567.HEIC", "flower-corridor.jpg"],
  ["IMG_1569.HEIC", "painted-sign.jpg"],
];

async function heicToJpegBuffer(inputPath) {
  const input = fs.readFileSync(inputPath);
  const output = await convert({
    buffer: input,
    format: "JPEG",
    quality: 0.9,
  });
  return Buffer.from(output);
}

async function magickToJpeg(inputPath, destPath) {
  await execFileAsync("magick", [
    inputPath,
    "-auto-orient",
    "-resize",
    "1600x1600>",
    "-quality",
    "75",
    destPath,
  ]);
}

async function writeOptimized(buffer, destPath) {
  await sharp(buffer)
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 75, mozjpeg: true })
    .toFile(destPath);
}

async function convertOne(fromName, toName) {
  const inputPath = path.join(sourceDir, fromName);
  const destPath = path.join(destDir, toName);
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing ${fromName} in scripts/source-images.`);
  }
  try {
    const jpeg = await heicToJpegBuffer(inputPath);
    await writeOptimized(jpeg, destPath);
    return "heic-convert";
  } catch (error) {
    console.warn(`${fromName}: heic-convert failed (${error.message}). Trying ImageMagick.`);
    await magickToJpeg(inputPath, destPath);
    return "imagemagick";
  }
}

fs.mkdirSync(destDir, { recursive: true });

for (const extra of ["IMG_1566.HEIC", "IMG_1568.HEIC"]) {
  const extraPath = path.join(sourceDir, extra);
  if (fs.existsSync(extraPath)) fs.unlinkSync(extraPath);
}

for (const [fromName, toName] of MAP) {
  const via = await convertOne(fromName, toName);
  const info = await sharp(path.join(destDir, toName)).metadata();
  console.log(`${toName}  ${info.width}x${info.height}  via ${via}`);
}
