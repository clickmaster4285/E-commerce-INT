// Socket room routing: admin data kabhi public room me nahi (optimizeplan.md §2.1 / §9.3)
const test = require("node:test");
const assert = require("node:assert/strict");
const { runWithStore } = require("../utils/tenantContext");
const { _rooms, relayToStore } = require("../utils/socket");

const { createTenantIO, adminRoom, storeRoom, customerRoom } = _rooms;
const STORE = "6b03bef060c6605e32775f6d";

// Fake socket.io Server: to(room).emit(...) record karta hai
const fakeServer = () => {
  const sent = [];
  return {
    sent,
    to(room) {
      return { emit: (event, payload) => { sent.push({ room, event, payload }); return true; } };
    },
    emit(event, payload) { sent.push({ room: "*", event, payload }); return true; },
  };
};
const inRoom = (sent, room) => sent.filter((s) => s.room === room);

test("io.emit in store context: full payload only to the admin room for admin-only events", () => {
  const server = fakeServer();
  const io = createTenantIO(server);
  runWithStore(STORE, () => io.emit("vendorCreated", { _id: "v1", bank_details: { account_no: "123" } }));
  assert.equal(inRoom(server.sent, adminRoom(STORE)).length, 1);
  assert.equal(inRoom(server.sent, adminRoom(STORE))[0].payload.bank_details.account_no, "123");
  assert.equal(inRoom(server.sent, storeRoom(STORE)).length, 0, "vendor data never reaches the public room");
});

test("public events reach storefront with the id only", () => {
  const server = fakeServer();
  const io = createTenantIO(server);
  const product = { _id: "p1", name: "Shirt", variants: [{ cost_price: 4 }], createdby: { email: "staff@x.com" } };
  runWithStore(STORE, () => io.emit("productUpdated", product));
  assert.deepEqual(inRoom(server.sent, adminRoom(STORE))[0].payload, product);
  assert.deepEqual(inRoom(server.sent, storeRoom(STORE))[0].payload, { _id: "p1" });
});

test("wrapped payloads ({success,data}) are unwrapped to the id", () => {
  const server = fakeServer();
  const io = createTenantIO(server);
  runWithStore(STORE, () => io.emit("deal:updated", { success: true, data: { _id: "d1", usageLimit: 5 } }));
  assert.deepEqual(inRoom(server.sent, storeRoom(STORE))[0].payload, { _id: "d1" });
});

test("storeUpdated goes public as { changed: true } (no activity log / token)", () => {
  const server = fakeServer();
  const io = createTenantIO(server);
  runWithStore(STORE, () => io.emit("storeUpdated", { _id: STORE, activity: [{ actorName: "x" }], domainVerifyToken: "t" }));
  assert.deepEqual(inRoom(server.sent, storeRoom(STORE))[0].payload, { changed: true });
});

test("stockUpdated keeps only product/variant id and quantity for the public room", () => {
  const server = fakeServer();
  const io = createTenantIO(server);
  runWithStore(STORE, () => io.emit("stockUpdated", { productId: "p1", variantId: "v1", quantity: 3, history: { performed_by_name: "Ali" } }));
  assert.deepEqual(inRoom(server.sent, storeRoom(STORE))[0].payload, { productId: "p1", variantId: "v1", quantity: 3 });
});

test("order events: full order to admins, only { _id } to the owning customer, nothing public", () => {
  const server = fakeServer();
  const io = createTenantIO(server);
  const order = { _id: "o1", user_id: "u9", address_snapshot: { phone: "0300" } };
  runWithStore(STORE, () => io.emit("order:statusChanged", { success: true, data: order }));
  assert.equal(inRoom(server.sent, adminRoom(STORE))[0].payload.data.address_snapshot.phone, "0300");
  assert.deepEqual(inRoom(server.sent, customerRoom("u9"))[0].payload, { _id: "o1" });
  assert.equal(inRoom(server.sent, storeRoom(STORE)).length, 0);
});

test("relayToStore: employee → admin room, storefront socket → public room", () => {
  const rooms = [];
  const socket = (userType) => ({ tenantStoreId: STORE, userType, to: (room) => { rooms.push(room); return {}; }, broadcast: {} });
  relayToStore(socket("employee"));
  relayToStore(socket("user"));
  assert.deepEqual(rooms, [adminRoom(STORE), storeRoom(STORE)]);
});

test("platform context (no store) keeps the global emit", () => {
  const server = fakeServer();
  const io = createTenantIO(server);
  io.emit("superadmin:event", { a: 1 });
  assert.equal(server.sent[0].room, "*");
});
