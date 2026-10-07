"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Flame, Clock, ArrowRight, ChevronLeft, ChevronRight, Package, Zap, Layers, ShoppingCart } from "lucide-react";
import { dealApi } from "@/apis/user/dealApi";

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
  if (!img || typeof img !== "string") return null;
  if (img.startsWith("http")) return img;
  return `${API_ORIGIN}${img.startsWith("/") ? "" : "/"}${img}`;
};

// Product ki pehli image — ProductCard jaisi hi priority
const getProductImage = (p) =>
  getImageUrl(p?.variants?.[0]?.images?.[0]?.img_url || p?.image || p?.images?.[0]?.img_url);

function getDealTypeLabel(type) {
  const labels = {
    percentage: "Mega Sale",
    fixed_amount: "Price Drop",
    buy_x_get_y: "Buy & Get",
    bundle: "Bundle Offer",
    free_shipping: "Free Shipping",
  };
  return labels[type] || "Hot Deal";
}

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

/* ✅ PERF: countdown sirf tab tick karta hai jab section viewport me ho.
   Off-screen re-render storm (har second poora DealEngine + 12 ProductCards)
   khatam — dikhai dene par waqt hamesha Date se fresh compute hota hai,
   is liye display bilkul same rehta hai. */
function useInViewport(ref) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref?.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
        else setVisible(false);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return visible;
}

