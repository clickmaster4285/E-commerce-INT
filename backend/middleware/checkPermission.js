const checkPermission = (permissionKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (req.user.role === "admin") {
      return next();
    }

    // ✅ FIX: undefined ko allow karo (purana user), sirf explicitly false block karo
    const hasPermission = req.user.permissions?.[permissionKey];

    if (hasPermission === false) {
      return res.status(403).json({
        success: false,
        message: `Access denied. You don't have '${permissionKey}' permission. Please contact an administrator or another staff member to grant you access.`,
      });
    }

    next();
  };
};

const staffPermissionCheck = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const userRole = req.user.role?.toLowerCase();

  if (userRole === "admin" || userRole === "staff") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access denied. Only admin and staff can perform this action.",
  });
};

module.exports = { checkPermission, staffPermissionCheck };