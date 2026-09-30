"use client";

/* ==========================================================
   FEATURED PRODUCTS — home page ka main products grid
   Tabs (saare REAL data par):
     Featured     → har category + brand se diverse ordering
     New Arrivals → real created_at (API) ke hisaab se latest
     Best Offers  → SIRF top / high percentage wali discount products
                    (discount % descending sort + sirf top 20 — chhoti
                    % wali offers is tab me nahi aatin)
   Sidebar ke filters yahin apply hote hain (filteredProducts prop).

   Pagination bilkul CLIENT-SIDE hai (PaginationBar):
     - har page par 20 products
     - page number click karne par koi navigation nahi hoti,
       usi section me agle 20 products render ho jate hain
   ========================================================== */

import { useMemo, useState } from "react";
import { Flame, PackageSearch, Shuffle, Sparkles, TrendingUp } from "lucide-react";
import ProductCard from "./ProductCard";
import PaginationBar from "./PaginationBar";
import SectionHeading from "./SectionHeading";
import { getProductCreatedAt, idOf, pickDiverse } from "@/utils/homeCatalog";

const TABS = [
  { id: "featured", label: "Featured", icon: Sparkles },
  { id: "new", label: "New Arrivals", icon: TrendingUp },
  { id: "offers", label: "Best Offers", icon: Flame },
];

const PER_PAGE = 20;

/* Best Offers me sirf TOP high-percentage discounts — sab se bari % wali
   itni products (ek page). Chhoti % wali discount products is tab me nahi. */
const TOP_OFFERS_LIMIT = 20;

/* Full-width responsive grid — sidebar ke sath bhi har screen par poori
   chaudai bharti hai: mobile 2 → sm 3 → md 4 → xl 5 → 2xl 6 columns
   (4K par 7-8, 1080p/laptop ka purana look same) */
const GRID = "grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 4xl:grid-cols-7 5xl:grid-cols-8";

/* List + pagination ek alag component me: list / tab badalne par parent
   naya `key` deta hai, is liye React is component ko remount karta hai aur
   page khud-ba-khud 1 par reset ho jata hai (koi extra effect nahi). */
function PaginatedProductGrid({ items = [] }) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE),
    [items, currentPage],
  );

  return (
    <>
      <div className={GRID}>
        {pageItems.map((product) => (
          <ProductCard key={idOf(product._id) || product.name} product={product} />
        ))}
      </div>

      <PaginationBar
        page={currentPage}
        totalPages={totalPages}
        total={items.length}
        perPage={PER_PAGE}
        onPageChange={setPage}
      />
    </>
  );
}

export default function FeaturedProducts({
  products = [],
  isLoading = false,
  filtersActive = false,
  onClear,
  getDiscountPercent,
  /* Har filter change par grid page 1 se start ho — is liye parent se
     ek chhota signature aata hai jo mount key me add ho jata hai. */
  resetKey = "",
  /* Sidebar me deal select ho to heading me us deal ka naam (page.js se). */
  titleOverride = null,
}) {
  const [tab, setTab] = useState("featured");
  const [shuffleKey, setShuffleKey] = useState(0);

  const discountOf = useMemo(
    () => (typeof getDiscountPercent === "function" ? getDiscountPercent : () => 0),
    [getDiscountPercent],
  );

  // Real data check — koi discount hi na ho to "Best Offers" tab hide
  const hasOffers = useMemo(
    () => products.some((product) => discountOf(product) > 0),
    [products, discountOf],
  );

  const tabs = useMemo(
    () => (hasOffers ? TABS : TABS.filter((item) => item.id !== "offers")),
    [hasOffers],
  );

  const items = useMemo(() => {
    if (!products.length) return [];
    if (tab === "new") {
      return [...products].sort((a, b) => getProductCreatedAt(b) - getProductCreatedAt(a));
    }
    if (tab === "offers") {
      return [...products]
        .filter((product) => discountOf(product) > 0)
        .sort((a, b) => discountOf(b) - discountOf(a))
        .slice(0, TOP_OFFERS_LIMIT);
    }
    // Poore catalog ki diverse ordering (limit = poori list) — is se
    // pagination par bhi har page diverse products dikhata hai.
    return pickDiverse(products, products.length, { seed: shuffleKey });
  }, [products, tab, shuffleKey, discountOf]);

  const tabClass = (active) =>
    `relative shrink-0 px-1 pb-1.5 text-[0.6875rem] font-bold uppercase tracking-wider transition-colors ${
      active
        ? "text-[var(--user-text)]"
        : "text-[var(--user-text-subtle)] hover:text-[var(--user-text-muted)]"
    }`;

  const title =
    titleOverride ||
    (filtersActive
      ? "Filtered Products"
      : tab === "new"
        ? "New Arrivals"
        : tab === "offers"
          ? "Best Offers"
          : "Featured Products");
  const subtitle =
    titleOverride && products.length
      ? `${products.length} ${products.length === 1 ? "product" : "products"} in this deal`
      : filtersActive
        ? `${products.length} ${products.length === 1 ? "product" : "products"} match your filters`
        : tab === "new"
          ? "Fresh arrivals — latest first"
          : tab === "offers"
            ? "Biggest discounts first"
            : "Handpicked across every category and brand";

  if (isLoading && !products.length) {
    return (
      <section>
        <SectionHeading title="Featured Products" subtitle="Loading products…" />
        <div className={GRID}>
          {[...Array(8).keys()].map((index) => (
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
    <section id="featured-products">
      <SectionHeading title={title} subtitle={subtitle}>
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`${tabClass(tab === id)} flex items-center gap-1.5`}
            >
              <Icon size={12} />
              {label}
              <span
                className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--user-accent)] transition-opacity ${
                  tab === id ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          ))}

          {tab === "featured" ? (
            <button
              type="button"
              onClick={() => setShuffleKey((value) => value + 1)}
              aria-label="Shuffle featured products"
              title="Shuffle featured products"
              className="group/shuffle inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--user-accent)]/35 bg-[var(--user-accent-soft)] px-3 py-1 text-[0.6875rem] font-black uppercase tracking-wider text-[var(--user-accent)] shadow-sm transition-all hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] hover:shadow-md active:scale-95"
            >
              <Shuffle
                size={12}
                className="transition-transform duration-500 group-active/shuffle:rotate-180"
              />
              Shuffle
            </button>
          ) : null}
        </div>
      </SectionHeading>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-12 text-center">
          <PackageSearch size={30} className="text-[var(--user-text-subtle)]" />
          <p className="text-sm font-bold text-[var(--user-text)]">No products found</p>
          <p className="text-[0.6875rem] text-[var(--user-text-muted)]">
            {filtersActive ? "Try a different filter or clear them." : "Products are loading."}
          </p>
          {filtersActive ? (
            <button
              type="button"
              onClick={onClear}
              className="mt-1 rounded-lg bg-[var(--user-accent)] px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--user-accent-text)] transition-opacity hover:opacity-90"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <PaginatedProductGrid
          key={`${tab}|${shuffleKey}|${resetKey}|${items.length}|${idOf(items[0]?._id)}`}
          items={items}
        />
      )}
    </section>
  );
}
