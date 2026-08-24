"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { dealApi } from "../../../apis/admin/dealApi";
import { productApi } from "../../../apis/admin/productApi";
import { categoryApi } from "../../../apis/admin/categoryApi";
import { brandApi } from "../../../apis/admin/brandApi";
// ✅ FIX: Importing the new socket sync hook
import useDealSocketSync from "../../../hooks/useDealSocketSync"; 

/* ==================== ICONS ==================== */
const PlusIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const SearchIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const EditIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>);
const TrashIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>);
const CloseIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
const DealIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h16v5H4z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 7v14" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.5 7C7.1 7 6 5.9 6 4.5S7.1 2 8.5 2C10.5 2 12 7 12 7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.5 7C16.9 7 18 5.9 18 4.5S16.9 2 15.5 2C13.5 2 12 7 12 7" /></svg>);
const CheckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>);

/* ==================== HELPERS (FIXED FOR BACKEND SCHEMA) ==================== */
const normalizeArrayResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.deals)) return response.deals;
  return [];
};

const getId = (item) => String(item?._id || item?.id || "");

const getName = (item, type) => {
  if (type === "product") return item?.name || item?.title || "Unnamed Product";
  if (type === "category") return item?.name || item?.categoryName || "Unnamed Category";
  if (type === "brand") return item?.name || item?.brandName || "Unnamed Brand";
  return item?.name || "Unnamed";
};

// FIXED: Status logic based on isActive and dates
const getDealStatus = (deal) => {
  if (!deal?.isActive) return "disabled";
  
  const now = new Date();
  const start = deal?.startDate ? new Date(deal.startDate) : null;
  const end = deal?.endDate ? new Date(deal.endDate) : null;
  
  if (start && start > now) return "scheduled";
  if (end && end < now) return "expired";
  return "active";
};

// FIXED: Maps backend 'applyTo' values to readable text
const formatTarget = (target) => {
  if (!target) return "All Products";
  const map = {
    all: "All Products",
    product: "Specific Products",
    category: "Categories",
    brand: "Brands",
    collection: "Collections",
  };
  return map[target] || target;
};

// FIXED: Uses 'discountValue' from backend schema
const formatDealValue = (deal) => {
  const type = deal?.type || "";
  // Backend field is 'discountValue'
  const value = Number(deal?.discountValue ?? 0); 

  switch (type) {
    case "percentage":
      return `${value}% OFF`;
    case "fixed_amount": 
    case "fixed":
      return `Rs. ${value} OFF`;
    case "buy_x_get_y": {
      const buy = deal?.buyQuantity ?? 1;
      const get = deal?.getQuantity ?? 1;
      const disc = deal?.getDiscountValue ?? 100;
      return `Buy ${buy} Get ${get} (${disc === 100 ? "Free" : `${disc}% Off`})`;
    }
    case "free_shipping":
      return "Free Shipping";
    case "bundle":
      return `Bundle @ Rs. ${deal?.bundlePrice ?? 0}`;
    default:
      return value > 0 ? `${value}` : "-";
  }
};

const toDateInput = (value) => {
  if (!value) return "";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  } catch { return ""; }
};

const dateToISO = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

const StatusBadge = ({ status }) => {
  const config = {
    active: { text: "Active", bg: "rgba(16,185,129,0.10)", color: "#34d399", border: "rgba(16,185,129,0.25)" },
    scheduled: { text: "Scheduled", bg: "rgba(59,130,246,0.10)", color: "#60a5fa", border: "rgba(59,130,246,0.25)" },
    expired: { text: "Expired", bg: "rgba(245,158,11,0.10)", color: "#fbbf24", border: "rgba(245,158,11,0.25)" },
    disabled: { text: "Disabled", bg: "rgba(239,68,68,0.10)", color: "#f87171", border: "rgba(239,68,68,0.25)" },
    draft: { text: "Draft", bg: "rgba(148,163,184,0.10)", color: "#94a3b8", border: "rgba(148,163,184,0.25)" },
  };
  const item = config[status] || config.disabled;
  return (
    <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}>
      {item.text}
    </span>
  );
};

