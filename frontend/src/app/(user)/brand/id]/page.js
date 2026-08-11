"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/apis/productApi";
import { brandApi } from "@/apis/brandApi";
import ProductCard from "@/app/Component/user/ProductCard";
import { ChevronRight, Package } from "lucide-react";

export default function BrandPage({ params }) {
  const { id } = use(params);

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: brandApi.getAll,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
  });

 const brand = brands.find(
  (b) =>
    b._id === id ||
    b.name?.toLowerCase().replace(/\s+/g, "-") === String(id).toLowerCase()
);

  const filtered = products.filter(
    (p) => (p.brand_id?._id || p.brand_id) === brand?._id
  );

  return (
    <main className="max-w-[1400px] mx-auto px-5 py-10">
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-8">
        <Link href="/" className="hover:text-[#d4af37]">Home</Link>
        <ChevronRight size={14} />
        <span className="text-[#d4af37]">{brand?.name || "Brand"}</span>
      </div>

      <div className="mb-7">
        <h1 className="text-3xl font-black text-white uppercase">{brand?.name || "Brand"}</h1>
        <p className="text-xs text-gray-400 mt-1">{filtered.length} products found</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-96 rounded-2xl bg-[#071b12] animate-pulse" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {filtered.map((p) => (
            <ProductCard key={p._id} product={p} />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center">
          <Package size={56} className="mx-auto text-[#d4af37] mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">No products found</h2>
          <p className="text-gray-400 text-sm">Check back soon for new arrivals.</p>
        </div>
      )}
    </main>
  );
}