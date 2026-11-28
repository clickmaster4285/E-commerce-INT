// ==========================================================
// PRICING — ek jagah se sab pricing/money helpers (§4.2)
// ----------------------------------------------------------
// - checkout / deal / bundle / discount rules: storefront parity (test/pricingParity.test.js)
// - money math (toMinor/allocate/roundMoney): utils/money.js — invoice, quote, POS, order sab yahin se round karte hain
//
// ⚠️ BAAQI DIVERGENCE (jaan-boojh kar abhi merge nahi kiya):
//   * Invoice (invoiceController): overall discount "flat" ya "percent" ho sakta hai, aur overall tax base
//     `discountBase - overallDiscount` hai; tax/discount shares line par allocateAmount se baante jate hain.
//   * Quote (quoteController): overall discount sirf percent hai, overall tax base `subtotal - discount`
//     (item discount + overall discount dono ghatne ke baad) — formula invoice se thoda alag hai.
//   * POS: tax-inclusive line totals + sale-level discount ka allocation (returns me whole-unit Math.round).
//   Teeno ka rounding roundMoney se hota hai, magar formula merge karne se purane documents ke totals
//   badal sakte hain — pehle golden tests (test/pricingGoldenP1.test.js) extend karo, phir merge.
// ==========================================================
const money = require("../../utils/money");
const dealRules = require("./dealRules");
const bundleRules = require("./bundleRules");
const discountRules = require("./discountRules");
const { priceCheckout } = require("./checkout");

module.exports = { money, dealRules, bundleRules, discountRules, priceCheckout };