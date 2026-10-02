const mongoose = require("mongoose");

// ==========================================
// ⭐ PRODUCT REVIEW (delivered orders only)
// ==========================================
// Media files are stored in the backend uploads/reviews/<productId>/ folder,
// only their URL paths (img_url / video_url) are stored in the DB.

const reviewMediaSchema = new mongoose.Schema(
  {
    img_url: { type: String, required: true },
    img_size: { type: Number, default: 0 },
    mimeType: { type: String, default: "" },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
  },
  { _id: false },
);

const reviewVideoSchema = new mongoose.Schema(
  {
    video_url: { type: String, required: true },
    file_size: { type: Number, default: 0 },
    mimeType: { type: String, default: "" },
  },
  { _id: false },
);

const reviewSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, default: "" },
    comment: { type: String, trim: true, default: "" },
    storeResponse: {
      message: { type: String, trim: true, default: "" },
      responded_at: { type: Date, default: null },
      responded_by_name: { type: String, trim: true, default: "" },
    },
    images: { type: [reviewMediaSchema], default: [] },
    videos: { type: [reviewVideoSchema], default: [] },
    // ✅ Buyer verified through a delivered order
    verifiedPurchase: { type: Boolean, default: false },
    helpfulCount: { type: Number, default: 0 },
    helpfulBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: ["active", "hidden"],
      default: "active",
    },
    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

// ✅ One active review per user per product (repeat POST returns 409, use PUT to edit)
reviewSchema.index({ product_id: 1, user_id: 1 }, { unique: true });
reviewSchema.index({ product_id: 1, status: 1, is_deleted: 1, created_at: -1 });

module.exports = mongoose.model("Review", reviewSchema);
