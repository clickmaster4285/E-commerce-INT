// backend/routes/userRoutes.js
const express = require("express");
const {
  createUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  getProfile,
  getMe,
  updateProfile,
  changePassword,
  toggle2FA,
  googleLogin
} = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");

const router = express.Router();

// ==========================================
//  PUBLIC ROUTES (No Auth Required)
// ==========================================
router.post("/register", createUser);
router.post("/login", loginUser);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", logoutUser);
router.post("/google-login", googleLogin);  
// ==========================================
// 🔒 PROTECTED ROUTES (Auth Required)
// ==========================================

// ✅ GET /api/users/me — Har logged-in user apna data dekh sake (NO permission)
router.get("/me", authMiddleware, getMe);

// ✅ GET /api/users/profile — Har logged-in user apna profile dekh sake (NO permission)
router.get("/profile", authMiddleware, getProfile);

// ✅ PUT /api/users/profile — Permission required
router.put("/profile", authMiddleware, checkPermission("profile"), updateProfile);

// ✅ PUT /api/users/password — Permission required
router.put("/password", authMiddleware, checkPermission("profile"), changePassword);

// ✅ PUT /api/users/2fa — Permission required
router.put("/2fa", authMiddleware, checkPermission("profile"), toggle2FA);

// ==========================================
// 🛡️ 404 HANDLER
// ==========================================
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `User API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

module.exports = router;