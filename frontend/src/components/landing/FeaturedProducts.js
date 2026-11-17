"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Heart, Eye, ShoppingCart, Star, X } from "lucide-react";
import Image from "next/image";
import ProductImage from "./ProductImage";
import SectionHeading from "./SectionHeading";
import { useLanding } from "./LandingContext";
import { FEATURED_PRODUCTS, formatPrice } from "./data";

export default function FeaturedProducts() {
  const { addToCart, toggleWishlist, wishlist } = useLanding();
  const [quickView, setQuickView] = useState(null);

  return (
    <section aria-labelledby="featured-title" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Handpicked"
        title="Featured Products"
        subtitle="Sabse zyada bikne wale products, ek click mein."
      />

      <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {FEATURED_PRODUCTS.map((product) => {
          const wished = wishlist.includes(product.id);
          return (
            <li
              key={product.id}
              className="group/card landing-card group-product relative flex flex-col overflow-hidden"
            >
              <div className="relative">
                <ProductImage
                  src={product.img}
                  alt={`${product.name} — sample product photo`}
                  className="h-36 w-full sm:h-44"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />

                {product.oldPrice && (
                  <span className="deal-badge absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold">
                    SAVE {Math.round((1 - product.price / product.oldPrice) * 100)}%
                  </span>
                )}

                {/* Quick actions */}
                <div className="quick-actions absolute right-2 top-2 flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product.id)}
                    aria-pressed={wished}
                    aria-label={wished ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)]/95 shadow-sm backdrop-blur transition-colors hover:text-[var(--user-accent)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]"
                  >
                    <Heart size={17} className={wished ? "fill-[var(--user-accent)] text-[var(--user-accent)]" : "text-[var(--user-text-secondary)]"} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickView(product)}
                    aria-label={`Quick view ${product.name}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)]/95 shadow-sm backdrop-blur transition-colors hover:text-[var(--user-accent)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]"
                  >
                    <Eye size={17} className="text-[var(--user-text-secondary)]" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="flex flex-1 flex-col p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--user-text-muted)]">
                  {product.category}
                </p>
                <h3 className="mt-0.5 line-clamp-2 text-[13px] font-bold leading-snug text-[var(--user-text)] sm:text-sm">
                  {product.name}
                </h3>

                <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--user-text-muted)]">
                  <Star size={12} className="fill-amber-400 text-amber-400" aria-hidden="true" />
                  <span className="font-bold text-[var(--user-text-secondary)]">{product.rating}</span>
                  ({product.reviews.toLocaleString()})
                </div>

                <div className="mt-auto pt-2">
                  <div className="flex flex-wrap items-end gap-x-2">
                    <p className="text-base font-extrabold text-[var(--user-text)] sm:text-lg">
                      {formatPrice(product.price)}
                    </p>
                    {product.oldPrice && (
                      <p className="text-[11px] text-[var(--user-text-muted)] line-through">
                        {formatPrice(product.oldPrice)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => addToCart(product.name)}
                    aria-label={`Add ${product.name} to cart`}
                    className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--user-accent)] text-sm font-bold text-[var(--user-accent)] transition-all duration-200 hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
                  >
                    <ShoppingCart size={16} aria-hidden="true" />
                    Add
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Quick view modal */}
      <AnimatePresence>
        {quickView && (
          <>
            <motion.button
              key="qv-backdrop"
              aria-label="Close quick view"
              className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setQuickView(null)}
            />
            <motion.div
              key="qv-panel"
              role="dialog"
              aria-modal="true"
              aria-label={`Quick view: ${quickView.name}`}
              initial={{ opacity: 0, y: 32, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed left-1/2 top-1/2 z-[71] max-h-[92vh] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--user-text-muted)]">
                  {quickView.category}
                </p>
                <button
                  type="button"
                  onClick={() => setQuickView(null)}
                  aria-label="Close"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--user-text-muted)] transition-colors hover:bg-[var(--user-bg-hover)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <Image
                src={quickView.img}
                alt={`${quickView.name} — sample product photo`}
                width={400}
                height={300}
                className="mt-2 h-44 w-full rounded-xl object-cover"
              />
              <h3 className="mt-3 text-lg font-extrabold text-[var(--user-text)]">{quickView.name}</h3>
              <div className="mt-1 flex items-center gap-1 text-xs text-[var(--user-text-muted)]">
                <Star size={13} className="fill-amber-400 text-amber-400" aria-hidden="true" />
                <span className="font-bold text-[var(--user-text-secondary)]">{quickView.rating}</span>
                · {quickView.reviews.toLocaleString()} reviews
              </div>
              <div className="mt-3 flex items-end gap-3">
                <p className="text-2xl font-extrabold text-[var(--user-accent)]">{formatPrice(quickView.price)}</p>
                {quickView.oldPrice && (
                  <p className="pb-0.5 text-sm text-[var(--user-text-muted)] line-through">{formatPrice(quickView.oldPrice)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  addToCart(quickView.name);
                  setQuickView(null);
                }}
                className="landing-btn landing-btn-primary mt-4 w-full justify-center"
              >
                <ShoppingCart size={18} aria-hidden="true" />
                Add to Cart
              </button>
              <p className="mt-3 text-center text-[11px] text-[var(--user-text-muted)]">
                Cash on Delivery · 7-day easy return
              </p>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
}
