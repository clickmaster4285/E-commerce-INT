"use client";

/* ==========================================================
   SHARE PREVIEW BAR — store editor "Share preview" link se aaye visitor
   ko batata hai ke ye UNPUBLISHED draft hai (+ Exit). Expired link par
   chhota notice jo band ho sakta hai.
   ========================================================== */

import { useState } from "react";
import { Eye, X } from "lucide-react";
import { useStoreTheme, exitSharedPreview } from "./ThemeProvider";
import { useTranslation } from "@/i18n/LanguageProvider";

export default function SharePreviewBar() {
  const { sharePreview } = useStoreTheme();
  const { t, locale } = useTranslation();
  const [hidden, setHidden] = useState(false);
  if (!sharePreview || hidden) return null;

  if (sharePreview.status === "expired") {
    return (
      <div role="status" className="relative z-[52] flex items-center justify-center gap-3 bg-user-fg px-10 py-2 text-xs font-medium text-user-page">
        {t("storefront.sharePreview.expired")}
        <button type="button" onClick={() => setHidden(true)} aria-label={t("storefront.popup.close")} className="absolute end-2 rounded p-1 opacity-80 hover:opacity-100">
          <X size={14} />
        </button>
      </div>
    );
  }

  let expires = "";
  try {
    expires = new Date(sharePreview.expiresAt).toLocaleString(locale === "ur" ? "ur-PK" : locale, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    // ignore
  }

  return (
    <div role="status" className="relative z-[52] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-user-fg px-4 py-2 text-xs font-medium text-user-page">
      <span className="inline-flex items-center gap-1.5 font-bold">
        <Eye size={14} /> {t("storefront.sharePreview.active")}
      </span>
      {expires ? <span className="opacity-75">{t("storefront.sharePreview.expires", { date: expires })}</span> : null}
      <button type="button" onClick={exitSharedPreview} className="rounded-md bg-user-page/15 px-2.5 py-1 font-semibold hover:bg-user-page/25">
        {t("storefront.sharePreview.exit")}
      </button>
    </div>
  );
}
