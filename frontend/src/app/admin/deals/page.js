"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { dealApi } from "../../../apis/admin/dealApi";
import { productApi } from "../../../apis/admin/productApi";
import { categoryApi } from "../../../apis/admin/categoryApi";
import { brandApi } from "../../../apis/admin/brandApi";
import { attributeApi } from "../../../apis/admin/attributeApi";
import { toNonNegative, validateNonNegative } from "../discounts/_components/discountUtils";
import useDealSocketSync from "../../../hooks/useDealSocketSync"; 
import { DealFormModal, SelectionModal } from "./_components/dealModals";

/* ==================== CONSTANTS ==================== */
// ✅ Server-side pagination — ek request par yehi deals aati hain
const DEALS_PER_PAGE = 20;

/* ==================== ICONS ==================== */
const PlusIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const SearchIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const ListIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const GridIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>);
const EditIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>);
const TrashIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>);
const CloseIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>);
const ChevronDownIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>);
const ChevronLeftIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18l-6-6 6-6" /></svg>);
const ChevronRightIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18l6-6-6-6" /></svg>);
const Spinner = ({ className = "w-4 h-4" }) => (<svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>);
const DealIcon = ({ className = "w-5 h-5" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h16v5H4z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 7v14" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.5 7C7.1 7 6 5.9 6 4.5S7.1 2 8.5 2C10.5 2 12 7 12 7" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15.5 7C16.9 7 18 5.9 18 4.5S16.9 2 15.5 2C13.5 2 12 7 12 7" /></svg>);
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
const TruckIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>);
const DotsIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>);
const PowerIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 11-12.728 0M12 2v10" /></svg>);
const UploadIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M16 8l-4-4m0 0L8 8m4-4v12" /></svg>);
const ImageIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" /><circle cx="8.5" cy="8.5" r="1.5" /></svg>);

/* ==================== HELPERS ==================== */
const normalizeArrayResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.deals)) return response.deals;
  return [];
};

const getId = (item) => {
  if (!item) return "";
  if (typeof item === 'object') {
    return String(item._id || item.id || "");
  }
  return String(item);
};

const getName = (item, type) => {
  if (type === "product") return item?.name || item?.title || "Unnamed Product";
  if (type === "category") return item?.name || item?.categoryName || "Unnamed Category";
  if (type === "brand") return item?.name || item?.brandName || "Unnamed Brand";
  return item?.name || "Unnamed";
};

const getDealStatus = (deal) => {
  // ✅ Sirf Active/Inactive model — off (isActive false) ya expired sab "inactive"
  if (!deal?.isActive) return "inactive";
  const end = deal?.endDate ? new Date(deal.endDate) : null;
  if (end && end < new Date()) return "inactive";
  return "active";
};

const formatTarget = (target) => {
  if (!target) return "All Products";
  const map = { all: "All Products", product: "Specific Products", category: "Categories", brand: "Brands", collection: "Collections" };
  return map[target] || target;
};

const formatDealValue = (deal) => {
  const type = deal?.type || "";
  const value = Number(deal?.discountValue ?? 0); 
  switch (type) {
    case "percentage": return `${value}% OFF`;
    case "fixed_amount": case "fixed": return `Rs. ${value} OFF`;
    case "buy_x_get_y": {
      const buy = deal?.buyQuantity ?? 1;
      const get = deal?.getQuantity ?? 1;
      const disc = deal?.getDiscountValue ?? 100;
      return `Buy ${buy} Get ${get} (${disc === 100 ? "Free" : `${disc}% Off`})`;
    }
    case "free_shipping": return "Free Shipping";
    case "bundle": {
      const rule = deal?.bundleRule || deal?.bundle_rule || null;
      if (!rule) return "Bundle Deal";
      const buy = rule.buyQuantity || rule.buy_quantity || 1;
      if (rule.rewardType === "free_product" || rule.reward_type === "free_product") {
        const gift = rule.freeProductName || rule.freeProduct?.name || "Gift";
        const qty = rule.freeQuantity || rule.free_quantity || 1;
        return `Buy ${buy} → ${qty > 1 ? qty + "× " : ""}${gift} FREE`;
      }
      if (rule.rewardType === "percentage" || rule.reward_type === "percentage") {
        return `Buy ${buy} → ${rule.value || 0}% OFF`;
      }
      return `Buy ${buy} → Rs. ${rule.value || 0} OFF`;
    }
    default: return value > 0 ? `${value}` : "-";
  }
};

