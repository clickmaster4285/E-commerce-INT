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
const { queueOtpEmail, isSmtpConfigured } = require("../utils/sendEmail");
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

const checkRegistration = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const cleanUsername = String(req.body?.username || "").trim().toLowerCase();
    const cleanPhone = normalizePhone(typeof req.body?.phone === "string" ? req.body.phone : "");
    const errors = {};
    let code;

    if (email && isValidEmail(email)) {
      // Seller ka account Employee me hota hai — pending application email se pakdo
      const pendingApp = await SellerApplication.findOne({ email, status: "pending" }).select("_id").lean();
      if (pendingApp) {
        code = "SELLER_PENDING";
        errors.email = "An application for this email is already under review. Sign in to continue where you left off.";
      } else {
        const existingUser = await User.findOne({ email }).select("emailVerified").lean();
        if (existingUser && existingUser.emailVerified !== false) errors.email = "This email is already registered";
      }
    }

    if (cleanUsername) {
      const clash =
        (await User.findOne({ username: cleanUsername }).select("_id").lean()) ||
        (await PendingRegistration.findOne({ username: cleanUsername, email: { $ne: email } }).select("_id").lean());
      if (clash) errors.username = "This username is already taken";
    }

    if (cleanPhone) {
      const clash =
        (await User.findOne({ phone: cleanPhone }).select("_id").lean()) ||
        (await PendingRegistration.findOne({ phone: cleanPhone, email: { $ne: email } }).select("_id").lean());
      if (clash) errors.phone = "This phone number is already registered";
    }

    // Store web address (seller signup step 2)
    let subdomainSuggestion = "";
    if (typeof req.body?.subdomain === "string" && req.body.subdomain.trim()) {
      const { error, suggestion } = await checkStoreSubdomain(req.body.subdomain, email);
      if (error) errors.subdomain = error;
      subdomainSuggestion = suggestion;
    } else if (typeof req.body?.storeName === "string" && slugifySubdomain(req.body.storeName).length >= 3) {
      subdomainSuggestion = await Store.generateUniqueSubdomain(req.body.storeName);
    }

    // Username taken ho, ya khali ho aur naam mil gaya ho → naam se professional suggestions
    const name = String(req.body?.name || "").trim();
    const suggestions = errors.username || (!cleanUsername && name.length >= 2)
      ? await suggestUsernames(name, email, { excludeEmail: email })
      : [];

    return res.json({ success: true, available: Object.keys(errors).length === 0, errors, suggestions, ...(subdomainSuggestion ? { subdomainSuggestion } : {}), ...(code ? { code } : {}) });
  } catch (error) {
    log.error("[register/check] error:", error.message);
    return res.status(500).json({ success: false, message: "Could not check availability. Please try again." });
  }
};

