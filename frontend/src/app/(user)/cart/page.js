"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, ShoppingBag, Package, Tag, Check, Plus, Minus,
  Trash2, Sparkles, Zap, Truck, PackageOpen, ChevronDown, ShieldCheck, Lock,
  Gift, CreditCard, Percent, TrendingUp, Box
} from "lucide-react";
import { useCart } from "@/components/user/CartContext";
import { useDiscounts } from "@/components/user/DiscountContext";
import { shippingApi } from "@/apis/user/shippingApi";
import { calculateFreeItems, calculatePayableItems, calculateBuyXGetYSavings, isDealActive, hasFreeShippingDeal, isFreeShippingApplicable, getDefaultShippingMethod, matchShippingRule } from "@/utils/dealCalculator";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

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

export default function CartPage() {
  const router = useRouter();
  const { cart, updateQty, removeFromCart, restoreItems, selectedKeys, isLineSelected, toggleLineSelected, setAllSelected, selectedItems, clearSelection } = useCart();
  const { calculateProductDiscount, deals: dealsList = [] } = useDiscounts();
  const [collapsedDeals, setCollapsedDeals] = useState(() => new Set());

  // ✅ SHIPPING METHOD — derived from active free-shipping deal (no selector on cart page)
  const activeFreeShippingDeal = hasFreeShippingDeal(cart)
    ? dealsList.find((d) => d.type === "free_shipping")
    : null;
  const shippingMethod = getDefaultShippingMethod(activeFreeShippingDeal);

  // ✅ SHIPPING CONFIG — database se (admin panel)
  const { data: shipConfig } = useQuery({
    queryKey: ["shippingConfig"],
    queryFn: shippingApi.getConfig,
    staleTime: 5 * 60 * 1000,
  });
  // ✅ Active shipping rules (brand/category/product/all — free or fixed).
  const { data: shippingRules = [] } = useQuery({
    queryKey: ["shippingRules"],
    queryFn: shippingApi.getRules,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const cfg = shipConfig || {
    standard: { fee: 200, min_days: 2, max_days: 4 },
    express: { fee: 500, min_days: 1, max_days: 2 },
    free_shipping_over: 0,
  };

  const toggleDealCollapse = (dealId) => {
    setCollapsedDeals((prev) => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
  };

  // ✅ Same grouping logic as drawer (with Buy X Get Y activation threshold + regular discount)
  const groupedItems = useMemo(() => {
    const dealGroups = new Map();
    const regularItems = [];

    cart.forEach((raw) => {
      const qty = Number(raw.qty) || 0;
      const dealActive = isDealActive({ ...raw, qty });
      let displayPrice = Number(raw.price) || 0;
      const originalPrice = Number(raw.regularPrice ?? raw.price ?? 0);
      let regularDiscountSavings = 0;

      // ✅ Apply admin-applied regular discount on non-deal lines
      if (!dealActive) {
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
      };

      if (dealActive && raw.dealId) {
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
        group.totalSavings += effectiveDealSavings;
      } else {
        regularItems.push(itemData);
      }
    });

    return { deals: Array.from(dealGroups.values()), regular: regularItems };
  }, [cart, calculateProductDiscount]);

  const totals = useMemo(() => {
    // ✅ Compute from SELECTED items only
    const allItems = [...groupedItems.deals.flatMap(d => d.items), ...groupedItems.regular]
      .filter((i) => isLineSelected(i.key));
    const itemsForRules = selectedItems;
    const subtotal = allItems.reduce((s, i) => s + i.lineTotal, 0);
    // ✅ No double counting:
    // - Deal lines contribute `dealSavings` (deal section price drop + free items)
    // - Regular lines contribute `savings * qty` (regular-discount drop only)
    const totalSavings = allItems.reduce(
      (s, i) => s + (i.dealActive ? i.dealSavings : i.savings * i.qty),
      0
    );
    const tax = Math.round(allItems.reduce((s, i) => s + i.displayPrice * i.payableItems * (Number(i.raw.tax || 0) / 100), 0));
    // ✅ Shared helper — single source of truth. Evaluate against SELECTED items.
    const hasFreeShippingDealFlag = hasFreeShippingDeal(itemsForRules);
    // ✅ Cart page has no method selector — derive default from the active deal
    //    so an express-only deal shows EXPRESS + FREE here too.
    const freeShippingActiveForDefault = isFreeShippingApplicable(activeFreeShippingDeal, shippingMethod);
    return { subtotal, totalSavings, tax, hasFreeShippingDeal: hasFreeShippingDealFlag, freeShippingActiveForDefault, allItems };
  }, [groupedItems, selectedItems, isLineSelected, dealsList, activeFreeShippingDeal, shippingMethod]);

  // ✅ SHIPPING QUOTE — database se accurate calculation (selected items only)
  const { data: shipQuote } = useQuery({
    queryKey: [
      "shippingQuote",
      shippingMethod,
      Math.round(totals.subtotal),
      totals.allItems.map((i) => i.raw.productId || i.raw.id).join(","),
    ],
    queryFn: () =>
      shippingApi.quote({
        items: totals.allItems.map((i) => ({
          productId: i.raw.productId || i.raw.id,
          brandId: i.raw.brandId,
          categoryId: i.raw.categoryId,
        })),
        method: shippingMethod,
        subtotal: totals.subtotal,
      }),
    enabled: totals.allItems.length > 0,
  });

  const baseFee = shippingMethod === "express" ? cfg.express.fee : cfg.standard.fee;

  // ✅ Match admin shipping rules against SELECTED items (single source of truth).
  const cartItemsForRule = selectedItems.map((i) => ({
    productId: i.productId || i.product_id || i.id,
    categoryId: i.categoryId || i.category_id,
    brandId: i.brandId || i.brand_id,
  }));
  const matchedRule = matchShippingRule(cartItemsForRule, shippingRules);
  const ruleFree = matchedRule?.shipping_type === "free";
  const ruleFixedFee = matchedRule?.shipping_type === "fixed" ? Number(matchedRule.fee) || 0 : null;

  // ✅ Combine all free-shipping sources: deal (method-gated) | rule | threshold.
  //    Fixed rule overrides the method fee.
  let shipping;
  if (totals.freeShippingActiveForDefault || ruleFree) {
    shipping = 0;
  } else if (ruleFixedFee != null) {
    shipping = ruleFixedFee;
  } else {
    shipping = shipQuote?.fee ?? baseFee;
  }
  const shippingReason = totals.freeShippingActiveForDefault
    ? "Free shipping via active deal"
    : ruleFree
    ? `Free shipping (${matchedRule.rule_type} rule)`
    : (shipQuote?.reason || "");

  const grandTotal = Math.round(totals.subtotal + shipping + totals.tax);
  const freeOver = Number(cfg.free_shipping_over || 0);
  const freeProgress = freeOver > 0 ? Math.min((totals.subtotal / freeOver) * 100, 100) : 100;
  const freeRemaining = freeOver > 0 ? Math.max(freeOver - totals.subtotal, 0) : 0;

  const count = cart.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const hasItems = cart.length > 0;
  const selectedLineCount = selectedItems.length;
  const selectedQtyCount = selectedItems.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const allSelected = hasItems && selectedLineCount === cart.length;
  const canCheckout = selectedLineCount > 0;

  const handleRemove = (row) => {
    removeFromCart(row.key);
    toast.success("Item removed", { action: { label: "Undo", onClick: () => restoreItems([row.raw]) } });
  };

  const ItemRow = ({ row, isDeal = false, dealBadge = null, isSelected = true, onToggleSelect }) => (
    <div className={`group flex flex-col sm:flex-row sm:items-start gap-2 p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 ${
      !isSelected ? "opacity-60" : ""
    } ${
      isDeal
        ? "border-[var(--user-accent)]/20 bg-[var(--user-bg-card)] hover:border-[var(--user-accent)]/40 hover:shadow-md hover:shadow-[var(--user-accent)]/5"
        : "border-[var(--user-border)] bg-[var(--user-bg-card)] hover:border-[var(--user-accent)]/30 hover:shadow-md hover:-translate-y-0.5"
    }`}>
      {/* ✅ Selection checkbox — 20px visible, 28px tap target, top-aligned to thumb */}
      <button
        type="button"
        onClick={() => onToggleSelect?.()}
        aria-label={isSelected ? `Unselect ${row.name}` : `Select ${row.name}`}
        aria-pressed={isSelected}
        className="shrink-0 p-1 mt-0.5 sm:mt-1 rounded-md hover:bg-[var(--user-bg-hover)] active:scale-95 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
      >
        <span
          className={`flex items-center justify-center w-5 h-5 rounded-full border-2 transition-[background,border-color,transform] duration-150 ${isSelected ? "bg-[var(--user-accent)] border-[var(--user-accent)]" : "bg-transparent border-[var(--user-border)] hover:border-[var(--user-accent)]/60"}`}
        >
          {isSelected && <Check size={12} className="text-[var(--user-accent-text)]" strokeWidth={3} />}
        </span>
      </button>
      {/* Image + Name */}
      <div className="flex gap-4 flex-1 min-w-0">
        <Link href={`/product/${row.raw.productId || row.raw.id}`} className="shrink-0 group/img">
          <div className="relative">
            {getImgUrl(row.image) ? (
              <img
                src={getImgUrl(row.image)}
                alt={row.name}
                className="w-24 h-24 rounded-xl object-cover border-2 border-[var(--user-border)] bg-[var(--user-bg-hover)] group-hover/img:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-24 h-24 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-border)] flex items-center justify-center">
                <Package size={28} className="text-[var(--user-text-subtle)]" />
              </div>
            )}
            <div className="absolute -top-1.5 -right-1.5 min-w-[24px] h-6 px-1.5 rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[10px] font-black flex items-center justify-center border-2 border-[var(--user-bg-card)] shadow-sm">
              ×{row.qty}
            </div>
          </div>
        </Link>

        <div className="flex-1 min-w-0 flex flex-col">
          <Link href={`/product/${row.raw.productId || row.raw.id}`} className="text-sm sm:text-base font-bold text-[var(--user-text)] hover:text-[var(--user-accent)] transition-colors line-clamp-2 leading-snug">
            {row.name}
          </Link>
          {row.brand && <p className="text-[10px] font-black uppercase tracking-wider text-[var(--user-text-subtle)] mt-1">{row.brand}</p>}
          {row.variantTitle && <p className="text-xs text-[var(--user-text-muted)] mt-0.5 truncate">{row.variantTitle}</p>}
          
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {isDeal && dealBadge && (
              <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r ${getDealBadgeConfig(row.raw)?.color || "from-purple-500 to-pink-600"} text-white px-2 py-0.5 text-[10px] font-black shadow-sm`}>
                <Sparkles size={10} /> {dealBadge}
              </span>
            )}
            {row.freeItems > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--user-success)]/15 text-[var(--user-success)] border border-[var(--user-success)]/20 px-2 py-0.5 text-[10px] font-black">
                <Check size={10} /> {row.freeItems} FREE
              </span>
            )}
            {row.hasDiscount && row.originalPrice > row.displayPrice && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--user-accent)]/10 text-[var(--user-accent)] border border-[var(--user-accent)]/20 px-2 py-0.5 text-[10px] font-black">
                <TrendingUp size={10} /> -{Math.round(((row.originalPrice - row.displayPrice) / row.originalPrice) * 100)}%
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-auto pt-2">
            <p className="text-base font-black text-[var(--user-text)]">{fmt(row.displayPrice)}</p>
            {row.hasDiscount && row.originalPrice * row.qty > row.lineTotal && (
              <p className="text-xs text-[var(--user-text-subtle)] line-through">{fmt(row.originalPrice * row.qty)}</p>
            )}
          </div>
        </div>
      </div>

      {/* Qty + Total + Remove */}
      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 sm:shrink-0">
        <div className="flex items-center gap-1 rounded-xl border-2 border-[var(--user-border)] bg-[var(--user-bg-card)] p-1">
          <button
            type="button"
            onClick={() => row.qty > 1 && updateQty(row.key, row.qty - 1)}
            disabled={row.qty <= 1}
            aria-label="Decrease"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--user-text-muted)] hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] active:scale-90 disabled:pointer-events-none disabled:opacity-30 transition"
          >
            <Minus size={14} />
          </button>
          <span className="w-9 text-center text-sm font-black tabular-nums text-[var(--user-text)]">{row.qty}</span>
          <button
            type="button"
            onClick={() => updateQty(row.key, row.qty + 1)}
            aria-label="Increase"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--user-text-muted)] hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] active:scale-90 transition"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="text-right">
          <p className="text-lg font-black text-[var(--user-accent)]">{fmt(row.lineTotal)}</p>
          {row.freeItems > 0 && (
            <p className="text-[10px] text-[var(--user-success)] font-semibold mt-0.5">{row.payableItems} paid + {row.freeItems} free</p>
          )}
          {row.savings > 0 && (
            <p className="text-[10px] font-black text-[var(--user-success)] flex items-center justify-end gap-1 mt-0.5">
              <Tag size={10} /> Save {fmt(row.savings * row.qty)}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => handleRemove(row)}
          aria-label={`Remove ${row.name}`}
          className="p-2 rounded-lg text-[var(--user-text-subtle)] hover:bg-[var(--user-danger)]/10 hover:text-[var(--user-danger)] transition"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  // ✅ Daraz-style mobile rendering — kept identical state/handlers/queries.
  return (
    <>
    {/* ============= DESKTOP — UNCHANGED ============= */}
    <div className="hidden lg:block">
    <main className="max-w-[1200px] mx-auto px-4 lg:px-6 py-6 lg:py-10 pb-32 md:pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="flex items-center gap-3 text-2xl lg:text-3xl font-black text-[var(--user-text)]">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-xl bg-[var(--user-accent)] flex items-center justify-center">
              <ShoppingBag size={22} className="text-[var(--user-accent-text)]" />
            </div>
            Shopping Cart
          </h1>
          <p className="text-sm text-[var(--user-text-muted)] mt-2">
            {count} {count === 1 ? "item" : "items"} in your cart
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-[var(--user-border)] text-sm font-bold text-[var(--user-text)] hover:border-[var(--user-accent)]/40 hover:text-[var(--user-accent)] transition"
        >
          <ArrowLeft size={16} /> Continue Shopping
        </Link>
      </div>

      {/* ✅ Select All row (visible whenever items exist) */}
      {hasItems && (
        <div className="flex items-center justify-between mb-5 px-3 sm:px-4 py-2.5 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)]">
          <button
            type="button"
            onClick={() => setAllSelected(!allSelected)}
            aria-pressed={allSelected}
            className="flex items-center gap-2 rounded-md hover:bg-[var(--user-bg-hover)] active:scale-[0.98] transition"
          >
            <span
              className={`flex items-center justify-center w-5 h-5 rounded-full border-2 transition-[background,border-color,transform] duration-150 ${allSelected ? "bg-[var(--user-accent)] border-[var(--user-accent)]" : "bg-transparent border-[var(--user-border)] hover:border-[var(--user-accent)]/60"}`}
            >
              {allSelected && <Check size={12} className="text-[var(--user-accent-text)]" strokeWidth={3} />}
            </span>
            <span className="text-sm font-bold text-[var(--user-text)]">Select All</span>
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-[var(--user-text-muted)] tabular-nums">
            {selectedLineCount} of {cart.length} selected
          </span>
        </div>
      )}

      {!hasItems ? (
        <div className="rounded-3xl border-2 border-[var(--user-border)] bg-[var(--user-bg-card)] p-10 sm:p-16 text-center relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[var(--user-accent)]/5 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-[var(--user-accent)]/5 blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-[var(--user-accent)]/10 border-2 border-[var(--user-accent)]/20 flex items-center justify-center mb-6">
              <ShoppingBag size={44} className="text-[var(--user-accent)]" />
            </div>
            <h2 className="text-2xl font-black text-[var(--user-text)] mb-2">Your cart is empty</h2>
            <p className="text-sm text-[var(--user-text-muted)] mb-8 max-w-sm mx-auto">
              Looks like you haven't added anything yet. Explore our deals and start shopping!
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-7 py-3.5 rounded-xl text-sm font-black hover:opacity-90 hover:shadow-lg hover:shadow-[var(--user-accent)]/20 active:scale-[0.98] transition-all"
            >
              Start Shopping <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_400px] gap-6 items-start">
          {/* LEFT — Items */}
          <div className="space-y-5">
            {/* ✅ FREE SHIPPING PROGRESS */}
            {freeOver > 0 && !totals.hasFreeShippingDeal && (
              <div className="rounded-2xl border-2 border-[var(--user-success)]/20 bg-[var(--user-success)]/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck size={18} className="text-[var(--user-success)]" />
                  {freeRemaining > 0 ? (
                    <p className="text-sm font-bold text-[var(--user-text)]">
                      Add <span className="text-[var(--user-success)]">{fmt(freeRemaining)}</span> more for <span className="text-[var(--user-success)]">FREE shipping</span>!
                    </p>
                  ) : (
                    <p className="text-sm font-black text-[var(--user-success)] flex items-center gap-1.5">
                      <Check size={16} /> You've unlocked FREE shipping!
                    </p>
                  )}
                </div>
                <div className="h-2 rounded-full bg-[var(--user-bg-hover)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--user-success)] to-emerald-500 transition-all duration-700 ease-out"
                    style={{ width: `${freeProgress}%` }}
                  />
                </div>
                {freeRemaining > 0 && (
                  <p className="text-[10px] text-[var(--user-text-muted)] mt-1.5">
                    {Math.round(freeProgress)}% of {fmt(freeOver)}
                  </p>
                )}
              </div>
            )}

            {/* Deal Sections */}
            {groupedItems.deals.map((dealGroup, di) => {
              const badgeConfig = getDealBadgeConfig({
                type: dealGroup.dealType,
                buyQuantity: dealGroup.items[0]?.raw.dealBuyQuantity,
                getQuantity: dealGroup.items[0]?.raw.dealGetQuantity,
                discountValue: dealGroup.items[0]?.raw.dealSavings,
              });
              const Icon = badgeConfig?.icon || Sparkles;
              const isCollapsed = collapsedDeals.has(dealGroup.dealId);
              
              return (
                <div key={dealGroup.dealId || di} className="rounded-2xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-pink-500/5 overflow-hidden">
                  <div className={`flex items-center gap-3 px-4 py-3.5 ${!isCollapsed ? "border-b-2 border-purple-500/20" : ""}`}>
                    <button
                      type="button"
                      onClick={() => toggleDealCollapse(dealGroup.dealId)}
                      aria-label={isCollapsed ? "Expand" : "Collapse"}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--user-text-muted)] hover:bg-purple-500/15 hover:text-[var(--user-text)] transition-colors"
                    >
                      <ChevronDown size={16} className={`transition-transform duration-300 ${isCollapsed ? "" : "rotate-180"}`} />
                    </button>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${badgeConfig?.color || "from-purple-500 to-pink-600"} flex items-center justify-center shrink-0 shadow-md`}>
                      <Icon size={18} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-black text-[var(--user-text)] truncate">{dealGroup.dealName}</h3>
                      <p className="text-[10px] font-black text-purple-600 uppercase tracking-wider">{dealGroup.dealBadge || "Active Deal"}</p>
                    </div>
                    {isCollapsed && (
                      <span className="text-[10px] font-black text-[var(--user-text-muted)] bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-2 py-0.5 rounded-full">
                        {dealGroup.items.length} {dealGroup.items.length === 1 ? "item" : "items"}
                      </span>
                    )}
                    {dealGroup.totalSavings > 0 && !isCollapsed && (
                      <span className="text-xs font-black text-[var(--user-success)] flex items-center gap-1">
                        <TrendingUp size={12} /> Save {fmt(dealGroup.totalSavings)}
                      </span>
                    )}
                  </div>
                  
                  {!isCollapsed && (
                    <div className="p-4 space-y-3">
                      {dealGroup.items.map((row) => (
                        <ItemRow key={row.key} row={row} isDeal dealBadge={dealGroup.dealBadge} isSelected={isLineSelected(row.key)} onToggleSelect={() => toggleLineSelected(row.key)} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Regular Items */}
            {groupedItems.regular.length > 0 && (
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--user-text-muted)] mb-3 px-1 flex items-center gap-2">
                  <Box size={14} />
                  Regular Items ({groupedItems.regular.length})
                </h3>
                <div className="space-y-3">
                  {groupedItems.regular.map((row) => (
                    <ItemRow key={row.key} row={row} isSelected={isLineSelected(row.key)} onToggleSelect={() => toggleLineSelected(row.key)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Order Summary */}
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="rounded-2xl border-2 border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 sm:p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-base font-black text-[var(--user-text)] mb-5">
                <div className="w-9 h-9 rounded-lg bg-[var(--user-accent)] flex items-center justify-center">
                  <Package size={17} className="text-[var(--user-accent-text)]" />
                </div>
                Order Summary
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-[var(--user-text-muted)]">
                  <span>Subtotal ({count} items)</span>
                  <span className="font-bold text-[var(--user-text)]">{fmt(totals.subtotal)}</span>
                </div>
                {totals.totalSavings > 0 && (
                  <div className="flex justify-between bg-[var(--user-success)]/10 border border-[var(--user-success)]/20 rounded-xl px-3 py-2.5 -mx-2">
                    <span className="flex items-center gap-1.5 font-black text-[var(--user-success)]">
                      <Tag size={13} /> Total Savings
                    </span>
                    <span className="font-black text-[var(--user-success)]">-{fmt(totals.totalSavings)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--user-text-muted)]">
                  <span className="flex items-center gap-1.5">
                    <Truck size={13} /> Shipping
                    {totals.freeShippingActiveForDefault && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 text-[9px] font-black text-orange-600">
                        <Truck size={9} /> Deal
                      </span>
                    )}
                    {shipping === 0 && (
                      <span className="text-[9px] font-black text-[var(--user-success)] bg-[var(--user-success)]/15 border border-[var(--user-success)]/30 px-1.5 py-0.5 rounded">FREE</span>
                    )}
                  </span>
                  <span className="font-bold text-[var(--user-text)]">
                    {shipping === 0 ? "Rs. 0" : fmt(shipping)}
                  </span>
                </div>
                {shippingReason && (
                  <p className="text-[10px] text-[var(--user-success)] font-semibold -mt-1">{shippingReason}</p>
                )}
                {totals.tax > 0 && (
                  <div className="flex justify-between text-[var(--user-text-muted)]">
                    <span>Tax</span>
                    <span className="font-bold text-[var(--user-text)]">{fmt(totals.tax)}</span>
                  </div>
                )}

                <div className="flex justify-between pt-4 mt-4 border-t-2 border-[var(--user-border)]">
                  <span className="text-base font-black text-[var(--user-text)]">Total</span>
                  <div className="text-right">
                    <p className="text-2xl font-black text-[var(--user-accent)] leading-none">{fmt(grandTotal)}</p>
                    <p className="text-[10px] text-[var(--user-text-muted)] mt-1">Including all taxes</p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => canCheckout && router.push("/checkout")}
                disabled={!canCheckout}
                className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--user-accent)] py-4 text-sm font-black uppercase tracking-widest text-[var(--user-accent-text)] hover:opacity-90 hover:shadow-xl hover:shadow-[var(--user-accent)]/20 active:scale-[0.98] transition-all disabled:pointer-events-none disabled:opacity-50"
              >
                {canCheckout ? (<>Proceed to Checkout <ArrowRight size={16} /></>) : ("Select items to checkout")}
              </button>

              <div className="mt-5 pt-5 border-t-2 border-[var(--user-border)] space-y-2">
                <p className="flex items-center gap-2 text-[10px] text-[var(--user-text-muted)]">
                  <Lock size={11} className="text-[var(--user-accent)]" /> Secure checkout with encrypted payment
                </p>
                <p className="flex items-center gap-2 text-[10px] text-[var(--user-text-muted)]">
                  <ShieldCheck size={11} className="text-[var(--user-accent)]" /> 100% protected & guaranteed delivery
                </p>
                <p className="flex items-center gap-2 text-[10px] text-[var(--user-text-muted)]">
                  <CreditCard size={11} className="text-[var(--user-accent)]" /> COD, Card & Bank transfer accepted
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ MOBILE STICKY PROCEED BAR */}
      {hasItems && (
        <div className="fixed bottom-16 left-0 right-0 z-40 md:hidden bg-[var(--user-bg-elevated)]/95 backdrop-blur-md border-t-2 border-[var(--user-border)] px-4 py-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[var(--user-text-muted)] font-bold">{count} items · {totals.freeShippingActiveForDefault || shipping === 0 ? "FREE shipping" : `Shipping ${fmt(shipping)}`}</p>
              <p className="text-lg font-black text-[var(--user-accent)]">{fmt(grandTotal)}</p>
            </div>
            <button
              onClick={() => router.push("/checkout")}
              className="h-12 px-6 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-black uppercase tracking-wider flex items-center gap-2 active:scale-95 transition"
            >
              Checkout <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </main>
    </div>

    {/* ============= MOBILE (Daraz-style) — lg:hidden ============= */}
    <div className="lg:hidden">
      {/* Sticky top app bar */}
      <div
        className="sticky top-0 z-30 bg-[var(--user-bg-elevated)]/90 backdrop-blur-md border-b border-[var(--user-border)]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-2 px-3 h-12">
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition active:scale-90"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-black text-[var(--user-text)] leading-none truncate">Cart</p>
            <p className="text-[11px] text-[var(--user-text-muted)] mt-0.5">{count} {count === 1 ? "item" : "items"}</p>
          </div>
          <span className="text-[11px] font-bold text-[var(--user-text-muted)] tabular-nums">{fmt(grandTotal)}</span>
        </div>
      </div>

      {/* Content */}
      <div className="bg-[var(--user-bg)] px-3 pt-3 pb-28 min-h-[60vh]">
        {!hasItems ? (
          <div className="flex flex-col items-center justify-center pt-16 pb-8 text-center">
            <div className="w-20 h-20 rounded-full bg-[var(--user-bg-card)] border-2 border-[var(--user-border)] flex items-center justify-center mb-5">
              <ShoppingBag size={36} className="text-[var(--user-accent)]" />
            </div>
            <h2 className="text-lg font-black text-[var(--user-text)] mb-1.5">Your cart is empty</h2>
            <p className="text-xs text-[var(--user-text-muted)] mb-6 max-w-[280px]">Looks like you haven&apos;t added anything yet. Let&apos;s find something great.</p>
            <Link
              href="/product"
              className="w-full max-w-xs h-11 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition"
            >
              Start Shopping <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <>
              {/* Optional FREE shipping progress (matches desktop) */}
              {freeOver > 0 && !totals.hasFreeShippingDeal && (
                <div className="rounded-xl border border-[var(--user-success)]/30 bg-[var(--user-success)]/10 p-3 mb-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Truck size={15} className="text-[var(--user-success)] shrink-0" />
                    {freeRemaining > 0 ? (
                      <p className="text-[12px] font-bold text-[var(--user-text)]">
                        Add <span className="text-[var(--user-success)]">{fmt(freeRemaining)}</span> more for FREE shipping!
                      </p>
                    ) : (
                      <p className="text-[12px] font-black text-[var(--user-success)] flex items-center gap-1">
                        <Check size={13} /> You&apos;ve unlocked FREE shipping!
                      </p>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--user-bg-hover)] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[var(--user-success)] to-emerald-500 transition-all duration-700 ease-out" style={{ width: `${freeProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Deal sections (mobile cards) */}
              {groupedItems.deals.map((dealGroup) => (
                <div key={dealGroup.dealId} className="mb-3">
                  <div className="flex items-center gap-2 px-1 mb-1.5">
                    <Sparkles size={13} className="text-purple-500" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-purple-500">{dealGroup.dealBadge || dealGroup.dealName}</span>
                  </div>
                  {dealGroup.items.map((row) => (
                    <MobileCartCard key={row.key} row={row} onDec={() => row.qty > 1 && updateQty(row.key, row.qty - 1)} onInc={() => updateQty(row.key, row.qty + 1)} onRemove={handleRemove} isDeal dealBadge={dealGroup.dealBadge} isSelected={isLineSelected(row.key)} onToggleSelect={() => toggleLineSelected(row.key)} />
                  ))}
                </div>
              ))}

              {/* Regular items */}
              {groupedItems.regular.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 px-1 mb-1.5">
                    <Box size={13} className="text-[var(--user-text-muted)]" />
                    <span className="text-[11px] font-black uppercase tracking-wider text-[var(--user-text-muted)]">Items ({groupedItems.regular.length})</span>
                  </div>
                  {groupedItems.regular.map((row) => (
                    <MobileCartCard key={row.key} row={row} onDec={() => row.qty > 1 && updateQty(row.key, row.qty - 1)} onInc={() => updateQty(row.key, row.qty + 1)} onRemove={handleRemove} isSelected={isLineSelected(row.key)} onToggleSelect={() => toggleLineSelected(row.key)} />
                  ))}
                </div>
              )}
            </>
        )}
      </div>

      {/* Sticky bottom bar (mobile) — direct child of lg:hidden page root, fixed bottom-0 z-50 */}
      {hasItems && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--user-bg-elevated)]/95 backdrop-blur-md border-t border-[var(--user-border)]"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-[var(--user-text-muted)] font-bold uppercase tracking-wider">
                Total
                <span className={`ml-1 ${totals.freeShippingActiveForDefault || shipping === 0 ? "text-[var(--user-success)]" : "text-[var(--user-text-muted)]"}`}>
                  {totals.freeShippingActiveForDefault || shipping === 0 ? "FREE shipping" : "incl. shipping"}
                </span>
              </p>
              <p className="text-base font-black text-[var(--user-accent)] leading-none mt-0.5">{fmt(grandTotal)}</p>
            </div>
            <button
              type="button"
              onClick={() => canCheckout && router.push("/checkout")}
              disabled={!canCheckout}
              className="h-11 px-6 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-xs font-black uppercase tracking-wider flex items-center gap-2 active:scale-95 transition shadow-lg shadow-[var(--user-accent)]/20 disabled:pointer-events-none disabled:opacity-50"
            >
              Checkout <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}

// ✅ MOBILE cart card (Daraz-style) — reusable in mobile tree, uses passed-in handlers.
function MobileCartCard({ row, onDec, onInc, onRemove, isDeal = false, dealBadge = null, isSelected = true, onToggleSelect }) {
  const img = getImgUrl(row.image);
  return (
    <div className={`bg-[var(--user-bg-card)] rounded-xl border border-[var(--user-border)] p-3 mb-2 flex items-start gap-2 ${!isSelected ? "opacity-60" : ""}`}>
      {/* ✅ Selection checkbox — 20px visible, 28px tap target, top-aligned to thumb */}
      <button
        type="button"
        onClick={() => onToggleSelect?.()}
        aria-label={isSelected ? `Unselect ${row.name}` : `Select ${row.name}`}
        aria-pressed={isSelected}
        className="shrink-0 p-1 mt-0.5 rounded-md hover:bg-[var(--user-bg-hover)] active:scale-95 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
      >
        <span
          className={`flex items-center justify-center w-5 h-5 rounded-full border-2 transition-[background,border-color,transform] duration-150 ${isSelected ? "bg-[var(--user-accent)] border-[var(--user-accent)]" : "bg-transparent border-[var(--user-border)] hover:border-[var(--user-accent)]/60"}`}
        >
          {isSelected && <Check size={12} className="text-[var(--user-accent-text)]" strokeWidth={3} />}
        </span>
      </button>
      <Link href={`/product/${row.raw.productId || row.raw.id}`} className="shrink-0">
        {img ? (
          <img src={img} alt={row.name} className="w-20 h-20 rounded-lg object-cover border border-[var(--user-border)] bg-[var(--user-bg-hover)]" />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-[var(--user-bg-hover)] border border-[var(--user-border)] flex items-center justify-center">
            <Package size={26} className="text-[var(--user-text-muted)]" />
          </div>
        )}
      </Link>
      <div className="flex-1 min-w-0 flex flex-col">
        <Link href={`/product/${row.raw.productId || row.raw.id}`} className="text-[13px] font-bold text-[var(--user-text)] line-clamp-2 leading-tight">
          {row.name}
        </Link>
        {row.variantTitle && (
          <p className="text-[10px] text-[var(--user-text-muted)] mt-0.5 truncate">{row.variantTitle}</p>
        )}
        {(isDeal && dealBadge) || row.freeItems > 0 || row.hasDiscount ? (
          <div className="flex flex-wrap items-center gap-1 mt-1">
            {isDeal && dealBadge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-600 text-white px-1.5 py-0.5 text-[9px] font-black">
                <Sparkles size={8} /> {dealBadge}
              </span>
            )}
            {row.freeItems > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--user-success)]/15 text-[var(--user-success)] border border-[var(--user-success)]/25 px-1.5 py-0.5 text-[9px] font-black">
                <Check size={8} /> {row.freeItems} FREE
              </span>
            )}
            {row.hasDiscount && row.originalPrice > row.displayPrice && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--user-accent)]/10 text-[var(--user-accent)] border border-[var(--user-accent)]/25 px-1.5 py-0.5 text-[9px] font-black">
                <TrendingUp size={8} /> -{Math.round(((row.originalPrice - row.displayPrice) / row.originalPrice) * 100)}%
              </span>
            )}
          </div>
        ) : null}

        {/* Price row */}
        <div className="flex items-baseline gap-1.5 mt-1">
          <p className="text-[13px] font-black text-[var(--user-accent)]">{fmt(row.displayPrice)}</p>
          {row.hasDiscount && row.originalPrice * row.qty > row.lineTotal && (
            <p className="text-[10px] text-[var(--user-text-muted)] line-through">{fmt(row.originalPrice * row.qty)}</p>
          )}
        </div>

        {/* Qty stepper + delete */}
        <div className="flex items-center justify-between mt-auto pt-1.5">
          <div className="inline-flex items-center rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-elevated)] overflow-hidden">
            <button
              type="button"
              onClick={onDec}
              disabled={row.qty <= 1}
              aria-label="Decrease"
              className="h-7 w-7 flex items-center justify-center text-[var(--user-text-muted)] hover:bg-[var(--user-bg-hover)] active:scale-90 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <Minus size={13} />
            </button>
            <span className="w-7 text-center text-[12px] font-black tabular-nums text-[var(--user-text)]">{row.qty}</span>
            <button
              type="button"
              onClick={onInc}
              aria-label="Increase"
              className="h-7 w-7 flex items-center justify-center text-[var(--user-text-muted)] hover:bg-[var(--user-bg-hover)] active:scale-90 transition"
            >
              <Plus size={13} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => onRemove(row)}
            aria-label={`Remove ${row.name}`}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--user-text-muted)] hover:bg-[var(--user-danger)]/10 hover:text-[var(--user-danger)] active:scale-90 transition"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}