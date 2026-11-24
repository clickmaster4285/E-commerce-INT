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
  };
}
