const loyalty = require("../utils/loyaltyService");
const referrals = require("../utils/referralService");
const crypto = require("crypto");
const { OWNER_ROLE, ADMIN_ROLES, STAFF_ROLES, ASSIGNABLE_ROLES, isOwnerRole, isAdminRole, isStaffRole } = require("../utils/roles");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Otp = require("../models/Otp");
const User = require("../models/User");
const PendingRegistration = require("../models/PendingRegistration");
const Store = require("../models/Store");
const { sendOtpEmail } = require("../utils/sendEmail");
const SellerApplication = require("../models/SellerApplication");
const { sendApplicationReceivedEmail } = require("../services/emailService");
const { storeAdminBaseUrl } = require("../utils/storeUrl");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity } = require("../utils/activityHelper");
const log = require("../utils/logger");

// ==========================================
// âš™ï¸ OTP CONFIG (sirf env se â€” koi hardcoded fallback nahi)
// ==========================================
const OTP_EXPIRE_MINUTES = Number(process.env.EMAIL_OTP_EXPIRE_MINUTES);
const OTP_MAX_ATTEMPTS = Number(process.env.EMAIL_OTP_MAX_ATTEMPTS);
const OTP_RESEND_SECONDS = Number(process.env.EMAIL_OTP_RESEND_SECONDS);
const OTP_LENGTH = Number(process.env.OTP_LENGTH);
const RESET_TOKEN_EXPIRE_MINUTES = Number(process.env.RESET_TOKEN_EXPIRE_MINUTES);
const SMTP_RETRY_SECONDS = 10;

const normalizeEmail = (email) => String(email || "").toLowerCase().trim();

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// âœ… Cryptographically secure 6-digit code
const generateOtpCode = () =>
  String(crypto.randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");

// âœ… Sessions utils/tokens.js se â€” customer (aud "user") aur seller admin
// (aud "admin") ke alag secrets + cookies. Pehle yahan hard-coded
// secure:false / 7-din wale employee tokens the.
const tokens = require("../utils/tokens");

const setAuthCookies = (req, res, user) => tokens.issueSession(req, res, "user", user);

// Seller admin session. Pending sellers get this too, so they can open the
// admin panel read-only until the Super Admin approves them.
const setEmployeeAuthCookies = (req, res, employee) => tokens.issueSession(req, res, "admin", employee);

// ==========================================
// ðŸ” ISSUE + SEND OTP (shared)
// ==========================================
const issueOtp = async ({ email, purpose }) => {
  // ðŸ›‘ Resend throttle â€” bar bar OTP request par spam rokta hai
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

  // âœ… Purane codes invalid â€” ek waqt mein sirf latest OTP valid rehta hai
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
    // âœ… Email fail ho to bekaar OTP DB mein na chhodo â€” user dobara try kar sake
    await Otp.deleteOne({ _id: created._id }).catch(() => {});
    emailError.statusCode = 503;
    emailError.retryAfter = SMTP_RETRY_SECONDS;
    throw emailError;
  }
  if (!delivery.delivered && process.env.NODE_ENV === "production") {
    await Otp.deleteOne({ _id: created._id }).catch(() => {});
    const error = new Error("The email server did not accept the verification email. Please retry shortly.");
    error.statusCode = 503;
    error.retryAfter = SMTP_RETRY_SECONDS;
    throw error;
  }

  // ðŸ§ª DEV ONLY â€” SMTP off ho to bhi flow test ho sake (prod mein kabhi OTP expose nahi hoga)
  const debugOtp =
    !delivery.delivered && process.env.NODE_ENV !== "production" ? code : undefined;
  if (debugOtp) {
    log.warn(`ðŸ§ª [DEV] OTP for ${email} (${purpose}): ${code} â€” SMTP set karne par real email jayegi`);
  }

  return { delivered: delivery.delivered, debugOtp };
};

// ==========================================
// ðŸ”Ž VERIFY OTP (shared) â€” verified OTP document return karta hai
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

// ðŸ§ª DEV ONLY helper â€” prod mein debugOtp kabhi response mein nahi jata
const withDebugOtp = (payload, debugOtp) =>
  debugOtp ? { ...payload, debugOtp } : payload;

