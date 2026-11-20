const fs = require("fs");
const path = require("path");
const { sendEmail, isSmtpConfigured } = require("../utils/sendEmail");
const { logActivity } = require("../utils/superAdminActivity");

// ==========================================
// 📧 SELLER APPLICATION EMAIL SERVICE
// ==========================================
// Templates live in backend/templates/emails/.
// Delivery is attempted twice; failure never throws — the caller (apply /
// approve / reject) must not fail because an email could not be sent.
// Final failures are logged via logActivity() for audit.

const readTemplate = (name) =>
  fs.readFileSync(path.join(__dirname, "..", "templates", "emails", name), "utf8");

const BASE_LAYOUT = readTemplate("baseLayout.html");
const PENDING_BODY = readTemplate("sellerPending.html");
const APPROVED_BODY = readTemplate("sellerApproved.html");
const REJECTED_BODY = readTemplate("sellerRejected.html");
const INFO_REQUEST_BODY = readTemplate("sellerInfoRequest.html");

const escapeHtml = (value) =>
  String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[ch]);

const fillTemplate = (tpl, vars) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : ""));

const frontendBase = () => String(process.env.CLIENT_URL || "").replace(/\/+$/, "");

const baseVars = (extra = {}) => ({
  YEAR: new Date().getFullYear(),
  STORE_NAME: escapeHtml(process.env.PLATFORM_NAME || "Click Master Store"),
  SUPPORT_EMAIL: escapeHtml(process.env.PLATFORM_SUPPORT_EMAIL || "hello@clickmasterstore.pk"),
  ...extra,
});

const render = (body, vars) =>
  fillTemplate(BASE_LAYOUT, baseVars({ CONTENT: fillTemplate(body, vars) }));

const sendWithRetry = async ({ to, subject, html, text, action, entityId }) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const result = await sendEmail({ to, subject, html, text });
      if (result?.delivered) return result;
      console.error(`[emailService] ${action} → ${to}: not delivered (${result?.reason || "unknown"})`);
      return { delivered: false, reason: result?.reason || "unknown" };
    } catch (error) {
      const message = error?.message || String(error);
      console.error(`[emailService] ${action} → ${to} attempt ${attempt + 1} failed:`, message);
      if (attempt === 1) {
        await logActivity({
          action: `${action} email delivery failed`,
          entityType: "seller_application",
          entityId: String(entityId || ""),
          details: { to, error: message },
        }).catch(() => {});
        return { delivered: false, reason: "send_failed", error: message };
      }
    }
  }
  return { delivered: false, reason: "unknown" };
};

const sendApplicationReceivedEmail = async ({ name, email, storeName }) => {
  const vars = baseVars({
    NAME: escapeHtml(name),
    STORENAME: escapeHtml(storeName),
    EMAIL: escapeHtml(email),
    STATUS_URL: escapeHtml(`${frontendBase()}/seller/status`),
  });
  const html = render(PENDING_BODY, vars);
  const text = `Hi ${name}, we've received your seller application for ${storeName}. Our team will review it and email you once a decision is made. Status: ${frontendBase()}/seller/status`;
  return sendWithRetry({
    to: email,
    subject: `Your seller application is under review — ${process.env.PLATFORM_NAME || "Click Master Store"}`,
    html,
    text,
    action: "Seller application received",
    entityId: email,
  });
};

const sendApplicationApprovedEmail = async ({ name, email, storeName }) => {
  const vars = baseVars({
    NAME: escapeHtml(name),
    STORENAME: escapeHtml(storeName),
    EMAIL: escapeHtml(email),
    DASHBOARD_URL: escapeHtml(`${frontendBase()}/seller/dashboard`),
  });
  const html = render(APPROVED_BODY, vars);
  const text = `Hi ${name}, congratulations! Your seller application for ${storeName} has been approved. Sign in at ${frontendBase()} and open your seller dashboard: ${frontendBase()}/seller/dashboard`;
  return sendWithRetry({
    to: email,
    subject: `Congratulations! Your seller account has been approved`,
    html,
    text,
    action: "Seller application approved",
    entityId: email,
  });
};

const sendApplicationInfoRequestedEmail = async ({ name, email, storeName, message, setupToken }) => {
  // Signed link (utils/sellerSetupToken.js) — sirf email wala link koi bhi bana sakta tha
  const setupUrl = `${frontendBase()}/store-setup?token=${encodeURIComponent(setupToken || "")}`;
  const vars = baseVars({
    NAME: escapeHtml(name),
    STORENAME: escapeHtml(storeName),
    EMAIL: escapeHtml(email),
    MESSAGE: escapeHtml(message),
    SETUP_URL: escapeHtml(setupUrl),
  });
  const html = render(INFO_REQUEST_BODY, vars);
  const text = `Hi ${name}, our team reviewed your application for ${storeName} and needs more information: ${message}\n\nUpdate your application: ${setupUrl}`;
  return sendWithRetry({
    to: email,
    subject: `We need more information — your seller application for ${storeName}`,
    html,
    text,
    action: "Seller info requested",
    entityId: email,
  });
};

const sendApplicationRejectedEmail = async ({ name, email, storeName, reason }) => {
  const vars = baseVars({
    NAME: escapeHtml(name),
    STORENAME: escapeHtml(storeName),
    EMAIL: escapeHtml(email),
    REASON: escapeHtml(reason && String(reason).trim() ? reason : "No reason was provided."),
    APPLY_URL: escapeHtml(`${frontendBase()}/seller/apply`),
  });
  const html = render(REJECTED_BODY, vars);
  const text = `Hi ${name}, we're sorry — your seller application for ${storeName} was not approved. Reason: ${reason || "Not provided"}. You may reapply at ${frontendBase()}/seller/apply`;
  return sendWithRetry({
    to: email,
    subject: `Update regarding your seller application — ${process.env.PLATFORM_NAME || "Click Master Store"}`,
    html,
    text,
    action: "Seller application rejected",
    entityId: email,
  });
};

module.exports = {
  sendApplicationReceivedEmail,
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
  sendApplicationInfoRequestedEmail,
  templatesAvailable: true,
  smtpConfigured: () => isSmtpConfigured(),
};
