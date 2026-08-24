"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productApi } from "../../../apis/admin/productApi";
import { discountApi } from "../../../apis/admin/discountApi";
import { categoryApi } from "../../../apis/admin/categoryApi";
import { brandApi } from "../../../apis/admin/brandApi";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

/* ================= Icons ================= */
const PlusIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);
const SearchIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const ListIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
const GridIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
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
const EyeIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);
const CloseIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
const Spinner = ({ className = "w-4 h-4" }) => (
  <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);
const TagIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);
const CheckIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
  </svg>
);

/* ================= Helpers ================= */
const getInitials = (name) => {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
};

const normalizeArrayResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.products)) return response.products;
  if (Array.isArray(response?.categories)) return response.categories;
  if (Array.isArray(response?.brands)) return response.brands;
  if (Array.isArray(response?.discounts)) return response.discounts;
  return [];
};

const getItemId = (item) => String(item?._id || item?.id || "");
const getItemName = (item, type) => {
  if (type === "product") return item?.name || item?.title || "Unnamed Product";
  if (type === "category") return item?.name || item?.categoryName || "Unnamed Category";
  if (type === "brand") return item?.name || item?.brandName || "Unnamed Brand";
  return item?.name || "Unnamed";
};

const formatTarget = (value) => {
  const map = {
    all: "All Products", all_products: "All Products", product: "Specific Products",
    specific_products: "Specific Products", category: "Categories", specific_categories: "Categories",
    brand: "Brands", price_range: "Price Range",
  };
  return map[value] || String(value || "All Products").replaceAll("_", " ");
};

const formatValue = (discount) => {
  const type = discount?.value_type || discount?.valueType || discount?.type || "percentage";
  if (type === "percentage") return `${discount?.value ?? 0}%`;
  if (type === "fixed_amount" || type === "fixed") return `-${discount?.value ?? 0}`;
  if (type === "fixed_price") return `Fixed ${discount?.value ?? 0}`;
  return `-${discount?.value ?? 0}`;
};

const getDiscountStatus = (discount) => {
  if (discount?.status) return discount.status;
  if (discount?.isActive === false) return "inactive";
  const end = discount?.end_at || discount?.endDate || discount?.endDateTime;
  if (end && new Date(end) < new Date()) return "expired";
  return "active";
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

const dateInputToISO = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
};

const Avatar = ({ name, size = "w-8 h-8" }) => (
  <div className={`${size} rounded-full flex items-center justify-center text-[11px] font-bold shrink-0`} style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "1px solid var(--border-color)" }}>
    {getInitials(name)}
  </div>
);

const StatusBadge = ({ status }) => {
  const isActive = status === "active" || status === "scheduled";
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap" style={isActive ? { backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" } : status === "expired" ? { backgroundColor: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" } : { backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
      {status === "expired" ? "Expired" : status === "active" || status === "scheduled" ? "Active" : "Inactive"}
    </span>
  );
};

