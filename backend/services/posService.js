// POS return core (§4.2) — controller sirf HTTP wrapper; yahan validation + tx + stock restore.
// `{ status, body }` lautata hai, res ko touch nahi karta. Response shapes pehle jaise.
const mongoose = require("mongoose");
const { withTx } = require("../utils/tx"); // POS sale / return transactions
const { nextSeq, formatNumber, maxNumericSuffix } = require("../utils/counter");
const Variant = require("../models/Variant");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const PosSale = require("../models/PosSale");
const StockHistory = require("../models/StockHistory");
const SaleReturn = require("../models/SaleReturn");
const stock = require("./stock");
const payments = require("./payments");
const { toMinor, roundMoney } = require("../utils/money");
const { normalizeMethod, isPaymentMethodCode } = require("../config/paymentMethods");
const { pricePosLine } = require("./pricing/posLine");

const reply = (status, body) => ({ status, body });
const normalizeMoney = (value) => Math.max(0, Number(value) || 0);
const normalizePayMethod = normalizeMethod;
const generateNextSaleNumber = async () =>
  formatNumber("POS-", await nextSeq("pos_sale", { seed: () => maxNumericSuffix(PosSale, "sale_number", /^POS-\d+$/) }), 5);

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
          idempotency_key: `pos_sale:${sale._id}:return:${returnRecordId}:${line.variant_id}`,
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

      let refundPaymentId = null;
      const refundMinor = toMinor(refundTotal);
      if (refundMinor > 0) {
        const { payment } = await payments.record({
          direction: "out",
          method_code: normalizeMethod(sale.payment?.method || "cash"),
          amount_minor: refundMinor,
          status: "captured",
          ref_type: "pos_sale",
          ref_id: sale._id,
          party_type: sale.customer_id ? "customer" : "customer",
          party_id: sale.customer_id || null,
          reference: `Return ${returnRecordId} ${sale.sale_number || ""}`.trim(),
          received_by: user?._id || null,
          idempotency_key: `pos_sale:${sale._id}:return:${returnRecordId}:pay`,
        });
        refundPaymentId = payment?._id || null;
      }

      // Same _id as embedded sale.returns[] so getPosReturns can join without unwind (§4.5)
      await SaleReturn.create([{
        _id: returnRecordId,
        ref_type: "pos_sale",
        ref_id: sale._id,
        lines: returnLines.map((line) => ({
          variant_id: line.variant_id,
          qty: line.quantity,
          amount_minor: toMinor(line.refund_amount),
        })),
        refund_payment_id: refundPaymentId,
        method: "cash",
        reason,
        actor_id: user?._id || null,
        at: new Date(),
      }]);

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

