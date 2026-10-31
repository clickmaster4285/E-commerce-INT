"use client";

import FallbackImage from "@/components/common/FallbackImage";
/* ==========================================================
   POPULAR CATEGORIES — real category cards
   Har card me:
     - category ka real product image (us category ke kisi product se)
   ========================================================== */

import Link from "next/link";

import { smartImageLoader } from "@/utils/smartImageLoader";
import { ArrowRight } from "lucide-react";
import SectionHeading from "./SectionHeading";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";

const LIMIT = 12;

export default function PopularCategories({ tiles = [], isLoading = false }) {
  const { t } = useTranslation();
  const { fieldOf } = useLocalized();
  // ✅ Tiles server se (image) — full catalog nahi
  const list = (tiles || []).slice(0, LIMIT);

  if (isLoading && !list.length) {
    return (
      <section>
        <div className="mb-3.5 h-5 w-44 animate-pulse rounded-full bg-[var(--user-bg-card)]" />
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 4xl:grid-cols-8 5xl:grid-cols-9">
          {[...Array(8).keys()].map((index) => (
            <div
              key={index}
              className="h-[10.5rem] animate-pulse rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!list.length) return null;

  return (
    <section>
      <SectionHeading
        title={t("admin.categories.page.title")}
        href="/filtering-product?allCategories=1"
        linkLabel={t("admin.dashboard.topProducts.viewAll")}
      />

      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-6 4xl:grid-cols-8 5xl:grid-cols-9">
        {list.map((category) => (
          <Link
            key={category._id}
            href={`/filtering-product?category=${category._id}`}
            className="group flex flex-col overflow-hidden rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--user-accent-soft)] hover:shadow-[var(--user-shadow-sm)]"
          >
            <span className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-[var(--user-bg-hover)]">
              <FallbackImage nextImage
                src={category.image}
                alt={fieldOf(category, "name")}
                fill
                loader={smartImageLoader}
                sizes="(max-width: 640px) 50vw, 33vw"
                className="object-cover transition duration-500 group-hover:scale-105"
              />
            </span>

            <span className="flex flex-1 flex-col gap-1 px-3 py-2.5">
              <span className="w-full line-clamp-2 break-words text-xs font-medium capitalize text-[var(--user-text)] sm:text-[0.8125rem]">
                {fieldOf(category, "name")}
              </span>
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-3 flex justify-center lg:hidden">
        <Link
          href="/filtering-product?allCategories=1"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--user-border)] px-4 py-2 text-[0.6875rem] font-medium text-[var(--user-text-secondary)] transition-colors hover:text-[var(--user-accent)]"
        >
          {t("admin.dashboard.topProducts.viewAll")}
          <ArrowRight size={13} />
        </Link>
      </div>
    </section>
  );
}
