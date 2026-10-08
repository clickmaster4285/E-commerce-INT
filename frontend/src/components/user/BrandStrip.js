"use client";

/* ==========================================================
   BRAND STRIP — real brand logos + product counts
   (brand logo API se, count real products se, kuch hardcoded nahi)
   ========================================================== */

<<<<<<< ours
import { useMemo } from "react";
=======
import { useEffect, useMemo, useRef, useState } from "react";
>>>>>>> theirs
import Link from "next/link";
import Image from "next/image";
import { smartImageLoader } from "@/utils/smartImageLoader";
import SectionHeading from "./SectionHeading";
import {
  idOf,
  imageUrl,
  sortByPopularity,
} from "@/utils/homeCatalog";

const LIMIT = 14;

export default function BrandStrip({ brands = [], brandCounts = {}, isLoading = false }) {
<<<<<<< ours
=======
  const stripRef = useRef(null);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);
>>>>>>> theirs
  // ✅ Counts server facets se — full catalog nahi
  const list = useMemo(() => {
    const counts = brandCounts || {};
    return sortByPopularity(brands, counts)
      .map((brand) => ({ ...brand, count: counts[idOf(brand._id)] || 0 }))
      .filter((brand) => brand.count > 0)
      .slice(0, LIMIT);
  }, [brands, brandCounts]);

<<<<<<< ours
=======
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return undefined;
    const updateFades = () => {
      setFadeLeft(strip.scrollLeft > 1);
      setFadeRight(strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1);
    };
    updateFades();
    strip.addEventListener("scroll", updateFades, { passive: true });
    const observer = new ResizeObserver(updateFades);
    observer.observe(strip);
    return () => {
      strip.removeEventListener("scroll", updateFades);
      observer.disconnect();
    };
  }, [list.length]);

>>>>>>> theirs
  if (isLoading && !list.length) return null;
  if (!list.length) return null;

  return (
    <section>
      <SectionHeading
        title="Shop by Brand"
        subtitle={`${list.length} featured brands`}
        href="/filtering-product"
        linkLabel="All brands"
      />

<<<<<<< ours
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
=======
      <div
        ref={stripRef}
        className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide"
        style={{
          maskImage: fadeLeft && fadeRight
            ? "linear-gradient(to right, transparent 0, black 36px, black calc(100% - 36px), transparent 100%)"
            : fadeLeft
              ? "linear-gradient(to right, transparent 0, black 36px, black 100%)"
              : fadeRight
                ? "linear-gradient(to right, black 0, black calc(100% - 36px), transparent 100%)"
                : "none",
          WebkitMaskImage: fadeLeft && fadeRight
            ? "linear-gradient(to right, transparent 0, black 36px, black calc(100% - 36px), transparent 100%)"
            : fadeLeft
              ? "linear-gradient(to right, transparent 0, black 36px, black 100%)"
              : fadeRight
                ? "linear-gradient(to right, black 0, black calc(100% - 36px), transparent 100%)"
                : "none",
        }}
      >
>>>>>>> theirs
        {list.map((brand) => {
          const logo = imageUrl(brand.logo);
          return (
            <Link
              key={brand._id}
              href={`/filtering-product?brand=${brand._id}`}
<<<<<<< ours
              title={`${brand.name} — ${brand.count} products`}
              className="group flex w-[7.75rem] shrink-0 flex-col items-center gap-2 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-2 py-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--user-accent)]"
=======
              title={brand.name}
              className="group flex w-[8.75rem] shrink-0 flex-col items-center gap-3 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-2 py-3 transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--user-accent-soft)] hover:shadow-[var(--user-shadow-sm)]"
>>>>>>> theirs
            >
              <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[var(--user-border)] bg-[var(--user-bg-hover)] p-1.5">
                {logo ? (
                  <Image src={logo} alt={brand.name} fill loader={smartImageLoader} sizes="48px" className="object-contain" />
                ) : (
                  <span className="text-lg font-black text-[var(--user-accent)]">
                    {String(brand.name || "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
<<<<<<< ours
              <span className="w-full truncate text-center text-[0.6875rem] font-semibold capitalize text-[var(--user-text-secondary)]">
                {brand.name}
              </span>
              <span className="text-[0.625rem] font-bold text-[var(--user-text-subtle)]">{brand.count} items</span>
=======
              <span className="w-full truncate text-center text-sm font-medium capitalize text-[var(--user-text)]">
                {brand.name}
              </span>
              <span className="text-xs font-normal text-[var(--user-text-muted)]">{brand.count} items</span>
>>>>>>> theirs
            </Link>
          );
        })}
      </div>
    </section>
  );
}
