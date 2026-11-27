/* ==========================================================
   ELEMENT STYLES — store editor "Edit mode" per-element overrides
   ----------------------------------------------------------
   theme.elements = { "<scope>~<anchor>~<path>": { color, background, fontSize, ... } }
     scope  "*" (header/footer/announcement, har page) | pageScope(pathname)
     anchor "s:<sectionId>"  → [data-sf-section="<id>"]  (section ka wrapper div)
            "a:<name>"       → [data-sf-anchor="<name>"] (announcement/header/main/footer)
     path   "div.2/h2.1"     → > div:nth-child(2) > h2:nth-child(1)
   Server par bhi CSS banti hai (SSR, koi flash nahi) → live store par bhi wahi look.
   Backend mirror (validation): backend/utils/elementStyles.js — dono saath badlein.
   ========================================================== */

const SCOPE_RE = /^(?:\*|[a-z0-9_-]{1,40}(?:\/[a-z0-9_-]{1,40}){0,4})$/;
const ANCHOR_RE = /^(?:s:[a-z0-9_:-]{1,60}|a:(?:announcement|header|main|footer))$/;
const SEGMENT_RE = /^([a-z][a-z0-9]{0,9})\.([1-9]\d{0,2})$/;
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

export const GLOBAL_ANCHORS = ["announcement", "header", "footer"];

// Editor sliders + backend clamp ranges
export const ELEMENT_RANGES = {
  fontSize: [8, 120],
  radius: [0, 100],
  scale: [50, 200],
  opacity: [0, 100],
  padding: [0, 200],
  margin: [-200, 200],
  width: [16, 2400],
  height: [16, 2400],
};
export const FONT_WEIGHTS = [300, 400, 500, 600, 700, 800, 900];
export const TEXT_ALIGNS = ["start", "center", "end", "justify"];

/** Pathname → page scope ("home", "product", "pages/about", "orders/_") */
export function pageScope(pathname = "/") {
  const parts = String(pathname || "/")
    .split("?")[0]
    .split("/")
    .filter(Boolean)
    .map((p) => p.toLowerCase());
  if (!parts.length) return "home";
  if (parts[0] === "product") return "product";
  if (parts[0] === "filtering-product") return "category";
  if (parts[0] === "pages" && parts[1]) return `pages/${parts[1].replace(/[^a-z0-9_-]/g, "").slice(0, 40) || "_"}`;
  // ids / numbers / tokens → "_" (ek template ke saare pages ek scope)
  return parts
    .slice(0, 5)
    .map((p) => (/\d/.test(p) || p.length > 40 || /[^a-z0-9_-]/.test(p) ? "_" : p))
    .join("/");
}

const scopeFor = (anchor, scope) => (GLOBAL_ANCHORS.includes(anchor.slice(2)) && anchor.startsWith("a:") ? "*" : scope);

export function parseElementKey(key) {
  if (typeof key !== "string" || key.length > 400) return null;
  const [scope, anchor, path, extra] = key.split("~");
  if (extra !== undefined || !SCOPE_RE.test(scope || "") || !ANCHOR_RE.test(anchor || "")) return null;
  const segments = path ? path.split("/") : [];
  if (segments.length > 30) return null;
  const parsed = [];
  for (const seg of segments) {
    const m = SEGMENT_RE.exec(seg);
    if (!m) return null;
    parsed.push({ tag: m[1], n: Number(m[2]) });
  }
  return { scope, anchor, segments: parsed };
}

export function elementSelector(parsed) {
  const base = parsed.anchor.startsWith("s:")
    ? `[data-sf-section="${parsed.anchor.slice(2)}"]`
    : `[data-sf-anchor="${parsed.anchor.slice(2)}"]`;
  return parsed.segments.reduce((sel, { tag, n }) => `${sel} > ${tag}:nth-child(${n})`, base);
}

/* ── DOM side (sirf preview iframe me) ── */

/**
 * Hover / click target → editable element (ya null).
 * Editor UI (toolbars, overlay) kabhi nahi. Preview-only section wrapper
 * ([data-section-id], live store par hota hi nahi) → uske andar ka [data-sf-section]
 * — warna uska style live par kisi aur element par lagta.
 */
export function editableTarget(el) {
  if (!el?.closest || el.closest("[data-sf-editor-ui],[data-editor-toolbar]")) return null;
  if (el.hasAttribute("data-section-id")) return el.querySelector(":scope > [data-sf-section]");
  // Icon ke andar ka <path> → poora icon (<svg>)
  const svg = el.closest("svg");
  if (svg) return svg.parentElement?.closest("svg") || svg;
  return el;
}

