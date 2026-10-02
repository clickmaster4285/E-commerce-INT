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
  const user = trimEnv(process.env.SMTP_USER);
  const pass = trimEnv(process.env.SMTP_PASS).replace(/\s+/g, "");
  const port = Number(trimEnv(process.env.SMTP_PORT));
  const from = trimEnv(process.env.SMTP_FROM);

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
      "SMTP configured nahi hai. .env mein SMTP_HOST, SMTP_USER, SMTP_PASS set karein.",
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
      "Email nahi bheja ja saka: SMTP username/password galat hai. Gmail par 16-char App Password use karein (normal password nahi chalega).",
    );
    err.statusCode = 500;
    err.cause = error;
    return err;
  }
  if (code === "ESOCKET" || code === "ETIMEDOUT" || code === "ECONNECTION" || /timeout|timed out|connect/i.test(msg)) {
    const err = new Error(
      "Email server se connect nahi ho saka. SMTP_HOST/PORT check karein aur internet/firewall dekhein.",
    );
    err.statusCode = 500;
    err.cause = error;
    return err;
  }
  if (code === "EENVELOPE" || /mailbox unavailable|recipient|sender/i.test(msg)) {
    const err = new Error(`Email address reject ho gayi: ${msg.slice(0, 160)}`);
    err.statusCode = 500;
    err.cause = error;
    return err;
  }
  const err = new Error(`Email nahi bheja ja saka: ${msg.slice(0, 200) || code || "unknown error"}`);
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
  const storeName = trimEnv(process.env.DEFAULT_STORE_NAME);
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
  const storeName = process.env.DEFAULT_STORE_NAME;
  const safeStore = escapeHtml(storeName);
  const safeOtp = escapeHtml(otp);

  const html = `
  <div style="font-family:Inter,Segoe UI,Arial,sans-serif;background:#f4f4f5;padding:28px 12px;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:#0a0a0a;padding:22px 26px;">
        <p style="margin:0;color:#ffffff;font-size:17px;font-weight:800;letter-spacing:.3px;">${safeStore}</p>
      </div>
      <div style="padding:26px;">
        <h2 style="margin:0 0 8px;color:#0a0a0a;font-size:21px;">${copy.heading}</h2>
        <p style="margin:0 0 22px;color:#525252;font-size:14px;line-height:1.6;">${copy.lead}</p>
        <div style="text-align:center;margin:0 0 22px;">
          <div style="display:inline-block;background:#f4f4f5;border:1px dashed #d4d4d8;border-radius:12px;padding:14px 26px;">
            <span style="font-size:30px;font-weight:800;letter-spacing:9px;color:#0a0a0a;">${safeOtp}</span>
          </div>
        </div>
        <p style="margin:0 0 6px;color:#ef4444;font-size:13px;font-weight:700;">
          This code expires in ${expiresInMinutes} minutes.
        </p>
        <p style="margin:0;color:#737373;font-size:12.5px;line-height:1.6;">
          Never share this code with anyone. ${safeStore} will never ask you for it.
        </p>
      </div>
      <div style="padding:16px 26px;background:#fafafa;border-top:1px solid #f0f0f0;">
        <p style="margin:0;color:#a3a3a3;font-size:11.5px;">© ${new Date().getFullYear()} ${safeStore}. All rights reserved.</p>
      </div>
    </div>
  </div>`;

  const text = `${copy.heading}\n\nYour code is: ${otp}\n\nThis code expires in ${expiresInMinutes} minutes. Never share it with anyone.\n\n${storeName}`;

  return sendEmail({ to, subject: `${copy.subject} — ${storeName}`, html, text });
};

module.exports = { sendEmail, sendOtpEmail, isSmtpConfigured, verifySmtpConnection, getSmtpConfig };