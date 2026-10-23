const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const Lead = require("../models/Lead");
const PosSale = require("../models/PosSale");
const Quote = require("../models/Quote");
const Invoice = require("../models/Invoice");
const syncLeadCustomer = require("../utils/syncLeadCustomer");

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getCustomersAdmin = async (req, res) => {
  try {
    const convertedLeads = await Lead.find({
      status: { $in: ["Customer", "Converted"] },
      is_deleted: { $ne: true },
    });
    for (const lead of convertedLeads) await syncLeadCustomer(lead, req.user?._id || null);

    const search = String(req.query.search || "").trim();
    const q = { is_deleted: { $ne: true } };
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      q.$or = [
        { name: regex },
        { phone: regex },
        { email: regex },
        { address: regex },
      ];
    }

    const customers = await Customer.find(q).sort({ created_at: -1 }).lean();
    res.status(200).json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const searchCustomers = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    if (!search) {
      const customers = await Customer.find({ is_deleted: { $ne: true } }).sort({ created_at: -1 }).limit(10).lean();
      return res.status(200).json({ success: true, data: customers });
    }

    const regex = new RegExp(escapeRegex(search), "i");
    const customers = await Customer.find({
      is_deleted: { $ne: true },
      $or: [{ name: regex }, { phone: regex }, { email: regex }],
    }).sort({ created_at: -1 }).limit(20).lean();

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
      Quote.find({ customer_id: customer._id, is_deleted: { $ne: true } }).sort({ created_at: -1 }).lean(),
      Invoice.find({ customer_id: customer._id, is_deleted: { $ne: true } }).sort({ created_at: -1 }).lean(),
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

    customer.updatedby = req.user?._id || null;
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
