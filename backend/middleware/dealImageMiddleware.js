const multer = require("../utils/tenantMulter") /* store-context safe multer */;
const fs = require("fs");

const { uploadDirFor } = require("../utils/uploadPaths");

// Store ka apna folder: uploads/stores/<storeId>/deals (utils/uploadPaths.js)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = uploadDirFor(req, "deals");
    fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // 🔒 Extension whitelisted mimetype se (client ka ".svg"/".html" naam nahi)
    cb(null, `deal-${uniqueSuffix}.${IMAGE_TYPES[file.mimetype]}`);
  },
});

// Sirf raster images — SVG me script chal sakta hai (stored XSS)
const IMAGE_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
const fileFilter = (req, file, cb) => {
  if (IMAGE_TYPES[file.mimetype]) cb(null, true);
  else cb(new Error("Only PNG, JPEG, WEBP or GIF images are allowed"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Deal (bundle) image — single file, field name: "image"
module.exports = upload.single("image");
