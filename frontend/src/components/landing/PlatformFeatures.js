"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileCheck,
  Receipt,
  Truck,
  Wallet,
  Boxes,
  MessagesSquare,
  BarChart3,
  CheckCircle2,
  Banknote,
  Landmark,
  CreditCard,
  PackageCheck,
  ArrowRight,
} from "lucide-react";
import SectionHeading from "./SectionHeading";
import CountUp from "./CountUp";
import { FEATURES } from "./content";

const ICONS = {
  "file-check": FileCheck,
  receipt: Receipt,
  truck: Truck,
  wallet: Wallet,
  boxes: Boxes,
  "messages-square": MessagesSquare,
  "bar-chart-3": BarChart3,
};

/* ============ ANIMATED MOCKUPS (code-built, no images) ============ */

function QuoteMock() {
  const [status, setStatus] = useState("Sent");
  useEffect(() => {
    const id = window.setInterval(
      () => setStatus((s) => (s === "Sent" ? "Accepted" : "Sent")),
      2600
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 text-left shadow-xl">
      <div className="flex items-center justify-between border-b border-[var(--user-border)] pb-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--user-text-muted)]">Quotation</p>
          <p className="font-mono text-sm font-extrabold text-[var(--user-text)]">QT-00042</p>
        </div>
        <AnimatePresence mode="wait">
          <motion.span
            key={status}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
              status === "Accepted" ? "bg-emerald-500/15 text-emerald-600" : "bg-sky-500/15 text-sky-600"
            }`}
          >
            {status.toUpperCase()}
          </motion.span>
        </AnimatePresence>
      </div>
      <ul className="mt-3 space-y-2 text-[12px]">
        {[
          ["Cat 6 UTP Cable (305m) × 2", "Rs. 24,000"],
          ["RJ45 Connectors (100 pack)", "Rs. 2,500"],
          ["Labour & Installation", "Rs. 6,500"],
        ].map(([item, amount], i) => (
          <motion.li
            key={item}
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.18 }}
            className="flex items-center justify-between gap-3 border-b border-dashed border-[var(--user-border)] pb-2"
          >
            <span className="text-[var(--user-text-secondary)]">{item}</span>
            <span className="font-bold tabular-nums">{amount}</span>
          </motion.li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--user-text-muted)]">Total</span>
        <span className="text-lg font-extrabold text-[var(--user-accent)]">Rs. 33,000</span>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--user-text-muted)]">
        <FileCheck size={12} aria-hidden="true" /> Converts to order on acceptance
      </div>
    </div>
  );
}

function InvoiceMock() {
  const rows = [
    ["Dawlance Microwave 25L", "1", "Rs. 28,999"],
    ["Tax (GST 17%)", "—", "Rs. 4,930"],
    ["Discount (Bundle)", "—", "- Rs. 1,500"],
  ];
  return (
    <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 text-left shadow-xl">
      <div className="flex items-center justify-between border-b border-[var(--user-border)] pb-3">
        <div className="flex items-center gap-2">
          <Receipt size={18} className="text-[var(--user-accent)]" aria-hidden="true" />
          <p className="font-mono text-sm font-extrabold text-[var(--user-text)]">INV-000214</p>
        </div>
        <span className="rounded-full bg-red-500/15 px-3 py-1 text-[10px] font-extrabold text-red-600">UNPAID · DUE IN 3 DAYS</span>
      </div>
      <table className="mt-3 w-full text-[12px]">
        <thead>
          <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[var(--user-text-muted)]">
            <th className="pb-1.5">Item</th>
            <th className="pb-1.5">Qty</th>
            <th className="pb-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([item, qty, amount], i) => (
            <motion.tr
              key={item}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.2 }}
              className="border-t border-dashed border-[var(--user-border)]"
            >
              <td className="py-1.5 text-[var(--user-text-secondary)]">{item}</td>
              <td className="py-1.5">{qty}</td>
              <td className="py-1.5 text-right font-bold tabular-nums">{amount}</td>
            </motion.tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--user-border)] pt-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--user-text-muted)]">Grand Total</span>
        <span className="text-xl font-extrabold tabular-nums text-[var(--user-accent)]">
          <CountUp value={32429} prefix="Rs. " duration={1.4} />
        </span>
      </div>
      <p className="mt-2 text-[10px] font-semibold text-[var(--user-text-muted)]">
        PDF emailed to customer · Payments reconciled automatically
      </p>
    </div>
  );
}

function ShippingMock() {
  return (
    <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 text-left shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck size={18} className="text-[var(--user-accent)]" aria-hidden="true" />
          <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--user-text-muted)]">Shipment</p>
        </div>
        <span className="rounded-full bg-sky-500/15 px-3 py-1 text-[10px] font-extrabold text-sky-600">ON ROUTE · LH→KHI</span>
      </div>

      <svg viewBox="0 0 320 64" className="mt-3 w-full" role="presentation">
        <path id="ship-route" d="M12 50 C 90 50 100 12 170 14 S 280 14, 308 14" fill="none" stroke="var(--user-border)" strokeWidth="4" strokeDasharray="7 7" strokeLinecap="round" />
        <circle cx="12" cy="50" r="6" fill="var(--user-border)" />
        <circle cx="308" cy="14" r="6" fill="var(--user-accent)" />
        {/* Simple truck glyph in accent */}
        <g>
          <rect x="-13" y="-8" width="17" height="11" rx="2.5" fill="var(--user-accent)" />
          <path d="M4 -5 h6 a2 2 0 0 1 2 2 v6 h-8 z" fill="var(--user-accent-hover)" />
          <circle cx="-8" cy="4.5" r="2.4" fill="#0b0f14" />
          <circle cx="7" cy="4.5" r="2.4" fill="#0b0f14" />
          <animateMotion dur="4.8s" repeatCount="indefinite" rotate="auto">
            <mpath href="#ship-route" />
          </animateMotion>
        </g>
      </svg>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {[
          ["Standard", "Rs. 200 · 2–4 days"],
          ["Express", "Rs. 500 · 1–2 days"],
        ].map(([label, detail]) => (
          <div key={label} className="rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--user-text-muted)]">{label}</p>
            <p className="mt-0.5 text-xs font-extrabold text-[var(--user-text)]">{detail}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold text-emerald-700">
        Free delivery on orders above Rs. 10,000 — set by you
      </div>
    </div>
  );
}

function PaymentsMock() {
  const methods = [
    { icon: Banknote, label: "Cash on Delivery", detail: "Paid at doorstep" },
    { icon: Landmark, label: "Bank Transfer", detail: "Meezan Bank · ref. required" },
    { icon: CreditCard, label: "Card (in-store POS)", detail: "Chip & swipe billing" },
  ];
  const methodsRef = useRef(methods.length);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setIdx((i) => (i + 1) % methodsRef.current), 2400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 text-left shadow-xl">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--user-text-muted)]">Payment Methods</p>
      <ul className="mt-3 space-y-2">
        {methods.map(({ icon: Icon, label, detail }, i) => {
          const active = i === idx;
          return (
            <li
              key={label}
              className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-all duration-300 ${
                active
                  ? "border-[var(--user-accent)] bg-[var(--user-accent-soft)] shadow-sm"
                  : "border-[var(--user-border)]"
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[var(--user-accent)] text-white" : "bg-[var(--user-bg-hover)] text-[var(--user-text-secondary)]"}`}>
                <Icon size={19} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-extrabold text-[var(--user-text)]">{label}</span>
                <span className="block text-[10px] font-semibold text-[var(--user-text-muted)]">{detail}</span>
              </span>
              {active && <CheckCircle2 size={18} className="ml-auto shrink-0 text-emerald-500" aria-hidden="true" />}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--user-bg-hover)] px-3 py-2 text-[11px] font-bold text-[var(--user-text-secondary)]">
        <PackageCheck size={15} className="text-emerald-500" aria-hidden="true" />
        Rs. 10,529 recorded in ledger · status: Paid
      </div>
    </div>
  );
}

