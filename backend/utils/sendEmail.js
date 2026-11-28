const log = require("./logger");
const {
  trimEnv, getSmtpConfig, isSmtpConfigured, getTransporter, verifySmtpConnection, toFriendlySmtpError,
} = require("./mailer");
const { buildOtpEmail } = require("../services/email/otpTemplate");

// Fail quickly when the SMTP server accepts TCP but never completes its greeting.
const SMTP_TIMEOUTS = Object.freeze({ connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000 });

// ==========================================
// ✉️ EMAIL UTILITY (facade) — SMTP transport ab utils/mailer.js me, OTP template
// services/email/otpTemplate.js me. Public API (sendEmail / sendOtpEmail / ...) wahi hai.
// ==========================================
// .env mein SMTP_* set hon to real email jati hai, warna development fallback:
// OTP console par print ho jata hai taake local setup par bhi poora flow test ho sake.

/**
 * Generic email sender (synchronous delivery).
 * SMTP error par friendly message ke saath throw karta hai.
 * Background / fire-and-forget ke liye jobs/email.js enqueueEmail use karo.
 * @returns {Promise<{delivered: boolean, reason?: string}>}
 */
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


const sendOtpEmail = async ({ to, otp, purpose = "email_verification", expiresInMinutes }) => {
  const { subject, html, text } = buildOtpEmail({ otp, purpose, expiresInMinutes });
  return sendEmail({ to, subject, html, text });
};

/** Non-blocking OTP — see jobs/email.js (BullMQ / in-process queue). */
const queueOtpEmail = (...args) => require("../jobs/email").queueOtpEmail(...args);

module.exports = {
  sendEmail,
  sendOtpEmail,
  queueOtpEmail,
  isSmtpConfigured,
  verifySmtpConnection,
  getSmtpConfig,
};
