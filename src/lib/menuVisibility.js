function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function getCategoryMap(menu) {
  const map = new Map();
  for (const category of menu?.categories || []) {
    map.set(category.id, category);
  }
  return map;
}

export function isPubliclyVisible(item, category) {
  return Boolean(item?.isActive) && Boolean(category?.isActive);
}

export function getPublicCategories(menu) {
  const items = menu?.items || [];
  return (menu?.categories || [])
    .filter((category) => category.isActive)
    .filter((category) =>
      items.some((item) => item.categoryId === category.id && item.isActive),
    )
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function getPublicItems(menu, categoryId) {
  const categoryMap = getCategoryMap(menu);
  return (menu?.items || [])
    .filter((item) => {
      if (categoryId && item.categoryId !== categoryId) return false;
      return isPubliclyVisible(item, categoryMap.get(item.categoryId));
    })
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
}

export function getFeaturedItems(menu) {
  return getPublicItems(menu).filter((item) => item.isFeatured);
}

export function getVisibleCount(menu, categoryId) {
  return getPublicItems(menu, categoryId).length;
}

export function searchPublicItems(menu, query) {
  const needle = normalize(query);
  if (!needle) return getPublicItems(menu);
  const categoryMap = getCategoryMap(menu);
  return getPublicItems(menu).filter((item) => {
    const category = categoryMap.get(item.categoryId);
    const haystack = [
      item.name,
      item.nameHi,
      item.description,
      category?.name,
      ...(item.tags || []),
    ]
      .map(normalize)
      .join(" ");
    return haystack.includes(needle);
  });
}

export function groupItemsByCategory(menu, items) {
  const byId = new Map();
  for (const category of getPublicCategories(menu)) {
    byId.set(category.id, { category, items: [] });
  }
  for (const item of items) {
    const group = byId.get(item.categoryId);
    if (group) group.items.push(item);
  }
  return [...byId.values()].filter((group) => group.items.length > 0);
}

export function emptyRestaurant() {
  return {
    name: "The Maati Cafe & Restaurant",
    currency: "INR",
    description: "",
    address: "",
    phone: "",
    openingHours: "",
    footerText: "",
    wifi: { enabled: false, name: "", password: "" },
  };
}

export function createEmptyMenu() {
  return {
    schemaVersion: 1,
    revision: "draft",
    restaurant: emptyRestaurant(),
    categories: [],
    items: [],
  };
}
