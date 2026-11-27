// ==========================================================
// ELEMENT STYLES — store editor "Edit mode" ke per-element style overrides
// ----------------------------------------------------------
// theme.elements = { "<key>": { <style> } }
//
// Key = "<scope>~<anchor>~<path>"  (frontend storefront/elementStyles.js banata hai)
//   scope  → "*" (header / footer / announcement — har page) ya page type:
//            "home" | "product" | "category" | "pages/about" | "cart" ...
//   anchor → "s:<sectionId>" (data-sf-section) | "a:header|main|footer|announcement"
//   path   → "" ya "div.2/h2.1" (tag.nth-child, anchor se neeche)
//
// Frontend in keys se CSS selector banata hai — isliye key aur har value yahan
// strict regex / range se guzarti hai (koi raw CSS string kabhi store nahi hoti).
// Frontend mirror: frontend/src/storefront/elementStyles.js (dono saath badlein).
// ==========================================================

const ELEMENT_LIMITS = { maxElements: 300 };

const SCOPE = "(?:\\*|[a-z0-9_-]{1,40}(?:\\/[a-z0-9_-]{1,40}){0,4})";
const ANCHOR = "(?:s:[a-z0-9_:-]{1,60}|a:(?:announcement|header|main|footer))";
const SEGMENT = "[a-z][a-z0-9]{0,9}\\.[1-9]\\d{0,2}";
const ELEMENT_KEY = new RegExp(`^${SCOPE}~${ANCHOR}~(?:${SEGMENT}(?:\\/${SEGMENT}){0,29})?$`);

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const ALIGN = ["start", "center", "end", "justify"];
const WEIGHTS = [300, 400, 500, 600, 700, 800, 900];
const SIDES = ["t", "r", "b", "l"];

// Number ranges (px / %) — editor sliders bhi yahi use karte hain
const RANGES = {
  fontSize: [8, 120],
  radius: [0, 100],
  scale: [50, 200],
  opacity: [0, 100],
  padding: [0, 200],
  margin: [-200, 200],
  width: [16, 2400],
  height: [16, 2400],
};

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function num(raw, [min, max]) {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function sides(raw, range) {
  if (!isPlainObject(raw)) return undefined;
  const out = {};
  for (const s of SIDES) {
    const v = num(raw[s], range);
    if (v !== undefined) out[s] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Ek element ka style — unknown keys drop, invalid values drop (error nahi) */
function sanitizeElementStyle(raw) {
  if (!isPlainObject(raw)) return null;
  const out = {};
  for (const key of ["color", "background"]) {
    if (typeof raw[key] === "string" && HEX_COLOR.test(raw[key])) out[key] = raw[key].toLowerCase();
  }
  for (const key of ["fontSize", "radius", "scale", "opacity", "width", "height"]) {
    const v = num(raw[key], RANGES[key]);
    if (v !== undefined) out[key] = v;
  }
  const weight = Number(raw.fontWeight);
  if (WEIGHTS.includes(weight)) out.fontWeight = weight;
  if (ALIGN.includes(raw.textAlign)) out.textAlign = raw.textAlign;
  const padding = sides(raw.padding, RANGES.padding);
  if (padding) out.padding = padding;
  const margin = sides(raw.margin, RANGES.margin);
  if (margin) out.margin = margin;
  if (raw.hidden === true) out.hidden = true;
  return Object.keys(out).length ? out : null;
}

/** theme.elements validate → { value, errors } (khali styles hata diye jate hain) */
function validateElements(input, path = "elements") {
  const errors = [];
  if (input === undefined || input === null) return { value: {}, errors };
  if (!isPlainObject(input)) return { value: {}, errors: [`${path}: must be an object`] };
  const entries = Object.entries(input);
  if (entries.length > ELEMENT_LIMITS.maxElements) errors.push(`${path}: max ${ELEMENT_LIMITS.maxElements} styled elements`);
  const value = {};
  for (const [key, style] of entries.slice(0, ELEMENT_LIMITS.maxElements)) {
    if (key.length > 400 || !ELEMENT_KEY.test(key)) {
      errors.push(`${path}: invalid element key "${key.slice(0, 60)}"`);
      continue;
    }
    const clean = sanitizeElementStyle(style);
    if (clean) value[key] = clean;
  }
  return { value, errors };
}

module.exports = { ELEMENT_KEY, ELEMENT_LIMITS, ELEMENT_RANGES: RANGES, sanitizeElementStyle, validateElements };
