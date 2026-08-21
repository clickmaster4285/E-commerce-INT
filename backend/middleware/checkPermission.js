/**
 * Unified Permission Middleware
 * Compatible with separated User/Employee architecture
 */

// ✅ Specific permission check
const checkPermission = (permissionKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
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