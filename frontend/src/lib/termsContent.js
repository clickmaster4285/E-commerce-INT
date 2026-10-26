import DOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "strike", "code",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "ul[data-type]", "label", "input",
  "a", "img",
  "blockquote", "pre",
  "hr",
  "table", "thead", "tbody", "tr", "th", "td",
];

const ALLOWED_ATTR = [
  "href", "target", "rel", "src", "alt", "title", "style",
  "data-type", "data-checked", "checked", "disabled",
  "class",
];

const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "tr"]);

/** Sanitize rich-text HTML from the editor before rendering inline or persisting. */
export function sanitizeHtml(html) {
  const raw = String(html || "");
  if (typeof window === "undefined") return raw;
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    KEEP_CONTENT: true,
  });
}

/** Convert rich-text HTML to readable plain text (headings/lists become lines). */
export function htmlToPlainText(html) {
  const raw = String(html || "").trim();
  if (!raw) return "";
  if (!/<[a-z][\s\S]*>/i.test(raw)) return raw; // plain text already
  if (typeof window === "undefined") {
    return raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
  }
  const doc = new window.DOMParser().parseFromString(raw, "text/html");
  // Prefix list items with bullets/numbers so plain text keeps structure.
  doc.querySelectorAll("ol > li").forEach((li, index) => {
    li.textContent = `${index + 1}. ${li.textContent.replace(/^\s*[•\d.]+\s*/, "")}`;
  });
  doc.querySelectorAll("ul > li").forEach((li) => {
    if (li.getAttribute("data-type") === "taskItem" || li.querySelector('input[type="checkbox"]')) {
      li.textContent = `[${li.getAttribute("data-checked") === "true" ? "x" : " "}] ${li.textContent.replace(/^\s*\[[ x]\]\s*/, "")}`;
    } else {
      li.textContent = `• ${li.textContent.replace(/^\s*[•\d.]+\s*/, "")}`;
    }
  });

  const parts = [];
  const walk = (node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === window.Node.TEXT_NODE) {
        parts.push(child.textContent);
        return;
      }
      if (child.nodeType !== window.Node.ELEMENT_NODE) return;
      const tag = child.tagName.toLowerCase();
      if (tag === "br") {
        parts.push("\n");
        return;
      }
      walk(child);
      if (BLOCK_TAGS.has(tag) || tag === "li" || tag === "hr") parts.push("\n");
    });
  };
  walk(doc.body);
  const text = parts.join("");
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\s*terms\s*&?\s*conditions\s*:?\s*$/gim, "")
    .trim();
}

/** Render-ready sanitized HTML for dangerouslySetInnerHTML display spots. */
export function renderRichHtml(html) {
  return sanitizeHtml(html);
}
