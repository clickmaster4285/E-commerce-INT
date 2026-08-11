"use client";

import HeroSection from "../Component/user/HeroSection";
import ProductCard from "../Component/user/ProductCard";
import BrandSection from "../Component/user/BrandSection";
import products from "@/data/products";
import { Flame, ArrowRight } from "lucide-react";
import CategoryBar from "../Component/user/CategoryBar";

export default function Home() {
  return (
    <main
      className="
min-h-screen
bg-[#020d08]
text-white
"
    >
      {/* HERO */}
      <CategoryBar />
      <HeroSection />

      {/* FLASH DEALS */}

      <section
        className="
max-w-[1400px]
mx-auto
px-5
py-12
"
      >
        <div
          className="
flex
items-center
justify-between
mb-7
"
        >
          <div
            className="
flex
items-center
gap-3
"
          >
            <div
              className="
w-10
h-10
rounded-full
bg-[#d4af37]
text-black
flex
items-center
justify-center
"
            >
              <Flame size={22} />
            </div>

            <div>
              <h2
                className="
text-xl
font-bold
"
              >
                Flash Deals
              </h2>

              <p
                className="
text-xs
text-gray-400
"
              >
                Limited time offers
              </p>
            </div>
          </div>

          <button
            className="
flex
items-center
gap-1
text-sm
text-[#d4af37]
"
          >
            View All
            <ArrowRight size={15} />
          </button>
        </div>

        <div
          className="
grid
grid-cols-1
sm:grid-cols-2
lg:grid-cols-4
gap-5
"
        >
          {products.map((product) => (
            <ProductCard
              key={product._id || product.id} // ✅ Naya
              product={product}
            />
          ))}
        </div>
      </section>

      {/* BRANDS */}

      <BrandSection />
    </main>
  );
}
