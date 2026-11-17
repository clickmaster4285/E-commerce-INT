"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import {
  ShoppingCart,
  Truck,
  Banknote,
  RotateCcw,
  ArrowRight,
  BadgePercent,
  Zap,
} from "lucide-react";
import { useLanding } from "./LandingContext";
import { FLASH_DEALS, formatPrice } from "./data";

const TRUST_CHIPS = [
  { icon: Truck, label: "Free Delivery" },
  { icon: Banknote, label: "Cash on Delivery" },
  { icon: RotateCcw, label: "7-Day Return" },
];

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef(null);
  const { addToCart } = useLanding();

  // Parallax: blobs + floating cards move slower than scroll
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const blobY = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "0%" : "35%"]);
  const cardY1 = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "0%" : "70%"]);
  const cardY2 = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "0%" : "40%"]);

  const hero = FLASH_DEALS[0];

  return (
    <section
      ref={sectionRef}
      id="home"
      aria-label="Click Master Store — home"
      className="relative overflow-hidden"
    >
      {/* Ambient background */}
      <div className="hero-grid absolute inset-0" aria-hidden="true" />
      <motion.div style={{ y: blobY }} className="absolute inset-0" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </motion.div>

      <div className="relative z-[1] mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:pb-24 lg:pt-20">
        {/* Copy */}
        <div className="lg:col-span-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)] py-1.5 pl-1.5 pr-4 text-xs font-bold text-[var(--user-text-secondary)] shadow-sm"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--user-accent)] text-[var(--user-accent-text)]">
              <Zap size={13} aria-hidden="true" />
            </span>
            Pakistan&apos;s Trusted Online Store
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-[var(--user-text)] sm:text-5xl xl:text-6xl"
          >
            Click. Order.
            <br />
            <span className="text-[var(--user-accent)]">Delivered.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="mt-5 max-w-md text-base leading-7 text-[var(--user-text-muted)] sm:text-lg"
          >
            45,000+ products — mobiles se le kar kitchen tak. Cash on Delivery,
            7-day hassle-free returns, aur har sheher mein delivery.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.28 }}
            className="mt-7 flex flex-wrap items-center gap-3"
          >
            <a href="#deals" className="landing-btn landing-btn-primary">
              Shop Now
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <a href="#deals" className="landing-btn landing-btn-ghost">
              <BadgePercent size={18} aria-hidden="true" />
              View Deals
            </a>
          </motion.div>

          {/* Trust chips */}
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-6 flex flex-wrap gap-2"
            aria-label="Shopping assurances"
          >
            {TRUST_CHIPS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex min-h-[40px] items-center gap-2 rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)] px-3 py-1.5 text-xs font-semibold text-[var(--user-text-secondary)]"
              >
                <Icon size={15} className="text-[var(--user-accent)]" aria-hidden="true" />
                {label}
              </li>
            ))}
          </motion.ul>

          {/* Mini counters */}
          <dl className="mt-8 flex items-center gap-5 border-t border-[var(--user-border)] pt-6 text-[var(--user-text-secondary)]">
            {[
              ["250K+", "Happy Customers"],
              ["1.2M+", "Orders Shipped"],
              ["120+", "Cities"],
            ].map(([num, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd className="text-xl font-extrabold text-[var(--user-text)] sm:text-2xl">{num}</dd>
                <dd className="text-[11px] font-medium uppercase tracking-wide text-[var(--user-text-muted)]">{label}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Visual — floating product cards */}
        <div className="relative mx-auto h-[380px] w-full max-w-md sm:h-[440px] lg:col-span-6 lg:h-[500px] lg:max-w-none">
          {/* Main hero product card */}
          <motion.div
            style={{ y: cardY1 }}
            className="absolute left-1/2 top-1/2 z-[2] w-56 -translate-x-1/2 -translate-y-1/2 sm:w-64 lg:left-[46%]"
          >
            <motion.div
              animate={reduceMotion ? {} : { y: [0, -14, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="landing-card overflow-hidden p-3"
            >
              <div className="relative">
                <Image
                  src={hero.img}
                  alt={`${hero.name} — sample product photo`}
                  width={400}
                  height={400}
                  priority
                  className="h-40 w-full rounded-xl object-cover sm:h-48"
                />
                <span className="deal-badge absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-extrabold">
                  {hero.badge}
                </span>
              </div>
              <p className="mt-3 truncate text-sm font-bold text-[var(--user-text)]">{hero.name}</p>
              <div className="mt-1 flex items-end justify-between gap-2">
                <div>
                  <p className="text-lg font-extrabold text-[var(--user-accent)]">{formatPrice(hero.price)}</p>
                  <p className="text-xs text-[var(--user-text-muted)] line-through">{formatPrice(hero.oldPrice)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => addToCart(hero.name)}
                  aria-label={`Add ${hero.name} to cart`}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] transition-transform hover:scale-105 active:scale-95"
                >
                  <ShoppingCart size={18} aria-hidden="true" />
                </button>
              </div>
            </motion.div>
          </motion.div>

          {/* Floating side cards */}
          <motion.div style={{ y: cardY2 }} className="absolute left-0 top-6 z-[1] hidden w-40 sm:block lg:left-2">
            <motion.div
              animate={reduceMotion ? {} : { y: [0, 12, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
              className="landing-card p-2.5"
            >
              <Image
                src="/landing/placeholder-6.svg"
                alt="Smart Watch Fit 3 — sample product photo"
                width={200}
                height={200}
                className="h-20 w-full rounded-lg object-cover"
              />
              <p className="mt-2 text-[11px] font-bold text-[var(--user-text)]">Smart Watch Fit 3</p>
              <p className="text-[11px] font-extrabold text-[var(--user-accent)]">{formatPrice(5499)}</p>
            </motion.div>
          </motion.div>

          <motion.div style={{ y: cardY2 }} className="absolute bottom-10 right-0 z-[1] w-44 sm:w-48">
            <motion.div
              animate={reduceMotion ? {} : { y: [0, -10, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
              className="landing-card p-2.5"
            >
              <Image
                src="/landing/placeholder-3.svg"
                alt="Stainless Steel Cookware 12pc — sample product photo"
                width={220}
                height={220}
                className="h-20 w-full rounded-lg object-cover"
              />
              <p className="mt-2 text-[11px] font-bold text-[var(--user-text)]">Cookware 12pc</p>
              <p className="text-[11px] font-extrabold text-[var(--user-accent)]">{formatPrice(8999)}</p>
            </motion.div>
          </motion.div>

          {/* Free delivery pill */}
          <motion.div
            animate={reduceMotion ? {} : { y: [0, -8, 0], rotate: [0, 1.5, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            className="absolute right-1 top-4 z-[3] flex items-center gap-2 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] px-3 py-2 shadow-lg sm:right-4"
          >
            <Truck size={18} className="text-[var(--user-accent)]" aria-hidden="true" />
            <div className="leading-tight">
              <p className="text-[11px] font-extrabold text-[var(--user-text)]">FREE Delivery</p>
              <p className="text-[10px] text-[var(--user-text-muted)]">on orders over Rs. 2,000</p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
