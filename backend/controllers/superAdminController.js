const bcrypt = require("bcryptjs");
const { OWNER_ROLE, ADMIN_ROLES, STAFF_ROLES, ASSIGNABLE_ROLES, isOwnerRole, isAdminRole, isStaffRole } = require("../utils/roles");
const SuperAdmin = require("../models/SuperAdmin");
const SellerApplication = require("../models/SellerApplication");
const Store = require("../models/Store");
const Plan = require("../models/Plan");
const User = require("../models/User");
const Employee = require("../models/Employee");
const jwt = require("jsonwebtoken"); // store admin handoff token (openStoreAdmin)
// Super admin ka apna audience — sa_at / sa_rt cookies, alag secrets, rotating sessions
const tokens = require("../utils/tokens");
const { logActivity, activityRow, clientInfo } = require("../utils/superAdminActivity");
const SuperAdminActivity = require("../models/SuperAdminActivity");
const { storeAdminBaseUrl } = require("../utils/storeUrl");

// Seller ka employee: application ke store me (resume-flow wale purane records
// bina storeId ke bhi ho sakte hain — woh seller_pending se pehchane jate hain)
const sellerEmployeeFilter = (application) =>
  application.store_id
    ? { email: application.email, $or: [{ storeId: application.store_id }, { storeId: null, seller_pending: true }] }
    : { email: application.email, seller_pending: true };
const {
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
  sendApplicationInfoRequestedEmail,
} = require("../services/emailService");
const log = require("../utils/logger");
const { pushStoreActivity, getChanges } = require("../utils/activityHelper");
// approveRequest aur createSellerStore dono ko chahiye (pehle sirf createSellerStore ke andar tha → approve par ReferenceError)
const { uniqueUsername } = require("../utils/username");

// Best-effort seller notification — delivery failure must never reverse a decision
const notifySeller = async (sendFn, payload, action, entityId) => {
  try {
    const result = await sendFn(payload);
    if (!result?.delivered) {
      console.error(`[super-admin] ${action} email not delivered:`, result?.reason || "unknown");
      await logActivity({
        action: `${action} email not delivered`,
        entityType: "seller_application",
        entityId: String(entityId || ""),
        details: { to: payload?.email, reason: result?.reason || "unknown" },
      }).catch(() => {});
    }
    return result;
  } catch (error) {
    console.error(`[super-admin] ${action} email failed:`, error?.message || error);
    return { delivered: false, reason: "send_failed" };
  }
};

/* ==========================================
   AUTH — separate from seller/customer auth
   ========================================== */

const loginSuperAdmin = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    const superAdmin = await SuperAdmin.findOne({ email: normalizedEmail });
    if (!superAdmin) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }
    if (superAdmin.status !== "active") {
      return res.status(403).json({ success: false, message: "Super Admin account is inactive." });
    }
    const matches = await bcrypt.compare(String(password), superAdmin.passwordHash);
    if (!matches) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    await tokens.issueSession(req, res, "superadmin", { _id: superAdmin._id, role: superAdmin.role || "superadmin" });
    superAdmin.lastLoginAt = new Date();
    superAdmin.lastActiveAt = superAdmin.lastLoginAt;
    await superAdmin.save().catch(() => {});
    await logActivity({
      action: "Signed in",
      actor: superAdmin,
      entityType: "auth",
      entityId: String(superAdmin._id),
      details: clientInfo(req),
    });

    return res.json({
      success: true,
      message: "Super Admin login successful.",
      data: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        role: superAdmin.role || "superadmin",
        lastLoginAt: superAdmin.lastLoginAt,
      },
    });
  } catch (error) {
    log.error("[super-admin] login error:", error.message);
    return res.status(500).json({ success: false, message: "Login failed." });
  }
};

const refreshSuperAdminToken = async (req, res) => {
  try {
    const result = await tokens.rotateSession(req, res, "superadmin", async (id) => {
      const superAdmin = await SuperAdmin.findById(id).select("_id role status").lean();
      if (!superAdmin || superAdmin.status !== "active") return null;
      return { _id: superAdmin._id, role: superAdmin.role || "superadmin" };
    });
    if (!result.ok) return res.status(result.status).json({ success: false, message: result.message });
    return res.json({ success: true, message: "Token refreshed" });
  } catch (error) {
    log.error("[super-admin] refresh error:", error.message);
    return res.status(500).json({ success: false, message: "Could not refresh session" });
  }
};

const logoutSuperAdmin = async (req, res) => {
  try {
    let actor = req.superAdmin;
    if (!actor) {
      // Expired access token (sa_at) par bhi pata chale kaun logout hua
      const token = req.cookies?.[tokens.AUDIENCES.superadmin.cookies.access];
      try {
        const payload = token ? tokens.verifyAccess("superadmin", token, { ignoreExpiration: true }) : null;
        if (payload?.userId) actor = await SuperAdmin.findById(payload.userId).select("name email").lean();
      } catch { actor = null; }
    }
    await tokens.revokeCurrentSession(req, "superadmin").catch(() => {});
    tokens.clearAuthCookies(res, "superadmin");
    if (actor) {
      await logActivity({
        action: "Signed out",
        actor,
        entityType: "auth",
        entityId: String(actor._id),
        details: clientInfo(req),
      });
    }
    return res.json({ success: true, message: "Logged out." });
  } catch (error) {
    tokens.clearAuthCookies(res, "superadmin");
    return res.status(500).json({ success: false, message: "Logout failed." });
  }
};

const meSuperAdmin = (req, res) => {
  const admin = req.superAdmin;
  return res.json({
    success: true,
    data: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role || "superadmin",
      lastLoginAt: admin.lastLoginAt,
    },
  });
};

/* ==========================================
   DASHBOARD — real database counts
   ========================================== */

const getDashboard = async (req, res) => {
  try {
    const [
      totalUsers,
      totalSellers,
      totalStores,
      pendingApplications,
      approvedApplications,
      rejectedApplications,
      suspendedStores,
      recentRequests,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments({ is_deleted: { $ne: true }, role: "user" }),
      SellerApplication.countDocuments({ status: "approved" }),
      Store.countDocuments(),
      SellerApplication.countDocuments({ status: "pending" }),
      SellerApplication.countDocuments({ status: "approved" }),
      SellerApplication.countDocuments({ status: "rejected" }),
      Store.countDocuments({ store_status: "closed" }),
      SellerApplication.find()
        .sort({ created_at: -1 })
        .limit(6)
        .select("name email store_name status created_at")
        .lean(),
      User.find({ is_deleted: { $ne: true }, role: "user" })
        .sort({ created_at: -1 })
        .limit(6)
        .select("name email username created_at storeId status")
        .lean(),
    ]);

    // 7-day registration series (customers)
    const since = new Date();
    since.setDate(since.getDate() - 6);
    since.setHours(0, 0, 0, 0);
    const series = await User.aggregate([
      { $match: { created_at: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const seriesMap = new Map(series.map((s) => [s._id, s.count]));
    const registrationSeries = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      registrationSeries.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        count: seriesMap.get(key) || 0,
      });
    }

    return res.json({
      success: true,
      data: {
        totals: {
          totalUsers,
          totalSellers,
          totalStores,
          pendingApplications,
          approvedApplications,
          rejectedApplications,
          suspendedStores,
        },
        recentRequests,
        recentUsers,
        registrationSeries,
        approvalSplit: {
          pending: pendingApplications,
          approved: approvedApplications,
          rejected: rejectedApplications,
        },
      },
    });
  } catch (error) {
    log.error("[super-admin] dashboard error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load dashboard." });
  }
};

/* ==========================================
   REQUESTS — the seller application queue
   ========================================== */

// Platform host par tenant context nahi hota, phir bhi cross-store queries explicit rakho
const CROSS_STORE = { skipTenantScope: true };
const REQUEST_STATUSES = ["pending", "approved", "rejected"];

