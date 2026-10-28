"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useQuery } from "@tanstack/react-query";
import { storeApi } from "@/apis/admin/storeApi";
import { getQuoteHeaderData } from "@/lib/quoteHeaderData";
import { variantApi } from "@/apis/admin/variantApi";
import { useTranslation } from "@/i18n/LanguageProvider";
import { htmlToPlainText, renderRichHtml } from "@/lib/termsContent";
import { toast } from "sonner";
import { Calculator, Check, ChevronDown, ChevronLeft, Eye, FileText, Package, Palette, Pencil, Plus, Search, Trash2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Design constants that match the user's reference screenshot      */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "quote-template-settings-v1";
export const QUOTE_TEMPLATE_STORAGE_KEY = STORAGE_KEY;
export const INVOICE_TEMPLATE_STORAGE_KEY = "invoice-template-settings-v1";

/* ------------------------------------------------------------------ */
/*  Reusable document configuration — the designer component itself    */
/*  never hardcodes document-specific text or field names.             */
/*  Each entry describes one document type (quote, invoice, …).        */
/* ------------------------------------------------------------------ */

const lblPair = (key, fallback) => ({ key, fallback });

const resolveProductImage = (value) => {
  const raw = typeof value === "string"
    ? value
    : value?.img_url || value?.image_url || value?.url || value?.path || "";
  if (!raw) return "";
  if (/^(https?:|blob:|data:)/i.test(raw)) return raw;
  const origin = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
  return origin ? `${origin}${raw.startsWith("/") ? raw : `/${raw}`}` : raw;
};

const firstProductImage = (...sources) => {
  for (const source of sources) {
    const candidate = Array.isArray(source) ? source[0] : source;
    const url = resolveProductImage(candidate);
    if (url) return url;
  }
  return "";
};

export const DOCUMENT_CONFIG = {
  quote: {
    storageKey: QUOTE_TEMPLATE_STORAGE_KEY,
    dateField: "quote_date",
    dueField: "expiry_date",
    draftNumberPlaceholder: "Draft quote",
    statuses: ["pending", "draft", "sent", "accepted", "rejected"],
    fallbackStatus: "Draft",
    labels: {
      number: lblPair("admin.quoteInvoice.pdf.quoteNumber", "Quote Number"),
      status: lblPair("admin.quoteInvoice.pdf.status", "Status"),
      date: lblPair("admin.quoteInvoice.pdf.quoteDate", "Quote Date"),
      due: lblPair("admin.quoteInvoice.pdf.validUntil", "Valid Until"),
    },
    termsLabel: lblPair("admin.quoteDesigner.termsConditions", "Terms & conditions"),
    /* Formats the document number for the preview header. */
    formatNumber: (number, status) => getQuoteHeaderData({ quote_number: number === DOCUMENT_CONFIG.quote.draftNumberPlaceholder ? "" : number, status }).quoteNumber,
  },
  invoice: {
    storageKey: INVOICE_TEMPLATE_STORAGE_KEY,
    dateField: "invoice_date",
    dueField: "due_date",
    fallbackStatus: "Unpaid",
    labels: {
      number: lblPair("admin.quoteInvoice.pdf.invoiceNumber", "Invoice Number"),
      status: lblPair("admin.quoteInvoice.pdf.status", "Status"),
      date: lblPair("admin.invoiceDetail.field.invoiceDate", "Invoice Date"),
      due: lblPair("admin.invoiceDetail.field.dueDate", "Due Date"),
    },
    termsLabel: lblPair("admin.quoteDesigner.invoiceTerms", "Invoice Terms & Conditions"),
    /* Invoices show the raw number as-is. */
    formatNumber: (number) => number || "",
  },
};
const DEFAULT_DESIGN = {
  template: "Bold",
  pageSize: "a4-portrait",
  headerLayout: "band",
  accentColor: "#dc2626",
  fontFamily: "helvetica",
  fontSize: 9,
  bodyFontSize: 9,
  baseFontSize: 13,
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

const PAPER_SIZE_OPTIONS = [
  { value: "a4-portrait", label: "A4 · Portrait", size: [210, 297] },
  { value: "a4-landscape", label: "A4 · Landscape", size: [297, 210] },
  { value: "a5-portrait", label: "A5 · Portrait", size: [148, 210] },
  { value: "a5-landscape", label: "A5 · Landscape", size: [210, 148] },
  { value: "a3-portrait", label: "A3 · Portrait", size: [297, 420] },
  { value: "a3-landscape", label: "A3 · Landscape", size: [420, 297] },
  { value: "a6-portrait", label: "A6 · Portrait", size: [105, 148] },
  { value: "a6-landscape", label: "A6 · Landscape", size: [148, 105] },
  { value: "b5jis-portrait", label: "B5 (JIS) · Portrait", size: [182, 257] },
  { value: "b5jis-landscape", label: "B5 (JIS) · Landscape", size: [257, 182] },
  { value: "b4jis-portrait", label: "B4 (JIS) · Portrait", size: [257, 364] },
  { value: "b4jis-landscape", label: "B4 (JIS) · Landscape", size: [364, 257] },
  { value: "letter-portrait", label: "Letter", size: [215.9, 279.4] },
  { value: "legal-portrait", label: "Legal", size: [215.9, 355.6] },
  { value: "executive-portrait", label: "Executive", size: [184.15, 266.7] },
  { value: "statement-portrait", label: "Statement", size: [139.7, 215.9] },
  { value: "tabloid-portrait", label: "Tabloid · Portrait", size: [279.4, 431.8] },
  { value: "tabloid-landscape", label: "Tabloid / Ledger · Landscape", size: [431.8, 279.4] },
  { value: "thermal-58", label: "Thermal Receipt · 58 mm", size: [58, 200] },
  { value: "thermal-80", label: "Thermal Receipt · 80 mm", size: [80, 200] },
];

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

function getVariantDropdownPosition(anchor) {
  if (!anchor || typeof window === "undefined") return null;
  const rect = anchor.getBoundingClientRect();
  const viewportPadding = 12;
  const gap = 6;
  const availableBelow = Math.max(0, window.innerHeight - rect.bottom - gap - viewportPadding);
  const availableAbove = Math.max(0, rect.top - gap - viewportPadding);
  const openAbove = availableBelow < 280 && availableAbove > availableBelow;
  const availableHeight = openAbove ? availableAbove : availableBelow;
  const maxHeight = Math.max(120, Math.min(400, availableHeight));
  const width = Math.min(Math.max(rect.width, 320), Math.min(380, window.innerWidth - viewportPadding * 2));
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  const top = openAbove
    ? Math.max(viewportPadding, rect.top - maxHeight - gap)
    : Math.min(rect.bottom + gap, window.innerHeight - maxHeight - viewportPadding);
  return { top, left, width, maxHeight };
}

const EMPTY_ITEM_ROW = {
  row_id: "__empty-item-placeholder__",
  product_id: null,
  variant_id: null,
  name: "",
  variant_name: "",
  sku: "",
  image: "",
  quantity: 1,
  unit_price: 0,
  discount_rate: 0,
  tax_rate: 0,
};

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
      pageSize: PAPER_SIZE_OPTIONS.some((option) => option.value === saved.pageSize) ? saved.pageSize : "a4-portrait",
      watermark: saved.watermark ?? saved.showWatermark ?? DEFAULT_DESIGN.watermark,
      ...(saved.watermarkRotation == null ? {} : { watermarkRotation: clamp(Number(saved.watermarkRotation) || 0, -180, 180) }),
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
    pageSize: PAPER_SIZE_OPTIONS.some((option) => option.value === saved.pageSize) ? saved.pageSize : "a4-portrait",
    watermark: Boolean(saved.watermark),
    watermarkUseLogo: Boolean(saved.watermarkUseLogo),
    watermarkText: String(saved.watermarkText || "PAID").slice(0, 40),
    watermarkPosition: saved.watermarkPosition || "center",
    watermarkRotation: saved.watermarkRotation == null ? (saved.watermarkPosition === "diagonal" ? 35 : 0) : clamp(Number(saved.watermarkRotation) || 0, -180, 180),
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

function OptionalDocumentLogo({ src, alt = "", className = "", style }) {
  const [failedSrc, setFailedSrc] = useState(null);
  if (!src || failedSrc === src) return null;
  return <img src={src} alt={alt} className={className} style={style} onError={() => setFailedSrc(src)} />;
}

function QuoteHeaderDetails({ number, status, date, validUntil, labels, title, titleSize, className = "", color = "#475569", emphasis = "#0f172a" }) {
  return <div className={`space-y-0.5 text-[8px] leading-snug ${className}`} style={{ color }}>
    <p className="mb-1 font-extrabold leading-none" style={{ color: emphasis, fontSize: `${titleSize}px` }}>{title}</p>
    <p>{labels.number}: <span className="font-semibold" style={{ color: emphasis }}>{number}</span></p>
    <p>{labels.status}: <span className="font-semibold" style={{ color: emphasis }}>{status}</span></p>
    <p>{labels.date}: <span className="font-semibold" style={{ color: emphasis }}>{date}</span></p>
    <p>{labels.due}: <span className="font-semibold" style={{ color: emphasis }}>{validUntil}</span></p>
  </div>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                            */
/* ------------------------------------------------------------------ */

export default function QuoteTemplateDesigner({ form, totals, quoteNumber, quoteStatus, savedDesign, money, previewOnly = false, onBrowseProducts, onFieldChange, onUpdateItem, onRemoveItem, discountType, discountValue, onDiscountTypeChange, onDiscountValueChange, taxRate, onTaxRateChange, documentType = "quote", storageKey: storageKeyProp }) {
  const { t, locale } = useTranslation();
  const isInvoice = documentType === "invoice";
  const doc = DOCUMENT_CONFIG[documentType] || DOCUMENT_CONFIG.quote;
  const storageKey = storageKeyProp || doc.storageKey;
  const lbl = (pair) => { const value = t(pair.key); return value === pair.key ? pair.fallback : value; };
  const [design, setDesign] = useState(() => {
    const storedDesign = readSaved(storageKey);
    const mergedDesign = { ...DEFAULT_DESIGN, ...storedDesign, ...(savedDesign || {}) };
    return {
      ...mergedDesign,
      pageSize: PAPER_SIZE_OPTIONS.some((option) => option.value === mergedDesign.pageSize) ? mergedDesign.pageSize : "a4-portrait",
    };
  });
  const [loaded, setLoaded] = useState(true);
  const [workspaceMode, setWorkspaceMode] = useState("preview");
  const [variantSearch, setVariantSearch] = useState("");
  const [variantSearchOpen, setVariantSearchOpen] = useState(false);
  const [activeVariantItemId, setActiveVariantItemId] = useState(null);
  const [variantDropdownPosition, setVariantDropdownPosition] = useState(null);
  const variantInputRefs = useRef(new Map());
  const variantDropdownRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const previewPageOneRef = useRef(null);
  const previewSummaryRef = useRef(null);
  const termsSectionRef = useRef(null);
  const [previewCanvasWidth, setPreviewCanvasWidth] = useState(0);
  const [termsFitOnFirstPage, setTermsFitOnFirstPage] = useState(false);
  const settingsPanelRef = useRef(null);
  const watermarkSettingsRef = useRef(null);

  useEffect(() => {
    const node = previewCanvasRef.current;
    if (!node || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect?.width || node.clientWidth;
      if (width > 0) setPreviewCanvasWidth((current) => current === width ? current : width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [previewOnly]);

  const { data: rawVariants = [] } = useQuery({
    queryKey: ["variant-search-options"],
    queryFn: () => variantApi.getAll(),
    staleTime: 5 * 60 * 1000,
  });
  const variantOptions = useMemo(() => {
    const listOf = (value) => Array.isArray(value) ? value : Array.isArray(value?.data) ? value.data : Array.isArray(value?.items) ? value.items : [];
    return listOf(rawVariants).filter((variant) => !variant.is_deleted).map((variant) => {
      const product = variant.product_id && typeof variant.product_id === "object" ? variant.product_id : {};
      return {
        id: String(variant._id || ""),
        product_id: String(product._id || variant.product_id || ""),
        name: product.name || variant.name || "",
        variant: variant.title || "",
        sku: variant.sku || "",
        price: Number(variant.selling_price ?? 0),
        image: firstProductImage(
          product.images,
          product.image,
          product.image_url,
          variant.images,
          variant.image,
          variant.image_url,
        ),
      };
    }).filter((option) => option.id && option.product_id);
  }, [rawVariants]);
  const matchedVariants = useMemo(() => {
    const term = variantSearch.trim().toLowerCase();
    return variantOptions.filter((option) => !term || `${option.name} ${option.variant} ${option.sku}`.toLowerCase().includes(term)).slice(0, 8);
  }, [variantOptions, variantSearch]);

  const selectVariantForItem = (option, item) => {
    if (!option) return;
    const alreadySelected = (form?.items || []).some((existing) => (
      String(existing?.variant_id || "") === option.id && existing?.row_id !== item?.row_id
    ));
    if (alreadySelected) {
      const message = t("admin.quoteDesigner.variantAlreadySelected");
      toast.info(message === "admin.quoteDesigner.variantAlreadySelected" ? "Already selected" : message);
      return;
    }
    onUpdateItem?.(item.row_id, "product_id", option.product_id);
    onUpdateItem?.(item.row_id, "variant_id", option.id);
    onUpdateItem?.(item.row_id, "name", option.name);
    onUpdateItem?.(item.row_id, "variant_name", option.variant);
    onUpdateItem?.(item.row_id, "sku", option.sku);
    onUpdateItem?.(item.row_id, "image", option.image);
    onUpdateItem?.(item.row_id, "unit_price", option.price);
    setActiveVariantItemId(null);
    setVariantSearchOpen(false);
    setVariantDropdownPosition(null);
    setVariantSearch("");
  };

  const ensureEditorItem = (item) => {
    if (!form?.items?.length) onFieldChange?.("items", [item]);
  };

  const activateVariantSearch = (item, trigger) => {
    ensureEditorItem(item);
    setActiveVariantItemId(item.row_id);
    setVariantSearch("");
    setVariantDropdownPosition(getVariantDropdownPosition(trigger));
    setVariantSearchOpen(true);
  };

  useEffect(() => {
    if (!variantSearchOpen || !activeVariantItemId) return undefined;
    const reposition = () => {
      const trigger = variantInputRefs.current.get(activeVariantItemId);
      if (trigger) setVariantDropdownPosition(getVariantDropdownPosition(trigger));
    };
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [variantSearchOpen, activeVariantItemId]);

  useEffect(() => {
    if (!variantSearchOpen || !activeVariantItemId) return undefined;
    const closeOnOutsideClick = (event) => {
      const trigger = variantInputRefs.current.get(activeVariantItemId);
      if (trigger?.contains(event.target) || variantDropdownRef.current?.contains(event.target)) return;
      setVariantSearchOpen(false);
      setActiveVariantItemId(null);
      setVariantDropdownPosition(null);
      setVariantSearch("");
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [variantSearchOpen, activeVariantItemId]);

  const addManualItem = () => {
    const currentItems = Array.isArray(form?.items) ? form.items : [];
    const rowId = globalThis.crypto?.randomUUID?.() || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setActiveVariantItemId(null);
    setVariantSearchOpen(false);
    setVariantDropdownPosition(null);
    setVariantSearch("");
    const rows = currentItems.length ? currentItems : [EMPTY_ITEM_ROW];
    onFieldChange?.("items", [...rows, {
      row_id: rowId,
      product_id: null,
      variant_id: null,
      name: "",
      variant_name: "",
      sku: "",
      image: "",
      quantity: 1,
      unit_price: 0,
      discount_rate: 0,
      tax_rate: 0,
    }]);
  };

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
        pageSize: design.pageSize || "a4-portrait",

        showWatermark: design.watermark,
        watermarkUseLogo: design.watermarkUseLogo,
        watermarkText: design.watermarkText,
        watermark: design.watermark,
        watermarkOpacity: design.watermarkOpacity,
        watermarkSize: design.watermarkSize,
        watermarkPosition: design.watermarkPosition,
        watermarkRotation: design.watermarkRotation ?? (design.watermarkPosition === "diagonal" ? 35 : 0),
        headerLayout: design.headerLayout,
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
  const cleanPreview = previewOnly || workspaceMode === "preview";
  const companyName = store?.store_name || t("admin.quoteDesigner.yourCompany");
  const companyPhone = store?.support_phone || store?.phone || "";
  const companyEmail = store?.support_email || store?.email || "";
  const companyWebsite = store?.website || store?.website_url || store?.store_url || "";
  const countryNames = { PK: "Pakistan", US: "United States", GB: "United Kingdom", AE: "United Arab Emirates", IN: "India", CA: "Canada", AU: "Australia" };
  const addressLine = [store?.address, store?.city, store?.state, store?.zip_code, countryNames[String(store?.country || "").toUpperCase()] || store?.country].filter(Boolean).join(", ");
  const displayQuoteNumber = (() => {
    const headerNumber = doc.formatNumber(quoteNumber === doc.draftNumberPlaceholder ? "" : quoteNumber, quoteStatus);
    return !headerNumber
      ? t("admin.quoteInvoice.pdf.assignedWhenSaved")
      : headerNumber;
  })();
  const displayQuoteStatus = (() => {
    const raw = String(quoteStatus || doc.fallbackStatus).trim();
    const key = raw.toLowerCase();
    return doc.statuses?.includes(key) ? t(`admin.quoteInvoice.status.${key}`) : raw;
  })();
  const quoteHeaderLabels = {
    number: lbl(doc.labels.number),
    status: lbl(doc.labels.status),
    date: lbl(doc.labels.date),
    due: lbl(doc.labels.due),
  };
  const documentHeading = isInvoice ? "INVOICE" : "QUOTE";
  const documentHeadingSize = clamp(Number(design.titleSize) || DEFAULT_DESIGN.titleSize, 18, 30);

  const formatDate = (value) => {
    if (!value) return "\u2014";
    const parsed = new Date(`${String(value).length <= 10 ? `${value}T00:00:00` : value}`);
    return Number.isNaN(parsed.getTime()) ? "\u2014" : parsed.toLocaleDateString(locale || "en-GB", { year: "numeric", month: "short", day: "numeric" });
  };
  const quoteDateLabel = formatDate(form?.[doc.dateField]);
  const validUntilLabel = formatDate(form?.[doc.dueField]);

  const currency = (value) => new Intl.NumberFormat(locale || "en-PK", { style: "currency", currency: design.currencySymbol || "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
  const labelClass = "block text-[10px] font-semibold text-[var(--text-secondary)]";
  const inputClass = "h-9 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 text-xs text-[var(--text-primary)] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
  const selectClass = inputClass + " cursor-pointer";
  const buttonClass = (active) => `group flex flex-col gap-0.5 rounded-lg border p-1.5 text-left transition ${active ? "border-slate-900 bg-[var(--bg-card)] ring-2 ring-slate-900/10" : "border-[var(--border-color)] bg-[var(--bg-card)] hover:-translate-y-px hover:border-slate-400 hover:shadow-sm"}`;

  /* ------------------- Live preview article ---------------------- */
  const editorItems = form?.items?.length ? form.items : [EMPTY_ITEM_ROW];
  const activeVariantItem = editorItems.find((item) => item.row_id === activeVariantItemId);
  const items = (form?.items || []).filter((it) => it.name || it.variant_name);
  const previewItems = items.map((item, index) => {
    const gross = Number(item.quantity || 0) * Number(item.unit_price || 0);
    const discount = gross * Number(item.discount_rate || 0) / 100;
    const tax = (gross - discount) * Number(item.tax_rate || 0) / 100;
    return { ...item, gross, discount, tax, amount: gross - discount + tax, index: index + 1 };
  });
  const rawTerms = String(form?.terms || "");
  const hasTermsPage = design.showTerms !== false && Boolean(form?.terms || form?.notes);
  const hasRichTerms = /<[a-z][\s\S]*>/i.test(rawTerms);
  const previewTermsText = (hasRichTerms ? htmlToPlainText(rawTerms) : rawTerms)
    .replace(/\r\n?/g, "\n")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
  const previewTermParagraphs = previewTermsText.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);

  const isAgencyLayout = design.template === "agency";
  const isMonoLayout = design.template === "mono";
  const isBoldLayout = design.template === "bold" || design.headerLayout === "band";
  const isMinimalLayout = theme.layout === "minimal";
  const isCenteredLayout = theme.layout === "center" || design.headerLayout === "centered";
  const isSplitLayout = theme.layout === "split" || design.headerLayout === "split";

  const headerBackground = isBoldLayout ? accent : isMinimalLayout ? "#fff" : isCenteredLayout ? theme.tone || "#f8fafc" : design.accentColor || theme.color;
  const headerText = isBoldLayout ? "#fff" : isCenteredLayout ? design.accentColor || theme.color : design.accentColor || theme.color;

  const previewScale = clamp((design.baseFontSize || 13) / 13, 0.75, 1.4);
  const pageDimensions = PAPER_SIZE_OPTIONS.find((option) => option.value === design.pageSize)?.size || [210, 297];
  const watermarkPosition = design.watermarkPosition || "center";
  const watermarkRotation = design.watermarkRotation == null
    ? (watermarkPosition === "diagonal" ? 35 : 0)
    : clamp(Number(design.watermarkRotation) || 0, -180, 180);
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
  useLayoutEffect(() => {
    if (!hasTermsPage) return;
    const page = previewPageOneRef.current;
    const summary = previewSummaryRef.current;
    const terms = termsSectionRef.current;
    if (!page || !summary || !terms) return;

    const scale = previewScale;
    const pageBottom = page.getBoundingClientRect().bottom;
    const summaryBottom = summary.getBoundingClientRect().bottom;
    const termsHeight = terms.getBoundingClientRect().height;
    // Reserve the document's bottom padding and printed page number area.
    const reservedBottom = 38 * scale;
    const gap = 20 * scale;
    const fits = summaryBottom + gap + termsHeight <= pageBottom - reservedBottom;
    const frame = window.requestAnimationFrame(() => {
      setTermsFitOnFirstPage((current) => current === fits ? current : fits);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    hasTermsPage,
    previewCanvasWidth,
    previewScale,
    previewTermsText,
    form?.notes,
    form?.customer_name,
    form?.customer_email,
    form?.customer_phone,
    form?.customer_address,
    previewItems.length,
    totals?.total,
    design.pageSize,
    design.lineSpacing,
    design.baseFontSize,
    design.template,
    design.showTerms,
  ]);
  const previewPageCount = 1 + Number(hasTermsPage && !termsFitOnFirstPage);
  const termsSection = (
    <section ref={termsSectionRef} className="mt-5 pt-0" style={{ lineHeight: design.lineSpacing || 1.5 }}>
      <h3 className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: accent }}>{lbl(doc.termsLabel)}</h3>
      <div className="min-w-0 space-y-4 break-words whitespace-pre-line text-slate-600 [&_.terms-rich-content_p]:mb-3 [&_.terms-rich-content_h1]:mb-2 [&_.terms-rich-content_h1]:font-bold [&_.terms-rich-content_h2]:mb-2 [&_.terms-rich-content_h2]:font-bold [&_.terms-rich-content_h3]:mb-2 [&_.terms-rich-content_h3]:font-bold [&_.terms-rich-content_ul]:list-disc [&_.terms-rich-content_ul]:pl-5 [&_.terms-rich-content_ol]:list-decimal [&_.terms-rich-content_ol]:pl-5 [&_.terms-rich-content_a]:text-blue-700 [&_.terms-rich-content_a]:underline" style={{ overflowWrap: "anywhere" }}>
        {hasRichTerms
          ? <div className="terms-rich-content" dangerouslySetInnerHTML={{ __html: renderRichHtml(rawTerms) }} />
          : previewTermParagraphs.map((paragraph, index) => <p key={index}>{renderBoldText(paragraph)}</p>)}
        {form?.notes && <p><strong>{t("admin.quoteInvoice.ui.additional_notes_41b5f2e6")}:</strong> {form.notes}</p>}
      </div>
    </section>
  );

  /* ------------------- Component return ------------------------- */
  return (
    <section className={`${previewOnly ? "quote-saved-preview " : ""}${cleanPreview ? "m-0 w-full rounded-none border-0 bg-[var(--bg-card)] p-0 shadow-none" : "mt-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[0_8px_24px_rgba(15,23,42,0.045)]"}`} aria-labelledby="doc-design-heading">
      <div className={`${previewOnly ? "quote-no-print " : ""}flex items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3`}>
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white shadow-sm"><Palette size={16} /></span>
          <div>
            <h2 id="doc-design-heading" className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--text-primary)]">{t("admin.quoteDesigner.documentDesign")}</h2>
            <p className="text-[10px] text-[var(--text-muted)]">{t("admin.quoteDesigner.designHint")}</p>
          </div>
        </div>
      </div>

      <div className={`grid ${previewOnly ? "m-0 w-full gap-0 p-0" : "gap-3 p-3.5 lg:p-4"} ${previewOnly ? "grid-cols-1" : "lg:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.35fr)]"}`}>
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
            <label className={labelClass}>{t("admin.quoteDesigner.paperSize")}
              <select className={selectClass} value={PAPER_SIZE_OPTIONS.some((option) => option.value === design.pageSize) ? design.pageSize : "a4-portrait"} onChange={(event) => setDesign((prev) => ({ ...prev, pageSize: event.target.value }))}>
                {PAPER_SIZE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <p className="mt-1 text-[9px] text-[var(--text-muted)]">{t("admin.quoteDesigner.pdfPageSize")}</p>
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
              <label className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-3 text-[11px] font-semibold transition ${design.watermark ? "border-blue-300 bg-blue-50 text-blue-900 shadow-sm dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200" : "border-[var(--border-color)] text-[var(--text-secondary)] hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/30"}`}>
                    <input type="checkbox" checked={design.watermark} onChange={(e) => { const enabled = e.target.checked; setDesign((prev) => ({ ...prev, watermark: enabled })); if (enabled) requestAnimationFrame(() => watermarkSettingsRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })); }} className="h-4 w-4 shrink-0 rounded accent-blue-600" /> {t("admin.quoteDesigner.showWatermark")}
              </label>
              {design.watermark && (
                <div ref={watermarkSettingsRef} className="space-y-3 rounded-xl border-2 border-blue-200 bg-blue-50/80 p-3.5 shadow-sm ring-1 ring-blue-100 dark:border-blue-800 dark:bg-slate-900 dark:ring-blue-950">
                  <div className="flex items-center gap-2 border-b border-blue-200 pb-2">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-blue-600" />
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-blue-900 dark:text-blue-200">{t("admin.quoteDesigner.watermarkSettings")}</p>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-blue-200 bg-white/80 px-2.5 py-2 text-[11px] font-semibold text-[var(--text-primary)] dark:border-[var(--border-color)] dark:bg-[var(--bg-card)]">
                    <input type="checkbox" checked={design.watermarkUseLogo} onChange={(e) => setDesign((prev) => ({ ...prev, watermarkUseLogo: e.target.checked }))} className="h-4 w-4 shrink-0 rounded accent-blue-600" /> {t("admin.quoteDesigner.logoWatermark")}
                  </label>
                  {!design.watermarkUseLogo && (
                    <label className="block text-[11px] font-medium text-[var(--text-secondary)]">
                      {t("admin.quoteDesigner.watermarkText")}
                      <input value={design.watermarkText || ""} onChange={(e) => setDesign((prev) => ({ ...prev, watermarkText: e.target.value.slice(0, 40) }))} maxLength={40} className="mt-1 h-8 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2 text-[11px] outline-none focus:border-blue-500" placeholder="PAID" />
                    </label>
                  )}
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                    {t("admin.quoteDesigner.watermarkOpacity")} ({design.watermarkOpacity || 14}%)
                    <input type="range" min="5" max="40" value={design.watermarkOpacity || 14} onChange={(e) => setDesign((prev) => ({ ...prev, watermarkOpacity: Number(e.target.value) }))} className="mt-1.5 block w-full" />
                  </label>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                    {t("admin.quoteDesigner.watermarkSize")} ({design.watermarkSize || 50}%)
                    <input type="range" min="20" max="100" value={design.watermarkSize || 50} onChange={(e) => setDesign((prev) => ({ ...prev, watermarkSize: Number(e.target.value) }))} className="mt-1.5 block w-full" />
                  </label>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
                    {t("admin.quoteDesigner.watermarkRotation")} ({watermarkRotation}°)
                    <input type="range" min="-180" max="180" step="1" value={watermarkRotation} onChange={(e) => setDesign((prev) => ({ ...prev, watermarkRotation: Number(e.target.value) }))} className="mt-1.5 block w-full" />
                  </label>
                  <label className="block text-[11px] font-semibold text-[var(--text-secondary)]">
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
        <div className={`m-0 w-full min-w-0 overflow-hidden p-0 ${!previewOnly && workspaceMode === "preview" ? "rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm" : ""}`}>
          <div className={`${previewOnly ? "quote-no-print " : ""}flex items-center justify-between gap-3 border-b border-[var(--border-color)] px-4 py-3`}>
            <div className="flex min-w-0 items-center gap-2">
              {!previewOnly && workspaceMode === "edit" && <button type="button" onClick={() => setWorkspaceMode("preview")} aria-label={t("admin.quoteDesigner.preview")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] transition hover:border-slate-300 hover:text-[var(--text-primary)]"><ChevronLeft size={14} /></button>}
              <h3 className="truncate text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-primary)]">{t("admin.quoteDesigner.livePreview")} · {theme.name}</h3>
              {!previewOnly && <span className="hidden shrink-0 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[9px] font-bold text-[var(--accent)] sm:inline">{workspaceMode === "edit" ? t("admin.quoteDesigner.editMode") : t("admin.quoteDesigner.previewMode")}</span>}
            </div>
            {!previewOnly && <div className="flex shrink-0 items-center gap-2" role="tablist" aria-label={t("admin.quoteDesigner.editDocument")}>
              <button type="button" role="tab" aria-selected={workspaceMode === "edit"} onClick={() => setWorkspaceMode("edit")} className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[11px] font-bold transition ${workspaceMode === "edit" ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700" : "border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-slate-300 hover:text-[var(--text-primary)]"}`}><Pencil size={13} />{t("admin.quoteDesigner.edit")}</button>
              <button type="button" role="tab" aria-selected={workspaceMode === "preview"} onClick={() => setWorkspaceMode("preview")} className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-[11px] font-bold transition ${workspaceMode === "preview" ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700" : "border border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-secondary)] hover:border-slate-300 hover:text-[var(--text-primary)]"}`}><Eye size={13} />{t("admin.quoteDesigner.preview")}</button>
            </div>}
          </div>
          <div ref={previewCanvasRef} className={`no-scrollbar m-0 w-full min-w-0 overflow-x-hidden ${previewOnly ? "bg-white p-0" : workspaceMode === "preview" ? "max-h-[720px] overflow-y-auto bg-[var(--bg-secondary)] p-2" : "max-h-[720px] overflow-y-auto bg-white p-0"}`}>
            {!previewOnly && workspaceMode === "edit" ? (
              <div className="space-y-3 rounded-none border-0 bg-[var(--bg-card)] p-3.5 sm:p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]/10"><FileText size={18} /></span>
                  <div className="min-w-0"><h4 className="text-[15px] font-extrabold text-[var(--text-primary)]">{t("admin.quoteDesigner.editDocument")}</h4><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{t("admin.quoteDesigner.editHint")}</p></div>
                </div>

                <section className="rounded-xl border border-[var(--border-color)] p-3.5"><div className="mb-2.5 flex flex-wrap items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Package size={16} /></span><h5 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-primary)]">{t("admin.quoteDesigner.productsItems")}</h5><span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--accent)]">{Math.max(1, form?.items?.length || 0)} {t("admin.quoteInvoice.ui.items_7316c8b2")}</span></div>
                  <div className="overflow-x-auto pb-1">
                    <div className="min-w-[710px] space-y-2">
                    {(() => {
                      const itemGrid = "grid grid-cols-[1.25rem_2.5rem_minmax(140px,1.5fr)_minmax(58px,.6fr)_3.5rem_5rem_4.25rem_4.25rem_2rem] items-center gap-1.5";
                      const headers = ["#", "", t("admin.quoteInvoice.ui.product_dd3b86d1"), "SKU", t("admin.quoteInvoice.ui.quantity_44f6af69"), t("admin.quoteInvoice.ui.unit_price_3c6c777f"), t("admin.quoteInvoice.ui.discount_b524936d"), t("admin.quoteInvoice.ui.tax_9be70f66"), ""];
                      return <>
                        <div className={`${itemGrid} rounded-lg bg-[var(--bg-tertiary)]/70 px-2.5 py-2`}>
                          {headers.map((header, i) => <span key={i} className={`truncate text-[8px] font-bold uppercase tracking-wide text-[var(--text-muted)] ${i >= 3 && i <= 7 ? "text-center" : ""}`}>{header}</span>)}
                        </div>
                        {editorItems.map((item, index) => <div key={item.row_id || item._id || index} className={`${itemGrid} rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1.5 transition hover:border-blue-200`}>
                          <span className="text-center text-[9px] font-semibold tabular-nums text-[var(--text-muted)]">{index + 1}</span>
                          <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                            <Package size={14} className="absolute text-slate-400" />
                            {item.image && <img src={resolveProductImage(item.image)} alt={item.name || ""} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} className="relative h-full w-full object-cover" />}
                          </span>
                          <div className="relative flex min-w-0 flex-col justify-center">
                            <div className="relative">
                              <Search size={12} className="pointer-events-none absolute start-2 top-1/2 -translate-y-1/2 text-slate-400" />
                              <button ref={(node) => { if (node) variantInputRefs.current.set(item.row_id, node); else variantInputRefs.current.delete(item.row_id); }} type="button" onClick={(event) => { if (variantSearchOpen && activeVariantItemId === item.row_id) { setVariantSearchOpen(false); setActiveVariantItemId(null); setVariantDropdownPosition(null); setVariantSearch(""); } else activateVariantSearch(item, event.currentTarget); }} onKeyDown={(event) => { if (event.key === "Escape") { setVariantSearchOpen(false); setActiveVariantItemId(null); setVariantDropdownPosition(null); setVariantSearch(""); } }} className={"flex h-8 w-full min-w-0 items-center gap-2 rounded-lg border px-2 text-left transition " + (variantSearchOpen && activeVariantItemId === item.row_id ? "border-blue-500 bg-[var(--bg-card)] ring-2 ring-blue-500/10" : "border-transparent bg-transparent hover:border-[var(--border-color)] hover:bg-[var(--bg-card)]")} aria-label={t("admin.quoteInvoice.ui.product_dd3b86d1") + " " + (index + 1)} aria-haspopup="dialog" aria-expanded={variantSearchOpen && activeVariantItemId === item.row_id}><Search size={12} className="shrink-0 text-[var(--text-muted)]" /><span className={"min-w-0 flex-1 truncate text-[13px] " + (item.name ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-muted)]")}>{item.name || t("admin.quoteDesigner.selectOrTypeProduct")}</span><ChevronDown size={13} className="shrink-0 text-[var(--text-muted)]" /></button>
                            </div>
                          </div>
                          <span className="min-w-0 truncate px-1 py-2 text-center font-mono text-[9px] text-[var(--text-secondary)]" title={item.sku ? `SKU ${item.sku}` : undefined}>{item.sku || "—"}</span>
                          {[[t("admin.quoteInvoice.ui.quantity_44f6af69"), "quantity", 1], [t("admin.quoteInvoice.ui.unit_price_3c6c777f"), "unit_price", 0], [t("admin.quoteInvoice.ui.discount_b524936d"), "discount_rate", 0], [t("admin.quoteInvoice.ui.tax_9be70f66"), "tax_rate", 0]].map(([title, key, min]) => <input key={key} type="number" min={min} max={key.includes("rate") ? 100 : undefined} step={key === "quantity" ? 1 : 0.01} value={item[key] ?? 0} onChange={(event) => onUpdateItem(item.row_id, key, event.target.value)} aria-label={title} title={title} placeholder={title} className="h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-1.5 text-center text-[11px] font-semibold text-[var(--text-primary)] outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />)}
                          <button type="button" onClick={() => onRemoveItem(item.row_id)} aria-label={t("admin.quoteDesigner.remove")} title={t("admin.quoteDesigner.remove")} className="flex h-9 w-9 items-center justify-center justify-self-center rounded-lg bg-[var(--danger-soft)] text-[var(--danger-text)] transition hover:brightness-95"><Trash2 size={14} /></button>
                        </div>)}
                      </>;
                    })()}
                    </div>
                  </div>
                  <div className="mt-2">
                    <button type="button" onClick={addManualItem} className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border-color)] px-3 text-[10px] font-semibold text-[var(--text-secondary)] transition hover:border-blue-300 hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"><Plus size={13} />{t("admin.quoteDesigner.addItem")}</button>
                  </div>
                </section>
                <section className="rounded-xl border border-[var(--border-color)] p-3.5">
                  <div className="mb-3 flex flex-wrap items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Calculator size={16} /></span><h5 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--text-primary)]">{t("admin.quoteDesigner.totals")}</h5></div>
                  <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,300px)]">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className={`${labelClass} text-xs font-semibold`}>{t("admin.quoteDesigner.discountType")}<select value={discountType} onChange={(event) => onDiscountTypeChange(event.target.value)} className={`${selectClass} mt-1 text-sm`}><option value="percent">{t("admin.quoteDesigner.percent")}</option><option value="flat">{t("admin.quoteDesigner.fixedAmount")}</option></select></label>
                      <label className={`${labelClass} text-xs font-semibold`}>{t("admin.quoteInvoice.ui.discount_b524936d")}<span className="relative mt-1 block"><input type="number" min="0" step="0.01" value={discountValue} onChange={(event) => onDiscountValueChange(event.target.value)} className={`${inputClass} text-sm`} aria-label={t("admin.quoteInvoice.ui.discount_b524936d")} /><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-semibold text-[var(--text-secondary)]">%</span></span></label>
                      <label className={`${labelClass} text-xs font-semibold`}>{t("admin.quoteDesigner.additionalTax")}<span className="relative mt-1 block"><input type="number" min="0" max="100" step="0.01" value={taxRate} onChange={(event) => onTaxRateChange(event.target.value)} className={`${inputClass} text-sm`} aria-label={t("admin.quoteDesigner.additionalTax")} /><span aria-hidden="true" className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-semibold text-[var(--text-secondary)]">%</span></span></label>
                      <div className="mt-3 border-t border-[var(--border-color)] pt-3 sm:col-span-3">
                        <label className={`${labelClass} text-xs font-semibold`}>{t("admin.quoteDesigner.notes")}</label>
                        <textarea value={form?.notes || ""} onChange={(event) => onFieldChange("notes", event.target.value)} rows={3} maxLength={1000} placeholder={t("admin.quoteDesigner.notesPlaceholder")} aria-label={t("admin.quoteDesigner.notes")} className="mt-1 w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 text-sm leading-5 text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10" />
                      </div>
                    </div>
                    <div className="rounded-xl bg-[var(--bg-tertiary)]/60 p-3 lg:border-s lg:border-[var(--border-color)] lg:rounded-none lg:bg-transparent lg:ps-5">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between gap-3"><span className="text-[var(--text-secondary)]">{t("admin.quoteDesigner.subtotal")}:</span><span className="font-semibold text-[var(--text-primary)]">{currency(totals?.subtotal)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span className="text-[var(--text-secondary)]">{t("admin.quoteInvoice.ui.discount_b524936d")}:</span><span className="font-semibold text-[var(--text-primary)]">{currency(totals?.discount)}</span></div>
                        <div className="flex items-center justify-between gap-3"><span className="text-[var(--text-secondary)]">{t("admin.quoteInvoice.ui.tax_9be70f66")}:</span><span className="font-semibold text-[var(--text-primary)]">{currency(totals?.tax)}</span></div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[var(--accent-soft)] px-3 py-3"><span className="text-sm font-bold text-[var(--accent)]">{t("admin.quoteDesigner.grandTotal")}</span><span className="font-mono text-base font-extrabold text-[var(--accent)]">{currency(totals?.total)}</span></div>
                    </div>
                  </div>
                </section>
              </div>            ) : (
            /* Preview container with safe zoom */
            <div className="m-0 block w-full min-w-0 overflow-hidden bg-white p-0" style={{ position: "relative" }}>
              <article
                ref={previewPageOneRef}
                data-quote-document-page="true"
                className="relative m-0 block w-full min-w-0 max-w-none box-border overflow-hidden rounded-none bg-white text-slate-800 shadow-none ring-0"
                style={{
                  fontFamily: design.customTypography ? (FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily) ? `"${FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily)}", sans-serif` : "Arial, sans-serif") : "Arial, sans-serif",
                  fontSize: "13px",
                  fontWeight: design.boldBody ? 700 : 400,
                  fontStyle: design.italicBody ? "italic" : "normal",
                  zoom: previewScale,
                  width: previewCanvasWidth > 0 ? `${previewCanvasWidth / previewScale}px` : "100%",
                  height: "auto",
                  minHeight: 0,
                  maxWidth: "none",
                  boxSizing: "border-box",
                  aspectRatio: `${pageDimensions[0]} / ${pageDimensions[1]}`,
                  "--quote-page-ratio": `${pageDimensions[0]} / ${pageDimensions[1]}`,
                  margin: 0,
                }}
              >
                {isAgencyLayout && <aside className="absolute inset-y-0 left-0 z-10 flex w-[30%] flex-col px-4 py-6 text-white sm:px-5" style={{ background: accent }}>
                  {companyLogoUrl && <OptionalDocumentLogo src={companyLogoUrl} alt="Company logo" className="mb-4 h-8 w-auto max-w-24 object-contain" />}
                  <p className="text-[10px] font-bold">{companyName}</p>
                  <div className="mt-auto pt-6 text-[9px]"><p className="font-semibold text-white/70">{t("admin.quoteInvoice.ui.total_b25928c6").toUpperCase()}</p><p className="mt-0.5 text-sm font-extrabold">{money(totals?.total)}</p></div>
                </aside>}
                {/* Header */}
                {isAgencyLayout && <header className="absolute right-6 top-5 z-20 text-right"><QuoteHeaderDetails title={documentHeading} titleSize={documentHeadingSize} number={displayQuoteNumber} status={displayQuoteStatus} labels={quoteHeaderLabels} date={quoteDateLabel} validUntil={validUntilLabel} color="#475569" emphasis={accent} /></header>}
                {!isAgencyLayout && (design.template === "bold" ? (
                  <header className="relative min-h-[112px] overflow-hidden border-b-2 border-slate-100 bg-white px-6 py-5 sm:px-9">
                    <div className="pointer-events-none absolute right-0 top-0 h-full w-[42%]" style={{ background: accent, clipPath: "polygon(10% 0, 100% 0, 100% 100%, 30% 100%)" }} />
                    <div className="relative z-10 flex items-start justify-between gap-4"><div className="flex min-w-0 items-start gap-2"><OptionalDocumentLogo src={companyLogoUrl} alt="Logo" className="mt-1 h-8 w-auto max-w-[90px] object-contain" /><p className="truncate pt-2 text-[11px] font-extrabold text-slate-900">{companyName}</p></div><div className="relative z-10 w-[25%] max-w-[172px] min-w-0 pt-1 text-right text-white"><QuoteHeaderDetails title={documentHeading} titleSize={documentHeadingSize} number={displayQuoteNumber} status={displayQuoteStatus} labels={quoteHeaderLabels} date={quoteDateLabel} validUntil={validUntilLabel} color="rgba(255,255,255,.82)" emphasis="#ffffff" /></div></div>
                    <div className="absolute bottom-0 left-6 right-6 h-[2px]" style={{ background: accent }} />
                  </header>
                ) : isMinimalLayout ? (
                  <header className="relative border-b-[3px] px-6 pb-3 pt-5 sm:px-9" style={{ borderColor: accent }}>
                    {isMonoLayout && <span className="absolute inset-x-0 top-0 h-[7px] bg-zinc-900" />}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2">
                        <OptionalDocumentLogo src={companyLogoUrl} alt="Logo" className="h-7 w-auto max-w-[70px] object-contain" />
                        <div>
                          <p className="truncate text-[11px] font-extrabold">{companyName}</p>

                        </div>
                      </div>
                      <div className="text-right">
                        <QuoteHeaderDetails title={documentHeading} titleSize={documentHeadingSize} number={displayQuoteNumber} status={displayQuoteStatus} labels={quoteHeaderLabels} date={quoteDateLabel} validUntil={validUntilLabel} color="#64748b" emphasis={accent} />
                      </div>
                    </div>
                  </header>
                ) : isCenteredLayout ? (
                  <header className="px-6 pb-4 pt-5 text-center sm:px-9" style={{ background: theme.tone || "#f8fafc" }}>
                    <div className="flex justify-center">
                      <OptionalDocumentLogo src={companyLogoUrl} alt="Logo" className="h-8 w-auto max-w-[86px] object-contain" />
                    </div>
                    <div className="mt-2 flex items-start justify-between gap-3 text-left"><p className="pt-1 text-[9px] font-bold text-slate-700">{companyName}</p><div className="text-right"><QuoteHeaderDetails title={documentHeading} titleSize={documentHeadingSize} number={displayQuoteNumber} status={displayQuoteStatus} labels={quoteHeaderLabels} date={quoteDateLabel} validUntil={validUntilLabel} color="#64748b" emphasis={accent} /></div></div>
                  </header>
                ) : isSplitLayout ? (
                  <header className="flex items-center justify-between gap-4 px-6 pb-3 pt-5 sm:px-9">
                    <div className="flex min-w-0 items-center gap-2">
                      <OptionalDocumentLogo src={companyLogoUrl} alt="Logo" className="h-7 w-auto max-w-[70px] object-contain" />
                      <div className="min-w-0">
                        <p className="truncate text-[10.5px] font-extrabold">{companyName}</p>

                      </div>
                    </div>
                    <div className="rounded-bl-xl px-3 py-1.5 text-right" style={{ background: tintRgb(accent, 0.92) }}><QuoteHeaderDetails title={documentHeading} titleSize={documentHeadingSize} number={displayQuoteNumber} status={displayQuoteStatus} labels={quoteHeaderLabels} date={quoteDateLabel} validUntil={validUntilLabel} color="#475569" emphasis={accent} /></div>
                  </header>
                ) : (
                  <header className="flex items-start justify-between gap-4 px-6 py-5 sm:px-9" style={{ background: accent, color: "#fff" }}>
                    <div className="flex min-w-0 items-start gap-3">
                      <OptionalDocumentLogo src={companyLogoUrl} alt="Logo" className="h-9 w-auto max-w-[86px] object-contain" />
                      <div className="min-w-0">
                        <p className="truncate text-[10.5px] font-extrabold leading-tight">{companyName}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0"><QuoteHeaderDetails title={documentHeading} titleSize={documentHeadingSize} number={displayQuoteNumber} status={displayQuoteStatus} labels={quoteHeaderLabels} date={quoteDateLabel} validUntil={validUntilLabel} color="rgba(255,255,255,.82)" emphasis="#ffffff" /></div>
                  </header>
                ))}

                {/* Meta row */}
                <div className="relative px-6 py-4 sm:px-9" style={isAgencyLayout ? { marginLeft: "30%", paddingLeft: "16px", paddingRight: "16px", paddingTop: "96px" } : undefined}>
                  {design.watermark && (
                    <div aria-hidden="true" className="pointer-events-none absolute whitespace-nowrap font-black tracking-[0.2em]" style={{ ...watermarkPlacement, transform: `${watermarkPlacement.transform || ""} rotate(${watermarkRotation}deg)`, color: accent, opacity: design.watermarkOpacity / 100, fontSize: 32 * watermarkScale, zIndex: 10 }}>
                      {design.watermarkUseLogo && companyLogoUrl ? <OptionalDocumentLogo src={companyLogoUrl} alt="" className="h-auto max-w-[70%] object-contain" style={{ width: `${220 * watermarkScale}px` }} /> : (design.watermarkText || "PAID")}
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
                      <p className="text-[7.5px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{quoteHeaderLabels.date}</p>
                      <p className="mt-1 text-[10px] font-bold text-slate-900">{quoteDateLabel}</p>
                      <p className="mt-1.5 text-[8px] text-slate-500">{quoteHeaderLabels.due} <span className="font-bold">{validUntilLabel}</span></p>
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
                  <div ref={previewSummaryRef} className="ml-auto mt-4 max-w-[230px] space-y-1.5 text-[9px]">
                    <div className="flex justify-between text-slate-500"><span>{t("admin.quoteDesigner.subtotal")}</span><span>{currency(totals?.subtotal)}</span></div>
                    {Number(totals?.discount || 0) > 0 && <div className="flex justify-between text-slate-500"><span>{t("admin.quoteInvoice.ui.discount_b524936d")}</span><span>- {currency(totals?.discount || 0)}</span></div>}
                    {Number(totals?.tax || 0) > 0 && <div className="flex justify-between text-slate-500"><span>{t("admin.quoteInvoice.ui.tax_9be70f66")}</span><span>+ {currency(totals?.tax || 0)}</span></div>}
                    <div className="flex justify-between border-t-2 pt-1.5 text-[9.5px] font-extrabold text-slate-900" style={{ borderColor: accent }}>
                      <span>{t("admin.quoteInvoice.ui.total_b25928c6")}</span><span>{currency(totals?.total)}</span>
                    </div>
                  </div>
                  {hasTermsPage && termsFitOnFirstPage && termsSection}

                </div>
                {design.showPageNumbers !== false && <p className="quote-preview-page-number hidden mt-2 px-6 pb-1 text-right text-[8px] text-slate-400 sm:px-9">1 / {previewPageCount}</p>}
              </article>
              {hasTermsPage && !termsFitOnFirstPage && <>
                <div className="quote-preview-page-break my-3 h-5 border-y border-slate-200 bg-slate-100" aria-hidden="true" />
                <article
                data-quote-document-page="true"
                className="relative m-0 block h-auto min-h-0 w-full min-w-0 max-w-none box-border overflow-hidden rounded-none bg-white px-6 pb-6 pt-6 text-slate-800 shadow-none ring-0 sm:px-9"
                style={{
                  fontFamily: design.customTypography ? (FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily) ? `"${FONT_OPTIONS.find((f) => FONT_MAP[f] === design.fontFamily)}", sans-serif` : "Arial, sans-serif") : "Arial, sans-serif",
                  fontSize: "8px",
                  fontStyle: design.italicNotes ? "italic" : "normal",
                  zoom: previewScale,
                  width: previewCanvasWidth > 0 ? `${previewCanvasWidth / previewScale}px` : "100%",
                  height: "auto",
                  minHeight: 0,
                  maxWidth: "none",
                  aspectRatio: `${pageDimensions[0]} / ${pageDimensions[1]}`,
                  "--quote-page-ratio": `${pageDimensions[0]} / ${pageDimensions[1]}`,
                }}
              >
                {design.watermark && <div aria-hidden="true" className="pointer-events-none absolute whitespace-nowrap font-black tracking-[0.2em]" style={{ ...watermarkPlacement, transform: `${watermarkPlacement.transform || ""} rotate(${watermarkRotation}deg)`, color: accent, opacity: design.watermarkOpacity / 100, fontSize: 32 * watermarkScale, zIndex: 1 }}>
                  {design.watermarkUseLogo && companyLogoUrl ? <OptionalDocumentLogo src={companyLogoUrl} alt="" className="h-auto max-w-[70%] object-contain" style={{ width: `${220 * watermarkScale}px` }} /> : (design.watermarkText || "PAID")}
                </div>}

                <section ref={termsSectionRef} className="pt-0" style={{ lineHeight: design.lineSpacing || 1.5 }}>
                  <h3 className="mb-5 text-[10px] font-extrabold uppercase tracking-[0.16em]" style={{ color: accent }}>{lbl(doc.termsLabel)}</h3>
                  <div className="min-w-0 space-y-4 break-words whitespace-pre-line text-slate-600 [&_.terms-rich-content_p]:mb-3 [&_.terms-rich-content_h1]:mb-2 [&_.terms-rich-content_h1]:font-bold [&_.terms-rich-content_h2]:mb-2 [&_.terms-rich-content_h2]:font-bold [&_.terms-rich-content_h3]:mb-2 [&_.terms-rich-content_h3]:font-bold [&_.terms-rich-content_ul]:list-disc [&_.terms-rich-content_ul]:pl-5 [&_.terms-rich-content_ol]:list-decimal [&_.terms-rich-content_ol]:pl-5 [&_.terms-rich-content_a]:text-blue-700 [&_.terms-rich-content_a]:underline" style={{ overflowWrap: "anywhere" }}>
                    {hasRichTerms
                      ? <div className="terms-rich-content" dangerouslySetInnerHTML={{ __html: renderRichHtml(rawTerms) }} />
                      : previewTermParagraphs.map((paragraph, index) => <p key={index}>{renderBoldText(paragraph)}</p>)}
                    {form?.notes && <p><strong>{t("admin.quoteInvoice.ui.additional_notes_41b5f2e6")}:</strong> {form.notes}</p>}
                  </div>
                </section>
                {design.showPageNumbers !== false && <p className="quote-preview-page-number hidden mt-3 text-right text-[8px] text-slate-400">2 / {previewPageCount}</p>}
                </article>
              </>}
            </div>
            )}
          </div>
        </div>
      </div>
      {variantSearchOpen && activeVariantItem && variantDropdownPosition && createPortal(
        <div ref={variantDropdownRef} role="dialog" aria-label={t("admin.quoteInvoice.ui.search_variant_product_or_sku_2d76140d")} className="flex flex-col overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-xl shadow-slate-900/15" style={{ position: "fixed", top: variantDropdownPosition.top, left: variantDropdownPosition.left, width: variantDropdownPosition.width, maxHeight: variantDropdownPosition.maxHeight, zIndex: 10050 }}>
          <div className="shrink-0 border-b border-[var(--border-color)] p-2"><div className="relative"><Search size={14} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input autoFocus type="search" value={variantSearch} onChange={(event) => setVariantSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && matchedVariants[0]) { event.preventDefault(); selectVariantForItem(matchedVariants[0], activeVariantItem); } else if (event.key === "Escape") { setVariantSearchOpen(false); setActiveVariantItemId(null); setVariantDropdownPosition(null); setVariantSearch(""); } }} placeholder={t("admin.quoteInvoice.ui.search_variant_product_or_sku_2d76140d")} aria-label={t("admin.quoteInvoice.ui.search_variant_product_or_sku_2d76140d")} className="h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] ps-9 pe-3 text-xs text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15" /></div></div>
          <div role="listbox" aria-label={t("admin.quoteInvoice.ui.product_dd3b86d1")} className="min-h-0 flex-1 overflow-y-auto p-1">
          {variantOptions.length === 0 ? <p className="px-3 py-3 text-center text-[10px] text-[var(--text-muted)]">{t("admin.quoteDesigner.searchVariantsUnavailable")}</p>
            : matchedVariants.length === 0 ? <p className="px-3 py-3 text-center text-[10px] text-[var(--text-muted)]">{t("admin.quoteDesigner.noVariantsFound")}</p>
            : matchedVariants.map((option) => (
              <button key={option.id} type="button" role="option" aria-selected={false} onMouseDown={(event) => event.preventDefault()} onClick={() => selectVariantForItem(option, activeVariantItem)} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start transition hover:bg-[var(--accent-soft)]">
                <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)]"><Package size={14} className="absolute text-slate-400" />{option.image && <img src={option.image} alt={option.name || ""} loading="lazy" onError={(event) => { event.currentTarget.style.display = "none"; }} className="relative h-full w-full object-cover" />}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] font-semibold text-[var(--text-primary)]">{option.name}</span>
                  <span className="block truncate text-[9px] text-[var(--text-muted)]">{option.variant || option.sku || "—"}{option.sku && option.variant ? ` · ${option.sku}` : ""}</span>
                </span>
                <span className="shrink-0 text-[10px] font-bold text-[var(--text-secondary)]">{money(option.price)}</span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
