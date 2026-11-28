const express = require("express");
const { getCustomersAdmin, searchCustomers, getCustomerById, createCustomer, updateCustomer, deleteCustomer } = require("../controllers/customerController");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");

const router = express.Router();

router.get("/admin/all", authMiddleware, checkPermission("customers"), getCustomersAdmin);
router.get("/search", authMiddleware, checkPermission("customers"), searchCustomers);
router.get("/:id", authMiddleware, checkPermission("customers"), getCustomerById);
router.post("/", authMiddleware, checkPermission("customers"), createCustomer);
router.put("/:id", authMiddleware, checkPermission("customers"), updateCustomer);
router.delete("/:id", authMiddleware, checkPermission("customers"), deleteCustomer);

module.exports = router;
