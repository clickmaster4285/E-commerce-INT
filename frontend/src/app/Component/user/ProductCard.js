"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, ShoppingCart, Star } from "lucide-react";
import { useCart } from "./CartContext";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `${API_ORIGIN}${url}`;
};

export default function ProductCard({ product }) {
  const [liked, setLiked] = useState(false);
  const { addToCart } = useCart();

  const variants = product.variants || [];
  const firstVariant = variants[0];
  const image = firstVariant?.images?.[0]?.img_url;

  const price = Number(firstVariant?.selling_price || product.price || 0);
  const totalStock = variants.length
    ? variants.reduce((s, v) => s + Number(v.quantity || 0), 0)
    : 99;

  const brandName = product.brand_id?.name || product.brand || "";

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, firstVariant, 1);
  };

  return (
    <Link
      href={`/product/${product._id || product.id}`}
      className="group relative block bg-[#071b12] border border-white/10 rounded-2xl overflow-hidden hover:border-[#d4af37] transition-all duration-300 hover:-translate-y-1"
    >
      {/* BADGES */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {product.discount && (
          <span className="bg-[#d4af37] text-black text-xs font-bold px-3 py-1 rounded-full">
            -{product.discount}
          </span>
        )}
        {totalStock === 0 ? (
          <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            OUT OF STOCK
          </span>
        ) : totalStock < 5 ? (
          <span className="bg-red-500/80 text-white text-xs font-bold px-3 py-1 rounded-full">
            LOW STOCK
          </span>
        ) : null}
      </div>

      {/* HEART */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setLiked(!liked);
        }}
        className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center hover:bg-[#d4af37] transition"
      >
        <Heart size={18} className={liked ? "text-red-500 fill-red-500" : "text-white"} />
      </button>

      {/* IMAGE / EMOJI */}
      <div className="h-56 bg-[#10251a] flex items-center justify-center overflow-hidden">
        {image ? (
          <img
            src={getImageUrl(image)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition duration-300"
          />
        ) : (
          <div className="text-7xl group-hover:scale-110 transition duration-300">
            {product.emoji || "📦"}
          </div>
        )}
      </div>

      {/* DETAILS */}
      <div className="p-5">
        <p className="text-[#d4af37] text-xs uppercase tracking-wider mb-2">
          {brandName || "ClickMasters"}
        </p>

        <h3 className="text-white font-semibold text-base line-clamp-1">{product.name}</h3>

        {/* RATING */}
        <div className="flex items-center gap-1 mt-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} size={14} className="fill-[#d4af37] text-[#d4af37]" />
          ))}
          <span className="text-xs text-gray-400">4.8</span>
        </div>

        {/* PRICE */}
        <div className="mt-4 flex items-center justify-between">
          <h4 className="text-xl font-bold text-white">Rs. {price.toLocaleString()}</h4>
          <span className="text-xs text-gray-500">
            {variants.length} variant{variants.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* CART BUTTON */}
        <button
          onClick={handleAdd}
          className="mt-5 w-full flex items-center justify-center gap-2 bg-[#d4af37] text-black py-3 rounded-xl font-bold text-sm hover:bg-yellow-300 transition"
        >
          <ShoppingCart size={17} />
          Add To Cart
        </button>
      </div>
    </Link>
  );
}