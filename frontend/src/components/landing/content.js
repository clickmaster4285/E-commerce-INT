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

export const STEPS = [
  {
    step: "01",
    title: "Order Placed",
    text: "Customer orders in seconds — COD, bank transfer or card. Stock is reserved instantly and the order lands in your dashboard with a unique ORD- number.",
    tag: "ORD-000142 · COD",
  },
  {
    step: "02",
    title: "Quote Sent",
    text: "Cart abandoned? Turn it into a professional quotation in minutes — numbered QT-, branded PDF, terms attached. Customer accepts, order confirms.",
    tag: "QT-00042 · Sent → Accepted",
  },
  {
    step: "03",
    title: "Invoice Issued",
    text: "One click generates a tax-ready INV-invoice with items, discounts and tax lines. Print, download as PDF, or email — and it reconciles when payment lands.",
    tag: "INV-000214 · Tax-Ready",
  },
  {
    step: "04",
    title: "Shipped Smartly",
    text: "Standard or express shipping, free-delivery thresholds and per-product/category shipping rules — quotes are computed automatically at checkout.",
    tag: "Standard Rs.200 · 2–4 days",
  },
  {
    step: "05",
    title: "Delivered & Supported",
    text: "Order updates, live chat with context, 7-day returns and verified reviews — post-purchase handled end to end.",
    tag: "Delivered · 7-Day Return",
  },
];

/* Sticky scroll feature viewer — every item maps to a real module */
export const FEATURES = [
  {
    id: "quotes",
    icon: "file-check",
    eyebrow: "Quotations",
    title: "Quotes that close deals",
    bullets: [
      "QT- numbers reserved atomically — never duplicated, even under load",
      "Branded quote designer with your logo, terms and bank details",
      "Pipeline: Pending → Draft → Sent → Accepted / Rejected",
      "Convert accepted quotes straight into orders",
    ],
    mock: "quote",
  },
  {
    id: "invoices",
    icon: "receipt",
    eyebrow: "Invoices",
    title: "Tax-ready invoices, one click",
    bullets: [
      "INV- numbering, line items with tax_rate & discount per line",
      "Payment ledger: Cash / Bank / Card — partial payments tracked",
      "Returns ledger with automatic restocking of returned items",
      "Designed PDF + email delivery via built-in SMTP",
    ],
    mock: "invoice",
  },
  {
    id: "shipping",
    icon: "truck",
    eyebrow: "Shipping & Delivery",
    title: "Shipping rules that just work",
    bullets: [
      "Standard (Rs.200, 2–4 days) & Express (Rs.500, 1–2 days) — fully configurable",
      "Free delivery over a threshold you set (or per product/category/brand)",
      "Custom methods — add your own courier or pickup option",
      "Live fee quote at checkout — customer sees the final cost upfront",
    ],
    mock: "shipping",
  },
  {
    id: "payments",
    icon: "wallet",
    eyebrow: "Payments",
    title: "Payment methods Pakistanis trust",
    bullets: [
      "Cash on Delivery — the #1 trust driver in Pakistani e-commerce",
      "Bank transfer with clear account details & transaction reference",
      "Invoice ledger records every rupee: paid, pending or refunded",
      "In-store POS billing with returns — one system online & offline",
    ],
    mock: "payments",
  },
  {
    id: "inventory",
    icon: "boxes",
    eyebrow: "Inventory & Stock",
    title: "Never oversell again",
    bullets: [
      "Live variant stock with every order, return and PO receipt",
      "Low-stock and out-of-stock alerts with filters & pagination",
      "Stock history with reason codes — every adjustment auditable",
      "Real-time updates over WebSocket — dashboard and shop stay in sync",
    ],
    mock: "inventory",
  },
  {
    id: "chat",
    icon: "messages-square",
    eyebrow: "Support & Live Chat",
    title: "Support that answers mid-checkout",
    bullets: [
      "Live chat for guests and logged-in customers — no login required",
      "Context-aware: chats carry product, cart or order details",
      "Admin inbox with unread counters, open/close, full history",
      "Verified-purchase reviews with admin moderation & responses",
    ],
    mock: "chat",
  },
  {
    id: "reports",
    icon: "bar-chart-3",
    eyebrow: "Reports & Analytics",
    title: "Numbers you can act on",
    bullets: [
      "Sales, orders, top products and category share — 7d/30d ranges",
      "Finance overview: sales vs purchase orders, payments & returns",
      "Trend sparklines and period-over-period comparison",
      "Cost & margin visibility from purchase orders to final profit",
    ],
    mock: "reports",
  },
];

