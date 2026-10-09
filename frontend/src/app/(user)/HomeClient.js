"use client";

/* ==========================================================
   USER HOME PAGE (lightweight)

   Layout:
     Header (row 1)
     → Home Nav (row 2)
     → Left sticky sidebar (Category / Price / Brand / Deals /
       Availability / Discount — counts ke sath)
     → Main column (sirf showcase):
         Hero banner → Category tiles → Today's Deals →
         Featured products → Popular categories → Brand strip →
         Brand Spotlight (last)

   FILTERING — home par inline results NAHI hote (perf):
     Sidebar / tile / nav se koi bhi filter lage → seedha
     /filtering-product?... par navigate hota hai, aur wahan wahi
     sidebar same selection ke sath pre-selected milti hai (URL se).
     Is se home par koi products-grid query nahi chalti — home fast.

   Sab content REAL API data se (products, categories, brands,
   banners, deals, discounts).

   THEME: home accent orange — sirf is page par (inline CSS var).
   ========================================================== */

import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/apis/user/productApi";
import { SlidersHorizontal, X } from "lucide-react";
import HomeNav from "@/components/user/HomeNav";
import HomeSidebar from "@/components/user/HomeSidebar";
import BannerSlider from "@/components/user/BannerSlider";
import ViewportSection from "@/components/user/ViewportSection";
import { useHomeCatalog } from "@/hooks/useHomeCatalog";

/* Below-fold sections — code-split (initial JS chhota → LCP/INP fast).
   ssr:true taake SEO same rahe, lekin alag chunk me load hon. */
const HomeCategories = dynamic(() => import("@/components/user/HomeCategories"), {
  ssr: true,
  loading: () => <div className="h-[10rem] animate-pulse rounded-2xl bg-[var(--user-bg-card)]" />,
});
const DealsSection = dynamic(() => import("@/components/user/DealsSection"), {
  ssr: true,
  loading: () => <div className="h-[22rem] animate-pulse rounded-2xl bg-[var(--user-bg-card)]" />,
});
const FeaturedProducts = dynamic(() => import("@/components/user/FeaturedProducts"), {
  ssr: true,
  loading: () => <div className="h-[30rem] animate-pulse rounded-2xl bg-[var(--user-bg-card)]" />,
});
const PopularCategories = dynamic(() => import("@/components/user/PopularCategories"), {
  ssr: true,
  loading: () => <div className="h-[12rem] animate-pulse rounded-2xl bg-[var(--user-bg-card)]" />,
});
const BrandStrip = dynamic(() => import("@/components/user/BrandStrip"), {
  ssr: true,
  loading: () => <div className="h-[7rem] animate-pulse rounded-2xl bg-[var(--user-bg-card)]" />,
});
const BrandShowcase = dynamic(() => import("@/components/user/BrandShowcase"), {
  ssr: true,
  loading: () => <div className="h-[26rem] animate-pulse rounded-2xl bg-[var(--user-bg-card)]" />,
});
/* Mobile drawer: band ho to zero JS — sirf kholne par load. */
const SidebarDrawer = dynamic(() => import("@/components/user/HomeSidebar"), {
  ssr: false,
  loading: () => (
    <div className="space-y-2 p-4">
      {[...Array(6).keys()].map((i) => (
        <div key={i} className="h-7 animate-pulse rounded-lg bg-[var(--user-bg-hover)]" />
      ))}
    </div>
  ),
});

const HOME_THEME = {
  "--user-accent": "#f97316",
  "--user-accent-hover": "#ea580c",
  "--user-accent-text": "#ffffff",
  "--user-accent-soft": "rgba(249, 115, 22, 0.14)",
};

const FILTER_KEYS = [
  "category",
  "brand",
  "minPrice",
  "maxPrice",
  "stock",
  "discount",
  "deal",
  "allCategories",
  "allDeals",
];

/* Sidebar patch (home state shape) → /filtering-product query string. */
function buildFilteringQuery(base, patch) {
  const sp = new URLSearchParams(base || "");
  const setAll = (key, values) => {
    sp.delete(key);
    (values || []).map(String).filter(Boolean).forEach((v) => sp.append(key, v));
  };
  const next = { ...patch };
  if ("categoryIds" in next) setAll("category", next.categoryIds || []);
  if ("brandIds" in next) setAll("brand", next.brandIds || []);
  if ("minPrice" in next || "maxPrice" in next) {
    if ((next.minPrice ?? null) !== null) sp.set("minPrice", String(next.minPrice));
    else if ("minPrice" in next) sp.delete("minPrice");
    if ((next.maxPrice ?? null) !== null) sp.set("maxPrice", String(next.maxPrice));
    else if ("maxPrice" in next) sp.delete("maxPrice");
  }
  if ("stockStates" in next) setAll("stock", next.stockStates || []);
  if ("discountBands" in next || "discountBand" in next) {
    const bands = [
      ...(next.discountBands || []),
      ...(next.discountBand ?? null) !== null ? [next.discountBand] : [],
    ];
    setAll("discount", [...new Set(bands)]);
  }
  if ("dealIds" in next) setAll("deal", next.dealIds || []);
  return sp.toString();
}

