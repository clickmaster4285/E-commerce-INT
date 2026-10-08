"use client";

import { useState } from "react";
import Link from "next/link";
import { useWishlist } from "@/components/user/WishlistContext";
import ProductCard from "@/components/user/ProductCard";
import { Heart, Loader2, ShoppingBag } from "lucide-react";

// ✅ Ek waqt me kitne dikhein (load more — khatam ho to button hide)
const PAGE_SIZE = 20;

/* WishlistPage — /wishlist route ka full page AUR account ke Wishlist tab
   ka reused view (dono jagah EXACT same design).
   compact=true (account tab): page chrome (title header, page paddings)
   hide — sirf loading / empty / grid render hota hai. */
export default function WishlistPage({ compact = false }) {
  const { wishlist, count, loading } = useWishlist();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [seenCount, setSeenCount] = useState(count);

  // ✅ Wishlist items backend se populated + variants/price ke saath aate hain —
  // full catalog fetch ki zaroorat nahi
  const allItems = wishlist || [];
  // ✅ Count badle (add/remove) to dobara pehle page se (render me adjust — effect nahi)
  if (seenCount !== count) {
    setSeenCount(count);
    setVisible(PAGE_SIZE);
  }
  const shownItems = allItems.slice(0, visible);
  const hasMore = visible < allItems.length;

  const isLoading = loading;

  return (
    <main className={compact ? "" : "max-w-[75rem] mx-auto px-3 lg:px-6 py-4 lg:py-10 pb-24 md:pb-10"}>
      {/* Header — account tab (compact) me account ka apna header hota hai */}
      {!compact && (
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
          className="flex items-center gap-1.5 text-[0.6875rem] sm:text-xs font-bold text-[var(--user-accent)] hover:underline transition"
        >
          <ShoppingBag size={13} /> Continue Shopping
        </Link>
      </div>
      )}

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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {shownItems.map((item) => (
              <ProductCard key={item._id || item.id} product={item} />
            ))}
          </div>
          {hasMore ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="h-11 px-6 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] text-sm font-bold text-[var(--user-text-secondary)] hover:border-[var(--user-accent)]/50 hover:text-[var(--user-accent)] transition active:scale-95"
              >
                Show more ({allItems.length - visible} remaining)
              </button>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}
