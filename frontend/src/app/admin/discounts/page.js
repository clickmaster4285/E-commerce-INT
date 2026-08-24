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
const BoxIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);
const FolderIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);
const AwardIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
  </svg>
);
const GlobeIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const XIcon = ({ className = "w-3 h-3" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
const getItemName = (item) => item?.name || item?.title || item?.categoryName || item?.brandName || "Unnamed";

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
  const { markSelfAction } = useDiscountSocketSync();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterTarget, setFilterTarget] = useState("all");
  const [viewMode, setViewMode] = useState("list");
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeFormType, setActiveFormType] = useState(null); // 'product' | 'category' | 'brand' | 'all' | null
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const typeMenuRef = useRef(null);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const initialForm = {
    name: "", code: "", description: "",
    selected_ids: [],
    value_type: "percentage", value: "",
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
      if (typeMenuRef.current && !typeMenuRef.current.contains(event.target)) {
        setIsTypeMenuOpen(false);
      }
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

  const resetForm = () => {
    setFormData({ ...initialForm, selected_ids: [] });
    setEditingDiscount(null);
  };

  const openForm = (type) => {
    resetForm();
    setIsTypeMenuOpen(false);
    setActiveFormType(type);
  };

  const handleView = (discount) => {
    router.push(`/admin/discounts/${discount._id || discount.id}`);
  };

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
      name: discount?.name || "",
      code: discount?.code || "",
      description: discount?.description || "",
      selected_ids,
      value_type: discount?.value_type || (discount?.type === "fixed" ? "fixed_amount" : "percentage"),
      value: discount?.value ?? "",
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
      target_type = "specific_products";
      applyTo = "specific_products";
      if (formData.selected_ids.length === 0) return toast.error("Please select at least one product");
      payloadExtras.selected_product_ids = formData.selected_ids;
    } else if (activeFormType === "category") {
      target_type = "specific_categories";
      applyTo = "specific_categories";
      if (formData.selected_ids.length === 0) return toast.error("Please select at least one category");
      payloadExtras.selected_category_ids = formData.selected_ids;
    } else if (activeFormType === "brand") {
      target_type = "brand";
      applyTo = "brand";
      if (formData.selected_ids.length === 0) return toast.error("Please select at least one brand");
      payloadExtras.selected_brand_ids = formData.selected_ids;
    }

    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim() ? formData.code.trim().toUpperCase() : undefined,
      description: formData.description.trim() || undefined,
      target_type,
      applyTo,
      value_type: formData.value_type,
      type: formData.value_type === "fixed_amount" ? "fixed" : formData.value_type,
      value: Number(formData.value),
      start_at: dateInputToISO(formData.start_at) || new Date().toISOString(),
      end_at: dateInputToISO(formData.end_at) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: formData.status,
      isActive: formData.status === "active",
      ...payloadExtras,
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === undefined || payload[key] === null || payload[key] === "") delete payload[key];
    });

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

  // Discount type cards configuration
  const discountTypes = [
    {
      key: "product",
      title: "Product Discount",
      desc: "Apply discount on specific products",
      icon: BoxIcon,
      gradient: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.05))",
      iconColor: "#60a5fa",
      border: "rgba(59,130,246,0.3)",
    },
    {
      key: "category",
      title: "Category Discount",
      desc: "Apply discount on entire categories",
      icon: FolderIcon,
      gradient: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.05))",
      iconColor: "#c084fc",
      border: "rgba(168,85,247,0.3)",
    },
    {
      key: "brand",
      title: "Brand Discount",
      desc: "Apply discount on specific brands",
      icon: AwardIcon,
      gradient: "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))",
      iconColor: "#fbbf24",
      border: "rgba(245,158,11,0.3)",
    },
    {
      key: "all",
      title: "All Products Discount",
      desc: "Apply discount on all products",
      icon: GlobeIcon,
      gradient: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))",
      iconColor: "#34d399",
      border: "rgba(16,185,129,0.3)",
    },
  ];

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5 p-4 md:p-0">
        {/* ===== Header ===== */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Discount Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Create and manage promotional discounts for your store.</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setViewMode("list")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}><ListIcon /></button>
            <button type="button" onClick={() => setViewMode("grid")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}><GridIcon /></button>
          </div>
        </div>

        {/* ===== Discount Type Action ===== */}
        <div className="flex items-center justify-between gap-3 rounded-xl p-3 sm:p-4" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Create a discount</p>
            <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>Choose where the discount should apply.</p>
          </div>
          <div className="relative shrink-0" ref={typeMenuRef}>
            <button type="button" onClick={() => setIsTypeMenuOpen((open) => !open)} aria-expanded={isTypeMenuOpen} className="inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[12px] font-semibold transition hover:bg-[var(--accent-hover)]" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              <PlusIcon className="h-3.5 w-3.5" /> New Discount
              <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${isTypeMenuOpen ? "rotate-180" : ""}`} />
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
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{search || filterStatus !== "all" ? "No discounts match your filters" : "No discounts yet. Create one above!"}</p>
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

      {/* ===== Add/Edit Discount Modal ===== */}
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

      {/* ===== Delete Confirmation Modal ===== */}
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

/* ================= Discount Form Modal ================= */
function DiscountFormModal({ type, formData, setFormData, editingDiscount, products, categories, brands, mutation, onClose, onSubmit, cardStyle, inputStyle }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSelectionOpen, setIsSelectionOpen] = useState(false);

  const config = {
    product: {
      title: editingDiscount ? "Edit Product Discount" : "Create Product Discount",
      subtitle: "Apply discount on specific products",
      items: products,
      placeholder: "Search products...",
      emptyMsg: "No products found",
      selectedLabel: "Selected Products",
      color: "var(--accent)",
      border: "var(--border-color)",
      bg: "var(--accent-soft)",
    },
    category: {
      title: editingDiscount ? "Edit Category Discount" : "Create Category Discount",
      subtitle: "Apply discount on entire categories",
      items: categories,
      placeholder: "Search categories...",
      emptyMsg: "No categories found",
      selectedLabel: "Selected Categories",
      color: "var(--accent)",
      border: "var(--border-color)",
      bg: "var(--accent-soft)",
    },
    brand: {
      title: editingDiscount ? "Edit Brand Discount" : "Create Brand Discount",
      subtitle: "Apply discount on specific brands",
      items: brands,
      placeholder: "Search brands...",
      emptyMsg: "No brands found",
      selectedLabel: "Selected Brands",
      color: "var(--accent)",
      border: "var(--border-color)",
      bg: "var(--accent-soft)",
    },
    all: {
      title: editingDiscount ? "Edit All Products Discount" : "Create All Products Discount",
      subtitle: "This discount will apply to all products in your store",
      items: [],
      placeholder: "",
      emptyMsg: "",
      selectedLabel: "",
      color: "var(--accent)",
      border: "var(--border-color)",
      bg: "var(--accent-soft)",
    },
  };

  const current = config[type];
  const needsSelection = type !== "all";

  const filteredItems = useMemo(() => {
    if (!needsSelection) return [];
    if (!searchQuery.trim()) return current.items;
    const term = searchQuery.toLowerCase();
    return current.items.filter((item) => getItemName(item).toLowerCase().includes(term));
  }, [current.items, searchQuery, needsSelection]);

  const toggleItem = (id) => {
    const strId = String(id);
    setFormData({
      ...formData,
      selected_ids: formData.selected_ids.includes(strId)
        ? formData.selected_ids.filter((x) => x !== strId)
        : [...formData.selected_ids, strId],
    });
  };

  const removeItem = (id) => {
    setFormData({ ...formData, selected_ids: formData.selected_ids.filter((x) => x !== String(id)) });
  };

  const selectedItems = needsSelection
    ? current.items.filter((item) => formData.selected_ids.includes(getItemId(item)))
    : [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl" style={{ ...cardStyle, boxShadow: "var(--shadow-lg)" }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)", background: current.bg }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: current.bg, border: `1px solid ${current.border}` }}>
              <TagIcon className="w-5 h-5" style={{ color: current.color }} />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>{current.title}</h3>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{current.subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} disabled={mutation.isPending} className="p-1.5 rounded-md transition disabled:opacity-50 hover:opacity-70" style={{ color: "var(--text-muted)" }}><CloseIcon /></button>
        </div>

        {/* Form Body */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto">
          <div className="space-y-5 p-5 sm:p-6">

            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Discount Name *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required disabled={mutation.isPending} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50 focus:ring-1 focus:ring-[var(--accent)]/40" style={inputStyle} placeholder="Summer Sale 2026" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Coupon Code</label>
                <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} disabled={mutation.isPending} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50 uppercase font-mono focus:ring-1 focus:ring-[var(--accent)]/40" style={inputStyle} placeholder="SUMMER20" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows="2" disabled={mutation.isPending} className="px-3 py-2 rounded-md text-sm w-full outline-none disabled:opacity-50 resize-none focus:ring-1 focus:ring-[var(--accent)]/40" style={inputStyle} placeholder="Describe this discount..." />
            </div>

            {/* Selection Section (only for product/category/brand) */}
            {needsSelection && (
              <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
                <button type="button" onClick={() => setIsSelectionOpen((open) => !open)} aria-expanded={isSelectionOpen} className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[var(--bg-tertiary)]" style={{ borderBottom: isSelectionOpen ? "1px solid var(--border-color)" : "none" }}>
                  <span>
                    <span className="block text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Select {type === "product" ? "Products" : type === "category" ? "Categories" : "Brands"} *</span>
                    <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-muted)" }}>{formData.selected_ids.length} selected</span>
                  </span>
                  <span className="flex items-center gap-2 text-[11px] font-semibold" style={{ color: "var(--accent)" }}>{isSelectionOpen ? "Close" : "Choose"}<ChevronDownIcon className={`h-4 w-4 transition-transform ${isSelectionOpen ? "rotate-180" : ""}`} /></span>
                </button>

                {isSelectionOpen && <>
                {/* Search */}
                <div className="p-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon className="w-4 h-4" /></span>
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={current.placeholder} className="h-9 pl-9 pr-3 rounded-md text-sm w-full outline-none focus:ring-1 focus:ring-[var(--accent)]/40" style={inputStyle} />
                  </div>
                </div>

                {/* Selected Chips */}
                {selectedItems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-3 py-2.5" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                    {selectedItems.map((item) => {
                      const id = getItemId(item);
                      return (
                        <span key={id} className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md text-[11px] font-medium" style={{ backgroundColor: "var(--bg-card)", border: `1px solid ${current.border}`, color: current.color }}>
                          <span className="max-w-[120px] truncate">{getItemName(item)}</span>
                          <button type="button" onClick={() => removeItem(id)} className="w-4 h-4 rounded flex items-center justify-center hover:bg-red-500/20 hover:text-red-400 transition">
                            <XIcon className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Items List */}
                <div className="max-h-[220px] overflow-y-auto">
                  {filteredItems.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{current.emptyMsg}</p>
                    </div>
                  ) : (
                    <div className="p-1.5 space-y-0.5">
                      {filteredItems.map((item) => {
                        const id = getItemId(item);
                        const isSelected = formData.selected_ids.includes(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => toggleItem(id)}
                            className="w-full px-3 py-2 rounded-md flex items-center gap-3 text-left transition"
                            style={{ backgroundColor: isSelected ? current.bg : "transparent" }}
                            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)"; }}
                            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
                          >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${isSelected ? "" : "border-slate-600"}`}
                              style={isSelected ? { backgroundColor: current.color, borderColor: current.color, color: "#0a0a0a" } : {}}>
                              {isSelected && <CheckIcon className="w-3 h-3" />}
                            </span>
                            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 text-[10px] font-bold" style={{ backgroundColor: current.bg, color: current.color, border: `1px solid ${current.border}` }}>
                              {getInitials(getItemName(item))}
                            </div>
                            <span className="text-[13px] truncate flex-1" style={{ color: isSelected ? current.color : "var(--text-primary)", fontWeight: isSelected ? 600 : 400 }}>
                              {getItemName(item)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                </>}
              </div>
            )}

            {/* Value Section */}
            <div className="rounded-lg p-4 space-y-3" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Discount Value</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Discount Type</label>
                  <div className="relative">
                    <select value={formData.value_type} onChange={(e) => setFormData({ ...formData, value_type: e.target.value })} disabled={mutation.isPending} className="appearance-none h-9 px-3 pr-8 rounded-md text-sm w-full outline-none disabled:opacity-50 cursor-pointer focus:ring-1 focus:ring-[var(--accent)]/40" style={inputStyle}>
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed_amount">Fixed Amount</option>
                      <option value="fixed_price">Fixed Price</option>
                    </select>
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDownIcon className="w-3.5 h-3.5" /></span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Value *</label>
                  <div className="relative">
                    <input type="number" value={formData.value} onChange={(e) => setFormData({ ...formData, value: e.target.value })} required min="0" step="0.01" disabled={mutation.isPending} className="h-9 pl-3 pr-10 rounded-md text-sm w-full outline-none disabled:opacity-50 focus:ring-1 focus:ring-[var(--accent)]/40" style={inputStyle} placeholder={formData.value_type === "percentage" ? "20" : "500"} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                      {formData.value_type === "percentage" ? "%" : "$"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Start Date</label>
                <input type="datetime-local" value={formData.start_at} onChange={(e) => setFormData({ ...formData, start_at: e.target.value })} disabled={mutation.isPending} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50 [color-scheme:dark] focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>End Date</label>
                <input type="datetime-local" value={formData.end_at} onChange={(e) => setFormData({ ...formData, end_at: e.target.value })} disabled={mutation.isPending} className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50 [color-scheme:dark] focus:ring-1 focus:ring-emerald-500/40" style={inputStyle} />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Status</label>
              <div className="relative">
                <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} disabled={mutation.isPending} className="appearance-none h-9 px-3 pr-8 rounded-md text-sm w-full outline-none disabled:opacity-50 cursor-pointer focus:ring-1 focus:ring-emerald-500/40" style={inputStyle}>
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDownIcon className="w-3.5 h-3.5" /></span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-4 flex gap-2" style={{ borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
            <button type="button" onClick={onClose} disabled={mutation.isPending} className="flex-1 h-10 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
            <button type="submit" disabled={mutation.isPending} className="flex-1 h-10 rounded-md text-sm font-semibold transition disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              {mutation.isPending ? <><Spinner className="w-4 h-4" /> Saving...</> : editingDiscount ? "Update Discount" : "Create Discount"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}