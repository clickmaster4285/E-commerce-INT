const express = require("express");
const {
  createUser,
  loginUser,
  loginAdmin,
  refreshAccessToken,
  refreshAdminAccessToken,
  logoutUser,
  getProfile,
  getMe,
  updateProfile,
  changePassword,
  googleLogin,
  googleCustomerLogin,
  updatePhone,
  createCheckoutDraft,
  getCheckoutDrafts,
  getCheckoutDraft,
  updateCheckoutDraft,
  deleteCheckoutDraft,
  getWishlist,
  toggleWishlist,
  updateProfileREST,
  changePasswordREST,
} = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const { limiters } = require("../middleware/rateLimit");
const {
  sendEmailVerificationOtp,
  verifyEmailVerificationOtp,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
  getEmailHealth,
} = require("../controllers/otpController");

const router = express.Router();

// ==========================================
//  PUBLIC ROUTES
// ==========================================
router.post("/register", limiters.register, createUser);
router.post("/login", limiters.login, loginUser);
router.post("/admin/login", limiters.adminLogin, loginAdmin);
router.post("/refresh-token", refreshAccessToken);
// ✅ ADMIN refresh alias — purana endpoint untouched (compat). Sirf
// employee-type refresh token accept karta hai (user going admin panel
// ke liye nahi). Shape/logic purani jaisi.
router.post("/admin/refresh-token", refreshAdminAccessToken);
router.post("/logout", logoutUser);
router.post("/google-login", limiters.adminLogin, googleLogin);
router.post("/google-customer-login", limiters.googleLogin, googleCustomerLogin);

// ==========================================
// 📧 EMAIL HEALTH (SMTP diagnose — bina DB ke bhi chalega)
// ==========================================
router.get("/email-health", getEmailHealth);

// ==========================================
// 📧 EMAIL VERIFICATION (OTP — 5 min expiry)
// ==========================================
router.post("/send-email-otp", limiters.sendEmailOtp, sendEmailVerificationOtp);
router.post("/verify-email-otp", limiters.verifyEmailOtp, verifyEmailVerificationOtp);

// ==========================================
// 🔐 FORGOT PASSWORD (OTP — 5 min expiry)
// ==========================================
router.post("/forgot-password", limiters.forgotPassword, sendForgotPasswordOtp);
router.post("/verify-reset-otp", limiters.verifyResetOtp, verifyForgotPasswordOtp);
router.post("/reset-password", limiters.resetPassword, resetPasswordWithOtp);

// ==========================================
// 🔒 PROTECTED ROUTES
// ==========================================
router.get("/me", authMiddleware, getMe);
router.get("/profile", authMiddleware, getProfile);
router.put(
  "/profile",
  authMiddleware,
  checkPermission("profile"),
  updateProfile,
);
router.put(
  "/password",
  authMiddleware,
  checkPermission("profile"),
  changePassword,
);
router.put("/phone", authMiddleware, updatePhone);

// ✅ MULTIPLE CHECKOUT DRAFTS
router.post("/checkout-drafts", authMiddleware, createCheckoutDraft);
router.get("/checkout-drafts", authMiddleware, getCheckoutDrafts);
router.get("/checkout-drafts/:id", authMiddleware, getCheckoutDraft);
router.put("/checkout-drafts/:id", authMiddleware, updateCheckoutDraft);
router.delete("/checkout-drafts/:id", authMiddleware, deleteCheckoutDraft);
// ✅ NEW: Wishlist routes
router.get("/wishlist", authMiddleware, getWishlist);
router.put("/wishlist/toggle", authMiddleware, toggleWishlist);
router.put("/profile", authMiddleware, updateProfileREST);
router.post("/change-password", authMiddleware, changePasswordREST);
// ==========================================
// 🛡️ 404 HANDLER
// ==========================================
router.use((req, res) => {
  res
    .status(404)
    .json({
      success: false,
      message: `User API endpoint not found: ${req.method} ${req.originalUrl}`,
    });
});

module.exports = router;