const Customer = require("../models/Customer");

/**
 * Storefront User ↔ admin Customer record (§3.6).
 * Email pehle, warna phone se match — user_id set / create.
 */
async function upsertCustomerForUser({ storeId, user, addressSnapshot = null } = {}) {
  if (!storeId || !user?._id) return null;

  const name = String(user.name || addressSnapshot?.full_name || "").trim();
  const email = String(user.email || "").trim().toLowerCase();
  const phone = String(user.phone || addressSnapshot?.phone || "").trim();
  const address = String(addressSnapshot?.street_address1 || "").trim();

  if (!email && !phone) return null;

  let customer = null;
  if (email) {
    customer = await Customer.findOne({ email, is_deleted: { $ne: true } });
  }
  if (!customer && phone) {
    customer = await Customer.findOne({ phone, is_deleted: { $ne: true } });
  }

  if (!customer) {
    customer = await Customer.create({
      name: name || email || phone || "Customer",
      email,
      phone,
      address,
      user_id: user._id,
    });
    return customer;
  }

  let dirty = false;
  if (!customer.user_id) {
    customer.user_id = user._id;
    dirty = true;
  }
  if (name && !customer.name) {
    customer.name = name;
    dirty = true;
  }
  if (email && !customer.email) {
    customer.email = email;
    dirty = true;
  }
  if (phone && !customer.phone) {
    customer.phone = phone;
    dirty = true;
  }
  if (address && !customer.address) {
    customer.address = address;
    dirty = true;
  }
  if (dirty) await customer.save();
  return customer;
}

module.exports = { upsertCustomerForUser };