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

// ✅ Specific permission check
const checkPermission = (permissionKey) => {
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

    // Admin bypass
    if (isAdminRole(req.user.role)) {
      return next();
    }

    // undefined = allow (legacy), only explicitly false blocks
    if (resolvePermissionValue(req.user.permissions, permissionKey) === false) {
      return res.status(403).json({
        success: false,
        message: `Access denied. You don't have '${permissionKey}' permission. Please contact an administrator.`,
      });
    }

    next();
  };
};

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
  requirePermission: checkPermission, // Backward compatibility
  resolvePermissionValue,
};