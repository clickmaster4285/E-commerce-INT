const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs-extra");
const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Employee = require("../models/Employee");

// ==========================================
// 🔌 SOCKET HELPER (baqi controllers ki tarah)
// Admin review actions (hide/unhide, response) sab connected
// admin panels par live sync hote hain.
// ==========================================
const emitSocketEvent = (event, data) => {
  try {
    const { getIO } = require("../utils/socket");
    const io = getIO();
    if (io) io.emit(event, data);
  } catch (error) {
    console.error("⚠️ Review socket emit failed:", error.message);
  }
};

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

// Populate review owners from both account collections. Older reviews can
// reference an employee account even though the Review ref points to User.
const hydrateReviewCustomers = async (reviews = []) => {
  const unresolvedIds = [...new Set(reviews
    .filter((review) => !review.user_id?.name)
    .map((review) => String(review.user_id?._id || review.user_id || ""))
    .filter((id) => mongoose.Types.ObjectId.isValid(id)))];
  if (!unresolvedIds.length) return reviews;

  const ids = unresolvedIds.map((id) => new mongoose.Types.ObjectId(id));
  const [users, employees] = await Promise.all([
    User.find({ _id: { $in: ids } }).select("name avatar email phone created_at").lean(),
    Employee.find({ _id: { $in: ids } }).select("name avatar email phone created_at").lean(),
  ]);
  const customerById = new Map();
  users.forEach((user) => customerById.set(String(user._id), user));
  employees.forEach((employee) => {
    if (!customerById.has(String(employee._id))) customerById.set(String(employee._id), employee);
  });
  reviews.forEach((review) => {
    if (review.user_id?.name) return;
    const id = String(review.user_id?._id || review.user_id || "");
    const customer = customerById.get(id);
    if (customer) review.user_id = customer;
  });
  return reviews;
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
      .select("-helpfulCount -helpfulBy")
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
    log.error("❌ [getProductReviews] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
};

// ==========================================
// 🔒 MY REVIEWS — current user ki saari reviews
// GET /api/reviews/my
// ==========================================
// Order pages + product page isse dekhte hain ke user ne kis product ko
// already rate kiya hai (product_id → review map).
const getMyReviews = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Login required" });
    }
    const reviews = await Review.find({
      user_id: toObjectId(userId),
      is_deleted: { $ne: true },
    })
      .select("product_id rating title comment images videos status created_at updated_at storeResponse")
      .sort({ created_at: -1 })
      .lean();
    return res.status(200).json({ success: true, reviews });
  } catch (error) {
    console.error("❌ [getMyReviews] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch your reviews" });
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
    // ✅ Rating-only allowed — comment/photo/video optional rahenge.

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
    log.error("❌ [createReview] Error:", error.message);
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
    let requestedImageRemovals = [];
    try {
      requestedImageRemovals = Array.isArray(req.body.remove_images)
        ? req.body.remove_images
        : JSON.parse(req.body.remove_images || "[]");
    } catch {
      requestedImageRemovals = [];
    }
    const imageRemovalSet = new Set(requestedImageRemovals.filter((url) => typeof url === "string"));
    const removedImages = (review.images || []).filter((image) => imageRemovalSet.has(image.img_url));
    if (removedImages.length) {
      review.images = (review.images || []).filter((image) => !imageRemovalSet.has(image.img_url));
    }
    const removedVideos = req.body.remove_video === "true" ? (review.videos || []).slice() : [];
    if (removedVideos.length) review.videos = [];
    // ✅ Rating-only allowed — comment/photo/video optional rahenge.

    // ✅ NEW: Edit karte waqt nayi photos/video bhi add ho sakti hain (limits: 5 images, 1 video).
    const media = req.reviewMedia || { images: [], videos: [] };
    if ((media.images && media.images.length) || (media.videos && media.videos.length)) {
      review.images = [...(review.images || []), ...(media.images || [])].slice(0, 5);
      review.videos = [...(review.videos || []), ...(media.videos || [])].slice(0, 1);
    }

    await review.save();
    await deleteReviewMediaFiles({ images: removedImages, videos: removedVideos });
    const populated = await Review.findById(review._id)
      .populate("user_id", "name avatar")
      .lean();
    return res.status(200).json({ success: true, message: "Review updated", review: populated });
  } catch (error) {
    log.error("❌ [updateReview] Error:", error.message);
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
      log.error("Review media delete error:", err.message);
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
    log.error("❌ [deleteReview] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to delete review" });
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
    emitSocketEvent("reviewUpdated", {
      _id: review._id,
      product_id: review.product_id,
      status,
      statusOnly: true,
    });
    return res.status(200).json({ success: true, message: `Review ${status}`, review });
  } catch (error) {
    log.error("❌ [setReviewStatus] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update status" });
  }
};

