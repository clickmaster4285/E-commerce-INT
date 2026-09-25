"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Check,
  Package,
  Layers,
  ChevronDown,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useCart } from "./CartContext";
import { productApi } from "@/apis/user/productApi";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

export const getBundleImageUrl = (img) => {
  const raw = typeof img === "string" ? img : img?.img_url;
  if (!raw) return "";
  if (raw.startsWith("http") || raw.startsWith("blob:") || raw.startsWith("data:")) {
    return raw;
  }
  return `${API_ORIGIN}${raw.startsWith("/") ? "" : "/"}${raw}`;
};

const getProductPrice = (product) => {
  if (!product) return 0;
  const direct = Number(product.price || product.selling_price || 0);
  const variant = product.variants?.[0]?.selling_price
    ? Number(product.variants[0].selling_price)
    : 0;
  return direct > 0 ? direct : variant;
};

/**
 * ✅ Bundle ke andar wale products resolve karo (cart lines ke liye).
 * Har entry: { product, variant, quantity }
 */
export function resolveBundleItems(bundle, products = []) {
  const list = Array.isArray(products) ? products : [];
  return (bundle?.products || [])
    .map((entry) => {
      const rawId = entry?.product?._id || entry?.product || entry?.productId;
      const pid = rawId ? String(rawId) : "";
      if (!pid) return null;
      const product = list.find((p) => String(p._id || p.id) === pid);
      if (!product) return null;
      return {
        product,
        variant: product.variants?.[0] || null,
        quantity: Math.max(1, Number(entry?.quantity) || 1),
      };
    })
    .filter(Boolean);
}

export default function BundleCard({ bundle, className = "" }) {
  const [added, setAdded] = useState(false);
  const [showItems, setShowItems] = useState(false);
  const { addBundleToCart } = useCart();

  // ✅ Cart lines banane ke liye products (variants / prices / images) chahiye
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["bundle-products"],
    queryFn: productApi.getAll,
    staleTime: 60 * 1000,
  });

  const items = useMemo(
    () => resolveBundleItems(bundle, products),
    [bundle, products]
  );

  const name = bundle?.name || "Bundle Deal";
  const bundlePrice = Number(bundle?.bundlePrice) || 0;

  const originalPrice =
    Number(bundle?.originalPrice) ||
    items.reduce((sum, i) => sum + getProductPrice(i.product) * i.quantity, 0);

  const savings = Math.max(0, originalPrice - bundlePrice);
  const percent =
    Number(bundle?.discountPercent) ||
    (originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0);

  const image = getBundleImageUrl(bundle?.imageUrl || bundle?.image);
  const canAdd = items.length >= 2;
  const itemCount =
    Number(bundle?.itemCount) ||
    items.reduce((sum, i) => sum + i.quantity, 0);

  const handleAdd = () => {
    if (isLoading) return;
    if (!canAdd) {
      toast.error("This bundle is not available right now");
      return;
    }
    addBundleToCart(bundle, items);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div
      className={`group relative flex flex-col h-full bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-2xl overflow-hidden hover:border-[var(--user-accent)]/50 hover:-translate-y-0.5 hover:shadow-[var(--user-shadow-md)] transition-all duration-300 ${className}`}
    >
      {/* ✅ SIRF bundle ki manual cover image — individual product images nahi */}
      <div className="relative aspect-square bg-[var(--user-bg-hover)] overflow-hidden shrink-0">
        {image ? (
          <img
            src={image}
            alt={name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={44} className="text-[var(--user-text-subtle)]" />
          </div>
        )}

        <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5 items-start">
          <span className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg">
            <Layers size={9} /> BUNDLE
          </span>
          {percent > 0 && (
            <span className="bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[10px] font-bold px-2 py-0.5 rounded-full">
              {percent}% OFF
            </span>
          )}
        </div>

        {itemCount > 0 && (
          <span className="absolute top-2.5 right-2.5 z-10 bg-black/45 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/10">
            {itemCount} items
          </span>
        )}
      </div>

      <div className="p-3 lg:p-4 flex flex-col flex-1 min-w-0">
        <p className="text-[var(--user-text-subtle)] text-[10px] uppercase tracking-wider font-bold mb-1 truncate">
          Combo Deal
        </p>

        <h3 className="text-[var(--user-text)] font-medium text-sm lg:text-[15px] line-clamp-2 leading-snug min-h-[2.6em]">
          {name}
        </h3>

        {bundle?.description ? (
          <p className="mt-1 text-[11px] line-clamp-1 text-[var(--user-text-subtle)]">
            {bundle.description}
          </p>
        ) : null}

        {/* What's inside — sirf product names (images nahi) */}
        <button
          type="button"
          onClick={() => setShowItems((v) => !v)}
          className="mt-2 self-start text-[11px] font-semibold text-[var(--user-text-subtle)] hover:text-[var(--user-accent)] transition flex items-center gap-1"
        >
          <ChevronDown
            size={12}
            className={`transition-transform ${showItems ? "rotate-180" : ""}`}
          />
          {showItems ? "Hide products" : "What's inside?"}
        </button>

        {showItems && (
          <ul className="mt-1.5 mb-1 space-y-1">
            {items.length === 0 ? (
              <li className="text-[11px] text-[var(--user-text-subtle)]">
                Products load ho rahe hain...
              </li>
            ) : (
              items.map(({ product, quantity }) => (
                <li
                  key={product._id || product.id}
                  className="text-[11px] text-[var(--user-text-secondary)] flex items-start gap-1.5"
                >
                  <span className="text-[var(--user-accent)] font-bold">
                    {quantity}×
                  </span>
                  <span className="truncate">{product.name}</span>
                </li>
              ))
            )}
          </ul>
        )}

        <div className="mt-auto pt-2.5 flex flex-col items-start min-w-0">
          {originalPrice > bundlePrice && (
            <span className="text-[11px] lg:text-xs text-[var(--user-text-subtle)] line-through whitespace-nowrap">
              Rs. {originalPrice.toLocaleString()}
            </span>
          )}
          <h4 className="text-base lg:text-lg font-bold text-[var(--user-text)] whitespace-nowrap">
            Rs. {bundlePrice.toLocaleString()}
          </h4>
          {savings > 0 && (
            <span className="mt-1 text-[10px] font-semibold text-[var(--user-success)] flex items-center gap-1 whitespace-nowrap">
              <Sparkles size={10} /> Save Rs. {savings.toLocaleString()}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={isLoading || !canAdd}
          className={`mt-3 w-full h-9 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
            added
              ? "bg-[var(--user-success)] text-white"
              : "bg-[var(--user-accent)] text-[var(--user-accent-text)] hover:brightness-110"
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Loading...
            </>
          ) : added ? (
            <>
              <Check size={14} /> Added
            </>
          ) : !canAdd ? (
            "Unavailable"
          ) : (
            <>
              <Plus size={14} /> Add Bundle to Cart
            </>
          )}
        </button>

      </div>
    </div>
  );
}
