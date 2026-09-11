"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useWishlist } from "@/components/user/WishlistContext";
import { productApi } from "@/apis/user/productApi";
import ProductCard from "@/components/user/ProductCard";
import { Heart, Loader2, ShoppingBag, ChevronLeft, ChevronRight } from "lucide-react";

// ✅ PAGE_SIZE for client-side pagination
const PAGE_SIZE = 12;

export default function WishlistPage() {
  const { wishlist, count, loading } = useWishlist();
  const [page, setPage] = useState(1);

  // Reset to page 1 when wishlist changes
  useEffect(() => {
    setPage(1);
  }, [count]);

  // Full product data (same source as home page) — images + prices ke liye
  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  // Wishlist items ko full products se match karo
  const allItems = wishlist.map((w) => {
    const id = (w._id || w.id)?.toString();
    return allProducts.find((p) => (p._id || p.id)?.toString() === id) || w;
  });

  const isLoading = loading || (count > 0 && productsLoading);

  // ✅ CLIENT-SIDE PAGINATION
  // NOTE: Wishlist is backed by a single server endpoint (GET /users/wishlist) that
  // returns the user's entire wishlist as a populated array. There is no separate
  // paginated list endpoint, so we paginate the already-loaded list client-side
  // using the same pagination UI pattern as server-paginated pages.
  const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const items = allItems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const rangeStart = allItems.length ? (safePage - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, allItems.length);

  const goToPage = (p) => {
    if (p < 1 || p > totalPages || p === safePage) return;
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const getPageItems = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (safePage <= 4) return [1, 2, 3, 4, 5, "...", totalPages];
    if (safePage >= totalPages - 3)
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, "...", safePage - 1, safePage, safePage + 1, "...", totalPages];
  };

  return (
    <main className="max-w-[1200px] mx-auto px-3 lg:px-6 py-4 lg:py-10 pb-24 md:pb-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 sm:mb-8">
        <div>
          <h1 className="flex items-center gap-2 text-xl lg:text-2xl font-black text-[var(--user-text)]">
            <Heart size={20} className="text-[var(--user-danger)] fill-[var(--user-danger)]" />
            My Wishlist
          </h1>
          <p className="text-xs text-[var(--user-text-muted)] mt-1">
            {count} saved product{count !== 1 ? "s" : ""}
          </p>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[11px] sm:text-xs font-bold text-[var(--user-accent)] hover:underline transition"
        >
          <ShoppingBag size={13} /> Continue Shopping
        </Link>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="animate-spin text-[var(--user-accent)]" size={28} />
        </div>
      ) : count === 0 ? (
        /* Empty State */
        <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-12 text-center">
          <div className="w-20 h-20 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-4">
            <Heart size={32} className="text-[var(--user-text-subtle)]" />
          </div>
          <h2 className="text-lg font-bold text-[var(--user-text)] mb-2">
            Your wishlist is empty
          </h2>
          <p className="text-sm text-[var(--user-text-muted)]  mb-6">
            Tap the heart icon on any product to save it here.
          </p>
          <Link
            href="/"
            className="inline-block my-3 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <>
          {/* Wishlist Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
            {items.map((item) => (
              <ProductCard key={item._id || item.id} product={item} />
            ))}
          </div>

          {/* PAGINATION CONTROLS */}
          {totalPages > 1 && (
            <div className="mt-8 lg:mt-12 flex flex-col items-center gap-3">
              <p className="text-[11px] lg:text-xs text-[var(--user-text-muted)]">
                Showing{" "}
                <span className="font-semibold text-[var(--user-text)]">
                  {rangeStart}–{rangeEnd}
                </span>{" "}
                of <span className="font-semibold text-[var(--user-text)]">{allItems.length}</span> products
              </p>
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <button
                  onClick={() => goToPage(safePage - 1)}
                  disabled={safePage === 1}
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
                      aria-current={safePage === item ? "page" : undefined}
                      className={`h-9 min-w-[36px] px-2 lg:h-10 lg:min-w-[40px] rounded-lg lg:rounded-xl text-[11px] lg:text-xs font-bold transition ${
                        safePage === item
                          ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] border border-[var(--user-accent)]"
                          : "bg-[var(--user-bg-card)] border border-[var(--user-border)] text-[var(--user-text-secondary)] hover:border-[var(--user-accent)]/60"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  onClick={() => goToPage(safePage + 1)}
                  disabled={safePage === totalPages}
                  aria-label="Next page"
                  className="h-9 w-9 lg:h-10 lg:w-10 rounded-lg lg:rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] text-[var(--user-text-secondary)] flex items-center justify-center transition hover:border-[var(--user-accent)]/60 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
