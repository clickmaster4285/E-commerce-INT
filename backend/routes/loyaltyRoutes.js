const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const c = require("../controllers/loyaltyController");

const router = express.Router();

// PUBLIC — storefront banners / product page ("Earn X points")
router.get("/program", c.getProgram);

// CUSTOMER — apna balance + history
router.get("/me", authMiddleware.requireUser, c.getMyRewards);
router.get("/me/notices", authMiddleware.requireUser, c.getMyNotices);
router.post("/me/notices/seen", authMiddleware.requireUser, c.markMyNoticesSeen);
router.post("/me/welcome/claim", authMiddleware.requireUser, c.claimWelcomeBonus);

// ADMIN — sirf admin session (a_at) + 'loyalty' permission
const admin = [authMiddleware.requireAdmin, checkPermission("loyalty")];
router.get("/admin/overview", ...admin, c.getOverview);
router.get("/admin/settings", ...admin, c.getSettings);
router.put("/admin/settings", ...admin, c.updateSettings);
router.get("/admin/members", ...admin, c.listMembers);
router.get("/admin/members/:userId", ...admin, c.getMember);
router.post("/admin/members/:userId/adjust", ...admin, c.adjustMember);
router.get("/admin/transactions", ...admin, c.listTransactions);

module.exports = router;
