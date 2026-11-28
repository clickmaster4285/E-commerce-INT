// ==========================================================
// PRODUCT SUMMARY JOB (§6.3) — refresh denormalized Product fields
// ==========================================================
const queue = require("./queue");
const log = require("../utils/logger");

const PRODUCT_SUMMARY_JOB = "product.summary";

queue.register(PRODUCT_SUMMARY_JOB, async (payload) => {
  const productId = payload?.productId;
  if (!productId) return;
  const { refresh } = require("../services/productSummary");
  await refresh(productId);
});

function enqueueProductSummary(productId) {
  if (!productId) return Promise.resolve({ queued: false });
  const id = String(productId);
  return queue.add(
    PRODUCT_SUMMARY_JOB,
    { productId: id },
    { jobId: `product-summary-${id}`, attempts: 3, backoffMs: 1000 },
  ).catch((err) => {
    log.warn("[jobs/productSummary] enqueue failed, inline refresh:", err?.message || err);
    const { refresh } = require("../services/productSummary");
    return refresh(id)
      .then(() => ({ queued: false, inline: true }))
      .catch((e) => {
        log.warn("[jobs/productSummary] inline failed:", e?.message || e);
        return { queued: false };
      });
  });
}

module.exports = { PRODUCT_SUMMARY_JOB, enqueueProductSummary };
