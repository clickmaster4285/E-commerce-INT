"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { categoryApi } from "@/apis/categoryApi";
import { brandApi } from "@/apis/brandApi";
import { productApi } from "@/apis/productApi";
import ProductCard from "./ProductCard";

// ✅ ARROW — hamesha visible, disable jab aage/peeche kuch na ho
function ArrowBtn({ dir, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "left" ? "Previous products" : "Next products"}
      className={`w-9 h-9 lg:w-10 lg:h-10 rounded-xl border flex items-center justify-center transition shrink-0 ${
        disabled
          ? "border-[var(--user-border)] text-[var(--user-text-disabled)] opacity-40 cursor-not-allowed"
          : "border-[var(--user-border)] bg-[var(--user-bg-card)] text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] hover:border-[var(--user-accent)]/50 active:scale-90"
      }`}
    >
      {dir === "left" ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
    </button>
  );
}

// ✅ Loading skeleton row
function RowSkeleton() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 lg:px-6">
      <div className="h-6 w-40 bg-[var(--user-bg-card)] rounded-full animate-pulse mb-4" />
      <div className="flex gap-3 lg:gap-4 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="w-[160px] sm:w-[200px] lg:w-[230px] shrink-0 aspect-[3/4] rounded-2xl bg-[var(--user-bg-card)] animate-pulse border border-[var(--user-border)]"
          />
        ))}
      </div>
    </div>
  );
}

// ✅ Generic product row — title + FIXED arrows + horizontal slide
function ProductRow({ title, subtitle, href, products }) {
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 5);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 5);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (el) el.addEventListener("scroll", updateArrows);
    window.addEventListener("resize", updateArrows);
    return () => {
      if (el) el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [products]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.querySelector("a");
    const step = card ? card.offsetWidth + 16 : 240;
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  if (!products || products.length === 0) return null;

  return (
    <section className="max-w-[1400px] mx-auto px-4 lg:px-6">
      {/* HEADER — title left, FIXED arrows right */}
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <Link href={href} className="group inline-block">
            <h2 className="text-base lg:text-lg font-bold text-[var(--user-text)] capitalize group-hover:text-[var(--user-accent)] transition truncate">
              {title}
            </h2>
          </Link>
          {subtitle && (
            <p className="text-[11px] lg:text-xs text-[var(--user-text-muted)] mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* ✅ ARROWS — hamesha fixed, disable jab zaroorat na ho */}
        <div className="flex gap-2 shrink-0">
          <ArrowBtn dir="left" onClick={() => scroll("left")} disabled={!canLeft} />
          <ArrowBtn dir="right" onClick={() => scroll("right")} disabled={!canRight} />
        </div>
      </div>

      {/* PRODUCTS ROW — horizontal slide */}
      <div
        ref={scrollRef}
        className="scrollbar-hide flex gap-3 lg:gap-4 overflow-x-auto scroll-smooth pb-1"
      >
        {products.map((p) => (
          <div key={p._id} className="w-[160px] sm:w-[200px] lg:w-[230px] shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ==========================================
// ✅ CATEGORY SHOWCASE — Top 3 categories rows
// ==========================================
export function CategoryShowcase() {
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const top = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      const id = typeof p.category_id === "object" ? p.category_id?._id : p.category_id;
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return categories
      .map((c) => ({ ...c, count: counts[c._id] || 0 }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [categories, products]);

  if (isLoading) {
    return (
      <div className="space-y-10 lg:space-y-14 py-8 lg:py-10">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    );
  }

  if (top.length === 0) return null;

  return (
    <div className="space-y-10 lg:space-y-14 py-8 lg:py-10">
      {top.map((cat) => (
        <ProductRow
          key={cat._id}
          title={cat.name}
          subtitle={`${cat.count} products`}
          href={`/category/${cat._id}`}
          products={products.filter(
            (p) => (p.category_id?._id || p.category_id) === cat._id
          )}
        />
      ))}
    </div>
  );
}

// ==========================================
// ✅ BRAND SHOWCASE — Top 3 brands rows
// ==========================================
export function BrandShowcase() {
  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: brandApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const top = useMemo(() => {
    const counts = {};
    products.forEach((p) => {
      const id = typeof p.brand_id === "object" ? p.brand_id?._id : p.brand_id;
      if (id) counts[id] = (counts[id] || 0) + 1;
    });
    return brands
      .map((b) => ({ ...b, count: counts[b._id] || b.products?.length || 0 }))
      .filter((b) => b.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [brands, products]);

  if (isLoading) {
    return (
      <div className="space-y-10 lg:space-y-14 py-8 lg:py-10">
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </div>
    );
  }

  if (top.length === 0) return null;

  return (
    <div className="space-y-10 lg:space-y-14 py-8 lg:py-10">
      {top.map((brand) => (
        <ProductRow
          key={brand._id}
          title={brand.name}
          subtitle={`${brand.count} products`}
          href={`/brand/${brand._id}`}
          products={products.filter(
            (p) => (p.brand_id?._id || p.brand_id) === brand._id
          )}
        />
      ))}
    </div>
  );
}