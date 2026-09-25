"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Flame, Clock, ArrowRight, ChevronLeft, ChevronRight, Package, Zap, Sparkles, Layers, ShoppingCart } from "lucide-react";
import { dealApi } from "@/apis/user/dealApi";
import { productApi } from "@/apis/user/productApi";
import { useCart } from "./CartContext";
import {
  round2,
  normalizeBundleRule,
  bundleRuleLabel,
  bundleRuleRequiredQty,
} from "@/utils/bundleCalculator";
import ProductCard from "./ProductCard";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const getImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith("http")) return img;
  return `${API_ORIGIN}${img.startsWith("/") ? "" : "/"}${img}`;
};

function getDealConfig(type) {
  const configs = {
    percentage:    { gradient: "from-emerald-500 via-green-500 to-teal-600", hex: "#10b981" },
    fixed_amount:  { gradient: "from-blue-500 via-sky-500 to-cyan-600",     hex: "#3b82f6" },
    buy_x_get_y:   { gradient: "from-purple-500 via-fuchsia-500 to-pink-600", hex: "#a855f7" },
    bundle:        { gradient: "from-indigo-500 via-violet-500 to-purple-600", hex: "#6366f1" },
    free_shipping: { gradient: "from-orange-500 via-amber-500 to-red-600",   hex: "#f97316" },
  };
  return configs[type] || { gradient: "from-orange-500 via-amber-500 to-red-600", hex: "#f97316" };
}

function getDealBadgeText(deal) {
  if (!deal?.type) return null;
  if (deal.type === "percentage") return `${deal.discountValue}% OFF`;
  if (deal.type === "fixed_amount") return `Rs. ${deal.discountValue} OFF`;
  if (deal.type === "buy_x_get_y") {
    const b = deal.buyQuantity || 0;
    const g = deal.getQuantity || 0;
    return b > 0 && g > 0 ? `Buy ${b} Get ${g}` : "Buy X Get Y";
  }
  if (deal.type === "bundle") return "Bundle Deal";
  if (deal.type === "free_shipping") return "Free Shipping";
  return deal.type.replace(/_/g, " ").toUpperCase();
}

function useCountdown(endDate) {
  const [time, setTime] = useState(() => calcTime(endDate));
  useEffect(() => {
    const t = setInterval(() => setTime(calcTime(endDate)), 1000);
    return () => clearInterval(t);
  }, [endDate]);
  return time;
}

function calcTime(endDate) {
  const diff = new Date(endDate) - new Date();
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true };
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff / 3600000) % 24),
    m: Math.floor((diff / 60000) % 60),
    s: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

const idMatch = (arr, id) =>
  (arr || []).some((x) => String(typeof x === "object" ? x?._id : x) === String(id));

function matchDealProducts(deal, products) {
  if (!deal || !products?.length) return [];
  let out = [];
  switch (deal.applyTo) {
    case "product":
      out = products.filter((p) => idMatch(deal.productIds, p._id));
      break;
    case "category":
      out = products.filter((p) =>
        idMatch(deal.categoryIds, typeof p.category_id === "object" ? p.category_id?._id : p.category_id)
      );
      break;
    case "brand":
      out = products.filter((p) =>
        idMatch(deal.brandIds, typeof p.brand_id === "object" ? p.brand_id?._id : p.brand_id)
      );
      break;
    case "all":
    default:
      out = (deal.productIds || []).length
        ? products.filter((p) => idMatch(deal.productIds, p._id))
        : products;
      break;
  }
  return out;
}

export default function DealsSection() {
  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["activeDeals"],
    queryFn: dealApi.getActive,
    staleTime: 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  if (isLoading) return <DealsSkeleton />;
  if (!deals || deals.length === 0) return null;

  return (
    <section className="max-w-[1400px] mx-auto px-3 lg:px-6 py-5 lg:py-10">
      <style>{`
        @keyframes dealShine { 0% { transform: translateX(-150%) skewX(-20deg); } 60%, 100% { transform: translateX(400%) skewX(-20deg); } }
        @keyframes dealFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatY { 0%, 100% { transform: translateY(0) rotate(3deg); } 50% { transform: translateY(-6px) rotate(3deg); } }
        @keyframes dealProgress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes dealPulseRing { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.15); opacity: 0.15; } }
        @keyframes dealBadgeSweep { 0% { transform: translateX(-160%); } 55%, 100% { transform: translateX(420%); } }
      `}</style>
      <DealEngine deals={deals} />
    </section>
  );
}

