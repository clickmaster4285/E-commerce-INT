// ==========================================================
// MAILER — SMTP config + nodemailer transport + error mapping (optimizeplan.md §6.3)
// ----------------------------------------------------------
// utils/sendEmail.js se nikala gaya taake jobs/email.js aur services/email/* bina
// circular dependency ke transport use kar saken. Behavior pehle jaisa.
// ==========================================================

const nodemailer = require("nodemailer");

const trimEnv = (value) => String(value || "").trim().replace(/^["']|["']$/g, "");

const getSmtpConfig = () => {
  let host = trimEnv(process.env.SMTP_HOST);
  // Gmail shorthand: SMTP_USER/SMTP_PASS
  const user =  trimEnv(process.env.SMTP_USER);
  const pass = trimEnv(process.env.SMTP_PASS).replace(/\s+/g, "");
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


module.exports = { trimEnv, getSmtpConfig, isSmtpConfigured, getTransporter, verifySmtpConnection, toFriendlySmtpError };
