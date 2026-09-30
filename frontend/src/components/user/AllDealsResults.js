"use client";

/* ==========================================================
   ALL DEALS RESULTS — sidebar me "All Deals" click par main
   column ke TOP par aane wala deals panel.

   - Purani /deals page wale deal cards (wahi design): badge,
     timer, applyTo info, click → wahin us deal ke products
     filter ho kar show hote hain (koi detail page nahi khulta).
   - 10 cards per page + client-side pagination (PaginationBar),
     koi navigation nahi — next page click par agle 10 cards.
   ========================================================== */

import { useMemo, useState } from "react";
import { Clock, Flame, ArrowRight, Tag, RotateCcw } from "lucide-react";
import PaginationBar from "./PaginationBar";
import SectionHeading from "./SectionHeading";

const PER_PAGE = 10;

function calcTime(endDate) {
  const diff = new Date(endDate) - new Date();
  if (diff <= 0) return { d: 0, h: 0, expired: true };
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff / 3600000) % 24),
    expired: false,
  };
}

function dealBadge(deal) {
  if (deal?.type === "percentage") return `${deal.discountValue}% OFF`;
  if (deal?.type === "fixed_amount") return `Rs. ${deal.discountValue} OFF`;
  if (deal?.type === "buy_x_get_y") {
    const b = deal.buyQuantity || 0;
    const g = deal.getQuantity || 0;
    return b > 0 && g > 0 ? `Buy ${b} Get ${g}` : "Buy X Get Y";
  }
  if (deal?.type === "bundle") return "Bundle Deal";
  if (deal?.type === "free_shipping") return "Free Shipping";
  return String(deal?.type || "Deal").replace(/_/g, " ").toUpperCase();
}

export default function AllDealsResults({ deals = [], isLoading = false, onClear, onSelectDeal }) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(deals.length / PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => deals.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE),
    [deals, currentPage],
  );

  if (isLoading && !deals.length) {
    return (
      <section aria-label="All deals">
        <SectionHeading title="All Deals" subtitle="Loading deals…" icon={Flame} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(10).keys()].map((index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]"
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="All deals"
      className="rounded-2xl border border-[var(--user-accent)]/30 bg-[var(--user-bg-card)]/60 p-3 sm:p-4"
    >
      <SectionHeading
        title="All Deals"
        subtitle={`${deals.length} ${deals.length === 1 ? "deal" : "deals"} — click a card to see its products`}
        icon={Flame}
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

      {deals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-12 text-center">
          <Tag size={30} className="text-[var(--user-text-subtle)]" />
          <p className="text-sm font-bold text-[var(--user-text)]">No active deals</p>
          <p className="text-[0.6875rem] text-[var(--user-text-muted)]">Check back soon for exciting offers!</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {pageItems.map((deal) => {
              const time = calcTime(deal.endDate);
              return (
                <button
                  key={deal._id}
                  type="button"
                  onClick={() => onSelectDeal?.(deal)}
                  title={deal.name || "Deal"}
                  className="group relative rounded-2xl border-2 border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 text-left hover:border-orange-500/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="absolute top-2 right-2 bg-gradient-to-r from-red-500 to-orange-600 text-white px-2 py-1 rounded-lg font-black text-[0.625rem] uppercase shadow-lg">
                    {dealBadge(deal)}
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 flex items-center justify-center mb-3">
                    <Flame size={24} className="text-orange-500" />
                  </div>
                  <h3 className="text-sm font-black text-[var(--user-text)] mb-1.5 pr-16">
                    {deal.name}
                  </h3>
                  <p className="text-xs text-[var(--user-text-muted)] mb-3 line-clamp-2">
                    {deal.description}
                  </p>
                  {!time.expired && (
                    <div className="flex items-center gap-1.5 mb-3">
                      <Clock size={12} className="text-orange-500" />
                      <span className="text-[0.625rem] font-bold">
                        {time.d}d {time.h}h remaining
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[0.625rem] font-bold text-orange-600 uppercase tracking-wider line-clamp-1">
                      {deal.applyTo === "all"
                        ? "All Products"
                        : deal.applyTo === "category"
                          ? "Category"
                          : deal.applyTo === "brand"
                            ? "Brand"
                            : `${deal.productIds?.length || 0} Products`}
                    </span>
                    <ArrowRight
                      size={16}
                      className="text-[var(--user-text-muted)] group-hover:text-orange-500 group-hover:translate-x-1 transition-all"
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <PaginationBar
            page={currentPage}
            totalPages={totalPages}
            total={deals.length}
            perPage={PER_PAGE}
            itemLabel="deals"
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
