"use client";

/* ==========================================================
   FILTERING-PRODUCT PAGE (client)
   - Home page ka same sidebar (HomeSidebar — reuse, naya nahi).
   - Results grid wahi FilterResults (wahi ProductCard grid reuse).
   - URL <-> filters two-way sync (?category=&brand=&minPrice=&maxPrice=
     &stock=&discount=&deal=&sort=&page=&allCategories=&allDeals=) —
     refresh / share / back-forward safe.
   - Home se koi bhi filter lagao → router.push yahin hota hai, aur
     sidebar me wahi selection pre-selected milti hai (URL se).
   - THEME home wala hi (accent orange) — look same.
   - PERF: mobile drawer next/dynamic (band ho to zero JS), grid
     FilterResults ke andar deferred + server pagination.
   ========================================================== */

import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/apis/user/productApi";
import { ChevronRight, ListFilter, SlidersHorizontal, X } from "lucide-react";
import HomeNav from "@/components/user/HomeNav";
import HomeSidebar from "@/components/user/HomeSidebar";
import FilterResults from "@/components/user/FilterResults";
import AllDealsResults from "@/components/user/AllDealsResults";
import AllCategoriesResults from "@/components/user/AllCategoriesResults";
import SectionHeading from "@/components/user/SectionHeading";
import { useHomeCatalog } from "@/hooks/useHomeCatalog";

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

const FILTERING_THEME = {
  "--user-accent": "#f97316",
  "--user-accent-hover": "#ea580c",
  "--user-accent-text": "#ffffff",
  "--user-accent-soft": "rgba(249, 115, 22, 0.14)",
};

