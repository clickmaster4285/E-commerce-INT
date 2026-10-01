const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs-extra");
const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");

// ==========================================
// ⭐ PRODUCT REVIEWS (delivered orders only)
// ==========================================

const toObjectId = (id) => {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return null;
  }
};

// ✅ Only a user with a delivered order can write a review
const hasDeliveredPurchase = async (userId, productId) => {
  const pid = toObjectId(productId);
  if (!pid) return false;
  const order = await Order.findOne({
    user_id: toObjectId(userId),
    status: "delivered",
    "items.product_id": pid,
  })
    .select("_id")
    .lean();
  return !!order;
};

const reviewFilter = (productId) => ({
  product_id: toObjectId(productId),
  status: "active",
  is_deleted: { $ne: true },
});

const calcSummary = (reviews) => {
  const count = reviews.length;
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  reviews.forEach((r) => {
    const rating = Number(r.rating) || 0;
    sum += rating;
    if (distribution[rating] !== undefined) distribution[rating] += 1;
  });
  return {
    avg: count ? Math.round((sum / count) * 10) / 10 : 0,
    count,
    distribution,
  };
};

// ==========================================
// 🌐 PUBLIC — ek product ke reviews + summary
// GET /api/reviews/product/:productId?page=&limit=&sort=
// ==========================================
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!toObjectId(productId)) {
      return res.status(400).json({ success: false, message: "Invalid product ID" });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const ratingParam = parseInt(req.query.rating, 10);
    const sortKey = String(req.query.sort || "newest");
    const sortMap = {
      newest: { created_at: -1 },
      helpful: { helpfulCount: -1, created_at: -1 },
      high: { rating: -1, created_at: -1 },
      low: { rating: 1, created_at: -1 },
    };
    const sort = sortMap[sortKey] || sortMap.newest;

    // ✅ Base filter = summary ke liye; rating filter sirf list par lagta hai
    const baseFilter = reviewFilter(productId);
    const filter = { ...baseFilter };
    if (Number.isInteger(ratingParam) && ratingParam >= 1 && ratingParam <= 5) {
      filter.rating = ratingParam;
    }
    const total = await Review.countDocuments(filter);

    const reviews = await Review.find(filter)
      .populate("user_id", "name avatar")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // ✅ Summary is computed from all reviews (not just the current page / filter)
    const allRatings = await Review.find(baseFilter).select("rating").lean();
    const summary = calcSummary(allRatings);

    return res.status(200).json({
      success: true,
      summary,
      reviews,
      pagination: {
        total,
        page,
        limit,
        pages: Math.max(1, Math.ceil(total / limit)),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("❌ [getProductReviews] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
};

// ==========================================
// 🔒 CREATE — login + delivered order required
// POST /api/reviews (multipart: images max 5, videos max 1)
// ==========================================
const createReview = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Login required" });
    }
    const { product_id, rating, title, comment } = req.body;
    if (!toObjectId(product_id)) {
      return res.status(400).json({ success: false, message: "Valid product_id required" });
    }
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
    }
    const cleanComment = String(comment || "").trim();
    const cleanTitle = String(title || "").trim().slice(0, 120);
    const media = req.reviewMedia || { images: [], videos: [] };
    if (!cleanComment && !media.images.length && !media.videos.length) {
      return res.status(400).json({
        success: false,
        message: "Please add a comment or a photo/video with your review",
      });
    }

    const product = await Product.findOne({
      _id: product_id,
      is_deleted: { $ne: true },
    })
      .select("_id")
      .lean();
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const purchased = await hasDeliveredPurchase(userId, product_id);
    if (!purchased) {
      return res.status(403).json({
        success: false,
        message: "Only customers with a delivered order can write a review",
      });
    }

    const existing = await Review.findOne({
      product_id: toObjectId(product_id),
      user_id: toObjectId(userId),
      is_deleted: { $ne: true },
    }).lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product — you can edit your review",
        reviewId: existing._id,
      });
    }

    const review = await Review.create({
      product_id: toObjectId(product_id),
      user_id: toObjectId(userId),
      rating: ratingNum,
      title: cleanTitle,
      comment: cleanComment,
      images: media.images || [],
      videos: media.videos || [],
      verifiedPurchase: true,
    });

    const populated = await Review.findById(review._id)
      .populate("user_id", "name avatar")
      .lean();

    return res.status(201).json({ success: true, message: "Review added", review: populated });
  } catch (error) {
    // ✅ Convert multer fileFilter / limit errors into a clear 400 response
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error?.code === "LIMIT_FILE_SIZE" || /only|allowed|Unknown field/i.test(error?.message || "")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product — you can edit your review",
      });
    }
    console.error("❌ [createReview] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to add review" });
  }
};

