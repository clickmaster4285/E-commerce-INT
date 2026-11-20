const bcrypt = require("bcryptjs");
const { OWNER_ROLE, ADMIN_ROLES, STAFF_ROLES, ASSIGNABLE_ROLES, isOwnerRole, isAdminRole, isStaffRole } = require("../utils/roles");
const SuperAdmin = require("../models/SuperAdmin");
const SellerApplication = require("../models/SellerApplication");
const Store = require("../models/Store");
const User = require("../models/User");
const Employee = require("../models/Employee");
const jwt = require("jsonwebtoken"); // store admin handoff token (openStoreAdmin)
// Super admin ka apna audience — sa_at / sa_rt cookies, alag secrets, rotating sessions
const tokens = require("../utils/tokens");
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

// Best-effort seller notification — delivery failure must never reverse a decision
const notifySeller = async (sendFn, payload, action, entityId) => {
  try {
    const result = await sendFn(payload);
    if (!result?.delivered) {
      console.error(`[super-admin] ${action} email not delivered:`, result?.reason || "unknown");
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
    await tokens.revokeCurrentSession(req, "superadmin").catch(() => {});
    tokens.clearAuthCookies(res, "superadmin");
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

    // Linked store, seller accounts aur review history — detail page ke liye ek hi call
    const [store, user, employee] = await Promise.all([
      item.store_id
        ? Store.findById(item.store_id).setOptions(CROSS_STORE).select("store_name subdomain store_status createdAt").lean()
        : null,
      item.user_id
        ? User.findById(item.user_id).setOptions(CROSS_STORE).select("status emailVerified created_at").lean()
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
          user: user || null,
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
      if (application.user_id) {
        await User.updateOne({ _id: application.user_id }, { $set: { name: updates.name } }).setOptions(CROSS_STORE);
      }
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

    const removed = { store: 0, adminAccounts: 0, userAccount: 0 };
    if (application.store_id) {
      const storeResult = await Store.deleteOne({ _id: application.store_id, store_status: { $ne: "open" } }).setOptions(CROSS_STORE);
      removed.store = storeResult.deletedCount || 0;
      if (removed.store) {
        const empResult = await Employee.deleteMany({ storeId: application.store_id, email: application.email }).setOptions(CROSS_STORE);
        removed.adminAccounts = empResult.deletedCount || 0;
      }
    }
    if (application.user_id) {
      // Sirf signup wala blocked account — active customer account kabhi nahi
      const userResult = await User.deleteOne({ _id: application.user_id, status: "blocked" }).setOptions(CROSS_STORE);
      removed.userAccount = userResult.deletedCount || 0;
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

    // Provision store + seller account exactly once (password from request)
    const existingUser = await User.findOne({ email: application.email }).select("_id storeId status").lean();
    if (existingUser) {
      let openStore = store;
      if (!openStore) {
        const storeName0 = application.store_name || [application.name, "Store"].filter(Boolean).join(" ");
        openStore = existingUser.storeId
          ? await Store.findByIdAndUpdate(existingUser.storeId, { store_status: "open" }, { returnDocument: "after" })
          : await Store.create({
              store_name: storeName0,
              email: application.email,
              phone: application.phone || "",
              store_status: "open",
            });
      }
      // Activate the account that was blocked at apply time
      await User.updateOne(
        { _id: existingUser._id },
        { status: "active", emailVerified: true, storeId: openStore._id }
      );
      await SellerApplication.updateOne(
        { _id: application._id },
        { store_id: openStore._id, user_id: existingUser._id }
      );
      // Resume-flow employees may have been created without a storeId — link them now
      await Employee.findOneAndUpdate(
        sellerEmployeeFilter(application),
        { seller_pending: false, status: "active", role: OWNER_ROLE, storeId: openStore._id }
      ).setOptions({ skipTenantScope: true });
      await notifySeller(
        sendApplicationApprovedEmail,
        { name: application.name, email: application.email, storeName: application.store_name, storeUrl: storeAdminBaseUrl(openStore) },
        "Approval",
        application._id
      );
      return res.json({ success: true, message: "Seller approved and account activated.", data: { storeId: openStore?._id || null, userId: existingUser._id } });
    }

    const openStore = store || (application.store_name
      ? await Store.create({
          store_name: application.store_name,
          email: application.email,
          phone: application.phone || "",
          store_status: "open",
        })
      : await Store.create({
          store_name: [application.name, "Store"].filter(Boolean).join(" "),
          email: application.email,
          phone: application.phone || "",
          store_status: "open",
        }));
    const storeFinal = openStore;

    let username = String(application.username || "").trim();
    const localPart = String(application.email).split("@")[0] || "";
    if (!username) {
      username = localPart.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20) || `user${Date.now().toString(36)}`;
    }
    if (await User.exists({ username })) {
      let i = 1;
      while (await User.exists({ username: `${username}${i}` }) && i < 100) i += 1;
      username = `${username}${i}`;
    }

    const user = await User.create({
      name: application.name,
      username,
      email: application.email,
      phone: application.phone || "",
      password: application.passwordHash,
      role: "user",
      storeId: storeFinal._id,
      emailVerified: true,
      status: "active",
    });

    await SellerApplication.updateOne(
      { _id: application._id },
      { store_id: storeFinal._id, user_id: user._id }
    );

    await Employee.findOneAndUpdate(
      sellerEmployeeFilter(application),
      { seller_pending: false, status: "active", role: OWNER_ROLE, storeId: storeFinal._id }
    ).setOptions({ skipTenantScope: true });


    await notifySeller(
      sendApplicationApprovedEmail,
      { name: application.name, email: application.email, storeName: application.store_name, storeUrl: storeAdminBaseUrl(storeFinal) },
      "Approval",
      application._id
    );

    return res.json({
      success: true,
      message: "Seller approved and store provisioned.",
      data: { storeId: storeFinal._id, userId: user._id },
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
    const filter = {};
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

    // Resolve owner (User with storeId → that store)
    const storeIds = stores.map((s) => s._id);
    // Owner = seller account (application wala) — customer ka bhi storeId hota hai
    const owners = await User.find({ storeId: { $in: storeIds }, _id: { $in: await sellerUserIds() } })
      .select("name username email storeId")
      .lean();
    const ownerByStore = new Map();
    owners.forEach((o) => ownerByStore.set(String(o.storeId), o));

    const items = stores.map((s) => {
      const owner = ownerByStore.get(String(s._id));
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
        // Real storefront URL (subdomain) — same helper as request detail, emails and handoff
        url: storeAdminBaseUrl(s),
        createdAt: s.createdAt,
        status: s.store_status || "open",
        approvalStatus: s.store_status === "closed" ? "suspended" : "active",
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
    const ownerIds = await sellerUserIds();
    const owner = await User.findOne({ storeId: store._id, _id: { $in: ownerIds } })
      .select("name username email phone status createdAt")
      .lean();
    return res.json({ success: true, data: { ...store, id: store._id, status: store.store_status || "open", logo_url: store.logo?.img_url || "", url: storeAdminBaseUrl(store), owner: owner || null } });
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

    // Sync the seller account so suspension actually blocks their login
    if (status === "closed") {
      await User.updateMany({ storeId: store._id }, { status: "blocked" });
    } else if (status === "open") {
      await User.updateMany({ storeId: store._id, status: "blocked" }, { status: "active" });
    }


    return res.json({ success: true, message: "Store updated.", data: { status: store.store_status } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update store." });
  }
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
  const { uniqueUsername } = require("../utils/username");
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
    // Uniqueness — signup jaisi checks (platform accounts + pending signups + applications)
    const [emailUser, emailPending, emailApp, phoneUser, nameUser, subStore, subPending] = await Promise.all([
      errors.email ? null : User.exists({ email }).setOptions(CROSS_STORE),
      errors.email ? null : PendingRegistration.exists({ email, expiresAt: { $gt: new Date() } }),
      errors.email ? null : SellerApplication.exists({ email, status: "pending" }),
      errors.phone ? null : User.exists({ phone }).setOptions(CROSS_STORE),
      !usernameIn || errors.username ? null : User.exists({ username: usernameIn }).setOptions(CROSS_STORE),
      errors.subdomain ? null : Store.exists({ subdomain }).setOptions(CROSS_STORE),
      errors.subdomain ? null : PendingRegistration.exists({ subdomain, expiresAt: { $gt: new Date() } }),
    ]);
    if (emailUser) errors.email = "An account with this email already exists.";
    else if (emailPending || emailApp) errors.email = "This email has a signup in progress — review it under Signup Requests.";
    if (phoneUser) errors.phone = "This phone number is already registered.";
    if (nameUser) errors.username = "This username is already taken.";
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
      created.user = await User.create({
        name, username, email, phone, password: passwordHash,
        role: "user", storeId: created.store._id, emailVerified: true, status: "active",
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
        user_id: created.user._id,
        store_id: created.store._id,
      });
    } catch (err) {
      // Aadha bana hua data na rahe
      await Promise.allSettled([
        created.application && SellerApplication.deleteOne({ _id: created.application._id }),
        created.employee && Employee.deleteOne({ _id: created.employee._id }).setOptions(CROSS_STORE),
        created.user && User.deleteOne({ _id: created.user._id }).setOptions(CROSS_STORE),
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
    if (b.notify === true) {
      await notifySeller(sendApplicationApprovedEmail, { name, email, storeName, storeUrl }, "Approval", created.application._id);
    }
    return res.status(201).json({
      success: true,
      message: `${storeName} is live — ${name} can sign in with ${email}.`,
      data: { storeId: created.store._id, userId: created.user._id, subdomain, url: storeUrl },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to create the store." });
  }
};

const createStore = async (req, res) => {
  try {
    const { store_name, email, phone, subdomain, store_status = "open", business_category, business_type, description, country, city, address, zip_code, logo_url } = req.body || {};
    if (!String(store_name || "").trim()) return res.status(400).json({ success: false, message: "Store name is required." });
    if (!["open", "closed", "maintenance"].includes(String(store_status))) return res.status(400).json({ success: false, message: "Invalid store status." });
    const store = await Store.create({ store_name: String(store_name).trim(), email: String(email || "").trim(), phone: String(phone || "").trim(), subdomain: String(subdomain || "").trim().toLowerCase() || undefined, store_status, business_category: String(business_category || "").trim(), business_type: ["individual", "registered_business"].includes(String(business_type)) ? business_type : "individual", description: String(description || "").trim(), country: String(country || "").trim(), city: String(city || "").trim(), address: String(address || "").trim(), zip_code: String(zip_code || "").trim(), logo: { img_url: String(logo_url || "").trim(), public_id: "" } });
    return res.status(201).json({ success: true, message: "Store created.", data: store });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "That subdomain is already in use." });
    return res.status(500).json({ success: false, message: "Failed to create store." });
  }
};

const updateStore = async (req, res) => {
  try {
    const { store_name, email, phone, subdomain, store_status, business_category, business_type, description, country, city, address, zip_code, logo_url } = req.body || {};
    if (!String(store_name || "").trim()) return res.status(400).json({ success: false, message: "Store name is required." });
    if (store_status && !["open", "closed", "maintenance"].includes(String(store_status))) return res.status(400).json({ success: false, message: "Invalid store status." });
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });
    Object.assign(store, { store_name: String(store_name).trim(), email: String(email || "").trim(), phone: String(phone || "").trim(), subdomain: String(subdomain || "").trim().toLowerCase() || undefined, store_status: store_status || store.store_status, business_category: String(business_category || "").trim(), business_type: ["individual", "registered_business"].includes(String(business_type)) ? business_type : store.business_type, description: String(description || "").trim(), country: String(country || "").trim(), city: String(city || "").trim(), address: String(address || "").trim(), zip_code: String(zip_code || "").trim() });
    if (logo_url !== undefined) store.logo = { ...(store.logo?.toObject?.() || store.logo || {}), img_url: String(logo_url || "").trim() };
    await store.save();
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
    await Store.deleteOne({ _id: store._id });
    await User.updateMany({ storeId: store._id }, { $unset: { storeId: 1 }, status: "inactive" });
    return res.json({ success: true, message: "Store deleted." });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to delete store." });
  }
};

/* ==========================================
   USERS — list + block/unblock
   ========================================== */

/* Seller vs customer — dono User collection me hain aur DONO ke paas storeId hai
   (customer ka storeId = jis store par usne account banaya). Isliye storeId se seller
   pehchanna ghalat hai. Seller = jis User ki SellerApplication hai (har signup path user_id set karta hai). */
const sellerUserIds = () => SellerApplication.distinct("user_id", { user_id: { $ne: null } });
const isSellerUser = async (user) => Boolean(user && (await SellerApplication.exists({ user_id: user._id })));

const listUsers = async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    // Users page = sirf customers; sellers Stores page par (owner) manage hote hain
    const base = { is_deleted: { $ne: true }, _id: { $nin: await sellerUserIds() } };
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

// User detail — profile + store (seller) + application + admin access + orders + audit history
const getUser = async (req, res) => {
  try {
    const Order = require("../models/Order");
    const user = await User.findOne({ _id: req.params.id, is_deleted: { $ne: true } })
      .select("name username email phone role status storeId emailVerified provider avatar dob created_at updated_at")
      .populate({ path: "storeId", select: "store_name subdomain store_status business_category logo created_at", options: CROSS_STORE })
      .lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const isSeller = await isSellerUser(user);
    // Customer ke liye store = jis store par shopping account hai (admin access nahi)
    const store = user.storeId && typeof user.storeId === "object" ? user.storeId : null;
    const [application, employee, orderStats, recentOrders] = await Promise.all([
      SellerApplication.findOne({ user_id: user._id }).select("status reviewed_at created_at store_name").sort({ created_at: -1 }).lean(),
      isSeller && store ? Employee.findOne({ email: user.email, storeId: store._id }).select("status seller_pending role").setOptions(CROSS_STORE).lean() : null,
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
          type: isSeller ? "Seller" : "Customer",
          avatar: user.avatar || "",
          dob: user.dob || "",
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
        store: store
          ? { id: store._id, name: store.store_name, subdomain: store.subdomain || "", status: store.store_status || "open", category: store.business_category || "", logo: store.logo?.img_url || "", url: storeAdminBaseUrl(store), created_at: store.created_at }
          : null,
        application: application ? { id: application._id, status: application.status, reviewed_at: application.reviewed_at, created_at: application.created_at, store_name: application.store_name } : null,
        adminAccess: employee ? { status: employee.status, pending: !!employee.seller_pending, role: employee.role } : null,
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

    const previousEmail = (await User.findById(user._id).select("email").lean())?.email;
    await user.save();
    // Seller ka store-admin login bhi same rakho (naam / email / phone)
    if (user.storeId && (await isSellerUser(user))) {
      const sync = {};
      if (changed.includes("name")) sync.name = user.name;
      if (changed.includes("email")) sync.email = user.email;
      if (changed.includes("phone")) sync.phone = user.phone;
      if (Object.keys(sync).length) await Employee.updateOne({ storeId: user.storeId, email: previousEmail }, { $set: sync }).setOptions(CROSS_STORE);
    }
    return res.json({ success: true, message: "User updated." });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "That email or username is already in use." });
    return res.status(500).json({ success: false, message: "Failed to update the user." });
  }
};

// Naya password set karo (purana dikh nahi sakta — bcrypt hash hai). Seller ka store-admin login bhi same.
const setUserPassword = async (req, res) => {
  try {
    const password = String(req.body?.password || "");
    if (password.length < 8) return res.status(400).json({ success: false, message: "Password must be at least 8 characters.", errors: { password: "Password must be at least 8 characters." } });
    const user = await User.findOne({ _id: req.params.id, is_deleted: { $ne: true } });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    const hash = await bcrypt.hash(password, 10);
    user.password = hash;
    await user.save();
    const seller = user.storeId && (await isSellerUser(user));
    if (seller) await Employee.updateOne({ storeId: user.storeId, email: user.email }, { $set: { password: hash } }).setOptions(CROSS_STORE);
    return res.json({ success: true, message: `Password updated for ${user.name}.` });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to set the password." });
  }
};

// Delete user (soft delete) — seller ho to store-admin login bhi band; store khud delete nahi hota
const deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id, is_deleted: { $ne: true } });
    if (!user) return res.status(404).json({ success: false, message: "User not found." });
    user.is_deleted = true;
    user.deleted_at = new Date();
    user.status = "blocked";
    await user.save();
    const seller = user.storeId && (await isSellerUser(user));
    if (seller) {
      await Employee.updateOne({ storeId: user.storeId, email: user.email }, { $set: { status: "inactive" } }).setOptions(CROSS_STORE);
    }
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
});

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
};
