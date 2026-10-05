const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Otp = require("../models/Otp");
const User = require("../models/User");
const PendingRegistration = require("../models/PendingRegistration");
const Store = require("../models/Store");
const { sendOtpEmail } = require("../utils/sendEmail");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity } = require("../utils/activityHelper");
const log = require("../utils/logger");

// ==========================================
// ⚙️ OTP CONFIG (sirf env se — koi hardcoded fallback nahi)
// ==========================================
const OTP_EXPIRE_MINUTES = Number(process.env.EMAIL_OTP_EXPIRE_MINUTES);
const OTP_MAX_ATTEMPTS = Number(process.env.EMAIL_OTP_MAX_ATTEMPTS);
const OTP_RESEND_SECONDS = Number(process.env.EMAIL_OTP_RESEND_SECONDS);
const OTP_LENGTH = Number(process.env.OTP_LENGTH);
const RESET_TOKEN_EXPIRE_MINUTES = Number(process.env.RESET_TOKEN_EXPIRE_MINUTES);

const normalizeEmail = (email) => String(email || "").toLowerCase().trim();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ✅ Cryptographically secure 6-digit code
const generateOtpCode = () =>
  String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");

const getUserAccessDays = () => Number(process.env.JWT_USER_ACCESS_TOKEN_EXPIREE_DAYS) || 7;

const setAuthCookies = (res, userId, role) => {
  const accessToken = jwt.sign(
    { userId, role, type: "user" },
    process.env.JWT_SECRET,
    { expiresIn: `${getUserAccessDays()}d` },
  );
  const refreshToken = jwt.sign(
    { userId, role, type: "user" },
    process.env.JWT_SECRET,
    { expiresIn: `${process.env.JWT_REFRESH_TOKEN_EXPIREE_DAYS}d` },
  );
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge: getUserAccessDays() * 24 * 60 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    maxAge:
      Number(process.env.JWT_REFRESH_TOKEN_EXPIREE_DAYS) * 24 * 60 * 60 * 1000,
  });
};

// ==========================================
// 🔁 ISSUE + SEND OTP (shared)
// ==========================================
const issueOtp = async ({ email, purpose }) => {
  // 🛑 Resend throttle — bar bar OTP request par spam rokta hai
  const recent = await Otp.findOne({ email, purpose }).sort({ created_at: -1 });
  if (recent) {
    const elapsed = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
    if (elapsed < OTP_RESEND_SECONDS) {
      const retryAfter = Math.ceil(OTP_RESEND_SECONDS - elapsed);
      const error = new Error(
        `Please wait ${retryAfter} second${retryAfter === 1 ? "" : "s"} before requesting a new code.`,
      );
      error.statusCode = 429;
      error.retryAfter = retryAfter;
      throw error;
    }
  }

  // ✅ Purane codes invalid — ek waqt mein sirf latest OTP valid rehta hai
  await Otp.deleteMany({ email, purpose });

  const code = generateOtpCode();
  const code_hash = await bcrypt.hash(code, 10);
  const expires_at = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

  const created = await Otp.create({ email, purpose, code_hash, expires_at });

  let delivery;
  try {
    delivery = await sendOtpEmail({
      to: email,
      otp: code,
      purpose,
      expiresInMinutes: OTP_EXPIRE_MINUTES,
    });
  } catch (emailError) {
    // ✅ Email fail ho to bekaar OTP DB mein na chhodo — user dobara try kar sake
    await Otp.deleteOne({ _id: created._id }).catch(() => {});
    throw emailError;
  }

  // 🧪 DEV ONLY — SMTP off ho to bhi flow test ho sake (prod mein kabhi OTP expose nahi hoga)
  const debugOtp =
    !delivery.delivered && process.env.NODE_ENV !== "production" ? code : undefined;
  if (debugOtp) {
    log.warn(`🧪 [DEV] OTP for ${email} (${purpose}): ${code} — SMTP set karne par real email jayegi`);
  }

  return { delivered: delivery.delivered, debugOtp };
};

