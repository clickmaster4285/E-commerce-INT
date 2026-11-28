const express = require("express");
const router = express.Router();
const {
  getStoreInfo, updateStoreInfo, uploadStoreLogo, deleteStoreLogo,
  getPublicStoreInfo, resolveTenant, checkSubdomain, updateStoreDomain,
} = require("../controllers/storeController");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission"); // ✅ ADDED

// ✅ Logo upload — createImageUpload factory (middleware/imageUpload.js, §5.6):
// memory multer → sharp WebP (SVG/HTML reject) → uploads/stores/<storeId>/store/
const { createImageUpload } = require("../middleware/imageUpload");

const upload = createImageUpload({
  fields: "logo",
  kind: process.env.STORE_UPLOAD_SUBDIR || "store",
  resize: { w: 600, h: 600, fit: "inside" },
  quality: 88,
  maxBytes: 5 * 1024 * 1024, // Max 5MB limit
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
  .put(authMiddleware, checkPermission("store"), upload, updateStoreInfo);
// ✅ REST logo upload (socket base64 "updateStoreInfo" deprecated) — multipart field "logo"
router.post("/logo", authMiddleware, checkPermission("store"), upload, uploadStoreLogo);
router.delete("/logo", authMiddleware, checkPermission("store"), deleteStoreLogo);

module.exports = router;

