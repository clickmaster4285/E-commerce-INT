/* ==========================================================
   THEME TEXT TRANSLATION (storefront)
   Backend utils/themeTranslation.js ke keys:
     s.<sectionId>.<field> · b.<sectionId>.<blockId>.<field>
     m.<menuKey>.<itemId>  · a.<field>
   translations = { key: { ur, ar } } — current locale ka text ho to
   wahi, warna seller ka original (English) text. Language switch
   client par hota hai (reload nahi) → yahan har locale change par.
   ========================================================== */

export function localizeTheme(theme, translations, locale) {
  if (!theme || !translations || !locale || locale === "en") return theme;
  const tr = (key, fallback) => {
    const value = translations[key]?.[locale];
    return typeof value === "string" && value ? value : fallback;
  };
  if (!Object.keys(translations).length) return theme;

  const sections = {};
  for (const [id, section] of Object.entries(theme.sections || {})) {
    const settings = { ...(section.settings || {}) };
    for (const key of Object.keys(settings)) {
      if (typeof settings[key] === "string") settings[key] = tr(`s.${id}.${key}`, settings[key]);
    }
    const blocks = (section.blocks || []).map((block) => {
      const bs = { ...(block.settings || {}) };
      for (const key of Object.keys(bs)) {
        if (typeof bs[key] === "string") bs[key] = tr(`b.${id}.${block.id}.${key}`, bs[key]);
      }
      return { ...block, settings: bs };
    });
    sections[id] = { ...section, settings, blocks };
  }

  const menu = (menuKey, items) =>
    (items || []).map((item) => ({ ...item, label: tr(`m.${menuKey}.${item.id}`, item.label), children: menu(menuKey, item.children) }));

  const announcement = theme.settings?.announcement
    ? { ...theme.settings.announcement, text: tr("a.text", theme.settings.announcement.text) }
    : theme.settings?.announcement;

  return {
    ...theme,
    settings: { ...theme.settings, announcement },
    sections,
    menus: { main: menu("main", theme.menus?.main), footer: menu("footer", theme.menus?.footer) },
  };
}
