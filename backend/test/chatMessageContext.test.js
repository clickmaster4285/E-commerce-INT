const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });
const controller = require("../controllers/chatController");
const Cart = require("../models/Cart");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const ChatConversation = require("../models/ChatConversation");
const ChatMessage = require("../models/ChatMessage");

const productId = new mongoose.Types.ObjectId();
const variantId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();
const orderId = new mongoose.Types.ObjectId();
const product = { _id: productId, name: "Verified shirt", description: "Cotton shirt" };
const variant = { _id: variantId, product_id: productId, title: "Blue / Medium", sku: "SHIRT-BM", selling_price: 1250 };
const asQuery = (data) => ({ select() { return this; }, async lean() { return data; } });
const replace = (object, key, value, restore) => {
  const previous = object[key];
  object[key] = value;
  restore.push(() => { object[key] = previous; });
};
const withCatalog = async (callback) => {
  const restore = [];
  replace(Product, "findOne", () => asQuery(product), restore);
  replace(Variant, "findOne", () => asQuery(variant), restore);
  try { await callback(); } finally { restore.reverse().forEach((fn) => fn()); }
};

test("product message context is snapshotted from verified catalog values", async () => {
  await withCatalog(async () => {
    const snapshot = await controller._buildMessageContext({ body: { context: { kind: "product", productId, variantId, productName: "fake", price: 1 } } }, {});
    assert.equal(snapshot.kind, "product");
    assert.equal(String(snapshot.product_id), String(productId));
    assert.equal(snapshot.product_name, "Verified shirt");
    assert.equal(snapshot.variant_name, "Blue / Medium");
    assert.equal(snapshot.sku, "SHIRT-BM");
    assert.equal(snapshot.unit_price, 1250);
    assert.equal(snapshot.product_description, "Cotton shirt");
  });
});

test("multiple product variants are independently verified and kept as one message context", async () => {
  const restore = [];
  const secondProductId = new mongoose.Types.ObjectId();
  const secondVariantId = new mongoose.Types.ObjectId();
  const products = new Map([[String(productId), product], [String(secondProductId), { _id: secondProductId, name: "Verified trousers", description: "Denim trousers" }]]);
  const variants = new Map([[String(variantId), variant], [String(secondVariantId), { _id: secondVariantId, product_id: secondProductId, title: "Black / 32", sku: "TROUSER-B32", selling_price: 33300 }]]);
  replace(Product, "findOne", (filter) => asQuery(products.get(String(filter._id))), restore);
  replace(Variant, "findOne", (filter) => asQuery(String(filter.product_id) === String(variants.get(String(filter._id))?.product_id) ? variants.get(String(filter._id)) : null), restore);
  try {
    const snapshot = await controller._buildMessageContext({ body: { context: { kind: "product", products: [{ productId, variantId }, { productId: secondProductId, variantId: secondVariantId }] } } }, {});
    assert.equal(snapshot.item_count, 2);
    assert.equal(snapshot.items[0].product_name, "Verified shirt");
    assert.equal(snapshot.items[1].product_name, "Verified trousers");
    assert.equal(snapshot.items[1].variant_name, "Black / 32");
    assert.equal(snapshot.total, 34550);
    await assert.rejects(controller._buildMessageContext({ body: { context: { kind: "product", products: [{ productId, variantId: secondVariantId }] } } }, {}), /no longer available/);
    await assert.rejects(controller._buildMessageContext({ body: { context: { kind: "product", products: Array(21).fill({ productId, variantId }) } } }, {}), /between 1 and 20/);
  } finally { restore.reverse().forEach((fn) => fn()); }
});

test("cart context ignores client prices and names and keeps its own item snapshot", async () => {
  await withCatalog(async () => {
    const restore = [];
    replace(Cart, "findOne", () => ({ async lean() { return { items: [{ productId, variant_id: variantId, qty: 2, name: "Forged name", price: 0.01 }] }; } }), restore);
    try {
      const snapshot = await controller._buildMessageContext({ body: { context: { kind: "cart" } }, user: { _id: userId, role: "user" }, userType: "user" }, {});
      assert.equal(snapshot.label, "Cart question");
      assert.equal(snapshot.item_count, 1);
      assert.equal(snapshot.items[0].product_name, "Verified shirt");
      assert.equal(snapshot.items[0].unit_price, 1250);
      assert.equal(snapshot.items[0].qty, 2);
      assert.equal(snapshot.items[0].line_total, 2500);
      assert.equal(snapshot.total, 2500);
    } finally { restore.reverse().forEach((fn) => fn()); }
  });
});

test("guest cart message context accepts identifiers and quantities but not submitted prices", async () => {
  await withCatalog(async () => {
    const snapshot = await controller._buildMessageContext({ chatGuest: true, body: { context: { kind: "cart", items: [{ productId, variant_id: variantId, qty: 3, name: "Fake product", price: 0 }] } } }, {});
    assert.equal(snapshot.items[0].product_name, "Verified shirt");
    assert.equal(snapshot.items[0].unit_price, 1250);
    assert.equal(snapshot.total, 3750);
  });
});

