"use client";

/* ==========================================================
   HOME CATEGORIES — hero ke neeche wali category icon tiles row

   - Ek waqt me 7 categories (desktop), mobile par 3, tablet par 4.
   - Row ke LEFT aur RIGHT side par arrow buttons — click karne par
     categories EK-EK karke aage/peeche slide hoti hain.
   - Jis taraf koi category na ho us taraf ka arrow HIDE rehta hai.
   ========================================================== */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import CategoryIcon from "./CategoryIcon";
import SectionHeading from "./SectionHeading";
import SlideArrow from "./SlideArrow";


/* Ek waqt me kitni tiles nazar aayen — screen size ke hisaab se
   (desktop par 7, tablet par 4, mobile par 3) */
function useVisibleCount() {
  const get = () => {
    if (typeof window === "undefined") return 7;
    if (window.matchMedia("(min-width: 1024px)").matches) return 7;
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

export default function HomeCategories({ tiles = [], totalProducts = 0, isLoading = false }) {
  const [start, setStart] = useState(0);
  const visibleCount = useVisibleCount();

  // ✅ Tiles server se (count order me) — full catalog nahi
  const allTiles = useMemo(() => [...(tiles || [])], [tiles]);

  const maxStart = Math.max(0, allTiles.length - visibleCount);
  const safeStart = Math.min(start, maxStart);
  const visibleTiles = allTiles.slice(safeStart, safeStart + visibleCount);
  const canSlide = allTiles.length > visibleCount;

  /* Ek-ek karke aage/peeche */
  const handlePrev = () => setStart((s) => Math.max(0, Math.min(s, maxStart) - 1));
  const handleNext = () => setStart((s) => Math.min(maxStart, Math.min(s, maxStart) + 1));

  if (isLoading && !allTiles.length) {
    return (
      <section>
        <div className="mb-3.5">
          <div className="h-5 w-40 animate-pulse rounded-full bg-[var(--user-bg-card)]" />
        </div>
        <div className="grid w-full grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          {[...Array(7).keys()].map((i) => (
            <div key={i} className="h-[5.75rem] animate-pulse rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]" />
          ))}
        </div>
      </section>
    );
  }

  if (!allTiles.length) return null;

  return (
    <section>
      <style>{`
        @keyframes catSlideIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="mb-3.5">
        <SectionHeading title="Shop by Category" subtitle={`${allTiles.length} categories · ${totalProducts} products`} />
      </div>

      <div className="relative w-full">
        <div
          key={safeStart}
          style={{ animation: "catSlideIn 0.25s ease-out" }}
          className="grid w-full grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-7"
        >
          {visibleTiles.map((category) => (
            <Link
              key={category._id}
              href={`/?category=${category._id}`}
              title={`${category.name} — ${category.count} products`}
              className="group flex flex-col items-center gap-2 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-1.5 py-3 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--user-accent)] hover:bg-[var(--user-bg-hover)] hover:shadow-[var(--user-shadow-md)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--user-bg-hover)] text-[var(--user-accent)] transition-colors group-hover:bg-[var(--user-accent-soft)]">
                <CategoryIcon name={category.name} size={20} />
              </span>
              <span className="line-clamp-2 w-full break-words text-[0.6875rem] font-semibold capitalize leading-tight text-[var(--user-text-secondary)]">
                {category.name}
              </span>
            </Link>
          ))}
        </div>

        {/* Floating arrows (Deals style) — jis taraf kuch na ho hide */}
        {canSlide && safeStart > 0 ? (
          <SlideArrow dir="left" onClick={handlePrev} label="Previous categories" />
        ) : null}
        {canSlide && safeStart < maxStart ? (
          <SlideArrow dir="right" onClick={handleNext} label="Next categories" />
        ) : null}
      </div>
    </section>
  );
}
