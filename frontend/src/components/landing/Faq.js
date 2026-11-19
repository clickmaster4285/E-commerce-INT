"use client";

import { useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDown, Search, Headset, MessageCircle, Mail, X } from "lucide-react";
import { FAQS, SITE, WHATSAPP_NUMBER } from "./content";

const CATEGORIES = ["All", "Payments", "Shipping", "Invoices", "Account & Staff", "Returns"];

export default function Faq() {
  const reduce = useReducedMotion();
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [preferredOpenId, setPreferredOpenId] = useState(FAQS[0]?.id ?? null);
  const listRef = useRef(null);

  const trimmed = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      FAQS.filter(
        (f) =>
          (category === "All" || f.category === category) &&
          (!trimmed || `${f.q} ${f.a}`.toLowerCase().includes(trimmed))
      ),
    [category, trimmed]
  );

  /* Effective open item — inside the visible set; null means user closed it */
  let openId = null;
  if (visible.length > 0 && preferredOpenId !== null) {
    openId = visible.some((f) => f.id === preferredOpenId) ? preferredOpenId : visible[0].id;
  }

  const onListKeyDown = (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const buttons = Array.from(listRef.current?.querySelectorAll(".faq-question") ?? []);
    const idx = buttons.indexOf(document.activeElement);
    if (idx === -1) return;
    event.preventDefault();
    let next;
    if (event.key === "ArrowDown") next = (idx + 1) % buttons.length;
    else if (event.key === "ArrowUp") next = (idx - 1 + buttons.length) % buttons.length;
    else if (event.key === "Home") next = 0;
    else next = buttons.length - 1;
    buttons[next].focus();
  };

  const fade = (delay = 0) => ({
    initial: reduce ? false : { opacity: 0, y: 18 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.4, ease: "easeOut", delay },
  });

  const waHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    "Hi, I have a question about Click Master Store"
  )}`;

  return (
    <section id="faq" aria-labelledby="faq-title" className="faq-section scroll-mt-24">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
          {/* ---------- Left — sticky intro + help card ---------- */}
          <motion.div {...fade(0)} className="lg:col-span-5 lg:self-start lg:sticky lg:top-[120px]">
            <p className="tt-eyebrow text-[11px] font-bold uppercase tracking-[0.18em]">FAQ</p>
            <h2 id="faq-title" className="faq-title mt-2 font-extrabold leading-[1.12] tracking-tight">
              Questions? Answered.
            </h2>
            <p className="tt-sub mt-4 max-w-md text-base leading-6">
              Straight answers about COD, shipping, invoices and support — no sales fluff.
            </p>

            {/* Help card */}
            <div className="faq-help-card mt-7">
              <span className="faq-help-icon" aria-hidden="true">
                <Headset size={22} />
              </span>
              <h3 className="faq-help-title">Still have questions?</h3>
              <p className="faq-help-text">
                Our team replies on WhatsApp within minutes — order, invoice or setup, anything.
              </p>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                className="faq-wa-btn"
              >
                <MessageCircle size={20} aria-hidden="true" />
                Chat on WhatsApp
              </a>
              <a href={`mailto:${SITE.email}`} className="faq-email-link">
                <Mail size={15} aria-hidden="true" />
                Email us — {SITE.email}
              </a>
            </div>
          </motion.div>

          {/* ---------- Right — search + chips + accordion ---------- */}
          <div className="lg:col-span-7">
            {/* Search */}
            <label className="faq-search">
              <Search size={18} className="faq-search-icon" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search questions..."
                aria-label="Search questions"
                className="faq-search-input"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="faq-search-clear"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </label>

            {/* Category chips */}
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter questions by topic">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className="tt-chip"
                  aria-pressed={category === cat}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <p className="sr-only" role="status" aria-live="polite">
              {visible.length} {visible.length === 1 ? "question" : "questions"} shown
              {category !== "All" ? ` in ${category}` : ""}
            </p>

            {/* Accordion */}
            <ul ref={listRef} onKeyDown={onListKeyDown} className="faq-list mt-5">
              {visible.map(({ id, category: cat, q, a }, i) => {
                const isOpen = id === openId;
                return (
                  <motion.li
                    key={id}
                    layout
                    initial={reduce ? false : { opacity: 0, y: 16 }}
                    animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut", delay: reduce ? 0 : i * 0.04 }}
                  >
                    <div className="faq-item" data-open={isOpen}>
                      <button
                        type="button"
                        className="faq-question"
                        id={`faq-q-${id}`}
                        aria-expanded={isOpen}
                        aria-controls={`faq-a-${id}`}
                        onClick={() => setPreferredOpenId(isOpen ? null : id)}
                      >
                        <span className="min-w-0">
                          <span className="faq-category">{cat}</span>
                          <span className="faq-question-text">{q}</span>
                        </span>
                        <ChevronDown size={20} className="faq-chevron" aria-hidden="true" />
                      </button>
                      <div
                        id={`faq-a-${id}`}
                        role="region"
                        aria-labelledby={`faq-q-${id}`}
                        className="faq-answer"
                        data-open={isOpen}
                      >
                        <div className="faq-answer-inner">
                          <p className="faq-answer-text">{a}</p>
                        </div>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
              {visible.length === 0 && (
                <li className="faq-empty">
                  <p className="tt-quote text-base font-bold">No questions match &ldquo;{query.trim()}&rdquo;.</p>
                  <button type="button" className="faq-email-link mt-2" onClick={() => { setQuery(""); setCategory("All"); }}>
                    Clear search and filters
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
