// Locale: query → x-lang header → lang cookie (optimizeplan §8.2)
function extractLocaleRaw(req) {
  if (!req || typeof req !== "object") return "";
  const raw = req.query?.locale ?? req.headers?.["x-lang"] ?? req.cookies?.lang;
  return String(raw ?? "").trim().toLowerCase();
}

function normalizeLocale(value) {
  const requested = String(value ?? "en").trim().toLowerCase();
  if (/^[a-z]{2}$/.test(requested)) return requested;
  if (/^[a-z]{2}/.test(requested)) return requested.slice(0, 2);
  return "en";
}

function parseLocale(req) {
  const raw = extractLocaleRaw(req);
  return normalizeLocale(raw || "en");
}

module.exports = { parseLocale, normalizeLocale, extractLocaleRaw };