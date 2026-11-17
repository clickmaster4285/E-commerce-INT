"use client";

import { useEffect, useRef } from "react";
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
  const videoRef = useRef(null);

  /* Pause the video when the hero leaves the viewport */
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const playPromise = video.play();
            if (playPromise?.catch) playPromise.catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const contentY = useTransform(scrollYProgress, [0, 1], ["0%", reduceMotion ? "0%" : "18%"]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, reduceMotion ? 1 : 0.15]);

  const rise = (delay) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, ease: "easeOut", delay },
  });

  return (
    <section
      ref={sectionRef}
      id="home"
      aria-label="Click Master Store — commerce platform"
      className="relative flex min-h-[calc(100svh-64px)] flex-col justify-center overflow-hidden bg-[#05070b] py-[72px]"
    >
      {/* ===== Video background (decorative) ===== */}
      {reduceMotion ? (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,#1b2440_0%,#05070b_65%)]"
        />
      ) : (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src="/landing/hero-bg.mp4" type="video/mp4" />
        </video>
      )}

      {/* ===== Overlay: left read + top/bottom fades ===== */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(11,16,32,0.90)_0%,rgba(11,16,32,0.72)_45%,rgba(11,16,32,0.20)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(to_bottom,rgba(11,16,32,0.55)_0%,transparent_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(to_top,rgba(11,16,32,0.55)_0%,transparent_100%)]"
      />
      {/* Soft radial scrim behind the text column */}
      <div aria-hidden="true" className="hero-scrim" />

      {/* ===== Content — flex column with explicit gaps ===== */}
      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="relative z-[2] mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8"
      >
        <div className="hero-stack">
          {/* Eyebrow */}
          <motion.p {...rise(0)} className="hero-eyebrow">
            <Zap size={14} className="text-[#FF8A47]" aria-hidden="true" />
            {HERO.eyebrow}
          </motion.p>

          {/* H1 — exactly 2 lines */}
          <h1 aria-label={`${HERO.headlineA} ${HERO.headlineB}`} className="hero-h1">
            <span className="block text-white">Run your whole business</span>
            <span className="hero-h1-grad block">from one dashboard.</span>
          </h1>

          {/* Paragraph */}
          <motion.p {...rise(0.16)} className="hero-sub">
            {HERO.sub}
          </motion.p>

          {/* Buttons */}
          <motion.div {...rise(0.24)} className="hero-ctas">
            <Magnetic>
              <a href={HERO.primaryCta.href} className="hero-cta-primary">
                {HERO.primaryCta.label}
                <ArrowRight size={19} aria-hidden="true" />
              </a>
            </Magnetic>
            <Magnetic>
              <a
                href={HERO.secondaryCta.href}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost-on-dark hero-cta-ghost"
              >
                {HERO.secondaryCta.label}
              </a>
            </Magnetic>
          </motion.div>

          {/* Trust ticks */}
          <motion.ul {...rise(0.32)} className="hero-proofs">
            {["ORD- to INV- numbering", "COD + Bank Transfer", "Full Urdu (RTL)"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-400" aria-hidden="true" />
                {t}
              </li>
            ))}
          </motion.ul>
        </div>
      </motion.div>

      {/* ===== Scroll indicator ===== */}
      <a
        href="#how-it-works"
        aria-label="Scroll to learn more"
        className="absolute bottom-5 left-1/2 z-[3] flex -translate-x-1/2 flex-col items-center gap-1.5 text-white/60 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.25em]">Scroll</span>
        <motion.span animate={reduceMotion ? {} : { y: [0, 7, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}>
          <ChevronDown size={20} aria-hidden="true" />
        </motion.span>
      </a>
    </section>
  );
}
