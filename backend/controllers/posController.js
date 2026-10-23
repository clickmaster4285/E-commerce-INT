const mongoose = require("mongoose");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const PosSale = require("../models/PosSale");
const Customer = require("../models/Customer");
const StockHistory = require("../models/StockHistory");

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeMoney = (value) => Math.max(0, Number(value) || 0);

const generateNextSaleNumber = async () => {
  const sales = await PosSale.find({ sale_number: { $regex: /^POS-\d+$/ } }).select("sale_number").lean();
  let max = 0;
  for (const sale of sales) {
    const match = String(sale.sale_number || "").match(/^(?:POS-)(\d+)$/);
    const value = match ? Number(match[1]) : 0;
    if (Number.isFinite(value) && value > max) max = value;
  }
  return `POS-${String(max + 1).padStart(5, "0")}`;
};

const getPosProducts = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const category = String(req.query.category || "").trim();
    const brand = String(req.query.brand || "").trim();
    const stock = String(req.query.stock || "").trim();
    const sort = String(req.query.sort || "recent").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(30, Math.max(1, Number(req.query.limit) || 30));
    const productQuery = { is_deleted: { $ne: true }, status: "active" };
    const products = await Product.find(productQuery)
      .populate("category_id", "name")
      .populate("brand_id", "name")
      .sort({ created_at: -1 })
      .lean();

    const productIds = products.map((product) => product._id);
    const searchRegex = search ? new RegExp(escapeRegex(search), "i") : null;
    const categories = Array.from(new Set(products.map((product) => product?.category_id?.name).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
    const brands = Array.from(new Set(products.map((product) => product?.brand_id?.name).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
    const productById = new Map(products.map((product) => [String(product._id), product]));
    const variants = await Variant.find({ status: "active", product_id: { $in: productIds } })
      .sort({ created_at: -1 })
      .lean();
    const searchText = search.toLowerCase();
    const matchingVariants = variants.filter((variant) => {
      const product = productById.get(String(variant.product_id));
      if (!product) return false;
      const productCategory = product?.category_id?.name || "";
      const productBrand = product?.brand_id?.name || "";
      if (category && productCategory.toLowerCase() !== category.toLowerCase()) return false;
      if (brand && productBrand.toLowerCase() !== brand.toLowerCase()) return false;

      const quantity = Number(variant.quantity) || 0;
      if (stock === "in_stock" && quantity <= 0) return false;
      if (stock === "out_of_stock" && quantity > 0) return false;
      if (stock === "low_stock" && !(quantity > 0 && quantity <= (Number(variant.min_qnt) || 0))) return false;

      if (!search) return true;
      const productMatches = `${product.name || ""} ${productCategory} ${productBrand}`.toLowerCase().includes(searchText);
      return productMatches || searchRegex.test(`${variant.sku || ""} ${variant.title || ""}`);
    });

    if (sort === "name") {
      matchingVariants.sort((a, b) => {
        const productNameOrder = (productById.get(String(a.product_id))?.name || "")
          .localeCompare(productById.get(String(b.product_id))?.name || "");
        return productNameOrder || String(a.title || "").localeCompare(String(b.title || ""));
      });
    } else if (sort === "price_asc" || sort === "price_desc") {
      const direction = sort === "price_asc" ? 1 : -1;
      matchingVariants.sort((a, b) => ((Number(a.selling_price) || 0) - (Number(b.selling_price) || 0)) * direction);
    }

    const total = matchingVariants.length;
    const startIndex = (page - 1) * limit;
    const pageVariants = matchingVariants.slice(startIndex, startIndex + limit);
    const productsByPage = new Map();
    for (const variant of pageVariants) {
      const product = productById.get(String(variant.product_id));
      const productKey = String(product._id);
      if (!productsByPage.has(productKey)) {
        productsByPage.set(productKey, {
          _id: product._id,
          name: product.name,
          translations: product.translations,
          status: product.status,
          tax: Number(product.tax) || 0,
          category_name: product?.category_id?.name || "",
          brand_name: product?.brand_id?.name || "",
          product_image: variant.images?.[0]?.img_url || "",
          variants: [],
        });
      }
      productsByPage.get(productKey).variants.push({
        _id: variant._id,
        product_id: product._id,
        sku: variant.sku || "",
        title: variant.title || "Default",
        selling_price: Number(variant.selling_price) || 0,
        quantity: Number(variant.quantity) || 0,
        status: variant.status || "active",
        attributes: variant.attributes || {},
        images: variant.images || [],
      });
    }
    const output = Array.from(productsByPage.values());

    res.status(200).json({
      success: true,
      data: output,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit) || 1),
      },
      filters: { categories, brands },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPosSales = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || "").trim();

    const filter = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ sale_number: regex }, { "customer_snapshot.name": regex }, { "customer_snapshot.phone": regex }];
    }

    const total = await PosSale.countDocuments(filter);
    const sales = await PosSale.find(filter)
      .populate("customer_id", "name phone email")
      .populate("cashier_id", "name email")
      .populate("items.product_id", "name translations")
      .sort({ created_at: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.status(200).json({ success: true, data: sales, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPosSaleById = async (req, res) => {
  try {
    const sale = await PosSale.findById(req.params.id)
      .populate("customer_id", "name phone email address notes")
      .populate("cashier_id", "name email")
      .populate("items.product_id", "name translations")
      .populate("items.variant_id", "images")
      .lean();
    if (!sale) return res.status(404).json({ success: false, message: "Sale not found" });
    res.status(200).json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const returnPosSaleItems = async (req, res) => {
  const stockChanges = [];
  let insertedHistory = false;
  let saleId = null;
  let returnRecordId = null;
  let historyExplanation = "";
  try {
    const { items = [], note = "" } = req.body || {};
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid POS sale id" });
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ success: false, message: "Select at least one item to return" });
    const reason = String(note || "").trim();
    if (!reason) return res.status(400).json({ success: false, message: "A return reason is required" });
    if (reason.length > 300) return res.status(400).json({ success: false, message: "Return reason must be 300 characters or fewer" });
    const sale = await PosSale.findById(req.params.id);
    if (!sale || sale.status !== "completed") return res.status(404).json({ success: false, message: "Completed sale not found" });
    saleId = sale._id;
    const returnedSoFar = new Map();
    for (const ret of sale.returns || []) for (const line of ret.items || []) {
      const id = String(line.variant_id);
      returnedSoFar.set(id, (returnedSoFar.get(id) || 0) + Number(line.quantity || 0));
    }
    const returnLines = [];
    let refundTotal = 0;
    const taxInclusiveItemsTotal = sale.items.reduce((sum, line) => sum + (Number(line.line_total) || 0) * (1 + (Number(line.tax_rate) || 0) / 100), 0);
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
      const gross = Number(original.line_total) * (1 + (Number(original.tax_rate) || 0) / 100);
      const allocatedSaleDiscount = taxInclusiveItemsTotal > 0 ? saleLevelDiscount * (gross / taxInclusiveItemsTotal) : 0;
      const refund = Math.round(Math.max(0, gross - allocatedSaleDiscount) / original.quantity * quantity);
      refundTotal += refund;
      returnLines.push({ variant_id: original.variant_id, product_name: original.product_name, sku: original.sku, variant_title: original.variant_title, quantity, refund_amount: refund });
    }
    const historyRows = [];
    returnRecordId = new mongoose.Types.ObjectId();
    historyExplanation = `Return ${returnRecordId} for ${sale.sale_number}: ${reason}`;
    for (const line of returnLines) {
      const variant = await Variant.findOneAndUpdate({ _id: line.variant_id }, { $inc: { quantity: line.quantity } }, { returnDocument: "after" });
      if (!variant) throw new Error(`Could not restore stock for ${line.product_name}`);
      stockChanges.push({ variant_id: line.variant_id, quantity: line.quantity });
      historyRows.push({ variant_id: line.variant_id, product_id: sale.items.find((item) => String(item.variant_id) === String(line.variant_id))?.product_id, product_name: line.product_name, sku: line.sku, variant_title: line.variant_title, previous_quantity: variant.quantity - line.quantity, new_quantity: variant.quantity, change_quantity: line.quantity, adjustment_type: "add", reason: "POS sale return", explanation: historyExplanation, performed_by: req.user?._id || null, performed_by_name: req.user?.name || "Administrator" });
    }
    await StockHistory.insertMany(historyRows);
    insertedHistory = true;
    sale.returns.push({ _id: returnRecordId, returned_by: req.user?._id || null, returned_by_name: req.user?.name || "Administrator", reason, refund_method: "cash", refund_total: refundTotal, items: returnLines });
    await sale.save();
    return res.status(201).json({ success: true, data: { sale, refund_total: refundTotal } });
  } catch (error) {
    if (insertedHistory) await StockHistory.deleteMany({ reason: "POS sale return", explanation: historyExplanation }).catch(() => {});
    if (returnRecordId && saleId) await PosSale.updateOne({ _id: saleId }, { $pull: { returns: { _id: returnRecordId } } }).catch(() => {});
    for (const change of stockChanges.reverse()) await Variant.updateOne({ _id: change.variant_id }, { $inc: { quantity: -change.quantity } }).catch(() => {});
    return res.status(400).json({ success: false, message: error.message || "Unable to return POS sale items" });
  }
};

const savePosSale = async (req, res, existingSale = null) => {
  try {
    const { customer_id, customer_name, customer_phone, customer_email, customer_address, notes, payment_method = "cash", amount_received = 0, reference = "", items = [] } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one sale item is required" });
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
    let discountAmount = normalizeMoney(req.body.discount_amount || 0);
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

      const grossLineTotal = unitPrice * quantity;
      const percentageDiscount = grossLineTotal * (discountRate / 100);
      const flatDiscountPerUnit = Number(item.flat_discount ?? 0);
      if (!Number.isFinite(flatDiscountPerUnit) || flatDiscountPerUnit < 0) {
        throw new Error("Flat item discount must be a non-negative amount");
      }
      const cappedFlatDiscountPerUnit = Math.min(flatDiscountPerUnit, Math.max(0, unitPrice * (1 - discountRate / 100)));
      const flatDiscountTotal = cappedFlatDiscountPerUnit * quantity;
      const itemDiscount = percentageDiscount + flatDiscountTotal;
      const lineTotal = grossLineTotal - itemDiscount;
      subtotal += grossLineTotal;
      itemDiscountTotal += itemDiscount;
      const itemTax = lineTotal * (taxRate / 100);
      taxAmount += itemTax;

      normalizedItems.push({
        product_id: product._id,
        variant_id: variant._id,
        product_name: product.name,
        sku: variant.sku || "",
        variant_title: variant.title || "",
        product_image: variant.images?.[0]?.img_url || "",
        unit_price: unitPrice,
        quantity,
        line_total: lineTotal,
        discount_rate: discountRate,
        flat_discount: cappedFlatDiscountPerUnit,
        tax_rate: taxRate,
        discount_amount: itemDiscount,
      });
    }

    const requestedQuantities = new Map();
    for (const line of normalizedItems) {
      const variantId = String(line.variant_id);
      requestedQuantities.set(variantId, (requestedQuantities.get(variantId) || 0) + line.quantity);
    }
    for (const [variantId, quantity] of requestedQuantities) {
      const stock = availableStock.get(variantId) || 0;
      const creditedSaleQuantity = originalQuantities.get(variantId) || 0;
      if (stock + creditedSaleQuantity < quantity) {
        const line = normalizedItems.find((item) => String(item.variant_id) === variantId);
        throw new Error(`Insufficient stock for ${line?.product_name || "selected item"} (${line?.variant_title || line?.sku}). Only ${stock + creditedSaleQuantity} available.`);
      }
    }

    const finalSubtotal = Math.round(subtotal);
    const finalTax = Math.round(taxAmount);
    const finalDiscount = Math.min(itemDiscountTotal + discountAmount, finalSubtotal + finalTax);
    const total = Math.max(0, Math.round(finalSubtotal + finalTax - finalDiscount));

    let paymentMethod = String(payment_method || "cash").toLowerCase();
    if (!["cash", "card", "mobile_wallet", "bank_transfer"].includes(paymentMethod)) {
      paymentMethod = "cash";
    }
    if (["card", "bank_transfer"].includes(paymentMethod) && !String(reference || "").trim()) {
      return res.status(400).json({ success: false, message: "Transaction ID is required for card or bank payments" });
    }

    const amountReceived = normalizeMoney(amount_received);
    let changeDue = 0;
    if (paymentMethod === "cash") {
      if (amountReceived < total) {
        return res.status(400).json({ success: false, message: "Cash received is less than the total payable amount" });
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
    const saleData = {
      sale_number: saleNumber,
      customer_id: customer?._id || null,
      customer_snapshot: customerSnapshot,
      cashier_id: originalSale?.cashier_id || req.user?._id || null,
      cashier_name: originalSale?.cashier_name || req.user?.name || "Administrator",
      items: normalizedItems,
      subtotal: finalSubtotal,
      discount_amount: finalDiscount,
      tax_amount: finalTax,
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

    // This deployment is a standalone MongoDB server, so multi-document
    // transactions are unavailable. Use atomic stock decrements and compensate
    // completed writes if any later step fails.
    const stockChanges = [];
    const historyRows = [];
    const saleId = existingSale?._id || new mongoose.Types.ObjectId();
    let saleWriteAttempted = false;
    const historyReason = originalSale ? "POS sale edit" : "POS sale";
    const historyExplanation = originalSale ? `POS sale edit ${saleNumber}` : `POS sale ${saleNumber}`;

    try {
      const affectedVariantIds = new Set([...originalQuantities.keys(), ...requestedQuantities.keys()]);
      for (const variantId of affectedVariantIds) {
        const previousSold = originalQuantities.get(variantId) || 0;
        const nextSold = requestedQuantities.get(variantId) || 0;
        const stockChange = previousSold - nextSold;
        if (!stockChange) continue;

        const line = normalizedItems.find((item) => String(item.variant_id) === variantId)
          || (originalSale?.items || []).find((item) => String(item.variant_id?._id || item.variant_id) === variantId);
        const updated = stockChange < 0
          ? await Variant.findOneAndUpdate(
            { _id: variantId, quantity: { $gte: Math.abs(stockChange) } },
            { $inc: { quantity: stockChange } },
            { returnDocument: "after" },
          )
          : await Variant.findOneAndUpdate(
            { _id: variantId },
            { $inc: { quantity: stockChange } },
            { returnDocument: "after" },
          );
        if (!updated) throw new Error(`Stock changed while saving ${line?.product_name || "this sale"}. Please retry.`);

        stockChanges.push({ variant_id: variantId, quantity: stockChange });
        historyRows.push({
          variant_id: variantId,
          product_id: line?.product_id,
          product_name: line?.product_name || "",
          sku: line?.sku || "",
          variant_title: line?.variant_title || "",
          previous_quantity: (Number(updated.quantity) || 0) - stockChange,
          new_quantity: Number(updated.quantity) || 0,
          change_quantity: stockChange,
          adjustment_type: stockChange > 0 ? "add" : "remove",
          reason: historyReason,
          explanation: historyExplanation,
          performed_by: req.user?._id || null,
          performed_by_name: req.user?.name || "Administrator",
        });
      }

      saleWriteAttempted = true;
      const savedSale = existingSale
        ? await PosSale.findByIdAndUpdate(saleId, { $set: saleData }, { new: true, runValidators: true })
        : await PosSale.create({ ...saleData, _id: saleId });
      if (!savedSale) throw new Error("Sale could not be saved.");
      if (historyRows.length) await StockHistory.insertMany(historyRows);
      return res.status(existingSale ? 200 : 201).json({ success: true, data: savedSale });
    } catch (error) {
      const rollbackErrors = [];
      if (saleWriteAttempted) {
        try {
          if (originalSale) {
            const restore = { ...originalSale };
            delete restore._id;
            delete restore.created_at;
            delete restore.updated_at;
            await PosSale.findByIdAndUpdate(saleId, { $set: restore }, { runValidators: false });
          } else {
            await PosSale.deleteOne({ _id: saleId });
          }
        } catch (rollbackError) { rollbackErrors.push(rollbackError); }
      }
      if (historyRows.length) {
        try {
          await StockHistory.deleteMany({ reason: historyReason, explanation: historyExplanation });
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      for (const change of stockChanges.reverse()) {
        try {
          await Variant.updateOne({ _id: change.variant_id }, { $inc: { quantity: -change.quantity } });
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (rollbackErrors.length) {
        return res.status(500).json({ success: false, message: `${error.message || "Sale failed"}. Some rollback steps also failed; check stock history for POS ${saleNumber}.` });
      }
      throw error;
    }
  } catch (error) {
    res.status(400).json({ success: false, message: error.message || "Unable to save POS sale" });
  }
};

const createPosSale = (req, res) => savePosSale(req, res);

const updatePosSale = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid POS sale id" });
    }
    const sale = await PosSale.findById(req.params.id);
    if (!sale) return res.status(404).json({ success: false, message: "Sale not found" });
    return savePosSale(req, res, sale);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Unable to update POS sale" });
  }
};

const getCustomerPosHistory = async (req, res) => {
  try {
    const customerId = req.params.customerId;
    const sales = await PosSale.find({ customer_id: customerId }).sort({ created_at: -1 }).lean();
    const totalSpent = sales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
    res.status(200).json({ success: true, data: { sales, total_spent: totalSpent, total_sales: sales.length } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPosProducts,
  getPosSales,
  getPosSaleById,
  returnPosSaleItems,
  createPosSale,
  updatePosSale,
  getCustomerPosHistory,
};
