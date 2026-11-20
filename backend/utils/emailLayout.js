const fs = require("fs");
const path = require("path");

// ==========================================
// 📧 EMAIL DESIGN SYSTEM
// ------------------------------------------
// Har transactional email (OTP + seller emails) isi layout aur components se
// banti hai. Sirf table-based markup + inline styles — Gmail, Outlook, Apple
// Mail sab me same dikhta hai. Sab user values yahan escape hoti hain.
// ==========================================

const BRAND = {
  orange: "#f57224",
  orangeDark: "#e2641b",
  navy: "#0b1430",
  text: "#0f172a",
  body: "#475569",
  muted: "#64748b",
  border: "#e5e7eb",
  soft: "#f8fafc",
};

const TONES = {
  success: { bg: "#ecfdf5", border: "#a7f3d0", fg: "#047857", solid: "#10b981" },
  warning: { bg: "#fffbeb", border: "#fde68a", fg: "#b45309", solid: "#f59e0b" },
  danger: { bg: "#fef2f2", border: "#fecaca", fg: "#b91c1c", solid: "#ef4444" },
  brand: { bg: "#fff4ec", border: "#fed7aa", fg: "#c2410c", solid: BRAND.orange },
  neutral: { bg: BRAND.soft, border: BRAND.border, fg: BRAND.body, solid: BRAND.muted },
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const BASE_LAYOUT = fs.readFileSync(path.join(__dirname, "..", "templates", "emails", "baseLayout.html"), "utf8");

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : ""));

const platformName = () => process.env.PLATFORM_NAME || "Click Master Store";
const supportEmail = () => process.env.PLATFORM_SUPPORT_EMAIL || "hello@clickmasterstore.pk";

/* ---------- Components (sab HTML return karte hain) ---------- */

/** Status icon + eyebrow + heading + intro. introHtml caller ki taraf se already-safe HTML. */
const hero = ({ tone = "brand", symbol = "&#10003;", eyebrow, title, introHtml = "" }) => {
  const t = TONES[tone] || TONES.brand;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td style="padding:0 0 18px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="48" height="48" align="center" valign="middle" style="width:48px;height:48px;border-radius:24px;background:${t.bg};border:1px solid ${t.border};color:${t.fg};font-family:${FONT};font-size:22px;font-weight:700;line-height:48px;">${symbol}</td>
    </tr></table>
  </td></tr>
  ${eyebrow ? `<tr><td style="padding:0 0 6px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${t.fg};">${escapeHtml(eyebrow)}</td></tr>` : ""}
  <tr><td style="padding:0 0 12px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:700;color:${BRAND.text};">${escapeHtml(title)}</td></tr>
  ${introHtml ? `<tr><td style="padding:0 0 22px;font-family:${FONT};font-size:15px;line-height:1.65;color:${BRAND.body};">${introHtml}</td></tr>` : ""}
</table>`;
};

/** Chhota rounded status label */
const pill = (label, tone = "neutral") => {
  const t = TONES[tone] || TONES.neutral;
  return `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${t.bg};border:1px solid ${t.border};color:${t.fg};font-family:${FONT};font-size:12px;font-weight:700;">${escapeHtml(label)}</span>`;
};

/** Key/value card. rows: [[label, valueHtml]] — valueHtml already safe (escapeHtml ya pill). */
const details = (title, rows) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;border:1px solid ${BRAND.border};border-radius:12px;background:${BRAND.soft};">
  ${title ? `<tr><td colspan="2" style="padding:14px 18px 4px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${BRAND.muted};">${escapeHtml(title)}</td></tr>` : ""}
  ${rows
    .map(
      ([label, value], i) => `
  <tr>
    <td valign="top" style="padding:${i === 0 && !title ? "14px" : "8px"} 18px ${i === rows.length - 1 ? "14px" : "8px"};width:38%;font-family:${FONT};font-size:14px;color:${BRAND.muted};">${escapeHtml(label)}</td>
    <td valign="top" style="padding:${i === 0 && !title ? "14px" : "8px"} 18px ${i === rows.length - 1 ? "14px" : "8px"};font-family:${FONT};font-size:14px;font-weight:600;color:${BRAND.text};word-break:break-word;">${value}</td>
  </tr>`
    )
    .join("")}
