"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  MessageCircle,
  Zap,
  Banknote,
  FileText,
  FileCheck,
  Truck,
  CheckCircle2,
} from "lucide-react";
import { WHATSAPP_NUMBER } from "./content";

/* DEMO activity feed — client-side simulation, clearly labelled DEMO.
   Shows the kind of events the platform emits in real life. */
const FEED = [
  { icon: Banknote, text: "#ORD-000143 · COD · Lahore", amount: "Rs. 4,299", tone: "text-emerald-400" },
  { icon: FileText, text: "INV-000215 marked Paid", amount: "Rs. 10,529", tone: "text-sky-400" },
  { icon: FileCheck, text: "Quote QT-00043 accepted", amount: "", tone: "text-violet-400" },
  { icon: Truck, text: "#ORD-000142 shipped via Express", amount: "", tone: "text-amber-400" },
  { icon: Banknote, text: "#ORD-000144 · Bank Transfer", amount: "Rs. 28,900", tone: "text-emerald-400" },
];

const VISIBLE = 3;

export default function FinalCta() {
  const reduceMotion = useReducedMotion();
  const nextIndex = useRef(VISIBLE);
  const uid = useRef(VISIBLE);
  const [shown, setShown] = useState(() => FEED.slice(0, VISIBLE).map((item, i) => ({ ...item, uid: i })));

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setShown((prev) => [
        ...prev.slice(-(VISIBLE - 1)),
        { ...FEED[nextIndex.current % FEED.length], uid: uid.current },
      ]);
      nextIndex.current += 1;
      uid.current += 1;
    }, 3000);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  return (
    <section
      id="final-cta"
      aria-labelledby="final-cta-title"
      className="scroll-mt-24 px-4 pb-14 pt-2 sm:px-6 lg:px-8"
    >
      <div className="final-cta mx-auto max-w-7xl overflow-hidden rounded-[2rem]">
        <div aria-hidden="true" className="cta-grid absolute inset-0" />

        <div className="relative grid items-center gap-10 p-8 sm:p-12 lg:grid-cols-12 lg:gap-8 lg:p-16">
          {/* Copy */}
          <div className="lg:col-span-7">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-orange-300 backdrop-blur">
              <Zap size={12} aria-hidden="true" />
              Get Started
            </p>
            <h2
              id="final-cta-title"
              className="mt-5 text-3xl font-extrabold leading-[1.08] text-white sm:text-5xl"
            >
              See it running on
              <br />
              <span className="text-orange-300">
                your business — today.
              </span>
            </h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-white/70">
              A 15-minute live demo on WhatsApp. Your real orders, invoices,
              shipping rules and reports — walked through end to end. No
              signup, no card, no fine print.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Click Master Store! Show me the full platform on a live demo.")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[56px] items-center gap-2.5 rounded-2xl bg-[var(--user-accent)] px-7 text-base font-extrabold text-white shadow-sm transition-colors duration-200 hover:bg-[var(--user-accent-hover)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400"
              >
                <MessageCircle size={21} aria-hidden="true" />
                Book a Free Demo
              </a>
              <a
                href="#features"
                className="inline-flex min-h-[56px] items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 text-base font-bold text-white/85 backdrop-blur transition-all duration-200 hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Explore the Platform
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>

            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-white/55">
              {["Free migration help included", "Full Urdu (RTL) support", "COD-first workflow"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-400" aria-hidden="true" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Live activity feed (DEMO) */}
          <div className="lg:col-span-5" aria-hidden="true">
            <div className="relative rounded-3xl border border-white/10 bg-[#111926] p-5 shadow-lg">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <p className="font-mono text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-400">
                    Live activity
                  </p>
                </div>
                <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-white/40">
                  Demo
                </span>
              </div>

              <ul className="mt-4 space-y-2">
                <AnimatePresence initial={false} mode="popLayout">
                  {shown.map(({ icon: Icon, text, amount, tone, uid: eventId }) => (
                    <motion.li
                      key={eventId}
                      layout
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 420, damping: 36 }}
                      className="flex h-[60px] items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-4"
                    >
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 ${tone}`}>
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] font-semibold leading-5 text-white/80">
                        {text}
                      </span>
                      {amount && (
                        <span className="shrink-0 text-[12px] font-bold tabular-nums text-white/60">
                          {amount}
                        </span>
                      )}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              <p className="mt-4 border-t border-white/5 pt-3 text-center text-[9px] font-semibold uppercase tracking-[0.25em] text-white/30">
                Sample feed — what your dashboard emits
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
