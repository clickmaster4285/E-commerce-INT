"use client";

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform, useReducedMotion } from "framer-motion";
import {
  ShoppingCart,
  FileCheck,
  ReceiptText,
  Truck,
  PackageCheck,
  CheckCircle2,
} from "lucide-react";
import SectionHeading from "./SectionHeading";
import { STEPS } from "./content";

const STEP_ICONS = [ShoppingCart, FileCheck, ReceiptText, Truck, PackageCheck];

export default function HowItWorks() {
  const reduceMotion = useReducedMotion();
  const ref = useRef(null);

  // Line draws itself as the section scrolls through the viewport
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 75%", "end 55%"],
  });
  const pathLength = useSpring(scrollYProgress, { stiffness: 90, damping: 25, restDelta: 0.001 });

  return (
    <section
      id="how-it-works"
      ref={ref}
      aria-labelledby="hiw-title"
      className="scroll-mt-24 py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How It Works"
          title="From order to doorstep — the real flow"
          subtitle="Every Click Master order travels the same reliable pipeline. Here is exactly what happens, step by step."
        />

        <div className="relative mt-4">
          {/* Drawing spine (desktop) */}
          <svg
            viewBox="0 0 4 100"
            preserveAspectRatio="none"
            className="absolute left-[27px] top-0 hidden h-full w-1 sm:block"
            aria-hidden="true"
          >
            <line x1="2" y1="0" x2="2" y2="100" stroke="var(--user-border)" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <motion.line
              x1="2"
              y1="0"
              x2="2"
              y2="100"
              stroke="var(--user-accent)"
              strokeWidth="4"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ pathLength: reduceMotion ? 1 : pathLength }}
            />
          </svg>

          <ol className="space-y-4 sm:space-y-6">
            {STEPS.map(({ step, title, text, tag }, i) => {
              const Icon = STEP_ICONS[i];
              return (
                <motion.li
                  key={step}
                  initial={{ opacity: 0, x: -32 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.45, delay: i * 0.06 }}
                  className="relative flex items-start gap-4 sm:gap-6"
                >
                  {/* Step node */}
                  <div className="relative z-[1] flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-sm">
                    <Icon size={20} strokeWidth={1.9} className="text-[var(--user-accent)]" aria-hidden="true" />
                    <span className="mt-0.5 font-mono text-[9px] font-extrabold text-[var(--user-text-muted)]">{step}</span>
                  </div>

                  {/* Card */}
                  <div className="landing-card flex-1 p-4 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-5">
                    <div className="max-w-2xl">
                      <h3 className="flex items-center gap-2 text-base font-extrabold text-[var(--user-text)]">
                        {title}
                        <CheckCircle2 size={16} className="text-emerald-500" aria-hidden="true" />
                      </h3>
                      <p className="mt-1.5 text-sm leading-6 text-[var(--user-text-muted)]">{text}</p>
                    </div>
                    <code className="mt-3 inline-block shrink-0 rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-hover)] px-3 py-1.5 font-mono text-[10px] font-bold text-[var(--user-accent)] sm:mt-0">
                      {tag}
                    </code>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