const listRequests = async (req, res) => {
  try {
    const { status, search, sort = "newest", page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const filter = {};
    if (REQUEST_STATUSES.includes(String(status || ""))) {
      filter.status = String(status);
    }
    if (search) {
      const pattern = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { name: pattern },
        { email: pattern },
        { store_name: pattern },
        { phone: pattern },
        { username: pattern },
        { city: pattern },
      ];
    }

    const [items, total, grouped] = await Promise.all([
      SellerApplication.find(filter)
        .sort({ created_at: sort === "oldest" ? 1 : -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .select("-passwordHash")
        .lean(),
      SellerApplication.countDocuments(filter),
      // Status tabs ke counts (search/filter se independent)
      SellerApplication.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);

    const counts = { all: 0, pending: 0, approved: 0, rejected: 0 };
    for (const row of grouped) {
      if (REQUEST_STATUSES.includes(row._id)) counts[row._id] = row.count;
      counts.all += row.count;
    }

    return res.json({
      success: true,
      data: { items, total, counts, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load requests." });
  }
};

const getRequest = async (req, res) => {
  try {
    const item = await SellerApplication.findById(req.params.id).select("-passwordHash").lean();
    if (!item) return res.status(404).json({ success: false, message: "Application not found." });

    // Linked store aur seller admin account — detail page ke liye ek hi call.
    // Seller ka identity Employee me hai, customer_users me koi record nahi.
    const [store, employee] = await Promise.all([
      item.store_id
        ? Store.findById(item.store_id).setOptions(CROSS_STORE).select("store_name subdomain store_status createdAt").lean()
        : null,
      item.store_id
        ? Employee.findOne({ email: item.email, storeId: item.store_id })
            .setOptions(CROSS_STORE)
            .select("status seller_pending created_at")
            .lean()
        : null,
    ]);

    return res.json({
      success: true,
      data: {
        ...item,
        store: store ? { ...store, url: storeAdminBaseUrl(store) } : null,
        account: {
          user: null,
          adminAccess: employee
            ? { status: employee.status, pending: !!employee.seller_pending, created_at: employee.created_at }
            : null,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load request." });
  }
};

// Pending request ki details theek karna (e.g. typo) — store bhi sync hota hai
const EDITABLE_REQUEST_FIELDS = {
  name: 100,
  phone: 20,
  store_name: 120,
  store_description: 2000,
  business_category: 80,
  country: 80,
  city: 80,
  address: 300,
  zip_code: 20,
};

const updateRequest = async (req, res) => {
  try {
    const body = req.body || {};
    const updates = {};
    for (const [field, max] of Object.entries(EDITABLE_REQUEST_FIELDS)) {
      if (body[field] === undefined) continue;
      updates[field] = String(body[field] ?? "").trim().slice(0, max);
    }
    if (body.business_type !== undefined) {
      if (!["individual", "registered_business"].includes(body.business_type)) {
        return res.status(400).json({ success: false, message: "Invalid business type." });
      }
      updates.business_type = body.business_type;
    }

    const errors = {};
    if ("name" in updates && updates.name.length < 2) errors.name = "Name must be at least 2 characters.";
    if ("store_name" in updates && !updates.store_name) errors.store_name = "Store name is required.";
    if ("phone" in updates && updates.phone && !/^\d{10,16}$/.test(updates.phone)) {
      errors.phone = "Phone must be 10–16 digits.";
    }
    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, message: "Please fix the highlighted fields.", errors });
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: "Nothing to update." });
    }

    const before = await SellerApplication.findById(req.params.id).select("-passwordHash").lean();
    if (!before) return res.status(404).json({ success: false, message: "Application not found." });
    if (before.status !== "pending") {
      return res.status(409).json({
        success: false,
        message: "Only pending requests can be edited. Approved stores are managed from Store Management.",
      });
    }

    const changed = Object.keys(updates).filter((key) => String(before[key] ?? "") !== String(updates[key]));
    if (!changed.length) {
      return res.json({ success: true, message: "No changes to save.", data: before });
    }

    const application = await SellerApplication.findOneAndUpdate(
      { _id: before._id, status: "pending" },
      { $set: updates },
      { returnDocument: "after" }
    ).select("-passwordHash").lean();
    if (!application) {
      return res.status(409).json({ success: false, message: "This request was reviewed meanwhile. Please reload." });
    }

    // Signup par bana (closed) store request ke saath sync rahe
    if (application.store_id) {
      const storeUpdates = {};
      const map = {
        store_name: "store_name",
        store_description: "description",
        business_category: "business_category",
        business_type: "business_type",
        country: "country",
        city: "city",
        address: "address",
        zip_code: "zip_code",
        phone: "phone",
      };
      for (const [from, to] of Object.entries(map)) if (from in updates) storeUpdates[to] = updates[from];
      if (Object.keys(storeUpdates).length) {
        await Store.updateOne({ _id: application.store_id }, { $set: storeUpdates }).setOptions(CROSS_STORE);
      }
    }
    if ("name" in updates) {
      if (application.store_id) {
        await Employee.updateOne(
          { email: application.email, storeId: application.store_id },
          { $set: { name: updates.name } }
        ).setOptions(CROSS_STORE);
      }
    }


    return res.json({ success: true, message: "Request updated.", data: application });
  } catch (error) {
    log.error("[super-admin] update request error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update request." });
  }
};

// Pending/rejected request delete — signup par bane (khali, closed) store aur
// accounts bhi hatao taake wahi email dobara signup kar sake.
const deleteRequest = async (req, res) => {
  try {
    const application = await SellerApplication.findById(req.params.id).select("-passwordHash").lean();
    if (!application) return res.status(404).json({ success: false, message: "Application not found." });
    if (application.status === "approved") {
      return res.status(409).json({
        success: false,
        message: "Approved sellers cannot be deleted from here. Suspend or delete the store from Store Management.",
      });
    }

    // Atomic: sirf tab delete jab abhi bhi approved nahi hua
    const deleted = await SellerApplication.findOneAndDelete({ _id: application._id, status: { $ne: "approved" } });
    if (!deleted) {
      return res.status(409).json({ success: false, message: "This request was approved meanwhile. Please reload." });
    }

    const removed = { store: 0, adminAccounts: 0 };
    if (application.store_id) {
      const storeResult = await Store.deleteOne({ _id: application.store_id, store_status: { $ne: "open" } }).setOptions(CROSS_STORE);
      removed.store = storeResult.deletedCount || 0;
      if (removed.store) {
        const empResult = await Employee.deleteMany({ storeId: application.store_id, email: application.email }).setOptions(CROSS_STORE);
        removed.adminAccounts = empResult.deletedCount || 0;
      }
    }

    return res.json({ success: true, message: "Signup request deleted.", data: { removed } });
  } catch (error) {
    log.error("[super-admin] delete request error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to delete request." });
  }
};

const approveRequest = async (req, res) => {
  try {
    // Atomic guard: only flip pending → approved once
    const application = await SellerApplication.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      {
        status: "approved",
        reviewed_by: req.superAdmin._id,
        reviewed_at: new Date(),
      },
      { returnDocument: "after" }
    );
    if (!application) {
      return res
        .status(409)
        .json({ success: false, message: "This application is not pending (already reviewed)." });
    }

    // Store is provisioned at signup time; open it and unblock the pending seller employee.
    const storeId = application.store_id;
    const store = storeId
      ? await Store.findByIdAndUpdate(storeId, { store_status: "open" }, { returnDocument: "after" })
      : null;
    // Email ab sirf store ke andar unique — isi application ke store ka seller employee
    await Employee.findOneAndUpdate(
      sellerEmployeeFilter(application),
      { seller_pending: false, status: "active", role: OWNER_ROLE, ...(store ? { storeId: store._id } : {}) }
    ).setOptions({ skipTenantScope: true });

    // Store signup time pe already provision hota hai; nahi ho to ab banao.
    let openStore = store;
    if (!openStore) {
      const storeName0 = application.store_name || [application.name, "Store"].filter(Boolean).join(" ");
      openStore = await Store.create({
        store_name: storeName0,
        email: application.email,
        phone: application.phone || "",
        store_status: "open",
      });
    }

    await SellerApplication.updateOne({ _id: application._id }, { store_id: openStore._id, user_id: null });

    // Seller ka identity sirf Employee (admin_users) — na ho to ab banao.
    let sellerEmployee = await Employee.findOne(sellerEmployeeFilter(application)).setOptions({ skipTenantScope: true });
    if (!sellerEmployee) {
      const username = String(application.username || "").trim().toLowerCase() || (await uniqueUsername(application.name, application.email));
      sellerEmployee = await Employee.create({
        name: application.name,
        username,
        email: application.email,
        phone: application.phone || "",
        password: application.passwordHash,
        role: OWNER_ROLE,
        status: "active",
        storeId: openStore._id,
        seller_pending: false,
      });
    } else {
      await Employee.updateOne(
        { _id: sellerEmployee._id },
        { seller_pending: false, status: "active", role: OWNER_ROLE, storeId: openStore._id }
      ).setOptions({ skipTenantScope: true });
    }

    await notifySeller(
      sendApplicationApprovedEmail,
      { name: application.name, email: application.email, storeName: application.store_name, storeUrl: storeAdminBaseUrl(openStore) },
      "Approval",
      application._id
    );

    return res.json({
      success: true,
      message: "Seller approved and store opened.",
      data: { storeId: openStore._id },
    });
  } catch (error) {
    log.error("[super-admin] approve error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to approve application." });
  }
};

const requestInfo = async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim().slice(0, 2000);
    if (!message) {
      return res.status(400).json({ success: false, message: "A message is required." });
    }

    const application = await SellerApplication.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      { info_request_message: message, info_requested_at: new Date() },
      { returnDocument: "after" }
    );
    if (!application) {
      return res
        .status(409)
        .json({ success: false, message: "This application is not pending (already reviewed)." });
    }


    await notifySeller(
      sendApplicationInfoRequestedEmail,
      {
        name: application.name,
        email: application.email,
        storeName: application.store_name,
        message,
        // /store-setup ka signed link (sirf email se ab application nahi khulti)
        setupToken: require("../utils/sellerSetupToken").signSetupToken(application),
      },
      "Info request",
      application._id
    );

    return res.json({ success: true, message: "Information request sent to the applicant." });
  } catch (error) {
    log.error("[super-admin] request-info error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to send information request." });
  }
};

const rejectRequest = async (req, res) => {
  try {
    const reason = String(req.body?.reason || "").trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: "A rejection reason is required." });
    }
    const application = await SellerApplication.findOneAndUpdate(
      { _id: req.params.id, status: "pending" },
      {
        status: "rejected",
        rejection_reason: reason.slice(0, 500),
        reviewed_by: req.superAdmin._id,
        reviewed_at: new Date(),
      },
      { returnDocument: "after" }
    );
    if (!application) {
      return res
        .status(409)
        .json({ success: false, message: "This application is not pending (already reviewed)." });
    }

    // Close the store created at signup so the seller's panel cannot transact
    if (application.store_id) {
      await Store.updateOne({ _id: application.store_id }, { store_status: "closed" });
      await Employee.findOneAndUpdate(
        sellerEmployeeFilter(application),
        { seller_pending: true, status: "inactive", storeId: application.store_id }
      ).setOptions({ skipTenantScope: true });
    }

    const storedReason = reason.slice(0, 500);

    await notifySeller(
      sendApplicationRejectedEmail,
      { name: application.name, email: application.email, storeName: application.store_name, reason: storedReason },
      "Rejection",
      application._id
    );

    return res.json({ success: true, message: "Application rejected." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to reject application." });
  }
};

/* ==========================================
   STORES — suspend / activate
   ========================================== */