/* ── Element kind → kaun si properties dikhein (editor panel + preview toolbar) ── */

// Har kind ki properties (ElementPanel isi se groups banata hai)
export const KIND_PROPS = {
  text: ["color", "fontSize", "fontWeight", "textAlign", "margin", "padding", "opacity", "hidden"],
  button: ["color", "fontSize", "fontWeight", "background", "radius", "width", "height", "padding", "margin", "scale", "opacity", "hidden"],
  field: ["color", "fontSize", "background", "radius", "width", "height", "padding", "margin", "hidden"],
  icon: ["color", "scale", "margin", "opacity", "hidden"],
  image: ["radius", "width", "height", "scale", "opacity", "margin", "hidden"],
  card: ["background", "radius", "width", "height", "padding", "margin", "textAlign", "color", "scale", "opacity", "hidden"],
  box: ["background", "radius", "width", "height", "padding", "margin", "textAlign", "color", "opacity", "hidden"],
  section: ["background", "radius", "padding", "margin", "color", "hidden"],
  area: ["background", "color", "padding"],
};

const MEDIA_TAGS = ["img", "picture", "video", "iframe", "canvas"];
const FIELD_TAGS = ["input", "textarea", "select"];
const INLINE_DISPLAYS = ["inline", "inline-block", "inline-flex", "contents"];

const isTransparent = (c) => !c || c === "transparent" || /rgba\([^)]*,\s*0\)$/.test(c);

/** DOM element → "text" | "button" | "field" | "icon" | "image" | "card" | "box" | "section" | "area" */
export function elementKind(el) {
  if (!el) return "box";
  if (el.hasAttribute("data-sf-section")) return "section";
  if (el.hasAttribute("data-sf-anchor") || el.tagName === "MAIN") return "area";
  const tag = el.tagName.toLowerCase();
  if (tag === "svg") return "icon";
  if (MEDIA_TAGS.includes(tag)) return "image";
  if (FIELD_TAGS.includes(tag)) return "field";
  const cs = window.getComputedStyle(el);
  const hasText = Boolean(el.textContent?.trim());
  // Sirf inline bachche (text, chhota icon) → text jaisa element
  const inlineOnly = [...el.children].every((c) => {
    const t = c.tagName.toLowerCase();
    if (MEDIA_TAGS.includes(t)) return false;
    return t === "svg" || t === "br" || INLINE_DISPLAYS.includes(window.getComputedStyle(c).display);
  });
  const filled = !isTransparent(cs.backgroundColor) || parseFloat(cs.borderTopWidth) > 0;
  if (tag === "button" || ((tag === "a" || el.getAttribute("role") === "button") && hasText && inlineOnly && filled)) return "button";
  if (hasText && inlineOnly) return "text";
  if (!hasText && el.children.length === 1 && MEDIA_TAGS.includes(el.children[0].tagName.toLowerCase())) return "image";
  const boxed = filled || cs.boxShadow !== "none";
  return boxed ? "card" : "box";
}

const TAG_LABELS = {
  h1: "Heading", h2: "Heading", h3: "Heading", h4: "Heading", h5: "Heading", h6: "Heading",
  p: "Paragraph", blockquote: "Quote", li: "List item", label: "Label", figcaption: "Caption", a: "Link",
};
const KIND_LABELS = {
  text: "Text", button: "Button", field: "Input field", icon: "Icon", image: "Image",
  card: "Card", box: "Container", section: "Section", area: "Page area",
};

/** Hover / panel ka naam: "Heading", "Button", "Card", "Image" ... */
export function elementLabel(el, kind = elementKind(el)) {
  if (kind === "area") {
    const a = el.dataset?.sfAnchor;
    return a ? `${a[0].toUpperCase()}${a.slice(1)}` : "Page area";
  }
  if (kind === "text") return TAG_LABELS[el.tagName.toLowerCase()] || "Text";
  return KIND_LABELS[kind] || "Container";
}

/** Element → key ya null (editor UI / portals / anchor ke bahar) */
export function elementKeyFor(el, pathname) {
  el = editableTarget(el);
  if (!el) return null;
  const anchorEl = el.closest("[data-sf-section],[data-sf-anchor]");
  if (!anchorEl) return null;
  const anchor = anchorEl.dataset.sfSection !== undefined ? `s:${anchorEl.dataset.sfSection}` : `a:${anchorEl.dataset.sfAnchor}`;
  if (!ANCHOR_RE.test(anchor)) return null;
  const segments = [];
  let node = el;
  while (node && node !== anchorEl) {
    const parent = node.parentElement;
    if (!parent) return null;
    const index = Array.prototype.indexOf.call(parent.children, node) + 1;
    const tag = node.tagName.toLowerCase();
    if (!/^[a-z][a-z0-9]{0,9}$/.test(tag) || index > 999) return null;
    segments.unshift(`${tag}.${index}`);
    node = parent;
  }
  if (segments.length > 30) return null;
  const key = `${scopeFor(anchor, pageScope(pathname))}~${anchor}~${segments.join("/")}`;
  return parseElementKey(key) ? key : null;
}

