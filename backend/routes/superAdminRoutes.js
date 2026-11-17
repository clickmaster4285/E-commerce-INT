const express = require("express");
const { requireSuperAdmin } = require("../middleware/superAdminAuth");
const superAdminController = require("../controllers/superAdminController");

const router = express.Router();

/* Public auth */
router.post("/auth/login", superAdminController.loginSuperAdmin);
router.post("/auth/logout", superAdminController.logoutSuperAdmin);

/* Everything below needs a valid superadmin session */
router.use(requireSuperAdmin);

router.get("/auth/me", superAdminController.meSuperAdmin);

router.get("/dashboard", superAdminController.getDashboard);

router.get("/requests", superAdminController.listRequests);
router.get("/requests/:id", superAdminController.getRequest);
router.post("/requests/:id/approve", superAdminController.approveRequest);
router.post("/requests/:id/reject", superAdminController.rejectRequest);

router.get("/stores", superAdminController.listStores);
router.patch("/stores/:id/status", superAdminController.setStoreStatus);

router.get("/users", superAdminController.listUsers);
router.patch("/users/:id/status", superAdminController.setUserStatus);

router.get("/activity", superAdminController.listActivity);

router.get("/settings", superAdminController.getSettings);
router.put("/settings/password", superAdminController.changeSuperAdminPassword);

module.exports = router;
