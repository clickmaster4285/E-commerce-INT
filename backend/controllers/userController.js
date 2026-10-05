const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const PendingRegistration = require("../models/PendingRegistration");
const Wishlist = require("../models/Wishlist");
const CheckoutDraft = require("../models/CheckoutDraft");
const Employee = require("../models/Employee");
const Store = require("../models/Store");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity, getChanges } = require("../utils/activityHelper");
const { sendOtpEmail } = require("../utils/sendEmail");
const log = require("../utils/logger");

// ✅ OTP config (sirf .env se — koi hardcoded fallback nahi)
const REGISTER_OTP_EXPIRE_MINUTES = Number(process.env.EMAIL_OTP_EXPIRE_MINUTES);
const REGISTER_OTP_RESEND_SECONDS = Number(process.env.EMAIL_OTP_RESEND_SECONDS);

const normalizeEmail = (email) => String(email || "").toLowerCase().trim();
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const generateOtpCode = () => String(crypto.randomInt(0, 10 ** 6)).padStart(6, "0");

const getUserAccessDays = () => Number(process.env.JWT_USER_ACCESS_TOKEN_EXPIREE_DAYS) || 7;
const getAdminAccessMinutes = () => Number(process.env.JWT_ACCESS_TOKEN_EXPIREE_MINUTES);

// type=user + role=user → lamba (din), baaki sab (employee type ya admin/staff/manager role) → 10 min
const isLongLivedUserToken = (type, role) =>
  String(type || "user").toLowerCase() !== "employee" &&
  String(role || "").toLowerCase() === "user";

const getAccessExpiry = (type, role) =>
  isLongLivedUserToken(type, role)
    ? `${getUserAccessDays()}d`
    : `${getAdminAccessMinutes()}m`;

const getAccessCookieMaxAge = (type, role) =>
  isLongLivedUserToken(type, role)
    ? getUserAccessDays() * 24 * 60 * 60 * 1000
    : 60 * 60 * 1000;

const generateTokens = (userId, role, type = 'user') => {
  const accessToken = jwt.sign({ userId, role, type }, process.env.JWT_SECRET, {
    expiresIn: getAccessExpiry(type, role),
  });
  const refreshToken = jwt.sign({ userId, role, type }, process.env.JWT_SECRET, {
    expiresIn: `${process.env.JWT_REFRESH_TOKEN_EXPIREE_DAYS}d`,
  });
  return { accessToken, refreshToken };
};

const getCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: false, 
  sameSite: "lax",
  maxAge,
});

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
    const cleanPhone = String(phone || "").trim();
    const cleanName = String(name || "").trim();

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
    if (cleanPhone && cleanPhone.replace(/\D/g, "").length < 4)
      errors.phone = "Phone number must be at least 4 digits";
    if (Object.keys(errors).length > 0)
      return res.status(400).json({ success: false, message: "Registration failed", errors });

    const finalUsername = cleanUsername || email.split("@")[0] + Math.floor(Math.random() * 9999);

    // ✅ Verified User ka email dobara register nahi ho sakta
    // (purane users me emailVerified undefined hota hai — unhe verified maana jata hai)
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.emailVerified !== false) {
      return res.status(400).json({
        success: false,
        message: "Registration failed",
        errors: { email: "This email is already registered" },
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
    if (user.status === "inactive" || user.is_deleted)
      return res
        .status(403)
        .json({
          success: false,
          message: "Your account is inactive. Please contact administrator.",
        });
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
    const { accessToken, refreshToken } = generateTokens(user._id, user.role, 'user');
    res.cookie("accessToken", accessToken, getCookieOptions(getAccessCookieMaxAge('user', user.role)));
    res.cookie(
      "refreshToken",
      refreshToken,
      getCookieOptions(30 * 24 * 60 * 60 * 1000),
    );
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
    const employee = await Employee.findOne({ email }).select("-activities");
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
    await pushGlobalActivity(
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
    const { accessToken, refreshToken } = generateTokens(employee._id, employee.role, 'employee');
    res.cookie("accessToken", accessToken, getCookieOptions(60 * 60 * 1000));
    res.cookie(
      "refreshToken",
      refreshToken,
      getCookieOptions(30 * 24 * 60 * 60 * 1000),
    );
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

const refreshAccessToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "Refresh token required" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userType = decoded.type || 'user';
    const Model = userType === 'employee' ? Employee : User;
    const user = await Model.findById(decoded.userId);
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    const { accessToken } = generateTokens(decoded.userId, user.role, userType);
    res.cookie("accessToken", accessToken, getCookieOptions(getAccessCookieMaxAge(userType, user.role)));
    res.json({ success: true, message: "Token refreshed" });
  } catch (error) {
    res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
};

// ✅ ADMIN refresh alias — refreshAccessToken jaisi (purani untouched),
// sirf employee-type token accept (user token yahan reject).
const refreshAdminAccessToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token)
      return res
        .status(401)
        .json({ success: false, message: "Refresh token required" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== "employee")
      return res
        .status(401)
        .json({ success: false, message: "Invalid refresh token" });
    const user = await Employee.findById(decoded.userId);
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    const { accessToken } = generateTokens(decoded.userId, user.role, "employee");
    res.cookie("accessToken", accessToken, getCookieOptions(60 * 60 * 1000));
    res.json({ success: true, message: "Token refreshed" });
  } catch (error) {
    res.status(401).json({ success: false, message: "Invalid refresh token" });
  }
};

const logoutUser = async (req, res) => {
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
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.json({ success: true, message: "Logged out successfully" });
  }
};

