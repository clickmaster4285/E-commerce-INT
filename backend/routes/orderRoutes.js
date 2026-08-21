const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { placeOrder, getMyOrders, getOrderById } = require("../controllers/orderController");

const router = express.Router();

router.post("/", authMiddleware, placeOrder);
router.get("/my", authMiddleware, getMyOrders);
router.get("/:id", authMiddleware, getOrderById);

module.exports = router;