"use client";
import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { shippingApi } from "@/apis/admin/shippingApi";
import { adminBrandApi } from "@/apis/admin/brandApi";
import { categoryApi } from "@/apis/user/categoryApi";
import { productApi } from "@/apis/user/productApi";
import { useShippingSocketSync } from "@/hooks/useShippingSocketSync.js";

/* ================= Icons ================= */
const TruckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a2 2 0 11-1-1h-1m4 0a2 2 0 104 0m-4 0a2 2 0 114 0m6-2V9m-2 2h4l2 3v3h-2m-2-5a2 2 0 104 0m-4 0a2 2 0 114 0" />
  </svg>
);
const ZapIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);
const PlusIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const EditIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);
const TrashIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
  </svg>
);
const CloseIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const CheckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);
const SearchIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const GlobeIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const TagIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);
const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

/* ================================================================
   SEARCHABLE SELECT
============================================================ */
const SearchSelect = ({ value, onChange, options, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setTerm(""); }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    if (!term.trim()) return options;
    return options.filter((o) => o.name?.toLowerCase().includes(term.toLowerCase()));
  }, [options, term]);

  const sel = options.find((o) => String(o._id) === String(value));

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)}
        className="h-10 w-full px-3 rounded-lg text-[13px] flex items-center justify-between gap-2 outline-none transition"
        style={inputStyle}>
        <span className="truncate" style={{ color: sel ? "var(--text-primary)" : "var(--text-muted)" }}>
          {sel ? sel.name : placeholder}
        </span>
        <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "var(--text-muted)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg overflow-hidden shadow-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="p-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon className="w-3.5 h-3.5" /></span>
              <input autoFocus value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search..."
                className="w-full h-8 pl-8 pr-2 rounded-md text-[13px] outline-none" style={inputStyle} />
            </div>
          </div>
          <div className="max-h-[220px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>No results found</p>
            ) : (
              filtered.map((o) => {
                const isSel = String(o._id) === String(value);
                return (
                  <button key={o._id} type="button" onClick={() => { onChange(String(o._id)); setOpen(false); setTerm(""); }}
                    className="w-full px-3 py-2 text-left text-[13px] flex items-center justify-between gap-2 transition"
                    style={{ color: isSel ? "#10b981" : "var(--text-primary)", backgroundColor: isSel ? "rgba(16,185,129,0.08)" : "transparent" }}>
                    <span className="truncate">{o.name}</span>
                    {isSel && <CheckIcon className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ================================================================
   SETTINGS MODAL (POPUP)
============================================================ */
function SettingsModal({ open, config, onClose, onSave, saving }) {
  const [form, setForm] = useState({
    standard: { fee: 200, min_days: 2, max_days: 4 },
    express: { fee: 500, min_days: 1, max_days: 2 },
    free_shipping_over: 0,
  });

  useEffect(() => {
    if (open && config) {
      setForm({
        standard: {
          fee: Number(config?.standard?.fee ?? 200),
          min_days: Number(config?.standard?.min_days ?? 2),
          max_days: Number(config?.standard?.max_days ?? 4),
        },
        express: {
          fee: Number(config?.express?.fee ?? 500),
          min_days: Number(config?.express?.min_days ?? 1),
          max_days: Number(config?.express?.max_days ?? 2),
        },
        free_shipping_over: Number(config?.free_shipping_over ?? 0),
      });
    }
  }, [open, config]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="px-4 sm:px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
          <div>
            <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>Edit Shipping Settings</h3>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>Update delivery rates and windows</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md transition hover:opacity-70" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)" }}>
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="rounded-lg p-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>
                <TruckIcon className="w-4 h-4" />
              </div>
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>Standard Delivery</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Fee (Rs)</label>
                <input type="number" min="0" value={form.standard.fee} onChange={(e) => setForm({ ...form, standard: { ...form.standard, fee: Number(e.target.value) } })} className="h-10 px-3 rounded-lg text-[13px] w-full outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Min Days</label>
                <input type="number" min="0" value={form.standard.min_days} onChange={(e) => setForm({ ...form, standard: { ...form.standard, min_days: Number(e.target.value) } })} className="h-10 px-3 rounded-lg text-[13px] w-full outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Max Days</label>
                <input type="number" min="0" value={form.standard.max_days} onChange={(e) => setForm({ ...form, standard: { ...form.standard, max_days: Number(e.target.value) } })} className="h-10 px-3 rounded-lg text-[13px] w-full outline-none" style={inputStyle} />
              </div>
            </div>
          </div>

          <div className="rounded-lg p-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
                <ZapIcon className="w-4 h-4" />
              </div>
              <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>Express Delivery</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Fee (Rs)</label>
                <input type="number" min="0" value={form.express.fee} onChange={(e) => setForm({ ...form, express: { ...form.express, fee: Number(e.target.value) } })} className="h-10 px-3 rounded-lg text-[13px] w-full outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Min Days</label>
                <input type="number" min="0" value={form.express.min_days} onChange={(e) => setForm({ ...form, express: { ...form.express, min_days: Number(e.target.value) } })} className="h-10 px-3 rounded-lg text-[13px] w-full outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Max Days</label>
                <input type="number" min="0" value={form.express.max_days} onChange={(e) => setForm({ ...form, express: { ...form.express, max_days: Number(e.target.value) } })} className="h-10 px-3 rounded-lg text-[13px] w-full outline-none" style={inputStyle} />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(16,185,129,0.15)", color: "#10b981" }}>
                <TagIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>Free Shipping Threshold</p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Orders above this amount ship free (0 = disabled)</p>
              </div>
            </div>
            <input type="number" min="0" value={form.free_shipping_over} onChange={(e) => setForm({ ...form, free_shipping_over: Number(e.target.value) })} className="h-10 px-3 rounded-lg text-[13px] w-full outline-none" style={inputStyle} placeholder="e.g. 5000" />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
            <button type="button" onClick={onClose} disabled={saving} className="flex-1 h-11 sm:h-10 rounded-lg text-[13px] font-medium transition hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 h-11 sm:h-10 rounded-lg text-[13px] font-semibold transition disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              {saving ? (<><Spinner className="w-4 h-4" /> Saving...</>) : (<><CheckIcon className="w-4 h-4" /> Save Changes</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================================================================
   MAIN PAGE
============================================================ */
export default function ShippingPage() {
  useShippingSocketSync();
  const queryClient = useQueryClient();

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({ rule_type: "brand", ref_id: "", shipping_type: "free", fee: 0, is_active: true });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: config } = useQuery({ queryKey: ["adminShippingConfig"], queryFn: shippingApi.getConfig });
  const { data: rules = [] } = useQuery({ queryKey: ["adminShippingRules"], queryFn: shippingApi.getRules });
  const { data: brands = [] } = useQuery({ queryKey: ["adminBrands"], queryFn: adminBrandApi.getAll });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoryApi.getAll });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productApi.getAll });

  const configMutation = useMutation({
    mutationFn: shippingApi.updateConfig,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["adminShippingConfig"] }); toast.success("Shipping settings updated"); setShowSettingsModal(false); },
    onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Update failed"),
  });

  const ruleMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? shippingApi.updateRule(id, data) : shippingApi.createRule(data)),
    onSuccess: (_, v) => { queryClient.invalidateQueries({ queryKey: ["adminShippingRules"] }); toast.success(v.id ? "Rule updated" : "Rule added"); setShowRuleModal(false); setEditingRule(null); },
    onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Rule save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: shippingApi.deleteRule,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["adminShippingRules"] }); toast.success("Rule deleted"); setDeleteTarget(null); },
    onError: (e) => toast.error(e?.response?.data?.message || e?.message || "Delete failed"),
  });

  const toggleMutation = useMutation({
    mutationFn: shippingApi.toggleRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["adminShippingRules"] }),
  });

  const refName = (rule) => {
    if (rule.rule_type === "all" || (ruleForm.rule_type === "all" && !rule.ref_id)) return "All Products";
    const id = String(rule.ref_id ?? rule);
    const t = rule.rule_type || ruleForm.rule_type;
    if (t === "brand") return brands.find((b) => String(b._id) === id)?.name || "Unknown brand";
    if (t === "category") return categories.find((c) => String(c._id) === id)?.name || "Unknown category";
    if (t === "all") return "All Products";
    return products.find((p) => String(p._id) === id)?.name || "Unknown product";
  };

  const refList = (t) => t === "brand" ? brands : t === "category" ? categories : t === "product" ? products : [];

  const openRuleModal = (rule = null) => {
    if (rule) {
      setEditingRule(rule);
      setRuleForm({
        rule_type: rule.rule_type || "brand",
        ref_id: rule.rule_type === "all" ? "" : String(rule.ref_id || ""),
        shipping_type: rule.shipping_type || "free",
        fee: Number(rule.fee) || 0,
        is_active: !!rule.is_active,
      });
    } else {
      setEditingRule(null);
      setRuleForm({ rule_type: "brand", ref_id: "", shipping_type: "free", fee: 0, is_active: true });
    }
    setShowRuleModal(true);
  };

  const submitRule = (e) => {
    e.preventDefault();
    const { rule_type, ref_id, shipping_type, fee, is_active } = ruleForm;
    if (!["brand", "category", "product", "all"].includes(rule_type)) return toast.error("Please select a valid rule type");
    if (rule_type !== "all" && !ref_id) return toast.error("Please select a target");
    if (shipping_type === "fixed" && Number(fee) < 0) return toast.error("Fee cannot be negative");
    const payload = {
      rule_type, ref_id: rule_type === "all" ? null : ref_id, shipping_type,
      fee: shipping_type === "fixed" ? Number(fee) : 0, is_active: !!is_active,
    };
    ruleMutation.mutate({ id: editingRule?._id, data: payload });
  };

  const activeRules = rules.filter((r) => r.is_active).length;
  const freeRules = rules.filter((r) => r.is_active && r.shipping_type === "free").length;

  const ruleTypeConfig = {
    brand: { icon: TagIcon, color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)" },
    category: { icon: TagIcon, color: "#a855f7", bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.3)" },
    product: { icon: TagIcon, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
    all: { icon: GlobeIcon, color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)" },
  };

  return (
    <div className="w-full pb-8 space-y-5">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Shipping Management</h1>
          <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Delivery methods, rates & free-shipping rules</p>
        </div>
        <button onClick={() => setShowSettingsModal(true)}
          className="h-11 md:h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 transition hover:opacity-90 w-full md:w-auto"
          style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
          <EditIcon className="w-4 h-4" /> Edit Settings
        </button>
      </div>

      {/* STAT CARDS — Mobile Optimized */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="flex items-center gap-3 mb-4 sm:mb-5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
              <TruckIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <p className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>Standard</p>
          </div>
          <p className="text-2xl sm:text-[28px] font-bold mb-2 sm:mb-3" style={{ color: "var(--text-primary)" }}>Rs. {config?.standard?.fee ?? 200}</p>
          <div className="space-y-1">
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Min: {config?.standard?.min_days ?? 2} days</p>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Max: {config?.standard?.max_days ?? 4} days</p>
          </div>
        </div>

        <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="flex items-center gap-3 mb-4 sm:mb-5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(168,85,247,0.1)", color: "#a855f7" }}>
              <ZapIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <p className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>Express</p>
          </div>
          <p className="text-2xl sm:text-[28px] font-bold mb-2 sm:mb-3" style={{ color: "var(--text-primary)" }}>Rs. {config?.express?.fee ?? 500}</p>
          <div className="space-y-1">
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Min: {config?.express?.min_days ?? 1} days</p>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Max: {config?.express?.max_days ?? 2} days</p>
          </div>
        </div>

        <div className="rounded-xl p-4 sm:p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="flex items-center gap-3 mb-4 sm:mb-5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(16,185,129,0.1)", color: "#10b981" }}>
              <TagIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <p className="text-[13px] sm:text-[14px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>Free Shipping</p>
          </div>
          <p className="text-xl sm:text-[24px] font-bold mb-3 sm:mb-4" style={{ color: (config?.free_shipping_over || 0) > 0 ? "#10b981" : "var(--text-muted)" }}>
            {(config?.free_shipping_over || 0) > 0 ? `Rs. ${config.free_shipping_over.toLocaleString()}` : "Disabled"}
          </p>
          <div className="pt-3 sm:pt-4 border-t" style={{ borderColor: "var(--border-color)" }}>
            <p className="text-[12px] mb-1" style={{ color: "var(--text-muted)" }}>Active Rules</p>
            <p className="text-2xl sm:text-[28px] font-bold" style={{ color: "#3b82f6" }}>{activeRules}</p>
          </div>
        </div>
      </div>

      {/* SHIPPING RULES */}
      <div className="rounded-lg overflow-hidden" style={cardStyle}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider">Shipping Rules</h2>
          <button onClick={() => openRuleModal()}
            className="h-9 px-3 rounded-md text-[12px] font-semibold flex items-center gap-1.5 transition hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
            <PlusIcon className="w-3.5 h-3.5" /> Add Rule
          </button>
        </div>

        {rules.length === 0 ? (
          <div className="py-14 text-center px-4">
            <TruckIcon className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No rules yet — add a free/fixed shipping rule</p>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Type</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Target</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Shipping</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</th>
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule, i) => {
                    const isAll = rule.rule_type === "all";
                    const tc = ruleTypeConfig[rule.rule_type] || ruleTypeConfig.all;
                    const TypeIcon = tc.icon;
                    return (
                      <tr key={rule._id} style={{ borderBottom: i < rules.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                            style={isAll ? { backgroundColor: "rgba(168,85,247,0.12)", color: "#c084fc", border: "1px solid rgba(168,85,247,0.35)" } : { backgroundColor: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}>
                            {isAll ? "ALL" : rule.rule_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium">{isAll ? "All Products" : refName(rule)}</td>
                        <td className="px-4 py-3">
                          {rule.shipping_type === "free" ? (<span className="font-bold text-emerald-500">FREE</span>) : (<span className="font-bold">Rs. {Number(rule.fee || 0).toLocaleString()}</span>)}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleMutation.mutate(rule._id)} className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition" style={rule.is_active ? { backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" } : { backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                            {rule.is_active ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openRuleModal(rule)} className="min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "var(--text-secondary)" }} title="Edit"><EditIcon /></button>
                            <button onClick={() => setDeleteTarget(rule)} className="min-w-[34px] min-h-[34px] p-2 rounded-md transition text-red-500 hover:bg-red-500/10 flex items-center justify-center" title="Delete"><TrashIcon /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE CARDS LIST */}
            <div className="md:hidden space-y-3 p-4">
              {rules.map((rule) => {
                const isAll = rule.rule_type === "all";
                const tc = ruleTypeConfig[rule.rule_type] || ruleTypeConfig.all;
                const TypeIcon = tc.icon;
                return (
                  <div key={rule._id} className="rounded-xl p-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <div className="flex items-start justify-between mb-3">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase"
                        style={{ backgroundColor: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                        <TypeIcon className="w-3 h-3" />
                        {isAll ? "All" : rule.rule_type}
                      </span>
                      <button onClick={() => toggleMutation.mutate(rule._id)} className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide transition" style={rule.is_active ? { backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" } : { backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                        {rule.is_active ? "Active" : "Inactive"}
                      </button>
                    </div>
                    <p className="text-[14px] font-semibold mb-3 truncate" style={{ color: "var(--text-primary)" }}>
                      {isAll ? "All Products" : refName(rule)}
                    </p>
                    <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                      {rule.shipping_type === "free" ? (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "#10b981" }}>
                          <TruckIcon className="w-3.5 h-3.5" /> FREE Shipping
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>
                          Fee: Rs. {Number(rule.fee || 0).toLocaleString()}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <button onClick={() => openRuleModal(rule)} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)" }} title="Edit">
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(rule)} className="h-9 w-9 rounded-lg flex items-center justify-center transition text-red-500 hover:bg-red-500/10" title="Delete">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* SETTINGS MODAL */}
      <SettingsModal open={showSettingsModal} config={config} onClose={() => setShowSettingsModal(false)} onSave={(data) => configMutation.mutate(data)} saving={configMutation.isPending} />

      {/* RULE MODAL */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="w-full max-w-md rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="px-4 sm:px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>{editingRule ? "Edit Rule" : "Add Shipping Rule"}</h3>
                <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>Free ya fixed shipping — for any target</p>
              </div>
              <button onClick={() => setShowRuleModal(false)} className="p-1.5 rounded-md transition hover:opacity-70" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-tertiary)" }}>
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submitRule} className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-[12px] font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Apply To</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "brand", label: "Brand", icon: TagIcon, color: "#3b82f6", bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.3)" },
                    { key: "category", label: "Category", icon: TagIcon, color: "#a855f7", bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.3)" },
                    { key: "product", label: "Product", icon: TagIcon, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.3)" },
                    { key: "all", label: "All Products", icon: GlobeIcon, color: "#10b981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.3)" },
                  ].map(({ key, label, icon: Icon, color, bg, border }) => {
                    const active = ruleForm.rule_type === key;
                    return (
                      <button key={key} type="button" onClick={() => setRuleForm({ ...ruleForm, rule_type: key, ref_id: "" })}
                        className="rounded-lg p-3 text-left transition-all border-2"
                        style={{ backgroundColor: active ? bg : "var(--bg-tertiary)", borderColor: active ? border : "var(--border-color)" }}>
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: active ? "rgba(255,255,255,0.2)" : "var(--bg-card)" }}>
                          <Icon className="w-5 h-5" style={{ color: active ? color : "var(--text-muted)" }} />
                        </div>
                        <p className="text-[13px] font-bold" style={{ color: active ? color : "var(--text-primary)" }}>{label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {ruleForm.rule_type !== "all" && (
                <div>
                  <label className="block text-[12px] font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                    Select {ruleForm.rule_type === "brand" ? "Brand" : ruleForm.rule_type === "category" ? "Category" : "Product"}
                  </label>
                  <SearchSelect value={ruleForm.ref_id} onChange={(id) => setRuleForm({ ...ruleForm, ref_id: id })} options={refList(ruleForm.rule_type)} placeholder={`Search ${ruleForm.rule_type}...`} />
                </div>
              )}

              <div>
                <label className="block text-[12px] font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Shipping Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setRuleForm({ ...ruleForm, shipping_type: "free" })}
                    className="rounded-lg p-3 text-left transition-all border-2"
                    style={{ borderColor: ruleForm.shipping_type === "free" ? "rgba(16,185,129,0.5)" : "var(--border-color)", backgroundColor: ruleForm.shipping_type === "free" ? "rgba(16,185,129,0.08)" : "var(--bg-tertiary)" }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: ruleForm.shipping_type === "free" ? "rgba(16,185,129,0.15)" : "var(--bg-card)" }}>
                      <TruckIcon className="w-5 h-5" style={{ color: ruleForm.shipping_type === "free" ? "#10b981" : "var(--text-muted)" }} />
                    </div>
                    <p className="text-[13px] font-bold" style={{ color: ruleForm.shipping_type === "free" ? "#10b981" : "var(--text-primary)" }}>FREE</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>No charge</p>
                  </button>
                  <button type="button" onClick={() => setRuleForm({ ...ruleForm, shipping_type: "fixed" })}
                    className="rounded-lg p-3 text-left transition-all border-2"
                    style={{ borderColor: ruleForm.shipping_type === "fixed" ? "var(--accent)" : "var(--border-color)", backgroundColor: ruleForm.shipping_type === "fixed" ? "rgba(16,185,129,0.05)" : "var(--bg-tertiary)" }}>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: ruleForm.shipping_type === "fixed" ? "var(--accent-soft)" : "var(--bg-card)" }}>
                      <TagIcon className="w-5 h-5" style={{ color: ruleForm.shipping_type === "fixed" ? "var(--accent)" : "var(--text-muted)" }} />
                    </div>
                    <p className="text-[13px] font-bold" style={{ color: ruleForm.shipping_type === "fixed" ? "var(--accent)" : "var(--text-primary)" }}>Fixed Fee</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Custom rate (Rs)</p>
                  </button>
                </div>
              </div>

              {ruleForm.shipping_type === "fixed" && (
                <div>
                  <label className="block text-[12px] font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Fixed Fee (Rs)</label>
                  <input type="number" min="0" value={ruleForm.fee} onChange={(e) => setRuleForm({ ...ruleForm, fee: Number(e.target.value) })} className="h-10 px-3 rounded-lg text-[13px] w-full outline-none" style={inputStyle} placeholder="e.g. 150" />
                </div>
              )}

              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <span className="text-[11px] uppercase font-bold" style={{ color: "var(--text-muted)" }}>{ruleForm.rule_type}</span>
                <span className="text-[12px] font-semibold truncate flex-1" style={{ color: "var(--text-primary)" }}>
                  {ruleForm.rule_type === "all" ? "All Products" : (ruleForm.ref_id ? refName(ruleForm) : "—")}
                </span>
                <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-[12px] font-black shrink-0" style={{ color: ruleForm.shipping_type === "free" ? "#10b981" : "var(--text-primary)" }}>
                  {ruleForm.shipping_type === "free" ? "FREE" : `Rs. ${Number(ruleForm.fee || 0).toLocaleString()}`}
                </span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={ruleForm.is_active} onChange={(e) => setRuleForm({ ...ruleForm, is_active: e.target.checked })} className="w-4 h-4 rounded" style={{ accentColor: "var(--accent)" }} />
                <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>Active</span>
              </label>

              <div className="flex flex-col sm:flex-row gap-2 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button type="button" onClick={() => setShowRuleModal(false)} className="flex-1 h-11 sm:h-10 rounded-lg text-[13px] font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button type="submit" disabled={ruleMutation.isPending} className="flex-1 h-11 sm:h-10 rounded-lg text-[13px] font-semibold transition disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  {ruleMutation.isPending ? (<><Spinner className="w-4 h-4" /> Saving...</>) : (editingRule ? "Update Rule" : "Save Rule")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
          <div className="w-full max-w-sm rounded-xl p-4 sm:p-5" style={cardStyle}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <TrashIcon className="w-5 h-5" style={{ color: "var(--danger)" }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Delete this rule?</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {deleteTarget.rule_type === "all" ? "All Products" : refName(deleteTarget)} — {deleteTarget.shipping_type === "free" ? "FREE shipping" : `Rs. ${deleteTarget.fee}`}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-5">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-11 sm:h-9 rounded-lg text-[13px] sm:text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget._id)} disabled={deleteMutation.isPending} className="flex-1 h-11 sm:h-9 rounded-lg text-[13px] sm:text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--danger)" }}>
                {deleteMutation.isPending ? (<><Spinner className="w-4 h-4" /> Deleting...</>) : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 