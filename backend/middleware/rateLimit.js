const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const log = require("../utils/logger");

// ==========================================
// 🚦 DYNAMIC RATE LIMITING (.env based)
// ==========================================
// Saari limits sirf RATE_LIMIT_* env vars se aati hain.

const num = (value) => {
  const n = Number(value);
  return n;
};

const WINDOW_MINUTES = num(process.env.RATE_LIMIT_WINDOW_MINUTES);
const WINDOW_MS = Math.max(1, WINDOW_MINUTES) * 60 * 1000;

const USER_MULTIPLIER = num(process.env.RATE_LIMIT_USER_MULTIPLIER);
const ADMIN_MULTIPLIER = num(process.env.RATE_LIMIT_ADMIN_MULTIPLIER);

// ✅ FIX: undefined par "undefined" string na bane
const WHITELIST_IPS = String(process.env.RATE_LIMIT_WHITELIST_IPS || "")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean);

// ==========================================
// 🧠 STORE: Redis sirf tab jab REDIS_URL valid ho (redis:// ya rediss://)
// warna memory store (undefined) use hota hai
// ==========================================
let redisClient;
const getRedisClient = () => {
  if (redisClient !== undefined) return redisClient;
  redisClient = null;

  // ✅ FIX: String(undefined) = "undefined" wali galti khatam
  const redisUrl = String(process.env.REDIS_URL || "").trim();
  if (!/^rediss?:\/\//i.test(redisUrl)) return redisClient;

  try {
    const { Redis } = require("ioredis");
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    });
    // Redis errors repeat ho sakte hain — terminal spam na ho, sirf pehli baar
    let redisErrorLogged = false;
    client.on("error", (err) => {
      if (redisErrorLogged) return;
      redisErrorLogged = true;
      log.error("❌ [rateLimit] Redis error:", err.message);
    });
    redisClient = client;
    log.info("✅ [rateLimit] Redis enabled");
  } catch (error) {
    log.error("⚠️ [rateLimit] Redis load nahi hua, memory store use hoga:", error.message);
    redisClient = null;
  }
  return redisClient;
};

// ✅ FIX: har limiter ka apna alag store (unique prefix) — ERR_ERL_STORE_REUSE khatam
const makeStore = (name) => {
  const client = getRedisClient();
  if (!client) return undefined; // undefined = built-in memory store
  try {
    const { RedisStore } = require("rate-limit-redis");
    return new RedisStore({
      sendCommand: (...args) => client.call(...args),
      prefix: `rl:${name}:`,
    });
  } catch (error) {
    log.error("⚠️ [rateLimit] RedisStore load nahi hua, memory store use hoga:", error.message);
    return undefined;
  }
};

const isWhitelisted = (req) => {
  if (!WHITELIST_IPS.length) return false;
  const ip = String(req.ip || "").trim();
  if (WHITELIST_IPS.includes(ip)) return true;
  // ✅ X-Forwarded-For ka IP bhi check karo (proxy ke peeche direct IP ke liye)
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return forwarded.some((fip) => WHITELIST_IPS.includes(fip));
};

// ✅ Email key hamesha lowercase + trim
const emailOf = (req) => String(req.body?.email || req.query?.email || "").toLowerCase().trim();

const ipPart = (req) => {
  try {
    return ipKeyGenerator(req.ip);
  } catch {
    return String(req.ip || "unknown");
  }
};

// ==========================================
// 👤 ROLE PEHCHAN (global limiter auth se pehle chalta hai)
// Token ko sirf decode/verify karte hain — fail ho to guest, kabhi 401 nahi.
// ==========================================
const roleOf = (req) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    if (!token || !process.env.JWT_SECRET) return "guest";
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (String(decoded.role || "").toLowerCase() === "admin") return "admin";
    if (decoded.userId) return "user";
    return "guest";
  } catch {
    return "guest";
  }
};

const multiplierFor = (role) => {
  if (role === "admin") return ADMIN_MULTIPLIER;
  if (role === "user") return USER_MULTIPLIER;
  return 1;
};

// keyBy: "ip" | "email" | "ip+email" | "user"
const buildKeyGenerator = (keyBy) => {
  if (keyBy === "email") {
    return (req) => emailOf(req) || ipPart(req);
  }
  if (keyBy === "ip+email") {
    return (req) => {
      const email = emailOf(req);
      return email ? `${ipPart(req)}:${email}` : ipPart(req);
    };
  }
  if (keyBy === "user") {
    return (req) => {
      const id = req.user?._id || req.user?.id;
      return id ? `user:${String(id)}` : ipPart(req);
    };
  }
  return (req) => ipPart(req);
};

