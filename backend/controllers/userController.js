const crypto = require("crypto");
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

// ✅ OTP config (sirf .env se — koi hardcoded fallback nahi)
const REGISTER_OTP_EXPIRE_MINUTES = Number(process.env.EMAIL_OTP_EXPIRE_MINUTES);
const REGISTER_OTP_RESEND_SECONDS = Number(process.env.EMAIL_OTP_RESEND_SECONDS);

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
const createUser = async (req, res) => {
  try {
    const { name, username, phone, email: rawEmail, password } = req.body;
    const email = normalizeEmail(rawEmail);
    const cleanUsername = String(username || "").trim();
    const rawPhone = typeof phone === "string" ? phone : "";
    const cleanPhone = normalizePhone(rawPhone);
    const cleanName = String(name || "").trim();

    // Store host par signup = HAMESHA isi store ka customer (store-setup fields nahi).
    // Seller signup (naya store) sirf platform host (landing/signup) par.
    // Pehle wantsStore default true tha → storefront register form (jo store fields
    // bhejta hi nahi) "Please enter your store name" 400 deta tha.
    const signupStoreId = req.store?._id || null;
    const wantsStore = !signupStoreId && String(req.body.wantsStore ?? true) !== "false";
    if (!signupStoreId && !wantsStore) {
      return res.status(400).json({
        success: false,
        message: "Customer accounts are created on a store's website.",
      });
    }
    const storeName = String(req.body.storeName || "").trim().slice(0, 140);
    const storeDescription = String(req.body.storeDescription || "").trim().slice(0, 2000);
    const businessCategory = String(req.body.businessCategory || "").trim();
    const businessType = ["individual", "registered_business"].includes(String(req.body.businessType || ""))
      ? String(req.body.businessType)
      : "individual";
    const country = String(req.body.country || "").trim();
    const city = String(req.body.city || "").trim();
    const address = String(req.body.address || "").trim().slice(0, 300);
    const zipCode = String(req.body.zipCode || "").trim().slice(0, 20);
    const storeLogo = typeof req.body.storeLogo === "string" ? req.body.storeLogo : "";

    // ✅ Basic validation — User NAHI banega, sirf 400 milega
    const errors = {};
    if (!email || !isValidEmail(email)) errors.email = "Please enter a valid email address";
    if (!password || String(password).length < 6)
      errors.password = "Password must be at least 6 characters";
    if (!cleanName) errors.name = "Name is required";
    else if (cleanName.length < 2) errors.name = "Name must be at least 2 characters";
    if (cleanUsername) {
      if (cleanUsername.length < 3) errors.username = "Username must be at least 3 characters";
      else if (!/^[a-zA-Z0-9_]+$/.test(cleanUsername))
        errors.username = "Username can only contain letters, numbers, and underscores";
    }
    if (rawPhone && !isValidPhone(rawPhone)) {
      errors.phone = !/^\d+$/.test(rawPhone)
        ? "Phone number must contain digits only"
        : rawPhone.length < 10
          ? "Phone number must be at least 10 digits"
          : "Phone number must be at most 16 digits";
    }
    if (Object.keys(errors).length > 0)
      return res.status(400).json({ success: false, message: "Registration failed", errors });
    if (wantsStore) {
      if (!storeName || storeName.length < 1) errors.storeName = "Please enter your store name.";
      if (!storeDescription || storeDescription.length < 10) errors.storeDescription = "Please describe your store (at least 10 characters).";
      if (!businessCategory) errors.businessCategory = "Please select a business category.";
      if (!country) errors.country = "Please select a country.";
      if (!city || city.trim().length < 2) errors.city = "Please enter your city.";
      if (!address || address.trim().length < 5) errors.address = "Please enter a complete store address.";
    if (Object.keys(errors).length > 0)
      return res.status(400).json({ success: false, message: "Registration failed", errors });
    }

    const finalUsername = cleanUsername || email.split("@")[0] + Math.floor(Math.random() * 9999);

    // ✅ Verified User ka email dobara register nahi ho sakta
    // (purane users me emailVerified undefined hota hai — unhe verified maana jata hai)
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.emailVerified !== false) {
      // Blocked + pending application → same email + password as signup means
      // "continue where I left off" → welcome → read-only admin panel until approval.
      try {
        const pendingApp = await SellerApplication.findOne({ email, status: "pending" })
          .select("status store_id")
          .lean();
        if (existingUser.status === "blocked" && pendingApp) {
          const passwordMatches = await bcrypt.compare(String(password), existingUser.password || "");
          if (passwordMatches) {
            // Resume — make sure a pending-seller employee exists for the admin panel
            // Email ab sirf store ke andar unique — isi application ke store ka employee
            let employee = await Employee.findOne({ email, storeId: pendingApp.store_id || null })
              .setOptions({ skipTenantScope: true });
            if (!employee) {
              employee = await Employee.create({
                name: existingUser.name,
                username: existingUser.username,
                email,
                phone: existingUser.phone || "",
                password: existingUser.password, // already bcrypt-hashed
                role: "staff",
                status: "active",
                storeId: pendingApp.store_id || null,
                seller_pending: true,
              });
            } else if (!employee.seller_pending || employee.status !== "active") {
              employee.seller_pending = true;
              employee.status = "active";
              await employee.save();
            }
            // User + admin sessions alag cookies me (pehle employee wale user cookies overwrite kar dete the)
            await tokens.issueSession(req, res, "user", existingUser);
            await tokens.issueSession(req, res, "admin", employee);
            return res.json({
              success: true,
              pendingApproval: true,
              message: "Your application is under review. You can explore your admin panel in read-only mode until it is approved.",
            });
          }
          return res.status(403).json({
            success: false,
            code: "SELLER_PENDING",
            message: "Your application is already under review. You will be notified by email once it is approved.",
          });
        }
      } catch (lookupError) {
        console.error("[register] pending seller application lookup failed:", lookupError.message);
      }
      return res.status(400).json({
        success: false,
        message: "Registration failed",
        errors: { email: "This email is already registered" },
      });
    }
    // Option A: ek seller email sirf ek store ka owner (kisi bhi store ka admin / pending seller)
    if (wantsStore && (await sellerEmailTaken(email))) {
      return res.status(400).json({
        success: false,
        message: "Registration failed",
        errors: { email: SELLER_EMAIL_TAKEN_MESSAGE },
      });
    }
    // ✅ Legacy adhoora User (fix se pehle OTP ke bina bana) — pending flow ke liye hata do
    if (existingUser && existingUser.emailVerified === false) {
      await User.deleteOne({ _id: existingUser._id });
    }
    // ✅ username/phone clash — verified Users + doosri emails ke pendings se
    const dupErrors = {};
    const usernameClash = await User.findOne({ username: String(finalUsername).toLowerCase().trim() });
    if (usernameClash) dupErrors.username = "This username is already taken";
    else {
      const pendingUsernameClash = await PendingRegistration.findOne({
        username: String(finalUsername).toLowerCase().trim(),
        email: { $ne: email },
      });
      if (pendingUsernameClash) dupErrors.username = "This username is already taken";
    }
    if (cleanPhone) {
      const phoneClash = await User.findOne({ phone: cleanPhone });
      if (phoneClash) dupErrors.phone = "This phone number is already registered";
      else {
        const pendingPhoneClash = await PendingRegistration.findOne({
          phone: cleanPhone,
          email: { $ne: email },
        });
        if (pendingPhoneClash) dupErrors.phone = "This phone number is already registered";
      }
    }
    if (Object.keys(dupErrors).length > 0)
      return res.status(400).json({ success: false, message: "Registration failed", errors: dupErrors });

    // ✅ Same email se dobara Create: sirf pending hai to error nahi — naya OTP bhej ke update karo
    const existingPending = await PendingRegistration.findOne({ email });
    if (existingPending && new Date(existingPending.expiresAt).getTime() > Date.now()) {
      const elapsed = (Date.now() - new Date(existingPending.lastSentAt).getTime()) / 1000;
      if (elapsed < REGISTER_OTP_RESEND_SECONDS) {
        const retryAfter = Math.ceil(REGISTER_OTP_RESEND_SECONDS - elapsed);
        return res.status(429).json({
          success: false,
          message: `Please wait ${retryAfter} second${retryAfter === 1 ? "" : "s"} before requesting a new code.`,
          retryAfter,
          requireVerification: true,
          email,
        });
      }
    } else if (existingPending) {
      await PendingRegistration.deleteOne({ _id: existingPending._id });
    }

    let storeLogoUrl = "";
    if (wantsStore && storeLogo) {
      try {
        storeLogoUrl = await saveStoreLogoFromBase64(storeLogo);
      } catch (logoError) {
        return res.status(400).json({ success: false, message: "Store logo could not be processed. Please upload a smaller JPG, PNG or WEBP image." });
      }
    }

    // ✅ OTP + hashes — DB me plain text kuch nahi jayega
    const code = generateOtpCode();
    const passwordHash = await bcrypt.hash(String(password), 10);
    const otpHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + REGISTER_OTP_EXPIRE_MINUTES * 60 * 1000);

    if (existingPending && new Date(existingPending.expiresAt).getTime() > Date.now()) {
      existingPending.name = cleanName;
      existingPending.username = finalUsername;
      existingPending.phone = cleanPhone;
      existingPending.passwordHash = passwordHash;
      existingPending.otpHash = otpHash;
      existingPending.expiresAt = expiresAt;
      existingPending.attempts = 0;
      existingPending.lastSentAt = new Date();
      existingPending.storeId = signupStoreId;
      existingPending.storeName = wantsStore ? storeName : "";
      existingPending.storeDescription = storeDescription;
      existingPending.businessCategory = businessCategory;
      existingPending.businessType = businessType;
      existingPending.country = country;
      existingPending.city = city;
      existingPending.address = address;
      existingPending.zipCode = zipCode;
      if (storeLogoUrl) existingPending.storeLogoUrl = storeLogoUrl;
      await existingPending.save();
    } else {
      await PendingRegistration.create({
        email,
        name: cleanName,
        username: finalUsername,
        phone: cleanPhone,
        passwordHash,
        otpHash,
        expiresAt,
        attempts: 0,
        lastSentAt: new Date(),
        storeId: signupStoreId,
        storeName: wantsStore ? storeName : "",
        storeDescription,
        businessCategory,
        businessType,
        country,
        city,
        address,
        zipCode,
        storeLogoUrl,
      });
    }

    // 📧 Verification OTP bhejo — SMTP khaali ho to dev console fallback (sendEmail ke andar)
    let delivery;
    try {
      delivery = await sendOtpEmail({
        to: email,
        otp: code,
        purpose: "email_verification",
        expiresInMinutes: REGISTER_OTP_EXPIRE_MINUTES,
      });
    } catch (emailError) {
      await PendingRegistration.deleteOne({ email }).catch(() => {});
      log.error("createUser otp error:", emailError.cause || emailError);
      return res.status(500).json({ success: false, message: emailError.message });
    }

    // 🧪 DEV ONLY — SMTP off ho to bhi flow test ho sake (prod me kabhi OTP expose nahi hoga)
    const debugOtp =
      !delivery.delivered && process.env.NODE_ENV !== "production" ? code : undefined;
    if (debugOtp) {
      log.warn(`🧪 [DEV] OTP for ${email} (email_verification): ${code} — SMTP set karne par real email jayegi`);
    }

    // ⚠️ Is step par User NAHI bana — sirf pending + OTP. Cookies verify ke baad milenge.
    return res.status(201).json({
      success: true,
      message: delivery.delivered
        ? `Verification code sent to ${email}. It expires in ${REGISTER_OTP_EXPIRE_MINUTES} minutes.`
        : `SMTP set nahi hai — code email par nahi gaya. Backend console par OTP dekhein. (expires in ${REGISTER_OTP_EXPIRE_MINUTES} min)`,
      requireVerification: true,
      otpSent: true,
      delivered: delivery.delivered,
      email,
      expiresInMinutes: REGISTER_OTP_EXPIRE_MINUTES,
      resendAfterSeconds: REGISTER_OTP_RESEND_SECONDS,
      ...(debugOtp ? { debugOtp } : {}),
      user: { name: cleanName, username: finalUsername, phone: cleanPhone, email },
    });
  } catch (error) {
    log.error("createUser error:", error);
    if (error?.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";
      return res
        .status(400)
        .json({ success: false, message: "Registration failed", errors: { [field]: `This ${field} is already in use` } });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 🛒 CUSTOMER LOGIN
// ==========================================
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Please provide email and password" });
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    if (user.role !== "user")
      return res
        .status(403)
        .json({
          success: false,
          message: "This login is only for customers. Please use admin panel.",
        });
    if (user.status === "inactive" || user.status === "blocked" || user.is_deleted) {
      // If it's a pending seller, tell them the application is under review
      try {
        const app = await SellerApplication.findOne({ email: user.email }).select("status").lean();
        if (user.status === "blocked" && app && String(app.status).toLowerCase() === "pending") {
          return res.status(403).json({
            success: false,
            code: "SELLER_PENDING",
            message: "Your seller application is under review. You will be notified by email once it is approved.",
          });
        }
      } catch (lookupError) {
        console.error("[login] seller application lookup failed:", lookupError.message);
      }
      return res
        .status(403)
        .json({
          success: false,
          message: "Your account is inactive. Please contact administrator.",
        });
    }
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res
        .status(401)
        .json({ success: false, message: "Password incorrect" });

    // ✅ EMAIL VERIFICATION — verified nahi hai to login nahi hoga
    // (purane users mein field undefined hota hai, unhe verified maana jata hai)
    if (user.emailVerified === false)
      return res.status(403).json({
        success: false,
        needsVerification: true,
        email: user.email,
        message:
          "Your email is not verified. Please verify it with the code we sent to your email.",
      });

    const io = req.io || getIO();
    await pushGlobalActivity(
      io,
      {
        action: `${user.name} logged in`,
        category: "Authentication",
        performedBy: user._id,
        performedByName: user.name,
        details: { ip: req.ip },
      },
      user._id,
    );
    await tokens.issueSession(req, res, "user", user);
    res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
      },
    });
  } catch (error) {
    log.error("loginUser error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// 🛠️ ADMIN / STAFF LOGIN
// ==========================================
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
    if (!["admin", "staff", "manager"].includes(employee.role))
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
const refreshAccessToken = async (req, res) => {
  try {
    const result = await tokens.rotateSession(req, res, "user", async (id) => {
      const user = await User.findById(id).select("_id role status is_deleted storeId").lean();
      if (!user || user.is_deleted || user.status === "blocked" || user.status === "inactive") return null;
      return user;
    });
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    res.json({ success: true, message: "Token refreshed" });
  } catch (error) {
    log.error("refreshAccessToken error:", error);
    return res.status(500).json({ success: false, message: "Could not refresh session" });
  }
};

// Admin/employee refresh — a_rt rotate hota hai
const refreshAdminAccessToken = async (req, res) => {
  try {
    const result = await tokens.rotateSession(req, res, "admin", async (id) => {
      const employee = await Employee.findById(id).select("_id role status is_deleted storeId").lean();
      if (!employee || employee.is_deleted || employee.status === "inactive" || employee.status === "blocked") return null;
      if (!["admin", "staff", "manager"].includes(employee.role)) return null;
      return employee;
    });
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    res.json({ success: true, message: "Token refreshed" });
  } catch (error) {
    log.error("refreshAdminAccessToken error:", error);
    return res.status(500).json({ success: false, message: "Could not refresh session" });
  }
};

const logoutUser = async (req, res) => {
  const auds = audFromHeader(req) ? [audFromHeader(req)] : ["admin", "user"];
  try {
    if (req.user?._id) {
      const io = req.io || getIO();
      await pushGlobalActivity(
        io,
        {
          action: `${req.user.name || "User"} logged out`,
          category: "Authentication",
          performedBy: req.user._id,
          performedByName: req.user.name || "User",
        },
        req.user._id,
      );
    }
    for (const aud of auds) {
      await tokens.revokeCurrentSession(req, aud).catch((e) => log.error("logout revoke failed:", e.message));
      tokens.clearAuthCookies(res, aud);
    }
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    for (const aud of auds) tokens.clearAuthCookies(res, aud);
    res.json({ success: true, message: "Logged out successfully" });
  }
};

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
      String(req.user?.role || "").toLowerCase() === "admin" ||
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
    if (String(requesterRole).toLowerCase() !== "admin" && requesterStorePerm === undefined) {
      try {
        const reqDoc = await Model.findById(userId).select("role permissions").lean();
        if (reqDoc) {
          requesterRole = reqDoc.role || requesterRole;
          requesterStorePerm = reqDoc.permissions?.store;
        }
      } catch (e) { /* ignore — neeche deny hoga */ }
    }
    const canEditStore =
      String(requesterRole).toLowerCase() === "admin" || !!requesterStorePerm;
    const userUpdateFields = {};
    if (name !== undefined) userUpdateFields.name = name;
    if (email !== undefined)
      userUpdateFields.email = email.toLowerCase().trim();
    if (phone !== undefined) userUpdateFields.phone = phone ? normalizePhone(phone) : phone;
    if (website !== undefined) userUpdateFields.website = website;
    if (address !== undefined) userUpdateFields.address = address;
    userUpdateFields.updatedby = userId;
    const updatedUser = await Model.findByIdAndUpdate(userId, userUpdateFields, {
      new: true,
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

const googleLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(400).json({ message: "Google credential missing" });
    const payload = JSON.parse(
      Buffer.from(credential.split(".")[1], "base64").toString(),
    );
    const { email, name, picture } = payload;
    if (!email)
      return res
        .status(400)
        .json({ message: "No email found in Google account" });
    let user = await User.findOne({ email });
    if (!user) {
      // ✅ SECURITY FIX: Naye Google users ko direct access NAHI milega
      return res.status(403).json({ 
        success: false, 
        message: "Access Denied. Your email is not registered as Staff/Admin. Please contact administrator." 
      });
    }

    // ✅ EXISTING USER ROLE CHECK
    if (!["admin", "staff", "manager"].includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only administrators, managers and staff members can log in.",
      });
    } else {
      if (user.role !== "user")
        return res
          .status(403)
          .json({ message: "Admin/Staff cannot use customer Google login." });
      if (!user.avatar && picture) {
        user.avatar = picture;
        await user.save();
      }
    }
    // ⚠️ Pehle `type` payload me nahi tha → authMiddleware ise "user" maan kar
    // User collection me dhoondta (Employee hai → "User not found" 401), aur
    // admin refresh endpoint bhi is token ko reject kar deta tha. Ab type
    // set hai + expiry/cookie dono ek hi helper se aate hain.
    await tokens.issueSession(req, res, "admin", user);
    return res.json({
      success: true,
      message: "Google login successful",
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Google login failed", error: error.message });
  }
};

// ==========================================
// CUSTOMER GOOGLE LOGIN (One Tap / button)
// ==========================================
const googleCustomerLogin = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential)
      return res.status(400).json({ success: false, message: "Google credential missing" });

    let payload;
    try {
      const tokenRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
      );
      if (!tokenRes.ok)
        return res.status(401).json({ success: false, message: "Invalid Google token" });
      payload = await tokenRes.json();
    } catch {
      return res.status(401).json({ success: false, message: "Invalid Google token" });
    }

    if (payload.aud !== process.env.GOOGLE_CLIENT_ID)
      return res.status(401).json({ success: false, message: "Invalid Google token" });

    const { sub: googleId, email, name, picture, email_verified } = payload;
    if (!email)
      return res.status(400).json({ success: false, message: "Google account did not return an email" });

    let user = await User.findOne({ $or: [{ email }, { google_id: googleId }] });

    if (user) {
      const updates = {};
      if (!user.google_id && googleId) updates.google_id = googleId;
      if (!user.avatar && picture) updates.avatar = picture;
      // ✅ Google email pehle se verified hoti hai — local OTP ki zaroorat nahi
      if (!user.emailVerified) updates.emailVerified = true;
      if (Object.keys(updates).length) await User.findByIdAndUpdate(user._id, updates);
      user = await User.findById(user._id);
    } else {
      const randomPassword = await bcrypt.hash(require("crypto").randomBytes(32).toString("hex"), 10);
      // Customer isi host ke store ka hai; platform par koi store nahi (random store nahi)
      const defaultStore = req.store || null;
      user = await User.create({
        name: name || email.split("@")[0],
        username: email.split("@")[0] + Math.floor(Math.random() * 99999),
        email,
        password: randomPassword,
        role: "user",
        provider: "google",
        google_id: googleId,
        avatar: picture || "",
        storeId: defaultStore?._id,
        // ✅ Google se aayi email already verified hoti hai
        emailVerified: email_verified !== false,
      });
    }

    const io = req.io || getIO();
    await pushGlobalActivity(
      io,
      {
        action: `${user.name} logged in via Google`,
        category: "Authentication",
        performedBy: user._id,
        performedByName: user.name,
        details: { ip: req.ip, provider: "google" },
      },
      user._id,
    );

    await tokens.issueSession(req, res, "user", user);
    res.json({
      success: true,
      message: "Google login successful",
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        phone: user.phone,
        email: user.email,
        role: user.role,
        avatar: user.avatar || null,
      },
    });
  } catch (error) {
    log.error("googleCustomerLogin error:", error);
    res.status(500).json({ success: false, message: "Google login failed" });
  }
};

