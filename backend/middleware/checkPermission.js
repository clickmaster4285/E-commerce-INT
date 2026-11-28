const { OWNER_ROLE, ADMIN_ROLES, STAFF_ROLES, ASSIGNABLE_ROLES, isOwnerRole, isAdminRole, isStaffRole } = require("../utils/roles");
/**
 * Unified Permission Middleware
 * Compatible with separated User/Employee architecture
 */

// Customer (userType "user") bhi isi middleware se guzarta hai sirf apni profile
// ke liye (PUT /users/profile, /users/password). Baaki har key staff ki hai —
// pehle customer ke paas permissions object hi nahi tha → `=== false` kabhi
// true nahi hota tha aur customer token admin APIs par chal jata tha.
const CUSTOMER_ALLOWED_KEYS = new Set(["profile"]);

// `order` / `orders` — purane records me dono keys ho sakti hain (§5.4)
const PERMISSION_ALIASES = {
  order: "orders",
  orders: "order",
};

const resolvePermissionValue = (permissions, permissionKey) => {
  if (!permissions || typeof permissions !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(permissions, permissionKey)) {
    return permissions[permissionKey];
  }
  const alias = PERMISSION_ALIASES[permissionKey];
  if (alias && Object.prototype.hasOwnProperty.call(permissions, alias)) {
    return permissions[alias];
  }
  return undefined;
};

// ----------------------------------------------------------
// hasPermission — ek jagah semantics (requirePermission + controllers dono use karein)
//   mode "denyFalse"   (default): admin always; baqi sirf tab block jab value === false
//                      (undefined / missing = allow, legacy records).
//   mode "requireTrue" (finance, store-edit jaise sensitive keys): admin always; baqi
//                      ko value === true chahiye, missing/false = deny.
// ----------------------------------------------------------
const hasPermission = (user, permissionKey, mode = "denyFalse") => {
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  const value = resolvePermissionValue(user.permissions, permissionKey);
  return mode === "requireTrue" ? value === true : value !== false;
};

// ✅ Specific permission check — requirePermission(key, { mode, message })
const requirePermission = (permissionKey, { mode = "denyFalse", message } = {}) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (req.userType !== "employee") {
      if (CUSTOMER_ALLOWED_KEYS.has(permissionKey)) return next();
      return res.status(403).json({
        success: false,
        message: "Access denied. Staff account required.",
      });
    }

    // Admin bypass + denyFalse (undefined = allow, legacy) / requireTrue (sirf true)
    if (!hasPermission(req.user, permissionKey, mode)) {
      return res.status(403).json({
        success: false,
        message: message || `Access denied. You don't have '${permissionKey}' permission. Please contact an administrator.`,
      });
    }

    next();
  };
};

// Purana naam — behavior same (denyFalse)
const checkPermission = (permissionKey) => requirePermission(permissionKey);

// ✅ Role-based check (admin + manager + staff)
const staffPermissionCheck = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const role = req.user.role?.toLowerCase();
  if (isStaffRole(role)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied. Only admin, manager and staff can perform this action.",
  });
};

module.exports = {
  checkPermission,
  staffPermissionCheck,
  requirePermission,
  hasPermission,
  resolvePermissionValue,
};