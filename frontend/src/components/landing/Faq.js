"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, MessageCircleQuestion } from "lucide-react";
import SectionHeading from "./SectionHeading";
import { FAQS, WHATSAPP_NUMBER } from "./content";

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionHeading
            eyebrow="FAQ"
            title="Questions? Answered."
            subtitle="Straight answers about COD, shipping, invoices and support — no sales fluff."
          />
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi Click Master Store! I have a question.")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="landing-btn landing-btn-ghost"
          >
            <MessageCircleQuestion size={18} aria-hidden="true" />
            Ask us on WhatsApp
          </a>
        </div>

        <div className="lg:col-span-8">
          <ul className="divide-y divide-[var(--user-border)] overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)]">
            {FAQS.map(({ q, a }, i) => {
              const isOpen = i === open;
              return (
                <li key={q}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    id={`faq-q-${i}`}
                    className="flex min-h-[56px] w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[var(--user-bg-hover)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--user-accent)]"
                  >
                    <span className="text-sm font-bold text-[var(--user-text)] sm:text-base">{q}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      className="shrink-0 text-[var(--user-accent)]"
                    >
                      <ChevronDown size={20} aria-hidden="true" />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="answer"
                        id={`faq-a-${i}`}
                        role="region"
                        aria-labelledby={`faq-q-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <p className="border-t border-[var(--user-border)] px-5 py-4 text-sm leading-7 text-[var(--user-text-muted)]">
                          {a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
