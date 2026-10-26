const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const { translatePage, translateTerms } = require("../controllers/translationController");

const router = express.Router();
router.post("/page", authMiddleware, translatePage);
router.post("/terms", authMiddleware, translateTerms);
module.exports = router;
