/* =====================================================================
   Click Master Store — /landing CONTENT (edit everything here)
   All user-facing copy for the BUSINESS/PLATFORM page lives in this file.
   No fake claims: every capability listed maps to real code (see /docs).
   DEMO/placeholder values are clearly marked.
   ===================================================================== */

export const SITE = {
  name: "Click Master Store",
  tagline: "Click. Order. Delivered.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  phone: "+92 300 1234567",
  email: "hello@clickmasterstore.pk",
  address: "Logistic Shuttle, Johar Town, Lahore, Pakistan",
};

export const WHATSAPP_NUMBER = "923001234567"; // DEMO — replace with real support number

export const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Shipping", href: "#shipping" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

export const HERO = {
  eyebrow: "Commerce, done right — for Pakistan",
  headlineA: "Run your whole business",
  headlineB: "from one dashboard.",
  sub: "Orders, quotations, invoices, shipping rules, inventory, POS, CRM and finance — the complete operating system for a modern Pakistani store. Built for Urdu & English, COD-friendly, and fast.",
  primaryCta: { label: "See How It Works", href: "#how-it-works" },
  secondaryCta: { label: "Talk to Our Team", href: `https://wa.me/${WHATSAPP_NUMBER}` },
};

export const TRUST_POINTS = [
  { icon: "banknote", text: "COD & Bank Transfer" },
  { icon: "file-text", text: "Invoices & Quotes Built-In" },
  { icon: "boxes", text: "Real-Time Inventory" },
  { icon: "headset", text: "Live Chat Support" },
  { icon: "languages", text: "10 Languages, Full Urdu" },
];

/* Steps moved into HowItWorks.js (typed array, code-built previews). */

/* Module data moved into PlatformFeatures.js (typed, code-built previews). */

/* Stats moved into Stats.js — honest product facts, no demo numbers. */

/* Testimonials moved into the Testimonials component (placeholder dataset,
   shaped to become a DB query later). Replace with real, consented reviews. */

/* FAQ — single source of truth for the FAQ section AND the FAQPage JSON-LD
   in app/landing/page.js. Typed array: id, category, q, a. */
export const FAQS = [
  { id: "cod", category: "Payments", q: "Do you support Cash on Delivery?", a: "Yes — COD is a first-class payment method across the storefront and invoices. You can also offer bank transfer (with a transaction reference) and in-store card via POS." },
  { id: "invoices", category: "Invoices", q: "Can I print or email invoices to customers?", a: "Every invoice has a designed PDF with your branding — print, download or email directly from the admin panel. Partial payments and refunds are tracked in the invoice ledger." },
  { id: "shipping-calc", category: "Shipping", q: "How are shipping charges calculated?", a: "Standard (Rs. 200, 2–4 days) and Express (Rs. 500, 1–2 days) by default, plus a free-delivery threshold you set — overridable per product, category or brand. The exact fee is shown at checkout before payment." },
  { id: "tracking", category: "Shipping", q: "Do you offer live parcel tracking?", a: "Orders are tracked end-to-end (pending → confirmed → processing → shipped → delivered) with customer notifications. Direct courier-API GPS tracking isn't integrated today — we're upfront about that." },
  { id: "staff", category: "Account & Staff", q: "Can my staff use this, with their own permissions?", a: "Yes — roles for admin, manager and staff with ~28 granular permission keys. Permission changes apply live, even mid-session." },
  { id: "urdu", category: "Account & Staff", q: "Does it support Urdu?", a: "Yes — a full Urdu (Nastaliq) interface with proper RTL layout, plus per-field auto-translation into Urdu, Arabic, Spanish, French and more." },
  { id: "returns", category: "Returns", q: "What about returns and refunds?", a: "7-day returns on eligible orders. Invoice returns post items back into stock automatically and create negative payment entries for cash refunds or balance adjustments." },
  { id: "migrate", category: "Account & Staff", q: "Can I migrate my existing data?", a: "Yes — we help import products, customers and opening stock free during onboarding. Share your spreadsheets or POS export and we map it for you." },
  { id: "secure", category: "Account & Staff", q: "Is my data secure?", a: "Your store data lives on dedicated infrastructure with daily backups, and staff access is permission-scoped — every action is logged and auditable. We never sell your data." },
  { id: "setup", category: "Account & Staff", q: "How long does setup take?", a: "Most stores go live the same day — catalog upload, shipping rules, payments and staff permissions in about 15 minutes with guided onboarding." },
];

export const FOOTER = {
  columns: [
    {
      title: "Platform",
      links: [
        { label: "Features", href: "#features" },
        { label: "How It Works", href: "#how-it-works" },
        { label: "Shipping", href: "#shipping" },
        { label: "FAQ", href: "#faq" },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "Why Click Master", href: "#why" },
        { label: "Contact", href: "#contact" },
      ],
    },
  ],
  socials: [
    { label: "Facebook", href: "https://www.facebook.com/clickmasterstore" },
    { label: "Instagram", href: "https://www.instagram.com/clickmasterstore" },
    { label: "X (Twitter)", href: "https://www.x.com/clickmasterstore" },
    { label: "YouTube", href: "https://www.youtube.com/@clickmasterstore" },
  ],
  payments: ["Cash on Delivery", "Bank Transfer", "In-Store Card (POS)"],
};
