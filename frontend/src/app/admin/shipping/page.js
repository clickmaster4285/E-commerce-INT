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
const TruckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1h4a1 1 0 001-1v-3m-9 4a2 2 0 104 0m-4 0a2 2 0 114 0m6-2V9m-2 2h4l2 3v3h-2m-2-5a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>);
const ZapIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>);
const PlusIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const EditIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>);
const TrashIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>);
const CloseIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
const CheckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>);
const SearchIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const ArrowRightIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>);
const TagIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>);
const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);

const inputCls = "h-9 px-3 rounded-md text-sm w-full outline-none transition focus:ring-1 focus:ring-emerald-500/40";
const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
const labelCls = "block text-xs font-medium mb-1.5";
const labelStyle = { color: "var(--text-secondary)" };

/* ================================================================
   ✅ SEARCHABLE TARGET PICKER
================================================================ */
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

  const selected = options.find((o) => String(o._id) === String(value));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="h-9 w-full px-3 rounded-md text-sm flex items-center justify-between gap-2 outline-none transition"
        style={inputStyle}
      >
        <span className="truncate" style={{ color: selected ? "var(--text-primary)" : "var(--text-muted)" }}>
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg overflow-hidden shadow-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="p-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
                <SearchIcon className="w-3.5 h-3.5" />
              </span>
              <input
                autoFocus
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search..."
                className="w-full h-8 pl-8 pr-2 rounded-md text-[12px] outline-none"
                style={inputStyle}
              />
            </div>
          </div>
          <div className="max-h-[180px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>No results found</p>
            ) : (
              filtered.map((o) => {
                const isSel = String(o._id) === String(value);
                return (
                  <button
                    key={o._id}
                    type="button"
                    onClick={() => { onChange(String(o._id)); setOpen(false); setTerm(""); }}
                    className="w-full px-3 py-2 text-left text-[13px] flex items-center justify-between gap-2 transition hover:bg-white/5"
                    style={{
                      color: isSel ? "#34d399" : "var(--text-primary)",
                      backgroundColor: isSel ? "rgba(16,185,129,0.08)" : "transparent",
                    }}
                  >
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
   MAIN PAGE
================================================================ */
export default function ShippingPage() {
  useShippingSocketSync();
  const queryClient = useQueryClient();

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configForm, setConfigForm] = useState(null);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({ rule_type: "brand", ref_id: "", shipping_type: "free", fee: 0, is_active: true });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: config, isLoading } = useQuery({ queryKey: ["adminShippingConfig"], queryFn: shippingApi.getConfig });
  const { data: rules = [] } = useQuery({ queryKey: ["adminShippingRules"], queryFn: shippingApi.getRules });
  const { data: brands = [] } = useQuery({ queryKey: ["adminBrands"], queryFn: adminBrandApi.getAll });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoryApi.getAll });
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: productApi.getAll });

  /* ---------- Mutations ---------- */
  const configMutation = useMutation({
    mutationFn: shippingApi.updateConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminShippingConfig"] });
      toast.success("Shipping settings updated");
      setShowConfigModal(false);
    },
    onError: (e) => toast.error(e.response?.data?.message || "Update failed"),
  });

  const ruleMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? shippingApi.updateRule(id, data) : shippingApi.createRule(data)),
    onSuccess: (_, v) => {
      queryClient.invalidateQueries({ queryKey: ["adminShippingRules"] });
      toast.success(v.id ? "Rule updated" : "Rule added");
      setShowRuleModal(false);
      setEditingRule(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || "Rule save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: shippingApi.deleteRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminShippingRules"] });
      toast.success("Rule deleted");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.response?.data?.message || "Delete failed"),
  });

  const toggleMutation = useMutation({
    mutationFn: shippingApi.toggleRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["adminShippingRules"] }),
  });

  /* ---------- Helpers ---------- */
  const refName = (rule) => {
    const id = String(rule.ref_id ?? rule);
    if ((rule.rule_type || ruleForm.rule_type) === "brand") return brands.find((b) => String(b._id) === id)?.name || "Unknown brand";
    if ((rule.rule_type || ruleForm.rule_type) === "category") return categories.find((c) => String(c._id) === id)?.name || "Unknown category";
    return products.find((p) => String(p._id) === id)?.name || "Unknown product";
  };

  const refList = ruleForm.rule_type === "brand" ? brands : ruleForm.rule_type === "category" ? categories : products;

  const openConfigModal = () => {
    setConfigForm({
      standard: { fee: config?.standard?.fee ?? 200, min_days: config?.standard?.min_days ?? 2, max_days: config?.standard?.max_days ?? 4 },
      express: { fee: config?.express?.fee ?? 500, min_days: config?.express?.min_days ?? 1, max_days: config?.express?.max_days ?? 2 },
      free_shipping_over: config?.free_shipping_over ?? 0,
    });
    setShowConfigModal(true);
  };

  const openRuleModal = (rule = null) => {
    if (rule) {
      setEditingRule(rule);
      setRuleForm({ rule_type: rule.rule_type, ref_id: String(rule.ref_id), shipping_type: rule.shipping_type, fee: rule.fee || 0, is_active: rule.is_active });
    } else {
      setEditingRule(null);
      setRuleForm({ rule_type: "brand", ref_id: "", shipping_type: "free", fee: 0, is_active: true });
    }
    setShowRuleModal(true);
  };

  const submitRule = (e) => {
    e.preventDefault();
    if (!ruleForm.ref_id) return toast.error("Please select a target");
    if (ruleForm.shipping_type === "fixed" && ruleForm.fee < 0) return toast.error("Fee cannot be negative");
    ruleMutation.mutate({ id: editingRule?._id, data: ruleForm });
  };

  const activeRules = rules.filter((r) => r.is_active).length;
  const freeRules = rules.filter((r) => r.is_active && r.shipping_type === "free").length;

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight">Shipping Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
              Delivery methods, rates & free-shipping rules
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openConfigModal} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              <EditIcon /> Edit Settings
            </button>
            <button onClick={() => openRuleModal()} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={cardStyle}>
              <PlusIcon /> Add Rule
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><TruckIcon /> Standard</p>
            <p className="text-[20px] font-bold mt-1">Rs. {config?.standard?.fee ?? 200}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{config?.standard?.min_days ?? 2}–{config?.standard?.max_days ?? 4} working days</p>
          </div>
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><ZapIcon /> Express</p>
            <p className="text-[20px] font-bold mt-1">Rs. {config?.express?.fee ?? 500}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{config?.express?.min_days ?? 1}–{config?.express?.max_days ?? 2} working days</p>
          </div>
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Free Shipping Over</p>
            <p className="text-[20px] font-bold mt-1 text-emerald-500">{(config?.free_shipping_over || 0) > 0 ? `Rs. ${config.free_shipping_over.toLocaleString()}` : "Disabled"}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Order value threshold</p>
          </div>
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}><TagIcon /> Active Rules</p>
            <p className="text-[20px] font-bold mt-1 text-blue-500">{activeRules}</p>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{freeRules} free-shipping rules</p>
          </div>
        </div>

        {/* Rules Table */}
        <div className="rounded-lg overflow-hidden" style={cardStyle}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
            <h2 className="text-[12px] font-semibold uppercase tracking-wider">Shipping Rules (Brand / Category / Product)</h2>
          </div>
          {rules.length === 0 ? (
            <div className="py-14 text-center">
              <TruckIcon className="w-8 h-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No rules yet — add a free/fixed shipping rule</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                  {rules.map((rule, i) => (
                    <tr key={rule._id} style={{ borderBottom: i < rules.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" style={{ backgroundColor: "rgba(59,130,246,0.1)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}>
                          {rule.rule_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{refName(rule)}</td>
                      <td className="px-4 py-3">
                        {rule.shipping_type === "free" ? (
                          <span className="font-bold text-emerald-500">FREE</span>
                        ) : (
                          <span className="font-bold">Rs. {rule.fee.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleMutation.mutate(rule._id)} className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide transition" style={rule.is_active ? { backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" } : { backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
                          {rule.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openRuleModal(rule)} className="min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "var(--text-secondary)" }} title="Edit">
                            <EditIcon />
                          </button>
                          <button onClick={() => setDeleteTarget(rule)} className="min-w-[34px] min-h-[34px] p-2 rounded-md transition text-red-500 hover:bg-red-500/10 flex items-center justify-center" title="Delete">
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ===== Config Modal ===== */}
      {showConfigModal && configForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg rounded-xl" style={cardStyle}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <h3 className="text-base font-semibold">Shipping Settings</h3>
              <button onClick={() => setShowConfigModal(false)} className="p-1 rounded transition hover:opacity-70" style={{ color: "var(--text-muted)" }}><CloseIcon /></button>
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); configMutation.mutate(configForm); }}
              className="p-5 space-y-4 max-h-[70vh] overflow-y-auto"
            >
              <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}><TruckIcon /> Standard Delivery</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={labelCls} style={labelStyle}>Fee (Rs)</label><input type="number" min="0" value={configForm.standard.fee} onChange={(e) => setConfigForm({ ...configForm, standard: { ...configForm.standard, fee: Number(e.target.value) } })} className={inputCls} style={inputStyle} /></div>
                  <div><label className={labelCls} style={labelStyle}>Min Days</label><input type="number" min="0" value={configForm.standard.min_days} onChange={(e) => setConfigForm({ ...configForm, standard: { ...configForm.standard, min_days: Number(e.target.value) } })} className={inputCls} style={inputStyle} /></div>
                  <div><label className={labelCls} style={labelStyle}>Max Days</label><input type="number" min="0" value={configForm.standard.max_days} onChange={(e) => setConfigForm({ ...configForm, standard: { ...configForm.standard, max_days: Number(e.target.value) } })} className={inputCls} style={inputStyle} /></div>
                </div>
              </div>

              <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <p className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}><ZapIcon /> Express Delivery</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><label className={labelCls} style={labelStyle}>Fee (Rs)</label><input type="number" min="0" value={configForm.express.fee} onChange={(e) => setConfigForm({ ...configForm, express: { ...configForm.express, fee: Number(e.target.value) } })} className={inputCls} style={inputStyle} /></div>
                  <div><label className={labelCls} style={labelStyle}>Min Days</label><input type="number" min="0" value={configForm.express.min_days} onChange={(e) => setConfigForm({ ...configForm, express: { ...configForm.express, min_days: Number(e.target.value) } })} className={inputCls} style={inputStyle} /></div>
                  <div><label className={labelCls} style={labelStyle}>Max Days</label><input type="number" min="0" value={configForm.express.max_days} onChange={(e) => setConfigForm({ ...configForm, express: { ...configForm.express, max_days: Number(e.target.value) } })} className={inputCls} style={inputStyle} /></div>
                </div>
              </div>

              <div>
                <label className={labelCls} style={labelStyle}>Free Shipping Over (Rs) — 0 = disabled</label>
                <input type="number" min="0" value={configForm.free_shipping_over} onChange={(e) => setConfigForm({ ...configForm, free_shipping_over: Number(e.target.value) })} className={inputCls} style={inputStyle} />
              </div>

              <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button type="button" onClick={() => setShowConfigModal(false)} className="flex-1 h-9 rounded-md text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button type="submit" disabled={configMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-semibold transition disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  {configMutation.isPending ? "Saving..." : "Save Settings"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== ✅ IMPROVED RULE MODAL ===== */}
      {showRuleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl" style={cardStyle}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h3 className="text-base font-semibold">{editingRule ? "Edit Rule" : "Add Shipping Rule"}</h3>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Free ya fixed shipping — brand / category / product ke liye</p>
              </div>
              <button onClick={() => setShowRuleModal(false)} className="p-1 rounded transition hover:opacity-70" style={{ color: "var(--text-muted)" }}><CloseIcon /></button>
            </div>

            <form onSubmit={submitRule} className="p-5 space-y-4">
              {/* 1. Rule Type — segmented */}
              <div>
                <label className={labelCls} style={labelStyle}>Apply To</label>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                  {["brand", "category", "product"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRuleForm({ ...ruleForm, rule_type: t, ref_id: "" })}
                      className="h-8 rounded-md text-[12px] font-semibold capitalize transition"
                      style={ruleForm.rule_type === t ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : { color: "var(--text-muted)" }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Target — searchable */}
              <div>
                <label className={labelCls} style={labelStyle}>Select {ruleForm.rule_type === "brand" ? "Brand" : ruleForm.rule_type === "category" ? "Category" : "Product"}</label>
                <SearchSelect
                  value={ruleForm.ref_id}
                  onChange={(id) => setRuleForm({ ...ruleForm, ref_id: id })}
                  options={refList}
                  placeholder={`Search ${ruleForm.rule_type}...`}
                />
              </div>

              {/* 3. Shipping Type — cards */}
              <div>
                <label className={labelCls} style={labelStyle}>Shipping</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRuleForm({ ...ruleForm, shipping_type: "free" })}
                    className="rounded-lg p-3 text-left transition border-2"
                    style={ruleForm.shipping_type === "free"
                      ? { borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.08)" }
                      : { borderColor: "var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}
                  >
                    <p className="text-[13px] font-bold flex items-center gap-1.5" style={{ color: ruleForm.shipping_type === "free" ? "#34d399" : "var(--text-primary)" }}>
                      <TruckIcon className="w-4 h-4" /> FREE
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>No delivery charge</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRuleForm({ ...ruleForm, shipping_type: "fixed" })}
                    className="rounded-lg p-3 text-left transition border-2"
                    style={ruleForm.shipping_type === "fixed"
                      ? { borderColor: "var(--accent)", backgroundColor: "rgba(16,185,129,0.05)" }
                      : { borderColor: "var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}
                  >
                    <p className="text-[13px] font-bold flex items-center gap-1.5" style={{ color: ruleForm.shipping_type === "fixed" ? "var(--accent)" : "var(--text-primary)" }}>
                      <TagIcon className="w-4 h-4" /> Fixed Fee
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>Custom rate (Rs)</p>
                  </button>
                </div>
              </div>

              {/* 4. Fee (fixed only) */}
              {ruleForm.shipping_type === "fixed" && (
                <div>
                  <label className={labelCls} style={labelStyle}>Fixed Fee (Rs)</label>
                  <input
                    type="number"
                    min="0"
                    value={ruleForm.fee}
                    onChange={(e) => setRuleForm({ ...ruleForm, fee: Number(e.target.value) })}
                    className={inputCls}
                    style={inputStyle}
                    placeholder="e.g. 150"
                  />
                </div>
              )}

              {/* 5. Live Preview */}
              {ruleForm.ref_id && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                  <span className="text-[11px] uppercase font-bold" style={{ color: "var(--text-muted)" }}>{ruleForm.rule_type}</span>
                  <span className="text-[12px] font-semibold truncate flex-1">{refName(ruleForm)}</span>
                  <ArrowRightIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                  <span className="text-[12px] font-black shrink-0" style={{ color: ruleForm.shipping_type === "free" ? "#34d399" : "var(--text-primary)" }}>
                    {ruleForm.shipping_type === "free" ? "FREE" : `Rs. ${Number(ruleForm.fee || 0).toLocaleString()}`}
                  </span>
                </div>
              )}

              {/* 6. Active */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ruleForm.is_active}
                  onChange={(e) => setRuleForm({ ...ruleForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: "var(--accent)" }}
                />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Active</span>
              </label>

              <div className="flex gap-2 pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button type="button" onClick={() => setShowRuleModal(false)} className="flex-1 h-9 rounded-md text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button type="submit" disabled={ruleMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-semibold transition disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  {ruleMutation.isPending ? "Saving..." : editingRule ? "Update Rule" : "Save Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Delete Confirm ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-xl p-5" style={cardStyle}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <TrashIcon className="w-5 h-5" style={{ color: "var(--danger)" }} />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Delete this rule?</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {refName(deleteTarget)} — {deleteTarget.shipping_type === "free" ? "FREE shipping" : `Rs. ${deleteTarget.fee}`}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-9 rounded-md text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget._id)} disabled={deleteMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: "var(--danger)" }}>
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}