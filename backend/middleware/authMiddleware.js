// ==========================================================
// AUTH MIDDLEWARE — audience-aware (customer vs admin), store-bound
// ----------------------------------------------------------
//   authMiddleware          → admin YA customer (frontend `X-Auth-Aud` header
//                             batata hai kaun sa; header na ho to admin → user)
//   authMiddleware.requireAdmin → sirf employee/admin session (a_at)
//   authMiddleware.requireUser  → sirf customer session (u_at)
//
// Har token:
//   • apne audience ke secret + aud + typ=access se verify (utils/tokens.js)
//   • store host par token ka storeId === req.store._id (dusre store ka token 401)
//   • DB se fresh entity (tenant-scoped findById) — deleted/inactive/blocked block
// ==========================================================

const User = require("../models/User");
const Employee = require("../models/Employee");
const log = require("../utils/logger");
const { AUDIENCES, verifyAccess } = require("../utils/tokens");

const MODEL_FOR = { admin: () => Employee, user: () => User };
const TYPE_FOR = { admin: "employee", user: "user" };

function bearerToken(req) {
  const header = req.headers.authorization;
  return header && header.startsWith("Bearer ") ? header.slice(7).trim() : null;
}

/** Kaun se audience try karne hain — X-Auth-Aud header hint (allowed ke andar) */
function audiencesFor(req, allowed) {
  const hint = String(req.headers["x-auth-aud"] || "").trim().toLowerCase();
  return allowed.includes(hint) ? [hint] : allowed;
}

/** Pehla valid access token. Koi valid na ho to pehli error (expired → frontend refresh karega). */
function findAccessToken(req, audiences) {
  const bearer = bearerToken(req);
  let firstError = null;
  let sawToken = false;
  for (const aud of audiences) {
    const raw = bearer || req.cookies?.[AUDIENCES[aud].cookies.access];
    if (!raw) continue;
    sawToken = true;
    try {
      return { aud, decoded: verifyAccess(aud, raw) };
    } catch (error) {
      if (!firstError) firstError = error;
    }
  }
  return { error: firstError, sawToken };
}

const createAuth = (allowedAudiences) => async (req, res, next) => {
  try {
    const found = findAccessToken(req, audiencesFor(req, allowedAudiences));
    if (!found.decoded) {
      if (!found.sawToken) return res.status(401).json({ success: false, message: "Token required" });
      throw found.error;
    }
    const { aud, decoded } = found;

    // Store binding — token ka store aur request ka store ek hi hon
    if (req.store && String(decoded.storeId || "") !== String(req.store._id)) {
      return res.status(401).json({ success: false, message: "This session does not belong to this store." });
    }

    // Tenant-scoped lookup: store host par sirf isi store ka record milta hai
    const entity = await MODEL_FOR[aud]().findById(decoded.userId).select("-password -activities").lean();

    if (!entity || entity.is_deleted) {
      return res.status(401).json({ success: false, message: "User not found or deleted" });
    }
    if (req.store && String(entity.storeId || "") !== String(req.store._id)) {
      return res.status(401).json({ success: false, message: "User not found or deleted" });
    }

    // "inactive" (admin deactivated) aur "blocked" (super-admin suspended)
    // dono live sessions ko bhi block karte hain
    if (entity.status === "inactive") {
      return res.status(403).json({ success: false, message: "Your account is inactive. Please contact admin." });
    }
    if (entity.status === "blocked") {
      return res.status(403).json({ success: false, message: "Your account is blocked. Please contact admin." });
    }

    const userType = TYPE_FOR[aud];
    req.user = { ...entity, tenant_id: entity.storeId || null };
    req.userType = userType;
    req.authAud = aud;
    req.sessionId = decoded.sid || null;

    // Pending sellers can browse the admin panel but cannot change anything.
    if (userType === "employee" && entity.seller_pending) {
      const safeMethods = ["GET", "HEAD", "OPTIONS"];
      if (!safeMethods.includes(String(req.method || "GET").toUpperCase())) {
        return res.status(403).json({
          success: false,
          code: "SELLER_PENDING",
          message: "Your seller application is pending Super Admin approval. You can view all pages, but changes are locked until it is approved.",
        });
      }
    }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      // Expected event (silent refresh flow) — terminal noise nahi
      log.debug("Auth token expired (expected, silent refresh)");
      return res.status(401).json({ success: false, message: "Token expired. Please login again." });
    }
    if (error.name === "JsonWebTokenError" || error.name === "NotBeforeError") {
      log.warn("Auth invalid token:", error.message);
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    log.error("Auth Middleware Error:", error.message);
    return res.status(500).json({ success: false, message: "Authentication failed" });
  }
};

const authMiddleware = createAuth(["admin", "user"]);
authMiddleware.requireAdmin = createAuth(["admin"]);
authMiddleware.requireUser = createAuth(["user"]);
authMiddleware.createAuth = createAuth;

module.exports = authMiddleware;
