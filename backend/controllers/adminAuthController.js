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

const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Please provide email and password" });
    // Store host: isi store ka staff (tenant-scoped, email per-store unique).
    // Platform host: koi store nahi → sirf seller OWNER (Option A: ek email ek store).
    let employee;
    if (req.store) {
      employee = await Employee.findOne({ email: String(email).toLowerCase().trim() }).select("-activities");
    } else {
      const found = await findPlatformEmployee(email);
      if (found.ambiguous) {
        return res.status(409).json({
          success: false,
          message: "This email is linked to more than one store. Please sign in from your store's address.",
        });
      }
      employee = found.employee;
    }
    if (!employee)
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    if (!employee.password)
      return res
        .status(401)
        .json({ success: false, message: "Password incorrect" });
    if (!isStaffRole(employee.role))
      return res
        .status(403)
        .json({
          success: false,
          message: "Admin access denied. Please use customer login page.",
        });
    if (employee.status === "inactive" || employee.is_deleted)
      return res
        .status(403)
        .json({
          success: false,
          message: "Your account is inactive. Please contact administrator.",
        });
    const isValid = await bcrypt.compare(password, employee.password);
    if (!isValid)
      return res
        .status(401)
        .json({ success: false, message: "Password incorrect" });
    const io = req.io || getIO();
    // Keep the activity audit, but don't make a successful login wait for
    // secondary activity fan-out writes across the staff collection.
    void pushGlobalActivity(
      io,
      {
        action: `${employee.name} (${employee.role}) logged in to admin panel`,
        category: "Authentication",
        performedBy: employee._id,
        performedByName: employee.name,
        details: { ip: req.ip, role: employee.role },
      },
      employee._id,
    );
    await tokens.issueSession(req, res, "admin", employee);
    res.json({
      success: true,
      message: "Admin login successful",
      user: {
        id: employee._id,
        name: employee.name,
        username: employee.username,
        phone: employee.phone,
        email: employee.email,
        role: employee.role,
        avatar: employee.avatar || null,
      },
    });
  } catch (error) {
    log.error("loginAdmin error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Customer refresh — u_rt (path-restricted cookie) rotate hota hai

const refreshAdminAccessToken = async (req, res) => {
  try {
    const result = await tokens.rotateSession(req, res, "admin", async (id) => {
      const employee = await Employee.findById(id).select("_id role status is_deleted storeId").lean();
      if (!employee || employee.is_deleted || employee.status === "inactive" || employee.status === "blocked") return null;
      // Owner ("storehandler") / admin / manager / staff — utils/roles.js
      if (!isStaffRole(employee.role)) return null;
      return employee;
    });
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    res.json({ success: true, message: "Token refreshed" });
  } catch (error) {
    log.error("refreshAdminAccessToken error:", error);
    return res.status(500).json({ success: false, message: "Could not refresh session" });
  }
};

const googleLogin = async (req, res) => {
  try {
    let google;
    try {
      google = await verifyGoogleIdToken(req.body?.credential);
    } catch (error) {
      return res.status(401).json({ success: false, message: error.message || "Invalid Google token" });
    }

    let employee;
    if (req.store) {
      // Tenant-scoped: sirf isi store ka staff
      employee = await Employee.findOne({ email: google.email }).select("-activities");
    } else {
      const found = await findPlatformEmployee(google.email);
      if (found.ambiguous) {
        return res.status(409).json({
          success: false,
          message: "This email is linked to more than one store. Please sign in from your store's address.",
        });
      }
      employee = found.employee;
    }

    const denied = () =>
      res.status(403).json({ success: false, message: "This Google account is not a staff member of this store." });
    if (!employee || employee.is_deleted) return denied();
    // Owner ("storehandler") / admin / manager / staff — utils/roles.js
    if (!isStaffRole(employee.role)) return denied();
    if (employee.status === "inactive")
      return res.status(403).json({ success: false, message: "Your account is inactive. Please contact administrator." });

    const io = req.io || getIO();
    void pushGlobalActivity(
      io,
      {
        action: `${employee.name} (${employee.role}) logged in to admin panel via Google`,
        category: "Authentication",
        performedBy: employee._id,
        performedByName: employee.name,
        details: { ip: req.ip, role: employee.role, provider: "google" },
      },
      employee._id,
    );

    await tokens.issueSession(req, res, "admin", employee);
    return res.json({
      success: true,
      message: "Google login successful",
      user: {
        id: employee._id,
        name: employee.name,
        username: employee.username,
        phone: employee.phone,
        email: employee.email,
        role: employee.role,
        avatar: employee.avatar || (google.picture || null),
      },
    });
  } catch (error) {
    log.error("googleLogin error:", error);
    return res.status(500).json({ success: false, message: "Google login failed" });
  }
};

// ==========================================
// CUSTOMER GOOGLE LOGIN (One Tap / button)
// ==========================================

const createStoreHandoff = async (req, res) => {
  try {
    if (req.userType !== "employee") {
      return res.status(403).json({ success: false, message: "Only store staff can open a store admin panel." });
    }
    if (!req.user?.storeId) {
      return res.status(404).json({ success: false, message: "No store is linked to this account." });
    }
    const store = await Store.findById(req.user.storeId).select("subdomain store_name").lean();
    const baseUrl = storeAdminBaseUrl(store);
    if (!baseUrl) return res.status(404).json({ success: false, message: "Store address is not configured." });

    const token = jwt.sign(
      { type: "store_handoff", employeeId: String(req.user._id), storeId: String(store._id), jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: HANDOFF_TTL_SECONDS },
    );
    // Token URL ke #fragment me — server logs / Referer me nahi jata
    res.json({
      success: true,
      data: { storeUrl: baseUrl, subdomain: store.subdomain, url: `${baseUrl}/admin-handoff#token=${encodeURIComponent(token)}` },
    });
  } catch (error) {
    log.error("Create store handoff error:", error);
    res.status(500).json({ success: false, message: "Could not open the store admin panel." });
  }
};

// @route POST /api/users/admin/handoff/exchange   body: { token }   (store host, public)

const exchangeStoreHandoff = async (req, res) => {
  const invalid = () => res.status(401).json({ success: false, message: "This sign-in link is invalid or has expired. Please log in again." });
  try {
    if (!req.store) return invalid();
    let decoded;
    try {
      decoded = jwt.verify(String(req.body?.token || ""), process.env.JWT_SECRET);
    } catch {
      return invalid();
    }
    if (decoded.type !== "store_handoff" || String(decoded.storeId) !== String(req.store._id)) return invalid();

    // Single-use — Redis (ya Mongo fallback): restart / dusre server par bhi dobara nahi chalta
    const remaining = decoded.exp - Math.floor(Date.now() / 1000);
    if (!(await claimOnce("handoff", decoded.jti, remaining))) return invalid();

    // Tenant-scoped: sirf isi store ka employee milega
    const employee = await Employee.findById(decoded.employeeId).select("_id role status is_deleted name storeId").lean();
    if (!employee || employee.is_deleted || employee.status === "inactive" || employee.status === "blocked") return invalid();

    // Store host ka admin session — storeId isi store ka
    await tokens.issueSession(req, res, "admin", { ...employee, storeId: req.store._id });
    res.json({ success: true, message: "Signed in to your store." });
  } catch (error) {
    log.error("Exchange store handoff error:", error);
    res.status(500).json({ success: false, message: "Could not sign in to the store." });
  }
};

module.exports = {
  loginAdmin,
  refreshAdminAccessToken,
  googleLogin,
  createStoreHandoff,
  exchangeStoreHandoff,
};
