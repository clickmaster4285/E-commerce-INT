"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Star, Store } from "lucide-react";

/* ============================================================
   PLACEHOLDER DATA — swap with real, consented reviews before launch.
   Shape mirrors a future DB record so this can later be a query:
   id, name, role, store, city, category, quote, tag, rating,
   since, modules, initials, hue.
   ============================================================ */
const TESTIMONIALS = [
  {
    id: "ayesha-khan",
    name: "Ayesha Khan",
    role: "Owner",
    store: "Home & Kitchen",
    city: "Lahore",
    category: "Home & Kitchen",
    quote:
      "Month-end used to eat four days of my life. Now invoices, the GST breakdown and the payment ledger reconcile in about twenty minutes — partial payments, returns and bank transfers all line up. Zero reconciliation errors this month.",
    tag: "Faster bookkeeping",
    rating: 5,
    since: "2025",
    modules: ["Invoices", "Ledger"],
    initials: "AK",
    hue: "#FF6A1F",
  },
  {
    id: "bilal-sheikh",
    name: "Bilal Sheikh",
    role: "Owner",
    store: "Electronics",
    city: "Karachi",
    category: "Electronics",
    quote:
      "Customer approves the quote on WhatsApp, we convert it to an invoice in one click. Last month 38 accepted quotes worth Rs. 42 lakh flowed straight into orders — zero manual entry, zero typos.",
    tag: "Faster conversions",
    rating: 5,
    since: "2025",
    modules: ["Quotations", "Invoices"],
    initials: "BS",
    hue: "#0369A1",
  },
  {
    id: "fatima-noor",
    name: "Fatima Noor",
    role: "Owner",
    store: "Fashion Boutique",
    city: "Islamabad",
    category: "Fashion",
    quote:
      "COD and bank transfer cover 90% of our buyers. With stock finally accurate at the variant level, returns dropped from 18% to under 9% — real money saved every single month.",
    tag: "Returns down 50%",
    rating: 4,
    since: "2024",
    modules: ["Inventory", "Shipping"],
    initials: "FN",
    hue: "#7C3AED",
  },
  {
    id: "usman-tariq",
    name: "Usman Tariq",
    role: "Owner",
    store: "Hardware Store",
    city: "Faisalabad",
    category: "Hardware",
    quote:
      "Every PO receipt updates inventory instantly. JazzCash and bank transfer payments reconcile the same day, and low-stock alerts have cut our stockouts in half.",
    tag: "Stockouts halved",
    rating: 5,
    since: "2025",
    modules: ["Inventory", "POS"],
    initials: "UT",
    hue: "#059669",
  },
  {
    id: "hira-butt",
    name: "Hira Butt",
    role: "Owner",
    store: "Cosmetics & Beauty",
    city: "Multan",
    category: "Beauty",
    quote:
      "Reports show exactly which products earn margin, not just what sells. Our top 20 SKUs now drive 70% of profit — we doubled stock on the winners and cleared the dead inventory.",
    tag: "Higher margins",
    rating: 5,
    since: "2024",
    modules: ["Reports", "Inventory"],
    initials: "HB",
    hue: "#DB2777",
  },
];

const CATEGORIES = ["All", "Electronics", "Fashion", "Hardware", "Beauty", "Home & Kitchen"];

function Stars({ rating, size = 16 }) {
  return (
    <div className="flex gap-0.5" role="img" aria-label={`Rated ${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={size}
          aria-hidden="true"
          className={
            i < Math.round(rating)
              ? "fill-[#F5B942] text-[#F5B942]"
              : "fill-user-line text-user-line"
          }
        />
      ))}
    </div>
  );
}

function Avatar({ person, className = "h-10 w-10 text-[10px]" }) {
  return (
    <span
      role="img"
      aria-label={person.name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-extrabold text-white ${className}`}
      style={{ background: person.hue }}
    >
      {person.initials}
    </span>
  );
}

