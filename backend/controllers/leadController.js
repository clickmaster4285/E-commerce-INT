const mongoose = require("mongoose");
const Lead = require("../models/Lead");
const Employee = require("../models/Employee");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Customer = require("../models/Customer");
const PosSale = require("../models/PosSale");
const Quote = require("../models/Quote");
const Invoice = require("../models/Invoice");
const syncLeadCustomer = require("../utils/syncLeadCustomer");

const enumValues = {
  lead_type: ["Individual", "Business"],
  source: ["Walk-in", "Phone Call", "WhatsApp", "Referral", "Email", "Social Media", "Other"],
  status: ["New", "Contacted", "Qualified", "Customer", "Converted", "Lost"],
};
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nextLeadNumber = async () => {
  const existing = await Lead.find({ lead_number: /^LD-\d+$/ }).select("lead_number").lean();
  const max = existing.reduce((highest, lead) => Math.max(highest, Number(String(lead.lead_number).slice(3)) || 0), 0);
  return `LD-${String(max + 1).padStart(4, "0")}`;
};
const validId = (id) => mongoose.isValidObjectId(id);
const actorId = (req) => req.user?._id || req.user?.id || null;
const actorName = async (req) => req.user?.name || (actorId(req) ? (await Employee.findById(actorId(req)).select("name").lean())?.name : null) || "Staff";
const idError = (res, entity) => res.status(400).json({ success: false, message: `Invalid ${entity} ID` });
const validationError = (res, message) => res.status(400).json({ success: false, message });
const historyLabels = { lead_type: "Lead type", name: "Contact person", phone: "Phone", email: "Email", company_name: "Company", business_type: "Business type", business_address: "Business address", city: "City", source: "Source", status: "Status", assigned_employee_id: "Assigned employee", next_follow_up_date: "Next follow-up", notes: "Notes", estimated_deal_value: "Estimated value", expected_purchase_date: "Expected purchase", product_interest: "Product interest", products: "Products", custom_requirements: "Custom requirements" };
const historyValue = (value) => {
  if (value == null || value === "") return "—";
  if (value instanceof Date) return value.toLocaleString();
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return value.name || value._id?.toString() || JSON.stringify(value);
  return String(value);
};
const buildHistoryChanges = async (before, after) => {
  const employeeIds = [before?.assigned_employee_id, after?.assigned_employee_id].filter(Boolean).map((value) => value?._id || value);
  const employees = employeeIds.length ? await Employee.find({ _id: { $in: employeeIds } }).select("name").lean() : [];
  const employeeNames = new Map(employees.map((employee) => [String(employee._id), employee.name]));
  const fieldChanges = Object.keys(historyLabels).filter((key) => key !== "products").flatMap((key) => {
    const from = before?.[key];
    const to = after?.[key];
    const normalize = (value) => ["next_follow_up_date", "expected_purchase_date"].includes(key) && value
      ? new Date(value).toISOString().slice(0, 10)
      : value?._id?.toString?.() || value?.toString?.() || JSON.stringify(value ?? "");
    if (normalize(from) === normalize(to)) return [];
    const displayValue = (value) => key === "assigned_employee_id"
      ? employeeNames.get(String(value?._id || value)) || "Unassigned"
      : historyValue(value);
    return [{ field: historyLabels[key], from: displayValue(from), to: displayValue(to) }];
  });
  const oldProducts = before?.products || [];
  const newProducts = after?.products || [];
  const productIds = [...new Set([...oldProducts, ...newProducts].map((item) => String(item.product_id?._id || item.product_id || "")).filter(validId))];
  const variantIds = [...new Set([...oldProducts, ...newProducts].map((item) => String(item.variant_id?._id || item.variant_id || "")).filter(validId))];
  const [products, variants] = await Promise.all([
    productIds.length ? Product.find({ _id: { $in: productIds } }).select("name").lean() : [],
    variantIds.length ? Variant.find({ _id: { $in: variantIds } }).select("title sku").lean() : [],
  ]);
  const productNames = new Map(products.map((item) => [String(item._id), item.name]));
  const variantNames = new Map(variants.map((item) => [String(item._id), item.title || item.sku]));
  const rowKey = (item) => String(item.variant_id?._id || item.variant_id || item.product_id?._id || item.product_id || "");
  const oldByKey = new Map(oldProducts.map((item) => [rowKey(item), item]));
  const newByKey = new Map(newProducts.map((item) => [rowKey(item), item]));
  const describe = (item) => `${productNames.get(String(item.product_id?._id || item.product_id || "")) || "Product"}${item.variant_id ? ` · ${variantNames.get(String(item.variant_id?._id || item.variant_id)) || "Variant"}` : ""} × ${Number(item.quantity) || 0}`;
  const productChanges = [];
  for (const [key, item] of newByKey) {
    const old = oldByKey.get(key);
    if (!old) productChanges.push({ field: "Product added", from: "—", to: describe(item) });
    else if (Number(old.quantity) !== Number(item.quantity)) productChanges.push({ field: "Product quantity", from: describe(old), to: describe(item) });
  }
  for (const [key, item] of oldByKey) if (!newByKey.has(key)) productChanges.push({ field: "Product removed", from: describe(item), to: "—" });
  return [...fieldChanges, ...productChanges];
};
const historyEntry = async (req, action, summary, changes = []) => ({ action, summary, changes, employee_id: actorId(req), employee_name: await actorName(req), created_at: new Date() });
const leadFields = ["lead_type", "name", "phone", "email", "company_name", "business_type", "business_address", "city", "source", "status", "product_interest", "category_id", "assigned_employee_id", "estimated_deal_value", "expected_purchase_date", "next_follow_up_date", "products", "custom_requirements", "notes"];
const pickLeadFields = (body = {}) => Object.fromEntries(leadFields.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));

