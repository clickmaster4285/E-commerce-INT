const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { getStoreInfo, updateStoreInfo } = require("../controllers/storeController");
const authMiddleware = require("../middleware/authMiddleware");

// ✅ Multer setup for file upload (Logo)
const multer = require("multer");

// Uploads folder ka path set karein
const uploadDir = path.join(__dirname, "../uploads");

// Agar uploads folder nahi hai toh automatically bana dein (Crash se bachne ke liye)
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
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

// ✅ Routes with Auth Middleware
router.route("/")
  .get(authMiddleware, getStoreInfo) // Sirf logged in user dekh sakta hai
  .put(authMiddleware, upload.single('logo'), updateStoreInfo); // Sirf logged in admin update kar sakta hai

module.exports = router;