// ==========================================
// 🔒 UPDATE own review (text fields)
// PUT /api/reviews/:id
// ==========================================
const updateReview = async (req, res) => {
  try {
    const userId = String(req.user?._id || "");
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }
    const review = await Review.findOne({
      _id: req.params.id,
      is_deleted: { $ne: true },
    });
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    if (String(review.user_id) !== userId) {
      return res.status(403).json({ success: false, message: "You cannot edit this review" });
    }
    const { rating, title, comment } = req.body;
    if (rating !== undefined) {
      const ratingNum = Number(rating);
      if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        return res.status(400).json({ success: false, message: "Rating must be between 1 and 5" });
      }
      review.rating = ratingNum;
    }
    if (title !== undefined) review.title = String(title || "").trim().slice(0, 120);
    if (comment !== undefined) review.comment = String(comment || "").trim();
    if (!review.comment && !review.images.length && !review.videos.length) {
      return res.status(400).json({
        success: false,
        message: "Please add a comment or a photo/video with your review",
      });
    }
    await review.save();
    const populated = await Review.findById(review._id)
      .populate("user_id", "name avatar")
      .lean();
    return res.status(200).json({ success: true, message: "Review updated", review: populated });
  } catch (error) {
    console.error("❌ [updateReview] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update review" });
  }
};

// ==========================================
// 🔒 DELETE own review (soft delete, media files removed too)
// DELETE /api/reviews/:id
// ==========================================
const deleteReviewMediaFiles = async (review) => {
  const urls = [
    ...(review.images || []).map((i) => i.img_url),
    ...(review.videos || []).map((v) => v.video_url),
  ];
  for (const url of urls) {
    try {
      const clean = String(url || "").replace(/^\/+/, "");
      const filePath = path.join(process.cwd(), clean);
      if (await fs.pathExists(filePath)) await fs.remove(filePath);
    } catch (err) {
      console.error("Review media delete error:", err.message);
    }
  }
};

const deleteReview = async (req, res) => {
  try {
    const userId = String(req.user?._id || "");
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }
    const review = await Review.findOne({
      _id: req.params.id,
      is_deleted: { $ne: true },
    });
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    const isOwner = String(review.user_id) === userId;
    const isStaff = req.userType === "employee";
    if (!isOwner && !isStaff) {
      return res.status(403).json({ success: false, message: "You cannot delete this review" });
    }
    review.is_deleted = true;
    review.deleted_at = new Date();
    await review.save();
    await deleteReviewMediaFiles(review);
    return res.status(200).json({ success: true, message: "Review deleted" });
  } catch (error) {
    console.error("❌ [deleteReview] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to delete review" });
  }
};

// ==========================================
// 🔒 HELPFUL toggle (login required)
// POST /api/reviews/:id/helpful
// ==========================================
const toggleHelpful = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }
    const review = await Review.findOne({
      _id: req.params.id,
      status: "active",
      is_deleted: { $ne: true },
    });
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    const idx = review.helpfulBy.findIndex((id) => String(id) === String(userId));
    let marked;
    if (idx >= 0) {
      review.helpfulBy.splice(idx, 1);
      marked = false;
    } else {
      review.helpfulBy.push(userId);
      marked = true;
    }
    review.helpfulCount = review.helpfulBy.length;
    await review.save();
    return res.status(200).json({ success: true, helpful: marked, helpfulCount: review.helpfulCount });
  } catch (error) {
    console.error("❌ [toggleHelpful] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to vote" });
  }
};

// ==========================================
// 🛡️ ADMIN — review hide/unhide
// PATCH /api/reviews/:id/status
// ==========================================
const setReviewStatus = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }
    const { status } = req.body;
    if (!["active", "hidden"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be active or hidden" });
    }
    const review = await Review.findOne({ _id: req.params.id, is_deleted: { $ne: true } });
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    review.status = status;
    await review.save();
    return res.status(200).json({ success: true, message: `Review ${status}`, review });
  } catch (error) {
    console.error("❌ [setReviewStatus] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update status" });
  }
};

module.exports = {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
  toggleHelpful,
  setReviewStatus,
};
