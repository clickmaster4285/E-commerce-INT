"use client";

import { use, useState } from "react";
import Link from "next/link";
import products from "@/data/products";
import ProductCard from "@/app/Component/user/ProductCard";
import { useCart } from "@/app/Component/user/CartContext";
import {
  ShoppingCart,
  Truck,
  ShieldCheck,
  RotateCcw,
  ChevronRight,
  Minus,
  Plus,
  Star,
  Package,
} from "lucide-react";

export default function ProductDetailPage({ params }) {
  const { id } = use(params);

  const [variantIndex, setVariantIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const { addToCart, setIsCartOpen } = useCart();

  const product = products.find((p) => (p._id || String(p.id)) === id);

  if (!product) {
    return (
      <div className="max-w-[1400px] mx-auto px-5 py-24 text-center">
        <Package size={56} className="mx-auto text-[#d4af37] mb-4" />
        <h1 className="text-2xl font-bold text-white mb-2">Product not found</h1>
        <p className="text-gray-400 mb-6">This product may have been removed.</p>
        <Link
          href="/"
          className="inline-block bg-[#d4af37] text-black px-8 py-3 rounded-xl font-bold hover:bg-yellow-300 transition"
        >
          Back to Home
        </Link>
      </div>
    );
  }

  const variants = product.variants || [];
  const variant = variants[variantIndex] || variants[0];
  const price = Number(variant?.selling_price || 0);
  const stock = Number(variant?.quantity || 0);

  const categoryName = product.category_id?.name || "";
  const brandName = product.brand_id?.name || product.brand || "";

  const related = products
    .filter(
      (p) =>
        (p._id || String(p.id)) !== (product._id || String(product.id)) &&
        p.category_id?._id === product.category_id?._id
    )
    .slice(0, 4);

  const handleAdd = () => {
    addToCart(product, variant, qty);
    setIsCartOpen(true);
  };

  return (
    <main className="max-w-[1400px] mx-auto px-5 py-10">
      {/* BREADCRUMB */}
      <div className="flex items-center gap-2 text-xs text-gray-400 mb-8">
        <Link href="/" className="hover:text-[#d4af37]">Home</Link>
        <ChevronRight size={14} />
        <span className="hover:text-[#d4af37]">{categoryName}</span>
        <ChevronRight size={14} />
        <span className="text-[#d4af37] line-clamp-1">{product.name}</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* IMAGE */}
        <div className="relative rounded-3xl bg-[#071b12] border border-white/10 overflow-hidden aspect-square flex items-center justify-center">
          {product.discount && (
            <span className="absolute top-4 left-4 z-10 bg-[#d4af37] text-black text-xs font-bold px-3 py-1 rounded-full">
              -{product.discount}
            </span>
          )}
          <div className="text-[120px]">{product.emoji || "📦"}</div>
        </div>

        {/* INFO */}
        <div>
          <p className="text-[#d4af37] text-xs uppercase tracking-[3px] mb-3">{brandName}</p>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase leading-tight">
            {product.name}
          </h1>

          <div className="flex items-center gap-3 mt-4">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} size={16} className="fill-[#d4af37] text-[#d4af37]" />
              ))}
            </div>
            <span className="text-xs text-gray-400">4.8 · {variant?.sku || ""}</span>
          </div>

          <div className="flex items-end gap-3 mt-6">
            <h2 className="text-4xl font-black text-white">Rs. {price.toLocaleString()}</h2>
            {stock > 0 && stock < 5 && (
              <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full mb-1">
                Only {stock} left
              </span>
            )}
          </div>

          <p className="mt-5 text-gray-400 text-sm leading-6">{product.description}</p>

          {/* VARIANTS */}
          {variants.length > 1 && (
            <div className="mt-7">
              <h3 className="text-[#d4af37] text-xs uppercase tracking-widest mb-3">Variants</h3>
              <div className="flex flex-wrap gap-2">
                {variants.map((v, i) => (
                  <button
                    key={v._id || i}
                    onClick={() => {
                      setVariantIndex(i);
                      setQty(1);
                    }}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                      i === variantIndex
                        ? "bg-[#d4af37] text-black border-[#d4af37]"
                        : "bg-[#10251a] text-gray-300 border-white/10 hover:border-[#d4af37]/50"
                    }`}
                  >
                    {v.title || v.sku}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ATTRIBUTES */}
          {variant?.attributes && Object.keys(variant.attributes).length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {Object.entries(variant.attributes).map(([key, value]) => (
                <span
                  key={key}
                  className="px-3 py-1.5 rounded-full bg-[#10251a] border border-white/10 text-xs text-gray-300"
                >
                  <span className="text-[#d4af37] font-semibold">{key}:</span> {String(value)}
                </span>
              ))}
            </div>
          )}

          {/* QTY + ADD TO CART */}
          <div className="flex flex-wrap items-center gap-4 mt-8">
            <div className="flex items-center rounded-xl border border-white/10 bg-[#10251a]">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 text-gray-300 hover:text-[#d4af37]">
                <Minus size={16} />
              </button>
              <span className="w-10 text-center text-white font-bold">{qty}</span>
              <button onClick={() => setQty(Math.min(Math.max(stock, 1), qty + 1))} className="p-3 text-gray-300 hover:text-[#d4af37]">
                <Plus size={16} />
              </button>
            </div>

            <button
              onClick={handleAdd}
              className="flex-1 min-w-[200px] flex items-center justify-center gap-2 bg-[#d4af37] text-black py-3.5 rounded-xl font-bold hover:bg-yellow-300 transition"
            >
              <ShoppingCart size={18} />
              Add To Cart
            </button>
          </div>

          {/* FEATURES */}
          <div className="grid grid-cols-3 gap-3 mt-8">
            <Feature icon={<Truck size={20} />} title="Free Delivery" sub="On Rs. 5,000+" />
            <Feature icon={<ShieldCheck size={20} />} title="Warranty" sub="Official brand" />
            <Feature icon={<RotateCcw size={20} />} title="7-Day Return" sub="Easy returns" />
          </div>
        </div>
      </div>

      {/* RELATED */}
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-xl font-bold text-white mb-7">Related Products</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {related.map((p) => (
              <ProductCard key={p._id || p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Feature({ icon, title, sub }) {
  return (
    <div className="rounded-xl bg-[#071b12] border border-white/10 p-4 flex flex-col items-center text-center gap-2">
      <span className="text-[#d4af37]">{icon}</span>
      <p className="text-xs font-semibold text-white">{title}</p>
      <p className="text-[10px] text-gray-500">{sub}</p>
    </div>
  );
}