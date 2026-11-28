const Variant = require("../models/Variant");
const log = require("../utils/logger");
const Product = require("../models/Product");
const StockHistory = require("../models/StockHistory");
const { getIO } = require("../utils/socket");
const { emitSocketEvent } = require("../utils/emitSocketEvent");
const {
  pushGlobalActivity,
} = require("../utils/activityHelper");
const { withTx, TxAbort } = require("../utils/tx");
const stock = require("../services/stock");

const { escapeRegex } = require("../utils/escapeRegex");
const { refreshAsync: refreshProductSummary } = require("../services/productSummary");

const getRequestedLocale = (value) => {
  const locale = String(value || "en").trim().toLowerCase();
  return /^[a-z]{2}$/.test(locale) ? locale : "en";
};

// Keep only the active language in stock API payloads. English is the source
// value and is returned through the regular name/title fields.
const onlyLocaleTranslations = (translations, locale) => {
  if (locale === "en" || !translations || typeof translations !== "object") return {};
  return Object.fromEntries(
    Object.entries(translations).flatMap(([field, values]) => {
      const selected = values?.[locale];
      return typeof selected === "string" && selected.trim()
        ? [[field, { [locale]: selected }]]
        : [];
    })
  );
};

const getStockStatusExpression = (status) => {
  if (status === "out") return { $eq: ["$quantity", 0] };
  if (status === "low") {
    return { $and: [{ $gt: ["$quantity", 0] }, { $lte: ["$quantity", { $ifNull: ["$min_qnt", 0] }] }] };
  }
  if (status === "in") {
    return { $gt: ["$quantity", { $ifNull: ["$min_qnt", 0] }] };
  }
  return null;
};

const toStockItem = (variant, locale = "en") => {
  const product = variant.product_id && typeof variant.product_id === "object"
    ? variant.product_id
    : null;

  return {
    _id: variant._id,
    sku: variant.sku || "",
    title: variant.title || "",
    quantity: variant.quantity ?? 0,
    min_qnt: variant.min_qnt ?? 0,
    max_qnt: variant.max_qnt ?? 0,
    image: variant.images?.[0]?.img_url || "",
    product_id: product?._id || variant.product_id || null,
    translations: onlyLocaleTranslations(variant.translations, locale),
    product_name: product?.name || "Unknown Product",
    product_translations: onlyLocaleTranslations(product?.translations, locale),
    product_is_deleted: Boolean(product?.is_deleted),
    category_id: product?.category_id?._id || product?.category_id || null,
    // ✅ Fake labels ("Uncategorized" / "No brand") hataye — jab category/brand
    //    assign nahi hai to khaali bhejte hain aur frontend wo line chhupa deta hai.
    category_name: product?.category_id?.name || "",
    category_translations: onlyLocaleTranslations(product?.category_id?.translations, locale),
    brand_id: product?.brand_id?._id || product?.brand_id || null,
    brand_name: product?.brand_id?.name || "",
    brand_translations: onlyLocaleTranslations(product?.brand_id?.translations, locale),
    brand_logo: product?.brand_id?.logo?.img_url || "",
  };
};

/* =========================================================
   GET STOCK OVERVIEW
   ✅ FIX: Sirf wo products show honge jin ka is_deleted = false
========================================================= */

