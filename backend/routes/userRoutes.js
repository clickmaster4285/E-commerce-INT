const express = require("express");
const { checkRegistration, createUser, loginUser, googleCustomerLogin, refreshAccessToken, logoutUser, updatePhone } = require("../controllers/customerAuthController");
const { loginAdmin, refreshAdminAccessToken, googleLogin, createStoreHandoff, exchangeStoreHandoff } = require("../controllers/adminAuthController");
const { getProfile, getMe, updateProfile, changePassword, getProfileInfo, updateProfileInfo, changePasswordSocket, updateProfileREST, changePasswordREST } = require("../controllers/profileController");
const { getWishlist, toggleWishlist } = require("../controllers/wishlistController");
const { createCheckoutDraft, getCheckoutDrafts, getCheckoutDraft, updateCheckoutDraft, deleteCheckoutDraft } = require("../controllers/checkoutDraftController");
const authMiddleware = require("../middleware/authMiddleware");
const { allowPendingSeller } = require("../middleware/allowPendingSeller");
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
router.post("/register/check", limiters.registerCheck, checkRegistration);
router.post("/login", limiters.login, loginUser);
router.post("/admin/login", limiters.adminLogin, loginAdmin);
router.post("/refresh-token", refreshAccessToken);
router.post("/admin/refresh-token", refreshAdminAccessToken);
router.post("/admin/handoff", allowPendingSeller, authMiddleware.requireAdmin, createStoreHandoff);
router.post("/admin/handoff/exchange", limiters.adminLogin, exchangeStoreHandoff);
router.post("/logout", logoutUser);
router.post("/google-login", limiters.adminLogin, googleLogin);
router.post("/google-customer-login", limiters.googleLogin, googleCustomerLogin);

// ==========================================
// EMAIL HEALTH
// ==========================================
router.get("/email-health", getEmailHealth);

// ==========================================
// EMAIL VERIFICATION (OTP)
// ==========================================
router.post("/send-email-otp", sendEmailVerificationOtp);
router.post("/verify-email-otp", verifyEmailVerificationOtp);

// ==========================================
// FORGOT PASSWORD (OTP)
// ==========================================
router.post("/forgot-password", limiters.forgotPassword, sendForgotPasswordOtp);
router.post("/verify-reset-otp", limiters.verifyResetOtp, verifyForgotPasswordOtp);
router.post("/reset-password", limiters.resetPassword, resetPasswordWithOtp);

// ==========================================
// PROTECTED ROUTES
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

// MULTIPLE CHECKOUT DRAFTS
router.post("/checkout-drafts", authMiddleware.requireUser, createCheckoutDraft);
router.get("/checkout-drafts", authMiddleware.requireUser, getCheckoutDrafts);
router.get("/checkout-drafts/:id", authMiddleware.requireUser, getCheckoutDraft);
router.put("/checkout-drafts/:id", authMiddleware.requireUser, updateCheckoutDraft);
router.delete("/checkout-drafts/:id", authMiddleware.requireUser, deleteCheckoutDraft);
// Wishlist routes
router.get("/wishlist", authMiddleware.requireUser, getWishlist);
router.put("/wishlist/toggle", authMiddleware.requireUser, toggleWishlist);
router.post("/change-password", authMiddleware.requireUser, changePasswordREST);
// ==========================================
// 404 HANDLER
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
