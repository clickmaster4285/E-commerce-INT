// ==========================================================
// THEME VALIDATOR — store editor ka har save/publish yahan se guzarta hai
// ----------------------------------------------------------
// config/themeSchema.js se driven. Pure functions (DB nahi) → unit-testable.
//
//   validateThemeData(data, { storeId }) → { ok: true, data } | { ok: false, errors: [..] }
//     • unknown keys / section types drop ya reject
//     • strings length-capped, colors hex, ranges clamped
//     • images sirf ISI store ki uploads (/uploads/stores/<storeId>/...)
//     • links: allowlisted types, url sirf http(s) ya "/relative"
//     • richtext sanitize (sanitizeRichText)
//
//   sanitizeRichText(html) — dependency-free allowlist sanitizer:
//     poora string pehle HTML-escape hota hai, phir SIRF exact allowlisted
//     tags (bina attributes; <a> me sirf validated href) wapas markup bante hain.
//     Jo bhi allowlist me nahi woh escaped text hi rehta hai → script/on*/style
//     kabhi execute nahi hote. Frontend render par DOMPurify doosri layer hai.
// ==========================================================

const {
  LIMITS,
  FONTS,
  LINK_TYPES,
  SECTION_TYPES,
  GLOBAL_SETTINGS,
} = require("../config/themeSchema");

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SECTION_ID = /^[a-z0-9_-]{1,40}$/;
const OBJECT_ID = /^[a-f0-9]{24}$/i;
const PAGE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// ───────────────────────── Rich text ─────────────────────────
const SIMPLE_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "s", "h2", "h3", "h4", "ul", "ol", "li", "blockquote"];

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const decodeEntities = (s) =>
  String(s)
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

