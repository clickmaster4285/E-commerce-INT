"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Flame, ArrowRight, Clock, Tag } from "lucide-react";
import { dealApi } from "@/apis/user/dealApi";

function calcTime(endDate) {
  const diff = new Date(endDate) - new Date();
  if (diff <= 0) return { d: 0, h: 0, expired: true };
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff / 3600000) % 24),
    expired: false,
  };
}

export default function AllDealsPage() {
  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["activeDeals"],
    queryFn: dealApi.getActive,
  });

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-20 text-center">
        <div className="animate-pulse">
          <div className="h-10 w-64 bg-[var(--user-bg-card)] rounded-lg mx-auto mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-[var(--user-bg-card)] rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-[1400px] mx-auto px-3 lg:px-6 py-5 lg:py-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 lg:mb-10">
        <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-xl">
          <Flame size={24} className="text-white lg:w-7 lg:h-7" />
        </div>
        <div>
          <h1 className="text-xl lg:text-4xl font-black text-[var(--user-text)]">
            All Hot Deals
          </h1>
          <p className="text-xs lg:text-sm text-[var(--user-text-muted)] mt-0.5">
            {deals.length} active deals — grab them before they expire!
          </p>
        </div>
      </div>

      {/* Deals Grid */}
      {deals.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mx-auto mb-4">
            <Tag size={32} className="text-[var(--user-text-subtle)]" />
          </div>
          <h2 className="text-xl font-bold text-[var(--user-text)] mb-2">No active deals</h2>
          <p className="text-sm text-[var(--user-text-muted)]">Check back soon for exciting offers!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6">
          {deals.map((deal) => {
            const time = calcTime(deal.endDate);
            const badgeText = deal.type === "percentage" 
              ? `${deal.discountValue}% OFF` 
              : `Rs. ${deal.discountValue} OFF`;

            return (
              <Link
                key={deal._id}
                href={`/deals/${deal._id}`}
                className="group relative rounded-2xl border-2 border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 lg:p-6 hover:border-orange-500/50 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
              >
                {/* Badge */}
                <div className="absolute top-2 right-2 lg:top-4 lg:right-4 bg-gradient-to-r from-red-500 to-orange-600 text-white px-2 lg:px-3 py-1 lg:py-1.5 rounded-lg font-black text-[10px] lg:text-xs uppercase shadow-lg">
                  {badgeText}
                </div>

                {/* Icon */}
                <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-xl bg-gradient-to-br from-orange-500/10 to-red-500/10 flex items-center justify-center mb-3 lg:mb-4">
                  <Flame size={24} className="text-orange-500 lg:w-8 lg:h-8" />
                </div>

                {/* Title */}
                <h3 className="text-sm lg:text-xl font-black text-[var(--user-text)] mb-1.5 lg:mb-2 pr-16">
                  {deal.name}
                </h3>

                {/* Description */}
                <p className="text-xs lg:text-sm text-[var(--user-text-muted)] mb-3 lg:mb-4 line-clamp-2">
                  {deal.description}
                </p>
                {/* Timer */}
                {!time.expired && (
                  <div className="flex items-center gap-1.5 mb-3 lg:mb-4">
                    <Clock size={12} className="text-orange-500 lg:w-[14px] lg:h-[14px]" />
                    <span className="text-[10px] lg:text-xs font-bold">
                      {time.d}d {time.h}h remaining
                    </span>
                  </div>
                )}

                {/* CTA */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] lg:text-xs font-bold text-orange-600 uppercase tracking-wider line-clamp-1">
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
                    className="text-[var(--user-text-muted)] group-hover:text-orange-500 group-hover:translate-x-1 transition-all lg:w-[18px] lg:h-[18px]"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}