"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { storeApi } from "@/apis/admin/storeApi";
import { getQuoteHeaderData } from "@/lib/quoteHeaderData";
import { useTranslation } from "@/i18n/LanguageProvider";
import { Check, ChevronDown, Palette } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Design constants that match the user's reference screenshot      */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "quote-template-settings-v1";
export const INVOICE_TEMPLATE_STORAGE_KEY = "invoice-template-settings-v1";
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

  watermark: false,
  watermarkUseLogo: true,
  watermarkText: "PAID",
  watermarkPosition: "center",
  watermarkOpacity: 14,
  watermarkSize: 50,
  showTerms: true,
  showPageNumbers: true,
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
  customTypography: true,
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
  { value: 18, level: "H3", size: "small" },
  { value: 22, level: "H2", size: "medium" },
  { value: 26, level: "H1", size: "large" },
  { value: 30, level: "Display", size: "extraLarge" },
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

function readSaved(storageKey = STORAGE_KEY) {
  if (typeof window === "undefined") return DEFAULT_DESIGN;
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) || "{}");
    const selectedName = QUOTE_TEMPLATES.some((t) => t.name === saved.selected) ? saved.selected : DEFAULT_DESIGN.template;
    const theme = QUOTE_TEMPLATES.find((t) => t.name === selectedName) || QUOTE_TEMPLATES[0];
    return {
      ...DEFAULT_DESIGN,
      ...saved,
      watermark: saved.watermark ?? saved.showWatermark ?? DEFAULT_DESIGN.watermark,
      selected: selectedName,
      template: theme.name.toLowerCase(),
      accentColor: /^#[0-9a-f]{6}$/i.test(saved.accentColor || saved.customColor || "") ? (saved.accentColor || saved.customColor) : theme.color,
      fontFamily: FONT_OPTIONS.includes(saved.fontFamily) ? FONT_MAP[saved.fontFamily] || DEFAULT_DESIGN.fontFamily : DEFAULT_DESIGN.fontFamily,
      titleSize: TITLE_OPTIONS.some((o) => o.value === Number(saved.titleSize)) ? Number(saved.titleSize) : DEFAULT_DESIGN.titleSize,
      baseFontSize: clamp(Number(saved.baseFontSize) || DEFAULT_DESIGN.baseFontSize, 9, 18),
    };
  } catch {
    return DEFAULT_DESIGN;
  }
}

/* The function the page needs to build the PDF design payload */
export function getSavedQuotePdfDesign(storageKey = STORAGE_KEY) {
  const saved = readSaved(storageKey);
  const theme = QUOTE_TEMPLATES.find((t) => t.name.toLowerCase() === (saved.template || saved.selected?.toLowerCase())) || QUOTE_TEMPLATES[0];
  const scale = clamp((saved.baseFontSize || 13) / 13, 0.75, 1.45);
  return {
    template: theme.name.toLowerCase(),
    accentColor: saved.accentColor || theme.color,
    headerLayout: saved.headerLayout || "band",
    fontFamily: saved.fontFamily,
    fontSize: 9 * scale,
    bodyFontSize: 9,
    baseFontSize: saved.baseFontSize || 13,
    titleSize: saved.titleSize || DEFAULT_DESIGN.titleSize,
    boldTitles: saved.boldTitles !== false,
    boldBody: Boolean(saved.boldBody),
    italicBody: Boolean(saved.italicBody),
    italicNotes: Boolean(saved.italicNotes),

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
    showDescription: saved.showDescription !== false,
    showDiscount: saved.showDiscount !== false,
    showTax: saved.showTax !== false,
    showSku: saved.showSku !== false,
    lineSpacing: Number(saved.lineSpacing) || 1.15,
    decimalPrecision: 2,
    currencySymbol: saved.currencySymbol || "PKR",
    dateFormat: "locale",
    customTypography: true,
  };
}

/* ------------------------------------------------------------------ */
/*  Render inline bold markdown (**text**) without showing asterisks     */
/* ------------------------------------------------------------------ */
function renderBoldText(text) {
  if (!text) return null;
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    const m = /^\*\*(.+)\*\*$/.exec(part);
    if (m) return <strong key={i} className="font-semibold text-slate-700">{m[1]}</strong>;
    return <span key={i}>{part}</span>;
  });
}

