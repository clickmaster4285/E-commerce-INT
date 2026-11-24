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
  hero_banners: {
    label: "Hero banners",
    limit: 1,
    settings: [],
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
      { key: "categoryId", type: "category", label: "Category", default: "" },
      { key: "brandId", type: "brand", label: "Brand", default: "" },
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
    sections[type] = { type, disabled: false, settings: defaultsOf(SECTION_TYPES[type].settings), blocks: [] };
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
  DEFAULT_ORDER,
  buildDefaultTheme,
  defaultsOf,
  publicSchema,
};
