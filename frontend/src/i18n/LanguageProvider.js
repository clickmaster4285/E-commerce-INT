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
import { translate, loadLocale, loadAdminLocale, registerLocale } from "./translations";

const LanguageContext = createContext(null);

function readStoredLocale(fallbackLocale = DEFAULT_LOCALE) {
  if (typeof window === "undefined") return fallbackLocale;
  try {
    return normalizeLocale(Cookies.get(LANG_COOKIE) || fallbackLocale);
  } catch {
    return fallbackLocale;
  }
}

export function LanguageProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
  // Dictionary for `initialLocale`, passed by a server layout that already
  // read the `lang` cookie — lets SSR + first client render use the right
  // language with no English flash and no extra download.
  initialMessages = null,
  legacyCookieName = null,
}) {
  const normalizedInitialLocale = normalizeLocale(initialLocale);
  // Must run during render (not in an effect) so translate() sees it on the
  // server and in the very first client render alike.
  if (initialMessages) registerLocale(normalizedInitialLocale, initialMessages);
  const [locale, setLocale] = useState(normalizedInitialLocale);

  const isAdminSurface = Boolean(legacyCookieName);

  useEffect(() => {
    if (legacyCookieName) Cookies.remove(legacyCookieName, { path: "/" });
    const stored = readStoredLocale(normalizedInitialLocale);
    let cancelled = false;
    // Languages are split into lazy chunks: fetch the stored one, then switch.
    // Admin surface also merges admin.* so panel strings resolve.
    const boot = isAdminSurface
      ? loadLocale(stored).then(() => loadAdminLocale(stored))
      : loadLocale(stored);
    boot.then(() => {
      if (!cancelled) setLocale(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [legacyCookieName, normalizedInitialLocale, isAdminSurface]);

  const changeLocale = useCallback(async (next) => {
    const code = normalizeLocale(next);
    // Download the dictionary BEFORE switching so the UI never shows a
    // half-English state. Cached after the first time.
    await loadLocale(code);
    if (isAdminSurface) await loadAdminLocale(code);
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
  }, [legacyCookieName, isAdminSurface]);

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
