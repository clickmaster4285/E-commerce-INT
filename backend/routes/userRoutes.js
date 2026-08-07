const express = require("express");
const { 
  createUser, 
  loginUser, 
  refreshAccessToken, 
  logoutUser, 
  getProfile 
} = require("../controllers/userController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", createUser);
router.post("/login", loginUser);
router.post("/refresh-token", refreshAccessToken); // ✅ Naya Route
router.post("/logout", logoutUser);                // ✅ Naya Route
router.get("/profile", authMiddleware, getProfile);

module.exports = router;