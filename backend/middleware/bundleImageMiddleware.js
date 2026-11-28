const mongoose = require("mongoose");
const { createImageUpload } = require("./imageUpload");

// Single manual cover image — field name: "image"
// createImageUpload factory (§5.6): memory multer → magic-bytes → sharp WebP →
// uploads/stores/<storeId>/bundles/<bundleId>/
// Update → route id | Create → naya ObjectId (folder naam = bundle._id, product jaisa)
const bundleImageUpload = createImageUpload({
  fields: "image",
  kind: "bundles",
  idFrom: (req) => {
    if (!req.bundleId) req.bundleId = req.params?.id || new mongoose.Types.ObjectId();
    return String(req.bundleId);
  },
  resize: { w: 1000, h: 1000, fit: "inside" },
  quality: 88,
});

// Factory ke baad: req.file → req.bundleImage (DB path, leading slash ke bina) + meta
// Image nahi aayi (update par purani rakhne ke liye) to skip — "required" validation controller me.
const processBundleImage = (req, res, next) => {
  if (!req.file) return next();
  req.bundleImage = req.file.img_url.slice(1);
  req.bundleImageMeta = {
    img_url: req.file.img_url,
    img_size: req.file.img_size,
    mimeType: "image/webp",
    width: req.file.width,
    height: req.file.height,
  };
  return next();
};

module.exports = { bundleImageUpload, processBundleImage };

