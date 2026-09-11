"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/apis/user/productApi";
import ProductCard from "../../../components/user/ProductCard";
import { ChevronLeft, ChevronRight, Package, SearchX, SlidersHorizontal } from "lucide-react";

const PAGE_SIZE = 12;

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8 lg:py-12">
          <div className="h-8 w-64 bg-[var(--user-bg-card)] rounded-full animate-pulse mb-8 lg:mb-10" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-[var(--user-bg-card)] animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") || "").trim();
  const [sortBy, setSortBy] = useState("featured");
  const [page, setPage] = useState(1);

  // ✅ Search ya sort badle to page 1 pe wapas
  useEffect(() => {
    setPage(1);
  }, [query, sortBy]);

  // ✅ SERVER-SIDE PAGINATION query
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["products", "paginated", page, sortBy, query],
    queryFn: () =>
      productApi.getAllPaginated({
        page,
        limit: PAGE_SIZE,
        search: query,
        sort: sortBy,
      }),
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

  return (
    <main className="max-w-7xl mx-auto px-3 lg:px-6 py-5 lg:py-12">
      {/* HEADER */}
      <div className="mb-6 lg:mb-10">
        <h1 className="text-2xl lg:text-3xl xl:text-4xl font-extrabold text-[var(--user-text)] tracking-tight uppercase">
          {query ? (
            <>
              Results for <span className="text-[var(--user-accent)]">"{query}"</span>
            </>
          ) : (
            "All Products"
          )}
        </h1>
        <p className="text-[11px] lg:text-xs text-[var(--user-text-muted)] mt-2 lg:mt-3">
          {isLoading ? (
            "Loading products..."
          ) : (
            <>
              <span className="text-[var(--user-text)] font-semibold">{pagination.total}</span>{" "}
              {pagination.total === 1 ? "product" : "products"} found
            </>
          )}
        </p>
      </div>

      {/* TOOLBAR */}
      {!isLoading && pagination.total > 1 && (
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
              <div className="h-4 w-1/3 bg-[var(--user-bg-card)] rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {/* GRID */}
      {!isLoading && products.length > 0 && (
        <div
          className={`grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-5 transition-opacity ${
            isFetching ? "opacity-60 pointer-events-none" : "opacity-100"
          }`}
        >
          {products.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}

      {/* ✅ PAGINATION CONTROLS */}
      {!isLoading && totalPages > 1 && (
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
      {!isLoading && products.length === 0 && (
        <div className="py-16 lg:py-24 text-center rounded-2xl bg-[var(--user-bg-card)] border border-[var(--user-border)]">
          <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-5 lg:mb-6">
            {query ? (
              <SearchX size={28} className="text-[var(--user-accent)] lg:w-8 lg:h-8 opacity-60" />
            ) : (
              <Package size={28} className="text-[var(--user-accent)] lg:w-8 lg:h-8 opacity-60" />
            )}
          </div>
          <h2 className="text-lg lg:text-xl font-bold text-[var(--user-text)] mb-2">
            {query ? "No matching products" : "No products available"}
          </h2>
          <p className="text-[var(--user-text-muted)] text-sm mb-6 lg:mb-8 max-w-sm mx-auto leading-relaxed">
            {query
              ? `We couldn't find anything for "${query}". Try a different keyword.`
              : "Check back soon for new arrivals."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:bg-[var(--user-accent-hover)] active:scale-95 transition"
          >
            {query ? "Clear Search" : "Back to Home"}
          </Link>
        </div>
      )}
    </main>
  );
}