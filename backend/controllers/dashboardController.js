const Order = require("../models/Order");
const Product = require("../models/Product");
const Brand = require("../models/Brand");
const Category = require("../models/Category");
const Discount = require("../models/Discount");
const log = require("../utils/logger");

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

const IANA_TZ = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$|^UTC$/;

/** Resolve store IANA timezone (fallback UTC). */
const storeTimezone = (req) => {
  const raw = String(req.store?.timezone || "UTC").trim() || "UTC";
  return IANA_TZ.test(raw) ? raw : "UTC";
};

/** Calendar Y-M-D (and optional H:M:S) parts in a timezone. */
const zonedParts = (date, timeZone) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map = Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
};

/** Instant that is y-m-d h:m:s.ms in `timeZone`. */
const zonedWallTimeToUtc = (y, m, d, h, min, s, ms, timeZone) => {
  const utcGuess = Date.UTC(y, m - 1, d, h, min, s, ms);
  const asZoned = zonedParts(new Date(utcGuess), timeZone);
  const asIfUtc = Date.UTC(asZoned.year, asZoned.month - 1, asZoned.day, asZoned.hour, asZoned.minute, asZoned.second, ms);
  return new Date(utcGuess - (asIfUtc - utcGuess));
};

const dayKeyInTz = (date, timeZone) => {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

const startOfZonedDay = (date, timeZone) => {
  const p = zonedParts(date, timeZone);
  return zonedWallTimeToUtc(p.year, p.month, p.day, 0, 0, 0, 0, timeZone);
};

const endOfZonedDay = (date, timeZone) => {
  const p = zonedParts(date, timeZone);
  return zonedWallTimeToUtc(p.year, p.month, p.day, 23, 59, 59, 999, timeZone);
};

const addZonedDays = (date, days, timeZone) => {
  const p = zonedParts(date, timeZone);
  // Noon UTC-ish via wall clock to avoid DST edge when shifting calendar days
  const noon = zonedWallTimeToUtc(p.year, p.month, p.day, 12, 0, 0, 0, timeZone);
  return new Date(noon.getTime() + days * 86400000);
};

const buildBuckets = (start, end, bucket, timeZone) => {
  const buckets = [];
  let cursor = startOfZonedDay(start, timeZone);
  const endBound = endOfZonedDay(end, timeZone);
  while (cursor <= endBound) {
    const p = zonedParts(cursor, timeZone);
    if (bucket === "day") {
      buckets.push({
        key: dayKeyInTz(cursor, timeZone),
        label: `${MONTHS[p.month - 1]} ${p.day}`,
        revenue: 0,
        orders: 0,
      });
      cursor = startOfZonedDay(addZonedDays(cursor, 1, timeZone), timeZone);
    } else {
      buckets.push({
        key: `${p.year}-${String(p.month).padStart(2, "0")}`,
        label: MONTHS[p.month - 1],
        revenue: 0,
        orders: 0,
      });
      const nextMonth = p.month === 12 ? 1 : p.month + 1;
      const nextYear = p.month === 12 ? p.year + 1 : p.year;
      cursor = zonedWallTimeToUtc(nextYear, nextMonth, 1, 0, 0, 0, 0, timeZone);
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
    const locale = /^[a-z]{2,3}$/i.test(String(req.query.locale || "en")) ? String(req.query.locale || "en").toLowerCase() : "en";
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const makePage = (total, requested) => {
      const pages = Math.max(1, Math.ceil(total / limit));
      const page = Math.min(pages, Math.max(1, Number.parseInt(requested, 10) || 1));
      return { page, limit, total, pages, skip: (page - 1) * limit };
    };
    const { days, format, bucket } = RANGES[rangeKey];
    const tz = storeTimezone(req);

    const now = new Date();
    const end = endOfZonedDay(now, tz);
    const start = startOfZonedDay(addZonedDays(end, -(days - 1), tz), tz);
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = startOfZonedDay(addZonedDays(start, -days, tz), tz);
    const weekStart = startOfZonedDay(addZonedDays(end, -6, tz), tz);
    const prevWeekStart = startOfZonedDay(addZonedDays(weekStart, -7, tz), tz);

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
          _id: { k: { $dateToString: { format, date: "$created_at", timezone: tz } } },
          revenue: { $sum: "$total" },
          orders: { $sum: 1 },
        },
      },
    ]);
    const seriesMap = new Map(seriesRows.map((r) => [r._id.k, r]));
    const series = buildBuckets(start, end, bucket, tz).map((b) => {
      const row = seriesMap.get(b.key);
      return { label: b.label, revenue: Math.round(row?.revenue || 0), orders: row?.orders || 0 };
    });

    // ---- Counts + weekly creation trends ----
    const featuredProducts = await Product.countDocuments({ is_featured: true, is_deleted: { $ne: true } });
    const [products, brands, categories] = await Promise.all([
      Product.countDocuments({ is_deleted: { $ne: true } }),
      Brand.countDocuments({ is_deleted: { $ne: true } }),
      Category.countDocuments({ is_deleted: { $ne: true } }),
    ]);

    const creationTrend = async (Model, filter = {}) => {
      const [cur, prev] = await Promise.all([
        Model.countDocuments({ created_at: { $gte: weekStart, $lte: end }, ...filter }),
        Model.countDocuments({ created_at: { $gte: prevWeekStart, $lt: weekStart }, ...filter }),
      ]);
      return pctChange(cur, prev);
    };
    const [productsTrend, brandsTrend, categoriesTrend, featuredProductsTrend] = await Promise.all([
      creationTrend(Product),
      creationTrend(Brand),
      creationTrend(Category),
      creationTrend(Product, { is_featured: true }),
    ]);

    // ---- Sparklines — last 7 days ----
    const creationSpark = (Model) =>
      Model.aggregate([
        { $match: { created_at: { $gte: weekStart } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: tz } }, n: { $sum: 1 } } },
      ]);
    const [prodSpark, brandSpark, catSpark, revenueSparkRows, featuredSparkRows] = await Promise.all([
      creationSpark(Product),
      creationSpark(Brand),
      creationSpark(Category),
      Order.aggregate([
        { $match: { created_at: { $gte: weekStart }, status: { $ne: "cancelled" } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at", timezone: tz } }, revenue: { $sum: "$total" } } },
      ]),
      Product.aggregate([
        { $match: { featured_at: { $gte: weekStart } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$featured_at", timezone: tz } }, n: { $sum: 1 } } },
      ]),
    ]);
    const toSpark = (rows) => {
      const map = new Map(rows.map((r) => [r._id, r.n]));
      return buildBuckets(weekStart, end, "day", tz).map((b) => map.get(b.key) || 0);
    };
    const revenueSpark = toSpark(revenueSparkRows.map((r) => ({ _id: r._id, n: r.revenue })));
    const featuredSpark = toSpark(featuredSparkRows);

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
    const sortedTopProductRows = curItems.sort((a, b) => b.sold - a.sold);
    const topProductsPagination = makePage(sortedTopProductRows.length, req.query.topProductsPage);
    const topProductRows = sortedTopProductRows.slice(topProductsPagination.skip, topProductsPagination.skip + limit);
    const topProductCatalog = topProductRows.length
      ? await Product.find({ _id: { $in: topProductRows.map((row) => row._id).filter(Boolean) } })
          .select("name translations.name")
          .exec()
      : [];
    const topProductCatalogById = new Map(
      topProductCatalog.map((product) => {
        const nameTranslations = product.translations?.name;
        return [String(product._id), {
          name: product.name,
          translations: {
            name: (() => {
              const values = nameTranslations instanceof Map ? Object.fromEntries(nameTranslations) : nameTranslations?.toObject?.() || nameTranslations || {};
              return locale !== "en" && values[locale] ? { [locale]: values[locale] } : {};
            })(),
          },
        }];
      })
    );
    const topProducts = topProductRows.map((r) => {
      const catalogProduct = topProductCatalogById.get(String(r._id));
      return ({
        id: r._id,
        name: catalogProduct?.name || r.name || "Unknown product",
        translations: catalogProduct?.translations || {},
        image: r.image || "",
        sold: r.sold,
        revenue: Math.round(r.revenue),
        trend: pctChange(r.sold, prevSoldMap.get(String(r._id)) || 0),
      });
    });

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
    const recentOrdersTotal = await Order.countDocuments({});
    const recentOrdersPagination = makePage(recentOrdersTotal, req.query.recentOrdersPage);
    const recentOrdersRaw = await Order.find({})
      .sort({ created_at: -1 })
      .skip(recentOrdersPagination.skip)
      .limit(limit)
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
      Order.find({}).sort({ created_at: -1 }).select("order_number address_snapshot created_at").lean(),
      Product.find({}).sort({ created_at: -1 }).select("name created_at").lean(),
      Discount.find({}).sort({ createdAt: -1 }).select("name createdAt").lean(),
      Brand.find({}).sort({ created_at: -1 }).select("name created_at").lean(),
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
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const activitiesPagination = makePage(activities.length, req.query.activitiesPage);
    const visibleActivities = activities.slice(activitiesPagination.skip, activitiesPagination.skip + limit);

    // ---- Response ----
    res.status(200).json({
      success: true,
      data: {
        range: rangeKey,
        counts: { products, brands, categories, productsTrend, brandsTrend, categoriesTrend, featuredProducts, featuredProductsTrend },
        revenue: { total: Math.round(curTotals.revenue), trend: pctChange(curTotals.revenue, prevTotals.revenue) },
        orders: { count: curTotals.orders, trend: pctChange(curTotals.orders, prevTotals.orders) },
        series,
        sparklines: {
          products: toSpark(prodSpark),
          brands: toSpark(brandSpark),
          categories: toSpark(catSpark),
          revenue: revenueSpark,
          featuredProducts: featuredSpark,
        },
        distribution,
        topProducts,
        topProductsPagination: (({ skip, ...pagination }) => pagination)(topProductsPagination),
        recentOrders,
        recentOrdersPagination: (({ skip, ...pagination }) => pagination)(recentOrdersPagination),
        activities: visibleActivities,
        activitiesPagination: (({ skip, ...pagination }) => pagination)(activitiesPagination),
      },
    });




  } catch (error) {
    log.error("❌ [getDashboardStats] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getDashboardStats };
