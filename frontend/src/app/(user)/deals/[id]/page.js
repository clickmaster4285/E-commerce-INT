"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Flame, Tag, Package, Zap, ChevronLeft, ChevronRight } from "lucide-react";
import { dealApi } from "@/apis/user/dealApi";
import { productApi } from "@/apis/user/productApi";
import ProductCard from "@/components/user/ProductCard";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const getImageUrl = (img) => {
  if (!img) return null;
  if (img.startsWith("http")) return img;
  return `${API_ORIGIN}${img.startsWith("/") ? "" : "/"}${img}`;
};

function useCountdown(endDate) {
  const [time, setTime] = useState(() => calcTime(endDate));
  useEffect(() => {
    const timer = setInterval(() => setTime(calcTime(endDate)), 1000);
    return () => clearInterval(timer);
  }, [endDate]);
  return time;
}

function calcTime(endDate) {
  const diff = new Date(endDate) - new Date();
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, expired: true };
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff / 3600000) % 24),
    m: Math.floor((diff / 60000) % 60),
    s: Math.floor((diff / 1000) % 60),
    expired: false,
  };
}

function TimeBox({ value, label }) {
  return (
    <div className="flex-1 bg-[var(--user-bg-card)] border-2 border-orange-500/30 rounded-xl p-3 text-center shadow-lg">
      <p className="text-2xl font-black text-[var(--user-text)] tabular-nums leading-none">
        {String(value).padStart(2, "0")}
      </p>
      <p className="text-[10px] font-bold text-[var(--user-text-subtle)] uppercase mt-1">{label}</p>
    </div>
  );
}

