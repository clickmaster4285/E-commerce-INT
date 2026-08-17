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

// ✅ GET /api/users/me - Frontend profile page ke liye (primary endpoint)
router.get("/me", authMiddleware, getMe);

// ✅ GET /api/users/profile - Legacy endpoint (backward compatibility)
router.get("/profile", authMiddleware, getProfile);

// ✅ PUT /api/users/profile - Update profile + store info
router.put("/profile", authMiddleware, updateProfile);

// ✅ PUT /api/users/password - Change password
router.put("/password", authMiddleware, changePassword);

// ✅ PUT /api/users/2fa - Toggle two-factor authentication
router.put("/2fa", authMiddleware, toggle2FA);

// ==========================================
// 🛡️ 404 HANDLER (Is route file ke liye)
// ==========================================
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `User API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

module.exports = router;