export default function HomeClient({ initialBanners = null }) {
  return (
    <Suspense
      fallback={
        <main
          style={HOME_THEME}
          className="min-h-screen w-full min-w-0 pb-2 text-[var(--user-text)]"
        >
          <div className="sticky top-14 z-40 h-11 border-b border-[var(--user-border)] bg-[var(--user-bg-elevated)] lg:top-16 lg:h-12" />
          <div className="w-full max-w-none pl-3 pr-3 pt-4 sm:pl-4 sm:pr-4 lg:pl-0 lg:pr-8 lg:pt-5 xl:pl-0 xl:pr-10 2xl:pl-0 2xl:pr-12">
            <div className="h-7 w-48 animate-pulse rounded-full bg-[var(--user-bg-card)]" />
          </div>
        </main>
      }
    >
      <HomeContent initialBanners={initialBanners} />
    </Suspense>
  );
}

/* Sirf ?tab= yahan handle hota hai (Featured tabs). Purani filter URLs
   (?category= / ?brand= / ...) /filtering-product par redirect hoti hain
   taake shared links toot-ti nahi — selection wahan pre-selected milti hai. */
function HomeParamsSync() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const hasFilterKey = FILTER_KEYS.some((k) => searchParams.has(k));
      if (hasFilterKey) {
        const qs = searchParams.toString();
        router.replace(qs ? `/filtering-product?${qs}` : "/filtering-product");
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  void pathname;
  return null;
}