const createUser = async (req, res) => {
  try {

    const { name, username, phone, email: rawEmail, password } = req.body;
    const referralCode = String(req.body?.referralCode || "").trim().toUpperCase().slice(0, 24);
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
    const storeSubdomain = String(req.body.subdomain || "").trim().toLowerCase();
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
      if (!storeDescription) errors.storeDescription = "Please describe your store.";
      if (!businessCategory) errors.businessCategory = "Please select a business category.";
      if (!country) errors.country = "Please select a country.";
      if (!city || city.trim().length < 2) errors.city = "Please enter your city.";
      if (!address || address.trim().length < 5) errors.address = "Please enter a complete store address.";
      if (!storeSubdomain) errors.subdomain = "Please choose your store web address.";
      else {
        const { error } = await checkStoreSubdomain(storeSubdomain, email);
        if (error) errors.subdomain = error;
      }
    if (Object.keys(errors).length > 0)
      return res.status(400).json({ success: false, message: "Registration failed", errors });
    }

    // Username khali ho to naam se professional username (hamza.asif), email-prefix+random nahi
    const finalUsername = cleanUsername || (await uniqueUsername(cleanName, email, { excludeEmail: email }));

    // ✅ Verified customer ka email dobara register nahi ho sakta
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.emailVerified !== false) {
      return res.status(400).json({
        success: false,
        message: "Registration failed",
        errors: { email: "This email is already registered" },
      });
    }
    // Pending seller (sirf Employee + SellerApplication) — same password par
    // "continue where I left off" → read-only admin panel until approval.
    const pendingApp = await SellerApplication.findOne({ email, status: "pending" })
      .select("store_id")
      .lean();
    if (pendingApp) {
      const employee = await Employee.findOne({ email, storeId: pendingApp.store_id || null })
        .setOptions({ skipTenantScope: true });
      if (employee) {
        const passwordMatches = await bcrypt.compare(String(password), employee.password || "");
        if (passwordMatches) {
          await tokens.issueSession(req, res, "admin", employee);
          return res.json({
            success: true,
            pendingApproval: true,
            message: "Your application is under review. You can explore your admin panel in read-only mode until it is approved.",
          });
        }
      }
      return res.status(403).json({
        success: false,
        code: "SELLER_PENDING",
        message: "Your application is already under review. You will be notified by email once it is approved.",
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

    let pendingRegistration;
    if (existingPending && new Date(existingPending.expiresAt).getTime() > Date.now()) {
      existingPending.name = cleanName;
      existingPending.username = finalUsername;
      existingPending.phone = cleanPhone;
      existingPending.passwordHash = passwordHash;
      existingPending.storeId = signupStoreId;
      existingPending.referralCode = referralCode || existingPending.referralCode || "";
      existingPending.storeName = wantsStore ? storeName : "";
      existingPending.subdomain = wantsStore ? storeSubdomain : "";
      existingPending.storeDescription = storeDescription;
      existingPending.businessCategory = businessCategory;
      existingPending.businessType = businessType;
      existingPending.country = country;
      existingPending.city = city;
      existingPending.address = address;
      existingPending.zipCode = zipCode;
      if (storeLogoUrl) existingPending.storeLogoUrl = storeLogoUrl;
      await existingPending.save();
      pendingRegistration = existingPending;
    } else {
      pendingRegistration = await PendingRegistration.create({
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
        referralCode,
        storeName: wantsStore ? storeName : "",
        subdomain: wantsStore ? storeSubdomain : "",
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

    // 📧 Verification OTP background me bhejo — SMTP slow/down ho to bhi
    // signup request block na ho. Pending record pehle hi save ho chuka hai.
    const emailArgs = {
      to: email,
      otp: code,
      purpose: "email_verification",
      expiresInMinutes: REGISTER_OTP_EXPIRE_MINUTES,
    };
    const smtpConfigured = isSmtpConfigured();
    if (!smtpConfigured && process.env.NODE_ENV === "production") {
      const retryAfter = await allowSignupOtpRetry(email);
      return res.status(503).json({
        success: false,
        message: "The email service is not configured. Please try again later.",
        retryAfter,
      });
    }
    queueOtpEmail(emailArgs);

    pendingRegistration.otpHash = otpHash;
    pendingRegistration.expiresAt = expiresAt;
    pendingRegistration.attempts = 0;
    pendingRegistration.lastSentAt = new Date();
    await pendingRegistration.save();

    // 🧪 DEV ONLY — code hamesha response me, taake SMTP down ho to bhi test ho sake.
    // Production me kabhi OTP print/expose nahi hota.
    const debugOtp = process.env.NODE_ENV !== "production" ? code : undefined;
    if (debugOtp) {
      console.warn(`🧪 [DEV] OTP for ${email} (email_verification): ${code}`);
    }

    // ⚠️ Is step par User NAHI bana — sirf pending + OTP. Cookies verify ke baad milenge.
    return res.status(201).json({
      success: true,
      message: `Verification code sent to ${email}. It expires in ${REGISTER_OTP_EXPIRE_MINUTES} minutes.`,
      requireVerification: true,
      otpSent: smtpConfigured,
      delivered: smtpConfigured,
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
    await pushGlobalActivity( io,
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

const googleCustomerLogin = async (req, res) => {
  try {
    // Shared verify (aud + iss + exp + email_verified) — utils/googleAuth.js
    let google;
    try {
      google = await verifyGoogleIdToken(req.body?.credential);
    } catch (error) {
      return res.status(401).json({ success: false, message: error.message || "Invalid Google token" });
    }
    const { sub: googleId, email, name, picture } = google;
    const email_verified = true; // verifyGoogleIdToken sirf verified email par aage jane deta hai

    let user = await User.findOne({ $or: [{ email }, { google_id: googleId }] });
    const isNewUser = !user;

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
        username: await uniqueUsername(name || email.split("@")[0], email),
        email,
        password: randomPassword,
        role: "user",
        provider: "google",
        google_id: googleId,
        avatar: picture || "",
        storeId: defaultStore?._id,
        // ✅ Google se aayi email already verified hoti hai
        emailVerified: email_verified !== false,
        referredByCode: String(req.body?.referralCode || "").trim().toUpperCase().slice(0, 24),
      });
      // ✅ Naya Google customer → loyalty welcome bonus
      await loyalty.awardSignupBonus(user._id);
      try {
        const referrals = require("../utils/referralService");
        await referrals.ensureReferralCode(user);
      } catch (referralError) {
        console.error("[referrals] could not create referral code:", referralError.message);
      }
      try {
        const referrals = require("../utils/referralService");
        await referrals.processSignupReferral(user, req.body?.referralCode);
      } catch (referralError) {
        console.error("[referrals] Google signup processing failed:", referralError.message);
      }
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
      isNewUser,
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

module.exports = {
  checkRegistration,
  createUser,
  loginUser,
  googleCustomerLogin,
  refreshAccessToken,
  logoutUser,
  updatePhone,
};
