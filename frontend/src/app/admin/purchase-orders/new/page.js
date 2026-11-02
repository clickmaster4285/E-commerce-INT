"use client";
import FallbackImage from "@/components/common/FallbackImage";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vendorApi } from "@/apis/admin/vendorApi";
import { purchaseOrderApi } from "@/apis/admin/purchaseOrderApi";
import { stockApi } from "@/apis/admin/stockApi";
import { variantApi } from "@/apis/admin/variantApi";
import ProductFormModal from "@/components/admin/ProductFormModal";
import VariantCard from "@/components/admin/VariantCard";
import VariantForm from "@/components/admin/VariantForm";
import VendorFormModal, { emptyVendorForm, toVendorPayload } from "@/components/admin/VendorFormModal";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";
import { localizedStrictField } from "@/i18n/localize";
import { usePageTranslations } from "@/hooks/admin/usePageTranslations";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";
import { ArrowLeft, Plus, Search, Building2, CalendarDays, ChevronDown, MoreVertical, Package, X, Circle } from "lucide-react";

// Same tokens as the rest of the admin — no new design system.
const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
const accentBtn = { backgroundColor: "var(--accent)", color: "var(--accent-text)" };
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (!API_ORIGIN) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
};

const intlLocale = (locale = "en") => locale === "ur" ? "ur-PK" : locale === "ar" ? "ar" : locale === "hi" ? "hi-IN" : locale === "en" ? "en-PK" : locale;
const money = (n, locale = "en", dec = 2) => new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "PKR", minimumFractionDigits: dec, maximumFractionDigits: dec }).format(Math.max(0, Number(n) || 0));
const nowStamp = (locale = "en") => new Intl.DateTimeFormat(intlLocale(locale), { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());

function SectionTitle({ children }) {
  return <h2 className="text-sm font-bold mb-3">{children}</h2>;
}
function FieldLabel({ children, required }) {
  return <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{children} {required && <span style={{ color: "var(--danger-text)" }}>*</span>}</label>;
}
function Thumb({ src, alt, size = "w-9 h-9", circle = false }) {
  const round = circle ? "rounded-full" : "rounded-lg";
  const url = getImageUrl(src);
  if (url) return <FallbackImage src={url} alt={alt} className={`${size} shrink-0 ${round} object-cover`} style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }} />;
  return <div className={`${size} shrink-0 ${round} flex items-center justify-center`} style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}><Package size={16} aria-hidden="true" /></div>;
}

const GROUP_TINT = "color-mix(in srgb, var(--accent) 9%, transparent)";
const rowInputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

