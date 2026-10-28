"use client";

import FallbackImage from "@/components/common/FallbackImage";
// ==========================================
// LANGUAGE TRANSITION CURTAIN
// ==========================================
// Full-screen "curtain" that closes over the app, fires the actual language
// change while it is fully closed, then opens again — so the user never sees
// the half-translated state of the page underneath.
//
// Three phases, driven purely by a single `phase` state and CSS animations:
//   cover  -> panels slide in from both edges (screen hidden)
//   hold   -> `onSwitch()` has fired, logo/spinner/"switching language" label
//   reveal -> panels slide back out, caller unmounts us via `onComplete`
//
// The whole thing is opt-in per call site — the parent renders this component
// only while a switch is in flight:
//
//   const { locale, changeLocale } = useTranslation();
//   const [pending, setPending] = useState(null);
//   <LanguageTransition
//     locale={pending}
//     onSwitch={() => changeLocale(pending)}
//     onComplete={() => setPending(null)}
//   />
//
// NOTES
// - `onSwitch`/`onComplete` are read through refs so the timer effect runs
//   exactly once. Inline arrow props in the parent would otherwise re-run the
//   effect on every parent render and restart the whole animation.
// - Styles are a plain <style> block (same pattern the rest of the app uses)
//   rather than `<style jsx>`: styled-jsx in Client Components needs a
//   StyleRegistry wrapper, and src/app/layout.js does not set one up.
// - Palette follows the panel we are covering — the admin theme tokens
//   (`--bg-main`/`--accent`) or the storefront ones (`--user-bg`/`--user-accent`)
//   — so the curtain never flashes the wrong colors.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import { DEFAULT_LOCALE, isRtl } from "@/i18n/config";
import { translate } from "@/i18n/translations";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

/** Phase timings in ms. `cleanup` is just breathing room before unmount. */
const DURATION = { cover: 900, hold: 1400, reveal: 1000, cleanup: 100 };
const STAGGER = { coverStrip: 130, revealStrip: 120, revealPanel: 300 };

/** Much shorter timings when the user asked for reduced motion. */
const REDUCED = { switchDelay: 120, total: 480 };

/** Store logo `img_url` is relative ("uploads/x.png"), so prepend the API origin. */
function resolveLogoUrl(url) {
  if (!url) return null;
  const raw = String(url);
  if (raw.startsWith("http") || raw.startsWith("//") || raw.startsWith("data:") || raw.startsWith("blob:")) {
    return raw;
  }
  return `${API_ORIGIN}/${raw.replace(/^\/+/, "")}`;
}

