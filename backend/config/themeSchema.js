// ==========================================================
// STORE THEME SCHEMA — store editor ka single source of truth
// ----------------------------------------------------------
// Backend isi se har draft/publish validate karta hai (utils/themeValidator.js)
// aur editor GET /theme/schema se isi ke forms banata hai.
// Frontend sirf `type → React component` map karta hai
// (frontend/src/storefront/sections/registry.js).
//
// Naya section type: yahan SECTION_TYPES me add karo + frontend registry me
// component. Validator khud naye settings samajh leta hai.
//
// DEFAULT_THEME = aaj ka storefront bilkul waisa hi (non-breaking):
//   colors null → user.css ke built-in light/dark values (home orange rehta hai)
//   sections order = HomeClient.js ka purana hardcoded order
//   menus khali → HomeNav / Footer ke purane hardcoded links
// ==========================================================

const LIMITS = {
  maxSections: 25,
  maxBlocks: 12,
  maxMenuItems: 30,
  maxMenuDepth: 2,
  maxPayloadBytes: 256 * 1024,
  text: 200,
  textarea: 1000,
  richtext: 20000,
  url: 500,
};

// Google Fonts whitelist — frontend sirf inhi ka <link> banata hai
const FONTS = [
  "Inter",
  "Poppins",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Nunito",
  "DM Sans",
  "Playfair Display",
  "Merriweather",
  "Cairo",
  "Tajawal",
  "Noto Naskh Arabic",
];

// Theme color key → storefront CSS variable (frontend/src/app/user.css)
const COLOR_VARS = {
  accent: "--user-accent",
  accentHover: "--user-accent-hover",
  accentText: "--user-accent-text",
  background: "--user-bg",
  card: "--user-bg-card",
  text: "--user-text",
  border: "--user-border",
};

const LINK_TYPES = ["none", "home", "url", "page", "category", "product", "brand", "deal"];

// Setting field types jo editor render karta hai
const FIELD_TYPES = [
  "text",
  "textarea",
  "richtext",
  "image",
  "color",
  "select",
  "range",
  "checkbox",
  "link",
  "category",
  "brand",
  "product",
  "url", // http(s) only (video / external)
  "datetime", // ISO date-time (countdown)
  "phone", // digits with country code (WhatsApp)
  "geo", // { lat, lng } map pin — `withZoom: true` → { lat, lng, zoom } (map view)
];

const heading = (fallback = "") => ({ key: "heading", type: "text", label: "Heading", default: fallback, translatable: true });

