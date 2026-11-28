const PurchaseOrder = require("../models/PurchaseOrder");
const PurchasePayment = require("../models/PurchasePayment");

/** Vendor totals — saari POs + payments se (limit nahi), PO payment flow jaisa */
async function aggregateVendorBalances(vendorId) {
  if (!vendorId) {
    return { total_paid: 0, total_purchased: 0, balance_payable: 0 };
  }
  const vid = vendorId;
  const [payRows, poRows] = await Promise.all([
    PurchasePayment.aggregate([
      { $match: { vendor_id: vid } },
      { $group: { _id: null, paid: { $sum: "$amount" } } },
    ]),
    PurchaseOrder.aggregate([
      { $match: { vendor_id: vid, is_deleted: { $ne: true } } },
      { $group: { _id: null, purchased: { $sum: "$total" } } },
    ]),
  ]);
  const total_paid = payRows[0]?.paid || 0;
  const total_purchased = poRows[0]?.purchased || 0;
  const balance_payable = Math.max(0, total_purchased - total_paid);
  return { total_paid, total_purchased, balance_payable };
}

module.exports = { aggregateVendorBalances };