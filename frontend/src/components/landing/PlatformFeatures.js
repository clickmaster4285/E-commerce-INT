"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  ArrowRight,
  ArrowUpRight,
  Palette,
  Send,
  Layers,
  Percent,
  BookOpen,
  Undo2,
  Mail,
  BadgePercent,
  PackagePlus,
  Map,
  Split,
  Zap,
  BellRing,
  History,
  ListTree,
  Users,
  Inbox,
  ListChecks,
  Star,
  ShoppingCart,
  Scale,
  CalendarRange,
  TrendingUp,
  Clock,
  PackageCheck,
  Circle,
  TriangleAlert,
  Headphones,
} from "lucide-react";
import CountUp from "./CountUp";

/* ============================================================
   PLATFORM MODULES — 7 tabs, code-built interactive previews.
   Data below is the single source of truth for tabs + panels.
   ============================================================ */

const MODULES = [
  {
    id: "quotes",
    eyebrow: "Quotations",
    title: "Quotes that close the deal",
    intro: "From abandoned cart to accepted quote — numbered, branded and tracked.",
    icon: FileCheck,
    preview: "quote",
    benefits: [
      { icon: Send, title: "One click to send", text: "Draft, brand and send a quotation in minutes — QT- numbers reserved atomically, never duplicated." },
      { icon: Palette, title: "Branded PDF designer", text: "Your logo, terms and bank details on every quote — English or Urdu, print, download or email." },
      { icon: Layers, title: "Live pipeline", text: "Pending → Draft → Sent → Accepted or Rejected — see exactly where every deal stands." },
      { icon: FileCheck, title: "Accepted = converted", text: "Customer accepts and the quote becomes an order with an ORD- number automatically." },
    ],
  },
  {
    id: "invoices",
    eyebrow: "Invoices",
    title: "Tax-ready invoices in one click",
    intro: "GST lines, discounts and a payment ledger — all reconciled automatically.",
    icon: Receipt,
    preview: "invoice",
    benefits: [
      { icon: Percent, title: "GST line items", text: "Per-line tax_rate and discount — the invoice always adds up, no manual math at closing." },
      { icon: BookOpen, title: "Payment ledger", text: "Cash, bank or card — partial payments and refunds tracked to the last rupee." },
      { icon: Undo2, title: "Returns restock themselves", text: "A posted return puts items straight back into stock and adjusts the ledger." },
      { icon: Mail, title: "PDF & email delivery", text: "A designed invoice PDF emailed or downloaded straight from the admin panel." },
    ],
  },
  {
    id: "shipping",
    eyebrow: "Shipping & Delivery",
    title: "Shipping rules that just work",
    intro: "Standard or express — fees quoted live at checkout, thresholds enforced automatically.",
    icon: Truck,
    preview: "shipping",
    benefits: [
      { icon: Truck, title: "Configurable methods", text: "Standard (Rs. 200, 2–4 days) and Express (Rs. 500, 1–2 days) — change rates and timelines any time." },
      { icon: BadgePercent, title: "Free delivery thresholds", text: "Set an order value for free delivery — override it per product, category or brand." },
      { icon: PackagePlus, title: "Your own couriers", text: "Add a custom courier or pickup option — fees appear live at checkout for the customer." },
      { icon: Map, title: "Per-product overrides", text: "Free or fixed-fee shipping on any SKU, category or brand — quoted before payment, always." },
    ],
  },
  {
    id: "payments",
    eyebrow: "Payments",
    title: "Every rupee, accounted for",
    intro: "COD, bank transfer and card — one ledger that always reconciles.",
    icon: Wallet,
    preview: "payments",
    benefits: [
      { icon: Banknote, title: "COD, first-class", text: "The #1 trust driver in Pakistani e-commerce — tracked like any other tender." },
      { icon: Landmark, title: "Bank transfer + reference", text: "Meezan, HBL or your account — transaction reference captured on every order." },
      { icon: CreditCard, title: "In-store POS", text: "Chip and swipe billing with returns — one system online and at the counter." },
      { icon: Split, title: "Partial payments", text: "Split one order across cash, bank and card — the ledger always balances." },
    ],
  },
  {
    id: "inventory",
    eyebrow: "Inventory & Stock",
    title: "Never oversell again",
    intro: "Live stock across every order, return and purchase order — variant level.",
    icon: Boxes,
    preview: "inventory",
    benefits: [
      { icon: Zap, title: "Real-time stock", text: "Every order, return and PO receipt updates levels instantly over WebSocket." },
      { icon: BellRing, title: "Low-stock alerts", text: "Filterable low and out-of-stock alerts before a customer hits the wall." },
      { icon: History, title: "Auditable history", text: "Reason codes on every adjustment — the full stock trail, always." },
      { icon: ListTree, title: "Variant-level accuracy", text: "Size, colour, storage — tracked per variant, not per product." },
    ],
  },
  {
    id: "chat",
    eyebrow: "Support & Live Chat",
    title: "Answers mid-checkout",
    intro: "Guests and logged-in customers — every chat carries order context.",
    icon: MessagesSquare,
    preview: "chat",
    benefits: [
      { icon: Users, title: "No login wall", text: "Guests chat straight from the product page — no account required, ever." },
      { icon: Inbox, title: "Order-aware inbox", text: "Every conversation arrives with product, cart or order context attached." },
      { icon: ListChecks, title: "Admin triage", text: "Unread counters, open/close and full history — one inbox for the whole team." },
      { icon: Star, title: "Reviews that convert", text: "Moderated purchase reviews with public admin responses build trust." },
    ],
  },
  {
    id: "reports",
    eyebrow: "Reports & Analytics",
    title: "Numbers you can act on",
    intro: "Sales, margin and stock — the few charts that change what you order.",
    icon: BarChart3,
    preview: "reports",
    benefits: [
      { icon: ShoppingCart, title: "Sales & top products", text: "7d / 30d ranges, category share and trend lines — spot the winners fast." },
      { icon: Scale, title: "Finance overview", text: "Sales vs purchase orders, payments and returns — one reconciled view." },
      { icon: CalendarRange, title: "Period-over-period", text: "This month vs last, before you commit to your next stock purchase." },
      { icon: TrendingUp, title: "Margin visibility", text: "Profit per product, not just volume — busy and profitable are different things." },
    ],
  },
];

