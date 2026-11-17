"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  FileText,
  PackageCheck,
  Truck,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { HERO } from "./content";

/* Magnetic hover wrapper — small follow effect on desktop */
function Magnetic({ children, strength = 18 }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();

  const move = (e) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.transform = `translate(${((e.clientX - (r.left + r.width / 2)) / r.width) * strength}px, ${((e.clientY - (r.top + r.height / 2)) / r.height) * strength}px)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "translate(0,0)";
  };

  return (
    <span
      ref={ref}
      onMouseMove={move}
      onMouseLeave={reset}
      className="inline-block transition-transform duration-300 ease-out will-change-transform"
    >
      {children}
    </span>
  );
}

export default function Hero() {
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const meshY = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "0%" : "40%"]);

  // Mouse-move parallax for the floating UI cards
  const mx = useSpring(0, { stiffness: 60, damping: 20, mass: 0.6 });
  const my = useSpring(0, { stiffness: 60, damping: 20, mass: 0.6 });
  const onMouseMove = (e) => {
    if (reduceMotion) return;
    const r = sectionRef.current.getBoundingClientRect();
    mx.set(((e.clientX - (r.left + r.width / 2)) / r.width) * 2);
    my.set(((e.clientY - (r.top + r.height / 2)) / r.height) * 2);
  };
  const card1X = useTransform(mx, (v) => v * -12);
  const card1Y = useTransform(my, (v) => v * -9);
  const card2X = useTransform(mx, (v) => v * 14);
  const card2Y = useTransform(my, (v) => v * 11);
  const card3X = useTransform(mx, (v) => v * -7);
  const card3Y = useTransform(my, (v) => v * 13);

  return (
    <section
      ref={sectionRef}
      id="top"
      onMouseMove={onMouseMove}
      aria-label="Click Master Store — commerce platform"
      className="relative overflow-hidden"
    >
      {/* Ambient gradient mesh */}
      <div className="hero-grid absolute inset-0" aria-hidden="true" />
      <motion.div style={{ y: meshY }} className="absolute inset-0" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </motion.div>

      <div className="relative z-[1] mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-12 lg:gap-8 lg:px-8 lg:pb-24 lg:pt-20">
        {/* Copy */}
        <div className="lg:col-span-6">
          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--user-border)] bg-[var(--user-bg-card)] py-1.5 pl-2 pr-4 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--user-accent)] shadow-sm"
          >
            <Zap size={13} aria-hidden="true" />
            {HERO.eyebrow}
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-[var(--user-text)] sm:text-5xl xl:text-6xl"
          >
            {HERO.headlineA}
            <br />
            <span className="text-[var(--user-accent)]">{HERO.headlineB}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className="mt-5 max-w-md text-base leading-7 text-[var(--user-text-muted)] sm:text-lg"
          >
            {HERO.sub}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.28 }}
            className="mt-7 flex flex-wrap items-center gap-3"
          >
            <Magnetic>
              <a href={HERO.primaryCta.href} className="landing-btn landing-btn-primary">
                {HERO.primaryCta.label}
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </Magnetic>
            <Magnetic>
              <a href={HERO.secondaryCta.href} target="_blank" rel="noopener noreferrer" className="landing-btn landing-btn-ghost">
                {HERO.secondaryCta.label}
              </a>
            </Magnetic>
          </motion.div>

          {/* Micro proof points — real capabilities, not invented numbers */}
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.42 }}
            className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[var(--user-text-secondary)]"
          >
            {["Orders ORD-… to INV-…", "COD + Bank Transfer", "Full Urdu (RTL)"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-500" aria-hidden="true" />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* Right — floating code-built UI cards */}
        <div className="relative mx-auto h-[400px] w-full max-w-md sm:h-[440px] lg:col-span-6 lg:h-[500px] lg:max-w-none" aria-hidden="true">
          {/* Invoice card */}
          <motion.div style={{ x: card1X, y: card1Y }} className="absolute left-1/2 top-6 z-[2] w-60 -translate-x-1/2 sm:w-72 lg:left-[44%]">
            <motion.div
              animate={reduceMotion ? {} : { y: [0, -12, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
              className="landing-card p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--user-accent-soft)] text-[var(--user-accent)]">
                    <FileText size={17} aria-hidden="true" />
                  </span>
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--user-text-muted)]">Invoice</p>
                </div>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-600">UNPAID</span>
              </div>
              <p className="mt-2 font-mono text-xs font-bold text-[var(--user-text)]">INV-000214</p>
              <ul className="mt-2 space-y-1.5 border-t border-[var(--user-border)] pt-2 text-[11px]">
                {[
                  ["Stainless Cookware 12pc × 1", "Rs. 8,999"],
                  ["Tax (GST)", "Rs. 1,530"],
                ].map(([label, amount]) => (
                  <li key={label} className="flex items-center justify-between gap-2">
                    <span className="text-[var(--user-text-muted)]">{label}</span>
                    <span className="font-bold tabular-nums text-[var(--user-text-secondary)]">{amount}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex items-center justify-between border-t border-[var(--user-border)] pt-2">
                <span className="text-[11px] font-bold uppercase text-[var(--user-text-muted)]">Total</span>
                <span className="text-base font-extrabold tabular-nums text-[var(--user-accent)]">Rs. 10,529</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Order status card */}
          <motion.div style={{ x: card2X, y: card2Y }} className="absolute -left-1 top-40 z-[1] hidden w-52 sm:block lg:left-0 lg:top-52">
            <motion.div
              animate={reduceMotion ? {} : { y: [0, 12, 0] }}
              transition={{ duration: 6.2, repeat: Infinity, ease: "easeInOut", delay: 0.7 }}
              className="landing-card p-3"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
                  <PackageCheck size={17} aria-hidden="true" />
                </span>
                <div>
                  <p className="font-mono text-[11px] font-extrabold text-[var(--user-text)]">#ORD-000142</p>
                  <p className="text-[10px] font-semibold text-[var(--user-text-muted)]">COD · Lahore</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1">
                {["Pending", "Confirmed", "Shipped", "Delivered"].map((s, i, arr) => (
                  <span
                    key={s}
                    className={`h-1.5 flex-1 rounded-full ${s === "Shipped" ? "bg-[var(--user-accent)]" : i < 2 ? "bg-emerald-500" : "bg-[var(--user-border)]"}`}
                    title={s}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-[10px] font-bold text-[var(--user-accent)]">Shipped — arriving in 2 days</p>
            </motion.div>
          </motion.div>

          {/* Shipment tracker card */}
          <motion.div style={{ x: card3X, y: card3Y }} className="absolute bottom-8 right-0 z-[1] w-60 sm:w-64 lg:bottom-16">
            <motion.div
              animate={reduceMotion ? {} : { y: [0, -9, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
              className="landing-card p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--user-text-muted)]">Shipment</p>
                <span className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-extrabold text-sky-600">
                  <Truck size={11} aria-hidden="true" /> ON ROUTE
                </span>
              </div>
              <svg viewBox="0 0 220 46" className="mt-2 w-full" role="presentation">
                <path id="hero-route" d="M8 34 C 60 34, 70 10, 120 12 S 190 12, 212 12" fill="none" stroke="var(--user-border)" strokeWidth="3" strokeDasharray="6 6" />
                <circle cx="8" cy="34" r="5" fill="var(--user-border)" />
                <circle cx="212" cy="12" r="5" fill="var(--user-accent)" />
                <circle r="6" fill="var(--user-accent)" stroke="#fff" strokeWidth="2">
                  {!reduceMotion && <animateMotion dur="4.5s" repeatCount="indefinite"><mpath href="#hero-route" /></animateMotion>}
                </circle>
              </svg>
              <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold text-[var(--user-text-muted)]">
                <span>Lahore Hub</span>
                <span>Karachi · ETA 2d</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
