const express = require("express");
const {
  checkRegistration,
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
  getWishlistIds,
  getWishlist,
  toggleWishlist,
  changePasswordREST,
  createStoreHandoff,
  exchangeStoreHandoff,
} = require("../controllers/userController");
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
router.post("/register", limiters.register, createUser);
// Signup step 1 — email/username/phone pehle se liye hue? (same limiter as register)
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
// Limiters pehle define the lekin mount nahi the → email bombing / OTP guessing khula tha
router.post("/send-email-otp", limiters.sendEmailOtp, sendEmailVerificationOtp);
router.post("/verify-email-otp", limiters.verifyEmailOtp, verifyEmailVerificationOtp);

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
// ✅ NEW: Wishlist routes
router.get("/wishlist/ids", authMiddleware.requireUser, getWishlistIds);
router.get("/wishlist", authMiddleware.requireUser, getWishlist);
router.put("/wishlist/toggle", authMiddleware.requireUser, toggleWishlist);
router.post("/change-password", authMiddleware.requireUser, changePasswordREST);

// 404 global handler (app.js) sambhalta hai

module.exports = router;
