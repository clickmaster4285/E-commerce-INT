"use client";

import { CategoryShowcase, BrandShowcase } from "../../components/ui/user/Showcase";
import CategoryBar from "../../components/ui/user/CategoryBar";
import BrandSection from "../../components/ui/user/BrandSection";

export default function Home() {
  return (
    <main className="min-h-screen text-[var(--user-text)]">
      {/* ✅ TOP 3 CATEGORIES — product rows + arrows */}
      <CategoryShowcase />

      {/* ✅ ALL CATEGORIES — marquee */}
      <CategoryBar />

      {/* ✅ TOP 3 BRANDS — product rows + arrows */}
      <BrandShowcase />

      {/* ✅ ALL BRANDS — marquee */}
      <BrandSection />
    </main>
  );
}