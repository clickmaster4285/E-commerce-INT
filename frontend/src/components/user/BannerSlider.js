"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { smartImageLoader } from "@/utils/smartImageLoader";
import { useQuery } from "@tanstack/react-query";
import { bannerApi } from "@/apis/user/bannerApi";
import { ChevronLeft, ChevronRight } from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith("http")) return img;
  return `${API_ORIGIN}${img.startsWith("/") ? "" : "/"}${img}`;
};

/* Store owner portal se 600+ banners aa sakte hain (seeded data). Hero ke
   liye sirf top slides ka matlab banta hai — warna na carousel use ho sakta
   hai na indicator dots. Baaki banners admin portal me mojood rehte hain. */
const MAX_SLIDES = 12;

/* Ek waqt par sirf aas paas ke slides ki image mount karte hain:
     current            → jo dikh raha hai
     next, next+1       → aane wale slides (pehle se load → koi flash nahi)
     previous           → fade-out ke waqt gayab na ho
   Warna 600+ banners ki saari images ek saath download hoti hain
   (LCP par bara asar aur bandwidth waste). */
const MOUNT_AHEAD = 2;

export default function BannerSlider({ initialBanners = null }) {
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["activeBanners"],
    queryFn: bannerApi.getActive,
    // ✅ SSR initialData (R1): key/fn/polling same; server fail → client fetch
    initialData: initialBanners ?? undefined,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Position ke hisaab se sorted, sirf utne slides jitne hero me sane lagte hain
  const slides = useMemo(() => {
    const list = [...(banners || [])];
    list.sort((a, b) => (Number(a.position) || 0) - (Number(b.position) || 0));
    return list.slice(0, MAX_SLIDES);
  }, [banners]);

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const touchStartX = useRef(null);

  // ✅ Auto-play 4s (pause on hover)
  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    timerRef.current = setInterval(() => {
      setCurrent((p) => (p + 1) % slides.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [slides.length, paused]);

  // ✅ Mobile swipe — arrows mobile par hidden hain, is liye touch se slide
  const handleTouchStart = (event) => {
    touchStartX.current = event.touches?.[0]?.clientX ?? null;
  };
  const handleTouchEnd = (event) => {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches?.[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 40 || slides.length <= 1) return;
    if (delta < 0) goNext();
    else goPrev();
  };

  // Banners kam hone par index range ke andar rakho (stale index se bachne ke liye)
  const active = slides.length ? current % slides.length : 0;

  const isMounted = (index) => {
    const total = slides.length;
    if (!total) return false;
    const ahead = (index - active + total) % total;
    return ahead <= MOUNT_AHEAD || ahead === total - 1;
  };

  const goTo = (i) => setCurrent(i);
  const goPrev = () => setCurrent((p) => (p === 0 ? slides.length - 1 : p - 1));
  const goNext = () => setCurrent((p) => (p + 1) % slides.length);

  if (isLoading) {
    return (
      <section className="w-full">
        <div className="h-[13.125rem] w-full sm:h-[18.75rem] lg:h-[22.5rem] xl:h-[26rem] 2xl:h-[30rem] 3xl:aspect-[3/1] 3xl:h-auto bg-[var(--user-bg-card)] animate-pulse" />
      </section>
    );
  }

  if (!slides.length) return null;

  return (
    <section className="w-full" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <style>{`
        @keyframes kenBurns {
          0% { transform: scale(1); }
          100% { transform: scale(1.08); }
        }
      `}</style>
      {/* 1080p tak fixed height (jaisa tha), 2000px+ par 3:1 aspect —
          is liye bari screen par hero apne aap proportion me barhta hai */}
      <div
        className="relative w-full h-[13.125rem] sm:h-[18.75rem] lg:h-[22.5rem] xl:h-[26rem] 2xl:h-[30rem] 3xl:aspect-[3/1] 3xl:h-auto overflow-hidden bg-[var(--user-bg-card)]"
        style={{ minHeight: "13.125rem", touchAction: "pan-y" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* SLIDES */}
        {slides.map((banner, i) => {
          const imgUrl = getImageUrl(
            banner.desktopImage || banner.tabletImage || banner.mobileImage,
          );
          const isActive = i === active;
          const mountImage = isMounted(i);

          return (
            <div
              key={banner._id}
              className={`absolute inset-0 transition-opacity duration-700 ${
                isActive ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Background — sirf paas ke slides ki image DOM me aati hai */}
              {imgUrl && mountImage ? (
                <Image
                  src={imgUrl}
                  alt={banner.altText || banner.title || banner.heading || "Banner"}
                  fill
                  loader={smartImageLoader}
                  sizes="100vw"
                  priority={i === 0}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  className={`object-cover ${isActive ? "animate-[kenBurns_8s_ease-out_forwards]" : ""}`}
                />
              ) : imgUrl ? (
                <div className="w-full h-full bg-[var(--user-bg-card)]" />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: banner.backgroundColor || "#1f2937" }}
                />
              )}

              {/* Gradient overlays — strong left scrim so the heading/buttons
                  stay readable even when a banner image has baked-in text */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-black/10 to-transparent" />

              {/* Content */}
              <div className="absolute inset-0 flex items-center">
                <div className="w-full max-w-none px-5 sm:px-8 lg:px-12 xl:px-16">
                  <div
                    className={`max-w-2xl transition-all duration-700 ${
                      isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
                  >
                    {banner.eyebrow && (
                      <p className="inline-block text-[0.625rem] sm:text-xs font-black uppercase tracking-[0.25em] text-white/90 mb-2 sm:mb-3 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20">
                        {banner.eyebrow}
                      </p>
                    )}
                    {banner.heading && (
                      <h2 className="text-xl sm:text-3xl lg:text-[2.625rem] font-black text-white leading-[1.08] mb-2 sm:mb-3 drop-shadow-2xl line-clamp-2">
                        {banner.heading}
                      </h2>
                    )}
                    {banner.description && (
<p className="hidden sm:block text-sm sm:text-base lg:text-lg text-white/90 mb-5 sm:mb-6 max-w-xl leading-relaxed drop-shadow-lg">
                      {banner.description}
                    </p>
                    )}
                    <div className="flex flex-wrap gap-3">
                      {banner.primaryButton?.text && (
                        <ButtonLink button={banner.primaryButton} primary />
                      )}
                      {banner.secondaryButton?.text && (
                        <ButtonLink button={banner.secondaryButton} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Arrows — Daraz jaisa light-grey edge half-pill (all screens) */}
        {slides.length > 1 && (
          <>
            <button
              onClick={goPrev}
              aria-label="Previous banner"
              className="absolute left-0 top-1/2 -translate-y-1/2 z-20 flex w-6 h-12 sm:w-7 sm:h-14 items-center justify-center rounded-r-full bg-[#d9d9d9]/80 text-[#5a5a5a] hover:bg-[#c6c6c6] hover:text-[#333] active:bg-[#b5b5b5] transition-colors duration-200"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={goNext}
              aria-label="Next banner"
              className="absolute right-0 top-1/2 -translate-y-1/2 z-20 flex w-6 h-12 sm:w-7 sm:h-14 items-center justify-center rounded-l-full bg-[#d9d9d9]/80 text-[#5a5a5a] hover:bg-[#c6c6c6] hover:text-[#333] active:bg-[#b5b5b5] transition-colors duration-200"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* Pill Indicators */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 px-2.5 py-1.5 rounded-full bg-black/25 backdrop-blur-md border border-white/10">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to banner ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === active ? "w-5 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function ButtonLink({ button, primary }) {
  const href = button.link || "#";

  return (
    <Link
      href={href}
      className={`inline-flex min-h-8 items-center px-4 sm:px-5 py-2 rounded-lg text-[0.625rem] sm:text-xs font-bold uppercase tracking-wide transition-all duration-300 ${
        primary
          ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] shadow-lg hover:opacity-90"
          : "bg-white/10 backdrop-blur text-white border border-white/30 hover:bg-white/20"
      }`}
    >
      {button.text}
    </Link>
  );
}
