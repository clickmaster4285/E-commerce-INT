// ==========================================================
// EMAIL JOBS (optimizeplan.md §6.3)
// ----------------------------------------------------------
//   await enqueueEmail({ to, subject, html, text }, { jobId? })
//   await enqueueOtpEmail({ to, otp, purpose, expiresInMinutes })
// Queue me daal kar turant return (response SMTP handshake ka wait nahi karta).
//
// ⚠️ OTP controllers (otpController / userController) abhi `sendOtpEmail` AWAIT karte hain:
// wo delivery result (delivered / debugOtp) aur SMTP error user ko dikhate hain, aur fail par
// OTP row delete karte hain. Isliye wahan queue NAHI lagayi — sirf wahan use karo jahan
// delivery fail par request fail nahi honi chahiye (notifications, seller emails).
// NEXT STEP: BullMQ worker (alag process) — jobs/queue.js ka interface wahi rahega.
// ==========================================================

const queue = require("./queue");
const log = require("../utils/logger");

const EMAIL_JOB = "email";

// Handler lazy: sendEmail load hone se pehle tests stub kar saken
queue.register(EMAIL_JOB, async (message) => {
  const { sendEmail } = require("../utils/sendEmail");
  const result = await sendEmail(message); // SMTP error → throw → queue retry
  if (result && result.delivered === false) {
    log.warn(`[jobs/email] not delivered to ${message.to}: ${result.reason || "unknown"}`);
  }
});

const enqueueEmail = (message, opts = {}) =>
  queue.add(EMAIL_JOB, message, { attempts: 3, backoffMs: 2000, ...opts });

const enqueueOtpEmail = ({ to, otp, purpose, expiresInMinutes }, opts = {}) => {
  const { buildOtpEmail } = require("../services/email/otpTemplate");
  return enqueueEmail({ to, ...buildOtpEmail({ otp, purpose, expiresInMinutes }) }, opts);
};

module.exports = { enqueueEmail, enqueueOtpEmail, EMAIL_JOB };