async function validateReferences(payload, res) {
  if (payload.category_id) {
    if (!validId(payload.category_id)) { idError(res, "category"); return false; }
    const category = await Category.findOne({ _id: payload.category_id, is_deleted: { $ne: true } }).select("_id").lean();
    if (!category) { validationError(res, "Selected category not found"); return false; }
  }
  if (payload.assigned_employee_id) {
    if (!validId(payload.assigned_employee_id)) { idError(res, "employee"); return false; }
    const employee = await Employee.findOne({ _id: payload.assigned_employee_id, is_deleted: { $ne: true } }).select("_id").lean();
    if (!employee) { validationError(res, "Assigned employee not found"); return false; }
  }
  if (payload.products !== undefined) {
    if (!Array.isArray(payload.products)) { validationError(res, "Products must be a list"); return false; }
    for (const item of payload.products) {
      if (!item || !validId(item.product_id)) { validationError(res, "Each product requirement needs a valid product"); return false; }
      const product = await Product.findOne({ _id: item.product_id, is_deleted: { $ne: true } }).select("_id has_variants").lean();
      if (!product) { validationError(res, "A selected product was not found"); return false; }
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) { validationError(res, "Product quantities must be whole numbers of at least 1"); return false; }
      if (item.variant_id) {
        if (!validId(item.variant_id)) { validationError(res, "Invalid product variant ID"); return false; }
        const variant = await Variant.findOne({ _id: item.variant_id, product_id: product._id, is_deleted: { $ne: true } }).select("_id").lean();
        if (!variant) { validationError(res, "A selected variant does not belong to its product or no longer exists"); return false; }
      }
    }
  }
  return true;
}

function validatePayload(body, partial = false) {
  const payload = { ...body };
  for (const [key, allowed] of Object.entries(enumValues)) {
    if (payload[key] !== undefined && !allowed.includes(payload[key])) return `${key.replace("_", " ")} is invalid`;
  }
  if (!partial || payload.name !== undefined) {
    if (!String(payload.name || "").trim()) return "Contact person's name is required";
    payload.name = String(payload.name).trim();
  }
  if (!partial || payload.phone !== undefined) {
    const phone = String(payload.phone || "").replace(/\D/g, "").slice(0, 15);
    if (!phone || phone.length < 7) return "Enter a valid phone number with 7 to 15 digits";
    payload.phone = phone;
  }
  if (payload.email !== undefined) {
    payload.email = String(payload.email || "").trim().toLowerCase();
    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return "Enter a valid email address";
  }
  if (payload.product_interest !== undefined) payload.product_interest = String(payload.product_interest || "").trim();
  const type = payload.lead_type || "Individual";
  if (type === "Business" && payload.company_name !== undefined && !String(payload.company_name).trim()) return "Company name is required for Business leads";
  if (type === "Business" && !partial && !String(payload.company_name || "").trim()) return "Company name is required for Business leads";
  if (payload.estimated_deal_value !== undefined && payload.estimated_deal_value !== "" && (!Number.isFinite(Number(payload.estimated_deal_value)) || Number(payload.estimated_deal_value) < 0)) return "Deal value must be zero or greater";
  if (payload.estimated_deal_value === "") payload.estimated_deal_value = null;
  for (const key of ["expected_purchase_date", "next_follow_up_date"]) {
    if (payload[key] === "" || payload[key] === null) payload[key] = null;
    else if (payload[key] !== undefined && Number.isNaN(Date.parse(payload[key]))) return `${key.replaceAll("_", " ")} is invalid`;
  }
  return payload;
}

