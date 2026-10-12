"use client";

import { use, useState, useMemo, useCallback, useEffect, useRef, memo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { smartImageLoader } from "@/utils/smartImageLoader";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  ShoppingCart, ChevronRight, ChevronLeft, ChevronDown, Clock3,
  Minus, Plus, Package, X, Check, Zap, ZoomIn, Tag, Sparkles, Heart, Star,
  Store, ShieldCheck, ZoomIn as ZoomHintIcon,
} from "lucide-react";

import { productApi } from "@/apis/user/productApi";
import { storeApi } from "@/apis/user/storeApi";
import { userHttp } from "@/apis/axiosInstance";
import { reviewApi } from "@/apis/user/reviewApi";
import ProductRating, { ReviewMediaGallery, StoreResponse } from "@/components/user/ProductReviews";
import { useCart } from "@/components/user/CartContext";
import { useDiscounts } from "@/components/user/DiscountContext";
import { useWishlist } from "@/components/user/WishlistContext";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const DEFAULT_QTY = 1;
const MAX_RELATED = 10;

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

// ✅ Variant attribute values are not always plain strings — resolve readable text
// so the page never prints "[object Object]".
const attrValueOf = (raw) => {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") return String(raw).trim();
  if (Array.isArray(raw)) return raw.map(attrValueOf).filter(Boolean).join(", ");
  if (typeof raw === "object") {
    const direct = raw.value ?? raw.label ?? raw.name ?? raw.display ?? raw.title ?? raw.text;
    if (direct !== undefined && direct !== null && direct !== raw) return attrValueOf(direct);
    return Object.values(raw).map(attrValueOf).filter(Boolean).join(", ");
  }
  return String(raw);
};

// ✅ [name, readableValue] pairs from a variant.attributes map — empties dropped
const attrEntries = (attributes, limit) => {
  const list = Object.entries(attributes || {})
    .map(([name, raw]) => [String(name || "").trim(), attrValueOf(raw)])
    .filter(([name, value]) => name && value && value !== "[object Object]");
  return typeof limit === "number" ? list.slice(0, limit) : list;
};

const getDealBadgeText = (deal) => {
  if (!deal?.type) return deal?.name || "Deal";
  if (deal.type === "percentage") return Number(deal.discountValue) > 0 ? `${deal.discountValue}% OFF` : null;
  if (deal.type === "fixed_amount") return Number(deal.discountValue) > 0 ? `Rs. ${deal.discountValue} OFF` : null;
  if (deal.type === "buy_x_get_y") {
    const b = deal.buyQuantity || 0, g = deal.getQuantity || 0;
    return b > 0 && g > 0 ? `Buy ${b} Get ${g}` : "Buy X Get Y";
  }
  if (deal.type === "bundle") return "Bundle Deal";
  if (deal.type === "free_shipping") return "Free Shipping";
  return deal.name || "Deal";
};

// ✅ Flash-sale countdown — sirf real deal.endDate se
function useCountdown(endDate) {
  const target = useMemo(() => {
    const t = endDate ? new Date(endDate).getTime() : 0;
    return Number.isFinite(t) ? t : 0;
  }, [endDate]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function useProductDetail(productId) {
  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["product", productId], queryFn: () => productApi.getById(productId), enabled: !!productId, retry: false,
  });
  return { product, isLoading, isError };
}

