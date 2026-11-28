// §4–5 architecture / queries — smoke for extracts + caches
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

test("productQueryService exports filter helpers", () => {
  const svc = require("../services/productQueryService");
  assert.equal(typeof svc.buildProductFilter, "function");
  assert.equal(typeof svc.parseShopParams, "function");
  assert.equal(typeof svc.expandCategorySubtrees, "function");
  assert.match(read("controllers/productController.js"), /services\/productQueryService/);
});

test("posService exports savePosSale + controller is thin", () => {
  const pos = require("../services/posService");
  assert.equal(typeof pos.savePosSale, "function");
  assert.equal(typeof pos.recordReturn, "function");
  assert.equal(typeof pos.pricePosLine, "function");
  const ctrl = read("controllers/posController.js");
  assert.match(ctrl, /savePosSaleCore/);
  assert.doesNotMatch(ctrl, /withTx\(/);
  assert.match(ctrl, /SaleReturn/);
  assert.match(ctrl, /asyncHandler/);
});

test("pricing exports pricePosLine shared with POS", () => {
  const pricing = require("../services/pricing");
  assert.equal(typeof pricing.pricePosLine, "function");
  assert.match(read("services/posService.js"), /pricing\/posLine/);
});

test("keyset used on POS sales + invoices", () => {
  assert.match(read("controllers/posController.js"), /keysetFilter/);
  assert.match(read("controllers/invoiceController.js"), /keysetFilter/);
  assert.match(read("controllers/orderController.js"), /keysetFilter/);
});

test("category tree cache wired + invalidated on writes", () => {
  const cache = require("../utils/categoryTreeCache");
  assert.equal(typeof cache.getTree, "function");
  assert.equal(typeof cache.invalidateTree, "function");
  const src = read("controllers/categoryController.js");
  assert.match(src, /getCachedCategoryTree/);
  assert.match(src, /invalidateCategoryTree/);
});

test("auth principal cache + services/auth login merge", () => {
  const pc = require("../utils/principalCache");
  assert.equal(typeof pc.getPrincipal, "function");
  assert.equal(typeof pc.invalidateEmployee, "function");
  assert.match(read("middleware/authMiddleware.js"), /getPrincipal/);
  const auth = require("../services/auth");
  assert.equal(typeof auth.authenticateCustomer, "function");
  assert.equal(typeof auth.authenticateAdmin, "function");
  assert.equal(typeof auth.toPublicUser, "function");
  assert.match(read("controllers/userController.js"), /authenticateCustomer/);
  assert.match(read("controllers/adminAuthController.js"), /authenticateAdmin/);
  assert.match(read("controllers/employeeController.js"), /invalidateEmployee/);
});
