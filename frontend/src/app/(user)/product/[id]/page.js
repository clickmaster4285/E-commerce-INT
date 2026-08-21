"use client";

// ============================================================
// 1. IMPORTS
// ============================================================
import { use, useState, useMemo, useCallback, useEffect, memo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ShoppingCart,
  Truck,
  ShieldCheck,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Minus,
  Plus,
  Package,
  X,
  Check,
  Zap,
  ZoomIn,
  MapPin,
  Clock,
} from "lucide-react";

import { productApi } from "@/apis/productApi";
import ProductCard from "@/components/ui/user/ProductCard";
import { useCart } from "@/components/ui/user/CartContext";

// ============================================================
// 2. HELPERS & CONSTANTS
// ============================================================
const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const FREE_DELIVERY_THRESHOLD = 5000;
const DEFAULT_QTY = 1;
const MAX_RELATED = 8;

const getImageUrl = (img) => {
  if (!img) return null;
  const raw = typeof img === "string" ? img : img?.img_url;
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${API_ORIGIN}${path}`;
};

const extractId = (ref) => (ref && typeof ref === "object" ? ref._id : ref);
const extractName = (ref) => (ref && typeof ref === "object" ? ref.name : ref || "");
const toNum = (val) => (isNaN(Number(val)) ? 0 : Number(val));
const getDiscount = (oldPrice, newPrice) =>
  oldPrice > newPrice ? Math.round(((oldPrice - newPrice) / oldPrice) * 100) : 0;

// ============================================================
// 3. CUSTOM HOOKS
// ============================================================
function useProductDetail(productId) {
  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => productApi.getById(productId),
    enabled: !!productId,
    retry: false,
  });

  const { data: allProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: productApi.getAll,
    staleTime: 5 * 60 * 1000,
  });

  return { product, allProducts, isLoading, isError };
}

function useVariant(variants = []) {
  const safeVariants = variants.length ? variants : [{ _id: "default", images: [] }];
  const [index, setIndex] = useState(0);
  const [imgIndex, setImgIndex] = useState(0);

  const current = safeVariants[index] || safeVariants[0];
  const images = (current.images || []).map(getImageUrl).filter(Boolean);
  const mainImage = images[imgIndex] || images[0] || null;

  const selectVariant = useCallback((i) => {
    setIndex(i);
    setImgIndex(0);
  }, []);

  const allImages = useMemo(() => {
    const set = new Set();
    safeVariants.forEach((v) =>
      (v.images || []).forEach((img) => {
        const url = getImageUrl(img);
        if (url) set.add(url);
      })
    );
    return Array.from(set);
  }, [safeVariants]);

  return { variantIndex: index, imageIndex: imgIndex, setImageIndex: setImgIndex, currentVariant: current, images, mainImage, selectVariant, allImages };
}

function useQuantity(maxStock) {
  const [qty, setQty] = useState(DEFAULT_QTY);
  const increment = useCallback(() => setQty((p) => Math.min(Math.max(maxStock, 1), p + 1)), [maxStock]);
  const decrement = useCallback(() => setQty((p) => Math.max(1, p - 1)), []);
  const reset = useCallback(() => setQty(DEFAULT_QTY), []);
  return { quantity: qty, increment, decrement, reset };
}

function useAddFeedback(duration = 1500) {
  const [added, setAdded] = useState(false);
  const trigger = useCallback(() => {
    setAdded(true);
    setTimeout(() => setAdded(false), duration);
  }, [duration]);
  return { isAdded: added, trigger };
}

// ============================================================
// 4. PRESENTATIONAL COMPONENTS
// ============================================================
const Breadcrumb = memo(({ categoryId, categoryName, productName }) => (
  <nav className="flex items-center gap-1.5 text-[11px] lg:text-xs text-[var(--user-text-muted)] flex-wrap mb-6 lg:mb-8">
    <Link href="/" className="hover:text-[var(--user-accent)] transition-colors">Home</Link>
    <ChevronRight size={12} className="text-[var(--user-text-subtle)]" />
    {categoryName && categoryId && (
      <>
        <Link href={`/category/${categoryId}`} className="hover:text-[var(--user-accent)] transition-colors">
          {categoryName}
        </Link>
        <ChevronRight size={12} className="text-[var(--user-text-subtle)]" />
      </>
    )}
    <span className="text-[var(--user-text-secondary)] truncate max-w-[180px] sm:max-w-[280px]">
      {productName}
    </span>
  </nav>
));
Breadcrumb.displayName = "Breadcrumb";

const Gallery = memo(({ mainImage, images, imageIndex, onImageSelect, discount, stock, onZoom }) => (
  <div className="lg:sticky lg:top-24 self-start">
    <div
      className="relative aspect-square overflow-hidden rounded-2xl group cursor-zoom-in"
      onClick={() => mainImage && onZoom(mainImage)}
    >
      {mainImage ? (
        <>
          <img
            src={mainImage}
            alt="Product"
            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 pointer-events-none">
            <ZoomIn className="text-white drop-shadow-lg" size={32} />
          </div>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[var(--user-bg-card)]">
          <Package size={72} className="text-[var(--user-text-subtle)]" />
        </div>
      )}

      {discount > 0 && (
        <span className="absolute top-3 right-3 bg-[var(--user-accent)] text-[var(--user-accent-text)] text-[10px] lg:text-xs font-bold px-2.5 py-1 rounded-full shadow-md">
          -{discount}%
        </span>
      )}
      {stock === 0 && (
        <span className="absolute top-3 left-3 bg-red-600/90 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
          Out of Stock
        </span>
      )}
      {stock > 0 && stock < 5 && (
        <span className="absolute top-3 left-3 bg-yellow-500/90 backdrop-blur text-black text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md">
          Only {stock} left
        </span>
      )}
    </div>

    {images.length > 1 && (
      <div className="flex gap-2.5 mt-4 flex-wrap">
        {images.map((url, i) => (
          <button
            key={i}
            onClick={() => onImageSelect(i)}
            className={`w-14 h-14 lg:w-16 lg:h-16 rounded-xl overflow-hidden border-2 transition-all ${
              i === imageIndex
                ? "border-[var(--user-accent)] shadow-md"
                : "border-[var(--user-border)] opacity-60 hover:opacity-100 hover:border-[var(--user-accent)]/40"
            }`}
          >
            <img src={url} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    )}
  </div>
));
Gallery.displayName = "Gallery";

// ✅ FIX 3+4: whitespace-pre-line (Shift+Enter lines) + break-words (no overflow)
const Description = memo(({ text }) => {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const isLong = text.length > 160;
  return (
    <div className="mt-4 min-w-0">
      <p className={`text-[13px] lg:text-sm leading-6 lg:leading-7 text-[var(--user-text-muted)] whitespace-pre-line break-words ${!expanded && isLong ? "line-clamp-3" : ""}`}>
        {text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] lg:text-xs font-semibold text-[var(--user-accent)] hover:underline"
        >
          {expanded ? (
            <>Show less <ChevronUp size={14} /></>
          ) : (
            <>Read more <ChevronDown size={14} /></>
          )}
        </button>
      )}
    </div>
  );
});
Description.displayName = "Description";

const Divider = () => <hr className="my-5 lg:my-6 border-[var(--user-border)]" />;

const SectionHead = ({ children }) => (
  <h2 className="flex items-center gap-2.5 text-[15px] lg:text-[17px] font-bold text-[var(--user-text)] mb-4">
    <span className="w-1 h-5 rounded-full bg-[var(--user-accent)]" />
    {children}
  </h2>
);

const VariantSelector = memo(({ variants, selectedIndex, onSelect }) => {
  if (!variants || variants.length <= 1) return null;
  return (
    <div>
      <p className="text-[10px] lg:text-[11px] font-bold text-[var(--user-text-secondary)] uppercase tracking-widest mb-2.5">
        Options
        {variants[selectedIndex]?.title && (
          <span className="normal-case tracking-normal text-[var(--user-text-muted)] font-normal ml-2">
            — {variants[selectedIndex].title}
          </span>
        )}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {variants.map((v, i) => {
          const isOut = toNum(v.quantity) < 1;
          return (
            <button
              key={v._id || i}
              onClick={() => onSelect(i)}
              disabled={isOut}
              className={`h-9 px-4 rounded-full text-[11px] font-semibold border transition-all ${
                i === selectedIndex
                  ? "bg-[var(--user-accent)] text-[var(--user-accent-text)] border-[var(--user-accent)] shadow-sm"
                  : isOut
                  ? "text-[var(--user-text-subtle)] border-[var(--user-border)] line-through cursor-not-allowed bg-[var(--user-bg-card)]"
                  : "text-[var(--user-text-secondary)] border-[var(--user-border)] hover:border-[var(--user-accent)]/60 hover:text-[var(--user-text)] hover:bg-[var(--user-bg-card)]"
              }`}
            >
              {v.title || v.sku || `Option ${i + 1}`}
            </button>
          );
        })}
      </div>
    </div>
  );
});
VariantSelector.displayName = "VariantSelector";

const TrustBadges = memo(() => (
  <div className="grid grid-cols-3 divide-x divide-[var(--user-border)] rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] overflow-hidden shadow-sm">
    {[
      { icon: Truck, title: "Free Delivery", sub: `Rs. ${FREE_DELIVERY_THRESHOLD.toLocaleString()}+` },
      { icon: ShieldCheck, title: "Warranty", sub: "Official" },
      { icon: RotateCcw, title: "7-Day Return", sub: "Easy" },
    ].map(({ icon: Icon, title, sub }) => (
      <div key={title} className="flex flex-col items-center text-center gap-1 py-3 px-2">
        <span className="text-[var(--user-accent)]"><Icon size={16} /></span>
        <p className="text-[10px] font-bold text-[var(--user-text)] leading-none">{title}</p>
        <p className="text-[9px] text-[var(--user-text-muted)] leading-none">{sub}</p>
      </div>
    ))}
  </div>
));
TrustBadges.displayName = "TrustBadges";

const DeliveryInfo = memo(() => (
  <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)]">
    <Clock size={18} className="text-[var(--user-accent)] shrink-0 mt-0.5" />
    <div>
      <p className="text-sm font-semibold text-[var(--user-text)]">FREE Delivery</p>
      <p className="text-xs text-[var(--user-text-muted)]">
        Estimated <span className="font-medium">2–4 working days</span>
      </p>
      <p className="text-xs text-[var(--user-text-muted)] flex items-center gap-1 mt-0.5">
        <MapPin size={13} /> Available in your area
      </p>
    </div>
  </div>
));
DeliveryInfo.displayName = "DeliveryInfo";

// ✅ FIX 2: CONTENT-WIDTH table (poori width nahi)
const SpecsTable = memo(({ attributes }) => {
  const entries = Object.entries(attributes || {});
  if (entries.length === 0) return null;
  return (
    <div>
      <SectionHead>Specifications</SectionHead>
      <div className="w-fit max-w-full rounded-xl border border-[var(--user-border)] overflow-hidden bg-[var(--user-bg-card)] shadow-sm">
        <table className="w-full border-collapse">
          <tbody>
            {entries.map(([key, value], i) => (
              <tr key={key} className={i % 2 === 1 ? "bg-[var(--user-bg-hover)]/40" : ""}>
                <td className={`px-4 py-2.5 text-[10px] lg:text-[11px] text-[var(--user-text-muted)] uppercase tracking-wider font-medium whitespace-nowrap align-top border-r border-[var(--user-border)] ${i < entries.length - 1 ? "border-b border-b-[var(--user-border)]" : ""}`}>
                  {key}
                </td>
                <td className={`px-4 py-2.5 text-xs lg:text-[13px] text-[var(--user-text)] font-medium break-words ${i < entries.length - 1 ? "border-b border-b-[var(--user-border)]" : ""}`}>
                  {String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
SpecsTable.displayName = "SpecsTable";

// ✅ FIX 3: pre-line + break-words
const VariantDescription = memo(({ variant }) => {
  if (!variant?.description) return null;
  return (
    <section className="mt-10 lg:mt-14">
      <SectionHead>Details — {variant?.title || "Selected Option"}</SectionHead>
      <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 shadow-sm">
        <p className="text-[13px] lg:text-sm leading-7 text-[var(--user-text-muted)] whitespace-pre-line break-words">
          {variant.description}
        </p>
      </div>
    </section>
  );
});
VariantDescription.displayName = "VariantDescription";

const MoreImagesStack = memo(({ images, onZoom }) => {
  if (!images || images.length <= 1) return null;
  return (
    <section className="mt-10 lg:mt-14">
      <SectionHead>More Images</SectionHead>
      <div className="space-y-4 lg:space-y-5">
        {images.map((url, i) => (
          <button
            key={i}
            onClick={() => onZoom(url)}
            className="block w-full rounded-2xl overflow-hidden group cursor-zoom-in shadow-sm hover:shadow-md transition-shadow"
          >
            <img
              src={url}
              alt={`Product view ${i + 1}`}
              className="w-full h-[260px] sm:h-[380px] lg:h-[520px] object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
          </button>
        ))}
      </div>
    </section>
  );
});
MoreImagesStack.displayName = "MoreImagesStack";

const RelatedProducts = memo(({ products }) => {
  if (!products || products.length === 0) return null;
  return (
    <section className="mt-14 lg:mt-20">
      <SectionHead>You May Also Like</SectionHead>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-5">
        {products.map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
    </section>
  );
});
RelatedProducts.displayName = "RelatedProducts";

const MobileStickyBar = memo(({ name, price, qty, isAdded, stock, onAdd }) => (
  <div className="fixed bottom-16 left-0 right-0 z-30 md:hidden bg-[var(--user-bg-elevated)]/95 backdrop-blur-md border-t border-[var(--user-border)] shadow-lg">
    <div className="h-14 px-4 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-[var(--user-text-muted)] truncate">{name}</p>
        <p className="text-sm font-extrabold text-[var(--user-text)] leading-tight">Rs. {(price * qty).toLocaleString()}</p>
      </div>
      <button
        onClick={onAdd}
        disabled={stock < 1}
        className="h-9 px-4 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-40 bg-[var(--user-accent)] text-[var(--user-accent-text)]"
      >
        <ShoppingCart size={13} />
        Add
      </button>
    </div>
  </div>
));
MobileStickyBar.displayName = "MobileStickyBar";

const Lightbox = memo(({ images, index, onClose, onStep }) => {
  if (index === null || !images?.length) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="Close">
        <X size={20} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onStep(-1); }}
        className="absolute left-3 lg:left-6 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
        aria-label="Previous"
      >
        <ChevronLeft size={20} />
      </button>
      <img src={images[index]} alt="" className="max-w-[92vw] max-h-[82vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
      <button
        onClick={(e) => { e.stopPropagation(); onStep(1); }}
        className="absolute right-3 lg:right-6 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
        aria-label="Next"
      >
        <ChevronRight size={20} />
      </button>
      <span className="absolute bottom-4 text-white/60 text-xs font-medium">{index + 1} / {images.length}</span>
    </div>
  );
});
Lightbox.displayName = "Lightbox";

// ============================================================
// 5. LOADING & ERROR
// ============================================================
const LoadingState = () => (
  <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-8 lg:py-12">
    <div className="h-4 w-64 bg-[var(--user-bg-card)] rounded-full animate-pulse mb-8" />
    <div className="grid lg:grid-cols-[2fr_3fr] gap-8 lg:gap-12">
      <div className="aspect-square rounded-2xl bg-[var(--user-bg-card)] animate-pulse" />
      <div className="space-y-4">
        <div className="h-4 w-24 bg-[var(--user-bg-card)] rounded-full animate-pulse" />
        <div className="h-7 w-3/4 bg-[var(--user-bg-card)] rounded-full animate-pulse" />
        <div className="h-4 w-full bg-[var(--user-bg-card)] rounded-full animate-pulse" />
        <div className="h-8 w-44 bg-[var(--user-bg-card)] rounded-full animate-pulse" />
        <div className="h-10 w-full bg-[var(--user-bg-card)] rounded-xl animate-pulse" />
      </div>
    </div>
  </div>
);

const ErrorState = ({ isError }) => (
  <div className="max-w-[1400px] mx-auto px-4 lg:px-6 py-24 text-center">
    <div className="w-16 h-16 mx-auto rounded-2xl bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center mb-5">
      <Package size={26} className="text-[var(--user-accent)]" />
    </div>
    <h1 className="text-lg lg:text-xl font-bold text-[var(--user-text)] mb-2">
      {isError ? "Something Went Wrong" : "Product Not Found"}
    </h1>
    <p className="text-[var(--user-text-muted)] text-sm mb-7 max-w-sm mx-auto">
      {isError ? "We could not load this product. Please try again later." : "This product may have been removed."}
    </p>
    <Link href="/" className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-[var(--user-accent-hover)] transition-colors">
      Back to Home
    </Link>
  </div>
);

// ============================================================
// 6. MAIN COMPONENT
// ============================================================
export default function ProductDetailPage({ params }) {
  const { id } = use(params);
  const { product, allProducts, isLoading, isError } = useProductDetail(id);

  const variants = product?.variants?.length ? product.variants : [{ _id: "default", images: [] }];
  const { variantIndex, imageIndex, setImageIndex, currentVariant, images, mainImage, selectVariant, allImages } = useVariant(variants);

  const stock = toNum(currentVariant?.quantity);
  const { quantity, increment, decrement, reset } = useQuantity(stock);
  useEffect(() => reset(), [variantIndex, reset]);

  const { isAdded, trigger } = useAddFeedback();
  const { addToCart, setIsCartOpen } = useCart();

  const [lightbox, setLightbox] = useState(null);
  const openLightbox = useCallback((url) => {
    const i = allImages.indexOf(url);
    setLightbox(i >= 0 ? i : 0);
  }, [allImages]);
  const stepLightbox = useCallback(
    (dir) => setLightbox((c) => (c === null ? c : (c + dir + allImages.length) % allImages.length)),
    [allImages.length]
  );

  const handleAdd = useCallback(() => {
    if (stock < 1 || !product) return;
    addToCart(product, currentVariant, quantity);
    trigger();
  }, [stock, product, currentVariant, quantity, addToCart, trigger]);

  const handleBuy = useCallback(() => {
    if (stock < 1 || !product) return;
    addToCart(product, currentVariant, quantity);
    setIsCartOpen(true);
  }, [stock, product, currentVariant, quantity, addToCart, setIsCartOpen]);

  const price = toNum(currentVariant?.selling_price);
  const oldPrice = toNum(currentVariant?.price);
  const discount = product?.discount || getDiscount(oldPrice, price);

  const categoryId = extractId(product?.category_id);
  const categoryName = extractName(product?.category_id);
  const brandName = extractName(product?.brand_id);
  const brandId = extractId(product?.brand_id);

  const related = useMemo(() => {
    if (!product || !allProducts.length) return [];
    return allProducts
      .filter((p) => {
        const pCat = extractId(p.category_id);
        return p._id !== product._id && (!categoryId || pCat === categoryId);
      })
      .slice(0, MAX_RELATED);
  }, [product, allProducts, categoryId]);

  if (isLoading) return <LoadingState />;
  if (isError || !product) return <ErrorState isError={isError} />;

  return (
    <main className="max-w-[1400px] mx-auto px-4 lg:px-6 py-6 lg:py-10 pb-24 md:pb-10">
      <Breadcrumb categoryId={categoryId} categoryName={categoryName} productName={product.name} />

      {/* ═══════════ 2-COLUMN ═══════════ */}
      <div className="grid lg:grid-cols-[2fr_3fr] gap-8 lg:gap-12 mt-5 lg:mt-8">
        {/* LEFT: GALLERY */}
        <Gallery
          mainImage={mainImage}
          images={images}
          imageIndex={imageIndex}
          onImageSelect={setImageIndex}
          discount={discount}
          stock={stock}
          onZoom={openLightbox}
        />

        {/* RIGHT: DETAILS */}
        <div className="min-w-0">
          {brandName && brandId && (
            <Link href={`/brand/${brandId}`} className="inline-block text-[10px] lg:text-[11px] font-bold text-[var(--user-accent)] uppercase tracking-[0.2em] hover:opacity-80 transition">
              {brandName}
            </Link>
          )}

          <h1 className="mt-2 text-xl lg:text-2xl xl:text-[28px] font-bold text-[var(--user-text)] tracking-tight leading-snug break-words">
            {product.name}
          </h1>

          <div className="mt-1.5 text-[11px] lg:text-xs font-medium">
            {stock > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-[var(--user-success)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--user-success)]" /> In Stock
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[var(--user-danger)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--user-danger)]" /> Unavailable
              </span>
            )}
          </div>

          <Description text={product.description} />

          <div className="mt-5 rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] px-4 py-3 flex items-center gap-3 flex-wrap shadow-sm">
            <h2 className="text-lg lg:text-xl font-extrabold text-[var(--user-text)]">Rs. {price.toLocaleString()}</h2>
            {oldPrice > price && (
              <span className="text-xs lg:text-sm text-[var(--user-text-subtle)] line-through">Rs. {oldPrice.toLocaleString()}</span>
            )}
            {discount > 0 && (
              <span className="ml-auto text-[10px] font-bold text-[var(--user-success)] bg-[var(--user-success)]/10 border border-[var(--user-success)]/25 px-2 py-0.5 rounded-full">
                You save {discount}%
              </span>
            )}
          </div>

          <Divider />

          <VariantSelector variants={variants} selectedIndex={variantIndex} onSelect={selectVariant} />
          {variants.length > 1 && <div className="mt-4" />}

          {/* ✅ FIX 1: Dono buttons COMPACT + barabar size */}
          <div className="flex items-center gap-2.5 mt-1 flex-wrap">
            <div className="flex items-center h-10 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-card)] shrink-0">
              <button onClick={decrement} className="px-2.5 h-full text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition-colors" aria-label="Decrease">
                <Minus size={13} />
              </button>
              <span className="w-7 text-center text-xs font-bold text-[var(--user-text)]">{quantity}</span>
              <button onClick={increment} className="px-2.5 h-full text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition-colors" aria-label="Increase">
                <Plus size={13} />
              </button>
            </div>

            {/* Add to Cart — Buy Now jitna compact */}
            <button
              onClick={handleAdd}
              disabled={stock < 1}
              className={`h-10 px-4 rounded-lg flex items-center justify-center gap-1.5 text-xs font-bold transition active:scale-[0.97] disabled:cursor-not-allowed shrink-0 ${
                isAdded
                  ? "bg-[var(--user-success)] text-white"
                  : "bg-[var(--user-accent)] text-[var(--user-accent-text)] hover:bg-[var(--user-accent-hover)] disabled:bg-[var(--user-bg-hover)] disabled:text-[var(--user-text-disabled)]"
              }`}
            >
              {isAdded ? <Check size={14} /> : <ShoppingCart size={14} />}
              {stock < 1 ? "Out of Stock" : isAdded ? "Added!" : "Add to Cart"}
            </button>

            <button
              onClick={handleBuy}
              disabled={stock < 1}
              className="h-10 px-4 rounded-lg border border-[var(--user-accent)]/60 text-[var(--user-text)] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[var(--user-accent-soft)] active:scale-[0.97] transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Zap size={14} className="text-[var(--user-accent)]" />
              <span className="hidden sm:inline">Buy Now</span>
              <span className="sm:hidden">Buy</span>
            </button>
          </div>

          <div className="mt-4">
            <DeliveryInfo />
          </div>

          <div className="mt-4">
            <TrustBadges />
          </div>

          <Divider />

          <SpecsTable attributes={currentVariant?.attributes} />
        </div>
      </div>

      {/* ═══════════ BELOW THE FOLD ═══════════ */}
      <VariantDescription variant={currentVariant} />
      <MoreImagesStack images={allImages} onZoom={openLightbox} />
      <RelatedProducts products={related} />

      <MobileStickyBar name={product.name} price={price} qty={quantity} isAdded={isAdded} stock={stock} onAdd={handleAdd} />
      <Lightbox images={allImages} index={lightbox} onClose={() => setLightbox(null)} onStep={stepLightbox} />
    </main>
  );
}