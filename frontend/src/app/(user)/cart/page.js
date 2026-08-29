"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, ShoppingBag, Package, Tag, Check, Plus, Minus,
  Trash2, Sparkles, Zap, Truck, PackageOpen, ChevronDown, ShieldCheck, Lock
} from "lucide-react";
import { useCart } from "@/components/user/CartContext";
import { useDiscounts } from "@/components/user/DiscountContext";
import { calculateFreeItems, calculatePayableItems, calculateBuyXGetYSavings } from "@/utils/dealCalculator";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const SHIPPING_FEE = 200;

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
  const { cart, updateQty, removeFromCart, restoreItems } = useCart();
  const { calculateProductDiscount } = useDiscounts();
  const [collapsedDeals, setCollapsedDeals] = useState(() => new Set());

  const toggleDealCollapse = (dealId) => {
    setCollapsedDeals((prev) => {
      const next = new Set(prev);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      return next;
    });
  };

  // ✅ Same grouping logic as drawer
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
      
      const qty = raw.qty;
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

    return { deals: Array.from(dealGroups.values()), regular: regularItems };
  }, [cart, calculateProductDiscount]);

  const totals = useMemo(() => {
    const allItems = [...groupedItems.deals.flatMap(d => d.items), ...groupedItems.regular];
    const subtotal = allItems.reduce((s, i) => s + i.lineTotal, 0);
    const totalSavings = allItems.reduce((s, i) => {
      if (i.raw.dealType === "buy_x_get_y") return s + i.dealSavings;
      if (i.originalPrice > i.displayPrice) return s + (i.originalPrice - i.displayPrice) * i.qty;
      return s;
    }, 0);
    const tax = Math.round(allItems.reduce((s, i) => s + i.displayPrice * i.payableItems * (Number(i.raw.tax || 0) / 100), 0));
    const hasFreeShippingDeal = allItems.some((i) => i.raw.dealType === "free_shipping");
    const shipping = hasFreeShippingDeal ? 0 : SHIPPING_FEE;
    const grandTotal = subtotal + shipping + tax;
    return { subtotal, totalSavings, tax, shipping, grandTotal, hasFreeShippingDeal };
  }, [groupedItems]);

  const count = cart.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const hasItems = cart.length > 0;

  const handleRemove = (row) => {
    removeFromCart(row.key);
    toast.success("Item removed", { action: { label: "Undo", onClick: () => restoreItems([row.raw]) } });
  };

  // ✅ Detailed Item Row (bigger than drawer)
  const ItemRow = ({ row, isDeal = false, dealBadge = null }) => (
    <div className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border transition-colors ${isDeal ? "border-[var(--user-accent)]/20 bg-[var(--user-bg-card)]" : "border-[var(--user-border)] bg-[var(--user-bg-card)] hover:border-[var(--user-border-hover)]"}`}>
      {/* Image + Name */}
      <div className="flex gap-4 flex-1 min-w-0">
        <Link href={`/product/${row.raw.productId || row.raw.id}`} className="shrink-0">
          {getImgUrl(row.image) ? (
            <img src={getImgUrl(row.image)} alt={row.name} className="w-24 h-24 rounded-xl object-cover border border-[var(--user-border)] bg-white" />
          ) : (
            <div className="w-24 h-24 rounded-xl bg-[var(--user-bg-hover)] border border-[var(--user-border)] flex items-center justify-center">
              <Package size={28} className="text-[var(--user-text-subtle)]" />
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/product/${row.raw.productId || row.raw.id}`} className="text-sm sm:text-base font-bold text-[var(--user-text)] hover:text-[var(--user-accent)] transition-colors line-clamp-2">
            {row.name}
          </Link>
          {row.brand && <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--user-text-subtle)] mt-1">{row.brand}</p>}
          {row.variantTitle && <p className="text-xs text-[var(--user-text-muted)] mt-0.5">{row.variantTitle}</p>}
          
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {isDeal && dealBadge && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-bold text-purple-600">
                <Sparkles size={10} /> {dealBadge}
              </span>
            )}
            {row.freeItems > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-600">
                <Check size={10} /> {row.freeItems} FREE
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <p className="text-sm font-bold text-[var(--user-text)]">{fmt(row.displayPrice)}</p>
            {row.hasDiscount && row.originalPrice > row.displayPrice && (
              <p className="text-xs text-[var(--user-text-subtle)] line-through">{fmt(row.originalPrice)}</p>
            )}
            <span className="text-[10px] text-[var(--user-text-muted)]">each</span>
          </div>
        </div>
      </div>

      {/* Qty + Total + Remove */}
      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 sm:shrink-0">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => row.qty > 1 && updateQty(row.key, row.qty - 1)} disabled={row.qty <= 1} aria-label="Decrease quantity" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--user-border)] text-[var(--user-text-muted)] hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] active:scale-90 disabled:pointer-events-none disabled:opacity-30 transition">
            <Minus size={14} />
          </button>
          <span className="w-9 text-center text-sm font-bold tabular-nums text-[var(--user-text)]">{row.qty}</span>
          <button type="button" onClick={() => updateQty(row.key, row.qty + 1)} aria-label="Increase quantity" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--user-border)] text-[var(--user-text-muted)] hover:bg-[var(--user-bg-hover)] hover:text-[var(--user-text)] active:scale-90 transition">
            <Plus size={14} />
          </button>
        </div>

        <div className="text-right">
          <p className="text-lg font-black text-[var(--user-accent)]">{fmt(row.lineTotal)}</p>
          {row.freeItems > 0 && (
            <p className="text-[10px] text-[var(--user-text-muted)]">{row.payableItems} paid + {row.freeItems} free</p>
          )}
          {row.savings > 0 && (
            <p className="text-[10px] font-semibold text-[var(--user-success)] flex items-center justify-end gap-1 mt-0.5">
              <Tag size={10} /> Save {fmt(row.savings * row.qty)}
            </p>
          )}
        </div>

        <button type="button" onClick={() => handleRemove(row)} aria-label={`Remove ${row.name}`} className="p-2 rounded-lg text-[var(--user-text-subtle)] hover:bg-[var(--user-danger)]/10 hover:text-[var(--user-danger)] transition">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <main className="max-w-[1200px] mx-auto px-4 lg:px-6 py-6 lg:py-10 pb-24 md:pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="flex items-center gap-3 text-2xl lg:text-3xl font-black text-[var(--user-text)]">
            <ShoppingBag size={28} className="text-[var(--user-accent)]" />
            Shopping Cart
          </h1>
          <p className="text-sm text-[var(--user-text-muted)] mt-1">{count} {count === 1 ? "item" : "items"} in your cart</p>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--user-accent)] hover:opacity-80 transition">
          <ArrowLeft size={16} /> Continue Shopping
        </Link>
      </div>

      {!hasItems ? (
        <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-16 text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-5">
            <ShoppingBag size={40} className="text-[var(--user-text-subtle)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--user-text)] mb-2">Your cart is empty</h2>
          <p className="text-sm text-[var(--user-text-muted)] mb-7 max-w-sm mx-auto">Looks like you haven't added anything yet. Explore our deals and start shopping!</p>
          <Link href="/" className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-7 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition">
            Start Shopping <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
          {/* LEFT — Items */}
          <div className="space-y-5">
            {/* Deal Sections */}
            {groupedItems.deals.map((dealGroup, di) => {
              const badgeConfig = getDealBadgeConfig({ type: dealGroup.dealType, buyQuantity: dealGroup.items[0]?.raw.dealBuyQuantity, getQuantity: dealGroup.items[0]?.raw.dealGetQuantity, discountValue: dealGroup.items[0]?.raw.dealSavings });
              const Icon = badgeConfig?.icon || Sparkles;
              const isCollapsed = collapsedDeals.has(dealGroup.dealId);
              
              return (
                <div key={dealGroup.dealId || di} className="rounded-2xl border border-purple-500/30 bg-purple-500/5 overflow-hidden">
                  <div className={`flex items-center gap-3 px-4 py-3.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 ${!isCollapsed ? "border-b border-purple-500/20" : ""}`}>
                    <button type="button" onClick={() => toggleDealCollapse(dealGroup.dealId)} aria-label={isCollapsed ? "Expand" : "Collapse"} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--user-text-muted)] hover:bg-purple-500/15 hover:text-[var(--user-text)] transition-colors">
                      <ChevronDown size={16} className={`transition-transform duration-300 ${isCollapsed ? "" : "rotate-180"}`} />
                    </button>
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-r ${badgeConfig?.color || "from-purple-500 to-pink-600"} flex items-center justify-center shrink-0`}>
                      <Icon size={17} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-[var(--user-text)] truncate">{dealGroup.dealName}</h3>
                      <p className="text-[10px] text-purple-600 font-semibold">{dealGroup.dealBadge || "Active Deal"}</p>
                    </div>
                    {isCollapsed && (
                      <span className="text-[10px] font-bold text-[var(--user-text-muted)] bg-[var(--user-bg-hover)] border border-[var(--user-border)] px-2 py-0.5 rounded-full">
                        {dealGroup.items.length} {dealGroup.items.length === 1 ? "item" : "items"}
                      </span>
                    )}
                    {dealGroup.totalSavings > 0 && (
                      <span className="text-xs font-bold text-[var(--user-success)]">Save {fmt(dealGroup.totalSavings)}</span>
                    )}
                  </div>
                  
                  {!isCollapsed && (
                    <div className="p-4 space-y-3">
                      {dealGroup.items.map((row) => (
                        <ItemRow key={row.key} row={row} isDeal dealBadge={dealGroup.dealBadge} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Regular Items */}
            {groupedItems.regular.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--user-text-muted)] mb-3 px-1">Regular Items</h3>
                <div className="space-y-3">
                  {groupedItems.regular.map((row) => (
                    <ItemRow key={row.key} row={row} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Order Summary */}
          <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 lg:sticky lg:top-24">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--user-text)] mb-4">
              <Package size={16} className="text-[var(--user-accent)]" /> Order Summary
            </h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-[var(--user-text-muted)]">
                <span>Subtotal ({count} items)</span>
                <span className="font-semibold text-[var(--user-text)]">{fmt(totals.subtotal)}</span>
              </div>
              {totals.totalSavings > 0 && (
                <div className="flex justify-between text-[var(--user-success)]">
                  <span className="flex items-center gap-1.5"><Tag size={13} /> Total Savings</span>
                  <span className="font-bold">-{fmt(totals.totalSavings)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--user-text-muted)]">
                <span className="flex items-center gap-1.5">Shipping {totals.hasFreeShippingDeal && <Truck size={12} className="text-[var(--user-success)]" />}</span>
                {totals.shipping === 0 ? (
                  <span className="text-[10px] font-bold text-[var(--user-success)] bg-[var(--user-success)]/10 border border-[var(--user-success)]/30 px-2 py-0.5 rounded">FREE</span>
                ) : (
                  <span className="font-semibold text-[var(--user-text)]">{fmt(totals.shipping)}</span>
                )}
              </div>
              {totals.tax > 0 && (
                <div className="flex justify-between text-[var(--user-text-muted)]">
                  <span>Tax</span>
                  <span className="font-semibold text-[var(--user-text)]">{fmt(totals.tax)}</span>
                </div>
              )}
              <div className="flex justify-between pt-3 border-t-2 border-[var(--user-border)]">
                <span className="text-base font-bold text-[var(--user-text)]">Total</span>
                <span className="text-2xl font-black text-[var(--user-accent)]">{fmt(totals.grandTotal)}</span>
              </div>
            </div>

            <button type="button" onClick={() => router.push("/checkout")} className="mt-5 w-full flex items-center justify-center gap-2 rounded-xl bg-[var(--user-accent)] py-4 text-sm font-bold uppercase tracking-widest text-[var(--user-accent-text)] hover:opacity-90 hover:shadow-lg hover:shadow-[var(--user-accent)]/20 active:scale-[0.98] transition-all">
              Proceed to Checkout <ArrowRight size={16} />
            </button>

            <div className="mt-4 space-y-2">
              <p className="flex items-center gap-2 text-[10px] text-[var(--user-text-muted)]">
                <Lock size={11} className="text-[var(--user-accent)]" /> Secure checkout with encrypted payment
              </p>
              <p className="flex items-center gap-2 text-[10px] text-[var(--user-text-muted)]">
                <ShieldCheck size={11} className="text-[var(--user-accent)]" /> 100% protected & guaranteed delivery
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}