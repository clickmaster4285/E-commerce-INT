"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";
import {
  Upload,
  Truck,
  CheckCircle2,
  Timer,
} from "lucide-react";
import { FaWhatsapp, FaFacebookF, FaInstagram } from "react-icons/fa6";

/* ============================================================
   GO LIVE IN 15 MINUTES — 4-step onboarding, code-built previews
   ============================================================ */

const STORE_NAME = "Al-Noor Electronics";

const STEP_TIMES = [2, 5, 4, 4];
const SEGMENT_COLORS = ["#FF6A1F", "#FF8A47", "#FFA75C", "#FFC98A"];
const SEGMENT_LABELS = ["Store · 2m", "Catalog · 5m", "Payments · 4m", "Launch · 4m"];

/* ---------- Step 1 — Create your store ---------- */
function StoreFormPreview({ typed }) {
  return (
    <div className="gl-mini">
      <span className="gl-mini-label">Store name</span>
      <div className="gl-mini-input">
        <span className="gl-mini-value">{typed}</span>
        {typed.length < STORE_NAME.length && <span className="gl-caret" />}
      </div>
      <div className="gl-mini-row">
        <span className="gl-chip">₨ PKR</span>
        <span className="gl-lang" aria-hidden="true">
          <b className="gl-lang-on">EN</b>
          <span className="gl-lang-sep">|</span>
          <span className="urdu-text">اردو</span>
        </span>
      </div>
      <div className="gl-mini-logo">
        <span className="gl-mini-logo-mark" aria-hidden="true">A</span>
        <span className="gl-mini-logo-text">Logo uploaded</span>
      </div>
    </div>
  );
}

/* ---------- Step 2 — Add your products ---------- */
const PRODUCTS = [
  ["Samsung Galaxy A15", "Rs. 42,999"],
  ["Type-C Cable", "Rs. 850"],
  ["Tempered Glass", "Rs. 1,200"],
];

function ProductTablePreview() {
  return (
    <div className="gl-mini">
      <div className="gl-table-head">
        <span>Product</span>
        <span>Price</span>
      </div>
      <ul className="gl-table">
        {PRODUCTS.map(([name, price]) => (
          <li key={name} className="gl-table-row">
            <span className="gl-table-name">{name}</span>
            <span className="pf-mono gl-table-price">{price}</span>
          </li>
        ))}
      </ul>
      <span className="gl-import">
        <Upload size={12} aria-hidden="true" />
        Import CSV
      </span>
    </div>
  );
}

/* ---------- Step 3 — Payments & shipping ---------- */
const TOGGLES = [
  { label: "Cash on Delivery", on: true },
  { label: "Bank Transfer", on: true },
  { label: "Card (POS)", on: false },
];

function PaymentsPreview({ animate }) {
  return (
    <div className="gl-mini">
      <ul className="gl-toggle-list">
        {TOGGLES.map(({ label, on }, i) => (
          <li key={label} className="gl-toggle-row">
            <span className="gl-toggle-label">{label}</span>
            <span className={`mini-toggle ${on ? "mini-toggle-on" : ""}`}>
              <motion.span
                className="mini-knob"
                initial={false}
                animate={animate && i === 0 ? { x: 14 } : { x: on ? 14 : 0 }}
                transition={{ delay: animate && i === 0 ? 0.9 : 0, duration: 0.4, ease: "easeOut" }}
              />
            </span>
          </li>
        ))}
      </ul>
      <div className="gl-chip-row">
        <span className="gl-rate-chip">Standard · Rs. 200</span>
        <span className="gl-rate-chip">Express · Rs. 500</span>
      </div>
      <p className="gl-free">
        <Truck size={12} aria-hidden="true" />
        Free delivery above Rs. 10,000
      </p>
    </div>
  );
}

/* ---------- Step 4 — Take your first order ---------- */
function FirstOrderPreview({ animate, reduce }) {
  return (
    <div className="gl-mini">
      <motion.div
        className="gl-toast"
        initial={reduce ? false : { opacity: 0, y: -14 }}
        animate={animate ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 1.15, duration: 0.45, ease: "easeOut" }}
      >
        <CheckCircle2 size={16} className="gl-toast-check" aria-hidden="true" />
        <span className="gl-toast-text">
          New order <b className="pf-mono">ORD-000001</b> · COD
        </span>
      </motion.div>
      <div className="gl-share">
        <span className="gl-mini-label">Share your store link</span>
        <div className="gl-share-icons">
          <span className="gl-share-btn gl-share-wa"><FaWhatsapp size={15} aria-hidden="true" /></span>
          <span className="gl-share-btn gl-share-fb"><FaFacebookF size={13} aria-hidden="true" /></span>
          <span className="gl-share-btn gl-share-ig"><FaInstagram size={15} aria-hidden="true" /></span>
        </div>
        <span className="gl-share-count">+12 shares today</span>
      </div>
    </div>
  );
}

const PREVIEWS = {
  store: StoreFormPreview,
  products: ProductTablePreview,
  payments: PaymentsPreview,
  order: FirstOrderPreview,
};

