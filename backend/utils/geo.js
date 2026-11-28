// ISO 3166-1 alpha-2 — display name map chhota rakha (baad me badhayenge)
const DISPLAY_BY_CODE = {
  PK: "Pakistan",
};

const ALIASES = {
  pakistan: "PK",
  pk: "PK",
};

/**
 * "Pakistan" | "PK" | "pakistan" → "PK"; unknown input trimmed as-is (uppercase if 2 chars).
 */
function normalizeCountryCode(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return "";
  const lower = raw.toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  for (const [code, name] of Object.entries(DISPLAY_BY_CODE)) {
    if (name.toLowerCase() === lower) return code;
  }
  return raw;
}

function countryDisplayName(codeOrName) {
  const code = normalizeCountryCode(codeOrName);
  return DISPLAY_BY_CODE[code] || String(codeOrName ?? "").trim() || "";
}

module.exports = { normalizeCountryCode, countryDisplayName, DISPLAY_BY_CODE };