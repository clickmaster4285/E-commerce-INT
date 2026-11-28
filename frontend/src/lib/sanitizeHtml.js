import DOMPurify from "isomorphic-dompurify";

const DEFAULT_OPTS = {
  USE_PROFILES: { html: true },
  FORBID_ATTR: ["style"],
};

/**
 * Safe HTML for SSR + client (§9.1). Empty/falsy → "".
 */
export function sanitizeHtml(html, opts = {}) {
  if (!html || typeof html !== "string") return "";
  try {
    return DOMPurify.sanitize(html, { ...DEFAULT_OPTS, ...opts });
  } catch {
    return "";
  }
}

export default sanitizeHtml;