/* ==================== MAIN COMPONENT ==================== */
export default function DealsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all_targets"); // Default changed to avoid conflict
  const [showModal, setShowModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [selector, setSelector] = useState({ open: false, type: null });
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ✅ FIX: Using the dedicated socket sync hook for real-time updates
  const { markSelfAction } = useDealSocketSync();

  const [formData, setFormData] = useState({
    name: "", code: "", description: "",
    target_type: "all", // Matches backend 'applyTo' default
    selected_product_ids: [], selected_category_ids: [], selected_brand_ids: [],
    value_type: "percentage", value: "", min_order_value: "",
    buy_quantity: "", get_quantity: "", get_discount_value: "100", bundle_price: "",
    start_at: "", end_at: "", usage_limit: "", per_user_limit: "",
    status: "active", is_featured: false,
  });

  const { data: dealsResponse, isLoading } = useQuery({ queryKey: ["deals"], queryFn: dealApi.getAll });
  const deals = useMemo(() => normalizeArrayResponse(dealsResponse), [dealsResponse]);
  
  const { data: productsResponse } = useQuery({ queryKey: ["deal-products"], queryFn: productApi.getAll, staleTime: 60000 });
  const products = useMemo(() => normalizeArrayResponse(productsResponse), [productsResponse]);
  const { data: categoriesResponse } = useQuery({ queryKey: ["deal-categories"], queryFn: categoryApi.getAll, staleTime: 60000 });
  const categories = useMemo(() => normalizeArrayResponse(categoriesResponse), [categoriesResponse]);
  const { data: brandsResponse } = useQuery({ queryKey: ["deal-brands"], queryFn: brandApi.getAll, staleTime: 60000 });
  const brands = useMemo(() => normalizeArrayResponse(brandsResponse), [brandsResponse]);

  const resetForm = () => {
    setFormData({
      name: "", code: "", description: "", target_type: "all",
      selected_product_ids: [], selected_category_ids: [], selected_brand_ids: [],
      value_type: "percentage", value: "", min_order_value: "",
      buy_quantity: "", get_quantity: "", get_discount_value: "100", bundle_price: "",
      start_at: "", end_at: "", usage_limit: "", per_user_limit: "",
      status: "active", is_featured: false,
    });
    setEditingDeal(null);
    setSelector({ open: false, type: null });
  };

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? dealApi.update(id, data) : dealApi.create(data)),
    onMutate: (_, variables) => {
      // ✅ Mark self action to prevent duplicate refreshes from socket
      markSelfAction(variables.id ? "update" : "create");
    },
    onSuccess: (_, variables) => {
      // Note: invalidateQueries is handled by the hook, but keeping this as fallback/safety
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success(variables.id ? "Deal updated successfully" : "Deal created successfully");
      setShowModal(false);
      resetForm();
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Failed to save deal"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids) => await Promise.all(ids.map((id) => dealApi.delete(id))),
    onMutate: () => {
      // ✅ Mark self action for delete
      markSelfAction("delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setDeleteTarget(null);
      toast.success("Deal deleted successfully");
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Failed to delete deal"),
  });

  const filteredDeals = useMemo(() => {
    const term = search.toLowerCase().trim();
    return deals.filter((deal) => {
      const name = String(deal?.name || "").toLowerCase();
      const matchSearch = !term || name.includes(term);
      
      const status = getDealStatus(deal);
      const matchStatus = statusFilter === "all" || status === statusFilter;
      
      // Filter by applyTo (Fixed for 'all_targets' vs 'all')
      const rawTarget = deal?.applyTo || "all";
      const matchTarget = targetFilter === "all_targets" || rawTarget === targetFilter;
                          
      return matchSearch && matchStatus && matchTarget;
    });
  }, [deals, search, statusFilter, targetFilter]);

  const stats = useMemo(() => ({
    total: deals.length,
    active: deals.filter((d) => getDealStatus(d) === "active").length,
    expired: deals.filter((d) => getDealStatus(d) === "expired").length,
    disabled: deals.filter((d) => getDealStatus(d) === "disabled").length,
  }), [deals]);

  // FIXED: Edit Logic mapping backend fields to form state
  const openEdit = (deal) => {
    setFormData({
      name: deal?.name || "", 
      code: deal?.code || "", 
      description: deal?.description || "",
      target_type: deal?.applyTo || "all", // Backend field
      
      selected_product_ids: Array.isArray(deal?.productIds) ? deal.productIds.map(String) : [],
      selected_category_ids: Array.isArray(deal?.categoryIds) ? deal.categoryIds.map(String) : [],
      selected_brand_ids: Array.isArray(deal?.brandIds) ? deal.brandIds.map(String) : [],
      
      value_type: deal?.type || "percentage",
      value: deal?.discountValue ?? "", // Backend field
      
      min_order_value: deal?.minOrderValue ?? "",
      buy_quantity: deal?.buyQuantity ?? "",
      get_quantity: deal?.getQuantity ?? "",
      get_discount_value: deal?.getDiscountValue ?? "100",
      bundle_price: deal?.bundlePrice ?? "",
      
      start_at: toDateInput(deal?.startDate),
      end_at: toDateInput(deal?.endDate),
      
      usage_limit: deal?.usageLimit ?? "",
      per_user_limit: deal?.perUserLimit ?? "",
      
      status: deal?.isActive ? "active" : "disabled",
      is_featured: Boolean(deal?.isFeatured),
    });
    setEditingDeal(deal);
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!String(formData.name || "").trim()) return toast.error("Deal name is required");

    const dealValue = formData.value === "" ? NaN : Number(formData.value);
    if (["percentage", "fixed_amount"].includes(formData.value_type)) {
      if (Number.isNaN(dealValue) || dealValue < 0) return toast.error("Please enter a valid deal value");
      if (formData.value_type === "percentage" && dealValue > 100) return toast.error("Percentage cannot be greater than 100");
    }

    if (formData.target_type === "product" && formData.selected_product_ids.length === 0) return toast.error("Select at least one product");
    if (formData.target_type === "category" && formData.selected_category_ids.length === 0) return toast.error("Select at least one category");
    if (formData.target_type === "brand" && formData.selected_brand_ids.length === 0) return toast.error("Select at least one brand");

    const startDate = formData.start_at ? dateToISO(formData.start_at) : new Date().toISOString();
    const endDate = formData.end_at ? dateToISO(formData.end_at) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (new Date(endDate) <= new Date(startDate)) return toast.error("End date must be after start date");

    // FIXED: Payload matches Backend Schema exactly
    const payload = {
      name: String(formData.name).trim(),
      description: String(formData.description || "").trim() || undefined,
      
      applyTo: formData.target_type, // Backend field
      productIds: formData.target_type === "product" ? formData.selected_product_ids : [],
      categoryIds: formData.target_type === "category" ? formData.selected_category_ids : [],
      brandIds: formData.target_type === "brand" ? formData.selected_brand_ids : [],
      
      type: formData.value_type,
      discountValue: ["percentage", "fixed_amount"].includes(formData.value_type) ? dealValue : 0, // Backend field
      
      minOrderValue: formData.min_order_value ? Number(formData.min_order_value) : 0,
      buyQuantity: formData.buy_quantity ? Number(formData.buy_quantity) : 0,
      getQuantity: formData.get_quantity ? Number(formData.get_quantity) : 0,
      getDiscountValue: formData.get_discount_value ? Number(formData.get_discount_value) : 100,
      bundlePrice: formData.bundle_price ? Number(formData.bundle_price) : 0,

      startDate,
      endDate,
      
      usageLimit: formData.usage_limit !== "" ? Number(formData.usage_limit) : null,
      perUserLimit: formData.per_user_limit !== "" ? Number(formData.per_user_limit) : null,
      
      isActive: formData.status === "active",
      isFeatured: Boolean(formData.is_featured),
    };

    Object.keys(payload).forEach((key) => { if (payload[key] === undefined || payload[key] === null) delete payload[key]; });
    saveMutation.mutate({ id: editingDeal?._id || editingDeal?.id || null, data: payload });
  };

  const getSelectedItems = (type) => {
    let items = [], ids = [];
    if (type === "product") { items = products; ids = formData.selected_product_ids; }
    if (type === "category") { items = categories; ids = formData.selected_category_ids; }
    if (type === "brand") { items = brands; ids = formData.selected_brand_ids; }
    return items.filter((item) => ids.includes(getId(item)));
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.map((deal) => deal?._id || deal?.id));
  };

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5 p-4 md:p-0">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight">Deal Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Create and manage professional deals for your store.</p>
          </div>
          <button onClick={() => { resetForm(); setShowModal(true); }} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
            <PlusIcon /> Create Deal
          </button>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Total Deals" value={stats.total} cardStyle={cardStyle} />
          <StatCard title="Active" value={stats.active} valueClass="text-emerald-500" cardStyle={cardStyle} />
          <StatCard title="Disabled" value={stats.disabled} valueClass="text-red-400" cardStyle={cardStyle} />
          <StatCard title="Expired" value={stats.expired} valueClass="text-amber-500" cardStyle={cardStyle} />
        </div>

        {/* SEARCH & FILTERS */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
          <input type="text" placeholder="Search deal name..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-9 pr-3 rounded-lg text-[13px] outline-none" style={inputStyle} />
        </div>
        
        <div className="flex flex-wrap gap-3">
          {/* Status Filter */}
          <Select 
            value={statusFilter} 
            onChange={setStatusFilter} 
            inputStyle={inputStyle} 
            options={[
              ["all", "All Status"], 
              ["active", "Active"], 
              ["scheduled", "Scheduled"], 
              ["disabled", "Disabled"], 
              ["expired", "Expired"]
            ]} 
          />

          {/* Target Filter - Value 'all_targets' karne se conflict khatam ho jayega */}
          <Select 
            value={targetFilter} 
            onChange={setTargetFilter} 
            inputStyle={inputStyle} 
            options={[
              ["all_targets", "All Targets"], 
              ["all", "All Products"], 
              ["product", "Specific Products"], 
              ["category", "Categories"], 
              ["brand", "Brands"]
            ]} 
          />
        </div>

        {/* TABLE */}
        {isLoading ? (
          <div className="rounded-lg py-14 flex justify-center items-center gap-2" style={cardStyle}><Spinner /><span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading deals...</span></div>
        ) : filteredDeals.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center" style={cardStyle}>
            <DealIcon className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{search ? "No deals found" : "No deals created yet"}</p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-4 py-3 text-left" style={{ color: "var(--text-muted)" }}>Deal</th>
                    <th className="px-4 py-3 text-left" style={{ color: "var(--text-muted)" }}>Applies To</th>
                    <th className="px-4 py-3 text-left" style={{ color: "var(--text-muted)" }}>Offer</th>
                    <th className="px-4 py-3 text-left" style={{ color: "var(--text-muted)" }}>Status</th>
                    <th className="px-4 py-3 text-right" style={{ color: "var(--text-muted)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.map((deal, index) => {
                    const id = deal?._id || deal?.id;
                    const status = getDealStatus(deal);
                    return (
                      <tr key={id} style={{ borderBottom: index < filteredDeals.length - 1 ? "1px solid var(--border-color)" : "none" }} className="hover:bg-white/[0.02] transition">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16,185,129,0.10)", color: "#34d399" }}><DealIcon className="w-4 h-4" /></div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate max-w-[220px]">{deal?.name || "Untitled Deal"}</p>
                            </div>
                          </div>
                        </td>
                        {/* FIXED: Applies To Column */}
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                          {formatTarget(deal?.applyTo)}
                        </td>
                        {/* FIXED: Offer Column */}
                        <td className="px-4 py-3">
                          <span className="font-bold text-emerald-500">
                            {formatDealValue(deal)}
                          </span>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={status} /></td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end items-center gap-1">
                            <button title="Edit" onClick={() => openEdit(deal)} className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-white/5 transition" style={{ color: "var(--text-secondary)" }}><EditIcon /></button>
                            <button title="Delete" onClick={() => setDeleteTarget([deal])} className="w-8 h-8 rounded-md flex items-center justify-center text-red-500 hover:bg-red-500/10 transition"><TrashIcon /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showModal && (
        <DealFormModal formData={formData} setFormData={setFormData} editingDeal={editingDeal} saveMutation={saveMutation} setShowModal={setShowModal} resetForm={resetForm} setSelector={setSelector} getSelectedItems={getSelectedItems} handleSubmit={handleSubmit} inputStyle={inputStyle} />
      )}
      {selector.open && (
        <SelectionModal type={selector.type} items={selector.type === "product" ? products : selector.type === "category" ? categories : brands} selectedIds={selector.type === "product" ? formData.selected_product_ids : selector.type === "category" ? formData.selected_category_ids : formData.selected_brand_ids} onClose={() => setSelector({ open: false, type: null })} onApply={(ids) => {
          if (selector.type === "product") setFormData((prev) => ({ ...prev, selected_product_ids: ids }));
          if (selector.type === "category") setFormData((prev) => ({ ...prev, selected_category_ids: ids }));
          if (selector.type === "brand") setFormData((prev) => ({ ...prev, selected_brand_ids: ids }));
          setSelector({ open: false, type: null });
        }} inputStyle={inputStyle} cardStyle={cardStyle} />
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl p-5" style={cardStyle}>
            <h3 className="text-base font-semibold">Delete Deal?</h3>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>Are you sure you want to delete <span className="font-semibold">{deleteTarget[0]?.name}</span>?</p>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-9 rounded-md text-sm" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleteMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ backgroundColor: "var(--danger)" }}>
                {deleteMutation.isPending ? <><Spinner className="w-3.5 h-3.5" /> Deleting...</> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==================== SUB-COMPONENTS ==================== */
function StatCard({ title, value, valueClass = "", cardStyle }) {
  return (<div className="rounded-lg p-4" style={cardStyle}>
    <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{title}</p>
    <p className={`text-[20px] font-bold mt-1 ${valueClass}`}>{value}</p>
  </div>);
}

function Select({ value, onChange, options, inputStyle }) {
  return (
    <div className="relative">
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className="appearance-none h-9 w-[170px] pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer" 
        style={inputStyle}
      >
        {options.map(([val, label]) => (
          // FIX: Key ko unique banaya label ke sath combine karke
          <option key={`${val}-${label}`} value={val}>
            {label}
          </option>
        ))}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}>
        <ChevronDownIcon className="w-3.5 h-3.5" />
      </span>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, inputStyle }) {
  return (<div>
    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 px-3 rounded-md text-sm w-full outline-none" style={inputStyle} />
  </div>);
}

function SelectionField({ label, items, onClick, onRemove }) {
  return (<div className="mt-3">
    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
    <div className="rounded-md p-3 flex flex-wrap gap-2" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
      {items.length === 0 ? (<span className="text-xs" style={{ color: "var(--text-muted)" }}>No {label.toLowerCase()} selected</span>) : (
        items.slice(0, 5).map((item) => (<span key={getId(item)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px]" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          {getName(item, label === "Products" ? "product" : label === "Categories" ? "category" : "brand")}
          <button type="button" onClick={() => onRemove(getId(item))} className="text-red-500"><CloseIcon className="w-3 h-3" /></button>
        </span>))
      )}
      <button type="button" onClick={onClick} className="h-7 px-2.5 rounded text-[11px] font-medium flex items-center gap-1" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <PlusIcon className="w-3 h-3" /> {items.length ? "Manage" : "Select"}
      </button>
      {items.length > 5 && (<span className="text-[11px]" style={{ color: "var(--text-muted)" }}>+{items.length - 5} more</span>)}
    </div>
  </div>);
}

/* ==================== DEAL FORM MODAL ==================== */
function DealFormModal({ formData, setFormData, editingDeal, saveMutation, setShowModal, resetForm, setSelector, getSelectedItems, handleSubmit, inputStyle }) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div>
            <h3 className="text-base font-semibold">{editingDeal ? "Edit Deal" : "Create New Deal"}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Set the offer, products and deal schedule.</p>
          </div>
          <button onClick={() => { setShowModal(false); resetForm(); }} disabled={saveMutation.isPending} className="p-1 hover:opacity-70" style={{ color: "var(--text-muted)" }}><CloseIcon /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">
          <div>
            <p className="text-sm font-semibold mb-3">Basic Information</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Deal Name *" value={formData.name} onChange={(v) => setFormData({ ...formData, name: v })} placeholder="Weekend Mega Deal" inputStyle={inputStyle} />
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Description</label>
              <textarea rows={2} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-3 py-2 rounded-md text-sm outline-none resize-none" style={inputStyle} placeholder="Describe this deal..." />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-3">Deal Offer</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Discount Type</label>
                <select value={formData.value_type} onChange={(e) => setFormData({ ...formData, value_type: e.target.value })} className="h-9 w-full px-3 rounded-md text-sm outline-none" style={inputStyle}>
                  <option value="percentage">Percentage Discount (%)</option>
                  <option value="fixed_amount">Fixed Amount Discount (Rs.)</option>
                  <option value="buy_x_get_y">Buy X Get Y</option>
                  <option value="bundle">Bundle Deal</option>
                  <option value="free_shipping">Free Shipping</option>
                </select>
              </div>
              {formData.value_type === "percentage" && <Field label="Discount Percentage *" type="number" value={formData.value} onChange={(v) => setFormData({ ...formData, value: v })} placeholder="e.g., 20" inputStyle={inputStyle} />}
              {formData.value_type === "fixed_amount" && <Field label="Discount Amount (Rs.) *" type="number" value={formData.value} onChange={(v) => setFormData({ ...formData, value: v })} placeholder="e.g., 500" inputStyle={inputStyle} />}
              {formData.value_type === "free_shipping" && <Field label="Min Order Value (Rs.)" type="number" value={formData.min_order_value} onChange={(v) => setFormData({ ...formData, min_order_value: v })} placeholder="e.g., 2000" inputStyle={inputStyle} />}
              {formData.value_type === "buy_x_get_y" && (
                <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                  <Field label="Buy Quantity (X) *" type="number" value={formData.buy_quantity} onChange={(v) => setFormData({ ...formData, buy_quantity: v })} placeholder="e.g., 2" inputStyle={inputStyle} />
                  <Field label="Get Quantity (Y) *" type="number" value={formData.get_quantity} onChange={(v) => setFormData({ ...formData, get_quantity: v })} placeholder="e.g., 1" inputStyle={inputStyle} />
                  <Field label="Get Discount (%) *" type="number" value={formData.get_discount_value} onChange={(v) => setFormData({ ...formData, get_discount_value: v })} placeholder="100 for Free" inputStyle={inputStyle} />
                </div>
              )}
              {formData.value_type === "bundle" && (
                 <div className="col-span-1 md:col-span-2 mt-2">
                    <Field label="Bundle Fixed Price (Rs.) *" type="number" value={formData.bundle_price} onChange={(v) => setFormData({ ...formData, bundle_price: v })} placeholder="e.g., 1500" inputStyle={inputStyle} />
                 </div>
              )}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-3">Applies To</p>
            <select value={formData.target_type} onChange={(e) => setFormData({ ...formData, target_type: e.target.value })} className="h-9 w-full px-3 rounded-md text-sm outline-none" style={inputStyle}>
              <option value="all">All Products</option>
              <option value="product">Specific Products</option>
              <option value="category">Specific Categories</option>
              <option value="brand">Specific Brands</option>
            </select>
            {formData.target_type === "product" && (<SelectionField label="Products" items={getSelectedItems("product")} onClick={() => setSelector({ open: true, type: "product" })} onRemove={(id) => setFormData((prev) => ({ ...prev, selected_product_ids: prev.selected_product_ids.filter((x) => x !== id) }))} />)}
            {formData.target_type === "category" && (<SelectionField label="Categories" items={getSelectedItems("category")} onClick={() => setSelector({ open: true, type: "category" })} onRemove={(id) => setFormData((prev) => ({ ...prev, selected_category_ids: prev.selected_category_ids.filter((x) => x !== id) }))} />)}
            {formData.target_type === "brand" && (<SelectionField label="Brands" items={getSelectedItems("brand")} onClick={() => setSelector({ open: true, type: "brand" })} onRemove={(id) => setFormData((prev) => ({ ...prev, selected_brand_ids: prev.selected_brand_ids.filter((x) => x !== id) }))} />)}
          </div>

          <div>
            <p className="text-sm font-semibold mb-3">Deal Schedule & Limits</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Start Date & Time" type="datetime-local" value={formData.start_at} onChange={(v) => setFormData({ ...formData, start_at: v })} inputStyle={inputStyle} />
              <Field label="End Date & Time" type="datetime-local" value={formData.end_at} onChange={(v) => setFormData({ ...formData, end_at: v })} inputStyle={inputStyle} />
              <Field label="Total Usage Limit" type="number" value={formData.usage_limit} onChange={(v) => setFormData({ ...formData, usage_limit: v })} placeholder="100" inputStyle={inputStyle} />
              <Field label="Per Customer Limit" type="number" value={formData.per_user_limit} onChange={(v) => setFormData({ ...formData, per_user_limit: v })} placeholder="2" inputStyle={inputStyle} />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-3">Settings</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="h-9 w-full px-3 rounded-md text-sm outline-none" style={inputStyle}>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
              <label className="h-9 mt-6 px-3 rounded-md flex items-center gap-2 cursor-pointer text-xs" style={inputStyle}>
                <input type="checkbox" checked={formData.is_featured} onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })} className="w-4 h-4" style={{ accentColor: "var(--accent)" }} />
                Featured Deal
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
            <button type="button" onClick={() => { setShowModal(false); resetForm(); }} disabled={saveMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-medium" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-semibold flex items-center justify-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              {saveMutation.isPending ? <><Spinner className="w-3.5 h-3.5" /> Saving...</> : editingDeal ? "Update Deal" : "Create Deal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==================== SELECTION MODAL ==================== */
function SelectionModal({ type, items, selectedIds, onClose, onApply, inputStyle, cardStyle }) {
  const [search, setSearch] = useState("");
  const [draftIds, setDraftIds] = useState(selectedIds.map(String));
  
  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return items;
    return items.filter((item) => getName(item, type).toLowerCase().includes(term));
  }, [items, search, type]);

  const title = type === "product" ? "Products" : type === "category" ? "Categories" : "Brands";
  const toggle = (id) => setDraftIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl overflow-hidden" style={cardStyle}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <h3 className="text-base font-semibold">Select {title}</h3>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}><CloseIcon /></button>
        </div>
        <div className="p-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
            <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${title.toLowerCase()}...`} className="w-full h-9 pl-9 pr-3 rounded-md text-sm outline-none" style={inputStyle} />
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto px-4 pb-4">
          {filtered.length === 0 ? (<p className="text-center text-xs py-6" style={{ color: "var(--text-muted)" }}>No items found</p>) : (
            <div className="space-y-1">
              {filtered.map((item) => {
                const id = getId(item);
                const selected = draftIds.includes(id);
                return (
                  <button key={id} type="button" onClick={() => toggle(id)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left" style={{ backgroundColor: selected ? "rgba(16,185,129,0.08)" : "transparent" }}>
                    <span className="w-4 h-4 rounded border flex items-center justify-center shrink-0" style={{ backgroundColor: selected ? "#10b981" : "transparent", borderColor: selected ? "#10b981" : "var(--border-color)", color: "#fff" }}>
                      {selected && <CheckIcon className="w-3 h-3" />}
                    </span>
                    <span className="text-[13px] truncate">{getName(item, type)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: "1px solid var(--border-color)" }}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{draftIds.length} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="h-8 px-3 rounded-md text-xs" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>Cancel</button>
            <button onClick={() => onApply(draftIds)} className="h-8 px-4 rounded-md text-xs font-semibold" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}