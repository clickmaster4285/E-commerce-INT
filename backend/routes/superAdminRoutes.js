const express = require("express");
const { requireSuperAdmin, requireSuperAdminRole } = require("../middleware/superAdminAuth");
const superAdminController = require("../controllers/superAdminController");

const router = express.Router();

/* Public auth — apne sa_at / sa_rt / sa_sess cookies (seller/customer se alag, utils/tokens.js) */
router.post("/auth/login", superAdminController.loginSuperAdmin);
router.post("/auth/refresh-token", superAdminController.refreshSuperAdminToken);
router.post("/auth/logout", superAdminController.logoutSuperAdmin);

/* Everything below needs a valid superadmin session */
router.use(requireSuperAdmin);

router.get("/auth/me", superAdminController.meSuperAdmin);

router.get("/dashboard", superAdminController.getDashboard);
router.get("/activity/me", superAdminController.myActivity);

router.get("/requests", superAdminController.listRequests);
router.get("/requests/:id", superAdminController.getRequest);
router.patch("/requests/:id", superAdminController.updateRequest);
router.delete("/requests/:id", superAdminController.deleteRequest);
router.post("/requests/:id/approve", superAdminController.approveRequest);
router.post("/requests/:id/reject", superAdminController.rejectRequest);
router.post("/requests/:id/request-info", superAdminController.requestInfo);

router.get("/stores", superAdminController.listStores);
router.get("/stores/:id", superAdminController.getStore);
router.post("/stores", superAdminController.createStore);
router.post("/stores/with-owner", superAdminController.createSellerStore); // Add store page — store + owner
router.patch("/stores/:id", superAdminController.updateStore);
router.delete("/stores/:id", superAdminController.deleteStore);
router.patch("/stores/:id/status", superAdminController.setStoreStatus);

router.get("/store-admins", superAdminController.listStoreAdmins);
router.get("/store-admins/:id", superAdminController.getStoreAdmin);
router.patch("/store-admins/:id", superAdminController.updateStoreAdmin);
router.post("/store-admins/:id/password", superAdminController.resetStoreAdminPassword);
router.patch("/store-admins/:id/status", superAdminController.setStoreAdminStatus);

router.get("/users", superAdminController.listUsers);
router.get("/users/:id", superAdminController.getUser);
router.patch("/users/:id", superAdminController.updateUser);
router.delete("/users/:id", superAdminController.deleteUser);
router.post("/users/:id/password", superAdminController.setUserPassword);
router.post("/stores/:id/admin-access", superAdminController.openStoreAdmin);
router.patch("/users/:id/status", superAdminController.setUserStatus);

/* Team — only role "superadmin" (requireSuperAdminRole). Staff accounts are blocked. */
router.get("/team", requireSuperAdminRole, superAdminController.listTeam);
router.post("/team", requireSuperAdminRole, superAdminController.createTeamMember);
router.get("/team/:id", requireSuperAdminRole, superAdminController.getTeamMember);
router.get("/team/:id/activity", requireSuperAdminRole, superAdminController.teamMemberActivity);
router.patch("/team/:id", requireSuperAdminRole, superAdminController.updateTeamMember);
router.patch("/team/:id/status", requireSuperAdminRole, superAdminController.setTeamMemberStatus);
router.post("/team/:id/password", requireSuperAdminRole, superAdminController.resetTeamMemberPassword);
router.delete("/team/:id", requireSuperAdminRole, superAdminController.deleteTeamMember);

/* Plans — platform subscription catalog (limits + feature tiers) */
router.get("/plans", superAdminController.listPlans);
router.get("/plans/options", superAdminController.listPlanOptions);
router.post("/plans", superAdminController.createPlan);
router.get("/plans/:id/activity", superAdminController.planActivity);
router.get("/plans/:id", superAdminController.getPlan);
router.patch("/plans/:id", superAdminController.updatePlan);
router.patch("/plans/:id/status", superAdminController.setPlanStatus);
router.delete("/plans/:id", superAdminController.deletePlan);

module.exports = router;
