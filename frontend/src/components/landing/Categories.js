"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Smartphone,
  Shirt,
  Home,
  Sparkles,
  Dumbbell,
  BookOpen,
  Baby,
  Car,
  ArrowRight,
} from "lucide-react";
import SectionHeading from "./SectionHeading";
import { CATEGORIES } from "./data";

const ICONS = {
  smartphone: Smartphone,
  shirt: Shirt,
  home: Home,
  sparkles: Sparkles,
  dumbbell: Dumbbell,
  book: BookOpen,
  baby: Baby,
  car: Car,
};

export default function Categories() {
  return (
    <section id="categories" aria-labelledby="categories-title" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-14 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Browse"
        title="Shop by Category"
        subtitle="8 departments, 45,000+ products — jo tu chahe, yahan hai."
        action={
          <Link href="/shop" className="flex min-h-[44px] items-center gap-1.5 text-sm font-bold text-[var(--user-accent)] hover:text-[var(--user-accent-hover)]">
            View all <ArrowRight size={16} aria-hidden="true" />
          </Link>
        }
      />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:grid-cols-8">
        {CATEGORIES.map(({ name, icon, slug }, i) => {
          const Icon = ICONS[icon] || Smartphone;
          return (
            <motion.li
              key={slug}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <Link
                href={`/shop?category=${slug}`}
                className="group flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-3 text-center transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--user-accent)] hover:shadow-[0_16px_36px_color-mix(in_srgb,var(--user-accent)_22%,transparent)] focus-visible:outline-2 focus-visible:outline-[var(--user-accent)]"
                aria-label={`Shop ${name}`}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--user-accent-soft)] text-[var(--user-accent)] transition-all duration-300 group-hover:scale-110">
                  <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="text-[11px] font-bold leading-tight text-[var(--user-text-secondary)] sm:text-xs">
                  {name}
                </span>
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="-mt-1 translate-y-1 text-[var(--user-accent)] opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
                />
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
