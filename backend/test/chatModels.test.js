const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const ChatConversation = require("../models/ChatConversation");
const ChatMessage = require("../models/ChatMessage");
const validationError = async (document) => {
  try { await document.validate(); return null; }
  catch (error) { return error; }
};

test("conversation supports signed-in order chats, general chats, and anonymous chats", async () => {
  const conversation = new ChatConversation();
  const error = await validationError(conversation);
  assert.equal(error, null);

  const valid = new ChatConversation({ customer_id: new mongoose.Types.ObjectId(), order_id: new mongoose.Types.ObjectId() });
  assert.equal(valid.status, "open");
  assert.equal(valid.unread_admin_count, 0);
  assert.equal(valid.inquiry_type, "general");
  assert.equal(await validationError(valid), null);
  for (const type of ["general", "product", "cart", "order"]) assert.equal(await validationError(new ChatConversation({ inquiry_type: type })), null);
  assert.ok((await validationError(new ChatConversation({ inquiry_type: "invalid" })))?.errors.inquiry_type);
  assert.equal(await validationError(new ChatConversation({ customer_id: new mongoose.Types.ObjectId() })), null);
  assert.equal(await validationError(new ChatConversation({ guest_name: "Guest", guest_email: "guest@example.com", guest_token_hash: "a".repeat(64) })), null);
});

test("conversation has a partial unique index for one open order chat per customer", () => {
  const indexes = ChatConversation.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.customer_id === 1 && keys.order_id === 1 && options.unique && options.partialFilterExpression?.status === "open" && options.partialFilterExpression?.customer_id?.$type === "objectId"));
  assert.ok(indexes.some(([keys, options]) => keys.guest_token_hash === 1 && options.unique && options.sparse));
});

test("messages validate sender type, conversation, and non-empty bounded text", async () => {
  const base = { conversation_id: new mongoose.Types.ObjectId(), sender_id: new mongoose.Types.ObjectId(), sender_name: "Support", text: "Hello" };
  assert.equal(await validationError(new ChatMessage({ ...base, sender_type: "admin" })), null);
  assert.ok((await validationError(new ChatMessage({ ...base, sender_type: "other" })))?.errors.sender_type);
  assert.ok((await validationError(new ChatMessage({ ...base, sender_type: "customer", text: "  " })))?.errors.text);
  assert.ok((await validationError(new ChatMessage({ ...base, sender_type: "customer", text: "x".repeat(4001) })))?.errors.text);
  assert.equal(await validationError(new ChatMessage({ conversation_id: base.conversation_id, sender_type: "customer", sender_name: "Guest", text: "Hello" })), null);
  assert.equal(await validationError(new ChatMessage({ ...base, sender_type: "customer", context_snapshot: { kind: "cart", label: "Cart question", item_count: 1, total: 25, items: [{ product_name: "Shirt", variant_name: "Blue", qty: 1, unit_price: 25, line_total: 25 }] } })), null);
  assert.ok((await validationError(new ChatMessage({ ...base, sender_type: "customer", context_snapshot: { kind: "invalid", label: "Invalid" } })))?.errors["context_snapshot.kind"]);
});
