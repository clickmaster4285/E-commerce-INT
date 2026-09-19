const router = require("express").Router();
const {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  toggleStatus,
} = require("../controllers/employeeController");
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission } = require("../middleware/checkPermission");

// ✅ Authentication required for all employee routes
router.use(authMiddleware);

// GET — no permission check (allows auto-migration of legacy permissions)
router.get("/", getAllEmployees);
router.get("/:id", getEmployeeById);

// WRITE operations — employees permission required
router.post("/", checkPermission("employees"), createEmployee);
router.put("/:id", checkPermission("employees"), updateEmployee);
router.delete("/:id", checkPermission("employees"), deleteEmployee);
router.patch("/:id/toggle-status", checkPermission("employees"), toggleStatus);

module.exports = router;