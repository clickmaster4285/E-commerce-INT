const express = require("express");
const { limiters } = require("../middleware/rateLimit");
const sellerApplicationController = require("../controllers/sellerApplicationController");

const router = express.Router();

router.post("/apply", limiters.sellerApply, sellerApplicationController.sellerApply);
router.get("/apply/status", sellerApplicationController.sellerApplyStatus);

module.exports = router;
