"use client";

import { memo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { smartImageLoader } from "@/utils/smartImageLoader";
import {
  Heart,
  ShoppingCart,
  Zap,
  SlidersHorizontal,
  Check,
  Package,
  Tag,
  Truck,
  PackageOpen,
  Sparkles,
} from "lucide-react";
import { useCart } from "./CartContext";
import { useWishlist } from "./WishlistContext";
import { useDiscounts } from "./DiscountContext";
import { useQuickBuy } from "./QuickBuyContext";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `${API_ORIGIN}${url}`;
};

function getDealBadgeConfig(deal) {
  if (!deal) return null;

  const type = deal.type;
  const val = deal.discountValue || 0;
  const buyQty = deal.buyQuantity || 0;
  const getQty = deal.getQuantity || 0;

  // ✅ 0% / Rs. 0 OFF — off ho tabhi OFF badge dikhao, warna hide
  if ((type === "percentage" || type === "fixed_amount") && val <= 0) return null;

  if (type === "percentage")
    return {
      text: `${val}% OFF`,
      color: "bg-gradient-to-r from-green-500 to-emerald-600",
      icon: Tag,
    };
  if (type === "fixed_amount")
    return {
      text: `Rs. ${val} OFF`,
      color: "bg-gradient-to-r from-blue-500 to-cyan-600",
      icon: Tag,
    };
  if (type === "buy_x_get_y")
    return {
      text:
        buyQty > 0 && getQty > 0
          ? `Buy ${buyQty} Get ${getQty}`
          : "Buy X Get Y",
      color: "bg-gradient-to-r from-purple-500 to-pink-600",
      icon: PackageOpen,
    };
  if (type === "bundle")
    return {
      text: "Bundle Deal",
      color: "bg-gradient-to-r from-indigo-500 to-purple-600",
      icon: Package,
    };
  if (type === "free_shipping")
    return {
      text: "Free Shipping",
      color: "bg-gradient-to-r from-orange-500 to-red-600",
      icon: Truck,
    };

  return {
    text: deal.name || "Deal",
    color: "bg-gradient-to-r from-orange-500 to-red-600",
    icon: Tag,
  };
}