const listStores = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const filter = { is_deleted: { $ne: true } };
    if (["open", "closed", "maintenance"].includes(String(status || ""))) {
      filter.store_status = String(status);
    }
    if (search) {
      const pattern = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ store_name: pattern }, { email: pattern }];
    }

    const [stores, total] = await Promise.all([
      Store.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean(),
      Store.countDocuments(filter),
    ]);

    // Owner = store ka Employee (seller) — customer_users me seller nahi hota
    const storeIds = stores.map((s) => s._id);
    // Owner = store ka Employee (seller); plans = assigned subscription catalog
    const planIds = [...new Set(stores.map((s) => s.planId).filter(Boolean).map(String))];
    const [owners, plans] = await Promise.all([
      Employee.find({ storeId: { $in: storeIds }, role: OWNER_ROLE })
        .select("name username email storeId seller_pending")
        .setOptions(CROSS_STORE)
        .lean(),
      planIds.length
        ? Plan.find({ _id: { $in: planIds } }).select("name status price billingInterval currency").lean()
        : Promise.resolve([]),
    ]);
    const ownerByStore = new Map();
    owners.forEach((o) => ownerByStore.set(String(o.storeId), o));
    const planById = new Map(plans.map((p) => [String(p._id), p]));

    const items = stores.map((s) => {
      const owner = ownerByStore.get(String(s._id));
      const plan = s.planId ? planById.get(String(s.planId)) : null;
      return {
        id: s._id,
        store_name: s.store_name,
        owner_name: owner?.name || "Default / Unassigned",
        owner_email: owner?.email || s.email || "",
        owner_username: owner?.username || "",
        owner_id: owner?._id || null,
        email: s.email || "",
        phone: s.phone || "",
        subdomain: s.subdomain || "",
        city: s.city || "",
        business_category: s.business_category || "",
        description: s.description || "",
        business_type: s.business_type || "individual",
        country: s.country || "",
        address: s.address || "",
        zip_code: s.zip_code || "",
        logo_url: s.logo?.img_url || "",
        planId: s.planId || null,
        plan: plan ? { id: plan._id, name: plan.name, status: plan.status, price: plan.price, billingInterval: plan.billingInterval, currency: plan.currency } : null,
        // Real storefront URL (subdomain) — same helper as request detail, emails and handoff
        url: storeAdminBaseUrl(s),
        createdAt: s.createdAt,
        status: s.store_status || "open",
        approvalStatus: owner?.seller_pending ? "pending" : s.store_status === "closed" ? "suspended" : "active",
      };
    });

    return res.json({
      success: true,
      data: { items, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load stores." });
  }
};

const getStore = async (req, res) => {
  try {
    const store = await Store.findById(req.params.id).lean();
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });
    const [owner, plan] = await Promise.all([
      Employee.findOne({ storeId: store._id, role: OWNER_ROLE })
        .select("name username email phone status seller_pending createdAt")
        .setOptions(CROSS_STORE)
        .lean(),
      store.planId
        ? Plan.findById(store.planId).select("name status price billingInterval currency").lean()
        : Promise.resolve(null),
    ]);
    return res.json({
      success: true,
      data: {
        ...store,
        id: store._id,
        status: store.store_status || "open",
        approvalStatus: owner?.seller_pending ? "pending" : store.store_status === "closed" ? "suspended" : "active",
        logo_url: store.logo?.img_url || "",
        url: storeAdminBaseUrl(store),
        owner: owner || null,
        planId: store.planId || null,
        plan: plan
          ? { id: plan._id, name: plan.name, status: plan.status, price: plan.price, billingInterval: plan.billingInterval, currency: plan.currency }
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load store." });
  }
};

const setStoreStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["open", "closed", "maintenance"].includes(String(status || ""))) {
      return res.status(400).json({ success: false, message: "status must be open, closed or maintenance." });
    }
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });
    const previous = store.store_status;
    store.store_status = status;
    await store.save();
    if (previous !== status) await pushStoreActivity(store._id, req, "status_changed", `Store status changed from ${previous} to ${status}`, { from: previous, to: status });

    // Sync accounts: customer login block + seller (Employee) admin login block
    if (status === "closed") {
      await User.updateMany({ storeId: store._id }, { status: "blocked" });
      await Employee.updateMany({ storeId: store._id }, { status: "inactive" }).setOptions(CROSS_STORE);
    } else if (status === "open") {
      await User.updateMany({ storeId: store._id, status: "blocked" }, { status: "active" });
      await Employee.updateMany({ storeId: store._id, status: "inactive" }, { status: "active" }).setOptions(CROSS_STORE);
    }


    return res.json({ success: true, message: "Store updated.", data: { status: store.store_status } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update store." });
  }
};

/** Empty / null / "" → null (no plan). Otherwise must be a real Plan id. */
const resolvePlanIdInput = async (raw) => {
  if (raw === undefined) return { skipped: true };
  if (raw === null || raw === "") return { planId: null };
  const id = String(raw).trim();
  if (!/^[a-f\d]{24}$/i.test(id)) return { error: "Invalid plan." };
  const plan = await Plan.findById(id).select("_id").lean();
  if (!plan) return { error: "Plan not found." };
  return { planId: plan._id };
};

/* ==========================================
   ADD STORE (full page) — seller signup jaise saare fields: owner account + location + store.
   Store foran open, owner active + verified, SellerApplication "approved" (taake owner
   Stores → Manage owner / Users me sahi pehchana jaye). Koi field ghalat ho to kuch nahi banta.
   ========================================== */
const PPP_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const createSellerStore = async (req, res) => {
  const PendingRegistration = require("../models/PendingRegistration");
  const { validateStoreAddress } = require("../utils/tenantHost");
  const b = req.body || {};
  const str = (v, max = 300) => String(v ?? "").trim().slice(0, max);
  const name = str(b.name, 80);
  const usernameIn = str(b.username, 30);
  const phone = String(b.phone ?? "").replace(/\D/g, "").slice(0, 16);
  const email = str(b.email, 120).toLowerCase();
  const password = String(b.password ?? "");
  const storeName = str(b.storeName, 140);
  const subdomain = str(b.subdomain, 63).toLowerCase();
  const businessCategory = str(b.businessCategory, 80);
  const storeDescription = str(b.storeDescription, 2000);
  const country = str(b.country, 80);
  const city = str(b.city, 80);
  const address = str(b.address, 300);
  const zipCode = str(b.zipCode, 20);

  const errors = {};
  if (name.length < 2) errors.name = "Name must be at least 2 characters.";
  if (usernameIn && !/^[A-Za-z0-9_]{3,30}$/.test(usernameIn)) errors.username = "3–30 characters: letters, numbers or underscores.";
  if (phone.length < 10) errors.phone = "Phone must be 10–16 digits.";
  if (!PPP_EMAIL_RE.test(email)) errors.email = "Enter a valid email address.";
  if (password.length < 8) errors.password = "Password must be at least 8 characters.";
  if (!storeName) errors.storeName = "Please enter the store name.";
  if (!businessCategory) errors.businessCategory = "Please select a business category.";
  if (!storeDescription) errors.storeDescription = "Please describe the store.";
  if (!country) errors.country = "Please select a country.";
  if (city.length < 2) errors.city = "Please enter the city.";
  if (address.length < 5) errors.address = "Please enter a complete store address.";
  const subError = validateStoreAddress(subdomain);
  if (subError) errors.subdomain = subError;

  try {
    // Uniqueness — seller ka identity Employee me hai (customer_users me nahi)
    const [emailUser, emailEmp, emailPending, emailApp, phoneEmp, usernameEmp, subStore, subPending] = await Promise.all([
      errors.email ? null : User.exists({ email }).setOptions(CROSS_STORE),
      errors.email ? null : Employee.exists({ email }).setOptions(CROSS_STORE),
      errors.email ? null : PendingRegistration.exists({ email, expiresAt: { $gt: new Date() } }),
      errors.email ? null : SellerApplication.exists({ email, status: "pending" }),
      errors.phone ? null : Employee.exists({ phone }).setOptions(CROSS_STORE),
      !usernameIn || errors.username ? null : Employee.exists({ username: usernameIn }).setOptions(CROSS_STORE),
      errors.subdomain ? null : Store.exists({ subdomain }).setOptions(CROSS_STORE),
      errors.subdomain ? null : PendingRegistration.exists({ subdomain, expiresAt: { $gt: new Date() } }),
    ]);
    if (emailUser || emailEmp) errors.email = "An account with this email already exists.";
    else if (emailPending || emailApp) errors.email = "This email has a signup in progress — review it under Signup Requests.";
    if (phoneEmp) errors.phone = "This phone number is already registered.";
    if (usernameEmp) errors.username = "This username is already taken.";
    if (subStore || subPending) errors.subdomain = "This store address is already taken.";
    if (Object.keys(errors).length) {
      return res.status(400).json({ success: false, message: Object.values(errors)[0], errors });
    }

    const username = usernameIn || (await uniqueUsername(name, email, { excludeEmail: email }));
    const passwordHash = await bcrypt.hash(password, 10);
    const created = {};
    try {
      created.store = await Store.create({
        store_name: storeName,
        subdomain,
        tagline: "Welcome to our store",
        description: storeDescription,
        business_category: businessCategory,
        business_type: "individual",
        email,
        phone,
        country,
        city,
        address,
        zip_code: zipCode,
        store_status: "open",
        currency: "PKR",
        tax_rate: 17,
        weight_unit: "kg",
      });
      created.employee = await Employee.create({
        name, username, email, phone, password: passwordHash,
        role: OWNER_ROLE, status: "active", storeId: created.store._id, seller_pending: false,
      });
      created.application = await SellerApplication.create({
        name, email, phone, username, passwordHash,
        store_name: storeName,
        store_description: storeDescription,
        business_category: businessCategory,
        business_type: "individual",
        country, city, address, zip_code: zipCode,
        status: "approved",
        reviewed_by: req.superAdmin._id,
        reviewed_at: new Date(),
        user_id: null,
        store_id: created.store._id,
      });
    } catch (err) {
      // Aadha bana hua data na rahe
      await Promise.allSettled([
        created.application && SellerApplication.deleteOne({ _id: created.application._id }),
        created.employee && Employee.deleteOne({ _id: created.employee._id }).setOptions(CROSS_STORE),
        created.store && Store.deleteOne({ _id: created.store._id }).setOptions(CROSS_STORE),
      ]);
      if (err?.code === 11000) {
        const key = Object.keys(err.keyPattern || err.keyValue || {}).find((k) => k !== "storeId") || "";
        const field = key === "subdomain" ? "subdomain" : key === "username" ? "username" : key === "phone" ? "phone" : "email";
        const msg = field === "subdomain" ? "This store address is already taken." : field === "username" ? "This username is already taken." : field === "phone" ? "This phone number is already registered." : "An account with this email already exists.";
        return res.status(409).json({ success: false, message: msg, errors: { [field]: msg } });
      }
      throw err;
    }

    const storeUrl = storeAdminBaseUrl(created.store);
    await pushStoreActivity(created.store._id, req, "created", "Store created by Super Admin", { storeName });
    await logActivity({
      action: `Store created: ${storeName}`,
      actor: req.superAdmin,
      entityType: "store",
      entityId: String(created.store._id),
      details: { subdomain },
    });
    if (b.notify === true) {
      await notifySeller(sendApplicationApprovedEmail, { name, email, storeName, storeUrl }, "Approval", created.application._id);
    }
    return res.status(201).json({
      success: true,
      message: `${storeName} is live — ${name} can sign in with ${email}.`,
      data: { storeId: created.store._id, subdomain, url: storeUrl },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create the store." });
  }
};

const createStore = async (req, res) => {
  try {
    const { store_name, email, phone, subdomain, store_status = "open", business_category, business_type, description, country, city, address, zip_code, logo_url, planId } = req.body || {};
    if (!String(store_name || "").trim()) return res.status(400).json({ success: false, message: "Store name is required." });
    if (!["open", "closed", "maintenance"].includes(String(store_status))) return res.status(400).json({ success: false, message: "Invalid store status." });
    const planResult = await resolvePlanIdInput(planId === undefined ? null : planId);
    if (planResult.error) return res.status(400).json({ success: false, message: planResult.error });
    const store = await Store.create({
      store_name: String(store_name).trim(),
      email: String(email || "").trim(),
      phone: String(phone || "").trim(),
      subdomain: String(subdomain || "").trim().toLowerCase() || undefined,
      store_status,
      business_category: String(business_category || "").trim(),
      business_type: ["individual", "registered_business"].includes(String(business_type)) ? business_type : "individual",
      description: String(description || "").trim(),
      country: String(country || "").trim(),
      city: String(city || "").trim(),
      address: String(address || "").trim(),
      zip_code: String(zip_code || "").trim(),
      logo: { img_url: String(logo_url || "").trim(), public_id: "" },
      planId: planResult.planId ?? null,
    });
    await pushStoreActivity(store._id, req, "created", "Store created by Super Admin", { storeName: store.store_name });
    await logActivity({ action: `Store created: ${store.store_name}`, actor: req.superAdmin, entityType: "store", entityId: String(store._id), details: { subdomain: store.subdomain } });
    return res.status(201).json({ success: true, message: "Store created.", data: store });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "That subdomain is already in use." });
    return res.status(500).json({ success: false, message: "Failed to create store." });
  }
};

