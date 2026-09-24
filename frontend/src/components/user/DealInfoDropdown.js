"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import { Sparkles, Tag, PackageOpen, Package, Truck, Zap, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useDiscounts } from "./DiscountContext";
import { getEffectiveMinQuantity } from "@/utils/dealCalculator";

function getDealIcon(type) {
  if (type === "percentage") return Tag;
  if (type === "fixed_amount") return Tag;
  if (type === "buy_x_get_y") return PackageOpen;
  if (type === "bundle") return Package;
  if (type === "free_shipping") return Truck;
  if (type === "flash_sale") return Zap;
  return Tag;
}

function getDealColor(type) {
  if (type === "percentage") return "from-green-500 to-emerald-600";
  if (type === "fixed_amount") return "from-blue-500 to-cyan-600";
  if (type === "buy_x_get_y") return "from-purple-500 to-pink-600";
  if (type === "bundle") return "from-indigo-500 to-purple-600";
  if (type === "free_shipping") return "from-orange-500 to-red-600";
  if (type === "flash_sale") return "from-yellow-500 to-orange-600";
  return "from-orange-500 to-red-600";
}

function getDealBadgeText(deal) {
  if (!deal) return "";
  const val = deal.discountValue || 0;
  const buyQty = deal.buyQuantity || 0;
  const getQty = deal.getQuantity || 0;
  if (deal.type === "percentage") return val > 0 ? `${val}% OFF` : "";
  if (deal.type === "fixed_amount") return val > 0 ? `Rs. ${val} OFF` : "";
  if (deal.type === "buy_x_get_y") return buyQty > 0 && getQty > 0 ? `Buy ${buyQty} Get ${getQty}` : "Buy X Get Y";
  if (deal.type === "bundle") return "Bundle Deal";
  if (deal.type === "free_shipping") return "Free Shipping";
  if (deal.type === "flash_sale") return "Flash Sale";
  return deal.name || "Deal";
}

function getDealSavingsPreview(deal, regularPrice) {
  if (!deal) return null;
  const price = Math.max(0, Number(regularPrice) || 0);
  if (deal.type === "percentage" && Number(deal.discountValue) > 0) {
    const save = Math.round(price * (Number(deal.discountValue) / 100));
    return save > 0 ? `Save Rs. ${save.toLocaleString()}` : null;
  }
  if (deal.type === "fixed_amount" && Number(deal.discountValue) > 0) {
    const save = Math.min(Number(deal.discountValue), price);
    return save > 0 ? `Save Rs. ${Math.round(save).toLocaleString()}` : null;
  }
  if (deal.type === "buy_x_get_y") {
    const buy = Number(deal.buyQuantity) || 0;
    const get = Number(deal.getQuantity) || 0;
    if (buy > 0 && get > 0 && price > 0) return `Save Rs. ${Math.round(get * price).toLocaleString()}`;
    if (buy > 0 && get > 0) return `Get ${get} free`;
    return null;
  }
  if (deal.type === "free_shipping") return "Free delivery";
  return null;
}