export default function DealDetailPage({ params }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get("page")) || 1;
  const limit = 20;

  const { data: deal, isLoading } = useQuery({
    queryKey: ["deal", id, currentPage],
    queryFn: () => dealApi.getById(id, currentPage, limit),
  });

  // ✅ Full product data (variants/images/prices + populated brand) — same source as main page
  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  const time = useCountdown(deal?.endDate);

  if (isLoading) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 py-20 text-center">
        <div className="animate-pulse space-y-8">
          <div className="h-96 bg-[var(--user-bg-card)] rounded-2xl" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-80 bg-[var(--user-bg-card)] rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="max-w-[600px] mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <Flame size={32} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-black text-[var(--user-text)] mb-2">Deal Not Found</h1>
        <Link href="/deals" className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition">
          <ArrowLeft size={16} /> Back to All Deals
        </Link>
      </div>
    );
  }

  const rawProducts = deal.resolvedProducts || deal.productIds || [];
  const allProductsById = new Map(allProducts.map((p) => [p._id, p]));
  const products = rawProducts.map((p) => allProductsById.get(p._id) || p);
  const totalPages = deal.totalPages || 1;
  const badgeText = deal.type === "percentage" ? `${deal.discountValue}% OFF` : `Rs. ${deal.discountValue} OFF`;

  const imgUrl = getImageUrl(deal.image) || getImageUrl(products[0]?.images?.[0]?.img_url) || getImageUrl(products[0]?.images?.[0]);
  
  const dealVisual = {
    percentage: { color: "from-green-500 to-emerald-600", icon: Tag, label: "Percentage Off" },
    fixed_amount: { color: "from-blue-500 to-cyan-600", icon: Tag, label: "Fixed Amount Off" },
    buy_x_get_y: { color: "from-purple-500 to-pink-600", icon: Package, label: "Buy X Get Y" },
    bundle: { color: "from-indigo-500 to-purple-600", icon: Package, label: "Bundle Deal" },
    free_shipping: { color: "from-orange-500 to-red-600", icon: Zap, label: "Free Shipping" },
    flash_sale: { color: "from-yellow-500 to-orange-600", icon: Flame, label: "Flash Sale" },
  };
  const visual = dealVisual[deal.type] || { color: "from-orange-500 to-red-600", icon: Tag, label: "Deal" };
  const Icon = visual.icon;

  return (
    <main className="max-w-[1400px] mx-auto px-4 py-8 lg:py-12">
      <Link href="/deals" className="inline-flex items-center gap-2 text-sm font-bold text-[var(--user-text-muted)] hover:text-[var(--user-accent)] mb-8 transition">
        <ArrowLeft size={16} /> Back to All Deals
      </Link>

      {/* Deal Header Card */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-orange-500/10 via-red-500/5 to-pink-500/10 border-2 border-orange-500/30 shadow-2xl mb-10">
        <div className="grid md:grid-cols-2 gap-0">
          <div className="relative aspect-[4/3] md:aspect-auto block overflow-hidden">
            {imgUrl ? (
              <img src={imgUrl} alt={deal.name} className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full bg-gradient-to-br ${visual.color} flex flex-col items-center justify-center p-6`}>
                <div className="relative z-10 w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 border-2 border-white/30">
                  <Icon size={48} className="text-white" />
                </div>
                <div className="relative z-10 text-center">
                  <p className="text-4xl sm:text-5xl font-black text-white drop-shadow-lg">{badgeText}</p>
                  <p className="text-xs sm:text-sm text-white/80 font-bold uppercase tracking-wider mt-2">{visual.label}</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 sm:p-10 flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className={`inline-flex items-center gap-1 bg-gradient-to-r ${visual.color} text-white px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider shadow-lg`}>
                <Icon size={12} /> {deal.type.replace(/_/g, " ")}
              </span>
              {deal.isFeatured && (
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 bg-orange-500/10 border-2 border-orange-500/30 px-3 py-1 rounded-full flex items-center gap-1">
                  <Flame size={10} /> Featured
                </span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-[var(--user-text)] mb-4 leading-tight">{deal.name}</h1>
            {deal.description && <p className="text-base text-[var(--user-text-muted)] mb-6">{deal.description}</p>}

            {!time.expired ? (
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock size={18} className="text-orange-500" />
                  <span className="text-sm font-bold text-[var(--user-text)]">Ends in:</span>
                </div>
                <div className="flex gap-3">
                  <TimeBox value={time.d} label="Days" />
                  <TimeBox value={time.h} label="Hours" />
                  <TimeBox value={time.m} label="Mins" />
                  <TimeBox value={time.s} label="Secs" />
                </div>
              </div>
            ) : (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border-2 border-red-500/30">
                <p className="text-sm font-bold text-red-600 flex items-center gap-2"><Flame size={16} /> This deal has expired</p>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm">
              <Package size={16} className="text-[var(--user-accent)]" />
              <span className="font-bold text-[var(--user-text)]">{deal.totalProducts} total products in this deal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Products Grid with Pagination */}
      <div>
        <h2 className="text-2xl font-black text-[var(--user-text)] mb-6 flex items-center gap-2">
          Products in this Deal
          <span className="text-sm my-4 font-normal text-[var(--user-text-muted)]">
            (Page {currentPage} of {totalPages})
          </span>
        </h2>

        {products.length > 0 ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
             {products.map((product) => (
  <ProductCard 
    key={product._id} 
    product={product} 
    deal={deal} 
  />
))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Link
                  href={`/deals/${id}?page=${currentPage - 1}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)] text-sm font-bold transition ${
                    currentPage === 1 ? "opacity-50 cursor-not-allowed pointer-events-none" : "hover:border-orange-500/50 hover:text-orange-500"
                  }`}
                >
                  <ChevronLeft size={16} /> Previous
                </Link>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <Link
                      key={pageNum}
                      href={`/deals/${id}?page=${pageNum}`}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-bold transition ${
                        currentPage === pageNum
                          ? "bg-orange-500 text-white shadow-lg"
                          : "bg-[var(--user-bg-card)] border border-[var(--user-border)] text-[var(--user-text)] hover:border-orange-500/50"
                      }`}
                    >
                      {pageNum}
                    </Link>
                  ))}
                </div>

                <Link
                  href={`/deals/${id}?page=${currentPage + 1}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)] text-sm font-bold transition ${
                    currentPage === totalPages ? "opacity-50 cursor-not-allowed pointer-events-none" : "hover:border-orange-500/50 hover:text-orange-500"
                  }`}
                >
                  Next <ChevronRight size={16} />
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 rounded-2xl border-2 border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)]">
            <Package size={48} className="text-[var(--user-text-subtle)] mx-auto mb-4" />
            <p className="text-lg font-bold text-[var(--user-text)] mb-2">No products yet</p>
            <p className="text-sm text-[var(--user-text-muted)]">Products will be added to this deal soon.</p>
          </div>
        )}
      </div>
    </main>
  );
}