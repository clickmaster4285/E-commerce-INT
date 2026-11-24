"use client";

import { Suspense, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/apis/user/productApi";
import ProductCard from "@/components/user/ProductCard";
import PaginationBar from "@/components/user/PaginationBar";
import { PackageSearch, ChevronRight, SlidersHorizontal, Search } from "lucide-react";

const PAGE_SIZE = 20;
const VALID_SORTS = ["featured", "newest", "price-asc", "price-desc"];

const safePageParam = (raw) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
};

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const gridTopRef = useRef(null);

  const q = (searchParams.get("q") || "").trim();
  // ✅ Page/sort seedha URL se (duplicate state nahi — back/refresh safe)
  const sortBy = VALID_SORTS.includes(searchParams.get("sort"))
    ? searchParams.get("sort")
    : "featured";
  const page = safePageParam(searchParams.get("page"));

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["shopSearch", q, sortBy, page],
    queryFn: () =>
      productApi.getAllPaginated({ page, limit: PAGE_SIZE, search: q, sort: sortBy }),
    enabled: q.length > 0,
    retry: 1,
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const products = data?.products || [];
  const pagination = data?.pagination || null;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.pages || Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = pagination?.page || Math.min(page, totalPages);

  const goToPage = (next) => {
    const value = Math.min(Math.max(1, next), totalPages);
    const sp = new URLSearchParams(searchParams.toString());
    if (value <= 1) sp.delete("page");
    else sp.set("page", String(value));
    const query = sp.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    requestAnimationFrame(() => {
      gridTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const changeSort = (next) => {
    const sp = new URLSearchParams(searchParams.toString());
    if (!next || next === "featured") sp.delete("sort");
    else sp.set("sort", next);
    sp.delete("page");
    const query = sp.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <main className="min-h-screen text-user-fg">
      <section className="max-w-7xl mx-auto px-3 lg:px-6 py-5 lg:py-12">
        {/* BREADCRUMB */}
        <nav className="flex items-center gap-1.5 text-[0.6875rem] lg:text-xs text-user-fg-muted mb-6 lg:mb-10 flex-wrap">
          <Link href="/" className="hover:text-user-accent transition">
            Home
          </Link>
          <ChevronRight size={12} className="text-user-fg-subtle" />
          <span className="text-user-fg-secondary line-clamp-1 max-w-[11.25rem] sm:max-w-[13.75rem]">
            Search{q ? `: ${q}` : ""}
          </span>
        </nav>

        <div className="flex items-center gap-3 mb-6 lg:mb-10">
          <span className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-user-card border border-user-line flex items-center justify-center shrink-0">
            <Search size={18} className="text-user-accent" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight truncate">
              {q ? `Results for "${q}"` : "Search products"}
            </h1>
            {!isLoading && q ? (
              <p className="text-[0.6875rem] lg:text-xs text-user-fg-muted mt-0.5">
                {total} product{total === 1 ? "" : "s"} found
              </p>
            ) : null}
          </div>
        </div>

        {/* TOOLBAR */}
        {q && !isLoading && !isError && total > 1 ? (
          <div className="flex items-center justify-end mb-5 lg:mb-6 pb-4 lg:pb-5 border-b border-user-line">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={13} className="text-user-fg-muted" />
              <select
                value={sortBy}
                onChange={(e) => changeSort(e.target.value)}
                className="h-10 bg-user-card border border-user-line rounded-full px-3 text-[0.6875rem] lg:text-xs font-bold text-user-fg-secondary outline-none cursor-pointer hover:border-user-accent/50 transition focus:border-user-accent"
              >
                <option value="featured">Featured</option>
                <option value="newest">Newest Arrivals</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </div>
          </div>
        ) : null}

        {/* LOADING */}
        {isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-2 lg:space-y-3">
                <div className="aspect-square rounded-2xl bg-user-card animate-pulse border border-user-line" />
                <div className="h-3 w-3/4 bg-user-card rounded-full animate-pulse" />
                <div className="h-3 w-1/2 bg-user-card rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* ERROR */}
        {isError && (
          <div className="py-16 lg:py-24 text-center rounded-2xl bg-user-card border border-user-line">
            <p className="text-user-fg font-semibold mb-2 text-lg">
              We couldn&apos;t load these products.
            </p>
            <p className="text-user-fg-muted text-sm mb-6 max-w-sm mx-auto">
              Please try again later.
            </p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 bg-user-accent text-user-accent-fg px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:opacity-90 active:scale-95 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* RESULTS */}
        {!isLoading && !isError && q && total > 0 && (
          <div ref={gridTopRef} className="scroll-mt-24">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
              <p className="mt-2 text-center text-[0.6875rem] text-user-fg-subtle">Updating…</p>
            ) : null}
          </div>
        )}

        {/* EMPTY */}
        {!isLoading && !isError && ((q && total === 0) || !q) && (
          <div className="py-16 lg:py-24 text-center rounded-2xl bg-user-card border border-user-line">
            <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto rounded-full bg-user-hover flex items-center justify-center mb-5 lg:mb-6">
              <PackageSearch size={28} className="text-user-accent lg:w-8 lg:h-8 opacity-60" />
            </div>
            <p className="text-user-fg font-semibold mb-2 text-lg">
              {q ? "No products found" : "Type something to search"}
            </p>
            <p className="text-user-fg-muted text-sm mb-6 max-w-sm mx-auto">
              {q
                ? `Nothing matched "${q}". Try a different keyword.`
                : "Search by product, brand or category name."}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-user-accent text-user-accent-fg px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:opacity-90 active:scale-95 transition"
            >
              Explore All Products
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen text-user-fg">
          <section className="max-w-7xl mx-auto px-3 lg:px-6 py-5 lg:py-12">
            <div className="h-8 w-64 animate-pulse rounded-full bg-user-card" />
          </section>
        </main>
      }
    >
      <SearchContent />
    </Suspense>
  );
}
