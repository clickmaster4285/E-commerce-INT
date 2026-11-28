const loyalty = require("../utils/loyaltyService");
const crypto = require("crypto");
const { OWNER_ROLE, ADMIN_ROLES, STAFF_ROLES, ASSIGNABLE_ROLES, isOwnerRole, isAdminRole, isStaffRole } = require("../utils/roles");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const PendingRegistration = require("../models/PendingRegistration");
const Wishlist = require("../models/Wishlist");
const CheckoutDraft = require("../models/CheckoutDraft");
const Product = require("../models/Product");
const Order = require("../models/Order");
const Employee = require("../models/Employee");
const SellerApplication = require("../models/SellerApplication");
const Store = require("../models/Store");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity, getChanges } = require("../utils/activityHelper");
const { sendOtpEmail } = require("../utils/sendEmail");
const log = require("../utils/logger");
const { normalizePhone, isValidPhone } = require("../utils/phoneValidator");
const { suggestUsernames, uniqueUsername } = require("../utils/username");
const { validateStoreAddress, slugifySubdomain } = require("../utils/tenantHost");

/* Store web address check â€” format, reserved, kisi store ya doosre pending signup ne to nahi liya?
   @returns {{ error: string|null, suggestion: string }} */
const checkStoreSubdomain = async (raw, email) => {
  const sub = String(raw || "").trim().toLowerCase();
  const formatError = validateStoreAddress(sub);
  if (formatError) return { error: formatError, suggestion: "" };
  const taken =
    (await Store.exists({ subdomain: sub }).setOptions({ skipTenantScope: true })) ||
    (await PendingRegistration.exists({ subdomain: sub, email: { $ne: email || "" }, expiresAt: { $gt: new Date() } }));
  if (!taken) return { error: null, suggestion: "" };
  return { error: "This store address is already taken.", suggestion: await Store.generateUniqueSubdomain(sub) };
};

// âœ… OTP config (sirf .env se â€” koi hardcoded fallback nahi)
const REGISTER_OTP_EXPIRE_MINUTES = Number(process.env.EMAIL_OTP_EXPIRE_MINUTES);
const REGISTER_OTP_RESEND_SECONDS = Number(process.env.EMAIL_OTP_RESEND_SECONDS);
const SMTP_RETRY_SECONDS = 10;

const allowSignupOtpRetry = async (email) => {
  const cooldown = Number.isFinite(REGISTER_OTP_RESEND_SECONDS) && REGISTER_OTP_RESEND_SECONDS > 0
    ? REGISTER_OTP_RESEND_SECONDS
    : 60;
  const retryAfter = Math.min(SMTP_RETRY_SECONDS, cooldown);
  await PendingRegistration.updateOne(
    { email },
    { $set: { lastSentAt: new Date(Date.now() - Math.max(0, cooldown - retryAfter) * 1000) } },
  );
  return retryAfter;
};

const normalizeEmail = (email) => String(email || "").toLowerCase().trim();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const generateOtpCode = () => String(crypto.randomInt(0, 10 ** 6)).padStart(6, "0");

// Decode a base64 data URL (image) â†’ sharp â†’ uploads/store-logos/<name>.webp
const STORE_LOGO_DIR = path.join(__dirname, "..", "uploads", "store-logos");
const saveStoreLogoFromBase64 = async (raw) => {
  const match = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(String(raw || "").trim());
  if (!match) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > 4 * 1024 * 1024) return null;
  if (!fs.existsSync(STORE_LOGO_DIR)) fs.mkdirSync(STORE_LOGO_DIR, { recursive: true });
  const fileName = `logo-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`;
  await sharp(buffer, { limitInputPixels: 20_000_000 })
    .rotate()
    .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86 })
    .toFile(path.join(STORE_LOGO_DIR, fileName));
  return `/uploads/store-logos/${fileName}`;
};

// âœ… Tokens / cookies / sessions â€” har audience (user | admin) ke alag secrets,
// cookies aur DB-backed rotating refresh sessions (utils/tokens.js)
const tokens = require("../utils/tokens");
const { findPlatformEmployee, sellerEmailTaken, SELLER_EMAIL_TAKEN_MESSAGE } = require("../utils/sellerOwnership");
const { verifyGoogleIdToken } = require("../utils/googleAuth");

// Frontend axios instance `X-Auth-Aud` bhejta hai â€” logout sirf usi session ka
const audFromHeader = (req) => {
  const hint = String(req.headers?.["x-auth-aud"] || "").trim().toLowerCase();
  return hint === "admin" || hint === "user" ? hint : null;
};
const audForUserType = (userType) => (userType === "employee" ? "admin" : "user");

// Password badla â†’ is account ke baaki sab sessions band (current wala bacha rahe)
const revokeOtherSessions = (req, userType, subjectId) =>
  tokens
    .revokeAllForSubject(audForUserType(userType), subjectId, { exceptFamilyId: req.sessionId || null })
    .catch((e) => log.error("revoke sessions failed:", e.message));

