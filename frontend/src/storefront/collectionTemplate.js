"use client";

/* ==========================================================
   CATEGORY PAGE TEMPLATE hook — theme.templates.collection.settings
   Missing / purana theme → DEFAULT_COLLECTION_SETTINGS (aaj ka page).
   ========================================================== */

import { useMemo } from "react";
import { useStoreTheme } from "./ThemeProvider";
import { DEFAULT_COLLECTION_SETTINGS } from "./themeDefaults";

const SORTS = ["featured", "newest", "price-asc", "price-desc"];

export function useCollectionTemplate() {
  const { theme } = useStoreTheme();
  return useMemo(() => {
    const s = { ...DEFAULT_COLLECTION_SETTINGS, ...(theme?.templates?.collection?.settings || {}) };
    return {
      ...s,
      perPage: Math.min(60, Math.max(12, Number(s.perPage) || 24)),
      defaultSort: SORTS.includes(s.defaultSort) ? s.defaultSort : "featured",
    };
  }, [theme]);
}
