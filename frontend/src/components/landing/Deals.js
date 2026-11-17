"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, ShoppingCart, Star } from "lucide-react";
import ProductImage from "./ProductImage";
import SectionHeading from "./SectionHeading";
import { useLanding } from "./LandingContext";
import { FLASH_DEALS, formatPrice } from "./data";

/* Deal countdown — ends at local midnight (placeholder logic) */
function useCountdown() {
  const [left, setLeft] = useState({ h: "00", m: "00", s: "00" });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      let diff = Math.max(0, Math.floor((end - now) / 1000));
      const h = String(Math.floor(diff / 3600)).padStart(2, "0");
      diff %= 3600;
      const m = String(Math.floor(diff / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      setLeft({ h, m, s });
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return left;
}

export default function Deals() {
  const { h, m, s } = useCountdown();
  const { addToCart } = useLanding();

  return (
    <section
      id="deals"
      aria-labelledby="deals-title"
      className="scroll-mt-24 border-y border-[var(--user-border)] bg-[var(--user-bg-card)] py-12"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow={
            <span className="inline-flex items-center gap-1.5">
              <Zap size={13} aria-hidden="true" /> Limited time
            </span>
          }
          title="Flash Deals"
          action={
            <div className="flex items-center gap-2" role="timer" aria-label="Deal ends in">
              <span className="hidden text-xs font-bold uppercase tracking-wide text-[var(--user-text-muted)] sm:inline">
                Ends in
              </span>
              {[h, m, s].map((unit, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b0f14] font-mono text-lg font-extrabold tabular-nums text-white">
                    {unit}
                  </span>
                  {i < 2 && <span className="font-extrabold text-[var(--user-text-muted)]">:</span>}
                </span>
              ))}
            </div>
          }
        />

        {/* Horizontal scroll — swipe on touch */}
        <div className="deals-scroll -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          {FLASH_DEALS.map((product) => (
            <article
              key={product.id}
              className="group/card landing-card w-[210px] shrink-0 overflow-hidden sm:w-[230px]"
            >
              <ProductImage
                src={product.img}
                alt={`${product.name} — sample product photo`}
                className="h-40 w-full sm:h-44"
                sizes="230px"
              />
              <div className="p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--user-text-muted)]">
                  {product.category}
                </p>
                <h3 className="mt-0.5 line-clamp-2 min-h-[2.4em] text-sm font-bold leading-snug text-[var(--user-text)]">
                  {product.name}
                </h3>

                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[var(--user-text-muted)]">
                  <span className="flex items-center gap-0.5 font-bold text-[var(--user-text-secondary)]">
                    <Star size={12} className="fill-amber-400 text-amber-400" aria-hidden="true" />
                    {product.rating}
                  </span>
                  ({product.reviews.toLocaleString()})
                </div>

                <div className="mt-1.5 flex items-end gap-2">
                  <p className="text-lg font-extrabold text-[var(--user-accent)]">{formatPrice(product.price)}</p>
                  <p className="text-[11px] text-[var(--user-text-muted)] line-through">{formatPrice(product.oldPrice)}</p>
                  <span className="deal-badge mb-0.5 rounded px-1.5 py-0.5 text-[10px] font-extrabold">{product.badge}</span>
                </div>

                <button
                  type="button"
                  onClick={() => addToCart(product.name)}
                  aria-label={`Add ${product.name} to cart`}
                  className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--user-accent)] text-sm font-bold text-[var(--user-accent-text)] transition-all duration-200 hover:bg-[var(--user-accent-hover)] active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
                >
                  <ShoppingCart size={16} aria-hidden="true" />
                  Add to Cart
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
