"use client";

/* ==========================================================
   FEATURED PRODUCTS — home page ka main products grid
   Tabs (server-side, har tab apni query) — teeno hamesha visible:
     Featured     → default order (newest-first catalog order)
     New Arrivals → sort=newest
     Best Offers  → sab se bari discount % (sort=discount-desc)

   Har tab me numbered server pagination (PaginationBar, 20 per page).
   ========================================================== */

import { useDeferredValue, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Flame, PackageSearch, Sparkles, TrendingUp } from "lucide-react";
import ProductCard from "./ProductCard";
import PaginationBar from "./PaginationBar";
import SectionHeading from "./SectionHeading";
import { idOf } from "@/utils/homeCatalog";
import { useShopProducts, scrollToListTop } from "@/hooks/useShopProducts";
import { FEATURED_TAB_EVENT } from "./HomeNav";

const TABS = [
  { id: "featured", label: "Featured", icon: Sparkles },
  { id: "new", label: "New Arrivals", icon: TrendingUp },
  { id: "offers", label: "Best Offers", icon: Flame },
];

const PER_PAGE = 20;

const TAB_PARAMS = {
  featured: { sort: "featured" },
  new: { sort: "newest" },
  offers: { sort: "discount-desc", minDiscount: 1 },
};

/* Compact marketplace grid across storefront breakpoints */
const GRID =
  "grid w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 4xl:grid-cols-8 5xl:grid-cols-9";

function TabGrid({ tab }) {
  const [page, setPage] = useState(1);
  const gridRef = useRef(null);
  const params = TAB_PARAMS[tab] || TAB_PARAMS.featured;

  const { products, total, pagination, isLoading, isFetching, isError, refetch } = useShopProducts({
    page,
    limit: PER_PAGE,
    sort: params.sort,
    minDiscount: params.minDiscount ?? null,
  });

  const totalPages = pagination?.pages || Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = pagination?.page || Math.min(page, totalPages);
  // ✅ Badi list ka render defer — urgent updates (tab/page) pehle, logic same
  const deferredProducts = useDeferredValue(products);

  const goToPage = (next) => {
    setPage(Math.min(Math.max(1, next), totalPages));
    scrollToListTop(gridRef);
  };

  if (isLoading && !products.length) {
    return (
      <div className={GRID}>
        {[...Array(8).keys()].map((index) => (
          <div
            key={index}
            className="h-[18.125rem] animate-pulse overflow-hidden rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)] md:h-[19.125rem] xl:h-[20.125rem]"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-12 text-center">
        <PackageSearch size={30} className="text-[var(--user-text-subtle)]" />
        <p className="text-sm font-bold text-[var(--user-text)]">Could not load products</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-1 rounded-lg bg-[var(--user-accent)] px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--user-accent-text)] transition-opacity hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-12 text-center">
        <PackageSearch size={30} className="text-[var(--user-text-subtle)]" />
        <p className="text-sm font-bold text-[var(--user-text)]">No products found</p>
        <p className="text-[0.6875rem] text-[var(--user-text-muted)]">New products are on the way.</p>
      </div>
    );
  }

  return (
    <div ref={gridRef} className="scroll-mt-24">
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
      {isFetching && products.length > 0 ? (
        <p className="mt-2 text-center text-[0.6875rem] text-[var(--user-text-subtle)]">Updating…</p>
      ) : null}
    </div>
  );
}

export default function FeaturedProducts({ titleOverride = null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams?.get("tab");
  const normalizedUrlTab =
    urlTab === "offers" || urlTab === "new" || urlTab === "featured" ? urlTab : null;

  const [manualTab, setManualTab] = useState(normalizedUrlTab || "featured");
  const sectionRef = useRef(null);

  /* ?tab= URL param ho to wahi jeetta hai (nav / share / refresh),
     warna manual selection. Is se URL-sync ke liye effect me setState
     nahi karna padta. */
  const tab = normalizedUrlTab || manualTab;

  const syncUrlTab = (next) => {
    try {
      const sp = new URLSearchParams(searchParams?.toString() || "");
      if (next === "featured") sp.delete("tab");
      else sp.set("tab", next);
      const query = sp.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    } catch {}
  };

  useEffect(() => {
    const onSelect = (event) => {
      const next = event?.detail;
      if (next === "offers" || next === "new" || next === "featured") {
        setManualTab(next);
        requestAnimationFrame(() => {
          try {
            sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
          } catch {}
        });
      }
    };
    window.addEventListener(FEATURED_TAB_EVENT, onSelect);
    return () => window.removeEventListener(FEATURED_TAB_EVENT, onSelect);
  }, []);

  /* ?tab= ke sath page load / refresh ho to seedha Featured par scroll. */
  useEffect(() => {
    if (normalizedUrlTab === "offers" || normalizedUrlTab === "new") {
      const timer = setTimeout(() => {
        try {
          sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        } catch {}
      }, 350);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTab = (next) => {
    setManualTab(next);
    // Nav active state sync me rahe — ?tab= URL me likho (scroll nahi)
    syncUrlTab(next);
  };

  // Best Offers tab hamesha visible — Featured + New Arrivals ke sath
  const tabs = TABS;
  const safeTab = tab;

  const tabClass = (active) =>
    `relative shrink-0 px-1 pb-1.5 text-[0.6875rem] font-bold uppercase tracking-wider transition-colors ${
      active
        ? "text-[var(--user-text)]"
        : "text-[var(--user-text-subtle)] hover:text-[var(--user-text-muted)]"
    }`;

  const title =
    titleOverride ||
    (safeTab === "new"
      ? "New Arrivals"
      : safeTab === "offers"
        ? "Best Offers"
        : "Featured Products");
  const subtitle =
    safeTab === "new"
      ? "Fresh arrivals — latest first"
      : safeTab === "offers"
        ? "Biggest discounts first"
        : "Handpicked across every category and brand";

  return (
    <section id="featured-products" ref={sectionRef} className="scroll-mt-[7.5rem] lg:scroll-mt-[8.5rem]">
      <SectionHeading title={title} subtitle={subtitle}>
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              className={`${tabClass(safeTab === id)} flex items-center gap-1.5`}
            >
              <Icon size={12} />
              {label}
              <span
                className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[var(--user-accent)] transition-opacity ${
                  safeTab === id ? "opacity-100" : "opacity-0"
                }`}
              />
            </button>
          ))}
        </div>
      </SectionHeading>

      <TabGrid key={safeTab} tab={safeTab} />
    </section>
  );
}
