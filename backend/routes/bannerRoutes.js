const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/bannerController");
const upload = require("../middleware/uploadMiddleware");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require('../middleware/authMiddleware').requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");
const { publicCache } = require("../utils/publicCache");
const { invalidateOn } = require("../middleware/invalidateOn");
const { validate } = require("../middleware/validate");
const bannerValidators = require("../validators/bannerValidators");

// ✅ Admin mutation ke baad public cache drop (foran fresh)
const dropBannersCache = invalidateOn("banners"); // 2xx ke BAAD drop (finish hook)

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
router.post("/", authMiddleware, checkPermission("banners"), dropBannersCache, upload, validate(bannerValidators.createBanner), ctrl.createBanner);
router.put("/:id", authMiddleware, checkPermission("banners"), dropBannersCache, upload, validate(bannerValidators.updateBanner), ctrl.updateBanner);
router.patch("/:id/toggle", authMiddleware, checkPermission("banners"), validate(bannerValidators.bannerId), dropBannersCache, ctrl.toggleStatus);
router.post("/:id/duplicate", authMiddleware, checkPermission("banners"), validate(bannerValidators.bannerId), dropBannersCache, ctrl.duplicateBanner);
router.delete("/:id", authMiddleware, checkPermission("banners"), validate(bannerValidators.bannerId), dropBannersCache, ctrl.deleteBanner);

module.exports = router;