"use client";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { useProductSocketSync } from "@/hooks/useProductSocketSync";
import { useSocket } from "@/hooks/useSocket";
import {
  Package, Layers3, Box, Clock, Pencil, Check,
  ChevronDown, ChevronRight, Copy, Plus, Trash2, Upload, X,
  Sparkles, AlertTriangle, FolderOpen, Store, Hash, Tag as TagIcon,
  Edit3, Save, Calendar, User, Activity, Eye, ArrowLeft, Image as ImageIcon, FileText, Info,
  Ban, ChevronLeft, ZoomIn, Search // Added ZoomIn and ChevronLeft for gallery
} from "lucide-react";
import { toast } from "sonner";
import { productApi } from "@/apis/admin/productApi";
import { categoryApi } from "@/apis/admin/categoryApi";
import { brandApi } from "@/apis/admin/brandApi";
import { variantApi } from "@/apis/admin/variantApi";
import { tagApi } from "@/apis/admin/tagApi";
import { attributeApi } from "@/apis/admin/attributeApi";
import VariantForm from "@/components/admin/VariantForm";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:")) return url;
  return `${API_ORIGIN}${url}`;
};

const createEmptyVariant = (sku = "") => ({
  _id: null, sku, title: "", description: "",
  cost_price: "", selling_price: "", quantity: "0",
  topup: "0",
  attributes: [{ name: "Color", value: "Black", isCustom: false }],
  images: [],
  tags: [],
});

function fd(d) {
  return d ? new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

// Date + time (kab create / update hua) — Variant Details drawer ke audit cards ke liye
function fdt(d) {
  if (!d) return "—";
  const date = new Date(d);
  const day = date.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${day}, ${time}`;
}

function tago(d) {
  if (!d) return "";
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const dy = Math.floor(h / 24);
  return dy < 30 ? `${dy}d ago` : fd(d);
}

// Initials for an avatar circle. Returns "" when there is nothing to derive them
// from, so a missing name can never surface as a literal "?" placeholder — the
// caller decides what to show instead (see Avatar / the Brand card).
function ini(n) {
  if (!n) return "";
  return String(n).trim().split(/\s+/).map((w) => w[0]).join("").substring(0, 2).toUpperCase();
}

// ==================== MODERN COMPONENTS ====================

function StatusBadge({ active, size = "sm" }) {
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-[11px]";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide ${sizeClasses}`}
      style={{
        backgroundColor: active ? "var(--success-soft)" : "var(--danger-soft)",
        color: active ? "var(--success)" : "var(--danger)",
        border: `1px solid ${active ? "color-mix(in srgb, var(--success) 28%, transparent)" : "color-mix(in srgb, var(--danger) 28%, transparent)"}`,
      }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: active ? "var(--success)" : "var(--danger)" }} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function InfoCard({ icon: Icon, title, children, action }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
              <Icon className="w-4 h-4" />
            </div>
          )}
          <h3 className="text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function DataRow({ label, value, mono, highlight, icon: Icon }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="flex items-center gap-2.5">
        {Icon && <Icon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
        <span className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <span className={`text-[13px] font-semibold text-right truncate max-w-[60%] ${mono ? "font-mono" : ""}`}
        style={{ color: highlight ? "var(--success)" : "var(--text-primary)" }}>{value}</span>
    </div>
  );
}