// ✅ memo: parent/context re-render par same-props cards skip (logic same)
function ProductCardInner({
  product,
  hideDiscountBadge = false,
  dealBadge = null,
  deal = null,
  dealId = null,
  showDealPricing = false,
  children,
  // ✅ LCP rows ke liye: pehli 1-2 cards priority (eager+high), baaki lazy — default same
  priority = false,
}) {
  const [added, setAdded] = useState(false);
  const router = useRouter();
  const { addToCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { calculateProductDiscount, getActiveDealForProduct } = useDiscounts();
  const { openQuickBuy } = useQuickBuy() || {};

  if (!product) return null;

  const productId = product._id || product.id;
  const liked = isWishlisted(productId);

  const variants = product.variants || [];
  const firstVariant = variants[0];

  const image =
    firstVariant?.images?.[0]?.img_url ||
    product.image ||
    product.images?.[0]?.img_url;
  const variantPrice = Number(
    firstVariant?.selling_price || product.price || product.selling_price || 0,
  );
  const variantOldPrice = Number(firstVariant?.price || product.price || 0);

  let price = variantPrice;
  let oldPrice = variantOldPrice;
  let hasDiscount = false;
  let matchedDeal = null;
  let discInfo = null; // ✅ poora discount object rakh lo

  try {
    const disc = calculateProductDiscount(
      product,
      variantPrice,
      showDealPricing,
      deal,
    );
    discInfo = disc;
    price = disc.discountedPrice;
    oldPrice = disc.hasDiscount ? disc.originalPrice : variantOldPrice;
    hasDiscount = disc.hasDiscount;
    matchedDeal = disc.matchedDeal;
  } catch (e) {
    // Discount calc fail → default prices (purana fallback, bina warn ke)
  }

  // ✅ When showDealPricing is false (regular listing), still detect deal membership
  // so we can show a subtle "Also available in deal" mention — without applying deal pricing.
  const mentionDeal = !showDealPricing
    ? deal || matchedDeal || getActiveDealForProduct(product)
    : null;

  const totalStock = variants.length
    ? variants.reduce((s, v) => s + Number(v.quantity || 0), 0)
    : product.quantity || 99;

  const brandName = product.brand_id?.name || product.brand || "";
  const out = totalStock < 1;

  const activeDeal = showDealPricing ? deal || matchedDeal : deal;
  const badgeConfig = activeDeal ? getDealBadgeConfig(activeDeal) : null;
  const displayBadgeText = badgeConfig?.text || dealBadge;

  // ✅ SIMPLE DISCOUNT BADGE — percentage / fixed amount / effective %
  let discountBadgeText = "";
  if (hasDiscount && !activeDeal) {
    const d = discInfo || {};
    const md = d.matchedDiscount || d.discount || null;
    const t = d.discountType || d.type || (md && md.type) || "";
    const v = Number(d.discountValue ?? d.value ?? (md && md.value) ?? 0);
    if (t === "percentage" && v > 0) {
      discountBadgeText = `${v}% OFF`;
    } else if ((t === "fixed_amount" || t === "fixed") && v > 0) {
      discountBadgeText = `Rs. ${v.toLocaleString()} OFF`;
    } else {
      const pct =
        oldPrice > 0 ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;
      if (pct > 0) discountBadgeText = `${pct}% OFF`;
    }
  }

  // Multi-variant (>1) → "Choose Options" drawer; single variant → direct Add / Buy.
  const hasMultipleVariants = variants.length > 1;

  const buildDealInfo = () => {
    if (!activeDeal) return null;
    const info = {
      dealId: activeDeal._id,
      dealType: activeDeal.type,
      dealName: activeDeal.name,
      dealBadge: badgeConfig?.text || null,
      savings: price > 0 ? oldPrice - price : 0,
      originalPrice: oldPrice,
      dealDiscountValue: Number(activeDeal.discountValue) || 0,
      minQuantity: Number(activeDeal.minQuantity) || 1,
    };
    if (activeDeal.type === "buy_x_get_y") {
      info.buyQuantity = activeDeal.buyQuantity;
      info.getQuantity = activeDeal.getQuantity;
    }
    return info;
  };

  // Single-variant: sirf cart me add (koi drawer open / navigate nahi)
  const handleQuickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (out) return;
    addToCart(product, firstVariant, 1, buildDealInfo());
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  // Single-variant: add + go straight to checkout
  const handleQuickBuy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (out) return;
    addToCart(product, firstVariant, 1, buildDealInfo());
    router.push("/checkout");
  };

  // Multi-variant: global options drawer kholo (CartDrawer jaisa)
  const handleOpenOptions = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (out) return;
    openQuickBuy?.(product, buildDealInfo());
  };

  return (
    <Link
      href={
        showDealPricing
          ? dealId
            ? `/product/${productId}?source=deal&deal=${encodeURIComponent(dealId)}`
            : `/product/${productId}?source=deal`
          : `/product/${productId}`
      }
      className="group relative flex flex-col h-full bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-2xl overflow-hidden transition-colors duration-300"
    >
      <div className="relative aspect-square bg-[var(--user-bg-hover)] overflow-hidden shrink-0">
        {image ? (
          <Image
            src={getImageUrl(image)}
            alt={product.name}
            fill
            loader={smartImageLoader}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            priority={priority}
            fetchPriority={priority ? "high" : "auto"}
            className="object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={44} className="text-[var(--user-text-subtle)]" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition pointer-events-none" />

        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5 items-start">
          {displayBadgeText && !hideDiscountBadge && (
            <span
              className={`${badgeConfig?.color || "bg-gradient-to-r from-red-500 to-orange-600"} text-white text-[0.625rem] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg`}
            >
              {badgeConfig?.icon ? (
                <badgeConfig.icon size={9} />
              ) : (
                <Tag size={9} />
              )}{" "}
              {displayBadgeText}
            </span>
          )}

          {/* ✅ SIMPLE DISCOUNT — ab value dikhegi, sirf "Sale" nahi */}
          {!displayBadgeText && hasDiscount && !hideDiscountBadge && (
            <span className="bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[0.625rem] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
              <Tag size={9} /> {discountBadgeText || "Sale"}
            </span>
          )}

          {out ? (
            <span className="bg-[var(--user-danger)] text-white text-[0.625rem] font-bold px-2 py-0.5 rounded-full">
              OUT OF STOCK
            </span>
          ) : totalStock < 5 ? (
            <span className="bg-[var(--user-warning)] text-black text-[0.625rem] font-bold px-2 py-0.5 rounded-full">
              LOW STOCK
            </span>
          ) : null}
        </div>

        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleWishlist(productId);
          }}
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

        {/* Hover quick actions — no plus icon.
            Multi-variant: only "Choose Options" (opens right-side drawer).
            Single variant: "Add to Cart" + "Buy Now".
            Desktop: reveal on hover. Mobile: always visible (no hover). */}
        {!out && (
          <div className="absolute inset-x-2.5 bottom-2.5 z-10 flex gap-1.5 md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 transition-all duration-300">
            {hasMultipleVariants ? (
              <button
                onClick={handleOpenOptions}
                className="flex-1 min-w-0 h-8 sm:h-9 lg:h-10 rounded-lg sm:rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[0.625rem] sm:text-[0.6875rem] lg:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap shadow-lg hover:opacity-90 active:scale-[0.98] transition"
              >
                <SlidersHorizontal size={14} className="shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Choose Options
              </button>
            ) : (
              <>
                <button
                  onClick={handleQuickAdd}
                  className={`flex-1 min-w-0 h-8 sm:h-9 lg:h-10 rounded-lg sm:rounded-xl text-[0.625rem] sm:text-[0.6875rem] lg:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap shadow-lg active:scale-[0.98] transition ${
                    added
                      ? "bg-[var(--user-success)] text-white"
                      : "bg-[var(--user-accent)] text-[var(--user-accent-text)] hover:opacity-90"
                  }`}
                >
                  {added ? (
                    <Check size={14} className="shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  ) : (
                    <ShoppingCart size={14} className="shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  )}
                  {added ? "Added!" : "Cart"}
                </button>
                <button
                  onClick={handleQuickBuy}
                  className="flex-1 min-w-0 h-8 sm:h-9 lg:h-10 rounded-lg sm:rounded-xl bg-black/60 backdrop-blur-sm border border-white/20 text-white text-[0.625rem] sm:text-[0.6875rem] lg:text-xs font-bold flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap shadow-lg hover:bg-black/75 active:scale-[0.98] transition"
                >
                 
                  Buy Now
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-3 lg:p-4 flex flex-col flex-1 min-w-0">
        <p className="text-[var(--user-text-subtle)] text-[0.625rem] uppercase tracking-wider font-bold mb-1 truncate">
          {brandName || ""}
        </p>
        <h3 className="text-[var(--user-text)] font-medium text-sm lg:text-[0.9375rem] line-clamp-2 leading-snug min-h-[2.6em]">
          {product.name}
        </h3>

        <div className="mt-auto pt-2 flex flex-col items-start min-w-0">
          {oldPrice > price && (
            <span className="text-[0.6875rem] lg:text-xs text-[var(--user-text-subtle)] line-through whitespace-nowrap">
              Rs. {oldPrice.toLocaleString()}
            </span>
          )}
          <h4 className="text-base lg:text-lg font-bold text-[var(--user-text)] whitespace-nowrap">
            Rs. {price.toLocaleString()}
          </h4>
          {mentionDeal && (
            <span className="mt-1 text-[0.625rem] font-semibold text-[var(--user-text-subtle)] flex items-center gap-1 whitespace-nowrap">
              <Sparkles size={10} className="text-orange-500" /> Also available
              in deal
            </span>
          )}
        </div>

        {children}
      </div>
    </Link>
  );
}

const ProductCard = memo(ProductCardInner);

export default ProductCard;
