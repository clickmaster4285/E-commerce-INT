"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import {
  Zap,
  MessageCircle,
  ArrowRight,
  ArrowLeftRight,
  Languages,
  Banknote,
  Send,
  Timer,
  Database,
  CalendarCheck,
  CreditCard,
} from "lucide-react";
import { WHATSAPP_NUMBER } from "./content";

const DEMO_MESSAGE = "Hi, I'd like to book a free demo of Click Master Store";
const SLOTS = ["Today 4:00 PM", "Tomorrow 11:00 AM", "Tomorrow 3:00 PM"];

const waLink = (message) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

const FACTS = [
  { icon: Timer, value: "15 min", label: "Live walkthrough" },
  { icon: Database, value: "Your data", label: "Demo on your real orders" },
  { icon: CalendarCheck, value: "Same day", label: "Slot confirmation" },
  { icon: CreditCard, value: "No card", label: "Required to book" },
];

export default function FinalCta() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(reduce ? 2 : 0); // 0 idle · 1 typing · 2 replied
  const chatRef = useRef(null);
  const chatInView = useInView(chatRef, { once: true, margin: "-80px" });

  useEffect(() => {
    if (reduce || !chatInView) return undefined;
    const t1 = window.setTimeout(() => setPhase(1), 700); // typing after the customer bubble lands
    const t2 = window.setTimeout(() => setPhase(2), 1450); // reply replaces the typing indicator
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [chatInView, reduce]);

  const fade = (delay = 0) => ({
    initial: reduce ? false : { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-80px" },
    transition: { duration: 0.5, ease: "easeOut", delay },
  });

  return (
    <section id="final-cta" aria-labelledby="final-cta-title" className="cta-band">
      <div aria-hidden="true" className="cta-grid-faint" />
      <div aria-hidden="true" className="cta-glow cta-glow-a" />

      <div className="relative mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid items-center gap-6 sm:gap-8 lg:grid-cols-12 lg:gap-8">
          {/* ---------- LEFT ---------- */}
          <motion.div {...fade(0)} className="lg:col-span-7">
            <p className="cta-eyebrow">
              <Zap size={12} aria-hidden="true" />
              Get Started
            </p>
            <h2 id="final-cta-title" className="cta-title">
              See it running on
              <span className="hidden sm:inline"><br /></span>{" "}
              <span className="cta-title-grad">your business&nbsp;— today.</span>
            </h2>
            <p className="cta-sub">
              A free 15-minute live demo on WhatsApp. We walk through your real
              orders, invoices and shipping rules, end to end. No signup, no card.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href={waLink(DEMO_MESSAGE)}
                target="_blank"
                rel="noopener noreferrer"
                className="cta-primary w-full sm:w-auto"
              >
                <MessageCircle size={21} aria-hidden="true" />
                Book a Free Demo on WhatsApp
              </a>
              <a href="#features" className="cta-ghost btn-ghost-on-dark w-full sm:w-auto">
                Explore the Platform
                <ArrowRight size={18} className="cta-flip" aria-hidden="true" />
              </a>
            </div>

            <ul className="cta-trust">
              <li>
                <ArrowLeftRight size={20} aria-hidden="true" />
                Free migration help
              </li>
              <li>
                <Languages size={20} aria-hidden="true" />
                Full Urdu (RTL) support
              </li>
              <li>
                <Banknote size={20} aria-hidden="true" />
                COD-first workflow
              </li>
            </ul>
          </motion.div>

          {/* ---------- RIGHT — WhatsApp chat preview ---------- */}
          <motion.figure
            {...fade(0.12)}
            ref={chatRef}
            className="wa-card lg:col-span-5"
            aria-label="Example WhatsApp conversation"
          >
            {/* Header */}
            <div className="wa-header">
              <span className="wa-avatar" aria-hidden="true">
                CM
                <span className="wa-online" />
              </span>
              <div className="min-w-0">
                <p className="wa-name">Click Master Team</p>
                <p className="wa-sub">Typically replies in 5 minutes</p>
              </div>
            </div>

            {/* Chat body */}
            <div className="wa-body">
              <p className="wa-today">Today</p>

              <motion.div
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={chatInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.35, ease: "easeOut", delay: reduce ? 0 : 0.15 }}
                className="wa-bubble-out"
              >
                Hi, I&apos;d like a demo for my store
              </motion.div>

              {phase === 1 && (
                <div className="wa-typing" aria-hidden="true">
                  <span className="wa-dot" />
                  <span className="wa-dot" />
                  <span className="wa-dot" />
                </div>
              )}

              {phase >= 2 && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="wa-bubble-in"
                >
                  Sure! Which time works for you today or tomorrow?
                </motion.div>
              )}

              {phase >= 2 && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut", delay: reduce ? 0 : 0.15 }}
                  className="wa-slots"
                  role="group"
                  aria-label="Pick a demo slot"
                >
                  {SLOTS.map((slot) => (
                    <a
                      key={slot}
                      href={waLink(`${DEMO_MESSAGE} — ${slot}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wa-slot"
                    >
                      {slot}
                    </a>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Message input (decorative) */}
            <div className="wa-input" aria-hidden="true">
              Type a message…
              <Send size={17} className="wa-input-icon" />
            </div>
          </motion.figure>
        </div>

        {/* ---------- Benefits strip ---------- */}
        <dl className="cta-facts">
          {FACTS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="cta-fact">
              <Icon size={20} className="cta-fact-icon" aria-hidden="true" />
              <dt className="sr-only">{label}</dt>
              <dd className="cta-fact-value">{value}</dd>
              <dd className="cta-fact-label">{label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
