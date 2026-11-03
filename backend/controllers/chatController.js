const mongoose = require("mongoose");
const crypto = require("crypto");
const ChatConversation = require("../models/ChatConversation");
const ChatMessage = require("../models/ChatMessage");
const Order = require("../models/Order");
const User = require("../models/User");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Cart = require("../models/Cart");
const { consumeChatMessageRateLimit, CHAT_MESSAGE_RATE_LIMITED_MESSAGE } = require("../middleware/rateLimit");

const MAX_MESSAGE_LENGTH = 4000;
const escapeRegex = (value) => String(value || "").replace(/[-/\^$*+?.()|[\]{}]/g, "\\$&");
const roleOf = (req) => String(req.user?.role || "").toLowerCase();
const isStaff = (req) => req.userType === "employee" && ["admin", "manager", "staff"].includes(roleOf(req)) && (roleOf(req) === "admin" || req.user?.permissions?.order !== false);
const isCustomer = (req) => req.userType === "user" && roleOf(req) === "user";
const guestTokenOf = (req) => typeof req.headers?.["x-chat-guest-token"] === "string" ? req.headers["x-chat-guest-token"].trim() : "";
const guestTokenHash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const roomOf = (id) => "chat:conversation:" + String(id);
const fail = (res, status, message) => res.status(status).json({ success: false, message });
const publicConversation = (row) => {
  if (!row) return null;
  const value = { ...row };
  delete value.guest_token_hash;
  if (value.customer_id && typeof value.customer_id === "object") { value.customer = value.customer_id; value.customer_id = value.customer_id._id; }
  if (value.order_id && typeof value.order_id === "object") { value.order = value.order_id; value.order_id = value.order_id._id; }
  return value;
};
const ORDER_LIST_FIELDS = "order_number status total created_at";
const ORDER_CHAT_FIELDS = "order_number status total subtotal shipping tax created_at payment shipping_method address_snapshot items";
const validId = (value) => mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : null;
const contextError = (status, message) => Object.assign(new Error(message), { status });
const money = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const snapshotOrderItem = (item) => ({
  product_id: validId(item.product_id?._id || item.product_id),
  product_name: String(item.name || "Product").slice(0, 160),
  variant_id: validId(item.variant_id?._id || item.variant_id),
  variant_name: String(item.variantTitle || "").slice(0, 160),
  variant_image: String(item.image || item.variant_image || "").slice(0, 300),
  sku: String(item.sku || "").slice(0, 80),
  qty: Math.max(1, Math.min(999, Number(item.qty) || 1)),
  unit_price: money(Math.max(0, Number(item.price) || 0)),
  line_total: money(Math.max(0, Number(item.price) || 0) * Math.max(1, Math.min(999, Number(item.qty) || 1))),
});
async function buildMessageContext(req, conversation) {
  const input = req.body?.context && typeof req.body.context === "object" ? req.body.context : {};
  const kind = String(input.kind || conversation.inquiry_type || "general").toLowerCase();
  if (kind === "general") return null;
  if (!["cart", "product", "order"].includes(kind)) throw contextError(400, "Choose a valid chat topic");

  if (kind === "product") {
    const selected = Array.isArray(input.products) ? input.products : [{
      productId: input.productId || conversation.inquiry_product_id || conversation.inquiry_context?.product_id,
      variantId: input.variantId || conversation.inquiry_variant_id || conversation.inquiry_context?.variant_id,
    }];
    if (!selected.length || selected.length > 20) throw contextError(400, "Select between 1 and 20 product variants");
    const seenVariants = new Set();
    const items = [];
    for (const selection of selected) {
      const productId = validId(selection.productId || selection.product_id);
      const variantId = validId(selection.variantId || selection.variant_id);
      if (!productId || !variantId) throw contextError(400, "Each selection must include a valid product variant");
      if (seenVariants.has(String(variantId))) continue;
      seenVariants.add(String(variantId));
      const [product, variant] = await Promise.all([
        Product.findOne({ _id: productId, is_deleted: { $ne: true }, status: { $ne: "inactive" } }).select("name description").lean(),
        Variant.findOne({ _id: variantId, product_id: productId, is_deleted: { $ne: true }, status: { $ne: "inactive" } }).select("title sku selling_price images.img_url").lean(),
      ]);
      if (!product || !variant) throw contextError(404, "A selected product variant is no longer available");
      const unitPrice = money(Math.max(0, Number(variant.selling_price) || 0));
      items.push({ product_id: product._id, product_name: product.name, product_description: String(product.description || "").slice(0, 1000), variant_id: variant._id, variant_name: variant.title, variant_image: String(variant.images?.[0]?.img_url || "").slice(0, 300), sku: variant.sku, qty: 1, unit_price: unitPrice, line_total: unitPrice });
    }
    if (!items.length) throw contextError(400, "Select at least one product variant");
    const first = items[0];
    return {
      kind, label: items.length === 1 ? "Product question" : `Product question · ${items.length} selected`,
      product_id: first.product_id, product_name: first.product_name, product_description: first.product_description,
      variant_id: first.variant_id, variant_name: first.variant_name, sku: first.sku, unit_price: first.unit_price,
      item_count: items.length, total: money(items.reduce((sum, item) => sum + item.line_total, 0)), items,
    };
  }

  if (kind === "cart") {
    let sourceItems = [];
    if (isCustomer(req)) {
      const cart = await Cart.findOne({ user_id: req.user._id }).lean();
      sourceItems = Array.isArray(cart?.items) ? cart.items : [];
    } else if (req.chatGuest) {
      if (!Array.isArray(input.items)) throw contextError(400, "Cart details are missing; refresh your cart and try again");
      sourceItems = input.items;
    } else {
      throw contextError(403, "Only the customer can attach cart details");
    }
    if (sourceItems.length > 30) throw contextError(400, "A maximum of 30 cart items can be attached");

    const items = [];
    for (const source of sourceItems) {
      const productId = validId(source.productId || source.product_id?._id || source.product_id || source.id);
      const variantId = validId(source.variant_id?._id || source.variant_id || source.variantId);
      const qty = Number(source.qty);
      if (!productId || !variantId || !Number.isInteger(qty) || qty < 1 || qty > 999) {
        throw contextError(400, "A cart item is missing a valid product, variant, or quantity");
      }
      const [product, variant] = await Promise.all([
        Product.findOne({ _id: productId, is_deleted: { $ne: true } }).select("name").lean(),
        Variant.findOne({ _id: variantId, product_id: productId, is_deleted: { $ne: true } }).select("title sku selling_price images.img_url").lean(),
      ]);
      if (!product || !variant) throw contextError(400, "A cart item is no longer available; refresh your cart and try again");
      const unitPrice = money(Math.max(0, Number(variant.selling_price) || 0));
      items.push({ product_id: product._id, product_name: product.name, variant_id: variant._id, variant_name: variant.title, variant_image: String(variant.images?.[0]?.img_url || "").slice(0, 300), sku: variant.sku, qty, unit_price: unitPrice, line_total: money(unitPrice * qty) });
    }
    const total = money(items.reduce((sum, item) => sum + item.line_total, 0));
    return { kind, label: "Cart question", item_count: items.length, total, items };
  }

  const orderId = validId(input.orderId || conversation.inquiry_context?.order_id || conversation.order_id);
  if (!orderId) throw contextError(400, "Choose an order to attach to this question");
  if (!isCustomer(req)) throw contextError(403, "Only signed-in customers can ask about an order");
  const order = await Order.findOne({ _id: orderId, user_id: req.user._id }).select(ORDER_CHAT_FIELDS).lean();
  if (!order) throw contextError(404, "Order not found");
  const items = (Array.isArray(order.items) ? order.items : []).slice(0, 100).map(snapshotOrderItem);
  return {
    kind, label: `Order #${order.order_number}`, order_id: order._id, order_number: order.order_number,
    order_status: order.status, total: money(order.total), item_count: items.length, items,
  };
}
const populateConversation = (query, includeOrderDetails = false) => query.populate("customer_id", "name email phone").populate("order_id", includeOrderDetails ? ORDER_CHAT_FIELDS : ORDER_LIST_FIELDS);
async function adminUnreadCount() {
  const [row] = await ChatConversation.aggregate([{ $group: { _id: null, total: { $sum: "$unread_admin_count" } } }]);
  return Number(row?.total) || 0;
}
async function emitAdminUnread(io) { if (io) { try { io.to("chat:admins").emit("chat:unread-count", { count: await adminUnreadCount() }); } catch {} } }
async function emitConversation(io, id) {
  if (!io) return;
  const row = await populateConversation(ChatConversation.findById(id).select("+guest_token_hash").lean());
  const item = publicConversation(row);
  if (item) {
    io.to("chat:admins").emit("chat:conversation-updated", item);
    if (item.customer_id) io.to("chat:customer:" + String(item.customer_id)).emit("chat:conversation-updated", item);
    if (row.guest_token_hash) io.to("chat:guest:" + row.guest_token_hash).emit("chat:conversation-updated", item);
    io.to(roomOf(id)).emit("chat:conversation-updated", item);
  }
}
async function authorize(req, res, id) {
  if (!mongoose.isValidObjectId(id)) { fail(res, 400, "Invalid conversation id"); return null; }
  const query = ChatConversation.findById(id);
  if (req.chatGuest) query.select("+guest_token_hash");
  const conversation = await query.lean();
  if (!conversation) { fail(res, 404, "Conversation not found"); return null; }
  if (req.chatGuest && guestTokenOf(req) && conversation.guest_token_hash === guestTokenHash(guestTokenOf(req))) return conversation;
  if (isStaff(req) || (isCustomer(req) && String(conversation.customer_id) === String(req.user._id))) return conversation;
  fail(res, 403, "You are not allowed to access this conversation");
  return null;
}

