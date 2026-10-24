"use client";

/* ==========================================================
   FEATURED PRODUCTS — Admin
   Sirf wahi products jo admin ne "featured" mark kiye hain.
   - Layout: Products page bilkul same pattern
     (header → stat cards → toolbar → list table / grid → pagination)
   - Data: existing paginated products API (?featured=true) — koi naya API nahi
   - Unmark: existing PATCH /products/:id/toggle-featured
   ========================================================== */

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star,
  StarOff,
  Search,
  Eye,
  Package,
  List,
  Grid3x3,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { productApi } from "@/apis/admin/productApi";
import { useProductSocketSync } from "../../../hooks/admin/useProductSocketSync";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";
import { usePageTranslations } from "@/hooks/admin/usePageTranslations";

const PER_PAGE = 20;
const MODAL_PER_PAGE = 8;

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") ;
const getImageUrl = (path) => {
  if (!path) return "";
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
};

const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

const localeTag = (locale) =>
  locale === "ur" ? "ur-PK" : locale === "en" ? "en-US" : locale;
const fmt = (n, locale = "en") => new Intl.NumberFormat(localeTag(locale)).format(Number(n || 0));
const fmtCurrency = (n, locale = "en") => new Intl.NumberFormat(localeTag(locale), { style: "currency", currency: "PKR" }).format(Number(n || 0));

/* Same page-number logic jo Products page par hai */
function buildPageList(currentPage, totalPages) {
  const total = Math.max(1, Number(totalPages) || 1);
  const current = Math.min(Math.max(1, Number(currentPage) || 1), total);
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("…");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) pages.push("…");
  pages.push(total);
  return pages;
}

/* Same status pill jo Products page par hai */
function StatusBadge({ status }) {
  const { t } = useTranslation();
  const isActive = status === "active";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{
        backgroundColor: isActive ? "var(--success-soft)" : "var(--danger-soft)",
        color: isActive ? "var(--success-text)" : "var(--danger-text)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isActive ? "var(--success)" : "var(--danger)" }} />
      {isActive ? t("admin.featuredProducts.page.active") : t("admin.featuredProducts.page.inactive")}
    </span>
  );
}

/* ==========================================================
   TABLE SKELETON — same row pattern as Products page
   ========================================================== */
function TableSkeleton({ rows = PER_PAGE }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={`featured-skeleton-${i}`} style={{ borderBottom: "1px solid var(--border-color)" }}>
          <td className="px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded" style={{ backgroundColor: "var(--bg-tertiary)" }} />
              <div className="h-3 w-32 animate-pulse rounded" style={{ backgroundColor: "var(--bg-tertiary)" }} />
            </div>
          </td>
          {[0, 1, 2, 3].map((c) => (
            <td key={c} className="px-4 py-2.5">
              <div className="h-3 w-20 animate-pulse rounded" style={{ backgroundColor: "var(--bg-tertiary)" }} />
            </td>
          ))}
          <td className="px-4 py-2.5">
            <div className="h-5 w-14 animate-pulse rounded-full" style={{ backgroundColor: "var(--bg-tertiary)" }} />
          </td>
          <td className="px-4 py-2.5 text-end">
            <div className="ms-auto h-6 w-6 animate-pulse rounded" style={{ backgroundColor: "var(--bg-tertiary)" }} />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

/* ==========================================================
   GRID SKELETON
   ========================================================== */
function GridSkeleton({ cards = 8 }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={`featured-grid-skeleton-${i}`} className="rounded-lg p-4" style={cardStyle}>
          <div className="flex items-start justify-between">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-full" style={{ backgroundColor: "var(--bg-tertiary)" }} />
            <div className="h-5 w-16 animate-pulse rounded-full" style={{ backgroundColor: "var(--bg-tertiary)" }} />
          </div>
          <div className="mt-3 h-3 w-3/4 animate-pulse rounded" style={{ backgroundColor: "var(--bg-tertiary)" }} />
          <div className="mt-2 h-2.5 w-1/2 animate-pulse rounded" style={{ backgroundColor: "var(--bg-tertiary)" }} />
        </div>
      ))}
    </div>
  );
}


/* ==========================================================
   FEATURED ROW — list view table row (same cells as Products page)
   ========================================================== */
