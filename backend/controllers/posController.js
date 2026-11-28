const mongoose = require("mongoose");
const { withTx } = require("../utils/tx"); // POS sale / return transactions
const { nextSeq, peekSeq, formatNumber, maxNumericSuffix } = require("../utils/counter"); // atomic per-store numbers
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const PosSale = require("../models/PosSale");
const Customer = require("../models/Customer");
const StockHistory = require("../models/StockHistory");
const { escapeRegex } = require("../utils/escapeRegex");
const { recordReturn } = require("../services/posService"); // POS return core (§4.2)
const stock = require("../services/stock");
const payments = require("../services/payments");
const { toMinor } = require("../utils/money");
const { normalizeMethod: normalizePayMethod } = require("../config/paymentMethods");

const supportedLocales = new Set(["en", "ur", "ar", "es", "fr", "de", "hi", "zh", "pt", "tr"]);
const getLocale = (value) => supportedLocales.has(String(value || "").toLowerCase()) ? String(value).toLowerCase() : "en";
const getLocalizedName = (translations, locale) => {
  const names = translations?.name;
  return names instanceof Map ? names.get(locale) : names?.[locale];
};
const localizeProduct = (product, locale) => {
  if (!product || typeof product !== "object") return product;
  const translatedName = getLocalizedName(product.translations, locale);
  return {
    ...product,
    ...(translatedName ? { translations: { name: { [locale]: translatedName } } } : { translations: undefined }),
  };
};

const normalizeMoney = (value) => Math.max(0, Number(value) || 0);

// Atomic counter (pehle har sale par saari sales scan)
const generateNextSaleNumber = async () =>
  formatNumber("POS-", await nextSeq("pos_sale", { seed: () => maxNumericSuffix(PosSale, "sale_number", /^POS-d+$/) }), 5);

