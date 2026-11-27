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
        parent → iframe : { type: "theme:update", theme, selectedSectionId, labels,
                            mode: "view" | "edit", fields, selectedElementKey }
        iframe → parent : { type: "theme:ready" } | { type: "section:select", id }
                          | { type: "section:action", action, id }  (hover toolbar)
                          | element:select / element:style / field:edit / page:change
                            (Edit mode — storefront/VisualEditor.js)
     iframe ka name "sf-store-preview" → storefront ke andar navigate karne par
     (?preview=1 URL se hat jata hai) bhi preview chalu rehta hai.
     Draft kabhi public URL se nahi aata → public visitors ko draft nahi dikhta.
   ========================================================== */

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { buildThemeCss, themeFontsHref } from "./themeCss";
import { buildElementCss } from "./elementStyles";
import { buildDefaultTheme } from "./themeDefaults";
import { localizeTheme } from "./themeI18n";
import { useTranslation } from "@/i18n/LanguageProvider";
import { userHttp } from "@/apis/axiosInstance";

/* SHARED PREVIEW LINK (store editor "Share preview"):
   ?theme_preview=<token> → token is tab ki sessionStorage me, URL se hata diya,
   current DRAFT backend /theme/preview se. Navigation par bhi preview rehta hai.
   Expired / revoked → normal published theme + chhota notice. */
const SHARE_KEY = "store-theme-preview";

const ThemeContext = createContext({
  theme: null,
  isPreview: false,
  selectedSectionId: null,
  sectionLabels: null,
  editorMode: "edit",
  editableFields: [],
  selectedElementKey: null,
});

// Editor iframe ka window.name (PreviewFrame) — navigation ke baad bhi same rehta hai
export const PREVIEW_FRAME_NAME = "sf-store-preview";

// Edit mode messages (iframe → parent) — editor side bhi yahi allowlist maanta hai
export const EDITOR_MESSAGES = ["element:select", "element:style", "field:edit", "page:change", "editor:shortcut", "editor:batch"];

export const PREVIEW_MESSAGE = {
  update: "theme:update",
  ready: "theme:ready",
  select: "section:select",
  action: "section:action",
};

// Preview toolbar ke actions (editor side bhi yahi allowlist check karta hai)
export const SECTION_ACTIONS = ["moveUp", "moveDown", "hide", "duplicate", "remove", "addBelow"];

function detectPreview() {
  if (typeof window === "undefined") return false;
  try {
    if (window.parent === window) return false;
    const flagged = new URLSearchParams(window.location.search).get("preview") === "1" || window.name === PREVIEW_FRAME_NAME;
    if (!flagged) return false;
    // Cross-origin parent par ye throw karta hai → preview nahi
    return window.parent.location.origin === window.location.origin;
  } catch {
    return false;
  }
}

// Preview flag page ki zindagi me nahi badalta → subscribe ki zaroorat nahi
const noopSubscribe = () => () => {};

const isThemeShape =(t) => t && typeof t === "object" && Array.isArray(t.order) && t.sections && typeof t.sections === "object";