// ==========================================
// 1ï¸âƒ£ EMAIL VERIFICATION â€” SEND OTP (reusable helper)
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
  // âœ… Verified (ya purana user jisme field undefined hai) â€” dobara OTP nahi
  if (user && user.emailVerified !== false) return { alreadyVerified: true, email };

  // âœ… Pending registration hai to wahi par naya OTP issue karo (throttle ke saath)
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
    const otpHash = await bcrypt.hash(code, 10);
    let delivery;
    try {
      delivery = await sendOtpEmail({
        to: email,
        otp: code,
        purpose: "email_verification",
        expiresInMinutes: OTP_EXPIRE_MINUTES,
      });
    } catch (emailError) {
      const cooldown = Number.isFinite(OTP_RESEND_SECONDS) && OTP_RESEND_SECONDS > 0 ? OTP_RESEND_SECONDS : 60;
      pending.lastSentAt = new Date(Date.now() - Math.max(0, cooldown - Math.min(SMTP_RETRY_SECONDS, cooldown)) * 1000);
      await pending.save();
      emailError.statusCode = 503;
      emailError.retryAfter = Math.min(SMTP_RETRY_SECONDS, cooldown);
      throw emailError;
    }
    if (!delivery.delivered && process.env.NODE_ENV === "production") {
      const cooldown = Number.isFinite(OTP_RESEND_SECONDS) && OTP_RESEND_SECONDS > 0 ? OTP_RESEND_SECONDS : 60;
      pending.lastSentAt = new Date(Date.now() - Math.max(0, cooldown - Math.min(SMTP_RETRY_SECONDS, cooldown)) * 1000);
      await pending.save();
      const error = new Error("The email server did not accept the verification email. Please retry shortly.");
      error.statusCode = 503;
      error.retryAfter = Math.min(SMTP_RETRY_SECONDS, cooldown);
      throw error;
    }
    // Sirf email successfully queued (ya dev fallback code tayyar) hone par
    // naya OTP active karein; SMTP failure purane valid code ko revoke na kare.
    pending.otpHash = otpHash;
    pending.expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);
    pending.attempts = 0;
    pending.lastSentAt = new Date();
    await pending.save();
    const debugOtp =
      !delivery.delivered && process.env.NODE_ENV !== "production" ? code : undefined;
    if (debugOtp) {
      log.warn(`ðŸ§ª [DEV] OTP for ${email} (email_verification): ${code} â€” SMTP set karne par real email jayegi`);
    }
    return { alreadyVerified: false, email, delivered: delivery.delivered, debugOtp };
  }

  // âœ… Legacy fallback: fix se PEHLE bana unverified User (ab User pehle nahi banta,
  // lekin deploy se pehle ke adhoore accounts ke liye purana Otp flow chalÙ†Û’ do)
  if (user && user.emailVerified === false) {
    const { delivered, debugOtp } = await issueOtp({ email, purpose: "email_verification" });
    return { alreadyVerified: false, email, delivered, debugOtp };
  }

  const error = new Error("No account found with this email address. Please register first.");
  error.statusCode = 404;
  throw error;
};

// ==========================================
// 1ï¸âƒ£ EMAIL VERIFICATION â€” SEND OTP
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
            : `SMTP is not configured â€” the code was not emailed. Check the backend console for the OTP or configure SMTP. (expires in ${OTP_EXPIRE_MINUTES} min)`,
        },
        result.debugOtp,
      ),
    );
  } catch (error) {
    return sendError(res, error);
  }
};