exports.listLeads = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const filter = { is_deleted: { $ne: true } };
    const search = String(req.query.search || "").trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: regex }, { phone: regex }, { email: regex }, { company_name: regex }, { product_interest: regex }, { lead_number: regex }];
    }
    for (const key of ["lead_type", "status", "source"]) if (req.query[key] && enumValues[key].includes(req.query[key])) {
      filter[key] = key === "status" && req.query[key] === "Customer" ? { $in: ["Customer", "Converted"] } : req.query[key];
    }
    if (req.query.assigned_employee_id) {
      if (!validId(req.query.assigned_employee_id)) return idError(res, "employee");
      filter.assigned_employee_id = req.query.assigned_employee_id;
    }
    if (req.query.from || req.query.to) {
      filter.created_at = {};
      if (req.query.from && !Number.isNaN(Date.parse(req.query.from))) filter.created_at.$gte = new Date(req.query.from);
      if (req.query.to && !Number.isNaN(Date.parse(req.query.to))) { const to = new Date(req.query.to); to.setHours(23, 59, 59, 999); filter.created_at.$lte = to; }
    }
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const activeLeads = { is_deleted: { $ne: true } };
    const [items, total, allLeads, newThisMonth, qualified, followUpsDue] = await Promise.all([
      Lead.find(filter).populate("assigned_employee_id", "name email").populate("category_id", "name").sort({ created_at: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Lead.countDocuments(filter),
      Lead.countDocuments(activeLeads),
      Lead.countDocuments({ ...activeLeads, created_at: { $gte: monthStart } }),
      Lead.countDocuments({ ...activeLeads, status: "Qualified" }),
      Lead.countDocuments({ ...activeLeads, next_follow_up_date: { $ne: null, $lte: now } }),
    ]);
    res.json({ success: true, data: items.map((item) => item.status === "Converted" ? { ...item, status: "Customer" } : item), stats: { total: allLeads, newThisMonth, qualified, followUpsDue }, pagination: { total, page, limit, pages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 } });
  } catch (error) { res.status(500).json({ success: false, message: "Unable to load leads" }); }
};

exports.getLead = async (req, res) => {
  try {
    if (!validId(req.params.id)) return idError(res, "lead");
    let lead = await Lead.findOne({ _id: req.params.id, is_deleted: { $ne: true } })
      .populate("assigned_employee_id", "name email phone").populate("category_id", "name").populate("activities.employee_id", "name email")
      .populate("history.employee_id", "name email")
      .populate("products.product_id", "name has_variants").populate("products.variant_id", "title sku selling_price").lean();
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    if (lead.status === "Customer" || lead.status === "Converted") {
      const leadDocument = await Lead.findById(lead._id);
      if (leadDocument) {
        await syncLeadCustomer(leadDocument, actorId(req));
        lead = await Lead.findOne({ _id: req.params.id, is_deleted: { $ne: true } })
          .populate("assigned_employee_id", "name email phone").populate("category_id", "name").populate("activities.employee_id", "name email")
          .populate("history.employee_id", "name email")
          .populate("products.product_id", "name has_variants").populate("products.variant_id", "title sku selling_price").lean();
      }
    }
    let customerHistory = { pos: [], quotes: [], invoices: [] };
    if ((lead.status === "Customer" || lead.status === "Converted") && lead.customer_id) {
      const [pos, quotes, invoices] = await Promise.all([
        PosSale.find({ customer_id: lead.customer_id }).sort({ created_at: -1 }).lean(),
        Quote.find({ customer_id: lead.customer_id, is_deleted: { $ne: true } }).select("-activity").sort({ created_at: -1 }).lean(),
        Invoice.find({ customer_id: lead.customer_id, is_deleted: { $ne: true } }).select("-activity").sort({ created_at: -1 }).lean(),
      ]);
      customerHistory = { pos, quotes, invoices };
    }
    res.json({ success: true, data: { ...lead, customer_history: customerHistory } });
  } catch (error) { res.status(500).json({ success: false, message: "Unable to load lead" }); }
};

