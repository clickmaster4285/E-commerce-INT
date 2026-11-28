/* ==========================================================
   THEME LINK → storefront href
   Link shape backend validator se aata hai:
     { type: "none" | "home" | "url" | "page" | "category" | "product" | "brand" | "deal", ref?, url? }
   null → link render nahi (deleted target / "none").
   ========================================================== */

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Raw string URL (banner button.link, footer social url) — sirf same-site path,
// http(s) ya mailto/tel. javascript:, data:, vbscript:, "//host" sab block.
// Control chars/whitespace hata kar check hota hai ("java\nscript:" trick).
export function safeUrl(value, { allowMailto = true } = {}) {
  const url = String(value || "").trim();
  if (!url) return null;
  const compact = url.replace(/[\u0000-\u0020\u007f-\u009f]/g, "");
  if (/^\/(?![/\\])/.test(compact) || compact === "#") return url;
  if (/^https?:\/\/[^/\s]+/i.test(compact)) return url;
  if (allowMailto && /^(mailto|tel):/i.test(compact)) return url;
  return null;
}

export function resolveThemeLink(link) {
  if (!link || typeof link !== "object") return null;
  const ref = String(link.ref || "");
  switch (link.type) {
    case "home":
      return "/";
    case "url": {
      const url = String(link.url || "");
      if (/^\/(?!\/)/.test(url) || /^https?:\/\//i.test(url) || /^mailto:/i.test(url)) return url;
      return null;
    }
    case "page":
      return SLUG.test(ref) ? `/pages/${ref}` : null;
    case "category":
      return OBJECT_ID.test(ref) ? `/filtering-product?category=${ref}` : null;
    case "brand":
      return OBJECT_ID.test(ref) ? `/brand/${ref}` : null;
    case "product":
      return OBJECT_ID.test(ref) ? `/product/${ref}` : null;
    case "deal":
      return OBJECT_ID.test(ref) ? `/deals/${ref}` : null;
    default:
      return null;
  }
}

export const isExternalHref = (href) => /^(https?:|mailto:)/i.test(String(href || ""));