function HomeContent({ initialBanners = null }) {
  const {
    categories,
    brands,
    deals,
    dealFacet,
    dealsLoading,
    filters,
    clearFilters,
    facets,
    matchCount,
    filtersActive,
    activeFilterCount,
    stockFacet,
    discountFacet,
    isLoading,
  } = useHomeCatalog();

  // Category tiles (rails — count + fromPrice + image, server)
  const { data: categoryTiles = [] } = useQuery({
    queryKey: ["categoryTiles", 100],
    queryFn: () => productApi.getCategoryTiles({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Global total: home par filters hamesha EMPTY hote hain (filter lagte hi
  // /filtering-product navigate hota hai) → facets total HI global total hai.
  // Alag ["shopFacets","global"] request bhejna 62KB + poora facets compute
  // dobara tha (same params, doosri key). matchCount wahi number hai.
  const totalProducts = matchCount;

  // Brand counts map (BrandStrip/Showcase — server facets)
  const brandCounts = useMemo(() => {
    const map = {};
    (facets?.brands || []).forEach((b) => {
      map[String(b._id)] = b.count || 0;
    });
    return map;
  }, [facets]);

  // Offers tab: koi discounted product ho tabhi (server counts)
  const hasOffers = useMemo(
    () => (facets?.discounts || []).some((b) => (b.count || 0) > 0),
    [facets],
  );

  const [filtersOpen, setFiltersOpen] = useState(false);
  const router = useRouter();

  /* Sidebar se har filter change → /filtering-product navigate (selection
     query me — wahan sidebar same value pre-selected dikhata hai). */
  const goFiltering = (patch, extra = {}) => {
    let base = "";
    try {
      base = window.location.search.replace(/^\?/, "");
    } catch {}
    const qs = buildFilteringQuery(base, patch);
    const withExtra = new URLSearchParams(qs);
    Object.entries(extra).forEach(([k, v]) => {
      if (v === null || v === undefined) withExtra.delete(k);
      else withExtra.set(k, String(v));
    });
    const query = withExtra.toString();
    router.push(query ? `/filtering-product?${query}` : "/filtering-product");
  };

  const handleFilterChange = (patch) => {
    const next = { ...filters, ...patch };
    goFiltering(next);
  };

  const handleToggleAllDealsView = (next) => {
    const value = typeof next === "boolean" ? next : true;
    if (value) {
      goFiltering({ ...filters, dealIds: [] }, { allDeals: "1" });
    } else {
      router.push("/filtering-product");
    }
  };

  const handleClearAll = () => {
    clearFilters();
    setFiltersOpen(false);
  };

  const openCategoriesView = () => {
    goFiltering({ ...filters, categoryIds: [] }, { allCategories: "1" });
  };

  void openCategoriesView;

  const sidebarProps = {
    categories,
    brands,
    deals,
    dealFacet,
    dealsLoading,
    filters,
    onChange: handleFilterChange,
    onClear: handleClearAll,
    matchCount,
    filtersActive,
    stockFacet,
    discountFacet,
    facets,
    isLoading,
    showAllDealsView: false,
    onToggleAllDealsView: handleToggleAllDealsView,
  };

  return (
    <main
      style={HOME_THEME}
      className="min-h-screen w-full min-w-0 pb-2 text-[var(--user-text)]"
    >
      <HomeParamsSync />
      {/* HEADER ROW 2 — nav */}
      <HomeNav />

      <div className="w-full min-w-0 max-w-full pl-3 pr-3 pt-4 sm:pl-4 sm:pr-4 lg:pl-2 lg:pr-8 lg:pt-2 xl:pr-10 2xl:pr-12">
        <div className="flex w-full min-w-0 max-w-full items-start gap-4">
          {/* LEFT SIDEBAR — same component, click → /filtering-product */}
          <HomeSidebar
            {...sidebarProps}
            scrollable
            className="sticky top-[6.75rem] hidden w-[280px] shrink-0 rounded-l-none border-l-0 lg:block"
          />

          {/* MAIN COLUMN — sirf showcase (koi filter grid nahi → fast) */}
          <div className="w-full min-w-0 max-w-full flex-1 space-y-8 lg:space-y-12">
            {/* MOBILE FILTER TRIGGER → filtering page */}
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-3.5 py-2 text-[0.75rem] font-bold text-[var(--user-text)]"
              >
                <SlidersHorizontal size={14} className="text-[var(--user-accent)]" />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--user-accent)] px-1 text-[0.625rem] font-black text-[var(--user-accent-text)]">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
              <span className="text-[0.6875rem] font-semibold text-[var(--user-text-subtle)]">
                {`${matchCount} products`}
              </span>
            </div>

            {/* HERO BANNER */}
            <div className="overflow-hidden rounded-2xl border border-[var(--user-border)]">
              <BannerSlider initialBanners={initialBanners} />
            </div>

            {/* CATEGORY TILES */}
            <ViewportSection minHeight={220} className="w-full min-w-0 max-w-full px-4 sm:px-6">
              <HomeCategories tiles={categoryTiles} totalProducts={totalProducts} isLoading={isLoading} />
            </ViewportSection>

            {/* TODAY'S DEALS */}
            <ViewportSection minHeight={420} className="w-full min-w-0 max-w-full px-4 sm:px-6">
              <DealsSection embedded />
            </ViewportSection>

            {/* FEATURED PRODUCTS — server tabs */}
            <ViewportSection minHeight={640}>
              <FeaturedProducts hasOffers={hasOffers} />
            </ViewportSection>

            {/* POPULAR CATEGORIES */}
            <ViewportSection minHeight={260}>
              <PopularCategories tiles={categoryTiles} isLoading={isLoading} />
            </ViewportSection>

            {/* BRANDS */}
            <ViewportSection minHeight={120}>
              <BrandStrip brands={brands} brandCounts={brandCounts} isLoading={isLoading} />
            </ViewportSection>

            {/* BRAND SPOTLIGHT (LAST) */}
            <ViewportSection minHeight={520}>
              <BrandShowcase brands={brands} brandCounts={brandCounts} isLoading={isLoading} />
            </ViewportSection>
          </div>
        </div>
      </div>

      {/* MOBILE FILTER DRAWER — selection yahin se filtering page par */}
      {filtersOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-[21.25rem] overflow-y-auto border-l border-[var(--user-border)] bg-[var(--user-bg-elevated)]">
            <div className="flex items-center justify-between border-b border-[var(--user-border)] px-4 py-3">
              <span className="text-sm font-black uppercase tracking-wider text-[var(--user-text)]">
                Filters
              </span>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--user-text-muted)] hover:bg-[var(--user-bg-hover)]"
              >
                <X size={17} />
              </button>
            </div>
            <SidebarDrawer {...sidebarProps} className="rounded-none border-0 bg-transparent" />
          </div>
        </div>
      ) : null}
    </main>
  );
}