exports.createLead = async (req, res) => {
  try {
    const payload = validatePayload(pickLeadFields(req.body));
    if (typeof payload === "string") return validationError(res, payload);
    if (!(await validateReferences(payload, res))) return;
    const initialStatus = payload.status || "New";
    const createdChanges = await buildHistoryChanges({}, { ...payload, status: initialStatus });
    const createdEvent = await historyEntry(req, "created", `Lead created with status ${initialStatus}`, createdChanges);
    let lead;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        lead = await Lead.create({ ...payload, lead_number: await nextLeadNumber(), createdby: actorId(req), updatedby: actorId(req), history: [createdEvent] });
        break;
      } catch (error) { if (error.code !== 11000 || attempt === 4) throw error; }
    }
    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "Unable to generate a unique lead number. Please try again." });
    if (error.name === "ValidationError") return validationError(res, error.message);
    res.status(500).json({ success: false, message: "Unable to create lead" });
  }
};

exports.updateLead = async (req, res) => {
  try {
    if (!validId(req.params.id)) return idError(res, "lead");
    const payload = validatePayload(pickLeadFields(req.body), true);
    if (typeof payload === "string") return validationError(res, payload);
    if (!(await validateReferences(payload, res))) return;
    const current = await Lead.findOne({ _id: req.params.id, is_deleted: { $ne: true } });
    if (!current) return res.status(404).json({ success: false, message: "Lead not found" });
    if (current.status === "Customer" || current.status === "Converted") await syncLeadCustomer(current, actorId(req));
    if (payload.status === "Lost" && !["Contacted", "Qualified", "Lost"].includes(current.status)) return validationError(res, "Only contacted or qualified leads can be marked as lost");
    if (payload.status === "Customer" && !current.customer_added) return validationError(res, "Add the lead to Customers before setting this status");
    const mergedValidation = validatePayload({ ...current.toObject(), ...payload });
    if (typeof mergedValidation === "string") return validationError(res, mergedValidation);
    if (payload.lead_type === "Individual") { payload.company_name = ""; payload.business_type = ""; payload.business_address = ""; payload.city = ""; }
    const before = current.toObject();
    const lead = await Lead.findOneAndUpdate({ _id: req.params.id, is_deleted: { $ne: true } }, { $set: { ...payload, updatedby: actorId(req) } }, { new: true, runValidators: true });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    const changes = await buildHistoryChanges(before, lead.toObject());
    if (changes.length) {
      const statusChanged = changes.some((change) => change.field === "Status");
      const summary = statusChanged
        ? `Status changed from ${changes.find((change) => change.field === "Status").from} to ${changes.find((change) => change.field === "Status").to}`
        : "Lead details updated";
      lead.history.push(await historyEntry(req, statusChanged ? "status" : "updated", summary, changes));
      await lead.save();
    }
    if (lead.status === "Customer" || lead.status === "Converted") await syncLeadCustomer(lead, actorId(req));
    res.json({ success: true, data: lead });
  } catch (error) { if (error.name === "ValidationError") return validationError(res, error.message); res.status(500).json({ success: false, message: "Unable to update lead" }); }
};

