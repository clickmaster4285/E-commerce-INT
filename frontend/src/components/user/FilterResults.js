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

import { useDeferredValue, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListFilter, PackageSearch, RotateCcw, X } from "lucide-react";
import ProductCard from "./ProductCard";
import PaginationBar from "./PaginationBar";
import SectionHeading from "./SectionHeading";
import { STOCK_STATES, formatPrice, idOf } from "@/utils/homeCatalog";
import { useShopProducts, scrollToListTop } from "@/hooks/useShopProducts";

const PER_PAGE = 20;

const safePageParam = (raw) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
};

/* FeaturedProducts wali grid — dono jagah cards ek jaisi chaudai me */
const GRID =
  "grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 4xl:grid-cols-7 5xl:grid-cols-8 sm:gap-4";

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
  filters,
  sortBy = "featured",
  /* Shop page se free-text search (?q=) — grid isi se filter hota hai.
     Home se ye prop nahi aata (undefined = purana behavior same). */
  search = "",
  categories = [],
  brands = [],
  deals = [],
  onChange,
  onClear,
  /* Sidebar me deal select ho to heading me us deal ka naam (page.js se). */
  titleOverride = null,
  /* Shop par bina-filter state ("All Products") me empty copy alag ho —
     "remove a filter" wali line ka matlab nahi banta. Home false bhejta hai. */
  cleanMode = false,
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const sectionRef = useRef(null);
  // ✅ Server page seedha URL se (?page= — refresh/share safe, duplicate state nahi)
  const page = safePageParam(searchParams.get("page"));

  const filtersKey = useMemo(() => JSON.stringify({ filters, sortBy, search }), [filters, sortBy, search]);

  // ✅ Filter/sort badle to page 1 (sirf URL — external sync, state nahi)
  useEffect(() => {
    try {
      const sp = new URLSearchParams(searchParams.toString());
      if (!sp.has("page")) return;
      sp.delete("page");
      const query = sp.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  const bands = useMemo(() => {
    const list = [...(filters?.discountBands || [])];
    if ((filters?.discountBand ?? null) !== null) list.push(filters.discountBand);
    return [...new Set(list.map(Number).filter((n) => Number.isFinite(n)))];
  }, [filters]);

  // ✅ Server grid (admin pattern: placeholderData, queryKey me sab)
  const { products, total, pagination, isLoading, isFetching, isError, refetch } = useShopProducts({
    page,
    limit: PER_PAGE,
    sort: sortBy,
    search,
    brandIds: filters?.brandIds || [],
    categoryIds: filters?.categoryIds || [],
    minPrice: filters?.minPrice ?? null,
    maxPrice: filters?.maxPrice ?? null,
    stockStates: filters?.stockStates || [],
    dealIds: filters?.dealIds || [],
    discountBands: bands,
  });

  const totalPages = pagination?.pages || Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = pagination?.page || Math.min(page, totalPages);
  // ✅ Badi list ka render defer — filter typing/pagination responsive, logic same
  const deferredProducts = useDeferredValue(products);

  const goToPage = (next) => {
    const value = Math.min(Math.max(1, next), totalPages);
    try {
      const sp = new URLSearchParams(searchParams.toString());
      if (value <= 1) sp.delete("page");
      else sp.set("page", String(value));
      const query = sp.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    } catch {}
    scrollToListTop(sectionRef);
  };

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

  if (isError) {
    return (
      <section
        aria-label="Filter results"
        className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]/60 p-3 sm:p-4"
      >
        <SectionHeading title={titleOverride || "Filter Results"} subtitle="Something went wrong" icon={ListFilter} />
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-12 text-center">
          <PackageSearch size={30} className="text-[var(--user-text-subtle)]" />
          <p className="text-sm font-bold text-[var(--user-text)]">Could not load products</p>
          <p className="text-[0.6875rem] text-[var(--user-text-muted)]">Please check your connection and try again.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-1 rounded-lg bg-[var(--user-accent)] px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--user-accent-text)] transition-opacity hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      aria-label="Filter results"
      className="rounded-2xl border border-[var(--user-accent)]/30 bg-[var(--user-bg-card)]/60 p-3 sm:p-4 scroll-mt-24"
    >
      <SectionHeading
        title={titleOverride || "Filter Results"}
        subtitle={`${total} ${total === 1 ? "product" : "products"} match your filters${isFetching ? "…" : ""}`}
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

      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-12 text-center">
          <PackageSearch size={30} className="text-[var(--user-text-subtle)]" />
          <p className="text-sm font-bold text-[var(--user-text)]">
            {cleanMode ? "No products found" : "No products match these filters"}
          </p>
          <p className="text-[0.6875rem] text-[var(--user-text-muted)]">
            {cleanMode
              ? "Try a different search or filter."
              : "Try removing a filter or clear them all."}
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
            {deferredProducts.map((product, i) => (
              <ProductCard key={idOf(product._id) || product.name} product={product} priority={i < 2} />
            ))}
          </div>

          <PaginationBar
            page={currentPage}
            totalPages={totalPages}
            total={total}
            perPage={PER_PAGE}
            onPageChange={goToPage}
          />
        </>
      )}
    </section>
  );
}
