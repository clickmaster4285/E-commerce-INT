const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  getMyAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} = require("../controllers/addressController");

const router = express.Router();

router.get("/", authMiddleware, getMyAddresses);
router.post("/", authMiddleware, createAddress);
router.put("/:id/default", authMiddleware, setDefaultAddress);
router.put("/:id", authMiddleware, updateAddress);
router.delete("/:id", authMiddleware, deleteAddress);

module.exports = router;