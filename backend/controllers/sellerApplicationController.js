const bcrypt = require("bcryptjs");
const SellerApplication = require("../models/SellerApplication");
const User = require("../models/User");
const Store = require("../models/Store");
const log = require("../utils/logger");
const { sendApplicationReceivedEmail } = require("../services/emailService");

const normalizeEmail = (email) => String(email || "").toLowerCase().trim();

// Public endpoint — a seller requests to open a store. The account is NOT
// created here; it only enters the review queue with status "pending".
// After OTP-free signup, Super Admin approves → account + store provisioned.
const sellerApply = async (req, res) => {
  try {
    const { name, email, phone, username, password, storeName, storeDescription } = req.body || {};

    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ success: false, message: "Name must be at least 2 characters." });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });
    }
    if (!storeName || String(storeName).trim().length < 2) {
      return res.status(400).json({ success: false, message: "Store name must be at least 2 characters." });
    }
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    const existingUser = await User.findOne({ email: cleanEmail }).select("_id").lean();
    if (existingUser) {
      return res.status(400).json({ success: false, message: "An account already exists with this email." });
    }
    const existingApp = await SellerApplication.findOne({ email: cleanEmail }).lean();
    if (existingApp) {
      if (existingApp.status === "approved") {
        return res.status(400).json({ success: false, message: "This store application was already approved." });
      }
      if (existingApp.status === "pending") {
        return res.status(400).json({
          success: false,
          message: "An application for this email is already under review.",
        });
      }
      // Rejected → let them fix and resubmit once
      await SellerApplication.deleteOne({ _id: existingApp._id });
    }

    const cleanPhone = typeof phone === "string" ? String(phone).replace(/\D/g, "").slice(0, 16) : "";
    const passwordHash = await bcrypt.hash(String(password), 10);

    const application = await SellerApplication.create({
      name: String(name).trim(),
      email: cleanEmail,
      phone: cleanPhone,
      username: String(username || "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30) || "",
      passwordHash,
      store_name: String(storeName).trim(),
      store_description: String(storeDescription || "").trim().slice(0, 500),
    });

    // Best-effort — a failed email must not block the application flow
    try {
      await sendApplicationReceivedEmail({ name: application.name, email: cleanEmail, storeName: application.store_name });
    } catch (emailError) {
      console.error("[seller] confirmation email failed:", emailError.message);
    }

    return res.status(201).json({
      success: true,
      message: "Your store application has been submitted for review.",
      data: { id: application._id, email: application.email, status: application.status },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, message: "An application with this email already exists." });
    }
    log.error("[seller] apply error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to submit application." });
  }
};

// Lightweight status check so the applicant can see where they stand
const sellerApplyStatus = async (req, res) => {
  try {
    const email = normalizeEmail(req.query.email);
    if (!email) return res.status(400).json({ success: false, message: "email is required." });
    const app = await SellerApplication.findOne({ email }).select(
      "email store_name status created_at rejection_reason"
    ).lean();
    if (!app) return res.status(404).json({ success: false, message: "No application found for this email." });
    return res.json({
      success: true,
      data: {
        email: app.email,
        store_name: app.store_name,
        status: app.status,
        rejection_reason: app.status === "rejected" ? app.rejection_reason : undefined,
        created_at: app.created_at,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load application status." });
  }
};

// Status for the signed-in account (no email param needed) — used by /seller/status
const sellerStatusMe = async (req, res) => {
  try {
    const email = normalizeEmail(req.user?.email);
    if (!email) return res.status(401).json({ success: false, message: "Authentication required." });
    const app = await SellerApplication.findOne({ email })
      .select("email store_name status created_at reviewed_at rejection_reason store_id")
      .lean();
    if (!app) {
      return res.json({ success: true, data: null });
    }
    return res.json({
      success: true,
      data: {
        email: app.email,
        store_name: app.store_name,
        status: app.status,
        rejection_reason: app.status === "rejected" ? app.rejection_reason : undefined,
        created_at: app.created_at,
        reviewed_at: app.status === "pending" ? undefined : app.reviewed_at,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load application status." });
  }
};

// Seller dashboard summary — approved sellers only (requireApprovedSeller)
const sellerDashboard = async (req, res) => {
  try {
    const store = req.sellerStore || (await Store.findById(req.user?.storeId).lean());
    const app = await SellerApplication.findOne({ email: normalizeEmail(req.user?.email) })
      .select("created_at reviewed_at")
      .lean();
    return res.json({
      success: true,
      data: {
        store: store
          ? {
              store_name: store.store_name,
              store_status: store.store_status,
              email: store.email,
              phone: store.phone,
              createdAt: store.createdAt,
            }
          : null,
        application: app ? { created_at: app.created_at, reviewed_at: app.reviewed_at } : null,
        user: { name: req.user?.name, email: req.user?.email },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load seller dashboard." });
  }
};

const SELLER_EDITABLE_FIELDS = [
  "store_name", "tagline", "email", "phone",
  "support_email", "support_phone",
  "country", "state", "city", "zip_code", "address",
  "currency", "tax_rate", "weight_unit",
];

const sanitizeStoreUpdate = (body = {}) => {
  const update = {};
  for (const key of SELLER_EDITABLE_FIELDS) {
    if (body[key] === undefined) continue;
    const value = String(body[key]).trim().slice(0, 500);
    if (key === "tax_rate") {
      const n = Number(body[key]);
      update[key] = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
      continue;
    }
    update[key] = value;
  }
  return update;
};

// Own store profile — approved sellers only
const sellerStore = async (req, res) => {
  try {
    const store = await Store.findById(req.user?.storeId)
      .select("store_name tagline email phone support_email support_phone country state city zip_code address currency tax_rate weight_unit store_status logo createdAt")
      .lean();
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });
    return res.json({ success: true, data: store });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load store." });
  }
};

const sellerStoreUpdate = async (req, res) => {
  try {
    const update = sanitizeStoreUpdate(req.body);
    if (!Object.keys(update).length) {
      return res.status(400).json({ success: false, message: "No editable fields provided." });
    }
    if (update.store_name && update.store_name.length < 2) {
      return res.status(400).json({ success: false, message: "Store name must be at least 2 characters." });
    }
    if (update.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(update.email)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }
    const store = await Store.findByIdAndUpdate(req.user?.storeId, update, { new: true, runValidators: true })
      .select("store_name tagline email phone support_email support_phone country state city zip_code address currency tax_rate weight_unit store_status")
      .lean();
    if (!store) return res.status(404).json({ success: false, message: "Store not found." });
    return res.json({ success: true, message: "Store updated.", data: store });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update store." });
  }
};

module.exports = {
  sellerApply,
  sellerApplyStatus,
  sellerStatusMe,
  sellerDashboard,
  sellerStore,
  sellerStoreUpdate,
};
