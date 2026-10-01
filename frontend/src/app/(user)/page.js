"use client";

/* ==========================================================
   USER HOME PAGE

   Layout:
     Header (row 1)
     → Home Nav (row 2: All Categories | Home | Deals | Best Selling |
       New Arrivals | 3 parent categories | More)
     → Left sticky sidebar (Category / Price / Brand / Deals / Availability / Discount)
     → Main column:
         1. Filter Results (TOP — sirf jab koi filter active ho: filtered
            products, removable chips, 20 per page pagination)
         2. Hero banner → Category tiles → Today's Deals →
            Featured products (hamesha FULL catalog — filter se untouched) →
            Popular categories → Brand strip → Brand Spotlight (last)
     → Trust bar

   Filter lagane par neeche jump NAHI hota — results top par khulte hain
   aur neeche poora home page waisa hi rehta hai jaisa tha.

   Sab content REAL API data se aata hai (products, categories, brands,
   banners, deals, discounts, shipping config).

   THEME: home page ka accent orange hai — sirf is page par lagta hai
   (inline CSS variable; user.css ko chhua nahi gaya). Ek line badal kar
   revert ho sakta hai → HOME_THEME.
   ========================================================== */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/apis/user/productApi";
import { SlidersHorizontal, X } from "lucide-react";
import HomeNav from "@/components/user/HomeNav";
import HomeSidebar from "@/components/user/HomeSidebar";
import BannerSlider from "@/components/user/BannerSlider";
import HomeCategories from "@/components/user/HomeCategories";
import DealsSection from "@/components/user/DealsSection";
import FeaturedProducts from "@/components/user/FeaturedProducts";
import FilterResults from "@/components/user/FilterResults";
import AllDealsResults from "@/components/user/AllDealsResults";
import AllCategoriesResults from "@/components/user/AllCategoriesResults";
import BrandShowcase from "@/components/user/BrandShowcase";
import PopularCategories from "@/components/user/PopularCategories";
import BrandStrip from "@/components/user/BrandStrip";
import { useHomeCatalog } from "@/hooks/useHomeCatalog";

const HOME_THEME = {
  "--user-accent": "#f97316",
  "--user-accent-hover": "#ea580c",
  "--user-accent-text": "#ffffff",
  "--user-accent-soft": "rgba(249, 115, 22, 0.14)",
};

export default function Home() {
  return (
    <Suspense
      fallback={
        <main
          style={HOME_THEME}
          className="min-h-screen w-full min-w-0 pb-2 text-[var(--user-text)]"
        >
          {/* Static nav placeholder — HomeNav yahan nahi (useSearchParams
              Suspense mangta hai, fallback me crash karta hai) */}
          <div className="sticky top-14 z-40 h-11 border-b border-[var(--user-border)] bg-[var(--user-bg-elevated)] lg:top-16 lg:h-12" />
          <div className="w-full max-w-none pl-3 pr-3 pt-4 sm:pl-4 sm:pr-4 lg:pl-0 lg:pr-8 lg:pt-5 xl:pl-0 xl:pr-10 2xl:pl-0 2xl:pr-12">
            <div className="h-7 w-48 animate-pulse rounded-full bg-[var(--user-bg-card)]" />
          </div>
        </main>
      }
    >
      <HomeContent />
    </Suspense>
  );
}

const VALID_SORTS = ["featured", "newest", "price-asc", "price-desc"];

const sameIdSet = (a = [], b = []) => {
  const left = [...a].map(String).filter(Boolean).sort();
  const right = [...b].map(String).filter(Boolean).sort();
  return JSON.stringify(left) === JSON.stringify(right);
};

/* URL <-> filters two-way sync — product listing page delete ho gayi hai,
   ab sab kuch home par top FilterResults me hota hai:
   - Tile/nav click → /?category=X → yahin top par filtering (URL → filter).
   - Sidebar se kuch bhi filter karo → wo query URL me ajati hai
     (filter → URL), taake link share / refresh par wahi filtering rahe. */
