"use client";

import { useRouter } from "next/navigation";
import { X, Plus, Minus, Trash2, ShoppingBag, Package, Truck } from "lucide-react";
import { useCart } from "./CartContext";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

export default function CartDrawer() {
  const router = useRouter();
  const { cart, isCartOpen, setIsCartOpen, updateQty, removeFromCart, total, count } = useCart();

  // ✅ Image URL helper
  const getImgUrl = (img) => {
    const raw = typeof img === "string" ? img : img?.img_url;
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${API_ORIGIN}${path}`;
  };

  const shipping = total >= 5000 ? 0 : 200; // ✅ 250 se 200 kar diya
  const grandTotal = total + shipping;
  const freeShippingLeft = Math.max(0, 5000 - total);

  return (
    <>
      {/* OVERLAY */}
      {isCartOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
          onClick={() => setIsCartOpen(false)}
        />
      )}

      {/* DRAWER */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-[var(--user-bg-elevated)] z-50 shadow-[var(--user-shadow-lg)] transition-transform duration-300 flex flex-col ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 sm:py-5 border-b border-[var(--user-border)] shrink-0">
          <div>
            <h2 className="text-[var(--user-text)] font-bold flex items-center gap-2 text-base sm:text-lg">
              <ShoppingBag size={18} className="text-[var(--user-accent)]" />
              Shopping Cart
            </h2>
            <p className="text-[11px] sm:text-xs text-[var(--user-text-muted)] mt-0.5">
              {count} {count === 1 ? "item" : "items"}
            </p>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="w-9 h-9 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center hover:bg-[var(--user-bg-hover)] transition"
          >
            <X size={16} className="text-[var(--user-text)]" />
          </button>
        </div>

        {/* FREE SHIPPING PROGRESS BAR */}
        {cart.length > 0 && freeShippingLeft > 0 && (
          <div className="px-5 sm:px-6 py-3 bg-[var(--user-bg-card)] border-b border-[var(--user-border)]">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-[var(--user-text-muted)] flex items-center gap-1.5">
                <Truck size={13} className="text-[var(--user-accent)]" />
                Add Rs. {freeShippingLeft.toLocaleString()} more for free shipping
              </span>
              <span className="text-[var(--user-accent)] font-bold">
                {Math.round(((5000 - freeShippingLeft) / 5000) * 100)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--user-bg-hover)] overflow-hidden">
              <div
                className="h-full bg-[var(--user-accent)] rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, ((5000 - freeShippingLeft) / 5000) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {cart.length > 0 && shipping === 0 && (
          <div className="px-5 sm:px-6 py-2.5 bg-[var(--user-success)]/10 border-b border-[var(--user-success)]/20">
            <p className="text-[11px] font-semibold text-[var(--user-success)] flex items-center gap-1.5">
              <Truck size={13} />
              You've unlocked FREE shipping!
            </p>
          </div>
        )}

        {/* ITEMS */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 sm:py-5 space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <div className="w-20 h-20 rounded-full bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center mb-5">
                <Package size={32} className="text-[var(--user-accent)]/60" />
              </div>
              <p className="text-[var(--user-text)] font-semibold mb-1">Your cart is empty</p>
              <p className="text-[var(--user-text-muted)] text-sm mb-6 max-w-[260px] leading-relaxed">
                Browse our collection and add your favorite products.
              </p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-[var(--user-accent-hover)] active:scale-95 transition"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            cart.map((item) => {
              const imgUrl = getImgUrl(item.image);
              const lineTotal = item.price * item.qty;

              return (
                <div
                  key={item.key}
                  className="flex gap-3 bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-xl p-3 group hover:border-[var(--user-accent)]/40 transition"
                >
                  {/* REAL IMAGE */}
                  <div className="w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-lg bg-[var(--user-bg-hover)] overflow-hidden shrink-0 flex items-center justify-center border border-[var(--user-border)]">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package size={24} className="text-[var(--user-text-subtle)]" />
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[var(--user-text)] text-sm font-semibold truncate leading-tight">
                          {item.name}
                        </p>
                        {item.variantTitle && (
                          <p className="text-[var(--user-text-muted)] text-xs mt-0.5 truncate">
                            {item.variantTitle}
                          </p>
                        )}
                        {item.brand && (
                          <p className="text-[var(--user-accent)] text-[10px] uppercase tracking-wider mt-1 font-semibold">
                            {item.brand}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeFromCart(item.key)}
                        className="p-1.5 rounded-md text-[var(--user-text-subtle)] hover:text-[var(--user-danger)] hover:bg-[var(--user-danger)]/10 transition opacity-0 group-hover:opacity-100 sm:opacity-100"
                        aria-label="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Qty + Price Row */}
                    <div className="flex items-center justify-between mt-auto pt-2">
                      <div className="flex items-center rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-hover)]">
                        <button
                          onClick={() => updateQty(item.key, item.qty - 1)}
                          className="p-1.5 text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition active:scale-90"
                          aria-label="Decrease quantity"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="text-[var(--user-text)] text-xs font-bold w-7 text-center">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => updateQty(item.key, item.qty + 1)}
                          className="p-1.5 text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition active:scale-90"
                          aria-label="Increase quantity"
                        >
                          <Plus size={13} />
                        </button>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] sm:text-xs text-[var(--user-text-subtle)]">
                          Rs. {item.price.toLocaleString()} each
                        </p>
                        <p className="text-[var(--user-accent)] text-sm font-bold">
                          Rs. {lineTotal.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        {cart.length > 0 && (
          <div className="border-t border-[var(--user-border)] bg-[var(--user-bg-card)] shrink-0 pb-[env(safe-area-inset-bottom)]">
            <div className="px-5 sm:px-6 py-4 sm:py-5 space-y-3">
              {/* Subtotal */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--user-text-muted)]">Subtotal</span>
                <span className="text-[var(--user-text)] font-semibold">
                  Rs. {total.toLocaleString()}
                </span>
              </div>

              {/* Shipping */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--user-text-muted)] flex items-center gap-1.5">
                  Shipping
                  {shipping === 0 && (
                    <span className="text-[10px] font-bold text-[var(--user-success)] bg-[var(--user-success)]/10 border border-[var(--user-success)]/30 px-1.5 py-0.5 rounded">
                      FREE
                    </span>
                  )}
                </span>
                <span className="text-[var(--user-text)] font-semibold">
                  {shipping === 0 ? "Rs. 0" : `Rs. ${shipping}`}
                </span>
              </div>

              {/* Divider */}
              <div className="h-px bg-[var(--user-border)]" />

              {/* Grand Total */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[var(--user-text)] font-bold">Total</span>
                <span className="text-xl sm:text-2xl font-black text-[var(--user-accent)]">
                  Rs. {grandTotal.toLocaleString()}
                </span>
              </div>

              {/* Checkout Button — ✅ onClick add kiya */}
              <button
                onClick={() => { setIsCartOpen(false); router.push("/checkout"); }}
                className="w-full bg-[var(--user-accent)] text-[var(--user-accent-text)] py-3.5 rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-[var(--user-accent-hover)] active:scale-[0.98] transition"
              >
                Proceed to Checkout
              </button>

              <button
                onClick={() => setIsCartOpen(false)}
                className="w-full py-2 text-xs text-[var(--user-text-muted)] hover:text-[var(--user-text)] transition"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}