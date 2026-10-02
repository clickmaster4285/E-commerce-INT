"use client";

/* ==========================================================
   BRAND SHOWCASE — "Shop by Brand" ke neeche, home page ka
   aakhri section. Top brands ki apni sliding product rows:

   - SIRF woh brands jin me 6 ya 6 se zyada products hon
   - STRICTLY 1 ROW: desktop 6, tablet 4, mobile 3 products (ek hi row)
   - Row ke LEFT / RIGHT side par arrows — click par SIRF 1 product
     slide hota hai (zyada nahi)
   - Jis taraf koi product na ho us taraf ka arrow HIDE rehta hai
   - Saara data REAL API se (brands + products), kuch hardcoded nahi
   ========================================================== */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { smartImageLoader } from "@/utils/smartImageLoader";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import ProductCard from "./ProductCard";
import SectionHeading from "./SectionHeading";
import SlideArrow from "./SlideArrow";
import { productApi } from "@/apis/user/productApi";
import {
  idOf,
  imageUrl,
  sortByPopularity,
} from "@/utils/homeCatalog";

const BRAND_LIMIT = 4;

/* STRICTLY 1 ROW — har screen par: mobile (3 cols) → 3, tablet (4 cols)
   → 4, desktop (6 cols) → 6 products. Ek se zyada rows kabhi nahi. */
function useVisibleCount() {
  const get = () => {
    if (typeof window === "undefined") return 6;
    if (window.matchMedia("(min-width: 1024px)").matches) return 6;
    if (window.matchMedia("(min-width: 640px)").matches) return 4;
    return 3;
  };
  const [count, setCount] = useState(get);
  useEffect(() => {
    const onResize = () => setCount(get());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return count;
}

function BrandRow({ brand, items }) {
  const [start, setStart] = useState(0);
  const visibleCount = useVisibleCount();
  const brandId = idOf(brand._id);
  const logo = imageUrl(brand.logo);

  const maxStart = Math.max(0, items.length - visibleCount);
  const safeStart = Math.min(start, maxStart);
  const visible = items.slice(safeStart, safeStart + visibleCount);

  return (
    <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-3 sm:p-4">
      {/* Brand header */}
      <div className="mb-3 flex items-center gap-2.5">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--user-border)] bg-[var(--user-bg-hover)] p-1.5">
          {logo ? (
            <Image src={logo} alt={brand.name} fill loader={smartImageLoader} sizes="40px" className="object-contain" />
          ) : (
            <span className="text-base font-black text-[var(--user-accent)]">
              {String(brand.name || "?").charAt(0).toUpperCase()}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-black capitalize text-[var(--user-text)]">
            {brand.name}
          </p>
          <p className="text-[0.625rem] font-semibold text-[var(--user-text-subtle)]">
            {brand.count} {brand.count === 1 ? "item" : "items"}
          </p>
        </div>
        <Link
          href={`/?brand=${brandId}`}
          className="group inline-flex shrink-0 items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--user-accent)] transition-opacity hover:opacity-80"
        >
          View all
          <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Single-row sliding products grid (1 product per slide) */}
      <div className="relative w-full">
        <div
          key={safeStart}
          style={{ animation: "catSlideIn 0.25s ease-out" }}
          className="grid w-full grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6"
        >
          {visible.map((product) => (
            <ProductCard key={idOf(product._id) || product.name} product={product} />
          ))}
        </div>

        {/* Floating arrows (Deals style) — jis taraf kuch na ho hide */}
        {safeStart > 0 ? (
          <SlideArrow dir="left" onClick={() => setStart(safeStart - 1)} label={`Previous ${brand.name} products`} />
        ) : null}
        {safeStart < maxStart ? (
          <SlideArrow dir="right" onClick={() => setStart(safeStart + 1)} label={`Next ${brand.name} products`} />
        ) : null}
      </div>
    </div>
  );
}

/* Ek brand row ke products — server (?brand_id=, cap 30 slider headroom) */
function useBrandRowItems(brandId) {
  const { data } = useQuery({
    queryKey: ["brandRowProducts", brandId],
    queryFn: () =>
      productApi.getAllPaginated({ page: 1, limit: 30, brand_id: brandId }),
    enabled: !!brandId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return data?.products || [];
}

function BrandRowData({ brand }) {
  const items = useBrandRowItems(idOf(brand._id));
  if (!items.length) return null;
  return <BrandRow brand={brand} items={items} />;
}

export default function BrandShowcase({ brands = [], brandCounts = {}, isLoading = false }) {
  // ✅ Top brands server counts se (>=6 wali), items per-brand query se
  const rows = useMemo(() => {
    const counts = brandCounts || {};
    return sortByPopularity(brands, counts)
      .map((brand) => ({ ...brand, count: counts[idOf(brand._id)] || 0 }))
      .filter((brand) => brand.count >= 6)
      .slice(0, BRAND_LIMIT);
  }, [brands, brandCounts]);

  if (isLoading && !rows.length) {
    return (
      <section>
        <div className="mb-3.5 h-5 w-44 animate-pulse rounded-full bg-[var(--user-bg-card)]" />
        <div className="space-y-3">
          {[...Array(2).keys()].map((index) => (
            <div
              key={index}
              className="h-[16rem] animate-pulse rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!rows.length) return null;

  return (
    <section>
      <style>{`
        @keyframes catSlideIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <SectionHeading
        title="Brand Spotlight"
        subtitle="Top products from leading brands"
        href="/"
        linkLabel="All products"
      />

      <div className="space-y-3 lg:space-y-4">
        {rows.map((row) => (
          <BrandRowData key={idOf(row._id)} brand={row} />
        ))}
      </div>
    </section>
  );
}
