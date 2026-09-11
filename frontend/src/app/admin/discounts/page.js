"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { discountApi } from "../../../apis/admin/discountApi";
import { productApi } from "../../../apis/admin/productApi";
import { categoryApi } from "../../../apis/admin/categoryApi";
import { brandApi } from "../../../apis/admin/brandApi";
import useDiscountSocketSync from "../../../hooks/useDiscountSocketSync";

/* ==================== ICONS (same as Deals) ==================== */
const PlusIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const SearchIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const ListIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const GridIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>);
const EditIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>);
const TrashIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>);
const CloseIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>);
const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
const CheckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>);
const EyeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>);
const BoxIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>);
const FolderIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>);
const AwardIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>);
const GlobeIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const InfoIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>);
const TagIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>);
const PackageIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>);
const CalendarIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>);
const SettingsIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>);
const PercentIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21a4 4 0 01-4-4V5a2 2 0 012-2h14a2 2 0 012 2v12a4 4 0 01-4 4H7z" /></svg>);
const LayersIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l9 5-9 5-9-5 9-5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l9 5 9-5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 17l9 5 9-5" /></svg>);

/* ==================== HELPERS (same as Deals) ==================== */
const normalizeArrayResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.discounts)) return response.discounts;
  if (Array.isArray(response?.products)) return response.products;
  if (Array.isArray(response?.categories)) return response.categories;
  if (Array.isArray(response?.brands)) return response.brands;
  return [];
};

const getId = (item) => {
  if (!item) return "";
  if (typeof item === 'object') return String(item._id || item.id || "");
  return String(item);
};

const getName = (item, type) => {
  if (type === "product") return item?.name || item?.title || "Unnamed Product";
  if (type === "category") return item?.name || item?.categoryName || "Unnamed Category";
  if (type === "brand") return item?.name || item?.brandName || "Unnamed Brand";
  return item?.name || "Unnamed";
};

const formatCurrency = (amount) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amount || 0);

const formatTarget = (target) => {
  if (!target) return "All Products";
  const map = { all: "All Products", all_products: "All Products", product: "Specific Products", specific_products: "Specific Products", category: "Categories", specific_categories: "Categories", brand: "Brands" };
  return map[target] || String(target).replaceAll("_", " ");
};

const formatValue = (discount) => {
  const type = discount?.value_type || discount?.valueType || discount?.type || "percentage";
  const value = Number(discount?.value ?? 0);
  if (type === "percentage") return `${value}% OFF`;
  if (type === "fixed_amount" || type === "fixed") return `Rs. ${value} OFF`;
  if (type === "fixed_price") return `Fixed Rs. ${value}`;
  return `Rs. ${value} OFF`;
};

