"use client";

/* ==========================================================
   STORE EDITOR — schema-driven setting fields
   Backend config/themeSchema.js ke field types:
   text | textarea | richtext | image | color | select | range |
   checkbox | link | category | brand | product
   ========================================================== */

import dynamic from "next/dynamic";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { themeApi, pageApi, apiError } from "@/apis/admin/themeApi";
import { adminCategoryApi } from "@/apis/admin/categoryApi";
import { adminBrandApi } from "@/apis/admin/brandApi";
import { adminProductApi } from "@/apis/admin/productApi";

const RichTextEditor = dynamic(() => import("@/components/admin/RichTextEditor"), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-lg bg-subtle" />,
});

const API_ORIGIN = (process.env.NEXT_PUBLIC_SERVERURL || "").replace(/\/api\/?$/, "");
export const assetUrl = (url) => (!url ? "" : /^https?:/i.test(url) ? url : `${API_ORIGIN}${url}`);

const inputCls =
  "h-9 w-full rounded-lg border border-line bg-input px-3 text-sm text-fg outline-none transition placeholder:text-fg-muted focus:border-accent focus:ring-2 focus:ring-accent/20";

// onReset diya ho → label ke saath "reset to default" icon (sirf jab value default se alag ho)
function FieldShell({ label, hint, aside, onReset, children }) {
  return (
    <label className="group/field block space-y-1.5">
      <span className="flex min-h-5 items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-fg-secondary">{label}</span>
        {aside}
        {onReset ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onReset();
            }}
            title="Reset to default"
            aria-label={`Reset ${label} to default`}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-fg-muted opacity-70 transition hover:bg-subtle hover:text-fg hover:opacity-100"
          >
            <RotateCcw size={11} />
          </button>
        ) : null}
      </span>
      {children}
      {hint ? <span className="block text-[11px] text-fg-muted">{hint}</span> : null}
    </label>
  );
}

const cloneValue = (v) => (v === undefined ? null : v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v);
const isEmptyValue = (v) => v === undefined || v === null || v === "";
// Value default se alag? (link objects JSON compare; "" aur null barabar)
export function differsFromDefault(field, value) {
  if (value === undefined) return false; // kabhi set nahi hua = default
  const def = field.default === undefined ? null : field.default;
  if (isEmptyValue(value) && isEmptyValue(def)) return false;
  if ((value && typeof value === "object") || (def && typeof def === "object")) return JSON.stringify(value) !== JSON.stringify(def);
  return value !== def;
}

// Select options jinka humanize() acha nahi padhta
const OPTION_LABELS = { xlarge: "Extra large", uppercase: "UPPERCASE", start: "Start (left)", center: "Center", end: "End (right)" };
const optionLabel = (o) => (o === null ? "Default" : OPTION_LABELS[o] || humanize(o));

const humanize = (key) => String(key).replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

// ── Resource lists (cached, editor me baar baar use) ──
function useCategories() {
  return useQuery({ queryKey: ["storeEditor", "categories"], queryFn: adminCategoryApi.getAll, staleTime: 5 * 60 * 1000 });
}
function useBrands() {
  return useQuery({ queryKey: ["storeEditor", "brands"], queryFn: adminBrandApi.getAll, staleTime: 5 * 60 * 1000 });
}
function usePages() {
  return useQuery({ queryKey: ["storeEditor", "pages"], queryFn: pageApi.list, staleTime: 60 * 1000 });
}

const listOf = (v) => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : Array.isArray(v?.data) ? v.data : []);

