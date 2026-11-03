const Vendor = require("../models/Vendor");
const PurchaseOrder = require("../models/PurchaseOrder");
const PurchasePayment = require("../models/PurchasePayment");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity } = require("../utils/activityHelper");
const { auditEvent, diffFields } = require("../utils/auditHistory");

const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ==========================================
// 🌐 LOCALE + SLIM HELPERS — admin vendors (brand/banner/orders ka exact pattern)
//    Paginated rows me sirf FRONT fields jate hain — createdby/updatedby/
//    deletedby/activity/translation_source|status/deleted_at payload se bahar.
//    Translations sirf selected locale ki trim hoti hain.
// ==========================================
const parseVendorLocale = (value) => {
  const requestedLocale = String(value || "en").trim().toLowerCase();
  return /^[a-z]{2}$/.test(requestedLocale) ? requestedLocale : "en";
};

// ✅ Selected locale ki slim translation (name/company_name/address/city/state/country)
const slimVendorTranslations = (vendor, locale) => {
  if (locale === "en" || !vendor.translations) return null;
  const out = {};
  ["name", "company_name", "address", "city", "state", "country"].forEach((field) => {
    const value = vendor.translations?.[field]?.[locale];
    if (typeof value === "string" && value.trim()) out[field] = { [locale]: value };
  });
  return Object.keys(out).length ? out : {};
};

// ✅ Front + edit-form fields (table + VendorFormModal dono isi se chalte hain)
const frontVendorFields = (vendor) => ({
  _id: vendor._id,
  vendor_code: vendor.vendor_code,
  name: vendor.name,
  ...(vendor.company_name && { company_name: vendor.company_name }),
  ...(vendor.contact_person && { contact_person: vendor.contact_person }),
  ...(vendor.email && { email: vendor.email }),
  ...(vendor.phone && { phone: vendor.phone }),
  ...(vendor.whatsapp && { whatsapp: vendor.whatsapp }),
  ...(vendor.address && { address: vendor.address }),
  ...(vendor.city && { city: vendor.city }),
  ...(vendor.state && { state: vendor.state }),
  ...(vendor.country && { country: vendor.country }),
  ...(vendor.zip_code && { zip_code: vendor.zip_code }),
  ...(vendor.tax_id && { tax_id: vendor.tax_id }),
  ...(vendor.bank_details && { bank_details: vendor.bank_details }),
  ...(vendor.lead_time_days !== undefined && { lead_time_days: vendor.lead_time_days }),
  ...(vendor.rating !== undefined && { rating: vendor.rating }),
  is_active: vendor.is_active,
  balance_payable: vendor.balance_payable,
  total_purchased: vendor.total_purchased,
  total_paid: vendor.total_paid,
});

// ✅ Server-side sorting whitelist — sort key -> DB field
const VENDOR_SORT_FIELDS = {
  vendor_code: "vendor_code",
  name: "name",
  company: "company_name",
  city: "city",
  rating: "rating",
  balance: "balance_payable",
  status: "is_active",
  created: "created_at",
};

