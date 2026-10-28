import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateMenu } from "../src/lib/menuValidation.js";
import {
  getFeaturedItems,
  getPublicItems,
  searchPublicItems,
} from "../src/lib/menuVisibility.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const menu = JSON.parse(fs.readFileSync(path.join(root, "public", "data", "menu.json"), "utf8"));
const errors = [];

const result = validateMenu(menu);
if (!result.ok) errors.push(...result.errors);

if (menu.items.length < 550) errors.push(`Need 550+ items, found ${menu.items.length}`);

const ids = menu.items.map((item) => item.id);
if (new Set(ids).size !== ids.length) errors.push("Duplicate item ids");

const names = new Map();
for (const item of menu.items) {
  const key = item.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  names.set(key, [...(names.get(key) || []), item.name]);
}
const duplicateNames = [...names.values()].filter((list) => list.length > 1);
if (duplicateNames.length) {
  errors.push(`Duplicate normalized names: ${duplicateNames.map((list) => list.join("/")).join("; ")}`);
}

const categoryIds = new Set(menu.categories.map((category) => category.id));
for (const item of menu.items) {
  if (!categoryIds.has(item.categoryId)) errors.push(`Missing category ${item.categoryId} for ${item.id}`);
  if (!Number.isFinite(item.price) || item.price < 0) errors.push(`Bad price ${item.id}`);
}

const missingFiles = [];
for (const item of menu.items) {
  if (!item.image || item.image.startsWith("http") || item.image.startsWith("blob:")) {
    errors.push(`Unsafe or empty image for ${item.id}: ${item.image}`);
    continue;
  }
  const disk = path.join(root, "public", item.image.replace(/^\//, ""));
  if (!fs.existsSync(disk)) missingFiles.push(item.image);
}
if (missingFiles.length) {
  const unique = [...new Set(missingFiles)];
  errors.push(`Missing local images (${unique.length}): ${unique.slice(0, 12).join(", ")}`);
}

const publicItems = getPublicItems(menu);
if (publicItems.some((item) => !item.isActive)) errors.push("Public list includes inactive items");
const hidden = menu.items.find((item) => !item.isActive);
if (hidden && publicItems.some((item) => item.id === hidden.id)) {
  errors.push("Inactive item leaked into public list");
}
if (hidden && searchPublicItems(menu, hidden.name).some((item) => item.id === hidden.id)) {
  errors.push("Search leaked an inactive item");
}
if (getFeaturedItems(menu).some((item) => !item.isActive)) {
  errors.push("Featured list includes hidden items");
}

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

const photos = menu.items.filter((item) => item.image.startsWith("/images/menu/")).length;
console.log(
  JSON.stringify(
    {
      ok: true,
      items: menu.items.length,
      active: publicItems.length,
      featured: getFeaturedItems(menu).length,
      categories: menu.categories.length,
      photos,
      fallbacks: menu.items.length - photos,
    },
    null,
    2,
  ),
);
