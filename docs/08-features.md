# 08 — Features Deep Dive

## 1. Content Translation

**Files:** `utils/translationService.js`, `utils/libreTranslate.js`,
`controllers/translationController.js`, `scripts/backfillTranslations.js`

- English field **source of truth**; kabhi overwrite nahi hota.
- Translation: `translations.<field>.<locale>` (Map).
- Staleness hash: `translation_source.<field>` (md5).
- Status: `translation_status.<field>` = `pending|done|skipped|failed`.
- Service: self-hosted LibreTranslate/Argos (`LIBRETRANSLATE_URL`), serial queue, batch, retries.
- Controllers write par `queueTranslationSync()` (fire-and-forget via `setImmediate`).
- Service down ho to English dikhta hai.
- `isUsableTranslation` junk output reject karta hai (Wikipedia artifacts, wrong script, repeated words).
- `POST /translations/page` on-demand sync (19 whitelisted models, ≤50 ids, 1 locale).
- Backfill: `npm run translation:check` (preflight), `npm run backfill:translations`.
- Local server: `npm run argos:serve` (needs `uv`).

## 2. Email

**Files:** `utils/sendEmail.js`, `utils/emailLayout.js`, `services/emailService.js`,
`templates/emails/baseLayout.html`

- Nodemailer + SMTP (env-driven). Gmail shorthand supported.
- Port 465 → implicit TLS; 587 → STARTTLS. TLS min 1.2.
- `sendEmail` friendly errors; `verifySmtpConnection` health check.
- Dev (no SMTP) → OTP console par print.
- Layout: table-based, inline styles, 600px card, `{{PLACEHOLDER}}` substitution.
- Seller emails: application received, approved, info requested (signed setup link), rejected.
- `sendWithRetry` (2 tries), failures logged — user flow kabhi email par fail nahi hota.

## 3. Uploads / Images

- `utils/uploadPaths.js` — per-store paths + safety (`uploadDirFor`, `uploadUrlFor`, `localPathForUrl`).
- `utils/tenantMulter.js` — context-safe multer (plain multer context kho deta hai).
- Sharp → WebP compression:

| Upload | Behavior |
|---|---|
| Banner | desktop 3000 / tablet 1800 / mobile 1200 px, webp q85, max 15MB |
| Product images | original format saved, max 10, unique names |
| Brand logo | 300×300 contain, webp q85 |
| Bundle cover | 1000×1000 inside, webp q88 |
| Deal image | disk storage, max 5MB |
| Review images | 1200px webp q85, max 5; video max 1 (≤50MB) |
| Store logo | 600px webp q88 (alpha preserved; SVG raw) |
| Employee avatar | 320×320 cover webp q82 (base64 data URL, ~600KB cap) |
| Seller docs (KYC) | PDF/JPG/PNG/WEBP, max 4 × 1.5MB, `uploads/documents` (SA-only) |

- Filenames hamesha unique — overwrite kabhi nahi.
- `/uploads` immutable cache; `/uploads/documents` sirf super-admin.

## 4. Rate Limiting

