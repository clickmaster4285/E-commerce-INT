const SuperAdminActivity = require("../models/SuperAdminActivity");
const log = require("./logger");

// Audit every sensitive superadmin action. Never throws — audit failure must
// not break the business flow.
const logActivity = async ({ action, actor, entityType = "system", entityId = "", details = {} }) => {
  try {
    await SuperAdminActivity.create({
      action,
      actor: actor
        ? { id: actor._id || null, email: actor.email || "", name: actor.name || actor.email || "unknown" }
        : undefined,
      entityType,
      entityId: String(entityId || ""),
      details,
    });
  } catch (error) {
    log.error("[super-admin] activity log failed:", error.message);
  }
};

module.exports = { logActivity };
