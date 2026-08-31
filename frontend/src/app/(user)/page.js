import { CategoryShowcase, BrandShowcase } from "../../components/user/Showcase";
import CategoryBar from "../../components/user/CategoryBar";
import BrandSection from "../../components/user/BrandSection";
import BannerSlider from "../../components/user/BannerSlider";
import DealsSection from "../../components/user/DealsSection";

export default function Home() {
  return (
    <main className="min-h-screen text-[var(--user-text)]">
      {/* ✅ BANNER SLIDER — dynamic from admin */}
      <BannerSlider />

      {/* ✅ DEALS SECTION — dynamic from admin */}
      <DealsSection />

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