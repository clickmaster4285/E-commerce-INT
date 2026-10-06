const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/bannerController");
const upload = require("../middleware/uploadMiddleware");
const authMiddleware = require('../middleware/authMiddleware'); 
const { checkPermission } = require("../middleware/checkPermission");
const { publicCache, invalidate } = require("../utils/publicCache");

// ✅ Admin mutation ke baad public cache drop (foran fresh)
const dropBannersCache = (req, res, next) => { invalidate("banners"); next(); };

// ✅ Static route pehle (Admin list ke liye)
router.get("/admin/all", authMiddleware, checkPermission("banners"), ctrl.getAllBanners);

// ✅ Public/Storefront routes (60s memo — output same)
router.get("/", ctrl.getAllBanners);
router.get("/active", publicCache(60 * 1000), ctrl.getActiveBanners); 

// ✅ Dynamic routes baad mein
router.get("/:id", ctrl.getBanner); 
router.post("/", authMiddleware, checkPermission("banners"), dropBannersCache, upload, ctrl.createBanner);
router.put("/:id", authMiddleware, checkPermission("banners"), dropBannersCache, upload, ctrl.updateBanner);
router.patch("/:id/toggle", authMiddleware, checkPermission("banners"), dropBannersCache, ctrl.toggleStatus);
router.post("/:id/duplicate", authMiddleware, checkPermission("banners"), dropBannersCache, ctrl.duplicateBanner);
router.delete("/:id", authMiddleware, checkPermission("banners"), dropBannersCache, ctrl.deleteBanner);

module.exports = router;