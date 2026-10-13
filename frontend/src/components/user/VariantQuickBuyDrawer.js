"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  X,
  Minus,
  Plus,
  ShoppingCart,
  Zap,
  Check,
  Package,
} from "lucide-react";
import { useCart } from "./CartContext";
import { useQuickBuy } from "./QuickBuyContext";
import { getEffectiveMinQuantity } from "@/utils/dealCalculator";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const getImgUrl = (img) => {
  const raw = typeof img === "string" ? img : img?.img_url;
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  return `${API_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (n) => `Rs. ${Math.round(n).toLocaleString()}`;

/* ============================================================
   VariantQuickBuyDrawer — CartDrawer jaisa right-side drawer.
   Layout me ek baar mounted (hamesha DOM me, translate se open/close
   — bilkul CartDrawer wali tarah). ProductCard openQuickBuy se kholta hai.
   - Saare variants list, select + qty stepper
   - Footer: Add to Cart (sirf cart me add) + Buy Now (→ /checkout)
   ============================================================ */
export default function VariantQuickBuyDrawer() {
  const quick = useQuickBuy();
  const drawerRef = useRef(null);

  const open = quick?.open ?? false;
  const product = quick?.product ?? null;
  const dealInfo = quick?.dealInfo ?? null;
  const seq = quick?.seq ?? 0;
  const closeQuickBuy = quick?.closeQuickBuy;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeQuickBuy?.();
    };
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => drawerRef.current?.focus());
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeQuickBuy]);

  if (!quick) return null;

  const productKey = product
    ? String(product._id || product.id || "item")
    : "empty";

  return (
    <>
      <div
        aria-hidden="true"
        onClick={closeQuickBuy}
        className={`fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Choose options"
        className={`fixed top-0 right-0 z-50 flex h-full w-full flex-col overflow-hidden bg-[var(--user-bg-elevated)] shadow-[var(--user-shadow-md)] outline-none transition-transform duration-200 ease-out sm:w-[420px] ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {product ? (
          <QuickBuyBody
            key={`${productKey}-${seq}`}
            product={product}
            dealInfo={dealInfo}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)]">
              <Package
                size={36}
                aria-hidden="true"
                className="text-[var(--user-text-subtle)]"
              />
            </div>
            <h3 className="text-base font-semibold text-[var(--user-text)]">
              No product selected
            </h3>
          </div>
        )}
      </div>
    </>
  );
}

function QuickBuyBody({ product, dealInfo }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { closeQuickBuy } = useQuickBuy() || {};

  const variants = product?.variants?.length ? product.variants : [];
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const optionButtonsRef = useRef([]);

  const selected = variants[selectedIdx] || null;
  const stock = selected ? toNum(selected.quantity) : 0;
  const out = stock < 1;
  const maxQty = stock > 0 ? stock : 1;
  const requiredDealQty = dealInfo
    ? getEffectiveMinQuantity({
        type: dealInfo.dealType,
        minQuantity: dealInfo.minQuantity,
        buyQuantity: dealInfo.buyQuantity,
      })
    : 1;
  const selectedPrice = selected ? toNum(selected.selling_price) : 0;
  const selectedOld = selected ? toNum(selected.price) : 0;
  const firstInStockIndex = variants.findIndex((variant) => toNum(variant.quantity) > 0);
  const activeTabIndex = !out ? selectedIdx : firstInStockIndex;

  const clampQty = (n) => setQty(Math.min(Math.max(1, n), maxQty));

  const moveOptionSelection = (event, currentIndex) => {
    const direction = ["ArrowDown", "ArrowRight"].includes(event.key)
      ? 1
      : ["ArrowUp", "ArrowLeft"].includes(event.key)
        ? -1
        : 0;
    if (!direction) return;
    event.preventDefault();

    const availableIndices = variants
      .map((variant, index) => (toNum(variant.quantity) > 0 ? index : -1))
      .filter((index) => index >= 0);
    if (!availableIndices.length) return;

    const currentPosition = availableIndices.indexOf(currentIndex);
    const nextPosition = currentPosition < 0
      ? (direction > 0 ? 0 : availableIndices.length - 1)
      : (currentPosition + direction + availableIndices.length) % availableIndices.length;
    const nextIndex = availableIndices[nextPosition];
    setSelectedIdx(nextIndex);
    setQty(1);
    requestAnimationFrame(() => optionButtonsRef.current[nextIndex]?.focus());
  };

  // Sirf cart me add — koi drawer open / navigate nahi
  const handleAddToCart = (e) => {
    e?.stopPropagation?.();
    if (out || !selected) return;
    addToCart(product, selected, qty, dealInfo || null);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  // Cart me add + seedha checkout page
  const handleBuyNow = (e) => {
    e?.stopPropagation?.();
    if (out || !selected) return;
    addToCart(product, selected, qty, dealInfo || null);
    closeQuickBuy?.();
    if (dealInfo && qty < getEffectiveMinQuantity({
      type: dealInfo.dealType,
      minQuantity: dealInfo.minQuantity,
      buyQuantity: dealInfo.buyQuantity,
    })) {
      toast.info("This deal needs more items. Complete the quantity in your cart before checkout.");
      router.push("/cart");
      return;
    }
    router.push("/checkout");
  };

  const headerImage = getImgUrl(
    selected?.images?.[0]?.img_url || product?.image || product?.images?.[0]?.img_url || "",
  );

  return (
    <>
      <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-[var(--user-border)] bg-[var(--user-bg-elevated)] px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--user-bg-hover)]">
            {headerImage ? (
              <img src={headerImage} alt={product.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <Package size={18} aria-hidden="true" className="text-[var(--user-text-muted)]" />
            )}
          </span>
          <span className="min-w-0">
            <h2 className="line-clamp-1 text-base font-semibold text-[var(--user-text)]">{product.name}</h2>
            <p className="mt-0.5 truncate text-xs text-[var(--user-text-muted)]">{selected?.title || selected?.sku || "Select an option"}</p>
          </span>
        </div>
        <button
          type="button"
          onClick={closeQuickBuy}
          aria-label="Close options"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--user-text-muted)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-border-hover)]"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5" aria-live="polite">
        <div className="flex flex-col gap-5">
          <section aria-label="Product options">
            <p className="mb-2 text-xs font-medium text-[var(--user-text-muted)]">Options ({variants.length})</p>
            <div
              role="radiogroup"
              aria-label="Product options"
              className={`space-y-2 ${variants.length >= 6 ? "max-h-[50vh] overflow-y-auto overscroll-contain" : ""}`}
            >
              {variants.map((variant, index) => {
                const variantStock = toNum(variant.quantity);
                const variantOut = variantStock < 1;
                const isSelected = index === selectedIdx;
                const image = getImgUrl(variant.images?.[0]?.img_url || "");
                const price = toNum(variant.selling_price);
                return (
                  <button
                    key={variant._id || index}
                    ref={(element) => { optionButtonsRef.current[index] = element; }}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={index === activeTabIndex ? 0 : -1}
                    disabled={variantOut}
                    onClick={() => {
                      setSelectedIdx(index);
                      setQty(1);
                    }}
                    onKeyDown={(event) => moveOptionSelection(event, index)}
                    className={`flex h-14 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5 ring-1 ring-[var(--user-accent)]/30"
                        : "border-[var(--user-border)] bg-[var(--user-bg-card)] hover:bg-[var(--user-bg-hover)]"
                    } ${variantOut ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--user-bg-hover)]">
                      {image ? (
                        <img src={image} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <Package size={17} aria-hidden="true" className="text-[var(--user-text-muted)]" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--user-text)]">
                      {variant.title || variant.sku || `Option ${index + 1}`}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {variantOut && <span className="rounded bg-[var(--user-bg-hover)] px-1.5 py-0.5 text-[10px] text-[var(--user-text-muted)]">Out of stock</span>}
                      {!variantOut && variantStock < 5 && <span className="text-[10px] text-[var(--user-text-muted)]">Only {variantStock} left</span>}
                      <span className="text-sm font-medium tabular-nums text-[var(--user-text)]">{fmt(price)}</span>
                    </span>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${isSelected ? "border-[var(--user-accent)] bg-[var(--user-accent)]" : "border-[var(--user-border)]"}`}>
                      {isSelected && <Check size={11} strokeWidth={2.5} className="text-[var(--user-accent-text)]" aria-hidden="true" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="flex items-center justify-between gap-4" aria-label="Quantity">
            <p className="text-xs font-medium text-[var(--user-text-muted)]">Quantity</p>
            <div className="flex h-9 items-center rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)]">
              <button
                type="button"
                onClick={() => clampQty(qty - 1)}
                disabled={qty <= 1}
                aria-label="Decrease quantity"
                className="flex h-9 w-9 items-center justify-center text-[var(--user-text-muted)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] disabled:opacity-30"
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <span className="w-10 text-center text-sm tabular-nums text-[var(--user-text)]">{qty}</span>
              <button
                type="button"
                onClick={() => clampQty(qty + 1)}
                disabled={qty >= maxQty}
                aria-label="Increase quantity"
                className="flex h-9 w-9 items-center justify-center text-[var(--user-text-muted)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] disabled:opacity-30"
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            </div>
          </section>
          {dealInfo && requiredDealQty > 1 && (
            <p role="status" className="text-xs font-medium text-amber-700 dark:text-amber-300">
              {qty < requiredDealQty
                ? `Add ${requiredDealQty - qty} more item${requiredDealQty - qty === 1 ? "" : "s"} to unlock this deal.`
                : `Deal unlocked at ${requiredDealQty} items.`}
            </p>
          )}

          <div className="flex items-center justify-between border-t border-[var(--user-border)] pt-4">
            <span className="text-sm font-medium text-[var(--user-text-muted)]">Total</span>
            <span className="text-lg font-semibold tabular-nums text-[var(--user-text)]">
              {fmt(selectedPrice * qty)}
              {selectedOld > selectedPrice && <span className="ml-2 text-xs font-normal text-[var(--user-text-muted)] line-through">{fmt(selectedOld * qty)}</span>}
            </span>
          </div>
        </div>
      </div>

      <footer className="sticky bottom-0 z-10 shrink-0 border-t border-[var(--user-border)] bg-[var(--user-bg-elevated)] pb-[env(safe-area-inset-bottom)]">
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={out}
              aria-label="Add selected option to cart"
              className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--user-accent)] text-sm font-medium text-[var(--user-accent-text)] transition-colors hover:bg-[var(--user-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
            >
              {added ? <Check size={16} aria-hidden="true" /> : <ShoppingCart size={16} aria-hidden="true" />}
              {added ? "Added!" : "Add to Cart"}
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={out}
              aria-label="Buy selected option now"
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-[var(--user-border)] bg-transparent text-sm font-medium text-[var(--user-text)] transition-colors hover:bg-[var(--user-bg-hover)] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-border-hover)]"
            >
              <Zap size={16} aria-hidden="true" />
              Buy Now
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