const ICON_FOR = Object.fromEntries(MODULES.map((m) => [m.id, m.icon]));

/* ============ Browser frame shared by all previews ============ */

function BrowserFrame({ title, children }) {
  return (
    <div className="pf-frame">
      <div className="pf-frame-bar" aria-hidden="true">
        <span className="pf-dot pf-dot-red" />
        <span className="pf-dot pf-dot-amber" />
        <span className="pf-dot pf-dot-green" />
        <span className="pf-frame-address">
          <span className="pf-frame-lock" />
          <span className="pf-frame-bar-line w-24" />
          <span className="pf-frame-bar-line w-12" />
        </span>
        <span className="pf-frame-title">{title}</span>
      </div>
      <div className="pf-frame-body">{children}</div>
    </div>
  );
}

/* ============ Tab previews (real interactive mocks) ============ */

function QuoteMock() {
  const [status, setStatus] = useState("Sent");
  const items = [
    ["Cat 6 UTP Cable (305m) × 2", "Rs. 24,000"],
    ["RJ45 Connectors (100 pack)", "Rs. 2,500"],
    ["Labour & Installation", "Rs. 6,500"],
  ];

  return (
    <div>
      <div className="flex items-center justify-between border-b border-[var(--user-border)] pb-3">
        <div>
          <p className="pf-micro-label">Quotation</p>
          <p className="pf-mono text-sm font-extrabold text-[var(--user-text)]">QT-00042</p>
        </div>
        <span
          className={`pf-status-pill ${
            status === "Accepted"
              ? "bg-emerald-500/15 text-emerald-600"
              : status === "Declined"
                ? "bg-red-500/15 text-red-600"
                : "bg-sky-500/15 text-sky-600"
          }`}
        >
          {status.toUpperCase()}
        </span>
      </div>
      <ul className="mt-3 space-y-2 text-[12px]">
        {items.map(([item, amount]) => (
          <li
            key={item}
            className="flex items-center justify-between gap-3 border-b border-dashed border-[var(--user-border)] pb-2"
          >
            <span className="text-[var(--user-text-secondary)]">{item}</span>
            <span className="pf-mono font-bold text-[var(--user-text)]">{amount}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between">
        <span className="pf-micro-label">Total</span>
        <span className="pf-mono text-lg font-extrabold text-[#FF6A1F]">Rs. 33,000</span>
      </div>

      {status === "Sent" ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setStatus("Accepted")}
            className="pf-btn-accent flex-1"
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            Accept
          </button>
          <button
            type="button"
            onClick={() => setStatus("Declined")}
            className="pf-btn-ghost flex-1"
          >
            Decline
          </button>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-[11px] font-bold text-emerald-600">
          <CheckCircle2 size={15} aria-hidden="true" />
          {status === "Accepted" ? "Converted to order ORD-000143" : "Quote declined — customer notified"}
        </p>
      )}
    </div>
  );
}

function InvoiceMock() {
  const rows = [
    ["Dawlance Microwave 25L", "1", "Rs. 28,999"],
    ["Tax (GST 17%)", "—", "Rs. 4,930"],
    ["Discount (Bundle)", "—", "− Rs. 1,500"],
  ];
  return (
    <div>
      <div className="flex items-center justify-between border-b border-[var(--user-border)] pb-3">
        <div className="flex items-center gap-2">
          <Receipt size={17} className="text-[#FF6A1F]" aria-hidden="true" />
          <p className="pf-mono text-sm font-extrabold text-[var(--user-text)]">INV-000214</p>
        </div>
        <span className="pf-status-pill bg-amber-500/15 text-amber-600">PARTIAL · Rs. 12,429 DUE</span>
      </div>
      <table className="mt-3 w-full text-[12px]">
        <thead>
          <tr className="text-left">
            <th className="pf-micro-label pb-1.5">Item</th>
            <th className="pf-micro-label pb-1.5">Qty</th>
            <th className="pf-micro-label pb-1.5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([item, qty, amount]) => (
            <tr key={item} className="border-t border-dashed border-[var(--user-border)]">
              <td className="py-1.5 text-[var(--user-text-secondary)]">{item}</td>
              <td className="py-1.5 text-[var(--user-text-secondary)]">{qty}</td>
              <td className="pf-mono py-1.5 text-right font-bold text-[var(--user-text)]">{amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-between border-t border-[var(--user-border)] pt-3">
        <span className="pf-micro-label">Grand Total</span>
        <span className="pf-mono text-xl font-extrabold text-[#FF6A1F]">
          <CountUp value={32429} prefix="Rs. " duration={1.2} />
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 text-[10px] font-semibold text-[var(--user-text-muted)]">
        <span>Paid Rs. 20,000 of Rs. 32,429</span>
        <span>Rs. 12,429 left</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--user-bg-hover)]" role="progressbar" aria-label="Invoice paid so far" aria-valuenow={62} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-[#FF6A1F] to-[#FFB25E]" style={{ width: "62%" }} />
      </div>
      <p className="mt-2.5 text-[10px] font-semibold text-[var(--user-text-muted)]">
        PDF emailed to customer · reconciles automatically on payment
      </p>
    </div>
  );
}