/** http(s) / mailto / site-relative ("/x", not "//x") — warna null */
function safeHref(raw) {
  const value = String(raw || "").trim();
  if (!value || value.length > LIMITS.url) return null;
  if (/^\/(?!\/)/.test(value)) return value;
  if (/^mailto:[^\s<>"']+$/i.test(value)) return value;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

function sanitizeRichText(html, max = LIMITS.richtext) {
  if (typeof html !== "string" || !html) return "";
  let out = escapeHtml(html.slice(0, max));

  // Escaped tag ke andar attributes: sirf escaped chars ya plain text (raw "<" / ">" kabhi nahi)
  const ATTRS = "((?:\\s(?:[^&]|&quot;|&amp;|&#39;)*?)?)";

  // <p style="..."> / </p> / <br/> → attributes DROP, sirf bare tag wapas
  const simple = new RegExp(`&lt;(\\/?)(${SIMPLE_TAGS.join("|")})${ATTRS}\\s*\\/?&gt;`, "gi");
  out = out.replace(simple, (_m, slash, tag) => `<${slash}${tag.toLowerCase()}>`);

  // <a ... href="..." ...> — sirf validated href rakha jata hai (Tiptap target/rel pehle likhta hai)
  out = out.replace(new RegExp(`&lt;a${ATTRS}\\s*&gt;`, "gi"), (_m, attrs) => {
    const m = /\shref=&quot;((?:[^&]|&amp;)*)&quot;/i.exec(attrs || "");
    // Hamari escape layer hatao, phir source HTML ke entities (&amp; → &) decode
    const href = m ? safeHref(decodeEntities(m[1].replace(/&amp;/g, "&"))) : null;
    if (!href) return "<a>";
    const external = /^https?:/i.test(href);
    return `<a href="${escapeHtml(href)}"${external ? ' rel="noopener noreferrer nofollow" target="_blank"' : ""}>`;
  });
  out = out.replace(/&lt;\/a\s*&gt;/gi, "</a>");
  return out;
}

// ───────────────────────── Field values ─────────────────────────
function imageUrl(value, storeId) {
  const v = str(value, LIMITS.url);
  if (!v) return { value: "" };
  if (!storeId) return { error: "image requires store context" };
  const prefix = `/uploads/stores/${String(storeId)}/`;
  if (!v.startsWith(prefix) || v.includes("..") || /[?#\\]/.test(v)) {
    return { error: "image must be an upload of this store" };
  }
  return { value: v };
}

function linkValue(value) {
  if (!isPlainObject(value)) return { value: { type: "none" } };
  const type = LINK_TYPES.includes(value.type) ? value.type : null;
  if (!type) return { error: "invalid link type" };
  if (type === "none" || type === "home") return { value: { type } };
  if (type === "url") {
    const url = safeHref(value.url);
    return url ? { value: { type, url } } : { error: "link url must be http(s) or start with /" };
  }
  const ref = str(value.ref, 80);
  if (type === "page") {
    return PAGE_SLUG.test(ref) ? { value: { type, ref } } : { error: "invalid page slug" };
  }
  return OBJECT_ID.test(ref) ? { value: { type, ref } } : { error: `invalid ${type} id` };
}

function fieldValue(field, raw, ctx) {
  const missing = raw === undefined;
  const fallback = field.default === undefined ? null : structuredClone(field.default);
  switch (field.type) {
    case "text":
      return { value: missing ? fallback : str(raw, LIMITS.text) };
    case "textarea":
      return { value: missing ? fallback : str(raw, LIMITS.textarea) };
    case "richtext":
      return { value: missing ? fallback : sanitizeRichText(typeof raw === "string" ? raw : "") };
    case "color":
      if (missing || raw === null || raw === "") return { value: null };
      return HEX_COLOR.test(String(raw)) ? { value: String(raw).toLowerCase() } : { error: "invalid color" };
    case "select":
      if (missing) return { value: fallback };
      return field.options.includes(raw) ? { value: raw } : { error: "invalid option" };
    case "range": {
      if (missing) return { value: fallback };
      const n = Number(raw);
      if (!Number.isFinite(n)) return { error: "must be a number" };
      return { value: Math.min(field.max, Math.max(field.min, Math.round(n))) };
    }
    case "checkbox":
      return { value: missing ? Boolean(fallback) : Boolean(raw) };
    case "image":
      return missing ? { value: fallback || "" } : imageUrl(raw, ctx.storeId);
    case "link":
      return missing ? { value: fallback } : linkValue(raw);
    case "category":
    case "brand":
    case "product": {
      const v = missing ? "" : str(raw, 24);
      return !v || OBJECT_ID.test(v) ? { value: v } : { error: `invalid ${field.type} id` };
    }
    default:
      return { error: "unknown field type" };
  }
}

function validateFields(fields, input, path, ctx) {
  const src = isPlainObject(input) ? input : {};
  const out = {};
  for (const field of fields) {
    const r = fieldValue(field, src[field.key], ctx);
    if (r.error) ctx.errors.push(`${path}.${field.key}: ${r.error}`);
    else out[field.key] = r.value;
  }
  return out;
}

// ───────────────────────── Menus ─────────────────────────
function validateMenu(items, path, ctx, depth = 1) {
  if (items === undefined) return [];
  if (!Array.isArray(items)) {
    ctx.errors.push(`${path}: must be an array`);
    return [];
  }
  const out = [];
  for (const [i, item] of items.entries()) {
    if (ctx.menuCount >= LIMITS.maxMenuItems) {
      ctx.errors.push(`${path}: too many menu items (max ${LIMITS.maxMenuItems})`);
      break;
    }
    ctx.menuCount += 1;
    if (!isPlainObject(item)) {
      ctx.errors.push(`${path}[${i}]: invalid item`);
      continue;
    }
    const label = str(item.label, 60);
    if (!label) ctx.errors.push(`${path}[${i}].label: required`);
    const link = linkValue(item.link);
    if (link.error) ctx.errors.push(`${path}[${i}].link: ${link.error}`);
    const id = SECTION_ID.test(String(item.id || "")) ? item.id : `m${ctx.menuCount}`;
    const children =
      depth < LIMITS.maxMenuDepth ? validateMenu(item.children, `${path}[${i}].children`, ctx, depth + 1) : [];
    out.push({ id, label, link: link.value || { type: "none" }, children });
  }
  return out;
}

// ───────────────────────── Theme ─────────────────────────
function validateThemeData(data, { storeId } = {}) {
  const ctx = { storeId, errors: [], menuCount: 0 };

  if (!isPlainObject(data)) return { ok: false, errors: ["theme data must be an object"] };

  let bytes = 0;
  try {
    bytes = Buffer.byteLength(JSON.stringify(data), "utf8");
  } catch {
    return { ok: false, errors: ["theme data is not serializable"] };
  }
  if (bytes > LIMITS.maxPayloadBytes) {
    return { ok: false, errors: [`theme data too large (${bytes} > ${LIMITS.maxPayloadBytes} bytes)`] };
  }

  // Global settings
  const settingsIn = isPlainObject(data.settings) ? data.settings : {};
  const settings = {};
  for (const [group, fields] of Object.entries(GLOBAL_SETTINGS)) {
    settings[group] = validateFields(fields, settingsIn[group], `settings.${group}`, ctx);
  }
  for (const key of ["headingFont", "bodyFont"]) {
    const f = settings.typography?.[key];
    if (f !== null && f !== undefined && !FONTS.includes(f)) ctx.errors.push(`settings.typography.${key}: font not allowed`);
  }

  // Sections + order
  const sectionsIn = isPlainObject(data.sections) ? data.sections : {};
  const orderIn = Array.isArray(data.order) ? data.order : [];
  if (orderIn.length > LIMITS.maxSections) ctx.errors.push(`order: too many sections (max ${LIMITS.maxSections})`);

  const sections = {};
  const order = [];
  const perType = {};
  for (const id of orderIn.slice(0, LIMITS.maxSections)) {
    if (typeof id !== "string" || !SECTION_ID.test(id)) {
      ctx.errors.push(`order: invalid section id "${String(id).slice(0, 40)}"`);
      continue;
    }
    if (sections[id]) {
      ctx.errors.push(`order: duplicate section id "${id}"`);
      continue;
    }
    const sec = sectionsIn[id];
    if (!isPlainObject(sec)) {
      ctx.errors.push(`sections.${id}: missing`);
      continue;
    }
    const def = SECTION_TYPES[sec.type];
    if (!def) {
      ctx.errors.push(`sections.${id}.type: unknown section type "${String(sec.type).slice(0, 40)}"`);
      continue;
    }
    perType[sec.type] = (perType[sec.type] || 0) + 1;
    if (perType[sec.type] > def.limit) {
      ctx.errors.push(`sections.${id}: "${sec.type}" allowed at most ${def.limit} time(s)`);
      continue;
    }

    let blocks = [];
    if (def.blocks) {
      const blocksIn = Array.isArray(sec.blocks) ? sec.blocks : [];
      if (blocksIn.length > LIMITS.maxBlocks) ctx.errors.push(`sections.${id}.blocks: max ${LIMITS.maxBlocks}`);
      blocks = blocksIn.slice(0, LIMITS.maxBlocks).map((b, i) => ({
        id: isPlainObject(b) && SECTION_ID.test(String(b.id || "")) ? b.id : `b${i + 1}`,
        settings: validateFields(def.blocks.settings, isPlainObject(b) ? b.settings : {}, `sections.${id}.blocks[${i}]`, ctx),
      }));
    }

    sections[id] = {
      type: sec.type,
      disabled: Boolean(sec.disabled),
      settings: validateFields(def.settings, sec.settings, `sections.${id}.settings`, ctx),
      blocks,
    };
    order.push(id);
  }

  // Menus
  const menusIn = isPlainObject(data.menus) ? data.menus : {};
  const menus = {
    main: validateMenu(menusIn.main, "menus.main", ctx),
    footer: validateMenu(menusIn.footer, "menus.footer", ctx),
  };

  if (ctx.errors.length) return { ok: false, errors: ctx.errors.slice(0, 50) };
  return { ok: true, data: { settings, sections, order, menus } };
}

module.exports = {
  validateThemeData,
  sanitizeRichText,
  safeHref,
};
