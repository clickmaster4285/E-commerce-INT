const express = require("express");
// Sirf customer session (u_at)
const authMiddleware = require("../middleware/authMiddleware").requireUser;
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