// ==========================================
// 🔎 VERIFY OTP (shared) — verified OTP document return karta hai
// ==========================================
const verifyOtpCode = async ({ email, purpose, otp }) => {
  const record = await Otp.findOne({ email, purpose, consumed: false }).sort({
    created_at: -1,
  });

  if (!record) {
    const error = new Error("Code expired or not found. Please request a new one.");
    error.statusCode = 400;
    throw error;
  }

  if (new Date(record.expires_at).getTime() < Date.now()) {
    await Otp.deleteOne({ _id: record._id });
    const error = new Error("Code has expired. Please request a new one.");
    error.statusCode = 400;
    throw error;
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await Otp.deleteOne({ _id: record._id });
    const error = new Error("Too many incorrect attempts. Please request a new code.");
    error.statusCode = 429;
    throw error;
  }

  const isMatch = await bcrypt.compare(String(otp), record.code_hash);
  if (!isMatch) {
    record.attempts += 1;
    await record.save();
    const left = Math.max(OTP_MAX_ATTEMPTS - record.attempts, 0);
    const error = new Error(
      left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} remaining.`
        : "Too many incorrect attempts. Please request a new code.",
    );
    error.statusCode = left > 0 ? 400 : 429;
    throw error;
  }

  return record;
};

const sendError = (res, error) => {
  const status = error.statusCode || 500;
  if (status >= 500) log.error("OTP error:", error.cause || error);
  return res.status(status).json({
    success: false,
    message: error.message,
    ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
  });
};

// 🧪 DEV ONLY helper — prod mein debugOtp kabhi response mein nahi jata
const withDebugOtp = (payload, debugOtp) =>
  debugOtp ? { ...payload, debugOtp } : payload;

// ==========================================
// 1️⃣ EMAIL VERIFICATION — SEND OTP (reusable helper)
// PendingRegistration flow: User tabhi banega jab OTP verify hoga.
// Isliye resend sabse pehle Pending me dekhta hai.
// ==========================================
const sendVerificationOtpForEmail = async (rawEmail) => {
  const email = normalizeEmail(rawEmail);
  if (!email || !isValidEmail(email)) {
    const error = new Error("Please provide a valid email address");
    error.statusCode = 400;
    throw error;
  }

  const user = await User.findOne({ email });
  // ✅ Verified (ya purana user jisme field undefined hai) — dobara OTP nahi
  if (user && user.emailVerified !== false) return { alreadyVerified: true, email };

  // ✅ Pending registration hai to wahi par naya OTP issue karo (throttle ke saath)
  const pending = await PendingRegistration.findOne({ email });
  if (pending) {
    if (new Date(pending.expiresAt).getTime() < Date.now()) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      const error = new Error("Code has expired. Please register again to get a new code.");
      error.statusCode = 400;
      throw error;
    }
    const elapsed = (Date.now() - new Date(pending.lastSentAt).getTime()) / 1000;
    if (elapsed < OTP_RESEND_SECONDS) {
      const retryAfter = Math.ceil(OTP_RESEND_SECONDS - elapsed);
      const error = new Error(
        `Please wait ${retryAfter} second${retryAfter === 1 ? "" : "s"} before requesting a new code.`,
      );
      error.statusCode = 429;
      error.retryAfter = retryAfter;
      throw error;
    }
    const code = generateOtpCode();
    pending.otpHash = await bcrypt.hash(code, 10);
    pending.expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);
    pending.attempts = 0;
    pending.lastSentAt = new Date();
    await pending.save();

    let delivery;
    try {
      delivery = await sendOtpEmail({
        to: email,
        otp: code,
        purpose: "email_verification",
        expiresInMinutes: OTP_EXPIRE_MINUTES,
      });
    } catch (emailError) {
      throw emailError;
    }
    const debugOtp =
      !delivery.delivered && process.env.NODE_ENV !== "production" ? code : undefined;
    if (debugOtp) {
      log.warn(`🧪 [DEV] OTP for ${email} (email_verification): ${code} — SMTP set karne par real email jayegi`);
    }
    return { alreadyVerified: false, email, delivered: delivery.delivered, debugOtp };
  }

  // ✅ Legacy fallback: fix se PEHLE bana unverified User (ab User pehle nahi banta,
  // lekin deploy se pehle ke adhoore accounts ke liye purana Otp flow chalنے do)
  if (user && user.emailVerified === false) {
    const { delivered, debugOtp } = await issueOtp({ email, purpose: "email_verification" });
    return { alreadyVerified: false, email, delivered, debugOtp };
  }

  const error = new Error("No account found with this email address. Please register first.");
  error.statusCode = 404;
  throw error;
};

// ==========================================
// 1️⃣ EMAIL VERIFICATION — SEND OTP
// ==========================================
const sendEmailVerificationOtp = async (req, res) => {
  try {
    const result = await sendVerificationOtpForEmail(req.body?.email);

    if (result.alreadyVerified)
      return res.json({
        success: true,
        alreadyVerified: true,
        email: result.email,
        message: "This email is already verified. You can log in now.",
      });

    return res.json(
      withDebugOtp(
        {
          success: true,
          email: result.email,
          requireVerification: true,
          delivered: result.delivered,
          expiresInMinutes: OTP_EXPIRE_MINUTES,
          resendAfterSeconds: OTP_RESEND_SECONDS,
          message: result.delivered
            ? `Verification code sent to ${result.email}. It expires in ${OTP_EXPIRE_MINUTES} minutes.`
            : `SMTP is not configured — the code was not emailed. Check the backend console for the OTP or configure SMTP. (expires in ${OTP_EXPIRE_MINUTES} min)`,
        },
        result.debugOtp,
      ),
    );
  } catch (error) {
    return sendError(res, error);
  }
};


// ==========================================
// 1️⃣ EMAIL VERIFICATION — VERIFY OTP
// Request/response shape same: {email, otp} -> {success, message, user} + cookies.
// Sahi OTP par hi User document banta hai, pending record delete hota hai.
// ==========================================
const verifyEmailVerificationOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || "").trim();

    if (!email || !isValidEmail(email))
      return res
        .status(400)
        .json({ success: false, message: "Please provide a valid email address" });
    if (!otp)
      return res.status(400).json({ success: false, message: "Please enter the code" });

    // ✅ Naya flow: PendingRegistration se verify -> User create
    const pending = await PendingRegistration.findOne({ email });
    if (pending) {
      if (new Date(pending.expiresAt).getTime() < Date.now()) {
        await PendingRegistration.deleteOne({ _id: pending._id });
        return res
          .status(400)
          .json({ success: false, message: "Code has expired. Please register again to get a new code." });
      }
      if (pending.attempts >= OTP_MAX_ATTEMPTS) {
        await PendingRegistration.deleteOne({ _id: pending._id });
        return res
          .status(429)
          .json({ success: false, message: "Too many incorrect attempts. Please register again to get a new code." });
      }
      const isMatch = await bcrypt.compare(String(otp), pending.otpHash);
      if (!isMatch) {
        pending.attempts += 1;
        await pending.save();
        const left = Math.max(OTP_MAX_ATTEMPTS - pending.attempts, 0);
        if (left <= 0) {
          await PendingRegistration.deleteOne({ _id: pending._id });
          return res
            .status(429)
            .json({ success: false, message: "Too many incorrect attempts. Please register again to get a new code." });
        }
        return res
          .status(400)
          .json({ success: false, message: `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} remaining.` });
      }

      // ✅ Sahi OTP — ab User banao (is se pehle User exist nahi karta)
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser.emailVerified !== false) {
        await PendingRegistration.deleteOne({ _id: pending._id });
        return res
          .status(400)
          .json({ success: false, message: "This email is already registered. Please log in." });
      }
      if (existingUser && existingUser.emailVerified === false) {
        // Legacy adhoora record — naye verified User ke liye jagah banao
        await User.deleteOne({ _id: existingUser._id });
      }
      if (pending.username) {
        const clash = await User.findOne({
          username: String(pending.username).toLowerCase().trim(),
        });
        if (clash) {
          return res
            .status(400)
            .json({ success: false, message: "This username is already taken. Please register again with another username." });
        }
      }
      if (pending.phone) {
        const phoneClash = await User.findOne({ phone: String(pending.phone).trim() });
        if (phoneClash) {
          return res
            .status(400)
            .json({ success: false, message: "This phone number is already registered." });
        }
      }
      const defaultStore = await Store.findOne();
      const user = await User.create({
        name: pending.name,
        username: pending.username,
        phone: pending.phone || "",
        email: pending.email,
        // ✅ passwordHash pehle se bcrypt-hashed hai — dobara hash nahi karna
        password: pending.passwordHash,
        storeId: defaultStore?._id,
        role: "user",
        emailVerified: true,
      });
      await PendingRegistration.deleteOne({ _id: pending._id });

      // ✅ Verified hone par seedha login karwa dete hain
      setAuthCookies(res, user._id, user.role);

      const io = req.io || getIO();
      await pushGlobalActivity(
        io,
        {
          action: `${user.name} verified their email`,
          category: "Authentication",
          performedBy: user._id,
          performedByName: user.name,
          details: { email: user.email },
        },
        user._id,
      );

      return res.json({
        success: true,
        message: "Email verified successfully",
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
    }

    // ✅ Legacy fallback: fix se pehle bana unverified User + Otp record
    const record = await verifyOtpCode({ email, purpose: "email_verification", otp });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "No account found with this email address" });

    user.emailVerified = true;
    await user.save();
    record.verified = true;
    record.consumed = true;
    await record.save();

    // ✅ Verified hone par seedha login karwa dete hain
    setAuthCookies(res, user._id, user.role);

    const io = req.io || getIO();
    await pushGlobalActivity(
      io,
      {
        action: `${user.name} verified their email`,
        category: "Authentication",
        performedBy: user._id,
        performedByName: user.name,
        details: { email: user.email },
      },
      user._id,
    );

    return res.json({
      success: true,
      message: "Email verified successfully",
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
    return sendError(res, error);
  }
};

// ==========================================
// 2️⃣ FORGOT PASSWORD — SEND OTP
// ==========================================
const sendForgotPasswordOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email || !isValidEmail(email))
      return res
        .status(400)
        .json({ success: false, message: "Please provide a valid email address" });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "No account found with this email address" });

    if (user.provider === "google" && !user.password)
      return res.status(400).json({
        success: false,
        message: "This account uses Google sign-in. Please continue with Google.",
      });

    const { delivered, debugOtp } = await issueOtp({ email, purpose: "password_reset" });

    return res.json(
      withDebugOtp(
        {
          success: true,
          email,
          delivered,
          expiresInMinutes: OTP_EXPIRE_MINUTES,
          resendAfterSeconds: OTP_RESEND_SECONDS,
          message: delivered
            ? `Password reset code sent to ${email}. It expires in ${OTP_EXPIRE_MINUTES} minutes.`
            : `SMTP is not configured — the code was not emailed. Check the backend console for the OTP or configure SMTP. (expires in ${OTP_EXPIRE_MINUTES} min)`,
        },
        debugOtp,
      ),
    );
  } catch (error) {
    return sendError(res, error);
  }
};

// ==========================================
// 2️⃣ FORGOT PASSWORD — VERIFY OTP
// (success par short-lived reset token milta hai)
// ==========================================
const verifyForgotPasswordOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp || "").trim();

    if (!email || !isValidEmail(email))
      return res
        .status(400)
        .json({ success: false, message: "Please provide a valid email address" });
    if (!otp)
      return res.status(400).json({ success: false, message: "Please enter the code" });

    const record = await verifyOtpCode({ email, purpose: "password_reset", otp });

    record.verified = true;
    await record.save();

    const resetToken = jwt.sign(
      { email, purpose: "password_reset", otpId: String(record._id) },
      process.env.JWT_SECRET,
      { expiresIn: `${RESET_TOKEN_EXPIRE_MINUTES}m` },
    );

    return res.json({
      success: true,
      email,
      resetToken,
      message: "Code verified. Please set your new password.",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ==========================================
// 2️⃣ FORGOT PASSWORD — SET NEW PASSWORD
// ==========================================
const resetPasswordWithOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { resetToken, newPassword } = req.body || {};

    if (!email || !resetToken || !newPassword)
      return res.status(400).json({
        success: false,
        message: "Email, reset token and new password are required",
      });

    if (String(newPassword).length < 6)
      return res
        .status(400)
        .json({ success: false, message: "Password must be at least 6 characters" });

    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res
        .status(400)
        .json({ success: false, message: "Reset link expired. Please start again." });
    }

    if (payload.purpose !== "password_reset" || normalizeEmail(payload.email) !== email)
      return res
        .status(400)
        .json({ success: false, message: "Invalid reset request. Please start again." });

    const record = await Otp.findById(payload.otpId);
    if (
      !record ||
      !record.verified ||
      record.consumed ||
      new Date(record.expires_at).getTime() < Date.now()
    )
      return res
        .status(400)
        .json({ success: false, message: "Reset session expired. Please start again." });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "No account found with this email address" });

    user.password = await bcrypt.hash(String(newPassword), 10);
    await user.save();

    record.consumed = true;
    await record.save();

    const io = req.io || getIO();
    await pushGlobalActivity(
      io,
      {
        action: `${user.name} reset their password via OTP`,
        category: "Authentication",
        performedBy: user._id,
        performedByName: user.name,
        details: { email: user.email },
      },
      user._id,
    );

    // ✅ Security: purane sessions invalid karne ke liye cookies clear
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");

    return res.json({
      success: true,
      message: "Password reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ==========================================
// 📧 EMAIL HEALTH — SMTP diagnose karne ke liye
// GET /api/users/email-health
// ==========================================
const getEmailHealth = async (req, res) => {
  try {
    const { isSmtpConfigured, verifySmtpConnection, getSmtpConfig } = require("../utils/sendEmail");
    const configured = isSmtpConfigured();
    const cfg = getSmtpConfig();
    if (!configured) {
      return res.json({
        success: false,
        configured: false,
        message: "SMTP is not configured — OTP will only be printed to the console.",
        hint: "Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM in .env. For Gmail, use an App Password.",
        config: {
          host: cfg.host || "(empty)",
          port: cfg.port,
          secure: cfg.secure,
          user: cfg.user ? `${cfg.user.slice(0, 3)}***` : "(empty)",
          from: cfg.from || "(empty → SMTP_USER use hoga)",
        },
      });
    }
    await verifySmtpConnection();
    return res.json({
      success: true,
      configured: true,
        message: `SMTP OK — emails can be sent via ${cfg.host}:${cfg.port}.`,
      config: {
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        user: `${cfg.user.slice(0, 3)}***`,
        from: cfg.from || cfg.user,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      configured: true,
      message: `SMTP login/connect failed: ${error.message}`,
      hint: "Gmail: use a 16-character App Password (without spaces) with 2-Step Verification ON. A normal password will not work.",
    });
  }
};

module.exports = {
  sendEmailVerificationOtp,
  sendVerificationOtpForEmail,
  verifyEmailVerificationOtp,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
  getEmailHealth,
  OTP_EXPIRE_MINUTES,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
};

