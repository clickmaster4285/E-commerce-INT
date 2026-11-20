const jwt = require("jsonwebtoken");
const SuperAdmin = require("../models/SuperAdmin");
const log = require("../utils/logger");

const getAdminAccessMinutes = () => {
  const minutes = Number(process.env.JWT_ACCESS_TOKEN_EXPIREE_MINUTES);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 60;
};

const getRefreshTokenDays = () => {
  const days = Number(process.env.JWT_REFRESH_TOKEN_EXPIREE_DAYS);
  return Number.isFinite(days) && days > 0 ? days : 30;
};

const getAccessCookieMaxAge = () => getAdminAccessMinutes() * 60 * 1000;
const getRefreshCookieMaxAge = () => getRefreshTokenDays() * 24 * 60 * 60 * 1000;

const getCookieOptions = (maxAge) => {
  const requestedSameSite = String(process.env.AUTH_COOKIE_SAME_SITE || "lax").toLowerCase();
  const sameSite = ["strict", "lax", "none"].includes(requestedSameSite) ? requestedSameSite : "lax";
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || sameSite === "none",
    sameSite,
    maxAge,
    path: "/",
  };
};

const getJwtSecret = () => {
  const secret = String(process.env.JWT_SECRET || "").trim();
  if (!secret) {
    const err = new Error("JWT_SECRET is not configured.");
    err.code = "JWT_SECRET_MISSING";
    throw err;
  }
  return secret;
};

/** Same cookie names as seller/customer auth: accessToken + refreshToken. */
const generateTokens = (superAdmin) => {
  const payload = {
    userId: String(superAdmin._id),
    role: superAdmin.role || "superadmin",
    type: "superadmin",
  };
  const accessToken = jwt.sign(payload, getJwtSecret(), {
    expiresIn: `${getAdminAccessMinutes()}m`,
  });
  const refreshToken = jwt.sign(payload, getJwtSecret(), {
    expiresIn: `${getRefreshTokenDays()}d`,
  });
  return { accessToken, refreshToken };
};

const setAuthCookies = (res, tokens) => {
  res.cookie("accessToken", tokens.accessToken, getCookieOptions(getAccessCookieMaxAge()));
  res.cookie("refreshToken", tokens.refreshToken, getCookieOptions(getRefreshCookieMaxAge()));
};

const clearAuthCookies = (res) => {
  const { httpOnly, secure, sameSite, path } = getCookieOptions(0);
  const options = { httpOnly, secure, sameSite, path };
  res.clearCookie("accessToken", options);
  res.clearCookie("refreshToken", options);
};

// Every superadmin request must present a valid superadmin accessToken AND the
// account must still exist + be active. Seller/customer tokens cannot pass —
// payload type must be "superadmin".
const requireSuperAdmin = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.split(" ")[1];
    if (!token && req.cookies?.accessToken) token = req.cookies.accessToken;

    if (!token) {
      return res.status(401).json({ success: false, message: "Super Admin session required." });
    }

    let payload;
    try {
      payload = jwt.verify(token, getJwtSecret());
    } catch {
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }
    if (payload?.type !== "superadmin") {
      return res.status(401).json({ success: false, message: "Not a Super Admin session." });
    }

    const superAdmin = await SuperAdmin.findById(payload.userId).select("-passwordHash").lean();
    if (!superAdmin) {
      return res.status(401).json({ success: false, message: "Super Admin account not found." });
    }
    if (superAdmin.status !== "active") {
      return res.status(403).json({ success: false, message: "Super Admin account is inactive." });
    }

    // Last seen — har minute me max ek write ("Online now" / "Last seen")
    const now = Date.now();
    if (!superAdmin.lastActiveAt || now - new Date(superAdmin.lastActiveAt).getTime() > 60 * 1000) {
      SuperAdmin.updateOne({ _id: superAdmin._id }, { $set: { lastActiveAt: new Date(now) } }).catch(() => {});
    }

    req.superAdmin = superAdmin;
    return next();
  } catch (error) {
    log.error("[super-admin] auth error:", error.message);
    return res.status(500).json({ success: false, message: "Authentication failed." });
  }
};

// Team management sirf role "superadmin" ke liye — staff ko 403 (requireSuperAdmin ke baad lagao)
const requireSuperAdminRole = (req, res, next) => {
  if ((req.superAdmin?.role || "superadmin") === "superadmin") return next();
  return res.status(403).json({ success: false, message: "Only super admins can manage the team." });
};

module.exports = {
  requireSuperAdmin,
  requireSuperAdminRole,
  generateTokens,
  setAuthCookies,
  clearAuthCookies,
  getCookieOptions,
  getAccessCookieMaxAge,
};
