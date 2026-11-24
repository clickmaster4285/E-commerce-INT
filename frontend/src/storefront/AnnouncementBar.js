"use client";

/* ==========================================================
   ANNOUNCEMENT BAR — store editor Theme → Announcement bar
   settings.announcement = { enabled, text, link } (translated text
   StoreThemeProvider se aata hai).

   ✕ sirf is page view ke liye band karta hai (state). Pehle localStorage
   me hamesha ke liye save hota tha → refresh par bar ek second dikh kar
   gayab ho jata tha (SSR dikhata, hydration chhupa deta) aur kabhi wapas
   nahi aata tha. Shopify jaisa: har refresh par bar dikhta hai.
   ========================================================== */

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";
import { useStoreTheme } from "./ThemeProvider";
import { resolveThemeLink, isExternalHref } from "./themeLinks";

export default function AnnouncementBar() {
  const { theme } = useStoreTheme();
  const bar = theme?.settings?.announcement;
  const text = typeof bar?.text === "string" ? bar.text.trim() : "";
  const [dismissedText, setDismissedText] = useState("");

  if (!bar?.enabled || !text || dismissedText === text) return null;

  const href = resolveThemeLink(bar.link);
  const content = <span className="truncate">{text}</span>;

  return (
    <div
      role="region"
      aria-label="Announcement"
      className="relative z-[51] flex min-h-9 w-full items-center justify-center bg-user-accent px-10 py-2 text-center text-xs font-semibold text-user-accent-fg sm:text-[0.8125rem]"
    >
      {href ? (
        isExternalHref(href) ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-user-accent-fg underline-offset-2 hover:underline">
            {content}
          </a>
        ) : (
          <Link href={href} className="min-w-0 truncate text-user-accent-fg underline-offset-2 hover:underline">
            {content}
          </Link>
        )
      ) : (
        content
      )}
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => setDismissedText(text)}
        className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-user-accent-fg opacity-80 hover:opacity-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}