const updateStore = async (req, res) => {
  try {
    const { store_name, email, phone, subdomain, store_status, business_category, business_type, description, country, city, address, zip_code, logo_url, planId } = req.body || {};
    if (!String(store_name || "").trim()) return res.status(400).json({ success: false, message: "Store name is required." });
    if (store_status && !["open", "closed", "maintenance"].includes(String(store_status))) return res.status(400).json({ success: false, message: "Invalid store status." });
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });
    const planResult = await resolvePlanIdInput(planId);
    if (planResult.error) return res.status(400).json({ success: false, message: planResult.error });
    const before = store.toObject();
    Object.assign(store, {
      store_name: String(store_name).trim(),
      email: String(email || "").trim(),
      phone: String(phone || "").trim(),
      subdomain: String(subdomain || "").trim().toLowerCase() || undefined,
      store_status: store_status || store.store_status,
      business_category: String(business_category || "").trim(),
      business_type: ["individual", "registered_business"].includes(String(business_type)) ? business_type : store.business_type,
      description: String(description || "").trim(),
      country: String(country || "").trim(),
      city: String(city || "").trim(),
      address: String(address || "").trim(),
      zip_code: String(zip_code || "").trim(),
    });
    if (!planResult.skipped) store.planId = planResult.planId;
    if (logo_url !== undefined) store.logo = { ...(store.logo?.toObject?.() || store.logo || {}), img_url: String(logo_url || "").trim() };
    await store.save();
    const changes = getChanges(before, store.toObject(), ["store_name", "email", "phone", "business_category", "description", "country", "city", "address", "zip_code", "store_status", "planId"]);
    await pushStoreActivity(store._id, req, "updated", "Store details updated by Super Admin", { changes });
    await logActivity({ action: `Store updated: ${store.store_name}`, actor: req.superAdmin, entityType: "store", entityId: String(store._id), details: { status: store.store_status, changes } });
    return res.json({ success: true, message: "Store updated.", data: store });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "That subdomain is already in use." });
    return res.status(500).json({ success: false, message: "Failed to update store." });
  }
};

const deleteStore = async (req, res) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });
    if (store.is_deleted) {
      return res.json({ success: true, message: "Store already deleted." });
    }
    const storeName = store.store_name;
    const freedSubdomain = store.subdomain;
    // Soft delete — keep products/orders/employees for offline purge (§3.7).
    // Clear host fields so subdomain/custom domain can be reused.
    store.is_deleted = true;
    store.deleted_at = new Date();
    store.deletedby = req.superAdmin?._id || null;
    store.store_status = "closed";
    store.subdomain = undefined;
    store.customDomain = undefined;
    store.domainVerified = false;
    await store.save();
    await Employee.updateMany(
      { storeId: store._id, status: { $ne: "inactive" } },
      { status: "inactive" },
    ).setOptions(CROSS_STORE);
    try {
      require("../middleware/resolveStore").clearStoreHostCache();
    } catch { /* cache optional */ }
    await pushStoreActivity(store._id, req, "deleted", "Store soft-deleted by Super Admin", {
      freedSubdomain: freedSubdomain || null,
    });
    await logActivity({
      action: `Store deleted: ${storeName}`,
      actor: req.superAdmin,
      entityType: "store",
      entityId: String(store._id),
      details: { soft: true, freedSubdomain: freedSubdomain || null },
    });
    return res.json({ success: true, message: "Store deleted." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete store." });
  }
};

/* ==========================================
   USERS — list + block/unblock
   ========================================== */

/* Users page = sirf customers. Seller ka account Employee (admin_users) me hota hai,
   customer_users me nahi — isliye yahan seller filter ki zarurat nahi. */

