// §3.7 — referential cleanup + typed cart items + permission key migration (DB ke bina, models stub)
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env"), quiet: true });

const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Brand = require("../models/Brand");
const Tag = require("../models/Tag");
const Attribute = require("../models/Attribute");
const Cart = require("../models/Cart");
const CheckoutDraft = require("../models/CheckoutDraft");

const mockRes = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

// model static ko temporarily replace karo
const stub = (model, name, fn) => {
  const orig = model[name];
  model[name] = fn;
  return () => { model[name] = orig; };
};

test("attribute delete → Category.attributes se $pull", async () => {
  const calls = [];
  const restore = [
    stub(Attribute, "findOneAndUpdate", async () => ({ _id: "a1", toObject: () => ({ _id: "a1" }) })),
    stub(Category, "updateMany", async (filter, update) => { calls.push({ filter, update }); return {}; }),
  ];
  try {
    const { deleteAttribute } = require("../controllers/attributeController");
    const res = mockRes();
    await deleteAttribute({ params: { id: "a1" }, user: { _id: "u1" }, io: null }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls[0].filter, { "attributes.attribute_id": "a1" });
    assert.deepEqual(calls[0].update, { $pull: { attributes: { attribute_id: "a1" } } });
  } finally { restore.forEach((r) => r()); }
});

test("tag delete → Product.tag_ids aur Variant.tag_ids se $pull", async () => {
  const calls = [];
  const record = (name) => async (filter, update) => { calls.push({ name, filter, update }); return {}; };
  const restore = [
    stub(Tag, "findByIdAndUpdate", async () => ({ _id: "t1" })),
    stub(Product, "updateMany", record("product")),
    stub(Variant, "updateMany", record("variant")),
  ];
  try {
    const { deleteTag } = require("../controllers/tagController");
    const res = mockRes();
    await deleteTag({ params: { id: "t1" }, user: { _id: "u1" } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls.map((c) => c.name).sort(), ["product", "variant"]);
    for (const c of calls) {
      assert.deepEqual(c.filter, { tag_ids: "t1" });
      assert.deepEqual(c.update, { $pull: { tag_ids: "t1" } });
    }
  } finally { restore.forEach((r) => r()); }
});

test("brand delete products reference kar rahe hon to 409 (softDelete nahi)", async () => {
  let softDeleted = false;
  const restore = [
    stub(Brand, "findOne", async () => ({ _id: "b1", softDelete: async () => { softDeleted = true; } })),
    stub(Product, "countDocuments", async () => 3),
  ];
  try {
    const { deleteBrand } = require("../controllers/brandController");
    const res = mockRes();
    await deleteBrand({ params: { id: "b1" }, user: { _id: "u1" } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(softDeleted, false);
  } finally { restore.forEach((r) => r()); }
});

test("category delete products reference kar rahe hon to 409 (save nahi)", async () => {
  let saved = false;
  const doc = { _id: "c1", save: async () => { saved = true; } };
  const restore = [
    stub(Category, "findOne", async () => doc),
    stub(Category, "exists", async () => null), // child nahi
    stub(Product, "countDocuments", async () => 2),
  ];
  try {
    const { deleteCategory } = require("../controllers/categoryController");
    const res = mockRes();
    await deleteCategory({ params: { id: "c1" }, user: { _id: "u1" } }, res);
    assert.equal(res.statusCode, 409);
    assert.equal(saved, false);
    assert.notEqual(doc.is_deleted, true);
  } finally { restore.forEach((r) => r()); }
});

test("category delete: koi product nahi → soft delete chalta hai", async () => {
  let saved = false;
  const doc = { _id: "c1", save: async () => { saved = true; } };
  const restore = [
    stub(Category, "findOne", async () => doc),
    stub(Category, "exists", async () => null),
    stub(Product, "countDocuments", async () => 0),
  ];
  try {
    const { deleteCategory } = require("../controllers/categoryController");
    const res = mockRes();
    await deleteCategory({ params: { id: "c1" }, user: { _id: "u1" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(saved, true);
    assert.equal(doc.is_deleted, true);
  } finally { restore.forEach((r) => r()); }
});

test("Cart.items typed subschema: extra deal fields bachte hain, 50 se zyada reject", async () => {
  const cart = new Cart({
    user_id: "64b000000000000000000001",
    items: [{ key: "p1__v1", variant_id: "64b000000000000000000002", qty: 2, dealId: "d1", regularPrice: 100 }],
  });
  assert.equal(await cart.validate(), undefined);
  const item = cart.toObject().items[0];
  assert.equal(item.qty, 2);
  assert.equal(item.dealId, "d1"); // strict:false — legacy/deal fields as-is
  assert.equal(item.regularPrice, 100);

  const tooMany = new Cart({
    user_id: "64b000000000000000000001",
    items: Array.from({ length: 51 }, (_, i) => ({ key: `k${i}`, qty: 1 })),
  });
  await assert.rejects(() => tooMany.validate(), /max 50/);
});

test("CheckoutDraft.items typed + cap", async () => {
  const draftDoc = new CheckoutDraft({
    user_id: "64b000000000000000000001",
    drafts: [{ items: Array.from({ length: 51 }, (_, i) => ({ key: `k${i}`, qty: 1 })) }],
  });
  await assert.rejects(() => draftDoc.validate(), /max 50/);
  const ok = new CheckoutDraft({ user_id: "64b000000000000000000001", drafts: [{ items: [{ key: "a", qty: 1 }] }] });
  assert.equal(await ok.validate(), undefined);
});

test("migratePermissionKeys: mapping + deny wins + no-op", () => {
  const { planPermissionMigration, KEY_MAP } = require("../scripts/migratePermissionKeys");
  assert.deepEqual(KEY_MAP, { newsletter: "customers", categories: "products", chat: "orders" });

  const plan = planPermissionMigration({ newsletter: false, customers: true, categories: true, chat: true });
  assert.equal(plan.set["permissions.customers"], false); // deny wins
  assert.equal(plan.set["permissions.products"], true); // missing target → purani value
  assert.equal(plan.set["permissions.orders"], true);
  assert.deepEqual(Object.keys(plan.unset).sort(), ["permissions.categories", "permissions.chat", "permissions.newsletter"]);

  assert.equal(planPermissionMigration({ products: true }), null);
  assert.equal(planPermissionMigration(null), null);
});
