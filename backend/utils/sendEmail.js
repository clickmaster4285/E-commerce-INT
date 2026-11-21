const nodemailer = require("nodemailer");
const log = require("./logger");

// ==========================================
// ✉️ EMAIL UTILITY (Nodemailer + SMTP)
// ==========================================
// .env mein SMTP_* set hon to real email jati hai, warna
// development fallback: OTP console par print ho jata hai
// taake local setup par bhi poora flow test ho sake.

const trimEnv = (value) => String(value || "").trim().replace(/^["']|["']$/g, "");

const getSmtpConfig = () => {
  let host = trimEnv(process.env.SMTP_HOST);
  // Gmail shorthand: EMAIL_USER/EMAIL_PASS (or SMTP_USER/SMTP_PASS)
  const user = trimEnv(process.env.EMAIL_USER) || trimEnv(process.env.SMTP_USER);
  const pass = (trimEnv(process.env.EMAIL_PASS) || trimEnv(process.env.SMTP_PASS)).replace(/\s+/g, "");
  // If only credentials are provided, default to Gmail (smtp.gmail.com:587 STARTTLS)
  if (!host && user && pass) host = "smtp.gmail.com";
  const port = Number(trimEnv(process.env.SMTP_PORT)) || (user && pass ? 587 : NaN);
  const from = trimEnv(process.env.SMTP_FROM) || trimEnv(process.env.EMAIL_FROM);

  // Gmail host sirf env se aata hai (SMTP_HOST) — yahan koi hardcoded default nahi

  // Port 465 = implicit TLS (secure true), 587/25 = STARTTLS (secure false) — sirf env se
  let secure = String(process.env.SMTP_SECURE).toLowerCase();
  if (secure === "true") secure = true;
  else if (secure === "false") secure = false;
  else secure = port === 465;

  return { host, user, pass, port, secure, from };
};

const isSmtpConfigured = () => {
  const { host, user, pass } = getSmtpConfig();
  return Boolean(host && user && pass);
};

let transporter = null;
let cachedKey = "";

const getTransporter = () => {
  if (!isSmtpConfigured()) return null;
  const { host, user, pass, port, secure } = getSmtpConfig();
  const key = `${host}|${port}|${secure}|${user}`;
  if (transporter && cachedKey === key) return transporter;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    // ✅ Timeouts taake request hang na ho — fail fast aur clear error mile
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
    // ✅ Port 587 par STARTTLS force karo (Gmail/zyada providers ke liye zaroori)
    ...(secure === false && port === 587 ? { requireTLS: true } : {}),
    tls: { minVersion: "TLSv1.2" },
  });
  cachedKey = key;
  return transporter;
};

// ✅ Server start / health check par SMTP login verify karne ke liye
const verifySmtpConnection = async () => {
  const mailer = getTransporter();
  if (!mailer) {
    const error = new Error(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env.",
    );
    error.code = "SMTP_NOT_CONFIGURED";
    throw error;
  }
  await mailer.verify();
  return true;
};

const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);

/**
 * Generic email sender.
 * SMTP error par friendly message ke saath throw karta hai
 * taake API user ko samajh aaye ke asal masla kya hai.
 * @returns {Promise<{delivered: boolean, reason?: string}>}
 */
const toFriendlySmtpError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const msg = String(error?.message || "");

  if (code === "EAUTH" || /invalid login|username and password|535/i.test(msg)) {
    const err = new Error(
      "Could not send email: SMTP username/password is incorrect. For Gmail, use a 16-character App Password (a normal password will not work).",
    );
    err.statusCode = 500;
    err.cause = error;
    return err;
  }
  if (code === "ESOCKET" || code === "ETIMEDOUT" || code === "ECONNECTION" || /timeout|timed out|connect/i.test(msg)) {
    const err = new Error(
      "Could not connect to the email server. Check SMTP_HOST/PORT and your internet/firewall settings.",
    );
    err.statusCode = 500;
    err.cause = error;
    return err;
  }
  if (code === "EENVELOPE" || /mailbox unavailable|recipient|sender/i.test(msg)) {
    const err = new Error(`Email address was rejected: ${msg.slice(0, 160)}`);
    err.statusCode = 500;
    err.cause = error;
    return err;
  }
  const err = new Error(`Could not send email: ${msg.slice(0, 200) || code || "unknown error"}`);
  err.statusCode = 500;
  err.cause = error;
  return err;
};

const sendEmail = async ({ to, subject, html, text }) => {
  const mailer = getTransporter();
  if (!mailer) {
    // 🧪 DEV FALLBACK — sirf development me console par (OTP text samehit).
    // Production me OTP/email text KABHI print nahi hota — sirf 1 compact warn.
    // Return shape same ({ delivered:false, reason }) taake caller logic na badle.
    if (process.env.NODE_ENV !== "production") {
      log.warn("⚠️ SMTP not configured — email not sent. Falling back to console.");
      log.warn(`📧 TO: ${to}\n📧 SUBJECT: ${subject}\n${text || ""}`);
      log.warn("💡 Fix: .env mein SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM set karein.");
    } else {
      log.warn("⚠️ SMTP not configured — email not sent.");
    }
    return { delivered: false, reason: "smtp_not_configured" };
  }

  const { user, from } = getSmtpConfig();
  const storeName = trimEnv(process.env.PLATFORM_NAME);
  // ✅ "Name <email>" format — Gmail/spam filter ke liye behtar
  const fromAddress = from || user;
  const fromHeader = /</.test(fromAddress)
    ? fromAddress
    : `"${storeName.replace(/"/g, "")}" <${fromAddress}>`;

  try {
    const info = await mailer.sendMail({ from: fromHeader, to, subject, html, text });
    log.info(`✅ Email sent to ${to} (id: ${info?.messageId || "n/a"})`);
    return { delivered: true };
  } catch (error) {
    log.error("❌ SMTP send failed:", error?.code || "", error?.message || error);
    throw toFriendlySmtpError(error);
  }
};

// ==========================================
// 🔐 OTP EMAIL
// ==========================================
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

const sendOtpEmail = async ({ to, otp, purpose = "email_verification", expiresInMinutes }) => {
  const copy = PURPOSE_COPY[purpose] || PURPOSE_COPY.email_verification;
  const storeName = process.env.PLATFORM_NAME;
  const safeStore = escapeHtml(storeName);
  const safeOtp = escapeHtml(otp);
  // Shared email design (seller emails jaisa hi look)
  const { hero, note, paragraph, renderEmail, BRAND } = require("./emailLayout");

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

  return sendEmail({ to, subject: `${copy.subject} — ${storeName}`, html, text });
};

module.exports = { sendEmail, sendOtpEmail, isSmtpConfigured, verifySmtpConnection, getSmtpConfig };