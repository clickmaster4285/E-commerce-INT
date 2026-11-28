// §7.1 — /health (liveness) + /ready (Mongo [+ Redis]) + metrics stub
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";
process.env.ROOT_DOMAIN = process.env.ROOT_DOMAIN || "root.test";


const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app");
const metrics = require("../utils/metrics");

const API = process.env.API_PREFIX || "/api";
const PLATFORM = "root.test";
process.env.REDIS_URL = ""; // app .env load kar leta hai; Redis check sirf jab REDIS_URL ho

// connection.readyState ko fake karo (real DB ki zarurat nahi)
function fakeReadyState(value) {
  Object.defineProperty(mongoose.connection, "readyState", { configurable: true, get: () => value });
}
test.afterEach(() => { delete mongoose.connection.readyState; });

test("GET /health → 200 (liveness, DB se independent)", async () => {
  fakeReadyState(0);
  const res = await request(app).get(`${API}/health`).set("Host", PLATFORM);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test("GET /ready → 503 + checks.mongo=false jab Mongo connected nahi", async () => {
  fakeReadyState(0);
  const res = await request(app).get(`${API}/ready`).set("Host", PLATFORM);
  assert.equal(res.status, 503);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.checks.mongo, false);
});

test("GET /ready → 200 {ok:true} jab Mongo connected (readyState 1)", async () => {
  fakeReadyState(1);
  const res = await request(app).get(`${API}/ready`).set("Host", PLATFORM);
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true });
});

test("GET /ready store/unknown host par bhi khula rehta hai (probe Host ka muhtaj nahi)", async () => {
  fakeReadyState(1);
  const res = await request(app).get(`${API}/ready`).set("Host", "127.0.0.1");
  assert.notEqual(res.status, 404);
});

test("metrics stub counts requests and 5xx", async () => {
  metrics.reset();
  fakeReadyState(0);
  await request(app).get(`${API}/health`).set("Host", PLATFORM);
  await request(app).get(`${API}/ready`).set("Host", PLATFORM); // 503
  const snap = metrics.snapshot();
  assert.ok(snap.requestCount >= 2);
  assert.ok(snap.byStatusClass["2xx"] >= 1);
  assert.ok(snap.byStatusClass["5xx"] >= 1);
  assert.ok(snap.errorCount >= 1);
});