export default function FilteringProductClient() {
  return (
    <Suspense
      fallback={
        <main
          style={FILTERING_THEME}
          className="min-h-screen w-full min-w-0 pb-2 text-[var(--user-text)]"
        >
          <div className="sticky top-14 z-40 h-11 border-b border-[var(--user-border)] bg-[var(--user-bg-elevated)] lg:top-16 lg:h-12" />
          <div className="w-full max-w-none pl-3 pr-3 pt-4 sm:pl-4 sm:pr-4 lg:pl-0 lg:pr-8 lg:pt-5 xl:pl-0 xl:pr-10 2xl:pl-0 2xl:pr-12">
            <div className="flex w-full items-start gap-4 lg:gap-6 xl:gap-8">
              <div className="hidden w-[16.375rem] shrink-0 lg:block xl:w-[18rem] 2xl:w-[20rem]">
                <div className="space-y-2 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4">
                  {[...Array(8).keys()].map((i) => (
                    <div key={i} className="h-7 animate-pulse rounded-lg bg-[var(--user-bg-hover)]" />
                  ))}
                </div>
              </div>
              <div className="w-full min-w-0 flex-1">
                <div className="mb-3 h-6 w-52 animate-pulse rounded-full bg-[var(--user-bg-card)]" />
                <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                  {[...Array(10).keys()].map((i) => (
                    <div
                      key={i}
                      className="aspect-[3/4] animate-pulse rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      }
    >
      <FilteringContent />
    </Suspense>
  );
}

const VALID_SORTS = ["featured", "newest", "price-asc", "price-desc"];

const sameIdSet = (a = [], b = []) => {
  const left = [...a].map(String).filter(Boolean).sort();
  const right = [...b].map(String).filter(Boolean).sort();
  return JSON.stringify(left) === JSON.stringify(right);
};

/* URL -> filters/sort/views. Page (?page=) FilterResults khud sambhalta hai. */
function FilteringParamsSync({
  filters,
  updateFilter,
  sortBy,
  setSortBy,
  showAllDealsView,
  showAllCategoriesView,
  openDealsView,
  openCategoriesView,
  closeViews,
}) {
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
    if (
      (urlMin !== null || urlMax !== null) &&
      (nextMin !== (filters?.minPrice ?? null) || nextMax !== (filters?.maxPrice ?? null))
    ) {
      patch.minPrice = nextMin;
      patch.maxPrice = nextMax;
    }

    const urlStock = searchParams.getAll("stock").filter(Boolean);
    if (urlStock.length && !sameIdSet(urlStock, filters?.stockStates || [])) {
      patch.stockStates = urlStock;
    }

    const urlDiscounts = searchParams
      .getAll("discount")
      .map(Number)
      .filter((n) => Number.isFinite(n));
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
      closeViews?.();
      updateFilter(patch);
    }

    const sortParam = searchParams.get("sort");
    if (sortParam && VALID_SORTS.includes(sortParam) && sortParam !== sortBy) {
      setSortBy(sortParam);
    }

    if (searchParams.get("allCategories") && !showAllCategoriesView) {
      openCategoriesView?.();
    }
    if (searchParams.get("allDeals") && !showAllDealsView) {
      openDealsView?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return null;
}

function FilteringContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const topResultsRef = useRef(null);

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

  // Category tiles (All Categories cards view — home wali query same, shared key)
  const { data: categoryTiles = [] } = useQuery({
    queryKey: ["categoryTiles", 100],
    queryFn: () => productApi.getCategoryTiles({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [desktopHoverAvailable, setDesktopHoverAvailable] = useState(false);
  const [filtersSidebarExpanded, setFiltersSidebarExpanded] = useState(false);
  const [showAllDealsView, setShowAllDealsView] = useState(false);
  const [showAllCategoriesView, setShowAllCategoriesView] = useState(false);
  const [sortBy, setSortBy] = useState("featured");
  const wasActiveRef = useRef(false);

  useEffect(() => {
    const hoverMedia = window.matchMedia("(hover: hover) and (pointer: fine)");
    const updateHoverAvailability = () => {
      const hoverAvailable = hoverMedia.matches && window.innerWidth >= 1024;
      setDesktopHoverAvailable(hoverAvailable);
      if (!hoverAvailable) setFiltersSidebarExpanded(false);
    };
    updateHoverAvailability();
    hoverMedia.addEventListener("change", updateHoverAvailability);
    window.addEventListener("resize", updateHoverAvailability);
    return () => {
      hoverMedia.removeEventListener("change", updateHoverAvailability);
      window.removeEventListener("resize", updateHoverAvailability);
    };
  }, []);

  /* Har filter/sort change grid ko page 1 par (FilterResults key). */
  const filtersKey = useMemo(
    () => `${JSON.stringify(filters)}|${sortBy}`,
    [filters, sortBy],
  );

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
    const query = sp.toString();
    const current = window.location.search.replace(/^\?/, "");
    if (query !== current) {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  };

  const handleFilterChange = (patch) => {
    const next = { ...filters, ...patch };
    if ("categoryIds" in patch && showAllCategoriesView) {
      setShowAllCategoriesView(false);
      try {
        const sp = new URLSearchParams(window.location.search);
        sp.delete("allCategories");
      } catch {}
    }
    updateFilter(patch);
    writeFiltersToUrl(next);
  };

  const handleFilterChangeInner = (patch) => {
    const next = { ...filters, ...patch };
    updateFilter(patch);
    writeFiltersToUrl(next);
  };

  const handleToggleAllDealsView = (next) => {
    const value = typeof next === "boolean" ? next : !showAllDealsView;
    setShowAllDealsView(value);
    const sp = new URLSearchParams(window.location.search);
    if (value) {
      setShowAllCategoriesView(false);
      sp.delete("allCategories");
      if (!sp.get("allDeals")) sp.set("allDeals", "1");
      handleFilterChangeInner({ dealIds: [] });
    } else {
      sp.delete("allDeals");
    }
    const query = sp.toString();
    const current = window.location.search.replace(/^\?/, "");
    if (query !== current) {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  };

  const handleClearAll = () => {
    clearFilters();
    setShowAllDealsView(false);
    setShowAllCategoriesView(false);
    setSortBy("featured");
    router.replace(pathname, { scroll: false });
  };

  const openCategoriesView = () => {
    setShowAllDealsView(false);
    setShowAllCategoriesView(true);
    updateFilter({ categoryIds: [] });
    const sp = new URLSearchParams(window.location.search);
    sp.delete("category");
    sp.delete("allDeals");
    if (!sp.get("allCategories")) sp.set("allCategories", "1");
    const query = sp.toString();
    const current = window.location.search.replace(/^\?/, "");
    if (query !== current) {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  };

  const openDealsView = () => {
    setShowAllCategoriesView(false);
    setShowAllDealsView(true);
    updateFilter({ dealIds: [] });
    const sp = new URLSearchParams(window.location.search);
    sp.delete("deal");
    sp.delete("allCategories");
    if (!sp.get("allDeals")) sp.set("allDeals", "1");
    const query = sp.toString();
    const current = window.location.search.replace(/^\?/, "");
    if (query !== current) {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  };

  const closeViews = () => {
    setShowAllDealsView(false);
    setShowAllCategoriesView(false);
  };

  const changeSort = (next) => {
    setSortBy(next);
    const sp = new URLSearchParams(window.location.search);
    if (!next || next === "featured") sp.delete("sort");
    else sp.set("sort", next);
    sp.delete("page");
    const query = sp.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

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

  const handleSelectDealCard = (deal) => {
    const id = String(deal?._id || deal?.id || "");
    if (!id) return;
    setShowAllDealsView(false);
    const sp = new URLSearchParams(window.location.search);
    sp.delete("allDeals");
    handleFilterChangeInner({ dealIds: [id] });
    const query = new URLSearchParams(window.location.search);
    query.delete("allDeals");
    query.delete("deal");
    query.append("deal", id);
    const qs = query.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    requestAnimationFrame(() => {
      topResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    const isActive =
      activeFilterCount > 0 || showAllDealsView || showAllCategoriesView;
    if (isActive && !wasActiveRef.current && !filtersOpen) {
      topResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    wasActiveRef.current = isActive;
  }, [activeFilterCount, showAllDealsView, showAllCategoriesView, filtersOpen]);

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

  const selectedDealNames = useMemo(() => {
    const ids = new Set((filters?.dealIds || []).map((id) => String(id)));
    if (!ids.size) return [];
    return (dealFacet.length ? dealFacet : deals)
      .filter((deal) => ids.has(String(deal?._id)))
      .map((deal) => deal?.name)
      .filter(Boolean);
  }, [filters, deals, dealFacet]);

  const resultsTitle =
    selectedDealNames.length === 1
      ? `${selectedDealNames[0]} — Products`
      : selectedDealNames.length > 1
        ? `Deals Products (${selectedDealNames.length} deals)`
        : filtersActive
          ? "Filter Results"
          : "All Products";

  const showingViews = showAllCategoriesView || showAllDealsView;

  void searchParams;

  return (
    <main
      style={FILTERING_THEME}
      className="min-h-screen w-full min-w-0 pb-2 text-[var(--user-text)]"
    >
      <FilteringParamsSync
        filters={filters}
        updateFilter={updateFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        showAllDealsView={showAllDealsView}
        showAllCategoriesView={showAllCategoriesView}
        openDealsView={openDealsView}
        openCategoriesView={openCategoriesView}
        closeViews={closeViews}
      />
      <HomeNav />

      <div className="w-full max-w-none pl-3 pr-3 pt-4 sm:pl-4 sm:pr-4 lg:pl-0 lg:pr-8 lg:pt-5 xl:pl-0 xl:pr-10 2xl:pl-0 2xl:pr-12">
        {/* BREADCRUMB */}
        <nav
          aria-label="Breadcrumb"
          className="mb-3 flex items-center gap-1.5 text-[0.6875rem] text-[var(--user-text-muted)] lg:mb-4 lg:text-xs"
        >
          <Link href="/" className="transition hover:text-[var(--user-accent)]">
            Home
          </Link>
          <ChevronRight size={12} className="text-[var(--user-text-subtle)]" />
          <span className="font-semibold text-[var(--user-text-secondary)]">
            Filtered Products
          </span>
        </nav>

        <SectionHeading
          title="Filtered Products"
          subtitle={
            showingViews
              ? showAllCategoriesView
                ? `${categories.length} categories`
                : `${deals.length} deals`
              : `${matchCount} ${matchCount === 1 ? "product" : "products"}`
          }
          icon={ListFilter}
        >
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-[var(--user-text-muted)]" />
            <select
              value={sortBy}
              onChange={(e) => changeSort(e.target.value)}
              aria-label="Sort products"
              className="h-9 cursor-pointer rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)] px-3 text-[0.6875rem] font-bold text-[var(--user-text-secondary)] outline-none transition hover:border-[var(--user-accent)]/50 focus:border-[var(--user-accent)] lg:text-xs"
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest Arrivals</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </span>
        </SectionHeading>

        <div className="flex w-full items-start gap-4 lg:gap-6 xl:gap-8">
          {/* LEFT SIDEBAR — home wala same component */}
          <div
            className={`filters-sidebar-hover sticky top-[7.25rem] hidden min-w-0 shrink-0 self-start overflow-hidden ${
              desktopHoverAvailable ? "lg:block" : ""
            }`}
            style={{
              minWidth: 0,
              width: filtersSidebarExpanded ? "clamp(14rem, 17vw, 16rem)" : "3rem",
              transition: "width 220ms ease-out",
            }}
            onPointerEnter={(event) => {
              if (
                event.pointerType === "mouse" &&
                window.matchMedia("(hover: hover) and (pointer: fine)").matches
              ) {
                setFiltersSidebarExpanded(true);
              }
            }}
            onPointerLeave={(event) => {
              if (
                event.pointerType === "mouse" &&
                window.matchMedia("(hover: hover) and (pointer: fine)").matches
              ) {
                setFiltersSidebarExpanded(false);
              }
            }}
          >
            <HomeSidebar
              {...sidebarProps}
              scrollable
              collapsed={!filtersSidebarExpanded}
              className="w-full rounded-l-none border-l-0"
            />
          </div>

          {/* MAIN COLUMN */}
          <div className="w-full min-w-0 flex-1">
            {/* MOBILE FILTER TRIGGER */}
            <div
              className={`mb-4 flex items-center justify-between gap-3 ${
                desktopHoverAvailable ? "lg:hidden" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-3.5 py-2 text-[0.75rem] font-bold text-[var(--user-text)]"
              >
                <SlidersHorizontal size={14} className="text-[var(--user-accent)]" />
                Filters
                {activeFilterCount > 0 || showingViews ? (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--user-accent)] px-1 text-[0.625rem] font-black text-[var(--user-accent-text)]">
                    {showingViews && activeFilterCount === 0 ? 1 : activeFilterCount}
                  </span>
                ) : null}
              </button>
              <span className="text-[0.6875rem] font-semibold text-[var(--user-text-subtle)]">
                {showingViews
                  ? showAllCategoriesView
                    ? `${categories.length} categories`
                    : `${deals.length} deals`
                  : `${matchCount} products`}
              </span>
            </div>

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

            {!showingViews ? (
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
                  titleOverride={resultsTitle}
                  cleanMode={!filtersActive}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* MOBILE FILTER DRAWER — next/dynamic, sirf kholne par load */}
      {filtersOpen ? (
        <div className={`fixed inset-0 z-[70] ${desktopHoverAvailable ? "lg:hidden" : ""}`}>
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
