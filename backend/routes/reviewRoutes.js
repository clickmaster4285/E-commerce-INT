const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const {
  getProductReviews,
  getMyReviews,
  getAdminReviews,
  getAdminReviewById,
  createReview,
  updateReview,
  deleteReview,
  toggleHelpful,
  setReviewStatus,
  setReviewResponse,
} = require("../controllers/reviewController");
const {
  reviewMediaUpload,
  saveReviewMedia,
} = require("../middleware/reviewUploadMiddleware");
const { limiters } = require("../middleware/rateLimit");

const router = express.Router();

// ==========================================
// 🛡️ ADMIN — saari reviews (paginated + stats)
// ✅ "/:id" routes se PEHLE — warna "admin" ko id samajh liya jayega.
// ==========================================
router.get("/admin/all", authMiddleware, checkPermission("products"), getAdminReviews);
router.get("/admin/:id", authMiddleware, checkPermission("products"), getAdminReviewById);

// ==========================================
// 🌐 PUBLIC — reviews + summary for one product
// ==========================================
router.get("/product/:productId", getProductReviews);

// ==========================================
// 🔒 CUSTOMER — current user ki apni reviews (product_id → rating map)
// ✅ "/:id" routes se PEHLE — warna "my" ko id samajh liya jayega.
// ==========================================
router.get("/my", authMiddleware, getMyReviews);

// ==========================================
// 🔒 CUSTOMER — write a review (images + video go to uploads/reviews/)
// ==========================================
const handleMulterError = (err, req, res, next) => {
  if (!err) return next();
  const msg = err.message || "File upload failed";
  if (err.code === "LIMIT_FILE_SIZE" || /only|allowed|Unknown field/i.test(msg)) {
    return res.status(400).json({ success: false, message: msg });
  }
  return res.status(400).json({ success: false, message: msg });
};

router.post(
  "/",
  authMiddleware,
  (req, res, next) => reviewMediaUpload(req, res, (err) => handleMulterError(err, req, res, next)),
  saveReviewMedia,
  limiters.reviewCreate,
  createReview,
);
router.put(
  "/:id",
  authMiddleware,
  (req, res, next) => reviewMediaUpload(req, res, (err) => handleMulterError(err, req, res, next)),
  saveReviewMedia,
  updateReview,
);
router.delete("/:id", authMiddleware, deleteReview);
router.post("/:id/helpful", authMiddleware, toggleHelpful);

// ==========================================
// 🛡️ ADMIN — hide/unhide a review
// ==========================================
router.patch("/:id/status", authMiddleware, checkPermission("products"), setReviewStatus);
router.patch("/:id/response", authMiddleware, checkPermission("products"), setReviewResponse);

module.exports = router;
