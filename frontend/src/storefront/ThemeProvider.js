"use client";

/* ==========================================================
   STOREFRONT THEME PROVIDER
   ----------------------------------------------------------
   • Server layout published theme deta hai (initialTheme) → yahan
     se <style> SSR me hi render hota hai (koi color flash nahi).
   • useStoreTheme() → { theme, isPreview, selectedSectionId }
     (HomeClient sections, HomeNav / Footer menus).

   PREVIEW MODE (store editor iframe — /admin/store-editor):
     Sirf tab jab URL me ?preview=1 ho AUR page iframe me ho AUR parent
     ISI origin ka ho (admin panel same store host par chalta hai).
     Parent window draft theme postMessage se bhejta hai:
        parent → iframe : { type: "theme:update", theme, selectedSectionId }
        iframe → parent : { type: "theme:ready" } | { type: "section:select", id }
     Draft kabhi public URL se nahi aata → public visitors ko draft nahi dikhta.
   ========================================================== */

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { buildThemeCss, themeFontsHref } from "./themeCss";
import { buildDefaultTheme } from "./themeDefaults";

const ThemeContext = createContext({ theme: null, isPreview: false, selectedSectionId: null });

export const PREVIEW_MESSAGE = {
  update: "theme:update",
  ready: "theme:ready",
  select: "section:select",
};

function detectPreview() {
  if (typeof window === "undefined") return false;
  try {
    if (window.parent === window) return false;
    if (new URLSearchParams(window.location.search).get("preview") !== "1") return false;
    // Cross-origin parent par ye throw karta hai → preview nahi
    return window.parent.location.origin === window.location.origin;
  } catch {
    return false;
  }
}

// Preview flag page ki zindagi me nahi badalta → subscribe ki zaroorat nahi
const noopSubscribe = () => () => {};

const isThemeShape =(t) => t && typeof t === "object" && Array.isArray(t.order) && t.sections && typeof t.sections === "object";

export function StoreThemeProvider({ initialTheme = null, children }) {
  const [theme, setTheme] = useState(() => (isThemeShape(initialTheme) ? initialTheme : buildDefaultTheme()));
  // Server par hamesha false (hydration same), client par iframe/URL se
  const isPreview = useSyncExternalStore(noopSubscribe, detectPreview, () => false);
  const [selectedSectionId, setSelectedSectionId] = useState(null);

  useEffect(() => {
    if (!isPreview) return undefined;
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const msg = event.data;
      if (!msg || msg.type !== PREVIEW_MESSAGE.update) return;
      if (isThemeShape(msg.theme)) setTheme(msg.theme);
      setSelectedSectionId(typeof msg.selectedSectionId === "string" ? msg.selectedSectionId : null);
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: PREVIEW_MESSAGE.ready }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [isPreview]);

  const css = useMemo(() => buildThemeCss(theme), [theme]);
  const fontsHref = useMemo(() => themeFontsHref(theme), [theme]);
  const value = useMemo(() => ({ theme, isPreview, selectedSectionId }), [theme, isPreview, selectedSectionId]);

  return (
    <ThemeContext.Provider value={value}>
      {fontsHref ? <link rel="stylesheet" href={fontsHref} precedence="default" /> : null}
      {css ? <style data-store-theme="">{css}</style> : null}
      {children}
    </ThemeContext.Provider>
  );
}

export function useStoreTheme() {
  return useContext(ThemeContext);
}

/** Preview me section click → editor sidebar me wahi section select */
export function selectSectionInEditor(id) {
  try {
    window.parent.postMessage({ type: PREVIEW_MESSAGE.select, id }, window.location.origin);
  } catch {
    // ignore
  }
}
