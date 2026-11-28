const multer = require("../utils/tenantMulter") /* store-context safe multer */;
const path = require("path");
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
    cb(null, `deal-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) cb(null, true);
  else cb(new Error("Only image files are allowed"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Deal (bundle) image — single file, field name: "image"
module.exports = upload.single("image");
