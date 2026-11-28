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

/* Store web address check — format, reserved, kisi store ya doosre pending signup ne to nahi liya?
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

// ✅ OTP config (sirf .env se — koi hardcoded fallback nahi)
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

// Decode a base64 data URL (image) → sharp → uploads/store-logos/<name>.webp
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

// ✅ Tokens / cookies / sessions — har audience (user | admin) ke alag secrets,
// cookies aur DB-backed rotating refresh sessions (utils/tokens.js)
const tokens = require("../utils/tokens");
const { findPlatformEmployee, sellerEmailTaken, SELLER_EMAIL_TAKEN_MESSAGE } = require("../utils/sellerOwnership");
const { verifyGoogleIdToken } = require("../utils/googleAuth");

// Frontend axios instance `X-Auth-Aud` bhejta hai — logout sirf usi session ka
const audFromHeader = (req) => {
  const hint = String(req.headers?.["x-auth-aud"] || "").trim().toLowerCase();
  return hint === "admin" || hint === "user" ? hint : null;
};
const audForUserType = (userType) => (userType === "employee" ? "admin" : "user");

// Password badla → is account ke baaki sab sessions band (current wala bacha rahe)
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
// Public — signup Step 1 ke liye: email / username / phone pehle se liye hue to hain nahi?
// Rules bilkul createUser wale hain (verified User, pending seller, PendingRegistration clashes)
// taake user ko aakhri step ke bajaye pehle step par hi pata chal jaye.

const getWishlist = async (req, res) => {
  try {
    const wishlistDoc = await Wishlist.findOne({ user_id: req.user._id }).populate({
      path: "products",
      match: { is_deleted: { $ne: true } },
      populate: [
        { path: "category_id", select: "name" },
        { path: "brand_id", select: "name" },
      ],
    });
    const products = (wishlistDoc?.products || []).filter(Boolean);
    // ✅ Variants + price attach (getProducts legacy item shape jaisa) —
    // storefront ko hydrate ke liye full catalog fetch ki zaroorat nahi
    let withVariants = products;
    if (products.length) {
      const Variant = require("../models/Variant");
      const variants = await Variant.find({
        product_id: { $in: products.map((p) => p._id) },
        is_deleted: { $ne: true },
      })
        .sort({ created_at: 1, _id: 1 })
        .lean();
      const variantsMap = {};
      variants.forEach((v) => {
        const pid = String(v.product_id);
        (variantsMap[pid] = variantsMap[pid] || []).push(v);
      });
      withVariants = products.map((p) => {
        const plain = typeof p.toObject === "function" ? p.toObject() : { ...p };
        const vs = variantsMap[String(plain._id)] || [];
        return {
          ...plain,
          variants: vs,
          price: Number(vs[0]?.selling_price) || 0,
        };
      });
    }
    res.json({ success: true, wishlist: withVariants });
  } catch (error) {
    log.error("getWishlist error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ✅ TOGGLE WISHLIST (add / remove)
// ==========================================

const toggleWishlist = async (req, res) => {
  try {
    const { product_id } = req.body;
    if (!product_id) {
      return res
        .status(400)
        .json({ success: false, message: "Product ID required" });
    }

    let wishlistDoc = await Wishlist.findOne({ user_id: req.user._id });
    if (!wishlistDoc) {
      wishlistDoc = await Wishlist.create({ user_id: req.user._id, products: [] });
    }

    const idx = wishlistDoc.products.findIndex(
      (id) => id.toString() === product_id.toString(),
    );
    let added;
    if (idx >= 0) {
      wishlistDoc.products.splice(idx, 1);
      added = false;
    } else {
      wishlistDoc.products.push(product_id);
      added = true;
    }
    await wishlistDoc.save();

    res.json({ success: true, added, count: wishlistDoc.products.length });
  } catch (error) {
    log.error("toggleWishlist error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// ==========================================
// CHECKOUT DRAFTS
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

module.exports = {
  getWishlist,
  toggleWishlist,
};
