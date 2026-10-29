import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { cloneJson } from "../src/lib/ids.js";
import { formatItemPrice, parseTableParam } from "../src/lib/format.js";
import { isSafeImagePath, validateMenu } from "../src/lib/menuValidation.js";
import {
  getFeaturedItems,
  getPublicItems,
  searchPublicItems,
} from "../src/lib/menuVisibility.js";


const menu = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "data", "menu.json"), "utf8"),
);

test("catalogue has 550+ unique items", () => {
  assert.ok(menu.items.length >= 550);
  assert.equal(new Set(menu.items.map((item) => item.id)).size, menu.items.length);
});

test("schema validates", () => {
  const result = validateMenu(menu);
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("public visibility excludes inactive items and categories", () => {
  const published = getPublicItems(menu);
  assert.ok(published.every((item) => item.isActive));
  const hidden = menu.items.find((item) => !item.isActive);
  assert.ok(hidden);
  assert.equal(published.some((item) => item.id === hidden.id), false);
  assert.equal(searchPublicItems(menu, hidden.name).some((item) => item.id === hidden.id), false);
  assert.ok(getFeaturedItems(menu).every((item) => item.isActive));
});

test("inactive category hides its items without changing item.isActive", () => {
  const draft = cloneJson(menu);
  const category = draft.categories[0];
  const before = draft.items.find((item) => item.categoryId === category.id && item.isActive);
  if (!before) return;
  category.isActive = false;
  const publicItems = getPublicItems(draft);
  assert.equal(publicItems.some((item) => item.id === before.id), false);
  const still = draft.items.find((item) => item.id === before.id);
  assert.equal(still.isActive, true);
});

test("table parameter validation", () => {
  assert.equal(parseTableParam("04"), "04");
  assert.equal(parseTableParam("table 12"), null);
  assert.equal(parseTableParam("<script>"), null);
  assert.equal(parseTableParam(""), null);
});

test("variant price display uses From", () => {
  const item = menu.items.find((entry) => entry.variants?.length > 1 && entry.variants.some((variant) => variant.price !== entry.price));
  if (!item) return;
  assert.match(formatItemPrice(item), /^From /);
});

test("import rejects invalid data without mutating the original", () => {
  const original = cloneJson(menu);
  const invalid = { schemaVersion: 99, restaurant: {}, categories: [], items: [] };
  const result = validateMenu(invalid);
  assert.equal(result.ok, false);
  assert.equal(menu.items.length, original.items.length);
});

test("delete cancellation preserves data in cloned drafts", () => {
  const draft = cloneJson(menu);
  const id = draft.items[0].id;
  const cancelled = cloneJson(draft);
  assert.equal(cancelled.items.some((item) => item.id === id), true);
  draft.items = draft.items.filter((item) => item.id !== id);
  assert.equal(draft.items.some((item) => item.id === id), false);
  assert.equal(cancelled.items.some((item) => item.id === id), true);
});

test("uploaded menu image paths with timestamps are safe", () => {
  assert.equal(isSafeImagePath("/images/menu/screenshot-20261028-230812.webp"), true);
  assert.equal(isSafeImagePath("/images/menu/bread-butter-20261028-230812-1.webp"), true);
  assert.equal(isSafeImagePath("draft:screenshot-2026-04-12-162645-mvseckuc.webp"), false);
  assert.equal(isSafeImagePath("data:image/webp;base64,UklGRg=="), true);
  assert.equal(isSafeImagePath("data:text/plain;base64,AAAA"), false);
});

test("json round trip preserves hindi text", () => {
  const text = `${JSON.stringify(menu, null, 2)}\n`;
  const round = JSON.parse(text);
  const hindi = menu.items.find((item) => item.nameHi);
  assert.ok(hindi);
  assert.equal(round.items.find((item) => item.id === hindi.id).nameHi, hindi.nameHi);
});