/* ================= Main Component ================= */
export default function DiscountsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTarget, setFilterTarget] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [selectedIds, setSelectedIds] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selector, setSelector] = useState({ open: false, type: null });
  const itemsPerPage = 20;

  const initialForm = {
    name: "", code: "", description: "", target_type: "all_products",
    selected_product_ids: [], selected_category_ids: [], selected_brand_ids: [],
    price_min: "", price_max: "", value_type: "percentage", value: "",
    start_at: "", end_at: "", status: "draft",
  };
  const [formData, setFormData] = useState(initialForm);

  const { data: discountsResponse, isLoading } = useQuery({ queryKey: ["discounts"], queryFn: discountApi.getAll });
  const discounts = useMemo(() => normalizeArrayResponse(discountsResponse), [discountsResponse]);

  const { data: productsResponse } = useQuery({ queryKey: ["discount-products"], queryFn: productApi.getAll, staleTime: 60000 });
  const products = useMemo(() => normalizeArrayResponse(productsResponse), [productsResponse]);

  const { data: categoriesResponse } = useQuery({ queryKey: ["discount-categories"], queryFn: categoryApi.getAll, staleTime: 60000 });
  const categories = useMemo(() => normalizeArrayResponse(categoriesResponse), [categoriesResponse]);

  const { data: brandsResponse } = useQuery({ queryKey: ["discount-brands"], queryFn: brandApi.getAll, staleTime: 60000 });
  const brands = useMemo(() => normalizeArrayResponse(brandsResponse), [brandsResponse]);

  const mutation = useMutation({
    mutationFn: ({ id, data }) => {
      console.log("Sending to API:", { id, data });
      return id ? discountApi.update(id, data) : discountApi.create(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      toast.success(variables.id ? "Discount updated successfully" : "Discount added successfully");
      resetForm();
      setShowModal(false);
    },
    onError: (error) => {
      console.error("Discount mutation error:", error);
      const errorMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Failed to save discount";
      toast.error(errorMsg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => discountApi.delete(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      setSelectedIds([]);
      toast.success("Discount deleted successfully");
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast.error(error?.response?.data?.message || error?.message || "Failed to delete discount");
    },
  });

  const filteredDiscounts = useMemo(() => {
    return discounts.filter((d) => {
      const term = search.toLowerCase();
      const matchSearch = d.name?.toLowerCase().includes(term) || d.code?.toLowerCase().includes(term);
      const status = getDiscountStatus(d);
      const matchStatus = filterStatus === "all" || status === filterStatus;
      const target = d.target_type || d.applyTo || "all_products";
      const matchTarget = filterTarget === "all" || target === filterTarget || (filterTarget === "product" && target === "specific_products");
      return matchSearch && matchStatus && matchTarget;
    });
  }, [discounts, search, filterStatus, filterTarget]);

  const totalDiscounts = filteredDiscounts.length;
  const totalPages = Math.ceil(totalDiscounts / itemsPerPage);
  const paginatedDiscounts = filteredDiscounts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => { setCurrentPage(1); }, [search, filterStatus, filterTarget]);

  const stats = useMemo(() => {
    const total = discounts.length;
    const active = discounts.filter((d) => getDiscountStatus(d) === "active" || getDiscountStatus(d) === "scheduled").length;
    const inactive = discounts.filter((d) => getDiscountStatus(d) === "inactive" || getDiscountStatus(d) === "disabled" || getDiscountStatus(d) === "draft").length;
    const expired = discounts.filter((d) => getDiscountStatus(d) === "expired").length;
    return { total, active, inactive, expired };
  }, [discounts]);

  const resetForm = () => {
    setFormData({ ...initialForm, selected_product_ids: [], selected_category_ids: [], selected_brand_ids: [] });
    setEditingDiscount(null);
    setSelector({ open: false, type: null });
  };

  const handleView = (discount) => {
    router.push(`/admin/discounts/${discount._id || discount.id}`);
  };

  const openEdit = (discount) => {
    const rawTarget = discount?.target_type || discount?.applyTo || "all_products";
    let target = rawTarget;
    if (target === "all") target = "all_products";
    if (target === "specific_products" || target === "specific_product") target = "product";
    if (target === "specific_categories") target = "category";

    setFormData({
      ...initialForm,
      name: discount?.name || "", code: discount?.code || "", description: discount?.description || "",
      target_type: target,
      selected_product_ids: (discount?.selected_product_ids || discount?.products?.map(getItemId) || []).map(String),
      selected_category_ids: (discount?.selected_category_ids || discount?.categories?.map(getItemId) || []).map(String),
      selected_brand_ids: (discount?.selected_brand_ids || discount?.brands?.map(getItemId) || []).map(String),
      price_min: discount?.price_min ?? "", price_max: discount?.price_max ?? "",
      value_type: discount?.value_type || discount?.type === "fixed" ? "fixed_amount" : "percentage",
      value: discount?.value ?? "",
      start_at: toDateInput(discount?.start_at || discount?.startDate),
      end_at: toDateInput(discount?.end_at || discount?.endDate),
      status: discount?.status || (discount?.isActive ? "active" : "draft"),
    });
    setEditingDiscount(discount);
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) return toast.error("Discount name is required");
    if (formData.value === "" || Number(formData.value) < 0) return toast.error("Valid discount value is required");
    if (formData.value_type === "percentage" && Number(formData.value) > 100) return toast.error("Percentage cannot be greater than 100");
    
    const productIds = formData.target_type === "product" && formData.selected_product_ids.length > 0 ? formData.selected_product_ids : undefined;
    const categoryIds = formData.target_type === "category" && formData.selected_category_ids.length > 0 ? formData.selected_category_ids : undefined;
    const brandIds = formData.target_type === "brand" && formData.selected_brand_ids.length > 0 ? formData.selected_brand_ids : undefined;

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim() ? formData.code.trim().toUpperCase() : undefined,
      description: formData.description.trim() || undefined,
      target_type: formData.target_type,
      selected_product_ids: productIds,
      selected_category_ids: categoryIds,
      selected_brand_ids: brandIds,
      price_min: formData.target_type === "price_range" ? Number(formData.price_min) : undefined,
      price_max: formData.target_type === "price_range" ? Number(formData.price_max) : undefined,
      value_type: formData.value_type,
      value: Number(formData.value),
      start_at: dateInputToISO(formData.start_at) || new Date().toISOString(),
      end_at: dateInputToISO(formData.end_at) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: formData.status,
      applyTo: formData.target_type === "all_products" ? "all" : formData.target_type === "product" ? "specific_products" : formData.target_type === "category" ? "specific_categories" : formData.target_type,
      type: formData.value_type === "fixed_amount" ? "fixed" : formData.value_type,
      isActive: formData.status === "active",
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined || payload[key] === null || payload[key] === "") {
        delete payload[key];
      }
    });

    console.log("Final Payload:", payload);
    mutation.mutate({ id: editingDiscount?._id || editingDiscount?.id, data: payload });
  };

  const handleDelete = (discount) => setDeleteTarget({ discounts: [discount] });
  const handleBulkDelete = () => setDeleteTarget({ discounts: discounts.filter((d) => selectedIds.includes(d._id || d.id)) });
  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.discounts.map((d) => d._id || d.id), { onSettled: () => setDeleteTarget(null) });
  };

  const getSelectedItems = (type) => {
    let items = [], selectedIds = [];
    if (type === "product") { items = products; selectedIds = formData.selected_product_ids; }
    if (type === "category") { items = categories; selectedIds = formData.selected_category_ids; }
    if (type === "brand") { items = brands; selectedIds = formData.selected_brand_ids; }
    return items.filter((item) => selectedIds.includes(getItemId(item)));
  };

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  const renderPageNumbers = () => {
    const pages = []; const maxVisible = 5;
    if (totalPages <= maxVisible) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      if (currentPage <= 3) pages.push(1, 2, 3, 4, "...", totalPages);
      else if (currentPage >= totalPages - 2) pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      else pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5 p-4 md:p-0">
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Discount Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Create, manage and control your promotional discounts.</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setViewMode("list")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}><ListIcon /></button>
              <button type="button" onClick={() => setViewMode("grid")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}><GridIcon /></button>
            </div>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              <PlusIcon /> Add Discount
            </button>
          </div>
        </div>

        {/* ===== Stat Cards ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Total Discounts</p>
            <p className="text-[20px] font-bold mt-1">{stats.total}</p>
          </div>
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Active</p>
            <p className="text-[20px] font-bold mt-1 text-emerald-500">{stats.active}</p>
          </div>
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Inactive</p>
            <p className="text-[20px] font-bold mt-1 text-amber-500">{stats.inactive}</p>
          </div>
          <div className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Expired</p>
            <p className="text-[20px] font-bold mt-1 text-red-500">{stats.expired}</p>
          </div>
        </div>

        {/* ===== Search & Filters ===== */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
          <input type="text" placeholder="Search discount name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="appearance-none h-9 w-full sm:w-[160px] pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="expired">Expired</option>
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDownIcon className="w-3.5 h-3.5" /></span>
          </div>
          <div className="relative">
            <select value={filterTarget} onChange={(e) => setFilterTarget(e.target.value)} className="appearance-none h-9 w-full sm:w-[160px] pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle}>
              <option value="all">All Targets</option>
              <option value="all_products">All Products</option>
              <option value="product">Specific Products</option>
              <option value="category">Categories</option>
              <option value="brand">Brands</option>
              <option value="price_range">Price Range</option>
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDownIcon className="w-3.5 h-3.5" /></span>
          </div>
        </div>

        {/* ===== Bulk Selection Bar ===== */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-lg px-4 h-11" style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)" }}>
            <p className="text-sm font-semibold" style={{ color: "#34d399" }}>{selectedIds.length} selected</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedIds([])} className="h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Clear</button>
              <button onClick={handleBulkDelete} className="h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 transition hover:opacity-90" style={{ backgroundColor: "var(--danger)" }}><TrashIcon className="w-3.5 h-3.5" /> Delete Selected</button>
            </div>
          </div>
        )}

        {/* ===== Content ===== */}
        {isLoading ? (
          <div className="rounded-lg py-14 flex items-center justify-center gap-2" style={cardStyle}>
            <Spinner /><span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading discounts...</span>
          </div>
        ) : paginatedDiscounts.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{search || filterStatus !== "all" ? "No discounts match your filters" : "No discounts yet"}</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox" checked={paginatedDiscounts.length > 0 && paginatedDiscounts.every((d) => selectedIds.includes(d._id || d.id))} onChange={(e) => setSelectedIds(e.target.checked ? paginatedDiscounts.map((d) => d._id || d.id) : [])} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} />
                    </th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Discount</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Applies To</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Value</th>
                    <th className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Status</th>
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDiscounts.map((discount, index) => {
                    const id = discount._id || discount.id;
                    const isSelected = selectedIds.includes(id);
                    const status = getDiscountStatus(discount);
                    return (
                      <tr key={id} className="transition" style={{ borderBottom: index < paginatedDiscounts.length - 1 ? "1px solid var(--border-color)" : "none", backgroundColor: isSelected ? "var(--bg-tertiary)" : "var(--bg-card)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSelected ? "var(--bg-tertiary)" : "var(--bg-card)")}>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}><TagIcon /></div>
                            <div className="min-w-0">
                              <span className="font-medium text-[13px] truncate block max-w-[180px]">{discount.name || "Untitled"}</span>
                              {discount.code && <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{discount.code}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>{formatTarget(discount.target_type || discount.applyTo)}</td>
                        <td className="px-4 py-2.5 text-[13px] font-bold text-emerald-500">{formatValue(discount)}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={status} /></td>
                        <td className="px-4 py-2.5 whitespace-nowrap w-1">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            <button onClick={() => handleView(discount)} className="flex-shrink-0 min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-emerald-500/10 flex items-center justify-center" style={{ color: "#34d399" }} title="View Details">
                              <EyeIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => openEdit(discount)} className="flex-shrink-0 min-w-[34px] min-h-[34px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "var(--text-secondary)" }} title="Edit">
                              <EditIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(discount)} className="flex-shrink-0 min-w-[34px] min-h-[34px] p-2 rounded-md transition text-red-500 hover:bg-red-500/10 flex items-center justify-center" title="Delete">
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {paginatedDiscounts.map((discount) => {
              const id = discount._id || discount.id;
              const status = getDiscountStatus(discount);
              return (
                <div key={id} className="rounded-lg p-4 flex flex-col gap-3 transition hover:-translate-y-0.5 cursor-pointer" style={cardStyle}>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}><TagIcon className="w-5 h-5" /></div>
                    <StatusBadge status={status} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[13px] truncate">{discount.name || "Untitled"}</p>
                    {discount.code && <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{discount.code}</p>}
                  </div>
                  <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Value</p>
                      <p className="text-sm font-bold text-emerald-500 mt-0.5">{formatValue(discount)}</p>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleView(discount)} className="w-8 h-8 rounded-md flex items-center justify-center transition hover:bg-emerald-500/10" style={{ color: "#34d399" }} title="View">
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEdit(discount)} className="w-8 h-8 rounded-md flex items-center justify-center transition hover:bg-white/5" style={{ color: "var(--text-secondary)" }} title="Edit">
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(discount)} className="w-8 h-8 rounded-md flex items-center justify-center transition text-red-500 hover:bg-red-500/10" title="Delete">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===== Pagination ===== */}
        {totalDiscounts > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalDiscounts)} of {totalDiscounts} discounts</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronLeftIcon /></button>
              <div className="flex items-center gap-1">
                {renderPageNumbers().map((page, index) => (
                  <React.Fragment key={index}>
                    {page === "..." ? <span className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>...</span> : (
                      <button onClick={() => setCurrentPage(page)} className="h-8 min-w-[32px] px-2 rounded-md text-[13px] font-medium transition hover:opacity-80" style={{ backgroundColor: currentPage === page ? "var(--accent)" : "var(--bg-tertiary)", color: currentPage === page ? "var(--accent-text)" : "var(--text-primary)", border: `1px solid ${currentPage === page ? "var(--accent)" : "var(--border-color)"}` }}>{page}</button>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronRightIcon /></button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Add/Edit Modal ===== */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl rounded-xl overflow-hidden" style={cardStyle}>
            <div className="px-5 py-4 flex items-center justify-between rounded-t-xl" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              <h3 className="text-base font-semibold">{editingDiscount ? "Edit Discount" : "Add New Discount"}</h3>
              <button onClick={() => { setShowModal(false); resetForm(); }} disabled={mutation.isPending} className="p-1 rounded transition disabled:opacity-50 hover:opacity-70" style={{ color: "var(--text-muted)" }}><CloseIcon /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Discount Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required disabled={mutation.isPending} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50" style={inputStyle} placeholder="Summer Sale" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Discount Code</label>
                  <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} disabled={mutation.isPending} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50 uppercase" style={inputStyle} placeholder="SUMMER20" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows="2" disabled={mutation.isPending} className="px-3 py-2 rounded-md text-sm w-full outline-none disabled:opacity-50 resize-none" style={inputStyle} placeholder="Describe this discount..." />
              </div>

              {/* Target */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Applies To *</label>
                <select value={formData.target_type} onChange={(e) => setFormData({ ...formData, target_type: e.target.value })} disabled={mutation.isPending} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50 cursor-pointer" style={inputStyle}>
                  <option value="all_products">All Products</option>
                  <option value="product">Specific Products</option>
                  <option value="category">Specific Categories</option>
                  <option value="brand">Specific Brands</option>
                  <option value="price_range">Price Range</option>
                </select>
              </div>

              {/* Dynamic Target Selection */}
              {formData.target_type === "product" && (
                <SelectionField label="Products" items={getSelectedItems("product")} onClick={() => setSelector({ open: true, type: "product" })} onRemove={(id) => setFormData({ ...formData, selected_product_ids: formData.selected_product_ids.filter((x) => x !== id) })} inputStyle={inputStyle} />
              )}
              {formData.target_type === "category" && (
                <SelectionField label="Categories" items={getSelectedItems("category")} onClick={() => setSelector({ open: true, type: "category" })} onRemove={(id) => setFormData({ ...formData, selected_category_ids: formData.selected_category_ids.filter((x) => x !== id) })} inputStyle={inputStyle} />
              )}
              {formData.target_type === "brand" && (
                <SelectionField label="Brands" items={getSelectedItems("brand")} onClick={() => setSelector({ open: true, type: "brand" })} onRemove={(id) => setFormData({ ...formData, selected_brand_ids: formData.selected_brand_ids.filter((x) => x !== id) })} inputStyle={inputStyle} />
              )}
              {formData.target_type === "price_range" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Min Price *</label>
                    <input type="number" value={formData.price_min} onChange={(e) => setFormData({ ...formData, price_min: e.target.value })} required className="h-9 px-3 rounded-md text-sm w-full outline-none" style={inputStyle} placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Max Price *</label>
                    <input type="number" value={formData.price_max} onChange={(e) => setFormData({ ...formData, price_max: e.target.value })} required className="h-9 px-3 rounded-md text-sm w-full outline-none" style={inputStyle} placeholder="9999" />
                  </div>
                </div>
              )}

              {/* Value */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Discount Method</label>
                  <select value={formData.value_type} onChange={(e) => setFormData({ ...formData, value_type: e.target.value })} disabled={mutation.isPending} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50 cursor-pointer" style={inputStyle}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Fixed Amount</option>
                    <option value="fixed_price">Fixed Price</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Discount Value *</label>
                  <input type="number" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} required min="0" step="0.01" disabled={mutation.isPending} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50" style={inputStyle} placeholder={formData.value_type === "percentage" ? "20" : "500"} />
                </div>
              </div>

              {/* Schedule */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Start Date</label>
                  <input type="datetime-local" value={formData.start_at} onChange={(e) => setFormData({ ...formData, start_at: e.target.value })} disabled={mutation.isPending} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50 [color-scheme:dark]" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>End Date</label>
                  <input type="datetime-local" value={formData.end_at} onChange={(e) => setFormData({ ...formData, end_at: e.target.value })} disabled={mutation.isPending} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50 [color-scheme:dark]" style={inputStyle} />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Status</label>
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} disabled={mutation.isPending} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50 cursor-pointer" style={inputStyle}>
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <div className="flex gap-2 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button type="button" onClick={() => { setShowModal(false); resetForm(); }} disabled={mutation.isPending} className="flex-1 h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button type="submit" disabled={mutation.isPending} className="flex-1 h-9 rounded-md text-sm font-semibold transition disabled:opacity-50 hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  {mutation.isPending ? "Saving..." : editingDiscount ? "Update" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Selection Modal (Products/Categories/Brands) ===== */}
      {selector.open && (
        <SelectionModal
          type={selector.type}
          items={selector.type === "product" ? products : selector.type === "category" ? categories : brands}
          selectedIds={selector.type === "product" ? formData.selected_product_ids : selector.type === "category" ? formData.selected_category_ids : formData.selected_brand_ids}
          onClose={() => setSelector({ open: false, type: null })}
          onApply={(ids) => {
            if (selector.type === "product") setFormData({ ...formData, selected_product_ids: ids });
            if (selector.type === "category") setFormData({ ...formData, selected_category_ids: ids });
            if (selector.type === "brand") setFormData({ ...formData, selected_brand_ids: ids });
            setSelector({ open: false, type: null });
          }}
          cardStyle={cardStyle}
          inputStyle={inputStyle}
        />
      )}

      {/* ===== Delete Confirmation Modal ===== */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-xl p-5" style={{ ...cardStyle, animation: "modalScaleIn 0.2s ease-out" }}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
                <svg className="w-5 h-5" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold">{deleteTarget.discounts.length === 1 ? `Delete "${deleteTarget.discounts[0].name}"?` : `Delete ${deleteTarget.discounts.length} discounts?`}</h3>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setDeleteTarget(null)} className="flex-1 h-9 rounded-md text-sm font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleteMutation.isPending} className="flex-1 h-9 rounded-md text-sm font-semibold text-white transition disabled:opacity-60 hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--danger)" }}>
                {deleteMutation.isPending ? <><Spinner className="w-3.5 h-3.5" /> Deleting...</> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= Sub-Components ================= */

function SelectionField({ label, items, onClick, onRemove, inputStyle }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
      <div className="rounded-md p-3 flex flex-wrap gap-2 items-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
        {items.length === 0 ? (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>None selected</span>
        ) : (
          items.slice(0, 5).map((item) => (
            <span key={getItemId(item)} className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[11px]" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              {getItemName(item, label.toLowerCase().slice(0, -1))}
              <button type="button" onClick={() => onRemove(getItemId(item))} className="text-red-500 hover:text-red-400"><CloseIcon className="w-3 h-3" /></button>
            </span>
          ))
        )}
        <button type="button" onClick={onClick} className="h-7 px-2.5 rounded text-[11px] font-medium flex items-center gap-1 transition hover:opacity-80" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
          <PlusIcon className="w-3 h-3" /> {items.length > 0 ? "Manage" : "Select"}
        </button>
        {items.length > 5 && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>+{items.length - 5} more</span>}
      </div>
    </div>
  );
}

function SelectionModal({ type, items, selectedIds, onClose, onApply, cardStyle, inputStyle }) {
  const [search, setSearch] = useState("");
  const [draftIds, setDraftIds] = useState(selectedIds.map(String));

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const term = search.toLowerCase();
    return items.filter((item) => getItemName(item, type).toLowerCase().includes(term));
  }, [items, search, type]);

  const toggle = (id) => setDraftIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="w-full max-w-lg rounded-xl overflow-hidden" style={cardStyle}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <h3 className="text-base font-semibold">Select {type === "product" ? "Products" : type === "category" ? "Categories" : "Brands"}</h3>
          <button onClick={onClose} className="p-1 rounded hover:opacity-70" style={{ color: "var(--text-muted)" }}><CloseIcon /></button>
        </div>
        <div className="p-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon className="w-4 h-4" /></span>
            <input autoFocus type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-9 pl-9 pr-3 rounded-md text-sm w-full outline-none" style={inputStyle} />
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto px-4 pb-4 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-center text-xs py-4" style={{ color: "var(--text-muted)" }}>No items found</p>
          ) : (
            filtered.map((item) => {
              const id = getItemId(item);
              const isSelected = draftIds.includes(id);
              return (
                <button key={id} type="button" onClick={() => toggle(id)} className="w-full px-3 py-2 rounded-md flex items-center gap-3 text-left transition" style={{ backgroundColor: isSelected ? "rgba(16, 185, 129, 0.1)" : "transparent" }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-600"}`}>
                    {isSelected && <CheckIcon className="w-3 h-3" />}
                  </span>
                  <Avatar name={getItemName(item, type)} size="w-7 h-7" />
                  <span className="text-[13px] truncate flex-1" style={{ color: isSelected ? "#34d399" : "var(--text-primary)", fontWeight: isSelected ? 600 : 400 }}>{getItemName(item, type)}</span>
                </button>
              );
            })
          )}
        </div>
        <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderTop: "1px solid var(--border-color)" }}>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>{draftIds.length} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
            <button onClick={() => onApply(draftIds)} className="h-8 px-4 rounded-md text-xs font-semibold text-white transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>Apply</button>
          </div>
        </div>
      </div>
    </div>
  );
}