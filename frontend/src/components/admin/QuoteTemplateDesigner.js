"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { storeApi } from "@/apis/admin/storeApi";
import { Check, ChevronDown, Palette, RotateCcw } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Design constants that match the user's reference screenshot      */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "quote-template-settings-v1";
const DEFAULT_DESIGN = {
  template: "Bold",
  headerLayout: "band",
  accentColor: "#dc2626",
  fontFamily: "helvetica",
  fontSize: 9,
  bodyFontSize: 9,
  baseFontSize: 13,
  pageSize: "a4",
  orientation: "portrait",
  titleSize: 26,
  boldTitles: true,
  boldBody: false,
  italicBody: false,
  italicNotes: false,
  useCompanyLogo: true,
  watermark: false,
  watermarkUseLogo: true,
  watermarkText: "PAID",
  watermarkPosition: "center",
  watermarkOpacity: 14,
  watermarkSize: 50,
  showTerms: true,
  showPageNumbers: true,
  showSignature: false,
  showDescription: true,
  showDiscount: true,
  showTax: true,
  showSku: true,
  logoData: null,
  logoWidth: 30,
  logoAlignment: "left",
  logoOffset: 0,
  lineSpacing: 1.15,
  decimalPrecision: 2,
  currencySymbol: "PKR",
  customTypography: false,
};

const QUOTE_TEMPLATES = [
  { name: "Modern", subtitle: "Freelance", color: "#3567e8", tone: "#f5f8ff", layout: "band" },
  { name: "Minimal", subtitle: "Design", color: "#111827", tone: "#ffffff", layout: "minimal" },
  { name: "Corporate", subtitle: "Enterprise", color: "#233d63", tone: "#f5f7fa", layout: "band" },
  { name: "Elegant", subtitle: "Luxury", color: "#80613a", tone: "#faf7f1", layout: "center" },
  { name: "Blue", subtitle: "Small Business", color: "#2473a7", tone: "#f3f8fb", layout: "band" },
  { name: "Dark", subtitle: "Technology", color: "#111827", tone: "#f4f5f7", layout: "band" },
  { name: "Startup", subtitle: "SaaS", color: "#2e9788", tone: "#f2faf8", layout: "band" },
  { name: "Agency", subtitle: "Marketing", color: "#483cc7", tone: "#f5f4ff", layout: "split" },
  { name: "Creative", subtitle: "Creative Arts", color: "#d5177e", tone: "#fff5fa", layout: "center" },
  { name: "Classic", subtitle: "Accounting", color: "#374151", tone: "#f7f7f6", layout: "minimal" },
  { name: "Nordic", subtitle: "Architecture", color: "#64748b", tone: "#f6f8fa", layout: "split" },
  { name: "Emerald", subtitle: "Healthcare", color: "#29966b", tone: "#f1faf5", layout: "band" },
  { name: "Sunset", subtitle: "Hospitality", color: "#e94f1b", tone: "#fff6f1", layout: "split" },
  { name: "Slate", subtitle: "Legal", color: "#475569", tone: "#f5f7fa", layout: "minimal" },
  { name: "Bold", subtitle: "Sales", color: "#dc2626", tone: "#fff4f5", layout: "band" },
  { name: "Lavender", subtitle: "Beauty", color: "#7b3fe4", tone: "#f8f5ff", layout: "center" },
  { name: "Ocean", subtitle: "Consulting", color: "#287d91", tone: "#f1f8fa", layout: "split" },
  { name: "Mono", subtitle: "Software", color: "#18181b", tone: "#f4f4f5", layout: "minimal" },
];

const FONT_OPTIONS = [
  "Arial",
  "Helvetica",
  "Verdana",
  "Tahoma",
  "Georgia",
  "Times New Roman",
  "Courier New",
];

const FONT_MAP = {
  Arial: "helvetica",
  Helvetica: "helvetica",
  Verdana: "helvetica",
  Tahoma: "helvetica",
  Georgia: "times",
  "Times New Roman": "times",
  "Courier New": "courier",
};

const TITLE_OPTIONS = [
  { value: 18, label: "H3 - Small" },
  { value: 22, label: "H2 - Medium" },
  { value: 26, label: "H1 - Large" },
  { value: 30, label: "Display - Extra large" },
];

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ""));
  return m ? [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)] : [20, 20, 20];
}

function tintRgb(hex, ratio) {
  const rgb = hexToRgb(hex);
  return `rgb(${rgb.map((c) => Math.round(c + (255 - c) * ratio)).join(", ")})`;
}

/* ------------------------------------------------------------------ */
/*  Helper to read and save design settings                             */
/* ------------------------------------------------------------------ */