function QuoteHeaderDetails({ number, status, date, validUntil, labels, className = "", color = "#475569", emphasis = "#0f172a" }) {
  return <div className={`space-y-0.5 text-[8px] leading-snug ${className}`} style={{ color }}>
    <p>{labels.quoteNumber}: <span className="font-semibold" style={{ color: emphasis }}>{number}</span></p>
    <p>{labels.status}: <span className="font-semibold" style={{ color: emphasis }}>{status}</span></p>
    <p>{labels.quoteDate}: <span className="font-semibold" style={{ color: emphasis }}>{date}</span></p>
    <p>{labels.validUntil}: <span className="font-semibold" style={{ color: emphasis }}>{validUntil}</span></p>
  </div>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                            */
/* ------------------------------------------------------------------ */

export default function QuoteTemplateDesigner({ form, totals, quoteNumber, quoteStatus, savedDesign, money, previewOnly = false, onBrowseProducts, onFieldChange, onUpdateItem, onRemoveItem, discountType, discountValue, onDiscountTypeChange, onDiscountValueChange, taxRate, onTaxRateChange, documentType = "quote", storageKey = STORAGE_KEY }) {
  const { t, locale } = useTranslation();
  const isInvoice = documentType === "invoice";
  const [design, setDesign] = useState(() => ({ ...DEFAULT_DESIGN, ...readSaved(storageKey), ...(savedDesign || {}) }));
  const [loaded, setLoaded] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState("preview");
  const settingsPanelRef = useRef(null);
  const watermarkSettingsRef = useRef(null);

  const { data: store = null } = useQuery({
    queryKey: ["store-public"],
    queryFn: () => storeApi.getPublic(),
    staleTime: 5 * 60 * 1000,
  });

  /* Persist to localStorage */
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        selected: QUOTE_TEMPLATES.find((t) => t.name.toLowerCase() === design.template)?.name || design.selected || DEFAULT_DESIGN.template,
        customColor: design.accentColor || design.color,
        accentColor: design.accentColor || design.color,
        fontFamily: FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily) || "Arial",
        baseFontSize: design.baseFontSize || DEFAULT_DESIGN.baseFontSize,
        titleSize: design.titleSize || DEFAULT_DESIGN.titleSize,
        customTypography: design.customTypography,
        boldTitles: design.boldTitles,
        boldBody: design.boldBody,
        italicBody: design.italicBody,
        italicNotes: design.italicNotes,

        showWatermark: design.watermark,
        watermarkUseLogo: design.watermarkUseLogo,
        watermarkText: design.watermarkText,
        watermark: design.watermark,
        watermarkOpacity: design.watermarkOpacity,
        watermarkSize: design.watermarkSize,
        watermarkPosition: design.watermarkPosition,
        headerLayout: design.headerLayout,
        orientation: design.orientation,
        pageSize: design.pageSize,
        showTerms: design.showTerms,
        showPageNumbers: design.showPageNumbers,
        showDescription: design.showDescription,
        showDiscount: design.showDiscount,
        showTax: design.showTax,
        showSku: design.showSku,
      }));
    } catch { /* storage unavailable */ }
  }, [loaded, design, storageKey]);

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
  const companyName = store?.store_name || t("admin.quoteDesigner.yourCompany");
  const initials = String(companyName || "CO").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "CO";
  const companyPhone = store?.support_phone || store?.phone || "";
  const companyEmail = store?.support_email || store?.email || "";
  const companyWebsite = store?.website || store?.website_url || store?.store_url || "";
  const countryNames = { PK: "Pakistan", US: "United States", GB: "United Kingdom", AE: "United Arab Emirates", IN: "India", CA: "Canada", AU: "Australia" };
  const addressLine = [store?.address, store?.city, store?.state, store?.zip_code, countryNames[String(store?.country || "").toUpperCase()] || store?.country].filter(Boolean).join(", ");
  const quoteHeaderNumber = isInvoice ? quoteNumber || "Assigned when saved" : getQuoteHeaderData({
    quote_number: quoteNumber === "Draft quote" ? "" : quoteNumber,
    status: quoteStatus,
  }).quoteNumber;
  const displayQuoteNumber = quoteHeaderNumber === "Assigned when saved"
    ? t("admin.quoteInvoice.pdf.assignedWhenSaved")
    : quoteHeaderNumber;
  const normalizedQuoteStatus = String(quoteStatus || "Draft").trim().toLowerCase();
  const displayQuoteStatus = isInvoice
    ? String(quoteStatus || "Unpaid").trim()
    : ["pending", "draft", "sent", "accepted", "rejected"].includes(normalizedQuoteStatus)
    ? t(`admin.quoteInvoice.status.${normalizedQuoteStatus}`)
    : String(quoteStatus || "Draft").trim().toUpperCase();
  const quoteHeaderLabels = {
    quoteNumber: isInvoice ? "Invoice Number" : t("admin.quoteInvoice.pdf.quoteNumber"),
    status: t("admin.quoteInvoice.pdf.status"),
    quoteDate: isInvoice ? t("admin.invoiceDetail.field.invoiceDate") : t("admin.quoteInvoice.pdf.quoteDate"),
    validUntil: isInvoice ? t("admin.invoiceDetail.field.dueDate") : t("admin.quoteInvoice.pdf.validUntil"),
  };

  const formatDate = (value) => {
    if (!value) return "\u2014";
    const parsed = new Date(`${String(value).length <= 10 ? `${value}T00:00:00` : value}`);
    return Number.isNaN(parsed.getTime()) ? "\u2014" : parsed.toLocaleDateString(locale || "en-GB", { year: "numeric", month: "short", day: "numeric" });
  };
  const quoteDateLabel = formatDate(isInvoice ? form?.invoice_date : form?.quote_date);
  const validUntilLabel = formatDate(isInvoice ? form?.due_date : form?.expiry_date);

  const currency = (value) => new Intl.NumberFormat(locale || "en-PK", { style: "currency", currency: design.currencySymbol || "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
  const labelClass = "block text-[10px] font-semibold text-[var(--text-secondary)]";
  const inputClass = "h-9 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
  const selectClass = inputClass + " cursor-pointer";
  const buttonClass = (active) => `group flex flex-col gap-0.5 rounded-lg border p-1.5 text-left transition ${active ? "border-slate-900 bg-[var(--bg-card)] ring-2 ring-slate-900/10" : "border-[var(--border-color)] bg-[var(--bg-card)] hover:-translate-y-px hover:border-slate-400 hover:shadow-sm"}`;

  /* ------------------- Live preview article ---------------------- */
  const items = (form?.items || []).filter((it) => it.name || it.variant_name);
  const previewItems = items.map((item, index) => {
    const gross = Number(item.quantity || 0) * Number(item.unit_price || 0);
    const discount = gross * Number(item.discount_rate || 0) / 100;
    const tax = (gross - discount) * Number(item.tax_rate || 0) / 100;
    return { ...item, gross, discount, tax, amount: gross - discount + tax, index: index + 1 };
  });
  const previewTermsText = String(form?.terms || "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
  const previewTermParagraphs = previewTermsText.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const termsOnSecondPage = design.showTerms !== false && (previewTermsText.length > 650 || previewTermParagraphs.length > 8);

  const isAgencyLayout = design.template === "agency";
  const isMonoLayout = design.template === "mono";
  const isBoldLayout = design.template === "bold" || design.headerLayout === "band";
  const isMinimalLayout = theme.layout === "minimal";
  const isCenteredLayout = theme.layout === "center" || design.headerLayout === "centered";
  const isSplitLayout = theme.layout === "split" || design.headerLayout === "split";

  const headerBackground = isBoldLayout ? accent : isMinimalLayout ? "#fff" : isCenteredLayout ? theme.tone || "#f8fafc" : design.accentColor || theme.color;
  const headerText = isBoldLayout ? "#fff" : isCenteredLayout ? design.accentColor || theme.color : design.accentColor || theme.color;

  const previewScale = clamp((design.baseFontSize || 13) / 13, 0.75, 1.4);
  const watermarkPosition = design.watermarkPosition || "center";
  const watermarkPlacement = {
    center: { left: "50%", top: "48%", transform: "translate(-50%, -50%)" },
    diagonal: { left: "50%", top: "48%", transform: "translate(-50%, -50%) rotate(35deg)" },
    right: { right: "5%", top: "50%", transform: "translateY(-50%)" },
    left: { left: "5%", top: "50%", transform: "translateY(-50%)" },
    "top-right": { right: "5%", top: "25%" },
    "top-left": { left: "5%", top: "25%" },
    "bottom-right": { right: "5%", top: "72%" },
    "bottom-left": { left: "5%", top: "72%" },
  }[watermarkPosition] || { left: "50%", top: "48%", transform: "translate(-50%, -50%)" };
  const watermarkScale = clamp(Number(design.watermarkSize) || 50, 20, 100) / 50;
  const previewPageCount = 1 + Number(termsOnSecondPage);

  /* ------------------- Component return ------------------------- */
  return (
    <section className={`${previewOnly ? "quote-saved-preview " : ""}mt-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_8px_24px_rgba(15,23,42,0.045)]`} aria-labelledby="doc-design-heading">
      <div className={`${previewOnly ? "quote-no-print " : ""}flex items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3`}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-sm"><Palette size={16} /></span>
          <div>
            <h2 id="doc-design-heading" className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-primary)]">{t("admin.quoteDesigner.documentDesign")}</h2>
            <p className="text-[10px] text-[var(--text-muted)]">{t("admin.quoteDesigner.designHint")}</p>
          </div>
        </div>
      </div>

      <div className={`grid gap-3 p-3.5 lg:p-4 ${previewOnly ? "grid-cols-1" : "lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.35fr)]"}`}>
        {/* ---- Left panel ---- */}
        {!previewOnly && <div ref={settingsPanelRef} className="max-h-[min(82vh,900px)] overflow-y-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)]">
          <h3 className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-secondary)] px-3.5 pt-3">{t("admin.quoteDesigner.templatesTypography")}</h3>
          <div className="grid grid-cols-3 gap-1.5 px-3.5 pt-2.5 sm:grid-cols-4 lg:grid-cols-5">
            {QUOTE_TEMPLATES.map((t) => {
              const active = (design.template || design.template || design.template || design.selected) === t.name.toLowerCase() || (design.template ? false : (design.selected || DEFAULT_DESIGN.template) === t.name);
              return (
                <button key={t.name} type="button" aria-pressed={active} onClick={() => setDesign((prev) => ({ ...prev, selected: t.name, template: t.name.toLowerCase(), accentColor: t.color, headerLayout: t.layout === "center" ? "centered" : t.layout }))} className={buttonClass(active)}>
                  <span className="mb-1 block h-3 w-full rounded-full shadow-inner" style={{ background: t.color }} />
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
            <label className={labelClass} htmlFor="accent-color">{t("admin.quoteDesigner.accentColor")}</label>
            <label htmlFor="accent-color" className="mt-1.5 flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5">
              <span className="relative h-6 w-6 shrink-0 rounded-lg ring-1 ring-black/10 overflow-hidden shadow-inner">
                <input id="accent-color" type="color" value={design.accentColor || theme.color} onChange={(e) => setDesign((prev) => ({ ...prev, accentColor: e.target.value }))} aria-label="Accent color" className="absolute -left-2 -top-2 h-11 w-11 border-0 bg-transparent p-0 cursor-pointer" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--text-secondary)]">{design.accentColor || theme.color}</span>
            </label>
          </div>

          <div className="mt-3 border-t border-[var(--border-color)] px-3.5 pt-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>{t("admin.quoteDesigner.fontFamily")}
                <select className={selectClass} value={FONT_OPTIONS.includes(FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily) || "Arial") ? (FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily) || "Arial") : "Arial"} onChange={(e) => setDesign((prev) => ({ ...prev, fontFamily: FONT_MAP[e.target.value] || "helvetica", customTypography: true }))}>
                  {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </label>
              <label className={labelClass}>{t("admin.quoteDesigner.titleSize")}
                <select className={selectClass} value={design.titleSize || 26} onChange={(e) => setDesign((prev) => ({ ...prev, titleSize: Number(e.target.value) }))}>
                  {TITLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.level} - {t(`admin.quoteDesigner.${o.size}`)}</option>)}
                </select>
              </label>
              <label className={labelClass}>{t("admin.quoteDesigner.baseFontSize")} ({design.baseFontSize || 13}px)
                <input type="range" min="9" max="18" step="1" value={design.baseFontSize || 13} onChange={(e) => setDesign((prev) => ({ ...prev, baseFontSize: Number(e.target.value) }))} className="mt-3 block w-full" style={{ accentColor: "#16a34a" }} />
              </label>
            </div>
          </div>

          <div className="mt-3 border-t border-[var(--border-color)] px-3.5 pt-3">
            <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{t("admin.quoteDesigner.typographySpacing")}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                [t("admin.quoteDesigner.boldTitles"), "boldTitles"],
                [t("admin.quoteDesigner.boldBody"), "boldBody"],
                [t("admin.quoteDesigner.italicBody"), "italicBody"],
                [t("admin.quoteDesigner.italicNotes"), "italicNotes"],
              ].map(([label, key]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-color)] px-2.5 py-2 text-[10px] font-medium text-[var(--text-secondary)] hover:border-blue-300 transition">
                  <input type="checkbox" checked={!!design[key]} onChange={(e) => setDesign((prev) => ({ ...prev, [key]: e.target.checked }))} className="h-3.5 w-3.5 rounded" />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <details className="group mt-3 border-t border-[var(--border-color)] pt-2.5" open>
            <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              {t("admin.quoteDesigner.branding")}
              <ChevronDown size={13} className="text-[var(--text-muted)] transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-2 space-y-2 px-0.5">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-color)] px-3 py-2.5 text-[10px] font-medium text-[var(--text-secondary)] transition hover:border-slate-300">
                    <input type="checkbox" checked={design.watermark} onChange={(e) => { const enabled = e.target.checked; setDesign((prev) => ({ ...prev, watermark: enabled })); if (enabled) requestAnimationFrame(() => { const panel = settingsPanelRef.current; const controls = watermarkSettingsRef.current; if (panel && controls) panel.scrollTo({ top: controls.offsetTop - panel.offsetTop + panel.scrollTop, behavior: "smooth" }); }); }} className="h-3.5 w-3.5 rounded" /> {t("admin.quoteDesigner.showWatermark")}
              </label>
              {design.watermark && (
                <div ref={watermarkSettingsRef} className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3 shadow-sm">
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-blue-800">{t("admin.quoteDesigner.watermarkSettings")}</p>
                  <label className="flex cursor-pointer items-center gap-2 text-[10px] font-medium text-[var(--text-secondary)]">
                    <input type="checkbox" checked={design.watermarkUseLogo} onChange={(e) => setDesign((prev) => ({ ...prev, watermarkUseLogo: e.target.checked }))} className="h-3.5 w-3.5 rounded" /> {t("admin.quoteDesigner.logoWatermark")}
                  </label>
                  {!design.watermarkUseLogo && (
                    <label className="block text-[10px] font-medium text-[var(--text-secondary)]">
                      {t("admin.quoteDesigner.watermarkText")}
                      <input value={design.watermarkText || ""} onChange={(e) => setDesign((prev) => ({ ...prev, watermarkText: e.target.value.slice(0, 40) }))} maxLength={40} className="mt-1 h-8 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2 text-[11px] outline-none focus:border-blue-500" placeholder="PAID" />
                    </label>
                  )}
                  <label className="block text-[10px] font-medium text-[var(--text-secondary)]">
                    {t("admin.quoteDesigner.watermarkOpacity")} ({design.watermarkOpacity || 14}%)
                    <input type="range" min="5" max="40" value={design.watermarkOpacity || 14} onChange={(e) => setDesign((prev) => ({ ...prev, watermarkOpacity: Number(e.target.value) }))} className="mt-1.5 block w-full" />
                  </label>
                  <label className="block text-[10px] font-medium text-[var(--text-secondary)]">
                    {t("admin.quoteDesigner.watermarkSize")} ({design.watermarkSize || 50}%)
                    <input type="range" min="20" max="100" value={design.watermarkSize || 50} onChange={(e) => setDesign((prev) => ({ ...prev, watermarkSize: Number(e.target.value) }))} className="mt-1.5 block w-full" />
                  </label>
                  <label className="block text-[10px] font-medium text-[var(--text-secondary)]">
                    {t("admin.quoteDesigner.watermarkPosition")}
                    <select value={watermarkPosition} onChange={(e) => setDesign((prev) => ({ ...prev, watermarkPosition: e.target.value }))} className="mt-1 h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 text-[11px] text-[var(--text-primary)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10">
                      <option value="center">{t("admin.quoteDesigner.center")}</option>
                      <option value="diagonal">{t("admin.quoteDesigner.diagonal")}</option>
                      <option value="right">{t("admin.quoteDesigner.right")}</option>
                      <option value="left">{t("admin.quoteDesigner.left")}</option>
                      <option value="top-right">{t("admin.quoteDesigner.topRight")}</option>
                      <option value="top-left">{t("admin.quoteDesigner.topLeft")}</option>
                      <option value="bottom-right">{t("admin.quoteDesigner.bottomRight")}</option>
                      <option value="bottom-left">{t("admin.quoteDesigner.bottomLeft")}</option>
                    </select>
                  </label>
                </div>
              )}
            </div>
          </details>

        </div>}

        {/* ---- Right panel preview ---- */}
        <div className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <div className={`${previewOnly ? "quote-no-print " : ""}flex items-center justify-between gap-2 border-b border-[var(--border-color)] px-3.5 py-2.5 bg-[var(--bg-tertiary)]/40`}>
            <h3 className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-secondary)]">{t("admin.quoteDesigner.livePreview")} - {theme.name}</h3>
            {!previewOnly && <div className="flex items-center gap-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-0.5" role="tablist" aria-label={t("admin.quoteDesigner.editDocument")}>
              {["edit", "preview"].map((mode) => <button key={mode} type="button" role="tab" aria-selected={workspaceMode === mode} onClick={() => setWorkspaceMode(mode)} className={`rounded-md px-2.5 py-1.5 text-[9px] font-bold capitalize transition ${workspaceMode === mode ? "bg-blue-600 text-white shadow-sm" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}>{t(`admin.quoteDesigner.${mode}`)}</button>)}
            </div>}
          </div>
          <div className={`${previewOnly ? "bg-[var(--bg-tertiary)] p-3 sm:p-4" : "max-h-[720px] overflow-y-auto bg-[var(--bg-tertiary)] p-3 sm:p-4"}`}>
            {!previewOnly && workspaceMode === "edit" ? (
              <div className="mx-auto max-w-[760px] space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:p-4">
                <div><h4 className="text-sm font-bold text-[var(--text-primary)]">{t("admin.quoteDesigner.editDocument")}</h4><p className="text-[10px] text-[var(--text-muted)]">{t("admin.quoteDesigner.editHint")}</p></div>

                <section className="rounded-lg border border-[var(--border-color)] p-3"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><h5 className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{t("admin.quoteDesigner.productsItems")}</h5><span className="text-[9px] text-[var(--text-muted)]">{form?.items?.length || 0} {t("admin.quoteInvoice.ui.items_7316c8b2")}</span></div><button type="button" onClick={onBrowseProducts} className="h-9 rounded-lg bg-blue-600 px-4 text-[10px] font-bold text-white shadow-sm transition hover:bg-blue-700">{t("admin.quoteDesigner.addProduct")}</button></div>
                  {form?.items?.length ? <div className="space-y-2">{form.items.map((item, index) => <div key={item.row_id || item._id || index} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)]/40 p-2.5"><div className="mb-2 flex items-center gap-2"><div className="min-w-0 flex-1"><input value={item.name || ""} onChange={(event) => onUpdateItem(item.row_id, "name", event.target.value)} className={inputClass} aria-label={`${t("admin.quoteInvoice.ui.product_dd3b86d1")} ${index + 1}`} />{item.sku && <p className="mt-1 text-[9px] text-[var(--text-muted)]">SKU {item.sku}</p>}</div><button type="button" onClick={() => onRemoveItem(item.row_id)} className="rounded-md px-2 py-1 text-[10px] font-semibold text-rose-600 hover:bg-rose-50">{t("admin.quoteDesigner.remove")}</button></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[[t("admin.quoteInvoice.ui.quantity_44f6af69"), "quantity", 1], [t("admin.quoteInvoice.ui.unit_price_3c6c777f"), "unit_price", 0], [t("admin.quoteInvoice.ui.discount_b524936d"), "discount_rate", 0], [t("admin.quoteInvoice.ui.tax_9be70f66"), "tax_rate", 0]].map(([title, key, min]) => <label key={key} className={labelClass}>{title}<input type="number" min={min} max={key.includes("rate") ? 100 : undefined} step={key === "quantity" ? 1 : 0.01} value={item[key] ?? 0} onChange={(event) => onUpdateItem(item.row_id, key, event.target.value)} className={inputClass} /></label>)}</div></div>)}</div> : <div className="rounded-lg border border-dashed border-[var(--border-color)] p-5 text-center text-[10px] text-[var(--text-muted)]">{t("admin.quoteDesigner.noProducts")}</div>}
                </section>
                <section className="grid gap-2 rounded-lg border border-[var(--border-color)] p-3 sm:grid-cols-2"><h5 className="sm:col-span-2 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">{t("admin.quoteDesigner.totals")}</h5><label className={labelClass}>{t("admin.quoteDesigner.discountType")}<select value={discountType} onChange={(event) => onDiscountTypeChange(event.target.value)} className={selectClass}><option value="percent">{t("admin.quoteDesigner.percent")}</option><option value="flat">{t("admin.quoteDesigner.fixedAmount")}</option></select></label><label className={labelClass}>{t("admin.quoteInvoice.ui.discount_b524936d")}<input type="number" min="0" step="0.01" value={discountValue} onChange={(event) => onDiscountValueChange(event.target.value)} className={inputClass} /></label><label className={labelClass}>{t("admin.quoteDesigner.additionalTax")}<input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => onTaxRateChange(event.target.value)} className={inputClass} /></label><div className="self-end space-y-1 text-right text-[10px] text-[var(--text-secondary)]"><p>{t("admin.quoteDesigner.subtotal")} {money(totals?.subtotal)} · {t("admin.quoteInvoice.ui.discount_b524936d")} {money(totals?.discount)} · {t("admin.quoteInvoice.ui.tax_9be70f66")} {money(totals?.tax)}</p><p className="text-xs font-extrabold text-[var(--text-primary)]">{t("admin.quoteDesigner.grandTotal")} {money(totals?.total)}</p></div></section>
                <section className="grid gap-2 sm:grid-cols-2"><label className={labelClass}>{t("admin.quoteDesigner.notes")}<textarea value={form?.notes || ""} onChange={(event) => onFieldChange("notes", event.target.value)} rows={3} maxLength={1000} className="mt-1.5 w-full resize-y rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-2.5 text-xs" /></label></section>
              </div>            ) : (
            /* Preview container with safe zoom */
            <div style={{ overflow: "hidden", position: "relative" }}>
              <article
                data-quote-document-page="true"
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
                  minHeight: termsOnSecondPage ? `${960 / previewScale}px` : isAgencyLayout ? "790px" : undefined,
                }}
              >
                {isAgencyLayout && <aside className="absolute inset-y-0 left-0 z-10 flex w-[30%] flex-col px-4 py-6 text-white sm:px-5" style={{ background: accent }}>
                  {companyLogoUrl && <Image src={companyLogoUrl} alt="Company logo" width={120} height={48} unoptimized className="mb-4 h-8 w-auto max-w-24 object-contain" />}
                  <p className="text-[10px] font-bold">{companyName}</p>
                  <div className="mt-auto pt-6 text-[9px]"><p className="font-semibold text-white/70">{t("admin.quoteInvoice.ui.total_b25928c6").toUpperCase()}</p><p className="mt-0.5 text-sm font-extrabold">{money(totals?.total)}</p></div>
                </aside>}
                {/* Header */}
                {isAgencyLayout && <header className="absolute right-6 top-5 z-20 text-right"><QuoteHeaderDetails number={displayQuoteNumber} status={displayQuoteStatus} labels={quoteHeaderLabels} date={quoteDateLabel} validUntil={validUntilLabel} color="#475569" emphasis={accent} /></header>}
                {!isAgencyLayout && (design.template === "bold" ? (
                  <header className="relative min-h-[112px] overflow-hidden border-b-2 border-slate-100 bg-white px-5 py-5 sm:px-7">
                    <div className="pointer-events-none absolute right-0 top-0 h-full w-[42%]" style={{ background: accent, clipPath: "polygon(42% 0, 100% 0, 100% 100%, 72% 100%)" }} />
                    <div className="relative z-10 flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-2">{companyLogoUrl ? <Image src={companyLogoUrl} alt="Logo" width={120} height={48} unoptimized className="mt-1 h-8 w-auto max-w-[90px] object-contain" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-900 text-[11px] font-black text-white">{initials}</span>}<p className="truncate pt-2 text-[11px] font-extrabold text-slate-900">{companyName}</p></div><div className="relative z-10 shrink-0 pt-1 text-right text-white"><QuoteHeaderDetails number={displayQuoteNumber} status={displayQuoteStatus} labels={quoteHeaderLabels} date={quoteDateLabel} validUntil={validUntilLabel} color="rgba(255,255,255,.82)" emphasis="#ffffff" /></div></div>
                    <div className="absolute bottom-0 left-6 right-6 h-[2px]" style={{ background: accent }} />
                  </header>
                ) : isMinimalLayout ? (
                  <header className="relative border-b-[3px] px-5 pb-3 pt-5 sm:px-7" style={{ borderColor: accent }}>
                    {isMonoLayout && <span className="absolute inset-x-0 top-0 h-[7px] bg-zinc-900" />}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        {companyLogoUrl ? <Image src={companyLogoUrl} alt="Logo" width={100} height={32} unoptimized className="h-7 w-auto max-w-[70px] object-contain" /> : <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-900 text-[11px] font-black text-white">{initials}</span>}
                        <div>
                          <p className="truncate text-[11px] font-extrabold">{companyName}</p>

                        </div>
                      </div>
                      <div className="text-right">
                        <QuoteHeaderDetails number={displayQuoteNumber} status={displayQuoteStatus} labels={quoteHeaderLabels} date={quoteDateLabel} validUntil={validUntilLabel} color="#64748b" emphasis={accent} />
                      </div>
                    </div>
                  </header>
                ) : isCenteredLayout ? (
                  <header className="text-center px-5 pt-5 pb-4 sm:px-7" style={{ background: theme.tone || "#f8fafc" }}>
                    <div className="flex justify-center">
                      {companyLogoUrl ? <Image src={companyLogoUrl} alt="Logo" width={120} height={48} unoptimized className="h-8 w-auto max-w-[86px] object-contain" /> : <span className="flex h-8 w-8 items-center justify-center rounded bg-slate-900 text-[11px] font-black text-white">{initials}</span>}
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-3 text-left"><p className="pt-1 text-[9px] font-bold text-slate-700">{companyName}</p><div className="text-right"><QuoteHeaderDetails number={displayQuoteNumber} status={displayQuoteStatus} labels={quoteHeaderLabels} date={quoteDateLabel} validUntil={validUntilLabel} color="#64748b" emphasis={accent} /></div></div>
                  </header>
                ) : isSplitLayout ? (
                  <header className="flex items-center justify-between gap-4 px-5 pt-5 px-3 pb-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {companyLogoUrl ? <Image src={companyLogoUrl} alt="Logo" width={96} height={36} unoptimized className="h-7 w-auto max-w-[70px] object-contain" /> : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-slate-900 text-[10px] font-black text-white">{initials}</span>}
                      <div className="min-w-0">
                        <p className="truncate text-[10.5px] font-extrabold">{companyName}</p>

                      </div>
                    </div>
                    <div className="rounded-bl-xl px-3 py-1.5 text-right" style={{ background: tintRgb(accent, 0.92) }}><QuoteHeaderDetails number={displayQuoteNumber} status={displayQuoteStatus} labels={quoteHeaderLabels} date={quoteDateLabel} validUntil={validUntilLabel} color="#475569" emphasis={accent} /></div>
                  </header>
                ) : (
                  <header className="flex items-start justify-between gap-4 px-6 py-5 sm:px-9" style={{ background: accent, color: "#fff" }}>
                    <div className="flex min-w-0 items-start gap-3">
                      {companyLogoUrl ? <Image src={companyLogoUrl} alt="Logo" width={120} height={48} unoptimized className="h-9 w-auto max-w-[86px] object-contain" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white/20 text-[11px] font-black text-white">{initials}</span>}
                      <div className="min-w-0">
                        <p className="truncate text-[10.5px] font-extrabold leading-tight">{companyName}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0"><QuoteHeaderDetails number={displayQuoteNumber} status={displayQuoteStatus} labels={quoteHeaderLabels} date={quoteDateLabel} validUntil={validUntilLabel} color="rgba(255,255,255,.82)" emphasis="#ffffff" /></div>
                  </header>
                ))}

                {/* Meta row */}
                <div className="px-6 py-4 sm:px-9" style={isAgencyLayout ? { marginLeft: "30%", paddingLeft: "16px", paddingRight: "16px", paddingTop: "96px" } : undefined}>
                  {design.watermark && (
                    <div aria-hidden="true" className="pointer-events-none absolute whitespace-nowrap font-black tracking-[0.2em]" style={{ ...watermarkPlacement, color: accent, opacity: design.watermarkOpacity / 100, fontSize: 32 * watermarkScale, zIndex: 10 }}>
                      {design.watermarkUseLogo && companyLogoUrl ? <Image src={companyLogoUrl} alt="" width={220} height={100} unoptimized className="h-auto max-w-[70%] object-contain" style={{ width: `${220 * watermarkScale}px` }} /> : (design.watermarkText || "PAID")}
                    </div>
                  )}
                  <div className="relative z-0 grid grid-cols-3 gap-3 border-b border-slate-200 pb-4 text-[10px]">
                    <div>
                      <p className="text-[7.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{t("admin.quoteDesigner.from")}</p>
                      <p className="mt-1 text-[10px] font-extrabold text-slate-900">{companyName}</p>
                      {companyPhone && <p className="mt-0.5 text-[8px] leading-relaxed text-slate-500">{t("admin.quoteDesigner.phone")}: {companyPhone}</p>}
                      {companyEmail && <p className="text-[8px] leading-relaxed text-slate-500">{t("admin.quoteDesigner.email")}: {companyEmail}</p>}
                      {addressLine && <p className="text-[7.5px] leading-relaxed text-slate-500">{addressLine}</p>}
                      {companyWebsite && <p className="text-[7.5px] leading-relaxed text-slate-500">{companyWebsite}</p>}
                    </div>
                    <div>
                      <p className="text-[7.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{t("admin.quoteDesigner.billTo")}</p>
                      {form?.customer_name ? (
                        <>
                          <p className="mt-1 text-[10px] font-bold text-slate-900">{form.customer_name}</p>
                          {form.customer_phone && <p className="text-[8px] text-slate-500">{t("admin.quoteDesigner.phone")}: {form.customer_phone}</p>}
                          {form.customer_address && <p className="text-[8px] text-slate-500">{form.customer_address}</p>}
                          {form.customer_email && <p className="text-[8px] text-slate-500">{t("admin.quoteDesigner.email")}: {form.customer_email}</p>}
                        </>
                      ) : (
                        <p className="mt-1 text-[8px] italic text-slate-400">{t("admin.quoteDesigner.selectCustomer")}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-[7.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{quoteHeaderLabels.quoteDate}</p>
                      <p className="mt-1 text-[10px] font-bold text-slate-900">{quoteDateLabel}</p>
                      <p className="mt-1.5 text-[8px] text-slate-500">{quoteHeaderLabels.validUntil} <span className="font-bold">{validUntilLabel}</span></p>
                    </div>
                  </div>

                  {/* Table */}
                  <table className="mt-5 w-full text-left text-[9px]">
                    <thead>
                      <tr style={{ background: isBoldLayout ? accent : tintRgb(accent, 0.92), color: isBoldLayout ? "#fff" : accent }}>
                        <th className="px-2.5 py-2 font-bold">{t("admin.quoteDesigner.description")}</th>
                        <th className="px-2 py-2 text-right font-bold">{t("admin.quoteDesigner.quantity")}</th>
                        <th className="px-2 py-2 text-right font-bold">{t("admin.quoteDesigner.unitPrice")}</th>
                        <th className="px-2.5 py-2 text-right font-bold">{t("admin.quoteInvoice.ui.discount_b524936d")}</th>
                        <th className="px-2 py-2 text-right font-bold">{t("admin.quoteInvoice.ui.tax_9be70f66")}</th>
                        <th className="px-2.5 py-2 text-right font-bold">{t("admin.quoteDesigner.amount")}</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-600">
                      {previewItems.map((item) => (
                        <tr key={item.index} className={`border-b ${Number(item.returned_quantity) > 0 ? "border-rose-200 bg-rose-50/60" : "border-slate-100"}`}>
                          <td className="px-2.5 py-3 text-[8.5px]">
                            <span>{item.name || `Item ${item.index}`}</span>
                            {item.variant_name && <span className={Number(item.returned_quantity) > 0 ? "font-bold text-rose-700" : ""}> / {item.variant_name}</span>}
                            {Number(item.returned_quantity) > 0 && <span className="ml-1.5 inline-block rounded-full bg-rose-100 px-1.5 py-0.5 text-[7px] font-bold text-rose-700">{t(item.returned_quantity === 1 ? "admin.invoiceDetail.timeline.returnedOne" : "admin.invoiceDetail.timeline.returnedMany", { count: Number(item.returned_quantity) })}</span>}
                          </td>
                          <td className="px-2 py-3 text-right text-[9px]">{item.quantity}</td>
                          <td className="px-2 py-3 text-right text-[8.5px]">{currency(item.unit_price)}</td>
                          <td className="px-2 py-3 text-right text-[8.5px]">{currency(item.discount)}</td>
                          <td className="px-2 py-3 text-right text-[8.5px]">{currency(item.tax)}</td>
                          <td className="px-2.5 py-3 text-right text-[8.5px] font-semibold">{currency(item.amount)}</td>
                        </tr>
                      ))}
                      {previewItems.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-2.5 py-4 text-[9px] text-slate-400">{t("admin.quoteDesigner.noQuoteItems")}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* Subtotals */}
                  <div className="ml-auto mt-4 max-w-[230px] space-y-1.5 text-[9px]">
                    <div className="flex justify-between text-slate-500"><span>{t("admin.quoteDesigner.subtotal")}</span><span>{currency(totals?.subtotal)}</span></div>
                    {Number(totals?.discount || 0) > 0 && <div className="flex justify-between text-slate-500"><span>{t("admin.quoteInvoice.ui.discount_b524936d")}</span><span>- {currency(totals?.discount || 0)}</span></div>}
                    {Number(totals?.tax || 0) > 0 && <div className="flex justify-between text-slate-500"><span>{t("admin.quoteInvoice.ui.tax_9be70f66")}</span><span>+ {currency(totals?.tax || 0)}</span></div>}
                    <div className="flex justify-between border-t-2 pt-1.5 text-[9.5px] font-extrabold text-slate-900" style={{ borderColor: accent }}>
                      <span>{t("admin.quoteInvoice.ui.total_b25928c6")}</span><span>{currency(totals?.total)}</span>
                    </div>
                  </div>

                  {/* Terms */}
                  {design.showTerms !== false && !termsOnSecondPage && (form?.terms || form?.notes) && <div className="mt-5 border-t border-slate-100 pt-3" style={{ fontStyle: design.italicNotes ? "italic" : "normal" }}>
                    <p className="text-[7.5px] font-extrabold uppercase tracking-[0.14em] text-slate-400">{t("admin.quoteDesigner.termsConditions")}</p>
                    <div className="mt-1.5 text-[8px] leading-5 text-slate-500 space-y-1 whitespace-pre-line">
                      {form.terms && design.showTerms !== false && !termsOnSecondPage && <p>{renderBoldText(previewTermsText)}</p>}
                      {form.notes && <p>{form.notes}</p>}
                    </div>
                  </div>}
                </div>
              </article>
              {termsOnSecondPage && <article
                data-quote-document-page="true"
                className="relative mx-auto mt-4 max-w-[680px] overflow-hidden rounded-sm bg-white px-8 py-10 text-slate-800 shadow-lg ring-1 ring-black/5 sm:px-12"
                style={{
                  fontFamily: design.customTypography ? (FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily) ? `"${FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily)}", sans-serif` : "Arial, sans-serif") : "Arial, sans-serif",
                  fontSize: "8px",
                  fontStyle: design.italicNotes ? "italic" : "normal",
                  zoom: previewScale,
                  width: `${100 / previewScale}%`,
                  maxWidth: `${680 / previewScale}px`,
                  minHeight: `${960 / previewScale}px`,
                }}
              >
                {design.watermark && <div aria-hidden="true" className="pointer-events-none absolute whitespace-nowrap font-black tracking-[0.2em]" style={{ ...watermarkPlacement, color: accent, opacity: design.watermarkOpacity / 100, fontSize: 32 * watermarkScale, zIndex: 1 }}>
                  {design.watermarkUseLogo && companyLogoUrl ? <Image src={companyLogoUrl} alt="" width={220} height={100} unoptimized className="h-auto max-w-[70%] object-contain" style={{ width: `${220 * watermarkScale}px` }} /> : (design.watermarkText || "PAID")}
                </div>}

                <section className="pt-7" style={{ lineHeight: design.lineSpacing || 1.5 }}>
                  <h3 className="mb-5 text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: accent }}>{t("admin.quoteDesigner.termsConditions")}</h3>
                  <div className="space-y-4 whitespace-pre-line text-slate-600">
                    {previewTermParagraphs.map((paragraph, index) => <p key={index}>{renderBoldText(paragraph)}</p>)}
                    {form?.notes && <p><strong>{t("admin.quoteInvoice.ui.additional_notes_41b5f2e6")}:</strong> {form.notes}</p>}
                  </div>
                </section>
                {design.showPageNumbers !== false && <p className="absolute bottom-5 right-8 text-[8px] text-slate-400">2 / {previewPageCount}</p>}
              </article>}
            </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
