"use client";

import { memo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { smartImageLoader } from "@/utils/smartImageLoader";
import {
  Heart,
  ShoppingCart,
  SlidersHorizontal,
  Check,
  Loader2,
  Package,
  Tag,
  Truck,
  PackageOpen,
  Sparkles,
  Star,
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
  const [adding, setAdding] = useState(false);
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
  let matchedDeal = null;

  try {
    const disc = calculateProductDiscount(
      product,
      variantPrice,
      showDealPricing,
      deal,
    );
    price = disc.discountedPrice;
    oldPrice = disc.hasDiscount ? disc.originalPrice : variantOldPrice;
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

  // Multi-variant (>1) → "Choose Options" drawer; single variant → direct Add / Buy.
  const hasMultipleVariants = variants.length > 1;
  const rating = Number(product.ratingSummary?.avg) || 0;
  const ratingCount = Number(product.ratingSummary?.count) || 0;
  const discountPercent =
    oldPrice > price && oldPrice > 0
      ? Math.round(((oldPrice - price) / oldPrice) * 100)
      : 0;

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
    setAdding(true);
    addToCart(product, firstVariant, 1, buildDealInfo());
    setTimeout(() => {
      setAdding(false);
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    }, 200);
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
      className="product-card group relative flex h-full min-w-0 flex-col overflow-hidden rounded-none border-0 bg-[var(--user-bg-card)] shadow-none transition-colors duration-200"
    >
      <div
        className="relative h-40 w-full shrink-0 overflow-hidden bg-[var(--user-bg-card)]"
      >
        {image && failedImage !== image ? (
          <Image
            src={getImageUrl(image)}
            alt={product.name}
            fill
            loader={smartImageLoader}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            priority={priority}
            fetchPriority={priority ? "high" : "auto"}
            className="object-cover object-center p-0 transition-transform duration-200 ease-out group-hover:scale-[1.02]"
            onError={() => setFailedImage(image)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={36} className="text-[var(--user-text-subtle)]" />
          </div>
        )}

        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5 items-start">
          {displayBadgeText && !hideDiscountBadge && (
            <span
              className={`flex max-w-full items-center gap-1 truncate rounded-full bg-[var(--user-accent-soft)] px-2 py-1 text-[0.6rem] text-[var(--user-accent)] font-normal`}
            >
              {badgeConfig?.icon ? (
                <badgeConfig.icon size={9} />
              ) : (
                <Tag size={9} />
              )}{" "}
              {displayBadgeText}
            </span>
          )}

          {out ? (
            <span
              className={`rounded-full bg-[var(--user-danger)] px-2 py-1 text-[0.6rem] text-white font-normal`}
            >
              OUT OF STOCK
            </span>
          ) : totalStock < 5 ? (
            <span
              className={`rounded-full bg-[var(--user-warning)] px-2 py-1 text-[0.6rem] text-black font-normal`}
            >
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
          className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)] text-[var(--user-icon-color)] shadow-sm transition-colors hover:bg-[var(--user-bg-hover)]"
        >
          <Heart
            size={14}
            className={
              liked
                ? "text-[var(--user-danger)] fill-[var(--user-danger)]"
                : "text-[var(--user-icon-color)]"
            }
          />
        </button>

        {/* Desktop actions reveal on hover/focus; touch actions render below the price. */}
        {!out && (
          <div className="product-card-action-overlay absolute inset-x-0 bottom-0 z-10 flex translate-y-full items-end gap-1.5 bg-gradient-to-t from-black/45 via-black/20 to-transparent p-2 opacity-0 transition-all duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
            {hasMultipleVariants ? (
              <button
                type="button"
                onClick={handleOpenOptions}
                aria-label={`Select options for ${product.name}`}
                className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] bg-[var(--user-accent)] px-[10px] text-[12.5px] font-semibold tracking-[0.1px] text-[var(--user-accent-text)] transition duration-150 hover:brightness-[0.92] hover:-translate-y-px active:scale-[0.98] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
              >
                <SlidersHorizontal size={14} className="shrink-0" />
                Select Options
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  disabled={adding}
                  aria-label={adding ? `Adding ${product.name} to cart` : added ? `${product.name} added to cart` : `Add ${product.name} to cart`}
                    className={`flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] px-[10px] text-xs font-semibold tracking-[0.1px] transition duration-150 hover:-translate-y-px active:scale-[0.98] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)] ${
                    added
                      ? "bg-[var(--user-success)] text-white"
                      : "bg-[var(--user-accent)] text-[var(--user-accent-text)] hover:brightness-[0.92]"
                  }`}
                >
                  {adding ? (
                    <Loader2 size={14} className="shrink-0 animate-spin" />
                  ) : added ? (
                    <Check size={14} className="shrink-0" />
                  ) : (
                    <ShoppingCart size={12} className="shrink-0" />
                  )}
                    <span className="product-card-add-label">{adding ? "Adding..." : added ? "Added" : "Add to Cart"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleQuickBuy}
                  aria-label={`Buy ${product.name} now`}
                  className="flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] border border-[#E5E7EB] bg-white px-[10px] text-xs font-semibold tracking-[0.1px] text-gray-900 transition duration-150 hover:-translate-y-px active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
                >
                  Buy Now
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-1">
        <p className="h-3 truncate text-[0.6rem] font-normal uppercase leading-3 tracking-[0.1em] text-[var(--user-text-subtle)]">
          {brandName || ""}
        </p>
        <h3
          className="line-clamp-2 h-7 text-[0.75rem] font-normal leading-[0.875rem] text-[var(--user-text)] sm:text-[0.8125rem]"
        >
          {product.name}
        </h3>

        {ratingCount > 0 ? (
          <div className="mb-0.5 flex h-3 items-center gap-1 text-[0.625rem] text-[var(--user-text-muted)]">
            <span className="flex items-center gap-px" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={10}
                  className={
                    star <= Math.round(rating)
                      ? "fill-amber-400 text-amber-400"
                      : "text-[var(--user-border-hover)]"
                  }
                />
              ))}
            </span>
            <span>{rating.toFixed(1)}</span>
            <span>({ratingCount})</span>
          </div>
        ) : null}

        <h4
          className="truncate text-[0.9rem] font-medium leading-4 text-[var(--user-accent)] sm:text-[0.9375rem]"
        >
          Rs. {price.toLocaleString()}
        </h4>
        <div className="flex h-3 items-center gap-1.5 overflow-hidden text-[0.625rem]">
          {oldPrice > price ? (
            <>
              <span className="truncate text-[var(--user-text-subtle)] line-through">
                Rs. {oldPrice.toLocaleString()}
              </span>
              {discountPercent > 0 ? (
                <span className={`shrink-0 text-[var(--user-accent)] font-normal`}>
                  -{discountPercent}%
                </span>
              ) : null}
            </>
          ) : null}
        </div>
        {mentionDeal && !showDealPricing ? (
          <div className="flex h-3 min-w-0 items-center">
            <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-[var(--user-accent-soft)] px-1.5 py-0.5 text-[0.575rem] font-normal text-[var(--user-accent)]">
              <Sparkles size={9} className="shrink-0" />
              <span className="truncate">Deal Price</span>
            </span>
          </div>
        ) : null}
        {!out ? (
          <div className="product-card-touch-actions mt-2">
            {hasMultipleVariants ? (
              <button
                type="button"
                onClick={handleOpenOptions}
                aria-label={`Select options for ${product.name}`}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--user-accent)] px-2 text-[13px] font-semibold text-[var(--user-accent-text)] transition duration-150 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
              >
                <SlidersHorizontal size={14} className="shrink-0" />
                Select Options
              </button>
            ) : (
              <button
                type="button"
                onClick={handleQuickAdd}
                disabled={adding}
                aria-label={adding ? `Adding ${product.name} to cart` : added ? `${product.name} added to cart` : `Add ${product.name} to cart`}
                className={`flex h-9 w-full items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition duration-150 active:scale-[0.98] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)] ${
                  added
                    ? "bg-[var(--user-success)] text-white"
                    : "bg-[var(--user-accent)] text-[var(--user-accent-text)]"
                }`}
              >
                {adding ? (
                  <Loader2 size={14} className="shrink-0 animate-spin" />
                ) : added ? (
                  <Check size={14} className="shrink-0" />
                ) : (
                  <ShoppingCart size={12} className="shrink-0" />
                )}
                <span className="product-card-add-label">{adding ? "Adding..." : added ? "Added" : "Add to Cart"}</span>
              </button>
            )}
          </div>
        ) : null}
        {children}
      </div>
    </Link>
  );
}

const ProductCard = memo(ProductCardInner);

export default ProductCard;