const listUsers = async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    // Users page = sirf customers; sellers Stores page par (owner) manage hote hain
    const base = { is_deleted: { $ne: true } };
    const filter = { ...base };
    if (role && String(role) === "user") filter.role = "user";
    if (status && ["active", "blocked", "inactive"].includes(String(status))) filter.status = String(status);
    if (search) {
      const pattern = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: pattern }, { email: pattern }, { username: pattern }];
    }

    const Order = require("../models/Order");
    const [users, total, counts] = await Promise.all([
      User.find(filter)
        .sort({ created_at: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .select("name username email phone role status storeId emailVerified provider created_at")
        .populate({ path: "storeId", select: "store_name subdomain store_status", options: CROSS_STORE })
        .lean(),
      User.countDocuments(filter),
      // Tabs ke counts — search/filter se independent
      Promise.all([
        User.countDocuments(base),
        User.countDocuments({ ...base, status: "active" }),
        User.countDocuments({ ...base, status: "blocked" }),
      ]).then(([all, active, blocked]) => ({ all, active, blocked })),
    ]);

    // Orders per user (cross-store) — sirf is page ke users ke liye
    const ids = users.map((u) => u._id);
    const orderStats = ids.length
      ? await Order.aggregate([
          { $match: { user_id: { $in: ids } } },
          { $group: { _id: "$user_id", count: { $sum: 1 }, total: { $sum: "$total" }, last_at: { $max: "$created_at" } } },
        ]).option(CROSS_STORE)
      : [];
    const ordersByUser = new Map(orderStats.map((o) => [String(o._id), o]));

    const items = users.map((u) => {
      const store = u.storeId && typeof u.storeId === "object" ? u.storeId : null;
      const o = ordersByUser.get(String(u._id));
      return {
        id: u._id,
        name: u.name,
        username: u.username,
        email: u.email,
        phone: u.phone || "",
        provider: u.provider || "local",
        type: "Customer",
        role: u.role,
        status: u.status || "active",
        emailVerified: !!u.emailVerified,
        created_at: u.created_at,
        store: store ? { id: store._id, name: store.store_name, subdomain: store.subdomain || "", status: store.store_status || "open", url: storeAdminBaseUrl(store) } : null,
        orders: { count: o?.count || 0, total: o?.total || 0, last_at: o?.last_at || null },
      };
    });

    return res.json({
      success: true,
      data: { items, total, counts, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load users." });
  }
};

/* ==========================================
   STORE ADMINS — store ke owner/admin accounts (Employee / admin_users).
   Seller ka customer User nahi hota — yahi asli store-admin list hai.
   ========================================== */
const listStoreAdmins = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));

    const base = { role: { $in: ADMIN_ROLES }, is_deleted: { $ne: true } };
    const filter = { ...base };
    if (["active", "inactive"].includes(String(status))) filter.status = String(status);
    if (search) {
      const pattern = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: pattern }, { email: pattern }, { username: pattern }, { phone: pattern }];
    }

    const [items, total, counts] = await Promise.all([
      Employee.find(filter)
        .select("name username email phone role status seller_pending storeId created_at")
        .populate({ path: "storeId", select: "store_name subdomain store_status", options: CROSS_STORE })
        .sort({ created_at: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .setOptions(CROSS_STORE)
        .lean(),
      Employee.countDocuments(filter).setOptions(CROSS_STORE),
      Promise.all([
        Employee.countDocuments(base).setOptions(CROSS_STORE),
        Employee.countDocuments({ ...base, status: "active" }).setOptions(CROSS_STORE),
        Employee.countDocuments({ ...base, status: "inactive" }).setOptions(CROSS_STORE),
      ]).then(([all, active, inactive]) => ({ all, active, inactive })),
    ]);

    const mapped = items.map((e) => {
      const store = e.storeId && typeof e.storeId === "object" ? e.storeId : null;
      return {
        id: e._id,
        name: e.name,
        username: e.username || "",
        email: e.email,
        phone: e.phone || "",
        role: e.role,
        status: e.status || "active",
        sellerPending: !!e.seller_pending,
        store: store
          ? { id: store._id, name: store.store_name, subdomain: store.subdomain || "", status: store.store_status || "open", url: storeAdminBaseUrl(store) }
          : null,
        created_at: e.created_at,
      };
    });

    return res.json({
      success: true,
      data: { items: mapped, total, counts, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load store admins." });
  }
};

const getStoreAdmin = async (req, res) => {
  try {
    const admin = await Employee.findOne({ _id: req.params.id, role: { $in: ADMIN_ROLES }, is_deleted: { $ne: true } })
      .select("name username email phone avatar role status seller_pending storeId created_at updated_at activities")
      .populate({ path: "storeId", select: "store_name subdomain store_status business_category logo created_at", options: CROSS_STORE })
      .setOptions(CROSS_STORE)
      .lean();
    if (!admin) return res.status(404).json({ success: false, message: "Store admin not found." });
    const store = admin.storeId && typeof admin.storeId === "object" ? admin.storeId : null;
    const application = await SellerApplication.findOne({ $or: [{ store_id: store?._id }, { email: admin.email }] })
      .select("status created_at reviewed_at reviewed_by rejection_reason")
      .populate("reviewed_by", "name email")
      .lean();
    return res.json({
      success: true,
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          username: admin.username || "",
          email: admin.email,
          phone: admin.phone || "",
          avatar: admin.avatar || "",
          role: admin.role,
          status: admin.status || "active",
          sellerPending: !!admin.seller_pending,
          created_at: admin.created_at,
          updated_at: admin.updated_at,
          activities: Array.isArray(admin.activities) ? admin.activities.slice(0, 100) : [],
          approval: application ? { status: application.status, requestedAt: application.created_at, reviewedAt: application.reviewed_at, reviewedBy: application.reviewed_by || null, rejectionReason: application.rejection_reason || "" } : null,
        },
        store: store
          ? { id: store._id, name: store.store_name, subdomain: store.subdomain || "", status: store.store_status || "open", business_category: store.business_category || "", logo: store.logo?.img_url || "", created_at: store.created_at, url: storeAdminBaseUrl(store) }
          : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load the store admin." });
  }
};

const resetStoreAdminPassword = async (req, res) => {
  try {
    const password = String(req.body?.password || "");
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters.", errors: { password: "Password must be at least 8 characters." } });
    }
    const admin = await Employee.findOne({ _id: req.params.id, role: { $in: ADMIN_ROLES }, is_deleted: { $ne: true } }).setOptions(CROSS_STORE);
    if (!admin) return res.status(404).json({ success: false, message: "Store admin not found." });
    admin.password = await bcrypt.hash(password, 10);
    await admin.save();
    await tokens.revokeAllForSubject("admin", admin._id);
    return res.json({ success: true, message: `Password updated for ${admin.name}. All their sessions have been signed out.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to reset the password." });
  }
};

const updateStoreAdmin = async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const phone = String(req.body?.phone || "").trim();
    const status = String(req.body?.status || "active");
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirmPassword || "");
    if (name.length < 2) return res.status(400).json({ success: false, message: "Name must be at least 2 characters." });
    if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(400).json({ success: false, message: "Enter a valid email address." });
    if (!["active", "inactive"].includes(status)) return res.status(400).json({ success: false, message: "Invalid account status." });
    if (password && (password.length < 8 || password !== confirmPassword)) return res.status(400).json({ success: false, message: password.length < 8 ? "Password must be at least 8 characters." : "Passwords do not match." });
    const duplicate = await Employee.exists({ email, _id: { $ne: req.params.id } }).setOptions(CROSS_STORE);
    if (duplicate) return res.status(409).json({ success: false, message: "That email is already in use." });
    const admin = await Employee.findOne({ _id: req.params.id, role: { $in: ADMIN_ROLES }, is_deleted: { $ne: true } }).setOptions(CROSS_STORE);
    if (!admin) return res.status(404).json({ success: false, message: "Store admin not found." });
    const changes = [];
    [["name", admin.name, name], ["email", admin.email, email], ["phone", admin.phone, phone], ["status", admin.status, status]].forEach(([field, before, after]) => { if (String(before || "") !== String(after || "")) changes.push({ field, oldValue: before || "empty", newValue: after || "empty" }); });
    admin.name = name; admin.email = email; admin.phone = phone; admin.status = status;
    if (password) { admin.password = await bcrypt.hash(password, 10); changes.push({ field: "password", oldValue: "••••••••", newValue: "changed" }); }
    await admin.save();
    if (changes.length) {
      await Employee.updateOne(
        { _id: admin._id },
        { $push: { activities: { $each: [{ action: "Store admin profile updated by Super Admin", category: "Employee Management", performedBy: null, performedByName: req.superAdmin?.name || "Super Admin", details: { changes }, timestamp: new Date() }], $position: 0, $slice: 100 } } },
      ).setOptions(CROSS_STORE);
    }
    return res.json({ success: true, message: "Store admin updated.", data: admin });
  } catch (error) { return res.status(500).json({ success: false, message: "Failed to update the store admin." }); }
};

const setStoreAdminStatus = async (req, res) => {
  try {
    const status = String(req.body?.status || "");
    if (!["active", "inactive"].includes(status)) {
      return res.status(400).json({ success: false, message: "status must be active or inactive." });
    }
    const admin = await Employee.findOneAndUpdate(
      { _id: req.params.id, role: { $in: ADMIN_ROLES }, is_deleted: { $ne: true } },
      { status },
      { new: true }
    ).setOptions(CROSS_STORE);
    if (!admin) return res.status(404).json({ success: false, message: "Store admin not found." });
    if (status === "inactive") await tokens.revokeAllForSubject("admin", admin._id);
    return res.json({ success: true, message: status === "inactive" ? `${admin.name} can no longer sign in.` : `${admin.name} can sign in again.`, data: { status: admin.status } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update the status." });
  }
};

// User detail — profile + store (seller) + application + admin access + orders + audit history
const getUser = async (req, res) => {
  try {
    const Order = require("../models/Order");
    const user = await User.findOne({ _id: req.params.id, is_deleted: { $ne: true } })
      .select("name username email phone role status storeId emailVerified provider avatar dob created_at updated_at")
      .populate({ path: "storeId", select: "store_name subdomain store_status business_category logo created_at", options: CROSS_STORE })
      .lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    // Customer ke liye store = jis store par shopping account hai (admin access nahi)
    const store = user.storeId && typeof user.storeId === "object" ? user.storeId : null;
    const [orderStats, recentOrders] = await Promise.all([
      Order.aggregate([
        { $match: { user_id: user._id } },
        { $group: { _id: null, count: { $sum: 1 }, total: { $sum: "$total" }, last_at: { $max: "$created_at" } } },
      ]).option(CROSS_STORE),
      Order.find({ user_id: user._id }).sort({ created_at: -1 }).limit(10).select("order_number total status created_at storeId").populate({ path: "storeId", select: "store_name", options: CROSS_STORE }).setOptions(CROSS_STORE).lean(),
    ]);
    const stats = orderStats[0] || {};

    return res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          username: user.username,
          email: user.email,
          phone: user.phone || "",
          provider: user.provider || "local",
          emailVerified: !!user.emailVerified,
          status: user.status || "active",
          type: "Customer",
          avatar: user.avatar || "",
          dob: user.dob || "",
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
        store: store
          ? { id: store._id, name: store.store_name, subdomain: store.subdomain || "", status: store.store_status || "open", category: store.business_category || "", logo: store.logo?.img_url || "", url: storeAdminBaseUrl(store), created_at: store.created_at }
          : null,
        application: null,
        adminAccess: null,
        orders: { count: stats.count || 0, total: stats.total || 0, last_at: stats.last_at || null },
        recentOrders: recentOrders.map((o) => ({ id: o._id, order_number: o.order_number, total: o.total, status: o.status, created_at: o.created_at, store: o.storeId && typeof o.storeId === "object" ? { id: o.storeId._id, name: o.storeId.store_name } : null })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load the user." });
  }
};

// Edit user — name, username, email, phone (uniqueness check ke saath)
const updateUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, is_deleted: { $ne: true } });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const { name, username, email, phone } = req.body || {};
    const errors = {};
    const changed = [];

    if (name !== undefined) {
      const v = String(name).trim();
      if (v.length < 2) errors.name = "Name must be at least 2 characters.";
      else if (v !== user.name) { user.name = v; changed.push("name"); }
    }
    if (username !== undefined) {
      const v = String(username).trim().toLowerCase();
      if (!/^[a-z0-9._]{3,30}$/.test(v)) errors.username = "3–30 characters: letters, numbers, dots or underscores.";
      else if (v !== String(user.username).toLowerCase()) {
        if (await User.exists({ _id: { $ne: user._id }, username: v })) errors.username = "This username is already taken.";
        else { user.username = v; changed.push("username"); }
      }
    }
    if (email !== undefined) {
      const v = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors.email = "Enter a valid email address.";
      else if (v !== user.email) {
        if (await User.exists({ _id: { $ne: user._id }, email: v })) errors.email = "Another account already uses this email.";
        else { user.email = v; changed.push("email"); }
      }
    }
    if (phone !== undefined) {
      const v = String(phone).replace(/\D/g, "").slice(0, 16);
      if (v && v.length < 10) errors.phone = "Phone must be 10–16 digits.";
      else if (v !== (user.phone || "")) {
        if (v && (await User.exists({ _id: { $ne: user._id }, phone: v }))) errors.phone = "Another account already uses this phone number.";
        else { user.phone = v; changed.push("phone"); }
      }
    }
    if (Object.keys(errors).length) return res.status(400).json({ success: false, message: Object.values(errors)[0], errors });
    if (!changed.length) return res.json({ success: true, message: "No changes to save." });

    await user.save();
    return res.json({ success: true, message: "User updated." });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "That email or username is already in use." });
    return res.status(500).json({ success: false, message: "Failed to update the user." });
  }
};

// Naya password set karo (purana dikh nahi sakta — bcrypt hash hai).
const setUserPassword = async (req, res) => {
  try {
    const password = String(req.body?.password || "");
    if (password.length < 8) return res.status(400).json({ success: false, message: "Password must be at least 8 characters.", errors: { password: "Password must be at least 8 characters." } });
    const user = await User.findOne({ _id: req.params.id, is_deleted: { $ne: true } });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const hash = await bcrypt.hash(password, 10);
    user.password = hash;
    await user.save();
    return res.json({ success: true, message: `Password updated for ${user.name}.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to set the password." });
  }
};

// Delete customer user (soft delete) — store khud delete nahi hota
const deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, is_deleted: { $ne: true } });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    user.is_deleted = true;
    user.deleted_at = new Date();
    user.status = "blocked";
    await user.save();
    return res.json({ success: true, message: `${user.name}'s account has been deleted.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete the user." });
  }
};

/* Store admin panel — super admin ko store owner ke taur par one-time sign-in link
   (same store_handoff token jo seller login handoff use karta hai, 2 min, ek baar) */
const openStoreAdmin = async (req, res) => {
  try {
    const store = await Store.findById(req.params.id).select("store_name subdomain").setOptions(CROSS_STORE).lean();
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });
    const baseUrl = storeAdminBaseUrl(store);
    if (!baseUrl) return res.status(400).json({ success: false, message: "This store has no address yet." });

    // Owner pehle (storehandler), warna store ka koi active admin
    const employees = await Employee.find({ storeId: store._id, is_deleted: { $ne: true }, status: { $ne: "inactive" } })
      .select("_id role email created_at").sort({ created_at: 1 }).setOptions(CROSS_STORE).lean();
    const target = employees.find((e) => isOwnerRole(e.role)) || employees.find((e) => isAdminRole(e.role));
    if (!target) return res.status(404).json({ success: false, message: "This store has no active admin account to open." });

    const token = jwt.sign(
      { type: "store_handoff", employeeId: String(target._id), storeId: String(store._id), jti: require("crypto").randomUUID(), via: "superadmin", by: String(req.superAdmin._id) },
      process.env.JWT_SECRET,
      { expiresIn: 120 },
    );
    return res.json({ success: true, data: { url: `${baseUrl}/admin-handoff#token=${encodeURIComponent(token)}` } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not open the store admin panel." });
  }
};

const setUserStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["active", "blocked"].includes(String(status || ""))) {
      return res.status(400).json({ success: false, message: "status must be active or blocked." });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const previous = user.status || "active";
    user.status = status;
    await user.save();


    return res.json({ success: true, message: "User updated.", data: { status: user.status } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update user." });
  }
};

/* ==========================================
   TEAM — super admin + staff accounts (superadmins collection)
   Staff = full panel access, sirf Team manage nahi kar sakte (route-level guard).
   ========================================== */
const TEAM_ROLES = ["superadmin", "staff"];
const TEAM_PASSWORD_MIN = 8;
const seedEmail = () => String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
const isSeedAccount = (doc) => !!doc && String(doc.email).toLowerCase() === seedEmail();

// Kaun kis account ko badal sakta hai (edit / status / password / remove):
//  • staff apna account nahi badal sakta (super admin apna badal sakta hai)
//  • staff sirf doosre staff ko; super admin accounts sirf super admin badalta hai
//  • seeded primary account aur "last super admin" ke alag checks neeche hain
const manageBlockReason = (target, me) => {
  const meRole = me?.role || "superadmin";
  const targetRole = target?.role || "superadmin";
  const self = String(target?._id) === String(me?._id);
  if (self && meRole !== "superadmin") return "You cannot change your own account. Ask a super admin.";
  if (meRole !== "superadmin" && targetRole === "superadmin") return "Only super admins can change a super admin account.";
  return null;
};

const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const publicMember = (m, me) => ({
  id: m._id,
  name: m.name,
  email: m.email,
  phone: m.phone || "",
  role: m.role || "superadmin",
  status: m.status,
  lastLoginAt: m.lastLoginAt,
  lastActiveAt: m.lastActiveAt || m.lastLoginAt || null,
  // 5 min ke andar koi request = online
  online: Boolean(m.status === "active" && m.lastActiveAt && Date.now() - new Date(m.lastActiveAt).getTime() < ONLINE_WINDOW_MS),
  created_at: m.created_at,
  createdBy: m.createdBy && typeof m.createdBy === "object" ? { id: m.createdBy._id, name: m.createdBy.name } : null,
  isSeed: isSeedAccount(m),
  isSelf: String(m._id) === String(me?._id),
  canManage: !manageBlockReason(m, me),
  activities: Array.isArray(m.activities) ? m.activities.slice(0, 100) : [],
});

const recordSuperAdminActivity = async (req, action, category = "System", details = {}) => {
  if (!req?.superAdmin?._id) return;
  await SuperAdmin.updateOne({ _id: req.superAdmin._id }, { $push: { activities: { $each: [{ action, category, details, timestamp: new Date() }], $position: 0, $slice: 100 } } });
  // Global audit feed (My activity / Team ActivityFeed) — best-effort
  await logActivity({
    action,
    actor: req.superAdmin,
    entityType: "superadmin",
    entityId: String(details?.memberId || req.superAdmin._id),
    details: { category, ...details },
  }).catch(() => {});
};

// Aakhri active super admin ko demote/deactivate/delete nahi karne dete — warna koi Team manage nahi kar sakega
const otherActiveSuperAdmins = (excludeId) =>
  SuperAdmin.countDocuments({ _id: { $ne: excludeId }, role: "superadmin", status: "active" });

const listTeam = async (req, res) => {
  try {
    // Team page = sirf staff. Super admin accounts (seeded) list me nahi aate.
    const members = await SuperAdmin.find({ role: "staff" }).populate("createdBy", "name").sort({ created_at: -1 }).lean();
    const counts = {
      all: members.length,
      active: members.filter((m) => m.status === "active").length,
      inactive: members.filter((m) => m.status === "inactive").length,
    };
    return res.json({ success: true, data: { items: members.map((m) => publicMember(m, req.superAdmin)), counts } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load the team." });
  }
};

const createTeamMember = async (req, res) => {
  try {
    const { name, email, password, phone = "" } = req.body || {};
    const role = "staff"; // Team page se sirf staff add hote hain; super admin sirf .env seed se
    const errors = {};
    const cleanName = String(name || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanPhone = String(phone || "").replace(/\D/g, "").slice(0, 16);
    if (cleanName.length < 2) errors.name = "Name must be at least 2 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) errors.email = "Enter a valid email address.";
    if (String(password || "").length < TEAM_PASSWORD_MIN) errors.password = `Password must be at least ${TEAM_PASSWORD_MIN} characters.`;
    if (!TEAM_ROLES.includes(String(role))) errors.role = "Invalid role.";
    if (Object.keys(errors).length) return res.status(400).json({ success: false, message: "Please fix the highlighted fields.", errors });

    if (await SuperAdmin.exists({ email: cleanEmail })) {
      return res.status(409).json({ success: false, message: "A team member with this email already exists.", errors: { email: "This email is already on the team." } });
    }

    const member = await SuperAdmin.create({
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      passwordHash: await bcrypt.hash(String(password), 10),
      role: String(role),
      status: "active",
      createdBy: req.superAdmin._id,
    });
    await recordSuperAdminActivity(req, `Added team member ${member.name}`, "Employee Management", { memberId: member._id });
    return res.status(201).json({ success: true, message: `${member.name} has been added to the team.`, data: publicMember(member.toObject(), req.superAdmin) });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "A team member with this email already exists." });
    return res.status(500).json({ success: false, message: "Failed to add the team member." });
  }
};

const updateTeamMember = async (req, res) => {
  try {
    const member = await SuperAdmin.findById(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: "Team member not found." });
    const blocked = manageBlockReason(member, req.superAdmin);
    if (blocked) return res.status(403).json({ success: false, message: blocked });
    const { name, phone, role } = req.body || {};
    const errors = {};
    const changed = [];

    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (cleanName.length < 2) errors.name = "Name must be at least 2 characters.";
      else if (cleanName !== member.name) { member.name = cleanName; changed.push("name"); }
    }
    if (phone !== undefined) {
      const cleanPhone = String(phone).replace(/\D/g, "").slice(0, 16);
      if (cleanPhone !== (member.phone || "")) { member.phone = cleanPhone; changed.push("phone"); }
    }
    if (role !== undefined && String(role) !== (member.role || "superadmin")) {
      if (!TEAM_ROLES.includes(String(role))) errors.role = "Invalid role.";
      else if (String(member._id) === String(req.superAdmin._id)) errors.role = "You cannot change your own role.";
      else if (isSeedAccount(member)) errors.role = "The primary super admin account's role cannot be changed.";
      else if (role === "staff" && (await otherActiveSuperAdmins(member._id)) === 0) errors.role = "At least one active super admin is required.";
      else { member.role = String(role); changed.push("role"); }
    }
    if (Object.keys(errors).length) return res.status(400).json({ success: false, message: Object.values(errors)[0], errors });
    if (!changed.length) return res.json({ success: true, message: "No changes to save.", data: publicMember(member.toObject(), req.superAdmin) });

    await member.save();
    await recordSuperAdminActivity(req, `Updated team member ${member.name}`, "Employee Management", { changed });
    return res.json({ success: true, message: "Team member updated.", data: publicMember(member.toObject(), req.superAdmin) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update the team member." });
  }
};

const setTeamMemberStatus = async (req, res) => {
  try {
    const status = String(req.body?.status || "");
    if (!["active", "inactive"].includes(status)) return res.status(400).json({ success: false, message: "Invalid status." });
    const member = await SuperAdmin.findById(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: "Team member not found." });
    const blocked = manageBlockReason(member, req.superAdmin);
    if (blocked) return res.status(403).json({ success: false, message: blocked });
    if (status === "inactive") {
      if (String(member._id) === String(req.superAdmin._id)) return res.status(400).json({ success: false, message: "You cannot deactivate your own account." });
      if (isSeedAccount(member)) return res.status(400).json({ success: false, message: "The primary super admin account cannot be deactivated." });
      if ((member.role || "superadmin") === "superadmin" && (await otherActiveSuperAdmins(member._id)) === 0) {
        return res.status(400).json({ success: false, message: "At least one active super admin is required." });
      }
    }
    if (member.status === status) return res.json({ success: true, message: "No change.", data: publicMember(member.toObject(), req.superAdmin) });
    member.status = status;
    await member.save();
    await recordSuperAdminActivity(req, `${status === "active" ? "Activated" : "Deactivated"} team member ${member.name}`, "Employee Management", { memberId: member._id });
    return res.json({ success: true, message: `${member.name} is now ${status}.`, data: publicMember(member.toObject(), req.superAdmin) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update the status." });
  }
};

const resetTeamMemberPassword = async (req, res) => {
  try {
    const password = String(req.body?.password || "");
    if (password.length < TEAM_PASSWORD_MIN) {
      return res.status(400).json({ success: false, message: `Password must be at least ${TEAM_PASSWORD_MIN} characters.`, errors: { password: `Password must be at least ${TEAM_PASSWORD_MIN} characters.` } });
    }
    const member = await SuperAdmin.findById(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: "Team member not found." });
    const blocked = manageBlockReason(member, req.superAdmin);
    if (blocked) return res.status(403).json({ success: false, message: blocked });
    member.passwordHash = await bcrypt.hash(password, 10);
    await member.save();
    await recordSuperAdminActivity(req, `Reset password for ${member.name}`, "Employee Management", { memberId: member._id });
    return res.json({ success: true, message: `Password updated for ${member.name}.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to reset the password." });
  }
};

const deleteTeamMember = async (req, res) => {
  try {
    const member = await SuperAdmin.findById(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: "Team member not found." });
    const blocked = manageBlockReason(member, req.superAdmin);
    if (blocked) return res.status(403).json({ success: false, message: blocked });
    if (String(member._id) === String(req.superAdmin._id)) return res.status(400).json({ success: false, message: "You cannot remove your own account." });
    if (isSeedAccount(member)) return res.status(400).json({ success: false, message: "The primary super admin account cannot be removed." });
    if ((member.role || "superadmin") === "superadmin" && member.status === "active" && (await otherActiveSuperAdmins(member._id)) === 0) {
      return res.status(400).json({ success: false, message: "At least one active super admin is required." });
    }
    await SuperAdmin.deleteOne({ _id: member._id });
    return res.json({ success: true, message: `${member.name} has been removed from the team.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to remove the team member." });
  }
};

// Detail page — profile (online / last seen account par hi saved hai)
const getTeamMember = async (req, res) => {
  try {
    const member = await SuperAdmin.findById(req.params.id).populate("createdBy", "name email").lean();
    if (!member) return res.status(404).json({ success: false, message: "Team member not found." });
    // Dekhna sab ko allowed hai — sirf badalna restricted (manageBlockReason)
    return res.json({ success: true, data: { member: publicMember(member, req.superAdmin) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load the team member." });
  }
};

/* ==========================================
   MY ACTIVITY — logged-in member ki apni actions (time + description)
   ========================================== */
const ACTIVITY_TYPES = ["seller_application", "store", "user", "superadmin", "auth", "settings", "system", "plan"];
// Ek member ki activity — feed + counts + stats (My activity aur Team detail dono)
const activityFeed = async (actorId, query = {}) => {
  const { type, search, page = 1, limit = 25 } = query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const base = { "actor.id": actorId };
  const filter = { ...base };
  if (type && ACTIVITY_TYPES.includes(String(type))) filter.entityType = String(type);
  if (search) filter.action = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - 6);

  const [items, total, byType, today, week, all] = await Promise.all([
    SuperAdminActivity.find(filter).sort({ created_at: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    SuperAdminActivity.countDocuments(filter),
    SuperAdminActivity.aggregate([{ $match: base }, { $group: { _id: "$entityType", count: { $sum: 1 } } }]),
    SuperAdminActivity.countDocuments({ ...base, created_at: { $gte: startOfDay } }),
    SuperAdminActivity.countDocuments({ ...base, created_at: { $gte: startOfWeek } }),
    SuperAdminActivity.countDocuments(base),
  ]);
  const counts = { all };
  for (const row of byType) counts[row._id] = row.count;
  return { items: items.map(activityRow), total, counts, stats: { today, week, all }, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) || 1 };
};

const myActivity = async (req, res) => {
  try {
    return res.json({ success: true, data: await activityFeed(req.superAdmin._id, req.query) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load your activity." });
  }
};

// Team member detail page ka full activity feed (sign-ins + actions)
const teamMemberActivity = async (req, res) => {
  try {
    const member = await SuperAdmin.findById(req.params.id).select("_id").lean();
    if (!member) return res.status(404).json({ success: false, message: "Team member not found." });
    return res.json({ success: true, data: await activityFeed(member._id, req.query) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load activity." });
  }
};

/* ==========================================
   PLANS — platform subscription catalog
   ========================================== */

const parseLimit = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return { error: true };
  return n;
};

const LIMIT_ERROR_LABELS = {
  maxProducts: "Max products",
  maxStaffAccounts: "Max staff accounts",
  maxOrders: "Max orders",
  maxChats: "Max chats",
  maxLeads: "Max leads",
  maxQuotes: "Max quotes",
  maxInvoices: "Max invoices",
};

const publicLimits = (limits = {}) => {
  const out = {};
  for (const key of Plan.LIMIT_KEYS) out[key] = limits?.[key] ?? null;
  return out;
};

const publicCreatedBy = (createdBy) => {
  if (!createdBy) return null;
  if (typeof createdBy === "object" && createdBy._id) {
    return { id: createdBy._id, name: createdBy.name || "", email: createdBy.email || "" };
  }
  return { id: createdBy, name: "", email: "" };
};

const publicPlan = (p, storeCount = 0) => ({
  id: p._id,
  name: p.name,
  slug: p.slug,
  description: p.description || "",
  status: p.status || "active",
  sortOrder: p.sortOrder ?? 0,
  price: p.price ?? 0,
  billingInterval: p.billingInterval || "monthly",
  currency: p.currency || "PKR",
  limits: publicLimits(p.limits),
  features: {
    orderManagement: p.features?.orderManagement || "basic",
    analytics: p.features?.analytics || "basic",
    pos: Boolean(p.features?.pos),
    customDomain: Boolean(p.features?.customDomain),
    // Missing (purane plans) = ON
    storeEditor: p.features?.storeEditor !== false,
  },
  storeCount,
  createdBy: publicCreatedBy(p.createdBy),
  created_at: p.created_at,
  updated_at: p.updated_at,
});

/** Activity against a plan entity (create / update / status / delete) */
const planEntityActivityFeed = async (planId, query = {}) => {
  const { search, page = 1, limit = 25 } = query;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
  const base = { entityType: "plan", entityId: String(planId) };
  const filter = { ...base };
  if (search) filter.action = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - 6);

  const [items, total, today, week, all] = await Promise.all([
    SuperAdminActivity.find(filter).sort({ created_at: -1 }).skip((pageNum - 1) * limitNum).limit(limitNum).lean(),
    SuperAdminActivity.countDocuments(filter),
    SuperAdminActivity.countDocuments({ ...base, created_at: { $gte: startOfDay } }),
    SuperAdminActivity.countDocuments({ ...base, created_at: { $gte: startOfWeek } }),
    SuperAdminActivity.countDocuments(base),
  ]);
  return {
    items: items.map(activityRow),
    total,
    counts: { all },
    stats: { today, week, all },
    page: pageNum,
    limit: limitNum,
    pages: Math.ceil(total / limitNum) || 1,
  };
};

const parsePlanBody = async (body, { forUpdate = false, existing = null } = {}) => {
  const errors = {};
  const name = String(body?.name ?? existing?.name ?? "").trim();
  if (name.length < 2) errors.name = "Name must be at least 2 characters.";

  const description = String(body?.description ?? existing?.description ?? "").trim();
  const statusRaw = body?.status ?? existing?.status ?? "active";
  if (!["active", "inactive"].includes(String(statusRaw))) errors.status = "Status must be active or inactive.";

  let sortOrder = existing?.sortOrder ?? 0;
  if (body?.sortOrder !== undefined && body?.sortOrder !== null && body?.sortOrder !== "") {
    const n = Number(body.sortOrder);
    if (!Number.isFinite(n) || !Number.isInteger(n)) errors.sortOrder = "Sort order must be a whole number.";
    else sortOrder = n;
  }

  let price = existing?.price ?? 0;
  if (body?.price !== undefined && body?.price !== null && body?.price !== "") {
    const n = Number(body.price);
    if (!Number.isFinite(n) || n < 0) errors.price = "Price must be zero or greater.";
    else price = n;
  } else if (!forUpdate && (body?.price === undefined || body?.price === null || body?.price === "")) {
    price = 0;
  }

  const billingInterval = String(body?.billingInterval ?? existing?.billingInterval ?? "monthly");
  if (!Plan.BILLING_INTERVALS.includes(billingInterval)) errors.billingInterval = "Invalid billing interval.";

  const currency = String(body?.currency ?? existing?.currency ?? "PKR").trim().toUpperCase() || "PKR";
  if (!/^[A-Z]{3}$/.test(currency)) errors.currency = "Currency must be a 3-letter ISO code.";

  const limitsIn = body?.limits || {};
  const limits = {};
  for (const key of Plan.LIMIT_KEYS) {
    const parsed = body?.limits ? parseLimit(limitsIn[key]) : (existing?.limits?.[key] ?? null);
    if (parsed?.error) errors[key] = `${LIMIT_ERROR_LABELS[key] || key} must be a whole number or unlimited.`;
    else limits[key] = parsed;
  }

  // Missing keys keep the stored value — the form no longer edits order, analytics, or custom domain.
  const featuresIn = body?.features && typeof body.features === "object" ? body.features : {};
  const hasFeature = (key) => Object.prototype.hasOwnProperty.call(featuresIn, key);
  const orderManagement = hasFeature("orderManagement")
    ? String(featuresIn.orderManagement)
    : String(existing?.features?.orderManagement ?? "basic");
  const analytics = hasFeature("analytics")
    ? String(featuresIn.analytics)
    : String(existing?.features?.analytics ?? "basic");
  if (!Plan.FEATURE_TIERS.includes(orderManagement)) errors.orderManagement = "Invalid order management tier.";
  if (!Plan.FEATURE_TIERS.includes(analytics)) errors.analytics = "Invalid analytics tier.";
  const pos = hasFeature("pos") ? Boolean(featuresIn.pos) : Boolean(existing?.features?.pos);
  const customDomain = hasFeature("customDomain")
    ? Boolean(featuresIn.customDomain)
    : Boolean(existing?.features?.customDomain);
  // features object poora replace hota hai — storeEditor yahan na ho to save par mit jata
  const storeEditor = hasFeature("storeEditor")
    ? Boolean(featuresIn.storeEditor)
    : existing?.features?.storeEditor !== false;

  if (Object.keys(errors).length) return { errors };

  const slug = await Plan.uniqueSlug(name, existing?._id || null);

  return {
    data: {
      name,
      slug,
      description,
      status: statusRaw,
      sortOrder,
      price,
      billingInterval,
      currency,
      limits,
      features: { orderManagement, analytics, pos, customDomain, storeEditor },
    },
  };
};

const listPlans = async (req, res) => {
  try {
    const { status, search } = req.query;
    const filter = {};
    if (["active", "inactive"].includes(String(status || ""))) filter.status = String(status);
    if (search) {
      const pattern = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: pattern }, { slug: pattern }, { description: pattern }];
    }

    const [plans, counts] = await Promise.all([
      Plan.find(filter).sort({ sortOrder: 1, created_at: -1 }).lean(),
      Promise.all([
        Plan.countDocuments({}),
        Plan.countDocuments({ status: "active" }),
        Plan.countDocuments({ status: "inactive" }),
      ]).then(([all, active, inactive]) => ({ all, active, inactive })),
    ]);

    const planIds = plans.map((p) => p._id);
    const storeCounts = planIds.length
      ? await Store.aggregate([
          { $match: { planId: { $in: planIds } } },
          { $group: { _id: "$planId", count: { $sum: 1 } } },
        ]).option({ skipTenantScope: true })
      : [];
    const countByPlan = new Map(storeCounts.map((r) => [String(r._id), r.count]));

    return res.json({
      success: true,
      data: {
        items: plans.map((p) => publicPlan(p, countByPlan.get(String(p._id)) || 0)),
        counts,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load plans." });
  }
};

const getPlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id).populate("createdBy", "name email").lean();
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found." });

    const [storeCount, stores, activityTotal, activityWeek] = await Promise.all([
      Store.countDocuments({ planId: plan._id }).setOptions({ skipTenantScope: true }),
      Store.find({ planId: plan._id })
        .select("store_name subdomain store_status logo createdAt")
        .sort({ createdAt: -1 })
        .limit(12)
        .setOptions({ skipTenantScope: true })
        .lean(),
      SuperAdminActivity.countDocuments({ entityType: "plan", entityId: String(plan._id) }),
      SuperAdminActivity.countDocuments({
        entityType: "plan",
        entityId: String(plan._id),
        created_at: { $gte: (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 6); return d; })() },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        plan: publicPlan(plan, storeCount),
        stores: stores.map((s) => ({
          id: s._id,
          store_name: s.store_name,
          subdomain: s.subdomain || "",
          status: s.store_status || "open",
          logo_url: s.logo?.img_url || "",
          createdAt: s.createdAt,
        })),
        stats: { stores: storeCount, activity: activityTotal, activityWeek },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load the plan." });
  }
};

const planActivity = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id).select("_id").lean();
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found." });
    return res.json({ success: true, data: await planEntityActivityFeed(plan._id, req.query) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load plan activity." });
  }
};

const createPlan = async (req, res) => {
  try {
    const parsed = await parsePlanBody(req.body || {}, { forUpdate: false });
    if (parsed.errors) {
      return res.status(400).json({ success: false, message: "Please fix the highlighted fields.", errors: parsed.errors });
    }
    const plan = await Plan.create({
      ...parsed.data,
      createdBy: req.superAdmin?._id || null,
    });
    await logActivity({
      action: `Plan created: ${plan.name}`,
      actor: req.superAdmin,
      entityType: "plan",
      entityId: String(plan._id),
      details: { price: plan.price, billingInterval: plan.billingInterval },
    });
    const lean = plan.toObject();
    lean.createdBy = req.superAdmin
      ? { _id: req.superAdmin._id, name: req.superAdmin.name, email: req.superAdmin.email }
      : null;
    return res.status(201).json({ success: true, message: `${plan.name} has been created.`, data: publicPlan(lean, 0) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "A plan with that name already exists.", errors: { name: "This name is already taken." } });
    }
    return res.status(500).json({ success: false, message: "Failed to create the plan." });
  }
};

const updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found." });
    const parsed = await parsePlanBody(req.body || {}, { forUpdate: true, existing: plan.toObject() });
    if (parsed.errors) {
      return res.status(400).json({ success: false, message: "Please fix the highlighted fields.", errors: parsed.errors });
    }
    const before = plan.name;
    Object.assign(plan, parsed.data);
    await plan.save();
    const storeCount = await Store.countDocuments({ planId: plan._id }).setOptions({ skipTenantScope: true });
    await logActivity({
      action: `Plan updated: ${plan.name}`,
      actor: req.superAdmin,
      entityType: "plan",
      entityId: String(plan._id),
      details: { changed: before !== plan.name ? ["name"] : ["details"] },
    });
    return res.json({ success: true, message: "Plan updated.", data: publicPlan(plan.toObject(), storeCount) });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ success: false, message: "A plan with that name already exists.", errors: { name: "This name is already taken." } });
    }
    return res.status(500).json({ success: false, message: "Failed to update the plan." });
  }
};

const setPlanStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["active", "inactive"].includes(String(status || ""))) {
      return res.status(400).json({ success: false, message: "status must be active or inactive." });
    }
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found." });
    const previous = plan.status;
    if (previous === status) {
      const storeCount = await Store.countDocuments({ planId: plan._id }).setOptions({ skipTenantScope: true });
      return res.json({ success: true, message: "No change.", data: publicPlan(plan.toObject(), storeCount) });
    }
    plan.status = status;
    await plan.save();
    const storeCount = await Store.countDocuments({ planId: plan._id }).setOptions({ skipTenantScope: true });
    await logActivity({
      action: `Plan ${previous} → ${status}: ${plan.name}`,
      actor: req.superAdmin,
      entityType: "plan",
      entityId: String(plan._id),
      details: { previous, next: status },
    });
    return res.json({ success: true, message: `${plan.name} is now ${status}.`, data: publicPlan(plan.toObject(), storeCount) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update plan status." });
  }
};

const deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: "Plan not found." });
    const storeCount = await Store.countDocuments({ planId: plan._id }).setOptions({ skipTenantScope: true });
    if (storeCount > 0) {
      return res.status(409).json({
        success: false,
        message: `Cannot delete "${plan.name}" — ${storeCount} store${storeCount === 1 ? " is" : "s are"} still on this plan. Reassign them first.`,
      });
    }
    await Plan.deleteOne({ _id: plan._id });
    await logActivity({
      action: `Plan deleted: ${plan.name}`,
      actor: req.superAdmin,
      entityType: "plan",
      entityId: String(plan._id),
      details: {},
    });
    return res.json({ success: true, message: "Plan deleted." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete the plan." });
  }
};

module.exports = {
  getStore,
  // team
  listTeam,
  getTeamMember,
  getUser,
  createSellerStore,
  updateUser,
  setUserPassword,
  deleteUser,
  openStoreAdmin,
  createTeamMember,
  updateTeamMember,
  setTeamMemberStatus,
  resetTeamMemberPassword,
  deleteTeamMember,
  // auth
  loginSuperAdmin,
  refreshSuperAdminToken,
  logoutSuperAdmin,
  meSuperAdmin,
  // dashboard
  getDashboard,
  // requests
  listRequests,
  getRequest,
  updateRequest,
  deleteRequest,
  approveRequest,
  rejectRequest,
  requestInfo,
  // stores
  listStores,
  createStore,
  updateStore,
  deleteStore,
  setStoreStatus,
  // users
  listUsers,
  setUserStatus,
  // store admins
  listStoreAdmins,
  getStoreAdmin,
  resetStoreAdminPassword,
  updateStoreAdmin,
  setStoreAdminStatus,
  // plans
  listPlans,
  getPlan,
  planActivity,
  createPlan,
  updatePlan,
  setPlanStatus,
  deletePlan,
  // activity
  myActivity,
  teamMemberActivity,
};
