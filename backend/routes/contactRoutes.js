const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/contactController");
const requireAdmin = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");
const { limiters } = require("../middleware/rateLimit");

// ✅ Public (storefront contact form section) — newsletter wala IP limit
router.post("/", limiters.newsletter, ctrl.submitMessage);

// ✅ Admin inbox — customer data → "customers" permission
const admin = [requireAdmin, checkPermission("customers")];
router.get("/admin", ...admin, ctrl.listMessages);
router.patch("/admin/:id", ...admin, ctrl.updateMessage);
router.delete("/admin/:id", ...admin, ctrl.deleteMessage);

module.exports = router;
