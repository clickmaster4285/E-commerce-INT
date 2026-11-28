const mongoose = require("mongoose");
const { createImageUpload } = require("./imageUpload");
const Review = require("../models/Review");

// ==========================================
// ⭐ REVIEW MEDIA UPLOAD (images + video)
// ==========================================
// Form fields: images (max 5) + videos (max 1)
// Files are stored in uploads/reviews/<productId>/.

const MAX_IMAGES = 5;
const MAX_VIDEOS = 1;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB per image (optimizeplan.md §2.4)
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB per video

// createImageUpload factory (§5.6): memory multer → magic-bytes → sharp WebP (images) /
// video as-is (mp4/webm/mov sniffed) → uploads/stores/<storeId>/reviews/<productId>/
// Per-image 8MB limit saveReviewMedia me file.originalSize se (factory limit video ke liye 50MB).
const reviewMediaUpload = createImageUpload({
  fields: [
    { name: "images", maxCount: MAX_IMAGES },
    { name: "videos", maxCount: MAX_VIDEOS },
    { name: "video", maxCount: MAX_VIDEOS },
  ],
  kind: "reviews",
  idFrom: (req) => {
    const id = String(req.body?.product_id || req.params?.productId || "");
    return mongoose.Types.ObjectId.isValid(id) ? id : "invalid"; // saveReviewMedia 400 deta hai, cleanup file hata deta hai
  },
  resize: { w: 1200, h: 1200, fit: "inside" },
  quality: 85,
  maxBytes: MAX_VIDEO_SIZE,
  allowVideo: true,
  storage: "disk", // video 50MB RAM me na rahe — disk stream (§2.4)
});

// ==========================================
// 💾 SAVE REVIEW MEDIA (uploads/reviews/<productId>/)
// Images are compressed to webp with sharp, videos are written as-is.
// The controller receives req.reviewMedia = { images: [...], videos: [...] }.
// ==========================================
const saveReviewMedia = async (req, res, next) => {
  try {
    const files = req.files || {};
    const images = files.images || [];
    const videos = [...(files.videos || []), ...(files.video || [])];

    if (images.length > MAX_IMAGES) {
      return res.status(400).json({
        success: false,
        message: `You can upload up to ${MAX_IMAGES} images`,
      });
    }
    if (videos.length > MAX_VIDEOS) {
      return res.status(400).json({
        success: false,
        message: "You can upload only 1 video",
      });
    }
    if (!images.length && !videos.length) return next();

    const productId = String(req.body?.product_id || req.params?.productId || "");
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: "Valid product_id required" });
    }

    // For edits, check ownership and remaining media slots before writing files.
    if (req.method === "PUT") {
      const review = await Review.findOne({ _id: req.params.id, is_deleted: { $ne: true } })
        .select("user_id images videos")
        .lean();
      if (!review) return res.status(404).json({ success: false, message: "Review not found" });
      if (String(review.user_id) !== String(req.user?._id || "")) {
        return res.status(403).json({ success: false, message: "You cannot edit this review" });
      }
      let requestedImageRemovals = [];
      try {
        requestedImageRemovals = Array.isArray(req.body.remove_images)
          ? req.body.remove_images
          : JSON.parse(req.body.remove_images || "[]");
      } catch {
        requestedImageRemovals = [];
      }
      const imageRemovalSet = new Set(requestedImageRemovals.filter((url) => typeof url === "string"));
      const remainingImageCount = (review.images || []).filter((image) => !imageRemovalSet.has(image.img_url)).length;
      const removingVideo = req.body.remove_video === "true";
      const remainingVideoCount = removingVideo ? 0 : (review.videos || []).length;
      if (remainingImageCount + images.length > MAX_IMAGES) {
        return res.status(400).json({ success: false, message: `A review can have up to ${MAX_IMAGES} photos total` });
      }
      if (remainingVideoCount + videos.length > MAX_VIDEOS) {
        return res.status(400).json({ success: false, message: "A review can have only 1 video total" });
      }
    }

    // Files factory me pehle hi save ho chuki hain (error par factory cleanup hata deta hai)
    const savedImages = [];
    for (const file of images) {
      if ((file.originalSize || file.size) > MAX_IMAGE_SIZE) {
        return res.status(400).json({
          success: false,
          message: `Image "${file.originalname}" exceeds the 8MB limit`,
        });
      }
      savedImages.push({
        img_url: file.img_url,
        img_size: file.img_size,
        mimeType: "image/webp",
        width: file.width || null,
        height: file.height || null,
      });
    }

    const savedVideos = videos.map((file) => ({
      video_url: file.img_url,
      file_size: file.img_size,
      mimeType: file.mimeType,
    }));

    req.reviewMedia = { images: savedImages, videos: savedVideos };
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Review media save failed",
    });
  }
};

module.exports = { reviewMediaUpload, saveReviewMedia, MAX_IMAGES, MAX_VIDEOS };
