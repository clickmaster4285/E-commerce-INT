const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/bannerController");
const upload = require("../middleware/uploadMiddleware");
const authMiddleware = require('../middleware/authMiddleware'); 
const { checkPermission } = require("../middleware/checkPermission");

// ✅ Static route pehle (Admin list ke liye)
router.get("/admin/all", authMiddleware, checkPermission("banners"), ctrl.getAllBanners);

// ✅ Public/Storefront routes
router.get("/", ctrl.getAllBanners);
router.get("/active", ctrl.getActiveBanners); 

// ✅ Dynamic routes baad mein
router.get("/:id", ctrl.getBanner); 
router.post("/", authMiddleware, checkPermission("banners"), upload, ctrl.createBanner);
router.put("/:id", authMiddleware, checkPermission("banners"), upload, ctrl.updateBanner);
router.patch("/:id/toggle", authMiddleware, checkPermission("banners"), ctrl.toggleStatus);
router.post("/:id/duplicate", authMiddleware, checkPermission("banners"), ctrl.duplicateBanner);
router.delete("/:id", authMiddleware, checkPermission("banners"), ctrl.deleteBanner);

module.exports = router;