// ==========================================
// TRANSLATION LOOKUP (runtime)
// ==========================================
// ✏️  To add or change strings edit ./locales/<code>.json directly.
//     Add every new key to en.json (the fallback); other languages are optional.
//
// Why split: previously all 10 languages (1.8 MB) shipped to every visitor
// on every page. Now English (the fallback) is bundled, and each other
// language is a separate chunk that is downloaded only when it is used.
//
// The `translate()` lookup resolves dotted keys such as
//   t("header.searchPlaceholder")  -> storefront
//   t("admin.products.page.title") -> admin panel
// Behaviour is unchanged: locale value → English → the key itself.

import { isRtl as isRtlLocale, normalizeLocale, LOCALES } from "./config";
import en from "./locales/en.json";

export { LOCALES, normalizeLocale };

/** Loaded dictionaries, keyed by locale code. English is always present. */
const dictionaries = { en };

/** One lazy chunk per non-English locale. */
const loaders = {
  ur: () => import("./locales/ur.json"),
  ar: () => import("./locales/ar.json"),
  es: () => import("./locales/es.json"),
  fr: () => import("./locales/fr.json"),
  de: () => import("./locales/de.json"),
  hi: () => import("./locales/hi.json"),
  zh: () => import("./locales/zh.json"),
  pt: () => import("./locales/pt.json"),
  tr: () => import("./locales/tr.json"),
};

const pending = {};

/** true when `translate(locale, …)` can already answer from that locale. */
export function isLocaleLoaded(locale) {
  return Boolean(dictionaries[normalizeLocale(locale)]);
}

/** Download a locale's dictionary (no-op if already loaded / unknown). */
export function loadLocale(locale) {
  const code = normalizeLocale(locale);
  if (dictionaries[code] || !loaders[code]) return Promise.resolve();
  if (!pending[code]) {
    pending[code] = loaders[code]()
      .then((mod) => {
        dictionaries[code] = mod.default ?? mod;
      })
      .catch((err) => {
        // Network hiccup: allow a retry later; English fallback keeps the UI usable.
        delete pending[code];
        console.error(`i18n: failed to load "${code}" translations`, err);
      });
  }
  return pending[code];
}

/** Synchronously register a dictionary (used when the server already has it). */
export function registerLocale(locale, dict) {
  const code = normalizeLocale(locale);
  if (dict && !dictionaries[code]) dictionaries[code] = dict;
}

/** Return a loaded locale's dictionary (server layouts pass it to the client). */
export function getDictionary(locale) {
  return dictionaries[normalizeLocale(locale)] ?? null;
}

/** Resolve a dotted key for a locale, with {param} interpolation. */
export function translate(locale, key, params) {
  let text = dictionaries[locale]?.[key] ?? en[key] ?? key;
  if (params && typeof text === "string") {
    text = text.replace(/\{(\w+)\}/g, (m, p) => (params[p] !== undefined ? params[p] : m));
  }
  return text;
}

export function isRtl(locale) { return isRtlLocale(locale); }

export default dictionaries;
