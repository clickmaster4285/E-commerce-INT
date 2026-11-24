"use client";

/* ==========================================================
   PAGINATION BAR — client-side pagination controls

   Ye pure client-side hai: page number click karne par koi route
   navigation nahi hoti aur URL change nahi hota — parent sirf
   apna current page state badalta hai, isliye pehle 20 products
   ki jagah usi section me next 20 products render ho jate hain.

   Props:
     page, totalPages, total, perPage, onPageChange
     itemLabel  → "products" / "orders" (singular + plural auto)
     className  → optional wrapper classes
   ========================================================== */

import { ChevronLeft, ChevronRight } from "lucide-react";

const WINDOW = 2;

/* 1 … 4 5 [6] 7 8 … 20 */
export const getPageItems = (page, totalPages) => {
  if (totalPages <= 1) return [1];
  const items = [1];
  const start = Math.max(2, page - WINDOW);
  const end = Math.min(totalPages - 1, page + WINDOW);

  if (start > 2) items.push("...");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < totalPages - 1) items.push("...");
  items.push(totalPages);

  return items;
};

export default function PaginationBar({
  page = 1,
  totalPages = 1,
  total = 0,
  perPage = 20,
  onPageChange,
  itemLabel = "products",
  className = "",
}) {
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, page), totalPages);
  const rangeStart = (safePage - 1) * perPage + 1;
  const rangeEnd = Math.min(safePage * perPage, total);
  const goTo = (next) => {
    const value = Math.min(Math.max(1, next), totalPages);
    if (value !== safePage && typeof onPageChange === "function") onPageChange(value);
  };

  const arrowClass =
    "flex h-9 w-9 items-center justify-center rounded-xl border border-user-line bg-user-card text-user-fg-secondary transition-colors hover:border-user-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-user-line";

  return (
    <div className={`mt-5 flex flex-col items-center gap-3 ${className}`}>
      <p className="text-[0.6875rem] font-semibold text-user-fg-subtle">
        Showing{" "}
        <span className="text-user-fg">
          {rangeStart}–{rangeEnd}
        </span>{" "}
        of <span className="text-user-fg">{total}</span>{" "}
        {total === 1 ? itemLabel.replace(/s$/, "") : itemLabel}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <button
          type="button"
          onClick={() => goTo(safePage - 1)}
          disabled={safePage === 1}
          aria-label="Previous page"
          className={arrowClass}
        >
          <ChevronLeft size={15} />
        </button>

        {getPageItems(safePage, totalPages).map((item, index) =>
          item === "..." ? (
            <span
              key={`gap-${index}`}
              className="px-1 text-xs text-user-fg-muted"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => goTo(item)}
              aria-current={safePage === item ? "page" : undefined}
              className={`h-9 min-w-[2.25rem] rounded-xl px-2 text-[0.75rem] font-bold transition-colors ${
                safePage === item
                  ? "border border-user-accent bg-user-accent text-user-accent-fg"
                  : "border border-user-line bg-user-card text-user-fg-secondary hover:border-user-accent"
              }`}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => goTo(safePage + 1)}
          disabled={safePage === totalPages}
          aria-label="Next page"
          className={arrowClass}
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
