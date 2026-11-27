const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/bannerController");
const upload = require("../middleware/uploadMiddleware");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require('../middleware/authMiddleware').requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");
const { publicCache, invalidate } = require("../utils/publicCache");

// ✅ Admin mutation ke baad public cache drop (foran fresh)
const dropBannersCache = (req, res, next) => { invalidate("banners"); next(); };

// ✅ Static route pehle (Admin list ke liye)
router.get("/admin/all", authMiddleware, checkPermission("banners"), ctrl.getAllBanners);

// ✅ Public/Storefront route (60s memo) — storefront sirf /active use karta hai
router.get("/active", publicCache(60 * 1000), ctrl.getActiveBanners);

// 🔒 Admin list / single banner: pehle public the → draft/scheduled banners aur
// createdby/updatedby ke name+email bina login ke milte the. Admin panel adminHttp
// (a_at cookie) se hi call karta hai.
router.get("/", authMiddleware, checkPermission("banners"), ctrl.getAllBanners);

// ✅ Dynamic routes baad mein
router.get("/:id", authMiddleware, checkPermission("banners"), ctrl.getBanner);
router.post("/", authMiddleware, checkPermission("banners"), dropBannersCache, upload, ctrl.createBanner);
router.put("/:id", authMiddleware, checkPermission("banners"), dropBannersCache, upload, ctrl.updateBanner);
router.patch("/:id/toggle", authMiddleware, checkPermission("banners"), dropBannersCache, ctrl.toggleStatus);
router.post("/:id/duplicate", authMiddleware, checkPermission("banners"), dropBannersCache, ctrl.duplicateBanner);
router.delete("/:id", authMiddleware, checkPermission("banners"), dropBannersCache, ctrl.deleteBanner);

module.exports = router;