function ResourceSelect({ kind, value, onChange }) {
  const categories = useCategories();
  const brands = useBrands();
  const pages = usePages();
  const [search, setSearch] = useState("");
  const products = useQuery({
    queryKey: ["storeEditor", "products", search],
    queryFn: () => adminProductApi.getPaginated({ page: 1, limit: 20, search }),
    enabled: kind === "product",
    staleTime: 60 * 1000,
  });

  const options = useMemo(() => {
    if (kind === "category") return listOf(categories.data).map((c) => ({ value: c._id, label: c.name }));
    if (kind === "brand") return listOf(brands.data).map((b) => ({ value: b._id, label: b.name }));
    if (kind === "page") return listOf(pages.data).map((p) => ({ value: p.slug, label: `${p.title}${p.status === "draft" ? " (draft)" : ""}` }));
    if (kind === "product") {
      const items = listOf(products.data?.products || products.data);
      return items.map((p) => ({ value: p._id, label: p.name }));
    }
    return [];
  }, [kind, categories.data, brands.data, pages.data, products.data]);

  return (
    <div className="space-y-1.5">
      {kind === "product" ? (
        <input className={inputCls} placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
      ) : null}
      <select className={inputCls} value={value || ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">— Select —</option>
        {value && !options.some((o) => o.value === value) ? <option value={value}>{value}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

const LINK_LABELS = {
  none: "No link",
  home: "Home page",
  url: "Web address",
  page: "Page",
  category: "Category",
  product: "Product",
  brand: "Brand",
  deal: "Deal (id)",
};

export function LinkInput({ value, onChange, linkTypes = Object.keys(LINK_LABELS) }) {
  const link = value && typeof value === "object" ? value : { type: "none" };
  const setType = (type) => onChange(type === "url" ? { type, url: "" } : type === "none" || type === "home" ? { type } : { type, ref: "" });
  return (
    <div className="space-y-1.5">
      <select className={inputCls} value={link.type} onChange={(e) => setType(e.target.value)}>
        {linkTypes.map((t) => (
          <option key={t} value={t}>
            {LINK_LABELS[t] || t}
          </option>
        ))}
      </select>
      {link.type === "url" ? (
        <input className={inputCls} placeholder="https://… or /path" value={link.url || ""} onChange={(e) => onChange({ ...link, url: e.target.value })} />
      ) : null}
      {["page", "category", "product", "brand"].includes(link.type) ? (
        <ResourceSelect kind={link.type} value={link.ref} onChange={(ref) => onChange({ ...link, ref })} />
      ) : null}
      {link.type === "deal" ? (
        <input className={inputCls} placeholder="Deal id" value={link.ref || ""} onChange={(e) => onChange({ ...link, ref: e.target.value.trim() })} />
      ) : null}
    </div>
  );
}

function ImageInput({ value, onChange }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await themeApi.uploadImage(file);
      onChange(uploaded.url);
    } catch (error) {
      toast.error(apiError(error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  return (
    <div className="space-y-2">
      {value ? (
        <div className="group relative overflow-hidden rounded-lg border border-line bg-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetUrl(value)} alt="" className="h-32 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute end-2 top-2 rounded-md bg-card/90 p-1.5 text-danger shadow-sm"
            aria-label="Remove image"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-line text-xs font-semibold text-fg-secondary transition hover:border-accent hover:text-accent disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
        {value ? "Replace image" : "Upload image"}
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

function ColorInput({ value, onChange }) {
  const [text, setText] = useState(value || "");
  const valid = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={valid.test(value || "") && value.length === 7 ? value : "#000000"}
        onChange={(e) => {
          setText(e.target.value);
          onChange(e.target.value);
        }}
        className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-line bg-input p-1"
      />
      <input
        className={inputCls}
        placeholder="Default"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (valid.test(e.target.value)) onChange(e.target.value);
          if (!e.target.value) onChange(null);
        }}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setText("");
            onChange(null);
          }}
          title="Reset to default"
          className="rounded-lg p-2 text-fg-muted hover:bg-subtle hover:text-fg"
        >
          <RotateCcw size={14} />
        </button>
      ) : null}
    </div>
  );
}

/** Ek schema field render karo */
export function SettingField({ field, value, onChange, linkTypes }) {
  const label = field.label || humanize(field.key);
  // Reset icon: value badli ho to default par wapas (color ka apna reset hai)
  const onReset = differsFromDefault(field, value) ? () => onChange(cloneValue(field.default)) : null;
  switch (field.type) {
    case "text":
      return (
        <FieldShell label={label} onReset={onReset} hint={field.hint || (field.translatable ? "Leave empty to use the default text" : null)}>
          <input className={inputCls} maxLength={200} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        </FieldShell>
      );
    case "textarea":
      return (
        <FieldShell label={label} onReset={onReset} hint={field.hint}>
          <textarea className={`${inputCls} h-24 py-2`} maxLength={1000} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        </FieldShell>
      );
    case "richtext":
      return (
        <FieldShell label={label} onReset={onReset} hint={field.hint}>
          <RichTextEditor value={value || ""} onChange={onChange} minHeight={140} />
        </FieldShell>
      );
    case "image":
      return (
        <FieldShell label={label} hint={field.hint}>
          <ImageInput value={value} onChange={onChange} />
        </FieldShell>
      );
    case "color":
      return (
        <FieldShell label={label} hint={field.hint}>
          <ColorInput key={value || "empty"} value={value} onChange={onChange} />
        </FieldShell>
      );
    case "select":
      return (
        <FieldShell label={label} onReset={onReset} hint={field.hint}>
          <select className={inputCls} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}>
            {field.options.map((o) => (
              <option key={String(o)} value={o ?? ""}>
                {optionLabel(o)}
              </option>
            ))}
          </select>
        </FieldShell>
      );
    case "range":
      return (
        <FieldShell
          label={label}
          onReset={onReset}
          hint={field.hint}
          aside={<span className="rounded-md bg-subtle px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-fg">{value ?? field.default}</span>}
        >
          <input
            type="range"
            min={field.min}
            max={field.max}
            step={field.step || 1}
            value={value ?? field.default}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </FieldShell>
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-accent" />
          {label}
        </label>
      );
    case "link":
      return (
        <FieldShell label={label} onReset={onReset} hint={field.hint}>
          <LinkInput value={value} onChange={onChange} linkTypes={linkTypes} />
        </FieldShell>
      );
    case "url":
      return (
        <FieldShell label={label}>
          <input className={inputCls} type="url" placeholder="https://…" maxLength={500} value={value ?? ""} onChange={(e) => onChange(e.target.value.trim())} />
        </FieldShell>
      );
    case "phone":
      return (
        <FieldShell label={label}>
          <input
            className={inputCls}
            inputMode="numeric"
            placeholder="923001234567"
            maxLength={20}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          />
        </FieldShell>
      );
    case "datetime": {
      // Stored ISO (UTC) ↔ <input type="datetime-local"> (local time)
      const toLocal = (iso) => {
        if (!iso) return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "";
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      return (
        <FieldShell label={label}>
          <input
            className={inputCls}
            type="datetime-local"
            value={toLocal(value)}
            onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : "")}
          />
        </FieldShell>
      );
    }
    case "category":
    case "brand":
    case "product":
      return (
        <FieldShell label={label}>
          <ResourceSelect kind={field.type} value={value} onChange={onChange} />
        </FieldShell>
      );
    default:
      return null;
  }
}

export { inputCls, humanize };