</table>`;

/** Bulletproof button(s). buttons: [{ url, label, variant: "primary" | "secondary" }] */
const buttons = (list) => {
  const items = list.filter((b) => b && b.url);
  if (!items.length) return "";
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
  <tr>
    ${items
      .map((b, i) => {
        const primary = b.variant !== "secondary";
        return `<td style="padding:0 ${i < items.length - 1 ? "10px" : "0"} 10px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td align="center" bgcolor="${primary ? BRAND.orange : "#ffffff"}" style="border-radius:10px;${primary ? "" : `border:1px solid ${BRAND.border};`}">
          <a href="${escapeHtml(b.url)}" target="_blank" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:${primary ? "#ffffff" : BRAND.text};text-decoration:none;border-radius:10px;">${escapeHtml(b.label)}</a>
        </td>
      </tr></table>
    </td>`;
      })
      .join("")}
  </tr>
</table>`;
};

/** Numbered "what happens next" steps. items: [{ title, text }] */
const steps = (title, items) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
  ${title ? `<tr><td colspan="2" style="padding:0 0 12px;font-family:${FONT};font-size:15px;font-weight:700;color:${BRAND.text};">${escapeHtml(title)}</td></tr>` : ""}
  ${items
    .map(
      (s, i) => `
  <tr>
    <td valign="top" width="34" style="padding:0 12px 14px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="24" height="24" align="center" valign="middle" style="width:24px;height:24px;border-radius:12px;background:${s.done ? TONES.success.solid : "#fff4ec"};color:${s.done ? "#ffffff" : BRAND.orangeDark};font-family:${FONT};font-size:12px;font-weight:700;line-height:24px;">${s.done ? "&#10003;" : i + 1}</td>
      </tr></table>
    </td>
    <td valign="top" style="padding:2px 0 14px;font-family:${FONT};font-size:14px;line-height:1.55;color:${BRAND.body};">
      <strong style="color:${BRAND.text};">${escapeHtml(s.title)}</strong><br />${escapeHtml(s.text)}
    </td>
  </tr>`
    )
    .join("")}
</table>`;

/** Rangeen callout box. bodyHtml already safe. */
const note = (label, bodyHtml, tone = "neutral") => {
  const t = TONES[tone] || TONES.neutral;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;border-left:4px solid ${t.solid};background:${t.bg};border-radius:8px;">
  <tr><td style="padding:14px 18px;font-family:${FONT};">
    ${label ? `<p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${t.fg};">${escapeHtml(label)}</p>` : ""}
    <p style="margin:0;font-size:14px;line-height:1.65;color:${BRAND.text};white-space:pre-line;">${bodyHtml}</p>
  </td></tr>
</table>`;
};

/** Saada paragraph. html already safe. */
const paragraph = (html, { small = false } = {}) =>
  `<p style="margin:0 0 18px;font-family:${FONT};font-size:${small ? "13px" : "15px"};line-height:1.65;color:${small ? BRAND.muted : BRAND.body};">${html}</p>`;

const link = (url, label) =>
  `<a href="${escapeHtml(url)}" target="_blank" style="color:${BRAND.orangeDark};font-weight:600;text-decoration:none;">${escapeHtml(label || url)}</a>`;

/**
 * Poori email (layout + content).
 * @param {{ preheader: string, content: string, footerNote?: string }} opts
 */
const renderEmail = ({ preheader = "", content, footerNote = "" }) =>
  fill(BASE_LAYOUT, {
    PREHEADER: escapeHtml(preheader),
    PLATFORM: escapeHtml(platformName()),
    PLATFORM_INITIAL: escapeHtml((platformName().trim()[0] || "C").toUpperCase()),
    CONTENT: content,
    FOOTER_NOTE: escapeHtml(footerNote),
    SUPPORT_EMAIL: escapeHtml(supportEmail()),
    YEAR: String(new Date().getFullYear()),
    FONT,
    ORANGE: BRAND.orange,
    NAVY: BRAND.navy,
    MUTED: BRAND.muted,
    BORDER: BRAND.border,
  });

module.exports = {
  BRAND,
  escapeHtml,
  platformName,
  supportEmail,
  hero,
  pill,
  details,
  buttons,
  steps,
  note,
  paragraph,
  link,
  renderEmail,
};
