const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const PosSale = require("../models/PosSale");
const Quote = require("../models/Quote");
const Invoice = require("../models/Invoice");
const syncLeadCustomer = require("../utils/syncLeadCustomer");
const { auditEvent, diffFields } = require("../utils/auditHistory");

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getCustomersAdmin = async (req, res) => {
  try {
    const convertedLeads = await Lead.find({
      status: { $in: ["Customer", "Converted"] },
      is_deleted: { $ne: true },
    });
    for (const lead of convertedLeads) await syncLeadCustomer(lead, req.user?._id || null);

    const search = String(req.query.search || "").trim();
    const baseFilter = { is_deleted: { $ne: true } };
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      baseFilter.$or = [
        { name: regex },
        { phone: regex },
        { email: regex },
        { address: regex },
      ];
    }

    const listFilter = { ...baseFilter };
    const contactFilter = String(req.query.filter || "all");
    if (contactFilter === "phone") listFilter.phone = { $nin: ["", null] };
    else if (contactFilter === "email") listFilter.email = { $nin: ["", null] };

    // Calls without `page` retain the full-list response for POS/invoice flows.
    if (req.query.page === undefined) {
      const customers = await Customer.find(listFilter)
        .select("_id name phone email address created_at translations")
        .sort({ created_at: -1, _id: -1 })
        .lean();
      return res.status(200).json({ success: true, data: customers });
    }

    const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 10;
    const sortOrder = String(req.query.sort || "newest") === "oldest" ? 1 : -1;
    const total = await Customer.countDocuments(listFilter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, pages);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [customers, totalCustomers, newThisMonth, withPhone, withEmail] = await Promise.all([
      Customer.find(listFilter)
        .select("_id name phone email address created_at translations")
        .sort({ created_at: sortOrder, _id: sortOrder })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Customer.countDocuments({ is_deleted: { $ne: true } }),
      Customer.countDocuments({ is_deleted: { $ne: true }, created_at: { $gte: monthStart } }),
      Customer.countDocuments({ is_deleted: { $ne: true }, phone: { $nin: ["", null] } }),
      Customer.countDocuments({ is_deleted: { $ne: true }, email: { $nin: ["", null] } }),
    ]);

    res.status(200).json({
      success: true,
      data: customers,
      stats: { total: totalCustomers, newThisMonth, withPhone, withEmail },
      pagination: {
        total,
        page,
        limit,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const searchCustomers = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    if (!search) {
      const customers = await Customer.find({ is_deleted: { $ne: true } }).select("-activity").sort({ created_at: -1 }).limit(10).lean();
      return res.status(200).json({ success: true, data: customers });
    }

    const regex = new RegExp(escapeRegex(search), "i");
    const customers = await Customer.find({
      is_deleted: { $ne: true },
      $or: [{ name: regex }, { phone: regex }, { email: regex }],
    }).select("-activity").sort({ created_at: -1 }).limit(20).lean();

    res.status(200).json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, is_deleted: { $ne: true } }).lean();
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    const [sales, quotes, invoices] = await Promise.all([
      PosSale.find({ customer_id: customer._id }).sort({ created_at: -1 }).lean(),
      Quote.find({ customer_id: customer._id, is_deleted: { $ne: true } }).select("-activity").sort({ created_at: -1 }).lean(),
      Invoice.find({ customer_id: customer._id, is_deleted: { $ne: true } }).select("-activity").sort({ created_at: -1 }).lean(),
    ]);
    const totalSpent = sales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);

    res.status(200).json({
      success: true,
      data: {
        ...customer,
        total_sales: sales.length,
        total_spent: totalSpent,
        recent_sales: sales,
        quote_count: quotes.length,
        quote_history: quotes,
        invoice_count: invoices.length,
        invoice_history: invoices,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { name, phone = "", email = "", address = "", notes = "" } = req.body || {};
    if (!String(name || "").trim()) {
      return res.status(400).json({ success: false, message: "Customer name is required" });
    }

    const customer = await Customer.create({
      name: String(name).trim(),
      phone: String(phone || "").trim(),
      email: String(email || "").trim(),
      address: String(address || "").trim(),
      notes: String(notes || "").trim(),
      createdby: req.user?._id || null,
      activity: [auditEvent(req, "created", [{ field: "Customer", before: "—", after: String(name).trim() }])],
    });

    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findOne({ _id: req.params.id, is_deleted: { $ne: true } });
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });

    const allowed = ["name", "phone", "email", "address", "notes"];
    const before = Object.fromEntries(allowed.map((key) => [key, customer[key] || ""]));
    for (const key of allowed) {
      if (req.body[key] !== undefined) customer[key] = req.body[key];
    }

    const auditChanges = diffFields(before, customer.toObject(), allowed.map((key) => [key, key[0].toUpperCase() + key.slice(1)]));
    customer.updatedby = req.user?._id || null;
    if (auditChanges.length) customer.activity.push(auditEvent(req, "updated", auditChanges));
    await customer.save();
    const changes = allowed.filter((key) => String(before[key]) !== String(customer[key] || "")).map((key) => ({ field: key[0].toUpperCase() + key.slice(1), from: before[key] || "—", to: customer[key] || "—" }));
    if (changes.length) {
      const linkedLead = await Lead.findOne({ customer_id: customer._id, is_deleted: { $ne: true } });
      if (linkedLead) {
        linkedLead.history.push({
          action: "customer",
          summary: "Customer profile updated",
          changes,
          employee_id: req.user?._id || null,
          employee_name: req.user?.name || "Staff",
          created_at: new Date(),
        });
        await linkedLead.save();
      }
    }
    res.status(200).json({ success: true, data: customer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: "Customer not found" });
    customer.is_deleted = true;
    customer.deletedby = req.user?._id || null;
    customer.activity.push(auditEvent(req, "deleted", [{ field: "Customer", before: customer.name, after: "Deleted" }]));
    await customer.save();
    res.status(200).json({ success: true, message: "Customer deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCustomersAdmin,
  searchCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
