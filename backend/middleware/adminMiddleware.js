const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed. User not found.',
    });
  }

  const userRole = req.user.role?.toLowerCase();

  // ✅ Admin can do everything
  if (userRole === 'admin') {
    return next();
  }

  // ✅ For non-admin users, check if they have ANY permission enabled
  const permissions = req.user.permissions || {};
  const hasAnyPermission = Object.values(permissions).some((val) => val === true);

  if (!hasAnyPermission) {
    return res.status(403).json({
      success: false,
      message:
        'Access Denied! You have no permissions enabled. Please contact your admin or staff manager to request access.',
    });
  }

  return next();
};

// ==========================================
// ✅ PERMISSION CHECK FOR SPECIFIC ROUTES
// Usage: app.use('/api/products', requirePermission('products'), router)
// ==========================================
const requirePermission = (permissionKey) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. User not found.',
      });
    }

    const userRole = req.user.role?.toLowerCase();

    // Admin bypass
    if (userRole === 'admin') {
      return next();
    }

    const permissions = req.user.permissions || {};

    if (permissions[permissionKey] === false) {
      return res.status(403).json({
        success: false,
        message: `Access Denied! You don't have permission to access ${permissionKey}. Please contact your admin or staff manager to request access.`,
      });
    }

    return next();
  };
};

module.exports = adminMiddleware;
module.exports.requirePermission = requirePermission;