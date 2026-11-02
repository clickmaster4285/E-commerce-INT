"use client";

// ==========================================
// GLOBAL LANGUAGE PROVIDER — one for the whole app
// ==========================================
// Wraps the entire application (admin + user panels). Reads the `lang`
// cookie on mount and provides the active locale, direction and a `t()`
// helper through useTranslation().
//
// The provider writes `dir` and `lang` on a wrapper element so RTL applies
// to the app without touching the <html> tag (which is owned by the root
// layout and must not leak into any embedded/static contexts).

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Cookies from "js-cookie";
import {
  DEFAULT_LOCALE,
  LANG_COOKIE,
  LOCALES,
  isRtl,
  normalizeLocale,
} from "./config";
import { translate } from "./translations";

const LanguageContext = createContext(null);

function readStoredLocale(fallbackLocale = DEFAULT_LOCALE) {
  if (typeof window === "undefined") return fallbackLocale;
  try {
    return normalizeLocale(Cookies.get(LANG_COOKIE) || fallbackLocale);
  } catch {
    return fallbackLocale;
  }
}

export function LanguageProvider({ children, initialLocale = DEFAULT_LOCALE, legacyCookieName = null }) {
  const normalizedInitialLocale = normalizeLocale(initialLocale);
  const [locale, setLocale] = useState(normalizedInitialLocale);

  useEffect(() => {
    if (legacyCookieName) Cookies.remove(legacyCookieName, { path: "/" });
    setLocale(readStoredLocale(normalizedInitialLocale));
  }, [legacyCookieName, normalizedInitialLocale]);

  const changeLocale = useCallback((next) => {
    const code = normalizeLocale(next);
    try {
      Cookies.set(LANG_COOKIE, code, {
        expires: 365,
        path: "/",
        sameSite: "lax",
      });
      if (legacyCookieName) Cookies.remove(legacyCookieName, { path: "/" });
    } catch {
      /* cookie unavailable (private mode) — still switch for this session */
    }
    setLocale(code);
  }, [legacyCookieName]);

  const dir = isRtl(locale) ? "rtl" : "ltr";

  const t = useCallback(
    (key, params) => translate(locale, key, params),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, dir, locales: LOCALES, changeLocale, t }),
    [locale, dir, changeLocale, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      <div dir={dir} lang={locale} className="contents">
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

/** Access locale, direction and the `t()` translator from any component. */
export function useTranslation() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Provider missing — stay on English rather than crash.
    return { locale: DEFAULT_LOCALE, dir: "ltr", locales: LOCALES, changeLocale: () => {}, t: (k, p) => translate(DEFAULT_LOCALE, k, p) };
  }
  return ctx;
}

export function useLocale() {
  const { locale } = useTranslation();
  return locale;
}

export function useDir() {
  const { dir } = useTranslation();
  return dir;
}

export function useChangeLocale() {
  const { changeLocale } = useTranslation();
  return changeLocale;
}

export default LanguageProvider;
