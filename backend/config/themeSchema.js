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
    },
  },
];

const GLOBAL_SETTINGS = {
  colors: Object.keys(COLOR_VARS).map((key) => ({ key, type: "color", label: key, default: null })),
  typography: [
    { key: "headingFont", type: "select", label: "Heading font", options: [null, ...FONTS], default: null },
    { key: "bodyFont", type: "select", label: "Body font", options: [null, ...FONTS], default: null },
  ],
  layout: [
    { key: "radius", type: "select", label: "Corner radius", options: ["default", "none", "small", "large"], default: "default" },
  ],
  branding: [{ key: "favicon", type: "image", label: "Favicon", default: "" }],
  announcement: [
    { key: "enabled", type: "checkbox", label: "Show announcement bar", default: false },
    { key: "text", type: "text", label: "Text", default: "", translatable: true },
    { key: "link", type: "link", label: "Link", default: { type: "none" } },
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
  buildDefaultTheme,
  defaultsOf,
  publicSchema,
};
