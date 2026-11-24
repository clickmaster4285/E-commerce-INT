const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/subscriberController");
const requireAdmin = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");
const { limiters } = require("../middleware/rateLimit");

// ✅ Public (storefront newsletter section)
router.post("/subscribe", limiters.newsletter, ctrl.subscribe);

// ✅ Admin — customer data hai, is liye "customers" permission
const admin = [requireAdmin, checkPermission("customers")];
router.get("/admin/export", ...admin, ctrl.exportSubscribers);
router.get("/admin", ...admin, ctrl.listSubscribers);
router.patch("/admin/:id", ...admin, ctrl.updateSubscriber);
router.delete("/admin/:id", ...admin, ctrl.deleteSubscriber);

module.exports = router;