function useCountdown(endDate, active = true) {
  const [time, setTime] = useState(() => calcTime(endDate));
  useEffect(() => {
    if (!active) return;
    // Foran sync (invisible period ka gap na dikhe), phir 1s tick
    setTime(calcTime(endDate));
    const t = setInterval(() => setTime(calcTime(endDate)), 1000);
    return () => clearInterval(t);
  }, [endDate, active]);
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

export default function DealsSection({ embedded = false }) {
  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["activeDeals"],
    queryFn: dealApi.getActive,
    staleTime: 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
  });

  if (isLoading) return <DealsSkeleton embedded={embedded} />;
  if (!deals || deals.length === 0) return null;

  return (
    <section className={embedded ? "w-full" : "user-shell mx-auto px-3 lg:px-6 py-5 lg:py-10"}>
      <style>{`
        @keyframes dealFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dealSlideLeft { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes dealSlideRight { from { opacity: 0; transform: translateX(32px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes dealZoomIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes dealFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
        @keyframes dealPop { from { opacity: 0; transform: translateY(18px) scale(0.6); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes dealCube { 0%, 100% { transform: translateY(0) rotate(-14deg); } 50% { transform: translateY(-10px) rotate(14deg); } }
        @keyframes dealWiggle { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(8deg); } }
        @keyframes dealBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes dealTick { from { opacity: 0; transform: translateY(-55%); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dealBarGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes dealProgress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @media (prefers-reduced-motion: reduce) { .deal-anim { animation: none !important; } }
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
    }, 8000);
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

  // Live deals 600+ ho sakte hain (seeded data) — saare dots render karne se
  // poora indicator strip card se bahar chala jata tha aur prev/next arrows
  // bhi off-screen ho jate the. Isliye current ke aas paas ke dots dikhate
  // hain + "x / total" counter.
  const MAX_DOTS = 7;
  const dotWindow =
    deals.length <= MAX_DOTS
      ? deals.map((_, index) => index)
      : (() => {
          const start = Math.max(
            0,
            Math.min(current - Math.floor(MAX_DOTS / 2), deals.length - MAX_DOTS),
          );
          return Array.from({ length: MAX_DOTS }, (_, index) => start + index);
        })();

  const activeDeal = deals[current];
  const activeDealId = activeDeal?._id || activeDeal?.id || null;

  // ✅ Carousel deal ke products — server (12 tak, variants ke saath).
  // Full catalog fetch ki jagah per-deal query (cached).
  const { data: activeDealDetail = null } = useQuery({
    queryKey: ["deal", activeDealId, "preview"],
    queryFn: () => dealApi.getById(activeDealId, 1, 12),
    enabled: !!activeDealId,
    staleTime: 60 * 1000,
    retry: 1,
  });
  const cfg = getDealConfig(activeDeal.type);
  const badgeText = getDealBadgeText(activeDeal);
  const sectionRef = useRef(null);
  const sectionVisible = useInViewport(sectionRef);
  const time = useCountdown(activeDeal.endDate, sectionVisible);
  const products = useMemo(
    () => activeDealDetail?.resolvedProducts || [],
    [activeDealDetail],
  );

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

  // ✅ Urgency — flat color tint only (koi glow/shadow nahi)
  const hoursLeft = time.d * 24 + time.h;
  const urgency = time.expired
    ? "ended"
    : hoursLeft <= 6
      ? "critical"
      : hoursLeft <= 24
        ? "high"
        : "normal";
  const tone = urgency === "critical" ? "#ef4444" : urgency === "high" ? "#f59e0b" : cfg.hex;
  const typeLabel = getDealTypeLabel(activeDeal.type);
  const cubeLabel = activeDeal.type === "percentage" ? "%" : "Rs";

  // ✅ Image stage — deal image + products ki images (crisp, unique, max 6)
  const slides = useMemo(() => {
    const list = [
      getImageUrl(activeDeal.image),
      ...products.slice(0, 8).map(getProductImage),
    ].filter(Boolean);
    if (!list.length) {
      const fallback = getImageUrl(activeDeal.productIds?.[0]?.images?.[0]?.img_url);
      if (fallback) list.push(fallback);
    }
    return Array.from(new Set(list)).slice(0, 8);
  }, [activeDeal, products]);

  return (
    <div ref={sectionRef} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {/* Header — flat, solid */}
      <div
        className="deal-anim flex items-center justify-between mb-4 px-3 sm:px-4 py-2.5 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]"
        style={dealAnim("dealFadeIn", 0, 0.5)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-colors duration-500"
            style={{ backgroundColor: cfg.hex }}
          >
            <Flame
              size={18}
              className="deal-anim text-white"
              style={{ animation: "dealWiggle 2.6s ease-in-out infinite", transformOrigin: "50% 85%" }}
            />
          </div>
          <div className="flex flex-col">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-black tracking-tight text-[var(--user-text)] leading-none">
              Hot <span style={{ color: cfg.hex }} className="transition-colors duration-500">Deals</span>
            </h2>
            <span className="hidden sm:block text-[0.5625rem] font-bold uppercase tracking-[0.18em] text-[var(--user-text)] opacity-50 mt-1">
              Best offers · limited time
            </span>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-1.5 text-[0.625rem] font-black uppercase tracking-wider px-2.5 py-1 rounded-full transition-colors duration-500"
          style={{ backgroundColor: `${cfg.hex}18`, color: cfg.hex, border: `1px solid ${cfg.hex}45` }}
        >
          <span
            className="deal-anim w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: cfg.hex, animation: "dealBlink 1.4s ease-in-out infinite" }}
          />
          {deals.length} Live
        </span>
      </div>

      {/* ✅ FEATURED DEAL */}
      <div className="relative overflow-hidden rounded-2xl lg:rounded-3xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-sm">
        {/* ═══════ HERO BANNER — podium showcase ═══════ */}
        <div
          className="relative overflow-hidden"
          style={{ background: "linear-gradient(110deg, #07131b 0%, #0c2230 55%, #10364a 100%)" }}
        >
          {/* Flat angled accent panel (right side) — solid color, no blur */}
          <div
            key={`shape-${activeDeal._id}`}
            className="deal-anim pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] lg:block"
            style={{
              backgroundColor: `${cfg.hex}22`,
              clipPath: "polygon(24% 0, 100% 0, 100% 100%, 0 100%)",
              ...dealAnim("dealSlideRight", 0, 0.9),
            }}
          />

          {/* Floating cubes — decor, sirf animation */}
          <DealCube hex={cfg.hex} label={cubeLabel} className="left-3 top-5 sm:left-[2%]" delay={0} />
          <DealCube hex={cfg.hex} label={cubeLabel} className="right-3 top-24 hidden sm:flex lg:right-auto lg:left-[33%] lg:top-auto lg:bottom-9" delay={1.2} small />
          <DealCube hex={cfg.hex} label={cubeLabel} className="right-[4%] top-4 hidden lg:flex" delay={2.2} small />

          <div
            className={`relative px-4 sm:px-8 lg:px-10 pt-4 sm:pt-5 ${
              deals.length > 1 ? "pb-10" : "pb-4 sm:pb-5"
            }`}
          >
            <div key={activeDeal._id} className="grid items-center gap-4 lg:grid-cols-12 lg:gap-6">
              {/* LEFT — podium + products (har ~1.8s me badalte hain) */}
              <div className="order-2 min-w-0 lg:order-1 lg:col-span-4">
                <PodiumStage
                  key={`stage-${activeDeal._id}`}
                  images={slides}
                  name={activeDeal.name}
                  hex={cfg.hex}
                />
              </div>

              {/* MIDDLE — bold title block */}
              <div className="order-1 min-w-0 text-center lg:order-2 lg:col-span-4 lg:text-left">
                <p
                  className="deal-anim text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-white/80"
                  style={dealAnim("dealSlideLeft", 0.05)}
                >
                  {badgeText ? `Get ${badgeText}` : typeLabel} · Limited offer
                </p>

                <h3
                  className="deal-anim mt-1.5 text-3xl sm:text-4xl xl:text-5xl font-black uppercase italic leading-[0.95] tracking-tight text-white line-clamp-2 break-words"
                  style={{
                    textShadow: `1px 1px 0 ${cfg.hex}, 2px 2px 0 ${cfg.hex}, 3px 3px 0 ${cfg.hex}, 4px 4px 0 ${cfg.hex}, 5px 5px 0 rgba(0,0,0,0.35)`,
                    ...dealAnim("dealSlideLeft", 0.12, 0.7),
                  }}
                >
                  {activeDeal.name}
                </h3>

                <span
                  className="deal-anim mt-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[0.6875rem] font-black uppercase tracking-[0.14em] text-white"
                  style={{ backgroundColor: cfg.hex, ...dealAnim("dealSlideLeft", 0.22) }}
                >
                  <Zap size={11} /> {typeLabel}
                </span>

                <p
                  className="deal-anim mt-2 text-xs text-white/65 line-clamp-1"
                  style={dealAnim("dealSlideLeft", 0.3)}
                >
                  {products.length > 0 ? `${products.length} products · ` : ""}Ends {endsLabel}
                  {activeDeal.description ? ` · ${activeDeal.description}` : ""}
                </p>

                {/* Shop Now — inline color: `.user-theme a { color: inherit }` outranks Tailwind text-* on links */}
                <Link
                  href={`/deals/${activeDeal._id}`}
                  className="deal-anim group/cta mt-3 inline-flex items-center justify-center gap-2.5 rounded-full border-2 border-white/80 px-6 py-2 text-xs font-black uppercase tracking-wider transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/15 active:scale-95"
                  style={{ color: "#ffffff", ...dealAnim("dealSlideLeft", 0.38) }}
                >
                  Shop Now
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#0a0a0a] transition-transform duration-300 group-hover/cta:translate-x-1">
                    <ArrowRight size={12} />
                  </span>
                </Link>
              </div>

              {/* RIGHT — countdown card */}
              <div className="order-3 min-w-0 lg:col-span-4">
                <div
                  className="deal-anim rounded-2xl border border-white/10 bg-white/[0.05] p-3.5"
                  style={dealAnim("dealSlideRight", 0.2)}
                >
                  {!time.expired ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-white/85">
                          <Clock size={13} style={{ color: tone }} />
                          <span className="text-[0.625rem] font-black uppercase tracking-[0.16em]">
                            {urgency === "normal" ? "Deal ends in" : "Hurry — ends in"}
                          </span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[0.625rem] font-bold text-white/80">
                          <span
                            className="deal-anim h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: tone, animation: "dealBlink 1.4s ease-in-out infinite" }}
                          />
                          {urgency === "critical" ? "Almost over" : urgency === "high" ? "Ends today" : "Sale live"}
                        </span>
                      </div>

                      <div className="mt-2.5 grid grid-cols-4 gap-2">
                        <CountBox v={time.d} l="Days" tone={urgency === "normal" ? null : tone} />
                        <CountBox v={time.h} l="Hrs" tone={urgency === "normal" ? null : tone} />
                        <CountBox v={time.m} l="Min" tone={urgency === "normal" ? null : tone} />
                        <CountBox v={time.s} l="Sec" tone={urgency === "normal" ? null : tone} />
                      </div>

                      {timePct !== null && (
                        <>
                          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
                            <div className="deal-anim h-full origin-left" style={dealAnim("dealBarGrow", 0.5, 1.2)}>
                              <div
                                className="h-full rounded-full transition-[width] duration-1000 ease-linear"
                                style={{ width: `${Math.min(timePct, 100)}%`, backgroundColor: tone }}
                              />
                            </div>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[0.625rem] font-semibold tabular-nums text-white/60">
                            <span>
                              {time.d}d {time.h}h {time.m}m left
                            </span>
                            <span style={{ color: tone }}>{Math.round(timePct)}% done</span>
                          </div>
                        </>
                      )}

                      {/* Stock pressure — sirf jab real stock kam ho */}
                      {totalStock > 0 && totalStock <= 15 && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-300/40 bg-amber-400/15 px-2 py-0.5 text-[0.625rem] font-black uppercase tracking-wider text-amber-200">
                            <Flame size={11} /> Only {totalStock} left
                          </span>
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="deal-anim h-full origin-left rounded-full bg-amber-400"
                              style={{
                                width: `${Math.min(95, Math.max(8, Math.round(((60 - totalStock) / 60) * 100)))}%`,
                                ...dealAnim("dealBarGrow", 0.7, 1),
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="inline-block rounded-full border border-white/25 bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wider text-white">
                      Deal Expired
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* NOTE: bundle-type deals bhi simple deals jese hi dikhte hain
                (same header + countdown + products row) — koi alag bundle
                section/panel nahi. BundleDealPanel sirf deal detail page
                (/deals/[id]) par use hota hai. */}
          </div>

          {/* Prev / dots / next — banner ke andar overlay (extra height nahi) */}
          {deals.length > 1 && (
            <>
              <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-white/10 px-1.5 py-1">
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous deal"
                  className="group/arrow flex h-6 w-6 items-center justify-center rounded-full text-white/70 transition-all hover:bg-white/20 hover:text-white active:scale-90"
                >
                  <ChevronLeft size={14} className="transition-transform group-hover/arrow:-translate-x-0.5" />
                </button>
                <div className="flex items-center gap-1.5">
                  {dotWindow.map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => goTo(idx)}
                      aria-label={`Go to deal ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-500 ${
                        idx === current ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/70"
                      }`}
                    />
                  ))}
                  {deals.length > MAX_DOTS ? (
                    <span className="pl-1 text-[0.625rem] font-black tabular-nums text-white/80">
                      {current + 1}/{deals.length}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next deal"
                  className="group/arrow flex h-6 w-6 items-center justify-center rounded-full text-white/70 transition-all hover:bg-white/20 hover:text-white active:scale-90"
                >
                  <ChevronRight size={14} className="transition-transform group-hover/arrow:translate-x-0.5" />
                </button>
              </div>
              {/* 8s change timer — banner ke bottom edge par, hover-pause par ruk jata hai */}
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/10">
                <div
                  key={current}
                  className="h-full w-full origin-left bg-white/70"
                  style={{
                    animation: "dealProgress 8s linear forwards",
                    animationPlayState: paused ? "paused" : "running",
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* ═══════ PRODUCTS AREA — fixed min-height: products hon ya na hon,
            section ki height same rehti hai (deal badalne par jump nahi) ═══════ */}
        <div
          className="relative p-3 sm:p-5 lg:p-6 border-t border-[var(--user-border)] min-h-[23rem] sm:min-h-[25rem] lg:min-h-[23rem]"
          key={activeDeal._id}
          style={{ animation: "dealFadeIn .45s ease-out" }}
        >
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
        <span className={`flex items-center gap-1.5 text-[0.625rem] sm:text-[0.6875rem] font-black uppercase tracking-wider ${theme.label}`}>
          <Layers size={12} /> {items.length}-Product Combo
        </span>
        <span className={`text-[0.6875rem] sm:text-xs font-bold ${theme.price}`}>
          Total value Rs. {totalValue.toLocaleString()}
        </span>
      </div>

      {/* Single offer condition — applied automatically in the cart */}
      {ruleLabel && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-2.5">
          <span
            className={`px-2.5 py-1 rounded-full text-[0.625rem] font-black uppercase tracking-wide border ${
              isGiftRule
                ? "bg-amber-400/95 text-black border-amber-200/60"
                : theme.neutralBadge
            }`}
          >
            {isGiftRule ? "🎁 " : "🔥 "}
            {ruleLabel}
          </span>
          {requiredQty > 0 && (
            <span className={`text-[0.625rem] sm:text-[0.6875rem] font-semibold ${theme.hint}`}>
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
          className={`inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl text-[0.6875rem] sm:text-xs font-black uppercase tracking-wider shadow-lg hover:scale-[1.03] active:scale-95 transition ${theme.cta}`}
        >
          <ShoppingCart size={15} />
          {added ? "Added ✓" : `Add all ${items.length} products to cart`}
        </button>

        <p className={`text-[0.625rem] sm:text-[0.6875rem] font-semibold ${theme.hint}`}>
          Add the combo, then increase the quantity to meet the offer condition.
        </p>
      </div>
    </div>
  );
}

/* Shared animation shorthand — staggered entrance (reduced-motion me `.deal-anim` off) */
function dealAnim(name, delay = 0, duration = 0.65) {
  return { animation: `${name} ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s both` };
}

/* Countdown box — digit badalne par naya number upar se slide hota hai */
function CountBox({ v, l, tone = null }) {
  return (
    <div
      className="flex flex-col items-center overflow-hidden rounded-xl border border-white/10 bg-white/[0.06] py-2.5 transition-colors duration-500"
      style={tone ? { borderColor: `${tone}80` } : undefined}
    >
      <span
        key={v}
        className="deal-anim text-xl sm:text-2xl font-black leading-none tabular-nums text-white"
        style={{ animation: "dealTick 0.4s cubic-bezier(0.22, 1, 0.36, 1) both" }}
      >
        {String(v).padStart(2, "0")}
      </span>
      <span className="mt-1.5 text-[0.5625rem] font-bold uppercase tracking-wider text-white/60">{l}</span>
    </div>
  );
}

/* Floating cube — decor (flat color, sirf motion) */
function DealCube({ hex, label, className = "", delay = 0, small = false }) {
  return (
    <span
      aria-hidden="true"
      className={`deal-anim pointer-events-none absolute z-10 flex items-center justify-center rounded-lg border border-white/25 font-black text-white ${
        small ? "h-6 w-6 text-[0.625rem]" : "h-8 w-8 text-xs"
      } ${className}`}
      style={{
        background: `linear-gradient(135deg, ${hex}, ${hex}88)`,
        animation: `dealCube 6s ease-in-out ${delay}s infinite`,
      }}
    >
      {label}
    </span>
  );
}

/* Podium stage — products podium par khade, har SLIDE_MS par agli images
   pop-in hoti hain. Koi glow nahi: flat discs + flat ring. */
const SLIDE_MS = 1800;

function PodiumStage({ images, name, hex }) {
  const [idx, setIdx] = useState(0);
  const count = images.length;

  // Images pehle se cache me — badalte waqt flash na ho
  useEffect(() => {
    images.forEach((src) => {
      const im = new window.Image();
      im.src = src;
    });
  }, [images]);

  useEffect(() => {
    if (count <= 1) return undefined;
    const t = setTimeout(() => setIdx((c) => (c + 1) % count), SLIDE_MS);
    return () => clearTimeout(t);
  }, [idx, count]);

  const pick = (offset) => (count > offset ? images[(idx + offset) % count] : null);
  const center = pick(0);
  const left = pick(1);
  const right = pick(2);

  const card = (src, size, key, delay) =>
    src ? (
      <img
        key={`${key}-${src}`}
        src={src}
        alt={key === "c" ? name || "Deal product" : ""}
        draggable={false}
        className={`deal-anim ${size} rounded-xl border border-white/20 object-cover shadow-xl shadow-black/40`}
        style={{ animation: `dealPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}s both` }}
      />
    ) : null;

  return (
    <div className="deal-anim" style={dealAnim("dealZoomIn", 0.1, 0.8)}>
      <div className="relative mx-auto h-44 w-full max-w-[19rem]">
        {/* Podium — 2 flat discs + flat accent ring */}
        <div className="absolute inset-x-2 bottom-0 h-10">
          <div className="absolute inset-x-0 bottom-0 h-6 rounded-[50%] border border-white/10 bg-[#0a1b27]" />
          <div
            className="absolute inset-x-4 bottom-2.5 h-7 rounded-[50%] border-2 bg-[#12303f]"
            style={{ borderColor: hex }}
          />
        </div>

        {count ? (
          <>
            {/* Left */}
            {left && (
              <div className="absolute bottom-7 left-1 z-10" style={{ transform: "rotate(-7deg)" }}>
                <div className="deal-anim" style={{ animation: "dealFloat 4.6s ease-in-out 0.6s infinite" }}>
                  {card(left, "h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20", "l", 0.08)}
                </div>
              </div>
            )}
            {/* Right */}
            {right && (
              <div className="absolute bottom-7 right-1 z-10" style={{ transform: "rotate(7deg)" }}>
                <div className="deal-anim" style={{ animation: "dealFloat 5.2s ease-in-out 1.1s infinite" }}>
                  {card(right, "h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20", "r", 0.16)}
                </div>
              </div>
            )}
            {/* Center — sab se bada */}
            <div className="absolute bottom-8 left-1/2 z-20 -ml-[3.75rem] sm:-ml-16">
              <div className="deal-anim" style={{ animation: "dealFloat 5s ease-in-out infinite" }}>
                {card(center, "h-[7.5rem] w-[7.5rem] sm:h-32 sm:w-32", "c", 0)}
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-x-0 bottom-10 flex justify-center">
            <Package size={52} strokeWidth={1.25} className="text-white/30" />
          </div>
        )}
      </div>
    </div>
  );
}

/* =====================================================
   PRODUCTS ROW
===================================================== */
/* Ek category-wide deal me 100+ products match ho sakte hain — home page ki
   strip ko halka rakhne ke liye sirf pehle kuch cards render karte hain.
   Poori list deal detail page (/deals/[id]) par mojood rehti hai. */
const MAX_DEAL_CARDS = 12;

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
      <div className="flex min-h-[16rem] sm:min-h-[18rem] items-center justify-center text-center">
        <p className="text-sm text-[var(--user-text-muted)] py-6">
          No products attached to this deal yet.
        </p>
      </div>
    );
  }

  const visibleProducts =
    products.length > MAX_DEAL_CARDS ? products.slice(0, MAX_DEAL_CARDS) : products;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <h4 className="text-[0.6875rem] sm:text-xs font-black uppercase tracking-wider flex items-center gap-1.5" style={{ color: hex }}>
          <Package size={13} />
          Products in this deal
        </h4>
        <span className="flex items-center gap-3">
          <span className="text-[0.625rem] sm:text-[0.6875rem] font-bold" style={{ color: `${hex}cc` }}>
            {products.length} {products.length === 1 ? "item" : "items"}
          </span>
          {products.length > MAX_DEAL_CARDS ? (
            <Link
              href={`/deals/${deal._id}`}
              className="inline-flex items-center gap-1 text-[0.625rem] sm:text-[0.6875rem] font-black uppercase tracking-wider transition-opacity hover:opacity-80"
              style={{ color: hex }}
            >
              View all
              <ArrowRight size={12} />
            </Link>
          ) : null}
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
        className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory pb-1"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {/* Full-width responsive — har screen par poori chaudai me cards:
            mobile 2 → sm 3 → md 4 → lg 5 → xl 6 → 2xl 7 cards per view */}
        {visibleProducts.map((product) => (
          <div
            key={product._id || product.id}
            className="group/deal flex-shrink-0 w-[47%] sm:w-[31%] md:w-[23.5%] lg:w-[19%] xl:w-[15.8%] 2xl:w-[13.5%] 4xl:w-[12%] 5xl:w-[10.5%] snap-start"
            style={{ "--deal-hex": hex }}
          >
            {/* Card bilkul wahi ProductCard hai jo regular listing me use hota
                hai — koi extra chrome nahi, sirf deal context (deal badge +
                deal pricing) ke sath. */}
            <ProductCard product={product} deal={deal} dealId={deal._id} showDealPricing />
          </div>
        ))}
      </div>
    </div>
  );
}

/* =====================================================
   SKELETON
===================================================== */
function DealsSkeleton({ embedded = false }) {
  return (
    <section className={embedded ? "w-full" : "user-shell mx-auto px-3 lg:px-6 py-5 lg:py-10"}>
      <div className="animate-pulse space-y-4">
        <div className="flex items-center justify-between px-2.5 sm:px-4 py-2 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]/70 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--user-bg-card)]" />
          </div>
          <div className="h-7 w-20 rounded-full bg-[var(--user-bg-card)]" />
        </div>
        <div className="rounded-3xl overflow-hidden border-2 border-[var(--user-border)]">
          <div className="h-24 sm:h-30 bg-[var(--user-bg-card)]" />
          <div className="flex gap-4 p-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-[19.2%] 4xl:w-[15.5%] 5xl:w-[12.8%] h-60 bg-[var(--user-bg-card)] rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}