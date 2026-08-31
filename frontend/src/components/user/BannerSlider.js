"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { bannerApi } from "@/apis/user/bannerApi";
import { ChevronLeft, ChevronRight } from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith("http")) return img;
  return `${API_ORIGIN}${img.startsWith("/") ? "" : "/"}${img}`;
};

export default function BannerSlider() {
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["activeBanners"],
    queryFn: bannerApi.getActive,
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  // ✅ Auto-play 4s (pause on hover)
  useEffect(() => {
    if (banners.length <= 1 || paused) return;
    timerRef.current = setInterval(() => {
      setCurrent((p) => (p + 1) % banners.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [banners.length, paused]);

  const goTo = (i) => setCurrent(i);
  const goPrev = () => setCurrent((p) => (p === 0 ? banners.length - 1 : p - 1));
  const goNext = () => setCurrent((p) => (p + 1) % banners.length);

  if (isLoading) {
    return (
      <section className="w-full">
        <div className="h-[220px] sm:h-[320px] lg:h-[440px] bg-[var(--user-bg-card)] animate-pulse" />
      </section>
    );
  }

  if (!banners || banners.length === 0) return null;

  return (
    <section className="w-full" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <style>{`
        @keyframes kenBurns {
          0% { transform: scale(1); }
          100% { transform: scale(1.08); }
        }
      `}</style>
      <div
        className="relative w-full h-[220px] sm:h-[320px] lg:h-[440px] overflow-hidden bg-[var(--user-bg-card)]"
        style={{ minHeight: "220px" }}
      >
        {/* SLIDES */}
        {banners.map((banner, i) => {
          const imgUrl = getImageUrl(
            banner.desktopImage || banner.tabletImage || banner.mobileImage,
          );
          const isActive = i === current;

          return (
            <div
              key={banner._id}
              className={`absolute inset-0 transition-opacity duration-700 ${
                isActive ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {/* Background */}
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt={banner.altText || banner.title || banner.heading || "Banner"}
                  className={`w-full h-full object-cover ${isActive ? "animate-[kenBurns_8s_ease-out_forwards]" : ""}`}
                  loading={i === 0 ? "eager" : "lazy"}
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: banner.backgroundColor || "#1f2937" }}
                />
              )}

              {/* Gradient overlays for readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />

              {/* Content */}
              <div className="absolute inset-0 flex items-center">
                <div className="w-full max-w-[1400px] mx-auto px-6 sm:px-10 lg:px-16">
                  <div
                    className={`max-w-2xl transition-all duration-700 ${
                      isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    }`}
                  >
                    {banner.eyebrow && (
                      <p className="inline-block text-[10px] sm:text-xs font-black uppercase tracking-[0.25em] text-white/90 mb-2 sm:mb-4 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/20">
                        {banner.eyebrow}
                      </p>
                    )}
                    {banner.heading && (
                      <h2 className="text-2xl sm:text-4xl lg:text-6xl font-black text-white leading-[1.05] mb-3 sm:mb-4 drop-shadow-2xl">
                        {banner.heading}
                      </h2>
                    )}
                    {banner.description && (
                      <p className="text-sm sm:text-base lg:text-lg text-white/90 mb-5 sm:mb-7 max-w-xl leading-relaxed drop-shadow-lg">
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

        {/* Arrows (desktop only — swipe on mobile) */}
        {banners.length > 1 && (
          <>
            <button
              onClick={goPrev}
              aria-label="Previous banner"
              className="hidden sm:flex absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 items-center justify-center text-white hover:bg-black/50 hover:scale-110 transition-all duration-200"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              onClick={goNext}
              aria-label="Next banner"
              className="hidden sm:flex absolute right-4 lg:right-8 top-1/2 -translate-y-1/2 z-20 w-11 h-11 lg:w-12 lg:h-12 rounded-full bg-black/30 backdrop-blur-md border border-white/20 items-center justify-center text-white hover:bg-black/50 hover:scale-110 transition-all duration-200"
            >
              <ChevronRight size={22} />
            </button>
          </>
        )}

        {/* Pill Indicators */}
        {banners.length > 1 && (
          <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20 px-3 py-2 rounded-full bg-black/20 backdrop-blur-md border border-white/10">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to banner ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === current ? "w-8 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
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
  const cls = primary
    ? "bg-white text-black hover:bg-white/90"
    : "bg-white/10 backdrop-blur text-white border border-white/30 hover:bg-white/20";
  return (
    <Link
      href={href}
      className={`${cls} px-5 sm:px-7 py-2.5 sm:py-3 rounded-xl text-[11px] sm:text-sm font-black uppercase tracking-wider transition shadow-xl`}
    >
      {button.text}
    </Link>
  );
}