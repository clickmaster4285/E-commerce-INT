"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import {
  ArrowRight,
  Zap,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { HERO } from "./content";

/* Magnetic hover wrapper — desktop only */
function Magnetic({ children, strength = 16 }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();

  const move = (e) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    ref.current.style.transform = `translate(${((e.clientX - (r.left + r.width / 2)) / r.width) * strength}px, ${((e.clientY - (r.top + r.height / 2)) / r.height) * strength}px)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = "translate(0, 0)";
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
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "0%" : "18%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, reduceMotion ? 1 : 0.15]);

  return (
    <section
      ref={sectionRef}
      id="home"
      aria-label="Click Master Store — commerce platform"
      className="relative flex min-h-[94svh] flex-col justify-center overflow-hidden bg-[#05070b]"
    >
      {/* ===== Video background (decorative) ===== */}
      {reduceMotion ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#1b2440_0%,#05070b_65%)]"
        />
      ) : (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src="/landing/hero-bg.mp4" type="video/mp4" />
        </video>
      )}

      {/* ===== Cinematic scrims ===== */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,7,12,0.92)_0%,rgba(4,7,12,0.72)_38%,rgba(4,7,12,0.18)_70%,rgba(4,7,12,0.32)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(to_top,rgba(4,7,12,0.85)_0%,transparent_32%)]"
      />

      {/* ===== Content ===== */}
      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-[2] mx-auto w-full max-w-7xl px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:px-8 lg:pb-24 lg:pt-28"
      >
        <div className="max-w-2xl">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 py-1.5 pl-2 pr-4 text-[11px] font-bold uppercase tracking-[0.16em] text-white backdrop-blur-md"
          >
            <Zap size={13} className="text-[var(--user-accent)]" aria-hidden="true" />
            {HERO.eyebrow}
          </motion.p>

          <h1
            aria-label={`${HERO.headlineA} ${HERO.headlineB}`}
            className="mt-5 text-[2.65rem] font-extrabold leading-[1.04] tracking-tight text-white sm:text-6xl xl:text-[4.1rem]"
          >
            {HERO.headlineA.split(" ").map((word, i) => (
              <motion.span
                key={`a-${i}`}
                initial={{ opacity: 0, y: 44, rotate: 4 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.55, delay: 0.12 + i * 0.075, ease: [0.16, 1, 0.3, 1] }}
                className="mr-[0.28em] inline-block"
              >
                {word}
              </motion.span>
            ))}
            <br />
            {HERO.headlineB.split(" ").map((word, i) => (
              <motion.span
                key={`b-${i}`}
                initial={{ opacity: 0, y: 44, rotate: 4 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.55, delay: 0.45 + i * 0.075, ease: [0.16, 1, 0.3, 1] }}
                className="mr-[0.28em] inline-block text-[var(--user-accent)]"
              >
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.75 }}
            className="mt-6 max-w-md text-base leading-7 text-white/80 sm:text-lg"
          >
            {HERO.sub}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.9 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Magnetic>
              <a
                href={HERO.primaryCta.href}
                className="inline-flex min-h-[52px] items-center gap-2 rounded-xl bg-[var(--user-accent)] px-7 text-base font-extrabold text-white shadow-sm transition-colors duration-200 hover:bg-[var(--user-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)]"
              >
                {HERO.primaryCta.label}
                <ArrowRight size={19} aria-hidden="true" />
              </a>
            </Magnetic>
            <Magnetic>
              <a
                href={HERO.secondaryCta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[52px] items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-7 text-base font-bold text-white backdrop-blur-md transition-all duration-200 hover:border-white/45 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                {HERO.secondaryCta.label}
              </a>
            </Magnetic>
          </motion.div>

          {/* Proof points */}
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 1.05 }}
            className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-white/75"
          >
            {["ORD- to INV- numbering", "COD + Bank Transfer", "Full Urdu (RTL)"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-400" aria-hidden="true" />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>
      </motion.div>

      {/* ===== Scroll indicator ===== */}
      <a
        href="#why"
        aria-label="Scroll to learn more"
        className="absolute bottom-5 left-1/2 z-[3] flex -translate-x-1/2 flex-col items-center gap-1.5 text-white/60 transition-colors hover:text-white"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.25em]">Scroll</span>
        <motion.span animate={reduceMotion ? {} : { y: [0, 7, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
          <ChevronDown size={20} aria-hidden="true" />
        </motion.span>
      </a>
    </section>
  );
}
