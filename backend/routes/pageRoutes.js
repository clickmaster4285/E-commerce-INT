const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/pageController");
const requireAdmin = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");
const { requirePlanFeature } = require("../middleware/planFeature");

// Custom pages store editor ka hissa — wahi permission + plan feature
const editor = [requireAdmin, checkPermission("storeEditor"), requirePlanFeature("storeEditor")];

// ✅ Public (storefront) — sirf published
router.get("/public", ctrl.listPublicPages);
router.get("/public/:slug", ctrl.getPublicPage);

// ✅ Admin
router.get("/admin", ...editor, ctrl.listPages);
router.post("/admin", ...editor, ctrl.createPage);
router.get("/admin/:id", ...editor, ctrl.getPage);
router.put("/admin/:id", ...editor, ctrl.updatePage);
router.delete("/admin/:id", ...editor, ctrl.deletePage);

module.exports = router;
