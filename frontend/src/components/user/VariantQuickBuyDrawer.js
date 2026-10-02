"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Choose options"
        className={`fixed top-0 right-0 z-50 flex h-full w-full flex-col overflow-hidden bg-[var(--user-bg-elevated)] shadow-[var(--user-shadow-lg)] outline-none transition-transform duration-300 ease-in-out sm:w-[26.25rem] md:w-[28.75rem] ${open ? "translate-x-0" : "translate-x-full"}`}
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
            <h3 className="text-xl font-bold text-[var(--user-text)]">
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

  const selected = variants[selectedIdx] || null;
  const stock = selected ? toNum(selected.quantity) : 0;
  const out = stock < 1;
  const maxQty = stock > 0 ? stock : 1;

  const selectedPrice = selected ? toNum(selected.selling_price) : 0;
  const selectedOld = selected ? toNum(selected.price) : 0;

  const clampQty = (n) => setQty(Math.min(Math.max(1, n), maxQty));

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
    router.push("/checkout");
  };

  return (
    <>
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--user-border)] px-5 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)]">
            {getImgUrl(
              selected?.images?.[0]?.img_url ||
                product?.image ||
                product?.images?.[0]?.img_url ||
                "",
            ) ? (
              <img
                src={getImgUrl(
                  selected?.images?.[0]?.img_url ||
                    product?.image ||
                    product?.images?.[0]?.img_url ||
                    "",
                )}
                alt={product.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <Package
                size={20}
                aria-hidden="true"
                className="text-[var(--user-text-subtle)]"
              />
            )}
          </span>
          <span className="min-w-0">
            <h2 className="truncate text-base font-bold text-[var(--user-text)] sm:text-lg">
              {product.name}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--user-text-muted)]">
              Choose options
            </p>
          </span>
        </div>
        <button
          type="button"
          onClick={closeQuickBuy}
          aria-label="Close options"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--user-text-muted)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-6 sm:py-4"
        aria-live="polite"
      >
        <p className="mb-2 text-[0.6875rem] font-black uppercase tracking-[0.15em] text-[var(--user-text-muted)]">
          {variants.length} option{variants.length === 1 ? "" : "s"}
        </p>
        <ul className="m-0 list-none space-y-2 p-0">
          {variants.map((v, i) => {
            const vStock = toNum(v.quantity);
            const vOut = vStock < 1;
            const sel = i === selectedIdx;
            const img = getImgUrl(v.images?.[0]?.img_url || "");
            const vp = toNum(v.selling_price);
            return (
              <li key={v._id || i}>
                <button
                  type="button"
                  disabled={vOut}
                  onClick={() => {
                    setSelectedIdx(i);
                    setQty(1);
                  }}
                  aria-pressed={sel}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition active:scale-[0.99] ${
                    sel
                      ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5 shadow"
                      : "border-[var(--user-border)] bg-[var(--user-bg-card)] hover:border-[var(--user-accent)]/50"
                  } ${vOut ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-hover)]">
                    {img ? (
                      <img
                        src={img}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package
                        size={18}
                        aria-hidden="true"
                        className="text-[var(--user-text-subtle)]"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-semibold text-[var(--user-text)]">
                      {v.title || v.sku || `Option ${i + 1}`}
                    </span>
                    <span className="mt-0.5 block text-xs font-bold text-[var(--user-accent)]">
                      {fmt(vp)}
                      {vOut ? (
                        <span className="ml-2 font-semibold text-[var(--user-danger)]">
                          Out of stock
                        </span>
                      ) : vStock < 5 ? (
                        <span className="ml-2 font-semibold text-[var(--user-text-muted)]">
                          Only {vStock} left
                        </span>
                      ) : null}
                    </span>
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-[background,border-color,transform] duration-150 ${
                      sel
                        ? "border-[var(--user-accent)] bg-[var(--user-accent)]"
                        : "border-[var(--user-border)]"
                    }`}
                  >
                    {sel && (
                      <Check
                        size={12}
                        strokeWidth={3}
                        className="text-[var(--user-accent-text)]"
                      />
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 flex items-center justify-between">
          <p className="text-[0.6875rem] font-black uppercase tracking-[0.15em] text-[var(--user-text-muted)]">
            Quantity
          </p>
          <div className="flex items-center h-11 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)]">
            <button
              type="button"
              onClick={() => clampQty(qty - 1)}
              disabled={qty <= 1}
              aria-label="Decrease quantity"
              className="px-3.5 h-full text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition-colors disabled:opacity-30"
            >
              <Minus size={15} />
            </button>
            <span className="w-8 text-center text-sm font-bold text-[var(--user-text)]">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => clampQty(qty + 1)}
              disabled={qty >= maxQty}
              aria-label="Increase quantity"
              className="px-3.5 h-full text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition-colors disabled:opacity-30"
            >
              <Plus size={15} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl bg-[var(--user-bg-hover)] px-4 py-3">
          <span className="text-xs font-semibold text-[var(--user-text-muted)]">
            Total
          </span>
          <span className="text-base font-black text-[var(--user-accent)]">
            {fmt(selectedPrice * qty)}
            {selectedOld > selectedPrice && (
              <span className="ml-2 text-xs font-medium text-[var(--user-text-muted)] line-through">
                {fmt(selectedOld * qty)}
              </span>
            )}
          </span>
        </div>
      </div>

      <footer className="shrink-0 border-t border-[var(--user-border)] bg-[var(--user-bg-card)] pb-[env(safe-area-inset-bottom)]">
        <div className="px-5 py-3 sm:px-6">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={out}
              className={`h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)] ${
                added
                  ? "bg-[var(--user-success)] text-white"
                  : "bg-[var(--user-accent)] text-[var(--user-accent-text)] hover:opacity-90"
              }`}
            >
              {added ? <Check size={16} /> : <ShoppingCart size={16} />}
              {added ? "Added!" : "Add to Cart"}
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              disabled={out}
              className="h-12 rounded-xl border-2 border-[var(--user-accent)] text-[var(--user-accent)] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
            >
              <Zap size={16} />
              Buy Now
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
