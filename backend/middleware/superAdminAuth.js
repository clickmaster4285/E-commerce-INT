const jwt = require("jsonwebtoken");
const SuperAdmin = require("../models/SuperAdmin");
const log = require("../utils/logger");

const getCookieName = () => {
  const name = String(process.env.SUPER_ADMIN_COOKIE_NAME || "").trim();
  if (!name) {
    const err = new Error(
      "SUPER_ADMIN_COOKIE_NAME is not configured. Set it in backend/.env before using the Super Admin panel."
    );
    err.code = "SUPERADMIN_COOKIE_NAME_MISSING";
    throw err;
  }
  return name;
};

const getSessionTtlSeconds = () => {
  const raw = String(process.env.SUPER_ADMIN_SESSION_TTL_SECONDS || "").trim();
  const ttl = Number(raw);
  if (!raw || !Number.isFinite(ttl) || ttl < 60) {
    const err = new Error(
      "SUPER_ADMIN_SESSION_TTL_SECONDS is not configured (or invalid). Set it in backend/.env before using the Super Admin panel."
    );
    err.code = "SUPERADMIN_SESSION_TTL_MISSING";
    throw err;
  }
  return Math.floor(ttl);
};

const getSecret = () => {
  const secret = String(process.env.SUPER_ADMIN_JWT_SECRET || "").trim();
  if (!secret) {
    const err = new Error(
      "SUPER_ADMIN_JWT_SECRET is not configured. Set it in backend/.env before using the Super Admin panel."
    );
    err.code = "SUPERADMIN_SECRET_MISSING";
    throw err;
  }
  return secret;
};

const signSession = (superAdmin) =>
  jwt.sign(
    { sub: String(superAdmin._id), type: "superadmin", email: superAdmin.email },
    getSecret(),
    { expiresIn: `${getSessionTtlSeconds()}s` }
  );

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: getSessionTtlSeconds() * 1000,
  path: "/",
});

// Every superadmin request must present a valid superadmin token AND the
// account must still exist + be active. Normal user/employee tokens cannot
// pass — signature is verified with a dedicated secret.
const requireSuperAdmin = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.split(" ")[1];
    if (!token && req.cookies?.[getCookieName()]) token = req.cookies[getCookieName()];

    if (!token) {
      return res.status(401).json({ success: false, message: "Super Admin session required." });
    }

    let payload;
    try {
      payload = jwt.verify(token, getSecret());
    } catch {
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }
    if (payload?.type !== "superadmin") {
      return res.status(401).json({ success: false, message: "Not a Super Admin session." });
    }

    const superAdmin = await SuperAdmin.findById(payload.sub).select("-passwordHash").lean();
    if (!superAdmin) {
      return res.status(401).json({ success: false, message: "Super Admin account not found." });
    }
    if (superAdmin.status !== "active") {
      return res.status(403).json({ success: false, message: "Super Admin account is inactive." });
    }

    req.superAdmin = superAdmin;
    return next();
  } catch (error) {
    log.error("[super-admin] auth error:", error.message);
    return res.status(500).json({ success: false, message: "Authentication failed." });
  }
};

module.exports = { requireSuperAdmin, signSession, cookieOptions, getCookieName };
