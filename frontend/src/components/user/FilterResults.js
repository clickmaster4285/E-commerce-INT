"use client";

/* ==========================================================
   FILTER RESULTS — sidebar filter lagte hi main column ke TOP par
   aane wala results panel (neeche jump karne ki zaroorat nahi).

   - Sirf tab render hota hai jab koi filter active ho (parent handle
     karta hai) — iske neeche hero, categories, deals aur baaki home
     page bilkul normal rehta hai.
   - Active filters removable chips me (category / brand / price /
     stock / discount / deal) + "Clear all".
   - Grid me 20 products per page, client-side pagination (PaginationBar:
     page number / next-prev, koi navigation nahi).
   - Parent har filter change par naya `key` deta hai → remount → page 1.
   ========================================================== */

import { useMemo, useState } from "react";
import { ListFilter, PackageSearch, RotateCcw, X } from "lucide-react";
import ProductCard from "./ProductCard";
import PaginationBar from "./PaginationBar";
import SectionHeading from "./SectionHeading";
import { STOCK_STATES, formatPrice, idOf } from "@/utils/homeCatalog";

const PER_PAGE = 20;

/* FeaturedProducts wali grid — dono jagah cards ek jaisi chaudai me */
const GRID =
  "grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 4xl:grid-cols-7 5xl:grid-cols-8";

function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--user-accent)]/40 bg-[var(--user-accent-soft)] py-1 pl-3 pr-1.5 text-[0.6875rem] font-bold text-[var(--user-text)]">
      <span className="min-w-0 truncate capitalize">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label}`}
        className="flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)] transition-opacity hover:opacity-80"
      >
        <X size={10} />
      </button>
    </span>
  );
}

export default function FilterResults({
  products = [],
  isLoading = false,
  filters,
  categories = [],
  brands = [],
  deals = [],
  onChange,
  onClear,
  /* Sidebar me deal select ho to heading me us deal ka naam (page.js se). */
  titleOverride = null,
}) {
  const [page, setPage] = useState(1);

  /* ---------- Active filter chips (har chip apna filter hatati hai) ---------- */
  const chips = useMemo(() => {
    const list = [];
    const without = (array, value) => (array || []).filter((item) => idOf(item) !== value);

    const categoryIds = filters?.categoryIds || [];
    categoryIds.forEach((id) => {
      const value = idOf(id);
      const category = (categories || []).find((item) => idOf(item?._id) === value);
      list.push({
        key: `cat-${value}`,
        label: category?.name || "Category",
        onRemove: () => onChange?.({ categoryIds: without(categoryIds, value) }),
      });
    });

    const brandIds = filters?.brandIds || [];
    brandIds.forEach((id) => {
      const value = idOf(id);
      const brand = (brands || []).find((item) => idOf(item?._id) === value);
      list.push({
        key: `brand-${value}`,
        label: brand?.name || "Brand",
        onRemove: () => onChange?.({ brandIds: without(brandIds, value) }),
      });
    });

    const minPrice = filters?.minPrice ?? null;
    const maxPrice = filters?.maxPrice ?? null;
    if (minPrice !== null || maxPrice !== null) {
      const range =
        minPrice !== null && maxPrice !== null
          ? `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`
          : minPrice !== null
            ? `Above ${formatPrice(minPrice)}`
            : `Under ${formatPrice(maxPrice)}`;
      list.push({
        key: "price",
        label: range,
        onRemove: () => onChange?.({ minPrice: null, maxPrice: null }),
      });
    }

    (filters?.stockStates || []).forEach((id) => {
      const state = STOCK_STATES.find((item) => item.id === id);
      list.push({
        key: `stock-${id}`,
        label: state?.label || id,
        onRemove: () => onChange?.({ stockStates: without(filters.stockStates, id) }),
      });
    });

    const bands = [
      ...(filters?.discountBands || []),
      ...(filters?.discountBand ?? null) !== null ? [filters.discountBand] : [],
    ];
    [...new Set(bands)].forEach((band) => {
      list.push({
        key: `disc-${band}`,
        label: `${band}% or more off`,
        onRemove: () =>
          onChange?.({
            discountBand: null,
            discountBands: (filters?.discountBands || []).filter((item) => item !== band),
          }),
      });
    });

    const dealIds = filters?.dealIds || [];
    dealIds.forEach((id) => {
      const value = idOf(id);
      const deal = (deals || []).find((item) => idOf(item?._id) === value);
      list.push({
        key: `deal-${value}`,
        label: deal?.name || "Deal",
        onRemove: () => onChange?.({ dealIds: without(dealIds, value) }),
      });
    });

    return list;
  }, [filters, categories, brands, deals, onChange]);

  const totalPages = Math.max(1, Math.ceil(products.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => products.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE),
    [products, currentPage],
  );

  if (isLoading && !products.length) {
    return (
      <section aria-label="Filter results">
        <SectionHeading
          title={titleOverride || "Filter Results"}
          subtitle="Loading products…"
          icon={ListFilter}
        />
        <div className={GRID}>
          {[...Array(10).keys()].map((index) => (
            <div
              key={index}
              className="aspect-[3/4] animate-pulse rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Filter results"
      className="rounded-2xl border border-[var(--user-accent)]/30 bg-[var(--user-bg-card)]/60 p-3 sm:p-4"
    >
      <SectionHeading
        title={titleOverride || "Filter Results"}
        subtitle={`${products.length} ${products.length === 1 ? "product" : "products"} match your filters`}
        icon={ListFilter}
      >
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--user-border)] px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--user-text-muted)] transition-colors hover:border-[var(--user-accent)] hover:text-[var(--user-accent)]"
        >
          <RotateCcw size={12} />
          Clear all
        </button>
      </SectionHeading>

      {/* Active filter chips */}
      {chips.length > 0 ? (
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Chip key={chip.key} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      ) : null}

      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-12 text-center">
          <PackageSearch size={30} className="text-[var(--user-text-subtle)]" />
          <p className="text-sm font-bold text-[var(--user-text)]">No products match these filters</p>
          <p className="text-[0.6875rem] text-[var(--user-text-muted)]">
            Try removing a filter or clear them all.
          </p>
          <button
            type="button"
            onClick={onClear}
            className="mt-1 rounded-lg bg-[var(--user-accent)] px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--user-accent-text)] transition-opacity hover:opacity-90"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <div className={GRID}>
            {pageItems.map((product) => (
              <ProductCard key={idOf(product._id) || product.name} product={product} />
            ))}
          </div>

          <PaginationBar
            page={currentPage}
            totalPages={totalPages}
            total={products.length}
            perPage={PER_PAGE}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
