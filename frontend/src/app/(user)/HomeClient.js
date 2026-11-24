
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
import { useHomeCatalog } from "../../hooks/user/useHomeCatalog";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useStoreTheme } from "@/storefront/ThemeProvider";
import EditableSection from "@/storefront/EditableSection";
import { hasCustomAccent, revealEnabled } from "@/storefront/themeCss";
import { DEFAULT_SECTION_ORDER } from "@/storefront/themeDefaults";
import { GENERIC_SECTIONS } from "@/storefront/sections/registry";
import { SectionStyle, heroSlidesFromBlocks } from "@/storefront/sections/SectionStyle";

/* Below-fold sections — code-split (initial JS chhota → LCP/INP fast).
   ssr:true taake SEO same rahe, lekin alag chunk me load hon. */
const HomeCategories = dynamic(() => import("@/components/user/HomeCategories"), {
  ssr: true,
  loading: () => <div className="h-[10rem] animate-pulse rounded-2xl bg-user-card" />,
});
const DealsSection = dynamic(() => import("@/components/user/DealsSection"), {
  ssr: true,
  loading: () => <div className="h-[22rem] animate-pulse rounded-2xl bg-user-card" />,
});
const FeaturedProducts = dynamic(() => import("@/components/user/FeaturedProducts"), {
  ssr: true,
  loading: () => <div className="h-[30rem] animate-pulse rounded-2xl bg-user-card" />,
});
const PopularCategories = dynamic(() => import("@/components/user/PopularCategories"), {
  ssr: true,
  loading: () => <div className="h-[12rem] animate-pulse rounded-2xl bg-user-card" />,
});
const BrandStrip = dynamic(() => import("@/components/user/BrandStrip"), {
  ssr: true,
  loading: () => <div className="h-[7rem] animate-pulse rounded-2xl bg-user-card" />,
});
const BrandShowcase = dynamic(() => import("@/components/user/BrandShowcase"), {
  ssr: true,
  loading: () => <div className="h-[26rem] animate-pulse rounded-2xl bg-user-card" />,
});
/* Mobile drawer: band ho to zero JS — sirf kholne par load. */
const SidebarDrawer = dynamic(() => import("@/components/user/HomeSidebar"), {
  ssr: false,
  loading: () => (
    <div className="space-y-2 p-4">
      {[...Array(6).keys()].map((i) => (
        <div key={i} className="h-7 animate-pulse rounded-lg bg-user-hover" />
      ))}
    </div>
  ),
});

// Purana home-only orange accent. Store editor me seller apna accent set kare
// to ye skip hota hai (theme CSS vars #user-theme se aate hain).
const HOME_THEME = {
  "--user-accent": "#f97316",
  "--user-accent-hover": "#ea580c",
  "--user-accent-text": "#ffffff",
  "--user-accent-soft": "rgba(249, 115, 22, 0.14)",
};

function useHomeStyle() {
  const { theme } = useStoreTheme();
  return hasCustomAccent(theme) ? undefined : HOME_THEME;
}

