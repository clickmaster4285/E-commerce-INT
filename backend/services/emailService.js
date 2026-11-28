const { sendEmail, isSmtpConfigured } = require("../utils/sendEmail");
const {
  escapeHtml: esc,
  platformName,
  supportEmail,
  hero,
  pill,
  details,
  buttons,
  steps,
  note,
  paragraph,
  link,
  renderEmail,
} = require("../utils/emailLayout");

// ==========================================
// 📧 SELLER APPLICATION EMAIL SERVICE
// ==========================================
// Design utils/emailLayout.js me hai (OTP email bhi wahi use karti hai).
// Delivery is attempted twice; failure never throws — the caller (apply /
// approve / reject) must not fail because an email could not be sent.
// Final failures are reported to the console.

const frontendBase = () => String(process.env.CLIENT_URL || "").replace(/\/+$/, "");
const hostOf = (url) => String(url || "").replace(/^https?:\/\//, "").replace(/\/+$/, "");
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";
const today = () => new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const SELLER_FOOTER = "You are receiving this email because you created a seller account.";

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
        return { delivered: false, reason: "send_failed", error: message };
      }
    }
  }
  return { delivered: false, reason: "unknown" };
};

// ------------------------------------------
// 1) Signup complete — pending approval
// adminUrl (optional): store ka base URL → seller view-only admin panel me jaa sakta hai
// ------------------------------------------
const sendApplicationReceivedEmail = async ({ name, email, storeName, adminUrl }) => {
  const actionUrl = adminUrl ? `${adminUrl}/admin/login` : frontendBase();
  const content = [
    hero({
      tone: "warning",
      symbol: "&#8987;",
      eyebrow: "Pending approval",
      title: `Your seller account has been created, ${firstName(name)}.`,
      introHtml: `Thank you for joining ${esc(platformName())}. We have received your request for <strong style="color:#0f172a;">${esc(storeName)}</strong> and our team is reviewing it now.`,
    }),
    details("Account summary", [
      ["Store", esc(storeName)],
      ["Account email", esc(email)],
      ["Submitted", esc(today())],
      ["Status", pill("Pending approval", "warning")],
    ]),
    steps("What happens next", [
      { title: "Account created", text: "Your email is verified and your store has been set up.", done: true },
      {
        title: "Review by our team",
        text: adminUrl
          ? "While you wait, you can explore your admin panel. It is view-only until approval."
          : "There is nothing else you need to do right now.",
      },
      { title: "Approval email", text: "As soon as you are approved, we will email you and your store goes live." },
    ]),
    buttons([{ url: actionUrl, label: adminUrl ? "Open your admin panel" : `Visit ${platformName()}` }]),
  ].join("");

  const text = `Hi ${name}, your seller account for ${storeName} has been created and is pending approval. ${
    adminUrl ? "While you wait, you can explore your admin panel (view-only until approval)." : "There is nothing else you need to do right now."
  } We will email you as soon as your account is approved. ${actionUrl}`;

  return sendWithRetry({
    to: email,
    subject: `Your seller account is pending approval — ${platformName()}`,
    html: renderEmail({ preheader: `We're reviewing ${storeName}. We'll email you as soon as it's approved.`, content, footerNote: SELLER_FOOTER }),
    text,
    action: "Seller application received",
    entityId: email,
  });
};

