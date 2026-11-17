"use client";

import { motion } from "framer-motion";
import { Banknote, FileText, Boxes, Headset, Languages } from "lucide-react";
import { TRUST_POINTS } from "./content";

const ICONS = {
  banknote: Banknote,
  "file-text": FileText,
  boxes: Boxes,
  headset: Headset,
  languages: Languages,
};

export default function TrustStrip() {
  return (
    <div
      id="why"
      className="scroll-mt-24 border-y border-[var(--user-border)] bg-[var(--user-bg-card)]"
      aria-label="Why businesses choose Click Master Store"
    >
      <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 sm:grid-cols-3 sm:px-6 md:grid-cols-5 lg:px-8">
        {TRUST_POINTS.map(({ icon, text }, i) => {
          const Icon = ICONS[icon] || Banknote;
          return (
            <motion.li
              key={text}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="flex items-center gap-2"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--user-accent-soft)] text-[var(--user-accent)]">
                <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span className="text-[11px] font-bold leading-tight text-[var(--user-text-secondary)] sm:text-xs">
                {text}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