const SECTION_TYPES = {
  // ── Existing storefront components (har ek store-wide data se chalta hai → ek hi baar) ──
  // source "banners" = Admin → Banners wale slides (purana behavior, default)
  // source "custom"  = yahin editor me banaye slides (blocks)
  hero_banners: {
    label: "Hero banners",
    limit: 1,
    settings: [
      { key: "source", type: "select", label: "Slides from", options: ["banners", "custom"], default: "banners" },
      { key: "height", type: "select", label: "Height", options: ["default", "small", "large"], default: "default" },
      { key: "autoplay", type: "checkbox", label: "Auto-rotate slides", default: true },
      { key: "interval", type: "range", label: "Seconds per slide", min: 3, max: 10, step: 1, default: 5, showIf: { key: "autoplay", equals: true } },
    ],
    blocks: {
      label: "Slide",
      showIf: { key: "source", equals: "custom" },
      settings: [
        { key: "image", type: "image", label: "Image", default: "" },
        { key: "eyebrow", type: "text", label: "Small label", default: "", translatable: true },
        { key: "heading", type: "text", label: "Heading", default: "", translatable: true },
        { key: "description", type: "textarea", label: "Text", default: "", translatable: true },
        { key: "buttonLabel", type: "text", label: "Button label", default: "", translatable: true },
        { key: "buttonLink", type: "link", label: "Button link", default: { type: "none" } },
      ],
    },
  },
  category_tiles: {
    label: "Category tiles",
    limit: 1,
    settings: [heading()],
  },
  deals: {
    label: "Today's deals",
    limit: 1,
    settings: [heading()],
  },
  featured_products: {
    label: "Featured products",
    limit: 1,
    settings: [heading()],
  },
  popular_categories: {
    label: "Popular categories",
    limit: 1,
    settings: [heading()],
  },
  brand_strip: {
    label: "Brand strip",
    limit: 1,
    settings: [],
  },
  brand_showcase: {
    label: "Brand spotlight",
    limit: 1,
    settings: [heading()],
  },

  // ── Generic sections (multiple instances allowed) ──
  rich_text: {
    label: "Rich text",
    limit: 10,
    settings: [
      heading(),
      { key: "body", type: "richtext", label: "Content", default: "", translatable: true },
      { key: "align", type: "select", label: "Alignment", options: ["start", "center"], default: "start" },
    ],
  },
  image_with_text: {
    label: "Image with text",
    limit: 10,
    settings: [
      { key: "image", type: "image", label: "Image", default: "" },
      heading(),
      { key: "body", type: "richtext", label: "Content", default: "", translatable: true },
      { key: "buttonLabel", type: "text", label: "Button label", default: "", translatable: true },
      { key: "buttonLink", type: "link", label: "Button link", default: { type: "none" } },
      { key: "imagePosition", type: "select", label: "Image position", options: ["start", "end"], default: "start" },
    ],
  },
  product_carousel: {
    label: "Product carousel",
    limit: 10,
    settings: [
      heading(),
      { key: "source", type: "select", label: "Products from", options: ["new", "offers", "category", "brand"], default: "new" },
      { key: "categoryId", type: "category", label: "Category", default: "", showIf: { key: "source", equals: "category" } },
      { key: "brandId", type: "brand", label: "Brand", default: "", showIf: { key: "source", equals: "brand" } },
      { key: "limit", type: "range", label: "Number of products", min: 4, max: 24, step: 1, default: 8 },
    ],
  },
  newsletter: {
    label: "Newsletter",
    limit: 2,
    settings: [
      heading("Subscribe to our newsletter"),
      { key: "subheading", type: "textarea", label: "Text", default: "", translatable: true },
      { key: "buttonLabel", type: "text", label: "Button label", default: "Subscribe", translatable: true },
    ],
  },
  testimonials: {
    label: "Testimonials",
    limit: 3,
    settings: [heading("What our customers say")],
    blocks: {
      label: "Testimonial",
      settings: [
        { key: "quote", type: "textarea", label: "Quote", default: "", translatable: true },
        { key: "author", type: "text", label: "Author", default: "" },
        { key: "rating", type: "range", label: "Rating", min: 1, max: 5, step: 1, default: 5 },
      ],
    },
  },
  spacer: {
    label: "Spacer",
    limit: 10,
    settings: [{ key: "height", type: "range", label: "Height (px)", min: 8, max: 160, step: 8, default: 32 }],
  },

  // ── Release 5: more sections ──
  faq: {
    label: "FAQ",
    limit: 3,
    settings: [heading("Frequently asked questions")],
    blocks: {
      label: "Question",
      settings: [
        { key: "question", type: "text", label: "Question", default: "", translatable: true },
        { key: "answer", type: "textarea", label: "Answer", default: "", translatable: true },
      ],
    },
  },
  video: {
    label: "Video",
    limit: 5,
    settings: [
      heading(),
      { key: "url", type: "url", label: "YouTube or Vimeo link", default: "" },
      { key: "aspect", type: "select", label: "Shape", options: ["wide", "square", "vertical"], default: "wide" },
    ],
  },
  countdown: {
    label: "Countdown timer",
    limit: 3,
    settings: [
      heading("Sale ends in"),
      { key: "subheading", type: "textarea", label: "Text", default: "", translatable: true },
      { key: "endsAt", type: "datetime", label: "Ends at", default: "" },
      { key: "buttonLabel", type: "text", label: "Button label", default: "", translatable: true },
      { key: "buttonLink", type: "link", label: "Button link", default: { type: "none" } },
      { key: "hideWhenEnded", type: "checkbox", label: "Hide when the timer ends", default: true },
      // Khali (null) = theme accent wala purana look; text color khali → background ke hisaab se auto contrast
      { key: "backgroundColor", type: "color", label: "Box color", default: null },
      { key: "textColor", type: "color", label: "Text color", default: null },
      { key: "buttonColor", type: "color", label: "Button color", default: null },
      { key: "buttonTextColor", type: "color", label: "Button text color", default: null },
    ],
  },
  logo_list: {
    label: "Logo list",
    limit: 3,
    settings: [heading(), { key: "grayscale", type: "checkbox", label: "Grayscale logos", default: false }],
    blocks: {
      label: "Logo",
      settings: [
        { key: "image", type: "image", label: "Logo", default: "" },
        { key: "link", type: "link", label: "Link", default: { type: "none" } },
      ],
    },
  },
  image_gallery: {
    label: "Image gallery",
    limit: 5,
    settings: [
      heading(),
      { key: "columns", type: "select", label: "Columns (desktop)", options: ["2", "3", "4"], default: "3" },
    ],
    blocks: {
      label: "Image",
      settings: [
        { key: "image", type: "image", label: "Image", default: "" },
        { key: "caption", type: "text", label: "Caption", default: "", translatable: true },
        { key: "link", type: "link", label: "Link", default: { type: "none" } },
      ],
    },
  },
  contact_form: {
    label: "Contact form",
    limit: 1,
    settings: [
      heading("Contact us"),
      { key: "subheading", type: "textarea", label: "Text", default: "", translatable: true },
      { key: "showPhone", type: "checkbox", label: "Ask for phone number", default: true },
    ],
  },
  map: {
    label: "Map",
    limit: 2,
    settings: [
      heading("Visit our store"),
      { key: "address", type: "text", label: "Address (as on Google Maps)", default: "" },
      { key: "height", type: "select", label: "Height", options: ["small", "medium", "large"], default: "medium" },
    ],
  },
  // Leaflet + OpenStreetMap — Google "map" section se alag (woh waisa hi rehta hai).
  // Kai pins (blocks), seller khud zoom / area chunta hai, API key nahi chahiye.
  osm_map: {
    label: "Map (OpenStreetMap)",
    limit: 2,
    settings: [
      heading("Find our stores"),
      { key: "fitPins", type: "checkbox", label: "Zoom to show all pins", default: true },
      {
        key: "view",
        type: "geo",
        withZoom: true,
        label: "Map area and zoom",
        hint: "Move and zoom the map to the area customers see first",
        default: null,
        showIf: { key: "fitPins", equals: false },
      },
      { key: "height", type: "select", label: "Height", options: ["small", "medium", "large"], default: "medium" },
      { key: "showList", type: "checkbox", label: "Show the list of locations", default: true },
      { key: "scrollZoom", type: "checkbox", label: "Zoom with the mouse wheel", default: false },
    ],
    blocks: {
      label: "Location",
      settings: [
        { key: "name", type: "text", label: "Name", default: "", translatable: true },
        { key: "location", type: "geo", label: "Pin on the map", hint: "Search, or click the map to drop the pin", default: null },
        { key: "address", type: "textarea", label: "Address", default: "" },
        { key: "phone", type: "text", label: "Phone", default: "" },
        { key: "hours", type: "text", label: "Opening hours", default: "", translatable: true },
      ],
    },
  },
};

