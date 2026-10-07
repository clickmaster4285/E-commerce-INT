"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vendorApi } from "@/apis/admin/vendorApi";
import { purchaseOrderApi } from "@/apis/admin/purchaseOrderApi";
import { stockApi } from "@/apis/admin/stockApi";
import { variantApi } from "@/apis/admin/variantApi";
import { toast } from "sonner";
import { Plus, Search, Trash2, Building2, CalendarDays } from "lucide-react";

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

const TERMS = ["advance", "net_7", "net_15", "net_30", "cod"];
const TERMS_LABEL = { advance: "Advance", net_7: "Net 7", net_15: "Net 15", net_30: "Net 30", cod: "COD" };
const money = (n, dec = 2) => `Rs. ${(Math.max(0, Number(n) || 0)).toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
const nowStamp = () => new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

const stockStatusOf = (v) => {
  const qty = Number(v.quantity ?? 0), min = Number(v.min_qnt ?? 0);
  if (qty === 0) return "out";
  if (qty <= min) return "low";
  return "in";
};

function SectionTitle({ children }) {
  return <h2 className="text-sm font-bold mb-3">{children}</h2>;
}
function FieldLabel({ children, required }) {
  return <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{children} {required && <span style={{ color: "var(--danger-text)" }}>*</span>}</label>;
}
function Thumb({ src, alt, size = "w-9 h-9" }) {
  const url = getImageUrl(src);
  if (url) return <img src={url} alt={alt} className={`${size} shrink-0 rounded-lg object-cover`} style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }} />;
  return <div className={`${size} shrink-0 rounded-lg flex items-center justify-center text-xs`} style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>▣</div>;
}

export default function NewPOPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [vendorId, setVendorId] = useState("");
  const [vendorOpen, setVendorOpen] = useState(false);
  const [vendorSearch, setVendorSearch] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCategory, setPickerCategory] = useState("all");
  const [pickerStatus, setPickerStatus] = useState("all");
  const [pickerPage, setPickerPage] = useState(1);
  const [pickerQty, setPickerQty] = useState({});
  const [addingId, setAddingId] = useState(null);
  const [lines, setLines] = useState([]);
  const [checked, setChecked] = useState([]);
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [sideTab, setSideTab] = useState("items");
  const [events, setEvents] = useState([{ t: nowStamp(), label: "Draft started" }]);
  const [saving, setSaving] = useState(null); // 'draft' | 'create' | null
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

  useEffect(() => {
    if (selectedVendor?.payment_terms) setPaymentTerms(selectedVendor.payment_terms);
  }, [selectedVendor?._id]);

  useEffect(() => {
    const close = (e) => { if (vendorBoxRef.current && !vendorBoxRef.current.contains(e.target)) setVendorOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const { data: nextCode } = useQuery({ queryKey: ["po-next-code"], queryFn: () => purchaseOrderApi.getNextCode() });

  // Full variant list once (cached) so search + category + status filtering is exact client-side.
  const { data: stockAll, isLoading: stockLoading } = useQuery({ queryKey: ["stock-all"], queryFn: () => stockApi.getAll(), staleTime: 2 * 60 * 1000 });
  const categories = useMemo(() => {
    const m = new Map();
    for (const v of stockAll || []) {
      const id = String(v.category_id || "");
      if (id && !m.has(id)) m.set(id, v.category_name || "Uncategorized");
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [stockAll]);

  const pickerFiltered = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return (stockAll || []).filter((v) => {
      if (pickerCategory !== "all" && String(v.category_id || "") !== pickerCategory) return false;
      if (pickerStatus !== "all" && stockStatusOf(v) !== pickerStatus) return false;
      if (q && ![v.sku, v.title, v.product_name].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [stockAll, pickerSearch, pickerCategory, pickerStatus]);
  const PICKER_SIZE = 8;
  const pickerPages = Math.max(1, Math.ceil(pickerFiltered.length / PICKER_SIZE));
  const pickerRows = pickerFiltered.slice((Math.min(pickerPage, pickerPages) - 1) * PICKER_SIZE, Math.min(pickerPage, pickerPages) * PICKER_SIZE);

  const openPicker = (preset = "") => { setPickerSearch(preset); setPickerCategory("all"); setPickerStatus("all"); setPickerPage(1); setPickerQty({}); setPickerOpen(true); };
  const updateLine = (id, patch) => setLines((prev) => prev.map((l) => (String(l.variant_id) === String(id) ? { ...l, ...patch } : l)));

  const addLine = async (item, qty) => {
    const q = Math.max(1, Math.floor(Number(qty) || 1));
    if (lines.some((l) => String(l.variant_id) === String(item._id))) {
      updateLine(item._id, { qty_ordered: lines.find((l) => String(l.variant_id) === String(item._id)).qty_ordered + q });
      toast.success("Quantity increased for existing line");
      return;
    }
    setAddingId(item._id);
    let cost = 0;
    try {
      const full = await variantApi.getById(item._id);
      if (Number.isFinite(Number(full?.cost_price))) cost = Math.max(0, Number(full.cost_price));
    } catch {}
    setAddingId(null);
    setLines((prev) => [...prev, {
      variant_id: item._id, sku: item.sku || "", title: item.title || "",
      product_name: item.product_name || "Unknown Product", image: item.image || "",
      cost_price: cost, qty_ordered: q, tax_rate: 0, batch_no: "", mfg_date: "", expiry_date: "",
    }]);
    pushEvent(`Added ${item.sku || "variant"} × ${q}`);
    toast.success(`${item.sku || "Variant"} added to order`);
  };

  // Frontend estimate only — mirrors the backend formula.
  // The backend re-calculates everything on save and remains the source of truth.
  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    for (const l of lines) {
      const lineTotal = Math.round(Math.max(0, Number(l.cost_price) || 0) * Math.max(1, Math.floor(Number(l.qty_ordered) || 1)));
      subtotal += lineTotal;
      tax += Math.round(lineTotal * (Math.min(100, Math.max(0, Number(l.tax_rate) || 0)) / 100));
    }
    const ship = 0, disc = 0;
    return { subtotal, tax, shipping: ship, discount: disc, total: Math.round(subtotal + tax + ship - disc) };
  }, [lines]);

  const buildPayload = () => ({
    vendor_id: vendorId,
    items: lines.map((l) => ({
      variant_id: l.variant_id,
      qty_ordered: Math.max(1, Math.floor(Number(l.qty_ordered) || 1)),
      cost_price: Math.max(0, Number(l.cost_price) || 0),
      tax_rate: Math.min(100, Math.max(0, Number(l.tax_rate) || 0)),
      batch_no: String(l.batch_no || ""),
      mfg_date: l.mfg_date || undefined,
      expiry_date: l.expiry_date || undefined,
    })),
    shipping: 0,
    discount: 0,
    expected_date: expectedDate || undefined,
    due_date: deliveryDate || undefined,
    notes: notes.trim() || undefined,
  });

  const createMutation = useMutation({
    mutationFn: async (mode) => {
      setSaving(mode);
      const created = await purchaseOrderApi.create(buildPayload());
      const id = created?.data?._id;
      if (mode === "create") await purchaseOrderApi.send(id); // draft → sent, existing endpoint
      return { id, mode };
    },
    onSuccess: ({ id, mode }) => {
      toast.success(mode === "create" ? "Purchase order created and sent" : "Draft saved");
      qc.invalidateQueries({ queryKey: ["pos"] });
      qc.invalidateQueries({ queryKey: ["pos-all"] });
      router.push(`/admin/purchase-orders/${id}`);
    },
    onError: (e) => { toast.error(e?.response?.data?.message || "Save failed"); setSaving(null); },
  });

  const saveDisabled = createMutation.isPending || !vendorId || !lines.length;

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
          <section className="rounded-xl p-4" style={cardStyle}>
            <SectionTitle>1. Vendor Information</SectionTitle>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="relative" ref={vendorBoxRef}>
                <FieldLabel required>Vendor</FieldLabel>
                <button type="button" onClick={() => setVendorOpen((o) => !o)} className="w-full h-9 px-3 rounded-md text-sm flex items-center justify-between gap-2 outline-none" style={inputStyle}>
                  <span className="flex items-center gap-2 truncate" style={{ color: selectedVendor ? "var(--text-primary)" : "var(--text-muted)" }}>
                    <Search size={13} className="shrink-0" />{selectedVendor ? `${selectedVendor.name} (${selectedVendor.vendor_code})` : "Select Vendor"}
                  </span>
                  <span style={{ color: "var(--text-muted)" }}>▾</span>
                </button>
                {vendorOpen && (
                  <div className="absolute z-40 mt-1 w-full rounded-lg overflow-hidden shadow-2xl" style={cardStyle}>
                    <div className="p-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <input autoFocus value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} placeholder="Search vendors..." className="w-full h-8 px-2 rounded-md text-[13px] outline-none" style={inputStyle} />
                    </div>
                    <div className="max-h-[220px] overflow-y-auto py-1">
                      {vendorOptions.map((v) => (
                        <button key={v._id} type="button" onClick={() => { setVendorId(v._id); setVendorOpen(false); setVendorSearch(""); pushEvent(`Vendor selected: ${v.name}`); }} className="w-full px-3 py-2 text-left text-[13px] transition" style={{ backgroundColor: v._id === vendorId ? "var(--success-soft)" : "transparent" }} onMouseEnter={(e) => { if (v._id !== vendorId) e.currentTarget.style.backgroundColor = "var(--bg-row-hover)"; }} onMouseLeave={(e) => { if (v._id !== vendorId) e.currentTarget.style.backgroundColor = "transparent"; }}>
                          <div className="font-semibold">{v.name} <span className="font-mono font-normal text-[11px]" style={{ color: "var(--text-muted)" }}>{v.vendor_code}</span></div>
                          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{[v.company_name, v.city].filter(Boolean).join(" · ")}</div>
                        </button>
                      ))}
                      {!vendorOptions.length && <p className="px-3 py-4 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>No vendor found</p>}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <FieldLabel>Expected Date</FieldLabel>
                <div className="relative">
                  <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} />
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
              <p className="text-[11px] font-bold mb-2" style={{ color: "var(--accent)" }}>ⓘ Vendor Details <span className="font-normal" style={{ color: "var(--text-muted)" }}>(auto-filled after selection)</span></p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-[13px]">
                {[["Name", selectedVendor?.name], ["Company Name", selectedVendor?.company_name], ["Email", selectedVendor?.email], ["Phone", selectedVendor?.phone], ["City", selectedVendor?.city]].map(([l, val]) => (
                  <div key={l} className="sm:border-l sm:pl-3 sm:first:border-0 sm:first:pl-0" style={{ borderColor: "var(--border-color)" }}>
                    <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{l}</div>
                    <div className="font-medium truncate">{val || "-"}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 2. Products / Items */}
          <section className="rounded-xl p-4" style={cardStyle}>
            <SectionTitle>2. Products / Items</SectionTitle>
            <div className="grid sm:grid-cols-[1fr_150px_130px_auto] gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-muted)" }}>⌕</span>
                <input value={pickerSearch} onChange={(e) => { setPickerSearch(e.target.value); setPickerPage(1); }} placeholder="Search product by name, SKU or code..." className="w-full h-9 pl-9 pr-3 rounded-md text-sm outline-none" style={inputStyle} />
              </div>
              <select value={pickerCategory} onChange={(e) => { setPickerCategory(e.target.value); setPickerPage(1); }} className="h-9 px-2 rounded-md text-sm outline-none" style={inputStyle}>
                <option value="all">Category: All</option>{categories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <select value={pickerStatus} onChange={(e) => { setPickerStatus(e.target.value); setPickerPage(1); }} className="h-9 px-2 rounded-md text-sm outline-none" style={inputStyle}>
                <option value="all">Status: All</option><option value="in">In Stock</option><option value="low">Low Stock</option><option value="out">Out of Stock</option>
              </select>
              <button onClick={() => openPicker()} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition hover:opacity-90 whitespace-nowrap" style={accentBtn}><Plus size={14} /> Add Product</button>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border-color)" }}>
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-3 py-2.5 w-8"><input type="checkbox" checked={lines.length > 0 && checked.length === lines.length} onChange={() => setChecked(checked.length === lines.length ? [] : lines.map((l) => String(l.variant_id)))} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></th>
                    {["Product / Variant", "SKU", "Cost Price", "Qty Ordered", "Tax %", "Line Total", "Batch No.", "Mfg Date", "Expiry Date"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={String(l.variant_id)} className="transition" style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <td className="px-3 py-2"><input type="checkbox" checked={checked.includes(String(l.variant_id))} onChange={() => setChecked((s) => (s.includes(String(l.variant_id)) ? s.filter((x) => x !== String(l.variant_id)) : [...s, String(l.variant_id)]))} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></td>
                      <td className="px-3 py-2"><div className="flex items-center gap-2"><Thumb src={l.image} alt={l.product_name} /><div className="min-w-0"><div className="font-semibold truncate max-w-[150px]">{l.product_name}</div><div className="text-[11px] truncate max-w-[150px]" style={{ color: "var(--text-muted)" }}>{l.title}</div></div></div></td>
                      <td className="px-3 py-2 font-mono text-[12px] whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{l.sku}</td>
                      <td className="px-3 py-2"><input type="number" min={0} value={l.cost_price} onChange={(e) => updateLine(l.variant_id, { cost_price: Math.max(0, Number(e.target.value) || 0) })} className="w-20 h-8 px-2 rounded-md text-[13px] outline-none" style={inputStyle} /></td>
                      <td className="px-3 py-2"><input type="number" min={1} step={1} value={l.qty_ordered} onChange={(e) => updateLine(l.variant_id, { qty_ordered: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} className="w-16 h-8 px-2 rounded-md text-[13px] outline-none" style={inputStyle} /></td>
                      <td className="px-3 py-2"><div className="flex items-center gap-1"><input type="number" min={0} max={100} value={l.tax_rate} onChange={(e) => updateLine(l.variant_id, { tax_rate: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className="w-14 h-8 px-2 rounded-md text-[13px] outline-none" style={inputStyle} /><span className="text-[11px]" style={{ color: "var(--text-muted)" }}>%</span></div></td>
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">{(Math.round(Math.max(0, Number(l.cost_price) || 0) * Math.max(1, Math.floor(Number(l.qty_ordered) || 1)))).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2"><input value={l.batch_no} onChange={(e) => updateLine(l.variant_id, { batch_no: e.target.value })} placeholder="—" className="w-20 h-8 px-2 rounded-md text-[13px] outline-none" style={inputStyle} /></td>
                      <td className="px-3 py-2"><input type="date" value={l.mfg_date} onChange={(e) => updateLine(l.variant_id, { mfg_date: e.target.value })} className="h-8 px-1 rounded-md text-[12px] outline-none" style={inputStyle} /></td>
                      <td className="px-3 py-2"><input type="date" value={l.expiry_date} onChange={(e) => updateLine(l.variant_id, { expiry_date: e.target.value })} className="h-8 px-1 rounded-md text-[12px] outline-none" style={inputStyle} /></td>
                      <td className="px-3 py-2 text-right"><button onClick={() => { setLines((p) => p.filter((x) => String(x.variant_id) !== String(l.variant_id))); setChecked((s) => s.filter((x) => x !== String(l.variant_id))); }} className="p-1.5 rounded-md transition hover:opacity-70" style={{ color: "var(--text-muted)" }}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                  {!lines.length && <tr><td colSpan={11} className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No items yet — search above and add products to this order.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-2">
              <button onClick={() => openPicker()} className="text-[13px] font-semibold transition hover:opacity-80" style={{ color: "var(--accent)" }}>+ Add Another Product</button>
              {checked.length > 0 && <button onClick={() => { setLines((p) => p.filter((x) => !checked.includes(String(x.variant_id)))); setChecked([]); }} className="text-[12px] underline" style={{ color: "var(--danger-text)" }}>Remove selected ({checked.length})</button>}
            </div>

            {/* inline picker results */}
            {(pickerSearch.trim() || pickerCategory !== "all" || pickerStatus !== "all") && (
              <div className="mt-3 rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-color)" }}>
                <div className="px-3 py-2 text-[12px] font-semibold" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}>
                  {stockLoading ? "Loading products..." : `${pickerFiltered.length} matching variant${pickerFiltered.length === 1 ? "" : "s"} — exact variant is added to the order`}
                </div>
                {!stockLoading && pickerRows.map((item) => (
                  <div key={item._id} className="px-3 py-2 flex items-center gap-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                    <Thumb src={item.image} alt={item.product_name} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-[13px] truncate">{item.product_name}</div>
                      <div className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{item.title} · <span className="font-mono">{item.sku}</span> · stock {item.quantity ?? 0}</div>
                    </div>
                    <input type="number" min={1} value={pickerQty[item._id] ?? 1} onChange={(e) => setPickerQty((p) => ({ ...p, [item._id]: Math.max(1, Math.floor(Number(e.target.value) || 1)) }))} className="w-16 h-8 px-2 rounded-md text-[13px] outline-none" style={inputStyle} />
                    <button disabled={addingId === item._id} onClick={() => addLine(item, pickerQty[item._id] ?? 1)} className="h-8 px-3 rounded-lg text-xs font-bold transition hover:opacity-90 disabled:opacity-50" style={accentBtn}>
                      {addingId === item._id ? "..." : "Add"}
                    </button>
                  </div>
                ))}
                {!stockLoading && pickerPages > 1 && (
                  <div className="px-3 py-2 flex items-center justify-between text-[12px]" style={{ borderTop: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                    <span>Page {Math.min(pickerPage, pickerPages)} / {pickerPages}</span>
                    <div className="flex gap-1.5">
                      <button disabled={pickerPage <= 1} onClick={() => setPickerPage((p) => p - 1)} className="px-2.5 py-1 border rounded disabled:opacity-40" style={inputStyle}>Prev</button>
                      <button disabled={pickerPage >= pickerPages} onClick={() => setPickerPage((p) => p + 1)} className="px-2.5 py-1 border rounded disabled:opacity-40" style={inputStyle}>Next</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <div className="grid md:grid-cols-2 gap-4">
            {/* 3. Additional Details */}
            <section className="rounded-xl p-4" style={cardStyle}>
              <SectionTitle>3. Additional Details</SectionTitle>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Payment Terms</FieldLabel>
                  <select value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className="w-full h-9 px-2 rounded-md text-sm outline-none" style={inputStyle}>
                    <option value="">Select Payment Terms</option>
                    {TERMS.map((t) => <option key={t} value={t}>{TERMS_LABEL[t]}</option>)}
                  </select>
                </div>
                <div>
                  <FieldLabel>Expected Delivery Date</FieldLabel>
                  <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="w-full h-9 px-2 rounded-md text-sm outline-none" style={inputStyle} />
                </div>
              </div>
              <div className="mt-3">
                <FieldLabel>Notes</FieldLabel>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Enter any additional notes..." className="w-full px-3 py-2 rounded-md text-sm outline-none resize-y" style={inputStyle} />
              </div>
            </section>
            {/* 4. Summary */}
            <section className="rounded-xl p-4" style={cardStyle}>
              <SectionTitle>4. Summary</SectionTitle>
              <div className="text-sm space-y-1.5">
                <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>Subtotal</span><b>{money(totals.subtotal)}</b></div>
                <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>Tax (5%)</span><b>{money(totals.tax)}</b></div>
                <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>Shipping</span><b>{money(totals.shipping)}</b></div>
                <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>Discount</span><b>{money(totals.discount)}</b></div>
                <div className="flex justify-between pt-2 font-bold" style={{ borderTop: "1px solid var(--border-color)" }}><span>Total</span><span>{money(totals.total)}</span></div>
              </div>
              <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>Estimate only — the backend re-calculates all totals on save.</p>
            </section>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <aside className="space-y-4 xl:sticky xl:top-4">
          <section className="rounded-xl p-4 text-center" style={cardStyle}>
            <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: "color-mix(in srgb, #f59e0b 16%, transparent)", color: "#b45309" }}>+ Draft</span>
            <div className="font-mono font-bold mt-1">{nextCode?.nextCode || "PO-..."}</div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Auto generated</div>
            <div className="flex gap-2 mt-3">
              <button disabled={saveDisabled} onClick={() => createMutation.mutate("draft")} className="h-9 px-3 rounded-lg text-[13px] font-semibold transition hover:opacity-80 disabled:opacity-50 flex-1" style={{ ...cardStyle, borderRadius: "8px" }}>
                {saving === "draft" ? "Saving..." : "Save Draft"}
              </button>
              <button disabled={saveDisabled} onClick={() => createMutation.mutate("create")} className="h-9 px-3 rounded-lg text-[13px] font-semibold transition hover:opacity-90 disabled:opacity-50 flex-1" style={accentBtn}>
                {saving === "create" ? "Creating..." : "Create PO"}
              </button>
            </div>
          </section>

          <section className="rounded-xl overflow-hidden" style={cardStyle}>
            <div className="flex px-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
              {[["items", `Items ${lines.length}`], ["summary", "Summary"], ["history", "History"]].map(([k, label]) => (
                <button key={k} onClick={() => setSideTab(k)} className="px-3 py-2.5 text-[13px] font-semibold transition" style={sideTab === k ? { color: "var(--accent)", borderBottom: "2px solid var(--accent)" } : { color: "var(--text-muted)" }}>{label}</button>
              ))}
            </div>
            <div className="p-4">
              {sideTab === "items" && (
                lines.length === 0 ? <p className="text-[13px] text-center py-4" style={{ color: "var(--text-muted)" }}>No items yet.</p> :
                  <div className="space-y-2">{lines.map((l) => (
                    <div key={String(l.variant_id)} className="flex items-center gap-2 text-[13px]">
                      <Thumb src={l.image} alt={l.product_name} size="w-8 h-8" />
                      <div className="min-w-0 flex-1"><div className="font-semibold truncate">{l.product_name}</div><div className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{l.sku} × {l.qty_ordered}</div></div>
                      <b className="whitespace-nowrap">{(Math.round(Math.max(0, Number(l.cost_price) || 0) * Math.max(1, Math.floor(Number(l.qty_ordered) || 1)))).toLocaleString()}</b>
                    </div>
                  ))}</div>
              )}
              {sideTab === "summary" && (
                <div className="text-sm space-y-1.5">
                  <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>Subtotal</span><b>{money(totals.subtotal)}</b></div>
                  <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>Tax</span><b>{money(totals.tax)}</b></div>
                  <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>Shipping</span><b>{money(totals.shipping)}</b></div>
                  <div className="flex justify-between"><span style={{ color: "var(--text-secondary)" }}>Discount</span><b>{money(totals.discount)}</b></div>
                  <div className="flex justify-between pt-2 font-bold" style={{ borderTop: "1px solid var(--border-color)" }}><span>Total</span><span>{money(totals.total)}</span></div>
                </div>
              )}
              {sideTab === "history" && (
                <div className="space-y-3">
                  {events.map((e, i) => (
                    <div key={i} className="flex gap-2.5 text-[13px]">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px]" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>◷</div>
                      <div><div className="font-semibold">{e.label}</div><div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{e.t}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl p-4" style={cardStyle}>
            <p className="text-[13px] font-bold mb-2">Status & Payment</p>
            <FieldLabel>Order Status</FieldLabel>
            <div className="h-9 px-3 rounded-md text-sm flex items-center" style={inputStyle}>Draft</div>
            <div className="mt-2"><FieldLabel>Payment Status</FieldLabel></div>
            <div className="h-9 px-3 rounded-md text-sm flex items-center" style={inputStyle}>Unpaid</div>
            <p className="text-[11px] mt-2" style={{ color: "var(--text-muted)" }}>New orders always start as Draft / Unpaid. Payments are recorded after creation.</p>
          </section>

          <section className="rounded-xl p-4" style={cardStyle}>
            <p className="text-[13px] font-bold mb-2">Vendor Summary</p>
            {selectedVendor ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>
                  <Building2 size={16} />
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{selectedVendor.name}</div>
                  <div className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{selectedVendor.vendor_code}</div>
                  <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{TERMS_LABEL[paymentTerms] ? `Terms: ${TERMS_LABEL[paymentTerms]}` : ""}</div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}><Building2 size={16} /></div>
                <div><div className="font-bold text-sm">Select Vendor</div><div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Vendor details will appear here</div></div>
              </div>
            )}
          </section>

          <section className="rounded-xl p-4" style={cardStyle}>
            <p className="text-[13px] font-bold mb-2">Timeline</p>
            <div className="space-y-3">
              {events.slice(-3).map((e, i) => (
                <div key={i} className="flex gap-2.5 text-[13px]">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}><CalendarDays size={12} /></div>
                  <div><div className="font-semibold">{e.label}</div><div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{e.t}</div></div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      {/* picker modal */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setPickerOpen(false)}>
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-xl" style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Add products</h3>
                <button onClick={() => setPickerOpen(false)} className="p-1 rounded transition hover:opacity-70 text-lg leading-none" style={{ color: "var(--text-muted)" }}>×</button>
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Select the exact variant — the order line stores its SKU.</p>
            </div>
            <div className="overflow-y-auto flex-1">
              {stockLoading ? <p className="p-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>Loading products...</p> :
                pickerRows.map((item) => (
                  <div key={item._id} className="px-4 py-2.5 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <Thumb src={item.image} alt={item.product_name} size="w-10 h-10" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-[13px] truncate">{item.product_name}</div>
                      <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>{item.title} · <span className="font-mono">{item.sku}</span> · stock {item.quantity ?? 0}</div>
                    </div>
                    <input type="number" min={1} value={pickerQty[item._id] ?? 1} onChange={(e) => setPickerQty((p) => ({ ...p, [item._id]: Math.max(1, Math.floor(Number(e.target.value) || 1)) }))} className="w-16 h-8 px-2 rounded-md text-[13px] outline-none" style={inputStyle} />
                    <button disabled={addingId === item._id} onClick={async () => { await addLine(item, pickerQty[item._id] ?? 1); setPickerOpen(false); }} className="h-8 px-3 rounded-lg text-xs font-bold transition hover:opacity-90 disabled:opacity-50" style={accentBtn}>
                      {addingId === item._id ? "..." : "Add"}
                    </button>
                  </div>
                ))}
            </div>
            <div className="px-4 py-3 flex items-center justify-between text-xs" style={{ borderTop: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
              <span>Page {Math.min(pickerPage, pickerPages)} / {pickerPages} ({pickerFiltered.length} variants)</span>
              <div className="flex gap-2">
                <button disabled={pickerPage <= 1} onClick={() => setPickerPage((p) => p - 1)} className="h-8 px-3 rounded-lg text-xs font-semibold transition disabled:opacity-40" style={cardStyle}>Prev</button>
                <button disabled={pickerPage >= pickerPages} onClick={() => setPickerPage((p) => p + 1)} className="h-8 px-3 rounded-lg text-xs font-semibold transition disabled:opacity-40" style={cardStyle}>Next</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
