"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

const reducedMotion = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

const abbreviate = (value) => {
  const v = Math.round(Number(value) || 0);
  return v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}K` : String(v);
};

/**
 * Storefront header points pill. Sirf UI — data/click/auth handling caller karta hai.
 */
export default function PointsBadge({ points = 0, href = "/account?tab=rewards", loading = false, onClick, delta = null, boost = false }) {
  const { t, locale } = useTranslation();
  const [display, setDisplay] = useState(Number(points) || 0);
  const previous = useRef(Number(points) || 0);
  const first = useRef(true);

  useEffect(() => {
    const next = Number(points) || 0;
    const from = previous.current;
    previous.current = next;

    if (first.current) {
      first.current = false;
      setDisplay(next);
      return undefined;
    }
    if (next === from || reducedMotion()) {
      setDisplay(next);
      return undefined;
    }

    let raf;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - start) / 400);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(from + (next - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [points]);

  const fmt = (v) => new Intl.NumberFormat(locale).format(Math.round(Number(v) || 0));
  const fullValue = fmt(points || 0);

  if (loading) {
    return (
      <span aria-hidden="true" className="inline-flex h-9 w-[7.5rem] shrink-0 animate-pulse rounded-full bg-user-hover pointer-coarse:h-10" />
    );
  }

  const className = [
    "relative inline-flex h-9 shrink-0 items-center gap-2 rounded-full ps-1 pe-2",
    "bg-transparent transition-all duration-200 ease-out hover:-translate-y-px active:scale-[0.97]",
    "hover:bg-user-hover",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-user-accent focus-visible:ring-offset-2 focus-visible:ring-offset-user-card",
    "pointer-coarse:h-10 sm:h-10",
    boost ? "motion-safe:animate-[coinBoostGlow_1.4s_ease-out]" : "",
  ].join(" ");

  const inner = (
    <>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-user-accent">
        <Coins size={14} strokeWidth={2.2} className="text-user-accent-fg" aria-hidden="true" />
      </span>
      <span className="text-sm font-bold tabular-nums text-user-fg">
        <span className="min-[380px]:hidden">{abbreviate(display)}</span>
        <span className="hidden min-[380px]:inline">{fmt(display)}</span>
      </span>
      {delta !== null && Number(delta) > 0 && (
        <span aria-hidden="true" className="pointer-events-none absolute -top-2 end-0 rounded-full bg-user-accent px-1.5 py-0.5 text-[0.625rem] font-bold leading-none text-user-accent-fg motion-safe:animate-[pointsDeltaIn_1.2s_ease-out_both]">
          +{fmt(delta)}
        </span>
      )}
    </>
  );

  const shared = {
    "data-loyalty-coin-target": "",
    title: t("header.rewards"),
    "aria-label": t("header.pointsBadgeLabel", { points: fullValue }),
    className,
  };

  return (
    <>
      {href ? (
        <Link href={href} onClick={onClick} {...shared}>{inner}</Link>
      ) : (
        <button type="button" onClick={onClick} {...shared}>{inner}</button>
      )}
      <style>{`
        @keyframes pointsDeltaIn { 0% { opacity: 0; transform: translateY(6px) } 20% { opacity: 1; transform: translateY(0) } 70% { opacity: 1 } 100% { opacity: 0; transform: translateY(-8px) } }
        @keyframes coinBoostGlow { 0%, 100% { box-shadow: 0 0 0 0 transparent } 45% { box-shadow: 0 0 0 4px var(--user-accent-soft) } }
      `}</style>
    </>
  );
}
