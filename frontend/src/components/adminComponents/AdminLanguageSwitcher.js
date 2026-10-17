"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Languages } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import LanguageTransition from "@/components/common/LanguageTransition";

const NATIVE_NAMES = {
  en: "English",
  ar: "Arabic",
  ur: "Urdu",
  es: "Spanish",
  fr: "French",
  de: "German",
  hi: "Hindi",
  zh: "Chinese",
  pt: "Portuguese",
  tr: "Turkish",
};

export default function AdminLanguageSwitcher() {
  const { locale, locales, changeLocale, t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Target locale while a switch is in flight — the curtain is mounted for it.
  const [switchingTo, setSwitchingTo] = useState(null);
  const ref = useRef(null);
  const hoverTimer = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setOpen(true);
  };
  const handleMouseLeave = () => {
    hoverTimer.current = setTimeout(() => setOpen(false), 150);
  };

  const currentLanguage = locales.find((item) => item.code === locale) || locales[0];

  return (
    <div className="relative" ref={ref} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={t("admin.switcher.title")}
        aria-label={t("admin.switcher.label")}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold transition-colors hover:bg-[var(--accent-soft)]"
        style={{ color: "var(--text-muted)" }}
      >
        <Languages size={16} strokeWidth={2} />
        <span className="hidden sm:inline">Language</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("admin.switcher.current")}
          className="absolute inset-e-0 z-50 mt-2 min-w-[180px] overflow-hidden rounded-xl border border-[var(--border-card)] bg-[var(--bg-card)] py-1 shadow-xl"
        >
          {locales.map((item) => {
            const active = item.code === locale;
            return (
              <button
                key={item.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  setOpen(false);
                  if (item.code === locale) return;
                  setSwitchingTo(item.code);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-[13px] transition-colors hover:bg-[var(--bg-secondary)]"
                style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}
              >
                <span>{NATIVE_NAMES[item.code] || item.nativeLabel || item.code}</span>
                {active && <Check size={14} strokeWidth={2.5} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}

      {switchingTo && (
        <LanguageTransition
          locale={switchingTo}
          variant="admin"
          onSwitch={() => changeLocale(switchingTo)}
          onComplete={() => setSwitchingTo(null)}
        />
      )}
    </div>
  );
}
