const MAX_HTTP_URL_LENGTH = 2048;
const MAX_HTTP_URL_LIST_SIZE = 50;
const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function normalizeHttpUrl(value) {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (!candidate || candidate.length > MAX_HTTP_URL_LENGTH) return null;

  try {
    const url = new URL(candidate);
    if (!ALLOWED_PROTOCOLS.has(url.protocol) || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeHttpUrlList(value) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map(normalizeHttpUrl).filter((url) => url !== null)),
  ).slice(0, MAX_HTTP_URL_LIST_SIZE);
}