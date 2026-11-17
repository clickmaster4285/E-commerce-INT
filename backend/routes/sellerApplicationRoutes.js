const express = require("express");
const { limiters } = require("../middleware/rateLimit");
const authMiddleware = require("../middleware/authMiddleware");
const { requireApprovedSeller } = require("../middleware/requireApprovedSeller");
const sellerApplicationController = require("../controllers/sellerApplicationController");

const router = express.Router();

// Public — apply + lightweight status lookup by email
router.post("/apply", limiters.sellerApply, sellerApplicationController.sellerApply);
router.get("/apply/status", sellerApplicationController.sellerApplyStatus);

// Signed-in applicant — where does MY application stand? (pending must be able to see this)
router.get("/status", authMiddleware, sellerApplicationController.sellerStatusMe);

// Seller-only (approved + store open) — hard gate at the API level
router.get("/dashboard", authMiddleware, requireApprovedSeller, sellerApplicationController.sellerDashboard);
router.get("/store", authMiddleware, requireApprovedSeller, sellerApplicationController.sellerStore);
router.patch("/store", authMiddleware, requireApprovedSeller, sellerApplicationController.sellerStoreUpdate);

module.exports = router;
