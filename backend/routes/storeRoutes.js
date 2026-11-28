const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const {
  getStoreInfo, updateStoreInfo,
  getPublicStoreInfo, resolveTenant, checkSubdomain, updateStoreDomain,
} = require("../controllers/storeController");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission"); // ✅ ADDED

// ✅ Multer setup for file upload (Logo)
const multer = require("../utils/tenantMulter") /* store-context safe multer */;

const { uploadDirFor } = require("../utils/uploadPaths");

const storage = multer.diskStorage({
  // Store ka apna folder: uploads/stores/<storeId>/store (utils/uploadPaths.js)
  destination: function (req, file, cb) {
    const dir = uploadDirFor(req, process.env.STORE_UPLOAD_SUBDIR || "store");
    fs.mkdir(dir, { recursive: true }, (err) => cb(err, dir));
  },
  filename: function (req, file, cb) {
    // File ke naam mein spaces ko hyphen se replace karein taake URL mein masla na ho
    const safeFileName = file.originalname.replace(/\s+/g, '-');
    cb(null, Date.now() + "-" + safeFileName);
  },
});

// Sirf images ko allow karein
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // Max 5MB limit
});

// ✅ PUBLIC ROUTE — No auth required (for frontend store info)
// Master-data: short public cache (60s). Protected PUT/admin GET untouched.
router.get("/public", (req, res, next) => {
  res.set("Cache-Control", "public, max-age=60, must-revalidate");
  // Host ke hisaab se alag store → cache bhi host-wise alag rehna chahiye
  res.set("Vary", "Origin, Host");
  next();
}, getPublicStoreInfo);

// ✅ MULTI-TENANT
router.get("/resolve", resolveTenant);                       // public — ye host kis store ka hai
router.get("/check-subdomain", checkSubdomain);              // public — signup / store-setup me availability
router.put("/domain", authMiddleware, checkPermission("store"), updateStoreDomain);

// ✅ PROTECTED ROUTES — Admin only
router.route("/")
  .get(authMiddleware, getStoreInfo)
  .put(authMiddleware, checkPermission("store"), upload.single('logo'), updateStoreInfo);
module.exports = router;