// ==========================================
// 1ï¸âƒ£ EMAIL VERIFICATION â€” VERIFY OTP
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

    // âœ… Naya flow: PendingRegistration se verify -> User create
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

      // âœ… Sahi OTP â€” ab identity banao (customer = User, seller = Employee)
      const Employee = require("../models/Employee");
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser.emailVerified !== false) {
        const pendingApp = await SellerApplication.findOne({ email, status: "pending" }).select("status").lean();
        if (pendingApp) {
          await PendingRegistration.deleteOne({ _id: pending._id });
          return res.status(403).json({
            success: false,
            code: "SELLER_PENDING",
            message: "Your application is already under review. You will be notified by email once it is approved.",
          });
        }
        await PendingRegistration.deleteOne({ _id: pending._id });
        return res
          .status(400)
          .json({ success: false, message: "This email is already registered. Please log in." });
      }
      if (existingUser && existingUser.emailVerified === false) {
        // Legacy adhoora record â€” naye account ke liye jagah banao
        await User.deleteOne({ _id: existingUser._id });
      }
      // Seller ka identity Employee (admin_users) me hai â€” username/phone wahan check karo
      if (pending.username) {
        const uname = String(pending.username).toLowerCase().trim();
        const clash = pending.storeId
          ? await User.findOne({ username: uname })
          : await Employee.findOne({ username: uname }).setOptions({ skipTenantScope: true });
        if (clash) {
          return res
            .status(400)
            .json({ success: false, message: "This username is already taken. Please register again with another username." });
        }
      }
      if (pending.phone) {
        const phone = String(pending.phone).trim();
        const phoneClash = pending.storeId
          ? await User.findOne({ phone })
          : await Employee.findOne({ phone }).setOptions({ skipTenantScope: true });
        if (phoneClash) {
          return res
            .status(400)
            .json({ success: false, message: "This phone number is already registered." });
        }
      }
      // â”€â”€ Store customer signup (storefront register) â”€â”€
      // Seller approval / SellerApplication / blocked status sirf platform seller
      // signup ke liye â€” customer foran active hota hai aur login ho jata hai.
      if (pending.storeId) {
        if (!req.store || String(req.store._id) !== String(pending.storeId)) {
          return res
            .status(400)
            .json({ success: false, message: "Please verify your email on the store where you registered." });
        }
        const customer = await User.create({
          name: pending.name,
          username: pending.username,
          phone: pending.phone || "",
          email: pending.email,
          // âœ… passwordHash pehle se bcrypt-hashed hai â€” dobara hash nahi karna
          password: pending.passwordHash,
          storeId: req.store._id,
          role: "user",
          emailVerified: true,
          status: "active",
          referralCode: null,
          referredByCode: pending.referralCode || "",
        });
        await PendingRegistration.deleteOne({ _id: pending._id });
        // âœ… Loyalty welcome bonus (program off ho to kuch nahi hota)
        await loyalty.awardSignupBonus(customer._id);
        try {
          await referrals.ensureReferralCode(customer);
        } catch (referralError) {
          console.error("[referrals] could not create referral code:", referralError.message);
        }
        try {
          await referrals.processSignupReferral(customer, pending.referralCode);
        } catch (referralError) {
          console.error("[referrals] signup processing failed:", referralError.message);
        }
        await setAuthCookies(req, res, customer);

        const io = req.io || getIO();
        await pushGlobalActivity(
          io,
          {
            action: `${customer.name} verified their email`,
            category: "Authentication",
            performedBy: customer._id,
            performedByName: customer.name,
            details: { email: customer.email },
          },
          customer._id,
        );

        return res.json({
          success: true,
          message: "Email verified. Welcome!",
          user: {
            id: customer._id,
            name: customer.name,
            username: customer.username,
            phone: customer.phone,
            email: customer.email,
            role: customer.role,
            avatar: customer.avatar || null,
          },
        });
      }

      // â”€â”€ Platform seller signup (naya store, Super Admin approval) â”€â”€
      if (req.store) {
        return res
          .status(400)
          .json({ success: false, message: "Please verify your seller account on the main signup page." });
      }
      const isSeller = !!(pending.storeName && String(pending.storeName).trim().length >= 3);

      const Store = require("../models/Store");

      // Seller store is created up-front (closed) and stays read-only until approval.
      let store = null;
      if (isSeller) {
        // Seller ka chuna hua address â€” beech me kisi ne le liya ho to us se milta-julta free address
        let subdomain = String(pending.subdomain || "").trim().toLowerCase();
        if (!subdomain || (await Store.exists({ subdomain }).setOptions({ skipTenantScope: true }))) {
          subdomain = await Store.generateUniqueSubdomain(subdomain || pending.storeName);
        }
        store = await Store.create({
          store_name: pending.storeName,
          subdomain,
          tagline: "Welcome to our store",
          description: pending.storeDescription || "",
          business_category: pending.businessCategory || "",
          business_type: pending.businessType || "individual",
          logo: pending.storeLogoUrl
            ? { img_url: pending.storeLogoUrl, public_id: "" }
            : { img_url: "", public_id: "" },
          email: pending.email,
          phone: pending.phone || "",
          country: pending.country || "PK",
          city: pending.city || "",
          address: pending.address || "",
          zip_code: pending.zipCode || "",
          store_status: "closed",
          currency: "PKR",
          tax_rate: 17,
          weight_unit: "kg",
        });
      }

      // Seller ka identity sirf Employee (admin_users) + SellerApplication hai â€”
      // customer_users me seller ka duplicate account nahi banta.

      // Seller application queue â€” Super Admin reviews from here (everything supplied at signup)
      const application = await SellerApplication.create({
        name: pending.name,
        email: pending.email,
        phone: pending.phone || "",
        username: pending.username || "",
        passwordHash: pending.passwordHash,
        store_name: isSeller ? pending.storeName : `${String(pending.name || "").trim().slice(0, 40) || "New"}'s Store`,
        store_description: isSeller ? pending.storeDescription || "" : "",
        logo: isSeller && pending.storeLogoUrl
          ? { img_url: pending.storeLogoUrl, public_id: "" }
          : { img_url: "", public_id: "" },
        business_category: isSeller ? pending.businessCategory || "" : "",
        business_type: isSeller ? pending.businessType || "individual" : "individual",
        country: isSeller ? pending.country || "" : "",
        city: isSeller ? pending.city || "" : "",
        address: isSeller ? pending.address || "" : "",
        zip_code: isSeller ? pending.zipCode || "" : "",
        status: "pending",
        user_id: null,
        store_id: isSeller ? store._id : null,
      });

      // Seller gets an employee session in read-only mode (all pages viewable, nothing editable).
      // Store owner = "admin" role (full panel access); read-only is enforced by seller_pending, not role.
      const employee = await Employee.create({
        name: pending.name,
        username: pending.username,
        email: pending.email,
        phone: pending.phone || "",
        password: pending.passwordHash,
        role: OWNER_ROLE,
        status: "active",
        storeId: isSeller ? store._id : null,
        seller_pending: true,
      });

      await PendingRegistration.deleteOne({ _id: pending._id });
      const storeName = isSeller ? pending.storeName : ((application.store_name) || "Your store");
      // Best-effort â€” failure must not block signup
      try {
        await sendApplicationReceivedEmail({
          name: pending.name,
          email: pending.email,
          storeName,
          adminUrl: storeAdminBaseUrl(store), // store null ho to null â†’ generic link
        });
      } catch (emailError) {
        console.error("[signup] pending-approval email failed:", emailError.message);
      }

      // Pending approval â€” sirf read-only employee session (customer account nahi banta).
      await setEmployeeAuthCookies(req, res, employee);
      // Store handoff URL for frontend redirect (avoids a second call)
      let handoffUrl = null;
      try {
        const { storeAdminBaseUrl } = require("../utils/storeUrl");
        const baseUrl = storeAdminBaseUrl(store);
        if (baseUrl) {
          const token = jwt.sign(
            { type: "store_handoff", employeeId: String(employee._id), storeId: String(store._id), jti: crypto.randomUUID() },
            process.env.JWT_SECRET,
            { expiresIn: 10 * 60 },
          );
          handoffUrl = baseUrl + "/admin-handoff#token=" + encodeURIComponent(token);
        }
      } catch (e) { /* ignore */ }
      const io = req.io || getIO();
      await pushGlobalActivity(
        io,
        {
          action: `${employee.name} verified their email`,
          category: "Authentication",
          performedBy: employee._id,
          performedByName: employee.name,
          details: { email: employee.email },
        },
        employee._id,
      );

      return res.json({
        success: true,
        storeSubdomain: store?.subdomain || null,
        handoffUrl,
        pendingApproval: true,
        message: "Your application is pending Super Admin approval. We'll email you once it is approved.",
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
    }

    // âœ… Legacy fallback: fix se pehle bana unverified User + Otp record
    const record = await verifyOtpCode({ email, purpose: "email_verification", otp });

    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "No account found with this email address" });

    user.emailVerified = true;
    await user.save();
    if (user.role === "user" && user.storeId) await loyalty.awardSignupBonus(user._id);
    record.verified = true;
    record.consumed = true;
    await record.save();

    // âœ… Verified hone par seedha login karwa dete hain
    await setAuthCookies(req, res, user);

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
// 2ï¸âƒ£ FORGOT PASSWORD â€” SEND OTP
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
            : `SMTP is not configured â€” the code was not emailed. Check the backend console for the OTP or configure SMTP. (expires in ${OTP_EXPIRE_MINUTES} min)`,
        },
        debugOtp,
      ),
    );
  } catch (error) {
    return sendError(res, error);
  }
};