// ✅ Related — same category, server se (khud ko filter karke 10 tak)
function useRelatedProducts(product, categoryId) {
  const { data } = useQuery({
    queryKey: ["relatedProducts", product?._id || product?.id, categoryId],
    queryFn: () =>
      productApi.getAllPaginated({
        page: 1,
        limit: MAX_RELATED + 1,
        category_id: categoryId || undefined,
      }),
    enabled: !!product && !!categoryId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  const pid = String(product?._id || product?.id || "");
  return useMemo(() => {
    const list = data?.products || [];
    return list.filter((p) => String(p._id) !== pid).slice(0, MAX_RELATED);
  }, [data, pid]);
}

function useVariant(variants = []) {
  const safeVariants = variants.length ? variants : [{ _id: "default", images: [] }];
  const [index, setIndex] = useState(0);
  const [imgIndex, setImgIndex] = useState(0);
  const current = safeVariants[index] || safeVariants[0];
  const currentImages = (current.images || []).map(getImageUrl).filter(Boolean);
  const mainImage = currentImages[imgIndex] || currentImages[0] || null;
  const selectVariant = useCallback((i) => { setIndex(i); setImgIndex(0); }, []);

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

  return { variantIndex: index, currentVariant: current, images: allImages, mainImage, selectVariant, selectImageByUrl, allImages };
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

/* ================= Daraz-style pieces (sirf real data) ================= */

const Breadcrumb = memo(({ categoryId, categoryName, productName }) => (
  <nav className="flex items-center gap-1 text-xs text-[var(--user-text-muted)] flex-wrap py-3">
    <Link href="/" className="text-[var(--user-accent)] hover:underline">Home</Link>
    {categoryName && (
      <>
        <ChevronRight size={12} className="opacity-50" />
        <Link href={`/?category=${categoryId}`} className="text-[var(--user-accent)] hover:underline">{categoryName}</Link>
      </>
    )}
    <ChevronRight size={12} className="opacity-50" />
    <span className="text-[var(--user-text-secondary)] truncate max-w-[12rem] sm:max-w-[24rem] lg:max-w-[32rem]">{productName}</span>
  </nav>
));
Breadcrumb.displayName = "Breadcrumb";

const Stars = memo(({ value = 0, size = 13 }) => (
  <span className="inline-flex items-center gap-[1px]">
    {[1, 2, 3, 4, 5].map((i) => (
      <Star
        key={i}
        size={size}
        className={i <= Math.round(value) ? "fill-[#faca51] text-[#faca51]" : "fill-[#dadada] text-[#dadada]"}
      />
    ))}
  </span>
));
Stars.displayName = "Stars";

function ReviewComment({ comment }) {
  const [expanded, setExpanded] = useState(false);
  if (!comment) return null;
  return (
    <div>
      <p className={`whitespace-pre-line break-words text-sm leading-[1.6] text-[var(--user-text-secondary)] ${expanded ? "" : "line-clamp-4"}`}>{comment}</p>
      {comment.length > 220 && <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-1 min-h-9 text-xs font-semibold text-[var(--user-accent)] hover:underline">{expanded ? "Read less" : "Read more"}</button>}
    </div>
  );
}

const Gallery = memo(({ productName, mainImage, images, onImageSelect, stock, onZoom }) => {
  const stripRef = useRef(null);
  const imageFrameRef = useRef(null);
  const lensRef = useRef(null);
  const zoomPanelRef = useRef(null);
  const moveFrameRef = useRef(0);
  const pendingPointRef = useRef(null);
  const naturalSizeRef = useRef({ width: 1, height: 1 });
  const hoveredRef = useRef(false);
  const updateZoomPositionRef = useRef(null);
  const zoomRequestRef = useRef(0);
  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomLoaded, setZoomLoaded] = useState(false);
  const [hasHovered, setHasHovered] = useState(false);
  const activeIndex = Math.max(0, images.indexOf(mainImage));
  const lensSize = 112;
  const zoomFactor = 2.5;

  const preloadZoomImage = useCallback(() => {
    if (!mainImage || typeof window === "undefined") return;
    const requestId = ++zoomRequestRef.current;
    setZoomLoaded(false);
    const preload = new window.Image();
    preload.onload = () => {
      if (requestId !== zoomRequestRef.current) return;
      naturalSizeRef.current = {
        width: preload.naturalWidth || 1,
        height: preload.naturalHeight || 1,
      };
      setZoomLoaded(true);
      if (hoveredRef.current && !moveFrameRef.current) {
        moveFrameRef.current = window.requestAnimationFrame(() => {
          updateZoomPositionRef.current?.();
        });
      }
    };
    preload.onerror = () => {
      if (requestId === zoomRequestRef.current) setZoomLoaded(false);
    };
    preload.src = mainImage;
  }, [mainImage]);

  const updateZoomPosition = useCallback(() => {
    moveFrameRef.current = 0;
    const frame = imageFrameRef.current;
    const lens = lensRef.current;
    const panel = zoomPanelRef.current;
    const point = pendingPointRef.current;
    if (!frame || !lens || !panel || !point || !hoveredRef.current) return;

    const frameWidth = frame.clientWidth;
    const frameHeight = frame.clientHeight;
    const mainImg = frame.querySelector("img");
    const naturalWidth = mainImg?.naturalWidth || naturalSizeRef.current.width;
    const naturalHeight = mainImg?.naturalHeight || naturalSizeRef.current.height;
    const scale = Math.min(frameWidth / naturalWidth, frameHeight / naturalHeight);
    const imageWidth = naturalWidth * scale;
    const imageHeight = naturalHeight * scale;
    const offsetX = (frameWidth - imageWidth) / 2;
    const offsetY = (frameHeight - imageHeight) / 2;
    const cursorX = Math.max(offsetX, Math.min(point.x, offsetX + imageWidth));
    const cursorY = Math.max(offsetY, Math.min(point.y, offsetY + imageHeight));
    const activeLensSize = Math.min(lensSize, imageWidth, imageHeight);
    lens.style.width = `${activeLensSize}px`;
    lens.style.height = `${activeLensSize}px`;
    const lensLeft = Math.max(offsetX, Math.min(cursorX - activeLensSize / 2, offsetX + imageWidth - activeLensSize));
    const lensTop = Math.max(offsetY, Math.min(cursorY - activeLensSize / 2, offsetY + imageHeight - activeLensSize));
    const centerX = lensLeft + activeLensSize / 2 - offsetX;
    const centerY = lensTop + activeLensSize / 2 - offsetY;

    lens.style.transform = `translate3d(${lensLeft}px, ${lensTop}px, 0)`;
    const panelWidth = panel.clientWidth;
    const panelHeight = panel.clientHeight;
    panel.style.backgroundSize = `${imageWidth * zoomFactor}px ${imageHeight * zoomFactor}px`;
    const backgroundX = Math.min(
      0,
      Math.max(panelWidth - imageWidth * zoomFactor, panelWidth / 2 - centerX * zoomFactor),
    );
    const backgroundY = Math.min(
      0,
      Math.max(panelHeight - imageHeight * zoomFactor, panelHeight / 2 - centerY * zoomFactor),
    );
    panel.style.backgroundPosition = `${backgroundX}px ${backgroundY}px`;
  }, []);

  useEffect(() => {
    updateZoomPositionRef.current = updateZoomPosition;
  }, [updateZoomPosition]);

  const handleMouseMove = useCallback((event) => {
    const bounds = imageFrameRef.current?.getBoundingClientRect();
    if (!bounds) return;
    pendingPointRef.current = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    if (!moveFrameRef.current) {
      moveFrameRef.current = window.requestAnimationFrame(updateZoomPosition);
    }
  }, [updateZoomPosition]);

  const handleMouseEnter = useCallback(() => {
    hoveredRef.current = true;
    setZoomVisible(true);
    setHasHovered(true);
    preloadZoomImage();
  }, [preloadZoomImage]);

  useEffect(() => {
    if (hoveredRef.current && mainImage) preloadZoomImage();
  }, [mainImage, preloadZoomImage]);

  const handleMouseLeave = useCallback(() => {
    hoveredRef.current = false;
    setZoomVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (moveFrameRef.current) window.cancelAnimationFrame(moveFrameRef.current);
    };
  }, []);

  const scrollStrip = (dir) => {
    stripRef.current?.scrollBy({ left: dir * 220, behavior: "smooth" });
  };
  return (
    <div className="product-gallery-zoom relative z-0 min-w-0 lg:hover:z-30">
      <div className="product-gallery-main relative">
      <div
        ref={imageFrameRef}
        className="group relative aspect-square cursor-crosshair overflow-hidden border border-[var(--user-border)] bg-white"
        onClick={() => mainImage && onZoom(mainImage)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        {mainImage ? (
          <Image
            key={mainImage}
            src={mainImage}
            alt={productName}
            fill
            loader={smartImageLoader}
            sizes="(max-width: 1024px) 100vw, 40vw"
            priority
            className="object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white"><Package size={64} strokeWidth={1.25} className="text-gray-300" /></div>
        )}
        {stock === 0 && (
          <span className="absolute top-3 left-3 bg-[var(--user-danger)] text-white text-[11px] font-bold px-2.5 py-1">Out of Stock</span>
        )}
        {stock > 0 && stock < 5 && (
          <span className="absolute top-3 left-3 bg-[var(--user-danger)] text-white text-[11px] font-bold px-2.5 py-1">Only {stock} left</span>
        )}
        <div
          ref={lensRef}
          aria-hidden="true"
          className={`product-image-zoom-lens pointer-events-none absolute left-0 top-0 z-20 h-28 w-28 border border-[var(--user-accent)]/70 bg-[rgba(245,114,36,0.2)] transition-opacity duration-150 ${zoomVisible ? "opacity-100" : "opacity-0"}`}
          style={{ transform: "translate3d(-200px, -200px, 0)" }}
        />
        {!hasHovered && mainImage ? (
          <span className="product-image-zoom-hint pointer-events-none absolute bottom-3 right-3 z-20 inline-flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-[11px] text-white">
            <ZoomHintIcon size={13} aria-hidden="true" />
            Hover to zoom
          </span>
        ) : null}
      </div>
      {mainImage ? (
        <div
          ref={zoomPanelRef}
          aria-hidden="true"
          className={`product-image-zoom-panel pointer-events-none absolute left-full top-0 z-50 h-full w-[min(560px,45vw)] border border-[var(--user-border)] bg-white shadow-xl transition-opacity duration-150 ${zoomVisible ? "opacity-100" : "opacity-0"}`}
          style={{ backgroundImage: `url("${mainImage}")`, backgroundRepeat: "no-repeat" }}
        >
          {!zoomLoaded ? (
            <div className="absolute inset-0 animate-pulse bg-gray-100" />
          ) : null}
        </div>
      ) : null}
      </div>
      {images.length > 1 && (
        <div className="relative mt-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollStrip(-1)}
            aria-label="Previous images"
            className="flex h-12 w-6 shrink-0 items-center justify-center text-[var(--user-text-muted)] hover:text-[var(--user-accent)]"
          >
            <ChevronLeft size={18} />
          </button>
          <div ref={stripRef} className="flex flex-1 gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {images.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onImageSelect(url)}
                aria-label={`View image ${i + 1}`}
                className={`h-12 w-12 shrink-0 overflow-hidden border bg-white ${url === mainImage ? "border-[var(--user-accent)]" : "border-[var(--user-border)] opacity-80 hover:opacity-100"}`}
              >
                <img src={url} alt={`${productName}, image ${i + 1}`} loading="lazy" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => scrollStrip(1)}
            aria-label="Next images"
            className="flex h-12 w-6 shrink-0 items-center justify-center text-[var(--user-text-muted)] hover:text-[var(--user-accent)]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
});
Gallery.displayName = "Gallery";

// ✅ Product details images — pehle sirf pehli image (neeche se fade), "View More" par saari images
const COLLAPSED_IMAGE_HEIGHT = 620;
const DetailImages = memo(({ productName, images, onZoom }) => {
  const [expanded, setExpanded] = useState(false);
  if (!images?.length) return null;
  const hasMore = images.length > 1;
  const visible = expanded || !hasMore ? images : images.slice(0, 1);
  const collapsed = hasMore && !expanded;
  return (
    <div className="mx-auto max-w-4xl">
      <div
        className="relative overflow-hidden"
        style={collapsed ? { maxHeight: COLLAPSED_IMAGE_HEIGHT } : undefined}
      >
        <div className="flex flex-col items-center gap-2">
          {visible.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={`${productName}, image ${i + 1}`}
              loading="lazy"
              onClick={() => onZoom(url)}
              className="h-auto w-full cursor-zoom-in object-contain"
            />
          ))}
        </div>
        {collapsed && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[var(--user-bg-card)] to-transparent" />
        )}
      </div>
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="border border-[var(--user-accent)] px-8 py-2 text-sm font-medium uppercase text-[var(--user-accent)] transition hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)]"
          >
            {expanded ? "View Less" : `View More (${images.length - 1})`}
          </button>
        </div>
      )}
    </div>
  );
});
DetailImages.displayName = "DetailImages";

