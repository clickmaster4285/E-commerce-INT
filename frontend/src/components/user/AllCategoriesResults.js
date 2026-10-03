"use client";

/* ==========================================================
   ALL CATEGORIES RESULTS — nav ke "More → All Categories" par
   main column ke TOP par aane wala categories panel.

   - Neeche Popular Categories wale cards (wahi design): real image,
     "From Rs. X", count — click → wahin us category ke products
     filter ho kar show hote hain (koi alag page nahi khulta).
   - 12 cards per page + client-side pagination (PaginationBar).
   ========================================================== */

import { useMemo, useState } from "react";
import { ArrowRight, ImageOff, LayoutGrid, RotateCcw } from "lucide-react";
import PaginationBar from "./PaginationBar";
import SectionHeading from "./SectionHeading";
import { formatPrice } from "@/utils/homeCatalog";

const PER_PAGE = 12;

export default function AllCategoriesResults({
  tiles = [],
  isLoading = false,
  onClear,
  onSelectCategory,
}) {
  const [page, setPage] = useState(1);

  // ✅ Tiles server se (count + fromPrice + image) — master data, client pages
  const list = useMemo(() => [...(tiles || [])], [tiles]);

  const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => list.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE),
    [list, currentPage],
  );

  if (isLoading && !list.length) {
    return (
      <section aria-label="All categories">
        <SectionHeading title="All Categories" subtitle="Loading categories…" icon={LayoutGrid} />
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {[...Array(12).keys()].map((index) => (
            <div
              key={index}
              className="h-[10.5rem] animate-pulse rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="All categories"
      className="rounded-2xl border border-[var(--user-accent)]/30 bg-[var(--user-bg-card)]/60 p-3 sm:p-4"
    >
      <SectionHeading
        title="All Categories"
        subtitle={`${list.length} ${list.length === 1 ? "category" : "categories"} — click a card to see its products`}
        icon={LayoutGrid}
      >
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--user-border)] px-3 py-1.5 text-[0.6875rem] font-bold uppercase tracking-wider text-[var(--user-text-muted)] transition-colors hover:border-[var(--user-accent)] hover:text-[var(--user-accent)]"
        >
          <RotateCcw size={12} />
          Clear all
        </button>
      </SectionHeading>

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-12 text-center">
          <ImageOff size={30} className="text-[var(--user-text-subtle)]" />
          <p className="text-sm font-bold text-[var(--user-text)]">No categories yet</p>
          <p className="text-[0.6875rem] text-[var(--user-text-muted)]">Check back soon!</p>
        </div>
      ) : (
        <>
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {pageItems.map((category) => (
              <button
                key={category._id}
                type="button"
                onClick={() => onSelectCategory?.(category)}
                title={`${category.name} — ${category.count} products`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--user-accent)] hover:shadow-[var(--user-shadow-md)]"
              >
                <span className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-[var(--user-bg-hover)]">
                  {category.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={category.image}
                      alt={category.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <ImageOff size={26} className="text-[var(--user-text-subtle)]" />
                  )}
                </span>
                <span className="flex flex-1 flex-col gap-1 px-3 py-2.5">
                  <span className="w-full line-clamp-2 break-words text-[0.78125rem] font-bold capitalize text-[var(--user-text)]">
                    {category.name}
                  </span>
                  <span className="flex items-center justify-between gap-1 text-[0.65625rem] font-semibold">
                    <span className="truncate text-[var(--user-accent)]">
                      {category.fromPrice > 0 ? `From ${formatPrice(category.fromPrice)}` : "Explore"}
                    </span>
                    <span className="shrink-0 text-[var(--user-text-subtle)]">{category.count}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>

          <PaginationBar
            page={currentPage}
            totalPages={totalPages}
            total={list.length}
            perPage={PER_PAGE}
            itemLabel="categories"
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