// ✅ CURRENCY FORMATTER
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amount || 0);
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
  // ✅ Sirf Active/Inactive — purani values (scheduled/expired/disabled) bhi inactive
  const config = {
    active: { text: "Active", bg: "var(--success-soft)", color: "var(--success-text)", border: "color-mix(in srgb, var(--success) 28%, transparent)" },
    inactive: { text: "Inactive", bg: "var(--danger-soft)", color: "var(--danger-text)", border: "color-mix(in srgb, var(--danger) 28%, transparent)" },
    scheduled: { text: "Inactive", bg: "var(--danger-soft)", color: "var(--danger-text)", border: "color-mix(in srgb, var(--danger) 28%, transparent)" },
    expired: { text: "Inactive", bg: "var(--danger-soft)", color: "var(--danger-text)", border: "color-mix(in srgb, var(--danger) 28%, transparent)" },
    disabled: { text: "Inactive", bg: "var(--danger-soft)", color: "var(--danger-text)", border: "color-mix(in srgb, var(--danger) 28%, transparent)" },
    draft: { text: "Inactive", bg: "var(--danger-soft)", color: "var(--danger-text)", border: "color-mix(in srgb, var(--danger) 28%, transparent)" },
  };
  const item = config[status] || config.inactive;
  return (
    <span className="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ backgroundColor: item.bg, color: item.color, border: `1px solid ${item.border}` }}>
      {item.text}
    </span>
  );
};

