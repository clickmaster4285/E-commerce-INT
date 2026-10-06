"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { discountApi } from "../../../apis/admin/discountApi";
import { productApi } from "../../../apis/admin/productApi";
import { categoryApi } from "../../../apis/admin/categoryApi";
import { brandApi } from "../../../apis/admin/brandApi";
import { attributeApi } from "../../../apis/admin/attributeApi";
import useDiscountSocketSync from "../../../hooks/useDiscountSocketSync";
import { toNonNegative, validateNonNegative } from "./_components/discountUtils";
import { DiscountFormModal, SelectionModal } from "./_components/discountModals";

/* ==================== ICONS ==================== */
const PlusIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>);
const SearchIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>);
const ListIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>);
const GridIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /></svg>);
const EditIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>);
const TrashIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" /></svg>);
const DotsIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>);
const PowerIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 11-12.728 0M12 2v10" /></svg>);
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
// ✅ Rupee icon — "Fixed Amount / Fixed Price" wale discount type ke liye (badge look)
const RupeeIcon = ({ className = "w-4 h-4" }) => (<svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3h12M6 8h12M6 13h3m-3 0 8.5 8M9 13c6.667 0 6.667-10 0-10" /></svg>);

/* ==================== HELPERS ==================== */
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
  // ✅ Sirf Active/Inactive model — scheduled/expired/disabled/draft sab "inactive"
  const end = discount?.end_at || discount?.endDate;
  const isExpired = end && new Date(end) < new Date();
  if (discount?.isActive === false) return "inactive";
  if (["inactive", "disabled", "draft", "scheduled", "expired"].includes(discount?.status)) return "inactive";
  if (isExpired) return "inactive";
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
    active: { text: "Active", bg: "var(--success-soft)", color: "var(--success-text)", border: "color-mix(in srgb, var(--success) 28%, transparent)" },
    inactive: { text: "Inactive", bg: "var(--danger-soft)", color: "var(--danger-text)", border: "color-mix(in srgb, var(--danger) 28%, transparent)" },
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
      const MENU_HEIGHT = 264; // max-h-64 (256px) + margin (rich rows ke sath)
      setDropUp(window.innerHeight - rect.bottom < MENU_HEIGHT && rect.top > MENU_HEIGHT);
    }
    setIsOpen(next);
  };

  const selectedOption = options.find(o => o.value === value);
  const displayValue = selectedOption ? selectedOption.label : (value || placeholder);
  const SelectedIcon = selectedOption?.icon;

  return (
    <div className="relative w-full" ref={containerRef}>
      <button type="button" ref={buttonRef} onClick={handleToggle} disabled={disabled}
        className="flex h-10 md:h-9 w-full items-center justify-between gap-2 rounded-md px-3 text-left text-[16px] md:text-[13px] outline-none transition disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: value ? "var(--text-primary)" : "var(--text-muted)" }}>
        <span className="flex min-w-0 items-center gap-2">
          {SelectedIcon && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
              <SelectedIcon className="h-3 w-3" />
            </span>
          )}
          <span className="truncate">{displayValue}</span>
        </span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className={`absolute z-[100] w-full overflow-y-auto rounded-md border shadow-xl max-h-64 ${dropUp ? "bottom-full mb-1" : "mt-1"}`}
             style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-center" style={{ color: "var(--text-muted)" }}>No options available</div>
          ) : (
            options.map((opt) => {
              const active = value === opt.value;
              const OptionIcon = opt.icon;

              // ✅ Plain option (icon/description na ho) — purana simple row
              if (!OptionIcon && !opt.description) {
                return (
                  <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setIsOpen(false); }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-tertiary)] transition-colors"
                    style={{ color: active ? "var(--accent)" : "var(--text-primary)", backgroundColor: active ? "var(--accent-soft)" : "transparent" }}>
                    {opt.label}
                  </button>
                );
              }

              // ✅ Rich row — icon badge + title + example description + selected tick
              return (
                <button key={opt.value} type="button" onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-tertiary)]"
                  style={{
                    backgroundColor: active ? "var(--accent-soft)" : "transparent",
                    borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                  }}>
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: active ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      color: active ? "var(--accent)" : "var(--text-secondary)",
                    }}>
                    <OptionIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-semibold" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>
                      {opt.label}
                    </span>
                    {opt.description && (
                      <span className="mt-0.5 block text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>
                        {opt.description}
                      </span>
                    )}
                  </span>
                  {active && <CheckIcon className="mt-1 h-3.5 w-3.5 shrink-0" style={{ color: "var(--accent)" }} />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

/* ==================== SHARED FORM PIECES ==================== */
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
        {label} {required && <span className="normal-case" style={{ color: "var(--danger-text)" }}>*</span>}
      </label>
    )}
    {children}
    {hint && <p className="text-[10px] mt-1" style={{ color: "var(--text-muted)" }}>{hint}</p>}
  </div>
);

