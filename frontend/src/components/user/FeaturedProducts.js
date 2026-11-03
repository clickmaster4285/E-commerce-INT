"use client";

/* ==========================================================
   FEATURED PRODUCTS — home page ka main products grid
   Tabs (server-side, har tab apni query) — sab hamesha visible:
     All Products → complete catalog
     Featured     → sirf is_featured products
     New Arrivals → sort=newest
     Best Offers  → sab se bari discount % (sort=discount-desc)

   Har tab me 20 products ke server-side pages aur Load More button.
   ========================================================== */

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Flame, LayoutGrid, LoaderCircle, PackageSearch, Sparkles, TrendingUp } from "lucide-react";
import ProductCard from "./ProductCard";
import SectionHeading from "./SectionHeading";
import { idOf } from "@/utils/homeCatalog";
import { useShopProducts } from "../../hooks/user/useShopProducts";
import { FEATURED_TAB_EVENT } from "./HomeNav";
import { useTranslation } from "@/i18n/LanguageProvider";

const TABS = [
  { id: "all", labelKey: "storefront.navigation.allProducts", icon: LayoutGrid },
  { id: "featured", labelKey: "admin.featuredProducts.ui.featuredAria", icon: Sparkles },
  { id: "new", labelKey: "storefront.navigation.newProducts", icon: TrendingUp },
  { id: "offers", labelKey: "storefront.navigation.bestOffers", icon: Flame },
];

const PER_PAGE = 20;

const TAB_PARAMS = {
  all: { sort: "newest" },
  featured: { sort: "featured", featured: true },
  new: { sort: "newest" },
  offers: { sort: "discount-desc", minDiscount: 1 },
};

/* Compact marketplace grid across storefront breakpoints */
const GRID =
  "grid w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 4xl:grid-cols-8 5xl:grid-cols-9";

function TabGrid({ tab }) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const params = TAB_PARAMS[tab] || TAB_PARAMS.featured;

  const { products, total, pagination, isLoading, isFetching, isError, refetch } = useShopProducts({
    page,
    limit: PER_PAGE,
    sort: params.sort,
    minDiscount: params.minDiscount ?? null,
    featured: params.featured ? "true" : "",
  });

  const totalPages = pagination?.pages || Math.max(1, Math.ceil(total / PER_PAGE));
  const currentPage = pagination?.page || Math.min(page, totalPages);
  useEffect(() => {
    if (!pagination || pagination.page !== page || !products.length) return;
    setDisplayedProducts((current) => {
      if (page === 1) return products;
      const seen = new Set(current.map((product) => idOf(product._id)));
      return [...current, ...products.filter((product) => !seen.has(idOf(product._id)))];
    });
  }, [page, pagination, products]);

  if (isLoading && !products.length) {
    return (
      <div className={GRID}>
        {[...Array(8).keys()].map((index) => (
          <div
            key={index}
            className="h-[17.25rem] animate-pulse overflow-hidden rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)]"
          />
        ))}
      </div>
    );
  }

  if (isError && !displayedProducts.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-12 text-center">
        <PackageSearch size={30} className="text-[var(--user-text-subtle)]" />
        <p className="text-sm font-bold text-[var(--user-text)]">{t("admin.shared.state.error")}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-1 rounded-lg bg-[var(--user-accent)] px-4 py-2 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--user-accent-text)] transition-opacity hover:opacity-90"
        >
          {t("admin.shared.state.errorBody")}
        </button>
      </div>
    );
  }

  if (!products.length && !displayedProducts.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-12 text-center">
        <PackageSearch size={30} className="text-[var(--user-text-subtle)]" />
        <p className="text-sm font-bold text-[var(--user-text)]">{t("admin.products.table.empty")}</p>
        <p className="text-[0.6875rem] text-[var(--user-text-muted)]">{t("storefront.featured.comingSoon")}</p>
      </div>
    );
  }

  return (
    <div className="scroll-mt-24">
      <div className={GRID}>
        {displayedProducts.map((product, i) => (
          <ProductCard key={idOf(product._id) || product.name} product={product} priority={i < 2} />
        ))}
      </div>

      {currentPage < totalPages ? (
        <div className="mt-8 flex flex-col items-center gap-3 border-t border-[var(--user-border)] pt-6">
          <p className="text-[0.6875rem] font-medium text-[var(--user-text-muted)]">
            {t("storefront.featured.showingCount", {
              shown: displayedProducts.length.toLocaleString(),
              total: total.toLocaleString(),
            })}
          </p>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
            disabled={isFetching}
            aria-busy={isFetching}
            className="group inline-flex min-w-52 items-center justify-center gap-2 rounded-xl border border-[var(--user-accent)] bg-[var(--user-bg-card)] px-6 py-3 text-xs font-bold tracking-wide text-[var(--user-accent)] shadow-sm transition duration-200 hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)] disabled:cursor-wait disabled:opacity-70"
          >
            {isFetching ? <LoaderCircle size={15} className="animate-spin" /> : <ChevronDown size={15} className="transition-transform group-hover:translate-y-0.5" />}
            {t(isFetching ? "storefront.featured.loadingMore" : "storefront.featured.loadMoreProducts")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function FeaturedProducts({ titleOverride = null }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams?.get("tab");
  const normalizedUrlTab =
    urlTab === "all" || urlTab === "offers" || urlTab === "new" || urlTab === "featured" ? urlTab : null;

  const [manualTab, setManualTab] = useState(normalizedUrlTab || "all");
  const sectionRef = useRef(null);

  /* ?tab= URL param ho to wahi jeetta hai (nav / share / refresh),
     warna manual selection. Is se URL-sync ke liye effect me setState
     nahi karna padta. */
  const tab = normalizedUrlTab || manualTab;

  const syncUrlTab = (next) => {
    try {
      const sp = new URLSearchParams(searchParams?.toString() || "");
      if (next === "all") sp.delete("tab");
      else sp.set("tab", next);
      const query = sp.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    } catch {}
  };

  useEffect(() => {
    const onSelect = (event) => {
      const next = event?.detail;
      if (next === "all" || next === "offers" || next === "new" || next === "featured") {
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
    (safeTab === "all"
      ? t("storefront.navigation.allProducts")
      : safeTab === "new"
      ? t("storefront.navigation.newProducts")
      : safeTab === "offers"
        ? t("storefront.navigation.bestOffers")
        : t("admin.nav.item.featuredProducts"));
  const subtitle =
    safeTab === "all"
      ? t("storefront.featured.allSubtitle")
      : safeTab === "new"
      ? t("storefront.featured.newSubtitle")
      : safeTab === "offers"
        ? t("storefront.featured.offersSubtitle")
        : t("storefront.featured.defaultSubtitle");

  return (
    <section id="featured-products" ref={sectionRef} className="user-featured-products scroll-mt-[7.5rem] lg:scroll-mt-[8.5rem]">
      <SectionHeading title={title} subtitle={subtitle}>
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
          {tabs.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => selectTab(id)}
              aria-pressed={safeTab === id}
              className={`${tabClass(safeTab === id)} flex items-center gap-1.5`}
            >
              <Icon size={13} strokeWidth={2.2} />
              {t(labelKey)}
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
