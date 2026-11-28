const express = require("express");
const { getCart, saveCart } = require("../controllers/cartController");
// Sirf customer session (u_at)
const authMiddleware = require("../middleware/authMiddleware").requireUser;

const router = express.Router();

router.get("/", authMiddleware, getCart);
router.put("/", authMiddleware, saveCart);

module.exports = router;