const express = require("express");
const router = express.Router();

// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");

const {
  getAllTags,
  createTag,
  updateTag,
  deleteTag,
} = require("../controllers/tagController");

// Tags live under the products permission (no separate tags key in Employee.permissions)
router.get("/", authMiddleware, checkPermission("products"), getAllTags);
router.post("/", authMiddleware, checkPermission("products"), createTag);
router.put("/:id", authMiddleware, checkPermission("products"), updateTag);
router.delete("/:id", authMiddleware, checkPermission("products"), deleteTag);

module.exports = router;