// ==========================================
// REGISTER (Customer only)
// ==========================================
// ==========================================
// REGISTER (Customer only)
// ==========================================
// Public â€” signup Step 1 ke liye: email / username / phone pehle se liye hue to hain nahi?
// Rules bilkul createUser wale hain (verified User, pending seller, PendingRegistration clashes)
// taake user ko aakhri step ke bajaye pehle step par hi pata chal jaye.

// ==========================================
const CHECKOUT_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const checkoutDraftProductId = (item) => {
  const raw = item?.productId || item?.product_id || item?.id || item?._id ||
    String(item?.key || "").split("__")[0];
  const value = raw && typeof raw === "object" ? raw._id || raw.id : raw;
  return mongoose.isValidObjectId(value) ? String(value) : null;
};

const checkoutDraftProductIds = (draft) => {
  const ids = new Set();
  for (const item of Array.isArray(draft?.items) ? draft.items : []) {
    const id = checkoutDraftProductId(item);
    if (id) ids.add(id);
  }
  for (const key of Array.isArray(draft?.selectedKeys) ? draft.selectedKeys : []) {
    const id = checkoutDraftProductId({ key });
    if (id) ids.add(id);
  }
  return [...ids];
};

const finiteDraftAmount = (value, fallback = 0) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : fallback;
};

const hasAvailableDraftProducts = async (draft) => {
  const ids = checkoutDraftProductIds(draft);
  if (!ids.length) return false;
  const available = await Product.find({
    _id: { $in: ids },
    is_deleted: { $ne: true },
  }).select("_id").lean();
  return available.length === ids.length;
};

const createCheckoutDraft = async (req, res) => {
  try {
    const {
      step, selectedKeys, selectedAddressId, shippingMethod, paymentMethod, items,
      subtotal, shipping, tax, discount, estimatedTotal,
    } = req.body;
    const now = new Date();
    const newDraft = {
      step: step ?? 1,
      selectedKeys: Array.isArray(selectedKeys) ? selectedKeys : [],
      selectedAddressId: selectedAddressId || null,
      shippingMethod: shippingMethod || "standard",
      paymentMethod: paymentMethod || "cod",
      saved: false,
      status: "active",
      items: Array.isArray(items) ? items : [],
      subtotal: finiteDraftAmount(subtotal),
      shipping: finiteDraftAmount(shipping),
      tax: finiteDraftAmount(tax),
      discount: finiteDraftAmount(discount),
      estimatedTotal: finiteDraftAmount(estimatedTotal),
      order_id: null,
      updatedAt: now,
    };

    // Upsert the user's single draft container, then replace the most recently
    // active draft instead of appending another subdocument on each checkout.
    const checkoutDoc = await CheckoutDraft.findOneAndUpdate(
      { user_id: req.user._id },
      { $setOnInsert: { user_id: req.user._id } },
      { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
    );
    const cutoff = new Date(now.getTime() - CHECKOUT_DRAFT_MAX_AGE_MS);
    const completedDrafts = checkoutDoc.drafts.filter((draft) => draft.status === "completed");
    const activeDraft = checkoutDoc.drafts
      .filter((draft) => draft.status !== "completed")
      .filter((draft) => new Date(draft.updatedAt || 0) >= cutoff)
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))[0];

    if (activeDraft) {
      Object.assign(activeDraft, newDraft, { _id: activeDraft._id });
    }
    checkoutDoc.drafts = [
      ...completedDrafts.map((draft) => draft.toObject()),
      activeDraft ? activeDraft.toObject() : newDraft,
    ];
    await checkoutDoc.save();

    const savedDraft = checkoutDoc.drafts.find((draft) => draft.status === "active") || checkoutDoc.drafts.at(-1);
    res.status(activeDraft ? 200 : 201).json({ success: true, draft: savedDraft });
  } catch (error) {
    log.error("createCheckoutDraft error:", error);
    res.status(500).json({ success: false, message: error.message || "Checkout draft could not be saved" });
  }
};

