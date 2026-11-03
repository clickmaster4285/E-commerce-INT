const test = require("node:test");
const assert = require("node:assert/strict");
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });
const {
  createChatMessageRateLimiter,
  CHAT_MESSAGE_RATE_LIMIT,
  CHAT_MESSAGE_RATE_WINDOW_MS,
  limiters,
} = require("../middleware/rateLimit");
const chatRouter = require("../routes/chatRoutes");

test("chat rate-limit configuration has valid fallback values", () => {
  assert.ok(Number.isSafeInteger(CHAT_MESSAGE_RATE_LIMIT) && CHAT_MESSAGE_RATE_LIMIT > 0);
  assert.ok(Number.isSafeInteger(CHAT_MESSAGE_RATE_WINDOW_MS) && CHAT_MESSAGE_RATE_WINDOW_MS > 0);
  assert.equal(CHAT_MESSAGE_RATE_LIMIT, Number(process.env.CHAT_MESSAGE_RATE_LIMIT || 30));
  assert.equal(CHAT_MESSAGE_RATE_WINDOW_MS, Number(process.env.CHAT_MESSAGE_RATE_WINDOW_MS || 60000));
});

test("allows the configured count, rejects the next message, then resets after the window", async () => {
  let time = 1000;
  const consume = createChatMessageRateLimiter({ limit: 30, windowMs: 60000, now: () => time });
  for (let index = 0; index < 30; index += 1) assert.equal((await consume("customer:alice")).allowed, true);
  const rejected = await consume("customer:alice");
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.count, 30);
  assert.equal(rejected.retryAfterMs, 60000);
  time += 60000;
  assert.equal((await consume("customer:alice")).allowed, true);
});

test("customer identities are independent and multiple tabs share one account counter", async () => {
  const consume = createChatMessageRateLimiter({ limit: 2, windowMs: 60000, now: () => 5000 });
  assert.equal((await consume("customer:alice")).allowed, true); // HTTP tab
  assert.equal((await consume("customer:alice")).allowed, true); // Socket-connected second tab
  assert.equal((await consume("customer:alice")).allowed, false); // another tab
  assert.equal((await consume("customer:bob")).allowed, true);
});

test("two application instances share one atomic Redis-backed account counter", async () => {
  let time = 0;
  const shared = new Map();
  const redisClient = {
    async eval(_script, _keyCount, key, windowMs) {
      let entry = shared.get(key);
      if (!entry || time >= entry.expiresAt) {
        entry = { count: 0, expiresAt: time + Number(windowMs) };
        shared.set(key, entry);
      }
      entry.count += 1;
      return [entry.count, entry.expiresAt - time];
    },
  };
  const instanceOne = createChatMessageRateLimiter({ limit: 2, windowMs: 60000, redisClientProvider: () => redisClient, now: () => time });
  const instanceTwo = createChatMessageRateLimiter({ limit: 2, windowMs: 60000, redisClientProvider: () => redisClient, now: () => time });
  assert.equal((await instanceOne("customer:alice")).allowed, true);
  assert.equal((await instanceTwo("customer:alice")).allowed, true);
  assert.equal((await instanceOne("customer:alice")).allowed, false);
  assert.equal((await instanceTwo("customer:bob")).allowed, true);
  time += 60000;
  assert.equal((await instanceTwo("customer:alice")).allowed, true);
});

test("customer chat open and message routes do not use the legacy shared IP throttle", () => {
  const routes = chatRouter.stack.filter((layer) => layer.route);
  const generalOpen = routes.find((layer) => layer.route.path === "/general" && layer.route.methods.post);
  const orderOpen = routes.find((layer) => layer.route.path === "/order/:orderId" && layer.route.methods.post);
  const customerSend = routes.find((layer) => layer.route.path === "/:id/messages" && layer.route.methods.post);
  const guestSend = routes.find((layer) => layer.route.path === "/guest/:id/messages" && layer.route.methods.post);
  const customerContext = routes.find((layer) => layer.route.path === "/:id/context" && layer.route.methods.patch);
  const guestContext = routes.find((layer) => layer.route.path === "/guest/:id/context" && layer.route.methods.patch);
  assert.ok(customerSend);
  assert.ok(guestSend);
  assert.ok(customerContext);
  assert.ok(guestContext);
  assert.ok(generalOpen);
  assert.ok(orderOpen);
  for (const layer of [generalOpen, orderOpen, customerSend, guestSend, customerContext, guestContext]) {
    assert.equal(layer.route.stack.some((item) => item.handle === limiters.chat), false);
  }
  const guestStart = routes.find((layer) => layer.route.path === "/guest/start" && layer.route.methods.post);
  assert.ok(guestStart?.route.stack.some((item) => item.handle === limiters.chat), "anonymous chat creation keeps its abuse throttle");
});

