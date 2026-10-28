import { SCHEMA_VERSION, SPICE_LEVELS } from "./constants.js";

const MAX_TEXT = 240;
const MAX_DESC = 600;
const SAFE_IMAGE = /^\/images\/[A-Za-z0-9._/-]+$/;

export function isSafeImagePath(value) {
  if (!value) return true;
  if (typeof value !== "string") return false;
  if (value.startsWith("blob:") || value.startsWith("http://") || value.startsWith("https://")) {
    return false;
  }
  if (value.includes("..") || value.includes("\\")) return false;
  return SAFE_IMAGE.test(value);
}

function push(errors, condition, message) {
  if (condition) errors.push(message);
}

export function validateMenu(data) {
  const errors = [];
  const warnings = [];
  if (!data || typeof data !== "object") {
    return { ok: false, errors: ["Menu data must be an object."], warnings };
  }
  push(errors, data.schemaVersion !== SCHEMA_VERSION, `Unsupported schemaVersion. Expected ${SCHEMA_VERSION}.`);
  push(errors, !data.restaurant || typeof data.restaurant !== "object", "restaurant object is required.");
  push(errors, !Array.isArray(data.categories), "categories must be an array.");
  push(errors, !Array.isArray(data.items), "items must be an array.");
  if (errors.length) return { ok: false, errors, warnings };

  const restaurant = data.restaurant;
  for (const field of ["name", "currency"]) {
    push(errors, !String(restaurant[field] || "").trim(), `restaurant.${field} is required.`);
  }
  for (const field of ["name", "description", "address", "phone", "openingHours", "footerText"]) {
    const value = restaurant[field] ?? "";
    push(errors, String(value).length > MAX_DESC, `restaurant.${field} is too long.`);
  }
  if (restaurant.wifi && typeof restaurant.wifi === "object") {
    push(errors, typeof restaurant.wifi.enabled !== "boolean", "restaurant.wifi.enabled must be boolean.");
  }

  const categoryIds = new Set();
  for (const category of data.categories) {
    if (!category || typeof category !== "object") {
      errors.push("A category is not an object.");
      continue;
    }
    push(errors, !category.id, "Every category needs an id.");
    push(errors, categoryIds.has(category.id), `Duplicate category id: ${category.id}`);
    categoryIds.add(category.id);
    push(errors, !String(category.name || "").trim(), `Category ${category.id} needs a name.`);
    push(errors, String(category.name || "").length > MAX_TEXT, `Category ${category.id} name is too long.`);
    push(errors, typeof category.isActive !== "boolean", `Category ${category.id} isActive must be boolean.`);
    push(errors, !Number.isFinite(category.sortOrder), `Category ${category.id} sortOrder is invalid.`);
  }

  const itemIds = new Set();
  const variantIds = new Set();
  for (const item of data.items) {
    if (!item || typeof item !== "object") {
      errors.push("An item is not an object.");
      continue;
    }
    push(errors, !item.id, "Every item needs an id.");
    push(errors, itemIds.has(item.id), `Duplicate item id: ${item.id}`);
    itemIds.add(item.id);
    push(errors, !String(item.name || "").trim(), `Item ${item.id} needs a name.`);
    push(errors, String(item.name || "").length > MAX_TEXT, `Item ${item.id} name is too long.`);
    push(errors, String(item.description || "").length > MAX_DESC, `Item ${item.id} description is too long.`);
    push(errors, !categoryIds.has(item.categoryId), `Item ${item.id} references unknown category ${item.categoryId}.`);
    push(errors, !Number.isFinite(item.price) || item.price < 0, `Item ${item.id} has an invalid price.`);
    push(errors, typeof item.isActive !== "boolean", `Item ${item.id} isActive must be boolean.`);
    push(errors, typeof item.isFeatured !== "boolean", `Item ${item.id} isFeatured must be boolean.`);
    push(errors, !Number.isFinite(item.sortOrder), `Item ${item.id} sortOrder is invalid.`);
    push(errors, item.spiceLevel && !SPICE_LEVELS.includes(item.spiceLevel), `Item ${item.id} has an invalid spice level.`);
    push(errors, !Array.isArray(item.tags), `Item ${item.id} tags must be an array.`);
    push(errors, !Array.isArray(item.variants), `Item ${item.id} variants must be an array.`);
    if (item.image) {
      if (!isSafeImagePath(item.image)) {
        errors.push(`Item ${item.id} has an unsafe image path.`);
      }
      if (item.image.startsWith("blob:")) {
        errors.push(`Item ${item.id} must not use a blob URL.`);
      }
    }
    for (const variant of item.variants || []) {
      push(errors, !variant?.id, `Item ${item.id} has a variant without an id.`);
      push(errors, variantIds.has(variant?.id), `Duplicate variant id: ${variant?.id}`);
      variantIds.add(variant?.id);
      push(errors, !String(variant?.name || "").trim(), `Variant ${variant?.id} needs a name.`);
      push(errors, !Number.isFinite(variant?.price) || variant.price < 0, `Variant ${variant?.id} has an invalid price.`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}

export function summarizeMenu(data) {
  const items = data?.items || [];
  const categories = data?.categories || [];
  return {
    items: items.length,
    categories: categories.length,
    activeItems: items.filter((item) => item.isActive).length,
    inactiveItems: items.filter((item) => !item.isActive).length,
    featuredItems: items.filter((item) => item.isFeatured).length,
  };
}
