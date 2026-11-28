// ==========================================================
// EMAIL JOBS (optimizeplan.md §6.3)
// ----------------------------------------------------------
//   await enqueueEmail({ to, subject, html, text }, { jobId? })
//   await enqueueOtpEmail({ to, otp, purpose, expiresInMinutes })
//   queueOtpEmail(...) — non-blocking OTP dispatch (no SMTP await)
// Queue me daal kar turant return (response SMTP handshake ka wait nahi karta).
// ==========================================================

const queue = require("./queue");
const log = require("../utils/logger");

const EMAIL_JOB = "email";

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

/**
 * Non-blocking OTP send (§6.3).
 * - SMTP configured → enqueue, return { queued:true, delivered:true } (accepted)
 * - Dev without SMTP → sync console fallback via sendOtpEmail, debugOtp available
 * - Prod without SMTP → { queued:false, delivered:false } (caller may 503)
 */
function queueOtpEmail({ to, otp, purpose = "email_verification", expiresInMinutes } = {}, opts = {}) {
  const { isSmtpConfigured, sendOtpEmail } = require("../utils/sendEmail");
  if (!to || !otp) return { queued: false, delivered: false };

  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV === "production") {
      return { queued: false, delivered: false, reason: "smtp_not_configured" };
    }
    // Dev: fast console path (no SMTP wait)
    void sendOtpEmail({ to, otp, purpose, expiresInMinutes }).catch(() => {});
    return { queued: false, delivered: false, debugOtp: String(otp), reason: "smtp_not_configured" };
  }

  const jobId = opts.jobId || `otp-${purpose}-${String(to).toLowerCase()}-${Date.now()}`;
  enqueueOtpEmail({ to, otp, purpose, expiresInMinutes }, { ...opts, jobId }).catch((err) => {
    log.error("[jobs/email] OTP enqueue failed:", err?.message || err);
  });
  return { queued: true, delivered: true };
}

module.exports = { enqueueEmail, enqueueOtpEmail, queueOtpEmail, EMAIL_JOB };
