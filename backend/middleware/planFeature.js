// ==========================================================
// PLAN FEATURE GATE — subscription plan me feature band ho to 403
// ----------------------------------------------------------
//   router.get("/theme", requireAdmin, requirePlanFeature("storeEditor"), ...)
//
// Rule (utils/planLimits.js jaisa): store par plan hi nahi → allow.
// Sirf explicitly `features[key] === false` block karta hai, taake purane
// plans (jin me ye key abhi nahi) toot-te nahi.
// ==========================================================

const { resolveStorePlan } = require("../utils/planLimits");

const requirePlanFeature = (featureKey, { resolvePlan = resolveStorePlan } = {}) => async (req, res, next) => {
  try {
    const plan = await resolvePlan(req.store || null);
    if (plan && plan.features && plan.features[featureKey] === false) {
      return res.status(403).json({
        success: false,
        code: "PLAN_FEATURE_DISABLED",
        feature: featureKey,
        message: `Your "${plan.name || "current"}" plan does not include this feature. Upgrade the plan to use it.`,
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { requirePlanFeature };
