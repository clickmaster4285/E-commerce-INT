"use client";

/* ==========================================================
   STORE EDITOR — schema-driven setting fields
   Backend config/themeSchema.js ke field types:
   text | textarea | richtext | image | color | select | range |
   checkbox | link | category | brand | product | url | datetime | phone | geo
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
import { dealApi } from "@/apis/admin/dealApi";
import { Combobox } from "@/components/ui/combobox";
import { linkIssue } from "../draftIssues";

const RichTextEditor = dynamic(() => import("@/components/admin/RichTextEditor"), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-lg bg-subtle" />,
});

// Leaflet window chahiye → sirf client par
// Custom picker (drag + eyedropper + swatches); native <input type=color> drag par band ho jata tha
import ColorPicker from "./ColorPicker";

const GeoPicker = dynamic(() => import("./GeoPicker"), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-lg bg-subtle" />,
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
  return useQuery({ queryKey: ["storeEditor", "brands"], queryFn: () => adminBrandApi.getOptions(), staleTime: 5 * 60 * 1000 });
}
function usePages() {
  return useQuery({ queryKey: ["storeEditor", "pages"], queryFn: pageApi.list, staleTime: 60 * 1000 });
}

const listOf = (v) => (Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : Array.isArray(v?.data) ? v.data : []);

// Products / deals bahut ho sakte hain → server-side search (20 per request)
const REMOTE_LIMIT = 20;
const REMOTE = {
  product: {
    list: (search) => adminProductApi.getPaginated({ page: 1, limit: REMOTE_LIMIT, search }),
    items: (data) => listOf(data?.products || data),
    total: (data) => data?.pagination?.total ?? data?.total ?? null,
    one: (id) => adminProductApi.getById(id),
  },
  deal: {
    list: (search) => dealApi.getPaginated({ page: 1, limit: REMOTE_LIMIT, ...(search ? { search } : {}) }),
    items: (data) => listOf(data?.deals),
    total: (data) => data?.pagination?.total ?? null,
    one: (id) => dealApi.getById(id),
  },
};

const RESOURCE_TEXT = {
  category: { placeholder: "Choose a category", search: "Search categories…", empty: "No categories yet" },
  brand: { placeholder: "Choose a brand", search: "Search brands…", empty: "No brands yet" },
  page: { placeholder: "Choose a page", search: "Search pages…", empty: "No pages yet. Create one in Pages." },
  product: { placeholder: "Choose a product", search: "Search products…", empty: "No products found" },
  deal: { placeholder: "Choose a deal", search: "Search deals…", empty: "No deals found" },
};

function dealHint(d) {
  const end = d?.endDate || d?.endsAt || d?.end_date;
  if (d?.isActive === false || d?.status === "inactive") return "Inactive";
  if (end && Date.parse(end) < Date.now()) return "Ended";
  return end ? `Ends ${new Date(end).toLocaleDateString()}` : undefined;
}

function RemoteResourceSelect({ kind, value, onChange }) {
  const cfg = REMOTE[kind];
  const text = RESOURCE_TEXT[kind];
  const [search, setSearch] = useState("");
  const list = useQuery({
    queryKey: ["storeEditor", kind, "list", search],
    queryFn: () => cfg.list(search),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
  const items = cfg.items(list.data);
  const total = cfg.total(list.data);
  const options = items.map((it) => ({ value: it._id, label: it.name || it.title || it._id, hint: kind === "deal" ? dealHint(it) : undefined }));
  const found = !value || options.some((o) => o.value === value);
  // Selected item pehle 20 me na ho (reload ke baad) → uska naam alag se
  const selectedQuery = useQuery({
    queryKey: ["storeEditor", kind, "one", value],
    queryFn: () => cfg.one(value),
    enabled: Boolean(value) && !found,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  const selectedLabel = selectedQuery.data?.name || selectedQuery.data?.title || (selectedQuery.isError ? "Item not found" : selectedQuery.isLoading ? "Loading…" : value);
  // 10+ items ho (ya search chal rahi ho) tab hi search box
  const searchable = Boolean(search) || (total ?? items.length) > 10;
  const footer = total && total > items.length && !search ? `Showing ${items.length} of ${total}. Type to search.` : null;

  return (
    <Combobox
      options={options}
      value={value || ""}
      onChange={onChange}
      placeholder={text.placeholder}
      searchPlaceholder={text.search}
      emptyText={search ? `No ${kind}s match “${search}”` : text.empty}
      searchable={searchable}
      onSearchChange={setSearch}
      loading={list.isFetching}
      selectedLabel={selectedLabel}
      footer={footer}
      invalid={!value}
    />
  );
}

function ResourceSelect({ kind, value, onChange }) {
  if (REMOTE[kind]) return <RemoteResourceSelect kind={kind} value={value} onChange={onChange} />;
  return <LocalResourceSelect kind={kind} value={value} onChange={onChange} />;
}

function LocalResourceSelect({ kind, value, onChange }) {
  const categories = useCategories();
  const brands = useBrands();
  const pages = usePages();
  const text = RESOURCE_TEXT[kind] || {};
  const source = kind === "category" ? categories : kind === "brand" ? brands : pages;

  const options = useMemo(() => {
    if (kind === "category") return listOf(categories.data).map((c) => ({ value: c._id, label: c.name }));
    if (kind === "brand") return listOf(brands.data).map((b) => ({ value: b._id, label: b.name }));
    if (kind === "page") return listOf(pages.data).map((p) => ({ value: p.slug, label: p.title, hint: p.status === "draft" ? "Draft, not visible yet" : `/pages/${p.slug}` }));
    return [];
  }, [kind, categories.data, brands.data, pages.data]);

  return (
    <Combobox
      options={options}
      value={value || ""}
      onChange={onChange}
      placeholder={text.placeholder}
      searchPlaceholder={text.search}
      emptyText={source.isLoading ? "Loading…" : text.empty}
      loading={source.isLoading}
      selectedLabel={value}
      invalid={!value}
    />
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
  deal: "Deal",
};

export const linkTypeLabel = (type) => LINK_LABELS[type] || type;

export function LinkInput({ value, onChange, linkTypes = Object.keys(LINK_LABELS) }) {
  const link = value && typeof value === "object" ? value : { type: "none" };
  const setType = (type) => onChange(type === "url" ? { type, url: "" } : type === "none" || type === "home" ? { type } : { type, ref: "" });
  // Adhoora link (product select nahi, address khali) → yahin batao; save tab tak ruka
  const issue = linkIssue(link);
  return (
    <div className="space-y-1.5">
      <Combobox
        aria-label="Link type"
        options={linkTypes.map((t) => ({ value: t, label: LINK_LABELS[t] || t }))}
        value={link.type}
        onChange={(t) => t !== link.type && setType(t)}
      />
      {link.type === "url" ? (
        <input className={inputCls} placeholder="https://… or /path" value={link.url || ""} onChange={(e) => onChange({ ...link, url: e.target.value })} />
      ) : null}
      {["page", "category", "product", "brand", "deal"].includes(link.type) ? (
        <ResourceSelect key={link.type} kind={link.type} value={link.ref} onChange={(ref) => onChange({ ...link, ref })} />
      ) : null}
      {issue ? <p className="text-[11px] font-medium text-warning">{issue}</p> : null}
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
      // <label> nahi (FieldShell) — label click swatch button ko trigger kar deta
      return (
        <div className="space-y-1.5">
          <span className="flex min-h-5 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-fg-secondary">{label}</span>
          </span>
          <ColorPicker value={value} onChange={onChange} inputCls={inputCls} label={label} />
          {field.hint ? <span className="block text-[11px] text-fg-muted">{field.hint}</span> : null}
        </div>
      );
    case "select":
      return (
        <FieldShell label={label} onReset={onReset} hint={field.hint}>
          <Combobox
            aria-label={label}
            options={field.options.map((o) => ({ value: o, label: optionLabel(o) }))}
            value={value ?? field.default ?? null}
            onChange={onChange}
          />
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
    case "geo":
      // <label> nahi (FieldShell) — map ke andar clicks/buttons label ko forward ho jate
      return (
        <div className="space-y-1.5">
          <span className="flex min-h-5 items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-fg-secondary">{label}</span>
          </span>
          <GeoPicker value={value} onChange={onChange} withZoom={Boolean(field.withZoom)} />
          {field.hint ? <span className="block text-[11px] text-fg-muted">{field.hint}</span> : null}
        </div>
      );
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