const getProfile = async (req, res) => {
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
    if (phone !== undefined) userUpdateFields.phone = phone;
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
    if (phone !== undefined) storeUpdateFields.phone = phone;
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
      if (!store) store = await Store.create({});
      
      Object.assign(store, storeUpdateFields);
      updatedStore = await store.save();
      
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
    const accessToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: `${process.env.JWT_ACCESS_TOKEN_EXPIREE_MINUTES}m` },
    );
    const refreshToken = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: `${process.env.JWT_REFRESH_TOKEN_EXPIREE_DAYS}d` },
    );
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      sameSite: "lax",
      maxAge:
        Number(process.env.JWT_ACCESS_TOKEN_EXPIREE_MINUTES) * 60 * 1000,
    });
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      maxAge:
        Number(process.env.JWT_REFRESH_TOKEN_EXPIREE_DAYS) *
        24 *
        60 *
        60 *
        1000,
    });
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
      const defaultStore = await Store.findOne();
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

    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    res.cookie("accessToken", accessToken, getCookieOptions(getAccessCookieMaxAge('user', user.role)));
    res.cookie("refreshToken", refreshToken, getCookieOptions(30 * 24 * 60 * 60 * 1000));
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
    if (!phone || !/^[0-9+\-\s]{7,20}$/.test(String(phone)))
      return res.status(400).json({ message: "Valid phone number required" });
    const Model = req.userType === "employee" ? Employee : User;
    const user = await Model.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.phone = String(phone).trim();
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
// ✅ CREATE CHECKOUT DRAFT (new)
// ==========================================
const createCheckoutDraft = async (req, res) => {
  try {
    const {
      step,
      selectedKeys,
      selectedAddressId,
      shippingMethod,
      paymentMethod,
      items,
    } = req.body;

    const newDraft = {
      step: step ?? 1,
      selectedKeys: Array.isArray(selectedKeys) ? selectedKeys : [],
      selectedAddressId: selectedAddressId || null,
      shippingMethod: shippingMethod || "standard",
      paymentMethod: paymentMethod || "cod",
      saved: false,
      items: Array.isArray(items) ? items : [],
      updatedAt: new Date(),
    };

    let checkoutDoc = await CheckoutDraft.findOne({ user_id: req.user._id });
    if (!checkoutDoc) {
      checkoutDoc = await CheckoutDraft.create({ user_id: req.user._id, drafts: [newDraft] });
    } else {
      checkoutDoc.drafts.push(newDraft);
      await checkoutDoc.save();
    }

    const createdDraft = checkoutDoc.drafts[checkoutDoc.drafts.length - 1];
    res.status(201).json({ success: true, draft: createdDraft });
  } catch (error) {
    log.error("createCheckoutDraft error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ✅ GET ALL CHECKOUT DRAFTS
// ==========================================
const getCheckoutDrafts = async (req, res) => {
  try {
    const checkoutDoc = await CheckoutDraft.findOne({ user_id: req.user._id });
    if (!checkoutDoc)
      return res
        .status(404)
        .json({ success: false, message: "Checkout drafts not found" });
    const drafts = checkoutDoc.drafts || [];
    res.json({ success: true, drafts });
  } catch (error) {
    log.error("getCheckoutDrafts error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ✅ GET SINGLE CHECKOUT DRAFT BY ID
// ==========================================
const getCheckoutDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const checkoutDoc = await CheckoutDraft.findOne({ user_id: req.user._id });
    if (!checkoutDoc)
      return res
        .status(404)
        .json({ success: false, message: "Checkout drafts not found" });

    const draft = checkoutDoc.drafts.find(
      (d) => d._id.toString() === id,
    );
    if (!draft)
      return res
        .status(404)
        .json({ success: false, message: "Draft not found" });

    res.json({ success: true, draft });
  } catch (error) {
    log.error("getCheckoutDraft error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ✅ UPDATE SINGLE CHECKOUT DRAFT BY ID
// ==========================================
const updateCheckoutDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      step,
      selectedKeys,
      selectedAddressId,
      shippingMethod,
      paymentMethod,
      saved,
      items,
    } = req.body;

    const checkoutDoc = await CheckoutDraft.findOne({ user_id: req.user._id });
    if (!checkoutDoc)
      return res
        .status(404)
        .json({ success: false, message: "Checkout drafts not found" });

    const draftIndex = checkoutDoc.drafts.findIndex(
      (d) => d._id.toString() === id,
    );
    if (draftIndex === -1)
      return res
        .status(404)
        .json({ success: false, message: "Draft not found" });

    checkoutDoc.drafts[draftIndex].step = step ?? checkoutDoc.drafts[draftIndex].step;
    checkoutDoc.drafts[draftIndex].selectedKeys = Array.isArray(selectedKeys)
      ? selectedKeys
      : checkoutDoc.drafts[draftIndex].selectedKeys;
    checkoutDoc.drafts[draftIndex].selectedAddressId = selectedAddressId !== undefined ? selectedAddressId : checkoutDoc.drafts[draftIndex].selectedAddressId;
    checkoutDoc.drafts[draftIndex].shippingMethod = shippingMethod || checkoutDoc.drafts[draftIndex].shippingMethod;
    checkoutDoc.drafts[draftIndex].paymentMethod = paymentMethod || checkoutDoc.drafts[draftIndex].paymentMethod;
    checkoutDoc.drafts[draftIndex].saved = saved !== undefined ? saved : checkoutDoc.drafts[draftIndex].saved;
    checkoutDoc.drafts[draftIndex].items = Array.isArray(items) ? items : checkoutDoc.drafts[draftIndex].items;
    checkoutDoc.drafts[draftIndex].updatedAt = new Date();

    await checkoutDoc.save();

    const draft = checkoutDoc.drafts[draftIndex];
    res.json({ success: true, draft });
  } catch (error) {
    log.error("updateCheckoutDraft error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ✅ DELETE SINGLE CHECKOUT DRAFT BY ID
// ==========================================
const deleteCheckoutDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const checkoutDoc = await CheckoutDraft.findOne({ user_id: req.user._id });
    if (!checkoutDoc)
      return res
        .status(404)
        .json({ success: false, message: "Checkout drafts not found" });

    checkoutDoc.drafts = checkoutDoc.drafts.filter(
      (d) => d._id.toString() !== id,
    );
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
    res.json({ success: true, message: "Password changed successfully" });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
module.exports = {
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