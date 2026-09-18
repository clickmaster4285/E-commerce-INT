const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Employee = require("../models/Employee");

const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }

    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: "Token required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userType = decoded.type || 'user';

    let entity = null;
    if (userType === 'employee') {
      entity = await Employee.findById(decoded.userId).select("-password -activities").lean();
    } else {
      entity = await User.findById(decoded.userId).select("-password -activities").lean();
    }

    if (!entity || entity.is_deleted) {
      return res.status(401).json({ success: false, message: "User not found or deleted" });
    }

    if (entity.status === "inactive") {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact admin.",
      });
    }

    req.user = {
      ...entity,
      tenant_id: entity.storeId || null,
    };
    req.userType = userType;

    next();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error(" Auth Middleware Error:", error.message);
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired. Please login again." });
    }
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    return res.status(500).json({ success: false, message: "Authentication failed" });
  }
};

module.exports = authMiddleware;
