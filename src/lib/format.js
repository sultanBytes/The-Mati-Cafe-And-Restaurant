const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatPrice(value, currency = "INR") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  if (currency === "INR") return INR.format(amount);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getItemPrices(item) {
  const prices = [Number(item.price)];
  for (const variant of item.variants || []) {
    prices.push(Number(variant.price));
  }
  const finite = prices.filter((price) => Number.isFinite(price) && price >= 0);
  if (!finite.length) return { min: 0, max: 0, hasRange: false };
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  return { min, max, hasRange: max > min };
}

export function formatItemPrice(item, currency = "INR") {
  const { min, hasRange } = getItemPrices(item);
  const formatted = formatPrice(min, currency);
  return hasRange ? `From ${formatted}` : formatted;
}

export function parseTableParam(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (!/^[A-Za-z0-9-]{1,8}$/.test(raw)) return null;
  return raw.toUpperCase();
}

export function spiceLabel(level) {
  switch (level) {
    case "mild":
      return "Mild";
    case "medium":
      return "Medium spice";
    case "hot":
      return "Hot";
    case "none":
      return "Not spicy";
    default:
      return "";
  }
}

export function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}
