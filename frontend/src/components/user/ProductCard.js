"use client";

import { useState } from "react";
import Link from "next/link";


import { Heart, Plus, Check, Package, Tag } from "lucide-react";
import { useCart } from "./CartContext";
import { useWishlist } from "./WishlistContext";
import { useDiscounts } from "./DiscountContext";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `${API_ORIGIN}${url}`;
};

export default function ProductCard({ product }) {
  const [added, setAdded] = useState(false);
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();


  const { calculateProductDiscount } = useDiscounts();

  const productId = product._id || product.id;
  const liked = isWishlisted(productId);

  const variants = product.variants || [];
  const firstVariant = variants[0];
  const image = firstVariant?.images?.[0]?.img_url;

  const variantPrice = Number(
    firstVariant?.selling_price || product.price || 0,
  );
  const variantOldPrice = Number(firstVariant?.price || 0);

  // ✅ Admin + product discount — best one pick karo
  const disc = calculateProductDiscount(product, variantPrice);
  const price = disc.discountedPrice;
  const oldPrice = disc.hasDiscount ? disc.originalPrice : variantOldPrice;



  const totalStock = variants.length
    ? variants.reduce((s, v) => s + Number(v.quantity || 0), 0)
    : 99;

  const brandName = product.brand_id?.name || product.brand || "";
  const out = totalStock < 1;

  // ✅ Add to cart + feedback (✓ icon 1.2s)
  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (out) return;
    addToCart(product, firstVariant, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <Link
      href={`/product/${productId}`}
      className="group relative block bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-2xl overflow-hidden hover:border-[var(--user-accent)]/50 hover:-translate-y-0.5 hover:shadow-[var(--user-shadow-md)] transition-all duration-300"
    >
      {/* ==========================================
          IMAGE — square, clean
      ========================================== */}
      <div className="relative aspect-square bg-[var(--user-bg-hover)] overflow-hidden">
        {image ? (
          <img
            src={getImageUrl(image)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={44} className="text-[var(--user-text-subtle)]" />
          </div>
        )}

        {/* Hover gradient — plus button ke peeche depth */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition pointer-events-none" />



                {/* BADGES — top left */}
        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5 items-start">
          {disc.hasDiscount && (
            <span className="bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Tag size={9} />
              {disc.discountType === "percentage"
                ? `-${disc.discountValue}%`
                : disc.discountType === "fixed_price"
                  ? `Fixed Rs.${disc.discountValue}`
                  : `-Rs.${disc.discountValue}`}
            </span>
          )}
          {out ? (
            <span className="bg-[var(--user-danger)] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              OUT OF STOCK
            </span>
          ) : totalStock < 5 ? (
            <span className="bg-[var(--user-warning)] text-black text-[10px] font-bold px-2 py-0.5 rounded-full">
              LOW STOCK
            </span>
          ) : null}
        </div>



        {/* ✅ HEART — wishlist (database linked) */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(productId);
          }}
          aria-label="Add to wishlist"
          className="absolute top-2.5 right-2.5 z-10 w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center hover:bg-black/60 transition"
        >
          <Heart
            size={15}
            className={
              liked
                ? "text-[var(--user-danger)] fill-[var(--user-danger)]"
                : "text-white"
            }
          />
        </button>

        {/* ✅ ADD TO CART — bottom right plus (hover par slide-in) */}
        <button
          onClick={handleAdd}
          disabled={out}
          aria-label="Add to cart"
          className={`absolute bottom-2.5 right-2.5 z-10 w-10 h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 active:scale-90 ${
            out
              ? "bg-[var(--user-bg-hover)] text-[var(--user-text-disabled)] cursor-not-allowed"
              : added
              ? "bg-[var(--user-success)] text-white"
              : "bg-[var(--user-accent)] text-[var(--user-accent-text)] hover:scale-105"
          } md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0`}
        >
          {added ? <Check size={18} /> : <Plus size={18} />}
        </button>
      </div>

      {/* ==========================================
          DETAILS — brand + title + price (clean)
      ========================================== */}
      <div className="p-3 lg:p-4">
        {/* Brand */}
       <p className="text-[var(--user-text-subtle)] text-[10px] uppercase tracking-wider font-bold mb-1 truncate">
  {brandName || ""}
</p>

        {/* Title */}
        <h3 className="text-[var(--user-text)] font-medium text-sm lg:text-[15px] line-clamp-2 leading-snug min-h-[2.6em]">
          {product.name}
        </h3>

        {/* Price */}
        <div className="mt-2 flex items-baseline gap-2">
          <h4 className="text-base lg:text-lg font-bold text-[var(--user-text)]">
            Rs. {price.toLocaleString()}
          </h4>
          {oldPrice > price && (
            <span className="text-[11px] lg:text-xs text-[var(--user-text-subtle)] line-through">
              Rs. {oldPrice.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}