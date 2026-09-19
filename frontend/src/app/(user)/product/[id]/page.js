"use client";

import { use, useState, useMemo, useCallback, useEffect, useRef, memo, Suspense } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  ShoppingCart, Truck, ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  Minus, Plus, Package, X, Check, Zap, ZoomIn, MapPin, Tag, Sparkles, Heart, TrendingUp, Search,
} from "lucide-react";

import { productApi } from "@/apis/user/productApi";
import { storeApi } from "@/apis/user/storeApi";
import ProductCard from "@/components/user/ProductCard";
import { useCart } from "@/components/user/CartContext";
import { useDiscounts } from "@/components/user/DiscountContext";
import { useWishlist } from "@/components/user/WishlistContext";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const DEFAULT_QTY = 1;
const MAX_RELATED = 8;
const COLLAPSED_H = 360;

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

const getDealBadgeText = (deal) => {
  if (!deal?.type) return deal?.name || "Deal";
  if (deal.type === "percentage") return `${deal.discountValue}% OFF`;
  if (deal.type === "fixed_amount") return `Rs. ${deal.discountValue} OFF`;
  if (deal.type === "buy_x_get_y") {
    const b = deal.buyQuantity || 0, g = deal.getQuantity || 0;
    return b > 0 && g > 0 ? `Buy ${b} Get ${g}` : "Buy X Get Y";
  }
  if (deal.type === "bundle") return "Bundle Deal";
  if (deal.type === "free_shipping") return "Free Shipping";
  return deal.name || "Deal";
};

const getStockStatus = (stock) => {
  if (stock === 0) return { text: "Out of Stock", cls: "bg-[var(--user-danger)]/10 text-[var(--user-danger)]", dot: "bg-[var(--user-danger)]" };
  if (stock <= 3) return { text: `Only ${stock} left`, cls: "bg-orange-500/10 text-orange-500 [.light_&]:text-orange-600", dot: "bg-orange-500" };
  if (stock <= 10) return { text: `${stock} in stock`, cls: "bg-yellow-500/10 text-yellow-600 [.light_&]:text-yellow-700", dot: "bg-yellow-500" };
  return { text: "In Stock", cls: "bg-[var(--user-success)]/10 text-[var(--user-success)]", dot: "bg-[var(--user-success)]" };
};

function useProductDetail(productId) {
  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", productId], queryFn: () => productApi.getById(productId), enabled: !!productId, retry: false,
  });
  const { data: allProducts = [] } = useQuery({ queryKey: ["products"], queryFn: productApi.getAll, staleTime: 5 * 60 * 1000 });
  return { product, allProducts, isLoading, isError };
}

function useVariant(variants = []) {
  const safeVariants = variants.length ? variants : [{ _id: "default", images: [] }];
  const [index, setIndex] = useState(0);
  const [imgIndex, setImgIndex] = useState(0);
  const current = safeVariants[index] || safeVariants[0];
  const currentImages = (current.images || []).map(getImageUrl).filter(Boolean);
  const mainImage = currentImages[imgIndex] || currentImages[0] || null;
  const selectVariant = useCallback((i) => { setIndex(i); setImgIndex(0); }, []);

  // ✅ ALL variant images as flat URL array — for thumbnails (user can click any)
  const allVariantImages = useMemo(() => {
    return safeVariants.flatMap((v) => (v.images || []).map(getImageUrl).filter(Boolean));
  }, [safeVariants]);

  // ✅ Click any thumbnail → find which variant owns this URL, switch to it
  const selectImageByUrl = useCallback((url) => {
    for (let vIdx = 0; vIdx < safeVariants.length; vIdx++) {
      const imgs = (safeVariants[vIdx].images || []).map(getImageUrl).filter(Boolean);
      const iIdx = imgs.indexOf(url);
      if (iIdx >= 0) {
        setIndex(vIdx);
        setImgIndex(iIdx);
        return;
      }
    }
  }, [safeVariants]);

  const allImages = useMemo(() => {
    const set = new Set();
    safeVariants.forEach((v) => (v.images || []).forEach((img) => { const u = getImageUrl(img); if (u) set.add(u); }));
    return Array.from(set);
  }, [safeVariants]);

  return { variantIndex: index, imageIndex: imgIndex, setImageIndex: setImgIndex, currentVariant: current, images: allVariantImages, currentImages, mainImage, selectVariant, selectImageByUrl, allImages };
}

function useQuantity(maxStock) {
  const [qty, setQty] = useState(DEFAULT_QTY);
  const increment = useCallback(() => setQty((p) => Math.min(Math.max(maxStock, 1), p + 1)), [maxStock]);
  const decrement = useCallback(() => setQty((p) => Math.max(1, p - 1)), []);
  const reset = useCallback(() => setQty(DEFAULT_QTY), []);
  return { quantity: qty, increment, decrement, reset };
}

function useAddFeedback(duration = 2000) {
  const [added, setAdded] = useState(false);
  const trigger = useCallback(() => { setAdded(true); setTimeout(() => setAdded(false), duration); }, [duration]);
  return { isAdded: added, trigger };
}

