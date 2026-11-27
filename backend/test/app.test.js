// HTTP-level tests against the real Express app (optimizeplan.md §7.2) —
// app.js listen nahi karta, is liye supertest bina port ke request bhejta hai.
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../app");
const API = process.env.API_PREFIX || "/api";
const PLATFORM = process.env.ROOT_DOMAIN || "localhost";

test.after(() => {
  // rate limiter ka Redis client / mongoose buffers process ko zinda na rakhen
  setImmediate(() => process.exit(0));
});

test("GET /health → JSON, request id, security headers, no x-powered-by", async () => {
  const res = await request(app).get(`${API}/health`).set("Host", PLATFORM);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.match(res.headers["x-request-id"] || "", /^[A-Za-z0-9._-]{8,64}$/);
  assert.equal(res.headers["x-powered-by"], undefined);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.match(res.headers["content-security-policy"] || "", /frame-ancestors 'none'/);
  assert.equal(res.headers["cross-origin-resource-policy"], "cross-origin");
});

test("incoming X-Request-Id is echoed back (log correlation)", async () => {
  const res = await request(app).get(`${API}/health`).set("Host", PLATFORM).set("X-Request-Id", "req-abc-12345");
  assert.equal(res.headers["x-request-id"], "req-abc-12345");
});

test("store-only API on the platform host → 404 STORE_REQUIRED (JSON)", async () => {
  const res = await request(app).get(`${API}/products`).set("Host", PLATFORM);
  assert.equal(res.status, 404);
  assert.equal(res.body.code, "STORE_REQUIRED");
});

test("malformed JSON body → 400 INVALID_JSON from the central error handler (not an HTML page)", async () => {
  const res = await request(app)
    .post(`${API}/users/admin/login`)
    .set("Host", PLATFORM)
    .set("Content-Type", "application/json")
    .send("{not json");
  assert.equal(res.status, 400);
  assert.match(res.headers["content-type"] || "", /application\/json/);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, "INVALID_JSON");
  assert.ok(res.body.requestId, "error carries the request id");
});

test("/uploads responses get a sandboxed CSP (an uploaded file cannot run script)", async () => {
  const res = await request(app).get("/uploads/stores/x/nothing.png").set("Host", PLATFORM);
  assert.match(res.headers["content-security-policy"] || "", /sandbox/);
});

test("unknown route → JSON 404", async () => {
  const res = await request(app).get("/definitely-not-a-route").set("Host", PLATFORM);
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});
