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
  const [failedImage, setFailedImage] = useState("");
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
      className="group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[15px] border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-[var(--user-shadow-sm)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[var(--user-border-hover)] hover:shadow-[var(--user-shadow-md)]"
    >
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-[var(--user-bg-hover)]">
        {image && failedImage !== image ? (
          <Image
            src={getImageUrl(image)}
            alt={product.name}
            fill
            loader={smartImageLoader}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            priority={priority}
            fetchPriority={priority ? "high" : "auto"}
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            onError={() => setFailedImage(image)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={36} className="text-[var(--user-text-subtle)]" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5 items-start">
          {displayBadgeText && !hideDiscountBadge && (
            <span
              className="flex max-w-full items-center gap-1 truncate rounded-full bg-slate-900/80 px-2 py-1 text-[0.6rem] font-semibold text-white shadow-sm backdrop-blur-sm"
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
            <span className="flex max-w-full items-center gap-1 truncate rounded-full bg-[var(--user-accent)]/90 px-2 py-1 text-[0.6rem] font-semibold text-[var(--user-accent-text)]">
              <Tag size={9} /> {discountBadgeText || "Sale"}
            </span>
          )}

          {out ? (
            <span className="rounded-full bg-[var(--user-danger)] px-2 py-1 text-[0.6rem] font-semibold text-white">
              OUT OF STOCK
            </span>
          ) : totalStock < 5 ? (
            <span className="rounded-full bg-[var(--user-warning)] px-2 py-1 text-[0.6rem] font-semibold text-black">
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
          aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)] text-[var(--user-icon-color)] shadow-sm backdrop-blur-sm transition-colors hover:bg-[var(--user-bg-hover)]"
        >
          <Heart
            size={15}
            className={
              liked
                ? "text-[var(--user-danger)] fill-[var(--user-danger)]"
                : "text-[var(--user-icon-color)]"
            }
          />
        </button>

        {/* Hover quick actions — no plus icon.
            Multi-variant: only "Choose Options" (opens right-side drawer).
            Single variant: "Add to Cart" + "Buy Now".
            Desktop: reveal on hover. Mobile: always visible (no hover). */}
        {!out && (
          <div className="absolute inset-x-2 bottom-2 z-10 flex gap-1.5 transition-all duration-200 md:translate-y-1 md:opacity-0 md:group-hover:translate-y-0 md:group-hover:opacity-100">
            {hasMultipleVariants ? (
              <button
                onClick={handleOpenOptions}
                className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-[var(--user-accent)] px-2 text-[0.625rem] font-semibold text-[var(--user-accent-text)] shadow-sm transition hover:opacity-90 active:scale-[0.98] sm:gap-1.5 sm:text-[0.6875rem]"
              >
                <SlidersHorizontal size={14} className="shrink-0 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Choose Options
              </button>
            ) : (
              <>
                <button
                  onClick={handleQuickAdd}
                  className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-[0.625rem] font-semibold shadow-sm transition active:scale-[0.98] sm:gap-1.5 sm:text-[0.6875rem] ${
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
                  className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-white/20 bg-black/65 px-2 text-[0.625rem] font-semibold text-white shadow-sm backdrop-blur-sm transition hover:bg-black/75 active:scale-[0.98] sm:gap-1.5 sm:text-[0.6875rem]"
                >
                 
                  Buy Now
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-2.5 sm:p-3">
        <p className="mb-1 truncate text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[var(--user-text-subtle)]">
          {brandName || ""}
        </p>
        <h3 className="line-clamp-2 min-h-[2.5em] text-[0.8125rem] font-semibold leading-snug text-[var(--user-text)] sm:text-sm">
          {product.name}
        </h3>

        <div className="mt-auto flex min-w-0 flex-col items-start pt-2">
          <span
            className={`h-4 truncate text-[0.675rem] text-[var(--user-text-subtle)] line-through ${
              oldPrice > price ? "" : "invisible"
            }`}
            aria-hidden={oldPrice <= price}
          >
            Rs. {oldPrice.toLocaleString()}
          </span>
          <h4 className="max-w-full truncate text-[0.95rem] font-bold text-[var(--user-text)] sm:text-base">
            Rs. {price.toLocaleString()}
          </h4>
          <span className="mt-1 flex min-h-[1.125rem] max-w-full items-center">
            {mentionDeal ? (
              <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-[var(--user-accent-soft)] px-1.5 py-0.5 text-[0.575rem] font-medium text-[var(--user-accent)]">
                <Sparkles size={10} className="shrink-0" />
                <span className="truncate">Also available in deal</span>
              </span>
            ) : null}
          </span>
        </div>

        {children}
      </div>
    </Link>
  );
}

const ProductCard = memo(ProductCardInner);

export default ProductCard;