const StickyBar = memo(({ show, name, price, qty, stock, onAdd, isAdded }) => {
  if (!show) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-2xl md:hidden" style={{ animation: "slideUp .25s ease" }}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] text-[var(--user-text-muted)]">{name}</p>
          <p className="text-base font-bold text-[var(--user-accent)]">Rs. {(price * qty).toLocaleString()}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={stock < 1}
          className={`flex h-10 flex-1 items-center justify-center gap-1.5 text-xs font-bold disabled:opacity-40 ${isAdded ? "bg-[var(--user-success)] text-white" : "bg-[var(--user-accent)] text-[var(--user-accent-text)]"}`}
        >
          {isAdded ? <Check size={14} /> : <ShoppingCart size={14} />}
          {stock < 1 ? "Out of Stock" : isAdded ? "Added!" : "Add to Cart"}
        </button>
      </div>
    </div>
  );
});
StickyBar.displayName = "StickyBar";

const Lightbox = memo(({ images, index, onClose, onStep }) => {
  const [zoom, setZoom] = useState({ index, scale: 1 });
  const zoomScale = zoom.index === index ? zoom.scale : 1;
  const touchGestureRef = useRef(null);

  useEffect(() => {
    if (index === null) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onStep(-1);
      if (event.key === "ArrowRight") onStep(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, onClose, onStep]);

  if (index === null || !images?.length) return null;

  const handleTouchStart = (event) => {
    if (event.touches.length === 2) {
      const [first, second] = event.touches;
      touchGestureRef.current = {
        type: "pinch",
        distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
        scale: zoomScale,
      };
    } else if (event.touches.length === 1) {
      touchGestureRef.current = { type: "swipe", x: event.touches[0].clientX };
    }
  };

  const handleTouchMove = (event) => {
    const gesture = touchGestureRef.current;
    if (gesture?.type !== "pinch" || event.touches.length !== 2) return;
    event.preventDefault();
    const [first, second] = event.touches;
    const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
    setZoom({ index, scale: Math.max(1, Math.min(4, gesture.scale * (distance / gesture.distance))) });
  };

  const handleTouchEnd = (event) => {
    const gesture = touchGestureRef.current;
    if (gesture?.type === "swipe" && event.changedTouches.length && zoomScale === 1) {
      const delta = event.changedTouches[0].clientX - gesture.x;
      if (Math.abs(delta) > 55) onStep(delta > 0 ? -1 : 1);
    }
    touchGestureRef.current = null;
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Product image viewer" className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button type="button" onClick={(event) => { event.stopPropagation(); onClose(); }} className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="Close"><X size={20} /></button>
      <button type="button" onClick={(e) => { e.stopPropagation(); onStep(-1); }} className="absolute left-3 lg:left-6 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="Previous"><ChevronLeft size={20} /></button>
      <img
        src={images[index]}
        alt=""
        className="max-w-[92vw] max-h-[82vh] object-contain rounded-lg"
        style={{ transform: `scale(${zoomScale})`, touchAction: "none" }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      <button type="button" onClick={(e) => { e.stopPropagation(); onStep(1); }} className="absolute right-3 lg:right-6 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors" aria-label="Next"><ChevronRight size={20} /></button>
      <span className="absolute bottom-4 text-white/60 text-xs font-medium">{index + 1} / {images.length}</span>
    </div>
  );
});
Lightbox.displayName = "Lightbox";

const LoadingState = () => (
  <div className="user-shell px-3 lg:px-8 py-4">
    <div className="h-4 w-64 bg-[var(--user-bg-hover)] rounded animate-pulse mb-3" />
    <div className="grid lg:grid-cols-12 gap-3">
      <div className="lg:col-span-9 bg-[var(--user-bg-card)] p-4 grid md:grid-cols-2 gap-6">
        <div className="aspect-square bg-[var(--user-bg-hover)] animate-pulse" />
        <div className="space-y-3">
          <div className="h-5 w-3/4 bg-[var(--user-bg-hover)] rounded animate-pulse" />
          <div className="h-8 w-1/2 bg-[var(--user-bg-hover)] rounded animate-pulse" />
          <div className="h-11 w-full bg-[var(--user-bg-hover)] rounded animate-pulse" />
        </div>
      </div>
      <div className="lg:col-span-3 bg-[var(--user-bg-card)] p-4 h-48 animate-pulse" />
    </div>
  </div>
);

const ErrorState = ({ isError }) => (
  <div className="user-shell px-4 py-16 text-center">
    <div className="w-14 h-14 mx-auto bg-[var(--user-bg-card)] border border-[var(--user-border)] flex items-center justify-center mb-4">
      <Package size={24} className="text-[var(--user-accent)]" />
    </div>
    <h1 className="text-lg font-bold text-[var(--user-text)] mb-2">{isError ? "Something Went Wrong" : "Product Not Found"}</h1>
    <p className="text-[var(--user-text-muted)] text-sm mb-6 max-w-sm mx-auto">{isError ? "We could not load this product. Please try again later." : "This product may have been removed."}</p>
    <Link href="/" className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-6 py-2.5 text-sm font-bold hover:opacity-90 transition">Back to Home</Link>
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
  const { product, isLoading, isError } = useProductDetail(id);

  // ✅ User ki apni ratings — product page par sirf apni di hui rating dikhani hai.
  const { data: user = null } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await userHttp.get("/users/profile");
      return res.data?.user || res.data || null;
    },
    retry: false,
  });
  const { data: myReviews = [] } = useQuery({
    queryKey: ["myReviews"],
    queryFn: reviewApi.mine,
    enabled: !!user,
    retry: false,
  });

  const { data: store = null } = useQuery({ queryKey: ["storeInfo"], queryFn: storeApi.getPublic, staleTime: 5 * 60 * 1000 });
  const storeName = store?.store_name || "";

  const variants = product?.variants?.length ? product.variants : [{ _id: "default", images: [] }];
  const { variantIndex, currentVariant, images, mainImage, selectVariant, selectImageByUrl, allImages } = useVariant(variants);

  const stock = toNum(currentVariant?.quantity);
  const { quantity, increment, decrement, reset } = useQuantity(stock);
  useEffect(() => reset(), [variantIndex, reset]);

  const { isAdded, trigger } = useAddFeedback();
  const { addToCart, setIsCartOpen } = useCart();
  const { calculateProductDiscount, getActiveDealsForProduct } = useDiscounts();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [lightbox, setLightbox] = useState(null);
  const { show: showStickyBar, sentinelRef } = useStickyBar();

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
  const [dealsOpen, setDealsOpen] = useState(false);
  useEffect(() => {
    if (cameFromDeal && hasDeal) setDealsOpen(true);
  }, [cameFromDeal, hasDeal]);
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

  const dealDisc = useMemo(
    () => (hasDeal && matchedDeal ? calculateProductDiscount(product, variantPrice, true, matchedDeal) : null),
    [calculateProductDiscount, product, hasDeal, variantPrice, matchedDeal]
  );
  const dealPrice = dealDisc ? dealDisc.discountedPrice : variantPrice;
  const dealOriginalPrice = dealDisc && dealDisc.hasDiscount ? dealDisc.originalPrice : variantOldPrice;

  const isDealMode = purchaseMode === "deal" && hasDeal;
  const activePrice = isDealMode ? dealPrice : regularPrice;
  const activeOriginalPrice = isDealMode ? dealOriginalPrice : regularOriginalPrice;
  const activeHasDiscount = isDealMode ? (dealOriginalPrice > dealPrice) : regularHasDiscount;
  const discountPct = activeHasDiscount && activeOriginalPrice > 0 ? Math.round(((activeOriginalPrice - activePrice) / activeOriginalPrice) * 100) : 0;

  const selectedDealInfo = useMemo(() => {
    if (!isDealMode || !matchedDeal) return null;
    return {
      dealId: matchedDeal._id,
      dealType: matchedDeal.type,
      dealName: matchedDeal.name,
      dealBadge: getDealBadgeText(matchedDeal) || null,
      savings: dealDisc?.hasDiscount ? dealDisc.originalPrice - dealDisc.discountedPrice : 0,
      originalPrice: Number(dealDisc?.originalPrice) || variantPrice,
      dealDiscountValue: Number(matchedDeal.discountValue) || 0,
      minQuantity: Number(matchedDeal.minQuantity) || 1,
      ...(matchedDeal.type === "buy_x_get_y"
        ? {
            buyQuantity: Number(matchedDeal.buyQuantity) || 0,
            getQuantity: Number(matchedDeal.getQuantity) || 0,
          }
        : {}),
    };
  }, [isDealMode, matchedDeal, dealDisc, variantPrice]);

  const countdown = useCountdown(isDealMode ? matchedDeal?.endDate : null);

  const handleAdd = useCallback(() => {
    if (stock < 1 || !product) return;
    addToCart(product, currentVariant, quantity, selectedDealInfo);
    trigger();
  }, [stock, product, currentVariant, quantity, addToCart, trigger, selectedDealInfo]);

  const handleBuy = useCallback(() => {
    if (stock < 1 || !product) return;
    addToCart(product, currentVariant, quantity, selectedDealInfo);
    setIsCartOpen(true);
  }, [stock, product, currentVariant, quantity, addToCart, setIsCartOpen, selectedDealInfo]);

  const categoryId = extractId(product?.category_id);
  const categoryName = extractName(product?.category_id);
  const brandName = extractName(product?.brand_id);
  const brandId = extractId(product?.brand_id);

  const fullDescription = product?.description || "";
  const shortDescription = product?.short_description || "";
  const specEntries = attrEntries(currentVariant?.attributes);
  const variantAttrName = specEntries.length > 0 ? specEntries[0][0] : (variants.length > 1 ? "Option" : "");
  const expiryDuration = Number(product?.expiryDuration);
  const expiryUnit = String(product?.expiryUnit || "").toLowerCase();
  const expiryUnitName = { days: "Day", months: "Month", years: "Year" }[expiryUnit] || "";
  const expiryUnitLabel = expiryUnitName ? `${expiryUnitName}${expiryDuration === 1 ? "" : "s"}` : "";
  const showExpiryInfo = product?.isPerishable === true
    && Number.isFinite(expiryDuration)
    && expiryDuration > 0
    && !!expiryUnitLabel;

  const related = useRelatedProducts(product, categoryId);
  const productId = product?._id || product?.id;
  const liked = productId ? isWishlisted(productId) : false;

  // ✅ Is product ke liye user ki apni rating (agar di ho).
  const myReview = useMemo(() => {
    if (!productId) return null;
    return myReviews.find((r) => String(r.product_id?._id || r.product_id) === String(productId)) || null;
  }, [myReviews, productId]);

  // ✅ Public reviews summary — real backend data (avg / count / 5→1 distribution)
  const { data: publicReviewData = null } = useQuery({
    queryKey: ["productReviews", productId],
    queryFn: () => reviewApi.list(productId, { page: 1, limit: 5 }),
    enabled: !!productId,
    retry: false,
  });
  const summary = publicReviewData?.summary || { avg: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
  const publicReviews = publicReviewData?.reviews || [];
  const reviewsToDisplay = myReview?._id
    ? publicReviews.filter((review) => String(review._id) !== String(myReview._id))
    : publicReviews;
  const ratingAvg = Number(summary.avg) || 0;
  const ratingCount = Number(summary.count) || 0;

  if (isLoading) return <LoadingState />;
  if (isError || !product) return <ErrorState isError={isError} />;

  return (
    <main className="min-h-screen bg-[var(--user-bg-hover)] pb-16 md:pb-8">
      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      <div className="user-shell px-3 lg:px-8">
        <Breadcrumb categoryId={categoryId} categoryName={categoryName} productName={product.name} />

        {/* ===== Top card: gallery + info + sold-by (Daraz 3-col) ===== */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          <section className="bg-[var(--user-bg-card)] p-3 sm:p-4 lg:col-span-9 xl:col-span-10">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <Gallery
                productName={product.name}
                mainImage={mainImage}
                images={images}
                onImageSelect={selectImageByUrl}
                stock={stock}
                onZoom={openLightbox}
              />

              <div className="min-w-0" ref={sentinelRef}>
                {/* Flash sale — sirf real deal par */}
                {isDealMode && matchedDeal && (
                  <div className="mb-2 flex items-stretch justify-between border border-[var(--user-accent)]/30">
                    <div className="flex items-center gap-2 bg-[var(--user-accent)] px-3 py-1.5">
                      <Zap size={14} className="fill-[var(--user-accent-text)] text-[var(--user-accent-text)]" />
                      <span className="text-xs font-black italic tracking-wide text-[var(--user-accent-text)]">FLASH SALE</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-[var(--user-text-secondary)]">
                      {countdown ? (
                        <span>Ends in <span className="font-bold text-[var(--user-accent)] tabular-nums">{countdown}</span></span>
                      ) : (
                        <span className="font-semibold">{matchedDeal.name || "Limited time deal"}</span>
                      )}
                    </div>
                  </div>
                )}

                <h1 className="text-lg sm:text-xl font-normal leading-snug text-[var(--user-text)] break-words">{product.name}</h1>

                {/* Rating + wishlist */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Stars value={ratingAvg} />
                    <span className="text-xs text-[var(--user-accent)]">
                      {ratingCount > 0 ? `${ratingAvg}/5 (${ratingCount} Rating${ratingCount > 1 ? "s" : ""})` : "No Ratings"}
                    </span>
                    {myReview && (
                      <span className="text-xs font-bold text-amber-500">· Your rating: {myReview.rating}/5</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[var(--user-text-muted)]">
                    <button
                      type="button"
                      onClick={() => productId && toggleWishlist(productId)}
                      aria-label={liked ? "Remove from wishlist" : "Add to wishlist"}
                      className={`${liked ? "text-[var(--user-accent)]" : ""} hover:text-[var(--user-accent)] transition-colors`}
                    >
                      <Heart size={17} fill={liked ? "currentColor" : "none"} />
                    </button>
                  </div>
                </div>

                {/* Brand row — real brand/category */}
                {(brandName || categoryName) && (
                  <p className="mt-2 text-xs text-[var(--user-text-muted)]">
                    {brandName && (
                      <>Brand: <Link href={`/?brand=${brandId}`} className="text-[var(--user-accent)] hover:underline">{brandName}</Link></>
                    )}
                    {brandName && categoryName && <span className="mx-1.5 text-[var(--user-text-subtle)]">|</span>}
                    {categoryName && (
                      <>More {categoryName} from <Link href={`/?brand=${brandId}`} className="text-[var(--user-accent)] hover:underline">{brandName || storeName || "this store"}</Link></>
                    )}
                  </p>
                )}

                <div className="my-3 border-t border-[var(--user-border)]" />

                {/* Price — real */}
                <div>
                  <p className="text-3xl font-medium text-[var(--user-accent)]">Rs. {activePrice.toLocaleString()}</p>
                  {activeHasDiscount && activeOriginalPrice > activePrice && (
                    <p className="mt-1 text-xs text-[var(--user-text-muted)]">
                      <span className="line-through">Rs. {activeOriginalPrice.toLocaleString()}</span>
                      <span className="ml-1.5 font-semibold text-[var(--user-text)]">-{discountPct}%</span>
                    </p>
                  )}
                </div>

                {/* Purchase options — 1) Regular (original + admin discount)  2) Deals dropdown */}
                {hasDeal && (
                  <div className="mt-3 border border-[var(--user-border)]">
                    {/* Option 1 — Regular */}
                    <button
                      type="button"
                      onClick={() => { userSelectedModeRef.current = true; setPurchaseMode("regular"); }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${!isDealMode ? "bg-[var(--user-accent)]/5" : "hover:bg-[var(--user-bg-hover)]"}`}
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${!isDealMode ? "border-[var(--user-accent)]" : "border-[var(--user-text-subtle)]"}`}>
                        {!isDealMode && <span className="h-2 w-2 rounded-full bg-[var(--user-accent)]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-[var(--user-text)]">Regular Price</span>
                        <span className="flex items-center gap-1 text-[11px] text-[var(--user-text-muted)]">
                          <Tag size={11} />
                          {regularHasDiscount && regularDisc.discountName
                            ? `${regularDisc.discountName} applied`
                            : "Original price"}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-bold text-[var(--user-text)]">Rs. {regularPrice.toLocaleString()}</span>
                        {regularHasDiscount && regularOriginalPrice > regularPrice && (
                          <span className="block text-[11px] text-[var(--user-text-muted)] line-through">Rs. {regularOriginalPrice.toLocaleString()}</span>
                        )}
                      </span>
                    </button>

                    {/* Option 2 — Deals dropdown header */}
                    <button
                      type="button"
                      onClick={() => {
                        userSelectedModeRef.current = true;
                        if (!isDealMode) {
                          setPurchaseMode("deal");
                          setDealsOpen(true);
                        } else {
                          setDealsOpen((o) => !o);
                        }
                      }}
                      className={`flex w-full items-center gap-2.5 border-t border-[var(--user-border)] px-3 py-2.5 text-left transition-colors ${isDealMode ? "bg-[var(--user-accent)]/5" : "hover:bg-[var(--user-bg-hover)]"}`}
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${isDealMode ? "border-[var(--user-accent)]" : "border-[var(--user-text-subtle)]"}`}>
                        {isDealMode && <span className="h-2 w-2 rounded-full bg-[var(--user-accent)]" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--user-text)]">
                          <Sparkles size={12} className="text-[var(--user-accent)]" /> Deal Offers
                          <span className="bg-[var(--user-accent)]/10 px-1.5 py-0.5 text-[10px] font-bold text-[var(--user-accent)] tabular-nums">{allDeals.length}</span>
                        </span>
                        <span className="block text-[11px] text-[var(--user-text-muted)]">
                          {isDealMode && matchedDeal ? (matchedDeal.name || getDealBadgeText(matchedDeal) || "Deal selected") : "Tap to view all deals on this product"}
                        </span>
                      </span>
                      <ChevronDown size={15} className={`shrink-0 text-[var(--user-text-muted)] transition-transform ${dealsOpen ? "rotate-180" : ""}`} />
                    </button>

                    {/* Dropdown — is product par lagi tamam real deals */}
                    {dealsOpen && (
                      <div className="border-t border-[var(--user-border)]">
                        <div className="max-h-44 space-y-1 overflow-y-auto p-2">
                          {allDeals.map((d) => {
                            const sel = isDealMode && String(d._id) === String(selectedDealId);
                            const dd = calculateProductDiscount(product, variantPrice, true, d);
                            const saveAmt = dd && dd.hasDiscount ? (dd.originalPrice - dd.discountedPrice) : 0;
                            return (
                              <button
                                key={d._id}
                                type="button"
                                onClick={() => {
                                  userSelectedModeRef.current = true;
                                  setSelectedDealId(d._id);
                                  setPurchaseMode("deal");
                                }}
                                className={`flex w-full items-center gap-2 border px-2.5 py-2 text-left text-xs transition-colors ${sel ? "border-[var(--user-accent)] bg-[var(--user-accent)]/5" : "border-[var(--user-border)] hover:border-[var(--user-accent)]/50"}`}
                              >
                                <Sparkles size={13} className="shrink-0 text-[var(--user-accent)]" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-semibold text-[var(--user-text)]">{d.name || getDealBadgeText(d) || "Deal"}</span>
                                  <span className="block text-[11px] text-[var(--user-text-muted)]">
                                    Rs. {dd.discountedPrice.toLocaleString()}
                                    {saveAmt > 0 && <span className="ml-1.5 font-semibold text-[var(--user-success)]">Save Rs. {saveAmt.toLocaleString()}</span>}
                                  </span>
                                </span>
                                {sel && <Check size={14} className="shrink-0 text-[var(--user-accent)]" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Variant selector — real variants */}
                {variants.length > 1 && (
                  <div className="mt-4">
                    <p className="text-xs text-[var(--user-text-muted)]">
                      {variantAttrName || "Option"}: <span className="text-[var(--user-text)]">{currentVariant?.title || currentVariant?.sku || `Option ${variantIndex + 1}`}</span>
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {variants.map((variant, index) => {
                        const selected = index === variantIndex;
                        const unavailable = toNum(variant.quantity) < 1;
                        const image = getImageUrl(variant.images?.[0]);
                        return (
                          <button
                            key={variant._id || index}
                            type="button"
                            onClick={() => selectVariant(index)}
                            disabled={unavailable}
                            title={variant.title || variant.sku || `Option ${index + 1}`}
                            className={`flex h-11 min-w-11 items-center justify-center gap-2 border px-1.5 text-xs ${selected ? "border-[var(--user-accent)] ring-1 ring-[var(--user-accent)]" : "border-[var(--user-border)] hover:border-[var(--user-accent)]/60"} ${unavailable ? "cursor-not-allowed opacity-40" : ""}`}
                          >
                            {image ? (
                              <img src={image} alt="" className="h-9 w-9 object-contain" loading="lazy" />
                            ) : (
                              <span className="px-2 font-medium text-[var(--user-text)]">{variant.title || variant.sku || index + 1}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {showExpiryInfo && (
                  <div
                    className="mt-3 rounded-xl border p-3.5 sm:p-4"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--user-accent) 8%, var(--user-bg-card))",
                      borderColor: "color-mix(in srgb, var(--user-accent) 24%, var(--user-border))",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                        style={{
                          backgroundColor: "color-mix(in srgb, var(--user-accent) 14%, transparent)",
                          color: "var(--user-accent)",
                        }}
                      >
                        <Clock3 size={17} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-[var(--user-text)]">Perishable Product</p>
                        <p className="mt-1 text-sm font-medium text-[var(--user-text)]">
                          Valid for {expiryDuration} {expiryUnitLabel} after delivery
                        </p>
                        <p className="mt-1 text-[11px] leading-4 text-[var(--user-text-muted)]">
                          Please consume or use before the validity period ends.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quantity — real stock */}
                <div className="mt-4 flex items-center gap-4">
                  <span className="text-xs text-[var(--user-text-muted)]">Quantity</span>
                  <div className="flex items-center">
                    <button
                      onClick={decrement}
                      disabled={quantity <= 1}
                      className="flex h-7 w-7 items-center justify-center bg-[var(--user-bg-hover)] text-[var(--user-text-muted)] hover:text-[var(--user-accent)] disabled:opacity-40"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-10 text-center text-sm text-[var(--user-text)] tabular-nums">{quantity}</span>
                    <button
                      onClick={increment}
                      disabled={quantity >= Math.max(stock, 1)}
                      className="flex h-7 w-7 items-center justify-center bg-[var(--user-bg-hover)] text-[var(--user-text-muted)] hover:text-[var(--user-accent)] disabled:opacity-40"
                      aria-label="Increase quantity"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  {stock < 1 ? (
                    <span className="text-xs font-semibold text-[var(--user-accent)]">Out of stock</span>
                  ) : null}
                </div>

                {/* CTA — Daraz cyan/orange */}
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <button
                    onClick={handleBuy}
                    disabled={stock < 1}
                    className="flex h-11 items-center justify-center gap-1.5 border-2 border-[var(--user-accent)] text-sm font-medium text-[var(--user-accent)] hover:bg-[var(--user-accent)] hover:text-[var(--user-accent-text)] active:scale-[0.99] transition disabled:opacity-40"
                  >
                    Buy Now
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={stock < 1}
                    className={`flex h-11 items-center justify-center gap-1.5 text-sm font-medium active:scale-[0.99] transition disabled:opacity-40 ${isAdded ? "bg-[var(--user-success)] text-white" : "bg-[var(--user-accent)] text-[var(--user-accent-text)] hover:opacity-90"}`}
                  >
                    {isAdded ? <Check size={15} /> : null}
                    {stock < 1 ? "Out of Stock" : isAdded ? "Added!" : "Add to Cart"}
                  </button>
                </div>

              </div>
            </div>
          </section>

          {/* ===== Right sidebar — sirf real data (no fake fees/location) ===== */}
          <aside className="space-y-3 lg:col-span-3 xl:col-span-2">
            <div className="bg-[var(--user-bg-card)]">
              <p className="border-b border-[var(--user-border)] px-3 py-2.5 text-xs font-semibold text-[var(--user-text-muted)]">Sold by</p>
              <div className="px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center bg-[var(--user-accent)]/10">
                    <Store size={17} className="text-[var(--user-accent)]" />
                  </span>
                  <p className="text-sm font-semibold text-[var(--user-text)]">{storeName || "Official Store"}</p>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <ShieldCheck size={14} className={stock > 0 ? "text-[var(--user-success)]" : "text-[var(--user-text-muted)]"} />
                  {stock > 0 ? (
                    <span className="text-[var(--user-text-secondary)]">In stock, ready to ship</span>
                  ) : (
                    <span className="text-[var(--user-accent)] font-semibold">Currently unavailable</span>
                  )}
                </div>
              </div>
            </div>

            {specEntries.length > 0 && (
              <div className="hidden bg-[var(--user-bg-card)] lg:block">
                <p className="border-b border-[var(--user-border)] px-3 py-2.5 text-xs font-semibold text-[var(--user-text-muted)]">Highlights</p>
                <ul className="space-y-1.5 px-3 py-3">
                  {specEntries.slice(0, 4).map(([k, v]) => (
                    <li key={k} className="text-xs text-[var(--user-text-secondary)]">
                      <span className="font-semibold capitalize text-[var(--user-text)]">{k}: </span>{v}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>

        {/* ===== Product details — real description ===== */}
        {(shortDescription || fullDescription || currentVariant?.description) && (
          <section className="mt-3 bg-[var(--user-bg-card)]">
            <h2 className="border-b border-[var(--user-border)] px-3 sm:px-4 py-3 text-sm font-bold text-[var(--user-text)]">
              Product details of {shortDescription || product.name}
            </h2>
            <div className="space-y-3 px-3 sm:px-4 py-4 text-sm leading-7 text-[var(--user-text)]">
              {shortDescription && <p className="font-medium">{shortDescription}</p>}
              {fullDescription && <p className="whitespace-pre-line break-words text-[var(--user-text-secondary)]">{fullDescription}</p>}
              {currentVariant?.description && (
                <p className="whitespace-pre-line break-words text-[var(--user-text-secondary)]">
                  <span className="font-semibold text-[var(--user-text)]">{currentVariant?.title || "Selected option"}: </span>
                  {currentVariant.description}
                </p>
              )}
            </div>
          </section>
        )}

        {/* ===== Specifications — sirf real fields ===== */}
        <section className="mt-3 bg-[var(--user-bg-card)]">
          <h2 className="border-b border-[var(--user-border)] px-3 sm:px-4 py-3 text-sm font-bold text-[var(--user-text)]">
            Specifications of {product.name}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 px-3 sm:px-4 py-2">
            {brandName && (
              <div className="border-b border-[var(--user-border)] py-3">
                <p className="text-xs text-[var(--user-text-muted)]">Brand</p>
                <p className="mt-0.5 text-sm text-[var(--user-text)]">{brandName}</p>
              </div>
            )}
            {currentVariant?.sku && (
              <div className="border-b border-[var(--user-border)] py-3">
                <p className="text-xs text-[var(--user-text-muted)]">SKU</p>
                <p className="mt-0.5 text-sm text-[var(--user-text)] break-all">{currentVariant.sku}</p>
              </div>
            )}
            {specEntries.map(([k, v]) => (
              <div key={k} className="border-b border-[var(--user-border)] py-3">
                <p className="text-xs capitalize text-[var(--user-text-muted)]">{k}</p>
                <p className="mt-0.5 text-sm text-[var(--user-text)] break-words">{v}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== Ratings & Reviews — real summary + real reviews ===== */}
        <section className="mt-3 bg-[var(--user-bg-card)]">
          <h2 className="border-b border-[var(--user-border)] px-3 sm:px-4 py-3 text-sm font-bold text-[var(--user-text)]">
            Ratings &amp; Reviews of {product.name}
          </h2>
          <div className="grid grid-cols-1 gap-6 px-3 sm:px-4 py-5 md:grid-cols-[12rem_1fr]">
            <div>
              <p className="text-4xl font-medium text-[var(--user-text)]">
                {ratingAvg}<span className="text-lg text-[var(--user-text-muted)]">/5</span>
              </p>
              <div className="mt-2"><Stars value={ratingAvg} size={16} /></div>
              <p className="mt-2 text-xs text-[var(--user-text-muted)]">{ratingCount} Rating{ratingCount === 1 ? "" : "s"}</p>
            </div>
            <div className="max-w-md space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const c = Number(summary.distribution?.[star]) || 0;
                const pct = ratingCount > 0 ? Math.round((c / ratingCount) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-14 shrink-0"><Stars value={star} size={11} /></span>
                    <span className="h-2.5 flex-1 bg-[var(--user-bg-hover)]">
                      <span className="block h-full bg-[#faca51]" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="w-6 shrink-0 text-right text-[var(--user-text-muted)] tabular-nums">{c}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[var(--user-border)] px-3 sm:px-4 py-5">
            {myReview && (
              <div className="mb-4">
                <ProductRating productId={productId} productName={product?.name} review={myReview} variant="detail" autoOpen={searchParams.get("editReview") === "1"} />
              </div>
            )}
            {reviewsToDisplay.length > 0 ? (
              <ul className="divide-y divide-[var(--user-border)]">
                {reviewsToDisplay.map((r) => {
                  const reviewerName = r.user_id?.name || "Customer";
                  const reviewDate = r.created_at
                    ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "";
                  return (
                    <li key={r._id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--user-bg-hover)] text-sm font-semibold text-[var(--user-text-secondary)] ring-1 ring-[var(--user-border)]">
                          {reviewerName.trim().charAt(0).toUpperCase() || "C"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="text-sm font-semibold text-[var(--user-text)]">{reviewerName}</p>
                              {r.verifiedPurchase && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400"><Check size={12} strokeWidth={2.5} /> Verified buyer</span>}
                            </div>
                            {reviewDate && <time className="text-xs text-[var(--user-text-muted)]">{reviewDate}</time>}
                          </div>
                          <div className="mt-2"><Stars value={r.rating} size={15} /></div>
                          <p className="mt-1.5 text-base font-semibold text-[var(--user-text)]">{r.title || `${r.rating}/5`}</p>
                          {r.comment && <div className="mt-1"><ReviewComment comment={r.comment} /></div>}
                          {(r.images?.length > 0 || r.videos?.length > 0) && <div className="mt-3"><ReviewMediaGallery images={r.images} videos={r.videos} /></div>}
                          {r.storeResponse?.message && <div className="mt-3"><StoreResponse response={r.storeResponse} /></div>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : !myReview ? (
              <div className="py-6 text-center">
                <p className="text-sm text-[var(--user-text-muted)]">This product has no reviews.</p>
                <p className="mt-1 text-xs text-[var(--user-text-muted)]">Let others know what you think — be the first to write a review after delivery.</p>
              </div>
            ) : null}
          </div>
        </section>

        {/* ===== Product images — Ratings & Reviews ke neeche, "View More" se saari images ===== */}
        {allImages.length > 0 && (
          <section className="mt-3 bg-[var(--user-bg-card)]">
            <h2 className="border-b border-[var(--user-border)] px-3 sm:px-4 py-3 text-sm font-bold text-[var(--user-text)]">
              Product images of {product.name}
            </h2>
            <div className="px-3 sm:px-4 py-4">
              <DetailImages productName={product.name} images={allImages} onZoom={openLightbox} />
            </div>
          </section>
        )}

        {/* ===== You may also like — real related ===== */}
        {related.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 text-base font-bold text-[var(--user-text)]">You may also like</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {related.slice(0, 10).map((p) => {
                const image = getImageUrl(p?.variants?.[0]?.images?.[0] || p?.images?.[0]);
                const price = p?.variants?.[0]?.selling_price ?? p?.selling_price ?? p?.price;
                return (
                  <Link key={p._id} href={`/product/${p._id}`} className="group bg-[var(--user-bg-card)] hover:shadow-lg transition-shadow">
                    <div className="relative aspect-square overflow-hidden bg-white">
                      {image ? (
                        <img src={image} alt={p.name || ""} loading="lazy" className="h-full w-full object-contain p-2 group-hover:scale-[1.03] transition-transform" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center"><Package size={28} className="text-gray-300" /></div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="line-clamp-2 min-h-8 text-xs leading-4 text-[var(--user-text)]">{p.name}</p>
                      {price != null && <p className="mt-1.5 text-sm font-medium text-[var(--user-accent)]">Rs. {toNum(price).toLocaleString()}</p>}
                      <div className="mt-1"><Stars value={0} size={10} /></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <StickyBar show={showStickyBar} name={product.name} price={activePrice} qty={quantity} stock={stock} onAdd={handleAdd} isAdded={isAdded} />
      <Lightbox images={allImages} index={lightbox} onClose={() => setLightbox(null)} onStep={stepLightbox} />
    </main>
  );
}
