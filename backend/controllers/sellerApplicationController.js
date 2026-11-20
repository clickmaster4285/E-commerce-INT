const bcrypt = require("bcryptjs");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const SellerApplication = require("../models/SellerApplication");
const User = require("../models/User");
const Store = require("../models/Store");
const log = require("../utils/logger");
const { sendApplicationReceivedEmail } = require("../services/emailService");
const { sellerEmailTaken, SELLER_EMAIL_TAKEN_MESSAGE } = require("../utils/sellerOwnership");
const { findApplicationForToken, INVALID_SETUP_LINK } = require("../utils/sellerSetupToken");

const normalizeEmail = (email) => String(email || "").toLowerCase().trim();

// Store-setup documents — base64 data URLs (PDF / JPG / PNG / WEBP) saved under uploads/documents/
const DOCUMENTS_DIR = path.join(__dirname, "..", "uploads", "documents");
const DOCUMENT_MIME_EXT = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_DOCUMENTS = 4;
const MAX_DOCUMENT_BYTES = 1.5 * 1024 * 1024;

const saveDocumentFromBase64 = async (raw, displayName) => {
  const match = /^data:([a-z0-9/+.-]+);base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(String(raw || "").trim());
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const ext = DOCUMENT_MIME_EXT[mime];
  if (!ext) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length || buffer.length > MAX_DOCUMENT_BYTES) return null;
  if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
  const fileName = `doc-${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
  await fs.promises.writeFile(path.join(DOCUMENTS_DIR, fileName), buffer);
  const cleanName = String(displayName || fileName).replace(/[\r\n<>"'&]/g, "").slice(0, 160).trim() || fileName;
  return { name: cleanName, url: `/uploads/documents/${fileName}`, public_id: "" };
};

// Public endpoint — a seller requests to open a store. The account is created
// immediately but stays "blocked" (cannot log in) until Super Admin approves.
// After OTP-free signup, Super Admin approves → account activated + store linked.
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

    const existingUser = await User.findOne({ email: cleanEmail }).select("_id role status storeId").lean();
    if (existingUser && !(existingUser.role === "user" && existingUser.status === "blocked")) {
      return res.status(400).json({ success: false, message: "An account already exists with this email." });
    }
    const existingApp = await SellerApplication.findOne({ email: cleanEmail }).lean();
    // Option A: bina application wala purana store admin bhi isi email ka owner hai
    if (!existingApp && (await sellerEmailTaken(cleanEmail))) {
      return res.status(400).json({ success: false, message: SELLER_EMAIL_TAKEN_MESSAGE });
    }
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
      // Rejected → clean slate: drop the old blocked user + rejected application
      if (existingUser) await User.deleteOne({ _id: existingUser._id });
      await SellerApplication.deleteOne({ _id: existingApp._id });
    }

    const cleanPhone = typeof phone === "string" ? String(phone).replace(/\D/g, "").slice(0, 16) : "";
    const passwordHash = await bcrypt.hash(String(password), 10);

    // Diya hua username (unique banao) — warna naam se professional username (hamza.asif)
    const requested = String(username || "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20).toLowerCase();
    let finalUsername = requested;
    for (let i = 1; finalUsername && (await User.exists({ username: finalUsername })) && i < 100; i += 1) {
      finalUsername = `${requested}${i}`;
    }
    if (!finalUsername) finalUsername = await require("../utils/username").uniqueUsername(name, cleanEmail);

    // Account is created right away — but BLOCKED (can't login) until approval.
    const user = await User.create({
      name: String(name).trim(),
      username: finalUsername,
      email: cleanEmail,
      phone: cleanPhone,
      password: passwordHash,
      role: "user",
      storeId: null,
      emailVerified: false,
      status: "blocked",
    });

    const application = await SellerApplication.create({
      name: String(name).trim(),
      email: cleanEmail,
      phone: cleanPhone,
      username: String(username || "").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30) || finalUsername,
      passwordHash,
      store_name: String(storeName).trim(),
      store_description: String(storeDescription || "").trim().slice(0, 500),
      user_id: user._id,
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
      "email store_name status created_at rejection_reason setup_completed info_request_message info_requested_at"
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
        setup_completed: !!app.setup_completed,
        info_request_message: app.info_request_message || "",
        info_requested_at: app.info_requested_at || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load application status." });
  }
};

// Store-setup state for the public /store-setup page — lets a seller review and
// update the details they submitted at signup and attach verification documents.
const sellerSetupState = async (req, res) => {
  try {
    // Sirf email se nahi — email me bheja gaya signed link (utils/sellerSetupToken.js)
    const app = await findApplicationForToken(req.query.token, { select: "-passwordHash", lean: true });
    if (!app) return res.status(401).json({ success: false, code: "INVALID_SETUP_LINK", message: INVALID_SETUP_LINK });
    return res.json({
      success: true,
      data: {
        email: app.email,
        name: app.name,
        store_name: app.store_name || "",
        store_description: app.store_description || "",
        business_category: app.business_category || "",
        business_type: app.business_type || "individual",
        country: app.country || "",
        city: app.city || "",
        address: app.address || "",
        zip_code: app.zip_code || "",
        logo: app.logo?.img_url ? { img_url: app.logo.img_url } : { img_url: "" },
        documents: (app.documents || []).map((doc) => ({ name: doc.name, url: doc.url })),
        setup_completed: !!app.setup_completed,
        info_request_message: app.info_request_message || "",
        info_requested_at: app.info_requested_at || null,
        status: app.status,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load store setup." });
  }
};

// Seller submits verification documents + confirms store details.
// Marks the application as setup-complete after the seller submits store details/docs.
const completeSetup = async (req, res) => {
  try {
    const body = req.body || {};
    // Signed setup link zaroori — sirf email se kisi aur ki application badli ja sakti thi
    const application = await findApplicationForToken(body.token);
    if (!application) {
      return res.status(401).json({ success: false, code: "INVALID_SETUP_LINK", message: INVALID_SETUP_LINK });
    }
    const email = normalizeEmail(application.email);

    const storeName = String(body.storeName || "").trim().slice(0, 140);
    const storeDescription = String(body.storeDescription || "").trim().slice(0, 2000);
    const businessCategory = String(body.businessCategory || "").trim();
    const businessType = ["individual", "registered_business"].includes(String(body.businessType || ""))
      ? String(body.businessType)
      : "individual";
    const country = String(body.country || "").trim();
    const city = String(body.city || "").trim();
    const address = String(body.address || "").trim().slice(0, 300);
    const zipCode = String(body.zipCode || "").trim().slice(0, 20);
    const storeLogo = typeof body.storeLogo === "string" ? body.storeLogo : "";

    const errors = {};
    if (!storeName) errors.storeName = "Please enter your store name.";
    if (storeDescription.length < 10) errors.storeDescription = "Please describe your store (at least 10 characters).";
    if (!businessCategory) errors.businessCategory = "Please select a business category.";
    if (!country) errors.country = "Please select a country.";
    if (city.length < 2) errors.city = "Please enter your city.";
    if (address.length < 5) errors.address = "Please enter a complete store address.";
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, message: "Please fix the highlighted fields.", errors });
    }

    if (application.status === "approved") {
      return res.status(409).json({ success: false, message: "This application is already approved." });
    }
    if (application.status === "rejected") {
      return res.status(409).json({ success: false, message: "This application was rejected." });
    }

    // Verification documents — existing docs the seller removed from the form are dropped;
    // newly uploaded docs are appended. At least one document must remain.
    const removeUrls = new Set(
      (Array.isArray(body.removeDocuments) ? body.removeDocuments : [])
        .map((url) => String(url || "").trim())
        .filter(Boolean)
    );
    const rawDocuments = Array.isArray(body.documents) ? body.documents.slice(0, MAX_DOCUMENTS) : [];
    const keptDocuments = (application.documents || [])
      .filter((doc) => doc?.url && !removeUrls.has(doc.url))
      .map((doc) => ({
        name: doc.name,
        url: doc.url,
        public_id: doc.public_id || "",
      }));
    const savedDocuments = [];
    for (const doc of rawDocuments) {
      // eslint-disable-next-line no-await-in-loop
      const saved = await saveDocumentFromBase64(doc?.data, doc?.name);
      if (!saved) {
        return res.status(400).json({
          success: false,
          message: "A document could not be processed. Upload PDF, JPG, PNG or WEBP files under 1.5MB each.",
        });
      }
      savedDocuments.push(saved);
    }
    const totalDocuments = keptDocuments.length + savedDocuments.length;
    if (totalDocuments === 0) {
      return res.status(400).json({
        success: false,
        message: "Please upload at least one verification document.",
        errors: { documents: "Please upload at least one verification document." },
      });
    }
    if (totalDocuments > MAX_DOCUMENTS) {
      return res.status(400).json({
        success: false,
        message: `You can keep at most ${MAX_DOCUMENTS} documents.`,
      });
    }

    // Optional replacement logo
    let logoUrl = application.logo?.img_url || "";
    if (storeLogo) {
      const match = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(storeLogo.trim());
      if (!match) {
        return res.status(400).json({ success: false, message: "Store logo must be a JPG, PNG or WEBP image." });
      }
      const buffer = Buffer.from(match[2], "base64");
      if (!buffer.length || buffer.length > 4 * 1024 * 1024) {
        return res.status(400).json({ success: false, message: "Store logo must be under 4MB." });
      }
      const logoDir = path.join(__dirname, "..", "uploads", "store-logos");
      if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });
      const fileName = `logo-${Date.now()}-${crypto.randomBytes(6).toString("hex")}.webp`;
      await sharp(buffer, { limitInputPixels: 20_000_000 })
        .rotate()
        .resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 86 })
        .toFile(path.join(logoDir, fileName));
      logoUrl = `/uploads/store-logos/${fileName}`;
    }

    application.store_name = storeName;
    application.store_description = storeDescription;
    application.business_category = businessCategory;
    application.business_type = businessType;
    application.country = country;
    application.city = city;
    application.address = address;
    application.zip_code = zipCode;
    application.logo = { img_url: logoUrl, public_id: "" };
    application.documents = [...keptDocuments, ...savedDocuments];
    application.setup_completed = true;
    application.info_request_message = "";
    application.info_requested_at = null;
    await application.save();

    // Keep the provisioned store in sync
    if (application.store_id) {
      await Store.findByIdAndUpdate(application.store_id, {
        store_name: storeName,
        tagline: storeDescription.slice(0, 120),
        description: storeDescription,
        business_category: businessCategory,
        business_type: businessType,
        country,
        city,
        address,
        zip_code: zipCode,
        ...(logoUrl ? { logo: { img_url: logoUrl, public_id: "" } } : {}),
      }).catch((error) => log.error("[seller] setup store sync failed:", error.message));
    }


    return res.json({
      success: true,
      message: "Store setup submitted. Your application is now in the review queue.",
      data: { setup_completed: true, documents: application.documents.length },
    });
  } catch (error) {
    log.error("[seller] complete-setup error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to submit store setup." });
  }
};

// Status for the signed-in account (no email param needed) — used by /seller/status
const sellerStatusMe = async (req, res) => {
  try {
    const email = normalizeEmail(req.user?.email);
    if (!email) return res.status(401).json({ success: false, message: "Authentication required." });
    const app = await SellerApplication.findOne({ email })
      .select("email store_name status created_at reviewed_at rejection_reason store_id setup_completed info_request_message info_requested_at")
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
        setup_completed: !!app.setup_completed,
        info_request_message: app.info_request_message || "",
        info_requested_at: app.info_requested_at || null,
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
    const store = await Store.findByIdAndUpdate(req.user?.storeId, update, { returnDocument: "after", runValidators: true })
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
  sellerSetupState,
  completeSetup,
  sellerStatusMe,
  sellerDashboard,
  sellerStore,
  sellerStoreUpdate,
};
