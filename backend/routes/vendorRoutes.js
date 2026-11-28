const express = require("express");
const { getNextVendorCode, createVendor, getVendorsAdmin, getVendorById, getVendorWithPOs, updateVendor, deleteVendor, restoreVendor } = require("../controllers/vendorController");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");
const router = express.Router();

router.get("/next-code", authMiddleware, checkPermission("vendors"), getNextVendorCode);
router.get("/admin/all", authMiddleware, checkPermission("vendors"), getVendorsAdmin);
router.get("/:id/details", authMiddleware, checkPermission("vendors"), getVendorWithPOs);
router.get("/:id", authMiddleware, checkPermission("vendors"), getVendorById);
router.post("/", authMiddleware, checkPermission("vendors"), createVendor);
router.put("/:id", authMiddleware, checkPermission("vendors"), updateVendor);
router.delete("/:id", authMiddleware, checkPermission("vendors"), deleteVendor);
router.post("/:id/restore", authMiddleware, checkPermission("vendors"), restoreVendor);

module.exports = router;
