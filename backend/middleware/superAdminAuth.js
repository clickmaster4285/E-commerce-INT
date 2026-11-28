// ==========================================================
// SUPER ADMIN AUTH — apna audience ("superadmin"), apne secrets
// (JWT_SA_ACCESS_SECRET / JWT_SA_REFRESH_SECRET) aur apne cookies
// (sa_at / sa_rt / sa_sess). Seller/customer token yahan kabhi pass nahi
// hota — aud + typ + secret teeno alag. Utils: utils/tokens.js
// ==========================================================

const SuperAdmin = require("../models/SuperAdmin");
const log = require("../utils/logger");
const { AUDIENCES, verifyAccess } = require("../utils/tokens");

// Every superadmin request must present a valid superadmin access token AND the
// account must still exist + be active.
const requireSuperAdmin = async (req, res, next) => {
  try {
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) token = authHeader.slice(7).trim();
    if (!token) token = req.cookies?.[AUDIENCES.superadmin.cookies.access] || null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Super Admin session required." });
    }

    let payload;
    try {
      payload = verifyAccess("superadmin", token);
    } catch (error) {
      if (error.code === "JWT_SECRET_MISSING") throw error;
      return res.status(401).json({ success: false, message: "Session expired. Please log in again." });
    }

    // activities array (100 tak entries) har request par load nahi hoti
    const superAdmin = await SuperAdmin.findById(payload.userId).select("-passwordHash -activities").lean();
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
    req.sessionId = payload.sid || null;
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

// Tokens / cookies ab utils/tokens.js se (aud "superadmin": sa_at / sa_rt / sa_sess)
module.exports = { requireSuperAdmin, requireSuperAdminRole };
