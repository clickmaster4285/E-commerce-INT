const router = require("express").Router();
const {
  getAllEmployees,
  getEmployeeOptions,
  getEmployeeById,
  getEmployeeActivities,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  toggleStatus,
} = require("../controllers/employeeController");
// Sirf admin/employee session (a_at) — customer token yahan 401
const authMiddleware = require("../middleware/authMiddleware").requireAdmin;
const { checkPermission } = require("../middleware/checkPermission");

// ✅ Authentication required for all employee routes
router.use(authMiddleware);

router.get("/", checkPermission("employees"), getAllEmployees);
router.get("/options", checkPermission("employees"), getEmployeeOptions);
router.get("/:id/activities", checkPermission("employees"), getEmployeeActivities);
router.get("/:id", checkPermission("employees"), getEmployeeById);

// WRITE operations — employees permission required
router.post("/", checkPermission("employees"), createEmployee);
router.put("/:id", checkPermission("employees"), updateEmployee);
router.delete("/:id", checkPermission("employees"), deleteEmployee);
router.patch("/:id/toggle-status", checkPermission("employees"), toggleStatus);

module.exports = router;
