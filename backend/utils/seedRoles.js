const Role = require("../models/Role");
const { runWithStore } = require("./tenantContext");

const FULL_PERMISSIONS = Object.freeze({
  dashboard: true,
  products: true,
  brands: true,
  categories: true,
  users: true,
  settings: true,
  profile: true,
  employees: true,
  discounts: true,
  deals: true,
  bundles: true,
  store: true,
  banners: true,
  manageStock: true,
  shipping: true,
  orders: true,
  order: true,
  attribute: true,
  vendors: true,
  purchaseOrders: true,
  customers: true,
  leads: false,
  quotes: true,
  invoices: true,
  finance: true,
  pos: true,
  featuredProducts: true,
  reviews: true,
  storeEditor: true,
});

const MANAGER_PERMISSIONS = Object.freeze({
  ...FULL_PERMISSIONS,
  employees: false,
  finance: false,
  settings: false,
});

const CASHIER_PERMISSIONS = Object.freeze({
  dashboard: true,
  profile: true,
  pos: true,
  orders: true,
  order: true,
  customers: true,
  products: false,
  brands: false,
  categories: false,
  employees: false,
  discounts: false,
  deals: false,
  bundles: false,
  store: false,
  banners: false,
  manageStock: false,
  shipping: false,
  attribute: false,
  vendors: false,
  purchaseOrders: false,
  leads: false,
  quotes: false,
  invoices: false,
  finance: false,
  featuredProducts: false,
  reviews: false,
  storeEditor: false,
  users: false,
  settings: false,
});

const STAFF_PERMISSIONS = Object.freeze({
  dashboard: true,
  profile: true,
  products: true,
  brands: true,
  categories: true,
  manageStock: true,
  orders: true,
  order: true,
  customers: true,
  pos: false,
  employees: false,
  finance: false,
  settings: false,
  users: false,
  discounts: false,
  deals: false,
  bundles: false,
  store: false,
  banners: false,
  shipping: false,
  attribute: false,
  vendors: false,
  purchaseOrders: false,
  leads: false,
  quotes: false,
  invoices: false,
  featuredProducts: false,
  reviews: true,
  storeEditor: false,
});

const SYSTEM_ROLE_SEEDS = Object.freeze([
  { name: "Admin", permissions: FULL_PERMISSIONS },
  { name: "Manager", permissions: MANAGER_PERMISSIONS },
  { name: "Cashier", permissions: CASHIER_PERMISSIONS },
  { name: "Staff", permissions: STAFF_PERMISSIONS },
]);

/**
 * Naye store ke liye default roles — idempotent upsert
 * @param {import("mongoose").Types.ObjectId|string} storeId
 */
async function seedRolesForStore(storeId) {
  if (!storeId) return [];

  return runWithStore(storeId, async () => {
    const out = [];
    for (const seed of SYSTEM_ROLE_SEEDS) {
      // eslint-disable-next-line no-await-in-loop
      const role = await Role.findOneAndUpdate(
        { storeId, name: seed.name, is_system: true },
        {
          $set: { permissions: seed.permissions },
          $setOnInsert: { is_system: true, name: seed.name },
        },
        { upsert: true, new: true },
      );
      out.push(role);
    }
    return out;
  });
}

module.exports = {
  SYSTEM_ROLE_SEEDS,
  seedRolesForStore,
};