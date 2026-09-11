"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/apis/user/productApi";
import { brandApi } from "@/apis/user/brandApi";
import ProductCard from "@/components/user/ProductCard";
import { Package, ChevronRight, ChevronLeft, SlidersHorizontal } from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const PAGE_SIZE = 12;

export default function BrandPage() {
  const params = useParams();
  const id = params.id;

  return (
    <main className="min-h-screen text-[var(--user-text)]">
      <section className="max-w-7xl mx-auto px-3 lg:px-6 py-5 lg:py-12">
        <BrandContent brandId={id} />
      </section>
    </main>
  );
}

function BrandContent({ brandId }) {
  const [sortBy, setSortBy] = useState("featured");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [sortBy]);

  const { data: brand } = useQuery({
    queryKey: ["brand", brandId],
    queryFn: () => brandApi.getById(brandId),
    enabled: !!brandId,
    retry: false,
  });

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["brandProducts", brandId, page, sortBy],
    queryFn: () =>
      productApi.getAllPaginated({
        page,
        limit: PAGE_SIZE,
        brand_id: brandId,
        sort: sortBy,
      }),
    enabled: !!brandId,
    staleTime: 60 * 1000,
  });

  const products = data?.products || [];
  const pagination = data?.pagination || { total: 0, page: 1, pages: 1 };
  const totalPages = Math.max(1, pagination.pages || 1);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages || p === page) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPageItems = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (page <= 4) return [1, 2, 3, 4, 5, "...", totalPages];
    if (page >= totalPages - 3)
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", page - 1, page, page + 1, "...", totalPages];
  };

  const rangeStart = products.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, pagination.total);

  const getLogoUrl = (logo) => {
    const raw = typeof logo === "string" ? logo : logo?.img_url;
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${API_ORIGIN}${path}`;
  };

  const logoUrl = getLogoUrl(brand?.logo);

  return (
    <>
      {/* BREADCRUMB */}
      <nav className="flex items-center gap-1.5 text-[11px] lg:text-xs text-[var(--user-text-muted)] mb-6 lg:mb-10 flex-wrap">
        <Link href="/" className="hover:text-[var(--user-accent)] transition">
          Home
        </Link>
        <ChevronRight size={12} className="text-[var(--user-text-subtle)]" />
        <span className="text-[var(--user-text-secondary)] line-clamp-1 max-w-[180px] sm:max-w-[220px]">
          {brand?.name || "Brand"}
        </span>
      </nav>

      {/* HEADER WITH LOGO */}
      <div className="mb-6 lg:mb-10">
        <div className="flex items-center gap-3 lg:gap-4 mb-3">
          {logoUrl ? (
            <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-[var(--user-text)] border border-[var(--user-border)] flex items-center justify-center p-2 lg:p-2.5 shrink-0">
              <img
                src={logoUrl}
                alt={brand?.name}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center shrink-0">
              <span className="text-xl lg:text-2xl font-black text-[var(--user-accent)]">
                {brand?.name?.charAt(0) || "B"}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-3xl xl:text-4xl font-extrabold text-[var(--user-text)] tracking-tight uppercase">
              {brand?.name || "Brand"}
            </h1>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      {!isLoading && !isError && pagination.total > 1 && (
        <div className="flex items-center justify-end mb-5 lg:mb-6 pb-4 lg:pb-5 border-b border-[var(--user-border)]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-[var(--user-text-muted)] lg:w-[14px] lg:h-[14px]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-10 lg:h-auto bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-full lg:rounded-lg px-3 lg:px-3 py-1.5 lg:py-2 text-[11px] lg:text-xs font-bold text-[var(--user-text-secondary)] outline-none cursor-pointer hover:border-[var(--user-accent)]/50 transition focus:border-[var(--user-accent)]"
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest Arrivals</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>
      )}

      {/* LOADING */}
      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="space-y-2 lg:space-y-3">
              <div className="aspect-square rounded-2xl bg-[var(--user-bg-card)] animate-pulse border border-[var(--user-border)]" />
              <div className="h-3 w-3/4 bg-[var(--user-bg-card)] rounded-full animate-pulse" />
              <div className="h-3 w-1/2 bg-[var(--user-bg-card)] rounded-full animate-pulse" />
              <div className="h-4 w-1/3 bg-[var(--user-bg-card)] rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* ERROR */}
      {isError && (
        <div className="py-16 lg:py-24 text-center rounded-2xl bg-[var(--user-bg-card)] border border-[var(--user-border)]">
          <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-5 lg:mb-6">
            <Package size={28} className="text-[var(--user-danger)] lg:w-8 lg:h-8" />
          </div>
          <p className="text-[var(--user-text)] font-semibold mb-2 text-lg">
            We couldn't load these products.
          </p>
          <p className="text-[var(--user-text-muted)] text-sm mb-6 max-w-sm mx-auto">
            Please try again later.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:bg-[var(--user-accent-hover)] active:scale-95 transition"
          >
            Back to Home
          </Link>
        </div>
      )}

      {/* PRODUCTS */}
      {!isLoading && !isError && products.length > 0 && (
        <div
          className={`grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-5 transition-opacity ${
            isFetching ? "opacity-60 pointer-events-none" : "opacity-100"
          }`}
        >
          {products.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      )}

      {/* PAGINATION CONTROLS */}
      {!isLoading && !isError && totalPages > 1 && (
        <div className="mt-8 lg:mt-12 flex flex-col items-center gap-3">
          <p className="text-[11px] lg:text-xs text-[var(--user-text-muted)]">
            Showing{" "}
            <span className="font-semibold text-[var(--user-text)]">
              {rangeStart}–{rangeEnd}
            </span>{" "}
            of <span className="font-semibold text-[var(--user-text)]">{pagination.total}</span> products
          </p>
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
              className="h-9 w-9 lg:h-10 lg:w-10 rounded-lg lg:rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] text-[var(--user-text-secondary)] flex items-center justify-center transition hover:border-[var(--user-accent)]/60 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={15} />
            </button>

            {getPageItems().map((item, i) =>
              item === "..." ? (
                <span key={`gap-${i}`} className="px-1 text-[var(--user-text-muted)] text-xs">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  onClick={() => goToPage(item)}
                  aria-current={page === item ? "page" : undefined}
                  className={`h-9 min-w-[36px] px-2 lg:h-10 lg:min-w-[40px] rounded-lg lg:rounded-xl text-[11px] lg:text-xs font-bold transition ${
                    page === item
                      ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] border border-[var(--user-accent)]"
                      : "bg-[var(--user-bg-card)] border border-[var(--user-border)] text-[var(--user-text-secondary)] hover:border-[var(--user-accent)]/60"
                  }`}
                >
                  {item}
                </button>
              )
            )}

            <button
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              aria-label="Next page"
              className="h-9 w-9 lg:h-10 lg:w-10 rounded-lg lg:rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] text-[var(--user-text-secondary)] flex items-center justify-center transition hover:border-[var(--user-accent)]/60 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* EMPTY */}
      {!isLoading && !isError && products.length === 0 && (
        <div className="py-16 lg:py-24 text-center rounded-2xl bg-[var(--user-bg-card)] border border-[var(--user-border)]">
          <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-5 lg:mb-6">
            <Package size={28} className="text-[var(--user-accent)] lg:w-8 lg:h-8 opacity-60" />
          </div>
          <p className="text-[var(--user-text)] font-semibold mb-2 text-lg">
            No products available
          </p>
          <p className="text-[var(--user-text-muted)] text-sm mb-6 max-w-sm mx-auto">
            We don't have any products for this brand yet. Check back soon for new arrivals.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:bg-[var(--user-accent-hover)] active:scale-95 transition"
          >
            Explore All Products
          </Link>
        </div>
      )}
    </>
  );
}
