require("dotenv").config();
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
    from: cfg.from || "(empty)",
  });
  console.log("isSmtpConfigured:", isSmtpConfigured());

  if (!isSmtpConfigured()) {
    console.error("\n❌ SMTP set nahi hai. backend/.env mein ye set karein:");
    console.error("SMTP_HOST=smtp.gmail.com");
    console.error("SMTP_PORT=587");
    console.error("SMTP_SECURE=false");
    console.error("SMTP_USER=apka@gmail.com");
    console.error("SMTP_PASS=xxxx xxxx xxxx xxxx  (16-char App Password, space ke baghair)");
    console.error("SMTP_FROM=apka@gmail.com");
    process.exit(1);
  }

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("\nUsage: node scripts/testEmail.js apka-email@gmail.com");
    process.exit(1);
  }

  console.log("\n🔌 Verifying SMTP login...");
  await verifySmtpConnection();
  console.log("✅ Login OK. Test OTP bhej raha hoon...");

  const result = await sendOtpEmail({ to, otp: "123456", purpose: "email_verification", expiresInMinutes: 5 });
  console.log("✅ Result:", result);
  console.log(`📧 ${to} ka inbox (aur spam folder) check karein.`);
  process.exit(0);
})().catch((error) => {
  console.error("\n❌ Email test failed:", error.message);
  if (error.cause) console.error("Detail:", error.cause.code || "", error.cause.message || error.cause);
  process.exit(1);
});