function InventoryMock() {
  const rows = [
    { sku: "SKU-1001 · Wireless Headphones", qty: 84, max: 100, low: false },
    { sku: "SKU-1042 · Cookware 12pc", qty: 17, max: 100, low: true },
    { sku: "SKU-1077 · Smart Watch Fit 3", qty: 62, max: 100, low: false },
    { sku: "SKU-1088 · Anti-Aging Serum", qty: 6, max: 100, low: true },
  ];
  return (
    <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 text-left shadow-xl">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--user-text-muted)]">Live Stock Levels</p>
        <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Real-time
        </span>
      </div>
      <ul className="mt-3 space-y-3">
        {rows.map(({ sku, qty, max, low }) => (
          <li key={sku}>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="font-semibold text-[var(--user-text-secondary)]">{sku}</span>
              <span className={`font-mono font-bold tabular-nums ${low ? "text-red-500" : "text-[var(--user-text-muted)]"}`}>
                {qty} left{low && " · LOW"}
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--user-bg-hover)]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(qty / max) * 100}%` }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                className={`h-full rounded-full ${low ? "bg-red-500" : "bg-emerald-500"}`}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] font-semibold text-[var(--user-text-muted)]">
        Every order, return and PO receipt updates these bars live over WebSocket.
      </p>
    </div>
  );
}

function ChatMock() {
  const messages = [
    { from: "customer", text: "Is my parcel out for delivery today?" },
    { from: "admin", text: "Yes! ORD-000142 left Lahore hub at 9am. ETA tomorrow." },
    { from: "customer", text: "Perfect — I will keep the cash ready." },
    { from: "admin", text: "Great. Anything else I can help with?" },
  ];
  return (
    <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 text-left shadow-xl">
      <div className="flex items-center justify-between border-b border-[var(--user-border)] pb-3">
        <div className="flex items-center gap-2">
          <MessagesSquare size={18} className="text-[var(--user-accent)]" aria-hidden="true" />
          <p className="text-xs font-extrabold text-[var(--user-text)]">Support · #ORD-000142</p>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600">LIVE</span>
      </div>
      <ul className="mt-3 space-y-2">
        {messages.map((m, i) => (
          <motion.li
            key={i}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.5 }}
            className={`max-w-[78%] rounded-2xl px-3 py-2 text-[11px] leading-5 ${
              m.from === "customer"
                ? "rounded-bl-sm bg-[var(--user-bg-hover)] text-[var(--user-text-secondary)]"
                : "ml-auto rounded-br-sm bg-[var(--user-accent)] text-[var(--user-accent-text)]"
            }`}
          >
            {m.text}
          </motion.li>
        ))}
      </ul>
      <p className="mt-3 text-[10px] font-semibold text-[var(--user-text-muted)]">
        Works for guests too — chat carries order context automatically.
      </p>
    </div>
  );
}

function ReportsMock() {
  const bars = [38, 52, 44, 71, 63, 88, 96];
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-5 text-left shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-[var(--user-accent)]" aria-hidden="true" />
          <p className="text-xs font-extrabold text-[var(--user-text)]">Sales · Last 7 Days</p>
        </div>
        <span className="rounded-full bg-[var(--user-accent-soft)] px-2.5 py-0.5 text-[10px] font-extrabold text-[var(--user-accent)]">+18.2% vs last week</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["Revenue", "Rs. 1.28M"],
          ["Orders", "214"],
          ["Avg. Order", "Rs. 5,981"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[var(--user-bg-hover)] px-2 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--user-text-muted)]">{label}</p>
            <p className="mt-0.5 text-sm font-extrabold tabular-nums text-[var(--user-text)]">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex h-28 items-end justify-between gap-2" aria-hidden="true">
        {bars.map((h, i) => (
          <div key={i} className="flex h-full w-full flex-col items-center justify-end gap-1.5">
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.55, delay: 0.1 + i * 0.07, ease: "easeOut" }}
              style={{ height: `${h}%`, transformOrigin: "bottom" }}
              className="w-full rounded-md bg-gradient-to-t from-[var(--user-accent-hover)] to-[var(--user-accent)]"
            />
            <span className="text-[9px] font-bold text-[var(--user-text-muted)]">{days[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const MOCKS = {
  quote: QuoteMock,
  invoice: InvoiceMock,
  shipping: ShippingMock,
  payments: PaymentsMock,
  inventory: InventoryMock,
  chat: ChatMock,
  reports: ReportsMock,
};

/* ============ STICKY FEATURE VIEWER ============ */

export default function PlatformFeatures() {
  const [active, setActive] = useState(1); // Invoice open by default
  const feature = FEATURES[active];
  const Mock = MOCKS[feature.mock];

  return (
    <section id="features" aria-labelledby="features-title" className="relative scroll-mt-24 bg-[var(--user-bg-card)] py-16">
      <span id="shipping" className="absolute -top-24" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The Platform"
          title="Everything the back office needs, built in"
          subtitle="Pick a module — every screen below is real functionality shipped in the product, not a mockup promise."
        />

        {/* Module tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Platform modules">
          {FEATURES.map((f, i) => {
            const Icon = ICONS[f.icon] || FileCheck;
            const selected = i === active;
            return (
              <button
                key={f.id}
                role="tab"
                id={`tab-${f.id}`}
                aria-selected={selected}
                aria-controls="feature-panel"
                onClick={() => setActive(i)}
                className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-4 text-xs font-extrabold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[var(--user-accent)] ${
                  selected
                    ? "border-[var(--user-accent)] bg-[var(--user-accent)] text-[var(--user-accent-text)] shadow-md"
                    : "border-[var(--user-border)] bg-[var(--user-bg-card)] text-[var(--user-text-secondary)] hover:border-[var(--user-accent)] hover:text-[var(--user-accent)]"
                }`}
              >
                <Icon size={15} aria-hidden="true" />
                <span className="hidden sm:inline">{f.eyebrow}</span>
              </button>
            );
          })}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-12">
          {/* Text side */}
          <div className="lg:col-span-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={feature.id}
                id="feature-panel"
                role="tabpanel"
                aria-labelledby={`tab-${feature.id}`}
                initial={{ opacity: 0, x: -28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--user-accent)]">
                  {feature.eyebrow}
                </p>
                <h3 className="mt-2 text-2xl font-extrabold leading-tight text-[var(--user-text)] sm:text-3xl">
                  {feature.title}
                </h3>
                <ul className="mt-5 space-y-3">
                  {feature.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-sm leading-6 text-[var(--user-text-secondary)]">
                      <ArrowRight size={15} className="mt-0.5 shrink-0 text-[var(--user-accent)]" aria-hidden="true" />
                      {b}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Mock side — sticky */}
          <div className="lg:col-span-7">
            <div className="lg:sticky lg:top-24">
              <AnimatePresence mode="wait">
                <motion.div
                  key={feature.id}
                  initial={{ opacity: 0, y: 26, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -18, scale: 0.98 }}
                  transition={{ duration: 0.32 }}
                  className="mx-auto max-w-md lg:max-w-none"
                >
                  <Mock />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