function MiniCard({ person, hidden }) {
  return (
    <figure
      className={`tt-card tt-card-hover tt-marquee-card p-5 ${hidden ? "tt-dup" : ""}`}
      aria-hidden={hidden || undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="tt-result-tag">{person.tag}</span>
        <Stars rating={person.rating} size={12} />
      </div>
      <blockquote className="tt-text mt-3 flex-1 text-[14px] leading-6 line-clamp-4">
        &ldquo;{person.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-4 flex items-center gap-3 border-t border-user-line pt-3">
        <Avatar person={person} />
        <span className="min-w-0 leading-tight">
          <span className="tt-quote block truncate text-[13px] font-extrabold">{person.name}</span>
          <span className="tt-muted mt-0.5 block truncate text-[11px] font-medium">
            {person.store}, {person.city}
          </span>
        </span>
        <Store size={16} className="tt-muted ms-auto shrink-0" aria-hidden="true" />
      </figcaption>
    </figure>
  );
}

function MarqueeRow({ items, direction }) {
  const rows = [...items, ...items];
  return (
    <div className={`tt-marquee ${direction === "right" ? "tt-marquee-right" : "tt-marquee-left"}`}>
      <div className="tt-marquee-track">
        {rows.map((person, i) => (
          <MiniCard key={`${person.id}-${i}`} person={person} hidden={i >= items.length} />
        ))}
      </div>
    </div>
  );
}

export default function Testimonials() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState("All");

  const isAll = active === "All";
  const filtered = isAll ? TESTIMONIALS : TESTIMONIALS.filter((t) => t.category === active);
  const row1 = TESTIMONIALS.slice(0, 3);
  const row2 = TESTIMONIALS.slice(3);

  const fade = (delay = 0) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.5, ease: "easeOut", delay },
  });

  return (
    <section aria-labelledby="testimonials-title" className="tt-section">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        {/* ---------- Header ---------- */}
        <motion.div {...fade(0)} className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="tt-eyebrow text-[11px] font-bold uppercase tracking-[0.18em]">
              Customer Stories
            </p>
            <h2
              id="testimonials-title"
              className="tt-title mt-2 max-w-[24ch] font-extrabold leading-[1.15] tracking-tight"
            >
              Loved by stores across Pakistan
            </h2>
            <p className="tt-sub mt-3 max-w-md text-sm leading-6">
              How COD, invoices, stock and reports actually run for the owners using Click Master.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="tt-avatar-stack flex -space-x-3" aria-hidden="true">
              {TESTIMONIALS.map((t) => (
                <Avatar key={t.id} person={t} className="h-10 w-10 text-[10px]" />
              ))}
            </div>
            <p className="tt-muted max-w-[12rem] text-[11px] font-semibold leading-4">
              Trusted by <span className="tt-quote font-extrabold">growing stores</span> across Pakistan
            </p>
          </div>
        </motion.div>

        {/* ---------- Filter chips ---------- */}
        <motion.div {...fade(0.08)} className="mt-7 flex flex-wrap gap-2" role="group" aria-label="Filter stories by store type">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className="tt-chip"
              aria-pressed={active === cat}
              onClick={() => setActive(cat)}
            >
              {cat}
            </button>
          ))}
        </motion.div>
        <p className="sr-only" role="status" aria-live="polite">
          {isAll ? `${TESTIMONIALS.length} stories` : `${filtered.length} ${filtered.length === 1 ? "story" : "stories"} for ${active}`}
        </p>

        {/* ---------- Content ---------- */}
        <motion.div
          key={active}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="mt-8"
        >
          {isAll ? (
            <div className="space-y-4">
              <MarqueeRow items={row1} direction="left" />
              <MarqueeRow items={row2} direction="right" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {filtered.map((person) => (
                <MiniCard key={person.id} person={person} />
              ))}
            </div>
          )}
        </motion.div>

      </div>
    </section>
  );
}