const TextInput = ({ value, onChange, placeholder, type = "text", style, disabled, className = "", min, max, nonNegative = false, integer = false }) => (
  <input
    type={type}
    value={value || ""}
    min={nonNegative ? (min ?? 0) : min}
    max={max}
    step={nonNegative && type === "number" ? (integer ? 1 : "any") : undefined}
    inputMode={nonNegative ? (integer ? "numeric" : "decimal") : undefined}
    onChange={(e) => {
      const next = nonNegative ? toNonNegative(e.target.value, integer) : e.target.value;
      // ✅ Upper bound (e.g. percentage max 100) — typing/paste se hi clamp ho jata hai
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
    className={`h-9 w-full rounded-md px-3 text-sm outline-none transition focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
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

/* =========================================================
   SKELETON LOADING UI — existing `.skeleton` shimmer utility (globals.css) reuse
   ✅ Wahi pattern jo products page par use hua hai: wrapper, paddings aur column
      widths real table / grid cards jaise hi rakhe gaye hain, is liye data aane
      par layout shift nahi hota (pehle yahan sirf spinner tha).
   ✅ Sirf loading state ke liye — real table/grid design me koi change nahi.
========================================================= */
// `.skeleton` (globals.css) apna border-radius deta hai, is liye pills ke liye inline radius
const SKELETON_ROUND = { borderRadius: "9999px" };

function DiscountRowsSkeleton({ rows = 10 }) {
  return (
    <tbody aria-busy="true" aria-label="Loading discounts">
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`discount-skeleton-${i}`} style={{ borderBottom: "1px solid var(--border-color)" }}>
          {/* checkbox */}
          <td className="px-4 py-3"><span className="skeleton block h-4 w-4 rounded" /></td>
          {/* discount — icon + name */}
          <td className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="skeleton h-9 w-9 shrink-0 rounded-lg" />
              <span className="skeleton inline-block h-3 w-[140px] rounded align-middle" />
            </div>
          </td>
          {/* applies to */}
          <td className="px-4 py-3"><span className="skeleton inline-block h-3 w-[80px] rounded align-middle" /></td>
          {/* value */}
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

function DiscountCardsSkeleton({ cards = 8, cardStyle }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" aria-busy="true" aria-label="Loading discounts">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={`discount-card-skeleton-${i}`} className="rounded-lg p-4 flex flex-col gap-3" style={cardStyle}>
          <div className="flex items-start justify-between">
            <span className="skeleton h-10 w-10 shrink-0 rounded-lg" />
            <span className="skeleton inline-block h-5 w-[66px]" style={SKELETON_ROUND} />
          </div>
          <span className="skeleton block h-3 w-[75%] rounded" />
          <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-color)" }}>
            <span className="skeleton inline-block h-3 w-[52px] rounded align-middle" />
            <span className="skeleton block h-[38px] w-[44px] rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ title, value, valueStyle, cardStyle }) {
  return (<div className="rounded-lg p-4 flex flex-col justify-center" style={cardStyle}>
    <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{title}</p>
    <p className="text-[20px] font-bold mt-1" style={valueStyle}>{value}</p>
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

/* ==================== PRODUCT HELPERS ==================== */
const getInitials = (name) => {
  if (!name) return "??";
  return name.split(" ").map((w) => w[0]).join("").substring(0, 2).toUpperCase();
};

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") ;
const getProductImage = (product) => {
  if (!product) return null;
  const raw = product?.variants?.[0]?.images?.[0]?.img_url;
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("blob:") || raw.startsWith("data:")) return raw;
  return raw.startsWith("/") ? `${API_ORIGIN}${raw}` : `${API_ORIGIN}/${raw}`;
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

// ✅ Flatten any attribute value shape (string / number / array / {value|label|name} / nested {Key: "val"})
const attrValueText = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(attrValueText).filter(Boolean).join(", ");
  if (typeof value === "object") {
    if ("value" in value) return attrValueText(value.value);
    if ("label" in value) return attrValueText(value.label);
    if ("name" in value) return attrValueText(value.name);
    // Nested objects like { "Exterior Color": "BLACK" } — join their values
    return Object.values(value).map(attrValueText).filter(Boolean).join(", ");
  }
  return "";
};

// ✅ Build a clean attribute list from product.specifications + variant.attributes
// Merges values by attribute name across all variants (de-duplicated, order preserved)
const getProductAttributes = (product) => {
  if (!product) return [];
  const byName = new Map();

  // Product-level specifications
  if (product.specifications && typeof product.specifications === "object") {
    Object.entries(product.specifications).forEach(([key, value]) => {
      const name = humanizeKey(key);
      if (!name) return;
      if (!byName.has(name)) byName.set(name, new Set());
      const valueText = attrValueText(value);
      if (valueText) byName.get(name).add(valueText);
    });
  }

  // Variant attributes — supports object form { Color: "Red" } and array form [{ name, value }]
  (product.variants || []).forEach((variant) => {
    const attrs = variant?.attributes;
    if (!attrs) return;
    const entries = Array.isArray(attrs)
      ? attrs.map((a) => [a?.name || a?.key || a?.attribute, a?.value ?? a?.values])
      : Object.entries(attrs);
    entries.forEach(([key, value]) => {
      const name = humanizeKey(key);
      if (!name) return;
      if (!byName.has(name)) byName.set(name, new Set());
      const valueText = attrValueText(value);
      if (valueText) byName.get(name).add(valueText);
    });
  });

  return [...byName.entries()]
    .filter(([, values]) => values.size > 0)
    .map(([name, values]) => ({ name, value: [...values].join(", ") }));
};

/* ==================== DROPDOWN MENU ITEM ==================== */
const MenuItem = ({ icon, label, onClick, danger, success }) => (
  <button
    role="menuitem"
    type="button"
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="w-full px-3 py-2.5 text-left text-[13px] flex items-center gap-2.5 transition hover:bg-[var(--bg-tertiary)]"
    style={{ color: danger ? "var(--danger-text)" : success ? "var(--success-text)" : "var(--text-primary)" }}
  >
    {icon} {label}
  </button>
);

/* ==================== MAIN COMPONENT ==================== */
export default function DiscountsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [actionMenu, setActionMenu] = useState(null); // { id, top, left }
  const [activeFormType, setActiveFormType] = useState(null);
  const [isTypeMenuOpen, setIsTypeMenuOpen] = useState(false);
  const typeMenuRef = useRef(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [formData, setFormData] = useState({
    name: "", code: "", description: "",
    selected_ids: [],
    value_type: "percentage", value: "",
    min_order_amount: "", 
    has_min_quantity: false,
    min_quantity: "",
    usage_limit: "", usage_per_customer: "",
    start_at: "", end_at: "", status: "active",
  });
  const [formErrors, setFormErrors] = useState({});

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

  useEffect(() => {
    const timer = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(timer);
  }, [search, statusFilter, targetFilter]);
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
      name: "", code: "", description: "",
      selected_ids: [],
      value_type: "percentage", value: "",
      min_order_amount: "", 
      has_min_quantity: false, 
      min_quantity: "",
      usage_limit: "", usage_per_customer: "",
      start_at: "", end_at: "", status: "active",
    });
    setEditingDiscount(null);
    setSelector({ open: false, type: null });
    setActiveFormType(null);
    setFormErrors({});
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
    onError: (error) => {
      const msg = error?.response?.data?.message || error?.message || "Failed to save discount";
      if (msg && msg.toLowerCase().includes("already exists")) {
        setFormErrors({ code: "This discount code already exists. Please use a different code." });
        return;
      }
      toast.error(msg);
    },
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

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, newStatus }) =>
      discountApi.update(id, {
        status: newStatus,
        isActive: newStatus === "active",
      }),
    onMutate: () => markSelfAction("update"),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["discounts"] });
      toast.success(variables.newStatus === "active" ? "Discount activated" : "Discount deactivated");
    },
    onError: (error) => toast.error(error?.response?.data?.message || error?.message || "Failed to update status"),
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

  const paginatedDiscounts = discounts; 
  const totalPages = pagination.pages || 1;
  const totalDiscounts = pagination.total || discounts.length;

  // ✅ Stats server se aate hain (poora dataset — search respect, status se independent).
  //    Purana response (stats missing) ho to current page se fallback.
  const serverStats = paginatedDiscountsData?.stats || null;
  const stats = useMemo(() => {
    if (serverStats) {
      return {
        total: Number(serverStats.total) || 0,
        active: Number(serverStats.active) || 0,
        inactive: serverStats.inactive !== undefined && serverStats.inactive !== null
          ? Number(serverStats.inactive) || 0
          : Math.max(0, (Number(serverStats.total) || 0) - (Number(serverStats.active) || 0)),
      };
    }
    return {
      total: discounts.length,
      active: discounts.filter((d) => getDiscountStatus(d) === "active").length,
      inactive: discounts.filter((d) => getDiscountStatus(d) === "inactive").length,
    };
  }, [serverStats, discounts]);

  const openEdit = (discount) => {
    const rawTarget = discount?.target_type || discount?.applyTo || "all_products";
    let type = "all";
    if (rawTarget === "specific_products" || rawTarget === "product") type = "product";
    else if (rawTarget === "specific_categories" || rawTarget === "category") type = "category";
    else if (rawTarget === "specific_brands" || rawTarget === "brand") type = "brand";

    let selected_ids = [];
    if (type === "product") selected_ids = (discount?.selectedProducts || discount?.selected_product_ids || discount?.productIds || []).map(getId);
    else if (type === "category") selected_ids = (discount?.selectedCategories || discount?.selected_category_ids || discount?.categoryIds || []).map(getId);
    else if (type === "brand") selected_ids = (discount?.selectedBrands || discount?.selected_brand_ids || discount?.brandIds || []).map(getId);

    const rawMinQty = discount?.min_quantity ?? discount?.minQuantity;
    const hasMinQty = rawMinQty !== null && rawMinQty !== undefined && rawMinQty !== "";

    setFormData({
      name: discount?.name || "", code: discount?.code || "", description: discount?.description || "",
      selected_ids,
      value_type: discount?.value_type || (discount?.type === "fixed" ? "fixed_amount" : "percentage"),
      value: discount?.value ?? "",
      min_order_amount: discount?.min_order_amount ?? discount?.minOrderValue ?? "",
      has_min_quantity: hasMinQty,
      min_quantity: hasMinQty ? rawMinQty : "",
      usage_limit: discount?.usage_limit ?? discount?.usageLimit ?? "",
      usage_per_customer: discount?.usage_per_customer ?? discount?.perUserLimit ?? "",
      start_at: toDateInput(discount?.start_at || discount?.startDate),
      end_at: toDateInput(discount?.end_at || discount?.endDate),
      // ✅ Form options "active"/"disabled" hain — prefill usi value me karo
      // warna select khaali (placeholder) dikhta hai
      status: discount?.status === "active" ? "active" : "disabled",
    });
    setEditingDiscount(discount);
    setActiveFormType(type);
    setShowModal(true);
  };

  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId || !discounts.length) return;
    const discount = discounts.find((item) => String(item?._id || item?.id) === editId);
    if (!discount) return;
    const timer = setTimeout(() => openEdit(discount), 0);
    router.replace(pathname, { scroll: false });
    return () => clearTimeout(timer);
  }, [discounts, pathname, router, searchParams]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormErrors({});
    if (!String(formData.name || "").trim()) return toast.error("Discount name is required");
    const manualCode = String(formData.code || "").trim();
    if (!manualCode) {
      setFormErrors({ code: "Discount code is required." });
      return;
    }
    if (formData.value === "" || !Number.isFinite(Number(formData.value))) return toast.error("Valid discount value is required");
    if (Number(formData.value) < 0) return toast.error("Discount value cannot be less than 0");
    if (formData.value_type === "percentage" && Number(formData.value) > 100) return toast.error("Percentage cannot exceed 100");

    // ✅ Discount value aur limits 0 se kam kabhi nahi (negative values block)
    const nonNegativeError = validateNonNegative([
      ["Discount value", formData.value],
      ["Minimum order amount", formData.min_order_amount],
      ["Minimum quantity", formData.has_min_quantity ? formData.min_quantity : ""],
      ["Total usage limit", formData.usage_limit],
      ["Per customer limit", formData.usage_per_customer],
    ]);
    if (nonNegativeError) return toast.error(nonNegativeError);

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

    const finalMinQuantity = formData.has_min_quantity && formData.min_quantity 
      ? Number(formData.min_quantity) 
      : null;

    const payload = {
      name: String(formData.name).trim(),
      code: manualCode.toUpperCase(),
      description: String(formData.description || "").trim() || undefined,
      target_type, applyTo,
      value_type: formData.value_type,
      type: formData.value_type === "fixed_amount" ? "fixed" : formData.value_type,
      value: Number(formData.value),
      min_order_amount: formData.min_order_amount !== "" ? Number(formData.min_order_amount) : undefined,
      min_quantity: finalMinQuantity,
      usage_limit: formData.usage_limit !== "" ? Number(formData.usage_limit) : undefined,
      usage_per_customer: formData.usage_per_customer !== "" ? Number(formData.usage_per_customer) : undefined,
      start_at: startDate, end_at: endDate,
      status: formData.status,
      isActive: formData.status === "active",
      ...payloadExtras,
    };

    Object.keys(payload).forEach((key) => { if (payload[key] === undefined || payload[key] === null || payload[key] === "") delete payload[key]; });
    saveMutation.mutate({ id: editingDiscount?._id || editingDiscount?.id || null, data: payload });
  };

   const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.map((d) => d?._id || d?.id));
  };

  const handleToggleStatus = (discount) => {
    const id = discount?._id || discount?.id;
    const isActive = getDiscountStatus(discount) === "active";
    toggleStatusMutation.mutate({ id, newStatus: isActive ? "disabled" : "active" });
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

  const ActionButtons = ({ discount }) => {
    const id = discount._id || discount.id;
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
          aria-label={`Actions for ${discount?.name || "discount"}`}
          aria-haspopup="menu"
          aria-expanded={open}
          className="min-w-[44px] min-h-[44px] p-2 rounded-md transition hover:bg-[var(--bg-tertiary)] flex items-center justify-center"
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
                onClick={() => { setActionMenu(null); handleView(id); }}
              />
              <MenuItem
                icon={<EditIcon className="w-4 h-4" />}
                label="Edit Discount"
                onClick={() => { setActionMenu(null); openEdit(discount); }}
              />
              <MenuItem
                icon={<PowerIcon className="w-4 h-4" />}
                label={getDiscountStatus(discount) === "active" ? "Deactivate" : "Activate"}
                danger={getDiscountStatus(discount) === "active"}
                success={getDiscountStatus(discount) !== "active"}
                onClick={() => { setActionMenu(null); handleToggleStatus(discount); }}
              />
              <div className="my-1 mx-2 border-t" style={{ borderColor: "var(--border-color)" }} />
              <MenuItem
                icon={<TrashIcon className="w-4 h-4" />}
                label="Delete"
                danger
                onClick={() => { setActionMenu(null); setDeleteTarget([discount]); }}
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
        
        {/* ==================== HEADER SECTION ==================== */}
        <div className="flex flex-col gap-5">
          
          {/* Title & Actions Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-[24px] leading-7 font-bold tracking-tight">Discount Management</h1>
              <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>Create and manage promotional discounts for your store.</p>
            </div>
            
            <div className="flex items-center gap-2">
              {/* View Toggle Buttons */}
              <div className="flex items-center gap-1 mr-2">
                <button 
                  type="button" 
                  onClick={() => setViewMode("list")} 
                  className="h-9 w-9 rounded-lg flex items-center justify-center transition" 
                  style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} 
                  title="List view"
                >
                  <ListIcon />
                </button>
                <button 
                  type="button" 
                  onClick={() => setViewMode("grid")} 
                  className="h-9 w-9 rounded-lg flex items-center justify-center transition" 
                  style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle} 
                  title="Grid view"
                >
                  <GridIcon />
                </button>
              </div>

              {/* Add Button Dropdown */}
              <div className="relative shrink-0" ref={typeMenuRef}>
                <button 
                  type="button" 
                  onClick={() => setIsTypeMenuOpen((open) => !open)} 
                  aria-expanded={isTypeMenuOpen} 
                  className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center justify-center gap-2 hover:brightness-110 transition" 
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                >
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

          {/* Stats Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard title="Total Discounts" value={stats.total} cardStyle={cardStyle} />
            <StatCard title="Active" value={stats.active} valueStyle={{ color: "var(--success-text)" }} cardStyle={cardStyle} />
            <StatCard title="Inactive" value={stats.inactive} valueStyle={{ color: "var(--danger-text)" }} cardStyle={cardStyle} />
          </div>

          {/* Search Bar & Filters Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative w-full md:w-[400px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><SearchIcon /></span>
              <input 
                type="text" 
                placeholder="Search by discount name or code..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="w-full h-10 pl-9 pr-3 rounded-lg text-[16px] md:text-[13px] outline-none transition focus:ring-1 focus:ring-[var(--accent)]" 
                style={inputStyle} 
              />
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Select value={statusFilter} onChange={setStatusFilter} inputStyle={inputStyle} options={[["all", "All Status"], ["active", "Active"], ["inactive", "Inactive"]]} />
              <Select value={targetFilter} onChange={setTargetFilter} inputStyle={inputStyle} options={[["all", "All Targets"], ["all_products", "All Products"], ["product", "Specific Products"], ["category", "Categories"], ["brand", "Brands"]]} />
            </div>
          </div>

        </div>

        {/* BULK BAR */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between rounded-lg px-4 h-11" style={{ backgroundColor: "var(--success-soft)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--success-text)" }}>{selectedIds.length} selected</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedIds([])} className="h-8 px-3 rounded-md text-xs font-medium transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Clear</button>
              <button onClick={() => setDeleteTarget(discounts.filter((d) => selectedIds.includes(d._id || d.id)))} className="h-8 px-3 rounded-md text-xs font-semibold text-white flex items-center gap-1.5 transition hover:opacity-90" style={{ backgroundColor: "var(--danger)" }}><TrashIcon className="w-3.5 h-3.5" /> Delete Selected</button>
            </div>
          </div>
        )}

        {/* TABLE / GRID */}
        {isLoading ? (
          /* ✅ SKELETON — spinner ki jagah real layout ka skeleton:
             list view me wahi table shell + shimmer rows, grid view me shimmer cards */
          viewMode === "list" ? (
            <div className="rounded-lg overflow-hidden" style={cardStyle}>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                    <tr>
                      <th className="px-4 py-3 w-10"><span className="skeleton block h-4 w-4 rounded" /></th>
                      <th className="px-4 py-3 text-left" style={{ color: "var(--text-muted)" }}>Discount</th>
                      <th className="px-4 py-3 text-left" style={{ color: "var(--text-muted)" }}>Applies To</th>
                      <th className="px-4 py-3 text-left" style={{ color: "var(--text-muted)" }}>Value</th>
                      <th className="px-4 py-3 text-left" style={{ color: "var(--text-muted)" }}>Status</th>
                      <th className="px-4 py-3 text-right" style={{ color: "var(--text-muted)" }}>Actions</th>
                    </tr>
                  </thead>
                  <DiscountRowsSkeleton rows={itemsPerPage} />
                </table>
              </div>
            </div>
          ) : (
            <DiscountCardsSkeleton cards={8} cardStyle={cardStyle} />
          )
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
                      <tr key={id} onClick={() => handleView(id)} style={{ borderBottom: index < paginatedDiscounts.length - 1 ? "1px solid var(--border-color)" : "none", backgroundColor: isSelected ? "var(--bg-tertiary)" : "transparent" }} className="hover:bg-[var(--bg-row-hover)] transition cursor-pointer">
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={isSelected} onChange={() => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}><TagIcon className="w-4 h-4" /></div>
                            <div className="min-w-0">
                              <p className="font-semibold truncate max-w-[220px]">{discount?.name || "Untitled Discount"}</p>
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
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)" }}><TagIcon className="w-5 h-5" /></div>
                  <StatusBadge status={getDiscountStatus(discount)} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[13px] truncate">{discount?.name || "Untitled Discount"}</p>
                </div>
                <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-color)" }} onClick={(e) => e.stopPropagation()}>
                  <span className="text-[12px] font-bold" style={{ color: "var(--success-text)" }}>{formatValue(discount)}</span>
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
          formErrors={formErrors}
          setFormErrors={setFormErrors}
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

