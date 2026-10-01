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
  deleteAttribute,
} = require("../controllers/attributeController");

router.get("/", authMiddleware, checkPermission("attribute"), getAttributes);
router.post("/", authMiddleware, checkPermission("attribute"), createAttribute);
router.get("/:id/categories", authMiddleware, checkPermission("attribute"), getAttributeCategories);
router.put("/:id/categories", authMiddleware, checkPermission("attribute"), updateAttributeCategories);
router.get("/:id", authMiddleware, checkPermission("attribute"), getAttributeById);
router.put("/:id", authMiddleware, checkPermission("attribute"), updateAttribute);
router.delete("/:id", authMiddleware, checkPermission("attribute"), deleteAttribute);

module.exports = router;