// §7.2 — rate limiter mounted on auth / OTP / email / seller-status routes (layer identity check)
require("dotenv").config({ path: require("node:path").join(__dirname, "..", ".env"), quiet: true });
const test = require("node:test");
const assert = require("node:assert/strict");
const { limiters } = require("../middleware/rateLimit");

const userRoutes = require("../routes/userRoutes");
const sellerRoutes = require("../routes/sellerApplicationRoutes");

function handlersFor(router, method, path) {
  const layer = router.stack.find((l) => l.route && l.route.path === path && l.route.methods[method]);
  assert.ok(layer, `route ${method.toUpperCase()} ${path} not found`);
  return layer.route.stack.map((s) => s.handle);
}

const EXPECT = [
  [userRoutes, "post", "/login", "login"],
  [userRoutes, "post", "/admin/login", "adminLogin"],
  [userRoutes, "post", "/register", "register"],
  [userRoutes, "post", "/send-email-otp", "sendEmailOtp"],
  [userRoutes, "post", "/verify-email-otp", "verifyEmailOtp"],
  [userRoutes, "post", "/forgot-password", "forgotPassword"],
  [userRoutes, "post", "/verify-reset-otp", "verifyResetOtp"],
  [userRoutes, "post", "/reset-password", "resetPassword"],
  [userRoutes, "post", "/google-customer-login", "googleLogin"],
  [sellerRoutes, "post", "/apply", "sellerApply"],
  [sellerRoutes, "get", "/apply/status", "sellerApplyStatus"],
];

for (const [router, method, path, key] of EXPECT) {
  test(`limiter ${key} is mounted on ${method.toUpperCase()} ${path}`, () => {
    assert.equal(typeof limiters[key], "function", `limiters.${key} missing`);
    const handlers = handlersFor(router, method, path);
    assert.ok(handlers.includes(limiters[key]), `${path} has no limiters.${key}`);
    // limiter controller se PEHLE chalna chahiye
    assert.ok(handlers.indexOf(limiters[key]) < handlers.length - 1);
  });
}
