  "use client";

  import { useEffect, useMemo, useState, useRef } from "react";
  import { useRouter } from "next/navigation";
  import Link from "next/link";

  import {
    X, Plus, Minus, Trash2, ShoppingBag, Package, Tag, Check,
    Sparkles, Loader2, Zap, Truck, PackageOpen, ChevronDown, ArrowRight,
  } from "lucide-react";
  import { toast } from "sonner";
  import { useQuery } from "@tanstack/react-query";          // ✅ ADD
import { shippingApi } from "@/apis/user/shippingApi"; 
  import { useCart } from "./CartContext";
  import { useDiscounts } from "./DiscountContext";
  import { calculateFreeItems, calculatePayableItems, calculateBuyXGetYSavings } from "@/utils/dealCalculator";

  const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
  const SHIPPING_FEE = 200;
  const QTY_DEBOUNCE_MS = 300;
  const REMOVE_ANIM_MS = 180;

  const fmt = (n) => `Rs. ${Math.round(n).toLocaleString()}`;

  const getImgUrl = (img) => {
    const raw = typeof img === "string" ? img : img?.img_url;
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    return `${API_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
  };

  function getDealBadgeConfig(deal) {
    if (!deal) return null;
    const type = deal.type;
    const val = deal.discountValue || 0;
    const buyQty = deal.buyQuantity || 0;
    const getQty = deal.getQuantity || 0;
    
    if (type === "percentage") return { text: `${val}% OFF`, color: "from-green-500 to-emerald-600", icon: Tag };
    if (type === "fixed_amount") return { text: `Rs. ${val} OFF`, color: "from-blue-500 to-cyan-600", icon: Tag };
    if (type === "buy_x_get_y") return { text: buyQty > 0 && getQty > 0 ? `Buy ${buyQty} Get ${getQty}` : "Buy X Get Y", color: "from-purple-500 to-pink-600", icon: PackageOpen };
    if (type === "bundle") return { text: "Bundle Deal", color: "from-indigo-500 to-purple-600", icon: Package };
    if (type === "free_shipping") return { text: "Free Shipping", color: "from-orange-500 to-red-600", icon: Truck };
    if (type === "flash_sale") return { text: "Flash Sale", color: "from-yellow-500 to-orange-600", icon: Zap };
    
    return { text: deal.name || "Deal", color: "from-orange-500 to-red-600", icon: Tag };
  }

  export default function CartDrawer() {
    const router = useRouter();
    const { cart, isCartOpen, setIsCartOpen, updateQty, removeFromCart, restoreItems } = useCart();
    const { calculateProductDiscount } = useDiscounts();

  // ✅ Shipping config (standard fee admin settings se)
  const { data: shipConfig } = useQuery({
    queryKey: ["shippingConfig"],
    queryFn: shippingApi.getConfig,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
    const drawerRef = useRef(null);
    const timersRef = useRef([]);
    const qtyTimers = useRef({});

    const [pendingQty, setPendingQty] = useState({});
    const [removingKeys, setRemovingKeys] = useState(() => new Set());
    // ✅ COLLAPSED DEAL SECTIONS
    const [collapsedDeals, setCollapsedDeals] = useState(() => new Set());

    const toggleDealCollapse = (dealId) => {
      setCollapsedDeals((prev) => {
        const next = new Set(prev);
        if (next.has(dealId)) next.delete(dealId);
        else next.add(dealId);
        return next;
      });
    };

    useEffect(() => {
      if (!isCartOpen) return;
      const onKey = (e) => { if (e.key === "Escape") setIsCartOpen(false); };
      window.addEventListener("keydown", onKey);
      requestAnimationFrame(() => drawerRef.current?.focus());
      return () => window.removeEventListener("keydown", onKey);
    }, [isCartOpen, setIsCartOpen]);

    useEffect(() => {
      const timers = timersRef.current;
      const qtyTimersMap = qtyTimers.current;
      return () => {
        timers.forEach(clearTimeout);
        Object.values(qtyTimersMap).forEach(clearTimeout);
      };
    }, []);

    const groupedItems = useMemo(() => {
      const dealGroups = new Map();
      const regularItems = [];

      cart.forEach((raw) => {
        const disc = calculateProductDiscount(
          {
            _id: raw.productId || raw.id,
            category_id: raw.categoryId || null,
            brand_id: raw.brandId || null,
            discount: raw.productDiscountPct || 0,
          },
          raw.price,
        );
        
        const qty = pendingQty[raw.key] ?? raw.qty;
        
        let freeItems = 0;
        let payableItems = qty;
        let dealSavings = 0;
        
        if (raw.dealType === "buy_x_get_y" && raw.dealBuyQuantity && raw.dealGetQuantity) {
          freeItems = calculateFreeItems(qty, raw.dealBuyQuantity, raw.dealGetQuantity);
          payableItems = calculatePayableItems(qty, raw.dealBuyQuantity, raw.dealGetQuantity);
          dealSavings = calculateBuyXGetYSavings(qty, disc.discountedPrice, raw.dealBuyQuantity, raw.dealGetQuantity);
        }

        const itemData = {
          raw,
          qty,
          key: raw.key,
          name: raw.name,
          brand: raw.brand,
          variantTitle: raw.variantTitle,
          image: raw.image,
          displayPrice: disc.discountedPrice,
          originalPrice: disc.originalPrice,
          hasDiscount: disc.hasDiscount || raw.dealType === "buy_x_get_y",
          savings: raw.dealType === "buy_x_get_y" ? (dealSavings / qty) : disc.savings,
          dealSavings,
          freeItems,
          payableItems,
          lineTotal: payableItems * disc.discountedPrice,
        };

        if (raw.dealId) {
          if (!dealGroups.has(raw.dealId)) {
            dealGroups.set(raw.dealId, {
              dealId: raw.dealId,
              dealType: raw.dealType,
              dealName: raw.dealName || "Deal",
              dealBadge: raw.dealBadge || getDealBadgeConfig({ type: raw.dealType, discountValue: raw.dealSavings, buyQuantity: raw.dealBuyQuantity, getQuantity: raw.dealGetQuantity })?.text,
              items: [],
              totalSavings: 0,
            });
          }
          const group = dealGroups.get(raw.dealId);
          group.items.push(itemData);
          group.totalSavings += dealSavings;
        } else {
          regularItems.push(itemData);
        }
      });

      return {
        deals: Array.from(dealGroups.values()),
        regular: regularItems,
      };
    }, [cart, pendingQty, calculateProductDiscount]);

    const totals = useMemo(() => {
      const allItems = [...groupedItems.deals.flatMap(d => d.items), ...groupedItems.regular];
      const subtotal = allItems.reduce((s, i) => s + i.lineTotal, 0);
      
      const totalSavings = allItems.reduce((s, i) => {
        if (i.raw.dealType === "buy_x_get_y") {
          return s + i.dealSavings;
        }
        if (i.originalPrice > i.displayPrice) {
          return s + (i.originalPrice - i.displayPrice) * i.qty;
        }
        return s;
      }, 0);

        const tax = Math.round(allItems.reduce((s, i) => s + i.displayPrice * i.payableItems * (Number(i.raw.tax || 0) / 100), 0));
    const hasFreeShippingDeal = allItems.some((i) => i.raw.dealType === "free_shipping");

    // ✅ Standard fee admin config se (fallback 200)
    const standardFee = Number(shipConfig?.standard?.fee ?? SHIPPING_FEE) || 0;
    const freeOver = Number(shipConfig?.free_shipping_over ?? 0) || 0;

    let shipping = hasFreeShippingDeal ? 0 : standardFee;
    if (!hasFreeShippingDeal && freeOver > 0 && subtotal >= freeOver) shipping = 0;

    const grandTotal = subtotal + shipping + tax;

    return { subtotal, totalSavings, tax, shipping, grandTotal, hasFreeShippingDeal };
  }, [groupedItems, shipConfig]);

    const count = cart.reduce((s, i) => s + (Number(i.qty) || 0), 0);
    const hasItems = cart.length > 0;

    const handleQtyChange = (key, next) => {
      if (next < 1) return;
      setPendingQty((prev) => ({ ...prev, [key]: next }));
      clearTimeout(qtyTimers.current[key]);
      qtyTimers.current[key] = setTimeout(() => {
        updateQty(key, next);
        setPendingQty((prev) => {
          const next_ = { ...prev };
          delete next_[key];
          return next_;
        });
        delete qtyTimers.current[key];
      }, QTY_DEBOUNCE_MS);
    };

    const handleRemove = (row) => {
      const key = row.key;
      setRemovingKeys((prev) => new Set(prev).add(key));
      const t = setTimeout(() => {
        removeFromCart(key);
        clearTimeout(qtyTimers.current[key]);
        delete qtyTimers.current[key];
        setPendingQty((prev) => {
          const next_ = { ...prev };
          delete next_[key];
          return next_;
        });
        setRemovingKeys((prev) => {
          const next_ = new Set(prev);
          next_.delete(key);
          return next_;
        });
        toast.success("Item removed", { action: { label: "Undo", onClick: () => restoreItems([row.raw]) } });
      }, REMOVE_ANIM_MS);
      timersRef.current.push(t);
    };

    const goCheckout = () => { setIsCartOpen(false); router.push("/checkout"); };
    const startShopping = () => { setIsCartOpen(false); router.push("/products"); };

    return (
      <>
        <div aria-hidden="true" onClick={() => setIsCartOpen(false)} className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${isCartOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} />

        <div ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Shopping cart" className={`fixed top-0 right-0 z-50 flex h-full w-full flex-col overflow-hidden bg-[var(--user-bg-elevated)] shadow-[var(--user-shadow-lg)] outline-none transition-transform duration-300 ease-in-out sm:w-[420px] md:w-[460px] ${isCartOpen ? "translate-x-0" : "translate-x-full"}`}>
          <span className="sr-only" aria-live="polite">{count} {count === 1 ? "item" : "items"} in cart</span>

          <header className="flex shrink-0 items-center justify-between border-b border-[var(--user-border)] px-5 py-4 sm:px-6">
                    <Link href="/cart" onClick={() => setIsCartOpen(false)} className="group/cartlink min-w-0">
              <h2 className="flex items-center gap-2.5 text-base font-bold text-[var(--user-text)] sm:text-lg group-hover/cartlink:text-[var(--user-accent)] transition-colors">
                <ShoppingBag size={20} aria-hidden="true" className="text-[var(--user-accent)]" />
                Shopping Cart
                <ArrowRight size={14} className="text-[var(--user-text-muted)] group-hover/cartlink:translate-x-0.5 group-hover/cartlink:text-[var(--user-accent)] transition-all" />
              </h2>
              <p className="mt-0.5 text-xs text-[var(--user-text-muted)] group-hover/cartlink:text-[var(--user-accent)] transition-colors">
                {count} {count === 1 ? "item" : "items"} · View full details
              </p>
            </Link>
            <button type="button" onClick={() => setIsCartOpen(false)} aria-label="Close cart" className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--user-text-muted)] transition-colors hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]">
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6" aria-live="polite">
            {hasItems ? (
              <div className="space-y-6">
                
                {groupedItems.deals.map((dealGroup, dealIndex) => {
                  const badgeConfig = getDealBadgeConfig({ type: dealGroup.dealType, discountValue: dealGroup.items[0]?.raw.dealSavings, buyQuantity: dealGroup.items[0]?.raw.dealBuyQuantity, getQuantity: dealGroup.items[0]?.raw.dealGetQuantity });
                  const Icon = badgeConfig?.icon || Sparkles;
                  const isCollapsed = collapsedDeals.has(dealGroup.dealId);
                  
                  return (
                    <div key={dealGroup.dealId || dealIndex} className="rounded-xl border border-purple-500/30 bg-purple-500/5 overflow-hidden">
                      {/* ✅ HEADER with Collapse Arrow (Top Left) */}
                      <div className={`flex items-center gap-2 px-3 py-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 ${!isCollapsed ? "border-b border-purple-500/20" : ""}`}>
                        {/* ✅ Collapse Toggle Button */}
                        <button
                          type="button"
                          onClick={() => toggleDealCollapse(dealGroup.dealId)}
                          aria-label={isCollapsed ? "Expand deal section" : "Collapse deal section"}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--user-text-muted)] hover:bg-purple-500/15 hover:text-[var(--user-text)] transition-colors"
                        >
                          <ChevronDown 
                            size={16} 
                            className={`transition-transform duration-300 ${isCollapsed ? "" : "rotate-180"}`} 
                          />
                        </button>

                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${badgeConfig?.color || "from-purple-500 to-pink-600"} flex items-center justify-center shrink-0`}>
                          <Icon size={16} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-[var(--user-text)] truncate">{dealGroup.dealName}</h3>
                          <p className="text-[10px] text-purple-600 font-semibold truncate">{dealGroup.dealBadge || "Active Deal"}</p>
                        </div>

                        {/* ✅ Items count jab collapsed ho */}
                        {isCollapsed && (
                          <span className="text-[10px] font-bold text-[var(--user-text-muted)] bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-2 py-0.5 rounded-full shrink-0">
                            {dealGroup.items.length} {dealGroup.items.length === 1 ? "item" : "items"}
                          </span>
                        )}

                                            {dealGroup.totalSavings > 0 && (
                          <span className="text-xs font-bold text-[var(--user-success)] shrink-0">
                            Save {fmt(dealGroup.totalSavings)}
                          </span>
                        )}
                      </div>

                      {/* ✅ Items List — sirf jab expanded ho */}
                      {!isCollapsed && (
                        <ul className="m-0 list-none space-y-2.5 p-3">
                          {dealGroup.items.map((row, index) => (
                            <CartItemRow
                              key={row.key}
                              row={row}
                              index={index}
                              imgUrl={getImgUrl(row.image)}
                              isRemoving={removingKeys.has(row.key)}
                              isCommitting={pendingQty[row.key] !== undefined && pendingQty[row.key] !== row.raw.qty}
                              onQtyChange={handleQtyChange}
                              onRemove={handleRemove}
                              isDeal
                              dealBadge={dealGroup.dealBadge}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}

                {groupedItems.regular.length > 0 && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--user-text-muted)] mb-3 px-1">Regular Items</h3>
                    <ul className="m-0 list-none space-y-2.5 p-0">
                      {groupedItems.regular.map((row, index) => (
                        <CartItemRow
                          key={row.key}
                          row={row}
                          index={index}
                          imgUrl={getImgUrl(row.image)}
                          isRemoving={removingKeys.has(row.key)}
                          isCommitting={pendingQty[row.key] !== undefined && pendingQty[row.key] !== row.raw.qty}
                          onQtyChange={handleQtyChange}
                          onRemove={handleRemove}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)]">
                  <ShoppingBag size={36} aria-hidden="true" className="text-[var(--user-text-subtle)]" />
                </div>
                <h3 className="text-xl font-bold text-[var(--user-text)]">Your cart is empty</h3>
                <p className="mt-1.5 max-w-[260px] text-sm leading-relaxed text-[var(--user-text-muted)]">Add some products to get started.</p>
                <button type="button" onClick={startShopping} className="mt-6 rounded-xl bg-[var(--user-accent)] px-8 py-3 text-sm font-bold text-[var(--user-accent-text)] transition-all duration-200 hover:scale-[1.02] hover:bg-[var(--user-accent-hover)] active:scale-[0.98]">
                  Start Shopping
                </button>
              </div>
            )}
          </div>

          {hasItems && (
            <footer className="shrink-0 border-t border-[var(--user-border)] bg-[var(--user-bg-card)] pb-[env(safe-area-inset-bottom)]">
              <div className="px-5 py-4 sm:px-6">
                <div className="divide-y divide-[var(--user-border)]">
                  <div className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-medium text-[var(--user-text-muted)]">Subtotal</span>
                    <span className="font-semibold text-[var(--user-text)]">{fmt(totals.subtotal)}</span>
                  </div>
                  {totals.totalSavings > 0 && (
                    <div className="flex items-center justify-between py-2.5 text-sm">
                      <span className="flex items-center gap-1.5 font-medium text-[var(--user-success)]">
                        <Tag size={13} aria-hidden="true" />
                        Total Savings
                      </span>
                      <span className="font-semibold text-[var(--user-success)]">-{fmt(totals.totalSavings)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between py-2.5 text-sm">
                    <span className="font-medium text-[var(--user-text-muted)]">Shipping</span>
                    {totals.shipping === 0 ? (
                      <span className="rounded border border-[var(--user-success)]/30 bg-[var(--user-success)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--user-success)]">FREE</span>
                    ) : (
                      <span className="font-semibold text-[var(--user-text)]">{fmt(totals.shipping)}</span>
                    )}
                  </div>
                  {totals.tax > 0 && (
                    <div className="flex items-center justify-between py-2.5 text-sm">
                      <span className="font-medium text-[var(--user-text-muted)]">Tax</span>
                      <span className="font-semibold text-[var(--user-text)]">{fmt(totals.tax)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--user-bg-hover)] p-4">
                  <span className="text-lg font-semibold text-[var(--user-text)]">Total</span>
                  <span className="text-2xl font-bold text-[var(--user-accent)]">{fmt(totals.grandTotal)}</span>
                </div>
                <button type="button" onClick={goCheckout} disabled={!hasItems} className="mt-3 w-full rounded-xl bg-[var(--user-accent)] py-4 text-sm font-bold uppercase tracking-widest text-[var(--user-accent-text)] transition-all duration-200 hover:scale-[1.02] hover:bg-[var(--user-accent-hover)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]">
                  Proceed to Checkout
                </button>
              </div>
            </footer>
          )}
        </div>
      </>
    );
  }

  function CartItemRow({ row, index, imgUrl, isRemoving, isCommitting, onQtyChange, onRemove, isDeal = false, dealBadge = null }) {
    return (
      <li className={`cart-item-in group flex gap-3 rounded-xl border p-3 transition-all duration-200 ease-out ${isDeal ? "border-[var(--user-accent)]/20 bg-[var(--user-bg-card)]" : "border-[var(--user-border)] bg-[var(--user-bg-card)] hover:border-[var(--user-border-hover)]"} ${isRemoving ? "-translate-x-6 opacity-0" : ""}`} style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}>
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-hover)]">
          {imgUrl ? (<img src={imgUrl} alt={row.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />) : (<Package size={24} aria-hidden="true" className="text-[var(--user-text-subtle)]" />)}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-base font-semibold leading-tight text-[var(--user-text)]">{row.name}</h3>
              {row.variantTitle && (<p className="mt-0.5 truncate text-xs text-[var(--user-text-muted)]">{row.variantTitle}</p>)}
              {row.brand && (<p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[var(--user-text-subtle)]">{row.brand}</p>)}
            </div>
            <button type="button" onClick={() => onRemove(row)} aria-label={`Remove ${row.name} from cart`} className="-mr-1 -mt-1 rounded-lg p-2 text-[var(--user-text-subtle)] transition-colors hover:bg-[var(--user-danger)]/10 hover:text-[var(--user-danger)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-danger)]">
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>

          {isDeal && dealBadge && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-600">
                <Sparkles size={10} aria-hidden="true" />
                {dealBadge}
              </span>
              {row.freeItems > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-600">
                  <Check size={10} aria-hidden="true" />
                  {row.freeItems} FREE
                </span>
              )}
            </div>
          )}

          <div className="mt-auto flex items-end justify-between gap-2 pt-2">
            <div className={`flex items-center gap-0.5 transition-opacity ${isCommitting ? "opacity-60" : ""}`}>
              <button type="button" onClick={() => onQtyChange(row.key, row.qty - 1)} disabled={row.qty <= 1} aria-label="Decrease quantity" className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--user-text-muted)] transition-all hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] active:scale-90 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]">
                <Minus size={14} aria-hidden="true" />
              </button>
              <span key={row.qty} className="cart-qty-pop w-7 text-center text-sm font-bold tabular-nums text-[var(--user-text)]">{row.qty}</span>
            <button type="button" onClick={() => onQtyChange(row.key, row.qty + 1)} disabled={row.stock != null && row.qty >= row.stock} aria-label="Increase quantity" className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--user-text-muted)] transition-all hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] active:scale-90 focus-visible:outline-2 focus-visible:outline-[var(--user-accent)] disabled:pointer-events-none disabled:opacity-30">
    <Plus size={14} aria-hidden="true" />
  </button>
            </div>

            <div className="text-right">
              {row.hasDiscount && row.originalPrice > row.displayPrice && (
                <p className="text-[11px] leading-tight text-[var(--user-text-subtle)] line-through">
                  {fmt(row.originalPrice)}
                </p>
              )}
              
              <p className="text-base font-bold text-[var(--user-accent)]">
                {fmt(row.lineTotal)}
              </p>
              
                        {row.freeItems > 0 && (
                <p className="text-[10px] text-[var(--user-text-muted)]">
                  {row.payableItems} paid + {row.freeItems} FREE = {row.payableItems + row.freeItems} items
                </p>
              )}  
              
              {row.savings > 0 && (
                <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] font-semibold text-[var(--user-success)]">
                  <Tag size={10} aria-hidden="true" />
                  Save {fmt(row.savings * row.qty)}
                </p>
              )}
            </div>
          </div>
        </div>
      </li>
    );
  }