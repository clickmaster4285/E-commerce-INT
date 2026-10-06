const Vendor = require("../models/Vendor");
const PurchaseOrder = require("../models/PurchaseOrder");
const PurchasePayment = require("../models/PurchasePayment");
const { getIO } = require("../utils/socket");
const { pushGlobalActivity } = require("../utils/activityHelper");

const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
    const vendor = await Vendor.create({ ...req.body, vendor_code: code, createdby: req.user?._id || null });
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
      const vendors = await Vendor.find({ is_deleted: false }).sort({ created_at: -1 }).lean();
      return res.status(200).json({ success: true, data: vendors });
    }
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const search = String(req.query.search || "").trim();
    const status = String(req.query.status || "all").toLowerCase();
    const city = String(req.query.city || "").trim();
    const filter = { is_deleted: false };
    if (search) { const rx = new RegExp(escapeRegex(search), "i"); filter.$or = [{ name: rx }, { vendor_code: rx }, { company_name: rx }, { phone: rx }]; }
    if (status === "active") filter.is_active = true; else if (status === "inactive") filter.is_active = false;
    if (city && city.toLowerCase() !== "all") filter.city = city;
    const [total, vendors, totalAll, activeCount, cities] = await Promise.all([
      Vendor.countDocuments(filter),
      Vendor.find(filter).sort({ created_at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Vendor.countDocuments({ is_deleted: false }),
      Vendor.countDocuments({ is_deleted: false, is_active: true }),
      Vendor.distinct("city", { is_deleted: false }),
    ]);
    const pages = Math.max(1, Math.ceil(total / limit));
    res.status(200).json({ success: true, data: vendors, counts: { total: totalAll, active: activeCount, inactive: Math.max(0, totalAll - activeCount) }, cities: (cities || []).filter(Boolean).sort(), pagination: { total, page, limit, pages, hasNext: page < pages, hasPrev: page > 1 } });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

const getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, is_deleted: false }).lean();
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });
    res.status(200).json({ success: true, data: vendor });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

const getVendorWithPOs = async (req, res) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, is_deleted: false }).lean();
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });
    const pos = await PurchaseOrder.find({ vendor_id: vendor._id, is_deleted: { $ne: true } }).sort({ created_at: -1 }).limit(100).lean();
    const payments = await PurchasePayment.find({ vendor_id: vendor._id }).lean();
    const totalPurchased = pos.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const products = [...new Map(pos.flatMap((p) => p.items || []).map((i) => [String(i.product_id), { product_id: i.product_id, name: i.name, sku: i.sku }])).values()];
    res.status(200).json({ success: true, data: { ...vendor, total_purchased: totalPurchased, total_paid: totalPaid, balance_payable: Math.max(0, totalPurchased - totalPaid), purchaseOrders: pos, products } });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

const updateVendor = async (req, res) => {
  try {
    const existing = await Vendor.findOne({ _id: req.params.id, is_deleted: false });
    if (!existing) return res.status(404).json({ success: false, message: "Vendor not found" });
    const update = { ...req.body, updatedby: req.user?._id || null };
    if (!String(req.body?.vendor_code || "").trim()) update.vendor_code = existing.vendor_code;
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
