"use client";

/* ==========================================================
   PRODUCT PAGE TEMPLATE — store editor ke product blocks
   useProductTemplate() → theme.templates.product (missing → default =
   aaj ka product page). Add-on blocks: trust badges, delivery estimate,
   WhatsApp order, custom text. Sirf --user-* tokens.
   Preview me har block clickable (editor me select: "product:<zone>:<id>").
   ========================================================== */

import DOMPurify from "dompurify";
import { useMemo } from "react";
import { BadgeCheck, CalendarClock, MessageCircle, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { useStoreTheme, selectSectionInEditor } from "../ThemeProvider";
import { buildDefaultProductTemplate } from "../themeDefaults";
import { useTranslation } from "@/i18n/LanguageProvider";

export function useProductTemplate() {
  const { theme, isPreview, selectedSectionId } = useStoreTheme();
  const template = useMemo(() => {
    const t = theme?.templates?.product;
    const fallback = buildDefaultProductTemplate();
    if (!t || typeof t !== "object") return fallback;
    return {
      settings: { ...fallback.settings, ...(t.settings || {}) },
      info: t.info && Array.isArray(t.info.order) ? t.info : fallback.info,
      below: t.below && Array.isArray(t.below.order) ? t.below : fallback.below,
    };
  }, [theme]);
  return { template, isPreview, selectedSectionId };
}

/** Zone ke visible blocks [id, block] (disabled skip) */
export const zoneEntries = (zone) =>
  (zone?.order || []).map((id) => [id, zone.blocks?.[id]]).filter(([, b]) => b && !b.disabled);

export function EditableProductBlock({ zone, id, isPreview, selectedSectionId, children }) {
  if (!isPreview) return children;
  const key = `product:${zone}:${id}`;
  const selected = selectedSectionId === key;
  return (
    <div
      data-section-id={key}
      onClickCapture={(event) => {
        if (event.target.closest?.("a")) event.preventDefault();
        selectSectionInEditor(key);
      }}
      className={`relative outline-offset-2 ${selected ? "outline outline-2 outline-user-accent" : "hover:outline hover:outline-1 hover:outline-user-line"}`}
    >
      {children}
    </div>
  );
}

// ───────────────────────── Add-on blocks ─────────────────────────
const BADGE_ICONS = [Truck, RotateCcw, BadgeCheck, ShieldCheck];

export function TrustBadges({ settings = {}, compact = false }) {
  const items = String(settings.items || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (!items.length) return null;
  const list = settings.layout === "list";
  return (
    <ul className={list ? "space-y-2" : `grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4"}`}>
      {items.map((text, i) => {
        const Icon = BADGE_ICONS[i % BADGE_ICONS.length];
        return (
          <li key={`${text}-${i}`} className="flex items-center gap-2 rounded-lg border border-user-line bg-user-card px-2.5 py-2 text-xs text-user-fg-secondary">
            <Icon size={15} className="shrink-0 text-user-accent" aria-hidden="true" />
            <span className="min-w-0">{text}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function DeliveryEstimate({ settings = {} }) {
  const { locale } = useTranslation();
  const min = Math.max(0, Number(settings.minDays) || 0);
  const max = Math.max(min, Number(settings.maxDays) || min);
  const fmt = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    try {
      return d.toLocaleDateString(locale === "ur" ? "ur-PK" : locale, { weekday: "short", day: "numeric", month: "short" });
    } catch {
      return d.toDateString();
    }
  };
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-user-hover px-3 py-2.5 text-xs">
      <CalendarClock size={16} className="shrink-0 text-user-accent" aria-hidden="true" />
      <span className="text-user-fg-secondary">
        {settings.label ? <span className="font-semibold text-user-fg">{settings.label}: </span> : null}
        {min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`}
      </span>
    </div>
  );
}

export function WhatsAppButton({ settings = {}, productName = "", isPreview = false }) {
  const phone = String(settings.phone || "").replace(/\D/g, "");
  if (!phone) {
    return isPreview ? (
      <p className="rounded-lg border border-dashed border-user-line px-3 py-2 text-xs text-user-fg-muted">Add a WhatsApp number in the store editor</p>
    ) : null;
  }
  const url = typeof window !== "undefined" ? window.location.href.split("?")[0] : "";
  const text = [settings.message, productName, url].filter(Boolean).join("\n");
  return (
    <a
      href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#25d366] text-sm font-semibold text-white transition hover:brightness-95"
    >
      <MessageCircle size={17} aria-hidden="true" />
      {settings.label || "Order on WhatsApp"}
    </a>
  );
}

export function TextBlock({ settings = {}, boxed = false }) {
  const clean = useMemo(() => {
    const html = settings.body || "";
    if (!html || typeof window === "undefined" || !DOMPurify.isSupported) return html;
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  }, [settings.body]);
  if (!settings.heading && !clean) return null;
  return (
    <div className={boxed ? "bg-user-card" : ""}>
      {settings.heading ? (
        <h2 className={boxed ? "border-b border-user-line px-3 py-3 text-sm font-bold text-user-fg sm:px-4" : "mb-1.5 text-sm font-bold text-user-fg"}>
          {settings.heading}
        </h2>
      ) : null}
      {clean ? (
        <div
          className={`user-rich-text text-sm leading-relaxed text-user-fg-secondary ${boxed ? "px-3 py-4 sm:px-4" : ""}`}
          dangerouslySetInnerHTML={{ __html: clean }}
        />
      ) : null}
    </div>
  );
}

/** Info zone (Buy buttons ke neeche) */
export function ProductInfoBlocks({ productName }) {
  const { template, isPreview, selectedSectionId } = useProductTemplate();
  const entries = zoneEntries(template.info);
  if (!entries.length) return null;
  return (
    <div className="mt-4 space-y-3">
      {entries.map(([id, block]) => (
        <EditableProductBlock key={id} zone="info" id={id} isPreview={isPreview} selectedSectionId={selectedSectionId}>
          {block.type === "trust_badges" ? <TrustBadges settings={block.settings} compact /> : null}
          {block.type === "delivery_estimate" ? <DeliveryEstimate settings={block.settings} /> : null}
          {block.type === "whatsapp_button" ? <WhatsAppButton settings={block.settings} productName={productName} isPreview={isPreview} /> : null}
          {block.type === "text_block" ? <TextBlock settings={block.settings} /> : null}
        </EditableProductBlock>
      ))}
    </div>
  );
}