async function savePosSale({ body, user, existingSale = null } = {}) {
  try {
    const { customer_id, customer_name, customer_phone, customer_email, customer_address, notes, payment_method = "cash", amount_received = 0, reference = "", items = [] } = body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return reply(400, { success: false, message: "At least one sale item is required" });
    }

    const originalSale = existingSale?.toObject ? existingSale.toObject() : null;
    const originalQuantities = new Map();
    for (const line of originalSale?.items || []) {
      const variantId = String(line.variant_id?._id || line.variant_id || "");
      if (variantId) originalQuantities.set(variantId, (originalQuantities.get(variantId) || 0) + (Number(line.quantity) || 0));
    }
    const availableStock = new Map();
    const normalizedItems = [];
    let subtotal = 0;
    let discountAmount = normalizeMoney(body.discount_amount || 0);
    const additionalTaxRate = Number(body.additional_tax_rate ?? 0);
    if (!Number.isFinite(additionalTaxRate) || additionalTaxRate < 0 || additionalTaxRate > 100) {
      throw new Error("Additional tax must be between 0 and 100 percent");
    }
    let itemDiscountTotal = 0;
    let taxAmount = 0;

    for (const item of items) {
      const variantId = item.variant_id || item.variantId;
      if (!variantId || !mongoose.isValidObjectId(String(variantId))) {
        throw new Error("Invalid variant_id in sale item");
      }

      const quantity = Number(item.quantity || 0);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error("Each POS item quantity must be a positive integer");
      }

      const variant = await Variant.findById(variantId).lean();
      if (!variant || variant.status !== "active") {
        throw new Error("Selected variant is unavailable");
      }

      const product = await Product.findById(variant.product_id).lean();
      if (!product || product.is_deleted || product.status !== "active") {
        throw new Error(`Product for ${variant.sku || "selected variant"} is unavailable`);
      }

      availableStock.set(String(variant._id), Number(variant.quantity) || 0);

      const unitPrice = Number(item.unit_price ?? variant.selling_price ?? 0);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new Error("Invalid selling price for a sale item");
      }

      const discountRate = Number(item.discount_rate ?? 0);
      if (!Number.isFinite(discountRate) || discountRate < 0 || discountRate > 100) {
        throw new Error("Item discount must be between 0 and 100 percent");
      }
      const taxRate = Number(item.tax_rate ?? product.tax ?? 0);
      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
        throw new Error("Item tax must be between 0 and 100 percent");
      }

      const flatDiscountPerUnit = Number(item.flat_discount ?? 0);
      if (!Number.isFinite(flatDiscountPerUnit) || flatDiscountPerUnit < 0) {
        throw new Error("Flat item discount must be a non-negative amount");
      }
      const priced = pricePosLine({
        unitPrice,
        quantity,
        discountRate,
        flatDiscountPerUnit,
        taxRate,
      });
      subtotal += priced.grossLineTotal;
      itemDiscountTotal += priced.itemDiscount;
      taxAmount += priced.itemTax;

      normalizedItems.push({
        product_id: product._id,
        variant_id: variant._id,
        product_name: product.name,
        sku: variant.sku || "",
        variant_title: variant.title || "",
        product_image: variant.images?.[0]?.img_url || "",
        unit_price: unitPrice,
        quantity,
        line_total: priced.lineTotal,
        discount_rate: priced.discount_rate,
        flat_discount: priced.flat_discount,
        tax_rate: priced.tax_rate,
        discount_amount: priced.itemDiscount,
      });
    }

    const requestedQuantities = new Map();
    for (const line of normalizedItems) {
      const variantId = String(line.variant_id);
      requestedQuantities.set(variantId, (requestedQuantities.get(variantId) || 0) + line.quantity);
    }
    for (const [variantId, quantity] of requestedQuantities) {
      const onHand = availableStock.get(variantId) || 0;
      const creditedSaleQuantity = originalQuantities.get(variantId) || 0;
      if (onHand + creditedSaleQuantity < quantity) {
        const line = normalizedItems.find((item) => String(item.variant_id) === variantId);
        throw new Error(`Insufficient stock for ${line?.product_name || "selected item"} (${line?.variant_title || line?.sku}). Only ${onHand + creditedSaleQuantity} available.`);
      }
    }

    const finalSubtotal = roundMoney(subtotal);
    taxAmount += Math.max(0, subtotal - itemDiscountTotal) * (additionalTaxRate / 100);
    const finalTax = roundMoney(taxAmount);
    const finalDiscount = Math.min(itemDiscountTotal + discountAmount, finalSubtotal + finalTax);
    const total = Math.max(0, roundMoney(finalSubtotal + finalTax - finalDiscount));

    let paymentMethod = normalizeMethod(payment_method || "cash");
    const posCodes = ["cash", "card", "mobile_wallet", "bank_transfer"];
    if (!isPaymentMethodCode(paymentMethod) || !posCodes.includes(paymentMethod)) {
      paymentMethod = "cash";
    }
    if (["card", "bank_transfer"].includes(paymentMethod) && !String(reference || "").trim()) {
      return reply(400, { success: false, message: "Transaction ID is required for card or bank payments" });
    }

    const amountReceived = normalizeMoney(amount_received);
    let changeDue = 0;
    if (paymentMethod === "cash") {
      if (amountReceived < total) {
        return reply(400, { success: false, message: "Cash received is less than the total payable amount" });
      }
      changeDue = amountReceived - total;
    }

    let customer = null;
    if (customer_id && mongoose.isValidObjectId(String(customer_id))) {
      customer = await Customer.findOne({ _id: customer_id, is_deleted: { $ne: true } }).lean();
    }

    const customerSnapshot = {
      name: customer?.name || String(customer_name || "Walk-in Customer").trim(),
      phone: customer?.phone || String(customer_phone || "").trim(),
      email: customer?.email || String(customer_email || "").trim(),
      address: customer?.address || String(customer_address || "").trim(),
      notes: customer?.notes || "",
    };

    const saleNumber = originalSale?.sale_number || await generateNextSaleNumber();
    const editorName = String(user?.name || user?.username || user?.email || "Administrator").trim();
    const editChanges = [];
    if (originalSale) {
      const addValueChange = (action, fromValue, toValue, product = {}) => {
        const before = String(fromValue ?? "");
        const after = String(toValue ?? "");
        if (before === after) return;
        editChanges.push({ action, ...product, from_value: before || "—", to_value: after || "—" });
      };
      const previousItems = new Map((originalSale.items || []).map((item) => [String(item.variant_id?._id || item.variant_id), item]));
      const nextItems = new Map(normalizedItems.map((item) => [String(item.variant_id), item]));
      for (const [variantId, item] of nextItems) {
        const previous = previousItems.get(variantId);
        const details = { product_name: item.product_name, variant_title: item.variant_title || "", sku: item.sku || "" };
        if (!previous) editChanges.push({ action: "added", ...details, from_quantity: 0, to_quantity: item.quantity });
        else if (Number(previous.quantity) !== Number(item.quantity)) editChanges.push({ action: "quantity", ...details, from_quantity: Number(previous.quantity) || 0, to_quantity: item.quantity });
        if (previous) {
          addValueChange("price", Number(previous.unit_price) || 0, item.unit_price, details);
          const previousDiscount = `${Number(previous.discount_amount) || 0} (${Number(previous.discount_rate) || 0}% + flat ${Number(previous.flat_discount) || 0}/unit)`;
          const nextDiscount = `${Number(item.discount_amount) || 0} (${Number(item.discount_rate) || 0}% + flat ${Number(item.flat_discount) || 0}/unit)`;
          addValueChange("discount", previousDiscount, nextDiscount, details);
          addValueChange("tax", Number(previous.tax_rate) || 0, item.tax_rate, details);
        }
      }
      for (const [variantId, item] of previousItems) {
        if (!nextItems.has(variantId)) editChanges.push({ action: "removed", product_name: item.product_name, variant_title: item.variant_title || "", sku: item.sku || "", from_quantity: Number(item.quantity) || 0, to_quantity: 0 });
      }
      addValueChange("sale_discount", Number(originalSale.discount_amount) || 0, finalDiscount);
      addValueChange("tax", Number(originalSale.tax_amount) || 0, finalTax);
      addValueChange("sale_total", Number(originalSale.total) || 0, total);
      const previousCustomer = originalSale.customer_snapshot || {};
      if ((previousCustomer.name || "") !== customerSnapshot.name || (previousCustomer.phone || "") !== customerSnapshot.phone) {
        addValueChange("customer", `${previousCustomer.name || "Walk-in Customer"}${previousCustomer.phone ? ` · ${previousCustomer.phone}` : ""}`, `${customerSnapshot.name}${customerSnapshot.phone ? ` · ${customerSnapshot.phone}` : ""}`);
      }
      const previousPayment = originalSale.payment || {};
      const paymentBefore = `${previousPayment.method || "cash"}, received ${Number(previousPayment.amount_received) || 0}${previousPayment.reference ? `, ref ${previousPayment.reference}` : ""}`;
      const paymentAfter = `${paymentMethod}, received ${amountReceived}${String(reference || "").trim() ? `, ref ${String(reference).trim()}` : ""}`;
      addValueChange("payment", paymentBefore, paymentAfter);
      addValueChange("notes", originalSale.notes || "", String(notes || "").trim());
    }
    const saleData = {
      sale_number: saleNumber,
      customer_id: customer?._id || null,
      customer_snapshot: customerSnapshot,
      cashier_id: originalSale?.cashier_id || user?._id || null,
      cashier_name: originalSale?.cashier_name || user?.name || "Administrator",
      created_by_id: originalSale?.created_by_id || (!originalSale ? user?._id || null : null),
      created_by_name: originalSale?.created_by_name || (!originalSale ? editorName : ""),
      edit_history: originalSale
        ? [...(Array.isArray(originalSale.edit_history) ? originalSale.edit_history : []), {
          edited_at: new Date(),
          edited_by_id: user?._id || null,
          edited_by_name: editorName,
          changes: editChanges,
        }]
        : [],
      items: normalizedItems,
      subtotal: finalSubtotal,
      discount_amount: finalDiscount,
      tax_amount: finalTax,
      additional_tax_rate: additionalTaxRate,
      total,
      payment: {
        method: paymentMethod,
        amount_received: amountReceived,
        change_due: changeDue,
        reference: String(reference || "").trim(),
      },
      status: "completed",
      notes: String(notes || "").trim(),
    };

    // 🔒 Replica set transaction (stock + sale + history)
    const saleId = existingSale?._id || new mongoose.Types.ObjectId();
    const historyReason = originalSale ? "POS sale edit" : "POS sale";
    const historyExplanation = originalSale ? `POS sale edit ${saleNumber}` : `POS sale ${saleNumber}`;

    const { result: savedSaleResult } = await withTx(async () => {
      const historyRows = [];
      const affectedVariantIds = new Set([...originalQuantities.keys(), ...requestedQuantities.keys()]);
      for (const variantId of affectedVariantIds) {
        const previousSold = originalQuantities.get(variantId) || 0;
        const nextSold = requestedQuantities.get(variantId) || 0;
        const stockChange = previousSold - nextSold;
        if (!stockChange) continue;

        const line = normalizedItems.find((item) => String(item.variant_id) === variantId)
          || (originalSale?.items || []).find((item) => String(item.variant_id?._id || item.variant_id) === variantId);
        const adj = await stock.adjust({
          variant_id: variantId,
          qty_delta: stockChange,
          kind: stockChange < 0 ? "sale" : "return",
          ref_type: "pos_sale",
          ref_id: saleId,
          reason: historyReason,
          explanation: historyExplanation,
          actor: { id: user?._id || null, name: user?.name || "Administrator" },
        });
        if (!adj.ok) throw new Error(`Stock changed while saving ${line?.product_name || "this sale"}. Please retry.`);
        const newQty = Number(adj.on_hand) || 0;

        historyRows.push({
          variant_id: variantId,
          product_id: line?.product_id,
          product_name: line?.product_name || "",
          sku: line?.sku || "",
          variant_title: line?.variant_title || "",
          previous_quantity: newQty - stockChange,
          new_quantity: newQty,
          change_quantity: stockChange,
          adjustment_type: stockChange > 0 ? "add" : "remove",
          reason: historyReason,
          explanation: historyExplanation,
          performed_by: user?._id || null,
          performed_by_name: user?.name || "Administrator",
        });
      }

      const savedSale = existingSale
        ? await PosSale.findOneAndUpdate(
          { _id: saleId, ...(originalSale?.updated_at ? { updated_at: originalSale.updated_at } : {}) },
          { $set: saleData },
          { returnDocument: "after", runValidators: true },
        )
        : (await PosSale.create([{ ...saleData, _id: saleId }]))[0];
      if (!savedSale) throw new Error(existingSale ? "This sale was changed by someone else. Please reload and try again." : "Sale could not be saved.");
      if (historyRows.length) await StockHistory.insertMany(historyRows);

      // Append-only Payment + ledger for new sales (§3.9 dual-write)
      if (!existingSale) {
        const collected = Math.max(
          0,
          (Number(savedSale.payment?.amount_received) || Number(savedSale.total) || 0)
            - (Number(savedSale.payment?.change_due) || 0),
        );
        if (collected > 0) {
          await payments.record({
            direction: "in",
            method_code: normalizePayMethod(savedSale.payment?.method || "cash"),
            amount_minor: toMinor(collected),
            status: "captured",
            ref_type: "pos_sale",
            ref_id: savedSale._id,
            party_type: savedSale.customer_id ? "customer" : null,
            party_id: savedSale.customer_id || null,
            reference: savedSale.sale_number || "",
            received_by: user?._id || null,
            idempotency_key: `pos_sale:${savedSale._id}:capture`,
          });
        }
        const itemQty = (savedSale.items || []).reduce(
          (sum, line) => sum + Math.max(0, Number(line.quantity) || 0),
          0,
        );
        try {
          require("../services/storeStats").bumpStoreDaily({
            revenue: Number(savedSale.total) || collected || 0,
            orders: 1,
            items: itemQty,
          });
        } catch (_) { /* fire-and-forget */ }
      }
      return savedSale;
    });
    return reply(existingSale ? 200 : 201, { success: true, data: savedSaleResult });
  } catch (error) {
    return reply(400, { success: false, message: error.message || "Unable to save POS sale" });
  }
};


module.exports = { recordReturn, savePosSale, pricePosLine };
