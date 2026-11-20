"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "./Button";

/** "Showing 1–20 of 134" + prev/next. Sirf tab render karo jab pages > 1 ya total > pageSize. */
export default function Pagination({ page, pages, total, pageSize, onChange, itemLabel = "results" }) {
  if (!total || pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] px-5 py-3">
      <p className="text-[12.5px] text-[var(--text-muted)]">
        Showing <span className="font-semibold tabular-nums text-[var(--text-primary)]">{from}–{to}</span> of{" "}
        <span className="font-semibold tabular-nums text-[var(--text-primary)]">{total}</span> {itemLabel}
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <IconButton icon={ChevronLeft} label="Previous page" variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(Math.max(1, page - 1))} className="rtl:[&>svg]:rotate-180" />
        <span className="px-2 text-[12.5px] font-semibold tabular-nums text-[var(--text-secondary)]">
          {page} <span className="font-normal text-[var(--text-muted)]">/ {pages}</span>
        </span>
        <IconButton icon={ChevronRight} label="Next page" variant="outline" size="sm" disabled={page >= pages} onClick={() => onChange(Math.min(pages, page + 1))} className="rtl:[&>svg]:rotate-180" />
      </nav>
    </div>
  );
}
