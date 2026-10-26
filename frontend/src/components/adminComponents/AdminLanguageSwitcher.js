"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Languages } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import LanguageTransition from "@/components/common/LanguageTransition";

export default function AdminLanguageSwitcher() {
  const { locale, locales, changeLocale, t } = useTranslation();
  const [open, setOpen] = useState(false);
  // Target locale while a switch is in flight — the curtain is mounted for it.
  const [switchingTo, setSwitchingTo] = useState(null);
  const ref = useRef(null);

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

  const currentLanguage = locales.find((item) => item.code === locale) || locales[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        title={t("admin.switcher.title")}
        aria-label={t("admin.switcher.label")}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12px] font-semibold transition-all duration-150 active:scale-95"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(event) => {
          event.currentTarget.style.backgroundColor = "var(--bg-secondary)";
          event.currentTarget.style.color = "var(--text-primary)";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.backgroundColor = "transparent";
          event.currentTarget.style.color = "var(--text-muted)";
        }}
      >
        <Languages size={16} strokeWidth={2} />
        <span className="hidden sm:inline">{currentLanguage.nativeLabel}</span>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t("admin.switcher.current")}
          className="absolute z-50 mt-2 min-w-[190px] overflow-hidden rounded-lg border py-1 shadow-xl"
          style={{
            top: "100%",
            insetInlineEnd: 0,
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-card)",
          }}
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
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-[13px] transition-colors duration-150"
                style={{
                  color: active ? "var(--accent)" : "var(--text-primary)",
                  backgroundColor: active ? "var(--accent-soft)" : "transparent",
                }}
                onMouseEnter={(event) => {
                  if (!active) event.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                }}
                onMouseLeave={(event) => {
                  if (!active) event.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate">{item.nativeLabel}</span>
                  {item.nativeLabel !== item.label && (
                    <span className="text-[11px] text-[var(--text-muted)]">{item.label}</span>
                  )}
                </span>
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
