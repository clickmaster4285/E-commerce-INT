// Store editor image — createImageUpload factory (middleware/imageUpload.js, §5.6):
// memory multer → magic-bytes check → sharp WebP → uploads/stores/<storeId>/theme/theme-<ts>-<hex>.webp
// Filename hamesha unique (kabhi overwrite nahi). Purani images save par delete NAHI hoti —
// published versions abhi bhi unhe use kar sakte hain (cleanup: utils/themeImageCleanup.js).
const { createImageUpload } = require("./imageUpload");

// Single file, field name: "image"
const themeImageUpload = createImageUpload({
  fields: "image",
  kind: "theme",
  resize: { w: 2000, h: 2000, fit: "inside" },
  quality: 85,
});

// Factory ke baad: req.file → req.themeImage (controller ka purana contract)
const processThemeImage = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "Image file is required (field: image)" });
  }
  req.themeImage = {
    url: req.file.img_url,
    size: req.file.img_size,
    width: req.file.width,
    height: req.file.height,
    mimeType: "image/webp",
  };
  return next();
};

module.exports = { themeImageUpload, processThemeImage };

