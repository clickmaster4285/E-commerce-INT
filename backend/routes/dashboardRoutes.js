const express = require("express");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");
const { getDashboardStats } = require("../controllers/dashboardController");

const router = express.Router();

router.get("/stats", authMiddleware, checkPermission("dashboard"), getDashboardStats);

module.exports = router;
