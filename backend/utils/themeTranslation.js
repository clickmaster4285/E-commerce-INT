// ==========================================================
// THEME TRANSLATION — store editor ka seller-written text (published theme)
// ----------------------------------------------------------
// Theme ka shape dynamic hai (sections/blocks/menus), is liye translationService
// ke fixed field paths kaam nahi aate. Yahan:
//   collectThemeTexts(theme) → [{ key, text }]   (pure — testable)
//     s.<sectionId>.<field>            section text/textarea settings (translatable)
//     b.<sectionId>.<blockId>.<field>  block settings
//     m.<menuKey>.<itemId>             menu labels (children bhi)
//     a.text                           announcement bar
//   syncThemeTranslations(storeId)  → publish ke baad (fire-and-forget)
//     StoreTheme.translations = { [key]: { h: md5(text), ur: "...", ar: "..." } }
//     Same hash wali entries dobara translate NAHI hoti (sirf badla hua text).
//
// Rich text (HTML) abhi translate nahi hota — LibreTranslate markup tod sakta hai;
// storefront English (source) dikhata hai.
// ==========================================================

const { SECTION_TYPES, GLOBAL_SETTINGS, PRODUCT_BLOCK_TYPES } = require("../config/themeSchema");

const TEXT_TYPES = new Set(["text", "textarea"]);
const translatableKeys = (fields = []) => fields.filter((f) => f.translatable && TEXT_TYPES.has(f.type)).map((f) => f.key);

function collectThemeTexts(theme) {
  const out = [];
  const push = (key, text) => {
    const value = typeof text === "string" ? text.trim() : "";
    if (value) out.push({ key, text: value });
  };
  if (!theme || typeof theme !== "object") return out;

  for (const id of theme.order || []) {
    const section = theme.sections?.[id];
    const def = section && SECTION_TYPES[section.type];
    if (!def || section.disabled) continue;
    for (const key of translatableKeys(def.settings)) push(`s.${id}.${key}`, section.settings?.[key]);
    if (def.blocks) {
      const blockKeys = translatableKeys(def.blocks.settings);
      for (const block of section.blocks || []) {
        for (const key of blockKeys) push(`b.${id}.${block.id}.${key}`, block.settings?.[key]);
      }
    }
  }

  const walkMenu = (menuKey, items) => {
    for (const item of items || []) {
      push(`m.${menuKey}.${item.id}`, item.label);
      walkMenu(menuKey, item.children);
    }
  };
  walkMenu("main", theme.menus?.main);
  walkMenu("footer", theme.menus?.footer);

  for (const key of translatableKeys(GLOBAL_SETTINGS.announcement)) push(`a.${key}`, theme.settings?.announcement?.[key]);
  // Baaki global groups (header / footer ...) → g.<group>.<field>
  for (const [group, fields] of Object.entries(GLOBAL_SETTINGS)) {
    if (group === "announcement") continue;
    for (const key of translatableKeys(fields)) push(`g.${group}.${key}`, theme.settings?.[group]?.[key]);
  }

  // Product page template blocks → p.<zone>.<blockId>.<field>
  const product = theme.templates?.product;
  for (const zone of ["info", "below"]) {
    for (const id of product?.[zone]?.order || []) {
      const block = product[zone].blocks?.[id];
      const def = block && PRODUCT_BLOCK_TYPES[block.type];
      if (!def || block.disabled) continue;
      for (const key of translatableKeys(def.settings)) push(`p.${zone}.${id}.${key}`, block.settings?.[key]);
    }
  }
  return out;
}

/**
 * Pure merge: purani entries (same hash) reuse, sirf naye/badle texts `pending`.
 * Returns { next, pending: [{ key, text, hash }] }
 */
function planTranslations(entries, existing = {}, locales = [], hashText) {
  const next = {};
  const pending = [];
  for (const { key, text } of entries) {
    const h = hashText(text);
    const prev = existing?.[key];
    if (prev && prev.h === h && locales.every((l) => typeof prev[l] === "string" && prev[l])) {
      next[key] = prev;
    } else {
      next[key] = { h };
      pending.push({ key, text, hash: h });
    }
  }
  return { next, pending };
}

/** Public endpoint ke liye: hash hatao → { key: { ur, ar } } */
function publicTranslations(stored) {
  const out = {};
  for (const [key, value] of Object.entries(stored || {})) {
    if (!value || typeof value !== "object") continue;
    const { h, ...locales } = value;
    if (Object.keys(locales).length) out[key] = locales;
  }
  return out;
}

const inflight = new Set();

/** Published theme ka text translate karke StoreTheme.translations me likho */
async function syncThemeTranslations(storeId) {
  const id = String(storeId);
  if (inflight.has(id)) return;
  inflight.add(id);
  try {
    // Lazy require: libreTranslate load time par .env maangta hai (tests me nahi)
    const { isEnabled, translateBatch, TARGET_LOCALES } = require("./libreTranslate");
    const { hashText } = require("./translationService");
    const StoreTheme = require("../models/StoreTheme");
    if (!isEnabled()) return;

    const doc = await StoreTheme.findOne({ storeId }).setOptions({ skipTenantScope: true }).select("published publishedVersion translations").lean();
    if (!doc?.published) return;

    const { next, pending } = planTranslations(collectThemeTexts(doc.published), doc.translations, TARGET_LOCALES, hashText);

    for (const locale of TARGET_LOCALES) {
      if (!pending.length) break;
      // eslint-disable-next-line no-await-in-loop
      const result = await translateBatch(pending.map((p) => p.text), locale);
      if (!Array.isArray(result)) continue; // service down → English fallback
      pending.forEach((p, i) => {
        if (typeof result[i] === "string" && result[i].trim()) next[p.key][locale] = result[i].trim();
      });
    }

    // Beech me naya publish hua ho to uska apna sync chalega — purana overwrite nahi
    await StoreTheme.updateOne(
      { storeId, publishedVersion: doc.publishedVersion },
      { $set: { translations: next, translationsUpdatedAt: new Date() } },
    ).setOptions({ skipTenantScope: true });

    try {
      require("./publicCache").invalidate(["theme"]);
    } catch (_) {}
  } catch (error) {
    console.error("[themeTranslation] sync failed:", error.message);
  } finally {
    inflight.delete(id);
  }
}

function queueThemeTranslationSync(storeId) {
  if (!storeId) return;
  setImmediate(() => {
    syncThemeTranslations(storeId);
  });
}

module.exports = {
  collectThemeTexts,
  planTranslations,
  publicTranslations,
  syncThemeTranslations,
  queueThemeTranslationSync,
};