exports.openForOrder = async (req, res) => {
  try {
    if (!isCustomer(req)) return fail(res, 403, "Customer account required");
    if (!mongoose.isValidObjectId(req.params.orderId)) return fail(res, 400, "Invalid order id");
    const order = await Order.findOne({ _id: req.params.orderId, user_id: req.user._id }).select(ORDER_CHAT_FIELDS).lean();
    if (!order) return fail(res, 404, "Order not found");
    let conversation = await ChatConversation.findOne({ customer_id: req.user._id, order_id: order._id, status: "open" }).lean();
    let created = false;
    if (!conversation) {
      try { conversation = (await ChatConversation.create({ customer_id: req.user._id, order_id: order._id, inquiry_type: "order", inquiry_context: { label: `Order #${order.order_number}` } })).toObject(); created = true; }
      catch (error) {
        if (error.code !== 11000) throw error;
        conversation = await ChatConversation.findOne({ customer_id: req.user._id, order_id: order._id, status: "open" }).lean();
        if (!conversation) throw error;
      }
    }
    const contextUpdated = conversation.inquiry_type !== "order";
    if (contextUpdated) {
      await ChatConversation.updateOne({ _id: conversation._id }, { $set: { inquiry_type: "order", inquiry_context: { label: `Order #${order.order_number}` }, inquiry_product_id: null, inquiry_variant_id: null } });
      conversation.inquiry_type = "order";
      conversation.inquiry_context = { label: `Order #${order.order_number}` };
    }
    if (created && req.io) {
      const row = await populateConversation(ChatConversation.findById(conversation._id).lean());
      req.io.to("chat:admins").emit("chat:conversation-created", publicConversation(row));
      req.io.to("chat:customer:" + String(req.user._id)).emit("chat:conversation-created", publicConversation(row));
      await emitAdminUnread(req.io);
    }
    if (!created && contextUpdated && req.io) await emitConversation(req.io, conversation._id);
    res.status(created ? 201 : 200).json({ success: true, data: { ...conversation, order } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.openGeneral = async (req, res) => {
  try {
    if (!isCustomer(req)) return fail(res, 403, "Customer account required");
    let conversation = await ChatConversation.findOne({ customer_id: req.user._id, order_id: null, status: "open" }).lean();
    let created = false;
    if (!conversation) {
      try { conversation = (await ChatConversation.create({ customer_id: req.user._id, order_id: null })).toObject(); created = true; }
      catch (error) {
        if (error.code !== 11000) throw error;
        conversation = await ChatConversation.findOne({ customer_id: req.user._id, order_id: null, status: "open" }).lean();
        if (!conversation) throw error;
      }
    }
    if (created && req.io) {
      const row = await populateConversation(ChatConversation.findById(conversation._id).lean());
      const item = publicConversation(row);
      req.io.to("chat:admins").emit("chat:conversation-created", item);
      req.io.to("chat:customer:" + String(req.user._id)).emit("chat:conversation-created", item);
      await emitAdminUnread(req.io);
    }
    const row = await populateConversation(ChatConversation.findById(conversation._id).lean(), true);
    res.status(created ? 201 : 200).json({ success: true, data: publicConversation(row) });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.updateInquiryContext = async (req, res) => {
  try {
    const conversation = await authorize(req, res, req.params.id);
    if (!conversation) return;
    if (!isCustomer(req) && !req.chatGuest) return fail(res, 403, "Only the conversation owner can change its inquiry topic");
    if (conversation.status !== "open") return fail(res, 409, "Reopen this conversation to change its topic");
    const type = String(req.body?.type || "general");
    if (!["general", "product", "cart", "order"].includes(type)) return fail(res, 400, "Choose a valid inquiry type");
    let context = { label: "General support" };
    let productRef = null;
    let variantRef = null;
    if (type !== "general") {
      const contextReq = { body: { context: { kind: type, productId: req.body?.productId, variantId: req.body?.variantId, products: req.body?.products, orderId: req.body?.orderId || conversation.inquiry_context?.order_id || conversation.order_id, items: req.body?.items } }, user: req.user, userType: req.userType, chatGuest: req.chatGuest };
      let snapshot;
      try { snapshot = await buildMessageContext(contextReq, conversation); }
      catch (error) { return fail(res, error.status || 500, error.message || "Could not verify the selected chat context"); }
      if (type === "product") {
        productRef = snapshot.product_id;
        variantRef = snapshot.variant_id;
        context = { product_id: snapshot.product_id, variant_id: snapshot.variant_id, label: snapshot.label, variant: snapshot.variant_name, sku: snapshot.sku, price: snapshot.unit_price, products: snapshot.items.map((item) => ({ product_id: item.product_id, product_name: item.product_name, variant_id: item.variant_id, variant_name: item.variant_name, sku: item.sku, price: item.unit_price })) };
      } else if (type === "cart") {
        context = { label: `${snapshot.item_count} cart ${snapshot.item_count === 1 ? "item" : "items"}`, item_count: snapshot.item_count, items: snapshot.items.map((item) => ({ product_id: item.product_id, product_name: item.product_name, variant_id: item.variant_id, variant_name: item.variant_name, image: item.variant_image, sku: item.sku, qty: item.qty, price: item.unit_price, unit_price: item.unit_price, line_total: item.line_total })), total: snapshot.total };
      } else if (type === "order") {
        context = { order_id: snapshot.order_id, order_number: snapshot.order_number, order_status: snapshot.order_status, item_count: snapshot.item_count, items: snapshot.items, total: snapshot.total, label: snapshot.label };
      } else {
        context = { label: snapshot.label };
      }
    }
    await ChatConversation.updateOne({ _id: conversation._id, status: "open" }, { $set: { inquiry_type: type, inquiry_context: context, inquiry_product_id: productRef, inquiry_variant_id: variantRef } });
    if (req.io) await emitConversation(req.io, conversation._id);
    const row = await populateConversation(ChatConversation.findById(conversation._id).lean(), true);
    res.json({ success: true, data: publicConversation(row) });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.startGuest = async (req, res) => {
  try {
    const suppliedToken = guestTokenOf(req);
    if (suppliedToken) {
      let existing = await ChatConversation.findOne({ guest_token_hash: guestTokenHash(suppliedToken) }).select("+guest_token_hash").lean();
      if (existing) {
        const wasClosed = existing.status === "closed";
        if (existing.status === "closed") {
          await ChatConversation.updateOne({ _id: existing._id, status: "closed" }, { $set: { status: "open" } });
          existing = await ChatConversation.findById(existing._id).select("+guest_token_hash").lean();
        }
        if (wasClosed && req.io) { await emitConversation(req.io, existing._id); await emitAdminUnread(req.io); }
        const row = await populateConversation(ChatConversation.findById(existing._id).lean(), true);
        return res.json({ success: true, data: { token: suppliedToken, conversation: publicConversation(row) } });
      }
    }
    const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ").slice(0, 80) : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase().slice(0, 254) : "";
    if (!name) return fail(res, 400, "Name is required");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, "A valid email address is required");
    const token = crypto.randomBytes(32).toString("hex");
    const conversation = await ChatConversation.create({ guest_name: name, guest_email: email, guest_token_hash: guestTokenHash(token) });
    if (req.io) {
      const row = await populateConversation(ChatConversation.findById(conversation._id).lean());
      req.io.to("chat:admins").emit("chat:conversation-created", publicConversation(row));
      await emitAdminUnread(req.io);
    }
    const row = await populateConversation(ChatConversation.findById(conversation._id).lean(), true);
    res.status(201).json({ success: true, data: { token, conversation: publicConversation(row) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getGuestMine = async (req, res) => {
  try {
    const token = guestTokenOf(req);
    if (!token) return fail(res, 401, "Guest chat token required");
    const conversation = await ChatConversation.findOne({ guest_token_hash: guestTokenHash(token) }).select("+guest_token_hash").lean();
    if (!conversation) return fail(res, 404, "Guest conversation not found");
    const row = await populateConversation(ChatConversation.findById(conversation._id).lean(), true);
    res.json({ success: true, data: { conversation: publicConversation(row) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.requireGuestChat = async (req, res, next) => {
  try {
    const token = guestTokenOf(req);
    if (!token || !mongoose.isValidObjectId(req.params.id)) return fail(res, 401, "Guest chat authorization required");
    const conversation = await ChatConversation.findById(req.params.id).select("+guest_token_hash").lean();
    if (!conversation || !conversation.guest_token_hash || conversation.guest_token_hash !== guestTokenHash(token)) return fail(res, 403, "Guest chat access denied");
    req.chatGuest = true;
    req.chatGuestName = conversation.guest_name || "Guest";
    return next();
  } catch (error) { return fail(res, 500, "Could not authorize guest chat"); }
};

exports.listMine = async (req, res) => {
  try {
    if (!isCustomer(req)) return fail(res, 403, "Customer account required");
    const rows = await populateConversation(ChatConversation.find({ customer_id: req.user._id }).sort({ last_message_at: -1 }).lean());
    res.json({ success: true, data: rows.map(publicConversation) });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getConversation = async (req, res) => {
  try {
    const conversation = await authorize(req, res, req.params.id);
    if (!conversation) return;
    const row = await populateConversation(ChatConversation.findById(conversation._id).lean(), true);
    res.json({ success: true, data: publicConversation(row) });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.listAdmin = async (req, res) => {
  try {
    if (!isStaff(req)) return fail(res, 403, "Support access required");
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
    const filter = {};
    const status = String(req.query.status || "all");
    if (["open", "closed"].includes(status)) filter.status = status;
    if (status === "unread") filter.unread_admin_count = { $gt: 0 };
    const search = String(req.query.search || "").trim();
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      const [customers, orders] = await Promise.all([
        User.find({ $or: [{ name: regex }, { email: regex }, { phone: regex }] }).select("_id").lean(),
        Order.find({ order_number: regex }).select("_id").lean(),
      ]);
      filter.$or = [{ customer_id: { $in: customers.map((item) => item._id) } }, { order_id: { $in: orders.map((item) => item._id) } }, { "inquiry_context.order_number": regex }, { guest_name: regex }, { guest_email: regex }, { last_message: regex }];
    }
    const [total, rows] = await Promise.all([
      ChatConversation.countDocuments(filter),
      populateConversation(ChatConversation.find(filter).sort({ last_message_at: -1, updated_at: -1 }).skip((page - 1) * limit).limit(limit).lean()),
    ]);
    res.json({ success: true, data: rows.map(publicConversation), pagination: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.unreadCount = async (req, res) => {
  try { if (!isStaff(req)) return fail(res, 403, "Support access required"); res.json({ success: true, data: { count: await adminUnreadCount() } }); }
  catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getMessages = async (req, res) => {
  try {
    const conversation = await authorize(req, res, req.params.id);
    if (!conversation) return;
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const filter = { conversation_id: conversation._id };
    if (req.query.before) {
      if (!mongoose.isValidObjectId(req.query.before)) return fail(res, 400, "Invalid message cursor");
      const cursor = await ChatMessage.findOne({ _id: req.query.before, conversation_id: conversation._id }).select("created_at").lean();
      if (!cursor) return fail(res, 400, "Message cursor not found");
      filter.$or = [{ created_at: { $lt: cursor.created_at } }, { created_at: cursor.created_at, _id: { $lt: cursor._id } }];
    }
    const rows = await ChatMessage.find(filter).sort({ created_at: -1, _id: -1 }).limit(limit + 1).lean();
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).reverse();
    res.json({ success: true, data: { items, hasMore, nextCursor: hasMore ? items[0]?._id : null } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.sendMessage = async (req, res) => {
  try {
    const conversation = await authorize(req, res, req.params.id);
    if (!conversation) return;
    if (!isStaff(req) && !isCustomer(req) && !req.chatGuest) return fail(res, 403, "Chat access required");
    if (conversation.status !== "open") return fail(res, 409, "This conversation is closed. Reopen it before sending a message.");
    const messageText = (typeof req.body?.text === "string" ? req.body.text : "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
    if (!messageText) return fail(res, 400, "Message cannot be empty");
    if (messageText.length > MAX_MESSAGE_LENGTH) return fail(res, 400, "Message must be 4000 characters or fewer");
    const senderType = isStaff(req) ? "admin" : "customer";
    const senderName = isStaff(req) ? req.user.name : isCustomer(req) ? req.user.name : req.chatGuestName;
    let contextSnapshot = null;
    if (senderType === "customer" || (isStaff(req) && req.body?.context?.kind === "product")) {
      try { contextSnapshot = await buildMessageContext(req, conversation); }
      catch (error) { return fail(res, error.status || 500, error.message || "Could not verify the selected chat context"); }
      const identity = isCustomer(req) ? `customer:${String(req.user._id)}` : req.chatGuest ? `guest:${String(conversation.guest_token_hash || req.params.id)}` : null;
      if (identity) {
        const rate = await consumeChatMessageRateLimit(identity);
        if (!rate.allowed) {
          const retryAfter = Math.max(1, Math.ceil(rate.retryAfterMs / 1000));
          res.set?.("Retry-After", String(retryAfter));
          return res.status(429).json({ success: false, code: "CHAT_MESSAGE_RATE_LIMIT", message: CHAT_MESSAGE_RATE_LIMITED_MESSAGE, retryAfter });
        }
      }
    }
    const message = await ChatMessage.create({ conversation_id: conversation._id, sender_id: req.chatGuest ? null : req.user._id, sender_type: senderType, sender_name: String(senderName || "Support").trim().slice(0, 120), text: messageText, context_snapshot: contextSnapshot });
    const preview = messageText.length > 240 ? messageText.slice(0, 237) + "…" : messageText;
    const updated = await ChatConversation.findOneAndUpdate({ _id: conversation._id, status: "open" }, {
      $set: { last_message: preview, last_message_at: message.created_at, last_message_sender_type: senderType },
      $inc: senderType === "customer" ? { unread_admin_count: 1 } : { unread_customer_count: 1 },
    }, { new: true }).lean();
    if (!updated) { await ChatMessage.deleteOne({ _id: message._id }); return fail(res, 409, "This conversation was closed before the message could be sent"); }
    if (req.io) {
      req.io.to(roomOf(conversation._id)).emit("chat:message", { conversation_id: String(conversation._id), message: message.toObject() });
      await emitConversation(req.io, conversation._id);
      await emitAdminUnread(req.io);
    }
    res.status(201).json({ success: true, data: message.toObject() });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports._buildMessageContext = buildMessageContext;

exports.markRead = async (req, res) => {
  try {
    const conversation = await authorize(req, res, req.params.id);
    if (!conversation) return;
    const reader = isStaff(req) ? "admin" : "customer";
    await ChatMessage.updateMany({ conversation_id: conversation._id, sender_type: { $ne: reader }, read_at: null }, { $set: { read_at: new Date() } });
    await ChatConversation.updateOne({ _id: conversation._id }, { $set: reader === "admin" ? { unread_admin_count: 0 } : { unread_customer_count: 0 } });
    if (req.io) {
      req.io.to(roomOf(conversation._id)).emit("chat:read", { conversation_id: String(conversation._id), reader_type: reader, at: new Date() });
      await emitConversation(req.io, conversation._id);
      await emitAdminUnread(req.io);
    }
    res.json({ success: true, data: { conversation_id: String(conversation._id), reader_type: reader } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.updateStatus = async (req, res) => {
  try {
    if (!isStaff(req)) return fail(res, 403, "Support access required");
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 400, "Invalid conversation id");
    const status = String(req.body?.status || "");
    if (!["open", "closed"].includes(status)) return fail(res, 400, "Status must be open or closed");
    const conversation = await ChatConversation.findById(req.params.id);
    if (!conversation) return fail(res, 404, "Conversation not found");
    if (conversation.status !== status) { conversation.status = status; await conversation.save(); }
    if (req.io) { await emitConversation(req.io, conversation._id); await emitAdminUnread(req.io); }
    const row = await populateConversation(ChatConversation.findById(conversation._id).lean());
    res.json({ success: true, data: publicConversation(row) });
  } catch (error) { res.status(error.code === 11000 ? 409 : 500).json({ success: false, message: error.code === 11000 ? "An open conversation already exists for this order" : error.message }); }
};

exports.canUseInbox = (req, res, next) => isStaff(req) ? next() : fail(res, 403, "Support access required");
exports.canUseCustomerChat = (req, res, next) => isCustomer(req) ? next() : fail(res, 403, "Customer account required");