// ✅ 429 — OTP errors wala format + Retry-After header
const tooManyHandler = (req, res) => {
  let retryAfter = Math.ceil(WINDOW_MS / 1000);
  try {
    const resetTime = req.rateLimit?.resetTime;
    const resetMs = resetTime instanceof Date ? resetTime.getTime() : Number(resetTime);
    if (Number.isFinite(resetMs)) {
      retryAfter = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
    }
  } catch {
    // fallback: poori window
  }
  res.set("Retry-After", String(retryAfter));
  return res.status(429).json({
    success: false,
    message: `Too many requests. Please try again in ${retryAfter} seconds.`,
    retryAfter,
  });
};

// ==========================================
// 🏭 REUSABLE FACTORY
// createRateLimiter({ name, max, windowMs, keyBy, roleBased })
// roleBased=true sirf global/normal routes par (auth routes par hamesha sakht limit).
// multiplier 0 (admin default) = unlimited → request skip hoti hai.
// ==========================================
const createRateLimiter = ({ name, max, windowMs = WINDOW_MS, keyBy = "ip", roleBased = false }) => {
  const baseMax = Math.max(1, Math.round(num(max)));
  return rateLimit({
    windowMs,
    // ✅ roleBased par limit request ke role se decide hoti hai
    limit: (req) => {
      if (!roleBased) return baseMax;
      const mult = multiplierFor(roleOf(req));
      if (mult <= 0) return baseMax; // skip() already bypass kar chuka hai
      return Math.max(1, Math.round(baseMax * mult));
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: buildKeyGenerator(keyBy),
    skip: (req) => {
      if (isWhitelisted(req)) return true;
      // ✅ multiplier 0 = unlimited (roleBased routes par)
      if (roleBased && multiplierFor(roleOf(req)) <= 0) return true;
      return false;
    },
    store: makeStore(name), // ✅ har limiter ka alag store, ya memory (undefined)
    handler: tooManyHandler,
  });
};

// ==========================================
// 📋 PREBUILT LIMITERS (.env defaults)
// ==========================================
const limiters = {
  global: createRateLimiter({
    name: "global",
    max: num(process.env.RATE_LIMIT_GLOBAL_MAX),
    keyBy: "ip",
    roleBased: true,
  }),
  login: createRateLimiter({
    name: "login",
    max: num(process.env.RATE_LIMIT_LOGIN_MAX),
    keyBy: "ip+email",
  }),
  register: createRateLimiter({
    name: "register",
    max: num(process.env.RATE_LIMIT_REGISTER_MAX),
    keyBy: "ip",
  }),
  sendEmailOtp: createRateLimiter({
    name: "send-email-otp",
    max: num(process.env.RATE_LIMIT_SEND_EMAIL_OTP_MAX),
    keyBy: "email",
  }),
  verifyEmailOtp: createRateLimiter({
    name: "verify-email-otp",
    max: num(process.env.RATE_LIMIT_VERIFY_EMAIL_OTP_MAX),
    keyBy: "email",
  }),
  forgotPassword: createRateLimiter({
    name: "forgot-password",
    max: num(process.env.RATE_LIMIT_FORGOT_PASSWORD_MAX),
    keyBy: "email",
  }),
  verifyResetOtp: createRateLimiter({
    name: "verify-reset-otp",
    max: num(process.env.RATE_LIMIT_VERIFY_RESET_OTP_MAX),
    keyBy: "email",
  }),
  resetPassword: createRateLimiter({
    name: "reset-password",
    max: num(process.env.RATE_LIMIT_RESET_PASSWORD_MAX),
    keyBy: "email",
  }),
  googleLogin: createRateLimiter({
    name: "google-login",
    max: num(process.env.RATE_LIMIT_GOOGLE_LOGIN_MAX),
    keyBy: "ip",
  }),
  adminLogin: createRateLimiter({
    name: "admin-login",
    max: num(process.env.RATE_LIMIT_ADMIN_LOGIN_MAX),
    keyBy: "ip",
  }),
  orderCreate: createRateLimiter({
    name: "order-create",
    max: num(process.env.RATE_LIMIT_ORDER_CREATE_MAX),
    keyBy: "user",
  }),
  reviewCreate: createRateLimiter({
    name: "review-create",
    max: num(process.env.RATE_LIMIT_REVIEW_CREATE_MAX),
    keyBy: "user",
  }),
};

module.exports = {
  createRateLimiter,
  limiters,
  WINDOW_MS,
  WINDOW_MINUTES,
};