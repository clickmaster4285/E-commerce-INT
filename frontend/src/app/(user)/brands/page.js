"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search } from "lucide-react";
import FallbackImage from "@/components/common/FallbackImage";
import { brandApi } from "@/apis/user/brandApi";
import { smartImageLoader } from "@/utils/smartImageLoader";
import { imageUrl, idOf } from "@/utils/homeCatalog";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";

export default function BrandsPage() {
  const { t, dir } = useTranslation();
  const { fieldOf } = useLocalized();
  const [search, setSearch] = useState("");
  const { data: brands = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["brands"],
    queryFn: brandApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const filteredBrands = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return brands;
    return brands.filter((brand) =>
      String(fieldOf(brand, "name") || brand.name || "").toLocaleLowerCase().includes(term)
    );
  }, [brands, fieldOf, search]);

  return (
    <main dir={dir} className="min-h-[60vh] px-3 py-6 text-[var(--user-text)] sm:px-5 lg:px-6 lg:py-10">
      <div className="user-shell mx-auto">
        <nav className="mb-5 flex items-center gap-1.5 text-xs text-[var(--user-text-muted)]" aria-label="Breadcrumb">
          <Link href="/" className="transition hover:text-[var(--user-accent)]">{t("mobileNav.home")}</Link>
          <ChevronRight size={13} className={dir === "rtl" ? "rotate-180" : ""} />
          <span aria-current="page" className="text-[var(--user-text)]">{t("admin.brands.page.title")}</span>
        </nav>

        <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("admin.brands.page.title")}</h1>
            <p className="mt-1 text-sm text-[var(--user-text-muted)]">{t("header.topBrands")}</p>
          </div>
          <label className="relative block w-full sm:w-72">
            <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("admin.brands.page.searchPlaceholder")}
              aria-label={t("admin.brands.page.searchPlaceholder")}
              className="h-11 w-full rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] ps-9 pe-3 text-sm outline-none transition focus:border-[var(--user-accent)]"
            />
          </label>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]" />)}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-5 py-12 text-center">
            <p className="text-sm text-[var(--user-text-muted)]">{t("admin.brands.ui.loadFailed")}</p>
            <button type="button" onClick={() => refetch()} className="mt-3 text-sm font-semibold text-[var(--user-accent)] hover:underline">{t("common.retry")}</button>
          </div>
        ) : filteredBrands.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {filteredBrands.map((brand) => {
              const brandId = idOf(brand._id);
              const name = fieldOf(brand, "name") || brand.name || "";
              return (
                <Link
                  key={brandId}
                  href={`/brand/${brandId}`}
                  title={name}
                  className="group flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 text-center transition hover:-translate-y-0.5 hover:border-[var(--user-accent-soft)] hover:shadow-[var(--user-shadow-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
                >
                  <span className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-[var(--user-border)] bg-[var(--user-bg-hover)] p-3">
                    <FallbackImage nextImage src={imageUrl(brand.logo)} alt={name} fill loader={smartImageLoader} sizes="80px" className="object-contain" />
                  </span>
                  <span className="line-clamp-2 text-sm font-semibold text-[var(--user-text)] transition-colors group-hover:text-[var(--user-accent)]">{name}</span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] px-5 py-14 text-center text-sm text-[var(--user-text-muted)]">
            {search ? t("admin.brands.ui.noMatch") : t("admin.brands.page.noBrands")}
          </div>
        )}
      </div>
    </main>
  );
}
