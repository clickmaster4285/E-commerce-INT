"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { smartImageLoader } from "@/utils/smartImageLoader";
import { useQuery } from "@tanstack/react-query";
import { bannerApi } from "@/apis/user/bannerApi";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { dirForLocale } from "@/i18n/config";

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

/* Auto-play — active indicator ki progress animation khatam hone par agla slide.
   Hover par animation pause hoti hai, is liye bar aur slide hamesha sync rehte hain. */
const AUTOPLAY_MS = 5000;

/* Har slide ka apna flat color palette (glow/blur nahi) — index se cycle hota hai */
const PALETTES = [
  { from: "#4c1d95", via: "#a21caf", to: "#ec4899", extrude: "#2e1065" }, // violet → pink
  { from: "#1e3a8a", via: "#2563eb", to: "#06b6d4", extrude: "#172554" }, // blue → cyan
  { from: "#064e3b", via: "#059669", to: "#2dd4bf", extrude: "#022c22" }, // emerald → teal
  { from: "#9a3412", via: "#ea580c", to: "#f43f5e", extrude: "#431407" }, // orange → rose
  { from: "#312e81", via: "#6d28d9", to: "#3b82f6", extrude: "#1e1b4b" }, // indigo → blue
];

/* Entrance animation helper — sirf active slide par lagti hai, is liye slide
   dobara aane par poori sequence phir se chalti hai. */
const anim = (on, name, delay = 0, duration = 0.7) =>
  on ? { animation: `${name} ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s both` } : undefined;

/* Real start/end dates se pill text — dates na hon to pill hi nahi dikhti */
function getDateLabel(banner, now, locale) {
  const s = banner.startDate ? new Date(banner.startDate) : null;
  const e = banner.endDate ? new Date(banner.endDate) : null;
  const ok = (d) => d && !Number.isNaN(d.getTime());
  if (!ok(e)) return null;
  const dateLocale = locale === "ur" ? "ur-PK" : locale === "zh" ? "zh-CN" : locale === "pt" ? "pt-PT" : locale;
  const start = (d) => d.toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
  if (ok(s) && s.getTime() > now) return `${start(s)} – ${start(e)}`;
  return start(e);
}

function valueAtPath(value, path) {
  return path.split(".").reduce((current, part) => current?.[part], value);
}

function getBannerTranslation(banner, field, locale) {
  const translations = valueAtPath(banner?.translations, field);
  const translated = translations instanceof Map ? translations.get(locale) : translations?.[locale];
  return typeof translated === "string" ? translated.trim() : "";
}

function hasUntranslatedSourceWords(source, translated) {
  const sourceWords = String(source || "").match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [];
  const translatedWords = new Set(
    (String(translated || "").match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) || [])
      .map((word) => word.toLocaleLowerCase())
  );
  return sourceWords.some((word) => word.length >= 4 && translatedWords.has(word.toLocaleLowerCase()));
}

function hasTargetScript(text, locale) {
  const targetScript = {
    ur: /\p{Script=Arabic}/u,
    ar: /\p{Script=Arabic}/u,
    hi: /\p{Script=Devanagari}/u,
    zh: /\p{Script=Han}/u,
  }[locale];
  return !targetScript || !/\p{Script=Latin}/u.test(text) && targetScript.test(text);
}

function getBannerContent(banner, locale) {
  const fields = [
    "eyebrow",
    "heading",
    "description",
    "primaryButton.text",
    "secondaryButton.text",
  ];
  const hasMissingOrMixedTranslation = locale !== "en" && fields.some((field) => {
    const source = valueAtPath(banner, field);
    if (typeof source !== "string" || !source.trim()) return false;
    const translated = getBannerTranslation(banner, field, locale);
    return (
      !translated ||
      translated.toLocaleLowerCase() === source.trim().toLocaleLowerCase() ||
      !hasTargetScript(translated, locale) ||
      hasUntranslatedSourceWords(source, translated)
    );
  });
  const contentLocale = hasMissingOrMixedTranslation ? "en" : locale;
  const textFor = (field) =>
    contentLocale === "en"
      ? String(valueAtPath(banner, field) || "").trim()
      : getBannerTranslation(banner, field, contentLocale);

  return {
    locale: contentLocale,
    dir: dirForLocale(contentLocale),
    banner: {
      ...banner,
      title: textFor("title"),
      eyebrow: textFor("eyebrow"),
      heading: textFor("heading"),
      description: textFor("description"),
      altText: textFor("altText"),
      primaryButton: banner.primaryButton
        ? { ...banner.primaryButton, text: textFor("primaryButton.text") }
        : banner.primaryButton,
      secondaryButton: banner.secondaryButton
        ? { ...banner.secondaryButton, text: textFor("secondaryButton.text") }
        : banner.secondaryButton,
    },
  };
}

