// ==========================================================
// services/auth.js — shared login / session helpers (§5.4)
// ----------------------------------------------------------
// Controllers HTTP wrap karte hain; yahan credential checks + public user shape.
// ==========================================================

const bcrypt = require("bcryptjs");
const tokens = require("../utils/tokens");
const User = require("../models/User");
const Employee = require("../models/Employee");
const SellerApplication = require("../models/SellerApplication");
const { isStaffRole } = require("../utils/roles");
const { findPlatformEmployee } = require("../utils/sellerOwnership");

/** Login response ka `user` object — password/activities kabhi nahi. */
function toPublicUser(doc, { avatar } = {}) {
  return {
    id: doc._id,
    name: doc.name,
    username: doc.username,
    phone: doc.phone,
    email: doc.email,
    role: doc.role,
    avatar: avatar !== undefined ? avatar : doc.avatar || null,
  };
}

/** Session cookies/token issue (tokens.issueSession ka wrapper). */
function issueSession(req, res, aud, entity) {
  return tokens.issueSession(req, res, aud, entity);
}

/**
 * Customer password login. Returns `{ ok, status, body, user? }`.
 * Caller issues session + JSON when ok.
 */
async function authenticateCustomer({ email, password, storeRequired = true, store = null } = {}) {
  if (!email || !password) {
    return { ok: false, status: 400, body: { success: false, message: "Please provide email and password" } };
  }
  if (storeRequired && !store) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        code: "STORE_REQUIRED",
        message: "Customer login must be on a store host.",
      },
    };
  }
  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select("+password");
  if (!user) {
    return { ok: false, status: 401, body: { success: false, message: "User not found" } };
  }
  if (user.role !== "user") {
    return {
      ok: false,
      status: 403,
      body: {
        success: false,
        message: "This login is only for customers. Please use admin panel.",
      },
    };
  }
  if (user.status === "inactive" || user.status === "blocked" || user.is_deleted) {
    try {
      const app = await SellerApplication.findOne({ email: user.email }).select("status").lean();
      if (user.status === "blocked" && app && String(app.status).toLowerCase() === "pending") {
        return {
          ok: false,
          status: 403,
          body: {
            success: false,
            code: "SELLER_PENDING",
            message: "Your seller application is under review. You will be notified by email once it is approved.",
          },
        };
      }
    } catch (_) { /* ignore lookup */ }
    return {
      ok: false,
      status: 403,
      body: { success: false, message: "Your account is inactive. Please contact administrator." },
    };
  }
  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    return { ok: false, status: 401, body: { success: false, message: "Password incorrect" } };
  }
  if (user.emailVerified === false) {
    return {
      ok: false,
      status: 403,
      body: {
        success: false,
        needsVerification: true,
        email: user.email,
        message: "Your email is not verified. Please verify it with the code we sent to your email.",
      },
    };
  }
  return { ok: true, status: 200, user };
}

/**
 * Admin/staff password login. Returns `{ ok, status, body, employee? }`.
 */
async function authenticateAdmin({ email, password, store = null } = {}) {
  if (!email || !password) {
    return { ok: false, status: 400, body: { success: false, message: "Please provide email and password" } };
  }
  let employee;
  if (store) {
    employee = await Employee.findOne({ email: String(email).toLowerCase().trim() }).select("+password -activities");
  } else {
    const found = await findPlatformEmployee(email);
    if (found.ambiguous) {
      return {
        ok: false,
        status: 409,
        body: {
          success: false,
          message: "This email is linked to more than one store. Please sign in from your store's address.",
        },
      };
    }
    employee = found.employee;
  }
  if (!employee) {
    return { ok: false, status: 401, body: { success: false, message: "User not found" } };
  }
  if (!employee.password) {
    return { ok: false, status: 401, body: { success: false, message: "Password incorrect" } };
  }
  if (!isStaffRole(employee.role)) {
    return {
      ok: false,
      status: 403,
      body: {
        success: false,
        message: "Admin access denied. Please use customer login page.",
      },
    };
  }
  if (employee.status === "inactive" || employee.is_deleted) {
    return {
      ok: false,
      status: 403,
      body: {
        success: false,
        message: "Your account is inactive. Please contact administrator.",
      },
    };
  }
  const isValid = await bcrypt.compare(password, employee.password);
  if (!isValid) {
    return { ok: false, status: 401, body: { success: false, message: "Password incorrect" } };
  }
  return { ok: true, status: 200, employee };
}

module.exports = {
  toPublicUser,
  issueSession,
  authenticateCustomer,
  authenticateAdmin,
};
