"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Languages } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import LanguageTransition from "@/components/common/LanguageTransition";

export default function AdminLanguageSwitcher() {
  const { locale, locales, changeLocale, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  // Target locale while a switch is in flight — the curtain is mounted for it.
  const [switchingTo, setSwitchingTo] = useState(null);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = 190;
    const isRtl = trigger.closest("[dir='rtl']") || document.documentElement.dir === "rtl";
    const alignedLeft = isRtl ? rect.left : rect.right - width;
    const left = Math.max(8, Math.min(alignedLeft, window.innerWidth - width - 8));
    setMenuPosition({ left, top: rect.bottom + 8 });
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (
        ref.current?.contains(event.target) ||
        menuRef.current?.contains(event.target)
      ) return;
      setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleViewportChange = () => updateMenuPosition();
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, updateMenuPosition]);

  const currentLanguage = locales.find((item) => item.code === locale) || locales[0];

  return (
    <div ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => {
          const nextOpen = !open;
          if (nextOpen) updateMenuPosition();
          setOpen(nextOpen);
        }}
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

      {open && menuPosition && typeof document !== "undefined" && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          aria-label={t("admin.switcher.current")}
          className="fixed z-[10000] min-w-[190px] overflow-hidden rounded-lg border py-1 shadow-xl"
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            maxHeight: `calc(100vh - ${menuPosition.top}px - 8px)`,
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
        </div>,
        document.body
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