const generateNextVendorCode = async () => {
  const vendors = await Vendor.find({ vendor_code: { $regex: /^VND-\d+$/ } }).select("vendor_code").lean();
  let max = 0;
  for (const v of vendors) {
    const n = parseInt(String(v.vendor_code).split("-")[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `VND-${String(max + 1).padStart(5, "0")}`;
};

const getNextVendorCode = async (req, res) => {
  try {
    res.status(200).json({ success: true, data: { nextCode: await generateNextVendorCode() } });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

const createVendor = async (req, res) => {
  try {
    const code = String(req.body?.vendor_code || "").trim() || (await generateNextVendorCode());
    if (req.body?.vendor_code) {
      const dup = await Vendor.findOne({ vendor_code: code, is_deleted: false });
      if (dup) return res.status(400).json({ success: false, message: "Active vendor with this code already exists" });
    }
    const vendor = await Vendor.create({ ...req.body, vendor_code: code, createdby: req.user?._id || null, activity: [auditEvent(req, "created", [{ field: "Vendor", before: "—", after: String(req.body?.name || "").trim() }])] });
    const io = req.io || getIO();
    await pushGlobalActivity(io, { action: `${req.user?.name || "Admin"} created vendor "${vendor.name}"`, category: "Vendor Management", performedBy: req.user?._id || null, performedByName: req.user?.name || "Admin", details: { vendorId: vendor._id, vendor_code: code } }, req.user?._id || null).catch(() => {});
    try { io.emit("vendorCreated", vendor.toObject()); } catch {}
    res.status(201).json({ success: true, message: "Vendor created successfully", data: vendor });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success: false, message: "Vendor code already exists" });
    res.status(400).json({ success: false, message: e.message });
  }
};

const getVendorsAdmin = async (req, res) => {
  try {
    if (req.query.page === undefined && req.query.limit === undefined) {
      // ---- LEGACY MODE (no page/limit) -> exact old behavior ----
      // (purchase-orders pages vendor dropdown isi par depend karte hain)
      const vendors = await Vendor.find({ is_deleted: false }).select("-activity").sort({ created_at: -1 }).lean();
      return res.status(200).json({ success: true, data: vendors });
    }
    // ---- SERVER SIDE PAGINATION (brand admin list ka exact pattern) ----
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all").toLowerCase();
    const city = String(req.query.city || "").trim();
    const locale = parseVendorLocale(req.query.locale);
    const filter = { is_deleted: false };
    if (search) { const rx = new RegExp(escapeRegex(search), "i"); filter.$or = [{ name: rx }, { vendor_code: rx }, { company_name: rx }, { phone: rx }]; }
    if (status === "active") filter.is_active = true; else if (status === "inactive") filter.is_active = false;
    if (city && city.toLowerCase() !== "all") filter.city = city;

    // ✅ Sorting bhi server par hoti hai (whitelist ke ilawa koi custom field nahi).
    //    Default: created_at desc (legacy jaisa) — ties par _id stable order.
    const sortKeyRaw = String(req.query.sort || "").trim();
    const hasSort = Boolean(VENDOR_SORT_FIELDS[sortKeyRaw]);
    const sortField = hasSort ? VENDOR_SORT_FIELDS[sortKeyRaw] : "created_at";
    const rawOrder = String(req.query.order || "").trim().toLowerCase();
    const sortOrder = hasSort ? (rawOrder === "asc" ? 1 : -1) : -1;

    const purchaseTotalAgg = await Vendor.aggregate([
      { $match: { is_deleted: false } },
      { $group: { _id: null, sum: { $sum: "$total_purchased" } } },
    ]);

    const [total, vendors, totalAll, activeCount, cities] = await Promise.all([
      Vendor.countDocuments(filter),
      Vendor.find(filter).sort({ [sortField]: sortOrder, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Vendor.countDocuments({ is_deleted: false }),
      Vendor.countDocuments({ is_deleted: false, is_active: true }),
      Vendor.distinct("city", { is_deleted: false }),
    ]);
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);

    // ✅ Har row sirf front-visible fields + selected locale ki slim translation
    const rows = vendors.map((vendor) => {
      const item = frontVendorFields(vendor);
      const translations = slimVendorTranslations(vendor, locale);
      if (translations) item.translations = translations;
      return item;
    });

    res.status(200).json({
      success: true,
      data: rows,
      counts: {
        total: totalAll,
        active: activeCount,
        inactive: Math.max(0, totalAll - activeCount),
        // ✅ Poore collection ka purchase total — stat card ke liye (current page
        //    ke vendors par depend na kare, brands ka counts meta ka pattern)
        purchaseTotal: purchaseTotalAgg?.[0]?.sum || 0,
      },
      cities: (cities || []).filter(Boolean).sort(),
      pagination: { total, page: safePage, limit, pages, hasNext: safePage < pages, hasPrev: safePage > 1 },
    });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

// ==========================================
// 🛡️ GET VENDOR BY ID — ADMIN (slim, locale-aware)
// getBrandById / getBanner ka pattern: sirf front + audit fields + activity,
// selected locale ki slim translation ke saath.
// ==========================================
const getVendorById = async (req, res) => {
  try {
    const locale = parseVendorLocale(req.query.locale);
    const vendor = await Vendor.findOne({ _id: req.params.id, is_deleted: false })
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
      .lean();
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    // ✅ Internals (translation_source/status, deletedby/deleted_at, __v) bahar
    const { translation_source, translation_status, deletedby, deleted_at, is_deleted, activity, createdby, updatedby, ...frontOnly } = vendor;
    void translation_source; void translation_status; void deletedby; void deleted_at; void is_deleted;
    const responseVendor = {
      ...frontVendorFields(frontOnly),
      created_at: vendor.created_at,
      updated_at: vendor.updated_at,
      activity: activity || [],
      createdby: createdby ? { _id: createdby._id, name: createdby.name, email: createdby.email } : null,
      updatedby: updatedby ? { _id: updatedby._id, name: updatedby.name, email: updatedby.email } : null,
    };
    const translations = slimVendorTranslations(vendor, locale);
    if (translations) responseVendor.translations = translations;

    res.status(200).json({ success: true, data: responseVendor });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

const getVendorWithPOs = async (req, res) => {
  try {
    const locale = parseVendorLocale(req.query.locale);
    const vendor = await Vendor.findOne({ _id: req.params.id, is_deleted: false })
      .populate("createdby", "name email")
      .populate("updatedby", "name email")
      .lean();
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });
    const pos = await PurchaseOrder.find({ vendor_id: vendor._id, is_deleted: { $ne: true } }).sort({ created_at: -1 }).limit(100).lean();
    const payments = await PurchasePayment.find({ vendor_id: vendor._id }).lean();
    const totalPurchased = pos.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    // ✅ Internals bahar — sirf front + audit + activity (timeline tab isi se chalta hai)
    const { translation_source, translation_status, deletedby, deleted_at, is_deleted, activity, createdby, updatedby, ...frontOnly } = vendor;
    void translation_source; void translation_status; void deletedby; void deleted_at; void is_deleted;
    const responseVendor = {
      ...frontVendorFields(frontOnly),
      created_at: vendor.created_at,
      updated_at: vendor.updated_at,
      activity: activity || [],
      createdby: createdby ? { _id: createdby._id, name: createdby.name, email: createdby.email } : null,
      updatedby: updatedby ? { _id: updatedby._id, name: updatedby.name, email: updatedby.email } : null,
    };
    const translations = slimVendorTranslations(vendor, locale);
    if (translations) responseVendor.translations = translations;

    // ✅ PO rows bhi slim — sirf detail page + activity timeline wale fields
    const slimPurchaseOrder = (p) => ({
      _id: p._id,
      po_number: p.po_number,
      created_at: p.created_at,
      total: p.total,
      paid_amount: p.paid_amount,
      status: p.status,
      items_count: (p.items || []).length,
      ...(p.createdby && typeof p.createdby === "object"
        ? { createdby: { _id: p.createdby._id, name: p.createdby.name } }
        : {}),
      activity: p.activity || [],
      receivings: (p.receivings || []).map((r) => ({
        invoice_no: r.invoice_no,
        received_by_name: r.received_by_name,
        received_at: r.received_at,
        items: (r.items || []).map((it) => ({ qty: it.qty })),
      })),
    });

    res.status(200).json({
      success: true,
      data: {
        ...responseVendor,
        total_purchased: totalPurchased,
        total_paid: totalPaid,
        balance_payable: Math.max(0, totalPurchased - totalPaid),
        purchaseOrders: pos.map(slimPurchaseOrder),
      },
    });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

const updateVendor = async (req, res) => {
  try {
    const existing = await Vendor.findOne({ _id: req.params.id, is_deleted: false });
    if (!existing) return res.status(404).json({ success: false, message: "Vendor not found" });
    const update = { ...req.body, updatedby: req.user?._id || null };
    if (!String(req.body?.vendor_code || "").trim()) update.vendor_code = existing.vendor_code;
    const fields = ["vendor_code", "name", "company_name", "contact_person", "email", "phone", "whatsapp", "address", "city", "state", "country", "zip_code", "tax_id", "bank_details", "lead_time_days", "rating", "is_active"];
    const changes = diffFields(existing.toObject(), { ...existing.toObject(), ...update }, fields.map((key) => [key, key.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())]));
    if (changes.length) update.activity = [...(existing.activity || []), auditEvent(req, "updated", changes)];
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    try { (req.io || getIO()).emit("vendorUpdated", vendor.toObject()); } catch {}
    res.status(200).json({ success: true, message: "Vendor updated", data: vendor });
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ success: false, message: "Vendor code already exists" });
    res.status(400).json({ success: false, message: e.message });
  }
};

const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, is_deleted: false });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found or already deleted" });
    vendor.activity.push(auditEvent(req, "deleted", [{ field: "Vendor", before: vendor.name, after: "Deleted" }]));
    await vendor.softDelete(req.user?._id);
    try { (req.io || getIO()).emit("vendorDeleted", { _id: String(vendor._id) }); } catch {}
    res.status(200).json({ success: true, message: "Vendor soft deleted", data: { _id: vendor._id } });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

const restoreVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });
    await vendor.restore();
    res.status(200).json({ success: true, message: "Vendor restored", data: vendor });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

module.exports = { getNextVendorCode, createVendor, getVendorsAdmin, getVendorById, getVendorWithPOs, updateVendor, deleteVendor, restoreVendor };
