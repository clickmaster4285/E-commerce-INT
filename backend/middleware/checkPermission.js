const checkPermission = (permissionKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // ✅ Admin ko hamesha full access
    if (req.user.role === "admin") {
      return next();
    }

    // ✅ Staff/User ke liye permission check
    const hasPermission = req.user.permissions?.[permissionKey];

    if (!hasPermission) {
      return res.status(403).json({
        message: `Access denied. You need '${permissionKey}' permission.`,
      });
    }

    next();
  };
};

module.exports = checkPermission;