"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CategoryShowcase, BrandShowcase } from "../../components/user/Showcase";
import CategoryBar from "../../components/user/CategoryBar";
import BrandSection from "../../components/user/BrandSection";
import BannerSlider from "../../components/user/BannerSlider";
import DealsSection from "../../components/user/DealsSection";
import { categoryApi } from "@/apis/user/categoryApi";
import {
  Smartphone, Laptop, Watch, Headphones, Camera, Percent,
  FolderOpen, Tv, Gamepad2, ShoppingBag, Shirt,
} from "lucide-react";

const getCatIcon = (name) => {
  if (!name) return <FolderOpen size={20} />;
  const n = name.toLowerCase();
  if (n.includes("mobile") || n.includes("phone")) return <Smartphone size={20} />;
  if (n.includes("laptop") || n.includes("computer")) return <Laptop size={20} />;
  if (n.includes("watch")) return <Watch size={20} />;
  if (n.includes("headphone") || n.includes("earbud") || n.includes("audio")) return <Headphones size={20} />;
  if (n.includes("camera") || n.includes("photo")) return <Camera size={20} />;
  if (n.includes("deal") || n.includes("discount") || n.includes("offer")) return <Percent size={20} />;
  if (n.includes("tv") || n.includes("monitor")) return <Tv size={20} />;
  if (n.includes("game")) return <Gamepad2 size={20} />;
  if (n.includes("cloth") || n.includes("fashion")) return <Shirt size={20} />;
  if (n.includes("accessor")) return <ShoppingBag size={20} />;
  return <FolderOpen size={20} />;
};

/* ============ ✅ MOBILE-ONLY: Daraz-style category icon strip ============ */
function MobileCategoryStrip() {
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: categoryApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  // ✅ Client-side slice for display only; endpoint has no server pagination yet
  const categoriesSlice = categories.slice(0, 12);
  if (!categoriesSlice.length) return null;

  return (
    <div className="md:hidden px-3 pt-3 pb-1">
      <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
        {categoriesSlice.map((c) => (
          <Link key={c._id} href={`/category/${c._id}`} className="flex flex-col items-center gap-1.5 shrink-0 w-16 active:scale-95 transition">
            <span className="w-14 h-14 rounded-2xl bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center text-[var(--user-accent)] shadow-sm">
              {getCatIcon(c.name)}
            </span>
            <span className="text-[10px] font-semibold text-[var(--user-text-secondary)] truncate w-full text-center capitalize">
              {c.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen text-[var(--user-text)]">
      {/* ✅ BANNER SLIDER */}
      <BannerSlider />

      {/* ✅ MOBILE-ONLY category strip (Daraz style) */}
      <MobileCategoryStrip />

      {/* ✅ DEALS SECTION */}
      <DealsSection />

      {/* ✅ TOP 3 CATEGORIES */}
      <CategoryShowcase />

      {/* ✅ ALL CATEGORIES marquee */}
      <CategoryBar />

      {/* ✅ TOP 3 BRANDS */}
      <BrandShowcase />

      {/* ✅ ALL BRANDS marquee */}
      <BrandSection />
    </main>
  );
}