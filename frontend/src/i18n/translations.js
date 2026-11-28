// ==========================================
// TRANSLATION LOOKUP (runtime)
// ==========================================
// ✏️  Storefront strings: ./locales/<code>.json
//     Admin panel strings: ./locales/admin/<code>.json (loaded only on /admin)
//     Add every new storefront key to en.json; admin keys to admin/en.json.
//
// Why split: English alone was ~345 KB raw (~25% home JS) with ~85% admin.*.
// Storefront now ships only storefront + a small shared admin-key subset
// still referenced by user components. Admin layout merges the admin chunk.

import { isRtl as isRtlLocale, normalizeLocale, LOCALES } from "./config";
import en from "./locales/en.json";

export { LOCALES, normalizeLocale };

/** Loaded dictionaries, keyed by locale code. English storefront is always present. */
const dictionaries = { en };

/** Locales that already merged their admin chunk. */
const adminLoaded = new Set();

/** One lazy chunk per non-English storefront locale. */
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

/** Admin-only dictionaries (lazy). English admin is a separate chunk too. */
const adminLoaders = {
  en: () => import("./locales/admin/en.json"),
  ur: () => import("./locales/admin/ur.json"),
  ar: () => import("./locales/admin/ar.json"),
  es: () => import("./locales/admin/es.json"),
  fr: () => import("./locales/admin/fr.json"),
  de: () => import("./locales/admin/de.json"),
  hi: () => import("./locales/admin/hi.json"),
  zh: () => import("./locales/admin/zh.json"),
  pt: () => import("./locales/admin/pt.json"),
  tr: () => import("./locales/admin/tr.json"),
};

const pending = {};
const pendingAdmin = {};

/** true when `translate(locale, …)` can already answer from that locale. */
export function isLocaleLoaded(locale) {
  return Boolean(dictionaries[normalizeLocale(locale)]);
}

/** Download a locale's storefront dictionary (no-op if already loaded / unknown). */
export function loadLocale(locale) {
  const code = normalizeLocale(locale);
  if (dictionaries[code] || !loaders[code]) return Promise.resolve();
  if (!pending[code]) {
    pending[code] = loaders[code]()
      .then((mod) => {
        dictionaries[code] = mod.default ?? mod;
      })
      .catch((err) => {
        delete pending[code];
        console.error(`i18n: failed to load "${code}" translations`, err);
      });
  }
  return pending[code];
}

/**
 * Merge admin.* keys for a locale. Call from admin layout / LanguageProvider
 * so storefront routes never download the admin chunk.
 */
export function loadAdminLocale(locale = "en") {
  const code = normalizeLocale(locale);
  if (adminLoaded.has(code) || !adminLoaders[code]) return Promise.resolve();
  if (!pendingAdmin[code]) {
    pendingAdmin[code] = Promise.resolve()
      .then(() => (code === "en" ? null : loadLocale(code)))
      .then(() => adminLoaders[code]())
      .then((mod) => {
        const adminDict = mod.default ?? mod;
        const base = dictionaries[code] || (code === "en" ? en : {});
        dictionaries[code] = { ...base, ...adminDict };
        if (code === "en") {
          // Keep module-level `en` fallback in sync for missing keys.
          Object.assign(en, adminDict);
        }
        adminLoaded.add(code);
      })
      .catch((err) => {
        delete pendingAdmin[code];
        console.error(`i18n: failed to load admin "${code}" translations`, err);
      });
  }
  return pendingAdmin[code];
}

/** Synchronously register a dictionary (used when the server already has it). */
export function registerLocale(locale, dict) {
  const code = normalizeLocale(locale);
  if (dict && !dictionaries[code]) dictionaries[code] = dict;
  else if (dict && dictionaries[code]) dictionaries[code] = { ...dictionaries[code], ...dict };
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
