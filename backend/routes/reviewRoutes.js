const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
  toggleHelpful,
  setReviewStatus,
} = require("../controllers/reviewController");
const {
  reviewMediaUpload,
  saveReviewMedia,
} = require("../middleware/reviewUploadMiddleware");
const { limiters } = require("../middleware/rateLimit");

const router = express.Router();

// ==========================================
// 🌐 PUBLIC — reviews + summary for one product
// ==========================================
router.get("/product/:productId", getProductReviews);

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
router.put("/:id", authMiddleware, updateReview);
router.delete("/:id", authMiddleware, deleteReview);
router.post("/:id/helpful", authMiddleware, toggleHelpful);

// ==========================================
// 🛡️ ADMIN — hide/unhide a review
// ==========================================
router.patch("/:id/status", authMiddleware, checkPermission("products"), setReviewStatus);

module.exports = router;
