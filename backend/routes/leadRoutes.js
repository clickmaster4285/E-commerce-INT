const router = require("express").Router();
const authMiddleware = require("../middleware/authMiddleware");
const { checkPermission, staffPermissionCheck } = require("../middleware/checkPermission");
const { listLeads, getLead, createLead, updateLead, updateStatus, addActivity, deleteLead } = require("../controllers/leadController");

router.use(authMiddleware, staffPermissionCheck, checkPermission("leads"));
router.get("/", listLeads);
router.post("/", createLead);
router.get("/:id", getLead);
router.put("/:id", updateLead);
router.patch("/:id/status", updateStatus);
router.post("/:id/activities", addActivity);
router.delete("/:id", deleteLead);
module.exports = router;
