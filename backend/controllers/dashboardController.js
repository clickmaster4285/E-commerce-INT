const Order = require("../models/Order");
const Product = require("../models/Product");
const Brand = require("../models/brand");
const Category = require("../models/Category");
const Discount = require("../models/Discount");

// ==========================================
// RANGE CONFIG — 7d/30d grouped per day, 3m/6m/1y per month
// ==========================================
const RANGES = {
  "7d": { days: 7, format: "%Y-%m-%d", bucket: "day" },
  "30d": { days: 30, format: "%Y-%m-%d", bucket: "day" },
  "3m": { days: 90, format: "%Y-%m", bucket: "month" },
  "6m": { days: 180, format: "%Y-%m", bucket: "month" },
  "1y": { days: 365, format: "%Y-%m", bucket: "month" },
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pctChange = (current, previous) => {
  if (previous > 0) return Math.round(((current - previous) / previous) * 1000) / 10;
  return current > 0 ? 100 : 0;
};

const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const buildBuckets = (start, end, bucket) => {
  const buckets = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (bucket === "day") {
      buckets.push({
        key: dayKey(cursor),
        label: `${MONTHS[cursor.getMonth()]} ${cursor.getDate()}`,
        revenue: 0,
        orders: 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    } else {
      buckets.push({
        key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
        label: MONTHS[cursor.getMonth()],
        revenue: 0,
        orders: 0,
      });
      cursor.setMonth(cursor.getMonth() + 1);
      cursor.setDate(1);
    }
  }
  return buckets;
};

// ==========================================
// GET /api/dashboard/stats?range=7d|30d|3m|6m|1y
// ==========================================
const getDashboardStats = async (req, res) => {
  try {
    const rangeKey = RANGES[req.query.range] ? req.query.range : "7d";
    const { days, format, bucket } = RANGES[rangeKey];

    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);
    const prevEnd = new Date(start);
    prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - days);
    const weekStart = new Date(end);
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const baseMatch = { created_at: { $gte: start, $lte: end }, status: { $ne: "cancelled" } };
    const prevMatch = { created_at: { $gte: prevStart, $lte: prevEnd }, status: { $ne: "cancelled" } };

    const totalsAgg = async (match) => {
      const rows = await Order.aggregate([
        { $match: match },
        { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
      ]);
      return rows[0] || { revenue: 0, orders: 0 };
    };

    const [curTotals, prevTotals] = await Promise.all([totalsAgg(baseMatch), totalsAgg(prevMatch)]);

    // ---- Revenue / Orders series ----
    const seriesRows = await Order.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: { k: { $dateToString: { format, date: "$created_at" } } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
    ]);
    const seriesMap = new Map(seriesRows.map((r) => [r._id.k, r]));
    const series = buildBuckets(start, end, bucket).map((b) => {
      const row = seriesMap.get(b.key);
      return { label: b.label, revenue: Math.round(row?.revenue || 0), orders: row?.orders || 0 };
    });

    // ---- Counts + weekly creation trends ----
    const [products, brands, categories] = await Promise.all([
      Product.countDocuments({ is_deleted: { $ne: true } }),
      Brand.countDocuments({ is_deleted: { $ne: true } }),
      Category.countDocuments({ is_deleted: { $ne: true } }),
    ]);

    const creationTrend = async (Model) => {
      const [cur, prev] = await Promise.all([
        Model.countDocuments({ created_at: { $gte: weekStart, $lte: end } }),
        Model.countDocuments({ created_at: { $gte: prevWeekStart, $lt: weekStart } }),
      ]);
      return pctChange(cur, prev);
    };
    const [productsTrend, brandsTrend, categoriesTrend] = await Promise.all([
      creationTrend(Product),
      creationTrend(Brand),
      creationTrend(Category),
    ]);

    // ---- Sparklines — last 7 days ----
    const creationSpark = (Model) =>
      Model.aggregate([
        { $match: { created_at: { $gte: weekStart } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } }, n: { $sum: 1 } } },
      ]);
    const [prodSpark, brandSpark, catSpark, revenueSparkRows] = await Promise.all([
      creationSpark(Product),
      creationSpark(Brand),
      creationSpark(Category),
      Order.aggregate([
        { $match: { created_at: { $gte: weekStart }, status: { $ne: "cancelled" } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } }, revenue: { $sum: "$total" } } },
      ]),
    ]);
    const toSpark = (rows) => {
      const map = new Map(rows.map((r) => [r._id, r.n]));
      return buildBuckets(weekStart, end, "day").map((b) => map.get(b.key) || 0);
    };
    const revenueSpark = toSpark(revenueSparkRows.map((r) => ({ _id: r._id, n: r.revenue })));

    // ---- Item-level aggregation (top products + category distribution) ----
    const itemAgg = (match) =>
      Order.aggregate([
        { $match: match },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.product_id",
            name: { $first: "$items.name" },
            image: { $first: "$items.image" },
            revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
            sold: { $sum: "$items.qty" },
          },
        },
      ]);
    const [curItems, prevItems] = await Promise.all([itemAgg(baseMatch), itemAgg(prevMatch)]);

    const prevSoldMap = new Map(prevItems.map((r) => [String(r._id), r.sold]));
    const topProducts = curItems
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5)
      .map((r) => ({
        id: r._id,
        name: r.name || "Unknown product",
        image: r.image || "",
        sold: r.sold,
        revenue: Math.round(r.revenue),
        trend: pctChange(r.sold, prevSoldMap.get(String(r._id)) || 0),
      }));

    // ---- Sales distribution by category (revenue share) ----
    const categoryRows = await Order.aggregate([
      { $match: baseMatch },
      { $unwind: "$items" },
      { $group: { _id: "$items.product_id", revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } } } },
      { $lookup: { from: "products", localField: "_id", foreignField: "_id", as: "p" } },
      { $unwind: { path: "$p", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "categories", localField: "p.category_id", foreignField: "_id", as: "c" } },
      { $unwind: { path: "$c", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$c._id", name: { $first: "$c.name" }, revenue: { $sum: "$revenue" } } },
      { $sort: { revenue: -1 } },
    ]);

    let distribution = [];
    if (categoryRows.length > 0) {
      const top = categoryRows.slice(0, 5).map((r) => ({ name: r.name || "Uncategorized", value: Math.round(r.revenue), basis: "revenue" }));
      const othersRevenue = categoryRows.slice(5).reduce((s, r) => s + r.revenue, 0);
      if (othersRevenue > 0) top.push({ name: "Others", value: Math.round(othersRevenue), basis: "revenue" });
      distribution = top;
    } else {
      // Fallback: catalogue share by products per category so the chart is never empty
      const catCounts = await Product.aggregate([
        { $match: { is_deleted: { $ne: true } } },
        { $group: { _id: "$category_id", n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 5 },
        { $lookup: { from: "categories", localField: "_id", foreignField: "_id", as: "c" } },
        { $unwind: { path: "$c", preserveNullAndEmptyArrays: true } },
        { $project: { name: { $ifNull: ["$c.name", "Uncategorized"] }, value: "$n" } },
      ]);
      distribution = catCounts.map((r) => ({ name: r.name, value: r.value, basis: "products" }));
    }

    // ---- Recent orders ----
    const recentOrdersRaw = await Order.find({})
      .sort({ created_at: -1 })
      .limit(6)
      .populate("user_id", "name email")
      .lean();
    const recentOrders = recentOrdersRaw.map((o) => ({
      id: o._id,
      order_number: o.order_number,
      customer: o.user_id?.name || o.address_snapshot?.full_name || o.user_id?.email || "Guest",
      total: o.total,
      status: o.status,
      payment: o.payment?.status || "pending",
      image: o.items?.[0]?.image || "",
      created_at: o.created_at,
    }));

    // ---- Recent activity — synthesized from real collection changes ----
    const [actOrders, actProducts, actDiscounts, actBrands] = await Promise.all([
      Order.find({}).sort({ created_at: -1 }).limit(4).select("order_number address_snapshot created_at").lean(),
      Product.find({}).sort({ created_at: -1 }).limit(3).select("name created_at").lean(),
      Discount.find({}).sort({ createdAt: -1 }).limit(3).select("name createdAt").lean(),
      Brand.find({}).sort({ created_at: -1 }).limit(3).select("name created_at").lean(),
    ]);
    const activities = [
      ...actOrders.map((o) => ({
        key: `order-${o._id}`,
        title: "New order received",
        subtitle: `#${o.order_number} from ${o.address_snapshot?.full_name || "a customer"}`,
        category: "Order Management",
        timestamp: o.created_at,
      })),
      ...actProducts.map((p) => ({
        key: `product-${p._id}`,
        title: "Product created",
        subtitle: p.name,
        category: "Product Management",
        timestamp: p.created_at,
      })),
      ...actDiscounts.map((d) => ({
        key: `discount-${d._id}`,
        title: "Discount created",
        subtitle: d.name,
        category: "Coupon Management",
        timestamp: d.createdAt,
      })),
      ...actBrands.map((b) => ({
        key: `brand-${b._id}`,
        title: "Brand created",
        subtitle: b.name,
        category: "Brand Management",
        timestamp: b.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 6);

    // ---- Response ----
    res.status(200).json({
      success: true,
      data: {
        range: rangeKey,
        counts: { products, brands, categories, productsTrend, brandsTrend, categoriesTrend },
        revenue: { total: Math.round(curTotals.revenue), trend: pctChange(curTotals.revenue, prevTotals.revenue) },
        orders: { count: curTotals.orders, trend: pctChange(curTotals.orders, prevTotals.orders) },
        series,
        sparklines: {
          products: toSpark(prodSpark),
          brands: toSpark(brandSpark),
          categories: toSpark(catSpark),
          revenue: revenueSpark,
        },
        distribution,
        topProducts,
        recentOrders,
        activities,
      },
    });




  } catch (error) {
    console.error("❌ [getDashboardStats] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDashboardStats };
