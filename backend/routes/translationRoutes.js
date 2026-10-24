const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { translatePage } = require("../controllers/translationController");

const router = express.Router();
router.post("/page", authMiddleware, translatePage);
module.exports = router;
