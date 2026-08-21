"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/apis/productApi";
import { brandApi } from "@/apis/brandApi";
import ProductCard from "@/components/user/ProductCard";
import { Package, ChevronRight, Star } from "lucide-react";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

export default function BrandPage() {
  const params = useParams();
  const id = params.id;

  // Brand info
  const { data: brand } = useQuery({
    queryKey: ["brand", id],
    queryFn: () => brandApi.getById(id),
    enabled: !!id,
    retry: false,
  });

  // Products of this brand
  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ["brandProducts", id],
    queryFn: () => productApi.getByBrand(id),
    enabled: !!id,
  });

  // ✅ Logo URL helper
  const getLogoUrl = (logo) => {
    const raw = typeof logo === "string" ? logo : logo?.img_url;
    if (!raw) return null;
    if (raw.startsWith("http")) return raw;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${API_ORIGIN}${path}`;
  };

  const logoUrl = getLogoUrl(brand?.logo);

  return (
    <main className="min-h-screen text-[var(--user-text)]">
      <section className="max-w-7xl mx-auto px-4 lg:px-6 py-8 lg:py-12">
        {/* BREADCRUMB */}
        <nav className="flex items-center gap-1.5 text-[11px] lg:text-xs text-[var(--user-text-muted)] mb-6 lg:mb-10 flex-wrap">
          <Link href="/" className="hover:text-[var(--user-accent)] transition">
            Home
          </Link>
         
          <ChevronRight size={12} className="text-[var(--user-text-subtle)]" />
          <span className="text-[var(--user-text-secondary)] line-clamp-1 max-w-[180px] sm:max-w-[220px]">
            {brand?.name || "Brand"}
          </span>
        </nav>

        {/* HEADER WITH LOGO */}
        <div className="mb-6 lg:mb-10">
          <div className="flex items-center gap-3 lg:gap-4 mb-3">
            {logoUrl ? (
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-[var(--user-text)] border border-[var(--user-border)] flex items-center justify-center p-2 lg:p-2.5 shrink-0">
                <img
                  src={logoUrl}
                  alt={brand?.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center shrink-0">
                <span className="text-xl lg:text-2xl font-black text-[var(--user-accent)]">
                  {brand?.name?.charAt(0) || "B"}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl lg:text-3xl xl:text-4xl font-extrabold text-[var(--user-text)] tracking-tight uppercase">
                {brand?.name || "Brand"}
              </h1>
              <p className="text-[11px] lg:text-xs text-[var(--user-text-muted)] mt-1">
                {isLoading ? (
                  "Loading products..."
                ) : (
                  <>
                    <span className="text-[var(--user-text)] font-semibold">
                      {products.length}
                    </span>{" "}
                    {products.length === 1 ? "product" : "products"} available
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* LOADING */}
        {isLoading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-2 lg:space-y-3">
                <div className="aspect-square rounded-2xl bg-[var(--user-bg-card)] animate-pulse border border-[var(--user-border)]" />
                <div className="h-3 w-3/4 bg-[var(--user-bg-card)] rounded-full animate-pulse" />
                <div className="h-3 w-1/2 bg-[var(--user-bg-card)] rounded-full animate-pulse" />
                <div className="h-4 w-1/3 bg-[var(--user-bg-card)] rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {/* ERROR */}
        {isError && (
          <div className="py-16 lg:py-24 text-center rounded-2xl bg-[var(--user-bg-card)] border border-[var(--user-border)]">
            <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-5 lg:mb-6">
              <Package size={28} className="text-[var(--user-danger)] lg:w-8 lg:h-8" />
            </div>
            <p className="text-[var(--user-text)] font-semibold mb-2 text-lg">
              We couldn't load these products.
            </p>
            <p className="text-[var(--user-text-muted)] text-sm mb-6 max-w-sm mx-auto">
              Please try again later.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:bg-[var(--user-accent-hover)] active:scale-95 transition"
            >
              Back to Home
            </Link>
          </div>
        )}

        {/* PRODUCTS */}
        {!isLoading && !isError && products.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-5">
            {products.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        )}

        {/* EMPTY */}
        {!isLoading && !isError && products.length === 0 && (
          <div className="py-16 lg:py-24 text-center rounded-2xl bg-[var(--user-bg-card)] border border-[var(--user-border)]">
            <div className="w-16 h-16 lg:w-20 lg:h-20 mx-auto rounded-full bg-[var(--user-bg-hover)] flex items-center justify-center mb-5 lg:mb-6">
              <Package size={28} className="text-[var(--user-accent)] lg:w-8 lg:h-8 opacity-60" />
            </div>
            <p className="text-[var(--user-text)] font-semibold mb-2 text-lg">
              No products available
            </p>
            <p className="text-[var(--user-text-muted)] text-sm mb-6 max-w-sm mx-auto">
              We don't have any products for this brand yet. Check back soon for new arrivals.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl text-sm font-bold hover:bg-[var(--user-accent-hover)] active:scale-95 transition"
            >
              Explore All Products
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}