const getStockOverview = async (req, res) => {
  try {
    const locale = getRequestedLocale(req.query.locale);
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 0;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const search = String(req.query.search || "").trim();
    const statusFilter = ["all", "in", "low", "out"].includes(String(req.query.status || "all"))
      ? String(req.query.status || "all")
      : "all";

    const baseMatch = { is_deleted: { $ne: true } };
    if (search) {
      const safeSearch = escapeRegex(search);
      const matchingProducts = await Product.find(
        {
          is_deleted: { $ne: true },
          $or: [
            { name: { $regex: safeSearch, $options: "i" } },
            { search_text: { $regex: `^${safeSearch}`, $options: "i" } },
          ],
        },
        "_id",
      ).lean();
      baseMatch.$or = [
        { sku: { $regex: safeSearch, $options: "i" } },
        { title: { $regex: safeSearch, $options: "i" } },
        { product_id: { $in: matchingProducts.map((product) => product._id) } },
      ];
    }

    const withStatus = (status) => {
      const expression = getStockStatusExpression(status);
      return expression ? { $expr: expression } : null;
    };

    const matchActiveProduct = [
    { $match: baseMatch },
    {
      $lookup: {
        from: Product.collection.name,
        localField: "product_id",
        foreignField: "_id",
        as: "_prod",
      },
    },
    { $match: { "_prod.0": { $exists: true }, "_prod.0.is_deleted": { $ne: true } } },
    { $project: { _prod: 0 } },
  ];

    const statusExprIn = getStockStatusExpression("in");
    const statusExprLow = getStockStatusExpression("low");
    const statusExprOut = getStockStatusExpression("out");

    const [facetRows] = await Variant.aggregate([
      ...matchActiveProduct,
      {
        $facet: {
          all: [{ $count: "n" }],
          in: statusExprIn ? [{ $match: { $expr: statusExprIn } }, { $count: "n" }] : [{ $count: "n" }],
          low: statusExprLow ? [{ $match: { $expr: statusExprLow } }, { $count: "n" }] : [{ $count: "n" }],
          out: statusExprOut ? [{ $match: { $expr: statusExprOut } }, { $count: "n" }] : [{ $count: "n" }],
          products: [{ $group: { _id: "$product_id" } }, { $count: "n" }],
          units: [{ $group: { _id: null, total: { $sum: { $ifNull: ["$quantity", 0] } } } }],
        },
      },
    ]);

    const pickN = (key) => {
      const row = facetRows?.[key]?.[0];
      if (!row) return 0;
      return row.n ?? row.total ?? 0;
    };
    const searchTotalVariants = pickN("all");
    const searchInStock = pickN("in");
    const searchLowStock = pickN("low");
    const searchOutOfStock = pickN("out");
    const searchProductCount = pickN("products");
    const searchUnits = pickN("units");

    const summary = {
      totalVariants: searchTotalVariants,
      totalProducts: searchProductCount,
      totalUnits: searchUnits,
      inStock: searchInStock,
      lowStock: searchLowStock,
      outOfStock: searchOutOfStock,
    };
    const counts = {
      all: searchTotalVariants,
      in: searchInStock,
      low: searchLowStock,
      out: searchOutOfStock,
    };

    const populateProduct = [{
      path: "product_id",
      select: "name translations is_deleted category_id brand_id",
      populate: [
        { path: "category_id", select: "name translations" },
        { path: "brand_id", select: "name translations logo" },
      ],
    }];
    const variantSelect = "sku title translations quantity min_qnt max_qnt product_id images";

    const listAggBase = [...matchActiveProduct];
    const statusExprList = withStatus(statusFilter);
    if (statusExprList) listAggBase.push({ $match: { $expr: statusExprList } });

  const fetchVariantsByAgg = async (pipeline) => {
      const idRows = await Variant.aggregate([...pipeline, { $project: { _id: 1 } }]);
      if (!idRows.length) return [];
      const order = new Map(idRows.map((r, i) => [String(r._id), i]));
      const docs = await Variant.find({ _id: { $in: idRows.map((r) => r._id) } })
        .populate(populateProduct)
        .select(variantSelect)
        .lean();
      docs.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));
      return docs;
    };

    // ---- LEGACY MODE (no limit) ----
    if (!limit) {
      const variants = await fetchVariantsByAgg([
        ...listAggBase,
        { $sort: { created_at: -1, _id: -1 } },
      ]);

      return res.status(200).json({
        success: true,
        data: variants.map((variant) => toStockItem(variant, locale)),
        summary,
        counts,
      });
    }

    // ---- PAGINATED MODE ----
    const [countRow] = await Variant.aggregate([...listAggBase, { $count: "n" }]);
    const totalItems = countRow?.n || 0;
    const pages = Math.max(1, Math.ceil(totalItems / limit));
    const safePage = Math.min(page, pages || 1);
    const skip = (safePage - 1) * limit;

    const variants = await fetchVariantsByAgg([
      ...listAggBase,
      { $sort: { created_at: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    return res.status(200).json({
      success: true,
      data: variants.map((variant) => toStockItem(variant, locale)),
      summary,
      counts,
      pagination: {
        total: totalItems,
        page: safePage,
        limit,
        pages,
        hasNext: safePage < pages,
        hasPrev: safePage > 1,
      },
    });
  } catch (error) {
    log.error("Get stock overview error:", error);
    res.status(500).json({
      message: error.message,
    });
  }
};

/* =========================================================
   ADJUST STOCK
   type: "add" | "remove" | "set"
========================================================= */

const adjustStock = async (req, res) => {
  try {
    const {
      variant_id,
      type,
      quantity,
      reason,
      explanation,
    } = req.body;

    // ✅ "Explanation" (adjust form ka notes) — pehle ye notes preset reason ke
    // sath save hi nahi hote the, is liye Stock History mein dikhte nahi the.
    // Ab frontend ise required bhejta hai, lekin backend par bhi safety check.
    const explanationText = String(explanation || "").trim();
    const reasonText = String(reason || "").trim();

    /* =====================================================
       VALIDATION
    ===================================================== */

    if (!variant_id) {
      return res.status(400).json({
        message: "Variant is required",
      });
    }

    if (
      !["add", "remove", "set"].includes(
        type
      )
    ) {
      return res.status(400).json({
        message:
          "Adjustment type must be add, remove or set",
      });
    }

    if (
      !Number.isInteger(Number(quantity)) ||
      Number(quantity) < 0
    ) {
      return res.status(400).json({
        message:
          "Quantity must be a valid non-negative whole number",
      });
    }

    const qty = Number(quantity);

    if (type !== "set" && qty === 0) {
      return res.status(400).json({
        message:
          "Quantity must be greater than 0 for add or remove",
      });
    }

    // ✅ "Explanation" ab required hai — jab tak admin justification na de,
    // adjustment accept nahi hota. ("Other" reason mein bhi wahi text
    // explanation ke tor par bheja jata hai, is liye har case cover hota hai.)
    if (!explanationText) {
      return res.status(400).json({
        message:
          "Explanation is required for stock adjustment",
      });
    }

    const variant = await Variant.findOne({
      _id: variant_id,
      is_deleted: { $ne: true },
    }).populate({
      path: "product_id",
      select: "name is_deleted",
      // ✅ Deleted product ka stock adjust nahi ho sakta
      match: { is_deleted: { $ne: true } },
    });

    if (!variant || !variant.product_id) {
      return res.status(404).json({
        message: "Variant not found",
      });
    }

    const performerName = req.user?.name || "Admin";
    const performerId = req.user?._id || null;
    const productId = variant.product_id?._id || variant.product_id || null;
    const productName = variant.product_id?.name || "";
    const sku = variant.sku || "";
    const variantTitle = variant.title || "";
    const previousSnapshot = variant.quantity ?? 0;

    // services/stock.js — stock_levels + movements + Variant dual-write (§3.9 / §4.1)
    let history;
    let previousQuantity;
    let newQuantity;
    let stockTouched = null;
    try {
      ({ result: { history, previousQuantity, newQuantity } } = await withTx(async () => {
        stockTouched = null;
        const input =
          type === "set"
            ? { setTo: qty, kind: "count_set" }
            : type === "add"
              ? { qty_delta: qty, kind: "adjust_add" }
              : { qty_delta: -qty, kind: "adjust_remove" };

        const result = await stock.adjust({
          variant_id: variant._id,
          ...input,
          reason: reasonText,
          explanation: explanationText,
          actor: { id: performerId, name: performerName },
          ref_type: "manual_adjust",
        });
        if (!result.ok) {
          throw new TxAbort(result.status || 400, {
            message:
              result.message ||
              (type === "remove"
                ? `Cannot remove ${qty} units. Only ${previousSnapshot} in stock.`
                : "Stock adjust failed"),
          });
        }

        const next = result.on_hand ?? previousSnapshot;
        const prev =
          type === "set"
            ? previousSnapshot
            : type === "add"
              ? next - qty
              : next + qty;
        stockTouched = { variant_id: variant._id, from: prev, to: next };

        const [row] = await StockHistory.create([{
          variant_id: variant._id,
          product_id: productId,
          product_name: productName,
          sku,
          variant_title: variantTitle,
          previous_quantity: prev,
          new_quantity: next,
          change_quantity: next - prev,
          adjustment_type: type,
          reason: reasonText,
          explanation: explanationText,
          performed_by: performerId,
          performed_by_name: performerName,
        }]);
        return { history: row, previousQuantity: prev, newQuantity: next };
      }));
    } catch (txError) {
      if (txError instanceof TxAbort) return res.status(txError.status).json(txError.body);
      throw txError;
    }

    variant.quantity = newQuantity;

    /* =====================================================
       ACTIVITY LOG
    ===================================================== */

    let io = req.io || null;
    try { io = io || getIO(); } catch { /* tests / pre-listen */ }
    await pushGlobalActivity(
      io,
      {
        action: `${performerName} adjusted stock for "${variant.product_id?.name || "Unknown Product"} - ${variant.title}" (${type} ${qty})`,
        category: "Stock Management",
        performedBy: performerId,
        performedByName: performerName,
        details: {
          variantId: variant._id,
          sku: variant.sku,
          previousQuantity,
          newQuantity,
          adjustmentType: type,
          reason: reasonText,
          explanation: explanationText,
        },
      },
      performerId
    );

    /* =====================================================
       SOCKET — realtime sync for all browsers
    ===================================================== */

    emitSocketEvent("stockAdjusted", history);

    emitSocketEvent("stockUpdated", {
      variantId: variant._id,

      productId:
        variant.product_id?._id ||
        variant.product_id ||
        null,

      quantity: newQuantity,
    });

    refreshProductSummary(productId);

    res.status(200).json({
      success: true,

      message:
        "Stock adjusted successfully",

      item: {
        _id: variant._id,

        sku: variant.sku,

        title: variant.title,

        quantity: variant.quantity,

        min_qnt: variant.min_qnt,

        max_qnt: variant.max_qnt,

        product_id:
          variant.product_id?._id || null,

        product_name:
          variant.product_id?.name || "",
      },

      history,
    });
  } catch (error) {
    log.error(
      "Adjust stock error:",
      error
    );

    res.status(400).json({
      success: false,

      message: error.message,
    });
  }
};

/* =========================================================
   GET STOCK HISTORY
========================================================= */

const getStockHistory = async (req, res) => {
  try {
    const locale = getRequestedLocale(req.query.locale);
    const filter = {};
    if (req.query.variant_id) {
      filter.variant_id = req.query.variant_id;
    }

    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 0; // 0 = legacy mode
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);

    // ---- LEGACY MODE (no limit) -> exact old behavior ----
    if (!limit) {
      const history = await StockHistory.find(filter)
        .select("-__v")
        .sort({ created_at: -1, _id: -1 })
        .limit(500)
        .lean();
      return res.status(200).json(history.map((entry) => ({
        ...entry,
        translations: onlyLocaleTranslations(entry.translations, locale),
      })));
    }

    // ---- PAGINATED MODE ----
    const total = await StockHistory.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages || 1);
    const skip = (safePage - 1) * limit;

    const history = await StockHistory.find(filter)
      .select("-__v")
      .sort({ created_at: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data: history.map((entry) => ({
        ...entry,
        translations: onlyLocaleTranslations(entry.translations, locale),
      })),
      pagination: {
        total,
        page: safePage,
        limit,
        pages,
        hasNext: safePage < pages,
        hasPrev: safePage > 1,
      },
    });
  } catch (error) {
    log.error("Get stock history error:", error);
    res.status(500).json({
      message: error.message,
    });
  }
};

module.exports = {
  getStockOverview,
  adjustStock,
  getStockHistory,
};
