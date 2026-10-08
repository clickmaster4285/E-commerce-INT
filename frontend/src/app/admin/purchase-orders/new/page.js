"use client";
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
import { toast } from "sonner";
import { Plus, Search, Trash2, Building2, CalendarDays, ChevronDown, MoreVertical, Package } from "lucide-react";

// Same tokens as the rest of the admin — no new design system.
const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
const accentBtn = { backgroundColor: "var(--accent)", color: "var(--accent-text)" };
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  if (!API_ORIGIN) return url;
  return `${API_ORIGIN}${url.startsWith("/") ? url : `/${url}`}`;
};

const money = (n, dec = 2) => `Rs. ${(Math.max(0, Number(n) || 0)).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
const nowStamp = () => new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

function SectionTitle({ children }) {
  return <h2 className="text-sm font-bold mb-3">{children}</h2>;
}
function FieldLabel({ children, required }) {
  return <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{children} {required && <span style={{ color: "var(--danger-text)" }}>*</span>}</label>;
}
function Thumb({ src, alt, size = "w-9 h-9", circle = false }) {
  const round = circle ? "rounded-full" : "rounded-lg";
  const url = getImageUrl(src);
  if (url) return <img src={url} alt={alt} className={`${size} shrink-0 ${round} object-cover`} style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }} />;
  return <div className={`${size} shrink-0 ${round} flex items-center justify-center text-xs`} style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>▣</div>;
}

const GROUP_TINT = "color-mix(in srgb, var(--accent) 9%, transparent)";
const rowInputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

function NewPOPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const [vendorId, setVendorId] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCategory, setPickerCategory] = useState("all");
  const [pickerPage, setPickerPage] = useState(1);
  const [checkedProducts, setCheckedProducts] = useState({}); // product_id -> true means ticked; default unticked
  const [vDetails, setVDetails] = useState({}); // variant_id -> { cost_price, selling_price }
  const [addingAll, setAddingAll] = useState(false);
  // New-product popup uses the same top-up form as the Products page.
  const [qcOpen, setQcOpen] = useState(false);
  const [newProductId, setNewProductId] = useState("");
  const [lines, setLines] = useState([]); // each line: { ..., included: true }
  const [shipping, setShipping] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [sideTab, setSideTab] = useState("items");
  const [events, setEvents] = useState([{ t: nowStamp(), label: "Order started" }]);
  const vendorBoxRef = useRef(null);

  const pushEvent = (label) => setEvents((e) => [...e, { t: nowStamp(), label }]);

  const { data: vendorsRaw } = useQuery({ queryKey: ["vendors-all"], queryFn: () => vendorApi.getAll() });
  const vendorList = useMemo(() => {
    const arr = Array.isArray(vendorsRaw) ? vendorsRaw : vendorsRaw?.data || [];
    return arr.filter((v) => !v.is_deleted && v.is_active);
  }, [vendorsRaw]);
  const vendorOptions = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendorList;
    return vendorList.filter((v) => [v.name, v.vendor_code, v.company_name, v.phone].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [vendorList, vendorSearch]);
  const selectedVendor = vendorList.find((v) => v._id === vendorId);

  // Pre-select vendor when opened from a vendor detail page (?vendor=<id>).
  useEffect(() => {
    if (prefilled) return;
    const pre = searchParams.get("vendor");
    if (pre && vendorId === "" && vendorList.some((v) => v._id === pre)) {
      setVendorId(pre);
      pushEvent("Vendor pre-selected");
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
  const categories = useMemo(() => {
    const m = new Map();
    for (const v of stockAll || []) {
      const id = String(v.category_id || "");
      if (id && !m.has(id)) m.set(id, v.category_name || "Uncategorized");
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [stockAll]);

  // Product-level groups for the popup (variants fetched on add).
  const productGroups = useMemo(() => {
    const m = new Map();
    for (const v of stockAll || []) {
      const pid = String(v.product_id || v._id);
      if (!m.has(pid)) m.set(pid, { product_id: pid, product_name: v.product_name || "Unknown Product", image: v.image || "", category_id: String(v.category_id || ""), category_name: v.category_name || "", variants: [] });
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
      if (q && ![g.product_name, ...g.variants.map((v) => v.sku)].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [productGroups, pickerSearch, pickerCategory]);
  const PICKER_SIZE = 8;
  const pickerPages = Math.max(1, Math.ceil(pickerFiltered.length / PICKER_SIZE));
  const safePickerPage = Math.min(pickerPage, pickerPages);
  const pickerRows = pickerFiltered.slice((safePickerPage - 1) * PICKER_SIZE, safePickerPage * PICKER_SIZE);

  const openPicker = () => {
    setPickerSearch("");
    setPickerCategory("all");
    setPickerPage(1);
    setCheckedProducts({});
    setPickerOpen(true);
  };

  const updateLine = (id, patch) => setLines((prev) => prev.map((l) => (String(l.variant_id) === String(id) ? { ...l, ...patch } : l)));

  // Add all variants of ticked products — every variant line starts ticked (included).
  const addSelectedProducts = async () => {
    const chosen = pickerFiltered.filter((g) => checkedProducts[String(g.product_id)] === true);
    if (!chosen.length) { toast.error("Tick at least one product"); return; }
    setAddingAll(true);
    try {
      const variants = chosen.flatMap((g) => g.variants);
      const missing = [...new Set(variants.map((v) => String(v._id)).filter((vid) => !vDetails[vid]))];
      let detMap = {};
      if (missing.length) {
        const res = await Promise.all(missing.map((vid) => variantApi.getById(vid).catch(() => null)));
        res.forEach((full, i) => {
          if (full) detMap[missing[i]] = { cost_price: Math.max(0, Number(full.cost_price) || 0), selling_price: Math.max(0, Number(full.selling_price) || 0), topup: Number(full.topup) || 0 };
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
            tax_rate: 0, batch_no: "", mfg_date: "", expiry_date: "", included: true,
          });
          have.add(String(item._id));
        }
        added = fresh.length;
        return [...prev, ...fresh];
      });
      pushEvent(`Added ${chosen.length} product${chosen.length === 1 ? "" : "s"} (${added} new variant${added === 1 ? "" : "s"})`);
      toast.success(added ? `${added} variant${added === 1 ? "" : "s"} added (all ticked)` : "All variants already in order");
      setPickerOpen(false);
    } finally { setAddingAll(false); }
  };

  const includedLines = useMemo(() => lines.filter((l) => l.included !== false), [lines]);

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
    return { subtotal, tax, shipping: ship, discount: disc, total: Math.max(0, Math.round(subtotal + tax + ship - disc)) };
  }, [includedLines, shipping, discount]);

  const buildPayload = () => ({
    vendor_id: vendorId,
    items: includedLines.map((l) => ({
      variant_id: l.variant_id,
      qty_ordered: Math.max(1, Math.floor(Number(l.qty_ordered) || 1)),
      cost_price: Math.max(0, Number(l.cost_price) || 0),
      tax_rate: Math.min(100, Math.max(0, Number(l.tax_rate) || 0)),
      topup: Number(l.topup) || 0,
      batch_no: String(l.batch_no || ""),
      mfg_date: l.mfg_date || undefined,
      expiry_date: l.expiry_date || undefined,
    })),
    shipping: Math.max(0, Number(shipping) || 0),
    discount: Math.max(0, Number(discount) || 0),
    expected_date: expectedDate || undefined,
    notes: notes.trim() || undefined,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const created = await purchaseOrderApi.create(buildPayload());
      return created?.data?._id;
    },
    onSuccess: (id) => {
      toast.success("Purchase order created (Pending)");
      qc.invalidateQueries({ queryKey: ["pos"] });
      qc.invalidateQueries({ queryKey: ["pos-all"] });
      router.push(`/admin/purchase-orders/${id}`);
    },
    onError: (e) => { toast.error(e?.response?.data?.message || "Save failed"); },
  });

  const saveDisabled = createMutation.isPending || !vendorId || !includedLines.length;
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
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={style}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "currentColor" }} />{l.in_stock}</span>;
  };
  const groupStatus = (g) => {
    const ss = g.lines.map(variantStock);
    if (ss.includes("out")) return "out";
    if (ss.includes("low")) return "low";
    return "in";
  };
  const groupPill = (g) => {
    const s = groupStatus(g);
    const label = s === "out" ? "Out of Stock" : s === "low" ? "Low Stock" : "In Stock";
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
    <div>
      <div className="grid gap-4 items-start xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* LEFT */}
        <div className="space-y-4 min-w-0">
          <div>
            <h1 className="text-xl font-bold">Create Purchase Order</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Add vendor, products and details to create a new purchase order.</p>
          </div>

          {/* 1. Vendor Information */}
          <section className="rounded-2xl p-5 shadow-lg" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}>
                <Building2 size={16} color="#fff" />
              </div>
              <h2 className="text-base font-extrabold tracking-tight" style={{ color: "#0f172a" }}>1. Vendor Information</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="relative" ref={vendorBoxRef}>
                <FieldLabel required>Vendor</FieldLabel>
                <button type="button" onClick={() => setVendorOpen((o) => !o)} className="w-full h-10 px-4 rounded-xl text-sm flex items-center justify-between gap-2 outline-none shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: selectedVendor ? "#0f172a" : "#64748b" }}>
                  <span className="flex items-center gap-2.5 truncate font-medium">
                    <Search size={14} className="shrink-0" style={{ color: "#2563eb" }} />{selectedVendor ? `${selectedVendor.name} (${selectedVendor.vendor_code})` : "Select Vendor"}
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ color: "#94a3b8", background: "#f1f5f9" }}>▾</span>
                </button>
                {vendorOpen && (
                  <div className="absolute z-40 mt-2 w-full rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                    <div className="p-3" style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                      <input autoFocus value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} placeholder="Search vendors..." className="w-full h-10 px-3 rounded-xl text-sm outline-none font-medium shadow-sm transition focus:shadow-md focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }} />
                    </div>
                    <div className="max-h-[240px] overflow-y-auto py-1">
                      {vendorOptions.map((v) => (
                        <button key={v._id} type="button" onClick={() => { setVendorId(v._id); setVendorOpen(false); setVendorSearch(""); pushEvent(`Vendor selected: ${v.name}`); }} className="w-full px-4 py-3 text-left text-[13px] transition-all duration-150 rounded-xl mx-2 my-0.5" style={{ backgroundColor: v._id === vendorId ? "rgba(37,99,235,0.08)" : "transparent", border: v._id === vendorId ? "1px solid rgba(37,99,235,0.2)" : "1px solid transparent" }} onMouseEnter={(e) => { if (v._id !== vendorId) { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; } }} onMouseLeave={(e) => { if (v._id !== vendorId) { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "transparent"; } }}>
                          <div className="font-bold text-sm" style={{ color: v._id === vendorId ? "#2563eb" : "#0f172a" }}>{v.name} <span className="font-mono font-normal text-[11px]" style={{ color: "#64748b" }}>{v.vendor_code}</span></div>
                          <div className="text-[11px] font-medium" style={{ color: "#94a3b8" }}>{[v.company_name, v.city].filter(Boolean).join(" · ")}</div>
                        </button>
                      ))}
                      {!vendorOptions.length && <p className="px-4 py-6 text-center text-sm font-medium" style={{ color: "#94a3b8" }}>No vendor found</p>}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <FieldLabel>Expected Delivery Date</FieldLabel>
                <div className="relative">
                  <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="w-full h-10 px-4 rounded-xl text-sm outline-none font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }} />
                  <CalendarDays size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#94a3b8" }} />
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-2xl p-4 shadow-inner" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", border: "1px solid #e2e8f0" }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}>
                  <span className="text-[10px] font-extrabold text-white">i</span>
                </div>
                <p className="text-xs font-extrabold tracking-wide uppercase" style={{ color: "#2563eb" }}>Vendor Details</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-[13px]">
                {[ ["Name", selectedVendor?.name], ["Company Name", selectedVendor?.company_name], ["Email", selectedVendor?.email], ["Phone", selectedVendor?.phone], ["City", selectedVendor?.city] ].map(([l, val]) => (
                  <div key={l} className="rounded-xl p-3 shadow-sm transition hover:shadow-md" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                    <div className="text-[10px] font-extrabold uppercase tracking-wider mb-1" style={{ color: "#94a3b8" }}>{l}</div>
                    <div className="font-bold text-sm truncate" style={{ color: "#0f172a" }}>{val || "—"}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 2. Products / Items */}
          <section className="rounded-2xl p-5 shadow-lg" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)" }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}>
                  <Package size={16} color="#fff" />
                </div>
                <h2 className="text-base font-extrabold tracking-tight" style={{ color: "#0f172a" }}>2. Products / Items <span className="font-medium text-sm ml-1.5 px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(37,99,235,0.08)", color: "#2563eb" }}>{includedLines.length > 0 ? `${includedLines.length} in order` : "0 in order"}</span></h2>
              </div>
              <button onClick={openPicker} className="h-9 px-4 rounded-xl text-[13px] font-bold flex items-center gap-1.5 transition-all duration-200 hover:scale-[1.03] hover:shadow-md active:scale-[0.98] whitespace-nowrap shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "#fff", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}><Plus size={14} strokeWidth={2.5} /> Add Product</button>
            </div>
            {lines.length === 0 ? (
              <div className="py-12 flex flex-col items-center text-center rounded-2xl" style={{ border: "2px dashed #cbd5e1", background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)" }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-inner mb-3" style={{ background: "linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 100%)" }}><Package size={32} style={{ color: "#94a3b8" }} /></div>
                <div className="font-extrabold text-base" style={{ color: "#0f172a" }}>No products added</div>
                <div className="text-xs mt-1.5 max-w-xs" style={{ color: "#64748b" }}>Add products to enter cost, sell price, batch, and quantity details.</div>
                <button onClick={openPicker} className="h-10 px-5 mt-5 rounded-xl text-[13px] font-bold transition-all duration-200 hover:scale-[1.03] hover:shadow-lg active:scale-[0.98] shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "#fff", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}>Browse products</button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 px-1 py-2 text-[12px] rounded-lg" style={{ backgroundColor: "rgba(37,99,235,0.04)", border: "1px solid rgba(37,99,235,0.1)" }}>
                  <span className="font-semibold px-2" style={{ color: "#2563eb" }}>{includedLines.length}/{lines.length} variants included in order</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setLines((prev) => prev.map((line) => ({ ...line, included: true })))} className="underline font-bold text-[11px] transition hover:text-blue-700" style={{ color: "#2563eb" }}>Select all</button>
                    <button onClick={() => setLines((prev) => prev.map((line) => ({ ...line, included: false })))} className="underline font-medium text-[11px] transition hover:text-slate-500" style={{ color: "#64748b" }}>Deselect all</button>
                  </div>
                </div>
                <div className="mt-2 space-y-3">
                  {groupedLines.map((group) => (
                    <div key={group.id} className="overflow-hidden rounded-2xl shadow-md transition-all duration-200 hover:shadow-xl" style={{ border: "1px solid #e2e8f0", background: "#fff" }}>
                      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-4" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", borderBottom: "1px solid #e2e8f0" }}>
                        <input
                          type="checkbox"
                          checked={group.lines.every((line) => line.included !== false)}
                          onChange={(event) => setGroupTick(group, event.target.checked)}
                          className="w-4 h-4 rounded cursor-pointer shrink-0"
                          style={{ accentColor: "var(--accent)" }}
                          aria-label={`Include all variants of ${group.name}`}
                        />
                        <Thumb src={group.image} alt={group.name} size="w-12 h-12" />
                        <div className="min-w-0 flex-1">
                          <div className="font-extrabold text-sm truncate tracking-tight" style={{ color: "#0f172a" }}>{group.name || "Unknown Product"}</div>
                          <div className="text-xs mt-1 font-medium" style={{ color: "#64748b" }}>{group.lines.filter((line) => line.included !== false).length}/{group.lines.length} variants included</div>
                        </div>
                        <button onClick={() => removeProduct(group)} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 hover:scale-[1.05] hover:shadow-sm active:scale-[0.95]" style={{ color: "#dc2626", border: "1.5px solid #fecaca", background: "#fef2f2" }}>Remove product</button>
                        <button
                          type="button"
                          onClick={() => setExpanded((previous) => ({ ...previous, [group.id]: previous[group.id] === false }))}
                          className="p-2.5 rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-md active:scale-95"
                          style={{ color: "#334155", background: "#fff", border: "1px solid #e2e8f0" }}
                          aria-label={`${expanded[group.id] === false ? "Expand" : "Collapse"} ${group.name} variants`}
                          aria-expanded={expanded[group.id] !== false}
                        >
                          <ChevronDown size={18} className={`transition-transform duration-300 ${expanded[group.id] === false ? "-rotate-90" : ""}`} strokeWidth={2.5} />
                        </button>
                      </div>
                      {expanded[group.id] !== false && (
                        <div className="divide-y" style={{ borderColor: "var(--border-color)" }}>
                          <div className="hidden xl:grid xl:grid-cols-[24px_minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.5fr)_minmax(0,0.5fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_50px] items-center gap-2 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: "#64748b", background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", borderBottom: "1px solid #e2e8f0" }}>
                            <span>✓</span><span>Product / Variant</span><span className="text-center">In Stock</span><span className="text-right">Cost Price</span><span className="text-right">Sell Price</span><span className="text-right">Qty</span><span className="text-right">Tax %</span><span className="text-right">Line Total</span><span>Batch No.</span><span>Mfg Date</span><span>Expiry Date</span><span className="text-center">Actions</span>
                          </div>
                            {group.lines.map((line) => {
                              const lineTotal = Math.round(Math.max(0, Number(line.cost_price) || 0) * Math.max(1, Math.floor(Number(line.qty_ordered) || 1)));
                              return <div key={String(line.variant_id)} className="min-w-0 px-3 sm:px-4 py-3.5 transition-all duration-200 rounded-xl mx-1 my-0.5" style={{ backgroundColor: line.included === false ? "#f8fafc" : "#fff", opacity: line.included === false ? 0.7 : 1, border: line.included === false ? "1px solid #e2e8f0" : "1px solid transparent" }}>
                                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-[24px_minmax(0,1.5fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.5fr)_minmax(0,0.5fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_50px] gap-2 xl:items-center">
                                  <div className="flex items-center"><input type="checkbox" checked={line.included !== false} onChange={(event) => updateLine(line.variant_id, { included: event.target.checked })} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} aria-label={`Include ${line.title || line.sku}`} /></div>
                                  <div className="min-w-0 flex items-center gap-2"><Thumb src={line.image} alt={line.title || line.product_name} size="w-10 h-10" /><div className="min-w-0"><div className="font-semibold text-xs truncate" title={line.title || "Default variant"}>{line.title || "Default variant"}</div><div className="font-mono text-[10px] truncate" style={{ color: "var(--text-secondary)" }}>{line.sku || "—"}</div></div></div>
                                  <div className="min-w-0 xl:flex xl:justify-center"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "#94a3b8" }}>In Stock</div>{stockPill(line)}</div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "#94a3b8" }}>Cost Price</div><input type="number" min={0} step="0.01" value={line.cost_price} onChange={(event) => updateLine(line.variant_id, { cost_price: Math.max(0, Number(event.target.value) || 0) })} className="w-full min-w-0 h-9 px-2 rounded-lg text-right text-[11px] tabular-nums outline-none font-medium shadow-sm transition focus:shadow-md focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }} /></div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "#94a3b8" }}>Sell Price</div><input type="number" min={0} step="0.01" value={line.sell_price ?? ""} onChange={(event) => updateLine(line.variant_id, { sell_price: Math.max(0, Number(event.target.value) || 0) })} className="w-full min-w-0 h-9 px-2 rounded-lg text-right text-[11px] tabular-nums outline-none font-medium shadow-sm transition focus:shadow-md focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }} /></div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "#94a3b8" }}>Qty</div><input type="number" min={1} step={1} value={line.qty_ordered} onChange={(event) => updateLine(line.variant_id, { qty_ordered: Math.max(1, Math.floor(Number(event.target.value) || 1)) })} className="w-full min-w-0 h-9 px-2 rounded-lg text-right text-[11px] tabular-nums outline-none font-medium shadow-sm transition focus:shadow-md focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }} /></div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "#94a3b8" }}>Tax %</div><input type="number" min={0} max={100} value={line.tax_rate} onChange={(event) => updateLine(line.variant_id, { tax_rate: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })} className="w-full min-w-0 h-9 px-2 rounded-lg text-right text-[11px] tabular-nums outline-none font-medium shadow-sm transition focus:shadow-md focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }} /></div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "#94a3b8" }}>Line Total</div><div className="h-9 px-2 rounded-lg flex items-center justify-end font-extrabold text-[11px] tabular-nums whitespace-nowrap overflow-hidden shadow-inner" style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)", border: "1.5px solid #e2e8f0", color: "#0f172a" }}>{money(lineTotal, 0)}</div></div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "#94a3b8" }}>Batch No.</div><input value={line.batch_no || ""} onChange={(event) => updateLine(line.variant_id, { batch_no: event.target.value })} placeholder="Batch" className="w-full min-w-0 h-9 px-2 rounded-lg text-[11px] outline-none font-medium shadow-sm transition focus:shadow-md focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }} /></div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "#94a3b8" }}>Mfg Date</div><input type="date" value={line.mfg_date || ""} onChange={(event) => updateLine(line.variant_id, { mfg_date: event.target.value })} className="w-full min-w-0 h-9 px-2 rounded-lg text-[10px] outline-none font-medium shadow-sm transition focus:shadow-md focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }} /></div>
                                  <div className="min-w-0"><div className="mb-1 text-[9px] font-bold xl:hidden tracking-wide" style={{ color: "#94a3b8" }}>Expiry Date</div><input type="date" value={line.expiry_date || ""} onChange={(event) => updateLine(line.variant_id, { expiry_date: event.target.value })} className="w-full min-w-0 h-9 px-2 rounded-lg text-[10px] outline-none font-medium shadow-sm transition focus:shadow-md focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }} /></div>
                                  <div className="flex items-center justify-center"><button onClick={() => setLines((prev) => prev.filter((item) => String(item.variant_id) !== String(line.variant_id)))} className="h-9 w-9 flex items-center justify-center rounded-xl transition-all duration-200 hover:scale-110 hover:shadow-md active:scale-95" style={{ color: "#dc2626", background: "#fef2f2", border: "1.5px solid #fecaca" }} aria-label={`Remove ${line.title || line.product_name}`}><Trash2 size={15} strokeWidth={2.5} /></button></div>
                                </div>
                              </div>;
                            })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={openPicker} className="mt-4 text-[13px] font-extrabold transition-all duration-200 hover:scale-[1.03] hover:shadow-md active:scale-[0.98]" style={{ color: "#2563eb" }}><Plus size={14} strokeWidth={2.5} /> Add Another Product</button>
              </>
            )}
          </section>
          <div className="grid md:grid-cols-2 gap-4">
            {/* 3. Additional Details */}
            <section className="rounded-2xl p-5 shadow-lg" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)" }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}>
                  <Plus size={16} color="#fff" />
                </div>
                <h2 className="text-base font-extrabold tracking-tight" style={{ color: "#0f172a" }}>3. Additional Details</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Shipping (Rs.)</FieldLabel>
                  <input type="number" min={0} value={shipping} onChange={(e) => setShipping(e.target.value)} className="w-full h-10 px-4 rounded-xl text-sm outline-none font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }} />
                </div>
                <div>
                  <FieldLabel>Discount (Rs.)</FieldLabel>
                  <input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} className="w-full h-10 px-4 rounded-xl text-sm outline-none font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }} />
                </div>
              </div>
              <div className="mt-4">
                <FieldLabel>Notes</FieldLabel>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Enter any additional notes..." className="w-full px-4 py-3 rounded-xl text-sm outline-none font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-md focus:ring-2 focus:ring-blue-200 resize-y" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }} />
              </div>
            </section>
            {/* 4. Summary */}
            <section className="rounded-2xl p-5 shadow-lg" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)" }}>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}>
                  <span className="text-[10px] font-extrabold text-white">Rs</span>
                </div>
                <h2 className="text-base font-extrabold tracking-tight" style={{ color: "#0f172a" }}>4. Summary</h2>
              </div>
              <div className="text-sm space-y-2.5">
                <div className="flex justify-between items-center py-1.5 px-3 rounded-xl" style={{ background: "#f8fafc" }}><span className="font-medium" style={{ color: "#64748b" }}>Subtotal</span><b className="font-extrabold" style={{ color: "#0f172a" }}>{money(totals.subtotal)}</b></div>
                <div className="flex justify-between items-center py-1.5 px-3 rounded-xl" style={{ background: "#f8fafc" }}><span className="font-medium" style={{ color: "#64748b" }}>Tax</span><b className="font-extrabold" style={{ color: "#0f172a" }}>{money(totals.tax)}</b></div>
                <div className="flex justify-between items-center py-1.5 px-3 rounded-xl" style={{ background: "#f8fafc" }}><span className="font-medium" style={{ color: "#64748b" }}>Shipping</span><b className="font-extrabold" style={{ color: "#0f172a" }}>{money(totals.shipping)}</b></div>
                <div className="flex justify-between items-center py-1.5 px-3 rounded-xl" style={{ background: "#f8fafc" }}><span className="font-medium" style={{ color: "#64748b" }}>Discount</span><b className="font-extrabold" style={{ color: "#0f172a" }}>{money(totals.discount)}</b></div>
                <div className="flex justify-between items-center pt-3 px-3 font-extrabold text-base rounded-xl overflow-hidden" style={{ borderTop: "2px solid #e2e8f0", background: "#ecfdf5" }}><span className="truncate" style={{ color: "#059669" }}>Total</span><span className="truncate whitespace-nowrap ml-2" style={{ color: "#059669" }}>{money(totals.total)}</span></div>
              </div>
            </section>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="space-y-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-8rem)] xl:overflow-y-auto xl:overscroll-contain">
          <section className="rounded-2xl p-5 shadow-lg" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
                <span className="text-[10px] font-extrabold text-white">PO</span>
              </div>
              <h2 className="text-base font-extrabold tracking-tight" style={{ color: "#0f172a" }}>Purchase Order</h2>
            </div>
            <div className="text-center">
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-extrabold tracking-wide uppercase mb-2" style={{ background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }}>Pending</span>
              <div className="font-mono font-extrabold text-xl tracking-tight" style={{ color: "#0f172a" }}>{nextCode?.nextCode || "PO-..."}</div>
              <div className="text-[11px] font-medium mt-1" style={{ color: "#94a3b8" }}>Auto generated</div>
            </div>
            <div className="flex gap-2 mt-4">
              <button disabled={saveDisabled} onClick={() => createMutation.mutate()} className="h-11 px-5 rounded-2xl text-[13px] font-extrabold transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98] shadow-lg flex-1" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "#fff", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}>
                {createMutation.isPending ? "Creating..." : "Create PO"}
              </button>
            </div>
            {(lines.length > 0 || vendorId) && (
              <button
                onClick={() => { if (confirm("Clear this order?")) { setLines([]); setVendorId(""); setExpectedDate(""); setShipping(0); setDiscount(0); setNotes(""); } }}
                className="mt-3 w-full text-[12px] font-bold transition-all duration-200 hover:scale-[1.02] py-2 rounded-xl" style={{ color: "#64748b", background: "#f8fafc", border: "1px solid #e2e8f0" }}
              >
                Clear order
              </button>
            )}
          </section>

          <section className="rounded-2xl overflow-hidden shadow-lg" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)" }}>
            <div className="flex px-2" style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
              {[["items", `Items ${includedLines.length}`], ["summary", "Summary"], ["history", "History"]].map(([k, label]) => (
                <button key={k} onClick={() => setSideTab(k)} className="px-4 py-3 text-[13px] font-extrabold transition-all duration-200 rounded-t-xl mx-0.5" style={sideTab === k ? { color: "#2563eb", background: "#fff", borderBottom: "2px solid #2563eb", boxShadow: "0 -2px 8px rgba(37,99,235,0.08)" } : { color: "#94a3b8", background: "transparent" }}>{label}</button>
              ))}
            </div>
            <div className="p-4">
              {sideTab === "items" && (
                includedLines.length === 0 ? <div className="text-center py-6"><div className="text-sm font-bold" style={{ color: "#0f172a" }}>No ticked variants yet</div><div className="text-xs mt-1" style={{ color: "#94a3b8" }}>Select products to see them here</div></div> :
                  <div className="space-y-2">{includedLines.map((l) => (
                    <div key={String(l.variant_id)} className="flex items-center gap-3 p-2.5 rounded-xl transition hover:shadow-md" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                      <Thumb src={l.image} alt={l.product_name} size="w-10 h-10" />
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-sm truncate" style={{ color: "#0f172a" }}>{l.product_name}</div>
                        <div className="text-[11px] font-medium" style={{ color: "#64748b" }}>{l.sku} × {l.qty_ordered}</div>
                      </div>
                      <b className="font-extrabold text-sm whitespace-nowrap" style={{ color: "#0f172a" }}>{(Math.round(Math.max(0, Number(l.cost_price) || 0) * Math.max(1, Math.floor(Number(l.qty_ordered) || 1)))).toLocaleString()}</b>
                    </div>
                  ))}</div>
              )}
              {sideTab === "summary" && (
                <div className="text-sm space-y-1.5">
                  <div className="flex justify-between items-center py-2 px-3 rounded-xl" style={{ background: "#f8fafc" }}><span className="font-semibold" style={{ color: "#64748b" }}>Subtotal</span><b className="font-extrabold" style={{ color: "#0f172a" }}>{money(totals.subtotal)}</b></div>
                  <div className="flex justify-between items-center py-2 px-3 rounded-xl" style={{ background: "#f8fafc" }}><span className="font-semibold" style={{ color: "#64748b" }}>Tax</span><b className="font-extrabold" style={{ color: "#0f172a" }}>{money(totals.tax)}</b></div>
                  <div className="flex justify-between items-center py-2 px-3 rounded-xl" style={{ background: "#f8fafc" }}><span className="font-semibold" style={{ color: "#64748b" }}>Shipping</span><b className="font-extrabold" style={{ color: "#0f172a" }}>{money(totals.shipping)}</b></div>
                  <div className="flex justify-between items-center py-2 px-3 rounded-xl" style={{ background: "#f8fafc" }}><span className="font-semibold" style={{ color: "#64748b" }}>Discount</span><b className="font-extrabold" style={{ color: "#0f172a" }}>{money(totals.discount)}</b></div>
                  <div className="flex justify-between items-center pt-2 px-3 font-extrabold text-base rounded-xl" style={{ borderTop: "2px solid #e2e8f0", background: "#ecfdf5" }}><span style={{ color: "#059669" }}>Total</span><span style={{ color: "#059669" }}>{money(totals.total)}</span></div>
                </div>
              )}
              {sideTab === "history" && (
                <div className="space-y-3">
                  {events.map((e, i) => (
                    <div key={i} className="flex gap-3 text-[13px] p-2.5 rounded-xl" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}><span className="text-[10px] font-extrabold text-white">◷</span></div>
                      <div><div className="font-extrabold text-sm" style={{ color: "#0f172a" }}>{e.label}</div><div className="text-[11px] font-medium" style={{ color: "#94a3b8" }}>{e.t}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl p-5 shadow-lg" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}>
                <span className="text-[10px] font-extrabold text-white">✓</span>
              </div>
              <h2 className="text-base font-extrabold tracking-tight" style={{ color: "#0f172a" }}>Status & Payment</h2>
            </div>
            <div className="space-y-3">
              <div>
                <FieldLabel>Order Status</FieldLabel>
                <div className="h-10 px-4 rounded-xl text-sm flex items-center font-extrabold shadow-sm" style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", color: "#c2410c" }}>Pending</div>
              </div>
              <div>
                <FieldLabel>Payment Status</FieldLabel>
                <div className="h-10 px-4 rounded-xl text-sm flex items-center font-extrabold shadow-sm" style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", color: "#c2410c" }}>Unpaid</div>
              </div>
              <p className="text-[11px] font-medium leading-relaxed" style={{ color: "#94a3b8" }}>New orders always start as Pending / Unpaid. Payments are recorded after delivery.</p>
            </div>
          </section>

          <section className="rounded-2xl p-5 shadow-lg" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}>
                <Building2 size={16} color="#fff" />
              </div>
              <h2 className="text-base font-extrabold tracking-tight" style={{ color: "#0f172a" }}>Vendor Summary</h2>
            </div>
            {selectedVendor ? (
              <div className="flex items-center gap-3 p-3 rounded-2xl shadow-sm transition hover:shadow-md" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-md shrink-0" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}>
                  <Building2 size={20} color="#fff" />
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-base truncate" style={{ color: "#0f172a" }}>{selectedVendor.name}</div>
                  <div className="font-mono text-[11px] font-bold" style={{ color: "#64748b" }}>{selectedVendor.vendor_code}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "#f8fafc", border: "1px dashed #e2e8f0" }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: "#e2e8f0", color: "#94a3b8" }}><Building2 size={20} /></div>
                <div><div className="font-extrabold text-sm" style={{ color: "#0f172a" }}>Select Vendor</div><div className="text-[11px] font-medium" style={{ color: "#94a3b8" }}>Vendor details will appear here</div></div>
              </div>
            )}
          </section>

          <section className="rounded-2xl p-5 shadow-lg" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)" }}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}>
                <CalendarDays size={16} color="#fff" />
              </div>
              <h2 className="text-base font-extrabold tracking-tight" style={{ color: "#0f172a" }}>Timeline</h2>
            </div>
            <div className="space-y-2">
              {events.slice(-3).map((e, i) => (
                <div key={i} className="flex gap-3 p-2.5 rounded-xl transition hover:shadow-sm" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm" style={{ background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" }}>
                    <CalendarDays size={14} color="#fff" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm truncate" style={{ color: "#0f172a" }}>{e.label}</div>
                    <div className="text-[11px] font-medium" style={{ color: "#94a3b8" }}>{e.t}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* product picker popup — products only, nothing pre-ticked */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={() => setPickerOpen(false)}>
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-3xl shadow-2xl" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5" style={{ borderBottom: "1px solid #e2e8f0", background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}>
                    <Package size={18} color="#fff" />
                  </div>
                  <h3 className="text-lg font-extrabold tracking-tight" style={{ color: "#0f172a" }}>Add products</h3>
                </div>
                <button onClick={() => setPickerOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center transition hover:scale-110 hover:shadow-md" style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#64748b" }} aria-label="Close">×</button>
              </div>
              <p className="text-xs mt-2 font-medium" style={{ color: "#64748b" }}>Tick products and press Add selected — their variants appear below, all ticked.</p>
              <div className="grid sm:grid-cols-[1fr_160px] gap-3 mt-4">
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#94a3b8" }}>⌕</span>
                  <input
                    autoFocus value={pickerSearch}
                    onChange={(e) => { setPickerSearch(e.target.value); setPickerPage(1); }}
                    placeholder="Search product by name, SKU or code..."
                    className="w-full h-11 pl-10 pr-4 rounded-2xl text-sm outline-none font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }}
                  />
                </div>
                <select value={pickerCategory} onChange={(e) => { setPickerCategory(e.target.value); setPickerPage(1); }} className="h-11 px-4 rounded-2xl text-sm outline-none font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }}>
                  <option value="all">Category: All</option>{categories.map(([cid, name]) => <option key={cid} value={cid}>{name}</option>)}
                </select>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-2 py-2">
              {stockLoading ? <div className="p-8 text-center"><div className="text-sm font-bold" style={{ color: "#0f172a" }}>Loading products...</div></div> :
                pickerRows.map((g) => {
                  const ticked = checkedProducts[String(g.product_id)] === true;
                  const stock = g.variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0);
                  return (
                    <div key={g.product_id} className="mx-2 my-1 px-4 py-3 flex items-center gap-3 rounded-2xl transition-all duration-200 hover:shadow-md" style={{ background: ticked ? "rgba(37,99,235,0.06)" : "#fff", border: ticked ? "1.5px solid rgba(37,99,235,0.2)" : "1.5px solid #e2e8f0", opacity: ticked ? 1 : 0.9 }}>
                      <input type="checkbox" checked={ticked} onChange={(e) => setCheckedProducts((p) => ({ ...p, [String(g.product_id)]: e.target.checked }))} className="w-5 h-5 rounded-lg cursor-pointer shrink-0" style={{ accentColor: "#2563eb" }} />
                      <Thumb src={g.image} alt={g.product_name} size="w-12 h-12" />
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-[14px] truncate" style={{ color: ticked ? "#2563eb" : "#0f172a" }}>{g.product_name}</div>
                        <div className="text-[11px] font-medium truncate" style={{ color: "#94a3b8" }}>{g.variants.length} variant{g.variants.length === 1 ? "" : "s"} · stock {stock}{g.category_name ? ` · ${g.category_name}` : ""}</div>
                      </div>
                    </div>
                  );
                })}
              {!stockLoading && !pickerRows.length && <div className="p-8 text-center"><div className="text-sm font-bold" style={{ color: "#0f172a" }}>No products match</div><div className="text-xs mt-1" style={{ color: "#94a3b8" }}>Try adjusting your search or category filter</div></div>}
            </div>
            <div className="px-4 py-3" style={{ borderTop: "1px solid #e2e8f0", background: "#f8fafc" }}>
              <button onClick={() => setQcOpen(true)} className="w-full h-10 rounded-2xl text-[13px] font-extrabold flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] shadow-md" style={{ border: "1.5px dashed #cbd5e1", background: "#fff", color: "#2563eb" }}><Plus size={16} strokeWidth={2.5} /> Create New Product</button>
            </div>
            <div className="px-4 py-3 flex items-center justify-between text-xs font-medium" style={{ borderTop: "1px solid #e2e8f0", background: "#fff", color: "#64748b" }}>
              <span>Page {safePickerPage} / {pickerPages} ({pickerFiltered.length} products) · {tickedProducts} ticked</span>
              <div className="flex gap-2">
                <button disabled={safePickerPage <= 1} onClick={() => setPickerPage((p) => p - 1)} className="h-9 px-3 rounded-xl text-xs font-extrabold transition-all duration-200 hover:shadow-md disabled:opacity-30" style={{ background: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }}>Prev</button>
                <button disabled={safePickerPage >= pickerPages} onClick={() => setPickerPage((p) => p + 1)} className="h-9 px-3 rounded-xl text-xs font-extrabold transition-all duration-200 hover:shadow-md disabled:opacity-30" style={{ background: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }}>Next</button>
                <button disabled={addingAll || !tickedProducts} onClick={addSelectedProducts} className="h-9 px-4 rounded-2xl text-xs font-extrabold transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98] shadow-lg disabled:opacity-40" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "#fff", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}>{addingAll ? "Adding..." : `Add selected (${tickedProducts})`}</button>
                <button onClick={() => setPickerOpen(false)} className="h-9 px-4 rounded-2xl text-xs font-extrabold transition-all duration-200 hover:shadow-md hover:scale-[1.03] active:scale-[0.98]" style={{ background: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New product — same top-up form as the Products page (with variants step for PO) */}
      <ProductFormModal
        open={qcOpen}
        onClose={() => setQcOpen(false)}
        zIndex="z-[60]"
        onCreated={(data) => {
          const product = data?.product || data?.data || data;
          const productId = String(product?._id || "");
          if (!productId) { toast.error("Product created but its ID was not returned"); return; }
          setNewProductId(productId);
          setQcOpen(false);
        }}
      />
      {newProductId && (
        <VariantForm
          productId={newProductId}
          onCancel={() => setNewProductId("")}
          onSuccess={({ product, variant }) => {
            if (!variant?._id) { toast.error("Variant saved but could not be added to this order"); return; }
            qc.invalidateQueries({ queryKey: ["stock-all"] });
            const pname = product?.name || "Unknown Product";
            setLines((prev) => {
              if (prev.some((line) => String(line.variant_id) === String(variant._id))) return prev;
              return [...prev, {
                variant_id: variant._id, product_id: String(variant.product_id?._id || variant.product_id || newProductId),
                sku: variant.sku || "", title: variant.title || "", product_name: pname,
                image: variant.images?.[0]?.img_url || "", in_stock: variant.quantity ?? 0, qty_ordered: 1,
                cost_price: Math.max(0, Number(variant.cost_price) || 0), sell_price: Math.max(0, Number(variant.selling_price) || 0),
                topup: Number(variant.topup) || 0, tax_rate: 0, batch_no: "", mfg_date: "", expiry_date: "", included: true,
              }];
            });
            pushEvent(`Created product "${pname}" and added variant ${variant.sku || ""}`);
            toast.success("Variant added to purchase order");
            setNewProductId("");
          }}
        />
      )}
    </div>
  );
}

export default function NewPOPageWrapper() {
  return (
    <Suspense fallback={<p className="text-sm p-6 text-center" style={{ color: "var(--text-muted)" }}>Loading...</p>}>
      <NewPOPage />
    </Suspense>
  );
}
