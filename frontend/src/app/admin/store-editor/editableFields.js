/* ==========================================================
   INLINE TEXT EDITING — preview me click karke edit hone wale fields
   ----------------------------------------------------------
   buildEditableFields(draft, schema) → [{ id, sectionKey, value, multiline, max }]
     Preview (storefront/VisualEditor.js) clicked element ka text inn values se
     match karta hai; match mila → wahin text box.
     sectionKey: section id | "product:<zone>:<blockId>" | "*" (global: header,
     footer, announcement, menus, page templates)
   applyFieldValue(draft, id, value) → draft (copy) mutate; unknown id → false
   Sirf "text" / "textarea" fields (richtext / links sidebar me hi edit hote hain).
   ========================================================== */

const TEXT_TYPES = { text: false, textarea: true };

const fieldsOf = (defs, values, makeId, sectionKey, limits) =>
  (defs || [])
    .filter((f) => f.type in TEXT_TYPES && typeof values?.[f.key] === "string" && values[f.key].trim())
    .map((f) => ({
      id: makeId(f.key),
      sectionKey,
      value: values[f.key],
      multiline: TEXT_TYPES[f.type],
      max: f.type === "textarea" ? limits?.textarea || 1000 : limits?.text || 200,
    }));

export function buildEditableFields(draft, schema) {
  if (!draft || !schema) return [];
  const limits = schema.limits;
  const out = [];

  for (const id of draft.order || []) {
    const section = draft.sections?.[id];
    const def = section && schema.sectionTypes?.[section.type];
    if (!def || section.disabled) continue;
    out.push(...fieldsOf(def.settings, section.settings, (k) => `s|${id}|${k}`, id, limits));
    for (const block of section.blocks || []) {
      out.push(...fieldsOf(def.blocks?.settings, block.settings, (k) => `b|${id}|${block.id}|${k}`, id, limits));
    }
  }

  const product = draft.templates?.product;
  for (const zone of ["info", "below"]) {
    for (const [bid, block] of Object.entries(product?.[zone]?.blocks || {})) {
      const def = schema.product?.blockTypes?.[block?.type];
      if (def) out.push(...fieldsOf(def.settings, block.settings, (k) => `p|${zone}|${bid}|${k}`, `product:${zone}:${bid}`, limits));
    }
  }
  out.push(...fieldsOf(schema.product?.settings, product?.settings, (k) => `t|product|${k}`, "*", limits));
  out.push(...fieldsOf(schema.collection?.settings, draft.templates?.collection?.settings, (k) => `t|collection|${k}`, "*", limits));

  for (const [group, defs] of Object.entries(schema.globalSettings || {})) {
    out.push(...fieldsOf(defs, draft.settings?.[group], (k) => `g|${group}|${k}`, "*", limits));
  }

  const menuItems = (menuKey, items) => {
    for (const item of items || []) {
      if (item?.label?.trim()) out.push({ id: `m|${menuKey}|${item.id}`, sectionKey: "*", value: item.label, multiline: false, max: 60 });
      menuItems(menuKey, item?.children);
    }
  };
  menuItems("main", draft.menus?.main);
  menuItems("footer", draft.menus?.footer);
  return out;
}

const findMenuItem = (items, id) => {
  for (const item of items || []) {
    if (item.id === id) return item;
    const child = findMenuItem(item.children, id);
    if (child) return child;
  }
  return null;
};

/** Draft copy me value likho (update() ke andar). true = likha gaya */
export function applyFieldValue(draft, id, value) {
  if (typeof id !== "string" || typeof value !== "string") return false;
  const [kind, a, b, c] = id.split("|");
  const set = (obj, key) => {
    if (!obj || typeof obj[key] !== "string") return false;
    obj[key] = value;
    return true;
  };
  switch (kind) {
    case "s":
      return set(draft.sections?.[a]?.settings, b);
    case "b":
      return set((draft.sections?.[a]?.blocks || []).find((x) => x.id === b)?.settings, c);
    case "p":
      return set(draft.templates?.product?.[a]?.blocks?.[b]?.settings, c);
    case "t":
      return set(draft.templates?.[a]?.settings, b);
    case "g":
      return set(draft.settings?.[a], b);
    case "m": {
      const item = findMenuItem(draft.menus?.[a], b);
      if (!item || typeof item.label !== "string") return false;
      item.label = value.slice(0, 60);
      return true;
    }
    default:
      return false;
  }
}

/** Field ki current value (sidebar "Element" panel ka text box) — na mile to null */
export function readFieldValue(draft, id) {
  if (!draft || typeof id !== "string") return null;
  const [kind, a, b, c] = id.split("|");
  const pick = (obj, key) => (obj && typeof obj[key] === "string" ? obj[key] : null);
  switch (kind) {
    case "s":
      return pick(draft.sections?.[a]?.settings, b);
    case "b":
      return pick((draft.sections?.[a]?.blocks || []).find((x) => x.id === b)?.settings, c);
    case "p":
      return pick(draft.templates?.product?.[a]?.blocks?.[b]?.settings, c);
    case "t":
      return pick(draft.templates?.[a]?.settings, b);
    case "g":
      return pick(draft.settings?.[a], b);
    case "m":
      return findMenuItem(draft.menus?.[a], b)?.label ?? null;
    default:
      return null;
  }
}