const STEPS = [
  {
    id: "store",
    title: "Create your store",
    desc: "Add your business name, logo and currency. Choose English or Urdu (RTL).",
    time: "2 min",
    preview: "store",
    previewLabel: "Step 1 preview: store setup form",
  },
  {
    id: "products",
    title: "Add your products",
    desc: "Import a CSV or add products one by one, with categories, prices and stock.",
    time: "5 min",
    preview: "products",
    previewLabel: "Step 2 preview: product list with import",
  },
  {
    id: "payments",
    title: "Set payments & shipping",
    desc: "Turn on COD and bank transfer, then set Standard and Express rates and your free-delivery limit.",
    time: "4 min",
    preview: "payments",
    previewLabel: "Step 3 preview: payment method toggles",
  },
  {
    id: "order",
    title: "Take your first order",
    desc: "Share your store link on WhatsApp, Facebook or Instagram. Orders land in your dashboard with a unique ORD- number.",
    time: "4 min",
    preview: "order",
    previewLabel: "Step 4 preview: new order notification",
  },
];

export default function HowItWorks() {
  const reduce = useReducedMotion();
  const sectionRef = useRef(null);
  const inView = useInView(sectionRef, { once: true, margin: "-120px" });
  const [typedCount, setTypedCount] = useState(reduce ? STORE_NAME.length : 0);

  /* Typing animation for the store-name field */
  useEffect(() => {
    if (reduce || !inView) return undefined;
    let count = 0;
    const id = window.setInterval(() => {
      count += 1;
      setTypedCount(count);
      if (count >= STORE_NAME.length) window.clearInterval(id);
    }, 55);
    return () => window.clearInterval(id);
  }, [inView, reduce]);

  const typedText = reduce ? STORE_NAME : STORE_NAME.slice(0, typedCount);

  return (
    <section id="how-it-works" ref={sectionRef} aria-labelledby="hiw-title" className="gl-section scroll-mt-[88px]">
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        {/* ---------- Header ---------- */}
        <div className="mx-auto max-w-[720px] text-center">
          <p className="tt-eyebrow text-[11px] font-bold uppercase tracking-[0.18em]">How It Works</p>
          <h2 id="hiw-title" className="gl-title mt-2 font-extrabold">
            Go live in 15 minutes
          </h2>
          <p className="tt-sub mt-6 text-base leading-6 sm:text-lg sm:leading-7">
            No developers, no complicated setup. Four simple steps from signup to your first order.
          </p>
        </div>

        {/* ---------- Steps ---------- */}
        <ol className="gl-steps mt-12 lg:mt-16">
          {/* Horizontal connector — desktop only */}
          <div className="gl-connector" aria-hidden="true">
            <div className="gl-connector-track" />
            <motion.div
              className="gl-connector-fill"
              initial={reduce ? false : { scaleX: 0 }}
              animate={inView ? { scaleX: 1 } : { scaleX: reduce ? 1 : 0 }}
              transition={reduce ? undefined : { duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            />
          </div>

          {STEPS.map((step, i) => {
            const Preview = PREVIEWS[step.preview];
            return (
              <motion.li
                key={step.id}
                className="gl-step"
                initial={reduce ? false : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, ease: "easeOut", delay: i * 0.1 }}
              >
                <div className="gl-card">
                  <div className="gl-card-top">
                    <motion.span
                      className="gl-node"
                      initial={false}
                      animate={
                        inView
                          ? { backgroundColor: "#FF6A1F", borderColor: "#FF6A1F", color: "#FFFFFF" }
                          : {}
                      }
                      transition={reduce ? { duration: 0 } : { delay: 0.25 + i * 0.28, duration: 0.4 }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </motion.span>
                    <span className="gl-time-badge">{step.time}</span>
                  </div>

                  <div className="gl-preview" aria-hidden="true" aria-label={step.previewLabel}>
                    <Preview typed={typedText} animate={inView} reduce={reduce} />
                  </div>

                  <h3 className="gl-step-title">{step.title}</h3>
                  <p className="gl-step-desc">{step.desc}</p>
                </div>
              </motion.li>
            );
          })}
        </ol>

        {/* ---------- Total time bar ---------- */}
        <div className="gl-total mt-8">
          <div className="gl-total-bar" role="img" aria-label="Time per step: store 2 minutes, catalog 5 minutes, payments 4 minutes, launch 4 minutes">
            {STEP_TIMES.map((minutes, i) => (
              <div key={i} className="gl-total-seg" style={{ flex: minutes }}>
                <motion.div
                  className="gl-total-fill"
                  style={{ background: SEGMENT_COLORS[i] }}
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={inView ? { scaleX: 1 } : { scaleX: reduce ? 1 : 0 }}
                  transition={reduce ? undefined : { delay: 0.3 + i * 0.18, duration: 0.5, ease: "easeOut" }}
                />
              </div>
            ))}
          </div>
          <div className="gl-total-foot">
            <div className="gl-total-legend" aria-hidden="true">
              {SEGMENT_LABELS.map((label, i) => (
                <span key={i} className="gl-total-legend-item">
                  <span className="gl-total-dot" style={{ background: SEGMENT_COLORS[i] }} />
                  {label}
                </span>
              ))}
            </div>
            <span className="gl-total-chip">
              <Timer size={13} aria-hidden="true" />
              ≈ 15 minutes to your first order
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