const getPosProducts = async (req, res) => {
  try {
    const locale = getLocale(req.query.locale);
    const search = String(req.query.search || "").trim();
    const category = String(req.query.category || "").trim();
    const brand = String(req.query.brand || "").trim();
    const stock = String(req.query.stock || "").trim();
    const sort = String(req.query.sort || "recent").trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const SEARCH_CAP = 20;

    const Category = require("../models/Category");
    const Brand = require("../models/Brand");

    const [categoryNames, brandNames] = await Promise.all([
      Category.find({ is_deleted: { $ne: true }, is_active: { $ne: false } }).select("name").sort({ name: 1 }).limit(200).lean(),
      Brand.find({ is_deleted: false, is_active: { $ne: false } }).select("name").sort({ name: 1 }).limit(200).lean(),
    ]);
    const categories = categoryNames.map((c) => c.name).filter(Boolean);
    const brands = brandNames.map((b) => b.name).filter(Boolean);

    const activeProduct = { is_deleted: { $ne: true }, status: "active" };
    const productMatch = { ...activeProduct };
    if (category) {
      const catDoc = await Category.findOne({
        name: new RegExp(`^${escapeRegex(category)}$`, "i"),
        is_deleted: { $ne: true },
      }).select("_id").lean();
      if (!catDoc) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { total: 0, page: 1, limit, totalPages: 1 },
          filters: { categories, brands },
        });
      }
      productMatch.category_id = catDoc._id;
    }
    if (brand) {
      const brandDoc = await Brand.findOne({
        name: new RegExp(`^${escapeRegex(brand)}$`, "i"),
        is_deleted: false,
      }).select("_id").lean();
      if (!brandDoc) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { total: 0, page: 1, limit, totalPages: 1 },
          filters: { categories, brands },
        });
      }
      productMatch.brand_id = brandDoc._id;
    }

    let constrainedProductIds = null;
    if (search) {
      const escaped = escapeRegex(search);
      const prefix = new RegExp(`^${escaped}`, "i");
      const rx = new RegExp(escaped, "i");
      const [prodHits, varHits] = await Promise.all([
        Product.find({
          ...productMatch,
          $or: [
            { search_text: prefix },
            {
              $and: [
                { $or: [{ search_text: "" }, { search_text: { $exists: false } }, { search_text: null }] },
                { name: rx },
              ],
            },
          ],
        }).select("_id").limit(SEARCH_CAP).lean(),
        Variant.find({
          status: "active",
          is_deleted: { $ne: true },
          $or: [{ sku: rx }, { title: rx }],
        }).select("product_id").limit(SEARCH_CAP).lean(),
      ]);
      const idSet = new Set();
      for (const p of prodHits) idSet.add(String(p._id));
      for (const v of varHits) if (v.product_id) idSet.add(String(v.product_id));
      if (!idSet.size) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { total: 0, page: 1, limit, totalPages: 1 },
          filters: { categories, brands },
        });
      }
      constrainedProductIds = [...idSet].map((id) => new mongoose.Types.ObjectId(id));
    }

    const variantMatch = { status: "active", is_deleted: { $ne: true } };
    if (stock === "in_stock") variantMatch.quantity = { $gt: 0 };
    else if (stock === "out_of_stock") variantMatch.quantity = { $lte: 0 };
    else if (stock === "low_stock") {
      variantMatch.$expr = {
        $and: [
          { $gt: ["$quantity", 0] },
          { $lte: ["$quantity", { $ifNull: ["$min_qnt", 0] }] },
        ],
      };
    }

    const pipeline = [
      { $match: variantMatch },
      {
        $lookup: {
          from: Product.collection.name,
          localField: "product_id",
          foreignField: "_id",
          as: "p",
        },
      },
      { $unwind: "$p" },
      {
        $match: {
          "p.is_deleted": { $ne: true },
          "p.status": "active",
          ...(productMatch.category_id ? { "p.category_id": productMatch.category_id } : {}),
          ...(productMatch.brand_id ? { "p.brand_id": productMatch.brand_id } : {}),
          ...(constrainedProductIds ? { product_id: { $in: constrainedProductIds } } : {}),
        },
      },
    ];

    const sortStage =
      sort === "price_asc" || sort === "price_desc"
        ? { selling_price: sort === "price_asc" ? 1 : -1, _id: 1 }
        : sort === "name"
          ? { "p.name": 1, title: 1, _id: 1 }
          : { created_at: -1, _id: -1 };

    const skip = (page - 1) * limit;
    const [facet] = await Variant.aggregate([
      ...pipeline,
      {
        $facet: {
          total: [{ $count: "n" }],
          rows: [
            { $sort: sortStage },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                product_id: 1,
                sku: 1,
                title: 1,
                selling_price: 1,
                quantity: 1,
                status: 1,
                attributes: 1,
                images: 1,
                min_qnt: 1,
                translations: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = facet?.total?.[0]?.n || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const pageVariants = facet?.rows || [];
    const pageProductIds = [...new Set(pageVariants.map((v) => String(v.product_id)))];
    const products = pageProductIds.length
      ? await Product.find({ _id: { $in: pageProductIds } })
        .select("name translations status tax category_id brand_id")
        .populate("category_id", "name")
        .populate("brand_id", "name")
        .lean()
      : [];
    const productById = new Map(products.map((product) => [String(product._id), product]));

    const productsByPage = new Map();
    for (const variant of pageVariants) {
      const product = productById.get(String(variant.product_id));
      if (!product) continue;
      const productKey = String(product._id);
      if (!productsByPage.has(productKey)) {
        productsByPage.set(productKey, {
          _id: product._id,
          name: product.name,
          ...(locale === "en" ? {} : { translations: { name: getLocalizedName(product.translations, locale) ? { [locale]: getLocalizedName(product.translations, locale) } : {} } }),
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
        ...(locale === "en" ? {} : { translations: { title: getLocalizedName({ name: variant.translations?.title }, locale) ? { [locale]: getLocalizedName({ name: variant.translations?.title }, locale) } : {} } }),
        selling_price: Number(variant.selling_price) || 0,
        quantity: Number(variant.quantity) || 0,
        min_qnt: Number(variant.min_qnt) || 0,
        status: variant.status || "active",
        attributes: variant.attributes || {},
        images: variant.images || [],
      });
    }

    res.status(200).json({
      success: true,
      data: Array.from(productsByPage.values()),
      pagination: { total, page: safePage, limit, totalPages },
      filters: { categories, brands },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPosSales = async (req, res) => {
  try {
    const locale = getLocale(req.query.locale);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || "").trim();
    const paymentMethod = String(req.query.paymentMethod || "").trim().toLowerCase();
    const status = String(req.query.status || "").trim().toLowerCase();
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;

    const filter = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ sale_number: regex }, { "customer_snapshot.name": regex }, { "customer_snapshot.phone": regex }];
      const numericSearch = Number(search.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(numericSearch) && numericSearch > 0) filter.$or.push({ total: numericSearch });
      const dateSearch = new Date(search);
      if (!Number.isNaN(dateSearch.getTime())) {
        const start = new Date(dateSearch);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        filter.$or.push({ created_at: { $gte: start, $lt: end } });
      }
    }
    if (["cash", "card", "mobile_wallet", "bank_transfer"].includes(paymentMethod)) filter["payment.method"] = paymentMethod;
    if (["completed", "cancelled"].includes(status)) filter.status = status;
    if ((dateFrom && !Number.isNaN(dateFrom.getTime())) || (dateTo && !Number.isNaN(dateTo.getTime()))) {
      filter.created_at = {};
      if (dateFrom && !Number.isNaN(dateFrom.getTime())) filter.created_at.$gte = dateFrom;
      if (dateTo && !Number.isNaN(dateTo.getTime())) filter.created_at.$lte = dateTo;
    }

    const total = await PosSale.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let todayCount = 0;
    let todayRevenue = 0;
    if (req.query.includeSummary === "true") {
      [todayCount, todayRevenue] = await Promise.all([
        PosSale.countDocuments({ created_at: { $gte: today } }),
        PosSale.aggregate([{ $match: { created_at: { $gte: today } } }, { $group: { _id: null, revenue: { $sum: "$total" } } }]).then((rows) => rows[0]?.revenue || 0),
      ]);
    }
    const sales = await PosSale.find(filter)
      .select("sale_number customer_id customer_snapshot cashier_id cashier_name created_by_name items.product_name items.quantity items.unit_price items.line_total items.product_image items.variant_title items.sku items.product_id items.variant_id subtotal discount_amount tax_amount additional_tax_rate total payment status created_at edit_history notes")
      .populate("customer_id", "name phone email")
      .populate("cashier_id", "name")
      .populate("items.product_id", "name")
      .populate("items.variant_id", "images.img_url quantity")
      .slice("edit_history", -1)
      .sort({ created_at: -1 })
      .skip((safePage - 1) * limit)
      .limit(limit)
      .lean();

    const data = sales.map((sale) => ({
      ...sale,
      edit_history: sale.edit_history || [],
      // UI previews ~4 line items on the list card (§9.3)
      items: (sale.items || []).slice(0, 4).map((item) => {
        const variant = item.variant_id && typeof item.variant_id === "object" ? item.variant_id : null;
        const productName = item.product_name || item.product_id?.name || "";
        return {
          product_name: productName,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          sku: item.sku,
          variant_title: item.variant_title,
          product_id: item.product_id
            ? { _id: item.product_id._id || item.product_id, name: item.product_id.name || productName }
            : null,
          product_image: item.product_image || variant?.images?.[0]?.img_url || "",
          available_stock: variant ? Number(variant.quantity) || 0 : 0,
          variant_id: variant?._id || item.variant_id,
        };
      }),
    }));

    res.status(200).json({ success: true, data, pagination: { total, page: safePage, limit, totalPages }, summary: { todayCount, todayRevenue } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPosSaleById = async (req, res) => {
  try {
    const locale = getLocale(req.query.locale);
    const sale = await PosSale.findById(req.params.id)
      .populate("customer_id", "name phone email address notes")
      .populate("cashier_id", "name email")
      .populate("items.product_id", "name translations")
      .populate("items.variant_id", "images")
      .lean();
    if (!sale) return res.status(404).json({ success: false, message: "Sale not found" });
    sale.items = (sale.items || []).map((item) => ({ ...item, product_id: localizeProduct(item.product_id, locale) }));
    res.status(200).json({ success: true, data: sale });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getPosReturns = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const search = String(req.query.search || "").trim();
    const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
    const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;
    const match = {};
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      match.$or = [
        { sale_number: regex }, { "customer_snapshot.name": regex }, { "customer_snapshot.phone": regex },
        { "returns.reason": regex }, { "returns.returned_by_name": regex },
        { "returns.items.product_name": regex }, { "returns.items.sku": regex }, { "returns.items.variant_title": regex },
      ];
      const amount = Number(search.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(amount) && amount > 0) match.$or.push({ "returns.refund_total": amount });
    }
    const returnDate = {};
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) returnDate.$gte = dateFrom;
    if (dateTo && !Number.isNaN(dateTo.getTime())) returnDate.$lte = dateTo;
    // ✅ Pehle document-level pre-$match (sirf wo sales jin mein returns hain) — poori collection unwind nahi hoti (§4.5).
    //    Ye superset hai; asal per-return filter unwind ke baad wahi rehta hai.
    const preMatch = { "returns.0": { $exists: true }, ...match };
    if (Object.keys(returnDate).length) preMatch["returns.returned_at"] = returnDate;
    const pipeline = [
      { $match: preMatch },
      { $unwind: "$returns" },
      ...(Object.keys(match).length ? [{ $match: match }] : []),
      ...(Object.keys(returnDate).length ? [{ $match: { "returns.returned_at": returnDate } }] : []),
    ];
    const rowStages = (pageNo) => [
      { $sort: { "returns.returned_at": -1, _id: 1 } },
      { $skip: (pageNo - 1) * limit },
      { $limit: limit },
      { $project: {
        _id: "$returns._id", returned_at: "$returns.returned_at", returned_by_name: "$returns.returned_by_name",
        reason: "$returns.reason", refund_method: "$returns.refund_method", refund_total: "$returns.refund_total", items: "$returns.items",
        _saleId: "$_id", _saleNumber: "$sale_number", _saleTotal: "$total", _salePayment: "$payment.method",
        _customer: "$customer_snapshot", _cashier: { $ifNull: ["$returns.returned_by_name", "$cashier_name"] },
      } },
    ];
    // Ek hi pass: rows + count + refund sum ($facet) — pehle 3 alag unwind pipelines the
    const [facetRow] = await PosSale.aggregate([
      ...pipeline,
      { $facet: {
        rows: rowStages(page),
        meta: [{ $group: { _id: null, total: { $sum: 1 }, totalRefunded: { $sum: "$returns.refund_total" } } }],
      } },
    ]);
    const total = facetRow?.meta?.[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    // Page range se bahar ho to clamp karke sirf rows dobara (kam hi hota hai)
    const rows = safePage === page
      ? (facetRow?.rows || [])
      : await PosSale.aggregate([...pipeline, ...rowStages(safePage)]);
    res.status(200).json({ success: true, data: rows, pagination: { total, page: safePage, limit, totalPages }, summary: { totalRefunded: facetRow?.meta?.[0]?.totalRefunded || 0 } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const returnPosSaleItems = async (req, res) => {
  // Core services/posService.js me (§4.2)
  const out = await recordReturn({ saleId: req.params.id, payload: req.body, user: req.user });
  return res.status(out.status).json(out.body);
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
    const additionalTaxRate = Number(req.body.additional_tax_rate ?? 0);
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
    taxAmount += Math.max(0, subtotal - itemDiscountTotal) * (additionalTaxRate / 100);
    const finalTax = Math.round(taxAmount);
    const finalDiscount = Math.min(itemDiscountTotal + discountAmount, finalSubtotal + finalTax);
    const total = Math.max(0, Math.round(finalSubtotal + finalTax - finalDiscount));

    const { normalizeMethod, isPaymentMethodCode } = require("../config/paymentMethods");
    let paymentMethod = normalizeMethod(payment_method || "cash");
    const posCodes = ["cash", "card", "mobile_wallet", "bank_transfer"];
    if (!isPaymentMethodCode(paymentMethod) || !posCodes.includes(paymentMethod)) {
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
    const editorName = String(req.user?.name || req.user?.username || req.user?.email || "Administrator").trim();
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
      cashier_id: originalSale?.cashier_id || req.user?._id || null,
      cashier_name: originalSale?.cashier_name || req.user?.name || "Administrator",
      created_by_id: originalSale?.created_by_id || (!originalSale ? req.user?._id || null : null),
      created_by_name: originalSale?.created_by_name || (!originalSale ? editorName : ""),
      edit_history: originalSale
        ? [...(Array.isArray(originalSale.edit_history) ? originalSale.edit_history : []), {
          edited_at: new Date(),
          edited_by_id: req.user?._id || null,
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
          actor: { id: req.user?._id || null, name: req.user?.name || "Administrator" },
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
          performed_by: req.user?._id || null,
          performed_by_name: req.user?.name || "Administrator",
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
            received_by: req.user?._id || null,
            idempotency_key: `pos_sale:${savedSale._id}:capture`,
          });
        }
      }
      return savedSale;
    });
    return res.status(existingSale ? 200 : 201).json({ success: true, data: savedSaleResult });
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

// GET /pos/summary — overview counters without loading sales rows (§9.3)
const getPosSummary = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayCount, todayRevenueAgg, totalCount] = await Promise.all([
      PosSale.countDocuments({ created_at: { $gte: today } }),
      PosSale.aggregate([
        { $match: { created_at: { $gte: today } } },
        { $group: { _id: null, revenue: { $sum: "$total" } } },
      ]),
      PosSale.countDocuments({}),
    ]);
    return res.status(200).json({
      success: true,
      data: {
        todayCount,
        todayRevenue: todayRevenueAgg[0]?.revenue || 0,
        totalCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getCustomerPosHistory = async (req, res) => {
  try {
    const { legacyCap } = require("../utils/legacyListCap");
    const customerId = req.params.customerId;
    const sales = await PosSale.find({ customer_id: customerId })
      .sort({ created_at: -1 })
      .limit(legacyCap(req.query.limit, 50))
      .lean();
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
  getPosReturns,
  returnPosSaleItems,
  createPosSale,
  updatePosSale,
  getPosSummary,
  getCustomerPosHistory,
};