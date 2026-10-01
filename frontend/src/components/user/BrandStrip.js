"use client";

/* ==========================================================
   BRAND STRIP — real brand logos + product counts
   (brand logo API se, count real products se, kuch hardcoded nahi)
   ========================================================== */

import { useMemo } from "react";
import Link from "next/link";
import SectionHeading from "./SectionHeading";
import {
  idOf,
  imageUrl,
  sortByPopularity,
} from "@/utils/homeCatalog";

const LIMIT = 14;

export default function BrandStrip({ brands = [], brandCounts = {}, isLoading = false }) {
  // ✅ Counts server facets se — full catalog nahi
  const list = useMemo(() => {
    const counts = brandCounts || {};
    return sortByPopularity(brands, counts)
      .map((brand) => ({ ...brand, count: counts[idOf(brand._id)] || 0 }))
      .filter((brand) => brand.count > 0)
      .slice(0, LIMIT);
  }, [brands, brandCounts]);

  if (isLoading && !list.length) return null;
  if (!list.length) return null;

  return (
    <section>
      <SectionHeading
        title="Shop by Brand"
        subtitle={`${list.length} featured brands`}
        href="/"
        linkLabel="All brands"
      />

      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
        {list.map((brand) => {
          const logo = imageUrl(brand.logo);
          return (
            <Link
              key={brand._id}
              href={`/?brand=${brand._id}`}
              title={`${brand.name} — ${brand.count} products`}
              className="group flex w-[7.75rem] shrink-0 flex-col items-center gap-2 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-2 py-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--user-accent)]"
            >
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[var(--user-border)] bg-[var(--user-bg-hover)] p-1.5">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logo} alt={brand.name} loading="lazy" className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-lg font-black text-[var(--user-accent)]">
                    {String(brand.name || "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <span className="w-full truncate text-center text-[0.6875rem] font-semibold capitalize text-[var(--user-text-secondary)]">
                {brand.name}
              </span>
              <span className="text-[0.625rem] font-bold text-[var(--user-text-subtle)]">{brand.count} items</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
