"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { categoryApi } from "@/apis/user/categoryApi";
import { brandApi } from "@/apis/user/brandApi";
import { productApi } from "@/apis/user/productApi";
import ProductCard from "./ProductCard";

// ✅ ARROW — dark semi-transparent circular button on the outer carousel edge,
//    vertically centered, fully visible (offsets < section padding, never clipped)
function ArrowBtn({ dir, onClick, disabled, onHover }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => onHover?.(dir)}
      onMouseLeave={() => onHover?.(null)}
      aria-label={dir === "left" ? "Previous products" : "Next products"}
      className={`absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-md text-white border border-white/25 shadow-lg w-10 h-10 sm:w-11 sm:h-11 transition-all duration-500 ease-out ${
        dir === "left"
          ? "-left-2 sm:-left-3 lg:-left-4 hover:-translate-x-0.5"
          : "-right-2 sm:-right-3 lg:-right-4 hover:translate-x-0.5"
      } ${
        disabled
          ? "opacity-30 cursor-not-allowed pointer-events-none"
          : "hover:bg-black/75 hover:scale-110 hover:shadow-xl active:scale-95"
      }`}
    >
      {dir === "left" ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
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
  // ✅ Continuous hover-scroll state (per-frame drift while hovering an arrow)
  const hoverRef = useRef(null); // { dir, vel, max }
  const rafRef = useRef(0);

  // ✅ Stop hover-scroll smoothly — brief momentum glide-out, never a hard cut
  const stopHoverScroll = () => {
    const st = hoverRef.current;
    if (!st) return;
    hoverRef.current = null;
    const glide = () => {
      st.vel *= 0.8;
      const node = scrollRef.current;
      if (st.vel < 0.12 || !node) {
        if (node) node.style.scrollBehavior = "";
        rafRef.current = 0;
        return;
      }
      node.scrollLeft += st.dir === "right" ? st.vel : -st.vel;
      rafRef.current = requestAnimationFrame(glide);
    };
    glide();
  };

  // ✅ Start hover-scroll — slow, continuous movement for as long as hovered
  const startHoverScroll = (dir) => {
    const node = scrollRef.current;
    if (!node) return;
    cancelAnimationFrame(rafRef.current);
    node.style.scrollBehavior = "auto"; // per-frame writes must be instant
    const prev = hoverRef.current;
    const card = node.querySelector("a");
    const gap = parseFloat(getComputedStyle(node).columnGap) || 16;
    const cardStep = card ? card.offsetWidth + gap : 240;
    hoverRef.current = {
      dir,
      vel: prev && prev.dir === dir ? prev.vel : 0,
      max: cardStep / 110, // ≈ one card every ~1.8s @ 60fps — slow & steady
    };
    const tick = () => {
      const st = hoverRef.current;
      const el = scrollRef.current;
      if (!st || !el) {
        rafRef.current = 0;
        return;
      }
      st.vel = Math.min(st.vel + st.max / 30, st.max); // soft ease-in
      const max = el.scrollWidth - el.clientWidth;
      const atEnd =
        st.dir === "right" ? el.scrollLeft >= max - 1 : el.scrollLeft <= 1;
      if (!atEnd) el.scrollLeft += st.dir === "right" ? st.vel : -st.vel;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

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
      cancelAnimationFrame(rafRef.current);
    };
  }, [products]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    stopHoverScroll(); // click takes over from hover scrolling
    const card = el.querySelector("a");
    // ✅ Move 2 products per click (card width + flex gap, doubled)
    const gap = parseFloat(getComputedStyle(el).columnGap) || 16;
    const step = card ? (card.offsetWidth + gap) * 2 : 480;
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  if (!products || products.length === 0) return null;

  return (
    <section className="max-w-[1400px] mx-auto px-4 lg:px-6">
      {/* HEADER — title left */}
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
      </div>

      {/* PRODUCTS ROW — horizontal slide + side arrows */}
      <div className="relative">
        <ArrowBtn
          dir="left"
          onClick={() => scroll("left")}
          disabled={!canLeft}
          onHover={(d) => (d ? startHoverScroll(d) : stopHoverScroll())}
        />
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
        <ArrowBtn
          dir="right"
          onClick={() => scroll("right")}
          disabled={!canRight}
          onHover={(d) => (d ? startHoverScroll(d) : stopHoverScroll())}
        />
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