function HomeParamsSync({ filters, updateFilter, sortBy, setSortBy, closeDealsView, showAllCategoriesView, openCategoriesView }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const patch = {};

    const urlCats = searchParams.getAll("category").filter(Boolean);
    if (urlCats.length && !sameIdSet(urlCats, filters?.categoryIds || [])) {
      patch.categoryIds = urlCats;
    }

    const urlBrands = searchParams.getAll("brand").filter(Boolean);
    if (urlBrands.length && !sameIdSet(urlBrands, filters?.brandIds || [])) {
      patch.brandIds = urlBrands;
    }

    const urlMin = searchParams.get("minPrice");
    const urlMax = searchParams.get("maxPrice");
    const numOrNull = (raw) => {
      if (raw === null || raw === "") return null;
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    };
    const nextMin = numOrNull(urlMin);
    const nextMax = numOrNull(urlMax);
    if ((urlMin !== null || urlMax !== null) && (nextMin !== (filters?.minPrice ?? null) || nextMax !== (filters?.maxPrice ?? null))) {
      patch.minPrice = nextMin;
      patch.maxPrice = nextMax;
    }

    const urlStock = searchParams.getAll("stock").filter(Boolean);
    if (urlStock.length && !sameIdSet(urlStock, filters?.stockStates || [])) {
      patch.stockStates = urlStock;
    }

    const urlDiscounts = searchParams.getAll("discount").map(Number).filter((n) => Number.isFinite(n));
    const activeBands = [
      ...(filters?.discountBands || []),
      ...(filters?.discountBand ?? null) !== null ? [filters.discountBand] : [],
    ];
    if (urlDiscounts.length && !sameIdSet(urlDiscounts, activeBands)) {
      patch.discountBands = urlDiscounts;
      patch.discountBand = urlDiscounts[0] ?? null;
    }

    const urlDeals = searchParams.getAll("deal").filter(Boolean);
    if (urlDeals.length && !sameIdSet(urlDeals, filters?.dealIds || [])) {
      patch.dealIds = urlDeals;
    }

    if (Object.keys(patch).length) {
      closeDealsView?.();
      updateFilter(patch);
    }

    const sortParam = searchParams.get("sort");
    if (sortParam && VALID_SORTS.includes(sortParam) && sortParam !== sortBy) {
      setSortBy(sortParam);
    }

    // Nav "More → All Categories": saari categories cards me (Popular
    // Categories wala design), click par wahin filtering.
    if (searchParams.get("allCategories") && !showAllCategoriesView) {
      openCategoriesView?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}

function HomeContent() {
  const {
    categories,
    brands,
    deals,
    dealFacet,
    dealsLoading,
    filters,
    updateFilter,
    clearFilters,
    facets,
    matchCount,
    filtersActive,
    activeFilterCount,
    stockFacet,
    discountFacet,
    isLoading,
  } = useHomeCatalog();

  // ✅ Category tiles (Popular/Home/All-cats rails — count + fromPrice + image, server)
  const { data: categoryTiles = [] } = useQuery({
    queryKey: ["categoryTiles", 100],
    queryFn: () => productApi.getCategoryTiles({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Global total (HomeCategories subtitle — filters se unaffected, HomeNav key shared)
  const { data: globalFacets = null } = useQuery({
    queryKey: ["shopFacets", "global"],
    queryFn: () => productApi.getFacets({}),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const totalProducts = globalFacets?.total ?? matchCount;

  // ✅ Brand counts map (BrandStrip/Showcase — server facets)
  const brandCounts = useMemo(() => {
    const map = {};
    (facets?.brands || []).forEach((b) => {
      map[String(b._id)] = b.count || 0;
    });
    return map;
  }, [facets]);

  // ✅ Offers tab: koi discounted product ho tabhi (server counts)
  const hasOffers = useMemo(
    () => (facets?.discounts || []).some((b) => (b.count || 0) > 0),
    [facets],
  );

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllDealsView, setShowAllDealsView] = useState(false);
  const [showAllCategoriesView, setShowAllCategoriesView] = useState(false);
  const [sortBy, setSortBy] = useState("featured");
  const topResultsRef = useRef(null);
  const wasActiveRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  /* Sidebar / chips se har filter change URL me bhi likha jata hai —
     jis tara tile click par ?category= ata hai, usi tara sidebar se
     select par bhi query ban jati hai (share / refresh safe). */
  const writeFiltersToUrl = (next) => {
    const sp = new URLSearchParams(window.location.search);
    const setAll = (key, values) => {
      sp.delete(key);
      (values || []).map(String).filter(Boolean).forEach((value) => sp.append(key, value));
    };
    setAll("category", next.categoryIds || []);
    setAll("brand", next.brandIds || []);
    if ((next.minPrice ?? null) !== null) sp.set("minPrice", String(next.minPrice));
    else sp.delete("minPrice");
    if ((next.maxPrice ?? null) !== null) sp.set("maxPrice", String(next.maxPrice));
    else sp.delete("maxPrice");
    setAll("stock", next.stockStates || []);
    const bands = [
      ...(next.discountBands || []),
      ...(next.discountBand ?? null) !== null ? [next.discountBand] : [],
    ];
    setAll("discount", [...new Set(bands)]);
    setAll("deal", next.dealIds || []);
    // ?sort= ko chheda nahi (wo nav links se ata hai, clear par hat ta hai)
    const query = sp.toString();
    const current = window.location.search.replace(/^\?/, "");
    if (query !== current) {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  };

  /* Sidebar / chips se har filter change URL ke sath sync rehta hai.
     Category filter badle to All Categories cards view band (taake mix na ho). */
  const handleFilterChange = (patch) => {
    const next = { ...filters, ...patch };
    if ("categoryIds" in patch && showAllCategoriesView) {
      setShowAllCategoriesView(false);
    }
    updateFilter(patch);
    writeFiltersToUrl(next);
  };

  /* All Deals cards view on: koi deal select nahi hoti, sirf deal cards
     show hote hain — isliye dealIds clear kar do taake mix na ho. */
  const handleToggleAllDealsView = (next) => {
    const value = typeof next === "boolean" ? next : !showAllDealsView;
    setShowAllDealsView(value);
    if (value) {
      setShowAllCategoriesView(false);
      handleFilterChange({ dealIds: [] });
      // allCategories param bhi hata do warna ParamSync dobara cards view khol dega
      const sp = new URLSearchParams(window.location.search);
      if (sp.has("allCategories")) {
        sp.delete("allCategories");
        const query = sp.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }
    }
  };

  const handleClearAll = () => {
    clearFilters();
    setShowAllDealsView(false);
    setShowAllCategoriesView(false);
    setSortBy("featured");
    // Saare params (?category= / ?brand= / ?sort= / ?allCategories=) URL se bhi saaf
    router.replace(pathname, { scroll: false });
  };

  /* Nav "More → All Categories": saari categories cards me (koi category
     select nahi hoti), deals view band taake mix na ho. */
  const openCategoriesView = () => {
    setShowAllDealsView(false);
    setShowAllCategoriesView(true);
    updateFilter({ categoryIds: [] });
    const sp = new URLSearchParams(window.location.search);
    sp.delete("category");
    if (!sp.get("allCategories")) sp.set("allCategories", "1");
    const query = sp.toString();
    const current = window.location.search.replace(/^\?/, "");
    if (query !== current) {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  };

  /* Category card par click: wahin us category ke products filter ho kar
     top panel me show hote hain (cards view band + allCategories URL se saaf). */
  const handleSelectCategoryCard = (category) => {
    const id = String(category?._id || category?.id || "");
    if (!id) return;
    setShowAllCategoriesView(false);
    updateFilter({ categoryIds: [id] });
    const sp = new URLSearchParams(window.location.search);
    sp.delete("allCategories");
    sp.delete("category");
    sp.append("category", id);
    const query = sp.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    requestAnimationFrame(() => {
      topResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  /* Deal card par click: detail page NAHI khulta — wahin us deal ke
     products filter ho kar top panel me show hote hain. */
  const handleSelectDealCard = (deal) => {
    const id = String(deal?._id || deal?.id || "");
    if (!id) return;
    setShowAllDealsView(false);
    handleFilterChange({ dealIds: [id] });
    requestAnimationFrame(() => {
      topResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  /* Filter lagte hi results TOP panel me khulte hain — neeche koi jump
     nahi hota. Sirf us waqt halka scroll jab filters inactive → active
     hon (pehla filter) ya All Deals / All Categories view khule, taake
     top panel nazar aaye. Uske baad filter badalne par koi scroll nahi.
     Mobile drawer khula ho to scroll drawer band hone tak defer hota hai. */
  useEffect(() => {
    const isActive = activeFilterCount > 0 || showAllDealsView || showAllCategoriesView;
    if (isActive && !wasActiveRef.current && !filtersOpen) {
      topResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    wasActiveRef.current = isActive;
  }, [activeFilterCount, showAllDealsView, showAllCategoriesView, filtersOpen]);

  /* Any filter/sort change resets the top results grid back to page 1. */
  const filtersKey = useMemo(() => `${JSON.stringify(filters)}|${sortBy}`, [filters, sortBy]);

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
    showAllDealsView,
    onToggleAllDealsView: handleToggleAllDealsView,
  };

  /* Sidebar me koi deal select ho to top results panel ki heading me us
     deal ka naam dikhao (single select = deal ka naam, multi = count). */
  const selectedDealNames = useMemo(() => {
    const ids = new Set((filters?.dealIds || []).map((id) => String(id)));
    if (!ids.size) return [];
    return (dealFacet.length ? dealFacet : deals)
      .filter((deal) => ids.has(String(deal?._id)))
      .map((deal) => deal?.name)
      .filter(Boolean);
  }, [filters, deals, dealFacet]);

  const resultsTitleOverride =
    selectedDealNames.length === 1
      ? `${selectedDealNames[0]} — Products`
      : selectedDealNames.length > 1
        ? `Deals Products (${selectedDealNames.length} deals)`
        : null;

  return (
    <main
      style={HOME_THEME}
      className="min-h-screen w-full min-w-0 pb-2 text-[var(--user-text)]"
    >
      <HomeParamsSync
        filters={filters}
        updateFilter={updateFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        closeDealsView={() => setShowAllDealsView(false)}
        showAllCategoriesView={showAllCategoriesView}
        openCategoriesView={openCategoriesView}
      />
      {/* HEADER ROW 2 — nav */}
      <HomeNav />

      <div className="w-full max-w-none pl-3 pr-3 pt-4 sm:pl-4 sm:pr-4 lg:pl-0 lg:pr-8 lg:pt-5 xl:pl-0 xl:pr-10 2xl:pl-0 2xl:pr-12">
        <div className="flex w-full items-start gap-4 lg:gap-6 xl:gap-8">
          {/* LEFT SIDEBAR — left edge ke sath attached (koi left margin nahi) */}
          <HomeSidebar
            {...sidebarProps}
            scrollable
            className="sticky top-[7.25rem] hidden w-[16.375rem] shrink-0 rounded-l-none border-l-0 lg:block xl:w-[18rem] 2xl:w-[20rem]"
          />

          {/* MAIN COLUMN */}
          <div className="w-full min-w-0 flex-1 space-y-6 lg:space-y-8">
            {/* MOBILE FILTER TRIGGER */}
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-3.5 py-2 text-[0.75rem] font-bold text-[var(--user-text)]"
              >
                <SlidersHorizontal size={14} className="text-[var(--user-accent)]" />
                Filters
                {activeFilterCount > 0 || showAllDealsView || showAllCategoriesView ? (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--user-accent)] px-1 text-[0.625rem] font-black text-[var(--user-accent-text)]">
                    {(showAllDealsView || showAllCategoriesView) && activeFilterCount === 0 ? 1 : activeFilterCount}
                  </span>
                ) : null}
              </button>
              <span className="text-[0.6875rem] font-semibold text-[var(--user-text-subtle)]">
                {showAllCategoriesView
                  ? `${categories.length} categories`
                  : showAllDealsView
                    ? `${deals.length} deals`
                    : `${matchCount} products`}
              </span>
            </div>

            {/* ALL CATEGORIES CARDS (TOP) — nav More → All Categories par
                category cards yahin top par (12 per page + next/prev).
                Card click par wahin us category ki filtering. */}
            {showAllCategoriesView ? (
              <div ref={topResultsRef} className="scroll-mt-[7.5rem] lg:scroll-mt-[8.5rem]">
                <AllCategoriesResults
                  key={`all-cats-${categories.length}`}
                  tiles={categoryTiles}
                  isLoading={isLoading}
                  onClear={handleClearAll}
                  onSelectCategory={handleSelectCategoryCard}
                />
              </div>
            ) : null}

            {/* ALL DEALS CARDS (TOP) — sidebar me All Deals click par deal
                cards yahin top par (10 per page + next/prev). Koi deal
                select nahi hoti. */}
            {showAllDealsView && !showAllCategoriesView ? (
              <div ref={topResultsRef} className="scroll-mt-[7.5rem] lg:scroll-mt-[8.5rem]">
                <AllDealsResults
                  key={`all-deals-${deals.length}`}
                  deals={deals}
                  isLoading={dealsLoading}
                  onClear={handleClearAll}
                  onSelectDeal={handleSelectDealCard}
                />
              </div>
            ) : null}

            {/* FILTER RESULTS (TOP) — sirf jab koi sidebar filter active ho.
                Filtered products yahin top par (20 per page + next/prev),
                iske neeche poora home page normal rehta hai. */}
            {filtersActive && !showAllDealsView && !showAllCategoriesView ? (
              <div ref={topResultsRef} className="scroll-mt-[7.5rem] lg:scroll-mt-[8.5rem]">
                <FilterResults
                  key={filtersKey}
                  filters={filters}
                  sortBy={sortBy}
                  categories={categories}
                  brands={brands}
                  deals={dealFacet.length ? dealFacet : deals}
                  onChange={handleFilterChange}
                  onClear={handleClearAll}
                  titleOverride={resultsTitleOverride}
                />
              </div>
            ) : null}

            {/* HERO BANNER */}
            <div className="overflow-hidden rounded-2xl border border-[var(--user-border)]">
              <BannerSlider />
            </div>

            {/* CATEGORY TILES */}
            <HomeCategories tiles={categoryTiles} totalProducts={totalProducts} isLoading={isLoading} />

            {/* TODAY'S DEALS */}
            <DealsSection embedded />

            {/* FEATURED PRODUCTS — server tabs (filter se untouched) */}
            <FeaturedProducts hasOffers={hasOffers} />

            {/* POPULAR CATEGORIES */}
            <PopularCategories tiles={categoryTiles} isLoading={isLoading} />

            {/* BRANDS */}
            <BrandStrip brands={brands} brandCounts={brandCounts} isLoading={isLoading} />

            {/* BRAND SPOTLIGHT (LAST) — top brands ki 2-column sliding rows,
                arrows ek-ek product slide karte hain */}
            <BrandShowcase brands={brands} brandCounts={brandCounts} isLoading={isLoading} />
          </div>
        </div>
      </div>

      {/* MOBILE FILTER DRAWER */}
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
            <HomeSidebar {...sidebarProps} className="rounded-none border-0 bg-transparent" />
          </div>
        </div>
      ) : null}
    </main>
  );
}
