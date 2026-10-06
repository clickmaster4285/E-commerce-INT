"use client";

/* Shared discount modals — moved out of page.js (App Router pages cannot have named exports). */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { attributeApi } from "../../../../apis/admin/attributeApi";
import { toNonNegative } from "./discountUtils";

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

/* ==================== FORM MODAL ==================== */
const DISCOUNT_TYPE_LABELS = { all: "All Products Discount", product: "Product Discount", category: "Category Discount", brand: "Brand Discount" };
const DISCOUNT_TYPE_SUBTITLES = {
  all: "This discount will apply to all products in your store automatically.",
  product: "Select specific products to apply this discount to.",
  category: "Apply this discount to entire categories.",
  brand: "Apply this discount to specific brands.",
};
const DISCOUNT_TYPE_ICONS = { all: GlobeIcon, product: BoxIcon, category: FolderIcon, brand: AwardIcon };

const TargetIconFor = (formType) => {
  if (formType === "product") return PackageIcon;
  if (formType === "category") return FolderIcon;
  if (formType === "brand") return AwardIcon;
  return TagIcon;
};

export function DiscountFormModal({ formType, formData, setFormData, formErrors, setFormErrors, editingDiscount, saveMutation, setShowModal, resetForm, setSelector, handleSubmit, inputStyle, products, categories, brands }) {
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
                <div className="space-y-4">
                  <FormField label="Discount Name" required fullWidth>
                    <TextInput
                      value={formData.name}
                      onChange={(v) => setFormData({ ...formData, name: v })}
                      placeholder="e.g., Summer Sale 2026"
                      style={inputStyle}
                    />
                  </FormField>
                  <FormField label="Discount Code" required hint="Enter a unique code, e.g., SUMMER20">
                    <TextInput
                      value={formData.code}
                      onChange={(v) => { setFormData({ ...formData, code: v }); setFormErrors(prev => ({ ...prev, code: undefined })); }}
                      placeholder="e.g., SUMMER20"
                      style={{ ...inputStyle, textTransform: "uppercase" }}
                      className={formErrors.code ? "ring-2 ring-red-500/50" : ""}
                    />
                    {formErrors.code && <p className="text-[11px] mt-1 text-red-400 font-medium">{formErrors.code}</p>}
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

            {/* TARGET SELECTION */}
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
                        style={{ backgroundColor: "var(--success-soft)", borderColor: "color-mix(in srgb, var(--success) 28%, transparent)", color: "var(--success-text)" }}
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
                          <span>Total Value: <span className="font-bold" style={{ color: "var(--success-text)" }}>{formatCurrency(totalSelectedValue)}</span></span>
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
                      {
                        value: "percentage",
                        label: "Percentage Discount (%)",
                        icon: PercentIcon,
                        description: "Example: 10% off on the order total",
                      },
                      {
                        value: "fixed_amount",
                        label: "Fixed Amount Discount (Rs.)",
                        icon: RupeeIcon,
                        description: "Example: Rs. 1,000 off on the order total",
                      },
                      {
                        value: "fixed_price",
                        label: "Fixed Sale Price (Rs.)",
                        icon: TagIcon,
                        description: "Example: Sell at a fixed price, e.g. Rs. 7,000",
                      },
                    ]}
                    placeholder="Select discount type"
                  />
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {formData.value_type === "percentage" && (
                    <FormField label="Discount Percentage (%)" fullWidth hint="Value must be between 0 and 100 (max 100)">
                      <TextInput type="number" nonNegative max={100} value={formData.value} onChange={(v) => setFormData({ ...formData, value: v })} placeholder="e.g., 20" style={inputStyle} />
                    </FormField>
                  )}

                  {formData.value_type === "fixed_amount" && (
                    <FormField label="Discount Amount (Rs.)" fullWidth hint="Negative values are not allowed (minimum 0)">
                      <TextInput type="number" nonNegative value={formData.value} onChange={(v) => setFormData({ ...formData, value: v })} placeholder="e.g., 500" style={inputStyle} />
                    </FormField>
                  )}

                  {formData.value_type === "fixed_price" && (
                    <FormField label="Fixed Price (Rs.)" fullWidth hint="Negative values are not allowed (minimum 0)">
                      <TextInput type="number" nonNegative value={formData.value} onChange={(v) => setFormData({ ...formData, value: v })} placeholder="e.g., 999" style={inputStyle} />
                    </FormField>
                  )}
                </div>
              </div>
            </section>

            {/* CONDITIONS & LIMITS */}
            <section>
              <SectionHeader 
                icon={LayersIcon} 
                title="Conditions & Limits" 
                subtitle="Control when and how often the discount can be used" 
              />
              <div className="rounded-lg p-5 space-y-5" style={cardStyle}>
                
                {/* Row 1: Min Order Amount & Min Quantity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField label="Min Order Amount (Rs.)" hint="Leave empty for no minimum">
                    <TextInput 
                      type="number" 
                      nonNegative
                      value={formData.min_order_amount} 
                      onChange={(v) => setFormData({ ...formData, min_order_amount: v })} 
                      placeholder="e.g., 1000" 
                      style={inputStyle} 
                    />
                  </FormField>

                  {/* Min Quantity with Checkbox Logic */}
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5 uppercase tracking-wide flex items-center justify-between" style={{ color: "var(--text-secondary)" }}>
                      <span>Min Quantity</span>
                      <span 
                        className="flex items-center gap-2 cursor-pointer select-none group" 
                        onClick={() => {
                          const newState = !formData.has_min_quantity;
                          setFormData(prev => ({ 
                            ...prev, 
                            has_min_quantity: newState,
                            min_quantity: newState ? prev.min_quantity : "" 
                          }));
                        }}
                      >
                        <span className="text-[10px] normal-case tracking-normal opacity-70 group-hover:opacity-100 transition">
                          Enable Limit
                        </span>
                        <div 
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                            formData.has_min_quantity ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border-color)] bg-transparent"
                          }`}
                        >
                          {formData.has_min_quantity && <CheckIcon className="w-3 h-3 text-white" />}
                        </div>
                      </span>
                    </label>
                    
                    <div className={`transition-all duration-200 ${!formData.has_min_quantity ? "opacity-40 grayscale pointer-events-none" : "opacity-100"}`}>
                      <TextInput 
                        type="number" 
                        nonNegative
                        integer
                        value={formData.min_quantity} 
                        onChange={(v) => setFormData({ ...formData, min_quantity: v })} 
                        placeholder={formData.has_min_quantity ? "e.g., 2" : "Disabled"} 
                        disabled={!formData.has_min_quantity}
                        style={{
                          ...inputStyle,
                          backgroundColor: !formData.has_min_quantity ? "var(--bg-secondary)" : "var(--bg-tertiary)",
                          cursor: !formData.has_min_quantity ? "not-allowed" : "text"
                        }} 
                      />
                    </div>
                    {!formData.has_min_quantity && (
                      <p className="text-[10px] mt-1.5 italic" style={{ color: "var(--text-muted)" }}>
                        Discount applies regardless of quantity
                      </p>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="h-px w-full" style={{ backgroundColor: "var(--border-color)" }}></div>

                {/* Row 2: Usage Limits */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField label="Total Usage Limit" hint="Leave empty for unlimited uses">
                    <TextInput 
                      type="number" 
                      nonNegative
                      integer
                      value={formData.usage_limit} 
                      onChange={(v) => setFormData({ ...formData, usage_limit: v })} 
                      placeholder="Unlimited" 
                      style={inputStyle} 
                    />
                  </FormField>
                  <FormField label="Per Customer Limit" hint="Leave empty for unlimited per user">
                    <TextInput 
                      type="number" 
                      nonNegative
                      integer
                      value={formData.usage_per_customer} 
                      onChange={(v) => setFormData({ ...formData, usage_per_customer: v })} 
                      placeholder="Unlimited" 
                      style={inputStyle} 
                    />
                  </FormField>
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
                        { value: "disabled", label: "Inactive" },
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

/* ==================== SELECTION MODAL ==================== */
export function SelectionModal({ type, items, selectedIds, onClose, onApply, inputStyle, cardStyle }) {
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
                      backgroundColor: selected ? "var(--success-soft)" : "transparent",
                      border: `1px solid ${selected ? "rgba(16,185,129,0.30)" : "transparent"}`,
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) e.currentTarget.style.backgroundColor = "var(--bg-row-hover)";
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
                <> · <span className="font-bold" style={{ color: "var(--success-text)" }}>{formatCurrency(totalDraftValue)}</span></>
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

/* ==================== SELECTED PRODUCT ROW ==================== */
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
          <span className="text-[12px] font-bold font-mono" style={{ color: "var(--success-text)" }}>
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

/* ==================== PRODUCT DETAILS MODAL ==================== */
function ProductDetailsModal({ product, onClose }) {
  const name = getName(product, "product");
  const price = getProductPrice(product);
  const image = getProductImage(product);
  const variantCount = Array.isArray(product?.variants) ? product.variants.length : 0;
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };

  // Category-assigned attributes (Attribute manager) — shown even when no variant value exists
  const categoryId = product?.category_id?._id || product?.category_id;
  const { data: categoryAttributes = [] } = useQuery({
    queryKey: ["category-attributes", categoryId],
    queryFn: () => attributeApi.getByCategory(categoryId),
    enabled: !!categoryId,
    retry: false,
  });

  const attributes = useMemo(() => {
    const base = getProductAttributes(product);
    const have = new Set(base.map((a) => String(a.name).toLowerCase()));
    const assigned = (categoryAttributes || [])
      .filter((a) => a && a.name && a.is_active !== false && !have.has(String(a.name).toLowerCase()))
      .map((a) => ({ name: a.name, value: "Not set" }));
    return [...base, ...assigned];
  }, [product, categoryAttributes]);

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
              <BoxIcon className="h-5 w-5" />
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
              <p className="text-[18px] font-bold font-mono mt-0.5" style={{ color: "var(--success-text)" }}>
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
                <TagIcon className="h-3.5 w-3.5" />
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