/* =====================================================
   DEAL ENGINE
===================================================== */
function DealEngine({ deals }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((p) => (p + 1) % deals.length);
    }, 4000);
  }, [deals.length]);

  useEffect(() => {
    if (deals.length <= 1 || paused) {
      clearInterval(timerRef.current);
      return;
    }
    resetTimer();
    return () => clearInterval(timerRef.current);
  }, [deals.length, paused, resetTimer]);

  const goTo = (idx) => {
    setCurrent(idx);
    if (!paused) resetTimer();
  };
  const goPrev = () => goTo((current - 1 + deals.length) % deals.length);
  const goNext = () => goTo((current + 1) % deals.length);

  // ✅ Full product list for deal matching
  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const activeDeal = deals[current];
  const cfg = getDealConfig(activeDeal.type);
  const badgeText = getDealBadgeText(activeDeal);
  const time = useCountdown(activeDeal.endDate);
  const products = useMemo(() => matchDealProducts(activeDeal, allProducts), [activeDeal, allProducts]);

  const stripImg =
    getImageUrl(activeDeal.image) ||
    getImageUrl(activeDeal.productIds?.[0]?.images?.[0]?.img_url) ||
    null;

  const endsLabel = new Date(activeDeal.endDate).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });

  // ✅ Live sale-window progress — derived from countdown state (pure in render)
  const timePct = (() => {
    const start = new Date(
      activeDeal.startDate || activeDeal.createdAt || activeDeal.endDate
    ).getTime();
    const end = new Date(activeDeal.endDate).getTime();
    if (!start || !end || end <= start) return null;
    const remainMs = ((time.d * 24 + time.h) * 3600 + time.m * 60 + time.s) * 1000;
    return Math.min(100, Math.max(0, (1 - remainMs / (end - start)) * 100));
  })();

  // ✅ Real stock left across every product attached to this deal
  const totalStock = useMemo(() => {
    if (!products.length) return 0;
    return products.reduce((sum, p) => {
      const s = p.variants?.length
        ? p.variants.reduce((a, v) => a + Number(v.quantity || 0), 0)
        : Number(p.quantity || 0);
      return sum + (Number.isFinite(s) ? s : 0);
    }, 0);
  }, [products]);

  // ✅ Urgency level drives countdown tint + progress bar color
  const hoursLeft = time.d * 24 + time.h;
  const urgency = time.expired
    ? "ended"
    : hoursLeft <= 6
      ? "critical"
      : hoursLeft <= 24
        ? "high"
        : "normal";
  const urgencyHex =
    urgency === "critical" ? "#ef4444" : urgency === "high" ? "#f59e0b" : cfg.hex;
  const accent = urgency === "normal" ? null : urgencyHex;

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Slim header — elevated glass bar */}
      <div className="flex items-center justify-between mb-4 px-2.5 sm:px-4 py-2 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]/70 backdrop-blur-md shadow-sm">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="relative w-9 h-9 sm:w-10 sm:h-10">
            <span
              className="absolute inset-0 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 opacity-60 blur-md"
              style={{ animation: "dealPulseRing 2.4s ease-in-out infinite" }}
            />
            <div className="relative w-full h-full rounded-xl bg-gradient-to-br from-orange-500 via-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/40 ring-1 ring-white/20">
              <Flame size={17} className="text-white drop-shadow" />
            </div>
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight text-[var(--user-text)] leading-none">
              Hot{" "}
              <span className="bg-gradient-to-r from-orange-500 via-red-500 to-rose-500 bg-clip-text text-transparent">
                Deals
              </span>
            </h2>
            <span className="hidden sm:block text-[9px] font-bold uppercase tracking-[0.18em] text-[var(--user-text)] opacity-50 mt-1">
              Best offers · limited time
            </span>
          </div>
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${cfg.hex}18`, color: cfg.hex, border: `1px solid ${cfg.hex}45` }}
          >
            <span className="relative flex w-1.5 h-1.5">
              <span
                className="absolute inline-flex w-full h-full rounded-full"
                style={{ backgroundColor: cfg.hex, animation: "dealPulseRing 1.6s ease-out infinite" }}
              />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.hex }} />
            </span>
            {deals.length} Live
          </span>
        </div>
        <Link
          href="/deals"
          className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold px-3.5 py-1.5 rounded-full transition-all hover:gap-2.5 hover:shadow-md"
          style={{ color: cfg.hex, backgroundColor: `${cfg.hex}14`, border: `1px solid ${cfg.hex}40` }}
        >
          View All <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* ✅ FEATURED STOREFRONT */}
      <div
        className="relative rounded-2xl lg:rounded-3xl overflow-hidden border-2 shadow-2xl transition-colors duration-500"
        style={{
          borderColor: `${cfg.hex}66`,
          background: `linear-gradient(180deg, ${cfg.hex}14 0%, ${cfg.hex}07 35%, transparent 70%), var(--user-bg-card)`,
          boxShadow: `0 24px 70px -30px ${cfg.hex}99, 0 6px 24px -12px rgba(0,0,0,0.4)`,
        }}
      >
        {/* ═══════ TOP STRIP — rendered at 75% (zoom keeps full width, scales content+height) ═══════ */}
        <div className={`relative bg-gradient-to-r ${cfg.gradient} overflow-hidden`} style={{ zoom: "0.75" }}>
          {/* Decor layers */}
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0 2px, transparent 2px 16px)" }}
          />
          <div
            className="absolute inset-0 opacity-[0.10] pointer-events-none"
            style={{ backgroundImage: "repeating-linear-gradient(-45deg, #000 0 1px, transparent 1px 14px)" }}
          />
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(80% 70% at 70% 30%, #000 0%, transparent 75%)",
              WebkitMaskImage: "radial-gradient(80% 70% at 70% 30%, #000 0%, transparent 75%)",
            }}
          />
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-white/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-12 w-56 h-56 rounded-full bg-black/30 blur-3xl pointer-events-none" />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 28%, transparent 70%, rgba(0,0,0,0.22) 100%)",
            }}
          />
          <div
            className="absolute top-0 bottom-0 w-1/4 bg-white/10 pointer-events-none"
            style={{ animation: "dealShine 4.5s ease-in-out infinite" }}
          />
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />

          {/* ✅ Faded product image — right side depth */}
          {stripImg && (
            <img
              src={stripImg}
              alt=""
              aria-hidden="true"
              className="absolute inset-y-0 right-0 w-[46%] h-full object-cover opacity-25 pointer-events-none hidden sm:block"
              style={{
                maskImage: "linear-gradient(to left, rgba(0,0,0,0.95) 20%, transparent 90%)",
                WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.95) 20%, transparent 90%)",
              }}
            />
          )}

          <div className="relative px-4 sm:px-8 lg:px-10 py-5 sm:py-7 lg:py-8">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-8">
              {/* LEFT — identity */}
              <div className="flex items-start gap-3 sm:gap-5 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <span
                    className="absolute inset-0 rounded-2xl bg-white/30 blur-lg"
                    style={{ animation: "dealPulseRing 3s ease-in-out infinite" }}
                  />
                  <div
                    className="relative w-12 h-12 sm:w-16 sm:h-16 lg:w-[4.5rem] lg:h-[4.5rem] rounded-2xl bg-white/15 backdrop-blur-md border-2 border-white/30 flex items-center justify-center shadow-2xl"
                    style={{ animation: "floatY 3.5s ease-in-out infinite" }}
                  >
                    <Zap size={24} className="text-white sm:w-7 sm:h-7 drop-shadow-lg" />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
                    <h3 className="text-lg sm:text-3xl lg:text-4xl font-black text-white leading-none tracking-tight drop-shadow-[0_3px_12px_rgba(0,0,0,0.45)] truncate">
                      {activeDeal.name}
                    </h3>
                    {badgeText && (
                      <span
                        style={{ color: "#0a0a0a" }}
                        className="relative overflow-hidden bg-white px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-sm font-black uppercase tracking-wide shadow-xl ring-2 ring-white/40 whitespace-nowrap"
                      >
                        <span
                          className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-black/15 to-transparent"
                          style={{ animation: "dealBadgeSweep 3.2s ease-in-out infinite" }}
                        />
                        <span className="relative">{badgeText}</span>
                      </span>
                    )}
                  </div>

                  <p className="hidden sm:block text-white/90 text-xs sm:text-base max-w-xl line-clamp-2 leading-relaxed">
                    {activeDeal.description || "Limited-time offer — grab it before it's gone"}
                  </p>

                  {/* ✅ Perks row */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-2.5 sm:mt-4">
                    <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-white uppercase tracking-wider bg-black/20 backdrop-blur border border-white/20 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5">
                      <Package size={12} /> {products.length} Products
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-white uppercase tracking-wider bg-black/20 backdrop-blur border border-white/20 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5">
                      <Clock size={12} /> Ends {endsLabel}
                    </span>
                    {activeDeal.isFeatured && (
                      <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-yellow-200 uppercase tracking-wider bg-yellow-400/20 backdrop-blur border border-yellow-300/40 rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5">
                        <Sparkles size={12} /> Featured
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT — countdown + CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 shrink-0">
                {!time.expired ? (
                  <div
                    className="flex flex-col items-center gap-1.5 rounded-2xl backdrop-blur-md px-3.5 py-2.5 border transition-all duration-500"
                    style={{
                      backgroundColor:
                        urgency === "normal" ? "rgba(0,0,0,0.25)" : `${urgencyHex}2e`,
                      borderColor:
                        urgency === "normal" ? "rgba(255,255,255,0.2)" : `${urgencyHex}99`,
                      boxShadow:
                        urgency === "normal"
                          ? "0 8px 24px -14px rgba(0,0,0,0.6)"
                          : `0 0 26px -8px ${urgencyHex}cc`,
                    }}
                  >
                    <span
                      className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em]"
                      style={{ color: urgency === "normal" ? "rgba(255,255,255,0.7)" : "#fff" }}
                    >
                      {urgency === "normal" ? (
                        "Ends in"
                      ) : (
                        <>
                          <Flame size={10} style={{ color: urgencyHex }} /> Hurry — ends in
                        </>
                      )}
                    </span>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <TimeChip v={time.d} l="days" accent={accent} />
                      <span className="text-white/50 font-black text-base sm:text-lg leading-none pb-2">:</span>
                      <TimeChip v={time.h} l="hrs" accent={accent} />
                      <span className="text-white/50 font-black text-base sm:text-lg leading-none pb-2">:</span>
                      <TimeChip v={time.m} l="min" accent={accent} />
                      <span className="text-white/50 font-black text-base sm:text-lg leading-none pb-2">:</span>
                      <TimeChip v={time.s} l="sec" pulse accent={accent} />
                    </div>
                  </div>
                ) : (
                  <span className="self-start bg-white/15 border border-white/25 text-white text-xs sm:text-sm font-black uppercase tracking-wider px-4 py-2 rounded-full">
                    Deal Expired
                  </span>
                )}

                {/* Shop Now — inline color: `.user-theme a { color: inherit }` outranks Tailwind text-* on links */}
                <Link
                  href={`/deals/${activeDeal._id}`}
                  className="group/cta inline-flex items-center justify-center gap-2.5 bg-white hover:bg-white/95 text-[#0a0a0a] px-6 sm:px-9 py-3 sm:py-3.5 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider ring-2 ring-white/30 hover:scale-[1.05] active:scale-95 transition-all"
                  style={{ boxShadow: `0 18px 40px -18px ${cfg.hex}cc`, color: "#0a0a0a" }}
                >
                  Shop Now
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#0a0a0a] text-white transition-transform group-hover/cta:translate-x-0.5">
                    <ArrowRight size={13} />
                  </span>
                </Link>
              </div>
            </div>

            {/* ✅ URGENCY BAR — live sale progress + stock pressure */}
            {!time.expired && timePct !== null && (
              <div className="mt-4 rounded-2xl border border-white/15 bg-black/20 backdrop-blur-md px-3.5 sm:px-4 py-2.5 sm:py-3">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-white/90">
                    <Clock size={12} style={{ color: urgencyHex }} />
                    {urgency === "critical"
                      ? "Almost over — grab it now"
                      : urgency === "high"
                        ? "Ends today — don't wait"
                        : `Sale live · ends ${endsLabel}`}
                  </span>
                  <span
                    className="text-[10px] sm:text-[11px] font-black tabular-nums whitespace-nowrap"
                    style={{ color: urgencyHex }}
                  >
                    {time.d}d {time.h}h {time.m}m left
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-linear"
                    style={{
                      width: `${Math.min(timePct, 100)}%`,
                      background: `linear-gradient(90deg, ${urgencyHex}ee, ${urgencyHex})`,
                      boxShadow: `0 0 14px -3px ${urgencyHex}`,
                    }}
                  />
                  <div
                    className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                    style={{ animation: "dealBadgeSweep 2.8s ease-in-out infinite" }}
                  />
                </div>

                {/* ✅ Stock pressure — only when running low (real variant quantities) */}
                {totalStock > 0 && totalStock <= 15 && (
                  <div className="flex items-center gap-2.5 mt-2.5">
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-200 bg-amber-400/15 border border-amber-300/40 rounded-full px-2.5 py-1 whitespace-nowrap">
                      <Flame size={11} /> Only {totalStock} left
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/15 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-red-500 transition-all duration-700"
                        style={{
                          width: `${Math.min(95, Math.max(8, Math.round(((60 - totalStock) / 60) * 100)))}%`,
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-red-300 whitespace-nowrap">
                      Selling fast
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ✅ BUNDLE DEAL — combo price + quantity rules + add to cart */}
            {activeDeal.type === "bundle" && products.length > 0 && (
              <BundleDealPanel deal={activeDeal} products={products} allProducts={allProducts} />
            )}

            {/* Dots + prev/next + autoplay progress */}
            {deals.length > 1 && (
              <div className="flex flex-col items-center gap-2.5 mt-5">
                <div className="flex items-center gap-1.5 bg-black/15 backdrop-blur-md border border-white/15 px-2 py-1.5 rounded-full">
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Previous deal"
                    className="group/arrow flex items-center justify-center w-7 h-7 rounded-full text-white/70 hover:text-white hover:bg-white/20 active:scale-90 transition-all"
                  >
                    <ChevronLeft size={16} className="transition-transform group-hover/arrow:-translate-x-0.5" />
                  </button>
                  <div className="flex items-center gap-1.5">
                    {deals.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => goTo(idx)}
                        aria-label={`Go to deal ${idx + 1}`}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          idx === current
                            ? "w-7 bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                            : "w-1.5 bg-white/40 hover:bg-white/70"
                        }`}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Next deal"
                    className="group/arrow flex items-center justify-center w-7 h-7 rounded-full text-white/70 hover:text-white hover:bg-white/20 active:scale-90 transition-all"
                  >
                    <ChevronRight size={16} className="transition-transform group-hover/arrow:translate-x-0.5" />
                  </button>
                </div>
                {!paused && (
                  <div className="h-0.5 w-28 sm:w-40 rounded-full bg-white/20 overflow-hidden">
                    <div
                      key={current}
                      className="h-full origin-left bg-white/90"
                      style={{ animation: "dealProgress 4s linear forwards" }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ═══════ PRODUCTS AREA ═══════ */}
        <div
          className="relative p-3 sm:p-5 lg:p-6 border-t border-[var(--user-border)]"
          key={activeDeal._id}
          style={{ animation: "dealFadeIn .45s ease-out" }}
        >
          <span
            className="absolute top-0 left-6 right-6 h-px pointer-events-none"
            style={{ background: `linear-gradient(90deg, transparent, ${cfg.hex}80, transparent)` }}
          />
          <ProductsRow products={products} deal={activeDeal} hex={cfg.hex} />
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   BUNDLE DEAL PANEL — offer condition + add to cart
   =====================================================
   Deal type "bundle": all combo products are added to the cart in one
   click. The single offer condition (buy all products / buy N items)
   is applied by the cart — the deal only kicks in once it is met.
===================================================== */
export function BundleDealPanel({ deal, products, allProducts = [], variant = "dark" }) {
  const { addBundleToCart } = useCart();
  const [added, setAdded] = useState(false);
  const isLight = variant === "light";

  const theme = {
    wrap: isLight
      ? "mt-0 rounded-2xl border-2 border-indigo-500/30 bg-indigo-500/5 px-4 py-3.5"
      : "mt-4 rounded-2xl border border-white/20 bg-white/10 backdrop-blur px-3.5 py-3",
    label: isLight ? "text-indigo-600" : "text-white/95",
    price: isLight ? "text-[var(--user-text)]" : "text-white",
    neutralBadge: isLight
      ? "bg-indigo-500/10 text-indigo-600 border-indigo-500/25"
      : "bg-white/15 text-white border-white/25",
    hint: isLight ? "text-[var(--user-text-muted)]" : "text-white/85",
    cta: isLight
      ? "bg-[var(--user-accent)] text-[var(--user-accent-text)]"
      : "bg-white text-black",
  };

  // Full catalog (variants included) so the gift product can be priced
  const catalog = useMemo(() => {
    const map = new Map();
    const pid = (p) => String(p?._id || p?.id || "");
    (products || []).forEach((p) => map.set(pid(p), p));
    (allProducts || []).forEach((p) => {
      const id = pid(p);
      if (id && !map.has(id)) map.set(id, p);
    });
    return map;
  }, [products, allProducts]);

  // One unit of every combo product (best priced variant)
  const items = useMemo(
    () =>
      (products || []).map((p) => {
        const variants = p.variants || [];
        const variant =
          variants.find((v) => Number(v.selling_price) > 0) || variants[0] || null;
        return { product: p, variant, quantity: 1 };
      }),
    [products]
  );

  const totalValue = round2(
    items.reduce((s, it) => s + (Number(it.variant?.selling_price) || 0), 0)
  );

  // ✅ Single offer rule, prepared for the cart (gift price/variant enriched)
  const rawRule = deal?.bundleRule;
  const cartRule = useMemo(() => {
    const base = Array.isArray(rawRule) ? rawRule[0] : rawRule;
    if (!base || typeof base !== "object") return null;

    const populated =
      base.freeProduct && typeof base.freeProduct === "object" ? base.freeProduct : null;
    const giftId = String(populated?._id || base.freeProduct || base.freeProductId || "");
    const gift = catalog.get(giftId) || populated;

    const giftVariants = gift?.variants || [];
    const giftVariant =
      giftVariants.find((v) => Number(v.selling_price) > 0) || giftVariants[0] || null;

    return {
      ...base,
      freeProductId: giftId || base.freeProductId || "",
      freeProductName: gift?.name || base.freeProductName || "",
      freeProductImage: gift?.images?.[0]?.img_url || base.freeProductImage || "",
      freeProductPrice: Number(giftVariant?.selling_price ?? 0) || 0,
      freeProductVariantId: giftVariant?._id ? String(giftVariant._id) : "",
    };
  }, [rawRule, catalog]);

  const normalizedRule = normalizeBundleRule(cartRule);
  const ruleLabel = normalizedRule ? bundleRuleLabel(normalizedRule, items.length) : "";
  const requiredQty = normalizedRule ? bundleRuleRequiredQty(normalizedRule, items.length) : 0;
  const isGiftRule = normalizedRule?.rewardType === "free_product";

  const handleAdd = () => {
    if (!items.length) return;
    addBundleToCart({ ...deal, bundleRule: cartRule }, items);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  return (
    <div className={theme.wrap}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={`flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${theme.label}`}>
          <Layers size={12} /> {items.length}-Product Combo
        </span>
        <span className={`text-[11px] sm:text-xs font-bold ${theme.price}`}>
          Total value Rs. {totalValue.toLocaleString()}
        </span>
      </div>

      {/* Single offer condition — applied automatically in the cart */}
      {ruleLabel && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-2.5">
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide border ${
              isGiftRule
                ? "bg-amber-400/95 text-black border-amber-200/60"
                : theme.neutralBadge
            }`}
          >
            {isGiftRule ? "🎁 " : "🔥 "}
            {ruleLabel}
          </span>
          {requiredQty > 0 && (
            <span className={`text-[10px] sm:text-[11px] font-semibold ${theme.hint}`}>
              Requires {requiredQty} {requiredQty === 1 ? "item" : "items"} — reward is
              applied automatically in the cart.
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 mt-3">
        <button
          type="button"
          onClick={handleAdd}
          className={`inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl text-[11px] sm:text-xs font-black uppercase tracking-wider shadow-lg hover:scale-[1.03] active:scale-95 transition ${theme.cta}`}
        >
          <ShoppingCart size={15} />
          {added ? "Added ✓" : `Add all ${items.length} products to cart`}
        </button>

        <p className={`text-[10px] sm:text-[11px] font-semibold ${theme.hint}`}>
          Add the combo, then increase the quantity to meet the offer condition.
        </p>
      </div>
    </div>
  );
}

function TimeChip({ v, l, pulse = false, accent = null }) {
  return (
    <div
      className={`flex flex-col items-center backdrop-blur-md rounded-xl px-2 sm:px-2.5 py-1.5 min-w-[46px] sm:min-w-[54px] shadow-lg ${pulse ? "animate-pulse" : ""}`}
      style={{
        backgroundColor: accent ? `${accent}30` : "rgba(255,255,255,0.10)",
        border: `1px solid ${accent || "rgba(255,255,255,0.25)"}`,
        boxShadow: accent
          ? `0 0 16px -6px ${accent}, inset 0 1px 0 rgba(255,255,255,0.18)`
          : "0 4px 14px -8px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)",
      }}
    >
      <span className="text-lg sm:text-2xl font-black text-white tabular-nums leading-none drop-shadow">
        {String(v).padStart(2, "0")}
      </span>
      <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.12em] text-white/75 mt-1">
        {l}
      </span>
    </div>
  );
}

/* =====================================================
   PRODUCTS ROW
===================================================== */
function ProductsRow({ products, deal, hex }) {
  const scrollRef = useRef(null);
  const [canScrollL, setCanScrollL] = useState(false);
  const [canScrollR, setCanScrollR] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollL(el.scrollLeft > 5);
    setCanScrollR(el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll);
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [products]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -el.clientWidth * 0.85 : el.clientWidth * 0.85, behavior: "smooth" });
  };

  if (products.length === 0) {
    return (
      <p className="text-sm text-[var(--user-text-muted)] py-6 text-center">
        No products attached to this deal yet.
      </p>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <h4 className="text-[11px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: hex }}>
          <Package size={13} />
          Products in this deal
        </h4>
        <span className="text-[10px] sm:text-[11px] font-bold" style={{ color: `${hex}cc` }}>
          {products.length} {products.length === 1 ? "item" : "items"}
        </span>
      </div>

      {canScrollL && (
        <button
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          className="hidden sm:flex absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full items-center justify-center shadow-xl border-2 transition-all active:scale-95 hover:scale-110"
          style={{ backgroundColor: "var(--user-bg-card)", borderColor: `${hex}66`, color: hex }}
        >
          <ChevronLeft size={18} />
        </button>
      )}
      {canScrollR && (
        <button
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          className="hidden sm:flex absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full items-center justify-center text-white shadow-xl transition-all active:scale-95 hover:scale-110"
          style={{ background: `linear-gradient(135deg, ${hex}, ${hex}cc)` }}
        >
          <ChevronRight size={18} />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-none scroll-smooth snap-x snap-mandatory pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {products.map((product) => (
          <div
            key={product._id || product.id}
            className="group/deal flex-shrink-0 w-[47%] sm:w-[30%] lg:w-[19.2%] snap-start"
            style={{ "--deal-hex": hex }}
          >
            <div className="relative h-full rounded-2xl transition-all duration-300 group-hover/deal:-translate-y-1.5 group-hover/deal:shadow-[0_20px_44px_-20px_rgba(0,0,0,0.5)] group-hover/deal:ring-2 group-hover/deal:ring-[color:var(--deal-hex)]">
              <ProductCard product={product} deal={deal} dealId={deal._id} showDealPricing />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =====================================================
   SKELETON
===================================================== */
function DealsSkeleton() {
  return (
    <section className="max-w-[1400px] mx-auto px-3 lg:px-6 py-5 lg:py-10">
      <div className="animate-pulse space-y-4">
        <div className="flex items-center justify-between px-2.5 sm:px-4 py-2 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]/70 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--user-bg-card)]" />
            <div className="h-6 w-32 bg-[var(--user-bg-card)] rounded-lg" />
          </div>
          <div className="h-7 w-20 rounded-full bg-[var(--user-bg-card)]" />
        </div>
        <div className="rounded-3xl overflow-hidden border-2 border-[var(--user-border)]">
          <div className="h-24 sm:h-30 bg-[var(--user-bg-card)]" />
          <div className="flex gap-4 p-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-[19.2%] h-60 bg-[var(--user-bg-card)] rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}