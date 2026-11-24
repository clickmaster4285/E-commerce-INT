const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/themeController");
// Sirf admin/employee session (a_at) — customer token yahan 401
const requireAdmin = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");
const { requirePlanFeature } = require("../middleware/planFeature");
const { themeImageUpload, processThemeImage } = require("../middleware/themeImageMiddleware");
const { limiters } = require("../middleware/rateLimit");

// Store editor guard: admin session + staff permission + plan feature
const editor = [requireAdmin, checkPermission("storeEditor"), requirePlanFeature("storeEditor")];

// ✅ Public (storefront) — sirf published theme
router.get("/public", ctrl.getPublicTheme);

// ✅ Admin — static routes pehle
router.get("/schema", requireAdmin, ctrl.getSchema);
router.get("/versions", ...editor, ctrl.listVersions);
router.post("/versions/:version/restore", ...editor, ctrl.restoreVersion);
router.post("/upload-image", ...editor, limiters.themeWrite, themeImageUpload, processThemeImage, ctrl.uploadImage);
router.put("/draft", ...editor, limiters.themeWrite, ctrl.saveDraft);
router.post("/publish", ...editor, ctrl.publish);
router.post("/discard", ...editor, ctrl.discardDraft);
router.get("/", ...editor, ctrl.getTheme);

module.exports = router;
