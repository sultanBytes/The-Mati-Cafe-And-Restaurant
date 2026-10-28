export function withBase(path) {
  if (!path) return path;
  if (/^(https?:|blob:|data:|draft:)/i.test(path)) return path;
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${String(path).replace(/^\//, "")}`;
}