const getCheckoutDrafts = async (req, res) => {
  try {
    const checkoutDoc = await CheckoutDraft.findOne({ user_id: req.user._id });
    if (!checkoutDoc) return res.json({ success: true, drafts: [] });

    const cutoff = new Date(Date.now() - CHECKOUT_DRAFT_MAX_AGE_MS);
    const completedDrafts = [];
    const activeCandidates = [];
    let changed = false;

    for (const draft of checkoutDoc.drafts || []) {
      if (draft.status === "completed") {
        completedDrafts.push(draft);
        continue;
      }
      const updatedAt = new Date(draft.updatedAt || checkoutDoc.updated_at || 0);
      if (updatedAt < cutoff) {
        changed = true;
        continue;
      }
      if (draft.status !== "active") {
        draft.status = "active"; // legacy drafts had no lifecycle field
        changed = true;
      }
      activeCandidates.push(draft);
    }

    const linkedOrders = activeCandidates.length
      ? await Order.find({
          user_id: req.user._id,
          checkout_draft_id: { $in: activeCandidates.map((draft) => draft._id) },
        }).select("_id checkout_draft_id").lean()
      : [];
    const orderByDraftId = new Map(linkedOrders.map((order) => [String(order.checkout_draft_id), order]));
    const uncompleted = [];
    for (const draft of activeCandidates) {
      const order = orderByDraftId.get(String(draft._id));
      if (order) {
        draft.status = "completed";
        draft.order_id = order._id;
        completedDrafts.push(draft);
        changed = true;
      } else {
        uncompleted.push(draft);
      }
    }

    const productIds = [...new Set(uncompleted.flatMap(checkoutDraftProductIds))];
    const existingProducts = productIds.length
      ? await Product.find({ _id: { $in: productIds }, is_deleted: { $ne: true } }).select("_id").lean()
      : [];
    const availableProductIds = new Set(existingProducts.map((product) => String(product._id)));
    const availableDrafts = [];
    for (const draft of uncompleted) {
      if (hasAvailableDraftProductsFromSet(draft, availableProductIds)) {
        availableDrafts.push(draft);
      } else {
        changed = true;
      }
    }

    availableDrafts.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    if (availableDrafts.length > 1) changed = true;
    const activeDrafts = availableDrafts.slice(0, 1);
    checkoutDoc.drafts = [
      ...completedDrafts,
      ...activeDrafts,
    ];
    if (changed) await checkoutDoc.save();

    res.json({ success: true, drafts: activeDrafts });
  } catch (error) {
    log.error("getCheckoutDrafts error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const hasAvailableDraftProductsFromSet = (draft, availableProductIds) => {
  const ids = checkoutDraftProductIds(draft);
  return ids.length > 0 && ids.every((id) => availableProductIds.has(id));
};

const getCheckoutDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const checkoutDoc = await CheckoutDraft.findOne({ user_id: req.user._id });
    const draft = checkoutDoc?.drafts.find((entry) => String(entry._id) === id);
    if (!draft || draft.status === "completed") {
      return res.status(404).json({ success: false, message: "Draft not found" });
    }

    const cutoff = new Date(Date.now() - CHECKOUT_DRAFT_MAX_AGE_MS);
    if (new Date(draft.updatedAt || checkoutDoc.updated_at || 0) < cutoff) {
      checkoutDoc.drafts = checkoutDoc.drafts.filter((entry) => String(entry._id) !== id);
      await checkoutDoc.save();
      return res.status(404).json({ success: false, message: "This checkout draft has expired" });
    }

    const linkedOrder = await Order.findOne({ user_id: req.user._id, checkout_draft_id: draft._id }).select("_id").lean();
    if (linkedOrder || !(await hasAvailableDraftProducts(draft))) {
      checkoutDoc.drafts = checkoutDoc.drafts.filter((entry) => String(entry._id) !== id);
      await checkoutDoc.save();
      return res.status(404).json({
        success: false,
        message: linkedOrder ? "This draft has already been ordered" : "A product in this draft is no longer available",
      });
    }

    res.json({ success: true, draft });
  } catch (error) {
    log.error("getCheckoutDraft error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateCheckoutDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      step, selectedKeys, selectedAddressId, shippingMethod, paymentMethod, saved, items,
      subtotal, shipping, tax, discount, estimatedTotal,
    } = req.body;
    const checkoutDoc = await CheckoutDraft.findOne({ user_id: req.user._id });
    const draft = checkoutDoc?.drafts.find((entry) => String(entry._id) === id);
    if (!draft || draft.status === "completed") {
      return res.status(404).json({ success: false, message: "Active checkout draft not found" });
    }

    draft.step = step ?? draft.step;
    draft.selectedKeys = Array.isArray(selectedKeys) ? selectedKeys : draft.selectedKeys;
    draft.selectedAddressId = selectedAddressId !== undefined ? selectedAddressId : draft.selectedAddressId;
    draft.shippingMethod = shippingMethod || draft.shippingMethod;
    draft.paymentMethod = paymentMethod || draft.paymentMethod;
    draft.saved = saved !== undefined ? saved : draft.saved;
    draft.items = Array.isArray(items) ? items : draft.items;
    for (const [field, value] of Object.entries({ subtotal, shipping, tax, discount, estimatedTotal })) {
      if (value !== undefined && Number.isFinite(Number(value))) draft[field] = Number(value);
    }
    draft.updatedAt = new Date();
    await checkoutDoc.save();

    res.json({ success: true, draft });
  } catch (error) {
    log.error("updateCheckoutDraft error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteCheckoutDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const checkoutDoc = await CheckoutDraft.findOne({ user_id: req.user._id });
    if (!checkoutDoc) return res.status(404).json({ success: false, message: "Checkout drafts not found" });

    checkoutDoc.drafts = checkoutDoc.drafts.filter((draft) => String(draft._id) !== id);
    await checkoutDoc.save();
    res.json({ success: true, message: "Draft deleted" });
  } catch (error) {
    log.error("deleteCheckoutDraft error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createCheckoutDraft,
  getCheckoutDrafts,
  getCheckoutDraft,
  updateCheckoutDraft,
  deleteCheckoutDraft,
};


