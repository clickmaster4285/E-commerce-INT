/* ==========================================================
   DEFAULT THEME (client fallback)
   Backend config/themeSchema.js ka buildDefaultTheme() — jab
   /theme/public fail ho (backend down / timeout) to storefront
   bilkul purane layout par chalta rahe. Dono ko sync rakho.
   ========================================================== */

export const DEFAULT_SECTION_ORDER = [
  "hero_banners",
  "category_tiles",
  "deals",
  "featured_products",
  "popular_categories",
  "brand_strip",
  "brand_showcase",
];

export function buildDefaultTheme() {
  const sections = {};
  for (const type of DEFAULT_SECTION_ORDER) {
    sections[type] = { type, disabled: false, settings: {}, blocks: [] };
  }
  return {
    settings: { colors: {}, typography: {}, layout: { radius: "default" }, branding: {}, announcement: {} },
    sections,
    order: [...DEFAULT_SECTION_ORDER],
    menus: { main: [], footer: [] },
    templates: { product: buildDefaultProductTemplate(), collection: buildDefaultCollectionTemplate() },
  };
}

// Category page (/filtering-product) template default = aaj ka page (backend buildDefaultCollectionTemplate)
export const DEFAULT_COLLECTION_SETTINGS = {
  columns: "default",
  perPage: 24,
  defaultSort: "featured",
  sidebar: "left",
  showBreadcrumb: true,
  showBanner: false,
  bannerImage: "",
  bannerHeading: "",
  bannerText: "",
};

export function buildDefaultCollectionTemplate() {
  return { settings: { ...DEFAULT_COLLECTION_SETTINGS } };
}

// Product page template default = aaj ka product page (backend buildDefaultProductTemplate)
export const DEFAULT_PRODUCT_BELOW = ["description", "specifications", "reviews", "images", "related"];

export function buildDefaultProductTemplate() {
  const blocks = {};
  for (const type of DEFAULT_PRODUCT_BELOW) blocks[type] = { type, disabled: false, settings: {} };
  return {
    settings: { stickyBar: true, sidebar: true },
    info: { order: [], blocks: {} },
    below: { order: [...DEFAULT_PRODUCT_BELOW], blocks },
  };
}
