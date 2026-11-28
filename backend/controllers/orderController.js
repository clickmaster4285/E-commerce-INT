const mongoose = require("mongoose");
const { roundMoney } = require("../utils/roundMoney");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Address = require("../models/Address");
const log = require("../utils/logger");
const { statusCounts, sumCounts } = require("../utils/statusCounts");
const { keysetFilter, encodeCursor } = require("../utils/keysetPaginate");
const { withTx, TxAbort } = require("../utils/tx"); // one transaction per checkout

// placeOrder ka core + socket emit helpers services/orderService.js me hain (§4.2)
const { placeOrderCore, emitOrderEvent, emitStockEvent } = require("../services/orderService");

/// ==========================================
// POST /api/orders — Place Order
// ✅ FIXED: Trust frontend snapshot, no re-calculation
// ==========================================
const placeOrder = async (req, res) => {
  try {
    const out = await placeOrderCore({
      body: req.body,
      user: req.user,
      store: req.store,
      idempotencyHeader: req.get("Idempotency-Key"),
    });
    res.status(out.status).json(out.body);
  } catch (error) {
    log.error("❌ [placeOrder] Error:", error);
    res.status(500).json({ success: false, message: "Could not place your order. Please try again." });
  }
};

// ==========================================
// GET /api/orders/my/summary — account stats (counts only, §9.2)
const getMyOrdersSummary = async (req, res) => {
  try {
    const rows = await Order.aggregate([
      { $match: { user_id: req.user._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const byStatus = {};
    let total = 0;
    for (const row of rows) {
      byStatus[row._id] = row.count;
      total += row.count;
    }
    const active = total
      - (byStatus.delivered || 0)
      - (byStatus.cancelled || 0);
    return res.status(200).json({
      success: true,
      data: { total, active, byStatus },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/orders/my — Meri orders (optional server-side pagination)
// ✅ Non-breaking: agar ?limit= nahi bheja to purana full-array response
// ==========================================
const getMyOrders = async (req, res) => {
  try {
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 0; // 0 = legacy mode
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const status = String(req.query.status || "all").trim();
    const search = String(req.query.search || "").trim();
    const sort = String(req.query.sort || "newest");
    const timeRange = String(req.query.timeRange || "all");

    const filter = { user_id: req.user._id };

    // Status filter
    if (status && status !== "all" && status !== "draft") {
      filter.status = status;
    }

    // Search filter
    if (search) {
      const rx = { $regex: search, $options: "i" };
      filter.$or = [
        { order_number: rx },
        { "items.name": rx },
      ];
    }

    // Time range filter
    if (timeRange && timeRange !== "all") {
      const days = Number(timeRange);
      if (Number.isFinite(days) && days > 0) {
        const cutoff = new Date(Date.now() - days * 86400000);
        filter.created_at = { $gte: cutoff };
      }
    }

    // ---- LEGACY MODE (no limit) → hard-capped (§4.5) ----
    if (!limit) {
      const { legacyCap } = require("../utils/legacyListCap");
      let query = Order.find(filter).limit(legacyCap(0, 50));
      if (sort === "oldest") query = query.sort({ created_at: 1 });
      else if (sort === "total_high") query = query.sort({ total: -1 });
      else if (sort === "total_low") query = query.sort({ total: 1 });
      else query = query.sort({ created_at: -1 });

      const orders = await query.lean();
      return res.status(200).json({ success: true, data: orders });
    }

    // ---- PAGINATED MODE ----
    const total = await Order.countDocuments(filter);
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages || 1);
    const skip = (safePage - 1) * limit;

    let query = Order.find(filter);
    // Sort
    if (sort === "oldest") query = query.sort({ created_at: 1 });
    else if (sort === "total_high") query = query.sort({ total: -1 });
    else if (sort === "total_low") query = query.sort({ total: 1 });
    else query = query.sort({ created_at: -1 }); // newest (default)

    const orders = await query.skip(skip).limit(limit).lean();

    // Status counts (for filter chips)
    const counts = await Order.aggregate([
      { $match: { user_id: req.user._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const statusCounts = {};
    counts.forEach((c) => { statusCounts[c._id] = c.count; });
    const totalOrders = counts.reduce((s, c) => s + c.count, 0);

    return res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: safePage,
        limit,
        pages,
        hasNext: safePage < pages,
        hasPrev: safePage > 1,
      },
      counts: statusCounts,
      totalOrders,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// GET /api/orders/:id — Order detail (sirf apni)
// ==========================================
const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user_id: req.user._id }).lean();
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// ✅ FIX: Search text ko safe regex banane ke liye — warna ".", "[", "(" jaise
//    special characters query ko bigaad dete hain (ya crash/slow kar dete hain).
const { escapeRegex } = require("../utils/escapeRegex");

// ==========================================
// ✅ SHARED ADMIN ORDER FILTER
//    List + summary dono isi builder se filters lete hain — is liye
//    product filter ke saath status/payment/shipping/time/search
//    hamesha ek jaise lagte hain.
// ==========================================
// ✅ Strict check — sirf 24-char hex ObjectId. Random/garbage ids gracefully reject hoti hain
//    (Types.ObjectId.isValid 12-char strings ko bhi "valid" maan leta hai).
const isValidProductId = (value) =>
  Boolean(value) && mongoose.isObjectIdOrHexString(String(value));

const buildAdminOrderFilter = ({
  status = "all",
  search = "",
  payment = "all",
  shipping = "all",
  dateRange = "all",
  productId = "",
} = {}) => {
  const query = {};

  if (status && status !== "all") {
    query.status = status;
  }

  // ✅ Payment / shipping ab bhi query me hain (pehle sirf frontend pe filter hote the)
  if (payment && payment !== "all") {
    query["payment.status"] = payment;
  }

  if (shipping && shipping !== "all") {
    query.shipping_method = shipping;
  }

  // ✅ Product filter — order match hoga agar KISI BHI line item ka product_id match kare.
  //    Invalid id par crash nahi hoga: query me kuch nahi jodenge (empty result).
  if (isValidProductId(productId)) {
    query["items.product_id"] = new mongoose.Types.ObjectId(String(productId));
  }

  if (dateRange && dateRange !== "all") {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (dateRange === "today") {
      query.created_at = { $gte: startOfToday };
    } else if (dateRange === "yesterday") {
      const y = new Date(startOfToday);
      y.setDate(y.getDate() - 1);
      query.created_at = { $gte: y, $lt: startOfToday };
    } else if (dateRange === "7d") {
      const c = new Date(startOfToday);
      c.setDate(c.getDate() - 7);
      query.created_at = { $gte: c };
    } else if (dateRange === "30d") {
      const c = new Date(startOfToday);
      c.setDate(c.getDate() - 30);
      query.created_at = { $gte: c };
    }
  }

  if (search && String(search).trim()) {
    // ✅ FIX: escaped regex — "." ya "[" jaise characters search ko break nahi karenge
    const rx = new RegExp(escapeRegex(String(search).trim()), "i");
    query.$or = [
      { order_number: rx },
      { "address_snapshot.full_name": rx },
      { "address_snapshot.phone": rx },
    ];
  }

  return query;
};

// ==========================================
// 🌐 LOCALE + SLIM HELPERS — admin orders (brand/banner admin lists ka pattern)
//    Response me sirf FRONT data: populated product/variant ki sirf selected
//    locale translation, aur internals (checkout_draft_id, address_id,
//    translation_source/status, __v) payload se bahar.
// ==========================================
const parseOrderLocale = (value) => {
  const requestedLocale = String(value || "en").trim().toLowerCase();
  return /^[a-z]{2}$/.test(requestedLocale) ? requestedLocale : "en";
};

// ✅ Populated ref ki translations sirf selected locale tak trim karo
const slimRefTranslations = (doc, field, locale) => {
  if (!doc || locale === "en") return null;
  const value = doc.translations?.[field]?.[locale];
  if (typeof value !== "string" || !value.trim()) return null;
  return { [field]: { [locale]: value } };
};

const slimOrderItem = (item, locale) => {
  if (!item) return item;
  return {
    ...item,
    ...(item.product_id && typeof item.product_id === "object"
      ? {
          product_id: {
            _id: item.product_id._id,
            name: item.product_id.name,
            ...(slimRefTranslations(item.product_id, "name", locale) && {
              translations: slimRefTranslations(item.product_id, "name", locale),
            }),
          },
        }
      : {}),
    ...(item.variant_id && typeof item.variant_id === "object"
      ? {
          variant_id: {
            _id: item.variant_id._id,
            title: item.variant_id.title,
            ...(slimRefTranslations(item.variant_id, "title", locale) && {
              translations: slimRefTranslations(item.variant_id, "title", locale),
            }),
          },
        }
      : {}),
  };
};

// ✅ Order ki notes/cancel_reason translations sirf selected locale ki
const slimOrderTranslations = (order, locale) => {
  if (locale === "en" || !order.translations) return null;
  const out = {};
  ["notes", "cancel_reason"].forEach((field) => {
    const value = order.translations?.[field]?.[locale];
    if (typeof value === "string" && value.trim()) out[field] = { [locale]: value };
  });
  return Object.keys(out).length ? out : {};
};

// ✅ List/detail rows me sirf wahi fields jate hain jo front par dikhte hain
//    (table + mobile card + expand preview + detail page). createdby jaise
//    internals + translation metadata response me leak nahi hoti.
const mapFrontOrder = (order, locale) => ({
  _id: order._id,
  order_number: order.order_number,
  user_id: order.user_id && typeof order.user_id === "object"
    ? { _id: order.user_id._id, name: order.user_id.name, email: order.user_id.email, phone: order.user_id.phone }
    : order.user_id ?? null,
  items: (order.items || []).map((item) => slimOrderItem(item, locale)),
  address_snapshot: order.address_snapshot,
  shipping_method: order.shipping_method,
  payment: { method: order.payment?.method, status: order.payment?.status },
  subtotal: order.subtotal,
  shipping: order.shipping,
  tax: order.tax,
  total: order.total,
  status: order.status,
  notes: order.notes ?? "",
  cancel_reason: order.cancel_reason ?? "",
  deal_ids: order.deal_ids,
  bundle_ids: order.bundle_ids,
  total_deal_savings: order.total_deal_savings,
  total_bundle_savings: order.total_bundle_savings,
  created_at: order.created_at,
  updated_at: order.updated_at,
  ...(slimOrderTranslations(order, locale) && { translations: slimOrderTranslations(order, locale) }),
});

// ✅ Server-side sorting whitelist — frontend sort key -> DB field
const ORDER_SORT_FIELDS = {
  order_number: "order_number",
  customer: "address_snapshot.full_name",
  total: "total",
  payment: "payment.method",
  status: "status",
  created_at: "created_at",
};

// GET /api/orders/admin/all — Get All Orders (Admin Only)
// ==========================================
const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const query = buildAdminOrderFilter(req.query);
    const locale = parseOrderLocale(req.query.locale);

    // ✅ Invalid productId -> koi crash nahi, empty result + explicit flag
    //    (frontend "No orders found for this product." empty state dikhata hai)
    if (req.query.productId && !isValidProductId(req.query.productId)) {
      return res.status(200).json({
        success: true,
        data: [],
        invalidProductId: true,
        counts: { total: 0, pending: 0, shipped: 0, delivered: 0, cancelled: 0 },
        pagination: { total: 0, page: 1, limit: Number(limit) || 15, pages: 1, totalPages: 1, hasNext: false, hasPrev: false },
      });
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 15));

    // ✅ Sorting bhi server par hoti hai (whitelist ke ilawa koi custom field nahi).
    //    Default: created_at desc (legacy jaisa) — ties par _id stable order.
    const sortKeyRaw = String(req.query.sort || "").trim();
    const hasSort = Boolean(ORDER_SORT_FIELDS[sortKeyRaw]);
    const sortField = hasSort ? ORDER_SORT_FIELDS[sortKeyRaw] : "created_at";
    const rawOrder = String(req.query.order || "").trim().toLowerCase();
    const sortOrder = hasSort ? (rawOrder === "asc" ? 1 : -1) : -1;

    const total = await Order.countDocuments(query);
    const pages = Math.max(1, Math.ceil(total / limitNum));
    const safePage = Math.min(pageNum, pages);

    // ✅ Stat card counts — pehle 5 alag count queries jaisa behaviour:
    //    sirf status + product filter, baaki filters counts me nahi lagte
    const countsQuery = buildAdminOrderFilter({ productId: req.query.productId });

    // ✅ Keyset pilot (§4.4): ?cursor= sirf default sort (created_at desc) par chalta hai;
    //    page/skip wala path waise hi rahta hai. Response mein extra `nextCursor` aata hai.
    const cursorFilter = !hasSort ? keysetFilter(req.query.cursor, "created_at") : null;
    const findQuery = cursorFilter ? { $and: [query, cursorFilter] } : query;

    // user_id se sirf email — naam/phone address_snapshot mein pehle se hai (§4.5 duplicate populate)
    const [orders, statusMap] =
      await Promise.all([
        Order.find(findQuery)
          .populate("user_id", "email")
          .populate("items.product_id", "name translations")
          .populate("items.variant_id", "title translations")
          .sort(cursorFilter ? { created_at: -1, _id: -1 } : { [sortField]: sortOrder, _id: 1 })
          .skip(cursorFilter ? 0 : (safePage - 1) * limitNum)
          .limit(limitNum)
          .lean(),
        // ✅ Ek hi $group — pehle 5 countDocuments (§4.3)
        statusCounts(Order, { match: countsQuery }),
      ]);
    const totalOrders = sumCounts(statusMap);
    const pendingOrders = statusMap.pending || 0;
    const shippedOrders = statusMap.shipped || 0;
    const deliveredOrders = statusMap.delivered || 0;
    const cancelledOrders = statusMap.cancelled || 0;

    res.status(200).json({
      success: true,
      data: orders.map((order) => mapFrontOrder(order, locale)),
      ...(!hasSort && { nextCursor: orders.length === limitNum ? encodeCursor(orders[orders.length - 1], "created_at") : null }),
      counts: {
        total: totalOrders,
        pending: pendingOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
      },
      pagination: {
        total,
        page: safePage,
        limit: limitNum,
        pages,
        totalPages: pages, // backward-compatible key
        hasNext: safePage < pages,
        hasPrev: safePage > 1,
      }
    });
  } catch (error) {
    log.error("❌ [getAllOrders] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// GET /api/orders/admin/product-summary?productId=...
//    Selected product ka poora history — total orders, units, revenue,
//    first/latest order date aur status-wise breakdown.
//    ✅ Cancelled orders LIST me rehti hain, lekin units + revenue se
//       exclude hoti hain (cancelledUnits / cancelledRevenue alag se bhejte hain
//       taake UI par clear note dikh sake).
// ==========================================
const SUMMARY_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

const getProductSummary = async (req, res) => {
  try {
    const { productId } = req.query;

    const empty = (extra = {}) => ({
      productId: productId || "",
      totalOrders: 0,
      unitsSold: 0,
      revenue: 0,
      cancelledOrders: 0,
      cancelledUnits: 0,
      cancelledRevenue: 0,
      firstOrderDate: null,
      lastOrderDate: null,
      byStatus: SUMMARY_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {}),
      ...extra,
    });

    // ✅ Invalid / missing productId -> crash nahi, empty summary
    if (!isValidProductId(productId)) {
      return res.status(200).json({
        success: true,
        data: empty({ invalidProductId: Boolean(productId) }),
      });
    }

    const match = buildAdminOrderFilter(req.query);
    const oid = new mongoose.Types.ObjectId(String(productId));

    const [totals] = await Order.aggregate([
      { $match: match },
      // Sirf is product ki line items nikalo
      {
        $project: {
          created_at: 1,
          status: 1,
          matchedItems: {
            $filter: {
              input: "$items",
              as: "it",
              cond: { $eq: ["$$it.product_id", oid] },
            },
          },
        },
      },
      {
        $project: {
          created_at: 1,
          status: 1,
          matchedQty: { $sum: "$matchedItems.qty" },
          matchedRevenue: {
            $sum: {
              $map: {
                input: "$matchedItems",
                as: "it",
                in: { $multiply: ["$$it.price", "$$it.qty"] },
              },
            },
          },
        },
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          firstOrderDate: { $min: "$created_at" },
          lastOrderDate: { $max: "$created_at" },
          // ✅ Cancelled exclude
          unitsSold: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 0, "$matchedQty"] },
          },
          revenue: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 0, "$matchedRevenue"] },
          },
          cancelledOrders: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
          },
          cancelledUnits: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, "$matchedQty", 0] },
          },
          cancelledRevenue: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, "$matchedRevenue", 0] },
          },
        },
      },
    ]);

    const statusRows = await Order.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const byStatus = SUMMARY_STATUSES.reduce((acc, s) => ({ ...acc, [s]: 0 }), {});
    statusRows.forEach((r) => {
      if (r._id && r._id in byStatus) byStatus[r._id] = r.count;
    });

    if (!totals) {
      return res.status(200).json({ success: true, data: empty() });
    }

    res.status(200).json({
      success: true,
      data: {
        productId: String(productId),
        totalOrders: totals.totalOrders || 0,
        unitsSold: totals.unitsSold || 0,
        revenue: Math.round(totals.revenue || 0),
        cancelledOrders: totals.cancelledOrders || 0,
        cancelledUnits: totals.cancelledUnits || 0,
        cancelledRevenue: Math.round(totals.cancelledRevenue || 0),
        firstOrderDate: totals.firstOrderDate || null,
        lastOrderDate: totals.lastOrderDate || null,
        byStatus,
      },
    });
  } catch (error) {
    log.error("❌ [getProductSummary] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// PATCH /api/orders/admin/:id/status — Update Order Status
// ==========================================
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, cancel_reason } = req.body;

    const validStatuses = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // ✅ FIX: Cancel hone par stock WAPAS restore (modal me yahi likha hai).
    //    Yahi logic deleteOrder() me pehle se tha — ab consistent hai.
    //    Double restore se bacha gaya hai: sirf tab jab pehle cancelled nahi tha.
    const previousStatus = order.status;
    const shouldRestoreStock = status === "cancelled" && previousStatus !== "cancelled";

      order.status = status;
    if (notes) order.notes = notes;
    if (status === "cancelled" && cancel_reason) order.cancel_reason = cancel_reason;

    // 🔒 Atomic claim: do concurrent "cancel" requests dono ne previousStatus
    // "pending" padha to dono stock wapas kar dete (double restore). Ab sirf wo
    // request restore karti hai jiska conditional update kamyab hua.
    let restoreClaimed = false;
    if (shouldRestoreStock) {
      const claim = await Order.updateOne({ _id: order._id, status: { $ne: "cancelled" } }, { $set: { status: "cancelled" } });
      restoreClaimed = claim.modifiedCount === 1;
    }

    await order.save();

    if (restoreClaimed) {
      const restoredVariants = [];
      for (const item of order.items || []) {
        if (!item.variant_id) continue;
        const restoreQty = (Number(item.qty) || 0) + (Number(item.free_items) || 0);
        await Variant.updateOne(
          { _id: item.variant_id },
          { $inc: { quantity: restoreQty } }
        );
        restoredVariants.push({ variant_id: item.variant_id, change: restoreQty });
      }
      // ✅ Live update — stock restore hote hi manage-stock page khud refresh
      if (restoredVariants.length > 0) {
        emitStockEvent({ variants: restoredVariants, source: "order_cancelled" });
      }
    }

    emitOrderEvent("order:updated", { success: true, data: order });
    emitOrderEvent("order:statusChanged", { success: true, data: order });
    res.status(200).json({ success: true, message: `Order status updated to ${status}`, data: order });
  } catch (error) {
    log.error("❌ [updateOrderStatus] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// PUT /api/orders/:id/edit — Edit Pending Order (Qty + Address)
// ✅ FIXED: Supports address_override for "order only" mode
// ==========================================
// Paid + free units. Stock isi farq se chalta hai (free paid qty ke UPAR hai).
const lineUnits = (item) => (Number(item.qty) || 0) + (Number(item.free_items) || 0);

const editOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { items, address_id, address_override } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (String(order.user_id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You can only edit your own orders" });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ success: false, message: "Only pending orders can be edited" });
    }

    const $set = {};
    // delta > 0 matlab shelf se aur units chahiye
    const stockDeltas = [];

    // ✅ Update Quantities. Tax product.tax se snapshot (tax_rate) par. Pehle
    // item.tax padha jata tha jo schema me hai hi nahi, is liye tax 0 ho jata tha,
    // aur qty badalne par stock bilkul nahi hilta tha.
    if (Array.isArray(items) && items.length) {
      const missingProductIds = [];
      for (const item of order.items) {
        if (item.tax_rate == null && item.product_id) missingProductIds.push(item.product_id);
      }
      const rateByProduct = new Map();
      if (missingProductIds.length) {
        const products = await Product.find({ _id: { $in: missingProductIds } }).select("tax").lean();
        for (const product of products) rateByProduct.set(String(product._id), Number(product.tax) || 0);
      }

      const oldUnits = new Map();
      for (const item of order.items) {
        if (!item.variant_id) continue;
        const key = String(item.variant_id);
        oldUnits.set(key, (oldUnits.get(key) || 0) + lineUnits(item));
      }

      let subtotal = 0;
      let knownTax = 0;
      let unresolved = false;
      const nextItems = order.items.map((item) => {
        const plain = item.toObject();
        const updated = items.find((i) => String(i._id || i.id) === String(item._id));
        const newQty = updated ? Math.max(1, Math.floor(Number(updated.qty) || 1)) : item.qty;

        let freeItems = Number(item.free_items) || 0;
        if (item.deal_type === "buy_x_get_y" && item.deal_buy_quantity && item.deal_get_quantity) {
          freeItems = Math.floor(newQty / item.deal_buy_quantity) * item.deal_get_quantity;
          plain.deal_savings = freeItems * item.price;
        }

        plain.qty = newQty;
        plain.payable_items = newQty;
        plain.free_items = freeItems;

        let rate = item.tax_rate == null ? null : Number(item.tax_rate);
        if (rate == null && item.product_id && rateByProduct.has(String(item.product_id))) {
          rate = rateByProduct.get(String(item.product_id));
          plain.tax_rate = rate;
        }
        if (plain.tax_rate == null) delete plain.tax_rate;
        const lineTotal = item.price * newQty;
        subtotal += lineTotal;
        if (rate == null) unresolved = true;
        else knownTax += lineTotal * (rate / 100);
        return plain;
      });

      subtotal = roundMoney(subtotal);
      const tax = unresolved
        ? (order.subtotal > 0 ? Math.round(order.tax * (subtotal / order.subtotal)) : order.tax)
        : Math.round(knownTax);

      const newUnits = new Map();
      const names = new Map();
      for (const item of nextItems) {
        if (!item.variant_id) continue;
        const key = String(item.variant_id);
        newUnits.set(key, (newUnits.get(key) || 0) + lineUnits(item));
        if (!names.has(key)) names.set(key, item.name || "item");
      }
      for (const key of new Set([...oldUnits.keys(), ...newUnits.keys()])) {
        const delta = (newUnits.get(key) || 0) - (oldUnits.get(key) || 0);
        if (delta !== 0) stockDeltas.push({ variant_id: key, delta, name: names.get(key) || "item" });
      }

      $set.items = nextItems;
      $set.subtotal = subtotal;
      $set.tax = tax;
      $set.total = subtotal + order.shipping + tax;
      $set.total_deal_savings = nextItems.reduce((sum, item) => sum + (Number(item.deal_savings) || 0), 0);
    }

    // ✅ Update Address — address book untouched when the customer sends an override
    if (address_override && typeof address_override === "object") {
      $set.address_snapshot = {
        full_name: address_override.full_name || "",
        phone: address_override.phone || "",
        country: address_override.country || "",
        street_address1: address_override.street_address1 || "",
        street_address2: address_override.street_address2 || "",
        city: address_override.city || "",
        state: address_override.state || "",
        zip_code: address_override.zip_code || "",
        delivery_instructions: address_override.delivery_instructions || "",
      };
      if (address_id) $set.address_id = address_id;
    } else if (address_id) {
      const address = await Address.findOne({ _id: address_id, user_id: req.user._id });
      if (!address) {
        return res.status(400).json({ success: false, message: "Address not found" });
      }
      $set.address_id = address._id;
      $set.address_snapshot = {
        full_name: address.full_name,
        phone: address.phone,
        country: address.country,
        street_address1: address.street_address1,
        street_address2: address.street_address2,
        city: address.city,
        state: address.state,
        zip_code: address.zip_code,
        delivery_instructions: address.delivery_instructions || "",
      };
    }

    if (!Object.keys($set).length) {
      return res.status(200).json({ success: true, message: "Order updated successfully", data: order });
    }

    // 🔒 Stock delta + order update ek transaction. Doosri request same updated_at
    // par fail (409) — warna dono qty barha kar stock do dafa kaat leti.
    const seenUpdatedAt = order.updated_at;
    const applied = [];
    let saved;
    try {
      ({ result: saved } = await withTx(async () => {
        applied.length = 0;
        for (const change of stockDeltas) {
          const inc = -change.delta;
          const result = change.delta > 0
            ? await Variant.updateOne(
              { _id: change.variant_id, quantity: { $gte: change.delta } },
              { $inc: { quantity: inc } },
            )
            : await Variant.updateOne({ _id: change.variant_id }, { $inc: { quantity: inc } });
          if (change.delta > 0 && !result.modifiedCount) {
            throw new TxAbort(400, { success: false, message: `Insufficient stock for "${change.name}". Please refresh and try again.` });
          }
          if (result.modifiedCount) applied.push({ variant_id: change.variant_id, change: inc });
        }
        const updated = await Order.findOneAndUpdate(
          { _id: order._id, user_id: req.user._id, status: "pending", updated_at: seenUpdatedAt },
          { $set },
          { returnDocument: "after", runValidators: true },
        );
        if (!updated) {
          throw new TxAbort(409, { success: false, code: "ORDER_CHANGED", message: "This order was changed at the same time. Refresh and try again." });
        }
        return updated;
      }));
    } catch (txError) {
      if (txError instanceof TxAbort) return res.status(txError.status).json(txError.body);
      throw txError;
    }

    if (applied.length) {
      emitStockEvent({ variants: applied.map((row) => ({ variant_id: row.variant_id, change: row.change })), source: "order_edited" });
    }
    emitOrderEvent("order:updated", { success: true, data: saved });
    res.status(200).json({ success: true, message: "Order updated successfully", data: saved });
  } catch (error) {
    log.error("❌ [editOrder] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// DELETE /api/orders/:id — Delete Pending Order
// ==========================================
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (String(order.user_id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You can only delete your own orders" });
    }

    if (order.status !== "pending") {
      return res.status(400).json({ success: false, message: "Only pending orders can be deleted" });
    }

    // 🔒 Pehle atomic delete (owner + pending shart ke sath), PHIR stock restore.
    // Pehle restore pehle hota tha → do concurrent delete requests dono stock
    // wapas kar deti thi. Ab sirf jis request ne asal me delete kiya wahi restore.
    const deletedOrder = await Order.findOneAndDelete({ _id: order._id, user_id: req.user._id, status: "pending" });
    if (!deletedOrder) {
      return res.status(409).json({ success: false, message: "Order was already changed or deleted" });
    }

    // ✅ Stock wapas restore = PAID + FREE (total jo ship hone wala tha)
    const restoredVariants = [];
    for (const item of deletedOrder.items) {
      if (item.variant_id) {
        await Variant.updateOne(
          { _id: item.variant_id },
          { $inc: { quantity: item.qty + (item.free_items || 0) } }
        );
        restoredVariants.push({ variant_id: item.variant_id, change: item.qty + (item.free_items || 0) });
      }
    }

    // ✅ Live update — stock restore hote hi manage-stock page apne aap refresh
    if (restoredVariants.length > 0) {
      emitStockEvent({ variants: restoredVariants, source: "order_deleted" });
    }

    emitOrderEvent("order:deleted", { success: true, data: { id: req.params.id } });
    emitOrderEvent("order:updated", { success: true, data: { id: req.params.id, deleted: true } });
    res.status(200).json({ success: true, message: "Order deleted successfully" });
  } catch (error) {
    log.error("❌ [deleteOrder] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// GET /api/orders/admin/:id — Admin single order
// getBanner/detail ka pattern: populate sirf display info ke liye, response me
// sirf front + audit fields, aur translations sirf selected locale ki.
// ==========================================
const getOrderByIdAdmin = async (req, res) => {
  try {
    const locale = parseOrderLocale(req.query.locale);
    const order = await Order.findById(req.params.id)
      .populate("user_id", "name email phone")
      .populate("items.product_id", "name translations")
      .populate("items.variant_id", "title translations")
      .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // ✅ mapFrontOrder sirf front-visible fields rakhta hai — checkout_draft_id,
    //    address_id, translation_source/status, __v response me nahi jate.
    res.status(200).json({ success: true, data: mapFrontOrder(order, locale) });
  } catch (error) {
    log.error("❌ [getOrderByIdAdmin] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// PATCH /api/orders/admin/:id/payment — Mark Payment Received
// ==========================================
const updatePaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["paid", "pending", "failed", "refunded"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid payment status" });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.payment.status = status;
    await order.save();

    emitOrderEvent("order:updated", { success: true, data: order });
    emitOrderEvent("order:paymentUpdated", { success: true, data: order });
    res.status(200).json({
      success: true,
      message: status === "paid" ? "Payment marked as received" : `Payment marked as ${status}`,
      data: order,
    });
  } catch (error) {
    log.error("❌ [updatePaymentStatus] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  placeOrder,
  getMyOrdersSummary,
  getMyOrders,
  getOrderById,
  getAllOrders,
  getProductSummary,
  updateOrderStatus,
  editOrder,
  deleteOrder,
  getOrderByIdAdmin,
  updatePaymentStatus,
};