"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Flame, Clock, ArrowRight, ChevronLeft, ChevronRight, Package, Zap, Sparkles } from "lucide-react";
import { dealApi } from "@/apis/user/dealApi";
import { productApi } from "@/apis/user/productApi";
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
  return out.slice(0, 12);
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
    <section className="max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 py-6 lg:py-10">
      <style>{`
        @keyframes dealShine { 0% { transform: translateX(-150%) skewX(-20deg); } 60%, 100% { transform: translateX(400%) skewX(-20deg); } }
        @keyframes dealFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes floatY { 0%, 100% { transform: translateY(0) rotate(3deg); } 50% { transform: translateY(-6px) rotate(3deg); } }
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

  // ✅ Products yahan compute (strip mein count + row dono ke liye)
  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 60 * 1000,
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

  return (
    <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Slim header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <Flame size={17} className="text-white" />
          </div>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-black text-[var(--user-text)]">
            Hot Deals
          </h2>
          <span
            className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${cfg.hex}18`, color: cfg.hex, border: `1px solid ${cfg.hex}45` }}
          >
            {deals.length} Live
          </span>
        </div>
        <Link
          href="/deals"
          className="group flex items-center gap-1.5 text-xs sm:text-sm font-bold hover:underline"
          style={{ color: cfg.hex }}
        >
          View All <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" />
        </Link>
      </div>

      {/* ✅ FEATURED STOREFRONT */}
      <div
        className="relative rounded-2xl lg:rounded-3xl overflow-hidden border-2 shadow-2xl transition-colors duration-500"
        style={{
          borderColor: `${cfg.hex}55`,
          background: `linear-gradient(180deg, ${cfg.hex}14 0%, ${cfg.hex}07 35%, transparent 70%), var(--user-bg-card)`,
        }}
      >
        {/* ═══════ TOP STRIP — thori bari, premium ═══════ */}
        <div className={`relative bg-gradient-to-r ${cfg.gradient} overflow-hidden`}>
          {/* Decor layers */}
          <div
            className="absolute inset-0 opacity-[0.07] pointer-events-none"
            style={{ backgroundImage: "repeating-linear-gradient(45deg, #fff 0 2px, transparent 2px 16px)" }}
          />
          <div className="absolute -top-20 -right-16 w-64 h-64 rounded-full bg-white/15 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-12 w-56 h-56 rounded-full bg-black/25 blur-3xl pointer-events-none" />
          <div
            className="absolute top-0 bottom-0 w-1/4 bg-white/10 pointer-events-none"
            style={{ animation: "dealShine 4.5s ease-in-out infinite" }}
          />

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

          <div className="relative px-5 sm:px-8 lg:px-10 py-6 sm:py-7 lg:py-8">
            <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
              {/* LEFT — identity */}
              <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
                <div
                  className="w-14 h-14 sm:w-16 sm:h-16 lg:w-[4.5rem] lg:h-[4.5rem] rounded-2xl bg-white/15 backdrop-blur border-2 border-white/25 flex items-center justify-center shrink-0 shadow-2xl"
                  style={{ animation: "floatY 3.5s ease-in-out infinite" }}
                >
                  <Zap size={28} className="text-white" />
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 mb-1.5 sm:mb-2">
                    <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-none drop-shadow-lg truncate">
                      {activeDeal.name}
                    </h3>
                    {badgeText && (
                                         <span
                        style={{ color: "#0a0a0a" }}
                        className="bg-white px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-sm font-black uppercase tracking-wide shadow-xl whitespace-nowrap"
                      >
                        {badgeText}
                      </span>
                    )}
                  </div>

                  <p className="text-white/90 text-xs sm:text-base max-w-xl line-clamp-2 leading-relaxed">
                    {activeDeal.description || "Limited-time offer — grab it before it's gone"}
                  </p>

                  {/* ✅ Perks row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 sm:mt-4">
                    <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-white/95 uppercase tracking-wider">
                      <Package size={12} /> {products.length} Products
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/50" />
                    <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-white/95 uppercase tracking-wider">
                      <Clock size={12} /> Ends {endsLabel}
                    </span>
                    {activeDeal.isFeatured && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-white/50" />
                        <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-black text-yellow-200 uppercase tracking-wider">
                          <Sparkles size={12} /> Featured
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT — countdown + CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 shrink-0">
                {!time.expired ? (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <TimeChip v={time.d} l="days" />
                    <span className="text-white/70 font-black text-lg">:</span>
                    <TimeChip v={time.h} l="hrs" />
                    <span className="text-white/70 font-black text-lg">:</span>
                    <TimeChip v={time.m} l="min" />
                    <span className="text-white/70 font-black text-lg">:</span>
                    <TimeChip v={time.s} l="sec" pulse />
                  </div>
                ) : (
                  <span className="bg-white/15 border border-white/25 text-white text-sm font-bold px-4 py-2 rounded-full">
                    Deal Expired
                  </span>
                )}

                              <Link
                  href={`/deals/${activeDeal._id}`}
                  style={{ color: "#0a0a0a" }}
                  className="group/cta inline-flex items-center justify-center gap-2 bg-white px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider shadow-2xl hover:scale-[1.04] active:scale-95 transition"
                >
                  Shop Now
                  <ArrowRight size={16} className="transition-transform group-hover/cta:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* Dots */}
            {deals.length > 1 && (
              <div className="flex items-center justify-center mt-5">
                <div className="flex items-center gap-1.5 bg-black/15 backdrop-blur px-3 py-1.5 rounded-full">
                  {deals.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => goTo(idx)}
                      aria-label={`Go to deal ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        idx === current ? "w-7 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Deal switch arrows */}
          {deals.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous deal"
                className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/25 backdrop-blur border border-white/25 flex items-center justify-center text-white hover:bg-black/45 hover:scale-110 transition-all"
              >
                <ChevronLeft size={19} />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next deal"
                className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/25 backdrop-blur border border-white/25 flex items-center justify-center text-white hover:bg-black/45 hover:scale-110 transition-all"
              >
                <ChevronRight size={19} />
              </button>
            </>
          )}
        </div>

        {/* ═══════ PRODUCTS AREA ═══════ */}
        <div className="p-3.5 sm:p-5 lg:p-6" key={activeDeal._id} style={{ animation: "dealFadeIn .45s ease-out" }}>
          <ProductsRow products={products} deal={activeDeal} hex={cfg.hex} />
        </div>
      </div>
    </div>
  );
}

function TimeChip({ v, l, pulse = false }) {
  return (
    <div
      className={`flex flex-col items-center bg-white/15 backdrop-blur border border-white/25 rounded-xl px-2 sm:px-2.5 py-1.5 min-w-[46px] sm:min-w-[54px] shadow-lg ${pulse ? "animate-pulse" : ""}`}
    >
      <span className="text-lg sm:text-2xl font-black text-white tabular-nums leading-none">
        {String(v).padStart(2, "0")}
      </span>
      <span className="text-[8px] sm:text-[9px] font-bold uppercase text-white/75 mt-1">{l}</span>
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
          <div key={product._id || product.id} className="flex-shrink-0 w-[45%] sm:w-[30%] lg:w-[19.2%] snap-start">
            <ProductCard product={product} deal={deal} />
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
    <section className="max-w-[1400px] mx-auto px-3 sm:px-4 lg:px-6 py-6 lg:py-10">
      <div className="animate-pulse space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--user-bg-card)]" />
          <div className="h-6 w-32 bg-[var(--user-bg-card)] rounded-lg" />
        </div>
        <div className="rounded-3xl overflow-hidden border-2 border-[var(--user-border)]">
          <div className="h-32 sm:h-40 bg-[var(--user-bg-card)]" />
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