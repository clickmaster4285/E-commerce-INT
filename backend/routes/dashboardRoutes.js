const express = require("express");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { getDashboardStats } = require("../controllers/dashboardController");

const router = express.Router();

// GET /api/dashboard/stats — any authenticated admin/staff (no permission gate:
// the Dashboard is visible to everyone who can reach the admin panel)
router.get("/stats", authMiddleware, getDashboardStats);

module.exports = router;