export function StoreThemeProvider({ initialTheme = null, translations = null, children }) {
  const [rawTheme, setTheme] = useState(() => (isThemeShape(initialTheme) ? initialTheme : buildDefaultTheme()));
  const { locale } = useTranslation();
  // Server par hamesha false (hydration same), client par iframe/URL se
  const isPreview = useSyncExternalStore(noopSubscribe, detectPreview, () => false);
  const [selectedSectionId, setSelectedSectionId] = useState(null);
  const [sectionLabels, setSectionLabels] = useState(null); // { [id]: "Rich text · About" } (editor se)
  const [sharePreview, setSharePreview] = useState(null); // { status: "active" | "expired", expiresAt }
  const [editorMode, setEditorMode] = useState("edit"); // "view" = normal store (links chalte hain) | "edit"
  const [editableFields, setEditableFields] = useState([]); // inline text editing (editor se)
  const [selectedElementKey, setSelectedElementKey] = useState(null);
  const pathname = usePathname();

  useEffect(() => {
    if (isPreview) return undefined; // editor iframe apna draft postMessage se leta hai
    let token = null;
    try {
      const url = new URL(window.location.href);
      token = url.searchParams.get("theme_preview");
      if (token) {
        window.sessionStorage.setItem(SHARE_KEY, token);
        url.searchParams.delete("theme_preview");
        // Next router ki history state same rakho
        window.history.replaceState(window.history.state, "", url.toString());
      } else {
        token = window.sessionStorage.getItem(SHARE_KEY);
      }
    } catch {
      // storage / URL blocked
    }
    if (!token) return undefined;
    let cancelled = false;
    userHttp
      .get("/theme/preview", { params: { token } })
      .then((res) => {
        const d = res?.data?.data;
        if (cancelled || !isThemeShape(d?.theme)) return;
        setTheme(d.theme);
        setSharePreview({ status: "active", expiresAt: d.expiresAt });
      })
      .catch(() => {
        try {
          window.sessionStorage.removeItem(SHARE_KEY);
        } catch {
          // ignore
        }
        if (!cancelled) setSharePreview({ status: "expired" });
      });
    return () => {
      cancelled = true;
    };
  }, [isPreview]);

  useEffect(() => {
    if (!isPreview) return undefined;
    const onMessage = (event) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const msg = event.data;
      if (!msg || msg.type !== PREVIEW_MESSAGE.update) return;
      if (isThemeShape(msg.theme)) setTheme(msg.theme);
      setSelectedSectionId(typeof msg.selectedSectionId === "string" ? msg.selectedSectionId : null);
      if (msg.labels && typeof msg.labels === "object") setSectionLabels(msg.labels);
      if (msg.mode === "view" || msg.mode === "edit") setEditorMode(msg.mode);
      if (Array.isArray(msg.fields)) setEditableFields(msg.fields);
      setSelectedElementKey(typeof msg.selectedElementKey === "string" ? msg.selectedElementKey : null);
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ type: PREVIEW_MESSAGE.ready }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [isPreview]);

  // Preview / shared preview me draft (abhi translate nahi hua) → seller ka original text
  const showingDraft = isPreview || sharePreview?.status === "active";
  const theme = useMemo(
    () => (showingDraft ? rawTheme : localizeTheme(rawTheme, translations, locale)),
    [rawTheme, translations, locale, showingDraft],
  );

  // Editor iframe ko batao kaun sa page khula hai (storefront ke andar navigation)
  useEffect(() => {
    if (isPreview) sendToEditor("page:change", { path: pathname });
  }, [isPreview, pathname]);

  const css = useMemo(() => buildThemeCss(theme), [theme]);
  // Edit mode ke per-element styles — sirf is page + global (SSR me bhi → koi flash nahi)
  const elementCss = useMemo(() => buildElementCss(theme?.elements, pathname, { preview: isPreview }), [theme, pathname, isPreview]);
  const fontsHref = useMemo(() => themeFontsHref(theme), [theme]);
  const value = useMemo(
    () => ({ theme, isPreview, selectedSectionId, sharePreview, sectionLabels, editorMode, editableFields, selectedElementKey }),
    [theme, isPreview, selectedSectionId, sharePreview, sectionLabels, editorMode, editableFields, selectedElementKey],
  );

  return (
    <ThemeContext.Provider value={value}>
      {fontsHref ? <link rel="stylesheet" href={fontsHref} precedence="default" /> : null}
      {css ? <style data-store-theme="">{css}</style> : null}
      {elementCss ? <style data-store-elements="">{elementCss}</style> : null}
      {children}
    </ThemeContext.Provider>
  );
}

export function useStoreTheme() {
  return useContext(ThemeContext);
}

/** Shared preview band karo → published theme (reload) */
export function exitSharedPreview() {
  try {
    window.sessionStorage.removeItem(SHARE_KEY);
  } catch {
    // ignore
  }
  window.location.reload();
}

/** Preview me section click → editor sidebar me wahi section select */
export function selectSectionInEditor(id) {
  try {
    window.parent.postMessage({ type: PREVIEW_MESSAGE.select, id }, window.location.origin);
  } catch {
    // ignore
  }
}

/** Preview hover toolbar → editor (move / hide / duplicate / remove / add below) */
export function sendSectionAction(action, id) {
  if (!SECTION_ACTIONS.includes(action)) return;
  try {
    window.parent.postMessage({ type: PREVIEW_MESSAGE.action, action, id }, window.location.origin);
  } catch {
    // ignore
  }
}

/** Edit mode (VisualEditor) → editor; type allowlisted */
export function sendToEditor(type, payload = {}) {
  if (!EDITOR_MESSAGES.includes(type)) return;
  try {
    window.parent.postMessage({ ...payload, type }, window.location.origin);
  } catch {
    // ignore
  }
}
