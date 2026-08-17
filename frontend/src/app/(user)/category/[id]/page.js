"use client";

import { use, useState, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/apis/productApi";
import { categoryApi } from "@/apis/categoryApi";
import ProductCard from "@/app/Component/user/ProductCard";
import { ChevronRight, Package, SlidersHorizontal } from "lucide-react";

export default function CategoryPage({ params }) {
  const { id } = use(params);
  const [sortBy, setSortBy] = useState("featured");

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
  });

  // ✅ Find category by _id
  const category = categories.find((c) => c._id === id);

  // ✅ Filter products for this category
  const filtered = useMemo(() => {
    if (!category) return [];
    return products.filter(
      (p) => (p.category_id?._id || p.category_id) === category._id
    );
  }, [products, category]);

  // ✅ Apply sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "price-asc":
        return arr.sort((a, b) => {
          const priceA = Number(a.variants?.[0]?.selling_price || 0);
          const priceB = Number(b.variants?.[0]?.selling_price || 0);
          return priceA - priceB;
        });
      case "price-desc":
        return arr.sort((a, b) => {
          const priceA = Number(a.variants?.[0]?.selling_price || 0);
          const priceB = Number(b.variants?.[0]?.selling_price || 0);
          return priceB - priceA;
        });
      case "newest":
        return arr.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
      default:
        return arr;
    }
  }, [filtered, sortBy]);

  return (
    <main className="max-w-7xl mx-auto px-4 lg:px-6 py-8 lg:py-12">
      {/* BREADCRUMB */}
      <nav className="flex items-center gap-1.5 text-[11px] lg:text-xs text-[var(--user-text-muted)] mb-6 lg:mb-10 flex-wrap">
        <Link href="/" className="hover:text-[var(--user-accent)] transition">
          Home
        </Link>
        <ChevronRight size={12} className="text-[var(--user-text-subtle)]" />
        <Link href="/products" className="hover:text-[var(--user-accent)] transition">
          All Products
        </Link>
        <ChevronRight size={12} className="text-[var(--user-text-subtle)]" />
        <span className="text-[var(--user-text-secondary)] line-clamp-1 max-w-[180px] sm:max-w-[220px]">
          {category?.name || "Category"}
        </span>
      </nav>

      {/* HEADER */}
      <div className="mb-6 lg:mb-10">
        <h1 className="text-2xl lg:text-3xl xl:text-4xl font-extrabold text-[var(--user-text)] tracking-tight uppercase">
          {category?.name || "Category"}
        </h1>
        {category?.description && (
          <p className="text-sm text-[var(--user-text-muted)] mt-3 max-w-2xl leading-relaxed">
            {category.description}
          </p>
        )}
      </div>

      {/* TOOLBAR — Sort + Count */}
      <div className="flex items-center justify-between mb-5 lg:mb-6 pb-4 lg:pb-5 border-b border-[var(--user-border)]">
        <p className="text-[11px] lg:text-xs text-[var(--user-text-muted)]">
          {isLoading ? (
            "Loading products..."
          ) : (
            <>
              <span className="text-[var(--user-text)] font-semibold">{sorted.length}</span>{" "}
              {sorted.length === 1 ? "product" : "products"} available
            </>
          )}
        </p>

        {sorted.length > 1 && (
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
        )}
      </div>

      {/* LOADING */}
      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
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

      {/* PRODUCTS GRID */}
      {!isLoading && sorted.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
          {sorted.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {!isLoading && sorted.length === 0 && category && (
        <div className="py-16 lg:py-24 text-center">
          <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center mb-5 lg:mb-6">
            <Package size={28} className="text-[var(--user-accent)] lg:w-8 lg:h-8 opacity-60" />
          </div>
          <h2 className="text-lg lg:text-xl font-bold text-[var(--user-text)] mb-2">
            No products available
          </h2>
          <p className="text-[var(--user-text-muted)] text-sm mb-6 lg:mb-8 max-w-sm mx-auto">
            We don't have any products in this category yet. Check back soon for new arrivals.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:bg-[var(--user-accent-hover)] active:scale-95 transition"
          >
            Explore All Products
          </Link>
        </div>
      )}

      {/* CATEGORY NOT FOUND */}
      {!isLoading && !category && (
        <div className="py-16 lg:py-24 text-center">
          <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center mb-5 lg:mb-6">
            <Package size={28} className="text-[var(--user-danger)] lg:w-8 lg:h-8 opacity-60" />
          </div>
          <h2 className="text-lg lg:text-xl font-bold text-[var(--user-text)] mb-2">
            Category Not Found
          </h2>
          <p className="text-[var(--user-text-muted)] text-sm mb-6 lg:mb-8 max-w-sm mx-auto">
            The category you're looking for doesn't exist or has been removed.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:bg-[var(--user-accent-hover)] active:scale-95 transition"
          >
            Back to Home
          </Link>
        </div>
      )}
    </main>
  );
}