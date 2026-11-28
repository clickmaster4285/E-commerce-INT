const mongoose = require("mongoose");
const { createImageUpload } = require("./imageUpload");

// ==========================================
// Product / variant images — createImageUpload factory (§5.6)
// ----------------------------------------
// Field "images" (max 10): memory multer → magic-bytes → sharp WebP (max 2400px) →
// uploads/stores/<storeId>/products/<productId>/ . Pehle raw bytes (original extension)
// disk par jati thi. Product id: req.productId (variant routes set karte hain) ||
// params.id || naya ObjectId — controller bhi isi ko use karta hai.
// ==========================================
const productImagesUpload = createImageUpload({
  fields: "images",
  maxCount: 10,
  kind: "products",
  idFrom: (req) => {
    if (!req.productId) req.productId = req.params?.id || new mongoose.Types.ObjectId();
    return String(req.productId);
  },
  resize: { w: 2400, h: 2400, fit: "inside" },
  quality: 85,
});

// Factory ke baad: req.files = { images: [...] } → flat array + metadata (purana contract:
// req.files array, req.imageMetadata[i]). Files pehle hi validate + save ho chuki hoti hain.
const validateProductImages = (req, res, next) => {
  const saved = Array.isArray(req.files) ? req.files : req.files?.images || [];
  if (!saved.length) return next();
  req.files = saved;
  req.imageMetadata = saved.map((file) => ({
    originalName: file.originalname,
    img_size: file.img_size,
    mimeType: file.mimeType,
    width: file.width,
    height: file.height,
  }));
  return next();
};

module.exports = {
  productImagesUpload,
  validateProductImages,
};

