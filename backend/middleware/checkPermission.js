/**
 * Unified Permission Middleware
 * Compatible with separated User/Employee architecture
 */

// Customer (userType "user") bhi isi middleware se guzarta hai sirf apni profile
// ke liye (PUT /users/profile, /users/password). Baaki har key staff ki hai —
// pehle customer ke paas permissions object hi nahi tha → `=== false` kabhi
// true nahi hota tha aur customer token admin APIs par chal jata tha.
const CUSTOMER_ALLOWED_KEYS = new Set(["profile"]);

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
    if (req.user.role?.toLowerCase() === "admin") {
      return next();
    }

    // undefined = allow (legacy), only explicitly false blocks
    if (req.user.permissions?.[permissionKey] === false) {
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
  if (role === "admin" || role === "manager" || role === "staff") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied. Only admin, manager and staff can perform this action.",
  });
};

// ✅ Admin OR any-permission gate
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication failed. User not found.",
    });
  }

  if (req.user.role?.toLowerCase() === "admin") {
    return next();
  }

  const permissions = req.user.permissions || {};
  const hasAnyPermission = Object.values(permissions).some((val) => val === true);

  if (!hasAnyPermission) {
    return res.status(403).json({
      success: false,
      message: "Access Denied! You have no permissions enabled. Please contact your admin.",
    });
  }

  next();
};

module.exports = {
  checkPermission,
  staffPermissionCheck,
  adminMiddleware,
  requirePermission: checkPermission, // Backward compatibility
};