/* ── CSS ── */

const px = (n) => `${n}px`;
const ALIGN_CSS = { start: "start", center: "center", end: "end", justify: "justify" };

function styleDeclarations(style, { preview }) {
  const out = [];
  const add = (prop, value) => out.push(`${prop}:${value} !important`);
  if (HEX.test(style.color || "")) add("color", style.color);
  if (HEX.test(style.background || "")) add("background-color", style.background);
  if (Number.isFinite(style.fontSize)) add("font-size", px(style.fontSize));
  if (FONT_WEIGHTS.includes(style.fontWeight)) add("font-weight", String(style.fontWeight));
  if (ALIGN_CSS[style.textAlign]) add("text-align", ALIGN_CSS[style.textAlign]);
  if (Number.isFinite(style.radius)) add("border-radius", px(style.radius));
  if (Number.isFinite(style.opacity)) add("opacity", String(style.opacity / 100));
  if (Number.isFinite(style.scale) && style.scale !== 100) add("scale", String(style.scale / 100));
  // Size (resize handles / px inputs): flex / grid card par bhi chale; parent se bada na ho
  if (Number.isFinite(style.width)) {
    add("width", px(style.width));
    add("flex-basis", px(style.width));
    add("flex-grow", "0");
    add("flex-shrink", "0");
    add("max-width", "100%");
    add("min-width", "0");
  }
  if (Number.isFinite(style.height)) {
    add("height", px(style.height));
    add("min-height", "0");
    add("overflow", "hidden");
  }
  // Image ka size badla → khinchne ke bajaye crop (sirf img/video par asar)
  if (Number.isFinite(style.width) || Number.isFinite(style.height)) add("object-fit", "cover");
  for (const [prop, sides] of [["padding", style.padding], ["margin", style.margin]]) {
    if (!sides || typeof sides !== "object") continue;
    for (const [s, name] of [["t", "top"], ["r", "right"], ["b", "bottom"], ["l", "left"]]) {
      if (Number.isFinite(sides[s])) add(`${prop}-${name}`, px(sides[s]));
    }
  }
  if (style.hidden) {
    // Editor me chhupa element bhi dhoondna mumkin rahe (dhundla + dashed)
    if (preview) {
      add("opacity", "0.3");
      add("outline", "1px dashed currentColor");
    } else add("display", "none");
  }
  return out;
}

/* Editor ke apne toolbars (EditableSection) store ke DOM ke andar hote hain →
   kisi bade box (column / section) ka font / color / align inherit na karein.
   (globals.css: button { font: inherit } Tailwind text-xs ko bhi hara deta hai) */
const EDITOR_CHROME_RESET =
  "[data-editor-toolbar]{font-size:12px !important;font-weight:600 !important;line-height:1rem !important;" +
  "letter-spacing:normal !important;text-align:start !important;text-transform:none !important;font-style:normal !important}" +
  "[data-editor-toolbar] *{font-size:inherit !important;font-weight:inherit !important;line-height:inherit !important}";

/** Current page ke liye CSS (global + is scope ke elements) */
export function buildElementCss(elements, pathname, { preview = false } = {}) {
  const rules = preview ? [EDITOR_CHROME_RESET] : [];
  if (!elements || typeof elements !== "object") return rules.join("\n");
  const scope = pageScope(pathname);
  for (const [key, style] of Object.entries(elements)) {
    if (!style || typeof style !== "object") continue;
    const parsed = parseElementKey(key);
    if (!parsed || (parsed.scope !== "*" && parsed.scope !== scope)) continue;
    const decl = styleDeclarations(style, { preview });
    if (decl.length) rules.push(`${elementSelector(parsed)}{${decl.join(";")}}`);
  }
  return rules.join("\n");
}

/** Khali values hata kar style object (editor) — sab khali → null */
export function compactStyle(style) {
  if (!style || typeof style !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(style)) {
    if (v === null || v === undefined || v === "" || v === false) continue;
    if (typeof v === "object") {
      const inner = Object.fromEntries(Object.entries(v).filter(([, x]) => Number.isFinite(x)));
      if (Object.keys(inner).length) out[k] = inner;
    } else out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}
