"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/apis/user/productApi";
import ProductCard from "../../../components/user/ProductCard";
import { Package, SearchX, SlidersHorizontal } from "lucide-react";

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8 lg:py-12">
          <div className="h-8 w-64 bg-[var(--user-bg-card)] rounded-full animate-pulse mb-8 lg:mb-10" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
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
  const query = (searchParams.get("q") || "").toLowerCase();
  const [sortBy, setSortBy] = useState("featured");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Search filter
  const filtered = useMemo(() => {
    if (!query) return products;
    return products.filter((p) => {
      const brand = typeof p.brand_id === "object" ? p.brand_id?.name : "";
      const category = typeof p.category_id === "object" ? p.category_id?.name : "";
      const skus = (p.variants || []).map((v) => v.sku).join(" ");
      return (
        p.name?.toLowerCase().includes(query) ||
        brand?.toLowerCase().includes(query) ||
        category?.toLowerCase().includes(query) ||
        skus.toLowerCase().includes(query)
      );
    });
  }, [products, query]);

  // ✅ Sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const price = (p) => Number(p.variants?.[0]?.selling_price || 0);
    switch (sortBy) {
      case "price-asc":
        return arr.sort((a, b) => price(a) - price(b));
      case "price-desc":
        return arr.sort((a, b) => price(b) - price(a));
      case "newest":
        return arr.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      default:
        return arr;
    }
  }, [filtered, sortBy]);

  return (
    <main className="max-w-7xl mx-auto px-4 lg:px-6 py-8 lg:py-12">
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
          {isLoading
            ? "Loading products..."
            : (
              <>
                <span className="text-[var(--user-text)] font-semibold">
                  {sorted.length}
                </span>{" "}
                {sorted.length === 1 ? "product" : "products"} found
              </>
            )}
        </p>
      </div>

      {/* TOOLBAR */}
      {sorted.length > 1 && (
        <div className="flex items-center justify-end mb-5 lg:mb-6 pb-4 lg:pb-5 border-b border-[var(--user-border)]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-[var(--user-text-muted)] lg:w-[14px] lg:h-[14px]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-lg px-2.5 lg:px-3 py-1.5 lg:py-2 text-[11px] lg:text-xs text-[var(--user-text-secondary)] outline-none cursor-pointer hover:border-[var(--user-accent)]/50 transition focus:border-[var(--user-accent)]"
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
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
      {!isLoading && sorted.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
          {sorted.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}

      {/* EMPTY */}
      {!isLoading && sorted.length === 0 && (
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