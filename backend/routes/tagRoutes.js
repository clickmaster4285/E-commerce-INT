const express = require("express");
const router = express.Router();

// Middleware Imports
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
// const { checkPermission } = require("../middleware/checkPermission"); // ❌ Removed for now

// Controller Imports
const { 
  getAllTags, 
  createTag, 
  updateTag, 
  deleteTag 
} = require("../controllers/tagController");

// ==========================================
// ROUTES (Permissions Temporarily Disabled)
// ==========================================

// GET all tags - Authenticated users only
router.get("/", authMiddleware, getAllTags);

// CREATE new tag - No permission check for now
router.post("/", authMiddleware, createTag);

// UPDATE tag - No permission check for now
router.put("/:id", authMiddleware, updateTag);

// DELETE tag (Soft Delete) - No permission check for now
router.delete("/:id", authMiddleware, deleteTag);

module.exports = router;