function readSaved() {
  if (typeof window === "undefined") return DEFAULT_DESIGN;
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
    const selectedName = QUOTE_TEMPLATES.some((t) => t.name === saved.selected) ? saved.selected : DEFAULT_DESIGN.template;
    const theme = QUOTE_TEMPLATES.find((t) => t.name === selectedName) || QUOTE_TEMPLATES[0];
    return {
      ...DEFAULT_DESIGN,
      ...saved,
      selected: selectedName,
      template: theme.name.toLowerCase(),
      accentColor: /^#[0-9a-f]{6}$/i.test(saved.accentColor || "") ? saved.accentColor : theme.color,
      fontFamily: FONT_OPTIONS.includes(saved.fontFamily) ? FONT_MAP[saved.fontFamily] || DEFAULT_DESIGN.fontFamily : DEFAULT_DESIGN.fontFamily,
      titleSize: TITLE_OPTIONS.some((o) => o.value === Number(saved.titleSize)) ? Number(saved.titleSize) : DEFAULT_DESIGN.titleSize,
      baseFontSize: clamp(Number(saved.baseFontSize) || DEFAULT_DESIGN.baseFontSize, 9, 18),
    };
  } catch {
    return DEFAULT_DESIGN;
  }
}

/* The function the page needs to build the PDF design payload */
export function getSavedQuotePdfDesign() {
  const saved = readSaved();
  const theme = QUOTE_TEMPLATES.find((t) => t.name.toLowerCase() === (saved.template || saved.selected?.toLowerCase())) || QUOTE_TEMPLATES[0];
  const scale = clamp((saved.baseFontSize || 13) / 13, 0.75, 1.45);
  return {
    template: theme.name.toLowerCase(),
    accentColor: saved.accentColor || theme.color,
    headerLayout: saved.headerLayout || "band",
    fontFamily: saved.fontFamily,
    fontSize: 9 * scale,
    bodyFontSize: 9,
    titleSize: (saved.titleSize || 18) * 0.75,
    boldTitles: saved.boldTitles !== false,
    boldBody: Boolean(saved.boldBody),
    italicBody: Boolean(saved.italicBody),
    italicNotes: Boolean(saved.italicNotes),
    useCompanyLogo: saved.useCompanyLogo !== false,
    logoData: saved.logoData || null,
    logoWidth: Math.max(12, Math.min(50, Number(saved.logoWidth) || 24)),
    logoAlignment: saved.logoAlignment || "left",
    logoOffset: Number(saved.logoOffset) || 0,
    pageSize: saved.pageSize || "a4",
    orientation: saved.orientation || "portrait",
    pageHeight: 297,
    watermark: Boolean(saved.watermark),
    watermarkUseLogo: Boolean(saved.watermarkUseLogo),
    watermarkText: String(saved.watermarkText || "PAID").slice(0, 40),
    watermarkPosition: saved.watermarkPosition || "center",
    watermarkOpacity: clamp(Number(saved.watermarkOpacity) || 14, 5, 40),
    watermarkSize: clamp(Number(saved.watermarkSize) || 50, 20, 100),
    showTerms: saved.showTerms !== false,
    showPageNumbers: saved.showPageNumbers !== false,
    showSignature: Boolean(saved.showSignature),
    signatureMode: saved.signatureMode || "typed",
    signatureName: String(saved.signatureName || "").slice(0, 100),
    showDescription: saved.showDescription !== false,
    showDiscount: saved.showDiscount !== false,
    showTax: saved.showTax !== false,
    showSku: saved.showSku !== false,
    lineSpacing: Number(saved.lineSpacing) || 1.15,
    decimalPrecision: 2,
    currencySymbol: saved.currencySymbol || "PKR",
    dateFormat: "locale",
    customTypography: Boolean(saved.customTypography),
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                            */
/* ------------------------------------------------------------------ */

export default function QuoteTemplateDesigner({ form, totals, quoteNumber, savedDesign, money, onBrowseProducts, onFieldChange, onUpdateItem, onRemoveItem, discountType, discountValue, onDiscountTypeChange, onDiscountValueChange, taxRate, onTaxRateChange }) {
  const [design, setDesign] = useState(() => ({ ...DEFAULT_DESIGN, ...readSaved(), ...(savedDesign || {}) }));
  const [loaded, setLoaded] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState("preview");

  const { data: store = null } = useQuery({
    queryKey: ["store-public"],
    queryFn: () => storeApi.getPublic(),
    staleTime: 5 * 60 * 1000,
  });

  /* Persist to localStorage */
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        selected: QUOTE_TEMPLATES.find((t) => t.name.toLowerCase() === design.template)?.name || design.selected || DEFAULT_DESIGN.template,
        customColor: design.accentColor || design.color,
        fontFamily: FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily) || "Arial",
        baseFontSize: design.baseFontSize || DEFAULT_DESIGN.baseFontSize,
        titleSize: design.titleSize || DEFAULT_DESIGN.titleSize,
        customTypography: design.customTypography,
        boldTitles: design.boldTitles,
        boldBody: design.boldBody,
        italicBody: design.italicBody,
        italicNotes: design.italicNotes,
        useCompanyLogo: design.useCompanyLogo,
        showWatermark: design.watermark,
        watermarkUseLogo: design.watermarkUseLogo,
        watermarkText: design.watermarkText,
        watermarkOpacity: design.watermarkOpacity,
        headerLayout: design.headerLayout,
        orientation: design.orientation,
        pageSize: design.pageSize,
      }));
    } catch { /* storage unavailable */ }
  }, [loaded, design]);

  const theme = QUOTE_TEMPLATES.find(
    (t) => t.name.toLowerCase() === (design.template || design.selected?.toLowerCase())
  ) || QUOTE_TEMPLATES.find((t) => t.name.toLowerCase() === "bold") || QUOTE_TEMPLATES[0];

  const companyLogoUrl = store?.logo?.img_url ? (() => {
    const url = store.logo.img_url;
    if (!url || /^(https?:|blob:|data:)/i.test(url)) return url || "";
    const origin = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
    return origin ? `${origin}${url.startsWith("/") ? url : `/${url}`}` : url;
  })() : "";

  const accent = design.accentColor || theme.color || "#dc2626";
  const companyName = store?.store_name || "Your company";
  const initials = String(companyName || "CO").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "CO";
  const companyPhone = store?.support_phone || store?.phone || "";
  const companyEmail = store?.support_email || store?.email || "";
  const companyWebsite = store?.website || store?.website_url || store?.store_url || "";
  const countryNames = { PK: "Pakistan", US: "United States", GB: "United Kingdom", AE: "United Arab Emirates", IN: "India", CA: "Canada", AU: "Australia" };
  const addressLine = [store?.address, store?.city, store?.state, store?.zip_code, countryNames[String(store?.country || "").toUpperCase()] || store?.country].filter(Boolean).join(", ");
  const displayQuoteNumber = quoteNumber && quoteNumber !== "Draft quote" ? quoteNumber : "Assigned when saved";

  const formatDate = (value) => {
    if (!value) return "â€”";
    const parsed = new Date(`${String(value).length <= 10 ? `${value}T00:00:00` : value}`);
    return Number.isNaN(parsed.getTime()) ? "â€”" : parsed.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  };

  const currency = (value) => new Intl.NumberFormat("en-PK", { style: "currency", currency: design.currencySymbol || "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
  const labelClass = "block text-[10px] font-semibold text-[var(--text-secondary)]";
  const inputClass = "h-9 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
  const selectClass = inputClass + " cursor-pointer";
  const buttonClass = (active) => `group flex flex-col gap-1 rounded-xl border p-2.5 text-left transition ${active ? "border-slate-900 bg-[var(--bg-card)] ring-2 ring-slate-900/10" : "border-[var(--border-color)] bg-[var(--bg-card)] hover:-translate-y-px hover:border-slate-400 hover:shadow-sm"}`;

  /* ------------------- Live preview article ---------------------- */
  const items = (form?.items || []).filter((it) => it.name || it.variant_name);
  const previewItems = items.map((item, index) => {
    const gross = Number(item.quantity || 0) * Number(item.unit_price || 0);
    const discount = gross * Number(item.discount_rate || 0) / 100;
    const tax = (gross - discount) * Number(item.tax_rate || 0) / 100;
    return { ...item, gross, discount, tax, amount: gross - discount + tax, index: index + 1 };
  });

  const isAgencyLayout = design.template === "agency";
  const isMonoLayout = design.template === "mono";
  const isBoldLayout = design.template === "bold" || design.headerLayout === "band";
  const isMinimalLayout = theme.layout === "minimal";
  const isCenteredLayout = theme.layout === "center" || design.headerLayout === "centered";
  const isSplitLayout = theme.layout === "split" || design.headerLayout === "split";

  const headerBackground = isBoldLayout ? accent : isMinimalLayout ? "#fff" : isCenteredLayout ? theme.tone || "#f8fafc" : design.accentColor || theme.color;
  const headerText = isBoldLayout ? "#fff" : isCenteredLayout ? design.accentColor || theme.color : design.accentColor || theme.color;

  const previewScale = clamp((design.baseFontSize || 13) / 13, 0.75, 1.4);

  /* ------------------- Component return ------------------------- */
  return (
    <section className="mt-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_8px_24px_rgba(15,23,42,0.045)]" aria-labelledby="doc-design-heading">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-sm"><Palette size={16} /></span>
          <div>
            <h2 id="doc-design-heading" className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-primary)]">Document design</h2>
            <p className="text-[10px] text-[var(--text-muted)]">Choose the template, typography and branding saved with this document.</p>
          </div>
        </div>
        <button type="button" onClick={() => { setDesign(DEFAULT_DESIGN); } } className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-color)] px-2.5 text-[10px] font-semibold text-[var(--text-secondary)] transition hover:border-slate-400 hover:text-[var(--text-primary)]">
          <RotateCcw size={11} /> Reset design
        </button>
      </div>

      <div className="grid gap-3 p-3.5 lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.35fr)] lg:p-4">
        {/* ---- Left panel ---- */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
          <h3 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-secondary)] px-3.5 pt-3">Template & typography</h3>
          <div className="grid grid-cols-2 gap-1.5 px-3.5 pt-2.5 sm:grid-cols-3">
            {QUOTE_TEMPLATES.map((t) => {
              const active = (design.template || design.template || design.template || design.selected) === t.name.toLowerCase() || (design.template ? false : (design.selected || DEFAULT_DESIGN.template) === t.name);
              return (
                <button key={t.name} type="button" aria-pressed={active} onClick={() => setDesign((prev) => ({ ...prev, selected: t.name, template: t.name.toLowerCase(), accentColor: t.color, headerLayout: t.layout === "center" ? "centered" : t.layout }))} className={buttonClass(active)}>
                  <span className="mb-1.5 block h-5 w-full rounded-full shadow-inner" style={{ background: t.color }} />
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold leading-tight text-[var(--text-primary)]">{t.name}</span>
                    {active && <Check size={11} className="shrink-0 text-slate-900" />}
                  </span>
                  <span className="text-[9px] leading-tight text-[var(--text-muted)]">{t.subtitle}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-[var(--border-color)] px-3.5 pt-3">
            <label className={labelClass} htmlFor="accent-color">Accent color</label>
            <label htmlFor="accent-color" className="mt-1.5 flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5">
              <span className="relative h-6 w-6 shrink-0 rounded-lg ring-1 ring-black/10 overflow-hidden shadow-inner">
                <input id="accent-color" type="color" value={design.accentColor || theme.color} onChange={(e) => setDesign((prev) => ({ ...prev, accentColor: e.target.value }))} aria-label="Accent color" className="absolute -left-2 -top-2 h-11 w-11 border-0 bg-transparent p-0 cursor-pointer" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{design.accentColor || theme.color}</span>
            </label>
          </div>

          <div className="mt-3 border-t border-[var(--border-color)] px-3.5 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Font family
                <select className={selectClass} value={FONT_OPTIONS.includes(FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily) || "Arial") ? (FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily) || "Arial") : "Arial"} onChange={(e) => setDesign((prev) => ({ ...prev, fontFamily: FONT_MAP[e.target.value] || "helvetica", customTypography: true }))}>
                  <option>Arial (default)</option>
                  {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className={labelClass}>Title size
                <select className={selectClass} value={design.titleSize || 26} onChange={(e) => setDesign((prev) => ({ ...prev, titleSize: Number(e.target.value) }))}>
                  {TITLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
              <label className={labelClass}>Base font size ({design.baseFontSize || 13}px)
                <input type="range" min="9" max="18" step="1" value={design.baseFontSize || 13} onChange={(e) => setDesign((prev) => ({ ...prev, baseFontSize: Number(e.target.value) }))} className="mt-3 block w-full" style={{ accentColor: "#16a34a" }} />
              </label>
            </div>
          </div>

          <div className="mt-3 border-t border-[var(--border-color)] px-3.5 pt-3">
            <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Typography & spacing</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                ["Bold titles", "boldTitles"],
                ["Bold body text", "boldBody"],
                ["Italic body text", "italicBody"],
                ["Italic notes", "italicNotes"],
                ["Use custom typography", "customTypography"],
              ].map(([label, key]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-color)] px-2.5 py-2 text-[10px] font-medium text-[var(--text-secondary)] hover:border-blue-300 transition">
                  <input type="checkbox" checked={!!design[key]} onChange={(e) => setDesign((prev) => ({ ...prev, [key]: e.target.checked }))} className="h-3.5 w-3.5 rounded" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <details className="group mt-3 border-t border-[var(--border-color)] pt-2.5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              Branding
              <ChevronDown size={13} className="text-[var(--text-muted)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 space-y-2 px-0.5">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2.5 text-[10px] font-medium text-[var(--text-secondary)] transition hover:border-slate-300">
                <input type="checkbox" checked={design.useCompanyLogo} onChange={(e) => setDesign((prev) => ({ ...prev, useCompanyLogo: e.target.checked }))} className="h-3.5 w-3.5 rounded" /> Use company logo
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2.5 text-[10px] font-medium text-[var(--text-secondary)] transition hover:border-slate-300">
                <input type="checkbox" checked={design.watermark} onChange={(e) => setDesign((prev) => ({ ...prev, watermark: e.target.checked }))} className="h-3.5 w-3.5 rounded" /> Show watermark
              </label>
              {design.watermark && (
                <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50/40 p-2.5">
                  <label className="flex cursor-pointer items-center gap-2 text-[10px] font-medium text-[var(--text-secondary)]">
                    <input type="checkbox" checked={design.watermarkUseLogo} onChange={(e) => setDesign((prev) => ({ ...prev, watermarkUseLogo: e.target.checked }))} className="h-3.5 w-3.5 rounded" /> Use company logo as watermark
                  </label>
                  {!design.watermarkUseLogo && (
                    <label className="block text-[10px] font-medium text-[var(--text-secondary)]">
                      Watermark text
                      <input value={design.watermarkText || ""} onChange={(e) => setDesign((prev) => ({ ...prev, watermarkText: e.target.value.slice(0, 40) }))} maxLength={40} className="mt-1 h-8 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2 text-[11px] outline-none focus:border-blue-500" placeholder="PAID" />
                    </label>
                  )}
                  <label className="block text-[10px] font-medium text-[var(--text-secondary)]">
                    Watermark opacity ({design.watermarkOpacity || 14}%)
                    <input type="range" min="5" max="40" value={design.watermarkOpacity || 14} onChange={(e) => setDesign((prev) => ({ ...prev, watermarkOpacity: Number(e.target.value) }))} className="mt-1.5 block w-full" />
                  </label>
                </div>
              )}
            </div>
          </details>
        </div>

        {/* ---- Right panel preview ---- */}
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)] px-3.5 py-2.5 bg-[var(--bg-tertiary)]/40">
            <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Live preview â€” {theme.name}</h3>
            <div className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-0.5" role="tablist" aria-label="Quote workspace mode">
              {["edit", "preview"].map((mode) => <button key={mode} type="button" role="tab" aria-selected={workspaceMode === mode} onClick={() => setWorkspaceMode(mode)} className={`rounded-md px-2.5 py-1.5 text-[9px] font-bold capitalize transition ${workspaceMode === mode ? "bg-blue-600 text-white shadow-sm" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}>{mode}</button>)}
            </div>
          </div>
          <div className="bg-[var(--bg-tertiary)] p-3 sm:p-4">
            {workspaceMode === "edit" ? (
              <div className="mx-auto max-w-[760px] space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="text-sm font-bold text-[var(--text-primary)]">Edit quote document</h4><p className="text-[10px] text-[var(--text-muted)]">Edit the quote content here. Changes are reflected in Preview.</p></div><button type="button" onClick={onBrowseProducts} className="h-9 rounded-lg bg-blue-600 px-3.5 text-[10px] font-bold text-white shadow-sm hover:bg-blue-700">+ Add product</button></div>

                <section className="rounded-lg border border-[var(--border-color)] p-3"><div className="mb-2 flex items-center justify-between"><h5 className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Products &amp; items</h5><span className="text-[9px] text-[var(--text-muted)]">{form?.items?.length || 0} items</span></div>
                  {form?.items?.length ? <div className="space-y-2">{form.items.map((item, index) => <div key={item.row_id || item._id || index} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/40 p-2.5"><div className="mb-2 flex items-center gap-2"><div className="min-w-0 flex-1"><input value={item.name || ""} onChange={(event) => onUpdateItem(item.row_id, "name", event.target.value)} className={inputClass} aria-label={`Product ${index + 1} name`} />{item.sku && <p className="mt-1 text-[9px] text-[var(--text-muted)]">SKU {item.sku}</p>}</div><button type="button" onClick={() => onRemoveItem(item.row_id)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50">Remove</button></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["Quantity", "quantity", 1], ["Unit price", "unit_price", 0], ["Discount %", "discount_rate", 0], ["Tax %", "tax_rate", 0]].map(([title, key, min]) => <label key={key} className={labelClass}>{title}<input type="number" min={min} max={key.includes("rate") ? 100 : undefined} step={key === "quantity" ? 1 : 0.01} value={item[key] ?? 0} onChange={(event) => onUpdateItem(item.row_id, key, event.target.value)} className={inputClass} /></label>)}</div></div>)}</div> : <div className="rounded-lg border border-dashed border-[var(--border-color)] p-5 text-center text-[10px] text-[var(--text-muted)]">No products added. Use Add product to choose from the catalog.</div>}
                </section>
                <section className="grid gap-2 rounded-lg border border-[var(--border-color)] p-3 sm:grid-cols-2"><h5 className="sm:col-span-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">Totals</h5><label className={labelClass}>Quote discount type<select value={discountType} onChange={(event) => onDiscountTypeChange(event.target.value)} className={selectClass}><option value="percent">Percent</option><option value="flat">Fixed amount</option></select></label><label className={labelClass}>Quote discount<input type="number" min="0" step="0.01" value={discountValue} onChange={(event) => onDiscountValueChange(event.target.value)} className={inputClass} /></label><label className={labelClass}>Additional tax %<input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => onTaxRateChange(event.target.value)} className={inputClass} /></label><div className="self-end space-y-1 text-right text-[10px] text-[var(--text-secondary)]"><p>Subtotal {money(totals?.subtotal)} · Discount {money(totals?.discount)} · Tax {money(totals?.tax)}</p><p className="text-xs font-extrabold text-[var(--text-primary)]">Grand total {money(totals?.total)}</p></div></section>
                <section className="grid gap-2 sm:grid-cols-2"><label className={labelClass}>Quote notes<textarea value={form?.notes || ""} onChange={(event) => onFieldChange("notes", event.target.value)} rows={3} maxLength={1000} className="mt-1.5 w-full resize-y rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2.5 text-xs" /></label></section>
              </div>            ) : (
            /* Preview container with safe zoom */
            <div style={{ overflow: "hidden", position: "relative" }}>
              <article
                className="relative mx-auto bg-white text-slate-800 shadow-lg ring-1 ring-black/5 max-w-[680px] overflow-hidden rounded-sm"
                style={{
                  fontFamily: design.customTypography ? (FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily) ? `"${FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily)}", sans-serif` : "Arial, sans-serif") : "Arial, sans-serif",
                  fontSize: "13px",
                  fontWeight: design.boldBody ? 700 : 400,
                  fontStyle: design.italicBody ? "italic" : "normal",
                  zoom: previewScale,
                  width: `${100 / previewScale}%`,
                  maxWidth: `${680 / previewScale}px`,
                  margin: "0 auto",
                  minHeight: isAgencyLayout ? "790px" : undefined,
                }}
              >
                {isAgencyLayout && <aside className="absolute inset-y-0 left-0 z-10 flex w-[30%] flex-col px-4 py-6 text-white sm:px-5" style={{ background: accent }}>
                  {design.useCompanyLogo && companyLogoUrl && <Image src={companyLogoUrl} alt="Company logo" width={120} height={48} unoptimized className="mb-4 h-8 w-auto max-w-24 object-contain" />}
                  <p className="text-[10px] font-bold">{companyName}</p><h3 className="mt-7 text-2xl font-extrabold tracking-wide">QUOTE</h3>
                  <div className="mt-4 space-y-3 text-[9px]"><div><p className="font-semibold text-white/70">QUOTE #</p><p className="mt-0.5 font-bold">{displayQuoteNumber}</p></div><div><p className="font-semibold text-white/70">ISSUED</p><p className="mt-0.5 font-bold">{formatDate(form?.quote_date)}</p></div><div><p className="font-semibold text-white/70">DUE</p><p className="mt-0.5 font-bold">{formatDate(form?.expiry_date)}</p></div><div><p className="font-semibold text-white/70">TOTAL</p><p className="mt-0.5 text-sm font-extrabold">{money(totals?.total)}</p></div></div>
                </aside>}
                {/* Header */}
                {!isAgencyLayout && (design.template === "bold" ? (
                  <header className="relative min-h-[112px] overflow-hidden border-b-2 border-slate-100 bg-white px-5 py-5 sm:px-7">
                    <div className="pointer-events-none absolute right-0 top-0 h-full w-[42%]" style={{ background: accent, clipPath: "polygon(42% 0, 100% 0, 100% 100%, 72% 100%)" }} />
                    <div className="relative z-10 flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-2">{design.useCompanyLogo && companyLogoUrl ? <Image src={companyLogoUrl} alt="Logo" width={120} height={48} unoptimized className="mt-1 h-8 w-auto max-w-[90px] object-contain" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-900 text-[11px] font-black text-white">{initials}</span>}<p className="truncate pt-2 text-[11px] font-extrabold text-slate-900">{companyName}</p></div><div className="relative z-10 shrink-0 pt-1 text-right text-white"><p className="font-extrabold leading-none tracking-wide" style={{ fontSize: `${clamp(design.titleSize + 12, 34, 48)}px` }}>QUOTE</p><p className="mt-1 text-[8px]">Quote # {displayQuoteNumber}</p></div></div>
                    <div className="absolute bottom-0 left-6 right-6 h-[2px]" style={{ background: accent }} />
                  </header>
                ) : isMinimalLayout ? (
                  <header className="relative border-b-[3px] px-5 pb-3 pt-5 sm:px-7" style={{ borderColor: accent }}>
                    {isMonoLayout && <span className="absolute inset-x-0 top-0 h-[7px] bg-zinc-900" />}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        {design.useCompanyLogo && companyLogoUrl ? <Image src={companyLogoUrl} alt="Logo" width={100} height={32} unoptimized className="h-7 w-auto max-w-[70px] object-contain" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-900 text-[11px] font-black text-white">{initials}</span>}
                        <div>
                          <p className="truncate text-[11px] font-extrabold">{companyName}</p>

                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold tracking-wide" style={{ fontSize: `${clamp(design.titleSize + 12, 34, 48)}px`, color: accent }}>QUOTE</p>
                        <p className="mt-0.5 text-[8px] text-slate-500">Quote # {displayQuoteNumber}</p>
                      </div>
                    </div>
                  </header>
                ) : isCenteredLayout ? (
                  <header className="text-center px-5 pt-5 pb-4 sm:px-7" style={{ background: theme.tone || "#f8fafc" }}>
                    <div className="flex justify-center">
                      {design.useCompanyLogo && companyLogoUrl ? <Image src={companyLogoUrl} alt="Logo" width={120} height={48} unoptimized className="h-8 w-auto max-w-[86px] object-contain" /> : <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-900 text-[11px] font-black text-white">{initials}</span>}
                    </div>
                    <p className="mt-2 font-extrabold uppercase tracking-[0.2em]" style={{ fontSize: `${clamp(design.titleSize + 10, 34, 48)}px`, color: accent }}>QUOTE</p>
                    <p className="mt-1 text-[9px] font-bold text-slate-700">{companyName}</p>
                    <p className="mt-1 text-[8px] text-slate-500">Quote # {displayQuoteNumber}</p>
                  </header>
                ) : isSplitLayout ? (
                  <header className="flex items-center justify-between gap-4 px-5 pt-5 px-3 pb-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {design.useCompanyLogo && companyLogoUrl ? <Image src={companyLogoUrl} alt="Logo" width={96} height={36} unoptimized className="h-7 w-auto max-w-[70px] object-contain" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-900 text-[10px] font-black text-white">{initials}</span>}
                      <div className="min-w-0">
                        <p className="truncate text-[10.5px] font-extrabold">{companyName}</p>

                      </div>
                    </div>
                    <div className="rounded-bl-xl px-3 py-1.5 text-right" style={{ background: tintRgb(accent, 0.92) }}>
                      <p className="font-extrabold tracking-wide" style={{ fontSize: `${clamp(design.titleSize + 12, 34, 48)}px`, color: accent }}>QUOTE</p>
                      <p className="text-[7.5px] text-slate-600">Quote # {displayQuoteNumber}</p>
                    </div>
                  </header>
                ) : (
                  <header className="flex items-start justify-between gap-4 px-6 py-5 sm:px-9" style={{ background: accent, color: "#fff" }}>
                    <div className="flex min-w-0 items-start gap-3">
                      {design.useCompanyLogo && companyLogoUrl ? <Image src={companyLogoUrl} alt="Logo" width={120} height={48} unoptimized className="h-9 w-auto max-w-[86px] object-contain" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white/20 text-[11px] font-black text-white">{initials}</span>}
                      <div className="min-w-0">
                        <p className="truncate text-[10.5px] font-extrabold leading-tight">{companyName}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-extrabold leading-none tracking-wide" style={{ fontSize: `${clamp(design.titleSize + 12, 34, 48)}px` }}>QUOTE</p>
                      <p className="mt-1 text-[8px] opacity-90">Quote # {displayQuoteNumber}</p>
                    </div>
                  </header>
                ))}

                {/* Meta row */}
                <div className="px-6 py-4 sm:px-9" style={isAgencyLayout ? { marginLeft: "30%", paddingLeft: "16px", paddingRight: "16px" } : undefined}>
                  {design.watermark && (
                    <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[48%] -translate-x-1/2 -translate-y-1/2 rotate-[-28deg] whitespace-nowrap font-black tracking-[0.2em]" style={{ color: accent, opacity: design.watermarkOpacity / 100, fontSize: 32, zIndex: 10 }}>
                      {design.watermarkUseLogo && companyLogoUrl ? <Image src={companyLogoUrl} alt="" width={220} height={100} unoptimized className="h-auto max-h-24 w-56 object-contain" /> : (design.watermarkText || "PAID")}
                    </div>
                  )}
                  <div className="relative z-0 grid grid-cols-3 gap-3 border-b border-slate-200 pb-4 text-[10px]">
                    <div>
                      <p className="text-[7.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">From</p>
                      <p className="mt-1 text-[10px] font-extrabold text-slate-900">{companyName}</p>
                      {companyPhone && <p className="mt-0.5 text-[8px] leading-relaxed text-slate-500">Phone: {companyPhone}</p>}
                      {companyEmail && <p className="text-[8px] leading-relaxed text-slate-500">Email: {companyEmail}</p>}
                      {addressLine && <p className="text-[7.5px] leading-relaxed text-slate-500">{addressLine}</p>}
                      {companyWebsite && <p className="text-[7.5px] leading-relaxed text-slate-500">{companyWebsite}</p>}
                    </div>
                    <div>
                      <p className="text-[7.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Bill to</p>
                      {form?.customer_name ? (
                        <>
                          <p className="mt-1 text-[10px] font-bold text-slate-900">{form.customer_name}</p>
                          {form.customer_phone && <p className="text-[8px] text-slate-500">Phone: {form.customer_phone}</p>}
                          {form.customer_address && <p className="text-[8px] text-slate-500">{form.customer_address}</p>}
                          {form.customer_email && <p className="text-[8px] text-slate-500">Email: {form.customer_email}</p>}
                        </>
                      ) : (
                        <p className="mt-1 text-[8px] italic text-slate-400">Select a customer</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[7.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Quote date</p>
                      <p className="mt-1 text-[8px] text-slate-500">Quote # {displayQuoteNumber}</p>
                      <p className="mt-1 text-[10px] font-bold text-slate-900">{formatDate(form?.quote_date)}</p>
                      <p className="mt-1.5 text-[8px] text-slate-500">Valid until <span className="font-bold">{formatDate(form?.expiry_date)}</span></p>
                    </div>
                  </div>

                  {/* Table */}
                  <table className="mt-5 w-full text-left text-[9px]">
                    <thead>
                      <tr style={{ background: isBoldLayout ? accent : tintRgb(accent, 0.92), color: isBoldLayout ? "#fff" : accent }}>
                        <th className="px-2.5 py-2 font-bold">Description</th>
                        <th className="px-2 py-2 text-right font-bold">Qty</th>
                        <th className="px-2 py-2 text-right font-bold">Unit price</th>
                        <th className="px-2.5 py-2 text-right font-bold">Discount</th>
                        <th className="px-2 py-2 text-right font-bold">Tax</th>
                        <th className="px-2.5 py-2 text-right font-bold">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-600">
                      {previewItems.map((item) => (
                        <tr key={item.index} className="border-b border-slate-100">
                          <td className="px-2.5 py-3 text-[8.5px]">{[item.name, item.variant_name].filter(Boolean).join(" / ") || `Item ${item.index}`}</td>
                          <td className="px-2 py-3 text-right text-[9px]">{item.quantity}</td>
                          <td className="px-2 py-3 text-right text-[8.5px]">{currency(item.unit_price)}</td>
                          <td className="px-2 py-3 text-right text-[8.5px]">{currency(item.discount)}</td>
                          <td className="px-2 py-3 text-right text-[8.5px]">{currency(item.tax)}</td>
                          <td className="px-2.5 py-3 text-right text-[8.5px] font-semibold">{currency(item.amount)}</td>
                        </tr>
                      ))}
                      {previewItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-2.5 py-4 text-[9px] text-slate-400">No quote items added yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Subtotals */}
                  <div className="ml-auto mt-4 max-w-[230px] space-y-1.5 text-[9px]">
                    <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{currency(totals?.subtotal)}</span></div>
                    {Number(totals?.discount || 0) > 0 && <div className="flex justify-between text-slate-500"><span>Discount</span><span>âˆ’ {currency(totals?.discount || 0)}</span></div>}
                    {Number(totals?.tax || 0) > 0 && <div className="flex justify-between text-slate-500"><span>Tax</span><span>+ {currency(totals?.tax || 0)}</span></div>}
                    <div className="flex justify-between border-t-2 pt-1.5 text-[9.5px] font-extrabold text-slate-900" style={{ borderColor: accent }}>
                      <span>Total</span><span>{currency(totals?.total)}</span>
                    </div>
                  </div>

                  {/* Terms */}
                  {(form?.terms || form?.notes) && <div className="mt-5 border-t border-slate-100 pt-3" style={{ fontStyle: design.italicNotes ? "italic" : "normal" }}>
                    <p className="text-[7.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">Terms &amp; conditions</p>
                    <div className="mt-1.5 text-[8px] leading-5 text-slate-500 space-y-1 whitespace-pre-line">
                      {form.terms && <p>{form.terms}</p>}
                      {form.notes && <p>{form.notes}</p>}
                    </div>
                  </div>}
                </div>
              </article>
            </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
