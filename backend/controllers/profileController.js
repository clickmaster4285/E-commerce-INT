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

const getProfile = async (req, res) => {
  try {
    const userType = req.userType || 'user';
    // authMiddleware already loaded the employee account, so reuse it during
    // admin access verification instead of querying it and its store again.
    const entity = userType === 'employee'
      ? req.user
      : await User.findById(req.user._id)
        .select("-password -activities")
        .populate("storeId");
    if (!entity)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    res.json({ success: true, user: entity });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const userType = req.userType || 'user';
    let entity = null;
    if (userType === 'employee') {
      entity = await Employee.findById(req.user._id)
        .select("-password -activities")
        .populate("storeId");
    } else {
      entity = await User.findById(req.user._id)
        .select("-password -activities")
        .populate("storeId");
    }
    if (!entity)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    // ✅ Employee ka storeId null ho to default store fallback
    let storeDoc = entity.storeId || null;
    if (!storeDoc || !storeDoc.store_name) {
      try {
        storeDoc = storeDoc?._id
          ? await Store.findById(storeDoc._id).lean()
          : await Store.findOne().lean();
      } catch (e) { /* ignore, fallback below */ }
      if (!storeDoc) storeDoc = entity.storeId || {};
    }
     res.json({
       success: true,
       user: {
         _id: entity._id,
         name: entity.name,
         username: entity.username,
         email: entity.email,
         phone: entity.phone || "",
         role: entity.role,
         status: entity.is_deleted ? "Inactive" : "Active",
         seller_pending: !!entity.seller_pending,
         avatar: entity.avatar || null,
        permissions: entity.permissions || {
          dashboard: true, products: true, brands: true, categories: true,
          employees: true, discounts: true, deals: true, banners: true,
          manageStock: true, shipping: true, order: true, attribute: true,
          profile: true, store: true, bundles: true
        },
        preferences: entity.preferences || {
          darkMode: true, notifications: { email: true, push: true, weekly: true },
        },
        store: storeDoc || {},
      },
    });
  } catch (error) {
    log.error("getMe error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const {
      name,
      username,
      email,
      phone,
      dob,
      store,
      permissions,
      preferences,
    } = req.body;
    const userId = req.user._id;
    const userType = req.userType || 'user';
    const Model = userType === 'employee' ? Employee : User;

    // ✅ Sirf jo fields actually aayi hain unhi ko update karo
    // (pehle name/username bhejne par username silently drop ho jata tha
    //  kyunki updateProfileREST route kabhi match hi nahi hota tha)
    // ⚠️ role/status/permissions yahan JAANBOOZH kar update nahi kiye —
    // privilege escalation hoti (koi apni permission khud nahi badha sakta;
    // permissions sirf dusra authorized staff updateEmployee se change kar sakta hai)
    const update = { updatedby: userId };
    if (name !== undefined) update.name = name;
    if (username !== undefined) update.username = username;
    if (email !== undefined) update.email = String(email).toLowerCase().trim();
    if (phone !== undefined) update.phone = phone;
    if (dob !== undefined) update.dob = dob;
    if (preferences !== undefined) update.preferences = preferences;

    await Model.findByIdAndUpdate(userId, update);
    // ✅ Store fields sirf 'store' permission par (admin bypass)
    const canEditStoreHere =
      isAdminRole(req.user?.role) ||
      !!req.user?.permissions?.store;
    if (store && req.user.storeId && canEditStoreHere) {
      await Store.findByIdAndUpdate(req.user.storeId, {
        store_name: store.name,
        email: store.email,
        phone: store.phone,
        support_email: store.email,
        support_phone: store.phone,
        address: store.address,
      });
    }
    res.json({ success: true, message: "✅ Profile & Store saved!" });
  } catch (error) {
    log.error("updateProfile error:", error);
    // ✅ Duplicate email/username par friendly 400 message (500 ki jagah)
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      return res
        .status(400)
        .json({ success: false, message: `This ${field} is already in use` });
    }
    res
      .status(500)
      .json({ success: false, message: "Save failed: " + error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const Model = req.userType === "employee" ? Employee : User;
    const user = await Model.findById(req.user._id);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid)
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect" });
    user.password = await bcrypt.hash(newPassword, 10);
    user.updatedby = req.user._id;
    await user.save();
    await revokeOtherSessions(req, req.userType, user._id);
    const io = req.io || getIO();
    await pushGlobalActivity(
      io,
      {
        action: `${user.name} changed password`,
        category: "Authentication",
        performedBy: user._id,
        performedByName: user.name,
      },
      user._id,
    );
    res.json({ success: true, message: "✅ Password changed successfully!" });
  } catch (error) {
    log.error("changePassword error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getProfileInfo = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId || userId === "guest")
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const userType = req.userType || 'user';
    const Model = userType === 'employee' ? Employee : User;
    const user = await Model.findById(userId)
      .select("-password -activities")
      .populate("storeId");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    // ✅ Employee ka storeId null ho to default store fallback
    // taake employee login par store name / address blank na ho
    let store = user.storeId && user.storeId.store_name ? user.storeId : null;
    if (!store) {
      try {
        store = user.storeId?._id
          ? await Store.findById(user.storeId._id).lean()
          : await Store.findOne().lean();
      } catch (e) { /* ignore */ }
      if (!store) store = user.storeId || {};
    }
    const profileData = {
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email || store.email || "",
      phone: user.phone || store.phone || "",
      role: user.role,
      status: user.status || (user.is_deleted ? "Inactive" : "Active"),
      avatar: user.avatar || null,
      created_at: user.created_at,
      website: user.website || store.website || "",
      address: user.address || store.address || "",
      permissions: user.permissions || {
        dashboard: true, products: true, brands: true, categories: true,
        employees: true, discounts: true, deals: true, banners: true,
        manageStock: true, shipping: true, order: true, attribute: true,
        profile: true, store: true, bundles: true
      },
      preferences: user.preferences || {
        darkMode: true,
        notifications: { email: true, push: true, weekly: true },
      },
      store,
      store_name: store.store_name || "",
      stats: {
        logins: user.loginCount || 0,
        roles: 1,
        sessions: user.sessionCount || 0,
      },
    };
    return res.json({ success: true, data: profileData, user: profileData });
  } catch (error) {
    log.error("❌ Get Profile Info Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateProfileInfo = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId || userId === "guest")
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const userType = req.userType || 'user';
    const Model = userType === 'employee' ? Employee : User;
    const {
      name, email, phone, website, address,
      store_name, tagline, currency, country, city, state, zip_code, store_status
    } = req.body;
    if (phone !== undefined && String(phone).trim()) {
      const phoneValue = String(phone);
      if (!isValidPhone(phoneValue)) {
        const message = !/^\d+$/.test(phoneValue)
          ? "Phone number must contain digits only"
          : phoneValue.length < 10
            ? "Phone number must be at least 10 digits"
            : "Phone number must be at most 16 digits";
        return res.status(400).json({ success: false, message });
      }
    }
    // ✅ Store fields sirf tab jab 'store' permission ho (admin bypass).
    // Socket path par req.user.permissions stale ho sakte hain — fresh load karo.
    let requesterRole = req.user?.role || "";
    let requesterStorePerm = req.user?.permissions?.store;
    if (!isAdminRole(requesterRole) && requesterStorePerm === undefined) {
      try {
        const reqDoc = await Model.findById(userId).select("role permissions").lean();
        if (reqDoc) {
          requesterRole = reqDoc.role || requesterRole;
          requesterStorePerm = reqDoc.permissions?.store;
        }
      } catch (e) { /* ignore — neeche deny hoga */ }
    }
    const canEditStore =
      isAdminRole(requesterRole) || !!requesterStorePerm;
    const userUpdateFields = {};
    if (name !== undefined) userUpdateFields.name = name;
    if (email !== undefined)
      userUpdateFields.email = email.toLowerCase().trim();
    if (phone !== undefined) userUpdateFields.phone = phone ? normalizePhone(phone) : phone;
    if (website !== undefined) userUpdateFields.website = website;
    if (address !== undefined) userUpdateFields.address = address;
    userUpdateFields.updatedby = userId;
    const updatedUser = await Model.findByIdAndUpdate(userId, userUpdateFields, {
      returnDocument: "after",
      runValidators: true,
    })
      .select("-password")
      .populate("storeId");
    if (!updatedUser)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    let updatedStore = null;
    let storeSkipped = false;
    const storeUpdateFields = {};
    if (store_name !== undefined) storeUpdateFields.store_name = store_name;
    if (tagline !== undefined) storeUpdateFields.tagline = tagline;
    if (currency !== undefined) storeUpdateFields.currency = currency;
    if (country !== undefined) storeUpdateFields.country = country;
    if (city !== undefined) storeUpdateFields.city = city;
    if (state !== undefined) storeUpdateFields.state = state;
    if (zip_code !== undefined) storeUpdateFields.zip_code = zip_code;
    if (store_status !== undefined)
      storeUpdateFields.store_status = store_status;
    if (email !== undefined) storeUpdateFields.email = email;
    if (phone !== undefined) storeUpdateFields.phone = phone ? normalizePhone(phone) : phone;
    if (address !== undefined) storeUpdateFields.address = address;
    if (website !== undefined) storeUpdateFields.website = website;
    if (Object.keys(storeUpdateFields).length > 0 && !canEditStore) {
      // ✅ 'store' permission nahi — personal fields save hongi, store untouched rahega
      storeSkipped = true;
    }
    if (Object.keys(storeUpdateFields).length > 0 && canEditStore) {
      let store = updatedUser.storeId
        ? await Store.findById(updatedUser.storeId)
        : null;
      if (!store) store = await Store.findOne();
      // Blank store khud se nahi banta (multi-tenant)
      if (store) {
        Object.assign(store, storeUpdateFields);
        updatedStore = await store.save();
      }
      
      if (!updatedUser.storeId && updatedStore) {
        updatedUser.storeId = updatedStore._id;
        await updatedUser.save();
      }
      await updatedUser.populate("storeId");
    }
    return res.json({
      success: true,
      message: storeSkipped
        ? "Profile updated successfully (store changes skipped — no 'store' permission)"
        : "Profile updated successfully",
      store: updatedStore || updatedUser.storeId || null,
      storeUpdated: !!updatedStore,
      storeSkipped,
    });
  } catch (error) {
    log.error("❌ Update Profile Info Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const changePasswordSocket = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId || userId === "guest")
      return res.status(401).json({ success: false, message: "Unauthorized" });
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res
        .status(400)
        .json({ success: false, message: "All password fields are required" });
    const Model = req.userType === "employee" ? Employee : User;
    const user = await Model.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid)
      return res
        .status(400)
        .json({ success: false, message: "Current password is incorrect" });
    user.password = await bcrypt.hash(newPassword, 10);
    user.updatedby = userId;
    await user.save();
    await revokeOtherSessions(req, req.userType, user._id);
    return res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    log.error("❌ Change Password Socket Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ADMIN / STAFF GOOGLE LOGIN
// ------------------------------------------
// Pehle token ka payload bina signature check decode hota tha (koi bhi email
// likh kar bhej sakta tha) aur customer (User) collection me dhoonda jata tha.
// Ab: Google se verify (utils/googleAuth.js) → isi store ka Employee
// (platform par sirf seller owner) → loginAdmin jaisi checks → admin session.
// Naya account kabhi nahi banta.
// ==========================================

const updateProfileREST = async (req, res) => {
  try {
    const { name, username } = req.body;
    const update = {};
    if (name) update.name = name;
    if (username) update.username = username;
    const Model = req.userType === "employee" ? Employee : User;
    const user = await Model.findByIdAndUpdate(req.user._id, update, { returnDocument: "after" }).select("-password");
    res.json({ success: true, user });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

const changePasswordREST = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const Model = req.userType === "employee" ? Employee : User;
    const user = await Model.findById(req.user._id);
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ success: false, message: "Current password is incorrect" });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
    await revokeOtherSessions(req, req.userType, user._id);
    res.json({ success: true, message: "Password changed successfully" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
// ==========================================
// 🔀 STORE ADMIN HANDOFF (platform → store subdomain)
// ------------------------------------------
// Cookies host-only hain: platform (192.168.88.35.nip.io) par login/signup
// ke baad seller store subdomain (alistore.192.168.88.35.nip.io) par logged-in
// nahi hota. Platform par ek 2-minute, ek-baar wala token banta hai; store
// subdomain ka /admin/handoff page usay exchange karke wahan cookies set karta hai.
// ==========================================
const { storeAdminBaseUrl } = require("../utils/storeUrl");

const { claimOnce } = require("../utils/oneTimeToken");

const HANDOFF_TTL_SECONDS = 120;

// @route POST /api/users/admin/handoff   (logged-in employee, platform host)

module.exports = {
  getProfile,
  getMe,
  updateProfile,
  changePassword,
  getProfileInfo,
  updateProfileInfo,
  changePasswordSocket,
  updateProfileREST,
  changePasswordREST,
};
