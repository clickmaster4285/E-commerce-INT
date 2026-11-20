// Employee roles — ek jagah se, taake "admin" string har file me na bikhre.
//
//   storehandler → store ka owner (seller signup se banta hai). Full access, delete/demote nahi ho sakta.
//   admin        → owner ka banaya hua full-access staff.
//   manager/staff→ permission-based access.
//
// isAdminRole() = full access (owner + admin). Pending sellers ki read-only mode
// `seller_pending` flag se enforce hoti hai, role se nahi.

const OWNER_ROLE = "storehandler";
const ADMIN_ROLES = [OWNER_ROLE, "admin"];
const STAFF_ROLES = [...ADMIN_ROLES, "manager", "staff"];
// Roles jo employees form se assign ho sakte hain (owner role nahi)
const ASSIGNABLE_ROLES = ["admin", "manager", "staff"];

const normalizeRole = (role) => String(role || "").toLowerCase();
const isOwnerRole = (role) => normalizeRole(role) === OWNER_ROLE;
const isAdminRole = (role) => ADMIN_ROLES.includes(normalizeRole(role));
const isStaffRole = (role) => STAFF_ROLES.includes(normalizeRole(role));

module.exports = { OWNER_ROLE, ADMIN_ROLES, STAFF_ROLES, ASSIGNABLE_ROLES, normalizeRole, isOwnerRole, isAdminRole, isStaffRole };
