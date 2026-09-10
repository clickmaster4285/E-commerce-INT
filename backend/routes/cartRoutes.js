const express = require("express");
const { getCart, saveCart } = require("../controllers/cartController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, getCart);
router.put("/", authMiddleware, saveCart);

module.exports = router;