export default function LanguageTransition({
  locale = DEFAULT_LOCALE,
  storeName: storeNameProp,
  logoUrl: logoUrlProp,
  variant: variantProp = null,
  onSwitch,
  onComplete,
}) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState("cover");
  const [logoFailed, setLogoFailed] = useState(false);

  // Store identity is optional to pass — fall back to the same Redux slice the
  // sidebar and login pages read, so callers can render this with nothing.
  const reduxStoreName = useSelector((state) => state?.storeInfo?.storeName);
  const reduxLogo = useSelector((state) => state?.storeInfo?.logo);
  const storeName = storeNameProp || reduxStoreName || "";
  const logoUrl = resolveLogoUrl(
    logoUrlProp || (typeof reduxLogo === "string" ? reduxLogo : reduxLogo?.img_url)
  );

  const pathname = usePathname();
  const variant =
    variantProp || (pathname === "/admin" || pathname?.startsWith("/admin/") ? "admin" : "user");

  // Callbacks via ref — see the NOTE at the top of the file.
  const switchRef = useRef(onSwitch);
  const completeRef = useRef(onComplete);
  useEffect(() => {
    switchRef.current = onSwitch;
    completeRef.current = onComplete;
  });

  // Lock the page behind the curtain, then run cover -> hold -> reveal once.
  useEffect(() => {
    setMounted(true);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timers = [];
    const at = (delay, fn) => timers.push(window.setTimeout(fn, delay));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      at(REDUCED.switchDelay, () => {
        switchRef.current?.();
        setPhase("reveal");
      });
      at(REDUCED.total, () => completeRef.current?.());
    } else {
      at(DURATION.cover, () => {
        setPhase("hold");
        switchRef.current?.();
      });
      at(DURATION.cover + DURATION.hold, () => setPhase("reveal"));
      at(
        DURATION.cover + DURATION.hold + DURATION.reveal + DURATION.cleanup,
        () => completeRef.current?.()
      );
    }

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // A new logo deserves a fresh attempt at rendering.
  useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  if (!mounted) return null;

  const labelDir = isRtl(locale) ? "rtl" : "ltr";
  const fallbackLetter = (storeName || "C").charAt(0).toUpperCase();

  return createPortal(
    <div
      className={`language-curtain language-curtain--${phase}`}
      data-variant={variant}
      dir="ltr"
      lang={locale}
      role="status"
      aria-live="polite"
      style={{
        "--cover-duration": `${DURATION.cover}ms`,
        "--reveal-duration": `${DURATION.reveal}ms`,
        "--cover-stagger": `${STAGGER.coverStrip}ms`,
        "--reveal-stagger": `${STAGGER.revealStrip}ms`,
        "--reveal-panel-delay": `${STAGGER.revealPanel}ms`,
      }}
    >
      <span className="language-curtain__strip language-curtain__strip--left" aria-hidden="true" />
      <span className="language-curtain__strip language-curtain__strip--right" aria-hidden="true" />
      <span className="language-curtain__panel language-curtain__panel--left" aria-hidden="true" />
      <span className="language-curtain__panel language-curtain__panel--right" aria-hidden="true" />
      <span className="language-curtain__seam" aria-hidden="true" />

      <div className="language-curtain__message">
        <span className="language-curtain__brandmark">
          <span className="language-curtain__logo">
            {logoUrl && !logoFailed ? (
              <FallbackImage nextImage
                src={logoUrl}
                alt=""
                fill
                sizes="120px"
                className="object-contain"
                unoptimized
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span className="language-curtain__fallback" aria-hidden="true">
                {fallbackLetter}
              </span>
            )}
          </span>
          <span className="language-curtain__ring" aria-hidden="true" />
        </span>

        {storeName ? (
          <span className="language-curtain__store">{storeName}</span>
        ) : null}
        <span
          className="language-curtain__label"
          dir={labelDir}
          lang={locale}
        >
          {translate(locale, "common.switchingLanguage")}
        </span>
        <span className="language-curtain__progress" aria-hidden="true">
          <i />
        </span>
      </div>

      <style>{`
        .language-curtain {
          --lc-surface: var(--bg-main, #fff);
          --lc-accent: var(--accent, #2563eb);
          --lc-text: var(--text-primary, #111827);
          --lc-muted: var(--text-muted, #6b7280);

          position: fixed; inset: 0; z-index: 2147483647;
          display: flex; align-items: center; justify-content: center;
          width: 100vw; height: 100vh; height: 100dvh;
          overflow: hidden; pointer-events: all;
          background: var(--lc-surface); color: var(--lc-text);
          isolation: isolate; text-align: center;
        }
        .language-curtain[data-variant="user"] {
          --lc-surface: var(--user-bg, #fff);
          --lc-accent: var(--user-accent, #f57224);
          --lc-text: var(--user-text, #111827);
          --lc-muted: var(--user-text-muted, #6b7280);
        }

        .language-curtain__panel {
          position: absolute; z-index: 1; top: 0;
          width: calc(50vw + 1px);
          height: 100vh; height: 100dvh;
          background: var(--lc-surface);
          will-change: transform;
        }
        .language-curtain__panel--left { left: 0; transform: translate3d(-100%,0,0); box-shadow: 7px 0 20px rgba(0,0,0,.12); }
        .language-curtain__panel--right { right: 0; transform: translate3d(100%,0,0); box-shadow: -7px 0 20px rgba(0,0,0,.12); }

        .language-curtain__strip {
          position: absolute; z-index: 2; top: 0;
          width: 4px; height: 100vh; height: 100dvh;
          background: var(--lc-accent); opacity: .9;
          will-change: transform, opacity;
          transition: opacity 200ms ease;
        }
        .language-curtain__strip--left { left: calc(50% - 2px); transform: translate3d(-50vw,0,0); }
        .language-curtain__strip--right { right: calc(50% - 2px); transform: translate3d(50vw,0,0); }

        .language-curtain__seam {
          position: absolute; z-index: 3; top: 0; bottom: 0; left: 50%;
          width: 1px; background: var(--lc-accent);
          opacity: 0; transform: translateX(-50%);
          box-shadow: 0 0 14px 3px color-mix(in srgb, var(--lc-accent) 55%, transparent);
          will-change: opacity;
        }

        .language-curtain__message {
          position: relative; z-index: 3;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          text-align: center; pointer-events: none;
          opacity: 0; transform: translate3d(0,8px,0) scale(.85);
        }
        .language-curtain__brandmark { position: relative; display: grid; place-items: center; width: 170px; height: 170px; }
        .language-curtain__logo {
          position: absolute; inset: 0; margin: auto;
          display: grid; place-items: center; overflow: hidden;
          width: 120px; height: 120px; border-radius: 50%;
          background: #fff;
          box-shadow: 0 0 42px color-mix(in srgb, var(--lc-accent) 42%, transparent);
          animation: lc-logo-fade 260ms ease-out both;
        }
        .language-curtain__fallback { font-size: 30px; font-weight: 700; color: var(--lc-accent); }
        .language-curtain__ring {
          position: absolute; z-index: 4; inset: 0; margin: auto;
          width: 100%; height: 100%;
          border: 3px solid color-mix(in srgb, var(--lc-accent) 18%, transparent);
          border-top-color: var(--lc-accent);
          border-right-color: color-mix(in srgb, var(--lc-accent) 58%, transparent);
          border-radius: 50%;
          transform-origin: center;
        }
        .language-curtain__store { margin-top: 28px; font-size: 24px; font-weight: 600; letter-spacing: .12em; }
        .language-curtain__label { margin-top: 10px; font-size: 15px; letter-spacing: .1em; opacity: .82; color: var(--lc-muted); }
        .language-curtain__progress {
          width: 74px; height: 2px; margin-top: 20px; overflow: hidden;
          background: color-mix(in srgb, var(--lc-accent) 20%, transparent);
        }
        .language-curtain__progress i {
          display: block; width: 42%; height: 100%;
          background: var(--lc-accent);
          animation: lc-progress 900ms ease-in-out infinite alternate;
        }

        /* ---- cover: panels slide in ---- */
        .language-curtain--cover .language-curtain__panel--left { animation: lc-cover-left var(--cover-duration) cubic-bezier(.76,0,.24,1) both; }
        .language-curtain--cover .language-curtain__panel--right { animation: lc-cover-right var(--cover-duration) cubic-bezier(.76,0,.24,1) both; }
        .language-curtain--cover .language-curtain__strip--left { animation: lc-strip-left calc(var(--cover-duration) - var(--cover-stagger)) var(--cover-stagger) cubic-bezier(.76,0,.24,1) both; }
        .language-curtain--cover .language-curtain__strip--right { animation: lc-strip-right calc(var(--cover-duration) - var(--cover-stagger)) var(--cover-stagger) cubic-bezier(.76,0,.24,1) both; }

        /* ---- hold: switch happens here ---- */
        .language-curtain--hold .language-curtain__panel { transform: translate3d(0,0,0); }
        .language-curtain--hold .language-curtain__strip { opacity: 0; }
        .language-curtain--hold .language-curtain__seam { animation: lc-seam-flash 260ms ease-out both; }
        .language-curtain--hold .language-curtain__message { animation: lc-message-in 360ms 260ms cubic-bezier(.2,.8,.2,1) both; }
        .language-curtain--hold .language-curtain__ring { animation: lc-spin 1.2s linear infinite; }
        .language-curtain--hold .language-curtain__logo { animation: lc-logo-pulse 1.4s ease-in-out infinite alternate; }

        /* ---- reveal: panels slide back out ---- */
        .language-curtain--reveal .language-curtain__message { animation: lc-message-out 180ms ease-in both; }
        .language-curtain--reveal .language-curtain__panel--left { animation: lc-open-left calc(var(--reveal-duration) - var(--reveal-panel-delay)) var(--reveal-panel-delay) cubic-bezier(.76,0,.24,1) both; }
        .language-curtain--reveal .language-curtain__panel--right { animation: lc-open-right calc(var(--reveal-duration) - var(--reveal-panel-delay)) var(--reveal-panel-delay) cubic-bezier(.76,0,.24,1) both; }
        .language-curtain--reveal .language-curtain__strip--left { animation: lc-strip-out-left calc(var(--reveal-duration) - var(--reveal-stagger)) var(--reveal-stagger) cubic-bezier(.76,0,.24,1) both; }
        .language-curtain--reveal .language-curtain__strip--right { animation: lc-strip-out-right calc(var(--reveal-duration) - var(--reveal-stagger)) var(--reveal-stagger) cubic-bezier(.76,0,.24,1) both; }
        .language-curtain--reveal .language-curtain__seam { animation: lc-seam-out 180ms ease-out both; }

        @keyframes lc-cover-left { from { transform: translate3d(-100%,0,0); } to { transform: translate3d(0,0,0); } }
        @keyframes lc-cover-right { from { transform: translate3d(100%,0,0); } to { transform: translate3d(0,0,0); } }
        @keyframes lc-open-left { from { transform: translate3d(0,0,0); } to { transform: translate3d(-100%,0,0); } }
        @keyframes lc-open-right { from { transform: translate3d(0,0,0); } to { transform: translate3d(100%,0,0); } }
        @keyframes lc-strip-left { from { transform: translate3d(-50vw,0,0); } to { transform: translate3d(0,0,0); } }
        @keyframes lc-strip-right { from { transform: translate3d(50vw,0,0); } to { transform: translate3d(0,0,0); } }
        @keyframes lc-strip-out-left { from { transform: translate3d(0,0,0); } to { transform: translate3d(-50vw,0,0); } }
        @keyframes lc-strip-out-right { from { transform: translate3d(0,0,0); } to { transform: translate3d(50vw,0,0); } }
        @keyframes lc-seam-flash { 0% { opacity: 0; } 20% { opacity: .65; } 100% { opacity: 0; } }
        @keyframes lc-seam-out { to { opacity: 0; } }
        @keyframes lc-message-in { to { opacity: 1; transform: translate3d(0,0,0) scale(1); } }
        @keyframes lc-message-out { to { opacity: 0; transform: translate3d(0,-4px,0) scale(.98); } }
        @keyframes lc-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes lc-logo-pulse { to { transform: scale(1.04); } }
        @keyframes lc-logo-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lc-progress { to { transform: translateX(140%); } }
        @keyframes lc-fade-in { to { opacity: 1; } }
        @keyframes lc-fade-out { to { opacity: 0; } }

        @media (prefers-reduced-motion: reduce) {
          .language-curtain__strip { display: none; }
          .language-curtain--cover .language-curtain__panel { transform: none; opacity: 0; animation: lc-fade-in 120ms linear forwards !important; }
          .language-curtain--reveal .language-curtain__panel { animation: lc-fade-out 280ms linear forwards !important; }
          .language-curtain--hold .language-curtain__ring,
          .language-curtain--hold .language-curtain__logo,
          .language-curtain__progress i { animation: none !important; }
          .language-curtain--hold .language-curtain__message { opacity: 1; transform: none; }
        }

        @media (max-width: 640px) {
          .language-curtain__brandmark { width: 140px; height: 140px; }
          .language-curtain__logo { width: 96px; height: 96px; }
          .language-curtain__store { font-size: 22px; }
        }
      `}</style>
    </div>,
    document.body
  );
}
