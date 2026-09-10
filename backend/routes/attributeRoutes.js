const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");
const {
  getAttributeById,
  getAttributes,
  createAttribute,
  updateAttribute,
  getAttributeCategories,
  updateAttributeCategories,
} = require("../controllers/attributeController");

router.get("/", authMiddleware, checkPermission("products"), getAttributes);
router.post("/", authMiddleware, checkPermission("products"), createAttribute);
router.get("/:id/categories", authMiddleware, checkPermission("products"), getAttributeCategories);
router.put("/:id/categories", authMiddleware, checkPermission("products"), updateAttributeCategories);
router.get("/:id", authMiddleware, checkPermission("products"), getAttributeById);
router.put("/:id", authMiddleware, checkPermission("products"), updateAttribute);

module.exports = router;