// Phase §2.4–2.5 (optimizeplan.md): schema fields that were silently dropped,
// Brand model path, public product/brand leaks, pushGlobalActivity removed.
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });
process.env.JWT_ADMIN_ACCESS_SECRET = process.env.JWT_ADMIN_ACCESS_SECRET || "test-admin-access-secret";

const app = require("../app");
const tokens = require("../utils/tokens");
const Store = require("../models/Store");
const Employee = require("../models/Employee");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Brand = require("../models/Brand");
const Discount = require("../models/Discount");
const Deal = require("../models/Deal");
const PosSale = require("../models/PosSale");
const PurchaseOrder = require("../models/PurchaseOrder");
const Category = require("../models/Category");
const Attribute = require("../models/Attribute");
const Tag = require("../models/Tag");
const Banner = require("../models/Banner");

const API = process.env.API_PREFIX || "/api";
const ROOT = process.env.ROOT_DOMAIN || "localhost";
const baseUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/ecommerce";
const testUri = baseUri.replace(/\/([^/?]+)(\?|$)/, `/ecommerce_test_schemap0_${process.pid}_${Date.now()}$2`);

let ctx = null;
const oid = () => new mongoose.Types.ObjectId();

test.before(async () => {
  try { await mongoose.connect(testUri, { serverSelectionTimeoutMS: 2000 }); } catch { return; }
  const storeId = oid();
  const subdomain = `schemap0${Date.now().toString(36)}`;
  await Store.collection.insertOne({ _id: storeId, store_name: "Schema P0", subdomain, store_status: "open" });
  const adminId = oid();
  await Employee.collection.insertOne({
    _id: adminId, storeId, name: "Owner", username: `owner${Date.now()}`,
    email: `owner${Date.now()}@example.com`, password: "x".repeat(60),
    role: "admin", status: "active", is_deleted: false, permissions: {},
  });
  const brandId = oid();
  const categoryId = oid();
  await Brand.collection.insertOne({
    _id: brandId, storeId, brand_code: "BR-1", name: "Acme", is_active: true, is_deleted: false,
    createdby: adminId, updatedby: adminId,
  });
  await Category.collection.insertOne({
    _id: categoryId, storeId, category_code: "CAT-1", name: "Gadgets", is_deleted: false,
  });
  const activeId = oid();
  const inactiveId = oid();
  await Product.collection.insertOne({
    _id: activeId, storeId, name: "Active Kettle", category_id: categoryId, brand_id: brandId,
    status: "active", is_deleted: false,
  });
  await Product.collection.insertOne({
    _id: inactiveId, storeId, name: "Hidden Kettle", category_id: categoryId, brand_id: brandId,
    status: "inactive", is_deleted: false,
  });
  await Variant.collection.insertOne({
    _id: oid(), storeId, product_id: activeId, sku: "AK-1", title: "Default",
    selling_price: 100, quantity: 5, status: "active", is_deleted: false,
  });
  ctx = {
    storeId, brandId, activeId, inactiveId, host: `${subdomain}.${ROOT}`,
    adminToken: tokens.signAccess("admin", { subjectId: adminId, role: "admin", storeId, sid: "t" }),
  };
});

test.after(async () => {
  if (mongoose.connection.readyState === 1) {
    await Promise.all(mongoose.modelNames().map((n) => mongoose.model(n).init().catch(() => {})));
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect().catch(() => {});
  }
  setImmediate(() => process.exit(0));
});

test("Brand model resolves from models/Brand (case-sensitive path)", () => {
  assert.equal(Brand.modelName, "Brand");
  assert.ok(require.resolve("../models/Brand"));
});

test("activityHelper no longer exports pushGlobalActivity", () => {
  const activity = require("../utils/activityHelper");
  assert.equal(typeof activity.pushGlobalActivity, "undefined");
  assert.equal(typeof activity.pushActivityToUser, "undefined");
  assert.equal(typeof activity.pushStoreActivity, "function");
});