function FeaturedRow({ product, isRemoving, onOpen, onRemove }) {
  const { t, locale } = useTranslation();
  const { nameOf, productNameOf } = useLocalized();
  const variant = product?.variants?.[0];
  const img = variant?.images?.[0]?.img_url;
  const price = Number(variant?.selling_price) || Number(product?.price) || 0;
  const listPrice = Number(variant?.price) || 0;
  const productName = productNameOf(product);

  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer transition"
      style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={getImageUrl(img)} alt={productName} className="h-8 w-8 shrink-0 rounded object-cover" />
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded"
              style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}
            >
              <Package className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{productName}</p>
            <p className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{variant?.sku || "—"}</p>
          </div>
          <span
            className="ms-1 inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5"
            style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            title={t("admin.featuredProducts.ui.featuredLabel")}
            aria-label={t("admin.featuredProducts.ui.featuredAria")}
          >
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          </span>
        </div>
      </td>
      <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>{nameOf(product?.category_id) || "—"}</td>
      <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>{nameOf(product?.brand_id) || "—"}</td>
      <td className="px-4 py-2.5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold tabular-nums">{fmtCurrency(price, locale)}</span>
          {listPrice > price && (
            <span className="text-[11px] line-through tabular-nums" style={{ color: "var(--text-muted)" }}>
              {fmtCurrency(listPrice, locale)}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 font-medium tabular-nums">{fmt(variant?.quantity, locale)}</td>
      <td className="px-4 py-2.5"><StatusBadge status={product.status} /></td>
      <td className="px-4 py-2.5 text-end" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onOpen}
            title={t("admin.featuredProducts.page.viewProduct")}
            aria-label={t("admin.featuredProducts.ui.viewProductAria", { name: productName })}
            className="flex h-7 w-7 items-center justify-center rounded-md transition hover:opacity-80"
            style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={isRemoving}
            onClick={onRemove}
            title={t("admin.featuredProducts.page.removeFromFeatured")}
            aria-label={t("admin.featuredProducts.ui.removeAria", { name: productName })}
            className="flex h-7 w-7 items-center justify-center rounded-md transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          >
            <StarOff className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

/* ==========================================================
   FEATURED GRID CARD — same card layout as Products grid view
   ========================================================== */
function FeaturedGridCard({ product, isRemoving, onOpen, onRemove }) {
  const { t, locale } = useTranslation();
  const { nameOf, productNameOf } = useLocalized();
  const variant = product?.variants?.[0];
  const img = variant?.images?.[0]?.img_url;
  const price = Number(variant?.selling_price) || Number(product?.price) || 0;
  const productName = productNameOf(product);

  return (
    <div
      onClick={onOpen}
      className="flex cursor-pointer flex-col gap-3 rounded-lg p-4 transition hover:-translate-y-0.5"
      style={cardStyle}
    >
      <div className="flex items-start justify-between">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={getImageUrl(img)} alt={productName} className="h-10 w-10 shrink-0 rounded-full object-cover" />
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}
          >
            <Package className="h-4 w-4" />
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex items-center rounded-md px-1.5 py-1"
            style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            title={t("admin.featuredProducts.ui.featuredLabel")}
            aria-label={t("admin.featuredProducts.ui.featuredAria")}
          >
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          </span>
          <StatusBadge status={product.status} />
        </div>
      </div>

      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold">{productName}</p>
        {variant?.sku && <p className="mt-0.5 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{variant.sku}</p>}
        <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
          {[nameOf(product?.category_id), nameOf(product?.brand_id)].filter(Boolean).join(" · ") || "—"}
        </p>
        <p className="mt-1 text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
          {fmtCurrency(price, locale)} · {t("admin.featuredProducts.ui.stock")}: {fmt(variant?.quantity, locale)}
        </p>
      </div>

      <div
        className="mt-auto flex items-center justify-end gap-1.5 border-t pt-2"
        style={{ borderColor: "var(--border-color)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onOpen}
          title={t("admin.featuredProducts.page.viewProduct")}
          aria-label={t("admin.featuredProducts.ui.viewProductAria", { name: productName })}
          className="flex h-7 w-7 items-center justify-center rounded-md transition hover:opacity-80"
          style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          disabled={isRemoving}
          onClick={onRemove}
          title={t("admin.featuredProducts.page.removeFromFeatured")}
          aria-label={t("admin.featuredProducts.ui.removeAria", { name: productName })}
          className="flex h-7 w-7 items-center justify-center rounded-md transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
        >
          <StarOff className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}



/* ==========================================================
   MODAL SKELETON
   ========================================================== */
function ModalSkeleton({ rows = MODAL_PER_PAGE }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={`manage-skeleton-${i}`} className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <div className="h-5 w-5 shrink-0 animate-pulse rounded" style={{ backgroundColor: "var(--bg-tertiary)" }} />
          <div className="h-9 w-9 shrink-0 animate-pulse rounded" style={{ backgroundColor: "var(--bg-tertiary)" }} />
          <div className="flex-1">
            <div className="h-3 w-1/2 animate-pulse rounded" style={{ backgroundColor: "var(--bg-tertiary)" }} />
            <div className="mt-2 h-2.5 w-1/3 animate-pulse rounded" style={{ backgroundColor: "var(--bg-tertiary)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ==========================================================
   MANAGE FEATURED MODAL — "Manage Products" popup
   Saare products (sirf featured nahi) + multi-select checkbox.
   User kai products ek saath feature / unfeature kar sakta hai —
   professional dashboards jaisa. Inactive products select nahi ho
   sakte (backend bhi same rule lagata hai).
   ========================================================== */
function ManageFeaturedModal({ open, onClose, onSaved }) {
  const { t, dir, locale } = useTranslation();
  const { nameOf, productNameOf } = useLocalized();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  // draft: user ke explicitly toggle kiye ids → desired featured state
  const [draft, setDraft] = useState({});
  // orig: jab product pehli dafa dikha us waqt ka actual is_featured
  const [orig, setOrig] = useState({});

  // Modal khulte hi sab state reset
  useEffect(() => {
    if (open) {
      setSearch("");
      setDebounced("");
      setPage(1);
      setDraft({});
      setOrig({});
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["manage-featured", page, debounced],
    queryFn: () => productApi.getPaginated({ page, limit: MODAL_PER_PAGE, search: debounced }),
    enabled: open,
    retry: false,
  });

  const products = useMemo(() => data?.products || [], [data]);
  const pagination = data?.pagination || {};
  const totalPages = Math.max(1, Number(pagination.pages) || 1);
  const totalRecords = Number(pagination.total) || 0;
  const categories = useMemo(() => products.map((product) => product?.category_id).filter((item) => item?._id), [products]);
  const brands = useMemo(() => products.map((product) => product?.brand_id).filter((item) => item?._id), [products]);
  usePageTranslations({
    model: "Product",
    records: products,
    locale,
    ready: open && !isFetching && Number(pagination.page || page) === page,
    queryKey: ["manage-featured", page, debounced],
    queryClient,
  });
  usePageTranslations({
    model: "Category",
    records: categories,
    locale,
    ready: open && !isFetching && Number(pagination.page || page) === page,
    queryKey: ["manage-featured", page, debounced],
    queryClient,
  });
  usePageTranslations({
    model: "Brand",
    records: brands,
    locale,
    ready: open && !isFetching && Number(pagination.page || page) === page,
    queryKey: ["manage-featured", page, debounced],
    queryClient,
  });

  // Naye loaded products ke original state capture karo (draft ko touch na karo)
  useEffect(() => {
    if (!open || !products.length) return;
    setOrig((prev) => {
      let changed = false;
      const next = { ...prev };
      products.forEach((p) => {
        if (!(p._id in next)) {
          next[p._id] = p.is_featured === true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [products, open]);

  const valueOf = (p) =>
    Object.prototype.hasOwnProperty.call(draft, p._id)
      ? draft[p._id]
      : orig[p._id] ?? p.is_featured === true;

  const selectableOnPage = products.filter((p) => p.status === "active");
  const allOnPageSelected = selectableOnPage.length > 0 && selectableOnPage.every((p) => valueOf(p));
  const selectedCount = products.filter((p) => valueOf(p)).length;

  // Actual changes (draft vs orig) — cross-page safe
  const toFeature = [];
  const toUnfeature = [];
  Object.keys(draft).forEach((id) => {
    const wants = draft[id];
    const was = orig[id];
    if (was === undefined) return;
    if (wants && !was) toFeature.push(id);
    else if (!wants && was) toUnfeature.push(id);
  });
  const hasChanges = toFeature.length > 0 || toUnfeature.length > 0;

  const toggleRow = (p) => {
    if (p.status !== "active") return;
    setDraft((prev) => ({ ...prev, [p._id]: !valueOf(p) }));
  };

  const toggleAllOnPage = () => {
    if (!selectableOnPage.length) return;
    const next = !allOnPageSelected;
    setDraft((prev) => {
      const merged = { ...prev };
      selectableOnPage.forEach((p) => { merged[p._id] = next; });
      return merged;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      if (toFeature.length) results.push(await productApi.bulkFeatured({ ids: toFeature, is_featured: true }));
      if (toUnfeature.length) results.push(await productApi.bulkFeatured({ ids: toUnfeature, is_featured: false }));
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["featured-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["manage-featured"] });
      toast.success(t("admin.featuredProducts.toast.updated"));
      onSaved?.();
      onClose?.();
    },
    onError: (e) => {
      toast.error(t("admin.featuredProducts.toast.updateFailed"));
    },
  });

  const actionLabel = saveMutation.isPending
    ? t("admin.featuredProducts.modal.saving")
    : toFeature.length && toUnfeature.length
      ? t("admin.featuredProducts.modal.update")
      : toFeature.length
        ? t("admin.featuredProducts.modal.featureSelected", { count: toFeature.length })
        : toUnfeature.length
        ? t("admin.featuredProducts.modal.removeSelected", { count: toUnfeature.length })
        : t("admin.featuredProducts.modal.noChanges");

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("admin.featuredProducts.modal.manageFeatured")}
      dir={dir}
      lang={locale}
    >
      <style>{`@keyframes modalScaleIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}} @keyframes modalSlideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl sm:max-w-3xl sm:rounded-2xl"
        style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", animation: "modalSlideUp .25s ease-out" }}
      >
        {/* HEADER */}
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              <Star className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[16px] font-bold leading-6">{t("admin.featuredProducts.modal.title")}</h2>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--text-muted)" }}>
                {t("admin.featuredProducts.modal.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("admin.featuredProducts.ui.close")}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:opacity-70"
            style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* TOOLBAR */}
        <div className="flex flex-col gap-3 border-b px-5 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div className="relative w-full sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder={t("admin.featuredProducts.modal.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg ps-9 pe-3 text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40"
              style={inputStyle}
            />
          </div>
          <div className="flex items-center gap-3 text-[12px]" style={{ color: "var(--text-secondary)" }}>
            <label className="flex cursor-pointer select-none items-center gap-2">
              <input
                type="checkbox"
                checked={allOnPageSelected}
                onChange={toggleAllOnPage}
                disabled={!selectableOnPage.length}
                className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
              />
              {t("admin.featuredProducts.modal.selectAll")}
            </label>
            <span aria-hidden="true">·</span>
            <span>{t("admin.featuredProducts.modal.selected", { count: selectedCount })}</span>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {isLoading ? (
            <ModalSkeleton rows={MODAL_PER_PAGE} />
          ) : isError ? (
            <div className="px-4 py-14 text-center" style={{ color: "var(--text-muted)" }}>
              <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500 opacity-70" />
              <p className="text-[13px]">{t("admin.featuredProducts.ui.loadError")}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="mx-auto mt-4 flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90"
                style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
              >
                {t("admin.featuredProducts.page.retry")}
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className="px-4 py-14 text-center" style={{ color: "var(--text-muted)" }}>
              <Package className="mx-auto mb-3 h-8 w-8 opacity-30" />
              <p className="text-[13px]">{debounced ? t("admin.featuredProducts.modal.noProductsMatch") : t("admin.featuredProducts.modal.noProducts")}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {products.map((p) => {
                const variant = p?.variants?.[0];
                const img = variant?.images?.[0]?.img_url;
                const isInactive = p.status !== "active";
                const checked = valueOf(p);
                return (
                  <div
                    key={p._id}
                    onClick={() => toggleRow(p)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition"
                    style={{
                      cursor: isInactive ? "not-allowed" : "pointer",
                      opacity: isInactive ? 0.55 : 1,
                      backgroundColor: checked ? "var(--bg-tertiary)" : "transparent",
                    }}
                    onMouseEnter={(e) => { if (!isInactive && !checked) e.currentTarget.style.backgroundColor = "var(--bg-row-hover)"; }}
                    onMouseLeave={(e) => { if (!checked) e.currentTarget.style.backgroundColor = "transparent"; }}
                  >
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded border"
                      style={{
                        backgroundColor: checked ? "var(--accent)" : "var(--bg-card)",
                        borderColor: checked ? "var(--accent)" : "var(--border-color)",
                        color: "var(--accent-text)",
                      }}
                    >
                      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>

                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getImageUrl(img)} alt={productNameOf(p)} className="h-9 w-9 shrink-0 rounded object-cover" />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>
                        <Package className="h-4 w-4" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold">{productNameOf(p)}</p>
                      <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {variant?.sku || "—"} · {nameOf(p?.category_id) || "—"} · {nameOf(p?.brand_id) || "—"}
                      </p>
                    </div>

                    {isInactive ? (
                      <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" }}>
                        {t("admin.featuredProducts.page.inactive")}
                      </span>
                    ) : (
                      <StatusBadge status={p.status} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex flex-col gap-3 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              disabled={page <= 1 || isFetching}
              aria-label={t("admin.featuredProducts.pagination.prev")}
              className="flex h-8 w-8 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-35 hover:opacity-80"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
              {t("admin.featuredProducts.modal.pageOf", { page, pages: totalPages })}
              {totalRecords > 0 ? ` · ${t("admin.featuredProducts.pagination.products", { count: fmt(totalRecords, locale) })}` : ""}
            </span>
            <button
              type="button"
              onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
              disabled={page >= totalPages || isFetching}
              aria-label={t("admin.featuredProducts.pagination.next")}
              className="flex h-8 w-8 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-35 hover:opacity-80"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            {isFetching && <Loader2 className="ms-1 h-3.5 w-3.5 animate-spin" style={{ color: "var(--text-muted)" }} />}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDraft({})}
              disabled={!Object.keys(draft).length || saveMutation.isPending}
              className="h-9 rounded-lg px-3 text-[13px] font-medium transition disabled:opacity-40 hover:opacity-80"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
            >
              {t("admin.featuredProducts.modal.clear")}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saveMutation.isPending}
              className="h-9 rounded-lg px-3 text-[13px] font-medium transition disabled:opacity-40 hover:opacity-80"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
            >
              {t("admin.featuredProducts.modal.cancel")}
            </button>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              className="flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


export default function FeaturedProductsPage() {
  const { t, dir, locale } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  // ✅ Baqi pages (Products waghera) ki tarah live socket sync —
  //    dusre staff/tab ki featured changes bina refresh ke nazar aayein
  useProductSocketSync();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("list");
  // ✅ "Manage Products" popup — multi-select featured manager
  const [manageOpen, setManageOpen] = useState(false);

  // ✅ Same API jo Products page use karta hai — sirf featured=true filter ke saath
  // sort="featured-recent" → featured_at desc (jo abhi featured hua wo top par).
  // Default created_at sort is page kaam ka nahi tha (bulk seed me sab same).
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["featured-products", currentPage, search],
    queryFn: () =>
      productApi.getPaginated({
        page: currentPage,
        limit: PER_PAGE,
        search: search || "",
        featured: true,
        sort: "featured-recent",
      }),
    retry: false,
  });

  const products = useMemo(() => data?.products || [], [data]);
  const pagination = data?.pagination || { total: 0, pages: 1, limit: PER_PAGE };
  const categories = useMemo(() => products.map((product) => product?.category_id).filter((item) => item?._id), [products]);
  const brands = useMemo(() => products.map((product) => product?.brand_id).filter((item) => item?._id), [products]);
  usePageTranslations({
    model: "Product",
    records: products,
    locale,
    ready: !isFetching && Number(pagination.page || currentPage) === currentPage,
    queryKey: ["featured-products", currentPage, search],
    queryClient,
  });
  usePageTranslations({
    model: "Category",
    records: categories,
    locale,
    ready: !isFetching && Number(pagination.page || currentPage) === currentPage,
    queryKey: ["featured-products", currentPage, search],
    queryClient,
  });
  usePageTranslations({
    model: "Brand",
    records: brands,
    locale,
    ready: !isFetching && Number(pagination.page || currentPage) === currentPage,
    queryKey: ["featured-products", currentPage, search],
    queryClient,
  });
  const totalRecords = Number(pagination.total) || 0;
  const totalPages = Math.max(1, Number(pagination.pages) || 1);
  const pageLimit = Number(pagination.limit) || PER_PAGE;
  const firstRow = totalRecords === 0 ? 0 : (currentPage - 1) * pageLimit + 1;
  const lastRow = Math.min(currentPage * pageLimit, totalRecords);

  // ✅ Stat cards — current page se (total record count server se aata hai)
  const activeCount = useMemo(() => products.filter((p) => p?.status === "active").length, [products]);
  // ✅ "Inactive" card hata diya — featured products ka inactive hona practically hamesha
  //    0 hi hota tha (useless box). Uski jagah "Out of Stock": stock 0 wale featured
  //    products ka count (actionable — inhe restock ya unfeature karna hota hai).
  //    Stock wahi field use karta hai jo table ke Stock column me dikhta hai
  //    (variants[0].quantity), is liye numbers table se match karte hain.
  const outOfStockCount = useMemo(
    () => products.filter((p) => (Number(p?.variants?.[0]?.quantity) || 0) === 0).length,
    [products]
  );
  const totalStock = useMemo(
    () => products.reduce((sum, p) => sum + (Number(p?.variants?.[0]?.quantity) || 0), 0),
    [products]
  );

  // ✅ Unmark ke baad turant list refresh — server se confirm ho jata hai
  const featuredMutation = useMutation({
    mutationFn: (id) => productApi.toggleFeatured(id),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["featured-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("admin.featuredProducts.toast.removed"));
    },
    onError: (e) => {
      queryClient.invalidateQueries({ queryKey: ["featured-products"] });
      toast.error(t("admin.featuredProducts.toast.removeFailed"));
    },
  });

  const goToPage = (pg) => {
    setCurrentPage(Math.min(Math.max(1, pg), totalPages));
  };


  return (
    <div className="w-full min-h-screen space-y-5" style={{ color: "var(--text-primary)" }}>
      {/* HEADER — same as Products page */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-[24px] font-bold leading-7 tracking-tight">{t("admin.featuredProducts.page.title")}</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
            {t("admin.featuredProducts.page.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className="flex h-9 w-9 items-center justify-center rounded-lg transition"
              style={viewMode === "list" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}
              aria-label={t("admin.featuredProducts.ui.listView")}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className="flex h-9 w-9 items-center justify-center rounded-lg transition"
              style={viewMode === "grid" ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" } : cardStyle}
              aria-label={t("admin.featuredProducts.ui.gridView")}
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
          >
            <Package className="h-4 w-4" /> {t("admin.featuredProducts.page.manageProducts")}
          </button>
        </div>
      </div>

      {/* STAT CARDS — same 4-card grid as Products page */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: t("admin.featuredProducts.page.totalFeatured"), v: totalRecords },
          { l: t("admin.featuredProducts.page.active"), v: activeCount, c: "text-emerald-500" },
          { l: t("admin.featuredProducts.ui.outOfStock"), v: outOfStockCount, c: outOfStockCount ? "text-red-400" : "text-emerald-500" },
          { l: t("admin.featuredProducts.ui.totalStock"), v: totalStock, c: "text-blue-500" },
        ].map((s, i) => (
          <div key={i} className="rounded-lg p-4" style={cardStyle}>
            <p className="text-[12px] font-medium" style={{ color: "var(--text-muted)" }}>{s.l}</p>
            <p className={`mt-1 text-[20px] font-bold tabular-nums ${s.c || ""}`}>{fmt(s.v, locale)}</p>
          </div>
        ))}
      </div>

      {/* TOOLBAR — search left (same as Products / Brands) */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="relative w-full md:w-[400px]">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder={t("admin.featuredProducts.page.searchPlaceholder")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="h-9 w-full rounded-lg ps-9 pe-3 text-[13px] outline-none transition focus:ring-1 focus:ring-emerald-500/40"
            style={inputStyle}
          />
        </div>
      </div>


      {/* LIST VIEW — same table structure as Products page */}
      {viewMode === "list" && (
        <div className="overflow-hidden rounded-lg" style={cardStyle}>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                <tr>
                  {[t("admin.featuredProducts.page.product"), t("admin.featuredProducts.ui.category"), t("admin.featuredProducts.ui.brand"), t("admin.featuredProducts.ui.price"), t("admin.featuredProducts.ui.stock"), t("admin.featuredProducts.ui.status"), t("admin.featuredProducts.ui.actions")].map((h) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-start text-[12px] font-semibold uppercase tracking-wider ${h === t("admin.featuredProducts.ui.actions") ? "text-end" : ""}`}
                      style={{ color: "var(--text-muted)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              {isLoading ? (
                <TableSkeleton rows={PER_PAGE} />
              ) : (
                <tbody style={{ animation: "fadeIn 0.22s ease" }}>
                  {isError ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center" style={{ color: "var(--text-muted)" }}>
                        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500 opacity-70" />
                        <p className="text-[13px]">{t("admin.featuredProducts.page.loadFailed")}</p>
                        <button
                          type="button"
                          onClick={() => refetch()}
                          className="mx-auto mt-4 flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90"
                          style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                        >
                          {t("admin.featuredProducts.page.retry")}
                        </button>
                      </td>
                    </tr>
                  ) : products.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center" style={{ color: "var(--text-muted)" }}>
                        <Star className="mx-auto mb-3 h-8 w-8 opacity-30" />
                        {search ? t("admin.featuredProducts.page.noMatch") : t("admin.featuredProducts.page.empty")}
                      </td>
                    </tr>
                  ) : (
                    products.map((p) => (
                      <FeaturedRow
                        key={p._id}
                        product={p}
                        isRemoving={featuredMutation.isPending}
                        onOpen={() => router.push(`/admin/products/${p._id}`)}
                        onRemove={() => featuredMutation.mutate(p._id)}
                      />
                    ))
                  )}
                </tbody>
              )}
            </table>
          </div>
        </div>
      )}


      {/* GRID VIEW — same card grid as Products page */}
      {viewMode === "grid" && (
        isLoading ? (
          <GridSkeleton cards={8} />
        ) : isError ? (
          <div className="rounded-lg px-4 py-14 text-center" style={cardStyle}>
            <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-red-500 opacity-70" />
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              {t("admin.featuredProducts.page.loadFailed")}
            </p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mx-auto mt-4 flex h-9 items-center justify-center rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
            >
              {t("admin.featuredProducts.page.retry")}
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-lg px-4 py-14 text-center" style={cardStyle}>
            <Star className="mx-auto mb-3 h-8 w-8 opacity-30" style={{ color: "var(--text-muted)" }} />
            <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
              {search ? t("admin.featuredProducts.page.noMatch") : t("admin.featuredProducts.page.empty")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <FeaturedGridCard
                key={p._id}
                product={p}
                isRemoving={featuredMutation.isPending}
                onOpen={() => router.push(`/admin/products/${p._id}`)}
                onRemove={() => featuredMutation.mutate(p._id)}
              />
            ))}
          </div>
        )
      )}

      {/* PAGINATION — same simple pattern as Products page */}
      {!isLoading && !isError && totalRecords > PER_PAGE && (
        <div
          className="flex flex-col gap-3 rounded-lg px-4 py-3 lg:flex-row lg:items-center lg:justify-between"
          style={cardStyle}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
            <span>
              {t("admin.featuredProducts.ui.showing")} <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(firstRow, locale)}–{fmt(lastRow, locale)}</span> {t("admin.featuredProducts.ui.of")}{" "}
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(totalRecords, locale)}</span> {t("admin.featuredProducts.ui.products")}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t("admin.featuredProducts.ui.page")} <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{currentPage}</span> {t("admin.featuredProducts.ui.of")}{" "}
              <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{fmt(totalPages, locale)}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5" role="navigation" aria-label={t("admin.featuredProducts.ui.pagination")}>
            <button
              type="button"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1 || isFetching}
              aria-label={t("admin.featuredProducts.pagination.prev")}
              className="flex h-8 items-center gap-1 rounded-md px-2.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 hover:opacity-80"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> {t("admin.featuredProducts.ui.prev")}
            </button>

            {buildPageList(currentPage, totalPages).map((pg, i) =>
              pg === "…" ? (
                <span key={`skip-${i}`} aria-hidden="true" className="flex h-8 w-8 items-center justify-center text-[13px]" style={{ color: "var(--text-muted)" }}>
                  …
                </span>
              ) : (
                <button
                  key={pg}
                  type="button"
                  onClick={() => goToPage(pg)}
                  aria-current={pg === currentPage ? "page" : undefined}
              aria-label={t("admin.featuredProducts.pagination.pageOf", { page: pg })}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-[13px] font-semibold tabular-nums transition hover:opacity-80"
                  style={
                    pg === currentPage
                      ? { backgroundColor: "var(--accent)", color: "var(--accent-text)" }
                      : { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }
                  }
                >
                  {pg}
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages || isFetching}
              aria-label={t("admin.featuredProducts.pagination.next")}
              className="flex h-8 items-center gap-1 rounded-md px-2.5 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 hover:opacity-80"
              style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
            >
              {t("admin.featuredProducts.pagination.nextShort")} <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* "Manage Products" popup — saare products + multi-select featured manager */}
      <ManageFeaturedModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </div>
  );
}
