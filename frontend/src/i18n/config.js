// ==========================================
// I18N CONFIG — single source of truth for locale handling
// ==========================================
// Plain, framework-free locale helpers shared by the LanguageProvider,
// the language switcher and the middleware.

/** English is the default AND the fallback for any missing key. */
export const DEFAULT_LOCALE = "en";

export const LOCALES = [
  { code: "en", label: "English", nativeLabel: "English", dir: "ltr" },
  { code: "ar", label: "Arabic", nativeLabel: "العربية", dir: "rtl" },
  { code: "ur", label: "Urdu", nativeLabel: "اردو", dir: "rtl" },
];

export const LOCALE_CODES = LOCALES.map((l) => l.code);
export const RTL_LOCALES = LOCALES.filter((l) => l.dir === "rtl").map((l) => l.code);

/** Cookie name used for BOTH admin and user panels. */
export const LANG_COOKIE = "lang";

/** Normalise anything (cookie value, browser value) to a supported code. */
export function normalizeLocale(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return DEFAULT_LOCALE;
  if (LOCALE_CODES.includes(raw)) return raw;
  return DEFAULT_LOCALE;
}

/** true for right-to-left locales (Arabic, Urdu). */
export function isRtl(locale) {
  return RTL_LOCALES.includes(normalizeLocale(locale));
}

/** "rtl" | "ltr" for a locale. */
export function dirForLocale(locale) {
  return isRtl(locale) ? "rtl" : "ltr";
}

/**
 * Convert a data-driven label (e.g. "Featured Products") into a lookup key
 * ("featuredProducts"). Used by the admin sidebar so its existing `name`
 * arrays keep working as the stable key.
 */
export function slugKey(label) {
  const words = String(label || "")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
  return words
    .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join("");
}
