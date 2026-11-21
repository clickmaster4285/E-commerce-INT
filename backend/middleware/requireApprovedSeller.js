const SellerApplication = require("../models/SellerApplication");
const Store = require("../models/Store");

// Centralized gate for seller-only endpoints.
// Must run AFTER authMiddleware (req.user must be set).
// Pending or rejected applicants and suspended stores are rejected.
const requireApprovedSeller = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }
    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: user.status === "blocked" ? "Your account is blocked." : "Your account is not active.",
      });
    }
    if (!user.storeId) {
      // Attach the application state so the client can show the right screen
      let code = "SELLER_NOT_APPROVED";
      let message = "Your seller application is pending approval.";
      try {
        const application = await SellerApplication.findOne({ email: user.email }).select("status").lean();
        if (application?.status === "rejected") {
          code = "SELLER_REJECTED";
          message = "Your seller application was rejected.";
        } else if (!application) {
          code = "SELLER_NOT_APPLIED";
          message = "You have not applied to become a seller.";
        }
      } catch (lookupError) {
        console.error("[requireApprovedSeller] application lookup failed:", lookupError.message);
      }
      return res.status(403).json({ success: false, code, message });
    }
    const store = await Store.findById(user.storeId).select("store_name store_status").lean();
    if (!store) {
      return res.status(403).json({ success: false, code: "STORE_NOT_FOUND", message: "Your store could not be found." });
    }
    if (String(store.store_status).toLowerCase() === "closed") {
      return res.status(403).json({ success: false, code: "STORE_SUSPENDED", message: "Your store is suspended. Contact support." });
    }
    req.sellerStore = store;
    return next();
  } catch (error) {
    console.error("[requireApprovedSeller] error:", error.message);
    return res.status(500).json({ success: false, message: "Could not verify seller access." });
  }
};

module.exports = { requireApprovedSeller };