const updatePhone = async (req, res) => {
  try {
    const { phone } = req.body;
    if (typeof phone !== "string" || !phone.trim())
      return res.status(400).json({ message: "Phone number is required" });
    const phoneValue = phone;
    if (!/^\d+$/.test(phoneValue))
      return res.status(400).json({ message: "Phone number must contain digits only" });
    if (phoneValue.length < 10)
      return res.status(400).json({ message: "Phone number must be at least 10 digits" });
    if (phoneValue.length > 16)
      return res.status(400).json({ message: "Phone number must be at most 16 digits" });
    if (!isValidPhone(phoneValue))
      return res.status(400).json({ message: "Please enter a valid phone number" });
    const Model = req.userType === "employee" ? Employee : User;
    const user = await Model.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.phone = normalizePhone(phoneValue);
    await user.save();
    res
      .status(200)
      .json({ message: "Phone updated successfully", phone: user.phone });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



;

// ==========================================
// ✅ GET WISHLIST (populated products)
// ==========================================
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
      { new: true, upsert: true, setDefaultsOnInsert: true },
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
const updateProfileREST = async (req, res) => {
  try {
    const { name, username } = req.body;
    const update = {};
    if (name) update.name = name;
    if (username) update.username = username;
    const Model = req.userType === "employee" ? Employee : User;
    const user = await Model.findByIdAndUpdate(req.user._id, update, { new: true }).select("-password");
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
const { ROOT_DOMAIN } = require("../utils/tenantHost");

const { claimOnce } = require("../utils/oneTimeToken");

const HANDOFF_TTL_SECONDS = 120;

const storeAdminBaseUrl = (store) => {
  const protocol = process.env.PUBLIC_STORE_PROTOCOL || (process.env.NODE_ENV === "production" ? "https" : "http");
  const port = String(process.env.PUBLIC_STORE_PORT || "").trim();
  if (!store?.subdomain || !ROOT_DOMAIN) return null;
  return `${protocol}://${store.subdomain}.${ROOT_DOMAIN}${port ? `:${port}` : ""}`;
};

// @route POST /api/users/admin/handoff   (logged-in employee, platform host)
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
  createStoreHandoff,
  exchangeStoreHandoff,
  createUser,
  loginUser,
  loginAdmin,
  refreshAccessToken,
  refreshAdminAccessToken,
  logoutUser,
  getProfile,
  getMe,
  updateProfile,
  changePassword,
  getProfileInfo,
  updateProfileInfo,
  changePasswordSocket,
  updateProfileREST,
  changePasswordREST,
  googleLogin,
  googleCustomerLogin,
  updatePhone,
  createCheckoutDraft,
  getCheckoutDrafts,
  getCheckoutDraft,
  updateCheckoutDraft,
  deleteCheckoutDraft,
  getWishlist,
  toggleWishlist,
};
