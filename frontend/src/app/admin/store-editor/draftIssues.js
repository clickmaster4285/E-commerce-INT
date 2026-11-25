/* ==========================================================
   DRAFT ISSUES — save se pehle client-side check
   Backend themeValidator jo cheezen reject karta hai (menu label khali,
   product/category link me kuch select nahi, galat web address) wo yahan
   pehle hi pakad lete hain → autosave tab tak ruka rehta hai, 400 nahi.
   Rules backend utils/themeValidator.js (linkValue / validateMenu) ke saath sync.
   ========================================================== */

const REF_LABELS = { page: "page", category: "category", product: "product", brand: "brand", deal: "deal" };
const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** Link adhoora / galat → message, theek → null */
export function linkIssue(link) {
  if (!link || typeof link !== "object") return null;
  if (link.type === "url") {
    const url = String(link.url || "").trim();
    if (!url) return "Enter a web address";
    if (/^\/(?!\/)/.test(url) || /^mailto:\S+$/i.test(url)) return null;
    try {
      const u = new URL(url);
      return u.protocol === "http:" || u.protocol === "https:" ? null : "Use an address starting with https:// or /";
    } catch {
      return "Use an address starting with https:// or /";
    }
  }
  if (REF_LABELS[link.type]) {
    const ref = String(link.ref || "").trim();
    if (!ref) return `Choose a ${REF_LABELS[link.type]}`;
    if (link.type === "deal" && !OBJECT_ID.test(ref)) return "Deal id is 24 letters/numbers";
  }
  return null;
}

/** Ek menu item ke field-wise errors: { label?, link? } */
export function menuItemErrors(item) {
  const errors = {};
  if (!String(item?.label || "").trim()) errors.label = "Label is required";
  const link = linkIssue(item?.link);
  if (link) errors.link = link;
  return errors;
}

const MENU_TITLES = { main: "Main menu", footer: "Footer menu" };

function linkFieldIssues(fields, values, where, target, out) {
  for (const field of fields || []) {
    if (field.type !== "link") continue;
    const issue = linkIssue(values?.[field.key]);
    if (issue) out.push({ message: `${where} → ${field.label || field.key}: ${issue}`, target });
  }
}

/**
 * Poore draft ke issues: [{ message, target }]
 * target = { kind: "menus" } | { kind: "section", id } | { kind: "theme", group }
 */
export function draftIssues(draft, schema) {
  const out = [];
  if (!draft) return out;

  for (const [menuKey, items] of Object.entries(draft.menus || {})) {
    const title = MENU_TITLES[menuKey] || menuKey;
    (items || []).forEach((item, i) => {
      const e = menuItemErrors(item);
      const name = String(item?.label || "").trim() || `link ${i + 1}`;
      if (e.label) out.push({ message: `${title}, link ${i + 1}: ${e.label}`, target: { kind: "menus" } });
      if (e.link) out.push({ message: `${title}, “${name}”: ${e.link}`, target: { kind: "menus" } });
      (item?.children || []).forEach((child, j) => {
        const c = menuItemErrors(child);
        if (c.label) out.push({ message: `${title}, “${name}” sub-link ${j + 1}: ${c.label}`, target: { kind: "menus" } });
        if (c.link) out.push({ message: `${title}, “${name}” sub-link ${j + 1}: ${c.link}`, target: { kind: "menus" } });
      });
    });
  }

  if (schema) {
    for (const id of draft.order || []) {
      const section = draft.sections?.[id];
      const def = schema.sectionTypes?.[section?.type];
      if (!section || !def) continue;
      const where = def.label || section.type;
      const target = { kind: "section", id };
      linkFieldIssues(def.settings, section.settings, where, target, out);
      (section.blocks || []).forEach((block, i) => {
        linkFieldIssues(def.blocks?.settings, block?.settings, `${where} (${def.blocks?.label || "block"} ${i + 1})`, target, out);
      });
    }
    for (const [group, fields] of Object.entries(schema.globalSettings || {})) {
      linkFieldIssues(fields, draft.settings?.[group], "Theme settings", { kind: "theme", group }, out);
    }
  }
  return out;
}
