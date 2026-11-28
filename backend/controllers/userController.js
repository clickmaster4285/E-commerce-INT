const customerAuth = require("./customerAuthController");
const adminAuth = require("./adminAuthController");
const profile = require("./profileController");
const wishlist = require("./wishlistController");
const checkoutDraft = require("./checkoutDraftController");

module.exports = {
  ...customerAuth,
  ...adminAuth,
  ...profile,
  ...wishlist,
  ...checkoutDraft,
};