Dekho [05-auth-security.md](05-auth-security.md#10-rate-limiting-middleratelimitjs).

## 5. Sockets (realtime)

- Admin panel: order/product/stock/attribute/banner/brand/category/deal/discount/review/shipping/store
  events → React Query cache invalidate.
- Storefront: `useUserSocketSync` reconnect par catalog invalidate.
- Chat: messages, typing, unread counts.
- Loyalty notices: `loyalty:notice` → `chat:customer:<id>`.
- Plugins/auth: `auth:refresh-needed` → client refresh + reconnect.

## 6. Chat / Support

- Customer (logged-in) aur guest (token) dono support.
- `POST /chats/general` / `/chats/order/:orderId` — idempotent open conversation.
- Message: control chars strip, max 4000 chars, per-identity rate limit, context snapshot.
- Unread counters (`unread_admin_count`, `unread_customer_count`).
- Staff inbox `chat:admins:<storeId>`; guest access hashed `guest_token_hash`.
- Frontend `SupportChatWidget` + `ChatThread` + guest token localStorage.

## 7. Loyalty Program

**Files:** `utils/loyaltyMath.js`, `utils/loyaltyService.js`, models.

Math (pure):
- `pointsForAmount = floor(amount/spendUnit) * floor(pointsPerUnit)`
- `pointsToValue = floor(points * redeemValue / redeemPoints)`
- `quoteRedemption` — balance + `maxPercent` + `minPoints` caps.

Service (idempotent ledger, `source_key` unique):
- Signup bonus (idempotent), welcome claim (no double credit).
- Order earn `pending` → delivered par `available`.
- Cancel → earn reverse + redemption refund + referral reverse; uncancel restore.
- `redeemForCheckout` atomic balance guard; `rollbackRedemption`.
- Notices (`LoyaltyNotice`) + socket emit.
- Admin adjust (no negative), unseen notices.

Frontend: `lib/loyalty.js` client mirror, `LoyaltyCheckout`, `PointsBadge`, `RewardsView`.

## 8. Referrals

- `ReferralProgram` (per store): `referrerPoints`, `friendPoints`, `saleReferrerPoints`, headline.
- `ensureReferralCode` (random uppercase), `processSignupReferral` (unique per referred user),
  `rewardReferralSale` on delivered order, reverse/restore on cancel.
- Share URL: `${protocol}://<subdomain>.<root>/login?mode=register&ref=<code>`.
- Admin: `GET/PUT /loyalty/admin/referrals`. Customer: `GET /loyalty/referrals/me`.

## 9. Plans & Limits

- `Plan` model (platform): price, billing interval, `limits{maxProducts,maxStaffAccounts,…}`,
  `features{orderManagement, analytics, pos, customDomain}`.
- `utils/planLimits.js` `assertWithinLimit("products"|"staff")` — store ke plan se cap;
  `null` = unlimited; cap hit par `403` friendly message.
- Admin plans UI: `lib/planModules.js`.

## 10. Orders

- `POST /orders` — frontend item snapshot trust karta hai (server price recalc nahi),
  discounts (`calculateDiscountedPrice`), loyalty redeem/earn, checkout drafts.
- `DELIVERY_FEE = 200`.
- Status: pending → confirmed → processing → shipped → delivered / cancelled.
- Admin status/payment patch loyalty state transitions trigger karte hain.
- Customer apni hi order edit/delete kar sakta hai.

## 11. Deals, Discounts, Bundles

- **Deal**: automatic promotions (percentage, fixed, buy-x-get-y, bundle, free shipping),
  applyTo product/category/brand/collection, schedule, usage limits.
- **Discount**: coupon codes, targeting, min order/qty, validity, per-user limits.
  `calculateDiscountedPrice` deals ko priority deta hai (deal active ho to discount skip).
- **Bundle**: ≥2 products, one bundle price, savings computed.

Frontend pricing: `utils/dealCalculator.js`, `utils/bundleCalculator.js`.

## 12. POS (Point of Sale)

- `POST /pos/sales` — active variant/product, qty integer > 0, discount/tax 0–100,
  stock check (edit par purani qty credit), payment method (cash/card/mobile_wallet/bank_transfer),
  card/bank reference required, cash `amount_received >= total`.
- Atomic stock decrement + full compensating rollback.
- `PUT /pos/sales/:id` edit history.
- `POST /pos/sales/:id/returns` — per-variant unreturned cap, tax-inclusive refund,
  restock + `StockHistory`.

## 13. Invoices

- Create: valid customer + variant per item, atomic stock deduct (rollback on failure),
  `invoice_number` retry, default `Unpaid`.
- Update: `sent_at` ke baad blocked; stock deltas; total < paid refuse.
- `recordPayment`: amount > 0 ≤ remaining; methods Cash/Bank/Card/Other; status auto
  (Paid/Partially Paid/Unpaid/Overdue).
- `recordReturn`: sent invoice required, per-item unreturned checks, refund cap,
  settlement (cash refund vs balance adjustment), restock + history, `__v` optimistic concurrency.
- `sendInvoice` idempotent.

## 14. Quotes

- `QUO-####` numbers; `POST /quotes/reserve-number` 24h token (atomic consume).
- `buildQuote` server-side recompute (line/overall discount+tax+totals).
- Editable sirf Pending/Draft; status Sent/Accepted/Rejected; `Sent` sirf Pending/Draft se.

## 15. Purchase Orders

- `PO-00001`; transitions pending → confirmed → delivered → closed; cancel reason required.
- Deliver/receive stock in + `StockHistory` + `stockUpdated` socket.
- `recordPOPayment` updates paid/due.

## 16. Finance

- `GET /finance/overview?period=today|yesterday|7d|30d|month|lastMonth|year|all|custom`.
- Ledger combines invoice payments/refunds, POS sales/refunds, paid online orders,
  purchase orders/payments.
- Cash refund de-duplication (negative payment vs return record).
- Legacy invoices (`amount_paid` without itemized payments) handled.

## 17. Leads & Customers (CRM)

- Lead: phone normalized (7–15 digits), Business type needs company_name, status rules
  (Lost only from Contacted/Qualified; Customer needs customer_added + customer_id).
- `syncLeadCustomer` converted leads ko `Customer` se sync karta hai.
- Customer: offline/POS directory (storefront `User` se alag).

## 18. Shipping

- `ShippingConfig` (standard/express fee, delivery days, free-shipping threshold).
- `ShippingMethod` (custom methods by code).
- `ShippingRule` (free/fixed by product/category/brand/all).
- `POST /shipping/quote` calculate; frontend checkout me use.

## 19. Dashboard

- `GET /dashboard/stats?range=7d|30d|3m|6m|1y` — KPIs + time series + pct change.
- Super-admin dashboard: platform totals + 7-day registration series + approval split.

## 20. Banners

- Types hero/promo/product/collection/popup; status active/scheduled/expired/draft.
- `position` unique; `startDate`/`endDate`; `bannerScheduler` scheduled publish karta hai.
- Link types: product/category/brand/collection/deal.
- Public `GET /banners/active` (60s cache).

## 21. Reviews

- Sirf **delivered purchase** par review.
- Media (images/video), store response, translations.
- One active review per user/product.
- Admin hide/unhide + response.