// ── Har section ke common style settings (section.style) ──
const SECTION_STYLE = [
  { key: "background", type: "color", label: "Background color", default: null },
  { key: "padding", type: "select", label: "Vertical spacing", options: ["none", "small", "medium", "large"], default: "none" },
  { key: "visibility", type: "select", label: "Show on", options: ["all", "desktop", "mobile"], default: "all" },
];

// ── Theme presets (editor me one-click "Theme styles") ──
// Sirf colors / typography / layout badalte hain — sections ka content nahi.
// Har value validator se guzarti hai (hex, FONTS whitelist, radius options).
const PRESETS = [
  {
    id: "classic",
    name: "Classic",
    description: "The default storefront look",
    settings: {
      colors: { accent: null, accentHover: null, accentText: null, background: null, card: null, text: null, border: null },
      typography: { headingFont: null, bodyFont: null },
      layout: { radius: "default" },
      buttons: { shape: "default", style: "solid", textCase: "default" },
      cards: { style: "default" },
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean black & white, lots of space",
    settings: {
      colors: { accent: "#111827", accentHover: "#000000", accentText: "#ffffff", background: "#ffffff", card: "#ffffff", text: "#111827", border: "#e5e7eb" },
      typography: { headingFont: "Inter", bodyFont: "Inter" },
      layout: { radius: "small" },
      buttons: { shape: "square", style: "outline", textCase: "default" },
      cards: { style: "bordered" },
    },
  },
  {
    id: "bold",
    name: "Bold",
    description: "Strong red accent for sales & deals",
    settings: {
      colors: { accent: "#e11d48", accentHover: "#be123c", accentText: "#ffffff", background: "#fff5f6", card: "#ffffff", text: "#1f1720", border: "#fbd5dc" },
      typography: { headingFont: "Montserrat", bodyFont: "Poppins" },
      layout: { radius: "large" },
      buttons: { shape: "pill", style: "solid", textCase: "uppercase" },
      cards: { style: "shadow" },
    },
  },
  {
    id: "electronics",
    name: "Electronics",
    description: "Cool blue tech store",
    settings: {
      colors: { accent: "#2563eb", accentHover: "#1d4ed8", accentText: "#ffffff", background: "#f1f5f9", card: "#ffffff", text: "#0f172a", border: "#e2e8f0" },
      typography: { headingFont: "Poppins", bodyFont: "Inter" },
      layout: { radius: "default" },
      buttons: { shape: "rounded", style: "solid", textCase: "default" },
      cards: { style: "bordered" },
    },
  },
  {
    id: "fashion",
    name: "Fashion",
    description: "Elegant serif headings, warm neutrals",
    settings: {
      colors: { accent: "#1c1917", accentHover: "#44403c", accentText: "#ffffff", background: "#faf7f2", card: "#ffffff", text: "#1c1917", border: "#e7e5e4" },
      typography: { headingFont: "Playfair Display", bodyFont: "Lato" },
      layout: { radius: "none" },
      buttons: { shape: "square", style: "solid", textCase: "uppercase" },
      cards: { style: "default" },
    },
  },
  {
    id: "fresh",
    name: "Fresh",
    description: "Green & friendly — grocery, health",
    settings: {
      colors: { accent: "#059669", accentHover: "#047857", accentText: "#ffffff", background: "#f0fdf4", card: "#ffffff", text: "#052e16", border: "#d1fae5" },
      typography: { headingFont: "Nunito", bodyFont: "Nunito" },
      layout: { radius: "large" },
      buttons: { shape: "pill", style: "solid", textCase: "default" },
      cards: { style: "shadow" },
    },
  },
];

// Dark mode ke apne colors (khali = built-in dark surfaces; accent khali = light wala accent)
const DARK_COLOR_LABELS = {
  accent: "Accent (dark mode)",
  background: "Page background (dark mode)",
  card: "Cards (dark mode)",
  text: "Text (dark mode)",
  border: "Borders (dark mode)",
};

const GLOBAL_SETTINGS = {
  colors: Object.keys(COLOR_VARS).map((key) => ({ key, type: "color", label: key, default: null })),
  darkColors: Object.entries(DARK_COLOR_LABELS).map(([key, label]) => ({ key, type: "color", label, default: null })),
  typography: [
    { key: "headingFont", type: "select", label: "Heading font", options: [null, ...FONTS], default: null },
    { key: "bodyFont", type: "select", label: "Body font", options: [null, ...FONTS], default: null },
    { key: "headingWeight", type: "select", label: "Heading weight", options: ["default", "500", "600", "700", "800", "900"], default: "default" },
    { key: "headingSize", type: "select", label: "Heading size", options: ["default", "small", "large", "xlarge"], default: "default" },
    { key: "headingCase", type: "select", label: "Heading letters", options: ["default", "uppercase"], default: "default" },
    { key: "headingSpacing", type: "select", label: "Heading letter spacing", options: ["default", "tight", "wide"], default: "default" },
    { key: "textSize", type: "select", label: "Overall text size", options: ["default", "small", "large"], default: "default" },
  ],
  // ── Buttons (primary = accent buttons: Add to cart, Buy, Subscribe ...) ──
  buttons: [
    { key: "shape", type: "select", label: "Shape", options: ["default", "square", "rounded", "pill"], default: "default" },
    { key: "style", type: "select", label: "Style", options: ["solid", "outline"], default: "solid" },
    { key: "textCase", type: "select", label: "Letters", options: ["default", "uppercase"], default: "default" },
    { key: "hover", type: "select", label: "Hover effect", options: ["default", "lift", "glow"], default: "default" },
  ],
  // ── Product cards (har listing: home, category, search, deals) ──
  cards: [
    { key: "style", type: "select", label: "Card style", options: ["default", "bordered", "shadow"], default: "default" },
    { key: "imageRatio", type: "select", label: "Image shape", options: ["default", "square", "portrait", "landscape"], default: "default" },
    { key: "imageFit", type: "select", label: "Image fit", options: ["cover", "contain"], default: "cover" },
    { key: "hoverZoom", type: "checkbox", label: "Zoom image on hover", default: true },
    { key: "textAlign", type: "select", label: "Text alignment", options: ["start", "center"], default: "start" },
    { key: "showBrand", type: "checkbox", label: "Show brand name", default: true },
    { key: "showRating", type: "checkbox", label: "Show star rating", default: true },
    { key: "showWishlist", type: "checkbox", label: "Show wishlist heart", default: true },
    { key: "quickActions", type: "checkbox", label: "Show Add to cart / Buy now buttons", default: true },
  ],
  // ── Badges on product cards ──
  badges: [
    { key: "showDeal", type: "checkbox", label: "Show deal / discount badges", default: true },
    { key: "showStock", type: "checkbox", label: "Show out of stock / low stock badges", default: true },
    { key: "shape", type: "select", label: "Badge shape", options: ["pill", "square"], default: "pill" },
    { key: "saleColor", type: "color", label: "Deal badge color", default: null },
  ],
  layout: [
    { key: "radius", type: "select", label: "Corner radius", options: ["default", "none", "small", "large"], default: "default" },
  ],
  // ── Scroll animations (default off; reduced-motion users ko kabhi nahi) ──
  animations: [
    { key: "reveal", type: "select", label: "Sections appear on scroll", options: ["none", "fade", "slide", "zoom"], default: "none" },
  ],
  branding: [{ key: "favicon", type: "image", label: "Favicon", default: "" }],
  announcement: [
    { key: "enabled", type: "checkbox", label: "Show announcement bar", default: false },
    { key: "text", type: "text", label: "Text", default: "", translatable: true },
    { key: "link", type: "link", label: "Link", default: { type: "none" } },
  ],
  // ── Header (default = aaj ka header) ──
  header: [
    { key: "sticky", type: "checkbox", label: "Sticky header (stays on top while scrolling)", default: true },
    { key: "logoSize", type: "select", label: "Logo size", options: ["default", "small", "large"], default: "default" },
    { key: "showStoreName", type: "checkbox", label: "Show store name next to logo", default: true },
    { key: "showSearch", type: "checkbox", label: "Show search bar", default: true },
    // Phase 3 — layout + color (default = aaj ka header)
    { key: "logoPosition", type: "select", label: "Logo position", options: ["left", "center"], default: "left" },
    { key: "background", type: "color", label: "Header color (empty = default)", default: null },
    { key: "showLanguage", type: "checkbox", label: "Show language switcher", default: true },
    { key: "showThemeToggle", type: "checkbox", label: "Show dark mode switch", default: true },
    { key: "showWishlist", type: "checkbox", label: "Show wishlist icon", default: true },
  ],
  // ── Navigation bar (header ke neeche wali row) ──
  navigation: [
    { key: "show", type: "checkbox", label: "Show navigation bar", default: true },
    { key: "align", type: "select", label: "Links alignment (desktop)", options: ["center", "start"], default: "center" },
    { key: "categoryCount", type: "range", label: "Top categories shown", min: 0, max: 6, step: 1, default: 3 },
    { key: "showMoreCategories", type: "checkbox", label: "Show “More categories” dropdown", default: true },
    { key: "dropdownStyle", type: "select", label: "Menu dropdown style", options: ["list", "mega"], default: "list" },
    { key: "background", type: "color", label: "Navigation bar color (empty = default)", default: null },
  ],
  // ── Popup (default OFF) — newsletter signup ya offer / coupon ──
  popup: [
    { key: "enabled", type: "checkbox", label: "Show a popup", default: false },
    { key: "type", type: "select", label: "Popup type", options: ["newsletter", "offer"], default: "newsletter", showIf: { key: "enabled", equals: true } },
    { key: "image", type: "image", label: "Image", default: "", showIf: { key: "enabled", equals: true } },
    { key: "heading", type: "text", label: "Heading", default: "Get 10% off your first order", translatable: true, showIf: { key: "enabled", equals: true } },
    { key: "text", type: "textarea", label: "Text", default: "Join our newsletter for exclusive deals and new arrivals.", translatable: true, showIf: { key: "enabled", equals: true } },
    { key: "couponCode", type: "text", label: "Coupon code to show (optional)", default: "", showIf: { key: "enabled", equals: true } },
    { key: "buttonLabel", type: "text", label: "Button label", default: "", translatable: true, showIf: { key: "type", equals: "offer" } },
    { key: "buttonLink", type: "link", label: "Button link", default: { type: "none" }, showIf: { key: "type", equals: "offer" } },
    { key: "trigger", type: "select", label: "When to show", options: ["delay", "scroll", "exit"], default: "delay", showIf: { key: "enabled", equals: true } },
    { key: "delaySeconds", type: "range", label: "Seconds after page load", min: 0, max: 60, step: 1, default: 5, showIf: { key: "trigger", equals: "delay" } },
    { key: "scrollPercent", type: "range", label: "After scrolling (% of page)", min: 10, max: 90, step: 5, default: 40, showIf: { key: "trigger", equals: "scroll" } },
    { key: "frequency", type: "select", label: "How often", options: ["once", "session", "always"], default: "once", showIf: { key: "enabled", equals: true } },
    { key: "pages", type: "select", label: "Show on", options: ["all", "home"], default: "all", showIf: { key: "enabled", equals: true } },
  ],
  // ── Conversion (sab default OFF) ──
  conversion: [
    { key: "whatsappFloat", type: "checkbox", label: "Floating WhatsApp button on every page", default: false },
    { key: "whatsappNumber", type: "phone", label: "WhatsApp number (with country code, e.g. 923001234567)", default: "", showIf: { key: "whatsappFloat", equals: true } },
    { key: "whatsappMessage", type: "text", label: "Pre-filled message", default: "Hi, I have a question about your store.", translatable: true, showIf: { key: "whatsappFloat", equals: true } },
  ],
  // ── Footer (default = aaj ka footer; text khali = built-in text) ──
  footer: [
    { key: "aboutText", type: "textarea", label: "About text (empty = store tagline)", default: "", translatable: true },
    { key: "showCategories", type: "checkbox", label: "Show categories column", default: true },
    { key: "showHelp", type: "checkbox", label: "Show help / footer menu column", default: true },
    { key: "helpTitle", type: "text", label: "Help column title (empty = default)", default: "", translatable: true },
    { key: "showSocials", type: "checkbox", label: "Show social icons", default: true },
    { key: "showBadges", type: "checkbox", label: "Show payment & security badges", default: true },
    { key: "paymentMethods", type: "textarea", label: "Payment methods, one per line (empty = default badges)", default: "", showIf: { key: "showBadges", equals: true } },
    { key: "copyright", type: "text", label: "Copyright text (empty = default)", default: "", translatable: true },
    { key: "background", type: "color", label: "Footer color (empty = default dark)", default: null },
    { key: "showNewsletter", type: "checkbox", label: "Show newsletter signup in footer", default: false },
    { key: "newsletterTitle", type: "text", label: "Newsletter title", default: "Subscribe for offers and new arrivals", translatable: true, showIf: { key: "showNewsletter", equals: true } },
  ],
};

const DEFAULT_ORDER = [
  "hero_banners",
  "category_tiles",
  "deals",
  "featured_products",
  "popular_categories",
  "brand_strip",
  "brand_showcase",
];

// ==========================================================
// PRODUCT PAGE TEMPLATE (templates.product) — har product page par same
//   info  zone → product info column me Buy buttons ke NEECHE add-on blocks
//   below zone → main card ke neeche sections (reorder / hide / add)
// Core purchase flow (price / deals / variants / quantity / CTA) fixed rehta hai.
// Default = aaj ka product page bilkul waisa hi.
// ==========================================================
const PRODUCT_BLOCK_TYPES = {
  // ── Built-in (below zone, product data se) ──
  description: { label: "Description", zones: ["below"], limit: 1, settings: [] },
  specifications: { label: "Specifications", zones: ["below"], limit: 1, settings: [] },
  reviews: { label: "Ratings & reviews", zones: ["below"], limit: 1, settings: [] },
  images: { label: "Product images", zones: ["below"], limit: 1, settings: [] },
  related: {
    label: "Related products",
    zones: ["below"],
    limit: 1,
    settings: [
      heading(),
      { key: "limit", type: "range", label: "Number of products", min: 4, max: 12, step: 1, default: 10 },
    ],
  },
  // ── Add-on blocks ──
  trust_badges: {
    label: "Trust badges",
    zones: ["info", "below"],
    limit: 2,
    settings: [
      { key: "items", type: "textarea", label: "Badges (one per line)", default: "Free delivery\n7-day easy return\n100% original\nCash on delivery", translatable: true },
      { key: "layout", type: "select", label: "Layout", options: ["grid", "list"], default: "grid" },
    ],
  },
  delivery_estimate: {
    label: "Delivery estimate",
    zones: ["info"],
    limit: 1,
    settings: [
      { key: "label", type: "text", label: "Label", default: "Estimated delivery", translatable: true },
      { key: "minDays", type: "range", label: "From (days)", min: 0, max: 30, step: 1, default: 2 },
      { key: "maxDays", type: "range", label: "To (days)", min: 1, max: 60, step: 1, default: 5 },
    ],
  },
  whatsapp_button: {
    label: "WhatsApp order button",
    zones: ["info"],
    limit: 1,
    settings: [
      { key: "label", type: "text", label: "Button label", default: "Order on WhatsApp", translatable: true },
      { key: "phone", type: "text", label: "WhatsApp number (with country code, e.g. 923001234567)", default: "" },
      { key: "message", type: "textarea", label: "Message (product name & link added automatically)", default: "Hi, I want to order this product:", translatable: true },
    ],
  },
  text_block: {
    label: "Custom text",
    zones: ["info", "below"],
    limit: 4,
    settings: [
      heading(),
      { key: "body", type: "richtext", label: "Content", default: "", translatable: true },
    ],
  },
};

const PRODUCT_TEMPLATE_SETTINGS = [
  { key: "stickyBar", type: "checkbox", label: "Sticky add-to-cart bar on scroll", default: true },
  { key: "sidebar", type: "checkbox", label: "Show store & quick info sidebar", default: true },
  { key: "lowStockBadge", type: "checkbox", label: 'Show "Only X left" when stock is low', default: false },
  { key: "lowStockThreshold", type: "range", label: "Low stock at or below", min: 1, max: 20, step: 1, default: 5, showIf: { key: "lowStockBadge", equals: true } },
];

const PRODUCT_ZONES = {
  info: { label: "Next to product info", hint: "Shown under the Buy / Add to cart buttons.", max: 6 },
  below: { label: "Below the product", hint: "Sections under the main product card.", max: 12 },
};

// ==========================================================
// CATEGORY / PRODUCT LIST PAGE TEMPLATE (templates.collection)
// /filtering-product (category links, filters) — default = aaj ka page
// ==========================================================
const COLLECTION_TEMPLATE_SETTINGS = [
  { key: "columns", type: "select", label: "Products per row (desktop)", options: ["default", "3", "4", "5"], default: "default" },
  { key: "perPage", type: "range", label: "Products per page", min: 12, max: 60, step: 12, default: 24 },
  { key: "defaultSort", type: "select", label: "Default sort", options: ["featured", "newest", "price-asc", "price-desc"], default: "featured" },
  { key: "sidebar", type: "select", label: "Filter sidebar (desktop)", options: ["left", "right", "hidden"], default: "left" },
  { key: "showBreadcrumb", type: "checkbox", label: "Show breadcrumb", default: true },
  { key: "showBanner", type: "checkbox", label: "Show banner on top", default: false },
  { key: "bannerImage", type: "image", label: "Banner image", default: "", showIf: { key: "showBanner", equals: true } },
  { key: "bannerHeading", type: "text", label: "Banner heading", default: "", translatable: true, showIf: { key: "showBanner", equals: true } },
  { key: "bannerText", type: "textarea", label: "Banner text", default: "", translatable: true, showIf: { key: "showBanner", equals: true } },
];

const DEFAULT_PRODUCT_BELOW = ["description", "specifications", "reviews", "images", "related"];

const defaultsOf = (fields) =>
  Object.fromEntries(fields.map((f) => [f.key, f.default === undefined ? null : structuredClone(f.default)]));

function buildDefaultTheme() {
  const sections = {};
  for (const type of DEFAULT_ORDER) {
    sections[type] = {
      type,
      disabled: false,
      settings: defaultsOf(SECTION_TYPES[type].settings),
      style: defaultsOf(SECTION_STYLE),
      blocks: [],
    };
  }
  return {
    settings: Object.fromEntries(Object.entries(GLOBAL_SETTINGS).map(([group, fields]) => [group, defaultsOf(fields)])),
    sections,
    order: [...DEFAULT_ORDER],
    menus: { main: [], footer: [] },
    templates: { product: buildDefaultProductTemplate(), collection: buildDefaultCollectionTemplate() },
  };
}

function buildDefaultCollectionTemplate() {
  return { settings: defaultsOf(COLLECTION_TEMPLATE_SETTINGS) };
}

function buildDefaultProductTemplate() {
  const blocks = {};
  for (const type of DEFAULT_PRODUCT_BELOW) {
    blocks[type] = { type, disabled: false, settings: defaultsOf(PRODUCT_BLOCK_TYPES[type].settings) };
  }
  return {
    settings: defaultsOf(PRODUCT_TEMPLATE_SETTINGS),
    info: { order: [], blocks: {} },
    below: { order: [...DEFAULT_PRODUCT_BELOW], blocks },
  };
}

/** Editor ke liye (GET /theme/schema) — plain JSON */
function publicSchema() {
  return {
    limits: LIMITS,
    fonts: FONTS,
    colorVars: COLOR_VARS,
    linkTypes: LINK_TYPES,
    globalSettings: GLOBAL_SETTINGS,
    sectionStyle: SECTION_STYLE,
    presets: PRESETS,
    sectionTypes: SECTION_TYPES,
    product: { blockTypes: PRODUCT_BLOCK_TYPES, settings: PRODUCT_TEMPLATE_SETTINGS, zones: PRODUCT_ZONES },
    collection: { settings: COLLECTION_TEMPLATE_SETTINGS },
  };
}

module.exports = {
  LIMITS,
  FONTS,
  COLOR_VARS,
  LINK_TYPES,
  FIELD_TYPES,
  SECTION_TYPES,
  GLOBAL_SETTINGS,
  SECTION_STYLE,
  PRESETS,
  DEFAULT_ORDER,
  PRODUCT_BLOCK_TYPES,
  PRODUCT_TEMPLATE_SETTINGS,
  PRODUCT_ZONES,
  buildDefaultTheme,
  buildDefaultProductTemplate,
  COLLECTION_TEMPLATE_SETTINGS,
  buildDefaultCollectionTemplate,
  defaultsOf,
  publicSchema,
};
