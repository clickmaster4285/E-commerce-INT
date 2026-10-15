"use client";

// ==========================================
// LANGUAGE SWITCHER — dropdown for the user storefront header
// ==========================================
// Writes the shared `lang` cookie and switches the whole site instantly.

import { useEffect, useRef, useState } from "react";
import { Languages, Check } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

export default function LanguageSwitcher({ className = "" }) {
  const { locale, locales, changeLocale, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = locales.find((l) => l.code === locale) || locales[0];

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={t("switcher.title")}
        aria-label={t("switcher.label")}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2 transition-all duration-150 active:scale-95"
        style={{ color: "var(--user-text-muted)" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "var(--user-bg-hover)";
          e.currentTarget.style.color = "var(--user-text)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "transparent";
          e.currentTarget.style.color = "var(--user-text-muted)";
        }}
      >
        <Languages size={16} strokeWidth={2} />
        <span className="hidden text-[12px] font-semibold sm:inline">
          {current.nativeLabel}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-2 min-w-[190px] overflow-hidden rounded-lg border py-1 shadow-xl"
          style={{
            top: "100%",
            insetInlineEnd: 0,
            backgroundColor: "var(--user-bg-elevated)",
            borderColor: "var(--user-border)",
          }}
        >
          {locales.map((l) => {
            const isActive = l.code === locale;
            return (
              <button
                key={l.code}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  changeLocale(l.code);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-[13px] transition-colors duration-150"
                style={{
                  color: isActive ? "var(--user-accent)" : "var(--user-text)",
                  backgroundColor: isActive ? "var(--user-accent-soft)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "var(--user-bg-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{l.nativeLabel}</span>
                  {l.nativeLabel !== l.label && (
                    <span className="text-[11px]" style={{ color: "var(--user-text-muted)" }}>
                      {l.label}
                    </span>
                  )}
                </span>
                {isActive && <Check size={14} strokeWidth={2.5} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
