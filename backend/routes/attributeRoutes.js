// backend/routes/attributeRoutes.js
const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const {
  getAttributes,
  createAttribute,
  updateAttribute,
} = require("../controllers/attributeController");

router.get("/", authMiddleware, checkPermission("products"), getAttributes);
router.post("/", authMiddleware, checkPermission("products"), createAttribute);
router.put("/:id", authMiddleware, checkPermission("products"), updateAttribute);

module.exports = router;