/* DEMO VALUES — replace with real numbers before launch */
export const STATS = [
  { value: 250000, suffix: "+", label: "Orders Processed (demo)" },
  { value: 45000, suffix: "+", label: "Products Managed (demo)" },
  { value: 120, suffix: "", label: "Cities Served (demo)" },
  { value: 98, suffix: "%", label: "Uptime (demo)" },
];

/* PLACEHOLDER testimonials — replace with real customer quotes.
   FEATURED = the large bento card. TESTIMONIAL_SUMMARY = aggregate badge (DEMO). */
export const TESTIMONIAL_SUMMARY = {
  rating: "4.8 / 5",
  text: "Rated by verified store owners (demo)",
};

export const TESTIMONIALS = [
  { name: "Ayesha Khan", role: "Home & Kitchen Seller, Lahore", rating: 5, initials: "AK", featured: true, text: "Invoices with tax and the payment ledger ended our monthly reconciliation headache. Closing the month takes minutes now — GST breakdowns, partial payments, returns, everything just lines up." },
  { name: "Bilal Sheikh", role: "Electronics Store, Karachi", rating: 5, initials: "BS", text: "The quotation → invoice flow is exactly how we sell. Customers approve on WhatsApp, we convert in one click." },
  { name: "Fatima Noor", role: "Fashion Boutique, Islamabad", rating: 4, initials: "FN", text: "COD + bank transfer covered 90% of our buyers. Express shipping is fully configurable and customers love it." },
  { name: "Usman Tariq", role: "Hardware Store, Faisalabad", rating: 5, initials: "UT", text: "Stock never goes wrong — every PO receipt updates inventory automatically. Support chat resolves issues mid-checkout." },
  { name: "Hira Butt", role: "Cosmetics & Beauty, Multan", rating: 5, initials: "HB", text: "Reports show exactly which products earn margin, not just which ones sell. That's the difference between busy and profitable." },
];

export const FAQS = [
  {
    q: "Do you support Cash on Delivery (COD)?",
    a: "Yes. COD is a first-class payment method across the storefront and invoices. You can also offer bank transfer (with clear account details and transaction reference) and card payments in-store via POS.",
  },
  {
    q: "Can I print or email invoices to customers?",
    a: "Absolutely. Every invoice has a designed PDF with your branding and can be printed, downloaded or emailed directly from the admin panel. Partial payments and refunds are tracked in the invoice ledger.",
  },
  {
    q: "How are shipping charges calculated?",
    a: "Standard (Rs.200, 2–4 days) and Express (Rs.500, 1–2 days) by default, plus a free-delivery threshold you can set. You can override rules per product, category, brand (free or fixed fee) and add your own custom methods — the exact fee is shown at checkout before payment.",
  },
  {
    q: "Do you offer live parcel tracking?",
    a: "We track order status end-to-end (pending → confirmed → processing → shipped → delivered) with customer notifications and support. Direct courier-API GPS tracking is not integrated today — we are upfront about that.",
  },
  {
    q: "Can my staff use this, with their own permissions?",
    a: "Yes — roles for admin, manager and staff with ~28 granular permission keys (products, orders, invoices, quotes, POS, reports…). Permission changes apply live, even mid-session.",
  },
  {
    q: "Does it support Urdu?",
    a: "Yes — full Urdu (Nastaliq) interface with proper typography repair, RTL layout, and per-field auto-translation (English → Urdu/Arabic/Spanish/French and 6 more locales).",
  },
  {
    q: "What about returns and refunds?",
    a: "7-day returns on eligible orders. Invoice returns post items back into stock automatically and create negative payment entries for cash refunds or balance adjustments.",
  },
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
        { label: "WhatsApp Support", href: `https://wa.me/${WHATSAPP_NUMBER}` },
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
