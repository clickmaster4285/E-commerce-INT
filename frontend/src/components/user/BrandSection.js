"use client";

import FallbackImage from "@/components/common/FallbackImage";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { brandApi } from "@/apis/user/brandApi";
import { Package } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

export default function BrandSection() {
  const { t, dir } = useTranslation();
  const { fieldOf } = useLocalized();
  // ✅ Real brands database se
  // ✅ Client-side slice for display only; endpoint has no server pagination ye
  const { data: brandsRaw = [], isLoading, isError } = useQuery({
    queryKey: ["brands"],
    queryFn: brandApi.getAll,
    staleTime: 5 * 60 * 1000,
  });
  const brands = brandsRaw.slice(0, 12);

  // ✅ Logo URL helper
  const getLogoUrl = (logo) => {
    const raw = typeof logo === "string" ? logo : logo?.img_url;
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${API_ORIGIN}${path}`;
  };

  return (
    <section className="px-3 lg:px-6 py-5 lg:py-12" dir={dir}>
      <div className="user-shell mx-auto">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-4 lg:mb-5">
          <h2 className="text-user-fg font-bold text-base lg:text-lg">
            {t("header.topBrands")}
          </h2>
        </div>

        {/* LOADING — Skeleton */}
        {isLoading && (
          <div className="flex gap-3 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="w-[8.75rem] sm:w-[10rem] shrink-0 bg-user-card border border-user-line rounded-xl min-h-[8.125rem] animate-pulse"
              />
            ))}
          </div>
        )}

        {/* ERROR */}
        {isError && (
          <div className="text-center py-8 text-user-fg-muted text-sm">
            {t("admin.brands.ui.loadFailed")}
          </div>
        )}

        {/* ✅ AUTO-SCROLL MARQUEE — same as categories */}
        {!isLoading && !isError && brands.length > 0 && (
          <div className="relative">
            {/* Edge fades */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 lg:w-20 bg-gradient-to-r from-user-page to-transparent z-10" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 lg:w-20 bg-gradient-to-l from-user-page to-transparent z-10" />

            {/* Marquee container */}
            <div className="marquee overflow-hidden py-2">
              <div className="marquee-track flex w-max">
                {/* ✅ List 2x duplicate = seamless loop */}
                {[...brands, ...brands].map((brand, i) => {
                  const logoUrl = getLogoUrl(brand.logo);
                  const brandName = fieldOf(brand, "name") || brand.name;

                  return (
                    <Link
                      key={`${brand._id}-${i}`}
                      href={`/?brand=${brand._id}`}
                      className="mr-3 w-[8.75rem] sm:w-[10rem] shrink-0 bg-user-card border border-user-line rounded-xl px-4 py-5 flex flex-col items-center justify-center gap-3 min-h-[8.125rem] hover:border-user-accent hover:bg-user-hover transition-colors duration-300"
                    >
                      {/* ✅ Logo (white circle) */}
                      <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-user-line bg-user-hover p-2">
                        <FallbackImage src={logoUrl} alt={brandName} className="max-h-full max-w-full object-contain" />
                      </span>

                      {/* ✅ Brand name */}
                      <p className="text-xs text-user-fg-muted text-center capitalize line-clamp-1 w-full">
                        {brandName}
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
          <div className="text-center py-8 text-user-fg-subtle text-sm">
            <Package size={32} className="mx-auto mb-2 opacity-50" />
            {t("admin.brands.page.noBrands")}
          </div>
        )}
      </div>
    </section>
  );
}