export default function DealInfoDropdown({ cartItem, onApplyDeal, open, onClose }) {
  const rootRef = useRef(null);
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const { deals: allDeals = [] } = useDiscounts();

  const productId = cartItem?.productId || cartItem?.id || "";
  const categoryId = cartItem?.categoryId || cartItem?.category_id || "";
  const brandId = cartItem?.brandId || cartItem?.brand_id || "";
  const currentQty = Number(cartItem?.qty || 0);
  const activeDealId = cartItem?.dealId || null;
  const regularPrice = Number(cartItem?.dealRegularPrice || cartItem?.regularPrice || cartItem?.price || 0);

  const availableDeals = useMemo(() => {
    if (!allDeals.length || !productId) return [];
    const now = new Date();
    return allDeals.filter((deal) => {
      if (!deal.isActive) return false;
      const start = new Date(deal.startDate);
      const end = new Date(deal.endDate);
      if (start > now || end < now) return false;
      if (deal.applyTo === "all") return true;
      if (deal.applyTo === "product" || deal.applyTo === "specific_products") {
        const ids = deal.productIds || deal.selectedProducts || [];
        return ids.some((p) => String(p?._id || p) === String(productId));
      }
      if (deal.applyTo === "category" || deal.applyTo === "specific_categories") {
        const ids = deal.categoryIds || deal.selectedCategories || [];
        return categoryId && ids.some((c) => String(c?._id || c) === String(categoryId));
      }
      if (deal.applyTo === "brand" || deal.applyTo === "specific_brands") {
        const ids = deal.brandIds || deal.selectedBrands || [];
        return brandId && ids.some((b) => String(b?._id || b) === String(brandId));
      }
      return false;
    });
  }, [allDeals, productId, categoryId, brandId]);

  const updateScrollButtons = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    if (!open) return undefined;
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = 0;
      updateScrollButtons();
      el.addEventListener("scroll", updateScrollButtons, { passive: true });
      window.addEventListener("resize", updateScrollButtons);
    }
    return () => {
      el?.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const onMouseDown = (e) => {
      const root = rootRef.current;
      if (!root) return;
      // ✅ Hidden twin tree (desktop/mobile dono trees render this panel, ek CSS se
      // display:none hota hai) ka listener close-na kar-de — warna woh hamesha
      // "outside" click samajh kar panel band kar deta hai aur deal kabhi select nahi hoti.
      if (root.getClientRects().length === 0) return;
      if (!root.contains(e.target)) onClose?.();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!availableDeals.length) return null;
  if (!open) return null;

  const handleSelect = (deal) => {
    onApplyDeal?.(activeDealId === deal._id ? null : deal);
    onClose?.();
  };

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardW = el.firstChild?.clientWidth || 120;
    el.scrollBy({ left: dir * (cardW + 8), behavior: "smooth" });
  };

  return (
    <div
      ref={rootRef}
      className="deal-picker-panel absolute inset-0 z-40 flex flex-col overflow-hidden rounded-xl border-2 border-purple-500/30 bg-[var(--user-bg-card)] shadow-xl shadow-purple-500/20"
      role="listbox"
      aria-label="Available deals for this item"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-purple-500/15 bg-gradient-to-r from-purple-500/10 to-pink-500/10 px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles size={11} className="text-purple-600" />
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-600">Available Offers</span>
        </div>
        <div className="flex items-center gap-1">
          {availableDeals.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => scroll(-1)}
                disabled={!canScrollLeft}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 transition hover:bg-purple-500/20 disabled:opacity-30"
              >
                <ChevronLeft size={12} />
              </button>
              <button
                type="button"
                onClick={() => scroll(1)}
                disabled={!canScrollRight}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 transition hover:bg-purple-500/20 disabled:opacity-30"
              >
                <ChevronRight size={12} />
              </button>
            </>
          )}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 snap-x snap-mandatory gap-2 overflow-x-auto overflow-y-hidden overscroll-contain px-2 py-2"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {availableDeals.map((deal) => {
          const Icon = getDealIcon(deal.type);
          const color = getDealColor(deal.type);
          const minQty = getEffectiveMinQuantity(deal);
          const meetsMin = currentQty >= minQty;
          const gap = Math.max(0, minQty - currentQty);
          const isSelected = activeDealId === deal._id;
          const savingsText = getDealSavingsPreview(deal, regularPrice);
          const badgeText = getDealBadgeText(deal);

          return (
            <button
              key={deal._id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => handleSelect(deal)}
              className={`snap-start shrink-0 flex flex-col items-center justify-center gap-1 rounded-lg border p-2 text-center transition-all min-w-[90px] ${
                isSelected
                  ? "border-[var(--user-accent)]/40 bg-[var(--user-accent)]/10"
                  : "border-[var(--user-border)] hover:border-purple-500/30 hover:bg-purple-500/5"
              }`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                  isSelected ? "bg-[var(--user-accent)]" : `bg-gradient-to-r ${color}`
                }`}
              >
                {isSelected ? <Check size={13} strokeWidth={3} className="text-white" /> : <Icon size={13} className="text-white" />}
              </span>
              <span className={`line-clamp-2 text-[10px] font-bold leading-tight ${isSelected ? "text-[var(--user-accent)]" : "text-[var(--user-text)]"}`}>
                {deal.name}
              </span>
              {badgeText ? (
                <span className={`rounded-full bg-gradient-to-r px-1.5 py-px text-[8px] font-black text-white ${color}`}>
                  {badgeText}
                </span>
              ) : null}
              {savingsText && (
                <span className="text-[8px] font-bold text-[var(--user-success)]">{savingsText}</span>
              )}
              {!meetsMin && (
                <span className="text-[8px] font-semibold text-orange-500">+{gap} more</span>
              )}
              {isSelected && (
                <span className="text-[8px] font-black uppercase text-[var(--user-accent)]">Applied</span>
              )}
            </button>
          );
        })}
      </div>

      {activeDealId && (
        <button
          type="button"
          onClick={() => { onApplyDeal?.(null); onClose?.(); }}
          className="w-full shrink-0 border-t border-[var(--user-border)] px-2.5 py-1.5 text-center text-[10px] font-bold text-red-500 transition hover:bg-red-500/10"
        >
          Remove Deal
        </button>
      )}
    </div>
  );
}
