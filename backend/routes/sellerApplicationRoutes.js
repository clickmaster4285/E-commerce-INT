const express = require("express");
const { limiters } = require("../middleware/rateLimit");
const authMiddleware = require("../middleware/authMiddleware");
const { requireApprovedSeller } = require("../middleware/requireApprovedSeller");
const sellerApplicationController = require("../controllers/sellerApplicationController");

const router = express.Router();

// Public — apply + lightweight status lookup by email
router.post("/apply", limiters.sellerApply, sellerApplicationController.sellerApply);
router.get("/apply/status", limiters.sellerApplyStatus, sellerApplicationController.sellerApplyStatus);
// Public — store setup (details confirmation + verification documents) keyed by email
router.get("/apply/setup", sellerApplicationController.sellerSetupState);
router.post("/apply/complete-setup", limiters.sellerApply, sellerApplicationController.completeSetup);

// Signed-in applicant — where does MY application stand? (pending must be able to see this)
router.get("/status", authMiddleware, sellerApplicationController.sellerStatusMe);

// Seller-only (approved + store open) — hard gate at the API level
router.get("/dashboard", authMiddleware, requireApprovedSeller, sellerApplicationController.sellerDashboard);
router.get("/store", authMiddleware, requireApprovedSeller, sellerApplicationController.sellerStore);
router.patch("/store", authMiddleware, requireApprovedSeller, sellerApplicationController.sellerStoreUpdate);

module.exports = router;
