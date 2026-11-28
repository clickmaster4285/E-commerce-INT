// optimizeplan.md §3.3 — every store-owned hot path starts with storeId (ESR).
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");

const modelsDir = path.join(__dirname, "..", "models");
for (const file of fs.readdirSync(modelsDir)) {
  if (file.endsWith(".js")) require(path.join(modelsDir, file));
}

const mongoose = require("mongoose");

function indexKeys(Model) {
  return Model.schema.indexes().map(([fields]) => fields);
}

function hasIndex(Model, expected) {
  const needle = JSON.stringify(expected);
  return indexKeys(Model).some((k) => JSON.stringify(k) === needle);
}

test("Product has storeId-first list/featured/category/brand indexes", () => {
  const Product = mongoose.model("Product");
  assert.ok(hasIndex(Product, { storeId: 1, is_deleted: 1, status: 1, created_at: -1, _id: -1 }));
  assert.ok(hasIndex(Product, { storeId: 1, is_featured: 1, is_deleted: 1, featured_at: -1, _id: -1 }));
  assert.ok(hasIndex(Product, { storeId: 1, category_id: 1, is_deleted: 1 }));
  assert.ok(hasIndex(Product, { storeId: 1, brand_id: 1, is_deleted: 1 }));
  assert.ok(!hasIndex(Product, { category_id: 1 }));
  assert.ok(!hasIndex(Product, { brand_id: 1 }));
});

test("Variant SKU unique is store-scoped with case-insensitive collation", () => {
  const Variant = mongoose.model("Variant");
  assert.ok(hasIndex(Variant, { storeId: 1, product_id: 1, is_deleted: 1, created_at: 1, _id: 1 }));
  const skuIx = Variant.schema.indexes().find(([fields]) => fields.storeId === 1 && fields.sku === 1);
  assert.ok(skuIx, "storeId+sku unique");
  assert.equal(skuIx[1]?.unique, true);
  assert.equal(skuIx[1]?.collation?.strength, 2);
  assert.ok(!hasIndex(Variant, { product_id: 1, is_deleted: 1, created_at: 1, _id: 1 }));
});

test("Order / Invoice / Quote / PosSale storeId compounds", () => {
  const Order = mongoose.model("Order");
  assert.ok(hasIndex(Order, { storeId: 1, created_at: -1 }));
  assert.ok(hasIndex(Order, { storeId: 1, status: 1, created_at: -1 }));
  assert.ok(hasIndex(Order, { storeId: 1, user_id: 1, created_at: -1 }));
  assert.ok(!hasIndex(Order, { user_id: 1 }));

  const Invoice = mongoose.model("Invoice");
  assert.ok(hasIndex(Invoice, { storeId: 1, is_deleted: 1, created_at: -1 }));
  assert.ok(hasIndex(Invoice, { storeId: 1, customer_id: 1, created_at: -1 }));

  const Quote = mongoose.model("Quote");
  assert.ok(hasIndex(Quote, { storeId: 1, is_deleted: 1, status: 1, created_at: -1 }));
  assert.ok(hasIndex(Quote, { storeId: 1, customer_id: 1 }));

  const PosSale = mongoose.model("PosSale");
  assert.ok(hasIndex(PosSale, { storeId: 1, created_at: -1 }));
  assert.ok(hasIndex(PosSale, { storeId: 1, customer_id: 1, created_at: -1 }));
});

test("Banner unique position per store; Review soft-delete partial unique", () => {
  const Banner = mongoose.model("Banner");
  const posIx = Banner.schema.indexes().find(([f]) => f.storeId === 1 && f.position === 1 && !f.status);
  assert.ok(posIx?.[1]?.unique, "unique {storeId, position}");

  const Review = mongoose.model("Review");
  const uniq = Review.schema.indexes().find(([f, o]) => f.product_id && f.user_id && o?.unique);
  assert.deepEqual(uniq?.[1]?.partialFilterExpression, { is_deleted: false });
  assert.ok(hasIndex(Review, { storeId: 1, is_deleted: 1, created_at: -1 }));
});

test("Vendor / Category soft-unique partial; ChatConversation store compounds", () => {
  const Vendor = mongoose.model("Vendor");
  const v = Vendor.schema.indexes().find(([f, o]) => f.vendor_code && o?.unique);
  assert.equal(v?.[0]?.storeId, 1);
  assert.deepEqual(v?.[1]?.partialFilterExpression, { is_deleted: false });

  const Category = mongoose.model("Category");
  assert.ok(hasIndex(Category, { storeId: 1, parent_category_id: 1, is_deleted: 1 }));

  const Chat = mongoose.model("ChatConversation");
  assert.ok(hasIndex(Chat, { storeId: 1, status: 1, last_message_at: -1 }));
  assert.ok(hasIndex(Chat, { storeId: 1, customer_id: 1, last_message_at: -1 }));
});

test("Otp dropped lone email index; SuperAdminActivity has actor/entity + TTL", () => {
  const Otp = mongoose.model("Otp");
  assert.ok(!hasIndex(Otp, { email: 1 }));
  assert.ok(hasIndex(Otp, { email: 1, purpose: 1, created_at: -1 }));

  const SA = mongoose.model("SuperAdminActivity");
  assert.ok(hasIndex(SA, { "actor.id": 1, created_at: -1 }));
  assert.ok(hasIndex(SA, { entityType: 1, entityId: 1, created_at: -1 }));
  const ttl = SA.schema.indexes().find(([, o]) => o?.expireAfterSeconds != null);
  assert.ok(ttl, "retention TTL");
});
