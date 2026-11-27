"use client";

import FallbackImage from "@/components/common/FallbackImage";
import { Suspense, useRef } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/apis/user/productApi";
import { brandApi } from "@/apis/user/brandApi";
import ProductCard from "@/components/user/ProductCard";
import PaginationBar from "@/components/user/PaginationBar";
import { Package, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";

const PAGE_SIZE = 20;
const VALID_SORTS = ["featured", "newest", "price-asc", "price-desc"];

const safePageParam = (raw) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
};

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

export default function BrandPage() {
  const params = useParams();
  const id = params.id;

  return (
    <main className="min-h-screen text-user-fg">
      <section className="max-w-7xl mx-auto px-3 lg:px-6 py-5 lg:py-12">
        <Suspense
          fallback={
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-2 lg:space-y-3">
                  <div className="aspect-square rounded-2xl bg-user-card animate-pulse border border-user-line" />
                  <div className="h-3 w-3/4 bg-user-card rounded-full animate-pulse" />
                </div>
              ))}
            </div>
          }
        >
          <BrandContent brandId={id} />
        </Suspense>
      </section>
    </main>
  );
}

function BrandContent({ brandId }) {
  const { t, dir } = useTranslation();
  const { fieldOf, descriptionOf } = useLocalized();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const gridTopRef = useRef(null);
  // ✅ Page/sort seedha URL se (duplicate state nahi — back/refresh safe)
  const sortBy = VALID_SORTS.includes(searchParams.get("sort"))
    ? searchParams.get("sort")
    : "featured";
  const page = safePageParam(searchParams.get("page"));

  const { data: brand } = useQuery({
    queryKey: ["brand", brandId],
    queryFn: () => brandApi.getById(brandId),
    enabled: !!brandId,
    retry: false,
  });
  // Storefront admin-only /translations/page call nahi karta (shopper ko 401 + retry storm
  // aur har retry par list refetch). Server translations.* pehle se bhejta hai.

  // ✅ Server pagination + sort (?page=&sort= URL me)
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["brandProducts", brandId, sortBy, page],
    queryFn: () =>
      productApi.getAllPaginated({ page, limit: PAGE_SIZE, sort: sortBy, brand_id: brandId }),
    enabled: !!brandId,
    retry: 1,
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const products = data?.products || [];
  const pagination = data?.pagination || null;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.pages || Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = pagination?.page || Math.min(page, totalPages);

  const syncUrl = (nextPage, nextSort) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (!nextSort || nextSort === "featured") sp.delete("sort");
    else sp.set("sort", nextSort);
    if (nextPage <= 1) sp.delete("page");
    else sp.set("page", String(nextPage));
    const query = sp.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const goToPage = (next) => {
    const value = Math.min(Math.max(1, next), totalPages);
    syncUrl(value, sortBy);
    requestAnimationFrame(() => {
      gridTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const changeSort = (next) => {
    syncUrl(1, next);
  };

  const getLogoUrl = (logo) => {
    const raw = typeof logo === "string" ? logo : logo?.img_url;
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${API_ORIGIN}${path}`;
  };

  const logoUrl = getLogoUrl(brand?.logo);
  const brandDisplayName = fieldOf(brand, "name") || brand?.name || t("common.brand");
  const brandDisplayDesc = descriptionOf(brand) || brand?.description || "";

  return (
    <div dir={dir}>
      {/* BREADCRUMB */}
      <nav className="flex items-center gap-1.5 text-[0.6875rem] lg:text-xs text-user-fg-muted mb-6 lg:mb-10 flex-wrap">
        <Link href="/" className="hover:text-user-accent transition">
          {t("mobileNav.home")}
        </Link>
        <ChevronRight size={12} className={`text-user-fg-subtle ${dir === "rtl" ? "rotate-180" : ""}`} />
        <span className="text-user-fg-secondary line-clamp-1 max-w-[11.25rem] sm:max-w-[13.75rem]">
          {brandDisplayName}
        </span>
      </nav>

      {/* HEADER WITH LOGO */}
      <div className="mb-6 lg:mb-10">
        <div className="flex items-center gap-3 lg:gap-4 mb-3">
          {logoUrl ? (
            <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-user-fg border border-user-line flex items-center justify-center p-2 lg:p-2.5 shrink-0">
              <FallbackImage
                src={logoUrl}
                alt={brandDisplayName}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-user-card border border-user-line flex items-center justify-center shrink-0">
              <span className="text-xl lg:text-2xl font-black text-user-accent">
                {brandDisplayName?.charAt(0) || "B"}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-3xl xl:text-4xl font-extrabold text-user-fg tracking-tight uppercase">
              {brandDisplayName}
            </h1>
            {brandDisplayDesc && (
              <p className="mt-1 text-sm text-user-fg-muted line-clamp-2">
                {brandDisplayDesc}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      {!isLoading && !isError && total > 1 && (
        <div className="flex items-center justify-end mb-5 lg:mb-6 pb-4 lg:pb-5 border-b border-user-line">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-user-fg-muted lg:w-[0.875rem] lg:h-[0.875rem]" />
            <select
              value={sortBy}
              onChange={(e) => changeSort(e.target.value)}
              className="h-10 lg:h-auto bg-user-card border border-user-line rounded-full lg:rounded-lg px-3 lg:px-3 py-1.5 lg:py-2 text-[0.6875rem] lg:text-xs font-bold text-user-fg-secondary outline-none cursor-pointer hover:border-user-accent/50 transition focus:border-user-accent"
            >
              <option value="featured">{t("admin.featuredProducts.page.featured")}</option>
              <option value="newest">{t("admin.reviews.ui.newest")}</option>
              <option value="price-asc">{t("common.price")}: {t("admin.reviews.ui.lowest")}</option>
              <option value="price-desc">{t("common.price")}: {t("admin.reviews.ui.highest")}</option>
            </select>
          </div>
        </div>
      )}

      {/* LOADING */}
      {isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 4xl:grid-cols-5 5xl:grid-cols-6 6xl:grid-cols-7">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-2 lg:space-y-3">
              <div className="aspect-square rounded-2xl bg-user-card animate-pulse border border-user-line" />
              <div className="h-3 w-3/4 bg-user-card rounded-full animate-pulse" />
              <div className="h-3 w-1/2 bg-user-card rounded-full animate-pulse" />
              <div className="h-4 w-1/3 bg-user-card rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* ERROR */}
      {isError && (
        <div className="py-16 lg:py-24 text-center rounded-2xl bg-user-card border border-user-line">
          <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto rounded-full bg-user-hover flex items-center justify-center mb-5 lg:mb-6">
            <Package size={28} className="text-user-danger lg:w-8 lg:h-8" />
          </div>
          <p className="text-user-fg font-semibold mb-2 text-lg">
            {t("admin.brands.ui.loadFailed")}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 bg-user-accent text-user-accent-fg px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:opacity-90 active:scale-95 transition"
            >
              {t("common.retry")}
            </button>
            <Link
              href="/"
              className="inline-flex items-center gap-2 border border-user-line text-user-fg-muted px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:border-user-accent/50 transition"
            >
              {t("mobileNav.home")}
            </Link>
          </div>
        </div>
      )}

      {/* PRODUCTS */}
      {!isLoading && !isError && total > 0 && (
        <div ref={gridTopRef} className="scroll-mt-24">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 4xl:grid-cols-5 5xl:grid-cols-6 6xl:grid-cols-7">
            {products.map((product, i) => (
              <ProductCard key={product._id} product={product} priority={i < 2} />
            ))}
          </div>
          <PaginationBar
            page={currentPage}
            totalPages={totalPages}
            total={total}
            perPage={PAGE_SIZE}
            onPageChange={goToPage}
          />
          {isFetching ? (
            <p className="mt-2 text-center text-[0.6875rem] text-user-fg-subtle">{t("common.loading")}</p>
          ) : null}
        </div>
      )}

      {/* EMPTY */}
      {!isLoading && !isError && total === 0 && (
        <div className="py-16 lg:py-24 text-center rounded-2xl bg-user-card border border-user-line">
          <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto rounded-full bg-user-hover flex items-center justify-center mb-5 lg:mb-6">
            <Package size={28} className="text-user-accent lg:w-8 lg:h-8 opacity-60" />
          </div>
          <p className="text-user-fg font-semibold mb-2 text-lg">
            {t("product.noProducts")}
          </p>
          <p className="text-user-fg-muted text-sm mb-6 max-w-sm mx-auto">
            {t("admin.brands.page.noBrands")}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-user-accent text-user-accent-fg px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:bg-user-accent-hover active:scale-95 transition"
          >
            {t("cart.continueShopping")}
          </Link>
        </div>
      )}
    </div>
  );
}