/* Store editor preview wrapper (outline + hover toolbar) → storefront/EditableSection.js */

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
  const homeStyle = useHomeStyle();
  return (
    <Suspense
      fallback={
        <main
          style={homeStyle}
          className="min-h-screen w-full min-w-0 pb-2 text-user-fg"
        >
          <div className="sticky top-14 z-40 h-11 border-b border-user-line bg-user-elevated lg:top-16 lg:h-12" />
          <div className="w-full max-w-none pl-3 pr-3 pt-4 sm:pl-4 sm:pr-4 lg:pl-0 lg:pr-8 lg:pt-5 xl:pl-0 xl:pr-10 2xl:pl-0 2xl:pr-12">
            <div className="h-7 w-48 animate-pulse rounded-full bg-user-card" />
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
  const { dir } = useTranslation();
  const homeStyle = useHomeStyle();
  const { theme, isPreview, selectedSectionId } = useStoreTheme();
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
    facetsLoading,
  } = useHomeCatalog();

  // Category tiles (rails — count + fromPrice + image, server)
  const { data: categoryTiles = [], isPending: categoryTilesPending } = useQuery({
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

  // Store khali hai (product/category/brand/deal/category-tile kuch nahi) →
  // All Products section sab se upar aur baaki empty sections chhupa do.
  const isEmptyStorefront =
    !isLoading &&
    !facetsLoading &&
    !dealsLoading &&
    !categoryTilesPending &&
    totalProducts === 0 &&
    categories.length === 0 &&
    brands.length === 0 &&
    deals.length === 0 &&
    categoryTiles.length === 0;

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

  /* ── Store editor sections (theme order) ──
     Default theme = purana order bilkul same. Disabled / unknown types skip. */
  const sectionEntries = (Array.isArray(theme?.order) ? theme.order : DEFAULT_SECTION_ORDER)
    .map((id) => [id, theme?.sections?.[id] || (theme ? null : { type: id, settings: {} })])
    .filter(([, section]) => section && !section.disabled);

  const renderBuiltin = (type, settings = {}, blocks = []) => {
    const heading = settings.heading || "";
    switch (type) {
      case "hero_banners": {
        // source "custom" → editor ke slides; warna Admin → Banners (purana)
        const custom = settings.source === "custom" ? heroSlidesFromBlocks(blocks) : null;
        if (custom && !custom.length) {
          // Editor preview me placeholder (click karke select ho sake); live par kuch nahi
          return isPreview ? (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-user-line text-sm text-user-fg-muted">
              Add slides in the store editor
            </div>
          ) : null;
        }
        return (
          <div className="overflow-hidden rounded-2xl border border-user-line">
            <BannerSlider
              initialBanners={initialBanners}
              customSlides={custom}
              autoplay={settings.autoplay !== false}
              intervalMs={(Number(settings.interval) || 5) * 1000}
              height={settings.height || "default"}
            />
          </div>
        );
      }
      case "category_tiles":
        return (
          <ViewportSection minHeight={220} className="w-full min-w-0 max-w-full">
            <HomeCategories tiles={categoryTiles} totalProducts={totalProducts} isLoading={isLoading} heading={heading} />
          </ViewportSection>
        );
      case "deals":
        return (
          <ViewportSection minHeight={420} className="w-full min-w-0 max-w-full">
            <DealsSection embedded heading={heading} />
          </ViewportSection>
        );
      case "featured_products":
        return (
          <ViewportSection minHeight={640}>
            <FeaturedProducts hasOffers={hasOffers} titleOverride={heading || null} />
          </ViewportSection>
        );
      case "popular_categories":
        return (
          <ViewportSection minHeight={260}>
            <PopularCategories tiles={categoryTiles} isLoading={isLoading} heading={heading} />
          </ViewportSection>
        );
      case "brand_strip":
        return (
          <ViewportSection minHeight={120}>
            <BrandStrip brands={brands} brandCounts={brandCounts} isLoading={isLoading} />
          </ViewportSection>
        );
      case "brand_showcase":
        return (
          <ViewportSection minHeight={520}>
            <BrandShowcase brands={brands} brandCounts={brandCounts} isLoading={isLoading} heading={heading} />
          </ViewportSection>
        );
      default:
        return undefined;
    }
  };

  const reveal = revealEnabled(theme);
  const renderSection = (id, section, index) => {
    const builtin = renderBuiltin(section.type, section.settings, section.blocks);
    let node = builtin;
    if (builtin === undefined) {
      const generic = GENERIC_SECTIONS[section.type];
      if (!generic) return null; // unknown type (naya backend, purana frontend)
      const { Component, minHeight, eager } = generic;
      const inner = <Component settings={section.settings || {}} blocks={section.blocks || []} />;
      // Pehla section lazy nahi (LCP); baaki viewport par mount
      node = eager || index === 0 ? inner : <ViewportSection minHeight={minHeight}>{inner}</ViewportSection>;
    }
    if (!node) return null;
    return (
      <EditableSection
        key={id}
        id={id}
        isPreview={isPreview}
        selected={selectedSectionId === id}
        isFirst={index === 0}
        isLast={index === sectionEntries.length - 1}
      >
        {/* Scroll animation (theme "animations") — pehla section kabhi nahi (LCP) */}
        {reveal && index > 0 ? (
          <div data-theme-section="">
            <SectionStyle style={section.style}>{node}</SectionStyle>
          </div>
        ) : (
          <SectionStyle style={section.style}>{node}</SectionStyle>
        )}
      </EditableSection>
    );
  };

  return (
    <main
      style={homeStyle}
      className="min-h-screen w-full min-w-0 pb-2 text-user-fg"
    >
      <HomeParamsSync />
      {/* HEADER ROW 2 — nav */}
      <HomeNav />

      <div className={`w-full min-w-0 max-w-full pl-3 pr-3 pt-4 sm:pl-4 sm:pr-4 lg:pt-2 ${dir === "rtl" ? "lg:pr-2 lg:pl-8 xl:pl-10 2xl:pl-12" : "lg:pl-2 lg:pr-8 xl:pr-10 2xl:pr-12"}`}>
        <div dir={dir} className="flex w-full min-w-0 max-w-full items-start gap-4">
          {/* LEFT SIDEBAR — same component, click → /filtering-product */}
          <HomeSidebar
            {...sidebarProps}
            scrollable
            dir={dir}
            className={`sticky top-[6.75rem] hidden w-[280px] shrink-0 lg:block ${dir === "rtl" ? "rounded-r-none border-r-0" : "rounded-l-none border-l-0"}`}
          />

          {/* MAIN COLUMN — sirf showcase (koi filter grid nahi → fast) */}
          <div dir={dir} className="w-full min-w-0 max-w-full flex-1 space-y-8 lg:space-y-12">
            {/* MOBILE FILTER TRIGGER → filtering page */}
            <div className="flex items-center justify-between gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-user-line bg-user-card px-3.5 py-2 text-[0.75rem] font-bold text-user-fg"
              >
                <SlidersHorizontal size={14} className="text-user-accent" />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-user-accent px-1 text-[0.625rem] font-black text-user-accent-fg">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
              <span className="text-[0.6875rem] font-semibold text-user-fg-subtle">
                {`${matchCount} products`}
              </span>
            </div>

            {isEmptyStorefront ? (
              /* Khal store — All Products sab se upar, baaki sections chhupe */
              <FeaturedProducts hasOffers={hasOffers} />
            ) : (
              /* Store editor theme ka section order (default = purana:
                 Hero → Category tiles → Deals → Featured → Popular categories
                 → Brand strip → Brand spotlight) */
              <>{sectionEntries.map(([id, section], index) => renderSection(id, section, index))}</>
            )}
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
          <div className="absolute right-0 top-0 h-full w-[88%] max-w-[21.25rem] overflow-y-auto border-l border-user-line bg-user-elevated">
            <div className="flex items-center justify-between border-b border-user-line px-4 py-3">
              <span className="text-sm font-black uppercase tracking-wider text-user-fg">
                Filters
              </span>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-user-fg-muted hover:bg-user-hover"
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
