"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ImageOff } from "lucide-react";
import { smartImageLoader } from "@/utils/smartImageLoader";

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
      className="group flex h-[98px] w-[var(--category-card-width)] shrink-0 cursor-pointer flex-col overflow-hidden rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-0 text-left transition-colors duration-200 hover:border-[var(--user-border-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)] sm:h-[104px]"
    >
      <span className="relative mb-1 flex h-[56px] w-full shrink-0 items-center justify-center overflow-hidden sm:h-[62px]">
        {image && !imageFailed ? (
          <Image
            src={image}
            alt={category.name}
            fill
            loader={smartImageLoader}
            sizes="(max-width: 639px) 42vw, (max-width: 1023px) 22vw, 13vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            onError={() => setImageFailed(true)}
            draggable={false}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[var(--user-bg-card)] text-[var(--user-text-subtle)]">
            <ImageOff size={24} strokeWidth={1.5} aria-hidden="true" />
          </span>
        )}
      </span>

      <span className="flex min-h-0 items-start px-1.5 pt-1.5">
        <span className="min-w-0 line-clamp-2 break-words text-[0.7rem] font-medium leading-tight text-[var(--user-text)] sm:text-xs">
          {category.name}
        </span>
      </span>
    </Link>
  );
}

export function CategoryCarousel({ categories = [] }) {
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
      const track = trackRef.current;
      const firstSet = track?.children[0];
      const firstCard = firstSet?.children[0];
      const nextCard = firstSet?.children[1];
      if (!viewport || !firstCard || !nextCard) return;

      const distance = nextCard.offsetLeft - firstCard.offsetLeft;
      animationPausedRef.current = true;
      window.clearTimeout(interactionTimerRef.current);
      viewport.scrollBy({ left: direction * distance * 2, behavior: "smooth" });
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

  if (!categories.length) return null;
  const copies = Array.from({ length: categories.length < 2 ? 1 : copyCount }, (_, index) => index);

  return (
    <div className="group/carousel flex items-center gap-1.5 sm:gap-2">
      <button
        type="button"
        onClick={() => scrollByCards(-1)}
        disabled={categories.length < 2}
        aria-label="Previous categories"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--user-border)] bg-[var(--user-button-bg)] text-[var(--user-icon-color)] shadow-sm transition hover:border-[var(--user-border-hover)] hover:text-[var(--user-text)] disabled:cursor-not-allowed disabled:opacity-35 sm:h-9 sm:w-9"
      >
        <ArrowLeft size={16} />
      </button>

      <div
        ref={viewportRef}
        role="region"
        aria-label="Scrollable product categories"
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
        className={`min-w-0 flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
          dragging ? "cursor-grabbing select-none" : "cursor-grab"
        }`}
        style={{ scrollbarWidth: "none", touchAction: "pan-x pan-y" }}
      >
        <div ref={trackRef} className="flex w-max">
          {copies.map((copy) => (
            <div
              key={`category-set-${copy}`}
              data-category-set
              aria-hidden={copy !== 1}
              className="flex shrink-0 gap-3 pr-3 sm:gap-4 sm:pr-4"
            >
              {categories.map((category) => (
                <CategoryCard
                  key={`${copy}:${category._id}:${getCategoryImage(category) || ""}`}
                  category={category}
                  tabIndex={copy === 1 ? 0 : -1}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => scrollByCards(1)}
        disabled={categories.length < 2}
        aria-label="Next categories"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--user-border)] bg-[var(--user-button-bg)] text-[var(--user-icon-color)] shadow-sm transition hover:border-[var(--user-border-hover)] hover:text-[var(--user-text)] disabled:cursor-not-allowed disabled:opacity-35 sm:h-9 sm:w-9"
      >
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

export default function HomeCategories({ tiles = [], isLoading = false }) {
  const categories = tiles || [];

  if (isLoading && !categories.length) {
    return (
      <section aria-label="Shop by category">
        <div className="mb-3 space-y-1">
          <div className="h-3 w-32 animate-pulse rounded-full bg-[var(--user-bg-hover)]" />
          <div className="h-6 w-64 animate-pulse rounded-lg bg-[var(--user-bg-hover)]" />
        </div>
        <div className="flex gap-3 overflow-hidden sm:gap-4">
          {[...Array(8).keys()].map((index) => (
            <div
              key={index}
              className="h-[156px] w-[min(42vw,10.5rem)] shrink-0 animate-pulse rounded-[16px] border border-[var(--user-border)] bg-[var(--user-bg-card)] sm:w-[min(22vw,10.5rem)] lg:w-[min(13vw,10.5rem)] 2xl:w-[min(11.5vw,10.5rem)]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (!categories.length) return null;

  return (
    <section
      aria-labelledby="home-categories-heading"
      className="home-category-section rounded-2xl"
    >
      <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2 sm:mb-3">
        <div>
          <p className="text-[0.675rem] font-medium uppercase tracking-[0.12em] text-[var(--user-accent)]">
            Shop by category
          </p>
          <h2
            id="home-categories-heading"
            className="mt-0.5 text-[1.2rem] font-medium tracking-tight text-[var(--user-text)] sm:text-[1.35rem]"
          >
            Explore Our Categories
          </h2>
          <p className="mt-0.5 text-[0.75rem] font-normal text-[var(--user-text-muted)]">
            Find everything you need in one place.
          </p>
        </div>
        <Link
          href="/filtering-product"
          className="group inline-flex shrink-0 items-center gap-1 pb-0.5 text-[0.75rem] font-medium text-[var(--user-text-secondary)] transition-colors hover:text-[var(--user-accent)]"
        >
          View All
          <ArrowRight
            size={15}
            className="transition-transform group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </div>

      <CategoryCarousel categories={categories} />
    </section>
  );
}