function NewPOPage() {
  const { t, locale } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const qc = useQueryClient();
  const { data: editRes, isLoading: editLoading } = useQuery({ queryKey: ["po", editId], queryFn: () => purchaseOrderApi.getById(editId), enabled: !!editId });
  const editPO = editRes?.data || null;

  const [vendorId, setVendorId] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [editPrefilledId, setEditPrefilledId] = useState("");
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [vendorFormOpen, setVendorFormOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState({ ...emptyVendorForm, country: "Pakistan" });
  const [expectedDate, setExpectedDate] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCategory, setPickerCategory] = useState("all");
  const [pickerBrand, setPickerBrand] = useState("all");
  const [pickerPage, setPickerPage] = useState(1);
  const [checkedProducts, setCheckedProducts] = useState({}); // product_id -> true means ticked; default unticked
  const [vDetails, setVDetails] = useState({}); // variant_id -> { cost_price, selling_price }
  const [addingAll, setAddingAll] = useState(false);
  // New-product popup uses the same top-up form as the Products page.
  const [qcOpen, setQcOpen] = useState(false);
  const [newProductId, setNewProductId] = useState("");
  const [variantProductId, setVariantProductId] = useState("");
  const [lines, setLines] = useState([]); // each line: { ..., included: true }
  const [shipping, setShipping] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [overallTaxRate, setOverallTaxRate] = useState(0);
  const [notes, setNotes] = useState("");
  const [sideTab, setSideTab] = useState("items");
  const [events, setEvents] = useState([{ t: nowStamp(locale), label: t("admin.purchaseOrders.create.event.started") }]);
  const vendorBoxRef = useRef(null);
  const expectedDateRef = useRef(null);

  const openExpectedDatePicker = () => {
    const input = expectedDateRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === "function") {
        input.showPicker();
        return;
      }
    } catch {}
    input.focus();
    input.click();
  };

  const pushEvent = (label) => setEvents((e) => [...e, { t: nowStamp(locale), label }]);

  const { data: vendorsRaw } = useQuery({ queryKey: ["vendors-all"], queryFn: () => vendorApi.getAll() });
  const vendorList = useMemo(() => {
    const arr = Array.isArray(vendorsRaw) ? vendorsRaw : vendorsRaw?.data || [];
    return arr.filter((v) => !v.is_deleted && v.is_active);
  }, [vendorsRaw]);
  usePageTranslations({ model: "Vendor", records: vendorList, locale, ready: !!vendorsRaw, queryKey: ["vendors-all"], queryClient: qc });
  const vendorNameOf = (vendor) => localizedStrictField(vendor?.name, vendor?.translations?.name, locale);
  const vendorCompanyOf = (vendor) => localizedStrictField(vendor?.company_name, vendor?.translations?.company_name, locale);
  const vendorOptions = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendorList;
    return vendorList.filter((v) => [v.name, v.vendor_code, v.company_name, v.phone].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [vendorList, vendorSearch]);
  const selectedVendor = vendorList.find((v) => v._id === vendorId) || (editPO?.vendor_id?._id === vendorId ? editPO.vendor_id : null);

  const createVendorMutation = useMutation({
    mutationFn: async () => {
      const result = await vendorApi.create(toVendorPayload(vendorForm));
      const vendor = result?.data || result;
      if (!vendor?._id) throw new Error("vendor_id_missing");
      return vendor;
    },
    onSuccess: async (vendor) => {
      await qc.invalidateQueries({ queryKey: ["vendors-all"] });
      await qc.invalidateQueries({ queryKey: ["vendors"] });
      setVendorId(vendor._id);
      setVendorFormOpen(false);
      setVendorForm({ ...emptyVendorForm, country: "Pakistan" });
      pushEvent(t("admin.purchaseOrders.create.event.vendorSelected", { name: vendorNameOf(vendor) }));
      toast.success(t("admin.purchaseOrders.create.toast.vendorCreated"));
    },
    onError: () => toast.error(t("admin.purchaseOrders.create.toast.vendorFailed")),
  });

  // Pre-select vendor when opened from a vendor list or detail page (?vendor=<id>).
  useEffect(() => {
    if (prefilled) return;
    const pre = searchParams.get("vendor");
    if (pre && vendorId === "" && vendorList.some((v) => v._id === pre)) {
      setVendorId(pre);
      pushEvent(t("admin.purchaseOrders.create.event.vendorPreselected"));
      setPrefilled(true);
    }
  }, [searchParams, vendorList, vendorId, prefilled]);

  useEffect(() => {
    const close = (e) => { if (vendorBoxRef.current && !vendorBoxRef.current.contains(e.target)) setVendorOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const { data: nextCode } = useQuery({ queryKey: ["po-next-code"], queryFn: () => purchaseOrderApi.getNextCode() });

  // Full variant list once (cached) — grouped into products for the picker.
  const { data: stockAll, isLoading: stockLoading } = useQuery({ queryKey: ["stock-all"], queryFn: () => stockApi.getAll(), staleTime: 2 * 60 * 1000 });

  useEffect(() => {
    if (!editId || !editPO || !vendorsRaw || !stockAll || editPrefilledId === editId) return;
    const stockByVariant = new Map(stockAll.map((variant) => [String(variant._id), variant]));
    setVendorId(String(editPO.vendor_id?._id || editPO.vendor_id || ""));
    setExpectedDate(editPO.expected_date ? String(editPO.expected_date).slice(0, 10) : "");
    setShipping(Number(editPO.shipping) || 0);
    setDiscount(Number(editPO.discount) || 0);
    const taxBase = Number(editPO.subtotal || 0) - Number(editPO.discount || 0);
    setOverallTaxRate(editPO.overall_tax_rate != null ? Number(editPO.overall_tax_rate) : taxBase > 0 ? Number(editPO.overall_tax || 0) / taxBase * 100 : 0);
    setNotes(editPO.notes || "");
    setLines((editPO.items || []).map((item) => {
      const variantId = String(item.variant_id?._id || item.variant_id || "");
      const variant = stockByVariant.get(variantId);
      return {
        variant_id: variantId, product_id: String(item.product_id?._id || item.product_id || variant?.product_id || ""),
        product_name: item.name || item.product_id?.name || variant?.product_name || "Unknown Product",
        sku: item.sku || variant?.sku || "", title: item.variantTitle || item.variant_id?.title || variant?.title || "",
        image: item.image || variant?.image || "", in_stock: Number(variant?.quantity) || 0,
        qty_ordered: Math.max(1, Math.floor(Number(item.qty_ordered) || 1)),
        cost_price: Number(item.cost_price) || 0, sell_price: Number(item.sell_price) || 0,
        topup: Number(item.topup) || 0, tax_rate: Number(item.tax_rate) || 0,
        mfg_date: item.mfg_date ? String(item.mfg_date).slice(0, 10) : "",
        expiry_date: item.expiry_date ? String(item.expiry_date).slice(0, 10) : "",
        expiry_after_delivery: Number(item.expiry_after_delivery) || 0,
        expiry_after_delivery_unit: item.expiry_after_delivery_unit || "days", included: true,
      };
    }));
    setEditPrefilledId(editId);
  }, [editId, editPO, vendorsRaw, stockAll, editPrefilledId]);
  const categories = useMemo(() => {
    const m = new Map();
    for (const v of stockAll || []) {
      const id = String(v.category_id?._id || v.category_id || "");
      const name = String(v.category_name || v.category_id?.name || "").trim();
      if (id && name && !m.has(id)) m.set(id, name);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [stockAll]);
  const brands = useMemo(() => {
    const m = new Map();
    for (const v of stockAll || []) {
      const id = String(v.brand_id?._id || v.brand_id || "");
      const name = String(v.brand_name || v.brand_id?.name || "").trim();
      if (id && name && !m.has(id)) m.set(id, name);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [stockAll]);

  // Product-level groups for the popup (variants fetched on add).
  const productGroups = useMemo(() => {
    const m = new Map();
    for (const v of stockAll || []) {
      const pid = String(v.product_id || v._id);
      if (!m.has(pid)) m.set(pid, { product_id: pid, product_name: v.product_name || "Unknown Product", image: v.image || "", category_id: String(v.category_id?._id || v.category_id || ""), category_name: v.category_name || v.category_id?.name || "", brand_id: String(v.brand_id?._id || v.brand_id || ""), brand_name: v.brand_name || v.brand_id?.name || "", variants: [] });
      const g = m.get(pid);
      g.variants.push(v);
      if (!g.image && v.image) g.image = v.image;
    }
    return [...m.values()];
  }, [stockAll]);

  const pickerFiltered = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return productGroups.filter((g) => {
      if (pickerCategory !== "all" && g.category_id !== pickerCategory) return false;
      if (pickerBrand !== "all" && g.brand_id !== pickerBrand) return false;
      if (q && ![g.product_name, ...g.variants.map((v) => v.sku)].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [productGroups, pickerSearch, pickerCategory, pickerBrand]);
  const PICKER_SIZE = 8;
  const pickerPages = Math.max(1, Math.ceil(pickerFiltered.length / PICKER_SIZE));
  const safePickerPage = Math.min(pickerPage, pickerPages);
  const pickerRows = pickerFiltered.slice((safePickerPage - 1) * PICKER_SIZE, safePickerPage * PICKER_SIZE);

  const openPicker = () => {
    setPickerSearch("");
    setPickerCategory("all");
    setPickerPage(1);
    setCheckedProducts(Object.fromEntries(
      [...new Set(lines.map((line) => String(line.product_id || "")).filter(Boolean))]
        .map((productId) => [productId, true]),
    ));
    setPickerOpen(true);
  };
  const closePicker = () => {
    setCheckedProducts({});
    setPickerOpen(false);
  };

  const updateLine = (id, patch) => setLines((prev) => prev.map((l) => (String(l.variant_id) === String(id) ? { ...l, ...patch } : l)));

  const addCreatedVariantToOrder = ({ product, variant }, fallbackProductId) => {
    if (!variant?._id) {
      toast.error(t("admin.purchaseOrders.create.toast.variantAddFailed"));
      return false;
    }
    const productId = String(variant.product_id?._id || variant.product_id || product?._id || fallbackProductId || "");
    if (!productId) {
      toast.error(t("admin.purchaseOrders.create.toast.variantProductMissing"));
      return false;
    }
    const productName = product?.name || product?.product_name || "Unknown Product";
    const costPrice = Math.max(0, Number(variant.cost_price ?? variant.purchase_price) || 0);
    const sellPrice = Math.max(0, Number(variant.selling_price ?? variant.sell_price) || 0);
    qc.invalidateQueries({ queryKey: ["stock-all"] });
    qc.invalidateQueries({ queryKey: ["product", productId] });
    qc.invalidateQueries({ queryKey: ["products"] });
    setVDetails((previous) => ({
      ...previous,
      [String(variant._id)]: {
        cost_price: costPrice,
        selling_price: sellPrice,
        topup: Number(variant.topup) || 0,
        expiry_after_delivery: Math.max(0, Number(variant.expiry_after_delivery) || 0),
        expiry_after_delivery_unit: variant.expiry_after_delivery_unit || "days",
      },
    }));
    setLines((prev) => {
      const existingIndex = prev.findIndex((line) => String(line.variant_id) === String(variant._id));
      if (existingIndex !== -1) {
        return prev.map((line, index) => index === existingIndex ? {
          ...line,
          product_id: productId,
          product_name: productName,
          sku: variant.sku || line.sku,
          title: variant.title || line.title,
          image: variant.images?.[0]?.img_url || line.image,
          in_stock: variant.quantity ?? line.in_stock,
          cost_price: costPrice,
          sell_price: sellPrice,
          topup: Number(variant.topup) || 0,
        } : line);
      }
      return [...prev, {
        variant_id: variant._id, product_id: productId,
        sku: variant.sku || "", title: variant.title || "", product_name: productName,
        image: variant.images?.[0]?.img_url || "", in_stock: variant.quantity ?? 0, qty_ordered: 1,
        cost_price: costPrice, sell_price: sellPrice,
        topup: Number(variant.topup) || 0,
        expiry_after_delivery: Number(variant.expiry_after_delivery) || "",
        expiry_after_delivery_unit: variant.expiry_after_delivery_unit || "days",
        tax_rate: 0, mfg_date: "", expiry_date: "", included: true,
      }];
    });
    pushEvent(t("admin.purchaseOrders.create.event.variantRefreshed", { sku: variant.sku || "", product: productName }));
    toast.success(t("admin.purchaseOrders.create.toast.variantUpdated"));
    return true;
  };

  // Add all variants of ticked products — every variant line starts ticked (included).
  const addSelectedProducts = async () => {
    const chosen = pickerFiltered.filter((g) => checkedProducts[String(g.product_id)] === true);
    if (!chosen.length) { toast.error(t("admin.purchaseOrders.create.toast.selectProduct")); return; }
    setAddingAll(true);
    try {
      const variants = chosen.flatMap((g) => g.variants);
      const missing = [...new Set(variants.map((v) => String(v._id)).filter((vid) => !vDetails[vid]))];
      let detMap = {};
      if (missing.length) {
        const res = await Promise.all(missing.map((vid) => variantApi.getById(vid).catch(() => null)));
        res.forEach((full, i) => {
          if (full)           detMap[missing[i]] = {
            cost_price: Math.max(0, Number(full.cost_price) || 0),
            selling_price: Math.max(0, Number(full.selling_price) || 0),
            topup: Number(full.topup) || 0,
            expiry_after_delivery: Math.max(0, Number(full.expiry_after_delivery) || 0),
            expiry_after_delivery_unit: full.expiry_after_delivery_unit || "days",
          };
        });
        setVDetails((prev) => ({ ...prev, ...detMap }));
      }
      let added = 0;
      setLines((prev) => {
        const have = new Set(prev.map((l) => String(l.variant_id)));
        const fresh = [];
        for (const item of variants) {
          if (have.has(String(item._id))) continue;
          const det = detMap[String(item._id)] || vDetails[String(item._id)] || {};
          fresh.push({
            variant_id: item._id, product_id: String(item.product_id || ""),
            sku: item.sku || "", title: item.title || "",
            product_name: item.product_name || "Unknown Product", image: item.image || "",
            in_stock: item.quantity ?? 0, qty_ordered: 1,
            cost_price: det.cost_price ?? 0, sell_price: det.selling_price ?? 0,
            topup: det.topup ?? 0,
            expiry_after_delivery: det.expiry_after_delivery || "",
            expiry_after_delivery_unit: det.expiry_after_delivery_unit || "days",
            tax_rate: 0, mfg_date: "", expiry_date: "", included: true,
          });
          have.add(String(item._id));
        }
        added = fresh.length;
        return [...prev, ...fresh];
      });
      pushEvent(t("admin.purchaseOrders.create.event.productsAdded", { products: new Intl.NumberFormat(intlLocale(locale)).format(chosen.length), variants: new Intl.NumberFormat(intlLocale(locale)).format(added) }));
      toast.success(added ? t("admin.purchaseOrders.create.toast.variantsAdded", { count: new Intl.NumberFormat(intlLocale(locale)).format(added) }) : t("admin.purchaseOrders.create.toast.alreadyAdded"));
      closePicker();
    } finally { setAddingAll(false); }
  };

  const includedLines = useMemo(() => lines.filter((l) => l.included !== false), [lines]);
  const invalidPriceLines = useMemo(() => includedLines.filter((line) => (
    Number(line.cost_price || 0) > Number(line.sell_price || 0)
  )), [includedLines]);

  // Frontend estimate only — mirrors the backend formula (ticked lines only).
  // The backend re-calculates everything on save and remains the source of truth.
  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    for (const l of includedLines) {
      const lineTotal = Math.round(Math.max(0, Number(l.cost_price) || 0) * Math.max(1, Math.floor(Number(l.qty_ordered) || 1)));
      subtotal += lineTotal;
      tax += Math.round(lineTotal * (Math.min(100, Math.max(0, Number(l.tax_rate) || 0)) / 100));
    }
    const ship = Math.max(0, Number(shipping) || 0);
    const disc = Math.max(0, Number(discount) || 0);
    const taxBase = Math.max(0, subtotal - disc);
    const extraTaxRate = Math.min(100, Math.max(0, Number(overallTaxRate) || 0));
    const extraTax = Math.round(taxBase * extraTaxRate / 100);
    const totalTax = tax + extraTax;
    return { subtotal, tax: totalTax, overallTaxAmount: extraTax, shipping: ship, discount: disc, total: Math.max(0, Math.round(subtotal + totalTax + ship - disc)) };
  }, [includedLines, shipping, discount, overallTaxRate]);

  const buildPayload = () => ({
    vendor_id: vendorId,
    items: includedLines.map((l) => ({
      variant_id: l.variant_id,
      qty_ordered: Math.max(1, Math.floor(Number(l.qty_ordered) || 1)),
      cost_price: Math.max(0, Number(l.cost_price) || 0),
      sell_price: Math.max(0, Number(l.sell_price) || 0),
      tax_rate: Math.min(100, Math.max(0, Number(l.tax_rate) || 0)),
      topup: Number(l.topup) || 0,
      mfg_date: l.mfg_date || undefined,
      expiry_date: l.expiry_date || undefined,
      expiry_after_delivery: Math.max(0, Math.floor(Number(l.expiry_after_delivery) || 0)),
      expiry_after_delivery_unit: l.expiry_after_delivery_unit || "days",
    })),
    shipping: Math.max(0, Number(shipping) || 0),
    discount: Math.max(0, Number(discount) || 0),
    overall_tax: totals.overallTaxAmount,
    overall_tax_rate: Math.min(100, Math.max(0, Number(overallTaxRate) || 0)),
    expected_date: expectedDate || undefined,
    notes: notes.trim() || undefined,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const saved = editId ? await purchaseOrderApi.update(editId, buildPayload()) : await purchaseOrderApi.create(buildPayload());
      return saved?.data?._id || editId;
    },
    onSuccess: (id) => {
      toast.success(t(editId ? "admin.purchaseOrders.create.toast.updated" : "admin.purchaseOrders.create.toast.created"));
      qc.invalidateQueries({ queryKey: ["pos"] });
      qc.invalidateQueries({ queryKey: ["pos-all"] });
      if (editId) qc.invalidateQueries({ queryKey: ["po", editId] });
      router.push(`/admin/purchase-orders/${id}`);
    },
    onError: () => { toast.error(t("admin.purchaseOrders.create.toast.saveFailed")); },
  });

  const saveDisabled = createMutation.isPending || editLoading || (editId && editPrefilledId !== editId) || !vendorId || !includedLines.length || invalidPriceLines.length > 0;
  const tickedProducts = pickerFiltered.filter((g) => checkedProducts[String(g.product_id)] === true).length;

  // Group order lines by product for display.
  const groupedLines = useMemo(() => {
    const groups = new Map();
    for (const l of lines) {
      const pid = String(l.product_id || l.variant_id);
      if (!groups.has(pid)) groups.set(pid, { id: pid, name: l.product_name, image: l.image || "", category: "", lines: [] });
      const g = groups.get(pid);
      g.lines.push(l);
      if (!g.image && l.image) g.image = l.image;
    }
    return [...groups.values()];
  }, [lines]);

  const [expanded, setExpanded] = useState({});
  const [expandedVariants, setExpandedVariants] = useState({}); // variant_id -> true/false
  const [groupMenu, setGroupMenu] = useState(null);

  const minMap = useMemo(() => {
    const m = {};
    for (const v of stockAll || []) m[String(v._id)] = Number(v.min_qnt ?? 0);
    return m;
  }, [stockAll]);

  const variantStock = (l) => {
    const q = Number(l.in_stock ?? 0), min = Number(minMap[String(l.variant_id)] ?? 0);
    if (q === 0) return "out";
    if (q <= min) return "low";
    return "in";
  };
  const stockPill = (l) => {
    const s = variantStock(l);
    const style = s === "out"
      ? { backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" }
      : s === "low"
        ? { backgroundColor: "color-mix(in srgb, #f59e0b 16%, transparent)", color: "#b45309" }
        : { backgroundColor: "var(--success-soft)", color: "var(--success-text)" };
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={style}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "currentColor" }} />{new Intl.NumberFormat(intlLocale(locale)).format(Number(l.in_stock) || 0)}</span>;
  };
  const groupStatus = (g) => {
    const ss = g.lines.map(variantStock);
    if (ss.includes("out")) return "out";
    if (ss.includes("low")) return "low";
    return "in";
  };
  const groupPill = (g) => {
    const s = groupStatus(g);
    const label = t(`admin.purchaseOrders.create.stock.${s}`);
    const style = s === "out"
      ? { backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" }
      : s === "low"
        ? { backgroundColor: "color-mix(in srgb, #f59e0b 16%, transparent)", color: "#b45309" }
        : { backgroundColor: "var(--success-soft)", color: "var(--success-text)" };
    return <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={style}>{label}</span>;
  };
  const groupStats = (g) => {
    const ticked = g.lines.filter((l) => l.included !== false);
    const qty = ticked.reduce((s, l) => s + Math.max(1, Math.floor(Number(l.qty_ordered) || 1)), 0);
    const total = ticked.reduce((s, l) => s + Math.round(Math.max(0, Number(l.cost_price) || 0) * Math.max(1, Math.floor(Number(l.qty_ordered) || 1))), 0);
    return { ticked: ticked.length, total: g.lines.length, qty, total };
  };
  const setGroupTick = (g, tick) => setLines((prev) => prev.map((l) => (String(l.product_id || l.variant_id) === String(g.id) ? { ...l, included: tick } : l)));
  const removeProduct = (g) => setLines((prev) => prev.filter((l) => String(l.product_id || l.variant_id) !== String(g.id)));

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 items-start gap-3">
        <button type="button" onClick={() => router.push("/admin/purchase-orders")} aria-label={t("admin.purchaseOrders.page.title")} title={t("admin.purchaseOrders.page.title")} className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition hover:bg-[var(--bg-row-hover)]" style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}><ArrowLeft size={16} /></button>
        <div className="min-w-0 flex-1"><AdminPageHeader title={t(editId ? "admin.purchaseOrders.create.editHeading" : "admin.purchaseOrders.create.heading")} subtitle={t(editId ? "admin.purchaseOrders.create.editSubtitle" : "admin.purchaseOrders.create.subtitle")} /></div>
      </div>
      <div className="grid gap-4 items-start xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* LEFT */}
        <div className="space-y-4 min-w-0">
          {/* 1. Vendor Information */}
          <section className="rounded-lg p-4" style={cardStyle}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
                <Building2 size={16} style={{ color: "var(--accent)" }} />
              </div>
              <h2 className="text-base font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.vendorSection")}</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="relative" ref={vendorBoxRef}>
                <FieldLabel required>{t("admin.purchaseOrders.create.vendor")}</FieldLabel>
                <button type="button" onClick={() => setVendorOpen((o) => !o)} className="w-full h-10 px-3 rounded-lg text-sm flex items-center justify-between gap-2 outline-none transition focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: selectedVendor ? "var(--text-primary)" : "var(--text-secondary)" }}>
                  <span className="flex items-center gap-2.5 truncate font-medium">
                    <Search size={14} className="shrink-0" style={{ color: "var(--accent)" }} />{selectedVendor ? `${vendorNameOf(selectedVendor)} (${selectedVendor.vendor_code})` : t("admin.purchaseOrders.create.selectVendor")}
                  </span>
                  <ChevronDown size={15} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                </button>
                {vendorOpen && (
                  <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-lg shadow-md" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <div className="p-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <input autoFocus value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} placeholder={t("admin.purchaseOrders.create.searchVendors")} className="w-full h-9 px-3 rounded-lg text-sm outline-none transition focus:ring-2 focus:ring-blue-200" style={inputStyle} />
                    </div>
                    <div className="max-h-[240px] overflow-x-hidden overflow-y-auto py-1 px-2">
                      {vendorOptions.map((v) => (
                        <button key={v._id} type="button" onClick={() => { setVendorId(v._id); setVendorOpen(false); setVendorSearch(""); pushEvent(t("admin.purchaseOrders.create.event.vendorSelected", { name: v.name })); }} className="w-full px-3 py-2.5 text-start text-[13px] transition-colors hover:bg-[var(--bg-row-hover)]" style={{ backgroundColor: v._id === vendorId ? "var(--accent-soft)" : "transparent" }}>
                          <div className="font-bold text-sm" style={{ color: v._id === vendorId ? "var(--accent)" : "var(--text-primary)" }}>{vendorNameOf(v)} <span className="font-mono font-normal text-[11px]" style={{ color: "var(--text-secondary)" }}>{v.vendor_code}</span></div>
                          <div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{[vendorCompanyOf(v), localizedStrictField(v.city, v.translations?.city, locale)].filter(Boolean).join(" · ")}</div>
                        </button>
                      ))}
                      {!vendorOptions.length && <p className="px-4 py-6 text-center text-sm font-medium" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.create.noVendor")}</p>}
                    </div>
                    <div className="border-t p-2" style={{ borderColor: "var(--border-color)" }}>
                      <button type="button" onClick={() => { setVendorForm({ ...emptyVendorForm, country: "Pakistan" }); setVendorFormOpen(true); setVendorOpen(false); setVendorSearch(""); }} className="w-full h-9 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition hover:bg-[var(--bg-row-hover)]" style={{ color: "var(--accent)" }}>
                        <Plus size={15} /> {t("admin.purchaseOrders.create.addVendor")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <FieldLabel>{t("admin.purchaseOrders.create.expectedDelivery")}</FieldLabel>
                <div className="relative">
                  <input ref={expectedDateRef} type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="po-expected-date w-full h-10 px-4 pr-10 rounded-lg text-sm outline-none font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-blue-200" style={inputStyle} />
                  <button type="button" onClick={openExpectedDatePicker} aria-label="Open expected delivery date calendar" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-600 transition hover:bg-blue-50 hover:text-blue-700">
                    <CalendarDays size={16} />
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
              <p className="mb-2 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>{t("admin.purchaseOrders.create.vendorDetails")}</p>
              <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-5 text-[13px]">
                {[ ["admin.purchaseOrders.detail.name", vendorNameOf(selectedVendor)], ["admin.purchaseOrders.view.companyName", vendorCompanyOf(selectedVendor)], ["admin.purchaseOrders.detail.email", selectedVendor?.email], ["admin.purchaseOrders.detail.phone", selectedVendor?.phone], ["admin.purchaseOrders.view.city", localizedStrictField(selectedVendor?.city, selectedVendor?.translations?.city, locale)] ].map(([key, val]) => (
                  <div key={key} className="min-w-0 border-b py-2 last:border-0 sm:last:border-b" style={{ borderColor: "var(--border-color)" }}>
                    <div className="mb-0.5 text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t(key)}</div>
                    <div className="truncate text-[13px] font-medium" style={{ color: "var(--text-primary)" }}>{val || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 2. Products / Items */}
          <section className="rounded-lg p-4" style={cardStyle}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
                  <Package size={16} style={{ color: "var(--accent)" }} />
                </div>
                <h2 className="text-base font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.productsSection")} <span className="font-medium text-sm ml-1.5 px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(37,99,235,0.08)", color: "var(--accent)" }}>{t("admin.purchaseOrders.create.inOrder", { count: new Intl.NumberFormat(intlLocale(locale)).format(includedLines.length) })}</span></h2>
              </div>
              <button onClick={openPicker} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition hover:opacity-90 whitespace-nowrap" style={accentBtn}><Plus size={14} /> {t("admin.purchaseOrders.create.addProduct")}</button>
            </div>
            {lines.length === 0 ? (
              <div className="flex flex-col items-center rounded-lg border py-8 text-center" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
                <Package size={24} className="mb-2" style={{ color: "var(--text-muted)" }} />
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.noProducts")}</div>
                <div className="text-xs mt-1.5 max-w-xs" style={{ color: "var(--text-secondary)" }}>{t("admin.purchaseOrders.create.addProductsHelp")}</div>
                <button onClick={openPicker} className="h-9 px-4 mt-4 rounded-lg text-[13px] font-semibold transition hover:opacity-90" style={accentBtn}>{t("admin.purchaseOrders.create.browseProducts")}</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 px-1 py-2 text-[12px] rounded-lg" style={{ backgroundColor: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.1)" }}>
                  <span className="font-semibold px-2" style={{ color: "var(--accent)" }}>{t("admin.purchaseOrders.create.variantsIncluded", { included: includedLines.length, total: lines.length })}</span>
                </div>
                <div className="mt-2 space-y-3">
                  {groupedLines.map((group) => (
                    <div key={group.id} className="overflow-hidden rounded-lg" style={{ border: "1px solid var(--border-color)", background: "var(--bg-card)" }}>
                      <div className="flex flex-wrap items-center gap-3 px-3 py-3" style={{ background: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
                        <input
                          type="checkbox"
                          checked={group.lines.every((line) => line.included !== false)}
                          onChange={(event) => setGroupTick(group, event.target.checked)}
                          className="w-4 h-4 rounded cursor-pointer shrink-0"
                          style={{ accentColor: "var(--accent)" }}
                          aria-label={t("admin.purchaseOrders.create.includeVariants", { name: group.name })}
                        />
                        <Thumb src={group.image} alt={group.name} size="w-12 h-12" />
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-sm truncate tracking-tight" style={{ color: "var(--text-primary)" }}>{group.name || t("admin.purchaseOrders.create.unknownProduct")}</div>
                          <div className="text-xs mt-1 font-medium" style={{ color: "var(--text-secondary)" }}>{t("admin.purchaseOrders.create.variantsIncluded", { included: group.lines.filter((line) => line.included !== false).length, total: group.lines.length })}</div>
                        </div>
                        <button onClick={() => setVariantProductId(group.id)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-[1.05] hover:shadow-sm active:scale-[0.95]" style={{ color: "var(--accent)", border: "1px solid var(--border-color)", background: "var(--accent-soft)" }}>{t("admin.purchaseOrders.create.addVariant")}</button>
                        <button onClick={() => removeProduct(group)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-[1.05] hover:shadow-sm active:scale-[0.95]" style={{ color: "var(--danger-text)", border: "1.5px solid #fecaca", background: "var(--danger-soft)" }}>{t("admin.purchaseOrders.create.removeProduct")}</button>
                        <button
                          type="button"
                          onClick={() => setExpanded((previous) => ({ ...previous, [group.id]: previous[group.id] === false }))}
                          className="p-2.5 rounded-lg transition-all duration-200 hover:scale-110 hover:shadow-md active:scale-95"
                          style={{ color: "var(--text-primary)", background: "var(--bg-card)", border: "1px solid var(--border-color)" }}
                          aria-label={t(expanded[group.id] === false ? "admin.purchaseOrders.create.expandVariants" : "admin.purchaseOrders.create.collapseVariants", { name: group.name })}
                          aria-expanded={expanded[group.id] !== false}
                        >
                          <ChevronDown size={18} className={`transition-transform duration-300 ${expanded[group.id] === false ? "-rotate-90" : ""}`} strokeWidth={2.5} />
                        </button>
                      </div>
                      {expanded[group.id] !== false && (
                        <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                          <div className="hidden xl:grid xl:grid-cols-[24px_minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.5fr)_minmax(0,0.5fr)_minmax(0,0.8fr)_minmax(0,1fr)] items-center gap-2 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: "var(--text-secondary)", background: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                            <span>✓</span><span>{t("admin.purchaseOrders.create.productVariant")}</span><span className="text-center">{t("admin.purchaseOrders.create.inStock")}</span><span className="text-left">{t("admin.purchaseOrders.create.costPrice")}</span><span className="text-left">{t("admin.purchaseOrders.create.sellPrice")}</span><span className="text-left">{t("admin.purchaseOrders.create.qty")}</span><span className="text-left">{t("admin.purchaseOrders.create.tax")} %</span><span className="text-left">{t("admin.purchaseOrders.create.lineTotal")}</span><span>{t("admin.purchaseOrders.create.mfgDate")}</span>
                          </div>
                            {group.lines.map((line) => {
                              const lineTotal = Math.round(Math.max(0, Number(line.cost_price) || 0) * Math.max(1, Math.floor(Number(line.qty_ordered) || 1)));
                              return <div key={String(line.variant_id)} className="min-w-0 px-3 sm:px-4 py-3.5 transition-all duration-200 rounded-lg mx-1 my-0.5" style={{ backgroundColor: line.included === false ? "var(--bg-tertiary)" : "var(--bg-card)", opacity: line.included === false ? 0.7 : 1, border: line.included === false ? "1px solid var(--border-color)" : "1px solid transparent" }}>
                                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-[24px_minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.5fr)_minmax(0,0.5fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-2 xl:items-start">
                                  <div className="flex items-center"><input type="checkbox" checked={line.included !== false} onChange={(event) => updateLine(line.variant_id, { included: event.target.checked })} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} aria-label={t("admin.purchaseOrders.create.includeVariant", { variant: line.title || line.sku })} /></div>
                                  <div className="min-w-0 flex items-center gap-2"><Thumb src={line.image} alt={line.title || line.product_name} size="w-10 h-10" /><div className="min-w-0"><div className="font-semibold text-xs truncate" title={line.title || t("admin.purchaseOrders.create.defaultVariant")}>{line.title || t("admin.purchaseOrders.create.defaultVariant")}</div><div className="font-mono text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>{line.sku || "—"}</div></div></div>
                                  <div className="min-w-0 xl:flex xl:justify-center"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.create.inStock")}</div>{stockPill(line)}</div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.create.costPrice")}</div><input type="number" min={0} step="0.01" value={line.cost_price} onChange={(event) => updateLine(line.variant_id, { cost_price: Math.max(0, Number(event.target.value) || 0) })} className="w-full min-w-0 h-9 px-2 rounded-lg text-left text-[11px] tabular-nums outline-none font-medium shadow-sm transition focus:shadow-md focus:ring-2 focus:ring-blue-200" style={inputStyle} /></div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.create.sellPrice")}</div><input type="number" min={0} step="0.01" value={line.sell_price ?? ""} onChange={(event) => updateLine(line.variant_id, { sell_price: Math.max(0, Number(event.target.value) || 0) })} className={`w-full min-w-0 h-9 px-2 rounded-lg text-left text-[11px] tabular-nums outline-none font-medium shadow-sm transition focus:shadow-md focus:ring-2 ${Number(line.cost_price || 0) > Number(line.sell_price || 0) ? "border-red-400 focus:ring-red-100" : "focus:ring-blue-200"}`} style={{ backgroundColor: "var(--bg-card)", border: Number(line.cost_price || 0) > Number(line.sell_price || 0) ? "1.5px solid #ef4444" : "1px solid var(--border-color)", color: "var(--text-primary)" }} />{Number(line.cost_price || 0) > Number(line.sell_price || 0) && <p className="mt-1 max-w-full break-words text-[9px] font-semibold leading-3 text-red-600">{t("admin.purchaseOrders.create.costExceedsSell")}</p>}</div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.create.qty")}</div><input type="number" min={1} step={1} value={line.qty_ordered} onChange={(event) => updateLine(line.variant_id, { qty_ordered: Math.max(1, Math.floor(Number(event.target.value) || 1)) })} className="w-full min-w-0 h-9 px-2 rounded-lg text-left text-[11px] tabular-nums outline-none font-medium shadow-sm transition focus:shadow-md focus:ring-2 focus:ring-blue-200" style={inputStyle} /></div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.create.tax")} %</div><input type="number" min={0} max={100} value={line.tax_rate} onChange={(event) => updateLine(line.variant_id, { tax_rate: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} className="w-full min-w-0 h-9 px-2 rounded-lg text-left text-[11px] tabular-nums outline-none font-medium shadow-sm transition focus:shadow-md focus:ring-2 focus:ring-blue-200" style={inputStyle} /></div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.create.lineTotal")}</div><div className="h-9 px-2 rounded-lg flex items-center justify-start font-extrabold text-[11px] tabular-nums whitespace-nowrap overflow-hidden shadow-inner" style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>{money(lineTotal, 0)}</div></div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.create.mfgDate")}</div><input type="date" value={line.mfg_date || ""} onChange={(event) => updateLine(line.variant_id, { mfg_date: event.target.value })} className="w-full min-w-0 h-9 px-2 rounded-lg text-[10px] outline-none font-medium shadow-sm transition focus:shadow-md focus:ring-2 focus:ring-blue-200" style={inputStyle} /></div>
                                </div>
                              </div>;
                            })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
          <div className="grid items-stretch md:grid-cols-2 gap-4">
            {/* 3. Additional Details */}
            <section className="flex h-full flex-col rounded-lg p-4" style={cardStyle}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
                  <Plus size={16} style={{ color: "var(--accent)" }} />
                </div>
                <h2 className="text-base font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.additionalDetails")}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>{t("admin.purchaseOrders.create.shipping")}</FieldLabel>
                  <input type="number" min={0} value={shipping} onChange={(e) => setShipping(e.target.value)} className="w-full h-10 px-3 rounded-lg text-sm outline-none font-medium transition focus:ring-2 focus:ring-blue-200" style={inputStyle} />
                </div>
                <div>
                  <FieldLabel>{t("admin.purchaseOrders.create.discount")}</FieldLabel>
                  <input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full h-10 px-3 rounded-lg text-sm outline-none font-medium transition focus:ring-2 focus:ring-blue-200" style={inputStyle} />
                </div>
                <div>
                  <FieldLabel>Overall Tax (%)</FieldLabel>
                  <div className="relative">
                    <input type="number" min={0} max={100} step="0.01" value={overallTaxRate} onChange={(e) => setOverallTaxRate(e.target.value)} className="w-full h-10 pl-3 pr-10 rounded-lg text-sm outline-none font-medium transition focus:ring-2 focus:ring-blue-200" style={inputStyle} />
                    <span className="absolute inset-y-0 right-4 flex items-center text-sm font-medium" style={{ color: "var(--text-secondary)" }}>%</span>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <FieldLabel>{t("admin.purchaseOrders.create.notes")}</FieldLabel>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={t("admin.purchaseOrders.create.notesPlaceholder")} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none font-medium transition focus:ring-2 focus:ring-blue-200 resize-y" style={inputStyle} />
              </div>
            </section>
            {/* 4. Summary */}
            <section className="flex h-full flex-col rounded-lg p-4" style={cardStyle}>
              <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
                  <span className="text-[10px] font-extrabold" style={{ color: "var(--accent)" }}>Rs</span>
                </div>
                <h2 className="text-base font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.summary")}</h2>
              </div>
              <div className="divide-y text-sm" style={{ borderColor: "var(--border-color)" }}>
                {[["admin.purchaseOrders.create.subtotal", totals.subtotal], ["admin.purchaseOrders.create.tax", totals.tax], ["admin.purchaseOrders.create.overallTax", totals.overallTaxAmount], ["admin.purchaseOrders.create.shipping", totals.shipping], ["admin.purchaseOrders.create.discount", totals.discount]].map(([key, amount]) => <div key={key} className="flex items-center justify-between gap-3 py-2" style={{ borderColor: "var(--border-color)" }}><span style={{ color: "var(--text-secondary)" }}>{t(key)}</span><span className="font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>{money(amount)}</span></div>)}
                <div className="flex min-w-0 items-center justify-between gap-3 border-t pt-3 font-semibold" style={{ borderColor: "var(--border-color)" }}><span style={{ color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.total")}</span><span className="shrink-0 whitespace-nowrap text-right tabular-nums" style={{ color: "var(--accent)" }}>{money(totals.total)}</span></div>
              </div>
            </section>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:overscroll-contain">
          <section className="rounded-lg p-4" style={cardStyle}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
                <span className="text-[10px] font-extrabold" style={{ color: "var(--accent)" }}>PO</span>
              </div>
              <h2 className="text-base font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.purchaseOrder")}</h2>
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
              <div className="min-w-0"><div className="font-mono text-base font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>{editPO?.po_number || nextCode?.nextCode || "PO-..."}</div><div className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.create.autoGenerated")}</div></div>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "var(--warning-soft)", color: "var(--warning-text)" }}>{t("admin.purchaseOrders.status.pending")}</span>
            </div>
            <div className="flex gap-2 mt-4">
              <button disabled={saveDisabled} onClick={() => createMutation.mutate()} className="h-10 px-4 rounded-lg text-[13px] font-semibold transition hover:opacity-90 flex-1" style={accentBtn}>
                {createMutation.isPending ? t(editId ? "admin.purchaseOrders.create.updating" : "admin.purchaseOrders.create.creating") : t(editId ? "admin.purchaseOrders.create.updatePO" : "admin.purchaseOrders.create.createPO")}
              </button>
            </div>
            {!editId && (lines.length > 0 || vendorId) && (
              <button
                onClick={() => { if (confirm("Clear this order?")) { setLines([]); setVendorId(""); setExpectedDate(""); setShipping(0); setDiscount(0); setOverallTaxRate(0); setNotes(""); } }}
                className="mt-3 w-full text-[12px] font-bold transition-all duration-200 hover:scale-[1.02] py-2 rounded-lg" style={{ color: "var(--text-secondary)", background: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}
              >
                {t("admin.purchaseOrders.create.clearOrder")}
              </button>
            )}
          </section>

          <section className="overflow-hidden rounded-lg" style={cardStyle}>
            <div className="flex px-2" style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-card)" }}>
              {[["items", `Items ${includedLines.length}`], ["summary", "Summary"], ["history", "History"]].map(([k, label]) => (
                <button key={k} onClick={() => setSideTab(k)} className="px-3 py-2.5 text-[13px] font-medium transition-colors" style={sideTab === k ? { color: "var(--accent)", borderBottom: "2px solid var(--accent)" } : { color: "var(--text-secondary)", background: "transparent" }}>{label}</button>
              ))}
            </div>
            <div className={sideTab === "items" && includedLines.length === 0 ? "p-0" : "p-4"}>
              {sideTab === "items" && includedLines.length > 0 && (
                <div className="space-y-2">{includedLines.map((l) => (
                    <div key={String(l.variant_id)} className="flex items-center gap-3 p-2.5 rounded-lg transition hover:shadow-md" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                      <Thumb src={l.image} alt={l.product_name} size="w-10 h-10" />
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-sm truncate" style={{ color: "var(--text-primary)" }}>{l.product_name}</div>
                      <div className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>{l.sku} × {new Intl.NumberFormat(intlLocale(locale)).format(l.qty_ordered)}</div>
                      </div>
                      <b className="font-extrabold text-sm whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{new Intl.NumberFormat(intlLocale(locale)).format(Math.round(Math.max(0, Number(l.cost_price) || 0) * Math.max(1, Math.floor(Number(l.qty_ordered) || 1))))}</b>
                    </div>
                  ))}</div>
              )}
              {sideTab === "summary" && (
                <div className="divide-y text-sm" style={{ borderColor: "var(--border-color)" }}>
                  {[["admin.purchaseOrders.create.subtotal", totals.subtotal], ["admin.purchaseOrders.create.tax", totals.tax], ["admin.purchaseOrders.create.overallTax", totals.overallTaxAmount], ["admin.purchaseOrders.create.shipping", totals.shipping], ["admin.purchaseOrders.create.discount", totals.discount]].map(([key, amount]) => <div key={key} className="flex items-center justify-between gap-3 py-2" style={{ borderColor: "var(--border-color)" }}><span style={{ color: "var(--text-secondary)" }}>{t(key)}</span><span className="font-medium tabular-nums" style={{ color: "var(--text-primary)" }}>{money(amount)}</span></div>)}
                  <div className="flex items-center justify-between gap-3 border-t pt-2 font-semibold" style={{ borderColor: "var(--border-color)" }}><span style={{ color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.total")}</span><span className="tabular-nums" style={{ color: "var(--accent)" }}>{money(totals.total)}</span></div>
                </div>
              )}
              {sideTab === "history" && (
                <div className="space-y-3">
                  {events.map((e, i) => (
                    <div key={i} className="flex gap-3 text-[13px] p-2.5 rounded-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ background: "var(--accent)" }}><Circle size={8} fill="white" color="white" aria-hidden="true" /></div>
                      <div><div className="font-extrabold text-sm" style={{ color: "var(--text-primary)" }}>{e.label}</div><div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{e.t}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg p-4" style={cardStyle}>
              <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
                <Building2 size={16} style={{ color: "var(--accent)" }} />
              </div>
              <h2 className="text-base font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.vendorSummary")}</h2>
            </div>
            {selectedVendor ? (
              <div className="flex items-center gap-3 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
                <Building2 size={18} className="shrink-0" style={{ color: "var(--text-secondary)" }} />
                <div className="min-w-0">
                  <div className="font-extrabold text-base truncate" style={{ color: "var(--text-primary)" }}>{vendorNameOf(selectedVendor)}</div>
                  <div className="font-mono text-[11px] font-bold" style={{ color: "var(--text-secondary)" }}>{selectedVendor.vendor_code}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
                <Building2 size={18} className="shrink-0" style={{ color: "var(--text-muted)" }} />
                <div><div className="font-extrabold text-sm" style={{ color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.selectVendor")}</div><div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.create.vendorDetailsHint")}</div></div>
              </div>
            )}
          </section>

        </aside>
      </div>

      {/* product picker popup — products only, nothing pre-ticked */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={closePicker}>
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-lg shadow-lg" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--border-color)", background: "var(--bg-card)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--accent-soft)" }}>
                    <Package size={16} style={{ color: "var(--accent)" }} />
                  </div>
                  <h3 className="text-lg font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.addProducts")}</h3>
                </div>
                <button onClick={closePicker} className="w-8 h-8 rounded-full flex items-center justify-center transition hover:scale-110 hover:shadow-md" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }} aria-label={t("common.close")}><X size={16} aria-hidden="true" /></button>
              </div>
              <p className="text-xs mt-1.5" style={{ color: "var(--text-secondary)" }}>{t("admin.purchaseOrders.create.pickerInstructions")}</p>
              <div className="mt-3 grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_160px_160px]">
                <div className="relative min-w-0">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} aria-hidden="true" />
                  <input
                    autoFocus value={pickerSearch}
                    onChange={(e) => { setPickerSearch(e.target.value); setPickerPage(1); }}
                    placeholder={t("admin.purchaseOrders.create.searchProducts")}
                    className="w-full h-10 pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-2 focus:ring-blue-200" style={inputStyle}
                  />
                </div>
                <select value={pickerCategory} onChange={(e) => { setPickerCategory(e.target.value); setPickerPage(1); }} className="h-10 min-w-0 px-3 rounded-lg text-[13px] outline-none transition focus:ring-2 focus:ring-blue-200" style={inputStyle}>
                  <option value="all">{t("admin.purchaseOrders.create.categoryAll")}</option>{categories.map(([cid, name]) => <option key={cid} value={cid}>{name}</option>)}
                </select>
                <select value={pickerBrand} onChange={(e) => { setPickerBrand(e.target.value); setPickerPage(1); }} className="h-10 min-w-0 px-3 rounded-lg text-[13px] outline-none transition focus:ring-2 focus:ring-blue-200" style={inputStyle}>
                  <option value="all">{t("admin.purchaseOrders.create.brandAll")}</option>{brands.map(([brandId, name]) => <option key={brandId} value={brandId}>{name}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 space-y-1 px-3 py-3">
              {stockLoading ? <div className="p-8 text-center"><div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.loadingProducts")}</div></div> :
                pickerRows.map((g) => {
                  const ticked = checkedProducts[String(g.product_id)] === true;
                  const stock = g.variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);
                  return (
                    <label key={g.product_id} className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-[var(--bg-row-hover)]" style={{ background: ticked ? "var(--accent-soft)" : "var(--bg-card)", borderColor: ticked ? "var(--accent)" : "var(--border-color)" }}>
                      <input type="checkbox" checked={ticked} onChange={(e) => setCheckedProducts((p) => ({ ...p, [String(g.product_id)]: e.target.checked }))} className="h-4 w-4 shrink-0 cursor-pointer rounded" style={{ accentColor: "var(--accent)" }} />
                      <Thumb src={g.image} alt={g.product_name} size="w-12 h-12" />
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-[14px] truncate" style={{ color: ticked ? "var(--accent)" : "var(--text-primary)" }}>{g.product_name}</div>
                        <div className="text-[11px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.create.variantsCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(g.variants.length) })} · {t("admin.purchaseOrders.create.stockCount", { count: new Intl.NumberFormat(intlLocale(locale)).format(stock) })}{g.category_name ? ` · ${g.category_name}` : ""}</div>
                      </div>
                    </label>
                  );
                })}
              {!stockLoading && !pickerRows.length && <div className="p-8 text-center"><div className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.noProductsMatch")}</div><div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.create.adjustFilters")}</div></div>}
            </div>
            <div className="px-4 py-2.5" style={{ borderTop: "1px solid var(--border-color)" }}>
              <button onClick={() => setQcOpen(true)} className="w-full h-9 rounded-lg text-[13px] font-medium flex items-center justify-center gap-2 transition-colors hover:bg-[var(--bg-row-hover)]" style={{ background: "var(--bg-card)", color: "var(--accent)" }}><Plus size={15} /> {t("admin.purchaseOrders.create.createNewProduct")}</button>
            </div>
            <div className="px-4 py-3 flex items-center justify-between text-xs font-medium" style={{ borderTop: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-secondary)" }}>
              <span>{t("admin.purchaseOrders.create.pickerPage", { page: safePickerPage, pages: pickerPages, products: pickerFiltered.length, selected: tickedProducts })}</span>
              <div className="flex gap-2">
                <button disabled={safePickerPage <= 1} onClick={() => setPickerPage((p) => p - 1)} className="h-9 px-3 rounded-lg text-xs font-extrabold transition-all duration-200 hover:shadow-md disabled:opacity-30" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.previous")}</button>
                <button disabled={safePickerPage >= pickerPages} onClick={() => setPickerPage((p) => p + 1)} className="h-9 px-3 rounded-lg text-xs font-extrabold transition-all duration-200 hover:shadow-md disabled:opacity-30" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>{t("admin.purchaseOrders.create.next")}</button>
                <button disabled={addingAll || !tickedProducts} onClick={addSelectedProducts} className="h-9 px-4 rounded-lg text-xs font-semibold transition hover:opacity-90 disabled:opacity-40" style={accentBtn}>{addingAll ? t("admin.purchaseOrders.create.adding") : t("admin.purchaseOrders.create.addSelected", { count: tickedProducts })}</button>
                <button onClick={closePicker} className="h-9 px-4 rounded-lg text-xs font-medium transition hover:bg-[var(--bg-row-hover)]" style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>{t("common.close")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New product — same top-up form as the Products page (with variants step for PO) */}
      <VendorFormModal
        open={vendorFormOpen}
        form={vendorForm}
        setForm={setVendorForm}
        isPending={createVendorMutation.isPending}
        onSave={() => createVendorMutation.mutate()}
        onClose={() => setVendorFormOpen(false)}
      />
      <ProductFormModal
        open={qcOpen}
        onClose={() => setQcOpen(false)}
        zIndex="z-[60]"
        onCreated={(data) => {
          const product = data?.product || data?.data || data;
          const productId = String(product?._id || "");
          if (!productId) { toast.error(t("admin.purchaseOrders.create.toast.productIdMissing")); return; }
          setNewProductId(productId);
          setQcOpen(false);
        }}
      />
      {newProductId && (
        <VariantForm
          productId={newProductId}
          onCancel={() => setNewProductId("")}
          onSuccess={(result) => {
            if (addCreatedVariantToOrder(result, newProductId)) setNewProductId("");
          }}
        />
      )}
      {variantProductId && (
        <VariantForm
          productId={variantProductId}
          onCancel={() => setVariantProductId("")}
          onSuccess={(result) => {
            if (addCreatedVariantToOrder(result, variantProductId)) setVariantProductId("");
          }}
        />
      )}
    </div>
  );
}

function PurchaseOrderLoadingFallback() {
  const { t } = useTranslation();
  return <p className="text-sm p-6 text-center" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.create.loading")}</p>;
}

export default function NewPOPageWrapper() {
  return (
    <Suspense fallback={<PurchaseOrderLoadingFallback />}>
      <NewPOPage />
    </Suspense>
  );
}