function Avatar({ user, name, size = "md", color = "emerald" }) {
  const sizes = { sm: "w-7 h-7 text-[9px]", md: "w-9 h-9 text-[10px]", lg: "w-11 h-11 text-xs" };
  const iconSizes = { sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-5 h-5" };
  const colors = {
    emerald: { bg: "var(--success-soft)", text: "var(--success)" },
    blue: { bg: "var(--info-soft)", text: "var(--info)" },
    purple: { bg: "var(--purple-soft)", text: "var(--purple)" },
  };
  const c = colors[color] || colors.emerald;
  // `name` wins when the caller already resolved it (actorInfo). When nothing is
  // known the circle falls back to a neutral glyph — never "?" or "??".
  const label = String(name || user?.name || user?.email || "").trim();
  return (
    <div className={`${sizes[size]} rounded-full flex items-center justify-center font-bold shrink-0`}
      style={{ backgroundColor: c.bg, color: c.text }} title={label || undefined}>
      {label ? ini(label) : <User className={iconSizes[size]} />}
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
        <Icon className="w-7 h-7" style={{ color: "var(--text-muted)" }} />
      </div>
      <h3 className="text-base font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="text-[12px] max-w-sm mb-5" style={{ color: "var(--text-muted)" }}>{description}</p>
      {action}
    </div>
  );
}

function AllAttributesModal({ attributes, onClose }) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Modal ke andar search — attribute ke naam ya value par filter
  const filteredAttributes = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return attributes;
    return attributes.filter((attribute) =>
      `${attribute.name || ""} ${attribute.value || ""}`.toLowerCase().includes(term)
    );
  }, [attributes, search]);

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="all-attributes-title"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl shadow-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 px-5 py-4"
          style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}
            >
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 id="all-attributes-title" className="text-[15px] font-bold">All Attributes</h2>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                Product attributes and specifications — search bar se turant filter karein
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-md p-2 transition hover:bg-red-500/10 hover:text-red-400" style={{ color: "var(--text-muted)" }} aria-label="Close attributes">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {attributes.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed p-6 text-center" style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}>
              <p className="text-[12px]">No attributes are available for this product.</p>
            </div>
          ) : (
            <>
              {/* Search bar — attribute ka naam ya value search karne ke liye */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search attributes..."
                  className="h-9 w-full rounded-lg pl-9 pr-9 text-[16px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 sm:text-[13px]"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 transition hover:bg-black/10" style={{ color: "var(--text-muted)" }} aria-label="Clear search">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <p className="mb-3 text-[11px]" style={{ color: "var(--text-muted)" }}>
                Showing <span className="font-semibold" style={{ color: "var(--text-secondary)" }}>{filteredAttributes.length}</span> of {attributes.length} attribute{attributes.length === 1 ? "" : "s"}
              </p>

              {filteredAttributes.length === 0 ? (
                <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed p-6 text-center" style={{ borderColor: "var(--border-color)", color: "var(--text-muted)" }}>
                  <p className="text-[12px]">No attribute matches &quot;{search.trim()}&quot;.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filteredAttributes.map((attribute) => (
                    <div key={attribute.name} className="min-w-0 rounded-lg p-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                      <p className="break-words text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{attribute.name}</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-[13px] font-semibold leading-5" style={{ color: "var(--text-primary)" }}>{attribute.value || "—"}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 justify-end px-5 py-3" style={{ backgroundColor: "var(--bg-tertiary)", borderTop: "1px solid var(--border-color)" }}>
          <button type="button" onClick={onClose} className="h-9 rounded-md px-4 text-[12px] font-bold transition hover:brightness-110" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Edit Product modal ke Category / Brand dropdown — dropdown ke andar search bar
function SearchableSelectField({ value, onChange, options, placeholder = "Select...", searchPlaceholder = "Search...", emptyLabel = "No results found" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedOption = options.find((option) => String(option.value) === String(value)) || null;

  const filteredOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => String(option.label || "").toLowerCase().includes(term));
  }, [options, search]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setTimeout(() => searchInputRef.current?.focus(), 40);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const handleSelect = (nextValue) => {
    onChange(nextValue);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => { if (!open) setSearch(""); return !open; })}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="h-9 px-3 rounded-lg text-[12px] w-full flex items-center justify-between gap-2 outline-none transition focus:ring-1 focus:ring-emerald-500/40"
        style={{ backgroundColor: "var(--bg-tertiary)", border: `1px solid ${isOpen ? "var(--accent)" : "var(--border-color)"}`, color: "var(--text-primary)" }}
      >
        <span className="truncate" style={{ color: selectedOption ? "var(--text-primary)" : "var(--text-muted)" }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-[100] mt-1 overflow-hidden rounded-lg shadow-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="p-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-md pl-8 pr-2 text-[16px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 sm:h-8 sm:text-[12px]"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>{search.trim() ? `No match for "${search.trim()}"` : emptyLabel}</p>
            ) : filteredOptions.map((option) => (
              <button
                type="button"
                key={String(option.value)}
                onClick={() => handleSelect(String(option.value))}
                className="block w-full px-3 py-2 text-left text-[12px] transition hover:bg-[var(--bg-row-hover)]"
                style={{ color: String(value) === String(option.value) ? "var(--accent)" : "var(--text-primary)", fontWeight: String(value) === String(option.value) ? 600 : 400 }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Tag entries can be plain strings or legacy { name } objects
const tagNameOf = (t) => (typeof t === "object" && t !== null ? t.name : t);

// Attribute values can be plain strings/numbers or nested objects such as
// { Brand: "Dell" } / { label, value } coming from the attribute configuration.
// Always resolve a readable value so "[object Object]" is never rendered.
const attrValueOf = (raw) => {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    return String(raw).trim();
  }
  if (Array.isArray(raw)) return raw.map(attrValueOf).filter(Boolean).join(", ");
  if (typeof raw === "object") {
    const direct = raw.value ?? raw.label ?? raw.name ?? raw.display ?? raw.title ?? raw.text;
    if (direct !== undefined && direct !== null && direct !== raw) return attrValueOf(direct);
    return Object.values(raw).map(attrValueOf).filter(Boolean).join(", ");
  }
  return String(raw);
};

// ==================== ACTIVITY TIMELINE ====================
// Strictly an audit trail: every row below is backed by a timestamp the backend
// itself wrote at the moment the change happened. Nothing is inferred from the
// product's current values, so an action that never ran can never show up.
//   • Product  → created_at / updated_at (+ createdby / updatedby)
//   • Variant  → created_at / updated_at (+ createdby / updatedby)
// Tag documents are deliberately excluded — a tag's own createdAt / updatedAt
// belong to the shared tag library and say nothing about when it was attached to
// *this* product, so listing them here would invent events that never happened.
// Live socket events are merged on top so a change made in another tab appears
// immediately, before the refetch lands.
const ACTIVITY_TYPES = {
  "product-created": { group: "product", label: "Product Created", icon: Plus, bg: "var(--success-soft)", fg: "var(--success)", avatar: "emerald" },
  "product-updated": { group: "product", label: "Product Updated", icon: Pencil, bg: "var(--info-soft)", fg: "var(--info)", avatar: "blue" },
  "variant-created": { group: "variant", label: "Variant Created", icon: Layers3, bg: "var(--purple-soft)", fg: "var(--purple)", avatar: "purple" },
  "variant-updated": { group: "variant", label: "Variant Updated", icon: Pencil, bg: "var(--warning-soft)", fg: "var(--warning)", avatar: "blue" },
};

const activityMetaOf = (type) => ACTIVITY_TYPES[type] || ACTIVITY_TYPES["product-updated"];

// Audit users arrive populated ({ name, email }), as a bare id, or as null — the
// UI must never assume one shape. A raw ObjectId is an identifier, NOT a person,
// so it resolves to "unknown" instead of printing 24 characters of hex as a name.
const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;
// "admin" → "Admin"; deliberate capitals (McDonald, SKU codes) are left intact.
const titleCase = (value) => String(value).replace(/(^|[\s._-])\S/g, (c) => c.toUpperCase());

const UNKNOWN_ACTOR = Object.freeze({ known: false, name: "", email: "", initials: "" });

// Single source of truth for naming whoever made a change. Returns
// { known, name, email, initials } so no caller can accidentally render a blank
// row, a raw ObjectId, or the old "?" placeholder.
const actorInfo = (raw) => {
  if (!raw) return UNKNOWN_ACTOR;

  if (typeof raw === "string") {
    const value = raw.trim();
    if (!value || OBJECT_ID_RE.test(value)) return UNKNOWN_ACTOR;
    const name = titleCase(value);
    return { known: true, name, email: "", initials: ini(name) };
  }
  if (typeof raw !== "object") return UNKNOWN_ACTOR;

  const storedName = String(raw.name || raw.username || "").trim();
  const email = String(raw.email || "").trim();
  if (!storedName && !email) return UNKNOWN_ACTOR;

  // Prefer the real name; fall back to the email's local part so an entry whose
  // name never reached the audit record is still labelled usefully.
  const name = storedName ? titleCase(storedName) : titleCase(email.split("@")[0]);
  return { known: true, name, email, initials: ini(name) };
};

// Mongoose stamps created_at and updated_at off the same clock on insert, so
// for a record that was never edited the two are identical. The backend only
// saves a product / variant when isModified() is true, so any gap larger than
// this 1-second insert-jitter guard is a genuine edit — there is no arbitrary
// "ignore the first minute" fudge factor hiding real changes.
const hasRealUpdate = (createdAt, updatedAt) => {
  if (!createdAt || !updatedAt) return false;
  const delta = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
  return Number.isFinite(delta) && delta > 1000;
};

// A socket broadcast and the refetched document describe the same save with the
// same millisecond, so an exact stamp is the reliable duplicate test. Bucketing
// by minute would wrongly swallow two genuine edits made in the same minute.
const activityStamp = (type, date) => `${type}|${new Date(date).getTime()}`;

// Day headers ("Today", "Yesterday", weekday, or full date) for the timeline.
const startOfDay = (value) => {
  const date = new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};
const dayBucketOf = (value) => startOfDay(value);
const dayLabelOf = (value) => {
  const date = new Date(value);
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(value)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
};
// Wall-clock only — the day header above each group already carries the date.
const clockOf = (value) =>
  new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

// Full, unambiguous timestamp used as the hover title on every timeline row, so
// the exact moment of a change is always one hover away.
const fullStampOf = (value) =>
  value ? new Date(value).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" }) : "";

const variantLabelOf = (variant) => {
  const attrValues = Object.values(variant?.attributes || {}).map(attrValueOf).filter(Boolean);
  return variant?.title || attrValues.join(" / ") || variant?.sku || "Variant";
};

// ==================== COMPACT 3-DOT MENU ====================

function MoreMenu({ actions }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const menuHeight = 160; // approximate min height
      const windowHeight = window.innerHeight;
      const spaceBelow = windowHeight - rect.bottom;
      const spaceAbove = rect.top;
      let top = rect.bottom + 4;
      if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        top = rect.top - menuHeight - 4;
      }
      let left = rect.right - 160;
      if (left < 8) left = 8;
      if (left + 160 > window.innerWidth) left = window.innerWidth - 168;
      setMenuPos({ top, left });
    }
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    const handleKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [open]);

  return (
    <div className="relative z-10">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        aria-label="More actions"
        aria-haspopup="true"
        aria-expanded={open}
        className="w-8 h-8 inline-flex items-center justify-center rounded-md transition hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] focus:outline-none cursor-pointer"
        style={{ color: "var(--text-muted)", backgroundColor: "transparent" }}
      >
        <span className="flex flex-col items-center gap-[3px]">
          <span className="w-[3px] h-[3px] rounded-full bg-current" />
          <span className="w-[3px] h-[3px] rounded-full bg-current" />
          <span className="w-[3px] h-[3px] rounded-full bg-current" />
        </span>
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] min-w-[160px] rounded-lg border shadow-xl overflow-visible py-1 animate-in fade-in zoom-in-95 opacity-100 pointer-events-auto"
          style={{
            top: menuPos.top + "px",
            left: Math.max(8, menuPos.left) + "px",
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-color)",
            boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
            pointerEvents: "auto",
          }}
        >
          {actions.map((action, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); action.onClick?.(); }}
              disabled={action.disabled}
              className="w-full text-left px-3 py-2 text-[13px] flex items-center gap-2.5 transition-colors hover:bg-[var(--bg-tertiary)] disabled:opacity-40 opacity-100 pointer-events-auto cursor-pointer"
              style={{ color: action.destructive ? "var(--danger)" : "var(--text-primary)" }}
            >
              {action.icon && <span className="w-4 h-4 flex items-center justify-center shrink-0">{action.icon}</span>}
              <span>{action.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

// ==================== VARIANT DETAILS DRAWER ====================
// 3-dot menu → "View Detailed": variant ki poori detail right side panel mein.
// Sare fields pehle se fetched product payload se aate hain (koi extra API call nahi).

// Color attribute ke value ke aage chhota swatch (jaise "Blue") dikhane ke liye
function isColorAttribute(name, value) {
  return /colou?r/i.test(name || "") && /^[a-zA-Z]+$/.test(value || "");
}

// Section header: simple title + optional right-side action.
// `delay` se sections halke-halke (staggered) andar aate hain jab drawer khulta hai.
function DrawerSection({ title, delay = 0, action, children }) {
  return (
    <section className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{title}</h4>
        {action}
      </div>
      {children}
    </section>
  );
}

// Summary tile: label + bold value + optional status dot / supporting line.
function DetailStat({ label, value, sub, subColor, dotColor, color }) {
  return (
    <div className="rounded-xl px-3 py-3 transition hover:-translate-y-0.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
      <p className="truncate text-[10.5px] font-semibold" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[13.5px] font-black leading-tight tabular-nums" style={{ color: color || "var(--text-primary)" }}>
        {dotColor && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />}
        <span className="truncate">{value}</span>
      </p>
      {sub && <p className="mt-0.5 truncate text-[10.5px] font-medium" style={{ color: subColor || "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

function VariantDetailsDrawer({ variant, productName, onClose, onEdit, onDelete, onManageTags, onRemoveTag, tagUpdatePending }) {
  const [previewImage, setPreviewImage] = useState(null);
  const [copiedSku, setCopiedSku] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const panelRef = useRef(null);

  // ✅ Background page scroll lock — drawer khula ho to peeche wala list na hile
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => { document.body.style.overflow = originalOverflow; };
  }, []);

  // Escape: pehle image preview band karo, warna panel.
  // Tab: focus drawer ke andar hi cycle kare (focus trap), bahar na nikle.
  useEffect(() => {
    const focusableElements = () => Array.from(
      panelRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || []
    ).filter((element) => !element.disabled && element.offsetParent !== null);

    const handleKey = (event) => {
      if (event.key === "Escape") {
        if (previewImage !== null) setPreviewImage(null);
        else onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const list = focusableElements();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [previewImage, onClose]);

  if (!variant) return null;

  const isActive = variant.status === "active" || !variant.status;
  const quantity = Number(variant.quantity || 0);
  const images = variant.images || [];
  const tagList = (variant.tags || []).map(tagNameOf).filter(Boolean);
  const attributes = Object.entries(variant.attributes || {})
    .map(([name, raw]) => ({ name, value: attrValueOf(raw) }))
    .filter((attribute) => attribute.value);
  const createdBy = variant.createdby && typeof variant.createdby === "object" ? variant.createdby : null;
  const updatedBy = variant.updatedby && typeof variant.updatedby === "object" ? variant.updatedby : null;
  const money = (value) => `Rs. ${Number(value || 0).toLocaleString()}`;
  // "Updated By" card sirf tab dikhta hai jab variant waqai update hua ho —
  // warna creation timestamp hi update lagta hai (jaisa seed data mein hota hai).
  const auditEntries = [
    { label: "Created By", user: createdBy, date: variant.created_at, color: "emerald" },
    ...(hasRealUpdate(variant.created_at, variant.updated_at)
      ? [{ label: "Updated By", user: updatedBy, date: variant.updated_at, color: "blue" }]
      : []),
  ];

  // ✅ Stock status sirf quantity se (min/max qty UI mein nahi hain)
  const stockState = quantity <= 0
    ? { label: "Out of Stock", color: "var(--danger)" }
    : quantity <= 5
      ? { label: "Low Stock", color: "var(--warning)" }
      : { label: "In Stock", color: "var(--success)" };

  // ---- Summary tiles ke numbers ----
  const costPrice = Number(variant.cost_price || 0);
  const sellingPrice = Number(variant.selling_price || 0);

  const sku = variant.sku || "";
  const description = variant.description || "";
  const hasLongDescription = description.length > 140;
  const primaryImage = images[0];

  // SKU copy — clipboard se ek click mein
  const copySku = async () => {
    if (!sku) return;
    try {
      await navigator.clipboard.writeText(sku);
      setCopiedSku(true);
      setTimeout(() => setCopiedSku(false), 1800);
      toast.success("SKU copied to clipboard");
    } catch {
      toast.error("Could not copy SKU");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="variant-drawer-title">
      <div className="absolute inset-0 animate-in fade-in duration-300 bg-black/60 backdrop-blur-[3px]" onClick={onClose} />

      <aside
        ref={panelRef}
        tabIndex={-1}
        className="relative flex h-full w-full flex-col outline-none animate-in slide-in-from-right duration-300 sm:max-w-[480px]"
        style={{ backgroundColor: "var(--bg-card)", borderLeft: "1px solid var(--border-color)", boxShadow: "-18px 0 50px rgba(0,0,0,0.35)" }}
      >
        {/* Top accent bar — flat, koi glow/gradient nahi */}
        <div className="h-1 w-full shrink-0" style={{ backgroundColor: "var(--accent)" }} />

        {/* HEADER */}
        <div className="shrink-0 px-5 py-3.5" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
              <Layers3 className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 id="variant-drawer-title" className="text-[14px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>Variant Details</h2>
              <p className="mt-0.5 text-[11px] truncate" style={{ color: "var(--text-muted)" }}>{productName || "Product variant"}</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close variant details" title="Close (Esc)" className="w-8 h-8 rounded-lg flex items-center justify-center transition shrink-0 hover:brightness-125" style={{ color: "var(--text-muted)", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-5 py-5">
          {/* HERO — identity: image · title · status · SKU (copy) · description */}
          <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 flex items-start gap-3.5">
              {primaryImage ? (
                <button type="button" onClick={() => setPreviewImage(0)} aria-label="Open image preview" className="group relative w-[84px] h-[84px] rounded-xl overflow-hidden shrink-0 transition hover:-translate-y-0.5" style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={getImageUrl(primaryImage.img_url)} alt={variantLabelOf(variant)} className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.08]" />
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100" style={{ backgroundColor: "rgba(2,6,23,0.45)" }}>
                    <ZoomIn className="w-4 h-4 text-white" />
                  </span>
                  {images.length > 1 && (
                    <span className="absolute bottom-1 right-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[9.5px] font-bold text-white">+{images.length - 1}</span>
                  )}
                </button>
              ) : (
                <div className="w-[84px] h-[84px] rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-card)", border: "1px dashed var(--border-color)" }}>
                  <ImageIcon className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15.5px] font-bold leading-snug" style={{ color: "var(--text-primary)" }}>{variantLabelOf(variant)}</h3>
                  <StatusBadge active={isActive} />
                </div>

                {/* SKU + one-click copy */}
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="inline-flex min-w-0 items-center rounded-md px-2 py-1 text-[10.5px] font-mono" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                    <span className="truncate">{sku ? `SKU: ${sku}` : "No SKU"}</span>
                  </span>
                  {sku && (
                    <button type="button" onClick={copySku} title="Copy SKU" aria-label="Copy variant SKU" className="inline-flex w-6 h-6 shrink-0 items-center justify-center rounded-md transition hover:brightness-110" style={{ backgroundColor: copiedSku ? "var(--success-soft)" : "var(--accent-soft)", color: copiedSku ? "var(--success)" : "var(--accent)", border: `1px solid color-mix(in srgb, ${copiedSku ? "var(--success)" : "var(--accent)"} 28%, transparent)` }}>
                      {copiedSku ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>

                {description ? (
                  <>
                    <p className={`mt-2 text-[12px] leading-relaxed ${descExpanded ? "" : "line-clamp-2"}`} style={{ color: "var(--text-secondary)" }}>{description}</p>
                    {hasLongDescription && (
                      <button type="button" onClick={() => setDescExpanded((prev) => !prev)} className="mt-1 text-[11px] font-semibold transition hover:underline" style={{ color: "var(--accent)" }}>
                        {descExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-[12px] italic" style={{ color: "var(--text-muted)" }}>No description provided for this variant.</p>
                )}
              </div>
            </div>

          {/* SUMMARY TILES — cost · selling · quantity · status */}
          <div className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-300 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <DetailStat label="Cost Price" value={money(costPrice)} />
            <DetailStat label="Selling Price" value={money(sellingPrice)} color="var(--success)" />
            <DetailStat label="Quantity" value={quantity.toLocaleString()} sub={stockState.label} subColor={stockState.color} />
            <DetailStat label="Status" value={isActive ? "Active" : "Inactive"} color={isActive ? "var(--success)" : "var(--danger)"} dotColor={isActive ? "var(--success)" : "var(--danger)"} />
          </div>

          {/* ATTRIBUTES — 2-column boxes: label upar · value neeche */}
          <DrawerSection title="Attributes" delay={120}>
            {attributes.length === 0 ? (
              <div className="rounded-xl px-4 py-5 text-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>No attributes defined for this variant.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {attributes.map((attribute) => (
                  <div key={attribute.name} className="rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                    <p className="truncate text-[10.5px] font-semibold" style={{ color: "var(--text-muted)" }}>{attribute.name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {isColorAttribute(attribute.name, attribute.value) && (
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: attribute.value, border: "1px solid var(--border-color)" }} />
                      )}
                      <span className="min-w-0 break-words">{attribute.value}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </DrawerSection>

          {/* INVENTORY — sirf quantity (min/max qty UI mein nahi) */}
          <DrawerSection title="Inventory" delay={180}>
            <DetailStat label="Quantity" value={quantity.toLocaleString()} sub={stockState.label} subColor={stockState.color} />
          </DrawerSection>

          {/* TAGS */}
          <DrawerSection
            title="Tags"
            delay={240}
            action={(
              <button type="button" onClick={onManageTags} disabled={tagUpdatePending} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-50" style={{ color: "var(--accent)", backgroundColor: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)" }}>
                <Plus className="w-3 h-3" /> Add Tag
              </button>
            )}
          >
            {tagList.length === 0 ? (
              <div className="rounded-xl px-4 py-5 text-center" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                <p className="text-[11.5px]" style={{ color: "var(--text-muted)" }}>No tags assigned to this variant.</p>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tagList.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-[11px] font-semibold transition hover:brightness-110" style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 28%, transparent)" }}>
                    <TagIcon className="w-3 h-3 shrink-0" />
                    {tag}
                    <button type="button" onClick={() => onRemoveTag(tag)} disabled={tagUpdatePending} aria-label={`Remove tag ${tag}`} title={`Remove ${tag}`} className="rounded p-0.5 transition hover:bg-black/20 disabled:opacity-50">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </DrawerSection>

          {/* IMAGES */}
          {images.length > 0 && (
            <DrawerSection title="Images" delay={300}>
              <div className="grid grid-cols-4 gap-2.5">
                {images.map((image, index) => (
                  <button key={`${image.img_url}-${index}`} type="button" onClick={() => setPreviewImage(index)} aria-label={`Open image ${index + 1}`} className="group relative aspect-square rounded-xl overflow-hidden transition hover:-translate-y-0.5" style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={getImageUrl(image.img_url)} alt={`${variantLabelOf(variant)} ${index + 1}`} className="w-full h-full object-cover transition duration-300 group-hover:scale-[1.06]" />
                    <span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100" style={{ backgroundColor: "rgba(2,6,23,0.5)" }}>
                      <ZoomIn className="w-4 h-4 text-white" />
                    </span>
                  </button>
                ))}
              </div>
            </DrawerSection>
          )}

        </div>

        {/* FOOTER — Created By / Updated By + actions */}
        <div className="shrink-0 px-5 py-4" style={{ borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
          <div className={`grid gap-2.5 ${auditEntries.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {auditEntries.map((entry) => (
              <div key={entry.label} className="rounded-lg px-3 py-2.5" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{entry.label}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <Avatar user={entry.user} size="sm" color={entry.color} />
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{entry.user?.name || entry.user?.email || "System"}</p>
                    <p className="text-[10.5px]" style={{ color: "var(--text-muted)" }}>{fdt(entry.date)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2.5">
            <button type="button" onClick={onEdit} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-[12.5px] font-semibold transition hover:brightness-110" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              <Edit3 className="w-4 h-4" /> Edit Variant
            </button>
            <button type="button" onClick={onDelete} aria-label="Delete variant" title="Delete variant" className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg text-[12.5px] font-semibold transition hover:brightness-110" style={{ backgroundColor: "var(--danger)", color: "#ffffff" }}>
              <Trash2 className="w-4 h-4" /> Delete Variant
            </button>
          </div>
        </div>
      </aside>

      {/* FULL SIZE IMAGE PREVIEW — arrows, counter aur thumbnails ke saath */}
      {previewImage !== null && images[previewImage] && (
        <ImageGalleryModal images={images} initialIndex={previewImage} onClose={() => setPreviewImage(null)} />
      )}
    </div>,
    document.body
  );
}

// ==================== IMAGE GALLERY MODAL ====================
function ImageGalleryModal({ images, initialIndex, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  
  // Reset index when images change
  useEffect(() => {
    setCurrentIndex(initialIndex || 0);
  }, [initialIndex, images]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") nextImage();
      if (e.key === "ArrowLeft") prevImage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, images.length]);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  if (!images || images.length === 0) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Close Button */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-50"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main Image Container */}
      <div 
        className="relative w-full max-w-6xl h-[80vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking image area
      >
        {/* Previous Button */}
        {images.length > 1 && (
          <button 
            onClick={(e) => { e.stopPropagation(); prevImage(); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white transition-all hover:scale-110 z-50"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Image Display */}
        <div className="relative w-full h-full flex items-center justify-center p-8">
           <img 
            src={getImageUrl(images[currentIndex].img_url)} 
            alt={`Product view ${currentIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl select-none"
            draggable={false}
           />
           <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium backdrop-blur-sm">
             {currentIndex + 1} / {images.length}
           </div>
        </div>

        {/* Next Button */}
        {images.length > 1 && (
          <button 
            onClick={(e) => { e.stopPropagation(); nextImage(); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white transition-all hover:scale-110 z-50"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Thumbnails Strip */}
      {images.length > 1 && (
        <div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 p-2 rounded-xl bg-black/40 backdrop-blur-md border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`relative w-16 h-16 rounded-lg overflow-hidden transition-all duration-200 ${
                idx === currentIndex 
                  ? "ring-2 ring-emerald-500 scale-110 opacity-100" 
                  : "opacity-50 hover:opacity-80 grayscale hover:grayscale-0"
              }`}
            >
              <img 
                src={getImageUrl(img.img_url)} 
                alt="" 
                className="w-full h-full object-cover" 
              />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
}

// ==================== MAIN COMPONENT ====================

export default function ProductDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  useProductSocketSync();
  const { socket, isConnected } = useSocket();

  const id = params?.id;
  const [liveEvents, setLiveEvents] = useState([]);
  
  // Gallery State
  const [showImageGallery, setShowImageGallery] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAllAttributes, setShowAllAttributes] = useState(false);
  const [activityFilter, setActivityFilter] = useState("all");

  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams?.get("tab");
    const validTabs = ["overview", "variants", "tags", "category", "brand", "activity"];
    return validTabs.includes(tabParam) ? tabParam : "overview";
  });

  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    const validTabs = ["overview", "variants", "tags", "category", "brand", "activity"];
    if (validTabs.includes(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [expandedVariant, setExpandedVariant] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteVariantTarget, setDeleteVariantTarget] = useState(null);
  const [variantDetailsTarget, setVariantDetailsTarget] = useState(null);
  const [deleteTagTarget, setDeleteTagTarget] = useState(null);
  const [showCreateTagModal, setShowCreateTagModal] = useState(false);
  const [newTagModalValue, setNewTagModalValue] = useState("");
  const [editingVariantForTags, setEditingVariantForTags] = useState(null);
  const [showVariantTagsModal, setShowVariantTagsModal] = useState(false);
  const [variantTagInput, setVariantTagInput] = useState("");
  const [newGlobalTag, setNewGlobalTag] = useState("");
  const [showEditTagModal, setShowEditTagModal] = useState(false);
  const [editingTagId, setEditingTagId] = useState(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [attributeTargetVariant, setAttributeTargetVariant] = useState(null);
  const [newAttributeData, setNewAttributeData] = useState({
    name: "", code: "", data_type: "text",
    values: [{ label: "", value: "" }], variant_allowed: true,
  });

  const [formData, setFormData] = useState({
    category_id: "", brand_id: "", name: "", description: "", tax: "0", status: "active", tag_names: [],
    variants: [createEmptyVariant()],
  });
  const [tagInput, setTagInput] = useState("");

  // Socket listeners
  useEffect(() => {
    if (!socket || !isConnected || !id) return;
    const handleDeleted = (data) => {
      if (data?.id === id) { toast.info("This product was deleted from another session."); router.push("/admin/products"); }
    };
    const handleCreated = (data) => {
      if (String(data?._id) !== String(id)) return;
      setLiveEvents((prev) => [...prev, { key: `live-c-${Date.now()}`, type: "created", user: data?.createdby || null, date: data?.created_at || new Date().toISOString() }]);
    };
    const handleUpdated = (data) => {
      if (String(data?._id) !== String(id)) return;
      const date = data?.updated_at || new Date().toISOString();
      setLiveEvents((prev) => {
        // Ignore re-delivered socket events so an update is never listed twice.
        if (prev.some((e) => e.type === "updated" && e.date === date)) return prev;
        return [...prev, { key: `live-u-${Date.now()}`, type: "updated", user: data?.updatedby || null, date }];
      });
    };
    socket.on("productDeleted", handleDeleted);
    socket.on("productCreated", handleCreated);
    socket.on("productUpdated", handleUpdated);
    return () => { socket.off("productDeleted", handleDeleted); socket.off("productCreated", handleCreated); socket.off("productUpdated", handleUpdated); };
  }, [socket, isConnected, id, router]);

  const { data: product, isLoading, isError, refetch: refetchProduct } = useQuery({
    queryKey: ["product", id], queryFn: () => productApi.getById(id), enabled: !!id,
  });

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoryApi.getAll });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: brandApi.getAll });
  const { data: rawAttributes = [] } = useQuery({ queryKey: ["attributes"], queryFn: () => attributeApi.getAll(), retry: false });

  const productCategoryId = product?.category_id?._id || product?.category_id;
  const { data: categoryAttributes = [] } = useQuery({
    queryKey: ["category-attributes", productCategoryId],
    queryFn: () => attributeApi.getByCategory(productCategoryId),
    enabled: !!productCategoryId, retry: false,
  });

  // NOTE: live events are only kept as a real-time overlay. The persisted
  // Activity Timeline is built from the fetched product/variant/tag audit
  // fields, so nothing is lost on reload and no duplicate "Update" row is
  // seeded here anymore.

  const ATTRIBUTE_PRESETS = useMemo(() => {
    const source = (categoryAttributes && categoryAttributes.length) ? categoryAttributes : rawAttributes;
    if (!source.length) return [];
    return source
      .filter((a) => a.is_active && a.values?.length)
      .map((a) => ({
        name: a.name, code: a.code, data_type: a.data_type,
        values: (a.data_type === "multi_select" && Array.isArray(a.category_config?.value) && a.category_config.value.length)
          ? a.category_config.value : (a.values || []).map((v) => v.label || v.value),
      }));
  }, [rawAttributes, categoryAttributes]);

  const { data: globalTags = [], refetch: refetchTags } = useQuery({ queryKey: ["globalTags"], queryFn: tagApi.getAll });

  // Re-fetch tags once the product has loaded: the backend heals legacy
  // variant tags into Tag documents during the product fetch, and those
  // healed docs (with Created By) must appear in this page's tag lookups.
  useEffect(() => {
    if (product && refetchTags) refetchTags();
  }, [product?._id]);

  // Mutations
  const createTagMutation = useMutation({
    mutationFn: tagApi.create,
    onSuccess: () => { refetchTags(); setNewGlobalTag(""); setNewTagModalValue(""); toast.success("Tag created successfully"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to create tag"),
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, data }) => tagApi.update(id, data),
    onSuccess: () => { refetchTags(); setShowEditTagModal(false); setEditingTagId(null); setEditingTagName(""); toast.success("Tag updated successfully"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to update tag"),
  });

  const deleteTagMutation = useMutation({
    mutationFn: tagApi.delete,
    onSuccess: () => { refetchTags(); toast.success("Tag deleted successfully"); },
    onError: (err) => toast.error(err.response?.data?.message || "Failed to delete tag"),
  });

  // Shared mutation for add / rename / remove of tags assigned to THIS product
  // (uses the existing product update API; backend resolveTags preserves relationships)
  const updateProductTagsMutation = useMutation({
    mutationFn: ({ id, data }) => productApi.update(id, data),
    onSuccess: async (_res, vars) => {
      toast.success(vars?.successMsg || "Tags updated successfully");
      await refetchProduct();
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      refetchTags();
    },
    onError: (error, vars) => { toast.error(error.response?.data?.message || vars?.errorMsg || "Failed to update tags"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => productApi.update(id, data),
    onSuccess: async () => {
      toast.success("Product updated successfully");
      await refetchProduct();
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      // Re-fetch global tags so newly created variant tag docs (with their
      // Created By) appear in the Tags tab without a page refresh.
      refetchTags();
      if (showVariantTagsModal && editingVariantForTags) {
        setTimeout(() => {
          const freshProduct = queryClient.getQueryData(["product", id]);
          if (freshProduct) {
            const updatedVariant = freshProduct.variants?.find(v => String(v._id) === String(editingVariantForTags._id));
            if (updatedVariant) setEditingVariantForTags({ ...updatedVariant, tags: updatedVariant.tags || [] });
          }
        }, 300);
      }
      if (showModal) closeProductModal();
    },
    onError: (error) => { toast.error(error.response?.data?.message || "Product update failed"); },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: (variantId) => variantApi.delete(variantId),
    onSuccess: async () => {
      toast.success("Variant deleted successfully");
      await refetchProduct();
      queryClient.invalidateQueries({ queryKey: ["product", id] });
    },
    onError: (error) => { toast.error(error.response?.data?.message || "Failed to delete variant"); },
  });

  // ✅ Variant activate/deactivate: pehle POORA product + saare variants FormData ke
  //    saath PUT hota tha (bahut slow). Ab sirf ek lightweight variant PATCH +
  //    optimistic cache patch — row ka status foran badal jaata hai.
  const variantStatusMutation = useMutation({
    mutationFn: ({ variantId, status }) => variantApi.update(variantId, { status }),
    onMutate: async ({ variantId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["product", id] });
      const previous = queryClient.getQueryData(["product", id]);
      queryClient.setQueryData(["product", id], (old) => {
        if (!old?.variants) return old;
        return {
          ...old,
          variants: old.variants.map((v) =>
            String(v._id) === String(variantId) ? { ...v, status } : v
          ),
        };
      });
      return { previous };
    },
    onSuccess: (_res, vars) => {
      toast.success(`Variant ${vars?.status === "active" ? "activated" : "deactivated"}`);
      // Audit fields (updated_by / updated_at) background me fresh — UI block nahi hota
      refetchProduct();
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["product", id], ctx.previous);
      toast.error(error.response?.data?.message || "Failed to update variant status");
    },
  });

  // Variant Details drawer se tags update karne ke liye (badge ke × se remove)
  const variantTagUpdateMutation = useMutation({
    mutationFn: ({ variantId, tags }) => variantApi.update(variantId, { tags }),
    onSuccess: async () => {
      toast.success("Variant tags updated");
      await refetchProduct();
      // Naye tag docs (Created By) Tags tab mein foran dikhein
      refetchTags();
    },
    onError: (error) => { toast.error(error.response?.data?.message || "Failed to update variant tags"); },
  });

  const deleteMutation = useMutation({
    mutationFn: productApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["products"] }); toast.success("Product deleted successfully"); setShowDeleteModal(false); router.push("/admin/products"); },
    onError: (error) => { toast.error(error.response?.data?.message || "Product delete failed"); },
  });

  const createAttributeMutation = useMutation({
    mutationFn: ({ payload }) => attributeApi.create(payload),
    onSuccess: async (res, variables) => {
      const { tempKey, targetIndex, attributeName } = variables || {};
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      queryClient.invalidateQueries({ queryKey: ["category-attributes", productCategoryId] });
      const created = res?.data || res;
      const createdId = created?._id || created?.id;
      setFormData((prev) => {
        const v = [...prev.variants];
        if (v[targetIndex]) {
          v[targetIndex] = {
            ...v[targetIndex],
            attributes: (v[targetIndex]?.attributes || []).map((a) =>
              tempKey && a._localKey === tempKey ? { ...a, name: attributeName, _creating: false, _creatingId: createdId ? String(createdId) : undefined } : a
            ),
          };
        }
        return { ...prev, variants: v };
      });
      await refetchProduct();
      toast.success("Attribute created successfully!");
      setShowAttributeModal(false);
      setAttributeTargetVariant(null);
      resetAttributeForm();
    },
    onError: (err, variables) => {
      const { tempKey, targetIndex } = variables || {};
      setFormData((prev) => {
        const v = [...prev.variants];
        if (v[targetIndex]) {
          v[targetIndex] = {
            ...v[targetIndex],
            attributes: (v[targetIndex]?.attributes || []).map((a) =>
              tempKey && a._localKey === tempKey ? { ...a, _creating: false, _createError: true } : a
            ),
          };
        }
        return { ...prev, variants: v };
      });
      queryClient.invalidateQueries({ queryKey: ["attributes"] });
      queryClient.invalidateQueries({ queryKey: ["category-attributes", productCategoryId] });
      refetchProduct();
      toast.error(err?.response?.data?.message || err?.message || "Failed to create attribute");
    },
  });

  // Handlers
  const handleDelete = () => setShowDeleteModal(true);
  const confirmDelete = () => { if (product) deleteMutation.mutate(product._id); };

  const prepareEditData = (prod) => {
    const variants = prod.variants?.length
      ? prod.variants.map((v) => ({
        _id: v._id, sku: v.sku || "", title: v.title || "", description: v.description || "",
        cost_price: String(v.cost_price ?? ""), selling_price: String(v.selling_price ?? ""),
        quantity: String(v.quantity ?? 0),
        attributes: Object.entries(v.attributes || {}).map(([name, value]) => {
          const strValue = attrValueOf(value);
          const preset = rawAttributes.find((a) => a.name === name);
          const isMulti = preset?.data_type === "multi_select";
          return { name, value: isMulti ? strValue.split(",").map((s) => s.trim()).filter(Boolean)[0] || "" : strValue, isCustom: false };
        }),
        images: (v.images || []).map((img) => ({ existing: true, metadata: img, preview: getImageUrl(img.img_url) })),
        tags: v.tags || [],
      }))
      : [createEmptyVariant()];

    const currentTagNames = (prod.tag_ids || []).map(t => typeof t === 'object' ? t.name : t).filter(Boolean);

    return {
      category_id: prod.category_id?._id || prod.category_id || "",
      brand_id: prod.brand_id?._id || prod.brand_id || "",
      name: prod.name || "", description: prod.description || "",
      tax: String(prod.tax ?? 0), status: prod.status || "active",
      tag_names: currentTagNames, variants,
    };
  };

  const handleEdit = () => {
    if (!product) return;
    setFormData(prepareEditData(product));
    setEditingProduct(product);
    setCurrentStep(1);
    setExpandedVariant(0);
    setTagInput("");
    setShowModal(true);
  };

  const handleAddVariantFromTab = () => { if (!product) return; router.push(`/admin/products/${id}/add-variant?tab=${activeTab}`); };

  const closeProductModal = () => {
    formData.variants.forEach((v) => { v.images.forEach((img) => { if (img.preview?.startsWith("blob:")) URL.revokeObjectURL(img.preview); }); });
    setShowModal(false); setEditingProduct(null); setCurrentStep(1); setExpandedVariant(0); setTagInput("");
  };

  const addVariant = async () => {
    try {
      const result = await variantApi.getNextSku();
      const newIndex = formData.variants.length;
      setFormData((prev) => ({ ...prev, variants: [...prev.variants, createEmptyVariant(result.sku)] }));
      setExpandedVariant(newIndex);
    } catch { toast.error("Unable to generate SKU"); }
  };

  const duplicateVariant = async (index) => {
    try {
      const result = await variantApi.getNextSku();
      const old = formData.variants[index];
      const copy = { ...old, _id: null, sku: result.sku, attributes: old.attributes.map(i => ({ ...i })), images: [], tags: [...old.tags] };
      setFormData((prev) => { const v = [...prev.variants]; v.splice(index + 1, 0, copy); return { ...prev, variants: v }; });
      setExpandedVariant(index + 1);
    } catch { toast.error("Unable to generate SKU"); }
  };

  const removeVariant = (index) => {
    if (formData.variants.length === 1) { toast.error("At least one variant is required"); return; }
    setFormData((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  };

  const updateVariant = (index, field, value) => {
    setFormData((prev) => { const v = [...prev.variants]; v[index] = { ...v[index], [field]: value }; return { ...prev, variants: v }; });
  };

  const resetAttributeForm = () => {
    setNewAttributeData({ name: "", code: "", data_type: "text", values: [{ label: "", value: "" }], variant_allowed: true });
  };

  const handleOpenAttributeModal = (vi) => { setAttributeTargetVariant(vi); resetAttributeForm(); setShowAttributeModal(true); };
  const handleAddAttributeValue = () => setNewAttributeData((prev) => ({ ...prev, values: [...prev.values, { label: "", value: "" }] }));
  const handleRemoveAttributeValue = (index) => setNewAttributeData((prev) => ({ ...prev, values: prev.values.filter((_, i) => i !== index) }));
  const handleAttributeValueChange = (index, field, val) => {
    setNewAttributeData((prev) => { const newValues = [...prev.values]; newValues[index] = { ...newValues[index], [field]: val }; return { ...prev, values: newValues }; });
  };

  const addAttribute = (vi) => handleOpenAttributeModal(vi);

  const handleAttributeSubmit = () => {
    if (!newAttributeData.name.trim()) { toast.error("Attribute name is required"); return; }
    const finalCode = newAttributeData.code.trim() || newAttributeData.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const payload = {
      name: newAttributeData.name.trim(), code: finalCode, data_type: newAttributeData.data_type, variant_allowed: true,
      values: (newAttributeData.data_type === "select" || newAttributeData.data_type === "multi_select") ? newAttributeData.values.filter((v) => v.label.trim() && v.value.trim()) : [],
    };
    const tempKey = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const newAttrConfig = { _localKey: tempKey, name: newAttributeData.name, value: "", isCustom: false, _creating: true };
    const targetIndex = attributeTargetVariant ?? 0;
    setFormData((prev) => {
      const v = [...prev.variants];
      if (v[targetIndex]) v[targetIndex] = { ...v[targetIndex], attributes: [...(v[targetIndex]?.attributes || []), newAttrConfig] };
      return { ...prev, variants: v };
    });
    setShowAttributeModal(false);
    createAttributeMutation.mutate({ payload, tempKey, targetIndex, attributeName: newAttributeData.name });
  };

  const updateAttribute = (vi, ai, field, value) => {
    setFormData((prev) => { const v = [...prev.variants]; const a = [...v[vi].attributes]; a[ai] = { ...a[ai], [field]: value }; v[vi] = { ...v[vi], attributes: a }; return { ...prev, variants: v }; });
  };

  const removeAttribute = (vi, ai) => {
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], attributes: v[vi].attributes.filter((_, i) => i !== ai) }; return { ...prev, variants: v }; });
  };

  const addVariantTag = (vi, e) => {
    e?.preventDefault();
    const val = formData.variants[vi].tagInput?.trim().toLowerCase();
    if (!val) return;
    if (formData.variants[vi].tags.includes(val)) { toast.info("Tag already added to this variant"); return; }
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], tags: [...v[vi].tags, val], tagInput: "" }; return { ...prev, variants: v }; });
  };

  const removeVariantTag = (vi, tagName) => {
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], tags: v[vi].tags.filter(t => t !== tagName) }; return { ...prev, variants: v }; });
  };

  const updateVariantTagInput = (vi, value) => {
    setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], tagInput: value }; return { ...prev, variants: v }; });
  };

  const handleCreateGlobalTag = () => { if (!newGlobalTag.trim()) return; createTagMutation.mutate({ name: newGlobalTag.trim() }); };
  const handleCreateTagFromModal = () => {
    const tagName = newTagModalValue.trim();
    if (!tagName || !product?._id) return;
    // Create AND assign to this product in one step: backend resolveTags
    // creates the tag if missing and re-points product.tag_ids
    const data = new FormData();
    data.append("tag_names", JSON.stringify([...(displayTagNames || []), tagName]));
    updateProductTagsMutation.mutate(
      { id: product._id, data, successMsg: "Tag added successfully", errorMsg: "Failed to add tag" },
      { onSuccess: () => { setShowCreateTagModal(false); setNewTagModalValue(""); } }
    );
  };

  const startEditGlobalTag = (tag) => { setEditingTagId(tag._id); setEditingTagName(tag.name); setShowEditTagModal(true); };
  const saveEditGlobalTag = () => {
    const newName = editingTagName.trim();
    if (!newName || !editingTagId) return;
    const original = (allAssignedTags || []).find(t => String(t._id) === String(editingTagId));
    const oldName = original?.name;
    if (!oldName) return;
    if (oldName === newName) { cancelEditTag(); return; }
    const isRealTag = (globalTags || []).some(t => String(t._id) === String(editingTagId));
    if (isRealTag) {
      // Active global tag — rename the tag document (existing behaviour)
      updateTagMutation.mutate({ id: editingTagId, data: { name: newName } });
      return;
    }
    // Assigned tag without an active global tag doc — rename the assignment on
    // this product / variants (backend resolveTags creates/finds the active tag)
    const data = new FormData();
    data.append("tag_names", JSON.stringify((displayTagNames || []).map(n => (n === oldName ? newName : n))));
    const variantHasTag = (v) => (v.tags || []).map(tagNameOf).includes(oldName);
    if ((variants || []).some(variantHasTag)) {
      const updatedVariants = (variants || []).map(v => variantHasTag(v)
        ? { ...v, tags: (v.tags || []).map(tagNameOf).map(t => (t === oldName ? newName : t)) }
        : v);
      data.append("variants", JSON.stringify(updatedVariants));
    }
    updateProductTagsMutation.mutate(
      { id: product._id, data, successMsg: "Tag updated successfully", errorMsg: "Failed to update tag" },
      { onSuccess: () => { setShowEditTagModal(false); setEditingTagId(null); setEditingTagName(""); } }
    );
  };
  const cancelEditTag = () => { setShowEditTagModal(false); setEditingTagId(null); setEditingTagName(""); };
  const deleteGlobalTag = (tagId) => deleteTagMutation.mutate(tagId);

  const compressProductImage = (file) => new Promise((resolve) => {
    const image = new Image(); const imageUrl = URL.createObjectURL(file);
    image.onload = () => {
      const MAX = 1400; let w = image.width, h = image.height;
      if (w > MAX || h > MAX) { const r = Math.min(MAX / w, MAX / h); w = Math.round(w * r); h = Math.round(h * r); }
      const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, w, h);
      canvas.toBlob((blob) => { URL.revokeObjectURL(imageUrl); if (!blob) { resolve(file); return; } resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: "image/webp", lastModified: Date.now() })); }, "image/webp", 0.82);
    };
    image.onerror = () => { URL.revokeObjectURL(imageUrl); resolve(file); };
    image.src = imageUrl;
  });

  const handleImageUpload = async (vi, e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = files.filter(f => ["image/jpeg", "image/png", "image/webp"].includes(f.type));
    if (valid.length !== files.length) { toast.error("Only JPG, PNG and WebP images are allowed"); return; }
    try {
      const compressed = await Promise.all(valid.map(f => compressProductImage(f)));
      const imgs = compressed.map(f => ({ file: f, existing: false, preview: URL.createObjectURL(f) }));
      setFormData((prev) => { const v = [...prev.variants]; v[vi] = { ...v[vi], images: [...v[vi].images, ...imgs] }; return { ...prev, variants: v }; });
      toast.success("Image optimized successfully");
    } catch { toast.error("Image processing failed"); }
    e.target.value = "";
  };

  const removeImage = (vi, ii) => {
    setFormData((prev) => { const v = [...prev.variants]; const img = v[vi].images[ii]; if (img.preview?.startsWith("blob:")) URL.revokeObjectURL(img.preview); v[vi] = { ...v[vi], images: v[vi].images.filter((_, i) => i !== ii) }; return { ...prev, variants: v }; });
  };

  const handleNextStep = () => {
    if (!formData.category_id) { toast.error("Please select category"); return; }
    if (!formData.brand_id) { toast.error("Please select brand"); return; }
    if (!formData.name.trim()) { toast.error("Product name is required"); return; }
    setCurrentStep(2);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const skuSet = new Set();
    for (const v of formData.variants) {
      const sku = v.sku.trim();
      if (!sku) { toast.error("SKU is required"); return; }
      if (skuSet.has(sku)) { toast.error(`Duplicate SKU: ${sku}`); return; }
      skuSet.add(sku);
      if (!v.title.trim()) { toast.error("Variant title is required"); return; }
      if (v.cost_price === "" || v.selling_price === "") { toast.error("Cost price and selling price are required"); return; }
      if (Number(v.selling_price) <= Number(v.cost_price)) { toast.error(`Selling Price must be greater than Cost Price for "${v.title || v.sku}"`); return; }
    }

    const data = new FormData();
    data.append("category_id", formData.category_id);
    data.append("brand_id", formData.brand_id);
    data.append("name", formData.name.trim());
    data.append("description", formData.description);
    data.append("tax", formData.tax || "0");
    data.append("status", formData.status);
    data.append("tag_names", JSON.stringify(formData.tag_names || []));

    const imageVariantIndexes = [];
    const variants = formData.variants.map((v, idx) => {
      const attributes = {};
      v.attributes.forEach((a) => {
        const key = a.name.trim();
        if (!key) return;
        const preset = rawAttributes.find((p) => p.name === key);
        const isMulti = preset?.data_type === "multi_select";
        if (isMulti) { const singleVal = String(a.value || "").trim(); if (!singleVal) return; attributes[key] = singleVal; }
        else if (Array.isArray(a.value)) { if (a.value.length === 0) return; attributes[key] = a.value.join(","); }
        else { if (a.value === "" || a.value == null) return; attributes[key] = a.value; }
      });

      const existingImages = v.images.filter(i => i.existing).map(i => i.metadata);
      v.images.filter(i => !i.existing && i.file).forEach(i => { data.append("images", i.file); imageVariantIndexes.push(idx); });

      let finalSku = v.sku.trim();
      if (editingProduct) { const orig = editingProduct.variants?.find(ov => ov._id && String(ov._id) === String(v._id)); if (orig) finalSku = orig.sku; }

      return {
        _id: v._id || undefined, sku: finalSku, title: v.title.trim(), description: v.description,
        cost_price: Number(v.cost_price || 0), selling_price: Number(v.selling_price || 0),
        quantity: Number(v.quantity || 0),
        topup: Number(v.topup || 0),
        attributes, existing_images: existingImages, tags: v.tags || [],
      };
    });

    data.append("variants", JSON.stringify(variants));
    data.append("image_variant_indexes", JSON.stringify(imageVariantIndexes));

    if (editingProduct) updateMutation.mutate({ id: editingProduct._id, data });
  };

  const addTag = (e) => {
    e?.preventDefault();
    const val = tagInput.trim().toLowerCase();
    if (!val) return;
    if (formData.tag_names.includes(val)) { toast.info("Tag already added"); setTagInput(""); return; }
    setFormData(prev => ({ ...prev, tag_names: [...prev.tag_names, val] }));
    setTagInput("");
  };

  const removeTag = (tagName) => setFormData(prev => ({ ...prev, tag_names: prev.tag_names.filter(t => t !== tagName) }));

  const handleAddVariantTag = () => {
    const val = variantTagInput.trim().toLowerCase();
    if (!val) return;
    const currentTags = editingVariantForTags?.tags || [];
    if (currentTags.includes(val)) { toast.info("Tag already added"); setVariantTagInput(""); return; }
    const newTags = [...currentTags, val];
    setEditingVariantForTags({ ...editingVariantForTags, tags: newTags });
    const updatedVariants = product.variants.map(v => String(v._id) === String(editingVariantForTags._id) ? { ...v, tags: newTags } : v);
    const data = new FormData();
    data.append("variants", JSON.stringify(updatedVariants));
    updateMutation.mutate({ id: product._id, data });
    setVariantTagInput("");
  };

  const handleRemoveVariantTag = (tagToRemove) => {
    const newTags = (editingVariantForTags?.tags || []).filter(t => t !== tagToRemove);
    setEditingVariantForTags({ ...editingVariantForTags, tags: newTags });
    const updatedVariants = product.variants.map(v => String(v._id) === String(editingVariantForTags._id) ? { ...v, tags: newTags } : v);
    const data = new FormData();
    data.append("variants", JSON.stringify(updatedVariants));
    updateMutation.mutate({ id: product._id, data });
  };

  // Loading/Error states
  if (isLoading) return (
    <div className="w-full flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin" />
        <p className="text-[13px] font-medium" style={{ color: "var(--text-muted)" }}>Loading product details...</p>
      </div>
    </div>
  );

  if (isError || !product) return (
    <div className="w-full flex items-center justify-center py-24">
      <div className="flex flex-col items-center gap-4 max-w-md text-center px-6 py-10 rounded-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--danger-soft)" }}>
          <AlertTriangle className="w-7 h-7" style={{ color: "var(--danger)" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Product Not Found</h2>
        <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>This product does not exist or has been removed.</p>
        <button onClick={() => router.push("/admin/products")} className="mt-4 h-10 px-5 rounded-lg text-[13px] font-semibold flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
          <ArrowLeft className="w-4 h-4" /> Back to Products
        </button>
      </div>
    </div>
  );

  const variants = product.variants || [];
  const totalStock = variants.reduce((t, v) => t + Number(v.quantity || 0), 0);
  const totalVariants = variants.length;
  // Detail drawer ke liye live variant — refetch / tag update ke baad bhi fresh data
  const drawerVariant = variantDetailsTarget
    ? variants.find((v) => String(v._id) === String(variantDetailsTarget._id)) || variantDetailsTarget
    : null;
  const totalValue = variants.reduce((t, v) => t + (Number(v.selling_price || 0) * Number(v.quantity || 0)), 0);
  // ✅ Product-level price: min/max variant price (existing variant data hi use hota hai).
  // Sab variants ka same price → single price, warna price range "MIN – MAX".
  const lowestPrice = variants.length > 0 ? Math.min(...variants.map(v => Number(v.selling_price || 0))) : 0;
  const highestPrice = variants.length > 0 ? Math.max(...variants.map(v => Number(v.selling_price || 0))) : 0;
  const priceRange = lowestPrice === highestPrice
    ? `Rs. ${lowestPrice.toLocaleString()}`
    : `Rs. ${lowestPrice.toLocaleString()} – Rs. ${highestPrice.toLocaleString()}`;

  const displayTagNames = (product.tag_ids || []).map(t => typeof t === 'object' ? t.name : t).filter(Boolean);
  const assignedTagNames = new Set(displayTagNames.map(n => String(n).trim()).filter(Boolean));
  (variants || []).forEach(v => { (v.tags || []).forEach(tag => { const n = tagNameOf(tag); if (n) assignedTagNames.add(String(n).trim()); }); });
  // Case-insensitive matching: Tag docs store lowercased names while variant
  // tag strings keep the original case, so compare on lowercase everywhere.
  const lowerAssignedNames = new Set([...assignedTagNames].map(n => n.toLowerCase()));
  const globalTagNames = new Set((globalTags || []).map(t => String(t.name || t).trim().toLowerCase()));
  const assignedTags = (globalTags || []).filter(tag => lowerAssignedNames.has(String(tag.name || tag).trim().toLowerCase()));
  // Resolve assigned tag names/IDs back to their full records (including createdby).
  const tagRecordLookup = {};
  (globalTags || []).forEach(tag => {
    if (!tag || typeof tag !== "object") return;
    const nameKey = String(tag.name || "").trim().toLowerCase();
    const idKey = tag._id ? String(tag._id).trim().toLowerCase() : "";
    if (nameKey) tagRecordLookup[nameKey] = tag;
    if (idKey) tagRecordLookup[idKey] = tag;
  });
  const missingTagNames = [];
  assignedTagNames.forEach(name => {
    if (!globalTagNames.has(name.toLowerCase())) {
      missingTagNames.push(name);
    }
  });
  const syntheticTags = missingTagNames.map(name => ({ name, _id: name }));
  const allAssignedTags = [...assignedTags, ...syntheticTags];

  // ✅ FIX: Overview ka Tags block sirf product.tag_ids parhta tha, jabke naye
  // products mein tags variant-level assign hote hain (Variant Tags field /
  // "Add Tag" action) — isliye Overview hamesha "No tags assigned" dikhata tha.
  // Tags tab ki tarah product + variants ka union dikhao.
  const overviewTagNames = allAssignedTags.map(tagNameOf).filter(Boolean);

  // Source / Variant mapping for tag display (keys lowercased for case-insensitive lookup)
  const tagSourceInfo = {};
  (product.tag_ids || []).forEach(tagId => {
    const tagName = typeof tagId === 'object' ? tagId.name : tagId;
    if (tagName) tagSourceInfo[String(tagName).trim().toLowerCase()] = { source: "Product", variant: "—" };
  });
  (variants || []).forEach(v => {
    (v.tags || []).forEach(tagEntry => {
      const name = String(tagNameOf(tagEntry) || "").trim().toLowerCase();
      if (name) tagSourceInfo[name] = { source: "Variant", variant: v.sku || v.title || String(v._id) };
    });
  });
  const firstVariant = variants[0];
  const productImage = firstVariant?.images?.[0] ? getImageUrl(firstVariant.images[0].img_url) : null;

  // Hero side panel: attribute summary (derived from existing variant attributes)
  const attributeSummary = (() => {
    const map = {};
    (variants || []).forEach((v) => {
      Object.entries(v.attributes || {}).forEach(([name, value]) => {
        const n = String(name || "").trim();
        if (!n) return;
        const val = attrValueOf(value);
        if (!map[n]) map[n] = new Set();
        if (val) map[n].add(val);
      });
    });
    return Object.entries(map).map(([name, vals]) => ({ name, display: vals.size > 1 ? "Multiple" : [...vals][0] || "—" }));
  })();
  const allAttributeDetails = (() => {
    const valuesByName = new Map();
    (variants || []).forEach((variant) => {
      Object.entries(variant.attributes || {}).forEach(([name, value]) => {
        const cleanName = String(name || "").trim();
        const cleanValue = attrValueOf(value);
        if (!cleanName || !cleanValue) return;
        if (!valuesByName.has(cleanName)) valuesByName.set(cleanName, new Set());
        valuesByName.get(cleanName).add(cleanValue);
      });
    });
    return [...valuesByName.entries()].map(([name, values]) => ({ name, value: [...values].join(", ") }));
  })();
  const attributeCount = attributeSummary.length;
  const tagCount = allAssignedTags.length;

  // ==================== PERSISTED ACTIVITY TIMELINE ====================
  // Builds the History list from audit timestamps only. Every event here maps to
  // a real write the backend performed, so the tab can never show an action that
  // did not happen:
  //   • Product  → created_at / updated_at  (+ createdby / updatedby)
  //   • Variant  → created_at / updated_at  (+ createdby / updatedby)
  // The backend only bumps those stamps when isModified() is true, so untouched
  // records produce no event. Tag documents are intentionally not treated as
  // product activity — a tag's own timestamps belong to the shared tag library.
  const activityTimeline = (() => {
    const events = [];
    const push = (event) => {
      const meta = activityMetaOf(event?.type);
      // No valid timestamp → no proven event, so it is never rendered.
      if (!event?.date || !meta) return;
      const time = new Date(event.date).getTime();
      if (!Number.isFinite(time)) return;
      events.push({ ...event, group: meta.group, time });
    };

    /* ---------------- Product ---------------- */
    push({
      key: `product-created-${product._id}`,
      type: "product-created",
      actor: product.createdby || null,
      description: "Product was added to the catalog",
      date: product.created_at,
    });

    if (hasRealUpdate(product.created_at, product.updated_at)) {
      push({
        key: `product-updated-${product._id}`,
        type: "product-updated",
        actor: product.updatedby || null,
        description: "Product details were modified",
        date: product.updated_at,
      });
    }

    /* ---------------- Variants ---------------- */
    (variants || []).forEach((variant, index) => {
      const variantKey = String(variant._id || index);
      const label = variantLabelOf(variant);
      // SKU identifies the variant in every event. Deliberately NOT a list of the
      // current price / stock / status — those are the values *right now* and would
      // wrongly imply they were the fields that changed.
      const subject = [{ label: "SKU", value: variant.sku || "—", mono: true }];

      push({
        key: `variant-created-${variantKey}`,
        type: "variant-created",
        actor: variant.createdby || null,
        description: `Variant "${label}" was added to this product`,
        date: variant.created_at,
        subject,
      });

      if (hasRealUpdate(variant.created_at, variant.updated_at)) {
        push({
          key: `variant-updated-${variantKey}`,
          type: "variant-updated",
          actor: variant.updatedby || null,
          description: `Variant "${label}" was edited`,
          date: variant.updated_at,
          subject,
        });
      }
    });

    /* ---------------- Live socket overlay (deduped against DB entries) ---------------- */
    // The refetched document and the socket broadcast describe the same save with
    // the same millisecond, so an exact stamp match drops only true duplicates.
    const persistedStamps = new Set(events.map((e) => activityStamp(e.type, e.date)));
    (liveEvents || []).forEach((liveEvent) => {
      const type = liveEvent.type === "created" ? "product-created" : "product-updated";
      if (persistedStamps.has(activityStamp(type, liveEvent.date))) return;
      push({
        key: liveEvent.key,
        type,
        actor: liveEvent.user || null,
        description: liveEvent.type === "created"
          ? "Product was added to the catalog"
          : "Product details were modified",
        date: liveEvent.date,
        live: true,
      });
    });

    // Newest first: the most recent action always sits on top.
    return events.sort((a, b) => b.time - a.time);
  })();

  // Grouped into day buckets (Today / Yesterday / date) for the timeline header.
  const filteredActivity = activityFilter === "all"
    ? activityTimeline
    : activityTimeline.filter((e) => e.group === activityFilter);

  const activityGroups = (() => {
    const buckets = new Map();
    filteredActivity.forEach((ev) => {
      const bucket = dayBucketOf(ev.date);
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket).push(ev);
    });
    return [...buckets.entries()].map(([bucket, items]) => ({
      bucket,
      label: dayLabelOf(items[0].date),
      items,
    }));
  })();

  const productEventCount = activityTimeline.filter((e) => e.group === "product").length;
  const variantCreateCount = activityTimeline.filter((e) => e.type === "variant-created").length;
  const variantUpdateCount = activityTimeline.filter((e) => e.type === "variant-updated").length;
  // Entries the backend never attributed to a user. Surfaced so the empty actor
  // rows are explained instead of looking like a rendering fault.
  const unattributedCount = activityTimeline.filter((e) => !actorInfo(e.actor).known).length;

  // Resolved once so the "Created By" / "Updated By" cards and the timeline all
  // agree on the same naming rules (and so a raw ObjectId can never be mistaken
  // for a person just because the field is truthy).
  const createdByInfo = actorInfo(product.createdby);
  const updatedByInfo = actorInfo(product.updatedby);

  // Every number below is derived from a timestamp the backend itself wrote —
  // nothing here counts an action that was never recorded.
  const activitySummary = [
    { id: "total-events", label: "Recorded Changes", icon: Activity, soft: "var(--accent-soft)", color: "var(--accent)", value: activityTimeline.length, hint: "All activity on this product" },
    { id: "product-events", label: "Product Changes", icon: Package, soft: "var(--success-soft)", color: "var(--success)", value: productEventCount, hint: "Created & later edited" },
    { id: "variants-added", label: "Variants Added", icon: Layers3, soft: "var(--purple-soft)", color: "var(--purple)", value: variantCreateCount, hint: "Recorded variant creations" },
    { id: "variant-updates", label: "Variants Edited", icon: Pencil, soft: "var(--warning-soft)", color: "var(--warning)", value: variantUpdateCount, hint: "Recorded variant edits" },
  ];

  const activityFilters = [
    { id: "all", label: "All Activity", count: activityTimeline.length },
    { id: "product", label: "Product", count: productEventCount },
    { id: "variant", label: "Variants", count: variantCreateCount + variantUpdateCount },
  ];

  // Helper to open gallery
  const openGallery = (index) => {
    setCurrentImageIndex(index);
    setShowImageGallery(true);
  };

  // ==================== VARIANTS SECTION (shared: Overview + Variants tabs) ====================
  const variantsSection = (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Variants</h2>
        <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{totalVariants} {totalVariants === 1 ? "variant" : "variants"} · {totalStock} units total</p>
      </div>
      <button onClick={handleAddVariantFromTab} className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
        <Plus className="w-4 h-4" /> Add Variant
      </button>
    </div>

    {variants.length === 0 ? (
      <div className="rounded-xl py-10 flex flex-col items-center justify-center gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: "var(--bg-tertiary)" }}>
          <Layers3 className="w-6 h-6" style={{ color: "var(--text-muted)" }} />
        </div>
        <p className="text-[13px] font-medium text-[var(--text-secondary)]">No variants yet</p>
        <p className="text-[12px] text-[var(--text-muted)]">This product doesn&apos;t have any variants yet.</p>
        <button onClick={handleAddVariantFromTab} className="mt-2 h-10 px-5 rounded-lg text-[12px] font-semibold flex items-center gap-2" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
          <Plus className="w-4 h-4" /> Create First Variant
        </button>
      </div>
    ) : (
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <table className="w-full text-[12px]">
          <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
            <tr>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Image</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">SKU</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Variant / Color</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Price</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Stock</th>
              <th className="text-left px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Status</th>
              <th className="text-right px-4 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) => {
              const isLowStock = Number(variant.quantity) <= 5;
              const isActive = variant.status === "active" || !variant.status;
              return (
                <tr key={variant._id || index} onClick={() => setVariantDetailsTarget(variant)} className="cursor-pointer transition-colors hover:bg-[var(--bg-row-hover)]" style={{ borderBottom: index < variants.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                  <td className="px-4 py-2.5">
                    {variant.images?.length > 0 ? (
                      <button onClick={(e) => { e.stopPropagation(); openGallery(0); }} className="block w-10 h-10 rounded-md overflow-hidden border border-[var(--border-color)] hover:ring-2 hover:ring-[var(--accent)] transition-all">
                        <img src={getImageUrl(variant.images[0].img_url)} alt="" className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <div className="w-10 h-10 rounded-md bg-[var(--bg-tertiary)] border border-[var(--border-color)] flex items-center justify-center">
                        <ImageIcon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--text-secondary)] truncate max-w-[140px]">{variant.sku}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-[13px] text-[var(--text-primary)] truncate max-w-[180px]">{variant.title || `Variant ${index + 1}`}</p>
                    {variant.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {variant.tags.slice(0, 2).map((tag, idx) => (
                          <span key={`${tag}-${idx}`} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)]">{tag}</span>
                        ))}
                        {variant.tags.length > 2 && (
                          <span className="text-[9px] text-[var(--text-muted)]">+{variant.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-[13px]" style={{ color: "var(--success)" }}>Rs. {Number(variant.selling_price || 0).toLocaleString()}</td>
                  <td className="px-4 py-2.5 font-semibold text-[13px]" style={{ color: isLowStock ? "var(--danger)" : "var(--text-primary)" }}>{variant.quantity || 0}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
                      style={{
                        backgroundColor: isActive ? "var(--success-soft)" : "var(--danger-soft)",
                        color: isActive ? "var(--success)" : "var(--danger)",
                        border: `1px solid ${isActive ? "color-mix(in srgb, var(--success) 28%, transparent)" : "color-mix(in srgb, var(--danger) 28%, transparent)"}`,
                      }}>
                      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: isActive ? "var(--success)" : "var(--danger)" }} />
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right relative z-10">
                    <MoreMenu actions={[
                      {
                        label: "View Detailed",
                        icon: <Eye className="w-3.5 h-3.5" />,
                        onClick: () => setVariantDetailsTarget(variant)
                      },

                      { 
                        label: "Edit Variant", 
                        icon: <Edit3 className="w-3.5 h-3.5" />, 
                        onClick: () => router.push(`/admin/products/${id}/add-variant?edit=${variant._id}&tab=${activeTab}`) 
                      },
                      { 
                        label: "Add Tag", 
                        icon: <TagIcon className="w-3.5 h-3.5" />, 
                        onClick: () => { 
                          setEditingVariantForTags({ ...variant, tags: variant.tags || [] }); 
                          setShowVariantTagsModal(true); 
                          setVariantTagInput(""); 
                        } 
                      },
                      { 
                        label: isActive ? "Disable" : "Enable", 
                        icon: isActive ? <Ban className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />, 
                        onClick: () => {
                          variantStatusMutation.mutate({ variantId: variant._id, status: isActive ? "inactive" : "active" });
                        }
                      },
                      { 
                        label: "Delete", 
                        icon: <Trash2 className="w-3.5 h-3.5" />, 
                        destructive: true, 
                        onClick: () => {
                          setDeleteVariantTarget(variant);
                        } 
                      },
                    ]} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
  );

  return (
    <div className="w-full space-y-4 pb-10">
      
      {/* IMAGE GALLERY MODAL */}
      {showImageGallery && firstVariant?.images && (
        <ImageGalleryModal 
          images={firstVariant.images} 
          initialIndex={currentImageIndex} 
          onClose={() => setShowImageGallery(false)} 
        />
      )}

      {/* VARIANT DETAILS DRAWER (3-dot menu → View Detailed) */}
      {drawerVariant && (
        <VariantDetailsDrawer
          variant={drawerVariant}
          productName={product?.name}
          onClose={() => { if (showVariantTagsModal) return; setVariantDetailsTarget(null); }}
          onEdit={() => {
            const variantId = drawerVariant._id;
            setVariantDetailsTarget(null);
            router.push(`/admin/products/${id}/add-variant?edit=${variantId}&tab=${activeTab}`);
          }}
          onDelete={() => {
            setDeleteVariantTarget(drawerVariant);
            setVariantDetailsTarget(null);
          }}
          onManageTags={() => {
            setEditingVariantForTags({ ...drawerVariant, tags: drawerVariant.tags || [] });
            setShowVariantTagsModal(true);
            setVariantTagInput("");
          }}
          onRemoveTag={(tag) => variantTagUpdateMutation.mutate({
            variantId: drawerVariant._id,
            tags: (drawerVariant.tags || []).map(tagNameOf).filter((name) => name && name !== tag),
          })}
          tagUpdatePending={variantTagUpdateMutation.isPending}
        />
      )}


      {showAllAttributes && (
        <AllAttributesModal
          attributes={allAttributeDetails}
          onClose={() => setShowAllAttributes(false)}
        />
      )}

      {/* HEADER: Breadcrumb + Actions */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <nav className="flex items-center flex-wrap gap-1.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
            <button onClick={() => router.push("/admin/products")} className="hover:text-[var(--text-primary)] transition-colors font-medium">Products</button>
            <ChevronRight className="w-3 h-3 shrink-0" />
            {product.category_id?.name && (
              <>
                <span className="max-w-[160px] truncate">{product.category_id.name}</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
              </>
            )}
            {product.brand_id?.name && (
              <>
                <span className="max-w-[160px] truncate">{product.brand_id.name}</span>
                <ChevronRight className="w-3 h-3 shrink-0" />
              </>
            )}
            <span className="max-w-[240px] truncate font-semibold" style={{ color: "var(--text-primary)" }}>{product.name}</span>
          </nav>
          <h1 className="mt-2 text-[22px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{product.name}</h1>
          <p className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>View product information, variants, status and related details.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDelete}
            className="h-8 px-3.5 rounded-lg text-[12px] font-semibold flex items-center gap-1.5 transition hover:opacity-90"
            style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)" }}
          >
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
        </div>
      </div>

      {/* PRODUCT HERO: Gallery + Info + Meta panel */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        <div className="xl:col-span-8 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-0">
          {/* Image Area - NOW CLICKABLE */}
          <div className="relative bg-[var(--bg-tertiary)] p-5 md:p-6 flex items-center justify-center min-h-[280px] md:min-h-[340px] group">
            {firstVariant?.images?.length > 0 ? (
              <div className="flex w-full max-w-md items-start gap-3">
                {/* Main Clickable Image */}
                <button 
                  onClick={() => openGallery(0)}
                  className="block w-full relative overflow-hidden rounded-xl shadow-lg group-hover:shadow-2xl transition-all duration-300"
                >
                  <img
                    src={getImageUrl(firstVariant.images[0].img_url)}
                    alt={product.name}
                    className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-500"
                    style={{ maxHeight: 300 }}
                  />
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 bg-black/60 backdrop-blur-sm text-white px-4 py-2 rounded-full flex items-center gap-2">
                      <ZoomIn className="w-4 h-4" />
                      <span className="text-xs font-medium">View Full Size</span>
                    </div>
                  </div>
                </button>

                {/* Clickable Thumbnails */}
                {firstVariant.images.length > 1 && (
                  <div className="flex max-h-[300px] w-14 shrink-0 flex-col gap-2 overflow-y-auto pb-1 scrollbar-hide">
                    {firstVariant.images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => openGallery(i)}
                        className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all duration-200 ${
                          i === 0 
                            ? "border-[var(--accent)] ring-2 ring-[var(--accent)]/20 scale-105" 
                            : "border-[var(--border-color)] hover:border-[var(--text-muted)] opacity-70 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={getImageUrl(img.img_url)}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-48 rounded-xl flex flex-col items-center justify-center bg-[var(--bg-secondary)] border border-dashed border-[var(--border-color)]">
                <ImageIcon className="w-12 h-12 mb-2" style={{ color: "var(--text-muted)" }} />
                <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>No product images available</p>
              </div>
            )}
          </div>

          {/* Info Area */}
          <div className="p-4 md:p-5 flex flex-col justify-center gap-4">
            <h2 className="text-[20px] md:text-[22px] font-bold leading-tight" style={{ color: "var(--text-primary)" }}>{product.name}</h2>
            
            <p className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              {product.description ? product.description.slice(0, 160) + (product.description.length > 160 ? "..." : "") : "No description provided."}
            </p>
            <div className="flex items-baseline gap-3">
              {/* ✅ Product price — sirf variant price data se:
                  sab variants same price → single price; alag price → "Rs. MIN – Rs. MAX".
                  Alag variant prices ko original/sale (crossed-out) treat NAHI karte. */}
              <span className="text-2xl font-extrabold" style={{ color: "var(--text-primary)" }}>
                {priceRange}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: product.status === "active" ? "var(--success)" : "var(--danger)" }} />
              <span className="text-[12px] font-bold" style={{ color: product.status === "active" ? "var(--success)" : "var(--danger)" }}>
                {product.status === "active" ? "In Stock" : "Inactive"}
              </span>
              <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
                (Total: {totalStock} units)
              </span>
            </div>
            
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="rounded-lg p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Layers3 className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[10px] uppercase tracking-wide font-bold" style={{ color: "var(--text-muted)" }}>Variants</p>
                </div>
                <p className="text-[14px] font-extrabold tabular-nums" style={{ color: "var(--text-primary)" }}>{totalVariants}</p>
              </div>
              <div className="rounded-lg p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <Package className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[10px] uppercase tracking-wide font-bold" style={{ color: "var(--text-muted)" }}>Stock</p>
                </div>
                <p className="text-[14px] font-extrabold tabular-nums" style={{ color: "var(--text-primary)" }}>{totalStock}</p>
              </div>
              <div className="rounded-lg p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <FileText className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[10px] uppercase tracking-wide font-bold" style={{ color: "var(--text-muted)" }}>Attributes</p>
                </div>
                <p className="text-[14px] font-extrabold tabular-nums" style={{ color: "var(--text-primary)" }}>{attributeCount}</p>
              </div>
              <div className="rounded-lg p-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)]">
                <div className="flex items-center gap-1.5 mb-1">
                  <TagIcon className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[10px] uppercase tracking-wide font-bold" style={{ color: "var(--text-muted)" }}>Tags</p>
                </div>
                <p className="text-[14px] font-extrabold tabular-nums" style={{ color: "var(--text-primary)" }}>{tagCount}</p>
              </div>
            </div>
          </div>
          </div>
        </div>

        {/* SIDE PANEL: Brand / Category / Key Attributes */}
        <div className="xl:col-span-4 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div className="p-4 flex flex-col gap-4">
            {/* Brand */}
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Brand</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-bold" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--accent)" }}>
                    {product.brand_id?.name ? ini(product.brand_id.name) : <Store className="w-4 h-4" />}
                  </div>
                  <span className="truncate text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {product.brand_id?.name || "—"}
                  </span>
                </div>
                {product.brand_id?._id && (
                  <button type="button" onClick={() => router.push(`/admin/brands/${product.brand_id._id}`)} className="flex items-center gap-0.5 text-[11px] font-medium hover:underline shrink-0" style={{ color: "var(--accent)" }}>
                    View brand <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Category */}
            <div className="border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Category</p>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--accent)" }}>
                    <Box className="w-4 h-4" />
                  </div>
                  <span className="truncate text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {product.category_id?.name || "—"}
                  </span>
                </div>
                {product.category_id?._id && (
                  <button type="button" onClick={() => router.push(`/admin/categories/${product.category_id._id}`)} className="flex items-center gap-0.5 text-[11px] font-medium hover:underline shrink-0" style={{ color: "var(--accent)" }}>
                    View category <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Key Attributes */}
            <div className="border-t pt-3" style={{ borderColor: "var(--border-color)" }}>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Key Attributes</p>
              {attributeSummary.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {attributeSummary.slice(0, 4).map((attr) => (
                      <div key={attr.name} className="rounded-lg p-2" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                        <p className="truncate text-[10px] font-semibold" style={{ color: "var(--text-primary)" }}>{attr.name}</p>
                        <p className="truncate text-[10px]" style={{ color: "var(--text-muted)" }}>{attr.display}</p>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setShowAllAttributes(true)} className="mt-2.5 flex items-center gap-0.5 text-[11px] font-medium hover:underline" style={{ color: "var(--accent)" }}>
                    View all attributes <ChevronRight className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No attributes set on variants.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* MAIN CONTENT - FULL WIDTH NOW */}
        <div className="space-y-4">
          {/* TABS */}
          <div className="flex items-center gap-6 border-b" style={{ borderColor: "var(--border-color)" }}>
            {[
              { id: "overview", label: "Overview" },
              { id: "variants", label: "Variants", count: totalVariants > 0 ? totalVariants : null },
              { id: "tags", label: "Tags", count: allAssignedTags.length > 0 ? allAssignedTags.length : null },
              { id: "category", label: "Category" },
              { id: "brand", label: "Brand" },
              { id: "activity", label: "History" },
            ].map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className="relative py-3 text-[13px] font-medium transition-colors outline-none whitespace-nowrap"
                  style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
                >
                  {t.label}
                  {t.count != null && t.count > 0 && (
                    <span className="ml-1.5 text-[11px] font-medium" style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}>
                      ({t.count})
                    </span>
                  )}
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB CONTENT */}
          <div className="space-y-4">
            {activeTab === "overview" && (
              <div className="space-y-4">
                {/* Product Details + Description + Variants | Side cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 flex flex-col gap-4 self-start">
                    {/* Product Details */}
                    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                      <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Product Details</h3>
                        <span className="text-[10px] font-medium text-[var(--text-muted)]">Basic information</span>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">SKU</p>
                            <p className="text-[14px] font-mono font-medium text-[var(--text-secondary)]">{firstVariant?.sku || variants?.[0]?.sku || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Product Name</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.name}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Brand</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.brand_id?.name || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Category</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.category_id?.name || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Tax Rate</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.tax || 0}%</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Status</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.status === "active" ? "Active" : "Inactive"}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Price Range</p>
                            <p className="text-[14px] font-semibold text-[var(--accent)]">{priceRange}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Total Stock</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{totalStock} units</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Created at</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{fd(product.created_at)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">Updated at</p>
                            <p className="text-[14px] font-medium text-[var(--text-primary)]">{product.updated_at ? fd(product.updated_at) : "Never"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Description + Tags */}
                    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                      <div className="px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Description</h3>
                      </div>
                      <div className="p-4 space-y-4">
                        <p className="text-[12px] leading-relaxed whitespace-pre-wrap text-[var(--text-secondary)]">
                          {product.description || "No description provided for this product."}
                        </p>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Tags</p>
                            {overviewTagNames.length > 0 && (
                              <button type="button" onClick={() => setActiveTab("tags")} className="text-[11px] font-medium hover:underline" style={{ color: "var(--accent)" }}>
                                Manage
                              </button>
                            )}
                          </div>
                          {overviewTagNames.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {(overviewTagNames || []).map((tag) => (
                                <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)]">{tag}</span>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[12px] text-[var(--text-muted)]">No tags assigned to this product or its variants yet.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {variantsSection}
                  </div>

                  <div className="flex flex-col gap-3">
                    {/* Product Images */}
                    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                      <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Product Images</h3>
                        <span className="text-[10px] font-medium text-[var(--text-muted)]">{firstVariant?.images?.length || 0} {firstVariant?.images?.length === 1 ? "image" : "images"}</span>
                      </div>
                      <div className="p-3">
                        {firstVariant?.images?.length > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => openGallery(0)}
                              className="group/img relative block w-full overflow-hidden rounded-lg border border-[var(--border-color)]"
                            >
                              <img src={getImageUrl(firstVariant.images[0].img_url)} alt={product.name} className="w-full h-36 object-cover" />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/img:bg-black/20">
                                <span className="flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover/img:opacity-100">
                                  <ZoomIn className="w-3 h-3" /> View
                                </span>
                              </span>
                            </button>
                            {firstVariant.images.length > 1 && (
                              <div className="mt-2 grid grid-cols-4 gap-2">
                                {firstVariant.images.slice(1, 4).map((img, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => openGallery(i + 1)}
                                    className="h-14 w-full overflow-hidden rounded-md border border-[var(--border-color)] transition-all hover:ring-2 hover:ring-[var(--accent)]"
                                  >
                                    <img src={getImageUrl(img.img_url)} alt="" className="h-full w-full object-cover" />
                                  </button>
                                ))}
                                {firstVariant.images.length > 4 && (
                                  <button
                                    type="button"
                                    onClick={() => openGallery(4)}
                                    className="flex h-14 w-full items-center justify-center rounded-md text-[11px] font-bold"
                                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
                                  >
                                    +{firstVariant.images.length - 4}
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex h-24 w-full flex-col items-center justify-center rounded-lg border border-dashed" style={{ borderColor: "var(--border-color)" }}>
                            <ImageIcon className="mb-1 h-6 w-6" style={{ color: "var(--text-muted)" }} />
                            <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>No images available</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Info */}
                    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                      <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Quick Info</h3>
                      </div>
                      <div className="px-3 pb-3 pt-1">
                        <DataRow label="Total Stock" value={`${totalStock} units`} highlight />
                        <DataRow label="Total Variants" value={totalVariants} />
                        <DataRow label="Stock Value" value={`Rs. ${totalValue.toLocaleString()}`} />
                        <DataRow label="Price Range" value={priceRange} highlight mono />
                        <DataRow label="Tax Rate" value={`${product.tax || 0}%`} />
                      </div>
                    </div>

                    {/* Created By */}
                    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                      <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                        <h3 className="text-sm font-bold text-[var(--text-primary)]">Created By</h3>
                      </div>
                      <div className="p-3">
                        {createdByInfo.known ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                              <Avatar name={createdByInfo.name} size="md" color="emerald" />
                              <div>
                                <p className="text-[13px] font-semibold text-[var(--text-primary)]">{createdByInfo.name}</p>
                                <p className="text-[11px] text-[var(--text-muted)]">{createdByInfo.email || "—"}</p>
                              </div>
                            </div>
                            <p className="text-[11px] text-[var(--text-muted)] mt-1">Created At: <span className="font-medium text-[var(--text-secondary)]">{fd(product.created_at)}</span></p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <p className="text-[13px] font-semibold text-[var(--text-primary)]">Not recorded</p>
                            <p className="text-[11px] text-[var(--text-muted)]">Created At: <span className="font-medium text-[var(--text-secondary)]">{fd(product.created_at)}</span></p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Updated By — shown only when the product carries a real
                        update (audit timestamp later than creation), using the
                        persisted audit user so it survives a page reload. */}
                    {hasRealUpdate(product.created_at, product.updated_at) && (
                      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                        <div className="px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-tertiary)]/30">
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">Updated By</h3>
                        </div>
                        <div className="p-3">
                          {updatedByInfo.known ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-3">
                                <Avatar name={updatedByInfo.name} size="md" color="blue" />
                                <div>
                                  <p className="text-[13px] font-semibold text-[var(--text-primary)]">{updatedByInfo.name}</p>
                                  <p className="text-[11px] text-[var(--text-muted)]">{updatedByInfo.email || "—"}</p>
                                </div>
                              </div>
                              <p className="text-[11px] text-[var(--text-muted)] mt-1">Updated At: <span className="font-medium text-[var(--text-secondary)]">{fd(product.updated_at)}</span></p>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <p className="text-[13px] font-semibold text-[var(--text-primary)]">Not recorded</p>
                              <p className="text-[11px] text-[var(--text-muted)]">Updated At: <span className="font-medium text-[var(--text-secondary)]">{fd(product.updated_at)}</span></p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* VARIANTS TAB */}
            {activeTab === "variants" && variantsSection}

            {/* TAGS TAB */}
            {activeTab === "tags" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-bold text-[var(--text-primary)]">Tags</h2>
                    <p className="text-[12px] text-[var(--text-muted)] mt-0.5">{allAssignedTags.length} {allAssignedTags.length === 1 ? "tag" : "tags"} assigned</p>
                  </div>
                  <button
                    onClick={() => setShowCreateTagModal(true)}
                    className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 transition hover:opacity-90"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    <Plus className="w-4 h-4" /> Add Tag
                  </button>
                </div>

                {allAssignedTags.length === 0 ? (
                  <div className="rounded-xl py-14 flex flex-col items-center justify-center gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <TagIcon className="w-8 h-8" style={{ color: "var(--text-muted)" }} />
                    <p className="text-[13px] font-medium text-[var(--text-secondary)]">No assigned tags</p>
                    <p className="text-[12px] text-[var(--text-muted)]">Tags assigned to this product or its variants will appear here.</p>
                    <button
                      onClick={() => setShowCreateTagModal(true)}
                      className="mt-2 h-10 px-5 rounded-lg text-[12px] font-semibold flex items-center gap-2"
                      style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                    >
                      <Plus className="w-4 h-4" /> Create First Tag
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <table className="w-full text-[12px]">
                      <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                         <tr>
                           <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Tag Name</th>
                           <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Source</th>
                           <th className="text-left px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Created By</th>
                           <th className="text-right px-5 py-3 font-semibold uppercase tracking-wider text-[10px] text-[var(--text-muted)]">Actions</th>
                         </tr>
                      </thead>
                      <tbody>
                        {allAssignedTags.map((tag, index) => (
                          <tr key={tag._id || tag.name || index} style={{ borderBottom: index < allAssignedTags.length - 1 ? "1px solid var(--border-color)" : "none" }}>
                             <td className="px-5 py-3.5">
                               <span className="font-semibold text-[13px] capitalize" style={{ color: "var(--text-primary)" }}>{tag.name}</span>
                             </td>
                             <td className="px-5 py-3.5 text-[12px] text-[var(--text-secondary)] capitalize">
                               {tagSourceInfo[String(tag.name || tag || "").trim().toLowerCase()]?.source || "—"}
                             </td>
                              <td className="px-5 py-3.5 text-[12px] text-[var(--text-secondary)]">
                                {(() => {
                                  const lookupKey = String(tag.name || tag || "").trim().toLowerCase();
                                  const lookupIdKey = tag._id ? String(tag._id).trim().toLowerCase() : null;
                                  const resolvedTag = tagRecordLookup[lookupKey] || (lookupIdKey ? tagRecordLookup[lookupIdKey] : null) || tag;
                                  const cb = resolvedTag?.createdby;
                                  if (!cb) return "—";
                                  if (typeof cb === 'object') {
                                    const name = cb.name || cb.email || "";
                                    return name ? String(name).trim() : "—";
                                  }
                                  const str = String(cb || "").trim();
                                  return str && str !== "null" && str !== "undefined" ? str : "—";
                                })()}
                              </td>
                             <td className="px-5 py-3.5 text-right relative z-10">
                                <MoreMenu actions={[
                                 { label: "Edit", icon: <Edit3 className="w-3.5 h-3.5" />, onClick: () => startEditGlobalTag(tag) },
                                 { label: "Delete", icon: <Trash2 className="w-3.5 h-3.5" />, destructive: true, onClick: () => setDeleteTagTarget(tag), disabled: deleteTagMutation.isPending },
                              ]} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* CATEGORY TAB */}
            {activeTab === "category" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {product.category_id ? (
                  <>
                    <InfoCard icon={FolderOpen} title="Category Details">
                      <div className="space-y-1">
                        <DataRow icon={Hash} label="Name" value={product.category_id.name} />
                        <DataRow icon={Hash} label="Code" value={product.category_id.category_code || "—"} mono />
                        <DataRow icon={Activity} label="Status" value="Active" highlight />
                        <DataRow icon={Package} label="Assigned Product" value={product.name} />
                      </div>
                    </InfoCard>
                    <InfoCard icon={FileText} title="Description">
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                        {product.category_id.description || "No description available for this category."}
                      </p>
                    </InfoCard>
                  </>
                ) : (
                  <div className="lg:col-span-2 rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <EmptyState icon={FolderOpen} title="No Category Assigned" description="This product is not assigned to any category yet." />
                  </div>
                )}
              </div>
            )}

            {/* BRAND TAB */}
            {activeTab === "brand" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {product.brand_id ? (
                  <>
                    <InfoCard icon={Store} title="Brand Details">
                      <div className="space-y-1">
                        <DataRow icon={Hash} label="Name" value={product.brand_id.name} />
                        <DataRow icon={Hash} label="Code" value={product.brand_id.brand_code || "—"} mono />
                        <DataRow icon={FolderOpen} label="Country" value={product.brand_id.country || "—"} />
                        <DataRow icon={Activity} label="Status" value={product.brand_id.is_active ? "Active" : "Inactive"} highlight={product.brand_id.is_active} />
                      </div>
                    </InfoCard>
                    <InfoCard icon={FileText} title="Description">
                      <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
                        {product.brand_id.description || "No description available for this brand."}
                      </p>
                    </InfoCard>
                  </>
                ) : (
                  <div className="lg:col-span-2 rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                    <EmptyState icon={Store} title="No Brand Assigned" description="This product is not assigned to any brand yet." />
                  </div>
                )}
              </div>
            )}

            {/* ACTIVITY TAB */}
            {activeTab === "activity" && (
              <InfoCard icon={Activity} title="Activity Timeline" action={
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: "var(--accent-soft)", color: "var(--accent)" }}>
                    {activityTimeline.length} {activityTimeline.length === 1 ? "Event" : "Events"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: isConnected ? "var(--success-soft)" : "var(--bg-tertiary)", color: isConnected ? "var(--success)" : "var(--text-muted)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isConnected ? "var(--success)" : "var(--text-muted)" }} />
                    {isConnected ? "Live" : "Offline"}
                  </span>
                </div>
              }>
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {activitySummary.map((stat) => {
                      const StatIcon = stat.icon;
                      return (
                        <div key={stat.id} className="rounded-lg p-3.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: stat.soft, color: stat.color }}>
                              <StatIcon className="w-3.5 h-3.5" />
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wide truncate" style={{ color: "var(--text-muted)" }}>{stat.label}</span>
                          </div>
                          <p className="text-[17px] font-bold leading-none mt-2.5" style={{ color: "var(--text-primary)" }}>{stat.value}</p>
                          <p className="text-[10px] mt-1 truncate" style={{ color: "var(--text-muted)" }}>{stat.hint}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Type filters */}
                  <div className="flex flex-wrap items-center gap-2">
                    {activityFilters.map((f) => {
                      const active = activityFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setActivityFilter(f.id)}
                          className="h-8 px-3.5 rounded-full text-[11px] font-semibold transition-colors"
                          style={{
                            backgroundColor: active ? "var(--accent)" : "var(--bg-tertiary)",
                            color: active ? "var(--accent-text)" : "var(--text-secondary)",
                            border: `1px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
                          }}
                        >
                          {f.label} ({f.count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Explains blank actor rows honestly instead of leaving them
                      looking like a rendering fault. Shown only when relevant. */}
                  {unattributedCount > 0 && (
                    <div className="flex items-start gap-2 rounded-lg px-3 py-2.5"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                      <p className="text-[10px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        {unattributedCount} of {activityTimeline.length} {unattributedCount === 1 ? "entry has" : "entries have"} no user on record
                        — the database stored no audit user for {unattributedCount === 1 ? "it" : "them"}. Every edit saved from now on
                        shows who made it.
                      </p>
                    </div>
                  )}

                  {/* Timeline — grouped by day, newest first. Only real audit events. */}
                  {filteredActivity.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center rounded-xl"
                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                        <Clock className="w-5 h-5" style={{ color: "var(--text-muted)" }} />
                      </div>
                      <h4 className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                        {activityTimeline.length === 0 ? "No changes recorded yet" : "Nothing in this filter"}
                      </h4>
                      <p className="text-[11px] mt-1 max-w-sm" style={{ color: "var(--text-muted)" }}>
                        {activityTimeline.length === 0
                          ? "This product has only its original creation entry. Every edit you save from now on is listed here."
                          : "No recorded changes match the selected filter. Try “All Activity” to see everything."}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {activityGroups.map((group) => (
                        <div key={group.bucket}>
                          {/* Day header */}
                          <div className="flex items-center gap-3 mb-3">
                            <Calendar className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>
                              {group.label}
                            </span>
                            <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                              {group.items.length} {group.items.length === 1 ? "change" : "changes"}
                            </span>
                            <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-color)" }} />
                          </div>

                          {/* Events for this day */}
                          <div>
                            {group.items.map((ev, i) => {
                              const meta = activityMetaOf(ev.type);
                              const EventIcon = meta.icon;
                              const who = actorInfo(ev.actor);
                              const isLast = i === group.items.length - 1;
                              return (
                                <div key={ev.key} className="flex gap-3.5">
                                  {/* Rail */}
                                  <div className="flex flex-col items-center shrink-0">
                                    <div className="w-9 h-9 rounded-full flex items-center justify-center"
                                      style={{ backgroundColor: meta.bg, color: meta.fg, border: `1px solid ${meta.fg}33` }}>
                                      <EventIcon className="w-4 h-4" />
                                    </div>
                                    {!isLast && <div className="w-px flex-1 my-1.5" style={{ backgroundColor: "var(--border-color)" }} />}
                                  </div>

                                  {/* Card */}
                                  <div className={`flex-1 min-w-0 ${isLast ? "" : "pb-4"}`}>
                                    <div className="rounded-lg overflow-hidden flex" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                                      {/* Colour rail — lets the eye tell product rows from variant rows instantly */}
                                      <span className="w-[3px] shrink-0" style={{ backgroundColor: meta.fg, opacity: 0.7 }} />

                                      <div className="flex-1 min-w-0 p-3">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <h4 className="text-[12px] font-bold" style={{ color: "var(--text-primary)" }}>{meta.label}</h4>
                                            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                              style={{ backgroundColor: meta.bg, color: meta.fg }}>
                                              {meta.group}
                                            </span>
                                            {ev.live && (
                                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                                style={{ backgroundColor: "var(--success-soft)", color: "var(--success)" }}>LIVE</span>
                                            )}
                                          </div>
                                          <p className="text-[11px] mt-1" style={{ color: "var(--text-secondary)" }}>{ev.description}</p>
                                        </div>
                                        {/* Day is in the group header, so only the time here */}
                                        <div className="text-right shrink-0" title={fullStampOf(ev.date)}>
                                          <p className="text-[11px] font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>{clockOf(ev.date)}</p>
                                          <p className="text-[9px]" style={{ color: "var(--text-muted)" }}>{tago(ev.date)}</p>
                                        </div>
                                      </div>

                                      {/* Subject — identifies which variant this event belongs to */}
                                      {ev.subject && ev.subject.length > 0 && (
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                          {ev.subject.map((m, mi) => (
                                            <span key={`${ev.key}-subject-${mi}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
                                              style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                                              <span style={{ color: "var(--text-muted)" }}>{m.label}</span>
                                              <span className={m.mono ? "font-mono font-semibold" : "font-semibold"} style={{ color: "var(--text-primary)" }}>{m.value}</span>
                                            </span>
                                          ))}
                                        </div>
                                      )}

                                      {/* Actor — names a user only when the backend
                                          actually stored one; otherwise it says so
                                          plainly instead of a broken placeholder. */}
                                      <div className="mt-2.5 flex items-center gap-2 pt-2.5" style={{ borderTop: "1px solid var(--border-color)" }}>
                                        {who.known ? (
                                          <>
                                            <Avatar name={who.name} size="sm" color={meta.avatar} />
                                            <div className="min-w-0">
                                              <p className="text-[11px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{who.name}</p>
                                              {who.email && (
                                                <p className="text-[9px] truncate" style={{ color: "var(--text-muted)" }}>{who.email}</p>
                                              )}
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                                              style={{ backgroundColor: "var(--bg-card)", color: "var(--text-muted)", border: "1px solid var(--border-color)" }}>
                                              <User className="w-3.5 h-3.5" />
                                            </div>
                                            <p className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>No user recorded for this change</p>
                                          </>
                                        )}
                                      </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </InfoCard>
            )}
            
            {/* ATTRIBUTES TAB COMPLETELY REMOVED */}
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-3xl rounded-2xl overflow-hidden max-h-[92vh] flex flex-col" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Edit Product</h3>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>Update product and variant information</p>
              </div>
              <button onClick={closeProductModal} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-4 px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ backgroundColor: currentStep > 1 ? "var(--success)" : "var(--bg-card)", color: currentStep > 1 ? "#fff" : "var(--text-muted)" }}>
                  {currentStep > 1 ? <Check className="w-3.5 h-3.5" /> : "1"}
                </div>
                <span className="text-[12px] font-semibold" style={{ color: currentStep === 1 ? "var(--text-primary)" : "var(--text-muted)" }}>Product Info</span>
              </div>
              <div className="h-px w-8" style={{ backgroundColor: "var(--border-color)" }} />
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                  style={{ backgroundColor: currentStep === 2 ? "var(--success)" : "var(--bg-card)", color: currentStep === 2 ? "#fff" : "var(--text-muted)" }}>2</div>
                <span className="text-[12px] font-semibold" style={{ color: currentStep === 2 ? "var(--text-primary)" : "var(--text-muted)" }}>Variants</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              <form id="product-edit-form" onSubmit={handleSubmit} className="p-4">
                {currentStep === 1 && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Category *</label>
                        <SearchableSelectField
                          value={formData.category_id}
                          onChange={(value) => setFormData({ ...formData, category_id: value })}
                          options={categories.map(c => ({ value: String(c._id), label: c.name }))}
                          placeholder="Select category"
                          searchPlaceholder="Search category..."
                          emptyLabel="No category found"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Brand *</label>
                        <SearchableSelectField
                          value={formData.brand_id}
                          onChange={(value) => setFormData({ ...formData, brand_id: value })}
                          options={brands.map(b => ({ value: String(b._id), label: b.name }))}
                          placeholder="Select brand"
                          searchPlaceholder="Search brand..."
                          emptyLabel="No brand found"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Product Name *</label>
                      <input required type="text" placeholder="e.g. Cotton T-Shirt" value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Tags</label>
                      <div className="flex gap-2">
                        <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()}
                          placeholder="Type tag name & press Enter" className="h-9 px-3 rounded-lg text-[12px] flex-1 outline-none"
                          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                        <button type="button" onClick={addTag} className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1"
                          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      {formData.tag_names.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {formData.tag_names.map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                              {tag}
                              <button type="button" onClick={() => removeTag(tag)} className="ml-1 rounded-full p-0.5 hover:bg-black/10">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Description</label>
                      <textarea rows={3} placeholder="Enter product description..." value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="px-3 py-2.5 rounded-lg text-[12px] w-full outline-none resize-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Tax (%)</label>
                        <input type="number" min="0" placeholder="e.g. 18" value={formData.tax}
                          onChange={(e) => setFormData({ ...formData, tax: e.target.value })}
                          className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Status</label>
                        <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                          <option value="active">Active</option><option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button type="button" onClick={handleNextStep} className="h-9 px-6 rounded-lg text-[12px] font-semibold flex items-center gap-2"
                        style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                        Next: Variants <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {currentStep === 2 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="flex items-center gap-2 text-base font-bold">
                          <Sparkles className="w-5 h-5" style={{ color: "var(--accent)" }} />
                          Variants ({formData.variants.length})
                        </h4>
                        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>SKU, pricing, stock, attributes and images</p>
                      </div>
                      <button type="button" onClick={addVariant} className="h-9 px-4 rounded-lg text-[11px] font-semibold flex items-center gap-1.5"
                        style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                        <Plus className="w-3.5 h-3.5" /> Add Variant
                      </button>
                    </div>

                    <div className="space-y-3">
                      {formData.variants.map((variant, index) => (
                        <div key={variant._id || index} className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border-color)" }}>
                          <div className="flex cursor-pointer items-center justify-between px-4 py-3"
                            style={{ backgroundColor: "var(--bg-tertiary)" }}
                            onClick={() => setExpandedVariant(expandedVariant === index ? -1 : index)}>
                            <div>
                              <p className="text-[13px] font-bold">{variant.sku || `Variant ${index + 1}`}</p>
                              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{variant.title || `Variant #${index + 1}`}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button type="button" title="Duplicate" onClick={(e) => { e.stopPropagation(); duplicateVariant(index); }}
                                className="p-2 rounded-lg hover:bg-white/10 transition" style={{ color: "var(--text-muted)" }}>
                                <Copy className="w-4 h-4" />
                              </button>
                              <button type="button" title="Delete" onClick={(e) => { e.stopPropagation(); removeVariant(index); }}
                                className="p-2 rounded-lg hover:bg-red-500/20 transition" style={{ color: "var(--danger)" }}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <ChevronDown className={`w-5 h-5 transition-transform ${expandedVariant === index ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
                            </div>
                          </div>

                          {expandedVariant === index && (
                            <div className="space-y-3 p-4">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Identification</p>
                                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                                  <div>
                                    <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>SKU *</label>
                                    <input required type="text" placeholder="e.g. sku_4" value={variant.sku}
                                      readOnly={!!editingProduct && !!variant._id}
                                      onChange={(e) => updateVariant(index, "sku", e.target.value)}
                                      className={`h-9 px-3 rounded-lg text-[12px] w-full outline-none ${editingProduct && variant._id ? "opacity-60 cursor-not-allowed" : ""}`}
                                      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Variant Title *</label>
                                    <input required type="text" placeholder="e.g. Black - Large" value={variant.title}
                                      onChange={(e) => updateVariant(index, "title", e.target.value)}
                                      className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                  </div>
                                </div>
                                <div className="mt-2">
                                  <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Variant Description</label>
                                  <textarea rows={2} placeholder="Enter variant description..." value={variant.description}
                                    onChange={(e) => updateVariant(index, "description", e.target.value)}
                                    className="px-3 py-2.5 rounded-lg text-[12px] w-full outline-none resize-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                </div>
                              </div>

                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Pricing & Stock</p>
                                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                                  {[{ l: "Cost Price *", f: "cost_price", p: "1000" }, { l: "Selling Price *", f: "selling_price", p: "1500" },
                                  { l: "Topup", f: "topup", p: "0" },
                                  { l: "Quantity (whole units)", f: "quantity", p: "50" }
                                  ].map(({ l, f, p }) => (
                                    <div key={f}>
                                      <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>{l}</label>
                                      {/* Stock quantity sirf poore units mein — decimal point allowed nahi */}
                                      <input type="number" min="0" step={f === "quantity" ? "1" : "0.01"} inputMode={f === "quantity" ? "numeric" : "decimal"} placeholder={p} value={variant[f]}
                                        onKeyDown={(e) => { if (f === "quantity" && [".", ",", "-", "+", "e", "E"].includes(e.key)) e.preventDefault(); }}
                                        onChange={(e) => updateVariant(index, f, f === "quantity" ? ((e.target.value.includes(".") ? e.target.value.slice(0, e.target.value.indexOf(".")) : e.target.value).replace(/[^0-9]/g, "")) : e.target.value)}
                                        className="h-9 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                    </div>
                                  ))}
                                </div>
                                {variant.cost_price !== "" && variant.selling_price !== "" && Number(variant.selling_price) <= Number(variant.cost_price) && (
                                  <div className="mt-3 flex items-center gap-2 rounded-lg border px-4 py-3" style={{ borderColor: "color-mix(in srgb, var(--danger) 28%, transparent)", backgroundColor: "var(--danger-soft)" }}>
                                    <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "var(--danger)" }} />
                                    <p className="text-[11px] font-semibold" style={{ color: "var(--danger)" }}>Selling Price must be greater than Cost Price</p>
                                  </div>
                                )}
                              </div>

                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Variant Tags</p>
                                <div className="flex gap-2 mb-3">
                                  <input type="text" value={variant.tagInput || ""} onChange={(e) => updateVariantTagInput(index, e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addVariantTag(index, e)} placeholder="Add specific tag for this variant..."
                                    className="h-9 px-3 rounded-lg text-[12px] flex-1 outline-none"
                                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                  <button type="button" onClick={(e) => addVariantTag(index, e)} className="h-9 px-4 rounded-lg text-[12px] font-semibold flex items-center justify-center gap-1"
                                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                                {variant.tags.length > 0 && (
                                  <div className="flex flex-wrap gap-2">
                                    {variant.tags.map(tag => (
                                      <span key={tag} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                                        style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                                        {tag}
                                        <button type="button" onClick={() => removeVariantTag(index, tag)} className="ml-1 rounded-full p-0.5 hover:bg-black/10">
                                          <X className="w-3 h-3" />
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Attributes</p>
                                <div className="space-y-2">
                                  {variant.attributes.map((attr, ai) => {
                                    const preset = ATTRIBUTE_PRESETS.find(p => p.name === attr.name);
                                    const isMulti = preset?.data_type === "multi_select";
                                    const isNumber = preset?.data_type === "number";
                                    const selectedSingle = typeof attr.value === "string" ? attr.value : "";
                                    const setSingleValue = (val) => {
                                      const v = [...formData.variants];
                                      const a = [...v[index].attributes];
                                      a[ai] = { ...a[ai], value: val, isCustom: false };
                                      v[index] = { ...v[index], attributes: a };
                                      setFormData({ ...formData, variants: v });
                                    };

                                    return (
                                      <div key={ai} className="flex flex-wrap items-center gap-2">
                                        <div className="h-9 px-3 rounded-lg text-[12px] min-w-[140px] flex-1 flex items-center gap-2 font-semibold truncate"
                                          style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                                          <span className="truncate">{attr.name || "—"}</span>
                                          {attr._creating && <span className="text-[10px] font-normal italic" style={{ color: "var(--text-muted)" }}>creating…</span>}
                                          {attr._createError && <span className="text-[10px] font-normal italic" style={{ color: "var(--danger)" }}>failed</span>}
                                        </div>
                                        {preset ? (
                                          isMulti ? (
                                            <div className="flex-1 min-w-[180px] flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg min-h-[42px]"
                                              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                                              {!selectedSingle && <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Select an option...</span>}
                                              {selectedSingle && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                                                  style={{ backgroundColor: "var(--success-soft)", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }}>
                                                  {selectedSingle}
                                                  <button type="button" onClick={() => setSingleValue("")} className="ml-0.5 rounded-full p-0.5 hover:bg-black/10">
                                                    <X className="w-3 h-3" />
                                                  </button>
                                                </span>
                                              )}
                                              <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                                                {preset.values.filter((val) => val !== selectedSingle).map((val) => (
                                                  <button key={val} type="button" onClick={() => setSingleValue(val)}
                                                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                                                    style={{ backgroundColor: "var(--bg-card)", color: "var(--text-secondary)", border: "1px solid var(--border-color)" }}>
                                                    {val}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          ) : (
                                            <input type={isNumber ? "number" : "text"} value={attr.value || ""} onChange={(e) => setSingleValue(e.target.value)}
                                              placeholder={`Enter ${preset.name.toLowerCase()} value...`}
                                              className="h-9 px-3 rounded-lg text-[12px] min-w-[140px] flex-1 outline-none"
                                              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                          )
                                        ) : (
                                          <input type="text" placeholder="Value e.g. Black" value={attr.value || ""} onChange={(e) => setSingleValue(e.target.value)}
                                            className="h-9 px-3 rounded-lg text-[12px] flex-1 outline-none"
                                            style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                                        )}
                                        <button type="button" onClick={() => removeAttribute(index, ai)} className="p-2 rounded-lg hover:bg-red-500/20 transition" style={{ color: "var(--danger)" }}>
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                  <button type="button" onClick={() => addAttribute(index)} className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
                                    <Plus className="w-4 h-4" /> Add Attribute
                                  </button>
                                </div>
                              </div>

                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Product Images</p>
                                <label className="block cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition hover:border-[var(--accent)]" style={{ borderColor: "var(--border-color)" }}>
                                  <input hidden multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleImageUpload(index, e)} />
                                  <Upload className="mx-auto mb-2 w-6 h-6" style={{ color: "var(--text-muted)" }} />
                                  <p className="text-[12px] font-semibold">Click to select images</p>
                                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>JPG, PNG or WebP • Auto-optimized</p>
                                </label>
                                {variant.images.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {variant.images.map((img, ii) => (
                                      <div key={ii} className="relative group">
                                        <img src={img.preview} alt="" className="h-14 w-14 rounded-lg object-cover" style={{ border: "1px solid var(--border-color)" }} />
                                        <button type="button" onClick={() => removeImage(index, ii)}
                                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600">
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </form>
            </div>

            <div className="shrink-0 flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              {currentStep === 2 ? (
                <>
                  <button type="button" onClick={() => setCurrentStep(1)} className="h-9 px-5 rounded-lg text-[12px] font-semibold"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>← Back</button>
                  <button type="submit" form="product-edit-form" disabled={updateMutation.isPending}
                    className="h-9 px-6 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                    {updateMutation.isPending ? "Saving..." : "Update Product"} <Check className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <div />
                  <button type="submit" form="product-edit-form" disabled={updateMutation.isPending}
                    className="h-9 px-6 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                    style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                    {updateMutation.isPending ? "Saving..." : "Next →"} <Check className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Tag Modal */}
      {showCreateTagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Create New Tag</h3>
              <button onClick={() => { setShowCreateTagModal(false); setNewTagModalValue(""); }} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Tag Name</label>
                <input type="text" value={newTagModalValue} onChange={(e) => setNewTagModalValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateTagFromModal()} placeholder="Enter tag name..." autoFocus
                  className="h-10 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => { setShowCreateTagModal(false); setNewTagModalValue(""); }} className="h-10 px-5 rounded-lg text-[12px] font-semibold"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button onClick={handleCreateTagFromModal} disabled={updateProductTagsMutation.isPending || !newTagModalValue.trim()}
                  className="h-10 px-5 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  <Plus className="w-4 h-4" /> {updateProductTagsMutation.isPending ? "Adding..." : "Create Tag"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tag Modal */}
      {showEditTagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Edit Tag</h3>
              <button onClick={cancelEditTag} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Tag Name</label>
                <input type="text" value={editingTagName} onChange={(e) => setEditingTagName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveEditGlobalTag()} placeholder="Enter tag name..." autoFocus
                  className="h-10 px-3 rounded-lg text-[12px] w-full outline-none" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={cancelEditTag} className="h-10 px-5 rounded-lg text-[12px] font-semibold"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button onClick={saveEditGlobalTag} disabled={updateTagMutation.isPending || updateProductTagsMutation.isPending || !editingTagName.trim()}
                  className="h-10 px-5 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  <Save className="w-4 h-4" /> {(updateTagMutation.isPending || updateProductTagsMutation.isPending) ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variant Tags Modal */}
      {showVariantTagsModal && editingVariantForTags && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[85] p-4">
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Manage Variant Tags</h3>
                <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{editingVariantForTags.title || editingVariantForTags.sku}</p>
              </div>
              <button onClick={() => { setShowVariantTagsModal(false); setEditingVariantForTags(null); setVariantTagInput(""); }}
                className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input type="text" value={variantTagInput} onChange={(e) => setVariantTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddVariantTag(); } }}
                  placeholder="Type tag & press Enter..." autoFocus className="h-10 px-3 rounded-lg text-[12px] flex-1 outline-none"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                <button onClick={handleAddVariantTag} disabled={!variantTagInput.trim()}
                  className="h-10 px-4 rounded-lg text-[12px] font-semibold flex items-center gap-2 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              <div>
                <p className="text-[11px] font-semibold mb-3" style={{ color: "var(--text-muted)" }}>Current Tags:</p>
                <div className="flex flex-wrap gap-2">
                  {(editingVariantForTags.tags || []).length > 0 ? (
                    (editingVariantForTags.tags || []).map((tag, idx) => (
                      <span key={`${tag}-${idx}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium"
                        style={{ backgroundColor: "var(--success-soft)", color: "var(--success)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }}>
                        <TagIcon className="w-3 h-3" />
                        {tag}
                        <button onClick={() => handleRemoveVariantTag(tag)} className="ml-1 rounded-full p-0.5 hover:bg-black/20">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] italic" style={{ color: "var(--text-muted)" }}>No tags yet</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {showDeleteModal && product && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--danger-soft)" }}>
                <AlertTriangle className="w-6 h-6" style={{ color: "var(--danger)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Delete &quot;{product.name}&quot;?</h3>
                <p className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>This action cannot be undone. The product and all its variants will be permanently removed.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 h-10 rounded-lg text-[12px] font-semibold transition hover:opacity-80"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button disabled={deleteMutation.isPending} onClick={confirmDelete}
                className="flex-1 h-10 rounded-lg text-[12px] font-semibold text-white transition disabled:opacity-60 hover:opacity-90"
                style={{ backgroundColor: "var(--danger)" }}>{deleteMutation.isPending ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* VARIANT DELETE CONFIRMATION */}
      {deleteVariantTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--danger-soft)" }}>
                <AlertTriangle className="w-6 h-6" style={{ color: "var(--danger)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Delete Variant?</h3>
                <p className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>Are you sure you want to delete variant &quot;{deleteVariantTarget.sku}&quot;? This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteVariantTarget(null)} className="flex-1 h-10 rounded-lg text-[12px] font-semibold transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button onClick={() => {
                deleteVariantMutation.mutate(deleteVariantTarget._id);
                setDeleteVariantTarget(null);
              }} disabled={deleteVariantMutation.isPending} className="flex-1 h-10 rounded-lg text-[12px] font-semibold text-white transition disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: "var(--danger)" }}>{deleteVariantMutation.isPending ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* TAG DELETE CONFIRMATION */}
      {deleteTagTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--danger-soft)" }}>
                <AlertTriangle className="w-6 h-6" style={{ color: "var(--danger)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Delete Tag?</h3>
                <p className="text-[12px] mt-1.5" style={{ color: "var(--text-muted)" }}>Are you sure you want to delete tag &quot;{deleteTagTarget.name}&quot;? This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setDeleteTagTarget(null)} className="flex-1 h-10 rounded-lg text-[12px] font-semibold transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
              <button onClick={() => {
                const tagName = deleteTagTarget.name;
                // Remove the tag assignment from this product / variants
                // (other products' relationships remain unaffected)
                const data = new FormData();
                data.append("tag_names", JSON.stringify((displayTagNames || []).filter(n => n !== tagName)));
                if ((variants || []).some(v => (v.tags || []).map(tagNameOf).includes(tagName))) {
                  const updatedVariants = (variants || []).map(v => ({ ...v, tags: (v.tags || []).map(tagNameOf).filter(t => t !== tagName) }));
                  data.append("variants", JSON.stringify(updatedVariants));
                }
                updateProductTagsMutation.mutate({ id: product._id, data, successMsg: "Tag deleted successfully", errorMsg: "Failed to delete tag" });
                setDeleteTagTarget(null);
              }} disabled={updateProductTagsMutation.isPending} className="flex-1 h-10 rounded-lg text-[12px] font-semibold text-white transition disabled:opacity-60 hover:opacity-90" style={{ backgroundColor: "var(--danger)" }}>{updateProductTagsMutation.isPending ? "Deleting..." : "Delete"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD ATTRIBUTE MODAL */}
      {showAttributeModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-visible rounded-2xl shadow-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", maxHeight: "90vh" }}>
            <div className="flex items-center justify-between rounded-t-2xl px-6 py-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Create New Attribute</h3>
              <button type="button" onClick={() => { setShowAttributeModal(false); setAttributeTargetVariant(null); resetAttributeForm(); }} disabled={createAttributeMutation.isPending}
                className="rounded-lg p-2 transition hover:bg-[var(--bg-tertiary)] disabled:opacity-50" style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Attribute Name *</label>
                  <input type="text" value={newAttributeData.name} onChange={e => setNewAttributeData(p => ({ ...p, name: e.target.value }))} required disabled={createAttributeMutation.isPending}
                    className="h-10 w-full rounded-lg px-3 text-[12px] outline-none disabled:opacity-50"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="e.g. Color, RAM, Size" />
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Attribute Code</label>
                  <input type="text" value={newAttributeData.code} onChange={e => setNewAttributeData(p => ({ ...p, code: e.target.value.toLowerCase() }))} disabled={createAttributeMutation.isPending}
                    className="h-10 w-full rounded-lg px-3 text-[12px] outline-none disabled:opacity-50"
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="e.g. color, ram_size" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Data Type *</label>
                <select value={newAttributeData.data_type} onChange={e => setNewAttributeData(p => ({ ...p, data_type: e.target.value }))} disabled={createAttributeMutation.isPending}
                  className="h-10 w-full rounded-lg px-3 text-[12px] outline-none disabled:opacity-50"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="multi_select">Multi Select</option>
                  <option value="decimal">Decimal</option>
                </select>
              </div>
              {newAttributeData.data_type === "select" && (
                <div className="space-y-3 rounded-xl p-4" style={{ border: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold" style={{ color: "var(--text-muted)" }}>Allowed Values</label>
                    <button type="button" onClick={handleAddAttributeValue} className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: "var(--accent)" }}>
                      <Plus className="w-3.5 h-3.5" /> Add Value
                    </button>
                  </div>
                  <div className="space-y-2">
                    {newAttributeData.values.map((val, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input type="text" placeholder="Label (e.g. Red)" value={val.label} onChange={e => handleAttributeValueChange(idx, "label", e.target.value)}
                          className="h-9 flex-1 rounded-lg px-3 text-[12px] outline-none"
                          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                        <input type="text" placeholder="Value (e.g. #FF0000)" value={val.value} onChange={e => handleAttributeValueChange(idx, "value", e.target.value)}
                          className="h-9 flex-1 rounded-lg px-3 text-[12px] outline-none"
                          style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
                        <button type="button" onClick={() => handleRemoveAttributeValue(idx)} className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-5" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button type="button" onClick={() => { setShowAttributeModal(false); setAttributeTargetVariant(null); resetAttributeForm(); }} disabled={createAttributeMutation.isPending}
                  className="h-10 flex-1 rounded-lg text-[12px] font-semibold transition hover:opacity-80 disabled:opacity-50"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>Cancel</button>
                <button type="button" onClick={handleAttributeSubmit} disabled={createAttributeMutation.isPending}
                  className="h-10 flex-1 rounded-lg text-[12px] font-semibold transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  {createAttributeMutation.isPending ? "Creating..." : "Create Attribute"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
