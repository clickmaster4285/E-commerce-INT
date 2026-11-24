"use client";

/* ==========================================================
   ANNOUNCEMENT BAR — store editor Theme → Announcement bar
   settings.announcement = { enabled, text, link } (translated text
   StoreThemeProvider se aata hai). Visitor band kare to usi text ke
   liye band rehta hai (text badle to dobara dikhta hai).
   ========================================================== */

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useStoreTheme } from "./ThemeProvider";
import { resolveThemeLink, isExternalHref } from "./themeLinks";

const STORAGE_KEY = "announcement-dismissed";

const readDismissed = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
};
const noopSubscribe = () => () => {};

export default function AnnouncementBar() {
  const { theme, isPreview } = useStoreTheme();
  const bar = theme?.settings?.announcement;
  const text = typeof bar?.text === "string" ? bar.text.trim() : "";
  // Server par "" (hydration same); client par localStorage
  const storedDismissed = useSyncExternalStore(noopSubscribe, readDismissed, () => "");
  const [dismissedNow, setDismissedNow] = useState("");

  if (!bar?.enabled || !text) return null;
  if (!isPreview && (storedDismissed === text || dismissedNow === text)) return null;

  const href = resolveThemeLink(bar.link);
  const content = <span className="truncate">{text}</span>;

  return (
    <div className="relative flex min-h-9 w-full items-center justify-center bg-user-accent px-10 py-2 text-center text-xs font-semibold text-user-accent-fg sm:text-[0.8125rem]">
      {href ? (
        isExternalHref(href) ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate underline-offset-2 hover:underline">
            {content}
          </a>
        ) : (
          <Link href={href} className="min-w-0 truncate underline-offset-2 hover:underline">
            {content}
          </Link>
        )
      ) : (
        content
      )}
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          setDismissedNow(text);
          try {
            window.localStorage.setItem(STORAGE_KEY, text);
          } catch {
            // private mode — sirf is page ke liye band
          }
        }}
        className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 opacity-80 hover:opacity-100"
      >
        <X size={14} />
      </button>
    </div>
  );
}
