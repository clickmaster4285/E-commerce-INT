"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productApi } from "../../../apis/admin/productApi";
import { discountApi } from "../../../apis/admin/discountApi";
import { categoryApi } from "../../../apis/admin/categoryApi";
import { brandApi } from "../../../apis/admin/brandApi";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import useDiscountSocketSync from "../../../hooks/useDiscountSocketSync";

/* ================= Icons ================= */
const PlusIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const SearchIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const ListIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const GridIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>);
const EditIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>);
const TrashIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>);
const EyeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);
const CloseIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>);
const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
const TagIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>);
const CheckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>);
const BoxIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>);
const FolderIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>);
const AwardIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>);
const GlobeIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const XIcon = ({ className = "w-3 h-3" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);

/* ================= Helpers ================= */
const getInitials = (name) => { if (!name) return "??"; return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase(); };

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
const getItemName = (item) => item?.name || item?.title || item?.categoryName || item?.brandName || "Unnamed";

// ✅ CURRENCY FORMATTER
const formatCurrency = (amount) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amount || 0);

const formatTarget = (value) => {
  const map = { all: "All Products", all_products: "All Products", product: "Specific Products", specific_products: "Specific Products", category: "Categories", specific_categories: "Categories", brand: "Brands", price_range: "Price Range" };
  return map[value] || String(value || "All Products").replaceAll("_", " ");
};

const formatValue = (discount) => {
  const type = discount?.value_type || discount?.valueType || discount?.type || "percentage";
  if (type === "percentage") return `${discount?.value ?? 0}%`;
  if (type === "fixed_amount" || type === "fixed") return `-Rs.${discount?.value ?? 0}`;
  if (type === "fixed_price") return `Fixed Rs.${discount?.value ?? 0}`;
  return `-Rs.${discount?.value ?? 0}`;
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

const StatusBadge = ({ status }) => {
  const isActive = status === "active" || status === "scheduled";
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide whitespace-nowrap" 
      style={isActive ? { backgroundColor: "rgba(16,185,129,0.1)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" } : 
             status === "expired" ? { backgroundColor: "rgba(245,158,11,0.1)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.3)" } : 
             { backgroundColor: "rgba(239,68,68,0.1)", color: "#f87171", border: "1px solid rgba(239,68,68,0.3)" }}>
      {status === "expired" ? "Expired" : status === "active" || status === "scheduled" ? "Active" : "Inactive"}
    </span>
  );
};

