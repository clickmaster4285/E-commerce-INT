require("dotenv").config();
const { sendOtpEmail, isSmtpConfigured, verifySmtpConnection, getSmtpConfig } = require("../utils/sendEmail");
const log = require("../utils/logger");

const to = process.argv[2];

(async () => {
  log.info("--- SMTP config ---");
  const cfg = getSmtpConfig();
  log.info({
    host: cfg.host || "(empty)",
    port: cfg.port,
    secure: cfg.secure,
    user: cfg.user ? `${cfg.user.slice(0, 3)}***` : "(empty)",
    from: cfg.from || "(empty)",
  });
  log.info("isSmtpConfigured:", isSmtpConfigured());

  if (!isSmtpConfigured()) {
    log.error("\n❌ SMTP set nahi hai. backend/.env mein ye set karein:");
    log.error("SMTP_HOST=smtp.gmail.com");
    log.error("SMTP_PORT=587");
    log.error("SMTP_SECURE=false");
    log.error("SMTP_USER=apka@gmail.com");
    log.error("SMTP_PASS=xxxx xxxx xxxx xxxx  (16-char App Password, space ke baghair)");
    log.error("SMTP_FROM=apka@gmail.com");
    process.exit(1);
  }

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    log.error("\nUsage: node scripts/testEmail.js apka-email@gmail.com");
    process.exit(1);
  }

  log.info("\n🔌 Verifying SMTP login...");
  await verifySmtpConnection();
  log.info("✅ Login OK. Test OTP bhej raha hoon...");

  const result = await sendOtpEmail({ to, otp: "123456", purpose: "email_verification", expiresInMinutes: 5 });
  log.info("✅ Result:", result);
  log.info(`📧 ${to} ka inbox (aur spam folder) check karein.`);
  process.exit(0);
})().catch((error) => {
  log.error("\n❌ Email test failed:", error.message);
  if (error.cause) log.error("Detail:", error.cause.code || "", error.cause.message || error.cause);
  process.exit(1);
});