// ------------------------------------------
// 2) Approved — store live
// storeUrl ho to buttons seedha seller ke store par; warna platform admin login (handoff)
// ------------------------------------------
const sendApplicationApprovedEmail = async ({ name, email, storeName, storeUrl }) => {
  const adminUrl = storeUrl ? `${storeUrl}/admin/login` : `${frontendBase()}/admin/login`;
  const content = [
    hero({
      tone: "success",
      symbol: "&#10003;",
      eyebrow: "Approved",
      title: `Congratulations, ${firstName(name)}! Your store is live.`,
      introHtml: `Great news — your seller account for <strong style="color:#0f172a;">${esc(storeName)}</strong> has been approved. Your admin panel is now fully unlocked.`,
    }),
    details("Your store", [
      ["Store", esc(storeName)],
      ...(storeUrl ? [["Store address", link(storeUrl, hostOf(storeUrl))]] : []),
      ["Sign in with", esc(email)],
      ["Status", pill("Live", "success")],
    ]),
    buttons([
      { url: adminUrl, label: "Open your admin panel" },
      storeUrl ? { url: storeUrl, label: "Visit your storefront", variant: "secondary" } : null,
    ]),
    steps("Get ready to sell", [
      { title: "Add your products", text: "Upload photos, set prices and manage stock from your admin panel." },
      { title: "Customize your store", text: "Add your logo, banners and store details so buyers recognise you." },
      { title: "Start selling", text: "Share your store link and manage orders as they come in." },
    ]),
  ].join("");

  const text = `Hi ${name}, congratulations! Your seller account for ${storeName} has been approved and your store is live. Open your admin panel: ${adminUrl}${
    storeUrl ? ` — Visit your storefront: ${storeUrl}` : ""
  }`;

  return sendWithRetry({
    to: email,
    subject: `Congratulations! ${storeName} is approved and live`,
    html: renderEmail({ preheader: `${storeName} is live. Sign in to add your first products.`, content, footerNote: SELLER_FOOTER }),
    text,
    action: "Seller application approved",
    entityId: email,
  });
};

// ------------------------------------------
// 3) More information needed
// ------------------------------------------
const sendApplicationInfoRequestedEmail = async ({ name, email, storeName, message, setupToken }) => {
  // Signed link (utils/sellerSetupToken.js) — sirf email wala link koi bhi bana sakta tha
  const setupUrl = `${frontendBase()}/store-setup?token=${encodeURIComponent(setupToken || "")}`;
  const content = [
    hero({
      tone: "brand",
      symbol: "&#9998;",
      eyebrow: "Action needed",
      title: `We need a bit more information, ${firstName(name)}.`,
      introHtml: `Our team reviewed your request for <strong style="color:#0f172a;">${esc(storeName)}</strong> and needs a few more details before we can approve it.`,
    }),
    note("Message from our review team", esc(message), "brand"),
    paragraph("Update your store details and upload any documents we asked for. Your request stays pending until you submit, then it goes straight back to our review queue."),
    buttons([{ url: setupUrl, label: "Update your details" }]),
  ].join("");

  const text = `Hi ${name}, our team reviewed your request for ${storeName} and needs more information: ${message}\n\nUpdate your details: ${setupUrl}`;

  return sendWithRetry({
    to: email,
    subject: `Action needed: more information for ${storeName}`,
    html: renderEmail({ preheader: `Our team needs a few more details to approve ${storeName}.`, content, footerNote: SELLER_FOOTER }),
    text,
    action: "Seller info requested",
    entityId: email,
  });
};

// ------------------------------------------
// 4) Rejected
// (Reapply ka self-service flow abhi nahi — same email dobara signup block hai,
//  is liye support se rabta ka button.)
// ------------------------------------------
const sendApplicationRejectedEmail = async ({ name, email, storeName, reason }) => {
  const cleanReason = reason && String(reason).trim() ? String(reason).trim() : "No reason was provided.";
  const content = [
    hero({
      tone: "danger",
      symbol: "&#10005;",
      eyebrow: "Not approved",
      title: "An update on your seller request",
      introHtml: `Thank you for your interest in selling on ${esc(platformName())}, ${esc(firstName(name))}. After careful review, we are unable to approve <strong style="color:#0f172a;">${esc(storeName)}</strong> at this time.`,
    }),
    note("Reason", esc(cleanReason), "danger"),
    paragraph("If you have addressed the points above, or believe this was a mistake, reply to this email or contact our team. We'll be happy to take another look."),
    buttons([{ url: `mailto:${supportEmail()}?subject=${encodeURIComponent(`Seller request: ${storeName}`)}`, label: "Contact support" }]),
  ].join("");

  const text = `Hi ${name}, we're sorry — your seller request for ${storeName} was not approved. Reason: ${cleanReason} If you have addressed this or believe it was a mistake, contact us at ${supportEmail()}.`;

  return sendWithRetry({
    to: email,
    subject: `Update on your seller request — ${platformName()}`,
    html: renderEmail({ preheader: `An update on your seller request for ${storeName}.`, content, footerNote: SELLER_FOOTER }),
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
};
