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
  createStoreHandoff,
  exchangeStoreHandoff,
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
router.post("/register", createUser);
router.post("/login", limiters.login, loginUser);
router.post("/admin/login", limiters.adminLogin, loginAdmin);
router.post("/refresh-token", refreshAccessToken);
// ✅ ADMIN refresh alias — purana endpoint untouched (compat). Sirf
// employee-type refresh token accept karta hai (user going admin panel
// ke liye nahi). Shape/logic purani jaisi.
router.post("/admin/refresh-token", refreshAdminAccessToken);
// Multi-tenant: platform par login ke baad store subdomain ke admin panel me bhejna
router.post("/admin/handoff", authMiddleware.requireAdmin, createStoreHandoff);
router.post("/admin/handoff/exchange", limiters.adminLogin, exchangeStoreHandoff);
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
router.post("/send-email-otp", sendEmailVerificationOtp);
router.post("/verify-email-otp", verifyEmailVerificationOtp);

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
router.put("/phone", authMiddleware.requireUser, updatePhone);

// ✅ MULTIPLE CHECKOUT DRAFTS
router.post("/checkout-drafts", authMiddleware.requireUser, createCheckoutDraft);
router.get("/checkout-drafts", authMiddleware.requireUser, getCheckoutDrafts);
router.get("/checkout-drafts/:id", authMiddleware.requireUser, getCheckoutDraft);
router.put("/checkout-drafts/:id", authMiddleware.requireUser, updateCheckoutDraft);
router.delete("/checkout-drafts/:id", authMiddleware.requireUser, deleteCheckoutDraft);
// ✅ NEW: Wishlist routes
router.get("/wishlist", authMiddleware.requireUser, getWishlist);
router.put("/wishlist/toggle", authMiddleware.requireUser, toggleWishlist);
router.put("/profile", authMiddleware.requireUser, updateProfileREST);
router.post("/change-password", authMiddleware.requireUser, changePasswordREST);
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