export default function BannerSlider({ initialBanners = null }) {
  const { locale, dir, t } = useTranslation();
  const { data: banners = [], isLoading } = useQuery({
    // Locale is part of the cache identity so switching languages never
    // keeps rendering the previous locale's banner snapshot.
    queryKey: ["activeBanners", locale],
    queryFn: () => bannerApi.getActive({ limit: 12, locale }),
    // ✅ SSR initialData (R1): key/fn/polling same; server fail → client fetch
    initialData: initialBanners ?? undefined,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
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
  const [now] = useState(() => Date.now());
  const touchStartX = useRef(null);

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
        @keyframes kenBurns { 0% { transform: scale(1); } 100% { transform: scale(1.08); } }
        @keyframes bnGradient { 0%, 100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }
        @keyframes bnGrid { from { background-position: 0 0, 0 0; } to { background-position: 40px 40px, 40px 40px; } }
        @keyframes bnFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
        @keyframes bnSpin { to { transform: rotate(360deg); } }
        @keyframes bnShape { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-12px) rotate(25deg); } }
        @keyframes bnWord { from { opacity: 0; transform: translateY(0.5em) skewY(6deg); } to { opacity: 1; transform: translateY(0) skewY(0); } }
        @keyframes bnSlideDown { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bnSlideLeft { from { opacity: 0; transform: translateX(-32px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes bnSlideRight { from { opacity: 0; transform: translateX(48px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes bnFan { from { opacity: 0; transform: translateX(70px) rotate(0deg) scale(0.8); } to { opacity: 1; transform: var(--bn-to); } }
        @keyframes bnNudge { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(4px); } }
        @keyframes bnProgress { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @media (prefers-reduced-motion: reduce) { .bn-anim { animation: none !important; } }
      `}</style>
      {/* 1080p tak fixed height (jaisa tha), 2000px+ par 3:1 aspect —
          is liye bari screen par hero apne aap proportion me barhta hai */}
      <div
        className="group relative w-full h-[13.125rem] sm:h-[18.75rem] lg:h-[22.5rem] xl:h-[26rem] 2xl:h-[30rem] 3xl:aspect-[3/1] 3xl:h-auto overflow-hidden bg-[var(--user-bg-card)]"
        style={{ minHeight: "13.125rem", touchAction: "pan-y" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* SLIDES */}
        {slides.map((banner, i) => {
          const { banner: localizedBanner, locale: contentLocale, dir: contentDir } =
            getBannerContent(banner, locale);
          const imgUrl = getImageUrl(banner.desktopImage || banner.tabletImage || banner.mobileImage);
          const isActive = i === active;
          const hasCopy = Boolean(
            localizedBanner.eyebrow || localizedBanner.heading || localizedBanner.description || localizedBanner.primaryButton?.text,
          );

          return (
            <div
              key={banner._id}
              className={`absolute inset-0 transition-opacity duration-700 ${
                isActive ? "opacity-100" : "opacity-0 pointer-events-none"
              }`}
            >
              {hasCopy ? (
                <PromoSlide
                  banner={localizedBanner}
                  imgUrl={imgUrl}
                  mountImage={isMounted(i)}
                  isActive={isActive}
                  palette={PALETTES[i % PALETTES.length]}
                  priority={i === 0}
                  dateLabel={getDateLabel(banner, now, contentLocale)}
                  dir={contentDir}
                  locale={contentLocale}
                />
              ) : (
                <ImageSlide banner={localizedBanner} imgUrl={imgUrl} mountImage={isMounted(i)} isActive={isActive} priority={i === 0} fallbackAlt={t("banner.imageAlt")} />
              )}
            </div>
          );
        })}

        {/* Arrows — Daraz jaisa light-grey edge half-pill (all screens) */}
        {slides.length > 1 && (
          <>
            <button
              onClick={goPrev}
              aria-label={t("banner.previous")}
              className="absolute left-0 top-1/2 z-20 flex h-10 w-9 -translate-y-1/2 items-center justify-center rounded-r-md bg-black/30 text-white opacity-0 transition-colors duration-200 hover:bg-black/50 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onClick={goNext}
              aria-label={t("banner.next")}
              className="absolute right-0 top-1/2 z-20 flex h-10 w-9 -translate-y-1/2 items-center justify-center rounded-l-md bg-black/30 text-white opacity-0 transition-colors duration-200 hover:bg-black/50 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <ChevronRight size={13} />
            </button>
          </>
        )}

        {/* Pill indicators — active pill me progress bharti hai, khatam hone par agla slide */}
        {slides.length > 1 && (
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-md border border-white/15 bg-black/30 px-2.5 py-1.5 sm:bottom-4">
            {slides.map((_, i) =>
              i === active ? (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={t("banner.current", { index: i + 1 })}
                  className="relative h-1.5 w-10 overflow-hidden rounded-full bg-white/35"
                >
                  <span
                    key={active}
                    className="absolute inset-0 origin-left bg-white"
                    style={{
                      animation: `bnProgress ${AUTOPLAY_MS}ms linear forwards`,
                      animationPlayState: paused ? "paused" : "running",
                    }}
                    onAnimationEnd={goNext}
                  />
                </button>
              ) : (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={t("banner.goTo", { index: i + 1 })}
                  className="h-1.5 w-1.5 rounded-full bg-white/50 hover:bg-white/80 transition-colors duration-300"
                />
              ),
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* =====================================================
   PROMO SLIDE — text wale banners (Daraz-style campaign look)
   Banner image poori slide ka background hai, text iske upar overlay jaisa —
   word-by-word heading, date pill, CTA. Koi alag card/fan nahi.
===================================================== */
function PromoSlide({ banner, imgUrl, mountImage, isActive, palette, priority, dateLabel, dir, locale }) {
  const words = (banner.heading || "").split(/\s+/).filter(Boolean);
  const { t } = useTranslation();
  const alt = banner.altText || t("banner.imageAlt");
  const extrude = `1px 1px 0 ${palette.extrude}, 2px 2px 0 ${palette.extrude}, 3px 3px 0 ${palette.extrude}, 4px 4px 0 ${palette.extrude}, 5px 5px 0 rgba(0,0,0,0.3)`;

  return (
    <div className="bn-anim absolute inset-0 overflow-hidden">
      {/* Banner ka main image — ab alag card/fan nahi, poori slide ka background hai */}
      {imgUrl && mountImage ? (
        <Image
          src={imgUrl}
          alt={alt}
          fill
          loader={smartImageLoader}
          sizes="100vw"
          priority={priority}
          fetchPriority={priority ? "high" : "auto"}
          className={`object-cover ${isActive ? "animate-[kenBurns_8s_ease-out_forwards]" : ""}`}
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(120deg, ${palette.from}, ${palette.via}, ${palette.to})` }}
        />
      )}

      {/* Text readable rahe is liye halka dark overlay */}
      <div className="absolute inset-0 bg-black/35" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />

      <div dir={dir} className="relative z-10 flex h-full items-center justify-start px-5 sm:px-8 lg:px-12 xl:px-14">
        {/* COPY — ab image ke upar hi text aa raha hai */}
        <div dir={dir} className="w-full max-w-3xl text-start">
          {banner.eyebrow && (
            <span
              className={`bn-anim mb-2 inline-block rounded-md border border-white/40 bg-white/15 px-2.5 py-1 text-[0.625rem] font-semibold text-white sm:mb-2.5 sm:text-xs ${dir === "rtl" ? "normal-case" : "uppercase tracking-[0.12em]"}`}
              style={anim(isActive, "bnSlideDown", 0.05, 0.6)}
            >
              {banner.eyebrow}
            </span>
          )}

          {words.length > 0 && (
            <h2
              dir={dir}
              className={`mb-2 font-black text-white sm:mb-3 ${dir === "rtl" ? "text-2xl leading-[1.65] sm:text-4xl lg:text-5xl xl:text-6xl" : "text-2xl uppercase italic leading-[0.95] tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl"}`}
              style={{ overflowWrap: "normal", wordBreak: "normal", textShadow: extrude }}
            >
              {dir === "rtl"
                ? <span className="bn-anim inline-block" style={anim(isActive, "bnSlideLeft", 0.15, 0.6)}>{banner.heading}</span>
                : words.map((w, wi) => (
                    <span
                      key={`${w}-${wi}`}
                      className="bn-anim me-[0.25em] inline-block"
                      style={anim(isActive, "bnWord", 0.15 + wi * 0.09, 0.6)}
                    >
                      {w}
                    </span>
                  ))}
            </h2>
          )}

          {banner.description && (
            <p
              dir={dir}
              className={`bn-anim hidden max-w-xl text-sm text-white/85 sm:block sm:text-base lg:text-lg ${dir === "rtl" ? "mb-6 sm:mb-7 lg:mb-8 line-clamp-3 leading-[2]" : "mb-4 lg:mb-5 line-clamp-2 leading-relaxed"}`}
              style={{ lineHeight: dir === "rtl" ? 2 : undefined, ...anim(isActive, "bnSlideLeft", 0.35) }}
            >
              {banner.description}
            </p>
          )}

          {dateLabel && (
            <span
              className="bn-anim mb-2 hidden rounded-md bg-white px-3 py-1 text-[0.625rem] font-semibold uppercase tracking-wide sm:inline-block sm:text-xs lg:mb-3"
              style={{ color: palette.from, ...anim(isActive, "bnSlideLeft", 0.45) }}
            >
              {dateLabel}
            </span>
          )}

          <div className="flex flex-wrap justify-start gap-2 sm:gap-3">
            {banner.primaryButton?.text && (
              <ButtonLink button={banner.primaryButton} palette={palette} primary isActive={isActive} delay={0.55} locale={locale} />
            )}
            {banner.secondaryButton?.text && (
              <ButtonLink button={banner.secondaryButton} palette={palette} isActive={isActive} delay={0.65} locale={locale} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* Sirf image wale banners (koi text/button nahi) — full-bleed + Ken Burns */
function ImageSlide({ banner, imgUrl, mountImage, isActive, priority, fallbackAlt }) {
  return (
    <>
      {imgUrl && mountImage ? (
        <Image
          src={imgUrl}
          alt={banner.altText || fallbackAlt}
          fill
          loader={smartImageLoader}
          sizes="100vw"
          priority={priority}
          fetchPriority={priority ? "high" : "auto"}
          className={`object-cover ${isActive ? "animate-[kenBurns_8s_ease-out_forwards]" : ""}`}
        />
      ) : imgUrl ? (
        <div className="h-full w-full bg-[var(--user-bg-card)]" />
      ) : (
        <div className="h-full w-full" style={{ backgroundColor: banner.backgroundColor || "#1f2937" }} />
      )}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/50 to-transparent" />
    </>
  );
}

function ButtonLink({ button, palette, primary = false, isActive, delay = 0, locale }) {
  const { t } = useTranslation();
  const href = button.link || "#";

  // Inline color: `.user-theme a { color: inherit }` Tailwind text-* ko override kar deta hai
  return (
    <Link
      href={href}
      dir={dirForLocale(locale)}
      className={`bn-anim group/btn inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:scale-[0.98] sm:px-4 sm:py-2 sm:text-sm ${dirForLocale(locale) === "rtl" ? "normal-case tracking-normal leading-[1.8]" : "uppercase tracking-wide"} ${
        primary ? "bg-white" : "border-2 border-white/80 hover:bg-white/15"
      }`}
      style={{ color: primary ? palette.from : "#ffffff", ...anim(isActive, "bnSlideLeft", delay, 0.6) }}
    >
      {primary ? (locale === "en" ? "Shop Now" : t("banner.shopNow")) : button.text}
      {primary && (dirForLocale(locale) === "rtl" ? <ArrowLeft
          size={15}
          className="bn-anim"
          style={{ animation: isActive ? "bnNudge 1.6s ease-in-out 1.2s infinite" : undefined }}
        /> : <ArrowRight
          size={15}
          className="bn-anim"
          style={{ animation: isActive ? "bnNudge 1.6s ease-in-out 1.2s infinite" : undefined }}
        />)}
    </Link>
  );
}
