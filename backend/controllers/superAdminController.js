const bcrypt = require("bcryptjs");
const SuperAdmin = require("../models/SuperAdmin");
const SellerApplication = require("../models/SellerApplication");
const Store = require("../models/Store");
const User = require("../models/User");
const { signSession, cookieOptions, getCookieName } = require("../middleware/superAdminAuth");
const { logActivity } = require("../utils/superAdminActivity");
const {
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
} = require("../services/emailService");
const log = require("../utils/logger");

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

    const token = signSession(superAdmin);
    res.cookie(getCookieName(), token, cookieOptions());
    superAdmin.lastLoginAt = new Date();
    await superAdmin.save().catch(() => {});
    await logActivity({
      action: "Super admin logged in",
      actor: superAdmin,
      entityType: "auth",
      entityId: String(superAdmin._id),
    });

    return res.json({
      success: true,
      message: "Super Admin login successful.",
      data: {
        id: superAdmin._id,
        name: superAdmin.name,
        email: superAdmin.email,
        lastLoginAt: superAdmin.lastLoginAt,
      },
    });
  } catch (error) {
    log.error("[super-admin] login error:", error.message);
    return res.status(500).json({ success: false, message: "Login failed." });
  }
};

const logoutSuperAdmin = async (req, res) => {
  try {
    const actor = req.superAdmin;
    res.clearCookie(getCookieName(), { ...cookieOptions(), maxAge: 0 });
    if (actor) {
      await logActivity({
        action: "Super admin logged out",
        actor: { _id: actor._id, name: actor.name, email: actor.email },
        entityType: "auth",
        entityId: String(actor._id),
      });
    }
    return res.json({ success: true, message: "Logged out." });
  } catch (error) {
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

const listRequests = async (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const filter = {};
    if (["pending", "approved", "rejected"].includes(String(status || ""))) {
      filter.status = String(status);
    }
    if (search) {
      const pattern = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: pattern }, { email: pattern }, { store_name: pattern }];
    }

    const [items, total] = await Promise.all([
      SellerApplication.find(filter)
        .sort({ created_at: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .select("-passwordHash")
        .lean(),
      SellerApplication.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: { items, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load requests." });
  }
};

const getRequest = async (req, res) => {
  try {
    const item = await SellerApplication.findById(req.params.id).select("-passwordHash").lean();
    if (!item) return res.status(404).json({ success: false, message: "Application not found." });
    return res.json({ success: true, data: item });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load request." });
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
      { new: true }
    );
    if (!application) {
      return res
        .status(409)
        .json({ success: false, message: "This application is not pending (already reviewed)." });
    }

    // Provision store + seller account exactly once (password from request)
    const existingUser = await User.findOne({ email: application.email }).select("_id storeId").lean();
    if (existingUser) {
      // Already provisioned via a previous attempt — just link it
      await SellerApplication.updateOne(
        { _id: application._id },
        { store_id: existingUser.storeId || null, user_id: existingUser._id }
      );
      await notifySeller(
        sendApplicationApprovedEmail,
        { name: application.name, email: application.email, storeName: application.store_name },
        "Approval",
        application._id
      );
      return res.json({ success: true, message: "Application approved.", data: { storeProvisioned: false } });
    }

    const storeName = application.store_name || [application.name, "Store"].filter(Boolean).join(" ");
    const store = await Store.create({
      store_name: storeName,
      email: application.email,
      phone: application.phone || "",
      store_status: "open",
    });

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
      storeId: store._id,
      emailVerified: true,
      status: "active",
    });

    await SellerApplication.updateOne(
      { _id: application._id },
      { store_id: store._id, user_id: user._id }
    );

    await logActivity({
      action: `Seller approved — ${application.name} (${application.store_name})`,
      actor: req.superAdmin,
      entityType: "seller_application",
      entityId: String(application._id),
      details: { storeName: application.store_name, email: application.email },
    });

    await notifySeller(
      sendApplicationApprovedEmail,
      { name: application.name, email: application.email, storeName: application.store_name },
      "Approval",
      application._id
    );

    return res.json({
      success: true,
      message: "Seller approved and store provisioned.",
      data: { storeId: store._id, userId: user._id },
    });
  } catch (error) {
    log.error("[super-admin] approve error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to approve application." });
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
      { new: true }
    );
    if (!application) {
      return res
        .status(409)
        .json({ success: false, message: "This application is not pending (already reviewed)." });
    }

    const storedReason = reason.slice(0, 500);
    await logActivity({
      action: `Seller rejected — ${application.name} (reason: ${storedReason.slice(0, 120)})`,
      actor: req.superAdmin,
      entityType: "seller_application",
      entityId: String(application._id),
      details: { storeName: application.store_name, reason: storedReason },
    });

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
    const owners = await User.find({ storeId: { $in: storeIds } })
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
        url: `/store/${s._id}`,
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

    await logActivity({
      action: `Store ${previous} → ${status}: ${store.store_name}`,
      actor: req.superAdmin,
      entityType: "store",
      entityId: String(store._id),
      details: { previous, next: status },
    });

    return res.json({ success: true, message: "Store updated.", data: { status: store.store_status } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update store." });
  }
};

/* ==========================================
   USERS — list + block/unblock
   ========================================== */

const listUsers = async (req, res) => {
  try {
    const { role, type, status, search, page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
    const filter = { is_deleted: { $ne: true } };
    if (role && ["user", "admin", "staff"].includes(String(role))) filter.role = String(role);
    if (status && ["active", "blocked", "inactive"].includes(String(status))) filter.status = String(status);
    if (type === "seller") filter.storeId = { $ne: null };
    else if (type === "customer") filter.storeId = null;
    if (search) {
      const pattern = new RegExp(String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: pattern }, { email: pattern }, { username: pattern }];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ created_at: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .select("name username email phone role status storeId emailVerified created_at")
        .lean(),
      User.countDocuments(filter),
    ]);

    const items = users.map((u) => ({
      id: u._id,
      name: u.name,
      username: u.username,
      email: u.email,
      phone: u.phone || "",
      type: u.storeId ? "Seller" : "Customer",
      role: u.role,
      status: u.status || "active",
      emailVerified: !!u.emailVerified,
      created_at: u.created_at,
    }));

    return res.json({
      success: true,
      data: { items, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load users." });
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

    await logActivity({
      action: `User ${previous} → ${status}: ${user.name} (${user.email})`,
      actor: req.superAdmin,
      entityType: "user",
      entityId: String(user._id),
      details: { previous, next: status },
    });

    return res.json({ success: true, message: "User updated.", data: { status: user.status } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update user." });
  }
};

module.exports = {
  // auth
  loginSuperAdmin,
  logoutSuperAdmin,
  meSuperAdmin,
  // dashboard
  getDashboard,
  // requests
  listRequests,
  getRequest,
  approveRequest,
  rejectRequest,
  // stores
  listStores,
  setStoreStatus,
  // users
  listUsers,
  setUserStatus,
};