const getDiscountStatus = (discount) => {
  if (discount?.status) return discount.status;
  if (discount?.isActive === false) return "disabled";
  const end = discount?.end_at || discount?.endDate;
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
    inactive: { text: "Inactive", bg: "rgba(239,68,68,0.10)", color: "#f87171", border: "rgba(239,68,68,0.25)" },
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

/* ==================== CUSTOM MODAL SELECT (same as Deals) ==================== */
const CustomModalSelect = ({ value, onChange, options, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);
  const displayValue = selectedOption ? selectedOption.label : (value || placeholder);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button type="button" onClick={() => !disabled && setIsOpen(!isOpen)} disabled={disabled}
        className="flex h-10 md:h-9 w-full items-center justify-between rounded-md px-3 text-left text-[16px] md:text-[13px] outline-none transition disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
        <span className="truncate">{displayValue}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute z-[100] mt-1 w-full overflow-y-auto rounded-md border shadow-xl max-h-48"
             style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>No options available</div>
          ) : (
            options.map((opt) => (
              <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-black/5 transition-colors"
                style={{ color: value === opt.value ? "var(--accent)" : "var(--text-primary)", backgroundColor: value === opt.value ? "rgba(16,185,129,0.05)" : "transparent" }}>
                {opt.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

/* ==================== SHARED FORM PIECES (same as Deals) ==================== */
const SectionHeader = ({ icon: Icon, title, subtitle, right }) => (
  <div className="flex items-center justify-between gap-3 mb-3">
    <div className="flex items-center gap-2.5 min-w-0">
      {Icon && (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0">
        <h4 className="text-[13px] font-bold uppercase tracking-wide truncate" style={{ color: "var(--text-primary)" }}>{title}</h4>
        {subtitle && <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
      </div>
    </div>
    {right}
  </div>
);

const FormField = ({ label, required, children, hint, fullWidth }) => (
  <div className={fullWidth ? "md:col-span-2" : ""}>
    {label && (
      <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
        {label} {required && <span className="text-red-500 normal-case">*</span>}
      </label>
    )}
    {children}
    {hint && <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{hint}</p>}
  </div>
);

const TextInput = ({ value, onChange, placeholder, type = "text", style }) => (
  <input
    type={type}
    value={value || ""}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="h-9 w-full rounded-md px-3 text-sm outline-none transition focus:ring-2 focus:ring-[var(--accent)]/30"
    style={style}
  />
);

const TextArea = ({ value, onChange, placeholder, rows = 3, style }) => (
  <textarea
    rows={rows}
    value={value || ""}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    className="w-full px-3 py-2 rounded-md text-sm outline-none transition focus:ring-2 focus:ring-[var(--accent)]/30 resize-none"
    style={style}
  />
);

function StatCard({ title, value, valueClass = "", cardStyle }) {
  return (<div className="rounded-lg p-4" style={cardStyle}>
    <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{title}</p>
    <p className={`text-[20px] font-bold mt-1 ${valueClass}`}>{value}</p>
  </div>);
}

function Select({ value, onChange, options, inputStyle }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none h-10 md:h-9 w-[170px] pl-3 pr-8 rounded-lg text-[16px] md:text-[13px] outline-none cursor-pointer" style={inputStyle}>
        {options.map(([val, label]) => (<option key={`${val}-${label}`} value={val}>{label}</option>))}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDownIcon className="w-3.5 h-3.5" /></span>
    </div>
  );
}

/* ==================== PRODUCT HELPERS (same as Deals) ==================== */
const getInitials = (name) => {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
};

const getProductImage = (product) => {
  if (!product) return null;
  const firstVariantImage = product?.variants?.[0]?.images?.[0]?.img_url;
  if (firstVariantImage) return firstVariantImage;
  return null;
};

const getProductPrice = (product) => {
  if (!product) return 0;
  const directPrice = Number(product.price || 0);
  const variantPrice = product.variants?.[0]?.selling_price ? Number(product.variants[0].selling_price) : 0;
  return directPrice > 0 ? directPrice : variantPrice;
};

const humanizeKey = (key) => {
  if (!key) return "";
  const s = String(key);
  return s
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const getProductAttributes = (product) => {
  if (!product) return [];
  const list = [];
  if (product.specifications && typeof product.specifications === "object") {
    Object.entries(product.specifications).forEach(([key, value]) => {
      if (value === null || value === undefined || value === "") return;
      if (typeof value === "object") return;
      list.push({ name: humanizeKey(key), value: String(value) });
    });
  }
  const seen = new Set();
  (product.variants || []).forEach((variant) => {
    if (variant.attributes && typeof variant.attributes === "object") {
      Object.entries(variant.attributes).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") return;
        const k = `${key}::${value}`;
        if (seen.has(k)) return;
        seen.add(k);
        if (typeof value === "object") return;
        list.push({ name: humanizeKey(key), value: String(value) });
      });
    }
  });
  return list;
};

/* ==================== MAIN COMPONENT ==================== */
export default function DiscountsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const { markSelfAction } = useDiscountSocketSync();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
const [viewMode, setViewMode] = useState(() => {
  if (typeof window !== 'undefined') {
    return window.innerWidth < 768 ? "grid" : "list";
  }
  return "list";
});
  const [showModal, setShowModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [selector, setSelector] = useState({ open: false, type: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [activeFormType, setActiveFormType] = useState(null);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const typeMenuRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [formData, setFormData] = useState({
    name: "", code: "", description: "",
    selected_ids: [],
    value_type: "percentage", value: "", max_discount: "",
    min_order_amount: "", min_quantity: "",
    usage_limit: "", usage_per_customer: "",
    priority: "1", is_stackable: false,
    start_at: "", end_at: "", status: "active",
  });

  const { data: paginatedDiscountsData, isLoading } = useQuery({
    queryKey: ["discounts", "paginated", currentPage, search, statusFilter, targetFilter],
    queryFn: () => discountApi.getAllPaginated({ page: currentPage, limit: itemsPerPage, search: search || "", status: statusFilter === "all" ? "" : statusFilter, applyTo: targetFilter === "all" ? "" : targetFilter }),
  });
  const discounts = paginatedDiscountsData?.items || paginatedDiscountsData || normalizeArrayResponse(paginatedDiscountsData);
  const pagination = paginatedDiscountsData?.pagination || { total: 0, page: currentPage, limit: itemsPerPage, pages: 1, hasNext: false, hasPrev: false };
  const { data: productsResponse } = useQuery({ queryKey: ["discount-products"], queryFn: productApi.getAll, staleTime: 60000 });
  const products = useMemo(() => normalizeArrayResponse(productsResponse), [productsResponse]);
  const { data: categoriesResponse } = useQuery({ queryKey: ["discount-categories"], queryFn: categoryApi.getAll, staleTime: 60000 });
  const categories = useMemo(() => normalizeArrayResponse(categoriesResponse), [categoriesResponse]);
  const { data: brandsResponse } = useQuery({ queryKey: ["discount-brands"], queryFn: brandApi.getAll, staleTime: 60000 });
  const brands = useMemo(() => normalizeArrayResponse(brandsResponse), [brandsResponse]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(event.target)) setIsTypeMenuOpen(false);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter, targetFilter]);

  const resetForm = () => {
    setFormData({
      name: "", code: "", description: "",
      selected_ids: [],
      value_type: "percentage", value: "", max_discount: "",
      min_order_amount: "", min_quantity: "",
      usage_limit: "", usage_per_customer: "",
      priority: "1", is_stackable: false,
      start_at: "", end_at: "", status: "active",
    });
    setEditingDiscount(null);
    setSelector({ open: false, type: null });
    setActiveFormType(null);
  };

  const handleView = (id) => router.push(`${pathname}/${id}`);

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? discountApi.update(id, data) : discountApi.create(data)),
    onMutate: (_, variables) => markSelfAction(variables.id ? "update" : "create"),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      toast.success(variables.id ? "Discount updated successfully" : "Discount created successfully");
      setShowModal(false);
      resetForm();
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Failed to save discount"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids) => await Promise.all(ids.map((id) => discountApi.delete(id))),
    onMutate: () => markSelfAction("delete"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      setDeleteTarget(null);
      setSelectedIds([]);
      toast.success("Discount deleted successfully");
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Failed to delete discount"),
  });

  const filteredDiscounts = useMemo(() => {
    const term = search.toLowerCase().trim();
    return discounts.filter((d) => {
      const name = String(d?.name || "").toLowerCase();
      const code = String(d?.code || "").toLowerCase();
      const matchSearch = !term || name.includes(term) || code.includes(term);
      const status = getDiscountStatus(d);
      const matchStatus = statusFilter === "all" || status === statusFilter;
      const rawTarget = d?.target_type || d?.applyTo || "all_products";
      const matchTarget = targetFilter === "all" || rawTarget === targetFilter || (targetFilter === "product" && rawTarget === "specific_products") || (targetFilter === "category" && rawTarget === "specific_categories");
      return matchSearch && matchStatus && matchTarget;
    });
  }, [discounts, search, statusFilter, targetFilter]);

  const paginatedDiscounts = discounts; // server paginated; no client .slice()
  const totalPages = pagination.pages || 1;
  const totalDiscounts = pagination.total || discounts.length;

  const stats = useMemo(() => ({
    total: discounts.length,
    active: discounts.filter((d) => getDiscountStatus(d) === "active" || getDiscountStatus(d) === "scheduled").length,
    inactive: discounts.filter((d) => ["inactive", "disabled", "draft"].includes(getDiscountStatus(d))).length,
    expired: discounts.filter((d) => getDiscountStatus(d) === "expired").length,
  }), [discounts]);

  const openEdit = (discount) => {
    const rawTarget = discount?.target_type || discount?.applyTo || "all_products";
    let type = "all";
    if (rawTarget === "specific_products" || rawTarget === "product") type = "product";
    else if (rawTarget === "specific_categories" || rawTarget === "category") type = "category";
    else if (rawTarget === "brand") type = "brand";

    let selected_ids = [];
    if (type === "product") selected_ids = (discount?.selected_product_ids || discount?.productIds || discount?.products?.map(getId) || []).map(getId);
    else if (type === "category") selected_ids = (discount?.selected_category_ids || discount?.categoryIds || discount?.categories?.map(getId) || []).map(getId);
    else if (type === "brand") selected_ids = (discount?.selected_brand_ids || discount?.brandIds || discount?.brands?.map(getId) || []).map(getId);

    setFormData({
      name: discount?.name || "", code: discount?.code || "", description: discount?.description || "",
      selected_ids,
      value_type: discount?.value_type || (discount?.type === "fixed" ? "fixed_amount" : "percentage"),
      value: discount?.value ?? "", max_discount: discount?.max_discount ?? discount?.maxDiscountAmount ?? "",
      min_order_amount: discount?.min_order_amount ?? discount?.minOrderValue ?? "",
      min_quantity: discount?.min_quantity ?? discount?.minQuantity ?? "",
      usage_limit: discount?.usage_limit ?? discount?.usageLimit ?? "",
      usage_per_customer: discount?.usage_per_customer ?? discount?.perUserLimit ?? "",
      priority: discount?.priority ?? "1",
      is_stackable: Boolean(discount?.is_stackable ?? discount?.isStackable),
      start_at: toDateInput(discount?.start_at || discount?.startDate),
      end_at: toDateInput(discount?.end_at || discount?.endDate),
      status: discount?.status || (discount?.isActive ? "active" : "disabled"),
    });
    setEditingDiscount(discount);
    setActiveFormType(type);
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!String(formData.name || "").trim()) return toast.error("Discount name is required");
    if (formData.value === "" || Number(formData.value) < 0) return toast.error("Valid discount value is required");
    if (formData.value_type === "percentage" && Number(formData.value) > 100) return toast.error("Percentage cannot exceed 100");

    let target_type = "all_products";
    let applyTo = "all";
    let payloadExtras = {};

    if (activeFormType === "product") {
      target_type = "specific_products"; applyTo = "specific_products";
      if (formData.selected_ids.length === 0) return toast.error("Select at least one product");
      payloadExtras.selected_product_ids = formData.selected_ids.map((id) => String(id?._id || id));
    } else if (activeFormType === "category") {
      target_type = "specific_categories"; applyTo = "specific_categories";
      if (formData.selected_ids.length === 0) return toast.error("Select at least one category");
      payloadExtras.selected_category_ids = formData.selected_ids.map((id) => String(id?._id || id));
    } else if (activeFormType === "brand") {
      target_type = "brand"; applyTo = "brand";
      if (formData.selected_ids.length === 0) return toast.error("Select at least one brand");
      payloadExtras.selected_brand_ids = formData.selected_ids.map((id) => String(id?._id || id));
    }

    const startDate = formData.start_at ? dateToISO(formData.start_at) : new Date().toISOString();
    const endDate = formData.end_at ? dateToISO(formData.end_at) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    if (new Date(endDate) <= new Date(startDate)) return toast.error("End date must be after start date");

    const payload = {
      name: String(formData.name).trim(),
      code: formData.code.trim() ? formData.code.trim().toUpperCase() : undefined,
      description: String(formData.description || "").trim() || undefined,
      target_type, applyTo,
      value_type: formData.value_type,
      type: formData.value_type === "fixed_amount" ? "fixed" : formData.value_type,
      value: Number(formData.value),
      max_discount: formData.max_discount !== "" ? Number(formData.max_discount) : undefined,
      min_order_amount: formData.min_order_amount !== "" ? Number(formData.min_order_amount) : undefined,
      min_quantity: formData.min_quantity !== "" ? Number(formData.min_quantity) : undefined,
      usage_limit: formData.usage_limit !== "" ? Number(formData.usage_limit) : undefined,
      usage_per_customer: formData.usage_per_customer !== "" ? Number(formData.usage_per_customer) : undefined,
      priority: formData.priority !== "" ? Number(formData.priority) : undefined,
      is_stackable: Boolean(formData.is_stackable),
      start_at: startDate, end_at: endDate,
      status: formData.status,
      isActive: formData.status === "active" || formData.status === "scheduled",
      ...payloadExtras,
    };

    Object.keys(payload).forEach((key) => { if (payload[key] === undefined || payload[key] === null || payload[key] === "") delete payload[key]; });
    saveMutation.mutate({ id: editingDiscount?._id || editingDiscount?.id || null, data: payload });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.map((d) => d?._id || d?.id));
  };

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  const discountTypes = [
    { key: "all", title: "All Products Discount", desc: "Apply discount on all products", icon: GlobeIcon },
    { key: "product", title: "Product Discount", desc: "Apply discount on specific products", icon: BoxIcon },
    { key: "category", title: "Category Discount", desc: "Apply discount on entire categories", icon: FolderIcon },
    { key: "brand", title: "Brand Discount", desc: "Apply discount on specific brands", icon: AwardIcon },
  ];

  const openDiscountForm = (type) => {
    resetForm();
    setIsTypeMenuOpen(false);
    setActiveFormType(type);
    setShowModal(true);
  };

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

  const ActionButtons = ({ discount }) => (
    <div className="flex items-center justify-end gap-1 sm:gap-2">
      <button onClick={(e) => { e.stopPropagation(); handleView(discount._id || discount.id); }} className="flex-shrink-0 min-w-[44px] min-h-[44px] p-2 rounded-md transition hover:bg-emerald-500/10 flex items-center justify-center" style={{ color: "#34d399" }} title="View Details"><EyeIcon className="w-4 h-4" /></button>
      <button onClick={(e) => { e.stopPropagation(); openEdit(discount); }} className="flex-shrink-0 min-w-[44px] min-h-[44px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center" style={{ color: "var(--text-secondary)" }} title="Edit"><EditIcon className="w-4 h-4" /></button>
      <button onClick={(e) => { e.stopPropagation(); setDeleteTarget([discount]); }} className="flex-shrink-0 min-w-[44px] min-h-[44px] p-2 rounded-md transition text-red-500 hover:bg-red-500/10 flex items-center justify-center" title="Delete"><TrashIcon className="w-4 h-4" /></button>
    </div>
  );

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5 p-4 md:p-0">
        {/* HEADER */}
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
                <PlusIcon /> New Discount <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isTypeMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {isTypeMenuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl p-1.5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-lg)" }}>
                  {discountTypes.map((dt) => {
                    const Icon = dt.icon;
                    return (
                      <button key={dt.key} type="button" onClick={() => openDiscountForm(dt.key)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[var(--bg-tertiary)]">
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

        {/* STATS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Total Discounts" value={stats.total} cardStyle={cardStyle} />
          <StatCard title="Active" value={stats.active} valueClass="text-emerald-500" cardStyle={cardStyle} />
          <StatCard title="Inactive" value={stats.inactive} valueClass="text-red-400" cardStyle={cardStyle} />
          <StatCard title="Expired" value={stats.expired} valueClass="text-amber-500" cardStyle={cardStyle} />
        </div>

        {/* SEARCH & FILTERS */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
          <input type="text" placeholder="Search discount name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-10 pl-9 pr-3 rounded-lg text-[16px] md:text-[13px] outline-none" style={inputStyle} />
        </div>

        <div className="flex flex-wrap gap-3">
          <Select value={statusFilter} onChange={setStatusFilter} inputStyle={inputStyle} options={[["all", "All Status"], ["active", "Active"], ["scheduled", "Scheduled"], ["disabled", "Disabled"], ["expired", "Expired"]]} />
          <Select value={targetFilter} onChange={setTargetFilter} inputStyle={inputStyle} options={[["all", "All Targets"], ["all_products", "All Products"], ["product", "Specific Products"], ["category", "Categories"], ["brand", "Brands"]]} />
        </div>

        {/* BULK BAR */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-lg px-4 h-11" style={{ backgroundColor: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.35)" }}>
            <p className="text-sm font-semibold" style={{ color: "#34d399" }}>{selectedIds.length} selected</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedIds([])} className="h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Clear</button>
              <button onClick={() => setDeleteTarget(discounts.filter((d) => selectedIds.includes(d._id || d.id)))} className="h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 transition hover:opacity-90" style={{ backgroundColor: "var(--danger)" }}><TrashIcon className="w-3.5 h-3.5" /> Delete Selected</button>
            </div>
          </div>
        )}

        {/* TABLE / GRID */}
        {isLoading ? (
          <div className="rounded-lg py-14 flex justify-center items-center gap-2" style={cardStyle}><Spinner /><span className="text-sm" style={{ color: "var(--text-muted)" }}>Loading discounts...</span></div>
        ) : paginatedDiscounts.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center" style={cardStyle}>
            <TagIcon className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>{search ? "No discounts found" : "No discounts created yet"}</p>
          </div>
        ) : viewMode === "list" ? (
          <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-4 py-3 w-10"><input type="checkbox" checked={paginatedDiscounts.length > 0 && paginatedDiscounts.every((d) => selectedIds.includes(d._id || d.id))} onChange={(e) => setSelectedIds(e.target.checked ? paginatedDiscounts.map((d) => d._id || d.id) : [])} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></th>
                    <th className="px-4 py-3 text-left" style={{ color: "var(--text-muted)" }}>Discount</th>
                    <th className="px-4 py-3 text-left" style={{ color: "var(--text-muted)" }}>Applies To</th>
                    <th className="px-4 py-3 text-left" style={{ color: "var(--text-muted)" }}>Value</th>
                    <th className="px-4 py-3 text-left" style={{ color: "var(--text-muted)" }}>Status</th>
                    <th className="px-4 py-3 text-right" style={{ color: "var(--text-muted)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedDiscounts.map((discount, index) => {
                    const id = discount?._id || discount?.id;
                    const isSelected = selectedIds.includes(id);
                    const status = getDiscountStatus(discount);
                    return (
                      <tr key={id} onClick={() => handleView(id)} style={{ borderBottom: index < paginatedDiscounts.length - 1 ? "1px solid var(--border-color)" : "none", backgroundColor: isSelected ? "var(--bg-tertiary)" : "transparent" }} className="hover:bg-white/[0.02] transition cursor-pointer">
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16,185,129,0.10)", color: "#34d399" }}><TagIcon className="w-4 h-4" /></div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate max-w-[220px]">{discount?.name || "Untitled Discount"}</p>
                              <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{discount?.code || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{formatTarget(discount?.target_type || discount?.applyTo)}</td>
                        <td className="px-4 py-3"><span className="font-bold text-emerald-500">{formatValue(discount)}</span></td>
                        <td className="px-4 py-3"><StatusBadge status={status} /></td>
                        <td className="px-4 py-3 whitespace-nowrap w-1"><ActionButtons discount={discount} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {paginatedDiscounts.map((discount) => (
              <div key={discount._id || discount.id} onClick={() => handleView(discount._id || discount.id)} className="rounded-lg p-4 flex flex-col gap-3 transition hover:-translate-y-0.5 cursor-pointer" style={cardStyle}>
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(16,185,129,0.10)", color: "#34d399" }}><TagIcon className="w-5 h-5" /></div>
                  <StatusBadge status={getDiscountStatus(discount)} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[13px] truncate">{discount?.name || "Untitled Discount"}</p>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{discount?.code || "—"}</p>
                </div>
                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
                  <span className="text-[12px] font-bold" style={{ color: "#34d399" }}>{formatValue(discount)}</span>
                  <ActionButtons discount={discount} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAGINATION */}
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

      {/* MODALS */}
      {showModal && (
        <DiscountFormModal
          formType={activeFormType}
          formData={formData}
          setFormData={setFormData}
          editingDiscount={editingDiscount}
          saveMutation={saveMutation}
          setShowModal={setShowModal}
          resetForm={resetForm}
          setSelector={setSelector}
          handleSubmit={handleSubmit}
          inputStyle={inputStyle}
          products={products}
          categories={categories}
          brands={brands}
        />
      )}
      {selector.open && (
        <SelectionModal
          type={selector.type}
          items={selector.type === "product" ? products : selector.type === "category" ? categories : brands}
          selectedIds={formData.selected_ids}
          onClose={() => setSelector({ open: false, type: null })}
          onApply={(ids) => {
            setFormData((prev) => ({ ...prev, selected_ids: ids }));
            setSelector({ open: false, type: null });
          }}
          inputStyle={inputStyle}
          cardStyle={cardStyle}
        />
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-xl p-5" style={cardStyle}>
            <h3 className="text-base font-semibold">Delete Discount?</h3>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              Are you sure you want to delete {deleteTarget.length === 1 ? <span className="font-semibold">{deleteTarget[0]?.name}</span> : `${deleteTarget.length} discounts`}?
            </p>
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

/* ==================== FORM MODAL (same structure as DealFormModal) ==================== */
const DISCOUNT_TYPE_LABELS = { all: "All Products Discount", product: "Product Discount", category: "Category Discount", brand: "Brand Discount" };
const DISCOUNT_TYPE_SUBTITLES = {
  all: "This discount will apply to all products in your store automatically.",
  product: "Select specific products to apply this discount to.",
  category: "Select entire categories to apply this discount to.",
  brand: "Select specific brands to apply this discount to.",
};
const DISCOUNT_TYPE_ICONS = { all: GlobeIcon, product: BoxIcon, category: FolderIcon, brand: AwardIcon };

const TargetIconFor = (formType) => {
  if (formType === "product") return PackageIcon;
  if (formType === "category") return FolderIcon;
  if (formType === "brand") return AwardIcon;
  return TagIcon;
};

function DiscountFormModal({ formType, formData, setFormData, editingDiscount, saveMutation, setShowModal, resetForm, setSelector, handleSubmit, inputStyle, products, categories, brands }) {
  const [viewingProduct, setViewingProduct] = useState(null);

  const typeLabel = DISCOUNT_TYPE_LABELS[formType] || "Discount";
  const TypeIcon = DISCOUNT_TYPE_ICONS[formType] || TagIcon;

  const selConfig = {
    product: { key: "selected_ids", items: products, label: "Products", sub: "Select specific products to include in this discount" },
    category: { key: "selected_ids", items: categories, label: "Categories", sub: "Apply this discount to entire categories" },
    brand: { key: "selected_ids", items: brands, label: "Brands", sub: "Apply this discount to specific brands" },
  };

  const sel = formType !== "all" ? selConfig[formType] : null;
  const ids = sel ? (formData[sel.key] || []) : [];

  const selectedItemsDetails = useMemo(() => {
    if (!sel) return [];
    return sel.items.filter((item) => ids.includes(getId(item)));
  }, [sel, ids, sel?.items]);

  const totalSelectedValue = useMemo(() => {
    if (formType !== 'product') return 0;
    return selectedItemsDetails.reduce((sum, item) => sum + getProductPrice(item), 0);
  }, [selectedItemsDetails, formType]);

  const openSelection = () => setSelector({ open: true, type: formType });

  const removeSelectedItem = (id) => {
    if (!sel) return;
    setFormData((prev) => ({
      ...prev,
      [sel.key]: prev[sel.key].filter((x) => x !== id),
    }));
  };

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4">
      <div
        className="w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden rounded-xl shadow-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        {/* HEADER */}
        <div
          className="px-5 sm:px-6 py-4 flex items-center justify-between gap-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
              <TypeIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] sm:text-lg font-bold tracking-tight truncate">
                {editingDiscount ? `Edit ${typeLabel}` : `Create ${typeLabel}`}
              </h3>
              <p className="text-[11px] sm:text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>
                {DISCOUNT_TYPE_SUBTITLES[formType]}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setShowModal(false); resetForm(); }}
            disabled={saveMutation.isPending}
            className="shrink-0 p-2 rounded-md transition hover:bg-red-500/10 hover:text-red-500"
            style={{ color: "var(--text-muted)" }}
            title="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* FORM BODY */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-5 sm:p-6 space-y-6">

            {/* BASIC INFORMATION */}
            <section>
              <SectionHeader icon={InfoIcon} title="Basic Information" subtitle="Give your discount a clear identity" />
              <div className="rounded-lg p-4" style={cardStyle}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Discount Name" required>
                    <TextInput
                      value={formData.name}
                      onChange={(v) => setFormData({ ...formData, name: v })}
                      placeholder="e.g., Summer Sale 2026"
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Coupon Code" hint="Optional">
                    <TextInput
                      value={formData.code}
                      onChange={(v) => setFormData({ ...formData, code: v.toUpperCase() })}
                      placeholder="SUMMER20"
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Description" fullWidth>
                    <TextArea
                      value={formData.description}
                      onChange={(v) => setFormData({ ...formData, description: v })}
                      placeholder="Add optional details customers will see for this discount..."
                      rows={3}
                      style={inputStyle}
                    />
                  </FormField>
                </div>
              </div>
            </section>

            {/* TARGET SELECTION — same as Deals */}
            {sel && (
              <section>
                <SectionHeader
                  icon={TargetIconFor(formType)}
                  title={`Target Selection — ${sel.label}`}
                  subtitle={sel.sub}
                  right={
                    formType === 'product' && ids.length > 0 ? (
                      <span
                        className="px-2.5 py-1 rounded-md text-[11px] font-bold border whitespace-nowrap"
                        style={{ backgroundColor: "rgba(16,185,129,0.10)", borderColor: "rgba(16,185,129,0.25)", color: "#34d399" }}
                      >
                        Total: {formatCurrency(totalSelectedValue)}
                      </span>
                    ) : null
                  }
                />

                <div className="rounded-lg overflow-hidden" style={cardStyle}>
                  {/* Selection trigger row */}
                  <div className="flex items-center justify-between gap-3 p-3.5" style={{ borderBottom: ids.length > 0 ? "1px solid var(--border-color)" : "none" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sm font-bold"
                        style={{
                          backgroundColor: ids.length > 0 ? "var(--accent)" : "var(--bg-tertiary)",
                          color: ids.length > 0 ? "var(--accent-text)" : "var(--text-muted)",
                          border: "1px solid var(--border-color)",
                        }}
                      >
                        {ids.length}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold truncate">
                          {ids.length > 0
                            ? `${ids.length} ${sel.label.toLowerCase()} selected`
                            : `No ${sel.label.toLowerCase()} selected yet`}
                        </p>
                        <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                          {ids.length > 0 ? "Click below to manage the selection" : `Choose which ${sel.label.toLowerCase()} this discount applies to`}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={openSelection}
                      className="shrink-0 h-9 px-3.5 rounded-md text-[12px] font-semibold flex items-center gap-1.5 transition hover:brightness-110"
                      style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                      Select {sel.label}
                    </button>
                  </div>

                  {/* Selected items list */}
                  {selectedItemsDetails.length > 0 && (
                    <div className="p-3 space-y-2">
                      {formType === "product" ? (
                        selectedItemsDetails.map((product) => {
                          const id = getId(product);
                          const price = getProductPrice(product);
                          const image = getProductImage(product);
                          return (
                            <SelectedProductRow
                              key={id}
                              product={product}
                              price={price}
                              image={image}
                              onView={() => setViewingProduct(product)}
                              onRemove={() => removeSelectedItem(id)}
                            />
                          );
                        })
                      ) : (
                        selectedItemsDetails.map((item) => {
                          const id = getId(item);
                          return (
                            <div
                              key={id}
                              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-md"
                              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                                  style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
                                >
                                  {getInitials(getName(item, formType))}
                                </span>
                                <p className="text-[13px] font-medium truncate">{getName(item, formType)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeSelectedItem(id)}
                                className="shrink-0 p-1.5 rounded-md hover:bg-red-500/10 hover:text-red-500 transition"
                                style={{ color: "var(--text-muted)" }}
                                title="Remove"
                              >
                                <CloseIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}

                      {/* Summary footer for products */}
                      {formType === "product" && selectedItemsDetails.length > 0 && (
                        <div
                          className="flex items-center justify-between gap-3 pt-2 mt-1 px-1 text-[11px]"
                          style={{ borderTop: "1px dashed var(--border-color)", color: "var(--text-muted)" }}
                        >
                          <span>Selected Products: <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{selectedItemsDetails.length}</span></span>
                          <span>Total Value: <span className="font-bold" style={{ color: "#34d399" }}>{formatCurrency(totalSelectedValue)}</span></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* DISCOUNT VALUE */}
            <section>
              <SectionHeader icon={PercentIcon} title="Discount Value" subtitle="Configure how the discount is calculated" />
              <div className="rounded-lg p-4 space-y-4" style={cardStyle}>
                <FormField label="Discount Type" fullWidth>
                  <CustomModalSelect
                    value={formData.value_type}
                    onChange={(val) => setFormData({ ...formData, value_type: val })}
                    options={[
                      { value: "percentage", label: "Percentage Discount (%)" },
                      { value: "fixed_amount", label: "Fixed Amount (Rs.)" },
                      { value: "fixed_price", label: "Fixed Price (Rs.)" },
                    ]}
                    placeholder="Select discount type"
                  />
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {formData.value_type === "percentage" && (
                    <>
                      <FormField label="Discount Percentage (%)">
                        <TextInput type="number" value={formData.value} onChange={(v) => setFormData({ ...formData, value: v })} placeholder="e.g., 20" style={inputStyle} />
                      </FormField>
                      <FormField label="Max Discount Cap (Rs.)" hint="Optional - caps the maximum savings">
                        <TextInput type="number" value={formData.max_discount} onChange={(v) => setFormData({ ...formData, max_discount: v })} placeholder="e.g., 1000" style={inputStyle} />
                      </FormField>
                    </>
                  )}

                  {formData.value_type === "fixed_amount" && (
                    <FormField label="Discount Amount (Rs.)" fullWidth>
                      <TextInput type="number" value={formData.value} onChange={(v) => setFormData({ ...formData, value: v })} placeholder="e.g., 500" style={inputStyle} />
                    </FormField>
                  )}

                  {formData.value_type === "fixed_price" && (
                    <FormField label="Fixed Price (Rs.)" fullWidth>
                      <TextInput type="number" value={formData.value} onChange={(v) => setFormData({ ...formData, value: v })} placeholder="e.g., 999" style={inputStyle} />
                    </FormField>
                  )}
                </div>
              </div>
            </section>

            {/* CONDITIONS & LIMITS */}
            <section>
              <SectionHeader icon={LayersIcon} title="Conditions & Limits" subtitle="Control when and how often the discount can be used" />
              <div className="rounded-lg p-4" style={cardStyle}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Min Order Amount (Rs.)">
                    <TextInput type="number" value={formData.min_order_amount} onChange={(v) => setFormData({ ...formData, min_order_amount: v })} placeholder="e.g., 1000" style={inputStyle} />
                  </FormField>
                  <FormField label="Min Quantity">
                    <TextInput type="number" value={formData.min_quantity} onChange={(v) => setFormData({ ...formData, min_quantity: v })} placeholder="e.g., 1" style={inputStyle} />
                  </FormField>
                  <FormField label="Total Usage Limit" hint="Leave empty for unlimited">
                    <TextInput type="number" value={formData.usage_limit} onChange={(v) => setFormData({ ...formData, usage_limit: v })} placeholder="Unlimited" style={inputStyle} />
                  </FormField>
                  <FormField label="Per Customer Limit" hint="Leave empty for unlimited">
                    <TextInput type="number" value={formData.usage_per_customer} onChange={(v) => setFormData({ ...formData, usage_per_customer: v })} placeholder="Unlimited" style={inputStyle} />
                  </FormField>
                  <FormField label="Priority" hint="Higher number = applied first">
                    <TextInput type="number" value={formData.priority} onChange={(v) => setFormData({ ...formData, priority: v })} placeholder="1" style={inputStyle} />
                  </FormField>
                  <div className="flex items-center">
                    <label
                      className="flex w-full items-center gap-3 px-3 h-9 rounded-md cursor-pointer transition hover:opacity-90"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}
                    >
                      {/* <input
                        type="checkbox"
                        checked={formData.is_stackable}
                        onChange={(e) => setFormData({ ...formData, is_stackable: e.target.checked })}
                        className="w-4 h-4 accent-[var(--accent)] cursor-pointer"
                      />
                      <span className="text-[13px] font-semibold">Stackable</span>
                      <span className="text-[10px] ml-auto" style={{ color: "var(--text-muted)" }}>Allow with other discounts</span> */}
                    </label>
                  </div>
                </div>
              </div>
            </section>

            {/* SCHEDULE & STATUS */}
            <section>
              <SectionHeader icon={CalendarIcon} title="Schedule & Status" subtitle="Control when the discount is live" />
              <div className="rounded-lg p-4" style={cardStyle}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField label="Start Date">
                    <TextInput type="datetime-local" value={formData.start_at} onChange={(v) => setFormData({ ...formData, start_at: v })} style={inputStyle} />
                  </FormField>
                  <FormField label="End Date">
                    <TextInput type="datetime-local" value={formData.end_at} onChange={(v) => setFormData({ ...formData, end_at: v })} style={inputStyle} />
                  </FormField>
                  <FormField label="Status" fullWidth>
                    <CustomModalSelect
                      value={formData.status}
                      onChange={(val) => setFormData({ ...formData, status: val })}
                      options={[
                        { value: "active", label: "Active" },
                        { value: "scheduled", label: "Scheduled" },
                        { value: "draft", label: "Draft" },
                        { value: "disabled", label: "Disabled" },
                      ]}
                      placeholder="Select Status"
                    />
                  </FormField>
                </div>
              </div>
            </section>
          </div>
        </form>

        {/* FOOTER */}
        <div
          className="px-5 sm:px-6 py-3.5 flex items-center justify-end gap-2.5 shrink-0"
          style={{ borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}
        >
          <button
            type="button"
            onClick={() => { setShowModal(false); resetForm(); }}
            disabled={saveMutation.isPending}
            className="h-9 px-4 rounded-md text-[13px] font-semibold transition hover:opacity-80 disabled:opacity-50"
            style={{ backgroundColor: "transparent", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            className="h-9 px-5 rounded-md text-[13px] font-bold flex items-center gap-2 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
          >
            {saveMutation.isPending ? (
              <><Spinner className="w-4 h-4" /> Saving...</>
            ) : (
              editingDiscount ? "Update Discount" : "Create Discount"
            )}
          </button>
        </div>
      </div>

      {/* PRODUCT DETAILS POPUP */}
      {viewingProduct && (
        <ProductDetailsModal
          product={viewingProduct}
          onClose={() => setViewingProduct(null)}
        />
      )}
    </div>
  );
}

/* ==================== SELECTION MODAL (same as Deals) ==================== */
function SelectionModal({ type, items, selectedIds, onClose, onApply, inputStyle, cardStyle }) {
  const [search, setSearch] = useState("");
  const [draftIds, setDraftIds] = useState(selectedIds.map(id => String(id?._id || id)));

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return items;
    return items.filter((item) => getName(item, type).toLowerCase().includes(term));
  }, [items, search, type]);

  const title = type === "product" ? "Products" : type === "category" ? "Categories" : "Brands";
  const TypeIcon = type === "product" ? BoxIcon : type === "category" ? FolderIcon : AwardIcon;
  const toggle = (id) => {
    const cleanId = String(id?._id || id);
    setDraftIds((prev) => prev.includes(cleanId) ? prev.filter((x) => x !== cleanId) : [...prev, cleanId]);
  };
  const clearAll = () => setDraftIds([]);

  const totalDraftValue = useMemo(() => {
    if (type !== "product") return 0;
    return items.reduce((sum, item) => {
      const id = String(item?._id || item?.id);
      if (!draftIds.includes(id)) return sum;
      return sum + getProductPrice(item);
    }, 0);
  }, [items, draftIds, type]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div
        className="w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden rounded-xl shadow-2xl"
        style={cardStyle}
      >
        {/* HEADER */}
        <div
          className="px-5 py-3.5 flex items-center justify-between gap-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
            >
              <TypeIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold truncate">Select {title}</h3>
              <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                Multi-select {title.toLowerCase()} to include in this discount
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-md transition hover:bg-red-500/10 hover:text-red-500"
            style={{ color: "var(--text-muted)" }}
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* SEARCH */}
        <div className="px-4 py-3 shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}>
              <SearchIcon />
            </span>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}...`}
              className="w-full h-9 pl-9 pr-3 rounded-md text-[13px] outline-none transition focus:ring-2 focus:ring-[var(--accent)]/30"
              style={inputStyle}
            />
          </div>
        </div>

        {/* LIST */}
        <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
          {filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No {title.toLowerCase()} found</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((item) => {
                const id = getId(item);
                const selected = draftIds.includes(id);
                const price = type === "product" ? getProductPrice(item) : 0;
                const image = type === "product" ? getProductImage(item) : null;

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition"
                    style={{
                      backgroundColor: selected ? "rgba(16,185,129,0.10)" : "transparent",
                      border: `1px solid ${selected ? "rgba(16,185,129,0.30)" : "transparent"}`,
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
                    }}
                    onMouseLeave={(e) => {
                      if (!selected) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <span
                      className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: selected ? "var(--accent)" : "transparent",
                        borderColor: selected ? "var(--accent)" : "var(--border-color)",
                        color: "var(--accent-text)",
                      }}
                    >
                      {selected && <CheckIcon className="w-3 h-3" />}
                    </span>

                    {type === "product" ? (
                      <>
                        {image ? (
                          <img
                            src={image}
                            alt={getName(item, type)}
                            className="w-9 h-9 rounded-md object-cover shrink-0"
                            style={{ border: "1px solid var(--border-color)" }}
                            onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }}
                          />
                        ) : null}
                        <span
                          className="w-9 h-9 rounded-md shrink-0 items-center justify-center text-[10px] font-bold"
                          style={{
                            display: image ? "none" : "flex",
                            backgroundColor: "var(--bg-tertiary)",
                            color: "var(--text-muted)",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          {getInitials(getName(item, type))}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[13px] truncate ${selected ? "font-semibold" : "font-medium"}`}
                            style={{ color: selected ? "var(--accent)" : "var(--text-primary)" }}
                          >
                            {getName(item, type)}
                          </p>
                          <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
                            {formatCurrency(price)}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[10px] font-bold"
                          style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}
                        >
                          {getInitials(getName(item, type))}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[13px] truncate ${selected ? "font-semibold" : "font-medium"}`}
                            style={{ color: selected ? "var(--accent)" : "var(--text-primary)" }}
                          >
                            {getName(item, type)}
                          </p>
                        </div>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div
          className="px-4 py-3 flex items-center justify-between gap-2 shrink-0"
          style={{ borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{draftIds.length}</span> selected
              {type === "product" && draftIds.length > 0 && (
                <> · <span className="font-bold" style={{ color: "#34d399" }}>{formatCurrency(totalDraftValue)}</span></>
              )}
            </span>
            {draftIds.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] font-semibold underline hover:opacity-80"
                style={{ color: "var(--text-muted)" }}
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 rounded-md text-[12px] font-semibold transition hover:opacity-80"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onApply(draftIds)}
              className="h-9 px-4 rounded-md text-[12px] font-bold transition hover:brightness-110"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
            >
              Apply Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==================== SELECTED PRODUCT ROW (same as Deals) ==================== */
function SelectedProductRow({ product, price, image, onView, onRemove }) {
  const name = getName(product, "product");
  const variantCount = Array.isArray(product?.variants) ? product.variants.length : 0;

  return (
    <div
      className="flex items-center gap-3 p-2.5 rounded-md transition hover:opacity-95"
      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}
    >
      {image ? (
        <img
          src={image}
          alt={name}
          className="w-11 h-11 rounded-md object-cover shrink-0"
          style={{ border: "1px solid var(--border-color)" }}
          onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }}
        />
      ) : null}
      <span
        className="w-11 h-11 rounded-md shrink-0 items-center justify-center text-[11px] font-bold"
        style={{
          display: image ? "none" : "flex",
          backgroundColor: "var(--accent-soft)",
          color: "var(--accent)",
          border: "1px solid var(--border-color)",
        }}
      >
        {getInitials(name)}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
          {name}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[12px] font-bold font-mono" style={{ color: "#34d399" }}>
            {formatCurrency(price)}
          </span>
          {variantCount > 1 && (
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              · {variantCount} variants
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onView}
          className="h-8 px-2.5 rounded-md text-[11px] font-semibold flex items-center gap-1.5 transition hover:opacity-80"
          style={{
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            color: "var(--accent)",
          }}
          title="View attributes"
        >
          <InfoIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">View Attributes</span>
          <span className="sm:hidden">Details</span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="h-8 w-8 rounded-md flex items-center justify-center transition hover:bg-red-500/10 hover:text-red-500"
          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}
          title="Remove"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ==================== PRODUCT DETAILS MODAL (same as Deals) ==================== */
function ProductDetailsModal({ product, onClose }) {
  const name = getName(product, "product");
  const price = getProductPrice(product);
  const image = getProductImage(product);
  const attributes = getProductAttributes(product);
  const variantCount = Array.isArray(product?.variants) ? product.variants.length : 0;
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-xl shadow-2xl"
        style={cardStyle}
      >
        {/* HEADER */}
        <div
          className="px-5 py-3.5 flex items-center justify-between gap-3 shrink-0"
          style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
            >
              <BoxIcon className="h-5 h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold truncate">Product Details</h3>
              <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                Attributes and pricing information
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 rounded-md transition hover:bg-red-500/10 hover:text-red-500"
            style={{ color: "var(--text-muted)" }}
            title="Close"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-center gap-4 mb-5">
            {image ? (
              <img
                src={image}
                alt={name}
                className="w-16 h-16 rounded-lg object-cover shrink-0"
                style={{ border: "1px solid var(--border-color)" }}
                onError={(e) => { e.currentTarget.style.display = "none"; e.currentTarget.nextSibling.style.display = "flex"; }}
              />
            ) : null}
            <span
              className="w-16 h-16 rounded-lg shrink-0 items-center justify-center text-base font-bold"
              style={{
                display: image ? "none" : "flex",
                backgroundColor: "var(--accent-soft)",
                color: "var(--accent)",
                border: "1px solid var(--border-color)",
              }}
            >
              {getInitials(name)}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-bold truncate" style={{ color: "var(--text-primary)" }}>
                {name}
              </p>
              <p className="text-[18px] font-bold font-mono mt-0.5" style={{ color: "#34d399" }}>
                {formatCurrency(price)}
              </p>
              {variantCount > 0 && (
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                  {variantCount} {variantCount === 1 ? "variant" : "variants"} available
                </p>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <TagIcon className="h-3.5 h-3.5" />
              </span>
              <h4 className="text-[12px] font-bold uppercase tracking-wide">Attributes</h4>
              <span className="ml-auto text-[10px]" style={{ color: "var(--text-muted)" }}>
                {attributes.length} {attributes.length === 1 ? "attribute" : "attributes"}
              </span>
            </div>

            {attributes.length === 0 ? (
              <div className="rounded-md py-6 text-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  No attributes available for this product
                </p>
              </div>
            ) : (
              <div
                className="rounded-md overflow-hidden"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}
              >
                {attributes.map((attr, idx) => (
                  <div
                    key={`${attr.name}-${idx}`}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5"
                    style={{
                      borderTop: idx === 0 ? "none" : "1px solid var(--border-color)",
                    }}
                  >
                    <span className="text-[12px] font-semibold truncate" style={{ color: "var(--text-muted)" }}>
                      {attr.name}
                    </span>
                    <span className="text-[12px] font-bold text-right truncate max-w-[60%]" style={{ color: "var(--text-primary)" }}>
                      {attr.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div
          className="px-5 py-3 flex items-center justify-end shrink-0"
          style={{ borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-md text-[12px] font-bold transition hover:brightness-110"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}