const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const sharp = require("sharp");

// ==========================================
// ⭐ REVIEW MEDIA UPLOAD (images + video)
// ==========================================
// Form fields: images (max 5) + videos (max 1)
// Files are stored in uploads/reviews/<productId>/.

const MAX_IMAGES = 5;
const MAX_VIDEOS = 1;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB per image
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB per video

const IMAGE_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.fieldname === "images") {
    if (!IMAGE_MIMES.includes(file.mimetype)) {
      return cb(new Error("Only JPG, JPEG, PNG and WEBP images are allowed for reviews"), false);
    }
    return cb(null, true);
  }
  if (file.fieldname === "videos" || file.fieldname === "video") {
    if (!VIDEO_MIMES.includes(file.mimetype)) {
      return cb(new Error("Only MP4, WEBM or MOV videos are allowed for reviews"), false);
    }
    return cb(null, true);
  }
  return cb(new Error(`Unknown field: ${file.fieldname} (only images/videos allowed)`), false);
};

const reviewMediaUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_VIDEO_SIZE, files: MAX_IMAGES + MAX_VIDEOS },
}).fields([
  { name: "images", maxCount: MAX_IMAGES },
  { name: "videos", maxCount: MAX_VIDEOS },
  { name: "video", maxCount: MAX_VIDEOS },
]);

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

    const productId = String(req.body?.product_id || req.params?.productId || "general");
    const uploadDirectory = path.join(process.cwd(), "uploads", "reviews", productId);
    await fs.ensureDir(uploadDirectory);

    const savedImages = [];
    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      if (file.size > MAX_IMAGE_SIZE) {
        return res.status(400).json({
          success: false,
          message: `Image "${file.originalname}" exceeds the 10MB limit`,
        });
      }
      const base = path
        .basename(file.originalname, path.extname(file.originalname))
        .replace(/[^a-zA-Z0-9-_]/g, "-")
        .slice(0, 40) || "review";
      const fileName = `${Date.now()}-${i}-${base}.webp`;
      const filePath = path.join(uploadDirectory, fileName);
      await sharp(file.buffer)
        .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toFile(filePath);
      const metadata = await sharp(filePath).metadata();
      const stats = await fs.stat(filePath);
      savedImages.push({
        img_url: `/uploads/reviews/${productId}/${fileName}`,
        img_size: stats.size,
        mimeType: "image/webp",
        width: metadata.width || null,
        height: metadata.height || null,
      });
    }

    const savedVideos = [];
    for (let i = 0; i < videos.length; i++) {
      const file = videos[i];
      if (file.size > MAX_VIDEO_SIZE) {
        return res.status(400).json({
          success: false,
          message: `Video "${file.originalname}" exceeds the 50MB limit`,
        });
      }
      const ext = path.extname(file.originalname).toLowerCase() || ".mp4";
      const fileName = `${Date.now()}-video-${i}${ext}`;
      const filePath = path.join(uploadDirectory, fileName);
      await fs.writeFile(filePath, file.buffer);
      savedVideos.push({
        video_url: `/uploads/reviews/${productId}/${fileName}`,
        file_size: file.size,
        mimeType: file.mimetype,
      });
    }

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
