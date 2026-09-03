const express = require("express");
const {
  createUser,
  loginUser,
  loginAdmin,
  refreshAccessToken,
  logoutUser,
  getProfile,
  getMe,
  updateProfile,
  changePassword,
  toggle2FA,
  googleLogin,
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

const router = express.Router();

// ==========================================
//  PUBLIC ROUTES
// ==========================================
router.post("/register", createUser);
router.post("/login", loginUser);
router.post("/admin/login", loginAdmin);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", logoutUser);
router.post("/google-login", googleLogin);

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
router.put("/2fa", authMiddleware, checkPermission("profile"), toggle2FA);
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