/* ================= Main Component ================= */
export default function DiscountsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { markSelfAction } = useDiscountSocketSync();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTarget, setFilterTarget] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeFormType, setActiveFormType] = useState(null); 
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const typeMenuRef = useRef(null);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const initialForm = {
    name: "", code: "", description: "",
    selected_ids: [],
    value_type: "percentage", value: "", max_discount: "",
    min_order_amount: "", min_quantity: "",
    usage_limit: "", usage_per_customer: "",
    priority: "1", is_stackable: false,
    start_at: "", end_at: "", status: "active",
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
      markSelfAction(id ? "update" : "create");
      return id ? discountApi.update(id, data) : discountApi.create(data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      toast.success(variables.id ? "Discount updated successfully" : "Discount added successfully");
      resetForm();
      setActiveFormType(null);
    },
    onError: (error) => {
      const errorMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Failed to save discount";
      toast.error(errorMsg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (ids) => {
      markSelfAction("delete");
      return Promise.all(ids.map((id) => discountApi.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      setSelectedIds([]);
      toast.success("Discount deleted successfully");
    },
    onError: (error) => {
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

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(event.target)) setIsTypeMenuOpen(false);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const stats = useMemo(() => {
    const total = discounts.length;
    const active = discounts.filter((d) => getDiscountStatus(d) === "active" || getDiscountStatus(d) === "scheduled").length;
    const inactive = discounts.filter((d) => getDiscountStatus(d) === "inactive" || getDiscountStatus(d) === "disabled" || getDiscountStatus(d) === "draft").length;
    const expired = discounts.filter((d) => getDiscountStatus(d) === "expired").length;
    return { total, active, inactive, expired };
  }, [discounts]);

  const resetForm = () => { setFormData({ ...initialForm, selected_ids: [] }); setEditingDiscount(null); };

  const openForm = (type) => { resetForm(); setIsTypeMenuOpen(false); setActiveFormType(type); };

  const handleView = (discount) => router.push(`/admin/discounts/${discount._id || discount.id}`);

  const openEdit = (discount) => {
    const rawTarget = discount?.target_type || discount?.applyTo || "all_products";
    let type = "all";
    if (rawTarget === "specific_products" || rawTarget === "product" || rawTarget === "specific_product") type = "product";
    else if (rawTarget === "specific_categories" || rawTarget === "category") type = "category";
    else if (rawTarget === "brand") type = "brand";

    let selected_ids = [];
    if (type === "product") selected_ids = (discount?.selected_product_ids || discount?.products?.map(getItemId) || []).map(String);
    else if (type === "category") selected_ids = (discount?.selected_category_ids || discount?.categories?.map(getItemId) || []).map(String);
    else if (type === "brand") selected_ids = (discount?.selected_brand_ids || discount?.brands?.map(getItemId) || []).map(String);

    setFormData({
      ...initialForm,
      name: discount?.name || "", code: discount?.code || "", description: discount?.description || "",
      selected_ids,
      value_type: discount?.value_type || (discount?.type === "fixed" ? "fixed_amount" : "percentage"),
      value: discount?.value ?? "", max_discount: discount?.maxDiscountAmount ?? "",
      min_order_amount: discount?.minOrderValue ?? "", min_quantity: discount?.minQuantity ?? "",
      usage_limit: discount?.usageLimit ?? "", usage_per_customer: discount?.perUserLimit ?? "",
      priority: discount?.priority ?? "1", is_stackable: discount?.isStackable ?? false,
      start_at: toDateInput(discount?.start_at || discount?.startDate),
      end_at: toDateInput(discount?.end_at || discount?.endDate),
      status: discount?.status || (discount?.isActive ? "active" : "draft"),
    });
    setEditingDiscount(discount);
    setActiveFormType(type);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.error("Discount name is required");
    if (formData.value === "" || Number(formData.value) < 0) return toast.error("Valid discount value is required");
    if (formData.value_type === "percentage" && Number(formData.value) > 100) return toast.error("Percentage cannot exceed 100");

    let target_type = "all_products";
    let applyTo = "all";
    let payloadExtras = {};

    if (activeFormType === "product") {
      target_type = "specific_products"; applyTo = "specific_products";
      if (formData.selected_ids.length === 0) return toast.error("Please select at least one product");
      payloadExtras.selected_product_ids = formData.selected_ids;
    } else if (activeFormType === "category") {
      target_type = "specific_categories"; applyTo = "specific_categories";
      if (formData.selected_ids.length === 0) return toast.error("Please select at least one category");
      payloadExtras.selected_category_ids = formData.selected_ids;
    } else if (activeFormType === "brand") {
      target_type = "brand"; applyTo = "brand";
      if (formData.selected_ids.length === 0) return toast.error("Please select at least one brand");
      payloadExtras.selected_brand_ids = formData.selected_ids;
    }

    const payload = {
      name: formData.name.trim(), code: formData.code.trim() ? formData.code.trim().toUpperCase() : undefined,
      description: formData.description.trim() || undefined, target_type, applyTo,
      value_type: formData.value_type, type: formData.value_type === "fixed_amount" ? "fixed" : formData.value_type,
      value: Number(formData.value),
      max_discount: formData.max_discount !== "" ? Number(formData.max_discount) : undefined,
      min_order_amount: formData.min_order_amount !== "" ? Number(formData.min_order_amount) : undefined,
      min_quantity: formData.min_quantity !== "" ? Number(formData.min_quantity) : undefined,
      usage_limit: formData.usage_limit !== "" ? Number(formData.usage_limit) : undefined,
      usage_per_customer: formData.usage_per_customer !== "" ? Number(formData.usage_per_customer) : undefined,
      priority: formData.priority !== "" ? Number(formData.priority) : undefined,
      is_stackable: formData.is_stackable,
      start_at: dateInputToISO(formData.start_at) || new Date().toISOString(),
      end_at: dateInputToISO(formData.end_at) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: formData.status, isActive: formData.status === "active", ...payloadExtras,
    };

    Object.keys(payload).forEach((key) => { if (payload[key] === undefined || payload[key] === null || payload[key] === "") delete payload[key]; });
    mutation.mutate({ id: editingDiscount?._id || editingDiscount?.id, data: payload });
  };

  const handleDelete = (discount) => setDeleteTarget({ discounts: [discount] });
  const handleBulkDelete = () => setDeleteTarget({ discounts: discounts.filter((d) => selectedIds.includes(d._id || d.id)) });
  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.discounts.map((d) => d._id || d.id), { onSettled: () => setDeleteTarget(null) });
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

  const discountTypes = [
    { key: "product", title: "Product Discount", desc: "Apply discount on specific products", icon: BoxIcon },
    { key: "category", title: "Category Discount", desc: "Apply discount on entire categories", icon: FolderIcon },
    { key: "brand", title: "Brand Discount", desc: "Apply discount on specific brands", icon: AwardIcon },
    { key: "all", title: "All Products Discount", desc: "Apply discount on all products", icon: GlobeIcon },
  ];

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5 p-4 md:p-0">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight">Discount Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Create and manage promotional discounts for your store.</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setViewMode("list")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title="List view"><ListIcon /></button>
              <button type="button" onClick={() => setViewMode("grid")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title="Grid view"><GridIcon /></button>
            </div>
            <div className="relative shrink-0" ref={typeMenuRef}>
              <button type="button" onClick={() => setIsTypeMenuOpen((open) => !open)} aria-expanded={isTypeMenuOpen} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] transition" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                <PlusIcon className="w-4 h-4" /> New Discount <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isTypeMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {isTypeMenuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl p-1.5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-lg)" }}>
                  {discountTypes.map((dt) => {
                    const Icon = dt.icon;
                    return (
                      <button key={dt.key} type="button" onClick={() => openForm(dt.key)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[var(--bg-tertiary)]">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}><Icon className="h-4 w-4" /></span>
                        <span className="min-w-0"><span className="block text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{dt.title}</span><span className="block truncate text-[10px]" style={{ color: "var(--text-muted)" }}>{dt.desc}</span></span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="rounded-lg p-4" style={cardStyle}><p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Total Discounts</p><p className="text-[20px] font-bold mt-1">{stats.total}</p></div>
          <div className="rounded-lg p-4" style={cardStyle}><p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Active</p><p className="text-[20px] font-bold mt-1 text-emerald-500">{stats.active}</p></div>
          <div className="rounded-lg p-4" style={cardStyle}><p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Inactive</p><p className="text-[20px] font-bold mt-1 text-amber-500">{stats.inactive}</p></div>
          <div className="rounded-lg p-4" style={cardStyle}><p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>Expired</p><p className="text-[20px] font-bold mt-1 text-red-500">{stats.expired}</p></div>
        </div>

        {/* Search & Filters */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
          <input type="text" placeholder="Search discount name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="appearance-none h-9 w-full sm:w-[160px] pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle}>
              <option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="expired">Expired</option>
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDownIcon className="w-3.5 h-3.5" /></span>
          </div>
          <div className="relative">
            <select value={filterTarget} onChange={(e) => setFilterTarget(e.target.value)} className="appearance-none h-9 w-full sm:w-[160px] pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-emerald-500/40" style={inputStyle}>
              <option value="all">All Targets</option><option value="all_products">All Products</option><option value="product">Specific Products</option><option value="category">Categories</option><option value="brand">Brands</option>
            </select>
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDownIcon className="w-3.5 h-3.5" /></span>
          </div>
        </div>

        {/* Bulk Selection Bar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-lg px-4 h-11" style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)" }}>
            <p className="text-sm font-semibold" style={{ color: "#34d399" }}>{selectedIds.length} selected</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedIds([])} className="h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Clear</button>
              <button onClick={handleBulkDelete} className="h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 transition hover:opacity-90" style={{ backgroundColor: "var(--danger)" }}><TrashIcon className="w-3.5 h-3.5" /> Delete Selected</button>
            </div>
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div className="rounded-lg py-14 flex items-center justify-center gap-2" style={cardStyle}><Spinner /><span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading discounts...</span></div>
        ) : paginatedDiscounts.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center gap-3" style={cardStyle}><p className="text-sm" style={{ color: "var(--text-muted)" }}>{search || filterStatus !== "all" ? "No discounts match your filters" : "No discounts yet. Create one above!"}</p></div>
        ) : viewMode === "list" ? (
          <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-4 py-3 w-10"><input type="checkbox" checked={paginatedDiscounts.length > 0 && paginatedDiscounts.every((d) => selectedIds.includes(d._id || d.id))} onChange={(e) => setSelectedIds(e.target.checked ? paginatedDiscounts.map((d) => d._id || d.id) : [])} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></th>
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
                      <tr key={id} onClick={() => handleView(discount)} className="transition cursor-pointer" style={{ borderBottom: index < paginatedDiscounts.length - 1 ? "1px solid var(--border-color)" : "none", backgroundColor: isSelected ? "var(--bg-tertiary)" : "var(--bg-card)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-tertiary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = isSelected ? "var(--bg-tertiary)" : "var(--bg-card)")}>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}><TagIcon /></div>
                            <div className="min-w-0"><span className="font-medium text-[13px] truncate block max-w-[180px]">{discount.name || "Untitled"}</span>{discount.code && <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>{discount.code}</span>}</div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-[13px]" style={{ color: "var(--text-secondary)" }}>{formatTarget(discount.target_type || discount.applyTo)}</td>
                        <td className="px-4 py-2.5 text-[13px] font-bold text-emerald-500">{formatValue(discount)}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={status} /></td>
                        <td className="px-4 py-2.5 whitespace-nowrap w-1">
                          <div className="flex items-center justify-end gap-1 sm:gap-2">
                            <button onClick={(e) => { e.stopPropagation(); handleView(discount); }} className="flex-shrink-0 min-w-[44px] min-h-[44px] p-2 rounded-md transition hover:bg-emerald-500/10 flex items-center justify-center" style={{ color: "#34d399" }} title="View Details"><EyeIcon className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); openEdit(discount); }} className="flex-shrink-0 min-w-[44px] min-h-[44px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "var(--text-secondary)" }} title="Edit"><EditIcon className="w-4 h-4" /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(discount); }} className="flex-shrink-0 min-w-[44px] min-h-[44px] p-2 rounded-md transition text-red-500 hover:bg-red-500/10 flex items-center justify-center" title="Delete"><TrashIcon className="w-4 h-4" /></button>
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
                <div key={id} onClick={() => handleView(discount)} className="rounded-lg p-4 flex flex-col gap-3 transition hover:-translate-y-0.5 cursor-pointer" style={cardStyle}>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}><TagIcon className="w-5 h-5" /></div>
                    <StatusBadge status={status} />
                  </div>
                  <div className="min-w-0"><p className="font-semibold text-[13px] truncate">{discount.name || "Untitled"}</p>{discount.code && <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{discount.code}</p>}</div>
                  <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
                    <div><p className="text-[10px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Value</p><p className="text-sm font-bold text-emerald-500 mt-0.5">{formatValue(discount)}</p></div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button onClick={(e) => { e.stopPropagation(); handleView(discount); }} className="w-8 h-8 rounded-md flex items-center justify-center transition hover:bg-emerald-500/10" style={{ color: "#34d399" }} title="View"><EyeIcon className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); openEdit(discount); }} className="w-8 h-8 rounded-md flex items-center justify-center transition hover:bg-white/5" style={{ color: "var(--text-secondary)" }} title="Edit"><EditIcon className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(discount); }} className="w-8 h-8 rounded-md flex items-center justify-center transition text-red-500 hover:bg-red-500/10" title="Delete"><TrashIcon className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalDiscounts > itemsPerPage && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Showing {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, totalDiscounts)} of {totalDiscounts} discounts</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronLeftIcon /></button>
              <span className="hidden sm:inline-flex items-center gap-1">
                {renderPageNumbers().map((page, index) => (
                  <React.Fragment key={index}>
                    {page === "..." ? <span className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>...</span> : (
                      <button onClick={() => setCurrentPage(page)} className="h-8 min-w-[32px] px-2 rounded-md text-[13px] font-medium transition hover:opacity-80" style={{ backgroundColor: currentPage === page ? "var(--accent)" : "var(--bg-tertiary)", color: currentPage === page ? "var(--accent-text)" : "var(--text-primary)", border: `1px solid ${currentPage === page ? "var(--accent)" : "var(--border-color)"}` }}>{page}</button>
                    )}
                  </React.Fragment>
                ))}
              </span>
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}><ChevronRightIcon /></button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Discount Modal */}
      {activeFormType && (
        <DiscountFormModal
          type={activeFormType}
          formData={formData}
          setFormData={setFormData}
          editingDiscount={editingDiscount}
          products={products}
          categories={categories}
          brands={brands}
          mutation={mutation}
          onClose={() => { setActiveFormType(null); resetForm(); }}
          onSubmit={handleSubmit}
          cardStyle={cardStyle}
          inputStyle={inputStyle}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-xl p-5" style={{ ...cardStyle }}>
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

/* ================= Discount Form Modal (WITH OUTSIDE CLICK CLOSE) ================= */
function DiscountFormModal({ type, formData, setFormData, editingDiscount, products, categories, brands, mutation, onClose, onSubmit, cardStyle, inputStyle }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);
  
  // ✅ Ref for the selection container to detect outside clicks
  const selectionContainerRef = useRef(null);

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectionContainerRef.current && !selectionContainerRef.current.contains(event.target)) {
        setIsSelectionOpen(false);
      }
    };

    if (isSelectionOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isSelectionOpen]);

  const config = {
    product: { title: editingDiscount ? "Edit Product Discount" : "Create Product Discount", subtitle: "Apply discount on specific products", items: products, placeholder: "Search products...", emptyMsg: "No products found", selectedLabel: "Selected Products", color: "var(--accent)", border: "var(--border-color)", bg: "var(--accent-soft)" },
    category: { title: editingDiscount ? "Edit Category Discount" : "Create Category Discount", subtitle: "Apply discount on entire categories", items: categories, placeholder: "Search categories...", emptyMsg: "No categories found", selectedLabel: "Selected Categories", color: "var(--accent)", border: "var(--border-color)", bg: "var(--accent-soft)" },
    brand: { title: editingDiscount ? "Edit Brand Discount" : "Create Brand Discount", subtitle: "Apply discount on specific brands", items: brands, placeholder: "Search brands...", emptyMsg: "No brands found", selectedLabel: "Selected Brands", color: "var(--accent)", border: "var(--border-color)", bg: "var(--accent-soft)" },
    all: { title: editingDiscount ? "Edit All Products Discount" : "Create All Products Discount", subtitle: "This discount will apply to all products in your store", items: [], placeholder: "", emptyMsg: "", selectedLabel: "", color: "var(--accent)", border: "var(--border-color)", bg: "var(--accent-soft)" },
  };

  const current = config[type];
  const needsSelection = type !== "all";

  // ✅ LOGIC: Calculate Total Value of Selected Items (For Products)
  const selectedItemsDetails = useMemo(() => {
    if (type !== 'product') return [];
    return current.items.filter((item) => formData.selected_ids.includes(getItemId(item)));
  }, [current.items, formData.selected_ids, type]);

  const totalSelectedValue = useMemo(() => {
    if (type !== 'product') return 0;
    return selectedItemsDetails.reduce((sum, item) => {
      const directPrice = Number(item.price || 0);
      const variantPrice = item.variants?.[0]?.selling_price ? Number(item.variants[0].selling_price) : 0;
      const finalPrice = directPrice > 0 ? directPrice : variantPrice;
      return sum + finalPrice;
    }, 0);
  }, [selectedItemsDetails, type]);

  const filteredItems = useMemo(() => {
    if (!needsSelection) return [];
    if (!searchQuery.trim()) return current.items;
    const term = searchQuery.toLowerCase();
    return current.items.filter((item) => getItemName(item).toLowerCase().includes(term));
  }, [current.items, searchQuery, needsSelection]);

  const toggleItem = (id) => {
    const strId = String(id);
    setFormData({ ...formData, selected_ids: formData.selected_ids.includes(strId) ? formData.selected_ids.filter((x) => x !== strId) : [...formData.selected_ids, strId] });
  };

  const removeItem = (id) => { setFormData({ ...formData, selected_ids: formData.selected_ids.filter((x) => x !== String(id)) }); };

  const selectedItems = needsSelection ? current.items.filter((item) => formData.selected_ids.includes(getItemId(item))) : [];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl shadow-2xl" style={{ ...cardStyle }}>
        
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
          <div>
            <h3 className="text-lg font-bold tracking-tight">{current.title}</h3>
            <p className="text-xs mt-1 font-medium" style={{ color: "var(--text-muted)" }}>{current.subtitle}</p>
          </div>
          <button onClick={onClose} disabled={mutation.isPending} className="p-2 rounded-full hover:bg-red-500/10 hover:text-red-500 transition-colors" style={{ color: "var(--text-muted)" }}><CloseIcon className="w-5 h-5" /></button>
        </div>

        {/* Form Body */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="space-y-6 p-6">

            {/* Basic Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "var(--accent)" }}></div>
                <h4 className="text-sm font-bold uppercase tracking-wide">Basic Information</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>Discount Name <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required disabled={mutation.isPending} className="h-10 px-3 rounded-md text-sm w-full outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle} placeholder="Summer Sale 2026" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>Coupon Code</label>
                  <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} disabled={mutation.isPending} className="h-10 px-3 rounded-md text-sm w-full outline-none uppercase font-mono focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle} placeholder="SUMMER20" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows="2" disabled={mutation.isPending} className="px-3 py-2 rounded-md text-sm w-full outline-none resize-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle} placeholder="Describe this discount..." />
              </div>
            </div>

            {/* Selection Section (Accordion Style) - WITH REF FOR OUTSIDE CLICK */}
            {needsSelection && (
              <div className="space-y-4" ref={selectionContainerRef}>
                 <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "var(--accent)" }}></div>
                    <h4 className="text-sm font-bold uppercase tracking-wide">Target Selection</h4>
                  </div>
                  {/* ✅ PRICE SUMMARY BADGE FOR PRODUCTS */}
                  {type === 'product' && formData.selected_ids.length > 0 && (
                     <div className="px-3 py-1 rounded-full text-xs font-bold border" 
                          style={{ backgroundColor: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.2)", color: "#34d399" }}>
                        Total Value: {formatCurrency(totalSelectedValue)}
                     </div>
                  )}
                </div>

                <div className="rounded-lg overflow-hidden border" style={{ borderColor: "var(--border-color)" }}>
                  <button type="button" onClick={() => setIsSelectionOpen(!isSelectionOpen)} aria-expanded={isSelectionOpen} className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--bg-tertiary)]" style={{ backgroundColor: isSelectionOpen ? "var(--bg-tertiary)" : "transparent" }}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition-colors ${formData.selected_ids.length > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>{formData.selected_ids.length}</div>
                      <div>
                        <p className="text-sm font-semibold">Select {type === "product" ? "Products" : type === "category" ? "Categories" : "Brands"}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{formData.selected_ids.length === 0 ? `No ${type}s selected yet` : `${formData.selected_ids.length} ${type}s selected`}</p>
                      </div>
                    </div>
                    <ChevronDownIcon className={`w-5 h-5 transition-transform duration-200 ${isSelectionOpen ? 'rotate-180' : ''}`} style={{ color: "var(--text-muted)" }} />
                  </button>

                  {isSelectionOpen && (
                    <div className="border-t" style={{ borderColor: "var(--border-color)" }}>
                      <div className="p-3 border-b" style={{ borderColor: "var(--border-color)" }}>
                        <div className="relative">
                          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--text-muted)" }} />
                          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={current.placeholder} className="h-9 pl-9 pr-3 rounded-md text-sm w-full outline-none focus:ring-1 focus:ring-[var(--accent)]" style={inputStyle} />
                        </div>
                      </div>

                      {selectedItems.length > 0 && (
                        <div className="px-3 py-2 flex flex-wrap gap-2 bg-[var(--bg-tertiary)]/50 border-b" style={{ borderColor: "var(--border-color)" }}>
                          {selectedItems.map((item) => {
                            const id = getItemId(item);
                            const directPrice = Number(item.price || 0);
                            const variantPrice = item.variants?.[0]?.selling_price ? Number(item.variants[0].selling_price) : 0;
                            const price = directPrice > 0 ? directPrice : variantPrice;
                            
                            return (
                              <span key={id} className="inline-flex items-center gap-2 pl-2 pr-1 py-1 rounded-md text-xs font-medium border" style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)", color: "var(--text-primary)" }}>
                                <span className="max-w-[100px] truncate">{getItemName(item)}</span>
                                {type === 'product' && (
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{formatCurrency(price)}</span>
                                )}
                                <button type="button" onClick={() => removeItem(id)} className="w-4 h-4 rounded flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"><XIcon className="w-3 h-3" /></button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      <div className="max-h-[200px] overflow-y-auto p-1">
                        {filteredItems.length === 0 ? (
                          <div className="py-6 text-center"><p className="text-xs" style={{ color: "var(--text-muted)" }}>{current.emptyMsg}</p></div>
                        ) : (
                          filteredItems.map((item) => {
                            const id = getItemId(item);
                            const isSelected = formData.selected_ids.includes(id);
                            const directPrice = Number(item.price || 0);
                            const variantPrice = item.variants?.[0]?.selling_price ? Number(item.variants[0].selling_price) : 0;
                            const price = directPrice > 0 ? directPrice : variantPrice;

                            return (
                              <button key={id} type="button" onClick={() => toggleItem(id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-all mb-0.5 ${isSelected ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--bg-tertiary)]'}`}>
                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-[var(--accent)] border-[var(--accent)]' : 'border-slate-400'}`}>
                                  {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm truncate ${isSelected ? 'font-semibold' : ''}`} style={{ color: isSelected ? "var(--accent)" : "var(--text-primary)" }}>{getItemName(item)}</p>
                                  {type === 'product' && <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{formatCurrency(price)}</p>}
                                </div>
                                <div className="w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>{getInitials(getItemName(item))}</div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Value Section */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "var(--accent)" }}></div>
                <h4 className="text-sm font-bold uppercase tracking-wide">Discount Value</h4>
              </div>
              <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>Discount Type</label>
                    <div className="relative">
                      <select value={formData.value_type} onChange={(e) => setFormData({ ...formData, value_type: e.target.value })} disabled={mutation.isPending} className="appearance-none h-10 px-3 pr-8 rounded-md text-sm w-full outline-none cursor-pointer focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle}>
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed_amount">Fixed Amount</option>
                        <option value="fixed_price">Fixed Price</option>
                      </select>
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDownIcon className="w-3.5 h-3.5" /></span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>Value *</label>
                    <div className="relative">
                      <input type="number" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} required min="0" step="0.01" disabled={mutation.isPending} className="h-10 pl-3 pr-10 rounded-md text-sm w-full outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle} placeholder={formData.value_type === "percentage" ? "20" : "500"} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{formData.value_type === "percentage" ? "%" : "Rs."}</span>
                    </div>
                  </div>
                </div>
                {formData.value_type === "percentage" && (
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>Max Discount Cap (Rs.)</label>
                    <input type="number" value={formData.max_discount} onChange={(e) => setFormData({ ...formData, max_discount: e.target.value })} min="0" disabled={mutation.isPending} className="h-10 px-3 rounded-md text-sm w-full outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle} placeholder="e.g. 1000" />
                  </div>
                )}
              </div>
            </div>

            {/* Conditions */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "var(--accent)" }}></div>
                <h4 className="text-sm font-bold uppercase tracking-wide">Conditions & Limits</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>Min Order Amount (Rs.)</label>
                  <input type="number" value={formData.min_order_amount} onChange={(e) => setFormData({ ...formData, min_order_amount: e.target.value })} min="0" disabled={mutation.isPending} className="h-10 px-3 rounded-md text-sm w-full outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>Min Quantity</label>
                  <input type="number" value={formData.min_quantity} onChange={(e) => setFormData({ ...formData, min_quantity: e.target.value })} min="0" disabled={mutation.isPending} className="h-10 px-3 rounded-md text-sm w-full outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>Usage Limit (Total)</label>
                  <input type="number" value={formData.usage_limit} onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })} min="0" disabled={mutation.isPending} className="h-10 px-3 rounded-md text-sm w-full outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle} placeholder="Unlimited" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>Per User Limit</label>
                  <input type="number" value={formData.usage_per_customer} onChange={(e) => setFormData({ ...formData, usage_per_customer: e.target.value })} min="0" disabled={mutation.isPending} className="h-10 px-3 rounded-md text-sm w-full outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle} placeholder="1" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>Priority</label>
                  <input type="number" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} min="0" disabled={mutation.isPending} className="h-10 px-3 rounded-md text-sm w-full outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle} placeholder="1" />
                </div>
                <div className="flex items-center gap-2 h-10 px-3 rounded-md cursor-pointer transition-colors hover:bg-[var(--bg-tertiary)]" style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                  <input type="checkbox" checked={formData.is_stackable} onChange={(e) => setFormData({ ...formData, is_stackable: e.target.checked })} disabled={mutation.isPending} className="w-4 h-4 mr-3 accent-[var(--accent)]" />
                  <span className="text-sm font-medium">Allow stacking with other discounts</span>
                </div>
              </div>
            </div>

            {/* Schedule & Status */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-4 rounded-full" style={{ backgroundColor: "var(--accent)" }}></div>
                <h4 className="text-sm font-bold uppercase tracking-wide">Schedule & Status</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>Start Date</label>
                  <input type="datetime-local" value={formData.start_at} onChange={(e) => setFormData({ ...formData, start_at: e.target.value })} disabled={mutation.isPending} className="h-10 px-3 rounded-md text-sm w-full outline-none [color-scheme:dark] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>End Date</label>
                  <input type="datetime-local" value={formData.end_at} onChange={(e) => setFormData({ ...formData, end_at: e.target.value })} disabled={mutation.isPending} className="h-10 px-3 rounded-md text-sm w-full outline-none [color-scheme:dark] focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 ml-1" style={{ color: "var(--text-secondary)" }}>Status</label>
                <div className="relative">
                  <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} disabled={mutation.isPending} className="appearance-none h-10 px-3 pr-8 rounded-md text-sm w-full outline-none cursor-pointer focus:ring-2 focus:ring-[var(--accent)]/20 transition-all" style={inputStyle}>
                    <option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="active">Active</option><option value="disabled">Disabled</option>
                  </select>
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDownIcon className="w-3.5 h-3.5" /></span>
                </div>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 py-4 flex items-center justify-end gap-3 shrink-0" style={{ borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
            <button type="button" onClick={onClose} disabled={mutation.isPending} className="h-10 px-5 rounded-md text-sm font-semibold transition-colors hover:bg-slate-200 dark:hover:bg-slate-700" style={{ backgroundColor: "transparent", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="h-10 px-6 rounded-md text-sm font-bold flex items-center gap-2 transition-all hover:brightness-110 active:scale-95" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              {mutation.isPending ? <><Spinner className="w-4 h-4" /> Saving...</> : editingDiscount ? "Update Discount" : "Create Discount"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}