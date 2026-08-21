"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { categoryApi } from "@/apis/categoryApi";
import { Package } from "lucide-react";

export default function CategoryBar() {
  // ✅ Real categories database se
  const { data: categories = [], isLoading, isError } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <section className="px-4 lg:px-6 py-6 lg:py-8">
      <div className="max-w-[1400px] mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-4 lg:mb-5">
          <h2 className="text-[var(--user-text)] font-bold text-base lg:text-lg">
            Shop By Category
          </h2>
        </div>

        {/* LOADING — Skeleton */}
        {isLoading && (
          <div className="flex gap-3 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="w-[140px] sm:w-[180px] shrink-0 bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-xl min-h-[90px] animate-pulse"
              />
            ))}
          </div>
        )}

        {/* ERROR */}
        {isError && (
          <div className="text-center py-8 text-[var(--user-text-muted)] text-sm">
            Categories are unavailable right now.
          </div>
        )}

        {/* ✅ AUTO-SCROLL MARQUEE — no scrollbar, seamless loop */}
        {!isLoading && !isError && categories.length > 0 && (
          <div className="relative">
            {/* Edge fades (left/right soft gradient) */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 lg:w-20 bg-gradient-to-r from-[var(--user-bg)] to-transparent z-10" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 lg:w-20 bg-gradient-to-l from-[var(--user-bg)] to-transparent z-10" />

            {/* Marquee container */}
            <div className="marquee overflow-hidden py-2">
              <div className="marquee-track flex w-max">
                {/* ✅ List 2x duplicate = seamless loop */}
                {[...categories, ...categories].map((category, i) => (
                  <Link
                    key={`${category._id}-${i}`}
                    href={`/category/${category._id}`}
                    className="mr-3 w-[140px] sm:w-[180px] shrink-0 bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-xl px-3 py-6 flex items-center justify-center min-h-[90px] hover:border-[var(--user-accent)] hover:bg-[var(--user-bg-hover)] transition-colors duration-300"
                  >
                    <p className="text-[var(--user-accent)] font-extrabold text-xs sm:text-sm uppercase tracking-wider text-center leading-relaxed">
                      {category.name}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* EMPTY */}
        {!isLoading && !isError && categories.length === 0 && (
          <div className="text-center py-8 text-[var(--user-text-subtle)] text-sm">
            <Package size={32} className="mx-auto mb-2 opacity-50" />
            No categories available yet.
          </div>
        )}
      </div>
    </section>
  );
}