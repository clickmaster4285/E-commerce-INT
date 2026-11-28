// Employee roles — backend/utils/roles.js ka mirror.
//   storehandler → store owner (full access), admin → full-access staff, manager/staff → permission-based.
export const OWNER_ROLE = "storehandler";
export const ADMIN_ROLES = [OWNER_ROLE, "admin"];
export const STAFF_ROLES = [...ADMIN_ROLES, "manager", "staff"];

export const normalizeRole = (role) => String(role || "").toLowerCase();
export const isOwnerRole = (role) => normalizeRole(role) === OWNER_ROLE;
/** Full access — owner ya admin */
export const isAdminRole = (role) => ADMIN_ROLES.includes(normalizeRole(role));
export const isStaffRole = (role) => STAFF_ROLES.includes(normalizeRole(role));

const LABELS = { storehandler: "Store Handler", admin: "Admin", manager: "Manager", staff: "Staff" };
export const roleLabel = (role) => LABELS[normalizeRole(role)] || String(role || "");
