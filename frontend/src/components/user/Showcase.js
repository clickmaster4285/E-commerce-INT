"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { categoryApi } from "@/apis/user/categoryApi";
import { brandApi } from "@/apis/user/brandApi";
import { productApi } from "@/apis/user/productApi";
import ProductCard from "./ProductCard";

// ✅ Helper: Extract a clean string ID from any value (string, ObjectId, or { _id: ... } object)
const getStrId = (x) => String(typeof x === "object" ? (x?._id || "") : (x || ""));

// ✅ Helper: Safe ID comparison — handles string, ObjectId, or populated { _id: ... } refs
const safeIdCompare = (a, b) => {
  const idA = getStrId(a);
  const idB = getStrId(b);
  return idA !== "" && idA === idB;
};

// ✅ ARROW — dark semi-transparent circular button on the outer carousel edge
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

// ✅ Generic product row — title + arrows + horizontal slide
function ProductRow({ title, subtitle, href, products }) {
  const scrollRef = useRef(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const hoverRef = useRef(null);
  const hoverDirRef = useRef(null);
  const rafRef = useRef(0);
  const resumeRef = useRef(0);

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

  const startHoverScroll = (dir) => {
    const node = scrollRef.current;
    if (!node) return;
    cancelAnimationFrame(rafRef.current);
    node.style.scrollBehavior = "auto";
    const prev = hoverRef.current;
    const card = node.querySelector("a");
    const gap = parseFloat(getComputedStyle(node).columnGap) || 16;
    const cardStep = card ? card.offsetWidth + gap : 240;
    hoverRef.current = {
      dir,
      vel: prev && prev.dir === dir ? prev.vel : 0,
      max: cardStep / 110,
    };
    const tick = () => {
      const st = hoverRef.current;
      const el = scrollRef.current;
      if (!st || !el) {
        rafRef.current = 0;
        return;
      }
      st.vel = Math.min(st.vel + st.max / 30, st.max);
      const max = el.scrollWidth - el.clientWidth;
      const atEnd =
        st.dir === "right" ? el.scrollLeft >= max - 1 : el.scrollLeft <= 1;
      if (!atEnd) el.scrollLeft += st.dir === "right" ? st.vel : -st.vel;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const handleHover = (dir) => {
    hoverDirRef.current = dir;
    clearTimeout(resumeRef.current);
    if (dir) startHoverScroll(dir);
    else stopHoverScroll();
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
      clearTimeout(resumeRef.current);
    };
  }, [products]);

  const scroll = (dir) => {
    const el = scrollRef.current;
    if (!el) return;

    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    hoverRef.current = null;
    el.style.scrollBehavior = "";

    const card = el.querySelector("a");
    const gap = parseFloat(getComputedStyle(el).columnGap) || 16;
    const step = card ? (card.offsetWidth + gap) * 2 : 480;
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });

    if (hoverDirRef.current) {
      clearTimeout(resumeRef.current);
      resumeRef.current = setTimeout(() => {
        if (hoverDirRef.current) startHoverScroll(hoverDirRef.current);
      }, 550);
    }
  };

  if (!products || products.length === 0) return null;

  return (
    <section className="max-w-[1400px] mx-auto px-3 lg:px-6">
      <div className="flex items-center justify-between mb-3 lg:mb-4 gap-2">
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
        <Link href={href} className="shrink-0 inline-flex items-center gap-1 text-[11px] lg:text-xs font-bold text-[var(--user-accent)] hover:opacity-80 transition">
          See all <ChevronRight size={12} />
        </Link>
      </div>

      <div className="relative">
        <ArrowBtn
          dir="left"
          onClick={() => scroll("left")}
          disabled={!canLeft}
          onHover={handleHover}
        />
        <div
          ref={scrollRef}
          className="scrollbar-hide flex gap-3 lg:gap-4 overflow-x-auto scroll-smooth pb-1"
        >
          {products.map((p) => (
            <div key={p._id} className="w-[150px] sm:w-[200px] lg:w-[230px] shrink-0">
              <ProductCard product={p} />
            </div>
          ))}
        </div>
        <ArrowBtn
          dir="right"
          onClick={() => scroll("right")}
          disabled={!canRight}
          onHover={handleHover}
        />
      </div>
    </section>
  );
}

// ==========================================
// ✅ CATEGORY SHOWCASE — Top 3 categories by product count
// Row 1 = sabse zyada products wali category
// Row 2 = dusre number wali
// Row 3 = teesre number wali
// ==========================================
export function CategoryShowcase() {
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });
  const products = allProducts;

  // ✅ POORI categories list mein se top 3 by product count
  const top = useMemo(() => {
    // Step 1: Har category ke products count karo
    const counts = {};
    products.forEach((p) => {
      const id = getStrId(p.category_id);
      if (id) counts[id] = (counts[id] || 0) + 1;
    });

    // Step 2: Poore categories mein se top 3 nikalo (zyada products wale pehle)
    const topCategories = categories
      .map((c) => ({ ...c, count: counts[getStrId(c._id)] || 0 }))
      .filter((c) => c.count > 0)          // sirf jisme products hain
      .sort((a, b) => b.count - a.count)   // descending order
      .slice(0, 3);                         // top 3

    return topCategories;
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
          products={products.filter((p) => safeIdCompare(p.category_id, cat._id))}
        />
      ))}
    </div>
  );
}

// ==========================================
// ✅ BRAND SHOWCASE — Top 3 brands by product count
// Row 1 = sabse zyada products wala brand
// Row 2 = dusre number wala
// Row 3 = teesre number wala
// ==========================================
export function BrandShowcase() {
  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: brandApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const { data: allProducts = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });
  const products = allProducts;

  // ✅ POORE brands list mein se top 3 by product count
  const top = useMemo(() => {
    // Step 1: Har brand ke products count karo
    const counts = {};
    products.forEach((p) => {
      const id = getStrId(p.brand_id);
      if (id) counts[id] = (counts[id] || 0) + 1;
    });

    // Step 2: Poore brands mein se top 3 nikalo (zyada products wale pehle)
    const topBrands = brands
      .map((b) => ({ ...b, count: counts[getStrId(b._id)] || 0 }))
      .filter((b) => b.count > 0)          // sirf jisme products hain
      .sort((a, b) => b.count - a.count)   // descending order
      .slice(0, 3);                         // top 3

    return topBrands;
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
          products={products.filter((p) => safeIdCompare(p.brand_id, brand._id))}
        />
      ))}
    </div>
  );
}