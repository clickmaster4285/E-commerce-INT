  "use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";

  import {
    X, Plus, Minus, Trash2, ShoppingBag, Package, Tag, Check,
    Loader2, ChevronDown, LockKeyhole,
  } from "lucide-react";
  import { toast } from "sonner";
  import { useQuery } from "@tanstack/react-query";          // ✅ ADD
import { shippingApi } from "@/apis/user/shippingApi"; 
  import { useCart } from "./CartContext";
  import { useDiscounts } from "./DiscountContext";
  import DealInfoDropdown from "./DealInfoDropdown";
  import { calculateFreeItems, calculatePayableItems, calculateBuyXGetYSavings, isDealActive, hasFreeShippingDeal, isFreeShippingApplicable, getDefaultShippingMethod, matchShippingRule, sanitizeDealBadge } from "@/utils/dealCalculator";

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

  export default function CartDrawer() {
    const router = useRouter();
    const { cart, isCartOpen, setIsCartOpen, updateQty, removeFromCart, restoreItems, selectedKeys, isLineSelected, toggleLineSelected, setAllSelected, selectedItems } = useCart();
    const { calculateProductDiscount, deals: dealsList = [] } = useDiscounts();
    // ✅ Deal picker — kaunsa card ka popup khula hai (sirf ek waqt pe ek)
    const [openDealCardKey, setOpenDealCardKey] = useState(null);

  // ✅ Shipping config (standard fee admin settings se)
  const { data: shipConfig } = useQuery({
    queryKey: ["shippingConfig"],
    queryFn: shippingApi.getConfig,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  // ✅ Active shipping rules (brand/category/product/all — free or fixed).
  const { data: shippingRules = [] } = useQuery({
    queryKey: ["shippingRules"],
    queryFn: shippingApi.getRules,
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
    const [confirmClear, setConfirmClear] = useState(false);
    const clearTimerRef = useRef(null);
    const closeCart = useCallback(() => {
      clearTimeout(clearTimerRef.current);
      setConfirmClear(false);
      setIsCartOpen(false);
    }, [setIsCartOpen]);
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
      const onKey = (e) => { if (e.key === "Escape") closeCart(); };
      window.addEventListener("keydown", onKey);
      requestAnimationFrame(() => drawerRef.current?.focus());
      return () => window.removeEventListener("keydown", onKey);
    }, [isCartOpen, closeCart]);

    useEffect(() => {
      const timers = timersRef.current;
      const qtyTimersMap = qtyTimers.current;
      return () => {
        timers.forEach(clearTimeout);
        Object.values(qtyTimersMap).forEach(clearTimeout);
      };
    }, []);

    // ✅ Deal badge config (type-based color/text + raw badge text merge)
    function getDealBadgeConfig(deal) {
      if (!deal) return null;
      const type = deal.type;
      const discountValue = deal.discountValue ?? deal.discount_value ?? deal.savings ?? 0;
      const buyQuantity = deal.buyQuantity ?? deal.buy_qty ?? deal.minQuantity ?? 1;
      const getQuantity = deal.getQuantity ?? deal.get_qty ?? 1;

      if (type === "buy_x_get_y") {
        return {
          text: `Buy ${buyQuantity} Get ${getQuantity}`,
          color: "from-purple-500 to-pink-600",
          icon: Tag,
        };
      }

      if (type === "percentage") {
        return {
          text: `${discountValue}% OFF`,
          color: "from-green-500 to-emerald-600",
          icon: Tag,
        };
      }

      if (type === "fixed_amount") {
        return {
          text: `Rs. ${discountValue} OFF`,
          color: "from-blue-500 to-cyan-600",
          icon: Tag,
        };
      }

      if (type === "free_shipping") {
        return {
          text: "Free Shipping",
          color: "from-orange-500 to-red-600",
          icon: Tag,
        };
      }

      return {
        text: deal.name || "Deal",
        color: "from-orange-500 to-red-600",
        icon: Tag,
      };
    }

    const groupedItems = useMemo(() => {
      const dealGroups = new Map();
      const regularItems = [];

      cart.forEach((raw) => {
        const qty = pendingQty[raw.key] ?? raw.qty;
        // ✅ Buy X Get Y below threshold falls back to a regular line
        const dealActive = isDealActive({ ...raw, qty });

        // ✅ Recompute display/original price using calculateProductDiscount
        // so admin-applied regular discounts are visible on non-deal lines.
        // For deal-active lines we keep the stored deal-discounted price as-is.
        let displayPrice = Number(raw.price) || 0;
        let originalPrice = Number(raw.regularPrice ?? raw.price ?? 0);
        let regularDiscountSavings = 0;

        if (!dealActive && !raw.bundleId) {
          const fakeProduct = {
            _id: raw.productId || raw.id,
            category_id: raw.categoryId || null,
            brand_id: raw.brandId || null,
            discount: raw.productDiscountPct || 0,
          };
          // ✅ Regular cart line: includeDeals=false so any active deal
          // is IGNORED and ONLY the regular admin discount is applied.
          const disc = calculateProductDiscount(fakeProduct, originalPrice, false);
          if (disc && disc.hasDiscount && disc.discountedPrice < originalPrice) {
            displayPrice = Number(disc.discountedPrice) || displayPrice;
            regularDiscountSavings = Math.max(0, originalPrice - displayPrice);
          }
        }

        let freeItems = 0;
        let payableItems = qty;
        let dealSavings = 0;
        let effectiveDealSavings = 0;

        if (dealActive && raw.dealType === "buy_x_get_y" && raw.dealBuyQuantity && raw.dealGetQuantity) {
          freeItems = calculateFreeItems(qty, raw.dealBuyQuantity, raw.dealGetQuantity);
          payableItems = calculatePayableItems(qty, raw.dealBuyQuantity, raw.dealGetQuantity);
          dealSavings = calculateBuyXGetYSavings(qty, displayPrice, raw.dealBuyQuantity, raw.dealGetQuantity);
          effectiveDealSavings = dealSavings;
        } else if (dealActive && (raw.dealType === "percentage" || raw.dealType === "fixed_amount")) {
          effectiveDealSavings = Math.max(0, (originalPrice - displayPrice) * qty);
        }

        const lineTotal = (raw.dealType === "buy_x_get_y" && raw.dealBuyQuantity && raw.dealGetQuantity)
          ? payableItems * displayPrice
          : qty * displayPrice;

        const itemData = {
          raw,
          qty,
          key: raw.key,
          name: raw.name,
          brand: raw.brand,
          variantTitle: raw.variantTitle,
          image: raw.image,
          displayPrice,
          originalPrice,
          stock: raw.stock,
          hasDiscount: (originalPrice > displayPrice),
          savings: regularDiscountSavings,
          dealSavings: effectiveDealSavings,
          freeItems: dealActive ? freeItems : 0,
          payableItems: dealActive ? payableItems : qty,
          lineTotal,
          dealActive,
          // ✅ Bundle (combo deal) rules info
          isGift: Boolean(raw.isBundleGift),
          bundleId: raw.bundleId || null,
          bundleName: raw.bundleName || "",
          bundleAppliedRule: raw.bundleAppliedRule || "",
          bundleProgress: raw.bundleProgress || "",
        };

        if (dealActive && raw.dealId) {
          if (!dealGroups.has(raw.dealId)) {
            dealGroups.set(raw.dealId, {
              dealId: raw.dealId,
              dealType: raw.dealType,
              dealName: raw.dealName || "Deal",
              // ✅ discountValue = actual deal value (percent/fixed) — dealSavings rupees hai jo "0% OFF" banata tha
              dealBadge: sanitizeDealBadge(raw.dealBadge) || getDealBadgeConfig({ type: raw.dealType, discountValue: raw.dealDiscountValue ?? raw.dealSavings, buyQuantity: raw.dealBuyQuantity, getQuantity: raw.dealGetQuantity })?.text,
              items: [],
              totalSavings: 0,
            });
          }
          const group = dealGroups.get(raw.dealId);
          group.items.push(itemData);
          group.totalSavings += effectiveDealSavings;
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
      // ✅ Use SELECTED items for totals (selection-aware)
      const itemsForTotals = selectedItems;
      const allItems = [...groupedItems.deals.flatMap(d => d.items), ...groupedItems.regular]
        .filter((i) => isLineSelected(i.key));
      const subtotal = allItems.reduce((s, i) => s + i.lineTotal, 0);

      // ✅ No double counting:
      // - Deal lines contribute `dealSavings` (deal section price drop + free items)
      // - Regular lines contribute `savings * qty` (regular-discount drop only)
      const totalSavings = allItems.reduce(
        (s, i) => s + (i.dealActive ? i.dealSavings : i.savings * i.qty),
        0
      );

      const tax = Math.round(allItems.reduce((s, i) => s + i.displayPrice * i.payableItems * (Number(i.raw.tax || 0) / 100), 0));
    // ✅ Use the shared helper — single source of truth across cart/drawer/checkout.
    const hasFreeShippingDealFlag = hasFreeShippingDeal(itemsForTotals);
    // ✅ Derive the default shipping method from the active free-shipping deal
    //    (e.g. express-only deal => express; standard-only or both => standard;
    //    no deal => standard).
    const activeFreeShippingDeal = hasFreeShippingDealFlag
      ? dealsList.find((d) => d.type === "free_shipping")
      : null;
    const defaultMethod = getDefaultShippingMethod(activeFreeShippingDeal);
    const freeShippingActiveForDefault = isFreeShippingApplicable(activeFreeShippingDeal, defaultMethod);

    // ✅ Standard fee admin config se (fallback 200); express fee from config too.
    const standardFee = Number(shipConfig?.standard?.fee ?? SHIPPING_FEE) || 0;
    const expressFee = Number(shipConfig?.express?.fee ?? 0) || 0;
    const freeOver = Number(shipConfig?.free_shipping_over ?? 0) || 0;

    const defaultFee = defaultMethod === "express" ? expressFee : standardFee;

    // ✅ Match admin shipping rules against selected items (single source of truth).
    const cartItemsForRule = itemsForTotals.map((i) => ({
      productId: i.productId || i.product_id || i.id,
      categoryId: i.categoryId || i.category_id,
      brandId: i.brandId || i.brand_id,
    }));
    const matchedRule = matchShippingRule(cartItemsForRule, shippingRules);
    const ruleFree = matchedRule?.shipping_type === "free";
    const ruleFixedFee = matchedRule?.shipping_type === "fixed" ? Number(matchedRule.fee) || 0 : null;

    let shipping;
    if (freeShippingActiveForDefault || ruleFree) {
      // ✅ Deal free OR rule free => always 0
      shipping = 0;
    } else if (!freeShippingActiveForDefault && freeOver > 0 && subtotal >= freeOver) {
      // ✅ Threshold promo
      shipping = 0;
    } else if (ruleFixedFee != null) {
      // ✅ Fixed-fee rule overrides the method fee
      shipping = ruleFixedFee;
    } else {
      shipping = defaultFee;
    }

    const grandTotal = subtotal + shipping + tax;

    return {
      subtotal,
      totalSavings,
      tax,
      shipping,
      grandTotal,
      hasFreeShippingDeal: hasFreeShippingDealFlag,
      freeShippingActiveForDefault,
      matchedShippingRule: matchedRule,
      defaultShippingMethod: defaultMethod,
    };
  }, [groupedItems, shipConfig, selectedItems, isLineSelected, dealsList, shippingRules]);

    const count = cart.reduce((s, i) => s + (Number(i.qty) || 0), 0);
    const hasItems = cart.length > 0;
    const selectedCount = selectedItems.reduce((s, i) => s + (Number(i.qty) || 0), 0);
    const selectedLineCount = selectedItems.length;
    const allSelected = hasItems && selectedLineCount === cart.length;
    const freeShippingThreshold = Number(shipConfig?.free_shipping_over ?? 0) || 0;
    const freeShippingRemaining = Math.max(0, freeShippingThreshold - totals.subtotal);
    const freeShippingProgress = freeShippingThreshold > 0
      ? Math.min(100, (totals.subtotal / freeShippingThreshold) * 100)
      : 0;

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
        toast.success("Item removed", { duration: 5000, action: { label: "Undo", onClick: () => restoreItems([row.raw]) } });
      }, REMOVE_ANIM_MS);
      timersRef.current.push(t);
    };

    const goCheckout = () => { closeCart(); router.push("/checkout"); };
    const startShopping = () => { closeCart(); router.push("/"); };

    // ✅ CLEAR CART — two-tap confirm (ghalti se clear na ho)
    const handleClearCart = () => {
      if (!confirmClear) {
        setConfirmClear(true);
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = setTimeout(() => setConfirmClear(false), 3000);
        return;
      }
      clearTimeout(clearTimerRef.current);
      setConfirmClear(false);
      const snapshot = cart.map((i) => i.raw ?? i);
      cart.forEach((i) => removeFromCart(i.key));
      toast.success("Cart cleared", {
        action: { label: "Undo", onClick: () => restoreItems(snapshot) },
      });
    };

    return (
      <>
        <div aria-hidden="true" onClick={closeCart} className={`fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 ease-out ${isCartOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} />

        <div ref={drawerRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Shopping cart" className={`fixed top-0 right-0 z-50 flex h-full w-full flex-col overflow-hidden bg-[var(--user-bg-elevated)] font-normal text-[var(--user-text)] shadow-[var(--user-shadow-md)] outline-none transition-transform duration-200 ease-out sm:w-[420px] ${isCartOpen ? "translate-x-0" : "translate-x-full"}`}>
          <span className="sr-only" aria-live="polite">{count} {count === 1 ? "item" : "items"} in cart</span>

          <header className="sticky top-0 z-20 flex shrink-0 items-center justify-between border-b border-[var(--user-border)] bg-[var(--user-bg-elevated)] px-5 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <h2 className="text-base font-semibold leading-6 text-[var(--user-text)]">Shopping Cart</h2>
              <span aria-label={`${count} ${count === 1 ? "item" : "items"}`} className="inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--user-bg-hover)] px-2 py-0.5 text-xs font-normal tabular-nums text-[var(--user-text-muted)]">{count}</span>
            </div>
            <button type="button" onClick={closeCart} aria-label="Close cart" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--user-text-muted)] transition-colors duration-150 hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-border-hover)]">
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          {hasItems && freeShippingThreshold > 0 && (
            <section aria-label="Free shipping progress" className="shrink-0 border-b border-[var(--user-border)] px-5 py-3">
              {totals.shipping === 0 ? (
                <p className="flex items-center gap-2 text-sm font-normal text-[var(--user-text-muted)]">
                  <Check size={14} aria-hidden="true" />
                  You&apos;ve unlocked free shipping
                </p>
              ) : (
                <>
                  <p className="text-sm font-normal text-[var(--user-text-muted)]">Add {fmt(freeShippingRemaining)} more for free shipping</p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--user-bg-hover)]" role="progressbar" aria-label="Free shipping progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(freeShippingProgress)}>
                    <div className="h-full rounded-full bg-[var(--user-text-muted)] transition-[width] duration-300 ease-out" style={{ width: `${freeShippingProgress}%` }} />
                  </div>
                </>
              )}
            </section>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5" aria-live="polite">
            {hasItems ? (
              <div className="space-y-4">
                
                {groupedItems.deals.map((dealGroup, dealIndex) => {
                  const Icon = Tag;
                  const isCollapsed = collapsedDeals.has(dealGroup.dealId);
                  
                  return (
                    <div key={dealGroup.dealId || dealIndex} className="overflow-hidden border-b border-[var(--user-border)]">
                      <div className={`flex items-center gap-3 py-3 ${!isCollapsed ? "border-b border-[var(--user-border)]" : ""}`}>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--user-bg-hover)] text-[var(--user-text-muted)]">
                          <Icon size={16} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold text-[var(--user-text)]">{dealGroup.dealName}</h3>
                          <p className="mt-0.5 text-xs font-normal text-[var(--user-text-muted)]">
                            {dealGroup.dealType === "free_shipping" ? "Free Shipping" : "Deal applied"}
                          </p>
                        </div>
                        {isCollapsed && (
                          <span className="shrink-0 text-xs font-normal text-[var(--user-text-muted)]">
                            {dealGroup.items.length} {dealGroup.items.length === 1 ? "item" : "items"}
                          </span>
                        )}
                        {dealGroup.totalSavings > 0 && (
                          <span className="shrink-0 text-xs font-normal text-[var(--user-text-muted)]">Save {fmt(dealGroup.totalSavings)}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleDealCollapse(dealGroup.dealId)}
                          aria-label={isCollapsed ? "Expand deal section" : "Collapse deal section"}
                          aria-expanded={!isCollapsed}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--user-text-muted)] transition-colors duration-150 hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-border-hover)]"
                        >
                          <ChevronDown size={16} className={`transition-transform duration-200 ${isCollapsed ? "" : "rotate-180"}`} />
                        </button>
                      </div>

                      {/* ✅ Items List — sirf jab expanded ho */}
                      {!isCollapsed && (
                        <ul className="m-0 list-none p-0">
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
                            isSelected={isLineSelected(row.key)}
                            onToggleSelect={() => toggleLineSelected(row.key)}
                            openDealPicker={openDealCardKey === row.key}
                            onToggleDealPicker={() => setOpenDealCardKey((prev) => (prev === row.key ? null : row.key))}
                            onCloseDealPicker={() => setOpenDealCardKey(null)}
                          />
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}

                {groupedItems.regular.length > 0 && (
                  <div>
                    {groupedItems.deals.length > 0 && <h3 className="mb-1 text-xs font-medium text-[var(--user-text-muted)]">Regular items</h3>}
                    <ul className="m-0 list-none p-0">
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
                          isSelected={isLineSelected(row.key)}
                          onToggleSelect={() => toggleLineSelected(row.key)}
                          openDealPicker={openDealCardKey === row.key}
                          onToggleDealPicker={() => setOpenDealCardKey((prev) => (prev === row.key ? null : row.key))}
                          onCloseDealPicker={() => setOpenDealCardKey(null)}
                        />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--user-bg-hover)]">
                  <ShoppingBag size={28} aria-hidden="true" className="text-[var(--user-text-muted)]" />
                </div>
                <h3 className="text-base font-semibold text-[var(--user-text)]">Your cart is empty</h3>
                <p className="mt-2 max-w-[16.25rem] text-sm leading-relaxed text-[var(--user-text-muted)]">Add some products to get started.</p>
                <button type="button" onClick={startShopping} className="mt-5 inline-flex h-10 items-center justify-center rounded-lg border border-[var(--user-border)] px-5 text-sm font-medium text-[var(--user-text)] transition-colors duration-150 hover:bg-[var(--user-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-border-hover)]">
                  Continue shopping
                </button>
              </div>
            )}
          </div>

          {hasItems && (
            <footer className="sticky bottom-0 z-10 shrink-0 border-t border-[var(--user-border)] bg-[var(--user-bg-elevated)] pb-[env(safe-area-inset-bottom)]">
              <div className="flex flex-col gap-4 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setAllSelected(!allSelected)}
                    aria-pressed={allSelected}
                    className="flex min-h-8 items-center gap-2 rounded-md text-sm font-medium text-[var(--user-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
                  >
                    <span className={`flex h-5 w-5 items-center justify-center rounded border transition-[background,border-color] duration-150 ${allSelected ? "border-[var(--user-accent)] bg-[var(--user-accent)]" : "border-[var(--user-border)] bg-transparent hover:border-[var(--user-border-hover)]"}`}>
                      {allSelected && <Check size={12} className="text-[var(--user-accent-text)]" strokeWidth={2} />}
                    </span>
                    <span>Select all</span>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-normal tabular-nums text-[var(--user-text-muted)]">{selectedLineCount} of {cart.length} selected</span>
                    <button
                      type="button"
                      onClick={handleClearCart}
                      aria-label={confirmClear ? "Confirm clear cart" : "Clear cart"}
                      className={`text-xs font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-danger)] ${confirmClear ? "text-[var(--user-danger)]" : "text-[var(--user-text-muted)] hover:text-[var(--user-danger)]"}`}
                    >
                      {confirmClear ? "Confirm clear?" : "Clear cart"}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--user-text-muted)]">Subtotal</span>
                    <span key={totals.subtotal} className="cart-qty-pop text-sm tabular-nums text-[var(--user-text-muted)]">{fmt(totals.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--user-text-muted)]">Shipping</span>
                    <span className="text-sm tabular-nums text-[var(--user-text-muted)]">{totals.shipping === 0 ? "FREE" : fmt(totals.shipping)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--user-text-muted)]">Tax</span>
                    <span className="text-sm tabular-nums text-[var(--user-text-muted)]">{fmt(totals.tax)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--user-border)] pt-3">
                  <span className="text-sm font-medium text-[var(--user-text)]">Total</span>
                  <span key={totals.grandTotal} className="cart-qty-pop text-lg font-semibold tabular-nums text-[var(--user-text)]">{fmt(totals.grandTotal)}</span>
                </div>
                <button
                  type="button"
                  onClick={goCheckout}
                  disabled={!hasItems || selectedLineCount === 0}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--user-accent)] px-4 text-sm font-medium text-[var(--user-accent-text)] transition-colors duration-150 hover:bg-[var(--user-accent-hover)] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
                >
                  <LockKeyhole size={15} aria-hidden="true" />
                  {selectedLineCount === 0 ? "Select items" : "Proceed to Checkout"}
                </button>
                <p className="-mt-2 text-center text-xs text-[var(--user-text-muted)]">Secure checkout · Easy returns</p>
              </div>
            </footer>
          )}
        </div>
      </>
    );
  }

  function CartItemRow({ row, index, imgUrl, isRemoving, isCommitting, onQtyChange, onRemove, isSelected = true, onToggleSelect, openDealPicker = false, onToggleDealPicker, onCloseDealPicker }) {
    const { applyDealToItem } = useCart();
    const { getActiveDealsForProduct } = useDiscounts();
    // ✅ Deal button sirf tab dikhao jab is product ke liye koi active deal ho —
    // warna bina-deal product par bhi "Deals" button aata tha.
    const hasAvailableDeals = (getActiveDealsForProduct?.({
      _id: row.raw?.productId || row.raw?.id,
      category_id: row.raw?.categoryId || row.raw?.category_id || null,
      brand_id: row.raw?.brandId || row.raw?.brand_id || null,
    }) || []).length > 0;
    return (
      <li
        aria-busy={isCommitting}
        className={`relative grid grid-cols-[24px_64px_minmax(0,1fr)_72px] items-center gap-2 overflow-hidden border-b border-[var(--user-border)] py-4 transition-colors duration-150 ease-out last:border-b-0 hover:bg-[var(--user-bg-hover)]/40 ${openDealPicker ? "z-10 min-h-[15rem]" : ""} ${!isSelected ? "opacity-60" : ""} ${isRemoving ? "-translate-x-6 opacity-0" : ""}`}
        style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
          aria-label={isSelected ? `Unselect ${row.name}` : `Select ${row.name}`}
          aria-pressed={isSelected}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-150 hover:bg-[var(--user-bg-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-border-hover)]"
        >
          <span className={`flex h-5 w-5 items-center justify-center rounded border transition-[background,border-color] duration-150 ${isSelected ? "border-[var(--user-accent)] bg-[var(--user-accent)]" : "border-[var(--user-border)] bg-transparent hover:border-[var(--user-border-hover)]"}`}>
            {isSelected && <Check size={12} className="text-[var(--user-accent-text)]" strokeWidth={2} />}
          </span>
        </button>

        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--user-bg-hover)]">
          {imgUrl ? (<img src={imgUrl} alt={row.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />) : (<Package size={24} aria-hidden="true" className="text-[var(--user-text-subtle)]" />)}
        </div>

        <div className="flex min-w-0 flex-col">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug text-[var(--user-text)]">{row.name}</h3>
          <p className="mt-1 truncate text-xs text-[var(--user-text-muted)]">{row.variantTitle || "Default"}{row.brand ? ` · ${row.brand}` : ""}</p>

          {(row.isGift || row.bundleAppliedRule || (!row.isGift && row.bundleProgress)) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--user-text-muted)]">
              {row.isGift && <span>FREE GIFT</span>}
              {!row.isGift && row.bundleAppliedRule && <span>{row.bundleAppliedRule}</span>}
              {!row.isGift && !row.bundleAppliedRule && row.bundleProgress && <span>{row.bundleProgress}</span>}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            <div className={`flex h-8 items-center overflow-hidden rounded-md border border-[var(--user-border)] bg-[var(--user-bg-card)] transition-opacity duration-150 ${isCommitting ? "opacity-70" : ""}`}>
              <button type="button" onClick={() => onQtyChange(row.key, row.qty - 1)} disabled={row.qty <= 1 || isCommitting} aria-label={`Decrease quantity of ${row.name}`} className="flex h-8 w-8 items-center justify-center text-[var(--user-text-muted)] transition-colors duration-150 hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--user-border-hover)]">
                <Minus size={14} aria-hidden="true" />
              </button>
              {isCommitting ? (
                <Loader2 size={14} aria-label="Updating quantity" className="mx-1.5 animate-spin text-[var(--user-text-muted)]" />
              ) : (
                <span key={row.qty} className="cart-qty-pop w-8 text-center text-sm font-normal tabular-nums text-[var(--user-text)]">{row.qty}</span>
              )}
              <button type="button" onClick={() => onQtyChange(row.key, row.qty + 1)} disabled={(row.stock != null && row.qty >= row.stock) || isCommitting} aria-label={`Increase quantity of ${row.name}`} className="flex h-8 w-8 items-center justify-center text-[var(--user-text-muted)] transition-colors duration-150 hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--user-border-hover)]">
                <Plus size={14} aria-hidden="true" />
              </button>
            </div>
            {hasAvailableDeals && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onToggleDealPicker?.(); }} aria-label={`View available deals for ${row.name}`} aria-expanded={openDealPicker} title="View available deals" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--user-text-muted)] transition-colors duration-150 hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-border-hover)]">
                <Tag size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="flex w-[72px] shrink-0 flex-col items-end justify-center gap-1">
          <div className="text-right leading-5">
            <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-[var(--user-text)]">{row.isGift ? "FREE" : fmt(row.lineTotal)}</p>
            {row.hasDiscount && row.originalPrice * row.qty > row.lineTotal && (
              <p className="whitespace-nowrap text-xs tabular-nums text-[var(--user-text-muted)] line-through">{fmt(row.originalPrice * row.qty)}</p>
            )}
            {row.freeItems > 0 && <p className="mt-0.5 whitespace-nowrap text-[10px] text-[var(--user-text-muted)]">{row.payableItems} paid + {row.freeItems} FREE</p>}
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(row); }} aria-label={`Remove ${row.name} from cart`} title={`Remove ${row.name}`} className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--user-text-muted)] transition-colors duration-150 hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-danger)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-danger)]">
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>

        {hasAvailableDeals && (
          <DealInfoDropdown
            cartItem={row.raw}
            onApplyDeal={(deal) => applyDealToItem(row.key, deal)}
            open={openDealPicker}
            onClose={onCloseDealPicker}
          />
        )}
        {isCommitting && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-30 flex items-center gap-3 bg-[var(--user-bg-card)] px-4">
            <span className="h-5 w-5 shrink-0 animate-pulse rounded bg-[var(--user-bg-hover)]" />
            <span className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-[var(--user-bg-hover)]" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-4 w-4/5 animate-pulse rounded bg-[var(--user-bg-hover)]" />
              <span className="block h-3 w-1/2 animate-pulse rounded bg-[var(--user-bg-hover)]" />
              <span className="block h-8 w-24 animate-pulse rounded-md bg-[var(--user-bg-hover)]" />
            </span>
            <span className="h-5 w-16 shrink-0 animate-pulse rounded bg-[var(--user-bg-hover)]" />
          </div>
        )}
      </li>
    );
  }
