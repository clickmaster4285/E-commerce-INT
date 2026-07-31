const express = require("express");
const { createUser, loginUser, getProfile } = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware"); // <--- YE LINE MISSING THI!

const router = express.Router();

router.post("/register", createUser);
router.post("/login", loginUser);
router.get("/profile", authMiddleware, getProfile);

module.exports = router;