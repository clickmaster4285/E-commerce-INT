"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { smartImageLoader } from "@/utils/smartImageLoader";
import SectionHeading from "./SectionHeading";

function getCategoryImage(category) {
  return category?.image || null;
}

function CategoryCard({ category, tabIndex }) {
  const image = getCategoryImage(category);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Link
      href={`/filtering-product?category=${category._id}`}
      tabIndex={tabIndex}
      aria-hidden={tabIndex === -1}
      draggable={false}
      className="group flex h-[176px] w-[140px] shrink-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-0 text-left transition-all duration-200 ease-out hover:-translate-y-[3px] hover:border-[var(--user-accent)]/40 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] focus-visible:-translate-y-[3px] focus-visible:border-[var(--user-accent)]/40 focus-visible:shadow-[0_8px_20px_rgba(0,0,0,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)] active:scale-[0.98] sm:h-[200px] sm:w-[168px]"
    >
      <span className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-t-xl bg-[var(--user-bg-hover)]">
        {image && !imageFailed ? (
          <Image
            src={image}
            alt={category.name}
            fill
            loader={smartImageLoader}
            sizes="(max-width: 639px) 140px, 168px"
            className="object-cover object-center transition-transform duration-200 ease-out group-hover:scale-105 group-focus-visible:scale-105"
            onError={() => setImageFailed(true)}
            draggable={false}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[var(--user-text-subtle)]">
            <ImageOff size={24} strokeWidth={1.5} aria-hidden="true" />
          </span>
        )}
      </span>

      <span className="flex min-h-0 flex-1 flex-col p-3">
        <span className="min-h-8 line-clamp-2 break-words text-sm font-medium leading-4 text-[var(--user-text)]">
          {category.name}
        </span>
        {category.count != null && category.count !== "" ? (
          <span className="text-xs font-normal leading-[14px] text-[var(--user-text-muted)]">
            {category.count} {Number(category.count) === 1 ? "product" : "products"}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function CategorySkeletonCard() {
  return (
    <div aria-hidden="true" className="flex h-[176px] w-[140px] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] sm:h-[200px] sm:w-[168px]">
      <span className="skeleton aspect-[4/3] w-full shrink-0 rounded-t-xl" />
      <span className="flex flex-1 flex-col p-3">
        <span className="skeleton mt-0.5 h-3 w-4/5 rounded" />
        <span className="skeleton mt-1 h-3 w-3/5 rounded" />
        <span className="skeleton mt-1 h-3 w-1/2 rounded" />
      </span>
    </div>
  );
}

export function CategoryCarousel({ categories = [], header, isLoading = false }) {
  const viewportRef = useRef(null);
  const trackRef = useRef(null);
  const segmentWidthRef = useRef(0);
  const loopStartRef = useRef(0);
  const animationPausedRef = useRef(false);
  const hoveredRef = useRef(false);
  const pointerDownRef = useRef(false);
  const dragRef = useRef(null);
  const interactionTimerRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [copyCount, setCopyCount] = useState(3);
  const [dragging, setDragging] = useState(false);
  const [fadeLeft, setFadeLeft] = useState(false);
  const [fadeRight, setFadeRight] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const categorySignature = categories
    .map((category) => `${category._id}:${getCategoryImage(category) || ""}`)
    .join("|");

  const pauseForInteraction = useCallback((duration = 700) => {
    animationPausedRef.current = true;
    window.clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = window.setTimeout(() => {
      animationPausedRef.current = false;
    }, duration);
  }, []);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || categories.length < 2) return undefined;

    const measure = () => {
      const width = viewport.clientWidth;
      const firstSet = track.children[0];
      const secondSet = track.children[1];
      if (!width || !firstSet || !secondSet) return;

      const screenWidth = window.innerWidth;
      const visibleTarget =
        screenWidth < 640 ? 2.15 : screenWidth < 1024 ? 4.4 : screenWidth >= 1536 ? 8.5 : 7.5;
      const gap = Number.parseFloat(window.getComputedStyle(firstSet).columnGap) || 12;
      const cardWidth = Math.max(108, (width - gap * (visibleTarget - 1)) / visibleTarget);
      viewport.style.setProperty("--category-card-width", `${cardWidth}px`);

      const segmentWidth = secondSet.offsetLeft - firstSet.offsetLeft;
      if (!segmentWidth) return;

      const requiredCopies = Math.max(3, Math.ceil((width + segmentWidth) / segmentWidth) + 1);
      if (requiredCopies !== copyCount) {
        setCopyCount(requiredCopies);
        return;
      }

      const oldSegment = segmentWidthRef.current;
      const oldStart = loopStartRef.current;
      const progress = oldSegment
        ? ((viewport.scrollLeft - oldStart) % oldSegment + oldSegment) % oldSegment / oldSegment
        : 0;
      const newStart = segmentWidth;

      if (!oldSegment) {
        viewport.scrollLeft = newStart;
      } else if (oldSegment !== segmentWidth || oldStart !== newStart) {
        viewport.scrollLeft = newStart + progress * segmentWidth;
      }

      segmentWidthRef.current = segmentWidth;
      loopStartRef.current = newStart;
    };

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(viewport);
    resizeObserver.observe(track);
    measure();

    return () => resizeObserver.disconnect();
  }, [categories.length, categorySignature, copyCount]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;

    const updateFadeEdges = () => {
      const logicalStart = loopStartRef.current;
      const maxScroll = viewport.scrollWidth - viewport.clientWidth;
      setFadeLeft(viewport.scrollLeft > logicalStart + 1);
      setFadeRight(viewport.scrollLeft < maxScroll - 1);
      setCanScrollLeft(viewport.scrollLeft > 1);
      setCanScrollRight(viewport.scrollLeft < maxScroll - 1);
    };

    updateFadeEdges();
    viewport.addEventListener("scroll", updateFadeEdges, { passive: true });
    const resizeObserver = new ResizeObserver(updateFadeEdges);
    resizeObserver.observe(viewport);

    return () => {
      viewport.removeEventListener("scroll", updateFadeEdges);
      resizeObserver.disconnect();
    };
  }, [categories.length, copyCount, categorySignature]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || categories.length < 2) return undefined;

    let frameId;
    let previousTime = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const speed = 36;

    const animate = (time) => {
      if (!previousTime) previousTime = time;
      const delta = Math.min(time - previousTime, 50);
      previousTime = time;

      if (
        !animationPausedRef.current &&
        !hoveredRef.current &&
        !pointerDownRef.current &&
        !reducedMotion.matches
      ) {
        viewport.scrollLeft += (speed * delta) / 1000;

        const segmentWidth = segmentWidthRef.current;
        const loopStart = loopStartRef.current;
        if (segmentWidth > 0) {
          if (viewport.scrollLeft >= loopStart + segmentWidth) {
            viewport.scrollLeft -= segmentWidth;
          } else if (viewport.scrollLeft < loopStart) {
            viewport.scrollLeft += segmentWidth;
          }
        }
      }
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [categories.length]);

  useEffect(
    () => () => {
      window.clearTimeout(interactionTimerRef.current);
    },
    [],
  );

  const scrollByCards = useCallback(
    (direction) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      animationPausedRef.current = true;
      window.clearTimeout(interactionTimerRef.current);
      viewport.scrollBy({
        left: direction * viewport.clientWidth * 0.8,
        behavior: "smooth",
      });
      interactionTimerRef.current = window.setTimeout(() => {
        animationPausedRef.current = false;
      }, 850);
    },
    [],
  );

  const onPointerDown = (event) => {
    pointerDownRef.current = true;
    pauseForInteraction(600);
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: event.currentTarget.scrollLeft,
      moved: false,
    };
    setDragging(true);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 4 && !drag.moved) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (drag.moved) event.currentTarget.scrollLeft = drag.startScroll - delta;
  };

  const onPointerUp = (event) => {
    pointerDownRef.current = false;
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      pauseForInteraction(600);
      return;
    }
    if (drag.moved) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
    dragRef.current = null;
    setDragging(false);
    pauseForInteraction(600);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      scrollByCards(event.key === "ArrowLeft" ? -1 : 1);
    }
  };

  if (!categories.length && !isLoading) return null;
  const copies = Array.from({ length: categories.length < 2 ? 1 : copyCount }, (_, index) => index);
  const showSkeletons = isLoading && !categories.length;
  const edgeFadeWidth = "var(--category-edge-fade-width)";
  const edgeMask =
    fadeLeft && fadeRight
      ? `linear-gradient(to right, transparent 0, rgba(0,0,0,0.72) 8px, black ${edgeFadeWidth}, black calc(100% - ${edgeFadeWidth}), rgba(0,0,0,0.72) calc(100% - 8px), transparent 100%)`
      : fadeLeft
        ? `linear-gradient(to right, transparent 0, rgba(0,0,0,0.72) 8px, black ${edgeFadeWidth}, black 100%)`
        : fadeRight
          ? `linear-gradient(to right, black 0, black calc(100% - ${edgeFadeWidth}), rgba(0,0,0,0.72) calc(100% - 8px), transparent 100%)`
          : "none";

  return (
    <div>
      <SectionHeading
        title="Explore Our Categories"
        titleId="home-categories-heading"
        subtitle="Find everything you need in one place."
        className="mb-5"
      >
        <div className="flex shrink-0 items-end gap-4">
          <Link
            href="/filtering-product"
            className="group inline-flex items-center gap-1 text-[13px] font-medium text-[var(--user-text-muted)] transition-colors duration-150 hover:text-[var(--user-accent)] focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
          >
            View All
            <ArrowRight size={16} className="transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
          <span
            aria-hidden="true"
            className="hidden h-5 w-px bg-[var(--user-border)] sm:block"
          />
          <div className="hidden items-center gap-2 sm:flex">
            <button
              type="button"
              onClick={() => scrollByCards(-1)}
              disabled={!canScrollLeft || categories.length < 2}
              aria-label="Previous categories"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)] text-[var(--user-text-muted)] transition duration-150 hover:border-[var(--user-accent)] hover:bg-[var(--user-accent-soft)] hover:text-[var(--user-accent)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
            >
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => scrollByCards(1)}
              disabled={!canScrollRight || categories.length < 2}
              aria-label="Next categories"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)] text-[var(--user-text-muted)] transition duration-150 hover:border-[var(--user-accent)] hover:bg-[var(--user-accent-soft)] hover:text-[var(--user-accent)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
            >
              <ChevronRight size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </SectionHeading>
      <div
        ref={viewportRef}
        role="region"
        aria-label="Scrollable product categories"
        aria-busy={showSkeletons}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseEnter={() => {
          hoveredRef.current = true;
        }}
        onMouseLeave={() => {
          hoveredRef.current = false;
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        className={`[--category-edge-fade-width:24px] max-sm:[--category-edge-fade-width:16px] min-w-0 flex-1 snap-x snap-proximity overflow-x-auto overflow-y-hidden scrollbar-hide focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
          dragging ? "cursor-grabbing select-none" : "cursor-grab"
        }${fadeLeft ? " fade-left" : ""}${fadeRight ? " fade-right" : ""}`}
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          paddingInline: 0,
          scrollPaddingInline: "24px",
          touchAction: "pan-x pan-y",
          maskImage: edgeMask,
          WebkitMaskImage: edgeMask,
        }}
      >
        <div ref={trackRef} className="flex w-max px-6 py-2">
          {copies.map((copy) => (
            <div
              key={`category-set-${copy}`}
              data-category-set
              aria-hidden={copy !== 1}
              className="flex shrink-0 gap-4 pr-4"
            >
              {showSkeletons
                ? Array.from({ length: 8 }, (_, index) => (
                    <div key={`category-skeleton-${copy}-${index}`} className="snap-start">
                      <CategorySkeletonCard />
                    </div>
                  ))
                : categories.map((category) => (
                    <div
                      key={`${copy}:${category._id}:${getCategoryImage(category) || ""}`}
                      className="snap-start"
                    >
                      <CategoryCard category={category} tabIndex={copy === 1 ? 0 : -1} />
                    </div>
                  ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function HomeCategories({ tiles = [], isLoading = false }) {
  const categories = tiles || [];

  if (!categories.length && !isLoading) return null;

  return (
    <section
      aria-labelledby="home-categories-heading"
      className="home-category-section rounded-2xl"
    >
      <CategoryCarousel categories={categories} isLoading={isLoading} />
    </section>
  );
}
