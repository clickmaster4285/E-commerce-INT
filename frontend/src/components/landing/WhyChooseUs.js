"use client";

import { motion } from "framer-motion";
import { Truck, ShieldCheck, Banknote, RotateCcw } from "lucide-react";

const FEATURES = [
  {
    icon: Truck,
    title: "Fast Delivery",
    text: "Same-day dispatch in Lahore, Karachi & Islamabad. 2–4 days across Pakistan.",
  },
  {
    icon: ShieldCheck,
    title: "Secure Payment",
    text: "JazzCash, Easypaisa, bank transfer aur 100% encrypted card payments.",
  },
  {
    icon: Banknote,
    title: "Cash on Delivery",
    text: "Pehle product apne haath mein lo, phir paise do. Zero risk.",
  },
  {
    icon: RotateCcw,
    title: "Easy Returns",
    text: "7 din mein free return & exchange — no questions asked.",
  },
];

export default function WhyChooseUs() {
  return (
    <section id="why-us" aria-labelledby="why-us-title" className="scroll-mt-24 bg-[var(--user-bg-card)] py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--user-accent)]">
            The Click Master Promise
          </p>
          <h2 id="why-us-title" className="mt-2 text-2xl font-extrabold text-[var(--user-text)] sm:text-3xl">
            Why 250,000+ Pakistanis Shop With Us
          </h2>
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <motion.li
              key={title}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              className="landing-card landing-card-lift group p-6 text-center"
            >
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--user-accent-soft)] text-[var(--user-accent)] transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110">
                <Icon size={28} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-base font-extrabold text-[var(--user-text)]">{title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-[var(--user-text-muted)]">{text}</p>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