const RATES = [
  { id: "standard", label: "Standard", desc: "Rs. 200 · 2–4 days", fee: 200 },
  { id: "express", label: "Express", desc: "Rs. 500 · 1–2 days", fee: 500 },
];
const CART_TOTAL = 7600;
const FREE_DELIVERY_AT = 10000;

function ShippingMock() {
  const [rate, setRate] = useState("standard");
  const selected = RATES.find((r) => r.id === rate) || RATES[0];
  const orderTotal = CART_TOTAL + selected.fee;
  const remaining = FREE_DELIVERY_AT - CART_TOTAL;
  const freeProgress = Math.min(100, (CART_TOTAL / FREE_DELIVERY_AT) * 100);

  const timeline = [
    { icon: PackageCheck, label: "Picked up", time: "Today · 09:12", state: "done" },
    { icon: Truck, label: "In transit", time: "Today · 14:30", state: "current" },
    { icon: Clock, label: "Out for delivery", time: "Expected tomorrow", state: "pending" },
    { icon: Circle, label: "Delivered", time: "—", state: "pending" },
  ];

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between border-b border-[var(--user-border)] pb-3">
        <div className="flex items-center gap-2">
          <Truck size={17} className="text-[#FF6A1F]" aria-hidden="true" />
          <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--user-text-muted)]">Shipment</p>
          <p className="pf-mono text-[11px] font-extrabold text-[var(--user-text)]">#ORD-000142</p>
        </div>
        <span className="pf-status-pill bg-emerald-500/15 text-emerald-600">
          <span className="pf-live-dot" aria-hidden="true" />
          ON ROUTE
        </span>
      </div>

      {/* Route visual — clean 3-stop progress track */}
      <div className="pf-track mt-4" role="img" aria-label="Route from Lahore to Karachi via Islamabad, currently near Islamabad">
        <div className="pf-track-line">
          <span className="pf-track-stop pf-track-stop-done" />
          <span className="pf-track-seg pf-track-seg-done" />
          <span className="pf-track-stop pf-track-stop-current">
            <Truck size={15} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span className="pf-track-seg pf-track-seg-todo" />
          <span className="pf-track-stop pf-track-stop-todo" />
        </div>
        <div className="pf-track-labels">
          <span>Lahore</span>
          <span className="pf-track-label-current">Islamabad</span>
          <span>Karachi</span>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[10px] font-bold text-[var(--user-text-muted)]">
        <span className="flex items-center gap-1"><Clock size={11} aria-hidden="true" /> ETA 2 days · 1,214 km</span>
        <span className="tabular-nums">68% of route</span>
      </div>

      {/* Rate cards */}
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Delivery method">
        {RATES.map((option) => {
          const checked = option.id === rate;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => setRate(option.id)}
              className="pf-rate"
              data-checked={checked}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="pf-micro-label">{option.label}</span>
                <span className={`pf-rate-check ${checked ? "pf-rate-check-on" : ""}`} aria-hidden="true">
                  <CheckCircle2 size={16} />
                </span>
              </span>
              <span className="mt-1 block text-left text-[12px] font-extrabold leading-5 text-[var(--user-text)]">
                {option.desc}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold text-[var(--user-text-secondary)]">
        <span>Delivery fee · {selected.label}</span>
        <span className="pf-mono">Rs. {selected.fee.toLocaleString()}</span>
      </div>
      <div className="flex items-center justify-between border-t border-[var(--user-border)] pt-2 text-[13px] font-extrabold text-[var(--user-text)]">
        <span>Order total</span>
        <span className="pf-mono text-[#FF6A1F]">Rs. {orderTotal.toLocaleString()}</span>
      </div>

      {/* Free delivery progress */}
      <div className="mt-3">
        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-[var(--user-text-muted)]">
          <span>Add <span className="pf-mono text-[var(--user-text)]">Rs. {remaining.toLocaleString()}</span> more for free delivery</span>
          <span className="tabular-nums">{Math.round(freeProgress)}%</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--user-bg-hover)]" role="progressbar" aria-label="Progress towards free delivery" aria-valuenow={freeProgress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-[#FF6A1F] to-[#FFB25E]" style={{ width: `${freeProgress}%` }} />
        </div>
      </div>

      {/* Timeline */}
      <ul className="mt-3 space-y-1.5 border-t border-[var(--user-border)] pt-3">
        {timeline.map(({ icon: Icon, label, time, state }) => (
          <li key={label} className="flex items-center gap-2 text-[11px]">
            <Icon
              size={13}
              aria-hidden="true"
              className={
                state === "done"
                  ? "text-emerald-500"
                  : state === "current"
                    ? "text-[#FF6A1F]"
                    : "text-[var(--user-text-muted)]"
              }
            />
            <span className={`font-semibold ${state === "pending" ? "text-[var(--user-text-muted)]" : "text-[var(--user-text-secondary)]"}`}>
              {label}
            </span>
            <span className="ms-auto text-[10px] font-medium text-[var(--user-text-muted)]">{time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PaymentsMock() {
  const methods = [
    { icon: Banknote, label: "Cash on Delivery", detail: "Paid at doorstep", amount: "Rs. 142,300" },
    { icon: Landmark, label: "Bank Transfer", detail: "Meezan Bank · ref. required", amount: "Rs. 386,900" },
    { icon: CreditCard, label: "Card (in-store POS)", detail: "Chip & swipe billing", amount: "Rs. 74,850" },
  ];
  const [idx, setIdx] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % methods.length), 2400);
    return () => window.clearInterval(id);
  }, [reduce, methods.length]);

  return (
    <div>
      <p className="pf-micro-label">Payment Methods · This month</p>
      <ul className="mt-3 space-y-2">
        {methods.map(({ icon: Icon, label, detail, amount }, i) => {
          const active = i === idx;
          return (
            <li
              key={label}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-300 ${
                active ? "border-[#FF6A1F] bg-[rgba(255,106,31,0.08)]" : "border-[var(--user-border)]"
              }`}
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${active ? "bg-[#FF6A1F] text-white" : "bg-[var(--user-bg-hover)] text-[var(--user-text-secondary)]"}`}>
                <Icon size={19} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-extrabold text-[var(--user-text)]">{label}</span>
                <span className="block text-[10px] font-semibold text-[var(--user-text-muted)]">{detail}</span>
              </span>
              <span className="pf-mono ms-auto text-[11px] font-extrabold tabular-nums text-[var(--user-text-secondary)]">{amount}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-semibold text-[var(--user-text-muted)]">
        <span>Invoice INV-000214 · Partial payment</span>
        <span className="pf-mono">Rs. 6,500 / Rs. 10,529</span>
      </div>
      <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-[var(--user-bg-hover)]" role="progressbar" aria-label="Partial payment progress" aria-valuenow={62} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-[#FF6A1F]" style={{ width: "62%" }} />
      </div>
      <p className="mt-2.5 flex items-center gap-2 text-[10px] font-semibold text-[var(--user-text-muted)]">
        <CheckCircle2 size={13} className="text-emerald-500" aria-hidden="true" />
        Rs. 6,500 recorded in ledger · status: Partial · balance Rs. 4,029
      </p>
    </div>
  );
}

function InventoryMock() {
  const rows = [
    { sku: "SKU-1001", name: "Wireless Headphones", qty: 84, status: "Healthy" },
    { sku: "SKU-1042", name: "Cookware 12pc", qty: 17, status: "Low" },
    { sku: "SKU-1077", name: "Smart Watch Fit 3", qty: 62, status: "Healthy" },
    { sku: "SKU-1088", name: "Anti-Aging Serum", qty: 6, status: "Low" },
  ];
  return (
    <div>
      <div className="flex items-center justify-between border-b border-[var(--user-border)] pb-3">
        <p className="pf-micro-label">Live Stock · 4 SKUs</p>
        <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">
          <span className="pf-live-dot" aria-hidden="true" />
          Real-time
        </span>
      </div>
      <table className="mt-3 w-full text-[12px]">
        <thead>
          <tr className="text-left">
            <th className="pf-micro-label pb-1.5">SKU</th>
            <th className="pf-micro-label pb-1.5">Item</th>
            <th className="pf-micro-label pb-1.5 text-right">Qty</th>
            <th className="pf-micro-label pb-1.5 text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ sku, name, qty, status }) => (
            <tr key={sku} className="border-t border-[var(--user-border)]">
              <td className="pf-mono py-2 text-[10px] font-bold text-[var(--user-text-muted)]">{sku}</td>
              <td className="py-2 pr-2 text-[11px] font-semibold leading-4 text-[var(--user-text-secondary)]">{name}</td>
              <td className="pf-mono py-2 text-right text-[11px] font-bold tabular-nums text-[var(--user-text)]">{qty}</td>
              <td className="py-2 text-right">
                <span className={`pf-status-pill ${status === "Low" ? "bg-red-500/15 text-red-600" : "bg-emerald-500/15 text-emerald-600"}`}>
                  {status.toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] font-bold text-amber-700">
        <TriangleAlert size={15} aria-hidden="true" />
        2 items need reorder — Cookware 12pc, Anti-Aging Serum
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
    <div className="grid grid-cols-[1fr_auto] gap-3">
      {/* Chat column */}
      <div className="min-w-0">
        <div className="flex items-center justify-between border-b border-[var(--user-border)] pb-2.5">
          <p className="text-[10px] font-extrabold text-[var(--user-text)]">Support · #ORD-000142</p>
          <span className="pf-status-pill bg-emerald-500/15 text-emerald-600">LIVE</span>
        </div>
        <ul className="mt-2.5 space-y-2">
          {messages.map((m, i) => (
            <li
              key={i}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-5 ${
                m.from === "customer"
                  ? "rounded-bl-sm bg-[var(--user-bg-hover)] text-[var(--user-text-secondary)]"
                  : "ms-auto rounded-br-sm bg-[#FF6A1F] font-semibold text-white"
              }`}
            >
              {m.text}
            </li>
          ))}
        </ul>
      </div>
      {/* Order-context sidebar */}
      <aside className="w-[104px] shrink-0 rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)] p-2.5 text-left">
        <p className="pf-micro-label">Order</p>
        <p className="pf-mono mt-1 text-[10px] font-extrabold text-[var(--user-text)]">#ORD-000142</p>
        <div className="mt-2 flex h-12 w-12 items-center justify-center rounded-lg bg-[#FF6A1F]/15 text-[#FF6A1F]">
          <Headphones size={22} aria-hidden="true" />
        </div>
        <p className="mt-1.5 truncate text-[10px] font-bold text-[var(--user-text-secondary)]">Wireless Headphones</p>
        <p className="pf-mono mt-1 text-[11px] font-extrabold text-[var(--user-text)]">Rs. 4,299</p>
        <p className="mt-1.5 border-t border-[var(--user-border)] pt-1.5 text-[9px] font-semibold leading-3 text-[var(--user-text-muted)]">
          COD · ETA <span className="font-extrabold text-[var(--user-text-secondary)]">Tomorrow</span>
        </p>
      </aside>
    </div>
  );
}

const REVENUE = [38, 52, 44, 71, 63, 88, 96];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MARGIN_PRODUCTS = [
  ["Wireless Headphones", "34%", 92],
  ["Smart Watch Fit 3", "29%", 74],
  ["Dawlance Microwave", "21%", 58],
];

function ReportsMock() {
  const max = Math.max(...REVENUE);
  const pts = REVENUE.map((v, i) => {
    const x = (i / (REVENUE.length - 1)) * 268 + 16;
    const y = 78 - (v / max) * 62;
    return [x, y];
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `16,82 ${line} 284,82`;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-extrabold text-[var(--user-text)]">Sales · Last 7 days</p>
        <span className="pf-status-pill bg-emerald-500/15 text-emerald-600">+18.2% vs last week</span>
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
        {[["Revenue", "Rs. 1.28M"], ["Orders", "214"], ["Avg. order", "Rs. 5,981"]].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[var(--user-bg-hover)] px-2 py-2">
            <p className="pf-micro-label">{label}</p>
            <p className="pf-mono mt-0.5 text-[13px] font-extrabold tabular-nums text-[var(--user-text)]">{value}</p>
          </div>
        ))}
      </div>
      <svg viewBox="0 0 300 96" className="mt-2.5 w-full" role="img" aria-label="Revenue trend for the last 7 days, rising overall">
        <defs>
          <linearGradient id="pf-rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF6A1F" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF6A1F" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[24, 48, 72].map((y) => (
          <line key={y} x1="16" x2="284" y1={y} y2={y} stroke="var(--user-border)" strokeDasharray="4 5" strokeWidth="1" />
        ))}
        <polygon points={area} fill="url(#pf-rev-fill)" />
        <polyline points={line} fill="none" stroke="#FF6A1F" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 3.4 : 2} fill={i === pts.length - 1 ? "#FF6A1F" : "var(--user-bg-card)"} stroke="#FF6A1F" strokeWidth="1.6" />
        ))}
      </svg>
      <div className="flex justify-between px-1 text-[8px] font-bold text-[var(--user-text-muted)]">
        {DAYS.map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <p className="pf-micro-label mt-3">Top margin products</p>
      <ul className="mt-1.5 space-y-1.5">
        {MARGIN_PRODUCTS.map(([name, margin, width]) => (
          <li key={name} className="flex items-center gap-2 text-[10px]">
            <span className="min-w-0 flex-1 truncate font-semibold text-[var(--user-text-secondary)]">{name}</span>
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--user-bg-hover)]">
              <span className="block h-full rounded-full bg-[#FF6A1F]/80" style={{ width: `${width}%` }} />
            </span>
            <span className="pf-mono w-7 text-right font-extrabold text-[var(--user-text)]">{margin}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PREVIEWS = {
  quote: QuoteMock,
  invoice: InvoiceMock,
  shipping: ShippingMock,
  payments: PaymentsMock,
  inventory: InventoryMock,
  chat: ChatMock,
  reports: ReportsMock,
};

const FRAME_TITLES = {
  quote: "Quotations · QT-00042",
  invoice: "Invoices · INV-000214",
  shipping: "Shipping · #ORD-000142",
  payments: "Payments · Ledger",
  inventory: "Inventory · Stock levels",
  chat: "Support · #ORD-000142",
  reports: "Reports · Sales overview",
};

/* ============ Section ============ */

export default function PlatformFeatures() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0); // Quotations open by default
  const tabsRef = useRef(null);
  const activeModule = MODULES[active];
  const Preview = PREVIEWS[activeModule.preview];

  const focusTab = (index) => {
    const clamped = (index + MODULES.length) % MODULES.length;
    setActive(clamped);
    requestAnimationFrame(() => {
      const btn = tabsRef.current?.querySelector(`[data-index="${clamped}"]`);
      btn?.focus({ preventScroll: true });
      btn?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
    });
  };

  const onTabKeyDown = (event) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    if (event.key === "ArrowRight") focusTab(active + 1);
    else if (event.key === "ArrowLeft") focusTab(active - 1);
    else if (event.key === "Home") focusTab(0);
    else if (event.key === "End") focusTab(MODULES.length - 1);
  };

  const slide = reduce ? 0 : 12;

  return (
    <section id="features" aria-labelledby="features-title" className="pf-section relative scroll-mt-24">
      <span id="shipping" className="absolute -top-24" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        {/* Header */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-[640px]"
        >
          <p className="tt-eyebrow text-[11px] font-bold uppercase tracking-[0.18em]">The Platform</p>
          <h2 id="features-title" className="tt-title mt-2 font-extrabold leading-[1.18] tracking-tight">
            Everything the back office needs, built in
          </h2>
          <p className="tt-sub mt-6 text-base leading-6">Pick a module and see how it works.</p>
        </motion.div>

        {/* Tab bar */}
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Platform modules"
          onKeyDown={onTabKeyDown}
          className="pf-tabs mt-8"
        >
          {MODULES.map((m, i) => {
            const Icon = ICON_FOR[m.id];
            const selected = i === active;
            return (
              <button
                key={m.id}
                type="button"
                role="tab"
                id={`pf-tab-${m.id}`}
                data-index={i}
                aria-selected={selected}
                aria-controls="pf-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  setActive(i);
                  requestAnimationFrame(() => {
                    tabsRef.current
                      ?.querySelector(`[data-index="${i}"]`)
                      ?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
                  });
                }}
                className="pf-tab snap-start"
              >
                {selected && (
                  <motion.span
                    layoutId="pf-tab-pill"
                    className="pf-tab-pill"
                    transition={{ duration: reduce ? 0 : 0.25, ease: "easeOut" }}
                    aria-hidden="true"
                  />
                )}
                <Icon size={16} className="relative" aria-hidden="true" />
                <span className="relative">{m.eyebrow}</span>
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeModule.id}
            id="pf-panel"
            role="tabpanel"
            aria-labelledby={`pf-tab-${activeModule.id}`}
            initial={reduce ? false : { opacity: 0, x: slide }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -slide }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pf-panel-grid mt-8 lg:min-h-[440px]"
          >
            {/* Preview first on mobile */}
            <div className="order-1 lg:order-2 lg:col-span-7">
              <BrowserFrame title={FRAME_TITLES[activeModule.id]}>
                <Preview />
              </BrowserFrame>
            </div>

            {/* Left — copy */}
            <div className="order-2 lg:order-1 lg:col-span-5">
              <p className="tt-eyebrow text-[11px] font-bold uppercase tracking-[0.18em]">{activeModule.eyebrow}</p>
              <h3 className="tt-title mt-2 font-extrabold leading-[1.15] tracking-tight" style={{ fontSize: "clamp(1.9rem, 1.3rem + 2.6vw, 2.75rem)" }}>
                {activeModule.title}
              </h3>
              <p className="tt-sub mt-3 max-w-md text-[15px] leading-6">{activeModule.intro}</p>

              <ul className="mt-6 space-y-4">
                {activeModule.benefits.map(({ icon: Icon, title, text }, i) => (
                  <motion.li
                    key={title}
                    initial={reduce ? false : { opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 + i * 0.06 }}
                    className="flex items-start gap-3"
                  >
                    <span className="pf-benefit-icon">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="tt-quote block text-[16px] font-extrabold leading-6">{title}</span>
                      <span className="tt-muted mt-0.5 block text-[14px] leading-5">{text}</span>
                    </span>
                  </motion.li>
                ))}
              </ul>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <a href="#how-it-works" className="pf-text-link">
                  See it in action
                  <ArrowRight size={15} aria-hidden="true" />
                </a>
                <a href="#final-cta" className="landing-btn landing-btn-ghost">
                  Book a Free Demo
                  <ArrowUpRight size={16} aria-hidden="true" />
                </a>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