test("order message context can attach a selected owned order to a general conversation", async () => {
  const restore = [];
  replace(Order, "findOne", (filter) => {
    assert.equal(String(filter._id), String(orderId));
    assert.equal(String(filter.user_id), String(userId));
    return asQuery({ _id: orderId, order_number: "ORD-1001", status: "shipped", total: 1350, items: [{ product_id: productId, variant_id: variantId, name: "Purchased shirt", variantTitle: "Blue / Medium", price: 1350, qty: 1 }] });
  }, restore);
  try {
    const snapshot = await controller._buildMessageContext({ body: { context: { kind: "order", orderId } }, user: { _id: userId, role: "user" }, userType: "user" }, { order_id: null, inquiry_context: null });
    assert.equal(snapshot.order_number, "ORD-1001");
    assert.equal(snapshot.order_status, "shipped");
    assert.equal(snapshot.items[0].product_name, "Purchased shirt");
    assert.equal(snapshot.items[0].unit_price, 1350);
    assert.equal(snapshot.total, 1350);
  } finally { restore.reverse().forEach((fn) => fn()); }
});

test("general context stays empty and cannot be mixed with cart data", async () => {
  const snapshot = await controller._buildMessageContext({ body: { context: { kind: "general", items: [{ productId, variant_id: variantId, qty: 1 }] } } }, { inquiry_type: "cart" });
  assert.equal(snapshot, null);
});

test("each sent message stores its own snapshot and the Socket.IO event carries it", async () => {
  await withCatalog(async () => {
    const restore = [];
    const conversation = { _id: new mongoose.Types.ObjectId(), customer_id: userId, status: "open", inquiry_type: "general" };
    const saved = [];
    const events = [];
    replace(ChatConversation, "findById", () => ({ select() { return this; }, populate() { return this; }, lean() { return this; }, then(resolve, reject) { return Promise.resolve({ ...conversation }).then(resolve, reject); } }), restore);
    replace(ChatConversation, "findOneAndUpdate", () => ({ async lean() { return { ...conversation }; } }), restore);
    replace(ChatConversation, "aggregate", async () => [{ total: 0 }], restore);
    replace(ChatMessage, "create", async (data) => {
      saved.push(data);
      return { ...data, _id: new mongoose.Types.ObjectId(), created_at: new Date(), toObject() { return { ...data, _id: this._id, created_at: this.created_at }; } };
    }, restore);
    const io = { to: (room) => ({ emit: (event, payload) => events.push({ room, event, payload }) }) };
    const send = async (body) => {
      let response;
      const res = { status(code) { this.code = code; return this; }, json(value) { response = value; return this; } };
      await controller.sendMessage({ params: { id: conversation._id }, body, user: { _id: userId, role: "user", name: "Customer" }, userType: "user", io }, res);
      assert.equal(res.code, 201, response?.message);
      assert.equal(response.success, true);
    };
    try {
      await send({ text: "This variant is wrong", context: { kind: "product", productId, variantId, price: 0.01 } });
      await send({ text: "A separate general question", context: { kind: "general", items: [{ productId, variant_id: variantId, qty: 9 }] } });
      assert.equal(saved[0].context_snapshot.product_name, "Verified shirt");
      assert.equal(saved[1].context_snapshot, null);
      const realtime = events.find((event) => event.event === "chat:message")?.payload.message;
      assert.equal(realtime.context_snapshot.product_name, "Verified shirt");
      assert.equal(realtime.context_snapshot.unit_price, 1250);
    } finally { restore.reverse().forEach((fn) => fn()); }
  });
});

test("HTTP chat sends reject message 31 before save and leave admins unrestricted", async () => {
  const restore = [];
  const customerId = new mongoose.Types.ObjectId();
  const conversation = { _id: new mongoose.Types.ObjectId(), customer_id: customerId, status: "open", inquiry_type: "general" };
  let savedMessages = 0;
  replace(ChatConversation, "findById", () => ({ select() { return this; }, populate() { return this; }, lean() { return this; }, then(resolve, reject) { return Promise.resolve({ ...conversation }).then(resolve, reject); } }), restore);
  replace(ChatConversation, "findOneAndUpdate", () => ({ async lean() { return { ...conversation }; } }), restore);
  replace(ChatConversation, "aggregate", async () => [], restore);
  replace(ChatMessage, "create", async (data) => {
    savedMessages += 1;
    return { ...data, _id: new mongoose.Types.ObjectId(), created_at: new Date(), toObject() { return { ...data, _id: this._id, created_at: this.created_at }; } };
  }, restore);
  const events = [];
  const io = { to: (room) => ({ emit: (event, payload) => events.push({ room, event, payload }) }) };
  const invoke = async (user, userType, role, text) => {
    let response;
    const res = { status(code) { this.code = code; return this; }, set() { return this; }, json(body) { response = body; return this; } };
    await controller.sendMessage({ params: { id: conversation._id }, body: { text }, user: { _id: user, role, name: role }, userType, io }, res);
    return { status: res.code, body: response };
  };
  try {
    for (let index = 0; index < 30; index += 1) assert.equal((await invoke(customerId, "user", "user", `Message ${index + 1}`)).status, 201);
    const rejected = await invoke(customerId, "user", "user", "Message 31");
    assert.equal(rejected.status, 429);
    assert.equal(rejected.body.success, false);
    assert.equal(rejected.body.code, "CHAT_MESSAGE_RATE_LIMIT");
    assert.equal(rejected.body.message, "You are sending messages too quickly. Please try again later.");
    assert.ok(rejected.body.retryAfter >= 1);
    assert.equal(savedMessages, 30);
    assert.equal(events.filter((event) => event.event === "chat:message").length, 30);
    for (let index = 0; index < 31; index += 1) assert.equal((await invoke(new mongoose.Types.ObjectId(), "employee", "admin", `Admin reply ${index + 1}`)).status, 201);
  } finally { restore.reverse().forEach((fn) => fn()); }
});

