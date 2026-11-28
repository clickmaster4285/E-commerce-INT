// POS return core (§4.2) — controller sirf HTTP wrapper; yahan validation + tx + stock restore.
// `{ status, body }` lautata hai, res ko touch nahi karta. Response shapes pehle jaise.
const mongoose = require("mongoose");
const { withTx } = require("../utils/tx"); // POS sale / return transactions
const Variant = require("../models/Variant");
const PosSale = require("../models/PosSale");
const StockHistory = require("../models/StockHistory");
const stock = require("./stock");

const reply = (status, body) => ({ status, body });

/**
 * @param {{ saleId: string, payload: {items?: any[], note?: string}, user?: object }} ctx
 */
async function recordReturn({ saleId, payload, user }) {
  try {
    const { items = [], note = "" } = payload || {};
    if (!mongoose.isValidObjectId(saleId)) return reply(400, { success: false, message: "Invalid POS sale id" });
    if (!Array.isArray(items) || !items.length) return reply(400, { success: false, message: "Select at least one item to return" });
    const reason = String(note || "").trim();
    if (!reason) return reply(400, { success: false, message: "A return reason is required" });
    if (reason.length > 300) return reply(400, { success: false, message: "Return reason must be 300 characters or fewer" });
  
    const { result } = await withTx(async () => {
      const sale = await PosSale.findById(saleId);
      if (!sale || sale.status !== "completed") throw Object.assign(new Error("Completed sale not found"), { status: 404 });
      const returnedSoFar = new Map();
      for (const ret of sale.returns || []) {
        for (const line of ret.items || []) {
          const id = String(line.variant_id);
          returnedSoFar.set(id, (returnedSoFar.get(id) || 0) + Number(line.quantity || 0));
        }
      }
      const returnLines = [];
      let refundTotal = 0;
      const additionalTaxRate = Math.min(100, Math.max(0, Number(sale.additional_tax_rate) || 0));
      const taxInclusiveItemsTotal = sale.items.reduce((sum, line) => sum + (Number(line.line_total) || 0) * (1 + ((Number(line.tax_rate) || 0) + additionalTaxRate) / 100), 0);
      const itemDiscounts = sale.items.reduce((sum, line) => sum + (Number(line.discount_amount) || 0), 0);
      const saleLevelDiscount = Math.max(0, (Number(sale.discount_amount) || 0) - itemDiscounts);
      for (const requested of items) {
        const variantId = String(requested.variant_id || "");
        const quantity = Number(requested.quantity);
        if (!mongoose.isValidObjectId(variantId) || !Number.isInteger(quantity) || quantity < 1) throw new Error("Invalid return item or quantity");
        const original = sale.items.find((line) => String(line.variant_id) === variantId);
        if (!original) throw new Error("An item does not belong to this sale");
        const alreadyReturned = returnedSoFar.get(variantId) || 0;
        const requestedTotal = returnLines.filter((line) => String(line.variant_id) === variantId).reduce((sum, line) => sum + line.quantity, 0) + quantity;
        if (alreadyReturned + requestedTotal > original.quantity) throw new Error(`Only ${Math.max(0, original.quantity - alreadyReturned)} more ${original.product_name} item(s) can be returned`);
        const gross = Number(original.line_total) * (1 + ((Number(original.tax_rate) || 0) + additionalTaxRate) / 100);
        const allocatedSaleDiscount = taxInclusiveItemsTotal > 0 ? saleLevelDiscount * (gross / taxInclusiveItemsTotal) : 0;
        const refund = Math.round(Math.max(0, gross - allocatedSaleDiscount) / original.quantity * quantity);
        refundTotal += refund;
        returnLines.push({ variant_id: original.variant_id, product_name: original.product_name, sku: original.sku, variant_title: original.variant_title, quantity, refund_amount: refund });
      }
      const returnRecordId = new mongoose.Types.ObjectId();
      const historyExplanation = `Return ${returnRecordId} for ${sale.sale_number}: ${reason}`;
      const historyRows = [];
      for (const line of returnLines) {
        const adj = await stock.adjust({
          variant_id: line.variant_id,
          qty_delta: line.quantity,
          kind: "return",
          ref_type: "pos_sale",
          ref_id: sale._id,
          reason: "POS sale return",
          explanation: historyExplanation,
          actor: { id: user?._id || null, name: user?.name || "Administrator" },
        });
        if (!adj.ok) throw new Error(`Could not restore stock for ${line.product_name}`);
        const newQty = Number(adj.on_hand) || 0;
        historyRows.push({
          variant_id: line.variant_id,
          product_id: sale.items.find((item) => String(item.variant_id) === String(line.variant_id))?.product_id,
          product_name: line.product_name,
          sku: line.sku,
          variant_title: line.variant_title,
          previous_quantity: newQty - line.quantity,
          new_quantity: newQty,
          change_quantity: line.quantity,
          adjustment_type: "add",
          reason: "POS sale return",
          explanation: historyExplanation,
          performed_by: user?._id || null,
          performed_by_name: user?.name || "Administrator",
        });
      }
      await StockHistory.insertMany(historyRows);
      sale.returns.push({
        _id: returnRecordId,
        returned_by: user?._id || null,
        returned_by_name: user?.name || "Administrator",
        reason,
        refund_method: "cash",
        refund_total: refundTotal,
        items: returnLines,
      });
      await sale.save();
      return { sale, refundTotal };
    });
    return reply(201, { success: true, data: { sale: result.sale, refund_total: result.refundTotal } });
  } catch (error) {
    return reply(error.status || 400, { success: false, message: error.message || "Unable to return POS sale items" });
  }
}

module.exports = { recordReturn };
