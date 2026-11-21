const express = require("express");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { translatePage } = require("../controllers/translationController");

const router = express.Router();
router.post("/page", authMiddleware, translatePage);
module.exports = router;