/* ==================== CUSTOM MODAL SELECT ==================== */
const CustomModalSelect = ({ value, onChange, options, placeholder, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (disabled) return;
    const next = !isOpen;
    if (next && buttonRef.current) {
      // Viewport-aware: open upward when there is not enough space below the trigger
      const rect = buttonRef.current.getBoundingClientRect();
      const MENU_HEIGHT = 200; // max-h-48 (192px) + margin
      setDropUp(window.innerHeight - rect.bottom < MENU_HEIGHT && rect.top > MENU_HEIGHT);
    }
    setIsOpen(next);
  };

  const selectedOption = options.find(o => o.value === value);
  const displayValue = selectedOption ? selectedOption.label : (value || placeholder);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button type="button" ref={buttonRef} onClick={handleToggle} disabled={disabled}
        className="flex h-10 md:h-9 w-full items-center justify-between rounded-md px-3 text-left text-[16px] md:text-[13px] outline-none transition disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
        <span className="truncate">{displayValue}</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className={`absolute z-[100] w-full overflow-y-auto rounded-md border shadow-xl max-h-48 animate-in fade-in zoom-in-95 duration-100 ${dropUp ? "bottom-full mb-1" : "mt-1"}`}
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

/* ==================== DROPDOWN MENU ITEM ==================== */
const MenuItem = ({ icon, label, onClick, danger, success }) => (
  <button
    role="menuitem"
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 transition hover:bg-white/5 ${danger ? "text-red-400 hover:bg-red-500/10" : success ? "text-emerald-400 hover:bg-emerald-500/10" : ""}`}
    style={{ color: danger || success ? undefined : "var(--text-primary)" }}
  >
    {icon} {label}
  </button>
);

/* ==================== MAIN COMPONENT ==================== */
export default function DealsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  
  // ✅ SERVER-SIDE PAGINATION — search / status / target / page sab backend par (DB-level).
  const [searchInput, setSearchInput] = useState(""); // input box (turant update)
  const [search, setSearch] = useState("");          // debounced value → API query
  const [statusFilter, setStatusFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all_targets");
  const [currentPage, setCurrentPage] = useState(1);

  // Typing ke dauran har keystroke par API hit na ho — 400ms debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? "grid" : "list";
    }
    return "list";
  });
  const [showModal, setShowModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [selector, setSelector] = useState({ open: false, type: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionMenu, setActionMenu] = useState(null); // { id, top, left }
  const [activeFormType, setActiveFormType] = useState(null);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const typeMenuRef = useRef(null);
  const { markSelfAction } = useDealSocketSync();

  const [formData, setFormData] = useState({
    name: "", code: "", description: "",
    target_type: "all",
    selected_product_ids: [], selected_category_ids: [], selected_brand_ids: [],
    value_type: "percentage", value: "", min_order_value: "",
    buy_quantity: "",
    get_quantity: "",
    get_discount_value: "",
    bundle_rule: {
      mode: "all", // "all" = all selected products | "limit" = custom quantity
      buy_quantity: "",
      reward_type: "percentage",
      value: "",
      gift_product_id: "",
      gift_quantity: 1,
    },
    bundle_rules: [{ buy_quantity: 2, reward_type: "percentage", value: "", gift_product_id: "", gift_quantity: 1 }],
    has_min_quantity: false, // New field for checkbox
    min_quantity: "",
    start_at: "", end_at: "", usage_limit: "", per_user_limit: "",
    status: "active", is_featured: false,
  });

  const { data: dealsResponse, isLoading, isFetching } = useQuery({
    queryKey: ["deals", "paginated", currentPage, search, statusFilter, targetFilter],
    queryFn: () =>
      dealApi.getPaginated({
        page: currentPage,
        limit: DEALS_PER_PAGE,
        search: search || "",
        status: statusFilter,
        applyTo: targetFilter === "all_targets" ? "all" : targetFilter,
      }),
    // Page/filter change par purani list retain hoti hai → table blink nahi karta
    placeholderData: (previousData) => previousData,
    retry: false,
  });
  // Backend sirf CURRENT PAGE ki deals bhejta hai → { deals, stats, pagination }
  const deals = useMemo(() => normalizeArrayResponse(dealsResponse?.deals ?? dealsResponse), [dealsResponse]);
  const pagination = dealsResponse?.pagination || {
    total: 0,
    page: currentPage,
    limit: DEALS_PER_PAGE,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
  const { data: productsResponse } = useQuery({ queryKey: ["deal-products"], queryFn: productApi.getAll, staleTime: 60000 });
  const products = useMemo(() => normalizeArrayResponse(productsResponse), [productsResponse]);
  const { data: categoriesResponse } = useQuery({ queryKey: ["deal-categories"], queryFn: categoryApi.getAll, staleTime: 60000 });
  const categories = useMemo(() => normalizeArrayResponse(categoriesResponse), [categoriesResponse]);
  const { data: brandsResponse } = useQuery({ queryKey: ["deal-brands"], queryFn: brandApi.getAll, staleTime: 60000 });
  const brands = useMemo(() => normalizeArrayResponse(brandsResponse), [brandsResponse]);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (typeMenuRef.current && !typeMenuRef.current.contains(event.target)) setIsTypeMenuOpen(false);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!actionMenu) return;
    const close = () => setActionMenu(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [actionMenu]);

  const resetForm = () => {
    setFormData({
      name: "", code: "", description: "", target_type: "all",
      selected_product_ids: [], selected_category_ids: [], selected_brand_ids: [],
      value_type: "percentage", value: "", min_order_value: "",
      buy_quantity: "", get_quantity: "", get_discount_value: "",
      bundle_rule: {
        mode: "all",
        buy_quantity: "",
        reward_type: "percentage",
        value: "",
        gift_product_id: "",
        gift_quantity: 1,
      },
    bundle_rules: [{ mode: "limit", buy_quantity: 2, reward_type: "percentage", value: "", gift_product_id: "", gift_quantity: 1 }],
      has_min_quantity: false,
      min_quantity: "",
      start_at: "", end_at: "", usage_limit: "", per_user_limit: "",
      status: "active", is_featured: false,
    });
    setEditingDeal(null);
    setSelector({ open: false, type: null });
    setActiveFormType(null);
  };

  const handleViewDeal = (id) => router.push(`${pathname}/${id}`);

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => (id ? dealApi.update(id, data) : dealApi.create(data)),
    onMutate: (_, variables) => markSelfAction(variables.id ? "update" : "create"),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success(variables.id ? "Deal updated successfully" : "Deal created successfully");
      setShowModal(false);
      resetForm();
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Failed to save deal"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids) => await Promise.all(ids.map((id) => dealApi.delete(id))),
    onMutate: () => markSelfAction("delete"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      setDeleteTarget(null);
      toast.success("Deal deleted successfully");
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Failed to delete deal"),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, newActive }) => dealApi.update(id, { isActive: newActive }),
    onMutate: (_, variables) => markSelfAction("update"),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success(variables.newActive ? "Deal activated" : "Deal deactivated");
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Failed to update status"),
  });

  // ✅ Search / status / target filtering ab backend par ho chuki hai — is liye yahan
  //    koi client-side filter/slice nahi. Jo data aaya wohi current page hai.
  const totalPages = Math.max(1, Number(pagination.totalPages) || 1);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (currentPage > totalPages) setCurrentPage(totalPages); }, [currentPage, totalPages]);

  // ✅ Stats ab server se aate hain (poori filtered dataset par, current page par nahi).
  //    Legacy response (stats missing) ho to current page data se fallback.
  const serverStats = dealsResponse?.stats || null;
  const stats = useMemo(() => {
    if (serverStats) {
      return {
        total: Number(serverStats.total) || 0,
        active: Number(serverStats.active) || 0,
        // ✅ Backend ab 'inactive' bhejta hai; purana response ho to baaqi se derive karo
        inactive: serverStats.inactive !== undefined && serverStats.inactive !== null
          ? Number(serverStats.inactive) || 0
          : Math.max(0, (Number(serverStats.total) || 0) - (Number(serverStats.active) || 0)),
      };
    }
    return {
      total: deals.length,
      active: deals.filter((d) => getDealStatus(d) === "active").length,
      inactive: deals.filter((d) => getDealStatus(d) === "inactive").length,
    };
  }, [serverStats, deals]);

  // ✅ Numbered pagination (Products page ke pattern ke mutabiq)
  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else if (currentPage <= 3) pages.push(1, 2, 3, 4, "...", totalPages);
    else if (currentPage >= totalPages - 2) pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    else pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    return pages;
  };

  const openEdit = (deal) => {
    // ✅ Backward compatible: missing/empty freeShippingMethods → BOTH methods
    const fsm = Array.isArray(deal?.freeShippingMethods) && deal.freeShippingMethods.length > 0
      ? deal.freeShippingMethods
      : ["standard", "express"];

    // Handle Min Quantity Logic on Edit
    const rawMinQty = deal?.minQuantity ?? deal?.min_quantity;
    const hasMinQty = rawMinQty !== null && rawMinQty !== undefined && rawMinQty !== "";

    setFormData({
      name: deal?.name || "", code: deal?.code || "", description: deal?.description || "",
      target_type: deal?.applyTo || "all",
      selected_product_ids: Array.isArray(deal?.productIds) ? deal.productIds.map(getId) : [],
      selected_category_ids: Array.isArray(deal?.categoryIds) ? deal.categoryIds.map(getId) : [],
      selected_brand_ids: Array.isArray(deal?.brandIds) ? deal.brandIds.map(getId) : [],

      value_type: deal?.type || "percentage",
      value: deal?.discountValue ?? "",
      min_order_value: deal?.minOrderValue ?? "",
      buy_quantity: deal?.buyQuantity ?? "",
      get_quantity: deal?.getQuantity ?? "",
      get_discount_value: deal?.getDiscountValue ?? "",
      // ✅ Single offer condition (bundle deal)
      bundle_rule: {
        mode: deal?.bundleRule?.mode === "limit" ? "limit" : "all",
        buy_quantity: deal?.bundleRule?.buyQuantity ?? "",
        reward_type: deal?.bundleRule?.rewardType || "percentage",
        value: deal?.bundleRule?.value ?? "",
        gift_product_id: String(
          deal?.bundleRule?.freeProduct?._id || deal?.bundleRule?.freeProduct || ""
        ),
        gift_quantity: deal?.bundleRule?.freeQuantity ?? 1,
      },
      bundle_rules: deal?.bundleRule ? [{
        buy_quantity: deal?.bundleRule?.buyQuantity ?? 2,
        reward_type: deal?.bundleRule?.rewardType || "percentage",
        value: deal?.bundleRule?.value ?? "",
        gift_product_id: String(
          deal?.bundleRule?.freeProduct?._id || deal?.bundleRule?.freeProduct || ""
        ),
        gift_quantity: deal?.bundleRule?.freeQuantity ?? 1,
      }] : [{ buy_quantity: 2, reward_type: "percentage", value: "", gift_product_id: "", gift_quantity: 1 }],
      
      has_min_quantity: hasMinQty,
      min_quantity: hasMinQty ? rawMinQty : "",
      
      start_at: toDateInput(deal?.startDate),
      end_at: toDateInput(deal?.endDate),
      usage_limit: deal?.usageLimit ?? "",
      per_user_limit: deal?.perUserLimit ?? "",
      status: deal?.isActive ? "active" : "inactive",
      is_featured: Boolean(deal?.isFeatured),
    });
    setEditingDeal(deal);
    setActiveFormType(deal?.applyTo || "all");
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!String(formData.name || "").trim()) return toast.error("Deal name is required");

    // ✅ Negative values block — Deal Offer, quantities, limits (input level pe bhi blocked)
    const nonNegativeError = validateNonNegative([
      ["Deal value", formData.value],
      ["Buy quantity", formData.buy_quantity],
      ["Get quantity", formData.get_quantity],
      ["Get discount value", formData.get_discount_value],
      ["Minimum quantity", formData.has_min_quantity ? formData.min_quantity : ""],
      ["Usage limit", formData.usage_limit],
      ["Per customer limit", formData.per_user_limit],
    ]);
    if (nonNegativeError) return toast.error(nonNegativeError);
    if (formData.has_min_quantity) {
      const minQuantity = Number(formData.min_quantity);
      if (!Number.isInteger(minQuantity) || minQuantity < 1) {
        return toast.error("Minimum quantity must be a whole number greater than 0");
      }
    }

    const dealValue = formData.value === "" ? NaN : Number(formData.value);
    if (["percentage", "fixed_amount"].includes(formData.value_type)) {
      if (Number.isNaN(dealValue) || dealValue < 0) return toast.error("Please enter a valid deal value");
      if (formData.value_type === "percentage" && dealValue > 100) return toast.error("Percentage cannot be greater than 100");
    }

    if (formData.value_type === "buy_x_get_y") {
      if (!formData.buy_quantity || Number(formData.buy_quantity) <= 0) return toast.error("Please enter a valid Buy Quantity");
      if (!formData.get_quantity || Number(formData.get_quantity) <= 0) return toast.error("Please enter a valid Get Quantity");
      if (formData.get_discount_value !== "" && Number(formData.get_discount_value) > 100) return toast.error("Discount on Get Item (%) cannot be greater than 100");
    }

    // ✅ Bundle deal — single offer condition validation
    if (formData.value_type === "bundle") {
      const rule = formData.bundle_rule || {};

      if (rule.mode === "limit") {
        const buyQty = Number(rule.buy_quantity);
        if (!buyQty || buyQty <= 0) {
          return toast.error("Bundle offer: enter the required quantity");
        }
      }

      if (rule.reward_type === "free_product") {
        if (!rule.gift_product_id) {
          return toast.error("Bundle offer: select the free gift product");
        }
      } else {
        const val = Number(rule.value);
        if (!val || val <= 0) {
          return toast.error("Bundle offer: enter a discount value greater than 0");
        }
        if (rule.reward_type === "percentage" && val > 100) {
          return toast.error("Bundle offer: percentage cannot be more than 100%");
        }
      }
    }

    if (formData.target_type === "product" && formData.selected_product_ids.length === 0) return toast.error("Select at least one product");
    if (formData.target_type === "category" && formData.selected_category_ids.length === 0) return toast.error("Select at least one category");
    if (formData.target_type === "brand" && formData.selected_brand_ids.length === 0) return toast.error("Select at least one brand");

    const startDate = formData.start_at ? dateToISO(formData.start_at) : new Date().toISOString();
    const endDate = formData.end_at ? dateToISO(formData.end_at) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    if (new Date(endDate) <= new Date(startDate)) return toast.error("End date must be after start date");

    const cleanProductIds = formData.selected_product_ids.map(id => String(id?._id || id));
    const cleanCategoryIds = formData.selected_category_ids.map(id => String(id?._id || id));
    const cleanBrandIds = formData.selected_brand_ids.map(id => String(id?._id || id));

    // Prepare Min Quantity Payload
    const finalMinQuantity = formData.has_min_quantity && formData.min_quantity 
      ? Number(formData.min_quantity) 
      : null;

    const payload = {
      name: String(formData.name).trim(),
      description: String(formData.description || "").trim() || undefined,
      applyTo: formData.target_type,
      productIds: formData.target_type === "product" ? cleanProductIds : [],
      categoryIds: formData.target_type === "category" ? cleanCategoryIds : [],
      brandIds: formData.target_type === "brand" ? cleanBrandIds : [],
      type: formData.value_type,
      discountValue: ["percentage", "fixed_amount"].includes(formData.value_type) ? dealValue : 0,
      buyQuantity: formData.buy_quantity ? Number(formData.buy_quantity) : 1,
      getQuantity: formData.get_quantity ? Number(formData.get_quantity) : 1,
      getDiscountValue: formData.get_discount_value ? Number(formData.get_discount_value) : 100,
      // ✅ Single bundle offer condition (bundle deal only)
      // ✅ Single bundle offer condition (bundle deal only)
      bundleRule:
        formData.value_type === "bundle" && formData.bundle_rule
          ? {
              mode: formData.bundle_rule.mode === "limit" ? "limit" : "all",
              buyQuantity: Math.max(0, Number(formData.bundle_rule.buy_quantity) || 0),
              rewardType: formData.bundle_rule.reward_type || "percentage",
              value:
                formData.bundle_rule.reward_type === "free_product"
                  ? 0
                  : Number(formData.bundle_rule.value) || 0,
              freeProduct:
                formData.bundle_rule.reward_type === "free_product"
                  ? formData.bundle_rule.gift_product_id || null
                  : null,
              freeQuantity:
                formData.bundle_rule.reward_type === "free_product"
                  ? Math.max(1, Number(formData.bundle_rule.gift_quantity) || 1)
                  : 1,
            }
          : null,
      minQuantity: finalMinQuantity, // Send null if unchecked
      startDate, endDate,
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

  const handleToggleStatus = (deal) => {
    const id = deal?._id || deal?.id;
    const isActive = getDealStatus(deal) === "active";
    toggleStatusMutation.mutate({ id, newActive: !isActive });
  };

  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  const dealTypes = [
    { key: "all", title: "All Products Deal", desc: "Apply deal on all products", icon: GlobeIcon },
    { key: "product", title: "Product Deal", desc: "Apply deal on specific products", icon: BoxIcon },
    { key: "category", title: "Category Deal", desc: "Apply deal on entire categories", icon: FolderIcon },
    { key: "brand", title: "Brand Deal", desc: "Apply deal on specific brands", icon: AwardIcon },
  ];

  const openDealForm = (type) => {
    resetForm();
    setIsTypeMenuOpen(false);
    setActiveFormType(type);
    setFormData((prev) => ({ ...prev, target_type: type }));
    setShowModal(true);
  };

  const ActionButtons = ({ deal }) => {
    const id = deal._id || deal.id;
    const open = actionMenu?.id === id;

    const toggleMenu = (e) => {
      e.stopPropagation();
      if (open) { setActionMenu(null); return; }
      const rect = e.currentTarget.getBoundingClientRect();
      const menuHeight = 200;
      const menuWidth = 176;
      const top = rect.bottom + 6 + menuHeight > window.innerHeight
        ? rect.top - 6 - menuHeight
        : rect.bottom + 6;
      const left = Math.max(8, rect.right - menuWidth);
      setActionMenu({ id, top, left });
    };

    return (
      <div className="flex items-center justify-end">
        <button
          onClick={toggleMenu}
          aria-label={`Actions for ${deal?.name || "deal"}`}
          aria-haspopup="menu"
          aria-expanded={open}
          className="min-w-[44px] min-h-[44px] p-2 rounded-md transition hover:bg-white/5 flex items-center justify-center"
          style={{ color: "var(--text-secondary)" }}
          title="Actions"
        >
          <DotsIcon className="w-4 h-4" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActionMenu(null); }} />
            <div
              role="menu"
              onClick={(e) => e.stopPropagation()}
              className="fixed z-50 w-44 rounded-lg shadow-xl border py-1"
              style={{
                top: actionMenu.top,
                left: actionMenu.left,
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border-color)",
              }}
            >
              <MenuItem
                icon={<EyeIcon className="w-4 h-4" />}
                label="View Details"
                onClick={() => { setActionMenu(null); handleViewDeal(id); }}
              />
              <MenuItem
                icon={<EditIcon className="w-4 h-4" />}
                label="Edit Deal"
                onClick={() => { setActionMenu(null); openEdit(deal); }}
              />
              <MenuItem
                icon={<PowerIcon className="w-4 h-4" />}
                label={getDealStatus(deal) === "active" ? "Deactivate" : "Activate"}
                danger={getDealStatus(deal) === "active"}
                success={getDealStatus(deal) !== "active"}
                onClick={() => { setActionMenu(null); handleToggleStatus(deal); }}
              />
              <div className="my-1 mx-2 border-t" style={{ borderColor: "var(--border-color)" }} />
              <MenuItem
                icon={<TrashIcon className="w-4 h-4" />}
                label="Delete"
                danger
                onClick={() => { setActionMenu(null); setDeleteTarget([deal]); }}
              />
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-5 p-4 md:p-0">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight">Deal Management</h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Create and manage professional deals for your store.</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setViewMode("list")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title="List view"><ListIcon /></button>
              <button type="button" onClick={() => setViewMode("grid")} className="h-9 w-9 rounded-lg flex items-center justify-center transition" style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} title="Grid view"><GridIcon /></button>
            </div>
            <div className="relative shrink-0" ref={typeMenuRef}>
              <button type="button" onClick={() => setIsTypeMenuOpen((open) => !open)} aria-expanded={isTypeMenuOpen} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-[var(--accent-hover)] transition" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                <PlusIcon /> New Deal <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isTypeMenuOpen ? "rotate-180" : ""}`} />
              </button>
              {isTypeMenuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl p-1.5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-lg)" }}>
                  {dealTypes.map((dt) => {
                    const Icon = dt.icon;
                    return (
                      <button key={dt.key} type="button" onClick={() => openDealForm(dt.key)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[var(--bg-tertiary)]">
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
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard title="Total Deals" value={stats.total} cardStyle={cardStyle} />
          <StatCard title="Active" value={stats.active} valueClass="text-emerald-500" cardStyle={cardStyle} />
          <StatCard title="Inactive" value={stats.inactive} valueClass="text-red-400" cardStyle={cardStyle} />
        </div>

        {/* ===== Professional Toolbar: Search Left, Filters Right ===== */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          
          {/* Wider Search Bar (Left Side) */}
          <div className="relative w-full md:w-[400px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
            <input 
              type="text" 
              placeholder="Search deal name or code..." 
              value={searchInput} 
              onChange={(e) => setSearchInput(e.target.value)} 
              className="w-full h-9 pl-9 pr-3 rounded-lg text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" 
              style={inputStyle} 
            />
          </div>

          {/* Filters (Right Side) */}
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Select value={statusFilter} onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }} inputStyle={inputStyle} options={[["all", "All Status"], ["active", "Active"], ["inactive", "Inactive"]]} />
            <Select value={targetFilter} onChange={(v) => { setTargetFilter(v); setCurrentPage(1); }} inputStyle={inputStyle} options={[["all_targets", "All Targets"], ["all", "All Products"], ["product", "Specific Products"], ["category", "Categories"], ["brand", "Brands"]]} />
          </div>
        </div>

        {/* TABLE / GRID DISPLAY */}
        {isLoading ? (
          /* ✅ SKELETON — spinner ki jagah real layout ka skeleton:
             list view me wahi table shell + shimmer rows, grid view me shimmer cards */
          viewMode === "list" ? (
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
                  <DealRowsSkeleton rows={DEALS_PER_PAGE} />
                </table>
              </div>
            </div>
          ) : (
            <DealCardsSkeleton cards={8} cardStyle={cardStyle} />
          )
        ) : deals.length === 0 ? (
          <div className="rounded-lg py-14 flex flex-col items-center justify-center" style={cardStyle}>
            <DealIcon className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              {searchInput || statusFilter !== "all" || targetFilter !== "all_targets" ? "No deals match your filters" : "No deals created yet"}
            </p>
          </div>
        ) : viewMode === "list" ? (
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
                  {deals.map((deal, index) => {
                    const id = deal?._id || deal?.id;
                    const status = getDealStatus(deal);
                    return (
                      <tr key={id} onClick={() => handleViewDeal(id)} style={{ borderBottom: index < deals.length - 1 ? "1px solid var(--border-color)" : "none" }} className="hover:bg-white/[0.02] transition cursor-pointer">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}><DealIcon className="w-4 h-4" /></div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate max-w-[220px]">{deal?.name || "Untitled Deal"}</p>
                              <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{deal?.code || "—"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>{formatTarget(deal?.applyTo)}</td>
                        <td className="px-4 py-3"><span className="font-bold text-emerald-500">{formatDealValue(deal)}</span></td>
                        <td className="px-4 py-3"><StatusBadge status={status} /></td>
                        <td className="px-4 py-3 whitespace-nowrap w-1"><ActionButtons deal={deal} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {deals.map((deal) => (
              <div key={deal._id || deal.id} onClick={() => handleViewDeal(deal._id || deal.id)} className="rounded-lg p-4 flex flex-col gap-3 transition hover:-translate-y-0.5 cursor-pointer" style={cardStyle}>
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}><DealIcon className="w-5 h-5" /></div>
                  <StatusBadge status={getDealStatus(deal)} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[13px] truncate">{deal?.name || "Untitled Deal"}</p>
                  <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>{deal?.code || "—"}</p>
                </div>
                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
                  <span className="text-[12px] font-bold" style={{ color: "var(--success-text)" }}>{formatDealValue(deal)}</span>
                  <ActionButtons deal={deal} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ✅ PAGINATION (server-side) */}
        {totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-4 rounded-lg p-4 sm:flex-row" style={cardStyle}>
            <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              Showing {pagination.total === 0 ? 0 : (currentPage - 1) * DEALS_PER_PAGE + 1}-{Math.min(currentPage * DEALS_PER_PAGE, pagination.total)} of {pagination.total} deals
              {isFetching && !isLoading && <span className="ml-2 opacity-70">• loading...</span>}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" disabled={currentPage === 1 || isFetching} onClick={() => setCurrentPage((pg) => Math.max(1, pg - 1))} className="flex h-8 w-8 items-center justify-center rounded-md transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} aria-label="Previous page"><ChevronLeftIcon className="h-4 w-4" /></button>
              {renderPageNumbers().map((pg, i) =>
                pg === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-[13px]" style={{ color: "var(--text-muted)" }}>…</span>
                ) : (
                  <button key={pg} type="button" disabled={isFetching} onClick={() => setCurrentPage(pg)} className="flex h-8 min-w-[2rem] items-center justify-center rounded-md px-2 text-[13px] font-medium transition" style={pg === currentPage ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}>{pg}</button>
                )
              )}
              <button type="button" disabled={currentPage >= totalPages || isFetching} onClick={() => setCurrentPage((pg) => Math.min(totalPages, pg + 1))} className="flex h-8 w-8 items-center justify-center rounded-md transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} aria-label="Next page"><ChevronRightIcon className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showModal && (
        <DealFormModal formType={activeFormType} formData={formData} setFormData={setFormData} editingDeal={editingDeal} saveMutation={saveMutation} setShowModal={setShowModal} resetForm={resetForm} setSelector={setSelector} getSelectedItems={getSelectedItems} handleSubmit={handleSubmit} inputStyle={inputStyle} products={products} categories={categories} brands={brands} />
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
/* =========================================================
   SKELETON LOADING UI — existing `.skeleton` shimmer utility (globals.css) reuse
   ✅ Wahi pattern jo products page par use hua hai: wrapper, paddings aur column
      widths real table / grid cards jaise hi rakhe gaye hain, is liye data aane
      par layout shift nahi hota (pehle yahan sirf spinner tha).
   ✅ Sirf loading state ke liye — real table/grid design me koi change nahi.
========================================================= */
// `.skeleton` (globals.css) apna border-radius deta hai, is liye pills ke liye inline radius
const SKELETON_ROUND = { borderRadius: "9999px" };

function DealRowsSkeleton({ rows = DEALS_PER_PAGE }) {
  return (
    <tbody aria-busy="true" aria-label="Loading deals">
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`deal-skeleton-${i}`} style={{ borderBottom: "1px solid var(--border-color)" }}>
          {/* deal — icon + name + code */}
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="skeleton h-9 w-9 shrink-0 rounded-lg" />
              <div className="min-w-0">
                <span className="skeleton block h-3 w-[140px] rounded" />
                <span className="skeleton mt-1.5 block h-2.5 w-[70px] rounded" />
              </div>
            </div>
          </td>
          {/* applies to */}
          <td className="px-4 py-3"><span className="skeleton inline-block h-3 w-[80px] rounded align-middle" /></td>
          {/* offer */}
          <td className="px-4 py-3"><span className="skeleton inline-block h-3 w-[54px] rounded align-middle" /></td>
          {/* status badge */}
          <td className="px-4 py-3"><span className="skeleton inline-block h-5 w-[66px] align-middle" style={SKELETON_ROUND} /></td>
          {/* actions */}
          <td className="px-4 py-3 whitespace-nowrap w-1">
            <div className="flex items-center justify-end"><span className="skeleton block h-[38px] w-[44px] rounded-md" /></div>
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function DealCardsSkeleton({ cards = 8, cardStyle }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" aria-busy="true" aria-label="Loading deals">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={`deal-card-skeleton-${i}`} className="rounded-lg p-4 flex flex-col gap-3" style={cardStyle}>
          <div className="flex items-start justify-between">
            <span className="skeleton h-10 w-10 shrink-0 rounded-lg" />
            <span className="skeleton inline-block h-5 w-[66px]" style={SKELETON_ROUND} />
          </div>
          <div className="min-w-0">
            <span className="skeleton block h-3 w-[75%] rounded" />
            <span className="skeleton mt-1.5 block h-2.5 w-[40%] rounded" />
          </div>
          <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
            <span className="skeleton inline-block h-3 w-[52px] rounded align-middle" />
            <span className="skeleton block h-[38px] w-[44px] rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, value, valueClass = "", cardStyle }) {
  return (<div className="rounded-lg p-4" style={cardStyle}>
    <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{title}</p>
    <p className={`text-[20px] font-bold mt-1 ${valueClass}`}>{value}</p>
  </div>);
}

function Select({ value, onChange, options, inputStyle }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none h-9 w-[170px] pl-3 pr-8 rounded-lg text-[13px] outline-none cursor-pointer" style={inputStyle}>
        {options.map(([val, label]) => (<option key={`${val}-${label}`} value={val}>{label}</option>))}
      </select>
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "var(--text-muted)" }}><ChevronDownIcon className="w-3.5 h-3.5" /></span>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, inputStyle }) {
  return (<div>
    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{label}</label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-10 md:h-9 px-3 rounded-md text-[16px] md:text-[13px] w-full outline-none" style={inputStyle} />
  </div>);
}

/* ==================== SECTION HEADER (REUSABLE) ==================== */
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

// ✅ Deal form ke number inputs kabhi negative nahi ho sakte (nonNegative default) —
// "-"/"+"/"e"/"E" type nahi hota, paste par sign hat jata hai, min=0 aur spinner bhi 0 se neeche nahi jata.
const TextInput = ({ value, onChange, placeholder, type = "text", style, disabled, min, max, nonNegative = type === "number", integer = false }) => (
  <input
    type={type}
    value={value || ""}
    min={nonNegative ? (min ?? 0) : min}
    max={max}
    step={nonNegative && type === "number" ? (integer ? 1 : "any") : undefined}
    inputMode={nonNegative ? (integer ? "numeric" : "decimal") : undefined}
    onChange={(e) => {
      const next = nonNegative ? toNonNegative(e.target.value, integer) : e.target.value;
      // ✅ Upper bound (e.g. discount percentage max 100) — typing/paste se hi clamp ho jata hai
      const clamped = max !== undefined && next !== "" && Number(next) > max ? String(max) : next;
      onChange(clamped);
    }}
    onKeyDown={nonNegative ? (e) => {
      // ✅ "-", "+", "e", "E" type karne hi nahi dena (negative value block)
      if (["-", "+", "e", "E"].includes(e.key)) e.preventDefault();
    } : undefined}
    onWheel={nonNegative ? (e) => e.currentTarget.blur() : undefined}
    placeholder={placeholder}
    disabled={disabled}
    className="h-9 w-full rounded-md px-3 text-sm outline-none transition focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50 disabled:cursor-not-allowed"
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

/* ==================== BUNDLE IMAGE UPLOADER ==================== */
function BundleImageUploader({ value, onChange }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const preview = value
    ? value.startsWith("http") || value.startsWith("blob:") || value.startsWith("data:")
      ? value
      : `${API_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`
    : null;

  const uploadFile = async (file) => {
    if (!file) return;
    if (!file.type?.startsWith("image/")) return toast.error("Please select a valid image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image size must be less than 5MB");

    setUploading(true);
    try {
      const url = await dealApi.uploadImage(file);
      if (!url) throw new Error("Image upload failed");
      onChange(url);
      toast.success("Bundle image uploaded");
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || "Failed to upload bundle image");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <label className="block text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
          Bundle Image <span className="text-red-500">*</span>
        </label>
        {preview && (
          <button
            type="button"
            onClick={handleRemove}
            className="text-[11px] font-semibold transition hover:opacity-70"
            style={{ color: "var(--danger)" }}
          >
            Remove
          </button>
        )}
      </div>

      <div
        onClick={() => !uploading && !preview && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!preview && !uploading) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          if (!preview && !uploading) uploadFile(e.dataTransfer.files?.[0]);
        }}
        className={`relative w-full rounded-lg border-2 border-dashed p-3 transition ${preview ? "cursor-default" : "cursor-pointer"}`}
        style={{
          borderColor: isDragging || preview ? "var(--accent)" : "var(--border-color)",
          backgroundColor: isDragging ? "var(--accent-soft)" : "var(--bg-tertiary)",
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Bundle"
            className="w-full h-40 object-cover rounded-md"
            style={{ border: "1px solid var(--border-color)" }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <span
              className="flex h-11 w-11 items-center justify-center rounded-full mb-2"
              style={{ backgroundColor: "var(--bg-secondary)", color: isDragging ? "var(--accent)" : "var(--text-muted)" }}
            >
              {uploading ? <Spinner className="h-5 w-5" /> : <UploadIcon className="h-5 w-5" />}
            </span>
            <p className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {uploading ? "Uploading image..." : isDragging ? "Drop image here" : "Click to upload or drag & drop"}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>PNG, JPG or WEBP — max 5MB</p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
          }}
        />
      </div>

      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        Ye image bundle deal card aur storefront par dikhayi jayegi.
      </p>
    </div>
  );
}
