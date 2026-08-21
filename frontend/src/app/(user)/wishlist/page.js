"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useWishlist } from "@/components/user/WishlistContext";
import { productApi } from "@/apis/productApi";
import ProductCard from "@/components/user/ProductCard";
import { Heart, Loader2, ShoppingBag } from "lucide-react";

export default function WishlistPage() {
  const { wishlist, count, loading } = useWishlist();

  // ✅ Full product data (same source as home page) — images + prices ke liye
  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Wishlist items ko full products se match karo
  const items = wishlist.map((w) => {
    const id = (w._id || w.id)?.toString();
    return allProducts.find((p) => (p._id || p.id)?.toString() === id) || w;
  });

  const isLoading = loading || (count > 0 && productsLoading);

  return (
    <main className="max-w-[1200px] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-10 pb-20 sm:pb-24 md:pb-10">
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
        /* ✅ Simple Empty State — Start Shopping → / */
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
        /* ✅ Wishlist Grid — full product cards */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {items.map((item) => (
            <ProductCard key={item._id || item.id} product={item} />
          ))}
        </div>
      )}
    </main>
  );
}