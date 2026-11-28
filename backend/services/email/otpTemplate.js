// ==========================================================
// OTP EMAIL TEMPLATE (optimizeplan.md §6.3)
// ----------------------------------------------------------
// utils/sendEmail.js se nikala gaya: sirf HTML/text banata hai, bhejta nahi
// (bhejna utils/sendEmail.js / jobs/email.js ka kaam hai).
// ==========================================================

const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);

const PURPOSE_COPY = {
  email_verification: {
    subject: "Verify your email address",
    heading: "Verify your email",
    lead: "Use the code below to verify your email address and activate your account.",
  },
  password_reset: {
    subject: "Reset your password",
    heading: "Reset your password",
    lead: "Use the code below to reset your password. If you did not request this, you can safely ignore this email.",
  },
};

/** @returns {{ subject: string, html: string, text: string }} */
const buildOtpEmail = ({ otp, purpose = "email_verification", expiresInMinutes }) => {
  const copy = PURPOSE_COPY[purpose] || PURPOSE_COPY.email_verification;
  const storeName = process.env.PLATFORM_NAME;
  const safeStore = escapeHtml(storeName);
  const safeOtp = escapeHtml(otp);
  // Shared email design (seller emails jaisa hi look)
  const { hero, note, paragraph, renderEmail, BRAND } = require("../../utils/emailLayout");

  const codeBox = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px;">
  <tr><td align="center" style="padding:22px 16px;background:#fff4ec;border:1px dashed #fdba74;border-radius:12px;">
    <p style="margin:0 0 6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#c2410c;">Your verification code</p>
    <p style="margin:0;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;font-weight:800;letter-spacing:10px;color:${BRAND.text};">${safeOtp}</p>
  </td></tr>
</table>`;

  const content = [
    hero({ tone: "brand", symbol: "&#128274;", title: copy.heading, introHtml: escapeHtml(copy.lead) }),
    codeBox,
    paragraph(`This code expires in <strong style="color:#b91c1c;">${escapeHtml(String(expiresInMinutes))} minutes</strong>.`),
    note("Keep this code private", `Never share this code with anyone. ${safeStore} will never ask you for it.`, "neutral"),
  ].join("");

  const html = renderEmail({
    preheader: `Your ${storeName} code is ${otp}. It expires in ${expiresInMinutes} minutes.`,
    content,
    footerNote: "If you didn't request this code, you can safely ignore this email.",
  });

  const text = `${copy.heading}\n\nYour code is: ${otp}\n\nThis code expires in ${expiresInMinutes} minutes. Never share it with anyone.\n\n${storeName}`;

  return { subject: `${copy.subject} — ${storeName}`, html, text };
};

module.exports = { escapeHtml, PURPOSE_COPY, buildOtpEmail };
