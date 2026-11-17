"use client";

import { useEffect, useState, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Star, Quote, ChevronLeft, ChevronRight } from "lucide-react";
import SectionHeading from "./SectionHeading";
import { TESTIMONIALS } from "./data";

export default function Testimonials() {
  const reduceMotion = useReducedMotion();
  const [[index, direction], setIndex] = useState([0, 0]);
  const [paused, setPaused] = useState(false);

  const go = useCallback((dir) => {
    setIndex(([i]) => [(i + dir + TESTIMONIALS.length) % TESTIMONIALS.length, dir]);
  }, []);

  useEffect(() => {
    if (paused || reduceMotion) return;
    const t = window.setInterval(() => go(1), 5000);
    return () => window.clearInterval(t);
  }, [paused, reduceMotion, go]);

  const t = TESTIMONIALS[index];

  const variants = {
    enter: (dir) => ({ opacity: 0, x: dir >= 0 ? 90 : -90 }),
    center: { opacity: 1, x: 0 },
    exit: (dir) => ({ opacity: 0, x: dir >= 0 ? -90 : 90 }),
  };

  return (
    <section
      aria-labelledby="testimonials-title"
      className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <SectionHeading
        eyebrow="Reviews"
        title="Log Kya Kehte Hain"
        subtitle="Real buyers, real parcels — bas ziada tar."
      />

      <div className="relative mx-auto max-w-3xl">
        <Quote
          size={56}
          aria-hidden="true"
          className="absolute -left-2 -top-5 text-[var(--user-accent-soft)]"
          fill="var(--user-accent-soft)"
        />

        <div className="overflow-hidden">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.figure
              key={index}
              custom={direction}
              variants={reduceMotion ? undefined : variants}
              initial={reduceMotion ? { opacity: 0 } : "enter"}
              animate={reduceMotion ? { opacity: 1 } : "center"}
              exit={reduceMotion ? { opacity: 0 } : "exit"}
              transition={{ duration: 0.38, ease: "easeOut" }}
              drag={reduceMotion ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.7}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) go(1);
                else if (info.offset.x > 60) go(-1);
              }}
              className="landing-card cursor-grab p-6 text-center active:cursor-grabbing sm:p-10"
            >
              <div className="flex justify-center gap-1" aria-label={`Rated ${t.rating} out of 5`}>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    size={18}
                    aria-hidden="true"
                    className={i < t.rating ? "fill-amber-400 text-amber-400" : "text-[var(--user-border)]"}
                  />
                ))}
              </div>

              <blockquote className="mt-5 text-lg font-medium leading-8 text-[var(--user-text-secondary)] sm:text-xl">
                “{t.text}”
              </blockquote>

              <figcaption className="mt-6 flex items-center justify-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--user-accent)] text-sm font-extrabold text-[var(--user-accent-text)]">
                  {t.initials}
                </span>
                <span className="text-left leading-tight">
                  <span className="block text-sm font-bold text-[var(--user-text)]">{t.name}</span>
                  <span className="block text-xs text-[var(--user-text-muted)]">{t.city}</span>
                </span>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>

        {/* Controls */}
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous review"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--user-border)] text-[var(--user-text-secondary)] transition-colors hover:border-[var(--user-accent)] hover:text-[var(--user-accent)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>

          <div className="flex gap-2" role="tablist" aria-label="Review slides">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Review ${i + 1} of ${TESTIMONIALS.length}`}
                onClick={() => setIndex([i, i > index ? 1 : -1])}
                className={`h-2.5 rounded-full transition-all duration-300 focus-visible:outline-2 focus-visible:outline-[var(--user-accent)] ${
                  i === index ? "w-6 bg-[var(--user-accent)]" : "w-2.5 bg-[var(--user-border)] hover:bg-[var(--user-text-muted)]"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next review"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--user-border)] text-[var(--user-text-secondary)] transition-colors hover:border-[var(--user-accent)] hover:text-[var(--user-accent)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]"
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
