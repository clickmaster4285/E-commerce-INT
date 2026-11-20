// Pending sellers (seller_pending employees) are view-only: authMiddleware
// blocks every non-GET request for them. Some POST routes don't change any
// store data (e.g. creating the one-time admin handoff link right after
// signup), so they opt in here. Mount it BEFORE authMiddleware on the route.
const allowPendingSeller = (req, _res, next) => {
  req.allowPendingSeller = true;
  next();
};

module.exports = { allowPendingSeller };
