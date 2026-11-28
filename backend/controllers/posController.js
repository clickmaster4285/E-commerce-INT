const mongoose = require("mongoose");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const PosSale = require("../models/PosSale");
const SaleReturn = require("../models/SaleReturn");
const { escapeRegex } = require("../utils/escapeRegex");
const { keysetFilter, encodeCursor } = require("../utils/keysetPaginate");
const { fromMinor } = require("../utils/money");
const asyncHandler = require("../utils/asyncHandler");
const { recordReturn, savePosSale: savePosSaleCore } = require("../services/posService"); // POS core (§4.2)

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
    // §4.4 keyset: ?cursor= with default created_at desc (page/skip still works)
    const cursorFilter = keysetFilter(req.query.cursor, "created_at");
    const findFilter = cursorFilter ? { $and: [filter, cursorFilter] } : filter;
    const sales = await PosSale.find(findFilter)
      .select("sale_number customer_id customer_snapshot cashier_id cashier_name created_by_name items.product_name items.quantity items.unit_price items.line_total items.product_image items.variant_title items.sku items.product_id items.variant_id subtotal discount_amount tax_amount additional_tax_rate total payment status created_at edit_history notes")
      .populate("customer_id", "name phone email")
      .populate("cashier_id", "name")
      .populate("items.product_id", "name")
      .populate("items.variant_id", "images.img_url quantity")
      .slice("edit_history", -1)
      .sort({ created_at: -1, _id: -1 })
      .skip(cursorFilter ? 0 : (safePage - 1) * limit)
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

    res.status(200).json({
      success: true,
      data,
      nextCursor: sales.length === limit ? encodeCursor(sales[sales.length - 1], "created_at") : null,
      pagination: { total, page: safePage, limit, totalPages },
      summary: { todayCount, todayRevenue },
    });
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

/** §4.5 — SaleReturn index pe page; PosSale join for UI shape (no PosSale $unwind). */
const getPosReturns = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const search = String(req.query.search || "").trim();
  const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : null;
  const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : null;

  const filter = { ref_type: "pos_sale" };
  if ((dateFrom && !Number.isNaN(dateFrom.getTime())) || (dateTo && !Number.isNaN(dateTo.getTime()))) {
    filter.at = {};
    if (dateFrom && !Number.isNaN(dateFrom.getTime())) filter.at.$gte = dateFrom;
    if (dateTo && !Number.isNaN(dateTo.getTime())) filter.at.$lte = dateTo;
  }
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    const matchedSales = await PosSale.find({
      $or: [
        { sale_number: regex },
        { "customer_snapshot.name": regex },
        { "customer_snapshot.phone": regex },
      ],
    }).select("_id").limit(200).lean();
    filter.$or = [
      { reason: regex },
      { ref_id: { $in: matchedSales.map((s) => s._id) } },
    ];
  }

  // Prefer SaleReturn ledger; fall back to embedded PosSale.returns for pre-ledger data
  const ledgerCount = await SaleReturn.countDocuments(filter);
  if (!ledgerCount && !search) {
    const preMatch = { "returns.0": { $exists: true } };
    if (filter.at) preMatch["returns.returned_at"] = filter.at;
    const [facetRow] = await PosSale.aggregate([
      { $match: preMatch },
      { $unwind: "$returns" },
      ...(filter.at ? [{ $match: { "returns.returned_at": filter.at } }] : []),
      { $facet: {
        rows: [
          { $sort: { "returns.returned_at": -1, _id: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: {
            _id: "$returns._id", returned_at: "$returns.returned_at", returned_by_name: "$returns.returned_by_name",
            reason: "$returns.reason", refund_method: "$returns.refund_method", refund_total: "$returns.refund_total", items: "$returns.items",
            _saleId: "$_id", _saleNumber: "$sale_number", _saleTotal: "$total", _salePayment: "$payment.method",
            _customer: "$customer_snapshot", _cashier: { $ifNull: ["$returns.returned_by_name", "$cashier_name"] },
          } },
        ],
        meta: [{ $group: { _id: null, total: { $sum: 1 }, totalRefunded: { $sum: "$returns.refund_total" } } }],
      } },
    ]);
    const total = facetRow?.meta?.[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return res.status(200).json({
      success: true,
      data: facetRow?.rows || [],
      pagination: { total, page: Math.min(page, totalPages), limit, totalPages },
      summary: { totalRefunded: facetRow?.meta?.[0]?.totalRefunded || 0 },
    });
  }

  const [total, refundAgg, docs] = await Promise.all([
    SaleReturn.countDocuments(filter),
    SaleReturn.aggregate([
      { $match: filter },
      { $unwind: { path: "$lines", preserveNullAndEmptyArrays: true } },
      { $group: { _id: null, totalRefunded: { $sum: "$lines.amount_minor" } } },
    ]),
    SaleReturn.find(filter).sort({ at: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const pageDocs = safePage === page
    ? docs
    : await SaleReturn.find(filter).sort({ at: -1, _id: -1 }).skip((safePage - 1) * limit).limit(limit).lean();

  const saleIdList = [...new Set(pageDocs.map((d) => String(d.ref_id)))];
  const sales = saleIdList.length
    ? await PosSale.find({ _id: { $in: saleIdList } })
      .select("sale_number customer_snapshot total payment cashier_name returns")
      .lean()
    : [];
  const saleMap = new Map(sales.map((s) => [String(s._id), s]));

  const rows = pageDocs.map((doc) => {
    const sale = saleMap.get(String(doc.ref_id));
    const embedded = (sale?.returns || []).find((r) => String(r._id) === String(doc._id));
    const refundTotal = embedded
      ? Number(embedded.refund_total) || 0
      : (doc.lines || []).reduce((sum, line) => sum + fromMinor(line.amount_minor || 0), 0);
    const items = embedded?.items || (doc.lines || []).map((line) => ({
      variant_id: line.variant_id,
      quantity: line.qty,
      refund_amount: fromMinor(line.amount_minor || 0),
      product_name: "",
      variant_title: "",
      sku: "",
    }));
    return {
      _id: doc._id,
      returned_at: doc.at || embedded?.returned_at,
      returned_by_name: embedded?.returned_by_name || "",
      reason: doc.reason || embedded?.reason || "",
      refund_method: embedded?.refund_method || doc.method || "cash",
      refund_total: refundTotal,
      items,
      _saleId: doc.ref_id,
      _saleNumber: sale?.sale_number || "",
      _saleTotal: sale?.total || 0,
      _salePayment: sale?.payment?.method || "cash",
      _customer: sale?.customer_snapshot || {},
      _cashier: embedded?.returned_by_name || sale?.cashier_name || "",
    };
  });

  res.status(200).json({
    success: true,
    data: rows,
    pagination: { total, page: safePage, limit, totalPages },
    summary: { totalRefunded: fromMinor(refundAgg[0]?.totalRefunded || 0) },
  });
});

const returnPosSaleItems = asyncHandler(async (req, res) => {
  const out = await recordReturn({ saleId: req.params.id, payload: req.body, user: req.user });
  return res.status(out.status).json(out.body);
});

const createPosSale = asyncHandler(async (req, res) => {
  const out = await savePosSaleCore({ body: req.body, user: req.user });
  return res.status(out.status).json(out.body);
});

const updatePosSale = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid POS sale id" });
  }
  const sale = await PosSale.findById(req.params.id);
  if (!sale) return res.status(404).json({ success: false, message: "Sale not found" });
  const out = await savePosSaleCore({ body: req.body, user: req.user, existingSale: sale });
  return res.status(out.status).json(out.body);
});

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