function useStickyBar() {
  const [show, setShow] = useState(false);
  const sentinelRef = useRef(null);
  useEffect(() => {
    const s = sentinelRef.current;
    if (!s) return;
    const obs = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { threshold: 0, rootMargin: "-100px 0px 0px 0px" });
    obs.observe(s);
    return () => obs.disconnect();
  }, []);
  return { show, sentinelRef };
}

const Breadcrumb = memo(({ categoryId, categoryName, productName }) => (
  <nav className="flex items-center gap-1.5 text-[11px] sm:text-xs text-[var(--user-text-muted)] flex-wrap px-0.5">
    <Link href="/" className="hover:text-[var(--user-accent)] transition-colors">Home</Link>
    <ChevronRight size={11} className="opacity-60" />
    {categoryName && categoryId && (
      <>
        <Link href={`/category/${categoryId}`} className="hover:text-[var(--user-accent)] transition-colors">{categoryName}</Link>
        <ChevronRight size={11} className="opacity-60" />
      </>
    )}
    <span className="text-[var(--user-text-secondary)] truncate max-w-[160px] sm:max-w-[200px] lg:max-w-[320px]">{productName}</span>
  </nav>
));
Breadcrumb.displayName = "Breadcrumb";

const Gallery = memo(({ mainImage, images, onImageSelect, stock, onZoom }) => {
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const [paused, setPaused] = useState(false);

  // ✅ Auto-rotate disabled — user clicks thumbnail to switch variant
  const handleMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setOrigin(`${Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100))}% ${Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100))}%`);
  };

  return (
    <div className="flex gap-3 sm:gap-4">
      {images.length > 1 && (
        <div className="hidden lg:flex flex-col gap-2.5 shrink-0">
          {images.map((url, i) => (
            <button key={i} onClick={() => onImageSelect(url)} aria-label={`View image ${i + 1}`}
              className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${url === mainImage ? "border-[var(--user-accent)] ring-2 ring-[var(--user-accent)]/20" : "border-[var(--user-border)] opacity-60 hover:opacity-100"}`}>
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="relative flex-1 min-w-0">
        <div className="relative aspect-square overflow-hidden rounded-2xl group cursor-zoom-in bg-transparent border-0"
          onClick={() => mainImage && onZoom(mainImage)}
          onMouseEnter={() => { setZoomed(true); setPaused(true); }}
          onMouseLeave={() => { setZoomed(false); setPaused(false); }}
          onMouseMove={handleMove}>
          {mainImage ? (
            <div key={mainImage} className="w-full h-full" style={{ animation: "galleryImgIn .45s ease" }}>
              <img src={mainImage} alt="Product" className="w-full h-full object-contain"
                style={zoomed ? { transform: "scale(1.9)", transformOrigin: origin, transition: "transform .12s ease-out" } : { transform: "scale(1)", transition: "transform .35s ease" }} />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Package size={64} className="text-[var(--user-text-subtle)]" /></div>
          )}
          {stock === 0 && <span className="absolute top-3 right-3 bg-[var(--user-danger)] text-white text-[10px] font-bold px-2.5 py-1 rounded-full">Out of Stock</span>}
          {stock > 0 && stock < 5 && <span className="absolute top-3 right-3 bg-[var(--user-danger)] text-white text-[10px] font-bold px-2.5 py-1 rounded-full">Only {stock} left</span>}
          <button onClick={(e) => { e.stopPropagation(); mainImage && onZoom(mainImage); }} aria-label="Zoom"
            className="absolute bottom-3 right-3 w-9 h-9 rounded-lg bg-[var(--user-bg-card)]/80 backdrop-blur border border-[var(--user-border)] flex items-center justify-center text-[var(--user-text-secondary)] hover:text-[var(--user-accent)] transition">
            <Search size={15} />
          </button>
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 mt-3 overflow-x-auto lg:hidden pb-1 -mx-4 px-4 sm:-mx-5 sm:px-5" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            {images.map((url, i) => (
              <button key={i} onClick={() => onImageSelect(url)} aria-label={`View image ${i + 1}`}
                className={`w-14 h-14 shrink-0 rounded-xl overflow-hidden border-2 transition-all ${url === mainImage ? "border-[var(--user-accent)]" : "border-[var(--user-border)] opacity-60"}`}>
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
Gallery.displayName = "Gallery";

const SectionTitle = ({ children }) => (
  <h2 className="flex items-center gap-2.5 text-[15px] sm:text-base font-bold text-[var(--user-text)]">
    <span className="w-1 h-5 rounded-full bg-[var(--user-accent)]" />{children}
  </h2>
);

const DescriptionCard = memo(({ shortDescription, fullDescription, variantTitle, variantDescription }) => {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const bodyRef = useRef(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > COLLAPSED_H + 8);
  }, [shortDescription, fullDescription, variantDescription]);

  if (!shortDescription && !fullDescription && !variantDescription) return null;

  return (
    <div className="h-full flex flex-col rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] overflow-hidden">
      <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[var(--user-border)] shrink-0"><SectionTitle>Description</SectionTitle></div>
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          ref={bodyRef}
          className={`px-4 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-4 flex-1 ${expanded ? "overflow-y-auto" : ""}`}
          style={!expanded ? { maxHeight: COLLAPSED_H, overflow: "hidden" } : undefined}
        >
          {shortDescription && (
            <p className="text-[13px] sm:text-sm leading-6 sm:leading-7 font-medium text-[var(--user-text-secondary)]">{shortDescription}</p>
          )}
          {fullDescription && (
            <div className="text-[13px] sm:text-sm leading-6 sm:leading-7 text-[var(--user-text-muted)] whitespace-pre-line break-words">{fullDescription}</div>
          )}
          {variantDescription && (
            <div className="pt-3 sm:pt-4 border-t border-[var(--user-border)]">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-[var(--user-text-secondary)] mb-1.5 sm:mb-2">{variantTitle || "Selected Variant"}</p>
              <p className="text-[13px] sm:text-sm leading-6 sm:leading-7 text-[var(--user-text-muted)] whitespace-pre-line break-words">{variantDescription}</p>
            </div>
          )}
        </div>
        {overflowing && (
          <div className="relative shrink-0">
            {!expanded && (
              <div className="pointer-events-none absolute inset-x-0 bottom-full h-12 bg-gradient-to-t from-[var(--user-bg-card)] to-transparent" />
            )}
            <div className="px-4 sm:px-6 py-2.5 sm:py-3 border-t border-[var(--user-border)] bg-[var(--user-bg-card)]">
              <button
                onClick={() => setExpanded(!expanded)}
                className="inline-flex items-center gap-1.5 text-[13px] sm:text-sm font-semibold text-[var(--user-accent)] hover:underline"
              >
                {expanded ? <>Read less <ChevronUp size={14} /></> : <>Read more <ChevronDown size={14} /></>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
DescriptionCard.displayName = "DescriptionCard";

const SpecsCard = memo(({ attributes }) => {
  const entries = Object.entries(attributes || {});
  if (!entries.length) return null;
  return (
    <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] overflow-hidden">
      <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[var(--user-border)]"><SectionTitle>Specifications</SectionTitle></div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[280px]">
          <tbody>
            {entries.map(([key, value], i) => (
              <tr key={key} className={i % 2 === 1 ? "bg-[var(--user-bg-hover)]/40" : ""}>
                <td className={`w-2/5 px-4 sm:px-6 py-3 sm:py-3.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-[var(--user-text-muted)] align-top ${i < entries.length - 1 ? "border-b border-[var(--user-border)]" : ""}`}>{key}</td>
                <td className={`px-4 sm:px-6 py-3 sm:py-3.5 text-[13px] sm:text-sm font-medium text-[var(--user-text)] break-words ${i < entries.length - 1 ? "border-b border-[var(--user-border)]" : ""}`}>{String(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
SpecsCard.displayName = "SpecsCard";

const MoreImagesStack = memo(({ images, onZoom }) => {
  if (!images || images.length <= 1) return null;
  return (
    <section className="mt-10 sm:mt-12 lg:mt-14">
      <SectionTitle>More Images</SectionTitle>
      <div className="mt-4 sm:mt-5 space-y-3 sm:space-y-4 lg:space-y-5">
        {images.map((url, i) => (
          <button key={i} onClick={() => onZoom(url)} className="block w-full rounded-2xl overflow-hidden group cursor-zoom-in border border-[var(--user-border)]">
            <img src={url} alt={`Product view ${i + 1}`} loading="lazy" className="w-full h-[240px] sm:h-[380px] lg:h-[560px] object-cover group-hover:scale-[1.02] transition-transform duration-500" />
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
    <section className="mt-10 sm:mt-12 lg:mt-14">
      <SectionTitle>You May Also Like</SectionTitle>
      <div className="mt-4 sm:mt-5 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-5">
        {products.map((p) => <ProductCard key={p._id} product={p} />)}
      </div>
    </section>
  );
});
RelatedProducts.displayName = "RelatedProducts";

const DeliveryInfo = memo(({ storeName, stock }) => (
  <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-3.5 sm:p-4">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[var(--user-accent)]/10 flex items-center justify-center shrink-0">
        <Truck className="text-[var(--user-accent)]" size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] sm:text-sm font-bold text-[var(--user-text)]">{storeName || "Official Store"}</p>
        <div className="flex items-center gap-1.5 mt-0.5 text-[10px] sm:text-[11px] text-[var(--user-text-muted)]">
          <MapPin size={11} className="text-[var(--user-accent)]" />
          {stock > 0 ? <span className="text-[var(--user-success)] font-semibold">In stock, ready to ship</span> : <span>Currently unavailable</span>}
        </div>
      </div>
    </div>
  </div>
));
DeliveryInfo.displayName = "DeliveryInfo";

const StickyBar = memo(({ show, name, price, qty, stock, onAdd, isAdded, onWishlist, isWishlisted }) => {
  if (!show) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--user-bg-elevated)]/95 backdrop-blur-md border-t border-[var(--user-border)] shadow-2xl safe-bottom" style={{ animation: "slideUp .25s ease" }}>
      <div className="max-w-[1400px] mx-auto px-3 sm:px-4 h-16 flex items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-[var(--user-text-muted)] truncate">{name}</p>
          <p className="text-base sm:text-lg font-extrabold text-[var(--user-text)] leading-tight">Rs. {(price * qty).toLocaleString()}</p>
        </div>
        <button onClick={onWishlist} className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl border flex items-center justify-center transition-all ${isWishlisted ? "bg-[var(--user-danger)]/10 border-[var(--user-danger)]/30 text-[var(--user-danger)]" : "border-[var(--user-border)] text-[var(--user-text-muted)] hover:text-[var(--user-danger)]"}`}>
          <Heart size={17} fill={isWishlisted ? "currentColor" : "none"} />
        </button>
        <button onClick={onAdd} disabled={stock < 1}
          className={`h-10 sm:h-11 px-4 sm:px-6 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-2 transition active:scale-95 disabled:opacity-40 ${isAdded ? "bg-[var(--user-success)] text-white" : "bg-[var(--user-accent)] text-[var(--user-accent-text)] shadow-lg"}`}>
          {isAdded ? <Check size={14} /> : <ShoppingCart size={14} />}
          {isAdded ? "Added!" : "Add"}
        </button>
      </div>
    </div>
  );
});
StickyBar.displayName = "StickyBar";

const Lightbox = memo(({ images, index, onClose, onStep }) => {
  if (index === null || !images?.length) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="Close"><X size={20} /></button>
      <button onClick={(e) => { e.stopPropagation(); onStep(-1); }} className="absolute left-3 lg:left-6 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="Previous"><ChevronLeft size={20} /></button>
      <img src={images[index]} alt="" className="max-w-[92vw] max-h-[82vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
      <button onClick={(e) => { e.stopPropagation(); onStep(1); }} className="absolute right-3 lg:right-6 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="Next"><ChevronRight size={20} /></button>
      <span className="absolute bottom-4 text-white/60 text-xs font-medium">{index + 1} / {images.length}</span>
    </div>
  );
});
Lightbox.displayName = "Lightbox";

const LoadingState = () => (
  <div className="max-w-[1400px] mx-auto px-4 sm:px-5 lg:px-6 py-6 sm:py-8 lg:py-10">
    <div className="h-4 w-64 bg-[var(--user-bg-card)] rounded-full animate-pulse mb-6 sm:mb-8" />
    <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12">
      <div className="aspect-square rounded-2xl bg-[var(--user-bg-card)] animate-pulse" />
      <div className="space-y-4">
        <div className="h-4 w-24 bg-[var(--user-bg-card)] rounded-full animate-pulse" />
        <div className="h-8 w-3/4 bg-[var(--user-bg-card)] rounded-full animate-pulse" />
        <div className="h-24 w-full bg-[var(--user-bg-card)] rounded-2xl animate-pulse" />
        <div className="h-12 w-full bg-[var(--user-bg-card)] rounded-xl animate-pulse" />
      </div>
    </div>
  </div>
);

const ErrorState = ({ isError }) => (
  <div className="max-w-[1400px] mx-auto px-4 sm:px-5 lg:px-6 py-16 sm:py-20 lg:py-24 text-center">
    <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto rounded-2xl bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center mb-4 sm:mb-5">
      <Package size={24} className="text-[var(--user-accent)]" />
    </div>
    <h1 className="text-base sm:text-lg lg:text-xl font-bold text-[var(--user-text)] mb-2">{isError ? "Something Went Wrong" : "Product Not Found"}</h1>
    <p className="text-[var(--user-text-muted)] text-xs sm:text-sm mb-6 sm:mb-7 max-w-sm mx-auto">{isError ? "We could not load this product. Please try again later." : "This product may have been removed."}</p>
    <Link href="/" className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-5 sm:px-6 py-2.5 rounded-xl text-sm font-bold hover:opacity-90 transition">Back to Home</Link>
  </div>
);

export default function ProductDetailPage(props) {
  return (
    <Suspense fallback={<LoadingState />}>
      <ProductDetailContent {...props} />
    </Suspense>
  );
}

function ProductDetailContent({ params }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { product, allProducts, isLoading, isError } = useProductDetail(id);

  const { data: store = null } = useQuery({ queryKey: ["storeInfo"], queryFn: storeApi.getPublic, staleTime: 5 * 60 * 1000 });
  const storeName = store?.store_name || "";

  const variants = product?.variants?.length ? product.variants : [{ _id: "default", images: [] }];
  const { variantIndex, imageIndex, setImageIndex, currentVariant, images, currentImages, mainImage, selectVariant, selectImageByUrl, allImages } = useVariant(variants);

  const stock = toNum(currentVariant?.quantity);
  const { quantity, increment, decrement, reset } = useQuantity(stock);
  useEffect(() => reset(), [variantIndex, reset]);

  const { isAdded, trigger } = useAddFeedback();
  const { addToCart, setIsCartOpen } = useCart();
  const { calculateProductDiscount, getActiveDealsForProduct } = useDiscounts();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [lightbox, setLightbox] = useState(null);
  const { show: showStickyBar, sentinelRef } = useStickyBar();
  const specsBoxRef = useRef(null);
  const [descHeight, setDescHeight] = useState(0);

  useEffect(() => {
    const el = specsBoxRef.current;
    if (!el) return;
    const update = () => {
      const isLg = window.matchMedia("(min-width: 1024px)").matches;
      setDescHeight(isLg ? el.offsetHeight : 0);
    };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (ro) ro.observe(el);
    window.addEventListener("resize", update);
    return () => { if (ro) ro.disconnect(); window.removeEventListener("resize", update); };
  }, [currentVariant]);

  const openLightbox = useCallback((url) => { const i = allImages.indexOf(url); setLightbox(i >= 0 ? i : 0); }, [allImages]);
  const stepLightbox = useCallback((dir) => setLightbox((c) => (c === null ? c : (c + dir + allImages.length) % allImages.length)), [allImages.length]);

  const variantPrice = toNum(currentVariant?.selling_price);
  const variantOldPrice = toNum(currentVariant?.price);

  const allDeals = useMemo(() => getActiveDealsForProduct(product), [getActiveDealsForProduct, product]);
  const hasDeal = allDeals.length > 0;

  const dealParam = searchParams.get("deal");
  const sourceParam = searchParams.get("source");
  const cameFromDeal = sourceParam === "deal" || !!dealParam;

  const [selectedDealId, setSelectedDealId] = useState(() => {
    if (dealParam && allDeals.some((d) => String(d._id) === String(dealParam))) return dealParam;
    return allDeals[0]?._id || null;
  });

  useEffect(() => {
    const stillValid = allDeals.some((d) => String(d._id) === String(selectedDealId));
    if (stillValid) return;
    const fromParam = dealParam && allDeals.some((d) => String(d._id) === String(dealParam)) ? dealParam : null;
    const next = fromParam || allDeals[0]?._id || null;
    setSelectedDealId(next);
  }, [allDeals, dealParam, selectedDealId]);

  const matchedDeal = allDeals.find((d) => String(d._id) === String(selectedDealId)) || allDeals[0] || null;

  const [purchaseMode, setPurchaseMode] = useState(cameFromDeal && hasDeal ? "deal" : "regular");
  const userSelectedModeRef = useRef(false);
  useEffect(() => {
    if (userSelectedModeRef.current) return;
    if (cameFromDeal && hasDeal && purchaseMode !== "deal") setPurchaseMode("deal");
    else if (purchaseMode === "deal" && !hasDeal) setPurchaseMode("regular");
  }, [cameFromDeal, hasDeal, purchaseMode]);

  const regularDisc = useMemo(() => calculateProductDiscount(product, variantPrice, false), [calculateProductDiscount, product, variantPrice]);
  const regularPrice = regularDisc.discountedPrice;
  const regularOriginalPrice = regularDisc.hasDiscount ? regularDisc.originalPrice : variantOldPrice;
  const regularHasDiscount = regularDisc.hasDiscount;
  const regularSavings = regularDisc.hasDiscount ? (regularDisc.originalPrice - regularDisc.discountedPrice) : 0;
  const regularDiscountName = regularDisc.discountName || "";

  const dealDisc = useMemo(
    () => (hasDeal && matchedDeal ? calculateProductDiscount(product, variantPrice, true, matchedDeal) : null),
    [calculateProductDiscount, product, hasDeal, variantPrice, matchedDeal]
  );
  const dealPrice = dealDisc ? dealDisc.discountedPrice : variantPrice;
  const dealOriginalPrice = dealDisc && dealDisc.hasDiscount ? dealDisc.originalPrice : variantOldPrice;
  const dealSavings = dealDisc && dealDisc.hasDiscount ? (dealDisc.originalPrice - dealDisc.discountedPrice) : 0;

  const dealInfo = useMemo(() => {
    if (!matchedDeal) return null;
    const info = {
      dealId: matchedDeal._id, dealType: matchedDeal.type, dealName: matchedDeal.name,
      dealBadge: getDealBadgeText(matchedDeal),
      savings: Math.max(0, dealOriginalPrice - dealPrice), originalPrice: dealOriginalPrice,
      dealDiscountValue: Number(matchedDeal.discountValue) || 0,
    };
    if (matchedDeal.type === "buy_x_get_y") { info.buyQuantity = matchedDeal.buyQuantity; info.getQuantity = matchedDeal.getQuantity; }
    return info;
  }, [matchedDeal, dealOriginalPrice, dealPrice]);

  const isDealMode = purchaseMode === "deal" && hasDeal;
  const activePrice = isDealMode ? dealPrice : regularPrice;
  const activeOriginalPrice = isDealMode ? dealOriginalPrice : regularOriginalPrice;
  const activeHasDiscount = isDealMode ? (dealOriginalPrice > dealPrice) : regularHasDiscount;
  const activeSavings = isDealMode ? dealSavings : regularSavings;
  const discountPct = activeHasDiscount && activeOriginalPrice > 0 ? Math.round(((activeOriginalPrice - activePrice) / activeOriginalPrice) * 100) : 0;

  const handleAdd = useCallback(() => {
    if (stock < 1 || !product) return;
    addToCart(product, currentVariant, quantity, isDealMode ? dealInfo : null);
    trigger();
  }, [stock, product, currentVariant, quantity, addToCart, trigger, dealInfo, isDealMode]);

  const handleBuy = useCallback(() => {
    if (stock < 1 || !product) return;
    addToCart(product, currentVariant, quantity, isDealMode ? dealInfo : null);
    setIsCartOpen(true);
  }, [stock, product, currentVariant, quantity, addToCart, setIsCartOpen, dealInfo, isDealMode]);

  const categoryId = extractId(product?.category_id);
  const categoryName = extractName(product?.category_id);
  const brandName = extractName(product?.brand_id);
  const brandId = extractId(product?.brand_id);

  const fullDescription = product?.description || "";
  const shortDescription = product?.short_description || "";
  const highlightEntries = Object.entries(currentVariant?.attributes || {}).slice(0, 3);

  const related = useMemo(() => {
    if (!product || !allProducts.length) return [];
    return allProducts.filter((p) => { const pCat = extractId(p.category_id); return p._id !== product._id && (!categoryId || pCat === categoryId); }).slice(0, MAX_RELATED);
  }, [product, allProducts, categoryId]);

  const stockStatus = getStockStatus(stock);
  const productId = product?._id || product?.id;
  const liked = productId ? isWishlisted(productId) : false;

  if (isLoading) return <LoadingState />;
  if (isError || !product) return <ErrorState isError={isError} />;

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-5 lg:px-6 py-4 sm:py-6 lg:py-10 pb-20 sm:pb-24 md:pb-12">
      <style>{`
        @keyframes galleryImgIn { from { opacity: 0; transform: scale(1.03); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
      `}</style>

      <Breadcrumb categoryId={categoryId} categoryName={categoryName} productName={product.name} />

      <div className="grid lg:grid-cols-2 gap-5 sm:gap-6 lg:gap-12 mt-4 sm:mt-5 lg:mt-6">
        <div className="lg:sticky lg:top-24 self-start">
          <Gallery mainImage={mainImage} images={images} onImageSelect={selectImageByUrl} stock={stock} onZoom={openLightbox} />
                  </div>

        <div className="min-w-0 space-y-4 sm:space-y-5" ref={sentinelRef}>
          <div className="space-y-2">
            {brandName && brandId && (
              <Link href={`/brand/${brandId}`} className="inline-block text-[10px] sm:text-[11px] font-bold text-[var(--user-accent)] uppercase tracking-[0.18em] hover:opacity-80 transition">{brandName}</Link>
            )}
            <h1 className="text-[20px] sm:text-2xl lg:text-[28px] font-bold text-[var(--user-text)] tracking-tight leading-snug break-words">{product.name}</h1>
            <span className={`inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold px-2.5 py-1 rounded-full ${stockStatus.cls}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${stockStatus.dot}`} /> {stockStatus.text}
            </span>
          </div>

          <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 sm:p-5 space-y-3 sm:space-y-4">
            {hasDeal && (
              <div className="inline-flex items-center rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)] p-1">
                {[{ key: "regular", label: "Regular", icon: Tag }, { key: "deal", label: "Deal", icon: Sparkles }].map(({ key, label, icon: Icon }) => {
                  const active = purchaseMode === key;
                  return (
                    <button key={key} type="button" onClick={() => { userSelectedModeRef.current = true; setPurchaseMode(key); }}
                      className={`h-9 px-3.5 sm:px-4 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition ${active ? (key === "deal" ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow" : "bg-[var(--user-accent)] text-[var(--user-accent-text)] shadow") : "text-[var(--user-text-muted)] hover:text-[var(--user-text)]"}`}>
                      <Icon size={12} /> {label}
                    </button>
                  );
                })}
              </div>
            )}

            {isDealMode && allDeals.length > 1 && (
              <div className="rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)] p-2.5 sm:p-3">
                <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-[var(--user-text-muted)] mb-2 flex items-center gap-1.5">
              
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {allDeals.map((d) => {
                    const sel = String(d._id) === String(selectedDealId);
                    const dd = calculateProductDiscount(product, variantPrice, true, d);
                    const saveAmt = dd && dd.hasDiscount ? (dd.originalPrice - dd.discountedPrice) : 0;
                    const badge = getDealBadgeText(d);
                    return (
                      <button
                        key={d._id}
                        type="button"
                        onClick={() => setSelectedDealId(d._id)}
                        aria-pressed={sel}
                        className={`flex items-center gap-1.5 sm:gap-2 h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg text-[10px] sm:text-xs font-bold transition ${sel ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow" : "bg-[var(--user-bg-card)] border border-[var(--user-border)] text-[var(--user-text)] hover:border-[var(--user-accent)]/50"}`}
                      >
                        <Sparkles size={11} className={sel ? "text-white" : "text-purple-500"} />
                        <span>{badge}</span>
                        {saveAmt > 0 && (
                          <span className={`text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded ${sel ? "bg-white/20 text-white" : "bg-[var(--user-success)]/10 text-[var(--user-success)] border border-[var(--user-success)]/20"}`}>
                            Save Rs. {saveAmt.toLocaleString()}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-end gap-2 sm:gap-3 flex-wrap">
              <span className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-[var(--user-text)] leading-none">Rs. {activePrice.toLocaleString()}</span>
              {activeHasDiscount && activeOriginalPrice > activePrice && (
                <span className="text-sm sm:text-base text-[var(--user-text-subtle)] line-through pb-0.5">Rs. {activeOriginalPrice.toLocaleString()}</span>
              )}
              {discountPct > 0 && (
                <span className="text-[10px] sm:text-xs font-bold text-[var(--user-success)] bg-[var(--user-success)]/10 border border-[var(--user-success)]/20 px-2 py-1 rounded-lg">-{discountPct}%</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {activeSavings > 0 && (
                <span className="text-[10px] sm:text-xs font-semibold text-[var(--user-success)] flex items-center gap-1.5">
                  <Tag size={12} /> You save Rs. {activeSavings.toLocaleString()}{regularDiscountName && !isDealMode ? ` · ${regularDiscountName}` : ""}
                </span>
              )}
              {isDealMode && dealInfo && (
                <span className="text-[10px] sm:text-[11px] font-bold text-purple-400 [.light_&]:text-purple-700 bg-purple-500/10 border border-purple-500/20 px-2 sm:px-2.5 py-1 rounded-full flex items-center gap-1.5">
                  <Sparkles size={11} /> {dealInfo.dealBadge}
                </span>
              )}
            </div>
            {hasDeal && !isDealMode && (
              <p className="text-[10px] sm:text-[11px] text-[var(--user-text-muted)] flex items-center gap-1.5">
                <Sparkles size={11} className="text-orange-500" /> Also available in a deal — switch above to grab the deal price.
              </p>
            )}
          </div>

          {highlightEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {highlightEntries.map(([k, v]) => (
                <span key={k} className="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-1 rounded-lg bg-[var(--user-bg-hover)] border border-[var(--user-border)] text-[var(--user-text-secondary)]">
                  <span className="font-semibold text-[var(--user-text)] capitalize">{k}:</span> {String(v)}
                </span>
              ))}
            </div>
          )}

          {variants.length > 1 && (
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--user-text-secondary)] mb-2 sm:mb-2.5">Variant</p>
              <div className="flex flex-wrap gap-2 sm:gap-2.5">
                {variants.map((v, i) => {
                  const isOut = toNum(v.quantity) < 1;
                  const sel = i === variantIndex;
                  return (
                    <button key={v._id || i} onClick={() => selectVariant(i)} disabled={isOut}
                      className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl border text-[13px] sm:text-sm font-semibold transition-all ${sel ? "border-[var(--user-accent)] bg-[var(--user-accent)] text-[var(--user-accent-text)] shadow" : isOut ? "opacity-40 line-through cursor-not-allowed border-[var(--user-border)] text-[var(--user-text-subtle)]" : "border-[var(--user-border)] bg-[var(--user-bg-card)] text-[var(--user-text-secondary)] hover:border-[var(--user-accent)]/50 hover:text-[var(--user-text)]"}`}>
                      {v.title || v.sku || `Option ${i + 1}`}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {variants.length > 1 && (
            <div>
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--user-text-secondary)] mb-2 sm:mb-2.5">Colour</p>
              <div className="flex flex-wrap gap-2.5 sm:gap-3">
                {variants.map((v, i) => {
                  const firstImg = (v.images || [])[0];
                  const url = firstImg ? getImageUrl(firstImg) : null;
                  const isOut = toNum(v.quantity) < 1;
                  const sel = i === variantIndex;
                  return (
                    <button key={v._id || i} onClick={() => selectVariant(i)} disabled={isOut} aria-label={v.title || `Option ${i + 1}`} title={v.title || `Option ${i + 1}`}
                      className={`relative w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden border-2 transition-all ${sel ? "border-[var(--user-accent)] ring-2 ring-[var(--user-accent)]/25 scale-105" : "border-[var(--user-border)] hover:border-[var(--user-accent)]/50"} ${isOut ? "opacity-30 cursor-not-allowed" : ""}`}>
                      {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-[11px] sm:text-xs font-bold bg-[var(--user-bg-hover)] text-[var(--user-text-secondary)]">{(v.title || "?").charAt(0)}</span>}
                      {sel && <Check size={13} className="absolute inset-0 m-auto text-white drop-shadow-md" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

                <div className="space-y-2.5 sm:space-y-3">
            {/* ✅ MOBILE Row 1 — qty + wishlist icon + live total */}
            <div className="flex items-center gap-2 sm:hidden">
              <div className="flex items-center h-11 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shrink-0">
                <button onClick={decrement} className="px-3 h-full text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition-colors" aria-label="Decrease"><Minus size={15} /></button>
                <span className="w-8 text-center text-sm font-bold text-[var(--user-text)]">{quantity}</span>
                <button onClick={increment} className="px-3 h-full text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition-colors" aria-label="Increase"><Plus size={15} /></button>
              </div>
              <button onClick={() => productId && toggleWishlist(productId)} aria-label="Wishlist"
                className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-all active:scale-90 ${liked ? "bg-[var(--user-danger)]/10 border-[var(--user-danger)]/30 text-[var(--user-danger)]" : "border-[var(--user-border)] text-[var(--user-text-secondary)]"}`}>
                <Heart size={18} fill={liked ? "currentColor" : "none"} />
              </button>
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[9px] uppercase tracking-wider text-[var(--user-text-muted)] font-bold">Total</p>
                <p className="text-base font-black text-[var(--user-accent)] leading-none truncate">Rs. {(activePrice * quantity).toLocaleString()}</p>
              </div>
            </div>

            {/* ✅ MOBILE Row 2 — Add + Buy side-by-side */}
            <div className="grid grid-cols-2 gap-2 sm:hidden">
              <button onClick={handleAdd} disabled={stock < 1}
                className={`h-11 rounded-xl flex items-center justify-center gap-1.5 text-[12px] font-bold transition active:scale-[0.98] disabled:cursor-not-allowed shadow-lg ${isAdded ? "bg-[var(--user-success)] text-white" : isDealMode ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:opacity-90" : "bg-[var(--user-accent)] text-[var(--user-accent-text)] hover:opacity-90"}`}>
                {isAdded ? <Check size={14} /> : <ShoppingCart size={14} />}
                {stock < 1 ? "Out of Stock" : isAdded ? "Added!" : isDealMode ? "Add Deal" : "Add to Cart"}
              </button>
              <button onClick={handleBuy} disabled={stock < 1}
                className="h-11 rounded-xl border-2 border-[var(--user-accent)] text-[var(--user-accent)] text-[12px] font-bold flex items-center justify-center gap-1.5 hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed">
                <Zap size={14} /><span>Buy Now</span>
              </button>
            </div>

            {/* ✅ DESKTOP (unchanged) — qty + add + buy one row */}
            <div className="hidden sm:flex flex-row gap-3">
              <div className="flex items-center h-12 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shrink-0">
                <button onClick={decrement} className="px-3.5 h-full text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition-colors" aria-label="Decrease"><Minus size={15} /></button>
                <span className="w-10 text-center text-sm font-bold text-[var(--user-text)]">{quantity}</span>
                <button onClick={increment} className="px-3.5 h-full text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition-colors" aria-label="Increase"><Plus size={15} /></button>
              </div>
              <button onClick={handleAdd} disabled={stock < 1}
                className={`flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed shadow-lg ${isAdded ? "bg-[var(--user-success)] text-white" : isDealMode ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:opacity-90" : "bg-[var(--user-accent)] text-[var(--user-accent-text)] hover:opacity-90"}`}>
                {isAdded ? <Check size={15} /> : <ShoppingCart size={15} />}
                {stock < 1 ? "Out of Stock" : isAdded ? "Added!" : isDealMode ? "Add Deal" : "Add to Cart"}
              </button>
              <button onClick={handleBuy} disabled={stock < 1}
                className="flex-1 h-12 rounded-xl border-2 border-[var(--user-accent)] text-[var(--user-accent)] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] active:scale-[0.98] transition disabled:opacity-40 disabled:cursor-not-allowed">
                <Zap size={15} /><span>Buy Now</span>
              </button>
            </div>

            {/* ✅ DESKTOP wishlist full-width (unchanged) */}
            <button onClick={() => productId && toggleWishlist(productId)}
              className={`hidden sm:flex w-full h-11 rounded-xl border items-center justify-center gap-2 text-xs font-bold transition-all ${liked ? "bg-[var(--user-danger)]/10 border-[var(--user-danger)]/30 text-[var(--user-danger)]" : "border-[var(--user-border)] text-[var(--user-text-secondary)] hover:border-[var(--user-danger)]/40 hover:text-[var(--user-danger)]"}`}>
              <Heart size={14} fill={liked ? "currentColor" : "none"} /> {liked ? "Added to Wishlist" : "Add to Wishlist"}
            </button>
          </div>

          <DeliveryInfo storeName={storeName} stock={stock} />
        </div>
      </div>

      {/* Stack on mobile, side-by-side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 lg:gap-8 mt-10 sm:mt-12 lg:mt-14 items-start">
        <div className="lg:col-span-8" style={descHeight ? { height: descHeight } : undefined}>
          <DescriptionCard
            shortDescription={shortDescription}
            fullDescription={fullDescription}
            variantTitle={currentVariant?.title}
            variantDescription={currentVariant?.description}
          />
        </div>
        <div className="lg:col-span-4" ref={specsBoxRef}>
          <SpecsCard attributes={currentVariant?.attributes} />
        </div>
      </div>

      <MoreImagesStack images={allImages} onZoom={openLightbox} />
      <RelatedProducts products={related} />

      <StickyBar show={showStickyBar} name={product.name} price={activePrice} qty={quantity} stock={stock} onAdd={handleAdd} isAdded={isAdded} onWishlist={() => productId && toggleWishlist(productId)} isWishlisted={liked} />
      <Lightbox images={allImages} index={lightbox} onClose={() => setLightbox(null)} onStep={stepLightbox} />
    </main>
  );
}