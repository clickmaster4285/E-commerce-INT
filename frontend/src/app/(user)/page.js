"use client";

import { CategoryShowcase, BrandShowcase } from "../Component/user/Showcase";
import CategoryBar from "../Component/user/CategoryBar";
import BrandSection from "../Component/user/BrandSection";

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