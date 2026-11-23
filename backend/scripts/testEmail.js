




























// SMTP test — usage: node scripts/testEmail.js you@example.com
// utils/logger no-op hai, is liye yahan seedha console (CLI script ka output).
require("dotenv").config({ quiet: true });
const { sendOtpEmail, isSmtpConfigured, verifySmtpConnection, getSmtpConfig } = require("../utils/sendEmail");

const to = process.argv[2];

(async () => {
  console.log("--- SMTP config ---");
  const cfg = getSmtpConfig();
  console.log({
    host: cfg.host || "(empty)",
    port: cfg.port,
    secure: cfg.secure,
    user: cfg.user ? `${cfg.user.slice(0, 3)}***` : "(empty)",
    password: cfg.pass ? "(set)" : "(empty)",
    from: cfg.from || "(empty — the login address is used)",
  });

  if (!isSmtpConfigured()) {
    console.error("\n❌ Email is not configured. Add these to backend/.env:");
    console.error("SMTP_HOST=smtp.gmail.com");
    console.error("SMTP_PORT=587");
    console.error("SMTP_SECURE=false");
    console.error("SMTP_USER=you@gmail.com");
    console.error("SMTP_PASS=16-character Gmail App Password (no spaces)");
    console.error("SMTP_FROM=you@gmail.com");
    process.exit(1);
  }

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("\nUsage: node scripts/testEmail.js you@example.com");
    process.exit(1);
  }

  console.log("\n🔌 Connecting and logging in to the email server...");
  const t0 = Date.now();
  await verifySmtpConnection();
  console.log(`✅ Login OK (${Date.now() - t0} ms). Sending a test code to ${to}...`);

  const result = await sendOtpEmail({ to, otp: "123456", purpose: "email_verification", expiresInMinutes: 5 });
  console.log("Result:", result);
  console.log(result.delivered ? `📧 Sent. Check ${to} (and the spam folder).` : "❌ Not delivered — see the reason above.");
  process.exit(result.delivered ? 0 : 1);
})().catch((error) => {
  console.error("\n❌ Email test failed:", error.message);
  if (error.cause) console.error("Detail:", error.cause.code || "", error.cause.message || error.cause);
  const code = error.cause?.code || error.code || "";
  if (/ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ESOCKET|ECONNECTION/.test(code)) {
    console.error("👉 The email server can't be reached: check your internet, firewall or antivirus (port 587/465).");
  } else if (/EAUTH/.test(code) || /Invalid login|Username and Password not accepted/i.test(error.message)) {
    console.error("👉 Login rejected: for Gmail use a 16-character App Password (Google Account → Security → 2-Step Verification → App passwords).");
  }
  process.exit(1);
});