// ==========================================
// 2ï¸âƒ£ FORGOT PASSWORD â€” VERIFY OTP
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

    // storeId token me â€” reset sirf usi store (host) par complete hoga
    const resetToken = jwt.sign(
      { email, purpose: "password_reset", otpId: String(record._id), storeId: req.store?._id ? String(req.store._id) : null },
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
// 2ï¸âƒ£ FORGOT PASSWORD â€” SET NEW PASSWORD
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

    const requestStoreId = req.store?._id ? String(req.store._id) : null;
    if (
      payload.purpose !== "password_reset" ||
      normalizeEmail(payload.email) !== email ||
      (payload.storeId || null) !== requestStoreId // store A ka reset store B par nahi
    )
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

    // âœ… Security: is account ke SAARE sessions (har device) band + cookies clear
    await tokens.revokeAllForSubject("user", user._id, { reason: "password_reset" });
    tokens.clearAuthCookies(res, "user");

    return res.json({
      success: true,
      message: "Password reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    return sendError(res, error);
  }
};

// ==========================================
// ðŸ“§ EMAIL HEALTH â€” SMTP diagnose karne ke liye
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
        message: "SMTP is not configured â€” OTP will only be printed to the console.",
        hint: "Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM in .env. For Gmail, use an App Password.",
        config: {
          host: cfg.host || "(empty)",
          port: cfg.port,
          secure: cfg.secure,
          user: cfg.user ? `${cfg.user.slice(0, 3)}***` : "(empty)",
          from: cfg.from || "(empty â†’ SMTP_USER use hoga)",
        },
      });
    }
    await verifySmtpConnection();
    return res.json({
      success: true,
      configured: true,
        message: `SMTP OK â€” emails can be sent via ${cfg.host}:${cfg.port}.`,
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