// ==========================================
// 🛡️ ADMIN — publish or update a store response
// PATCH /api/reviews/:id/response
// ==========================================
const setReviewResponse = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }
    const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    if (!message) {
      return res.status(400).json({ success: false, message: "Write a response before publishing" });
    }
    if (message.length > 1000) {
      return res.status(400).json({ success: false, message: "Response must be 1,000 characters or fewer" });
    }
    const review = await Review.findOne({ _id: req.params.id, is_deleted: { $ne: true } });
    if (!review) {
      return res.status(404).json({ success: false, message: "Review not found" });
    }
    review.storeResponse = {
      message,
      responded_at: new Date(),
      responded_by_name: String(req.user?.name || "Store Support").trim().slice(0, 100),
    };
    await review.save();
    emitSocketEvent("reviewUpdated", {
      _id: review._id,
      product_id: review.product_id,
      hasResponse: true,
      responseOnly: true,
    });
    return res.status(200).json({ success: true, message: "Store response published", review });
  } catch (error) {
    console.error("[setReviewResponse] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to publish store response" });
  }
};

const deleteReviewResponse = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }
    const review = await Review.findOneAndUpdate(
      { _id: req.params.id, is_deleted: { $ne: true } },
      { $unset: { storeResponse: 1 } },
      { new: false },
    );
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    emitSocketEvent("reviewUpdated", {
      _id: req.params.id,
      hasResponse: false,
      responseOnly: true,
    });
    return res.status(200).json({ success: true, message: "Store response deleted" });
  } catch (error) {
    console.error("[deleteReviewResponse] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to delete store response" });
  }
};

// ==========================================
// 🛡️ ADMIN — paginated review list
// GET /api/reviews/admin/all?page=&limit=&search=&rating=&status=&sort=
// ==========================================
const getAdminReviews = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = String(req.query.search || "").trim();
    const ratingParam = parseInt(req.query.rating, 10);
    const statusParam = String(req.query.status || "all");
    const sortKey = String(req.query.sort || "newest");
    const sortMap = {
      newest: { created_at: -1 },
      oldest: { created_at: 1 },
      high: { rating: -1, created_at: -1 },
      low: { rating: 1, created_at: -1 },
    };
    const sort = sortMap[sortKey] || sortMap.newest;

    const filter = { is_deleted: { $ne: true } };
    if (["active", "hidden"].includes(statusParam)) filter.status = statusParam;
    if (Number.isInteger(ratingParam) && ratingParam >= 1 && ratingParam <= 5) {
      filter.rating = ratingParam;
    }
    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: rx }, { comment: rx }];
    }

    const total = await Review.countDocuments(filter);
    const reviews = await Review.find(filter)
      .select("-helpfulCount -helpfulBy")
      .populate("product_id", "name")
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    await hydrateReviewCustomers(reviews);

    // ✅ Whole-dataset stats (current filters / page se independent) — dashboard stat cards ke liye
    const statsAgg = await Review.aggregate([
      { $match: { is_deleted: { $ne: true } } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          visible: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          hidden: { $sum: { $cond: [{ $eq: ["$status", "hidden"] }, 1, 0] } },
          five: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
          ratingSum: { $sum: { $ifNull: ["$rating", 0] } },
        },
      },
    ]);
    const agg = statsAgg[0] || { total: 0, visible: 0, hidden: 0, five: 0, ratingSum: 0 };
    const stats = {
      total: agg.total,
      visible: agg.visible,
      hidden: agg.hidden,
      five: agg.five,
      avg: agg.total ? Math.round((agg.ratingSum / agg.total) * 10) / 10 : 0,
    };

    return res.status(200).json({
      success: true,
      reviews,
      stats,
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
    console.error("❌ [getAdminReviews] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch reviews" });
  }
};

const getAdminReviewById = async (req, res) => {
  try {
    if (!toObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid review ID" });
    }
    const review = await Review.findOne({ _id: req.params.id, is_deleted: { $ne: true } })
      .select("-helpfulCount -helpfulBy")
      .populate("product_id", "name")
      .lean();
    if (!review) return res.status(404).json({ success: false, message: "Review not found" });
    await hydrateReviewCustomers([review]);
    const customerId = review.user_id?._id || review.user_id;
    review.customerReviews = customerId
      ? await Review.find({
          user_id: customerId,
          _id: { $ne: review._id },
          is_deleted: { $ne: true },
        })
          .select("product_id rating title comment status created_at")
          .populate("product_id", "name")
          .sort({ created_at: -1 })
          .limit(3)
          .lean()
      : [];
    return res.status(200).json({ success: true, review });
  } catch (error) {
    console.error("[getAdminReviewById] Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch review" });
  }
};

module.exports = {
  getProductReviews,
  getMyReviews,
  getAdminReviews,
  getAdminReviewById,
  createReview,
  updateReview,
  deleteReview,
  setReviewStatus,
  setReviewResponse,
  deleteReviewResponse,
};