exports.updateStatus = async (req, res) => {
  try {
    if (!validId(req.params.id)) return idError(res, "lead");
    if (!enumValues.status.includes(req.body?.status)) return validationError(res, "Choose a valid lead status");
    if (req.body.status === "Customer" && req.body.customer_added !== true) return validationError(res, "Convert the lead to a customer before setting this status");
    const current = await Lead.findOne({ _id: req.params.id, is_deleted: { $ne: true } }).select("status lost_reason").lean();
    if (!current) return res.status(404).json({ success: false, message: "Lead not found" });
    if (req.body.status === "Lost" && !["Contacted", "Qualified", "Lost"].includes(current.status)) return validationError(res, "Only contacted or qualified leads can be marked as lost");
    const updates = { status: req.body.status, updatedby: actorId(req) };
    if (req.body.status === "Lost") updates.lost_reason = String(req.body.lost_reason || "").trim().slice(0, 1000);
    if (req.body.customer_added !== undefined) {
      if (req.body.status !== "Customer" || req.body.customer_added !== true) return validationError(res, "Customer can only be marked added when the lead is converted to a customer");
      updates.customer_added = true;
    }
    if (req.body.customer_id !== undefined) {
      if (req.body.status !== "Customer" || !validId(req.body.customer_id)) return validationError(res, "A valid customer record is required");
      const customer = await Customer.findOne({ _id: req.body.customer_id, is_deleted: { $ne: true } }).select("_id").lean();
      if (!customer) return validationError(res, "Customer record not found");
      updates.customer_id = customer._id;
    }
    const changes = [];
    if (current.status !== req.body.status) changes.push({ field: "Status", from: current.status, to: req.body.status });
    if (req.body.status === "Lost" && String(current.lost_reason || "") !== String(updates.lost_reason || "")) changes.push({ field: "Lost reason", from: current.lost_reason || "—", to: updates.lost_reason || "—" });
    const nextStatus = req.body.status === "Customer" ? "Customer" : req.body.status;
    const summary = current.status !== nextStatus
      ? `Status changed from ${current.status} to ${nextStatus}`
      : req.body.status === "Lost" ? "Lost reason updated" : "Lead status confirmed";
    const update = { $set: updates };
    if (changes.length) update.$push = { history: await historyEntry(req, "status", summary, changes) };
    const lead = await Lead.findOneAndUpdate({ _id: req.params.id, is_deleted: { $ne: true } }, update, { new: true, runValidators: true });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    if (lead.status === "Customer") await syncLeadCustomer(lead, actorId(req));
    res.json({ success: true, data: lead });
  } catch (error) { res.status(500).json({ success: false, message: "Unable to update status" }); }
};

exports.addActivity = async (req, res) => {
  try {
    if (!validId(req.params.id)) return idError(res, "lead");
    const { type, notes, follow_up_date } = req.body || {};
    if (!["Call", "WhatsApp", "Email", "Meeting", "Other"].includes(type)) return validationError(res, "Choose a valid interaction type");
    if (!String(notes || "").trim()) return validationError(res, "Activity notes are required");
    if (follow_up_date && Number.isNaN(Date.parse(follow_up_date))) return validationError(res, "Follow-up date is invalid");
    const employee = actorId(req) ? await Employee.findById(actorId(req)).select("name").lean() : null;
    const activity = { type, notes: String(notes).trim(), follow_up_date: follow_up_date || null, employee_id: actorId(req), employee_name: employee?.name || "Staff", created_at: new Date() };
    const update = { $push: { activities: activity }, $set: { updatedby: actorId(req) } };
    if (follow_up_date) update.$set.next_follow_up_date = follow_up_date;
    const lead = await Lead.findOneAndUpdate({ _id: req.params.id, is_deleted: { $ne: true } }, update, { new: true, runValidators: true }).populate("activities.employee_id", "name email");
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    res.status(201).json({ success: true, data: lead.activities[lead.activities.length - 1] });
  } catch (error) { res.status(500).json({ success: false, message: "Unable to add activity" }); }
};

exports.deleteLead = async (req, res) => {
  try {
    if (!validId(req.params.id)) return idError(res, "lead");
    const lead = await Lead.findOneAndUpdate({ _id: req.params.id, is_deleted: { $ne: true } }, {
      $set: { is_deleted: true, deleted_at: new Date(), updatedby: actorId(req) },
      $push: { history: await historyEntry(req, "deleted", "Lead deleted") },
    });
    if (!lead) return res.status(404).json({ success: false, message: "Lead not found" });
    res.json({ success: true, message: "Lead deleted" });
  } catch (error) { res.status(500).json({ success: false, message: "Unable to delete lead" }); }
};