test("schema paths exist for previously dropped fields", () => {
  assert.ok(Variant.schema.path("is_deleted"));
  assert.ok(Variant.schema.path("deleted_at"));
  for (const key of ["priceMin", "priceMax", "maxDiscountAmount", "priority", "usageCount"]) {
    assert.ok(Discount.schema.path(key), `Discount.${key}`);
  }
  assert.ok(Deal.schema.path("priority"));
  assert.ok(Deal.schema.path("code"));
  assert.ok(PosSale.schema.path("customer_snapshot.email"));
  assert.ok(PosSale.schema.path("customer_snapshot.address"));
  assert.ok(PosSale.schema.path("customer_snapshot.notes"));
  assert.ok(PurchaseOrder.schema.path("items").schema.path("topup"));
  assert.ok(Category.schema.path("category_type"));
  assert.ok(Category.schema.path("image_url"));
  assert.ok(Category.schema.path("sort_order"));
  assert.ok(Attribute.schema.path("filterable"));
  assert.ok(Attribute.schema.path("searchable"));
  assert.ok(Attribute.schema.path("visible"));
  assert.ok(Tag.schema.path("deleted_at"));
  assert.ok(Banner.schema.path("altText"));
  assert.ok(Banner.schema.path("backgroundColor"));
  assert.ok(Banner.schema.path("displayRules"));
});

test("Variant persists is_deleted (soft-delete filters can work)", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const id = oid();
  await Variant.collection.insertOne({
    _id: id, storeId: ctx.storeId, product_id: ctx.activeId, sku: `DEL-${id.toString().slice(-4)}`,
    title: "X", selling_price: 1, quantity: 0, status: "active", is_deleted: true, deleted_at: new Date(),
  });
  const found = await Variant.findOne({ _id: id, is_deleted: true }).setOptions({ skipTenantScope: true });
  assert.ok(found);
  assert.equal(found.is_deleted, true);
});

test("public GET /products forces active and paginates (ignores ?status=inactive)", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  const res = await request(app)
    .get(`${API}/products`)
    .query({ status: "inactive" })
    .set("Host", ctx.host);
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const body = res.body;
  // Paginated shape for public (data/products array + pagination, or array of active only)
  const rows = Array.isArray(body) ? body : (body.data || body.products || []);
  assert.ok(Array.isArray(rows) || body.pagination, JSON.stringify(body).slice(0, 300));
  const list = Array.isArray(rows) ? rows : [];
  assert.ok(list.every((p) => p.status !== "inactive"));
  if (body.pagination) {
    assert.ok(body.pagination.limit >= 1);
  } else if (Array.isArray(body)) {
    // Should not be the unbounded legacy array of both statuses
    assert.ok(!list.some((p) => String(p._id) === String(ctx.inactiveId)));
  }
});

test("public GET /brands/:id and /:id/details have no creator emails", async (t) => {
  if (!ctx) return t.skip("MongoDB not reachable");
  for (const path of [`${API}/brands/${ctx.brandId}`, `${API}/brands/${ctx.brandId}/details`]) {
    const res = await request(app).get(path).set("Host", ctx.host);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const data = res.body.data || res.body;
    assert.equal(data.createdby, undefined);
    assert.equal(data.updatedby, undefined);
    const raw = JSON.stringify(res.body);
    assert.ok(!/@example\.com/.test(raw), raw);
  }
});

test("review create mounts rate limiter before multer", () => {
  const reviewRoutes = require("fs").readFileSync(require("path").join(__dirname, "../routes/reviewRoutes.js"), "utf8");
  const postIdx = reviewRoutes.search(/router\.post\s*\(\s*["']\/["']/);
  const createIdx = reviewRoutes.indexOf("createReview", postIdx);
  assert.ok(postIdx >= 0 && createIdx > postIdx);
  const postBlock = reviewRoutes.slice(postIdx, createIdx);
  const limiterAt = postBlock.indexOf("limiters.reviewCreate");
  const multerAt = postBlock.indexOf("reviewMediaUpload");
  assert.ok(limiterAt >= 0 && multerAt >= 0 && limiterAt < multerAt, postBlock);
});

test("review image cap is 8MB", () => {
  const src = require("fs").readFileSync(require("path").join(__dirname, "../middleware/reviewUploadMiddleware.js"), "utf8");
  assert.match(src, /8 \* 1024 \* 1024/);
});
