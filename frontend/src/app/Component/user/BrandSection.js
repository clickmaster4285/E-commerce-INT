"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { brandApi } from "@/apis/brandApi";
import { Package } from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

export default function BrandSection() {
  // ✅ Real brands database se
  const { data: brands = [], isLoading, isError } = useQuery({
    queryKey: ["brands"],
    queryFn: brandApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Logo URL helper
  const getLogoUrl = (logo) => {
    const raw = typeof logo === "string" ? logo : logo?.img_url;
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${API_ORIGIN}${path}`;
  };

  return (
    <section className="px-4 lg:px-6 py-8 lg:py-12">
      <div className="max-w-[1400px] mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-4 lg:mb-5">
          <h2 className="text-[var(--user-text)] font-bold text-base lg:text-lg">
            Top Brands
          </h2>
        </div>

        {/* LOADING — Skeleton */}
        {isLoading && (
          <div className="flex gap-3 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="w-[140px] sm:w-[160px] shrink-0 bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-xl min-h-[130px] animate-pulse"
              />
            ))}
          </div>
        )}

        {/* ERROR */}
        {isError && (
          <div className="text-center py-8 text-[var(--user-text-muted)] text-sm">
            Brands are unavailable right now.
          </div>
        )}

        {/* ✅ AUTO-SCROLL MARQUEE — same as categories */}
        {!isLoading && !isError && brands.length > 0 && (
          <div className="relative">
            {/* Edge fades */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 lg:w-20 bg-gradient-to-r from-[var(--user-bg)] to-transparent z-10" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 lg:w-20 bg-gradient-to-l from-[var(--user-bg)] to-transparent z-10" />

            {/* Marquee container */}
            <div className="marquee overflow-hidden py-2">
              <div className="marquee-track flex w-max">
                {/* ✅ List 2x duplicate = seamless loop */}
                {[...brands, ...brands].map((brand, i) => {
                  const logoUrl = getLogoUrl(brand.logo);

                  return (
                    <Link
                      key={`${brand._id}-${i}`}
                      href={`/brand/${brand._id}`}
                      className="mr-3 w-[140px] sm:w-[160px] shrink-0 bg-[var(--user-bg-card)] border border-[var(--user-border)] rounded-xl px-4 py-5 flex flex-col items-center justify-center gap-3 min-h-[130px] hover:border-[var(--user-accent)] hover:bg-[var(--user-bg-hover)] transition-colors duration-300"
                    >
                      {/* ✅ Logo (white circle) */}
                      {logoUrl ? (
                        <div className="w-14 h-14 rounded-full bg-[var(--user-text)] flex items-center justify-center p-2">
                          <img
                            src={logoUrl}
                            alt={brand.name}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-[var(--user-bg-hover)] border border-[var(--user-border)] flex items-center justify-center">
                          <span className="text-2xl font-black text-[var(--user-accent)]">
                            {brand.name?.charAt(0)}
                          </span>
                        </div>
                      )}

                      {/* ✅ Brand name */}
                      <p className="text-xs text-[var(--user-text-muted)] text-center capitalize line-clamp-1 w-full">
                        {brand.name}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* EMPTY */}
        {!isLoading && !isError && brands.length === 0 && (
          <div className="text-center py-8 text-[var(--user-text-subtle)] text-sm">
            <Package size={32} className="mx-auto mb-2 opacity-50" />
            No brands available yet.
          </div>
        )}
      </div>
    </section>
  );
}