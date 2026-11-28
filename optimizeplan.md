# Backend and Database Optimization Plan

Scope: `backend/` (Express 5 + Mongoose 9), the MongoDB data model, and `frontend/` (Next.js 16), aimed at 100+ stores on one deployment.
Based on a full read of the code at commit `85a1bb6` (branch `optimizing_v1`): the backend (about 38.7k lines: 46 models, 37 controllers, 36 routes, 17 middleware files, 38 utils, scripts and tests) and the frontend (about 108k lines: `app/` 136 files, `components/` 110, `hooks/` 22, `apis/` 47).
Line numbers are from that commit and will drift as you edit.

## Priorities

| Tag | Meaning | When |
|---|---|---|
| **P0** | Security hole, data leak, or code that crashes or loses money | Before anything else |
| **P1** | Data integrity: races, oversell, duplicate numbers, missing transactions | Right after P0 |
| **P2** | Database foundation: indexes, data model, counters, audit collection | Core of the plan |
| **P3** | Query performance: N+1, full-collection loads, JS-side filtering | After P2 indexes exist |
| **P4** | Architecture: service layer, error handling, validation, config | In parallel with P3, module by module |
| **P5** | Multi-instance scale: Redis cache, Socket.IO adapter, queues, schedulers, file storage | Before running more than one server |
| **P6** | Cleanup: dead code, duplicate helpers, unused dependencies, API consistency | Ongoing; finish last |

Rule for the whole plan: **one module per PR**, with tests first. Never change an API response shape without updating the matching `frontend/src/apis/**` file in the same PR.

---

## Step 0: Dependency upgrades and `package.json` hygiene (do first, one PR per project)

Baseline before the upgrade: the backend passes `npm test` (177/177). Frontend `npm run lint` reports **118 errors and 41 warnings already**, so the upgrade must not raise that number. Runtime: Node 24.20, npm 11.19.

**Backend (`backend/package.json`):**
- [x] Minor and patch upgrades within the current majors:
  - `express` 5.3.0, `express-rate-limit` 8.7.5, `rate-limit-redis` 6.0.2
  - `mongoose` 9.13.1, `ioredis` 6.1.0
  - `multer` 2.5.0, `sharp` 0.35.5, `socket.io` 4.8.4
  - `nodemailer` 10.6.1, `fs-extra` 11.4.1
- [x] Remove the unused dependencies `image-size`, `jose` and `uuid` (no `require` anywhere, §8.1).
- [x] Hold `dotenv` at 17.x. Version 18 is a major release; `config/env.js` (§5.5) will replace the ad-hoc loading anyway, and Node 24's `process.loadEnvFile` is an option then.
- [x] Metadata:
  - `"private": true`, `"main": "server.js"` (today it says `index.js`, which does not exist)
  - `"engines": { "node": ">=24" }`
  - scripts: `migrate:indexes`, `migrate:attributes`
- [ ] New dependencies are added **in the PR that first uses them** (added so far: `helmet`, `pino`, `pino-http`, dev `supertest`, `pino-pretty`), not ahead of time: `helmet`, `pino` + `pino-http` (§7.1), `zod` (§5.3), and dev-only `supertest` + `mongodb-memory-server` (§7.2).

**Frontend (`frontend/package.json`):**
- [x] Minor and patch upgrades within the current majors:
  - `next` + `eslint-config-next` 16.4.6, `react` + `react-dom` 19.3.1
  - `@tanstack/react-query` 5.108, `axios` 1.21, `dompurify` 3.5, `socket.io-client` 4.8.4
  - all `@tiptap/*` packages 3.35, `recharts` 3.11, `radix-ui` 1.8, `lucide-react` 1.82
  - `tailwindcss` + `@tailwindcss/postcss` 4.3.5, `tailwind-merge` 3.7, `zustand` 5.1, `sonner` 2.0.8, `libphonenumber-js` 1.13.17, `shadcn` 4.23
  - Redux packages (removed later, §9.4)
- [x] Remove the unused dependencies `react-select` and `next-themes` (no imports, §9.4).
- [x] Hold `eslint` at 9.x until `eslint-config-next`'s bundled plugins support ESLint 10.
- [x] Metadata: `"private": true` and `"engines": { "node": ">=24" }`.
- [x] Verify: `npm run build` succeeds, and lint is no worse than the baseline.

**Step 0 result (done on `optimizing_v1`):**
- Backend: tests 177/177; the server boots and `/health` responds. `npm audit fix` cleared the high findings (`body-parser`, `engine.io`, `brace-expansion`). The 2 moderate findings left are in dev-only `nodemon`, and the only fix is a downgrade.
- Frontend: `next build` succeeds, and `npm audit` reports 0 vulnerabilities. Lint errors are unchanged at 118. Warnings went from 41 to 48, all 7 new ones from the new `@next/next/no-location-assign-relative-destination` rule in eslint-config-next 16.4 (existing code, fix in §9.4).
- The `@tiptap/*` packages pin exact peer versions, so upgrade them together. If npm reports `ERESOLVE`, remove `node_modules/@tiptap` and their lockfile entries, then reinstall.
- npm 11 does not run install scripts by default (`unrs-resolver` postinstall was skipped; lint still works). Review them with `npm install-scripts ls`.
- Restart both dev servers after pulling this change.

**Ongoing:** run `npm audit` and `npm outdated` in CI weekly. Keep both lockfiles committed, and upgrade majors one at a time, in their own PR, after reading the changelog.

## 0. Current state in numbers

- The local MongoDB 8.3 **is already a single-node replica set** (`mongod.cfg` → `replication.replSetName: rs0`; `rs.status()` → `127.0.0.1:27017 PRIMARY`), so transactions work on this machine today. The app does not use them:
  - `MONGO_URI` has no `?replicaSet=rs0`.
  - `config/db.js` forces `retryWrites=false`.
  - `posController.js:576` says "this deployment is a standalone MongoDB server" and does manual rollbacks instead.
  - `purchaseOrderController.js:402-408` runs `admin.hello()` on **every** PO delivery to decide whether a transaction is possible.

  Only that one place uses a transaction. Production must be verified to match (§3.1).
- **Money is stored as JS floating-point `Number`** in every model, rounded by 4 different `round` helpers (`financeController.js:7`, `invoiceController.js:9`, `quoteController.js:56`, `utils/invoiceReturnMath.js:1`). Stock is a single mutable `Variant.quantity` number (§3.9).
- `config/db.js` forces `retryWrites=false`. It sets no pool size and no `serverSelectionTimeoutMS`, and `autoIndex` is on in production.
- `utils/logger.js` is a **no-op**, so 164 `log.*` calls print nothing, including every `log.error` in roughly 415 try/catch blocks. Production errors are invisible.
- There are 229 hand-written `res.status(500)` responses, with no central error handler and no asyncHandler.
- There is no validation library (joi, zod or express-validator), and no `helmet`.
- There are 204 `.populate()` calls and 52 regex searches, most of them unanchored and case-insensitive.
- The tenant plugin adds a **single-field `storeId` index**, but almost every other compound index does **not start with `storeId`**. Most indexes are therefore useless or only partly useful for tenant queries (see §3.3).
- The largest controllers are `productController` (2810 lines), `superAdminController` (2154), `userController` (1692) and `orderController` (1280). There is no service layer.
- The tests are unit-level only. There are no HTTP route tests and no tests for products, orders, POS or stock.

---

## 1. The `{ id, name, email }` question: when to reference and when to copy

Your instinct is mostly right. The professional rule has one important exception:

| Kind of data | Rule | Examples in this project |
|---|---|---|
| **Live relationship** (current value matters) | Store **only the ObjectId**. Resolve names with one batched `$in` lookup (a "hydrate" helper) or a single `$lookup`, never one query per row. | Product → category, brand, tags; Lead → assigned employee; `createdby`/`updatedby` everywhere; Variant → tags; Review → user |
| **Historical record** (value *at that moment* matters, legally or financially) | Store the ObjectId **and** a frozen snapshot. Never sync it afterwards. | Order items (name, price, image), `address_snapshot`; Invoice and Quote customer and items; PosSale items and customer; PurchaseOrder `vendor_snapshot`; StockHistory names; ChatMessage `sender_name` |
| **Hot read-model counter** (expensive to compute on each read) | Keep a **denormalized aggregate** on the parent and update it on write. | Product `price_from`, `stock_total`, `variant_count`, `rating_avg`, `rating_count`; Vendor balances (computed correctly); daily store stats |

So:
- [ ] **P2** Keep the snapshots on Order, Invoice, Quote, PosSale, PurchaseOrder and StockHistory. An invoice must not change when a customer renames themself. **Do stop populating the live refs next to the snapshot** (`orderController.js:831-833,1218-1220`, `purchaseOrderController.js:218`). That is paying twice.
- [ ] **P2** Replace stale-prone copies with references:
  - [ ] `Variant.tags: [String]` holds tag names that never update on rename or delete. Move it to `tag_ids: [ObjectId]`, like Product (`models/Variant.js:115`).
  - [ ] `Attribute.category` holds a legacy category-name string. Drop it (`models/Attribute.js:27`).
  - [ ] `actor_name`, `performedByName`, `employee_name` and `*_by_name` inside **live** activity arrays can be resolved from `actor_id` once those arrays move to the audit collection (§3.5). Keep the name only as a fallback for deleted actors.
  - [ ] Lead ↔ Customer are linked by a text marker inside `notes` (`utils/syncLeadCustomer.js:27-31`) and found with an unanchored regex. Use a real `Lead.customer_id` / `Customer.lead_id` ref.
- [ ] **P2** Add the missing read-model fields (§3.4).
- [ ] **P4** Write one `utils/hydrate.js`: `hydrate(docs, { field: "createdby", model: Employee, select: "name" })`. It does one `$in` query per model per response and replaces the per-row creator lookups in tags, categories, discounts, deals and leads.

---

## 2. P0: Security and broken code (do first, small PRs)

### 2.1 Data leaks
- [x] Public `GET /products` (the no-limit branch) returns full variants with **`cost_price`**, populates `createdby`/`updatedby` **name and email**, and honours `?status=` from the query, so inactive products are public too (`productController.js:919-935`, `routes/productRoutes.js:39`). Add a public projection, force `status:"active"`, remove the creator populates, and require pagination. — **done:** `optionalAdmin` + `redactPublic()`; shoppers always get `status:"active"` (query `?status=` ignored) and a default `limit` of 24 with pagination. Real DTO still §9.2. `test/publicRedaction.test.js`, `test/schemaAndPublicP0.test.js`
- [x] Public `GET /banners` and `GET /banners/:id` run the **admin** handler, which returns every status plus creator and updater emails (`routes/bannerRoutes.js:17,21`, `bannerController.js:148-152`). — **done:** both now need `requireAdmin` + `checkPermission("banners")`; the storefront uses only `/banners/active`
- [x] Public `GET /products/:id` and `GET /brands/:id/details` expose creator emails. — **done:** product detail uses `redactPublic`; `GET /brands/:id` and `/:id/details` no longer select/populate creators. `test/schemaAndPublicP0.test.js`
- [x] `getPublicStoreInfo` returns the whole Store, **including the `activity` log** (`storeController.js:182-184`). Return an explicit public field list. — **done:** `activity`, `planId`, `domainVerifyToken` and `__v` are excluded
- [x] `createEmployee` deletes the password only from `result.userId`, so **`result.password` (the bcrypt hash) is returned and broadcast to the store room** (`employeeController.js:498-509`). `updateEmployee` and `toggleStatus` broadcast the full doc too (`:721-732`, `:909-923`). — **done:** password and activities are stripped from the create, update and status-toggle responses and broadcasts. `select:false` on the schema is still open (§9.3)
- [x] **Every socket on a store host, including anonymous storefront visitors, joins `store:<id>`** (`utils/socket.js:444`). `io.emit` therefore sends full orders (address and phone), vendors (bank details), POs and discounts to the public. Split rooms into `store:<id>:admin` (staff only) and `store:<id>:public` (storefront-safe events), and audit every `req.io.emit`. — **done:** employee sockets join `store:<id>:admin` and everyone else `store:<id>`. In store context `io.emit` sends the full payload to the admin room only; `PUBLIC_EVENTS` reach the storefront as `{_id}` / `{changed:true}`; order events go only to the owner (`customer:<userId>`) as `{_id}` (`utils/socket.js`, `test/socketRooms.test.js`)
- [x] Remove the client relay events. Any socket, guests included, can emit `productCreated` or `employeeRelay*` to the whole store (`utils/socket.js:1026-1032`). Only the server should emit. — **done**
- [x] `sellerApplyStatus` is public and unthrottled, so anyone can look up an email's application status (`sellerApplicationController.js:138`). — **done:** `limiters.sellerApplyStatus` (IP, default 20/window) mounted on `GET /seller/apply/status`
- [ ] 500 responses return raw `error.message`, which leaks Mongo internals. The central error handler (§5.2) fixes this. — **partly done:** central handler already sanitizes; ~100 controller catch blocks still return `error.message` directly (sweep still open)

### 2.2 Money and trust
- [x] **Checkout trusts client prices.** `displayPrice`, `savings`, `freeItems`, `payableItems`, `dealSavings` and the shipping `brandId`/`categoryId` all come from the request body (`orderController.js:235-246,320,406`). Recompute price, deal, bundle, tax and shipping on the server from DB data. The client sends only `{variant_id, qty}`. — **done:** `services/pricing/{dealRules,discountRules,bundleRules,checkout}.js` price every line from DB data (variant price, active Discounts, Deal/Bundle docs, gift validation, shipping category/brand from the product). A mismatch with the client price returns **409 `PRICE_CHANGED`** (the storefront refreshes prices and shows a message). Parity with the storefront rules is enforced by `test/pricingParity.test.js` (3,500 randomized cases against the real frontend source); the end-to-end test `test/placeOrderPricing.test.js` covers tamper → 409, honest → server prices, over-stock → 400. `PRICING_MODE=log` is an emergency switch only
- [x] Remove the raw card number and CVV handling (`orderController.js:44-47`). Nothing is charged, and receiving them puts you in PCI scope. Use a payment provider's token flow when card payments are added. — **done:** any `card_number` / `card_cvv` / `card_expiry` / `card_holder_name` → 400 `CARD_DATA_REJECTED`; `payment_method: "card"` remains as intent only until a provider token flow lands
- [x] Mass assignment: `...req.body` is spread into — **done (guard):** `utils/sanitizeBody.js#withoutProtected` now strips ids, `storeId`, audit/soft-delete/translation/activity fields, `$` operators and dotted keys in all five controllers below (deal also `usedCount`, vendor also the balances). Per-endpoint zod schemas are still §5.3
  - [x] Deal (`dealController.js:143-149,452`): can set `usedCount` and `createdBy`
  - [x] Vendor (`vendorController.js:349,525`): can set `balance_payable` and `is_deleted`
  - [x] Brand (`brandController.js:105,295`)
  - [x] Category `$set: req.body` (`categoryController.js:590-696`)
  - [x] Banner (`bannerController.js:263,312`)

  Whitelist fields per endpoint (validation schemas in §5.3).
- [x] A store admin can reopen a store the super admin closed (`storeController.js:81`). `store_status` should be writable by the super admin only. — **done:** store-admin `PUT /store` and profile store updates ignore `store_status`; only super-admin `PATCH /stores/:id/status` can change it

### 2.3 Auth and abuse
- [x] **Rate limiters `register`, `sendEmailOtp` and `verifyEmailOtp` are defined but never mounted** (`routes/userRoutes.js:47,73-74`). This allows email bombing and OTP guessing. — **done**
- [x] OTP attempt counters are read, incremented and saved non-atomically, so parallel guesses get past the limit (`otpController.js:127-128,301-302`). Use `findOneAndUpdate({attempts: {$lt: max}}, {$inc: {attempts: 1}})`. — **done:** `verifyOtpCode` and pending-registration verify both use conditional `$inc` on `attempts < max`
- [x] Customer login, forgot-password and reset on the **platform host** use `User.findOne({email})` with no store, which picks an arbitrary store's customer (`userController.js:432`, `otpController.js:169,598,720`). Require store context, or refuse. — **done:** `resolveStore` already returns 404 `STORE_REQUIRED` for these on the platform host; controllers also refuse when `!req.store` (`STORE_REQUIRED`)
- [x] Legacy `Store.findOne()` fallbacks with no store context can edit an arbitrary store (`userController.js:704,856,976`, `employeeController.js:461`). Remove them. — **done:** profile/store lookups use `req.store` / linked `storeId` only; employee create requires `req.store._id`
- [x] Missing permission checks: — **done:** all gated; tags/variants use `products`. Tested in `test/authAbuseP0.test.js`
  - [x] discount CRUD (`routes/discountRoutes.js:33-43`)
  - [x] tags (check commented out, `routes/tagRoutes.js:7`)
  - [x] `GET /employees` (`employeeRoutes.js:19-21`)
  - [x] the `next-code` endpoints (brand, vendor, PO)
  - [x] `GET /categories/admin/all` (`categoryRoutes.js:162`)
  - [x] dashboard (`dashboardRoutes.js:10`)
  - [x] the variants route, which has no permission key
- [x] `requireSuperAdminRole` is never used, so super-admin team management has no route-level role gate (`superAdminAuth.js:57`). — **done:** every `/super-admin/team*` route mounts `requireSuperAdminRole`
- [x] Unescaped user input goes into `RegExp` (injection and ReDoS) in: — **done:** shared `utils/escapeRegex.js`; listed call sites (and order list) use it
  - [x] `employeeController.js:212`
  - [x] `orderController.js:527`
  - [x] `discountController.js:352`
  - [x] `bundleController.js:247`
  - [x] `attributeController.js:188`
  - [x] `tagController.js:74,130`

  Use one shared `escapeRegex` (§8).

### 2.4 Uploads
- [ ] SVG and any `image/*` are stored **with the client's extension** and served from the API origin, which is stored XSS (`routes/storeRoutes.js:32-37`, `dealImageMiddleware.js:19-22`). Re-encode everything through sharp to webp, whitelist `jpeg|png|webp|gif`, and add `X-Content-Type-Options: nosniff` (helmet). — **partly done:** MIME whitelist + nosniff via helmet (`test/app.test.js`). Still open: full sharp re-encode factory for deal/store/product originals (§5.6)
- [x] Review upload: 50MB memory storage × 6 files, about 300MB of RAM per request, and it runs **before** the rate limiter (`reviewUploadMiddleware.js:41-49`, `reviewRoutes.js:57-59`). Rate-limit first, then cap images at about 8MB and use disk or stream storage for video. — **done:** `limiters.reviewCreate` runs before multer on create/update; images capped at 8MB in `saveReviewMedia`. Video still memory/50MB (stream/disk storage still open). `test/schemaAndPublicP0.test.js`
- [x] Store logos and KYC documents bypass `uploadDirFor` and go to global folders (`userController.js:48`, `sellerApplicationController.js:18,292`). — **done:** both use `uploadDirFor`/`uploadUrlFor` (platform host → `uploads/store-logos` / `uploads/documents`). `test/integrityPhaseP0.test.js`

### 2.5 Code that crashes or silently does nothing
- [x] `approveRequest` calls `uniqueUsername`, which is not in scope (it is only required inside `createSellerStore`, `superAdminController.js:525` vs `:815`). The call throws **after** the application is marked approved. — **done:** imported at module level
- [x] `utils/translationService.js:200` uses `izedName`, which is undefined (should be `localizedName`), so it throws a ReferenceError. — **done**
- [x] `reviewController.js` calls `log.error` 6 times but never requires `log`, so every catch block throws again. — **done**
- [x] `getActiveDeals` paginated mode uses `page`, which is never defined, so it always throws (`dealController.js:627`). — **done**
- [x] `require("../models/Brand")` but the file is `models/brand.js`, which crashes on Linux (`dealController.js:409`; the `loadBrandModel` hack in `productController.js:18-34`). Rename the file to `Brand.js` and fix every import. — **done:** file is `models/Brand.js`; all requires use `../models/Brand`; `loadBrandModel` removed. `test/schemaAndPublicP0.test.js`
- [x] Duplicate `PUT /users/profile` (`userRoutes.js:88` and `:111`), so the second handler can never run. — **done:** the unreachable route was removed (the `updateProfileREST` handler is left for §8.1)
- [x] Fields written or read that **are not in the schema** (strict mode drops them silently): — **done:** schemas updated; `deleteProduct` soft-deletes variants via `is_deleted`/`deleted_at`/`deletedby`. `test/schemaAndPublicP0.test.js`
  - [x] **Variant `is_deleted`**: missing entirely. Every `is_deleted:{$ne:true}` filter on Variant does nothing, and `deleteProduct` never soft-deletes variants (`productController.js:2388-2400`). Add the field and backfill it.
  - [x] Discount `priceMin`, `priceMax`, `maxDiscountAmount`, `priority`, `usageCount`: price-range discounts and `max_discount` never work.
  - [x] Deal `priority` and `code` are sorted and searched but do not exist.
  - [x] PosSale `customer_snapshot.email/address/notes`; PurchaseOrder item `topup`.
  - [x] Category `category_type`, `image_url`, `sort_order` (the sort on `sort_order` does nothing); Attribute `filterable`/`searchable`/`visible`; Tag `deleted_at`; Banner `altText`, `backgroundColor`, `displayRules`.
  - [x] `pushGlobalActivity` queries `User.role in [admin, staff, manager]`, but User.role only allows `"user"`. It scans the whole collection on **every** login and mutation, and pushes to a field that does not exist (`utils/activityHelper.js:44-61`). **Delete it.** §3.5 replaces it. — **done:** no-op stub kept so call sites stay safe until removed
- [x] `editOrder` recalculates tax from `item.tax`, which order items never store, so tax becomes 0. It also changes quantities with no stock adjustment (`orderController.js:1086-1106`). — **done:** checkout stores `items.tax_rate` (product tax snapshot). Edit recomputes tax from that rate, or from `Product.tax` when the snapshot is missing, or scales the existing tax if the product is gone. Quantity changes (paid + free) adjust stock with a conditional decrement inside `withTx`; a concurrent edit gets 409 `ORDER_CHANGED`. Address-only edits leave tax and stock alone. `test/editOrder.test.js`
- [x] `deleteStore` hard-deletes the store and its employees, but orphans every product, order and other store document (`superAdminController.js:1019-1021`). Replace it with soft delete plus an offline purge job (§3.7). — **done:** Store soft-delete (`is_deleted`/`deleted_at`/`deletedby`), status closed, subdomain/customDomain cleared for reuse, employees inactivated (not deleted), resolveStore ignores deleted stores. Offline purge job still §3.7. `test/integrityPhaseP0.test.js`
- [x] Dashboard day buckets use server-local `setHours` but group by UTC `$dateToString` (`dashboardController.js:72-75,104`). Use the store's timezone in both. — **done:** `Store.timezone` (default `UTC`); range bounds and `$dateToString.timezone` use it. `test/integrityPhaseP0.test.js`

---

## 3. P1/P2: Database

### 3.1 Switch to a replica set and use it (P1, blocks the transactions work)
A replica set enables transactions, retryable writes, change streams and `majority` reads and writes. The money and stock ledger (§3.9) depends on it.

**Development (this machine already has it):**
- [ ] Keep `C:\Program Files\MongoDB\Server\8.3\bin\mongod.cfg` → `replication: { replSetName: rs0 }` (already set and initiated). For any other developer machine, document these steps in `backend/README.md`:
  1. Add the same `replication` block.
  2. Restart the `MongoDB` service.
  3. Run `mongosh --eval "rs.initiate({_id:'rs0', members:[{_id:0, host:'127.0.0.1:27017'}]})"` once.
  4. Verify with `rs.status().ok === 1`.
- [ ] Set `MONGO_URI=mongodb://127.0.0.1:27017/ecommerce?replicaSet=rs0` in `backend/.env` and a new `.env.example`. Use `127.0.0.1`, not `localhost`, because the member is registered as `127.0.0.1`. Docker alternative: `mongo:8 --replSet rs0` with a one-shot init container.

**Production:**
- [ ] A **3-member replica set** (primary plus 2 secondaries, on separate machines or zones), or MongoDB Atlas (M10+), which is always a replica set. Never one node in production: a single node gives transactions but no failover.
- [ ] Enable authentication and keyfile/x.509 internal auth, plus TLS, and `bindIp` to private addresses only. The local config today has `#security:` commented out, which is acceptable only on a dev laptop.
- [ ] Connection string with every member, `replicaSet=rs0`, `retryWrites=true`, `w=majority`, `readPreference=primary` (use `secondaryPreferred` only for analytics/report jobs, never for money or stock reads).
- [ ] Backups: point-in-time recovery (Atlas continuous backup, or `mongodump --oplog` plus oplog archiving). Test a restore once per quarter.

**Code changes:**
- [ ] `config/db.js`:
  - remove the `retryWrites=false` rewrite
  - fail fast at boot if `db.hello().setName` is missing (`"MongoDB must be a replica set"`)
  - set the pool and timeout options listed below
- [x] `utils/tx.js`: `withTx(fn)` = `mongoose.connection.transaction(fn, { readConcern: "snapshot", writeConcern: { w: "majority" } })`. It retries `TransientTransactionError` and `UnknownTransactionCommitResult` automatically. — **done:** `utils/tx.js` (`transactionAsyncLocalStorage` on, snapshot/majority, `TxAbort` for business-rule rollbacks). On a standalone server it runs without a transaction and the caller compensates (`placeOrder` does), and startup logs a loud warning (`supportsTransactions()` in `server.js`)
  - The tenant ALS context must be kept inside the callback, so add a test for that.
  - Pass `{ session }` to every read and write inside it.
- [ ] Delete the fallbacks: `supportsTx()` (`purchaseOrderController.js:402-408`), the "standalone" manual compensations (`posController.js:576`, `createProduct`'s rollback at `productController.js:1917`, `createSellerStore`'s manual rollback), and every "if transactions unsupported" branch.
- [ ] Wrap every multi-document money/stock write in `withTx`: checkout, order cancel/edit, POS sale/edit/return, invoice create/edit/payment/return, PO deliver/payment, manual stock adjust, seller signup/approval, and store purge. — **partly done:** checkout, order edit, POS, invoice, PO payment/deliver, manual stock adjust, **`createSellerStore` + `approveRequest`**. Still open: store purge
- [ ] Tests: `MongoMemoryReplSet` (from `mongodb-memory-server`) so tests run against a real replica set.
- [ ] Later uses of the replica set: **change streams** for cross-instance cache invalidation (`store:changed`, `publicCache` namespaces), socket fan-out of admin events, and the read-model refresh (§3.4). They can replace some Redis pub/sub.
- [ ] Connection options: `maxPoolSize` (for example 50), `minPoolSize`, `serverSelectionTimeoutMS: 5000`, `socketTimeoutMS`, and **`autoIndex: false` in production**. Build indexes through a migration script, not on boot.
- [ ] Turn on the profiler (`slowms: 100`) in staging, and record `explain("executionStats")` for the top 30 queries before and after §3.3.
- [ ] Back up before every migration (`mongodump`), and version the migration scripts (§3.8).

### 3.2 Atomic counters: replace every "read max, then +1" (P1)
Today 9 generators scan every document to find the max, and **all of them race**:
- order number (`orderController.js:418`)
- invoice (`invoiceController.js:105`)
- POS (`posController.js:27`)
- PO (`purchaseOrderController.js:88`)
- vendor code (`vendorController.js:326`)
- quote (`quoteController.js:7`)
- lead (`leadController.js:47`)
- SKU (`utils/skuHelper.js`)
- category code (`utils/categoryCodeHelper.js`)
- brand code (`brandController.js:32`)
- employee code (`employeeController.js:454`)

The order generator also sorts **lexically**: once the store passes ORD-99999, `"ORD-100000"` sorts lower, so every new order fails.
- [x] New collection `counters { storeId, key, seq }` with unique `{storeId, key}`. — **done:** `models/Counter.js`
- [ ] `utils/counter.js`: `next(key)` = `findOneAndUpdate({storeId, key}, {$inc:{seq:1}}, {upsert:true, new:true})`, formatted as `ORD-000123`. — **partly done:** `nextSeq`/`peekSeq`/`formatNumber` are used by order, invoice, POS sale, PO, vendor code, quote and lead numbers; the `next-code` previews use `peekSeq`, so they consume nothing. Still open: SKU, category code, brand code, employee code
- [x] A migration seeds each counter from the current max per store. — **done differently:** lazy seed. On first use per store, `nextSeq` seeds from the numeric max of existing data (`maxNumericSuffix`, not a lexical sort), so no migration script is needed. Tested, including ORD-99999 → ORD-100000
- [x] Delete `QuoteNumberReservation`, or give it a TTL (`Quote.js:63`). — **done:** TTL index `expires_at` with `expireAfterSeconds: 0`. `test/hardeningP0.test.js`

### 3.3 Index rebuild (P2): the biggest single speed-up
The rule follows from how the tenant plugin works: **every store-owned index starts with `storeId`**, then equality fields, then sort fields, then range fields (the ESR rule). Replace the `is_deleted: {$ne: true}` filters with `is_deleted: false` so index bounds stay tight (backfill `false` first).

Per collection (add ✚, drop ✖):

- [ ] **Product**:
  - ✚ `{storeId, is_deleted, status, created_at:-1, _id:-1}`
  - ✚ `{storeId, is_featured, is_deleted, featured_at:-1, _id:-1}`
  - ✚ `{storeId, category_id, is_deleted}`
  - ✚ `{storeId, brand_id, is_deleted}`
  - ✚ `{storeId, tag_ids}`
  - ✚ `{storeId, price_from}` (after §3.4)
  - ✖ `{category_id}`, `{brand_id}`, `{status, is_deleted}`, `{created_at, _id}`, the old featured index
- [ ] **Variant**:
  - ✚ `{storeId, product_id, is_deleted, created_at:1, _id:1}`
  - make the unique `{storeId, sku}` case-insensitive (collation strength 2, or a `sku_lower` field)
  - ✖ the current `{product_id, is_deleted, ...}` index
- [ ] **StockHistory**:
  - ✚ `{storeId, created_at:-1, _id:-1}`
  - ✚ `{storeId, variant_id, created_at:-1}` (it has **no** index today)
- [ ] **Order**:
  - ✚ `{storeId, created_at:-1}`
  - ✚ `{storeId, status, created_at:-1}`
  - ✚ `{storeId, user_id, created_at:-1}`
  - ✚ `{storeId, "items.product_id", created_at:-1}`
  - ✚ unique partial `{storeId, checkout_draft_id}` (idempotency)
  - ✖ `{user_id}`, `{user_id, status, created_at}`, `{checkout_draft_id}`
- [ ] **Invoice**:
  - ✚ `{storeId, is_deleted, created_at:-1}`
  - ✚ `{storeId, is_deleted, status, due_date}`
  - ✚ `{storeId, customer_id, created_at:-1}`
  - ✚ `{storeId, "items.product_id"}`
  - ✖ single `invoice_number`, `status`, `is_deleted`, `customer_name`
- [ ] **Quote**:
  - ✚ `{storeId, is_deleted, status, created_at:-1}`
  - ✚ `{storeId, customer_id}`
  - ✖ single `quote_number`, `status`, `is_deleted`, `customer_name`
- [ ] **PosSale**:
  - ✚ `{storeId, created_at:-1}`
  - ✚ `{storeId, customer_id, created_at:-1}`
  - ✚ `{storeId, "items.variant_id"}`
  - ✖ `{customer_id, created_at}`, `{created_at}`
- [ ] **PurchaseOrder**:
  - ✚ `{storeId, is_deleted, status, created_at:-1}`
  - ✚ `{storeId, vendor_id, created_at:-1}`
  - ✚ `{storeId, "items.product_id"}`
  - ✖ the two non-store indexes, plus single `vendor_id`, `status`, `is_deleted`
- [ ] **PurchasePayment**: ✚ `{storeId, po_id, created_at:-1}`, ✚ `{storeId, vendor_id}`
- [ ] **Customer**:
  - ✚ `{storeId, is_deleted, created_at:-1}`
  - ✚ `{storeId, phone}`
  - ✚ `{storeId, email}`
  - ✖ `{name, phone}`, `{phone}`, `{email}`
- [ ] **Lead**:
  - ✚ `{storeId, is_deleted, created_at:-1}`
  - ✚ `{storeId, status, created_at:-1}`
  - ✚ `{storeId, phone}`
  - ✚ `{storeId, assigned_employee_id}`
  - ✚ `{storeId, next_follow_up_date}`
  - ✖ the three non-store indexes and single `lead_number`
- [ ] **Vendor**:
  - unique `{storeId, vendor_code}` **partial on `is_deleted:false`**
  - ✚ `{storeId, is_deleted, name}`
  - ✖ `{name, is_deleted}`, `{city, is_deleted}`
- [ ] **Discount / Deal**:
  - ✚ `{storeId, isActive, endDate}`
  - ✚ `{storeId, createdAt:-1}`
  - ✖ all non-store indexes (the Deal `productIds`/`categoryIds`/`brandIds` multikey indexes only serve dead code)
- [ ] **Bundle**:
  - ✚ `{storeId, isActive, createdAt:-1}`
  - ✚ `{storeId, "products.product"}`
  - ✖ the two non-store indexes
- [ ] **Category**:
  - ✚ `{storeId, parent_category_id, is_deleted}`
  - ✚ `{storeId, "attributes.attribute_id"}`
  - ✖ `tenant_id` (dead field) and `{name, parent_category_id, is_deleted}`
- [ ] **Brand**:
  - ✚ `{storeId, is_deleted, created_at:-1}`
  - ✖ single `is_deleted`
- [ ] **Banner**:
  - ✚ `{storeId, status, position}`
  - ✚ unique `{storeId, position}` (fixes the position race)
  - ✚ `{status, startDate}` and `{status, endDate}` (scheduler)
  - ✖ `{status, position}`. Banner currently has **no storeId index at all**, because it declares `storeId` itself, so the plugin skips adding one.
- [ ] **Review**:
  - make unique `{product_id, user_id}` **partial on `is_deleted:false`** (today a user who deleted a review can never post again)
  - ✚ `{storeId, is_deleted, created_at:-1}`
  - ✚ `{storeId, user_id, created_at:-1}`
  - ✖ single `product_id`
- [ ] **ChatConversation**:
  - ✚ `{storeId, status, last_message_at:-1}`
  - ✚ `{storeId, customer_id, last_message_at:-1}`
  - ✖ single `status`, `inquiry_type`, `last_message_at`, and `{status, last_message_at}`
- [ ] **Subscriber / ContactMessage**: ✚ `{storeId, createdAt:-1}`
- [ ] **User**:
  - ✚ `{storeId, phone}`
  - ✚ `{storeId, google_id}`
  - ✚ `{storeId, created_at:-1}`
  - ✚ `{created_at:-1}` (super admin)
- [ ] **Employee**:
  - ✚ `{storeId, role}`
  - ✚ `{username}` and `{phone}` (platform-wide checks)
  - ✖ `{"activities.timestamp"}`, a multikey index no query uses that rewrites up to 100 keys on every push
- [ ] **SellerApplication / PendingRegistration**:
  - ✚ `{username}`, `{phone}`, `{status, created_at}`
  - ✖ the duplicate `index:true` next to `unique:true` (SuperAdmin, SellerApplication, PendingRegistration)
- [ ] **SuperAdminActivity**: ✚ `{"actor.id", created_at:-1}`, ✚ `{entityType, entityId, created_at:-1}`, plus a retention TTL
- [x] **Wishlist**: ✚ unique `{storeId, user_id}`. **ShippingConfig**: ✚ unique `{storeId}` (concurrent `getConfig()` calls currently create duplicates). — **done:** both unique indexes; `getConfig` upserts safely on E11000. `test/hardeningP0.test.js`
- [ ] **Otp**: ✖ `{email}` (covered by `{email, purpose, created_at}`)
- [x] Soft-delete unique indexes `{storeId, code, is_deleted}` on Attribute, Category, Brand and Vendor fail with E11000 the second time the same code is deleted. Convert them to a **partial unique index on `is_deleted:false`**. — **done:** schema partial uniques; `migrateTenantIndexes.js` drops the legacy compounds before `createIndexes`. `test/integrityPhaseP0.test.js`
- [x] **Plugin change**: stop auto-adding the single `storeId` index when the schema already declares a compound index starting with `storeId` (an option such as `tenantScope(schema, { index: false })`). It is pure write overhead. — **done:** `tenantScope(..., { index: false })` on Wishlist, ShippingMethod, Address, ShippingConfig. `test/storefrontContractsP0.test.js`
- [ ] Update `scripts/migrateTenantIndexes.js` to read the desired indexes from the models, diff them against the live database, then drop and create (dry run by default). Verify with `explain()` that each hot query does an `IXSCAN` with no `SORT` stage.
- [ ] Partial-filter check: confirm with `explain()` that `Store.findOne({subdomain})` uses the partial unique index (`Store.js:84-91`).

### 3.4 Read-model fields: stop aggregating the whole catalog per request (P2)
- [ ] Add these to **Product**:
  - `price_from`, `price_to`
  - `stock_total`, `in_stock`
  - `variant_count`
  - `primary_image`
  - `rating_avg`, `rating_count`, `rating_dist{1..5}`
- [ ] Keep them current in **one place**: `services/productSummary.js#refresh(productId)`. Call it from variant create/update/delete, every stock write (§4.1), and review create/update/hide/delete. Run it inside the same transaction, or as a queued job (§6.3).
- [ ] Backfill script.
- [ ] Then facets, price sort, POS search and product tiles read the Product alone. That removes the full-variant aggregations in `getProductFacets`, `applyShopFacets`, the price/discount sorts (`productController.js:618-990,1186-1318`) and the rating `find` (`reviewController.js:140`, `productController.js:1600`).
- [ ] **Vendor** balances: compute `total_purchased`, `total_paid` and `balance_payable` from PO and payment writes inside a transaction. Today they are synced only in `recordPOPayment`, where the first update is overwritten, and `getVendorWithPOs` uses only the last 100 POs (`purchaseOrderController.js:527-530`, `vendorController.js:468`).
- [ ] New `store_daily_stats { storeId, day, revenue, orders, items, newCustomers, byProduct[], byCategory[] }`, updated on order, POS and invoice writes. The dashboard and finance read this instead of scanning (§4.3).
- [ ] Platform counters for the super-admin dashboard (`platform_stats`): stores, sellers and customers, updated by events or a 5-minute cron.

### 3.5 One audit and activity collection (P2)
Today there are **eight** separate audit mechanisms, each embedding a growing array inside the main document:
- `Store.activity`, `Employee.activities`, `SuperAdmin.activities`
- `Customer.activity`, `Lead.activities` + `Lead.history`, `Vendor.activity`, `PurchaseOrder.activity`, `Quote.activity`, `Invoice.activity`, `PosSale.edit_history`
- plus the broken `pushGlobalActivity`

The `activitySchema`/`auditChangeSchema` definition is copy-pasted into Customer, PurchaseOrder, Quote and Vendor. Every save rewrites the whole array, documents grow toward 16MB, and the auth middleware and public endpoints load these arrays.
- [ ] New `audit_events { storeId, entityType, entityId, action, actorType, actorId, actorName, changes[], meta, at }`.
  - Indexes: `{storeId, entityType, entityId, at:-1}`, `{storeId, at:-1}`, `{storeId, actorId, at:-1}`.
  - A TTL index or monthly archiving for low-value events (logins).
- [ ] `services/audit.js#record(event)`: non-blocking. It buffers and calls `insertMany` every 200ms, or goes through the queue (§6.3), and is never awaited on the request path. Reuse `utils/auditHistory.js` for diffing, and delete the duplicate diffing in `compareInvoice` and POS `editChanges`.
- [ ] Migration: move every embedded array into `audit_events`, then `$unset` the fields and drop the schemas.
- [ ] **Keep inside the document** only the arrays that belong to the record's **financial state**: `Invoice.payments`, `Invoice.returns`, `PosSale.returns`. They are bounded by business rules. Even so, consider a separate `invoice_payments` collection to make the finance ledger simple (§4.3).
- [ ] Lead `activities` (calls, meetings) are CRM data, not audit data. Move them to `lead_activities {storeId, lead_id, type, notes, follow_up_date, employee_id, at}`.

### 3.6 People model: one person, too many records (P2)
Current: **User** (storefront login) and **Customer** (admin/POS CRM record) have **no link**, so one buyer has two separate histories (orders use `user_id`, POS and invoices use `customer_id`). **Lead** converts to Customer through a notes text marker. **SellerApplication** and **PendingRegistration** repeat name, email, phone, username and `passwordHash`, and the application keeps a stale password hash forever.
- [ ] Add `Customer.user_id` (optional, unique per store, partial). On customer signup or checkout, upsert the matching Customer by `{storeId, email|phone}`, so admin "customer history" covers orders, POS, invoices and quotes through one id.
- [ ] Add `Lead.customer_id` as the real link, and drop `syncLeadCustomer`'s regex lookup and the **write-on-read** (`customerController.js:14-18` re-syncs every converted lead on every list request). — **partly done:** customer list write-on-read removed; real `Lead.customer_id` link + convert-path sync still open. `test/adminContractsP1.test.js`
- [ ] `SellerApplication`: keep application-only fields (KYC, status, reviewer, reason) plus `store_id`/`employee_id` refs. Remove the copies of store profile fields and `passwordHash` once the employee exists.
- [ ] `PendingRegistration`: scope it by store (`{storeId, email}` unique instead of a global `email`), and add the tenant plugin or an explicit storeId filter.
- [x] `Address`: add `tenantScope` and backfill `storeId` from the user. It currently has no `storeId` at all. — **done:** `tenantScope` + `{storeId, user_id}` index; new creates stamp via plugin. Backfill of legacy rows still a migration. `test/hardeningP0.test.js`
- [ ] **Stop machine-translating people's names and addresses**: `Customer.translations.name/address`, `Invoice/Quote.translations.customer_name`, `Employee.translations.name`, `Lead.translations.name/company_name`. Also remove the unused `StockHistory.translations` (product name, reason, explanation), which is dead weight on the highest-volume collection.
- [ ] `Employee.avatar` and `User.avatar` hold **base64 data URLs inside the document**, loaded by the auth middleware on every request. Move them to files (`uploadDirFor(req, "avatars")`) and store only the URL. Migrate existing data URLs.
- [ ] `Employee.permissions` has both `order` and `orders`. Merge them, and migrate the routes that use `"order"` (chat).

### 3.7 Consistency conventions (P2)
- [ ] **One timestamp convention.** Today half the models use `created_at`/`updated_at` and half use `createdAt`/`updatedAt` (Store, Banner, Bundle, Deal, Discount, Tag, Shipping*, StorePage, StoreTheme, Subscriber, ContactMessage, RefreshSession). Pick `created_at`, migrate with `$rename`, and update the frontend fields in the same PR.
- [ ] **One audit-ref convention**: `createdby`/`updatedby`/`deletedby` → `ref: "Employee"`. Variant and StockHistory wrongly use `ref: "User"`, and Deal, Discount and Plan use `createdBy` in camelCase.
- [ ] **Soft delete everywhere it exists**: `is_deleted: Boolean (default false, required)`, `deleted_at`, `deletedby`. Add a `softDelete` plugin that adds `is_deleted:false` to queries unless `{withDeleted:true}`. That removes the hundreds of hand-written `is_deleted: {$ne: true}` filters.
- [ ] Replace the untyped `Mixed` client blobs with typed subschemas:
  - `Cart.items` and `CheckoutDraft.items`: typed `{variant_id, qty}` with a size cap, since `placeOrder` trusts them today
  - `ChatConversation.inquiry_context` (three shapes)
  - `Product.specifications` / `Variant.attributes`: keyed by attribute code, so renaming an attribute orphans the data. Store `[{attribute_id, value}]`.
- [ ] Referential cleanup on delete:
  - attribute → `$pull` from `Category.attributes`
  - tag → `$pull` from `Product.tag_ids`
  - product → Bundle/Deal/Discount/cart references
  - brand/category delete → block while products reference them
- [x] Store deletion: `store.status = "deleted"`, then an offline `scripts/purgeStore.js` that deletes every store-owned collection by `storeId` and the `uploads/stores/<id>` folder. — **done:** soft-delete via `is_deleted`; `scripts/purgeStore.js --storeId … [--apply] [--hard-store]` purges tenantScope collections + RefreshSession + uploads. `test/storefrontContractsP0.test.js`
- [x] Store suspension: `resolveStore` should check `store_status` (closed, suspended, maintenance) **once**, instead of looping over every user and employee to block them (`superAdminController.js:780-786`). The current approach also wrongly unblocks individually blocked accounts. — **done:** non-open stores return 503 `STORE_CLOSED`/`STORE_MAINTENANCE` for storefront; `/store/public` and `X-Auth-Aud: admin` bypass. Employee mass inactive/active on status change can still be simplified later. `test/hardeningP0.test.js`
- [ ] Retention TTLs:
  - RefreshSession: on revoke, set `expiresAt` to now plus grace (today revoked sessions live 30 days, about 720 docs per admin per month)
  - abandoned guest chats
  - archived contact messages
  - SuperAdminActivity

### 3.8 Migration process
- [ ] `scripts/migrations/NNN-name.js` with `up()`, a dry-run by default, `--apply`, and a `migrations` collection that records what ran.
- [ ] Archive the one-off scripts that already ran (`renameAuthCollections.js`, `backfillSubdomains.js`, `migrateAttributesPerStore.js`) into `scripts/migrations/archive/`. Note: `renameAuthCollections` drops `superadmin_activities`, which is still in use.
- [ ] Order: **backups → field backfills (`is_deleted:false`, Variant.is_deleted, Address.storeId) → counters seed → new indexes (built online) → read-model backfill → audit move → money and stock ledger backfill (§3.9) → shared reference collections (§3.10) → drop old indexes and fields**.

### 3.9 Money and stock in their own linked, append-only collections (P1/P2)
**Why:** today money and stock live as mutable numbers and arrays *inside* business documents:
- money: `Invoice.payments[]`, `Invoice.returns[]`, `PosSale.payment`, `PosSale.returns[]`, `Order.payment`, `Vendor.total_paid` and `balance_payable`, `Invoice.remaining_balance`
- stock: `Variant.quantity`

Anyone can overwrite them (mass assignment, a direct `$set`), concurrent writes lose updates, there is no single place to answer "where did this money or unit go?", and finance has to load 5 collections to rebuild it (§4.3).

The professional pattern is **separate collections linked by ids, where each row is a fact that is never edited** (append-only, like a bank statement). Current balances are a small read-model updated **in the same transaction** (§3.1). Business documents (Order, Invoice, PosSale, PO) keep only their snapshot totals and a cached `amount_paid`.

```
Order / PosSale / Invoice / PurchaseOrder        (business document, snapshot totals)
   │ ref_type + ref_id                    │ ref_type + ref_id + line_id
   ▼                                      ▼
payments ──► ledger_entries ◄── returns   stock_movements ──► stock_levels
   (facts)      (double-entry journal)        (facts)            (current balance)
                     │
                     ▼
              account_balances (read model: cash, receivable, payable per party)
```

**Money (P1):**
- [ ] **Integer minor units everywhere:** store `amount_minor` as an integer number of paisa or cents, plus the store `currency` (ISO 4217). Never use floats.
  - Migration: a field-by-field `*_minor` backfill, then rename.
  - `utils/money.js`:
    - `toMinor`, `fromMinor`
    - `add`, `mul(qty)`
    - `pct(amount, rate)` with one rounding rule (half-up, per line)
    - `allocate(total, parts)` to split a discount across lines without losing a paisa

    It replaces the 4 `round` helpers.
  - `Decimal128` is the alternative, but integers are faster, indexable and exact in `$sum`.
- [ ] **`payments`**:
  - fields: `{ storeId, direction: "in"|"out", method_code (§3.10), amount_minor, currency, status: "pending"|"captured"|"failed"|"refunded", ref_type: "order"|"pos_sale"|"invoice"|"purchase_order", ref_id, party_type: "customer"|"vendor", party_id, reference, received_by, idempotency_key, at }`
  - indexes: unique `{storeId, idempotency_key}`, `{storeId, ref_type, ref_id}`, `{storeId, party_type, party_id, at:-1}`, `{storeId, at:-1}`
  - It replaces `Invoice.payments[]`, `Order.payment`, `PosSale.payment` and `PurchasePayment` (migrate that collection into it).
- [ ] **`returns`**:
  - fields: `{ storeId, ref_type, ref_id, lines:[{line_id, variant_id, qty, amount_minor}], refund_payment_id, method, reason, actor_id, at }`
  - It replaces `Invoice.returns[]` and `PosSale.returns[]`.
  - The "already returned" quantity is a `$group` over `{storeId, ref_type, ref_id}`, checked inside the transaction.
- [ ] **`ledger_entries`** (double-entry journal):
  - fields: `{ storeId, journal_no, at, ref_type, ref_id, memo, lines:[{ account, party_type?, party_id?, debit_minor, credit_minor }], posted_by }`
  - A schema validator requires **Σdebit = Σcredit**.
  - indexes: `{storeId, at:-1}`, `{storeId, ref_type, ref_id}`, `{storeId, "lines.account", at:-1}`, `{storeId, "lines.party_id", at:-1}`
  - Per-store chart of accounts (seeded): `cash`, `bank`, `card_clearing`, `wallet`, `accounts_receivable`, `accounts_payable`, `store_credit`, `sales_revenue`, `sales_returns`, `discounts_given`, `shipping_income`, `tax_payable`, `inventory`, `cogs`.
  - Examples:
    - a POS cash sale posts `cash Dr / sales_revenue Cr / tax_payable Cr`
    - PO delivery posts `inventory Dr / accounts_payable Cr`
    - a vendor payment posts `accounts_payable Dr / cash Cr`
- [ ] **`account_balances`** (read model):
  - fields: `{ storeId, account, party_type?, party_id?, balance_minor }`
  - unique `{storeId, account, party_id}`
  - Updated with `$inc` in the same transaction as the journal entry.
  - This gives vendor payable and customer receivable instantly, and replaces `Vendor.total_purchased/total_paid/balance_payable` (wrong today, §3.4) and the hand-maintained `Invoice.remaining_balance`.
- [ ] **Immutability:**
  - Mongoose `pre(["updateOne","updateMany","findOneAndUpdate","deleteOne","deleteMany"])` hooks on `payments`, `ledger_entries`, `returns` and `stock_movements` throw unless `{ allowCorrection: true }` (used only by a migration).
  - Mistakes are fixed with a **reversal entry**, never an edit.
  - Invoice/Order "edit" posts the difference as new entries.
- [ ] `services/ledger.js#post({ ref, lines }, session)` and `services/payments.js#record(...)` are the **only** writers. Controllers never touch these collections directly.
- [ ] Finance overview, the vendor statement, the customer statement, the daily cash report and `store_daily_stats` (§3.4) all read `ledger_entries`/`account_balances` with an indexed `{storeId, at}` range. This replaces the 5-collection scan in `financeController.js:96-274`.
- [ ] A nightly reconciliation job:
  - Σ`payments` per document = document `amount_paid`
  - Σjournal per account = `account_balances`
  - Alert on drift.

**Stock (P1):**
- [ ] **`stock_levels`**:
  - fields: `{ storeId, variant_id, location_id (default "main"), on_hand, reserved, reorder_min, reorder_max }`
  - unique `{storeId, variant_id, location_id}`, plus `{storeId, on_hand}` for the low-stock list
  - `available = on_hand - reserved`
  - `Variant.quantity`, `min_qnt` and `max_qnt` move here. Keep `Variant.quantity` only as a read-only cache during the migration, then drop it.
  - `location_id` makes multiple branches/warehouses possible later without another migration.
- [ ] **`stock_movements`** (replaces `StockHistory`):
  - fields: `{ storeId, variant_id, location_id, qty_delta, on_hand_after, kind: "sale"|"sale_cancel"|"return"|"purchase_receive"|"adjust_add"|"adjust_remove"|"count_set"|"transfer_in"|"transfer_out", ref_type, ref_id, line_id, unit_cost_minor, reason, explanation, actor_id, actor_name, sku, variant_title, at, idempotency_key }`
  - indexes: unique `{storeId, idempotency_key}` (for example `order:<id>:<line>:sale`), so a retried request can never move stock twice; `{storeId, variant_id, at:-1}`; `{storeId, at:-1}`; `{storeId, ref_type, ref_id}`
  - Drop the `translations` maps that StockHistory carries today.
- [ ] **`stock_reservations`**:
  - fields: `{ storeId, variant_id, location_id, qty, checkout_draft_id, expires_at }`
  - Checkout reserves (`reserved += n` only when `on_hand - reserved >= n`). The order confirm converts the reservation into a `sale` movement (`on_hand -= n`, `reserved -= n`).
  - A leader-locked sweeper job (§6.2) releases expired reservations in a transaction. **A TTL index alone is not enough**, because it would delete the row without giving back `reserved`. Keep the TTL only as a safety cleanup afterwards.
- [ ] `services/stock.js` (§4.1) is the only writer:
  - `reserve`, `commit`, `release`, `receive(po)`, `adjust`, `countSet`, `transfer`
  - each one is a conditional `updateOne` on `stock_levels`, plus a movement insert, plus `productSummary.refresh`, inside one `withTx`
- [ ] **Cost:** `purchase_receive` stores `unit_cost_minor`, so you can keep a weighted-average `avg_cost_minor` on `stock_levels`. Each sale posts `cogs Dr / inventory Cr` to the ledger, which gives real profit per product and per day.
- [ ] *(P3, optional)* **`stock_lots`** `{storeId, variant_id, lot_no, expiry_date, qty}` for perishable products (`Product.isPerishable`/`expiryDuration` exist today with no lot tracking). This allows first-expiry-first-out picking and expiry alerts.
- [ ] A nightly reconciliation job: Σ`qty_delta` per variant = `stock_levels.on_hand`, with an alert on drift.
- [ ] Backfill: create `stock_levels` from the current `Variant.quantity`, and move `StockHistory` rows into `stock_movements` (`kind` from `adjustment_type`), plus one `opening_balance` movement per variant so the reconciliation starts at zero drift.

### 3.10 Shared reference collections: store a value once, reference it everywhere (P2)
The same values are copied into thousands of documents today. Each item below says what is duplicated, where, and what replaces it.

- [ ] **Attribute templates.** `scripts/seedAttributes.js` copies **67 attributes with their values into every new store** (`models/Store.js:134`, `migrateAttributesPerStore.js`). At 100 stores that is 6,700 attribute documents, each sent to LibreTranslate separately.
  - New platform collection `attribute_templates` (no `storeId`, translated **once**), plus `store_attributes { storeId, template_id?, name?, values_override?, custom_values[], is_active }`.
  - A store stores only what it changes or adds. Reads merge template and override (cached per store).
- [ ] **Translation memory.**
  - The problem: identical strings ("Red", "Cotton", "Small", common category names, attribute labels) are machine-translated again for every store and every document.
  - New platform collection `translation_memory { source_hash, source_lang, target_lang, text, engine, created_at }`, with unique `{source_hash, target_lang}`.
  - `translationService` checks it before calling LibreTranslate and writes to it after. This cuts translation load and queue time across all stores.
- [ ] **Roles instead of 29 booleans per employee.** Every Employee document carries the full `permissions` object (`models/Employee.js:38-68`).
  - New `roles { storeId, name, permissions:{...}, is_system }`, seeded per store with Admin, Manager, Cashier and Staff.
  - `Employee.role_id` plus an optional, small `permission_overrides`.
  - Auth caches the role (§5.4), and editing a role changes every member at once.
  - Also merge the `order`/`orders` duplicate key here.
- [ ] **Document templates.** `pdf_design` (Mixed), `terms` and `bank_details` are copied from the request body into **every** invoice and quote (`invoiceController.js:184-187`, `quoteController.js:99-101`). The store also keeps `quote_terms_conditions`, `invoice_terms_conditions` and their translations in the Store document.
  - New `document_templates { storeId, kind: "invoice"|"quote"|"receipt"|"po", name, pdf_design, terms, bank_details, version, is_default }`.
  - Invoice and Quote store `template_id` plus `template_version`, and only a frozen copy of the **terms text** (that is legally part of the document). The `pdf_design` copy per document is removed.
- [ ] **Payment methods: one list instead of 4 different enums.** Today:
  - Order uses `cod|bank|card`
  - PosSale uses `cash|card|mobile_wallet|bank_transfer`
  - Invoice uses `Cash|Bank|Card|Other`
  - refunds use `Cash Refund|Balance Adjustment`

  The fix:
  - `config/paymentMethods.js` with codes `cash|card|bank_transfer|mobile_wallet|cod|store_credit|other`.
  - Per store, `store_payment_methods { storeId, code, label, enabled, ledger_account }` maps each method to its ledger account (§3.9).
  - A migration normalizes the existing values.
- [ ] **Tax classes.** Today a raw `tax` number sits on every product (`Product.js:73`), plus `Store.tax_rate`.
  - New `tax_classes { storeId, name, rate_bp (basis points), inclusive }`.
  - `Product.tax_class_id` (default = the store default class).
  - Orders and invoices snapshot the rate used.
- [ ] **Geography as ISO codes.** Today `Address.country` defaults to `"Pakistan"`, `Order.address_snapshot.country` to `"Pakistan"`, and `Store.country` to `"PK"`.
  - Store `country_code` (ISO 3166-1) and `state_code`, and render names from the frontend's `country-state-city` data.
  - Snapshots keep both the code and the display name.
- [ ] **Units, statuses and enums** as shared constants (`config/units.js`, `config/statuses.js`), not copy-pasted string arrays. Today `["days","months","years"]` appears in Product, Variant and PurchaseOrder, and order statuses are duplicated in controllers.
  - Add an **allowed-transitions map** for orders, POs and invoices (`pending→confirmed→processing→shipped→delivered`, `*→cancelled`), so the "status" update endpoints cannot jump states.
- [ ] **Media library.** The image sub-schema (`img_url`, `img_size`, `mimeType`, `width`, `height`) is defined separately in Variant, brand, Review, SellerApplication and Store, and the same picture uploaded for several variants is stored as several files.
  - New `media { storeId, kind, url, size, mime, width, height, sha256, ref_count, created_by, at }` with unique `{storeId, sha256}`, so identical uploads are deduplicated.
  - Documents store `media_ids`, or `{media_id, url}` for render speed.
  - Files are deleted only when `ref_count` reaches 0, which fixes the "files deleted before the DB write" bugs (§5.6).
- [ ] **Split the Store document by how often it is read.** Today one document holds routing data, settings, SEO, social links, 5 long legal texts with translations, and the activity log, and it is loaded and cached on every request (`resolveStore`).
  - `stores` (slim, cached per request): identity, subdomain/domain, status, plan, currency, timezone.
  - `store_settings` (read by admin/checkout): tax, units, locale, social, SEO, contact.
  - `store_content` (read on demand, cached): return/privacy/terms policies and their translations.
  - `Store.activity` moves to `audit_events` (§3.5).
- [ ] **Shipping methods by reference.** `Order.shipping_method` is a free string. Store `shipping_method_id` plus a snapshot `{code, name, price_minor}`.
- [ ] **Shared sub-schemas and plugins** in `models/shared/`:
  - `imageSchema`, `addressSchema`, `moneyFields`
  - an `auditRefs` plugin (`createdby/updatedby/deletedby`, `ref:"Employee"`)
  - a `softDelete` plugin (§3.7)
  - a **`translatable(schema, ["name","description"])` plugin**. The `translations` / `translation_source` / `translation_status` trio is hand-written in about 15 models today.
- [ ] **How these are linked and read (the relational part):**
  - Every reference is an indexed `ObjectId` (or a stable `code` for platform constants).
  - Per-request reads use the **cached** reference data (roles, tax classes, payment methods, templates, attribute templates) from Redis or an in-process LRU, invalidated on write (§6.1).
  - Lists resolve names with one batched `$in` (`hydrate`, §1).
  - `$lookup` is used only in admin reports and background jobs, never in the storefront hot path.

---

## 4. P1/P3: Data integrity and query performance per module

### 4.1 Stock: one service, atomic writes (P1)
Today stock is changed in about 8 copy-pasted places (order, cancel, delete, POS sale/edit/return, invoice create/edit/return, PO delivery, manual adjust, product/variant update). Most do read → check → set → save, so **concurrent orders oversell**. The order flow decrements before `Order.create` and never rolls back (`orderController.js:312,356,434`), and order flows write no StockHistory.
- [ ] `services/stock.js`, built on `stock_levels`, `stock_movements` and `stock_reservations` (§3.9):
  - `reserve(items, session)` = `updateOne({storeId, variant_id, location_id, $expr: {$gte: [{$subtract: ["$on_hand","$reserved"]}, n]}}, {$inc: {reserved: n}})`, failing on the first miss
  - `commit`, `release`, `receive`, `adjust`, `countSet`

  Every call writes a `stock_movements` row with an idempotency key and calls `productSummary.refresh` in the **same `withTx` transaction** (§3.1).
  - *Before §3.9 lands*, the quick fix on the current model is `findOneAndUpdate({_id, quantity: {$gte: n}}, {$inc: {quantity: -n}})`. **Done for `placeOrder`, `editOrder`, invoice create/update/return, manual `adjustStock`, and PO deliver** (conditional decrement / status claim; `test/counterAndStock.test.js`, `test/invoiceStockTx.test.js`, `test/integrityPhaseP0.test.js`). Still open: POS create path (sale already uses conditional `$inc` inside `withTx`) and product/variant quantity overwrites
- [ ] Replace every direct `quantity` write in controllers, including `updateVariant`/`updateProduct` (`variantController.js:170-177`, `productController.js:1860,2137`), which overwrite quantity with no history.
- [x] Order cancel and delete: use a conditional status transition, `findOneAndUpdate({_id, status: {$ne: "cancelled"}}, ...)`, so two concurrent cancels cannot restore stock twice (`orderController.js:1016-1048,1183-1198`). — **done:** cancel claims the transition with `updateOne({status:{$ne:"cancelled"}})`; delete uses an atomic `findOneAndDelete({user_id, status:"pending"})` before restoring
- [x] PO delivery: do the status transition plus stock in one transaction, so it is idempotent (`purchaseOrderController.js:411-482`). — **done:** `withTx` + conditional `status:"confirmed"→"delivered"` claim (409 `PO_CHANGED`); standalone compensates stock + status. `test/integrityPhaseP0.test.js`
- [x] POS returns: do the return-quantity check plus stock inside one transaction (`posController.js:311-349`). — **done:** `returnPosSaleItems` runs in `withTx` (5 concurrent returns on 2 sold → exactly 2); manual compensation only on standalone servers

### 4.2 Checkout and pricing (P1)
- [ ] `services/pricing.js`: **one** implementation of line pricing, discounts, deals (BOGO), bundles, tax, rounding and shipping. Today it is written 6 times, each slightly differently: `placeOrder`, `editOrder`, `buildInvoice`, `buildQuote` (no flat discount, different rounding, so quote → invoice totals can differ), `savePosSale` and PO `buildItems`. Discount math is triplicated inside `productController` (`:418-457,534,561`). — **partly done:** the storefront checkout rules are in `services/pricing/`. Still open: invoice, quote, POS and PO math (they have their own formulas) and tax/rounding moving to `utils/money.js` (§3.9)
- [x] `placeOrder` as one transaction: — **done:** stock (conditional) + deal usage (`usageLimit` atomic, `perUserLimit`) + counter number + `Order.create` + draft completion commit together; events fire only after commit. Steps 1–4 and 6–8 are done. Still open: step 5, discount usage recording (the Discount schema has no `usageCount`, §2.5). Tested in `test/placeOrderPricing.test.js` (rollback, deal limit, standalone fallback)
  1. load variants, products, deals and bundles with **`$in` (no N+1)**
  2. compute prices on the server
  3. `stock.reserve`
  4. enforce deal `usageLimit`/`perUserLimit` and increment `usedCount` atomically (today never enforced)
  5. record discount usage — **done:** conditional `$inc` on `Discount.usageCount` under `usageLimit` inside the same `withTx` (409/`DISCOUNT_LIMIT_REACHED`); standalone compensation. `test/integrityPhaseP0.test.js`
  6. `counter.next("order")`
  7. `Order.create`
  8. complete the draft
- [x] Idempotency: a unique partial `{storeId, checkout_draft_id}` or an `Idempotency-Key` header, so a double-click cannot create two orders. — **done:** `Order.idempotency_key` with a unique partial `{storeId, idempotency_key}`; checkout sends one key per attempt (reset after success); a repeat or a concurrent duplicate returns the existing order (`replayed: true`). Tested with 5 concurrent submits → 1 order
- [ ] Split `placeOrder` (470 lines, 100 of them card validation), `savePosSale` (310), `recordReturn` (185) and `getFinanceOverview` (190) into service functions.
- [x] Invoice `recordPayment` and `recordPOPayment`: use a conditional `$inc` on `amount_paid` with `remaining_balance >= amount`, inside a transaction (today concurrent payments can overpay). — **done:** invoice payment is a conditional `findOneAndUpdate` on `amount_paid` (409 `INVOICE_CHANGED`); PO payment is a conditional PO update plus the `PurchasePayment` create in one `withTx` (409 `PO_CHANGED`); the vendor balance comes only from the full recompute. `test/moneyConcurrency.test.js`: 5 concurrent payments → 1
- [ ] Shipping config and active rules: cache per store (Redis, invalidated on write), since every quote currently re-reads them (`shippingController.js:14,40`). Remove `supportsTx()`'s `admin.hello()` call on every PO delivery.

### 4.3 Dashboard, finance and stats (P3)
- [ ] Dashboard: `Order.find({})`, `Product.find({})`, `Discount.find({})` and `Brand.find({})` load **whole collections** to show 10 recent activities (`dashboardController.js:271-276`). Read them from `audit_events` with `{storeId, at:-1}` and `limit 10`.
- [ ] Dashboard: about 20 aggregations per load (`:97-253`). Read `store_daily_stats` for the range, and cache for 60s in Redis by `{storeId, range}`.
- [ ] Finance overview loads **5 entire collections** (with items, activity, returns and payments) and then filters, searches and pages in JS. It also runs `purchaseOrders.find` inside the payments loop, which is O(P×PO) (`financeController.js:96-274`). Replace this with reads from `ledger_entries`/`account_balances`/`payments` (§3.9), using an indexed `$match` on a `{storeId, at}` range. The sort parameter is currently ignored.
- [ ] Super-admin dashboard and `listUsers`: read cached platform stats instead of running platform-wide `countDocuments` and unanchored regex on every request (`superAdminController.js:177-209,1052-1066`). `activityFeed` runs 6 queries on an unindexed `actor.id` (`:1693`).
- [ ] Per-list status counts: orders (6 counts), deals (7), invoices (5), quotes (5), discounts (4), vendors (4 plus aggregate plus distinct), banners (6 plus 2 distinct). Replace each with **one** `$group` by status, or a `$facet`.

### 4.4 Catalog (P3)
- [ ] `getProducts` (310 lines, 5 response paths) becomes a `productQueryService` with one paginated path. The public endpoint always paginates and has a max limit.
- [ ] Keyset (cursor) pagination on `{created_at, _id}` for large admin lists, instead of `skip`. Keep `skip` only for the first few pages if the UI needs page numbers.
- [ ] Category subtree: compute the tree once per store and cache it (Redis, invalidated on category write). Today it is loaded and walked on every filtered request and copy-pasted 3 times (`productController.js:237,1207,1356`). Alternatively, store `ancestors: [ObjectId]` on Category and filter with `{storeId, ancestors: id}`.
- [ ] Search: build a `search_text` field (name, brand, category, SKUs, lowercased) on Product, maintained by `productSummary`. Use **prefix-anchored** `^term` matching on it, or a `{storeId:1, search_text:"text"}` text index. Move to Atlas Search later if you go to Atlas. This replaces the 4-branch unanchored `$or` (`:286-304`).
- [ ] `getProductById` (public):
  - remove the "legacy tag healing" writes (`:1563-1597`)
  - read the rating from the Product fields
  - move the PO, POS and invoice "document history" to an admin-only endpoint with indexes and limits
- [ ] Brands: remove the `Product.find` per brand (`brandController.js:170-177,474-481`). Use one `$group` by `brand_id`, or a stored `product_count`.
- [ ] Batch everything that loops:
  - `resolveTags` uses `bulkWrite` upserts (`productController.js:126`, `variantController.js:35`)
  - variant create/update in `createProduct`/`updateProduct`
  - `validateAttributePayload`
  - `assertValidParent`: use `ancestors`
  - `updateAttributeCategories`: two `updateMany` calls (`attributeController.js:480-518`)
  - `getAllTags` creator resolution: use `hydrate`
- [ ] `getStockOverview`: one `$facet` over Variant with `{storeId}` instead of a giant `$in` plus 6 scans (`stockController.js:110-163`).
- [ ] POS product search: query Product and Variant with the index, `limit 20` and prefix search. Today it loads the **whole catalog on every keystroke** (`posController.js:49-99`). `getPosReturns` unwinds the whole PosSale collection 3 times (`:265-288`).

### 4.5 Sales, CRM and the rest (P3)
- [ ] Add `.lean()` to every read-only query. There are 211 `find(` calls and 353 `.lean()` calls, but `placeOrder`, brand, variant and bundle reads, and the theme admin are missing it.
- [ ] Drop populates that duplicate snapshots (orders, POs). Use `$slice` projections for `edit_history` instead of slicing in JS (`posController.js:196-208`).
- [x] Remove the remaining unbounded "legacy mode" lists, or put a hard cap of 50 on them: — **done:** `utils/legacyListCap.js`; caps on getMyOrders, listInvoices (also uses filters), getDiscounts, getActiveDeals, listQuotes, getVendorsAdmin, getShippingRules, getCustomerPosHistory, getVariants (+is_deleted, no cost_price), getCategories, chat listMine, getMyReviews, customers legacy list + customer detail history (50). Socket `getProducts` still open.
  - [x] `getMyOrders`
  - [x] `listInvoices` (also ignores filters)
  - [x] `getDiscounts`
  - [x] `getActiveDeals`
  - [x] `listQuotes`
  - [x] `getVendorsAdmin`
  - [x] `getShippingRules`
  - [x] `getCustomerPosHistory`
  - [x] `getVariants`
  - [x] `getCategories`
  - [x] chat `listMine`
  - [x] `getMyReviews`
  - [x] customer and lead history (PosSale, Quote, Invoice with no limit)
  - [ ] socket `getProducts`
- [ ] Leads:
  - remove the double sync and double 6-populate in `getLead`/`updateLead` (`leadController.js:243-256,312,330`)
  - batch `validateReferences`
  - use `req.user.name` instead of re-querying the actor
- [ ] Chat:
  - per-store unread counter (Redis `INCRBY`, or a Store field), instead of aggregating every conversation after each send, read or open (`chatController.js:129-133`)
  - build the emit payload from the already-updated doc, which cuts `sendMessage` from about 7 queries to 3
  - batch `buildMessageContext` with `$in`
  - remove the double `findById` calls
- [ ] Theme:
  - `.lean()` reads; load the document once in `publish`
  - store a `draft_hash` instead of serializing draft and published to compare them on every response
  - answer a matching ETag with 304 before the DB read, using a cached version per store
- [ ] Subscriber export: stream from a cursor instead of building 50k rows in memory.
- [ ] Wishlist and checkout draft: `$addToSet`/`$pull`/positional updates instead of read → modify → save of the whole array.
- [ ] Platform-host uniqueness checks (username, phone) currently scan `User`/`Employee`/`SellerApplication`, and `sellerApplicationController.js:99` runs them up to 100 times in a loop. Index them (§3.3) and generate a unique candidate with one `$in` query.
- [ ] `superAdminAuth` loads the SuperAdmin including its `activities` on every request. Select only the needed fields once those move to `audit_events`.

---

## 5. P4: Architecture

### 5.1 Layers
Target structure (CommonJS kept):
```
backend/
  app.js            ← builds the express app (exportable, testable)
  server.js         ← listen + socket + schedulers + graceful shutdown
  config/env.js     ← validated env (one place)
  routes/           ← paths + middleware only, no logic
  controllers/      ← parse request → call service → send response (thin)
  services/         ← business logic (pricing, stock, order, invoice, pos, catalog, audit, counter, productSummary, email, ...)
  models/
  middleware/
  validators/       ← zod (or joi) schemas per endpoint
  jobs/             ← queue workers (translation, email, audit, stats, cleanup)
  utils/            ← small pure helpers
```
- [x] Split `app.js` from `server.js`. Today `server.js` calls `listen` on import, so the app cannot be tested. — **done:** `app.js` builds the app (exported, used by `test/app.test.js` through supertest); `server.js` owns HTTP, sockets (`app.set("io")`), DB, seeding, schedulers and listen
- [ ] Move all route-file logic into controllers or services: `categoryRoutes.js:38-256` (about 220 lines of handlers), `variantRoutes.js:41-59`, and the multer config in `storeRoutes.js:18-53`.
- [ ] Move `scripts/seedAttributes.js` (required at runtime by `models/Store.js:134`) into `services/`.
- [ ] `socket.js` (1050 lines) re-implements REST controllers using fake req/res objects, in 4 different variants. Keep sockets for **push notifications and chat only**, and move writes back to REST. Remove the permission migration that runs inside `getProfile`.

### 5.2 Errors and responses
- [ ] `utils/asyncHandler.js` plus an `AppError(status, code, message)` class plus **one** error-handling middleware (4 arguments) at the end of `app.js`. It maps: — **partly done:** `middleware/errorHandler.js` (`AppError`, classification, JSON with `requestId`, no raw 500 messages) is mounted last in `app.js`. Still open: `asyncHandler`, and moving controllers off try/catch
  - Mongoose `ValidationError` → 400
  - `CastError` → 400
  - E11000 → 409
  - multer errors → 413/400
  - everything else → 500, with a generic message and the details logged
- [ ] Remove about 415 try/catch blocks module by module.
- [ ] One response envelope:
  - `{ success: true, data, meta? }` / `{ success: false, code, message, errors? }`
  - Pagination `meta`: always `{ page, limit, total, totalPages }`, or `{ nextCursor }`

  Today you have bare arrays, `pages`/`totalPages`/`hasNextPage`, and 400s used for server errors. Coordinate with `frontend/src/apis/**`.
- [ ] Remove the per-router 404 handlers (bundle, deal, user) and keep the global one.

### 5.3 Validation
- [ ] Add **zod** (or joi) and a `validate({ body, query, params })` middleware.
  - Every write endpoint gets a whitelisted schema. That fixes mass assignment, NaN numbers and missing `newPassword` validation.
  - Query schemas enforce `limit <= 100`, sort whitelists and ObjectId params, which fixes 500s on bad ids such as `getCustomerPosHistory`.
- [ ] Reuse `phoneValidator.validatePhoneField`, which is currently unused, instead of the phone message ladder copy-pasted 4 times.

### 5.4 Auth and permissions
- [ ] One `requirePermission(key)` instead of 5 permission models:
  - `checkPermission` (`=== false` blocks)
  - inline finance (`=== true` required)
  - the controller re-check in `storeController.js:25`
  - `staffPermissionCheck`
  - unused `adminMiddleware`
- [ ] Use consistent permission keys (`chat`, `categories`, `newsletter`) and migrate the existing Employee docs. — **partly done:** schema dropped duplicate `orders` (keep `order`); `fixPermissions` merges `orders → order`
- [ ] Use audience-specific middleware: `requireUser` or `requireAdmin` on every route instead of the generic `authMiddleware`, which accepts either (chat, shipping quote, `/users/me|profile|password`, `sellerApplicationRoutes`).
- [ ] Auth cost per request: select only the fields auth needs (`_id storeId role permissions status is_deleted seller_pending name`), and cache the principal for 30–60s in Redis, invalidated on employee update or status change. The global limiter currently **verifies the JWT up to 4 times** per request before auth verifies it again (`rateLimit.js:164-251`). Verify once and put the result on `req`.
- [ ] Merge the duplicated auth flows into `services/auth.js`:
  - 5 login handlers
  - 3 refresh handlers
  - 3 OTP issue/send implementations
  - 3 change-password handlers
  - 3 profile readers
  - the `user:{...}` response object built 7 times
  - a duplicate seller onboarding path (the OTP-free `sellerApply`)
- [x] Signup and seller approval: wrap Store → SellerApplication → Employee in a transaction. Today a failure partway leaves an orphaned Store that blocks the retry, `approveRequest` updates the employee twice, and `createSellerStore` does a manual rollback. — **done:** both use `withTx` (standalone still compensates). `test/hardeningP0.test.js`

### 5.5 Config and server hardening
- [ ] `config/env.js`: validate every variable with zod at boot and fail fast with a clear message. Today a missing variable becomes `NaN`, for example in the limiter `max`/`WINDOW_MS` and `SOCKET_MAX_BUFFER_MB`. Remove the duplicate `TRANSLATION_MODEL_DOWNLOAD_CHUNK_BYTES` line in `.env`. Add a `.env.example`.
- [x] Add `helmet()`, `app.disable("x-powered-by")`, and per-route body limits instead of one large global `REQUEST_SIZE_LIMIT` (which was raised only for base64 KYC; send KYC as multipart). — **done:** default JSON `256kb`; only `POST /seller/apply/complete-setup` keeps `REQUEST_SIZE_LIMIT`. Multipart KYC still open.
- [x] Mount the global rate limiter **before** `resolveStore`, so unknown hosts cannot hit the DB unthrottled. Add limits for chat GET polling, staff sends and `/translation/page`. — **done:** global limiter now runs before `resolveStore` (chat still skipped). Dedicated chat/translation limits still open. `test/hardeningP0.test.js`
- [x] Graceful shutdown: on SIGTERM, `server.close()`, `io.close()`, drain the queues, `mongoose.disconnect()`. Add `unhandledRejection`/`uncaughtException` handlers that log and exit. — **done**
- [ ] Cache CORS origin checks, since they call `resolveStoreByHost` on every preflight (`server.js:126`).
- [ ] Use one router-import style. `server.js` currently mixes top-level imports with inline requires at lines 271-280.

### 5.6 Uploads: one factory
- [ ] `middleware/imageUpload.js`: `createImageUpload({ fields, maxCount, kind, idFrom, resize:{w,h,fit}, quality, rotate:true, maxPixels, maxBytes, reqKey, allowVideo })`.
  - One multer instance (memory, with a strict size limit) via `tenantMulter`.
  - One `processImage()` → webp → `{img_url, img_size, mimeType, width, height}`.
  - One multer-error mapper.
  - Clean up the written files if the controller fails.
- [ ] Replace the 8 copies: `imageMiddleware`, `productImageMiddleware` + `saveProductImages` (which **store the original unprocessed**, against the webp rule), `bundleImageMiddleware`, `dealImageMiddleware` (no sharp), `themeImageMiddleware`, `reviewUploadMiddleware`, `uploadMiddleware` (banners), and the inline logo multer in `storeRoutes.js`.
- [ ] Delete `middleware/uploadConfig.js`, a duplicate of `config/uploadConfig.js`.
- [ ] Delete files **after** a successful DB write, not before. Today `variantController.js:215-220,268-272` and `brandController.js:313-320` lose images when the save fails.
- [ ] Run sharp off the event loop where it is used inside socket handlers (`socket.js:81,105` use `writeFileSync`), or move those uploads to REST.

---

## 6. P5: Multi-instance scale (required before running more than one server)

### 6.1 Shared state in Redis
`REDIS_URL` already exists and is used for rate limits.
- [ ] **Socket.IO Redis adapter** (`@socket.io/redis-adapter`) plus sticky sessions at the load balancer, or `transports: ["websocket"]` first. Without it, `io.to(room)` reaches only sockets on the same instance, so chat messages and admin sync are lost.
- [ ] **`publicCache` → Redis.** Today it is one in-process Map with 500 FIFO entries shared by all stores (about 5 per store at 100 stores, so it constantly thrashes), and invalidation stays local.
  - Use versioned keys: `pc:{storeId}:{ns}:v{n}:{hash(url)}`. Invalidation = `INCR pc:{storeId}:{ns}:v`.
  - **Invalidate after the write succeeds** (`res.on("finish")` with 2xx). Today the drop middleware runs *before* the controller, so a concurrent GET re-caches stale data (`productRoutes.js:69`, `brandRoutes.js:37`, `categoryRoutes.js:266`, `bannerRoutes.js:22`).
  - Fix the namespaces that are never invalidated (featured toggles, bundles, attributes) and the no-op `invalidate(["theme"|"pages"])`.
  - Replace the 7 copied `drop*Cache` middlewares with one `invalidateOn(ns)`.
- [ ] **`resolveStore` cache**: today it is an unbounded Map that also caches misses (random Host headers grow memory) and is cleared only locally, and only from `storeController`. Super-admin subdomain, status and delete changes never clear it.
  - Use a bounded LRU (for example 5k entries) plus Redis pub/sub `store:changed` to invalidate across instances.
  - Cache a **slim projection** (`_id subdomain customDomain domainVerified store_status planId currency tax_rate`), not the full doc with `activity` and policies.
- [ ] Auth principal cache (§5.4), shipping config cache (§4.2), category tree cache (§4.4), chat unread counters (§4.5).

### 6.2 Schedulers: run once, not once per server
- [ ] `bannerScheduler` runs two cross-store `updateMany` calls every minute with no index, never invalidates the banner cache and never emits. `themeScheduler` and `themeImageCleanup` run on every instance too.
  - Use a leader lock (Redis `SET lock:scheduler NX PX 55000`), or run them in a separate `worker` process.
  - Add the scheduler indexes (§3.3), and invalidate and emit after each change.

### 6.3 Job queue (BullMQ on the existing Redis)
- [ ] **Translation:** today `queueTranslationSync` is a bare `setImmediate` with no dedupe, retry or limit, and jobs are lost on restart. LibreTranslate is a single global serial queue, so `POST /translation/page` waits behind every store's background jobs.
  - One job per `{model, id, fields}`, deduplicated by jobId, with retries, backoff, per-store fairness and a circuit breaker when LibreTranslate is down.
  - Skip the write and cache invalidation when nothing changed (`translationService.js:613-625`).
  - Fix the theme `inflight` Set that *drops* a second publish instead of queueing it (`themeTranslation.js:125`).
- [ ] **Email:** today it is sent inline in requests, with 15–20s SMTP timeouts × 2 retries, so one request can hang for about 70s (`otpController.js:75,201,497`, `sellerApplicationController.js:118`, `userController.js:376`). Queue it and return immediately.
- [ ] **Audit events, stats roll-ups, product summary refresh, store purge, image cleanup**: queue workers in `jobs/`.

### 6.4 Files
- [ ] Uploads live on local disk (`uploads/`), so a second server cannot see them. Move to object storage (S3, R2 or MinIO) behind `utils/uploadPaths.js`: keep `uploadDirFor`/`uploadUrlFor`/`localPathForUrl` as the only API, and swap the implementation. Serve through a CDN. Keep the KYC documents private (signed URLs, super admin only).
- [ ] Migrate the legacy root folders (`uploads/banners`, `bundles`, `deals`, `reviews`, `store`, `store-logos`) into `uploads/stores/<id>/...`, and stop creating them at startup (`server.js:80-82,293-302`).

### 6.5 Tenant-isolation hardening
- [ ] The plugin **fails open**: with no ALS context it applies no filter. Make store-owned models **throw** when there is no context and no `runUnscoped`/`skipTenantScope`. This turns silent cross-store leaks into loud errors.
- [ ] `insertMany` should reject a mismatched `storeId`, the same way `validate` does (`tenantScopePlugin.js:210-217`).
- [ ] Review all 36 `skipTenantScope` call sites, and add a comment on each explaining why.
- [ ] `scopeFieldForCollection` loops over every model for each `$lookup`. Build the Map once.

---

## 7. P0–P4: Observability and tests (start in week 1)

### 7.1 Logging and monitoring
- [x] Replace the no-op logger with **pino**: JSON logs with `reqId`, `storeId`, `userId`, route and duration, and `pino-http` for access logs. Keep the `log.*` interface so the 164 existing calls start working. Set the level per environment. — **done:** `utils/logger.js` (same `log.*` interface; `LOG_LEVEL`, default warn in dev / info in prod / silent in tests; pino-pretty in dev; secrets redacted), plus `pino-http` with `X-Request-Id`
- [ ] Error tracking (Sentry or similar) from the central error handler.
- [ ] Log slow queries: Mongoose `debug` in dev, the profiler in staging.
- [ ] `/health` (liveness) and `/ready` (Mongo, Redis and queue reachable).
- [ ] Basic metrics: request rate, latency p95, error rate per route, queue depth.

### 7.2 Tests (a safety net before the refactor)
- [ ] `mongodb-memory-server` (replica-set mode) plus `supertest` against `app.js`.
- [ ] **Permission matrix test:** for every route × {anonymous, customer, staff without permission, staff with permission, admin, other store's admin} → expected status. This would have caught every finding in §2.3 and the public/admin leaks in §2.1.
- [ ] **Cross-store isolation:** two stores, then `findById`, `populate`, `$lookup`, `bulkWrite`, `insertMany` and sockets, all confirming nothing crosses.
- [ ] **Concurrency:** 20 parallel orders for a stock of 5 → exactly 5 succeed. Parallel cancel → stock is restored once. Parallel counter → no duplicates. Parallel OTP guesses → the limit holds.
- [ ] **Pricing:** golden tests for `services/pricing.js` (deals, BOGO, bundles, tax, rounding) shared by order, POS, invoice and quote.
- [ ] Upload middleware: the type whitelist, size limits, and cleanup on failure.
- [ ] Rate-limiter mount test: every auth, OTP and email route has a limiter.
- [ ] Config validation test: a missing env variable fails boot with a clear error.
- [ ] CI: `npm test` plus lint on every PR.

---

## 8. P6: Cleanup (dead code and duplication)

### 8.1 Delete
- [ ] Unused npm dependencies: `image-size`, `jose`, `uuid` (none is required anywhere).
- [ ] `scripts/_tmp_patch_final2.js` (hardcoded localhost URI, test email and password `123456`).
- [ ] `scripts/testEmail.js` (prints nothing through the no-op logger). Fix it or delete it.
- [ ] `scripts/seedAllData.js` inserts rows with `storeId:null`. Rewrite it to take a `--store` argument, or delete it.
- [ ] `pushGlobalActivity` and `pushActivityToUser` (`utils/activityHelper.js`).
- [ ] `calculateDiscountedPrice` (`discountController.js:867-1055`) and its imports.
- [ ] `getBrands` (exported, never routed), `getProfileInfo`, `updateProfileREST` (unreachable), `needsPermissionMigration` (two copies), `adminMiddleware`, `requireStore`, `validatePhoneField` (or start using it), `STORE_ADDRESS_MIN`, `translateBatchMultiTarget`, `templatesAvailable`, `smtpConfigured`, `FINANCE_SORT_FIELDS`, `DELIVERY_FEE`.
- [ ] The `loadBrandModel` 4-path hack (`productController.js:18-34`), the `employee.userId` branch (`employeeController.js:799`), and the legacy Otp email-verification path (`otpController.js:218-223,538-581`).
- [ ] Phantom selects and fields: `-helpfulCount -helpfulBy` (`reviewController.js:132,521,577`), `frontBannerFields` reading fields that are not in the schema, the unused `displayRulesSchema`, the dead `Category.tenant_id`, and Product `product_code`/`sku` reads.
- [ ] Commented-out blocks and "REMOVED" stubs (`productController.js:1752,2269-2285`, `categoryController`, `tagRoutes.js:7`, `Category.js:80-85`).
- [ ] Unused imports: role symbols destructured in 5+ controllers, `socket.js:2`, `chatController.js:2`, `translationController.js:2`, and `path` in brand, review and banner controllers.
- [ ] Duplicate socket events (`banner:created` + `bannerCreated`, `discount:created` + `discountCreated`, and similar). Keep one naming style (`entity:action`) and update the `frontend/src/hooks/admin/use*SocketSync.js` hooks.

### 8.2 Merge into shared helpers (`utils/`)
- [ ] `escapeRegex`: about 12 copies.
- [ ] `emitSocketEvent` / `emitToStore`: about 11 copies.
- [ ] `parseLocale(req)`: about 20 copies.
- [ ] `paginate(query)` and `paginationMeta()`: hand-built about 18 times.
- [ ] `roundMoney`: 4 copies.
- [ ] `fail()`/error helpers (chat, theme, page, subscriber, contact): replaced by `AppError` (§5.2).
- [ ] Creator and actor resolution: `hydrate()` (§1).
- [ ] Guest token hashing (chat and socket), unread aggregate (chat and socket), rating summary (review and product).
- [ ] `TRANSLATABLE_FIELDS` vs `CONTENT_FIELDS` (`translationService.js:43,70`): one source of truth.
- [ ] Email: transport in `utils/mailer.js`, all templates in `services/email/` (move the OTP template and `escapeHtml` out of `utils/sendEmail.js`), and one retry with backoff, run by the queue.

### 8.3 API naming (coordinate with the frontend; do it last)
- [ ] Admin lists: pick one style, `GET /admin/<resource>`, instead of the current mix of `/admin/all`, `/admin` and `/`.
- [ ] Status changes: `PATCH /<resource>/:id/status`, instead of `/toggle`, `/toggle-status` and `/status`.
- [ ] Consistent plural mount paths, and `PATCH` for partial updates.
- [ ] One change-password endpoint and one profile endpoint per audience.
- [ ] Keep old paths as thin aliases for one release, then remove them.

---

## 9. Frontend (Next.js 16): security, data contracts, speed

Read `frontend/node_modules/next/dist/docs/` before any Next-specific change (Next 16 differs from older versions: middleware is `src/proxy.js`, plus the caching APIs and headers config).

### 9.1 Security (P0/P1)
What is already good and should be kept:
- Auth is httpOnly cookies only; no tokens are in localStorage, Redux or Zustand.
- The store-editor `postMessage` listeners check `origin` and `source` (`store-editor/components/PreviewFrame.js:190`, `storefront/ThemeProvider.js:142`).
- Theme links and CSS values are allowlisted (`storefront/themeLinks.js`, `themeCss.js:83`).
- No secret is `NEXT_PUBLIC_*`.

- [ ] **P0 Raw SVG store logo is stored XSS that crosses stores.** — **done for new uploads:** SVG was removed from the admin picker, the backend and the locale strings; no `.svg` files exist in local `uploads/`. Still open: the `/uploads` CSP/`nosniff` headers, and checking production uploads
  - The admin accepts `image/svg+xml` (`app/admin/store-info/page.js:712,1112`), and the backend writes the raw buffer (`backend/utils/socket.js:78-83`).
  - `/uploads` is served by plain `express.static` on **every** API host (`backend/server.js:180`). A seller's SVG therefore runs script on another store's API origin, or on the platform API origin, where host-only `a_at`/`sa_at` cookies are sent.
  - Fix:
    - remove SVG from both lists
    - re-encode the logo through sharp (§2.4)
    - serve `/uploads` with `Content-Security-Policy: default-src 'none'; sandbox`, `X-Content-Type-Options: nosniff`, and `Content-Disposition: attachment` for anything that is not a raster image
    - delete or convert the existing `.svg` files under `uploads/`
  - `app/admin/deals/page.js:1229` also accepts `image/*`.
- [x] **P0 Tenant spoofing through the proxy matcher.** — **done:** server code reads the tenant from `Host` (`getServerStoreHost()` in `lib/serverStore.js`), the matcher skips only `_next/static|_next/image|favicon.ico`, and the proxy deletes incoming `x-store-subdomain`/`x-internal-proxy-secret`. Verified with `next start`: a spoofed `x-store-host` on `/product/abc.png` renders no store data
  - The matcher skips any path ending in `.svg|png|jpg|jpeg|gif|webp` (`src/proxy.js:133`), so for `/product/abc.png` the proxy does not run and the **client's own `x-store-host` header** reaches server components.
  - `lib/serverStore.js:33-40` and `app/(user)/page.js:23-28` forward that header **together with `INTERNAL_PROXY_SECRET`**, so the backend serves store B's data under host A. That is content spoofing and cache poisoning, and it also skips the `storeExists` and `/admin` cookie checks.
  - Fix:
    - in server code, derive the tenant from `headers().get("host")` with `parseTenantHost`, never from `x-store-host`
    - narrow the matcher to `_next/static|_next/image|favicon.ico` plus real `public/` paths
    - in the proxy, always delete incoming `x-store-subdomain` and `x-internal-proxy-secret`
    - add `import "server-only"` to `lib/serverStore.js`
- [ ] **P1 Security headers: there are none** (no `headers()` in `next.config.mjs`, none in the proxy). — **partly done:** `next.config.mjs` `headers()` adds nosniff, Referrer-Policy, Permissions-Policy and HSTS (production), with `frame-ancestors none`/DENY on `/admin` + `/super-admin` and `self` on the storefront, plus `poweredByHeader:false`. Still open: the full CSP with nonce
  - Add `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=(self)` (the map section uses geolocation), and HSTS in production.
  - Add `frame-ancestors 'none'` on `/admin/:path*` and `/super-admin/:path*` (POS actions and approvals can be clickjacked today), and `'self'` on storefront paths (the store-editor preview iframe is same-origin).
  - CSP with a per-request nonce generated in `proxy.js` (the Next docs guide `content-security-policy.md`). The inline `beforeInteractive` theme scripts (`app/layout.js:37-46`) need the nonce.
  - Allow Google GSI, Google fonts, OSM tiles, and the API/socket origin in `connect-src`/`img-src`.
- [ ] **P1 Sanitize HTML during SSR too.**
  - `storefront/sections/GenericSections.js:30` and `storefront/product/ProductBlocks.js:139` return **raw HTML when `typeof window === "undefined"`**, so server-rendered output is unsanitized.
  - `app/(user)/pages/[slug]/page.js:48` never sanitizes.
  - Today only the backend `sanitizeRichText` protects them. Use `isomorphic-dompurify` (one `sanitizeHtml()` helper) on server and client, with `FORBID_ATTR: ["style"]`.
  - In `lib/termsContent.js:55-62`, drop `style` and remote `img` (they allow UI redressing and tracking pixels). The `"ul[data-type]"` entry is not a valid tag.
- [ ] **P1 CSRF between stores.** Every `<store>.<root>` is the *same site*, so `SameSite=Lax` gives no protection between stores (`backend/utils/tokens.js:125-129` can even be switched to `none` by env).
  - The backend should reject state-changing requests without `Content-Type: application/json` or the custom `X-Auth-Aud` header (which the frontend already sends), use a strict per-origin CORS allowlist, and never allow `SameSite=None`.
- [ ] **P1 Login CSRF in the admin handoff.** `app/admin-handoff/page.js:20-29` exchanges any `#token=` without confirmation, so an attacker's link logs the victim into the attacker's store.
  - Bind the token to a nonce cookie set on the platform host when the handoff was requested, or show "Continue as X to store Y?" first.
- [ ] **P2 Unbounded `storeCache` in the proxy.** `src/proxy.js:34-52` caches by any Host header, and each unknown host triggers a backend `/store/resolve` call. One transient 5xx is cached as "not found" for 60s.
  - Use an LRU capped at a few thousand entries, cache only `res.ok`, use a short TTL for negatives, and have nginx reject unknown hosts.
- [ ] **P2 Validate the remaining user-controlled links** with the `resolveThemeLink` rules (React 19 blocks `javascript:`, but don't rely on that alone): banner `button.link` (`components/user/BannerSlider.js:483`) and footer social `url` (`components/user/Footer.js:334`).
- [ ] **P2 Client-side storage hygiene:**
  - the guest chat token in localStorage (`components/chat/SupportChatWidget.js:28,325`) needs a short TTL
  - the POS held carts (`app/admin/pos/page.js:297-304`) and the quote template draft (`components/admin/QuoteTemplateDesigner.js:228,533`) must be cleared on logout (shared POS machines)
- [ ] **P2 Error messages:** about 73 places toast the raw backend `err.response.data.message`. Map them through one `toUserMessage(err)` that uses the backend `code` (§5.2).
- [ ] **P3 Route guards:** the proxy only checks that admin cookies exist (`src/proxy.js:97-100`), and `/super-admin` has no proxy check. The client shells do wait for `me()` before rendering, so there is no data flash. Add a `sa_sess` presence redirect in the proxy for consistency. Permission checks stay server-side (§5.4).
- [ ] **P3 Dependencies:** `html2canvas@1.4.1` and `react-phone-input-2@2.15.1` are unmaintained. Run `npm audit` in CI, and plan replacements (§9.4).

### 9.2 Send only what the page renders: storefront data contracts (P0/P1)
**Rule:** every endpoint returns a named **DTO** built by an explicit projection, never a whole Mongoose document. The DTOs live in `backend/dto/*.js`, one function per shape (`toProductTile(doc, locale)`), with a contract test that fails if a field outside the whitelist appears.

Translations are **sliced to the active locale on the server**: send `name` already localized, or `{name, nameLocal}`, never `translations.*` maps for every locale and never `translation_source`/`translation_status`. `storeId`, `__v`, audit refs and timestamps are left out unless the page shows them.

**P0: sensitive data reaching public storefront responses** (in addition to §2.1):
- [x] `GET /products/:id` returns: — **done:** see §2.1 (`optionalAdmin` + `redactPublic`; PO history, actors and tag healing are admin-only; ratings now use a ``)
  - `purchaseOrderHistory[]`, with `cost_price`, `sell_price`, `po_number`, `invoice_no` and `received_by_name` (`productController.js:1518-1555,1625`)
  - raw variants with `cost_price`
  - staff `createdby`/`updatedby` `{name,email}` (`:1490-1513`)

  It also runs 3 extra DB queries and **writes Tags** on a public GET (`:1563-1596`). Move the document history to an admin-only endpoint.
- [x] `GET /products` (every mode) returns full Variant docs (`cost_price`, `min_qnt/max_qnt/topup`, audit ids). Without `slim=1` it also returns staff name and email. — **done for public:** public lists always slim + variant projection without cost/thresholds/audit; admin legacy unchanged. Status `active` already forced for shoppers. `test/storefrontContractsP0.test.js`
  - The non-slim callers are the Header search (`components/user/Header.js:393`), `BundleCard.js:83`, `app/(user)/brand/[id]/page.js:86`, related products (`product/[id]/page.js:119`) and `search/page.js:36`.
  - Public reads also have **no `status:"active"` filter** (`buildProductFilter`, `productController.js:261-283`), and `getProductById` does not check status.
- [x] `GET /users/profile` (customer) runs `.populate("storeId")`, which sends the **whole Store document including `domainVerifyToken`**, `activity[]` and `planId` (`userController.js:668-670`). It also sends `google_id`, `provider` and `status`. — **done:** it populates only `store_name logo email phone currency subdomain customDomain`
- [x] `GET /store/public` sends `activity[]`, `planId`, `logo.public_id`, quote/invoice terms and their translations, and `__v` (`storeController.js:169-181`). — **done:** `STORE_PUBLIC_SELECT` + `publicStorePayload` whitelist. `test/storefrontContractsP0.test.js`
- [x] `GET /deals/active/:id` returns the full Deal (`createdBy`, `usageLimit`, `usedCount`, `perUserLimit`), full products and variants (`cost_price`), and has **no active/date check**, so expired deals can be read by id (`dealController.js:673-756`). — **done:** requires active + date window; strips usage/createdBy; variants omit `cost_price`. `test/hardeningP0.test.js`
- [x] `GET /discounts/public` sends every active discount's `code`, `usageLimit`, `perUserLimit` and `minOrderValue` (`discountController.js:837-848`). Send only what the badge shows, and validate codes at checkout. — **done:** badge/pricing fields only. `test/storefrontContractsP0.test.js`
- [x] `GET /reviews/product/:id` sends `storeResponse.responded_by_name` and other customers' `user_id` (`reviewController.js:131-137`). — **done:** ReviewItem DTO (`user:{name,avatar}`, storeResponse without responder). `test/storefrontContractsP0.test.js`
- [x] Socket `productCreated`/`productUpdated` events carry full variants (`cost_price`) and staff emails to every storefront visitor (`productController.js:1893-1905,2336-2350`). Socket events should carry **`{ _id, changed: true }` only** and let the client refetch its own DTO. Today `useUserSocketSync.js:86-89` also *replaces* the detail cache with that partial payload, so after any admin edit the product page loses its description, category and brand. — **done:** storefront payloads are id-only, and `useUserSocketSync` now invalidates by id instead of writing payloads into the cache

**DTOs to build (P1):**

| DTO | Fields | Used by | Today |
|---|---|---|---|
| `ProductTile` | `_id, name, category_id, brand:{_id,name}, price, compareAt?, totalStock, image, variantCount, rating?, singleVariant?:{_id,sku,price,qty,image}` | shop, filtering, home grids, brand rows, carousels, search, related, wishlist page, bundles | full product + all-locale translations + every full variant: about **120–150 KB for 24 tiles vs about 8–10 KB needed** (~15×) |
| `ProductDetail` | `_id, name, description, short_description, category:{_id,name}, brand:{_id,name}, isPerishable, expiryDuration, expiryUnit, rating summary, variants:[{_id,sku,title,description,price,qty,attributes,images:[url]}]` | `/product/[id]` | 60–80% unused, plus PO history, audit data and ratings computed twice |
| `VariantPicker` | `variants:[{_id,title,sku,price,qty,attributes,image}]` from `GET /products/:id/variants` | `VariantQuickBuyDrawer.js:120-235`, loaded **lazily when it opens** | every tile carries every variant |
| `CategoryNav` / `CategoryTile` | `{_id,name,parent_category_id,sort_order}` / `{_id,name,image,count,fromPrice}` | header/nav, home tiles | spreads the whole category (`productController.js:1349,1413`; `/categories/public`) |
| `BannerSlide` | `_id, position, desktopImage, tabletImage, mobileImage, eyebrow, heading, description, altText, primaryButton, secondaryButton` | `BannerSlider` | the `locale` param is ignored (`bannerController.js:234-258`), with `displayRules`, `createdby` and all locales |
| `StorePublic` | `store_name, tagline, logo.url, phone, support_email, support_phone, address, city, country, social_links, currency, store_status, maintenance_message` (policies via a separate `/store/content/:kind`) | layout, header, footer | full Store |
| `ProfileMe` | `_id, name, username, email, phone, dob, avatar, emailVerified, provider` | account and 9+ components | full user + populated store |
| `OrderListItem` | `_id, order_number, status, total, created_at, payment.status, itemCount, items[0..2]:{name,image,qty,price}` | orders, account | full docs, unpaginated legacy mode |
| `ReviewItem` | `_id, rating, title, comment, images[url], videos[url], verifiedPurchase, created_at, user:{name,avatar}, storeResponse:{message,responded_at}` | product reviews | all ratings loaded into Node for the summary (`reviewController.js:140`) |
| `DealCard` / `BundleCard` | the deal/bundle fields shown **plus resolved product tiles embedded**, paginated | `DealsSection`, `BundlesSection`, `/bundles` | `DealsSection.js:227` sends products twice (`productIds` with variants, plus `resolvedProducts`). The `images.img_url` populate is wasted because Product has no `images` field. **Each `BundleCard` makes its own `/products?ids=` request without slim (N+1, `BundleCard.js:80-86`).** |

- [ ] Build `ProductTile` with one `Variant.aggregate` (`$group` for the first price, the first image and the stock sum), like `getAdminListVariantSummaries` (`productController.js:783-800`), or read the Product read-model fields directly once §3.4 lands.
- [ ] **One endpoint, one shape.** Replace the `slim=1` flag and the legacy no-limit modes with dedicated endpoints (`/products/tiles`, `/products/:id`, `/products/:id/variants`), each always paginated where it is a list.

**Duplicate and wasted requests (P1):**
- [x] **Storefront calls an admin endpoint.** `usePageTranslations` (imported from `hooks/admin/`) runs in `hooks/user/useHomeCatalog.js:73` and `app/(user)/brand/[id]/page.js:73`, and calls `POST /translations/page`, which is `requireAdmin` (`backend/routes/translationRoutes.js:7`). — **done:** removed from `useHomeCatalog` and `brand/[id]`
  - For `ur`/`ar` customers that is a 401, then **3 retries every 5s, and each retry invalidates `["brands"]`, so the list refetches up to 4× per page load**.
  - Remove it from the storefront. The server returns localized text (above).
- [x] **Wishlist on every page:** `/users/wishlist` runs on every page (`WishlistContext.js:12-19`, no `staleTime`, and guests get a 401 every time), and it returns full products plus variants (`userController.js:1226-1259`). The provider needs only ids. — **done:** `GET /users/wishlist/ids`; context uses ids + `hasAuthSession`; full products only on `/wishlist`. `test/storefrontWasteP1.test.js`
  - Add `GET /users/wishlist/ids`, skip the call for guests, and send `ProductTile` only on `/wishlist`.
- [x] **The chat widget loads the whole order history even when closed:** `SupportChatWidget` is always mounted (`UserLayoutClient.js:184`) and fetches the **entire unpaginated `/orders/my`** plus conversations for every logged-in customer (`SupportChatWidget.js:166`). Gate both on `open`. — **done:** orders + customer/admin chats `enabled: … && open`. `test/storefrontWasteP1.test.js`
- [x] **Account page:** it fetches the full `/orders/my` only to count (`account/page.js:504-573`), while the embedded `OrdersView` fetches the paginated list again. Add `/orders/my/summary` (counts per status). — **done:** `GET /orders/my/summary` + account uses it. MyReviews fold still open. `test/storefrontWasteP1.test.js`
  - MyReviews, the chats page and the order detail also fetch all orders or all `/reviews/my`. Fold `myReview` into `/reviews/product/:id` for the logged-in user.
- [x] **SSR data fetched twice:**
  - `/store/public` is fetched in `generateMetadata` (`app/(user)/layout.js:15`) and again on the client (`UserLayoutClient.js:137`).
  - The home banners are server-rendered, but `BannerSlider` uses `staleTime:0, refetchOnMount:"always"` (`BannerSlider.js:161-170`), so it refetches right after hydration. The SSR fetch also has no `type` filter.

  Pass the SSR result as `initialData`, and set `staleTime` to 60s or more. — **done:** layout passes `initialStore`; BannerSlider `staleTime:60s` + no polling. `test/storefrontWasteP1.test.js`
- [x] `/theme/public` serializes translations for **all locales** into every page's RSC payload (`themeController.js:64-81`). Slice them to the `lang` cookie on the server. — **done:** slices when `locale` / `x-lang` / `lang` cookie is known; otherwise all locales for backward compat.
- [ ] **Waterfalls on product detail:** `getById` → related products, and `/users/profile` → `/reviews/my` (`product/[id]/page.js:108-126,679-692`). Fetch them in parallel or server-render them.
- [ ] Cart and checkout: the shipping-quote query key includes `Math.round(subtotal)` (`cart/page.js:245-262`, `checkout/page.js:761-767`), so **every quantity click POSTs a new quote**. Debounce it, and key by item ids plus method.
- [x] Header search: 400ms debounce, but it fires at 1 character and without slim (`Header.js:384-397`). Use a 2-character minimum, `limit 8` and `ProductTile`. — **done:** min 2 chars + `slim:1` + limit 8. `test/storefrontWasteP1.test.js`
- [ ] `["shopFacets","global"]` runs a full-catalog facet compute in Header and HomeNav on every page, only to sort the nav (`Header.js:352`, `HomeNav.js:231`). Ship `productCount` inside `CategoryNav` instead.
- [ ] Dead code: `Showcase.js` (calls the whole-catalog `productApi.getAll`; not imported) and `dealApi.getActivePaginated` (the backend branch is broken, §2.5).

**Rendering (P1):**

| Data | Where |
|---|---|
| Store info, theme, category nav, brands, category tiles, home banners | RSC fetch in the layout or page (tenant from `Host`, §9.1), passed to client components as `initialData`. Cache with the backend ETag/`Cache-Control` per host |
| Product detail | **Server-rendered** (SEO and LCP: the page is 100% client-fetched today), with `ProductDetail`. The client only refreshes stock |
| Shop grids and facets | Client (filter-driven), `ProductTile`, `keepPreviousData` |
| Wishlist ids, profile, orders, chat | Client, only when logged in, and lazily (the widget fetches when opened) |

### 9.3 Send only what the page renders: admin and super-admin data contracts (P0/P1)
**P0: socket events and admin responses that leak.** Every socket on a store host, including anonymous visitors, joins `store:<id>` (`utils/socket.js:444`), so each of these reaches the public. Fix them together with the admin/public room split (§2.1). An admin event carries `{ _id, changed_fields?, status? }`, and the admin client refetches its own DTO.
- [x] `employeeCreated`/`employeeUpdated`/`employeeStatusToggled` include the **password hash** (`employeeController.js:497-508,720-732,911-923`; `Employee.password` has no `select:false`). Add `select:false` to `password` in Employee, User and SuperAdmin. — **done:** `select:false` on Employee/User `password` and SuperAdmin `passwordHash`; login/change-password use `+password`. `test/hardeningP0.test.js`
- [x] `storeUpdated` sends the full Store (activity, `domainVerifyToken`) (`storeController.js:134`, `socket.js:664,690`). The public socket `getStoreInfo` returns the raw document (`socket.js:621`). `profileUpdated` with the populated store goes to the room (`socket.js:749`). — **done:** `storeUpdated` is admin room only (public gets `{changed:true}`), and the socket `getStoreInfo` returns the public projection to non-employee sockets
- [x] Order events send the raw Order with `address_snapshot` (name, phone, city) and `payment` (`orderController.js:14-18,495,1050,1153,1256`). The admin hook reads only `_id` (`hooks/admin/useOrderSocketSync.js:22-33`). — **done** (admin room plus the owner's room only)
- [x] `vendorCreated` sends `bank_details.account_no` (`vendorController.js:95`). `bank_details` is also in both vendor list modes (`:48,108`); keep it on the detail page only. — **done:** socket admin-only; list/legacy omit `bank_details`. `test/hardeningP0.test.js`
- [x] Product events send variants with `cost_price` and staff emails (`productController.js:1898,2340`). — **done** (admin room only; public gets `{_id}`)
- [ ] **Split the product endpoints:** `GET /products/admin/:id` (auth, current payload) and the public `GET /products/:id` (`ProductDetail`, §9.2). The admin edit page reuses the public endpoint today (`app/admin/products/[id]/page.js:1146`).
- [x] Lead detail embeds full PosSale, Quote and Invoice documents in `customer_history`, which no screen reads (`leadController.js:268-276`). Delete it. — **done.** `test/storefrontContractsP0.test.js`
- [x] The super-admin applications list sends `documents[]` (KYC), phone, address and rejection text (`superAdminController.js:276-281`). Whitelist `_id, name, email, store_name, business_category, city, country, logo, status, created_at`. — **done:** list select whitelist (no documents/address/passwordHash). `test/hardeningP0.test.js`
- [x] `GET /employees` has no permission check, so any staff member lists every employee's email and phone (§2.3). — **done earlier** (§2.3)

**P1: replace "load the whole collection into a dropdown" with search-as-you-type option endpoints.** Each option endpoint is `?search=&limit=20`, prefix match, indexed, and returns only label fields. React Query uses one key per option type.

| Endpoint (new or existing) | Returns | Replaces |
|---|---|---|
| `/brands/admin/options` | `{_id, name}` (localized) | legacy `brandApi.getAll`, an **N+1: one `Product.find` per brand**, non-lean, deleted products included (`brandController.js:468-482`). It is called on products list/edit mount, in `ProductFormModal`, banners, deals, discounts and the store-editor `fields.js:93`. `brands/page.js:316` loads it only to compute the next code, although `/brands/next-code` exists — **done:** endpoint + FE dropdowns (products/deals/discounts/banners/store-editor/ProductFormModal) use `getOptions`. Brands admin list page still uses paginated `getAllPaginated`. `test/storefrontWasteP1.test.js` |
| `/categories/admin/options` (**already exists**, `categoryRoutes.js:135`) | `{_id, name, parent}` | `getCategories` with populated attributes, parents and creators (`categoryController.js:516-527`), in the same 7 places |
| `/products/options` (or the existing `admin_list=1&admin_inventory=1`) | `{_id, name, price, image}` | legacy `/products`, which loads the whole catalog with every variant. `banners/page.js:858` loads it **on mount**. The store-editor `fields.js:105` calls `getPaginated` without `admin_list` on every keystroke, `fields.js:108` uses the heavy `getById` just for a label, and `store-editor/page.js:229` fetches a full document to get one `_id` |
| `/variants/picker` | `{_id, sku, title, selling_price, quantity, product:{_id,name}, image}` | `/variants` (no `is_deleted` filter, no `.lean()`, `cost_price`, all translations, populated creators, `variantController.js:116-127`) plus the legacy `stockApi.getAll()` in `quotes/new:276`, `invoices/new:72`, `QuoteTemplateDesigner.js:390` and `purchase-orders/new:161`. `quotes/[id]/page.js:31` loads all variants for names that `getQuote` already populates, so delete that query |
| `/customers/search` (**exists**, limit 20) | `{_id, name, phone, email, address}` | `customerApi.getAll({limit:500})`. The backend ignores `limit` without `page` and returns **every customer** (`customerController.js:38-43`), after running `syncLeadCustomer` for every converted lead (writes on a GET) |
| `/vendors/options`, `/employees/options`, `/plans/options` | `{_id, name, code?}` / `{_id, name, role}` / `{_id, name, status}` | full vendors with bank details (PO pages), full employees with email/phone/avatar (lead dropdowns), all plans (`StoreFormDialog.js:34`) |

**P1: move filtering, sorting and paging into MongoDB:**
- [ ] POS products: `posController.js:38-146` loads all products and variants, then filters, sorts and pages in JS, with an undebounced search (`pos/page.js:795`). Project `{_id, sku, title, selling_price, quantity, min_qnt, image}` with `limit 20`, and serve category/brand facets from a separate cached endpoint.
- [ ] Finance: `/finance/transactions?from&to&type&page` returns the list DTO `{id, kind, category, reference, title, counterparty, amount, date, method, status}`, with `/finance/transactions/:id` for the detail (reads §3.9 `ledger_entries`/`payments`).
- [ ] Dashboard: the activity panel (§4.3), and `recentOrders` gets a `select` (`dashboardController.js:253`).

**P1: detail endpoints that ship unbounded history:**

| Endpoint | Fix |
|---|---|
| `GET /customers/:id` (`customerController.js:107-131`, also `posController.js:688`) returns **every** PosSale, Quote and Invoice in full (items, `pdf_design`, payments, returns, edit_history). The quote and invoice "new" pages use it only to prefill | customer plus counts, then paginated `/customers/:id/sales`, `/quotes` and `/invoices` rows `{number, date, method, total, status}` |
| `GET /vendors/:id/details` returns 100 POs with full `activity`, and then the page makes **10 `purchaseOrderApi.getById` calls** for payments that the backend already loaded (`vendors/[id]:109-118`, `vendorController.js:212`) | return a slim `payments[]` and remove the N+1 |
| SA `getStore` / `getStoreAdmin` return 100 activity entries; 20 are rendered (`superAdminController.js:734,1146,1198`) | field projection plus paginated `audit_events` (§3.5) |
| SA `listTeam`/`getTeamMember` put `activities.slice(0,100)` on every list row (never rendered), and the detail page and `ActivityFeed` both **poll every 60s** with 6 queries each (`team/[id]:24`, `ActivityFeed.js:52`) | drop activities from list rows; one feed with no polling (use socket push) |
| `GET /theme` returns both `draft` and `published`; publish, restore and preview echo both, and `saveDraft` echoes the draft (`themeController.js:39-53,127,181-355`) | draft plus meta; `saveDraft` returns `{draftRevision}` only — **partly done:** `draft_hash` + hash compare; `saveDraft` returns `{draftRevision, draftUpdatedAt}` only. GET still returns both draft and published for the editor. |

**P1: trim list endpoints:**
- [x] Leads: no `select` (`leadController.js:203`), so `activities` and `history` are read and deleted in JS, and the translation internals still go out. `getLead` re-syncs on every GET (§3.6). — **done for list:** `.select` excludes activities/history/translation internals. `getLead` re-sync still open. `test/adminContractsP1.test.js`
- [x] PO list populates vendor phone, email, address and every translation (`purchaseOrderController.js:218`). The page uses the name, `vendor_code` and the localized name. — **done:** populate `name vendor_code translations.name`
- [x] POS sales list ships every item with populated translations and images (the UI previews 4), and reads the full `edit_history` to take the last entry (`posController.js:195-221`). The overview card calls `getSales({limit:1})` for a single counter; add `/pos/summary`. — **done:** list slim + `GET /pos/summary`. `test/storefrontWasteP1.test.js`
- [x] Quotes list returns translations for every locale (`quoteController.js:129,143`); invoices already slice them. The invoice list sends `translation_source/status` (`invoiceController.js:225`). — **done:** quotes locale-slice; invoice list drops translation_source/status. `test/adminContractsP1.test.js`
- [x] SA `listStores` has no `.select` (`superAdminController.js:667`). — **done:** whitelist select. `test/adminContractsP1.test.js`
- [x] SA `listTeam` dropped `activities` from list rows (detail keeps them). Customer list no longer write-syncs leads on GET. Vendor detail returns slim payments[] + capped POs. Brands `/admin/options` added.
- [ ] Already lean (keep as the reference pattern): products `admin_list`, stock paginated, customers, employees, orders paginated, discount and deal lists, SA users, chat.

**P2: socket invalidation storms and refetch triggers:**
- [ ] `useProductSocketSync.js:125-135` prefix-invalidates `["brands"]` (the N+1), every `["products"]` key and every `["product",*]` detail **on each event**. `variantController.js:93,230,274` emits `productUpdated` per variant save, so saving a product with N variants triggers N full refetch waves in every open admin tab, and `useStockSocketSync.js:40-42` refetches stock on top.
  - Patch the caches by id (`setQueryData`), and invalidate only `["product", id]` and the visible list page. Have the backend emit **one** event per save.
- [ ] Chat: one message emits 3 events and `markRead` emits 2 (`chatController.js:405-425`). Each reruns the list and `chat-counts` (4 separate `listAdmin` calls, `chats/page.js:43-64`), which adds up to **about 15 requests per incoming message**. `ChatThread.js:215-226` also refetches the page, although the payload contains the message.
  - Use `setQueryData` from the payload, one `/chat/admin/counts` aggregate, and debounced search with limits.
- [ ] Dashboard: about 20 event types trigger a full stats recompute (`dashboard/page.js:131-137,1062-1068`). Debounce the invalidation to about 5s and read the precomputed stats (§3.4).
- [ ] `staleTime: 0` overrides the 60s global default (`app/providers.js:17`) in `categories/page.js:357` and `attributes/page.js:520,619`. Remove these.
- [ ] Debounce search (300ms, at least 2 characters) in POS products/customers/history (`pos/page.js:482,795,930`), finance (`finance/page.js:315`) and chat.
- [ ] Unify duplicate query keys for the same data (`["admin-products"]`/`["deal-products"]`/`["discount-products"]`, and 4 category keys). Use one key factory in `src/lib/queryKeys.js`.
- [ ] Store logo upload sends base64 over the socket (`socket.js:645`). Move it to multipart HTTP (§5.6).

### 9.4 Speed and maintainability (P1/P2)
Measured from the existing `.next` build. Today home is **940 KB raw / 259 KB gzipped** of JS, and the storefront order detail page is **9,460 KB / 2,538 KB gz**.

**P1, biggest wins:**
- [ ] **The order detail page ships 2.5 MB gzipped** because `app/(user)/orders/[id]/page.js:15` statically imports `{Country, State, City}` from `country-state-city` (`city.json` alone is 8 MB). The same static import is in `admin/store-info/page.js:48`, `components/admin/VendorFormModal.js:5`, `admin/purchase-orders/new` and `admin/vendors/*`.
  - Read-only pages render the stored name (§3.10 stores code plus name).
  - Forms use `import()`, as `landing/signup:282` already does, or a backend `/geo/:country/states` endpoint.
- [ ] **Every storefront page load fetches everything twice.** `hooks/user/useUserSocketSync.js:58-60` runs `onReconnect` on the **first** `connect` too, and it invalidates 17 key families (categories, products, brands, deals, discounts, banners, facets, store and more). Item-level events invalidate the whole `["products"]` prefix, so one admin edit makes every connected shopper refetch every list. Polling runs on top (`BannerSlider.js:169`, `DealsSection.js:126`, `DiscountContext.js:17,25`, `useHomeCatalog.js:87`). — **done:** `useUserSocketSync` refreshes only on `socket.io` `reconnect`, and item events invalidate narrow keys. Polling is still to be removed
  - Invalidate only on a real `socket.io.on("reconnect")`.
  - Use narrow keys by id (with the `{_id}` socket payloads from §9.2).
  - Remove polling wherever the socket already covers it. — **partly done:** removed `refetchInterval` from BannerSlider, DealsSection, DiscountContext, useHomeCatalog.
- [ ] **Images are not optimized.** There is no `images` block in `next.config.mjs`, so `/_next/image` rejects the remote URLs that `utils/smartImageLoader.js` sends. Private hosts get `?w=&q=` appended, which the backend ignores, so the full-size file is served.
  - Only 18 of 117 `<FallbackImage>` uses go through next/image (most of them `unoptimized`), plus 15 raw `<img>`.
  - Add `images: { remotePatterns: [backend/CDN], qualities: [75] }`, and route product cards, banners and the product gallery through next/image with `sizes`.
  - Replace the deprecated `priority` prop with `preload` / `fetchPriority="high"` on the LCP image (Next 16 `image.md:291`).
  - Have the backend generate fixed widths (320/640/1080) at upload (§5.6), so the loader can request a real size.
- [ ] **i18n sends admin strings to every shopper.**
  - `i18n/translations.js:17` statically imports `en.json` (305 KB raw / 64 KB gz, about **25% of the home JS**), and roughly 223 KB of it is `admin.*`.
  - The storefront root `LanguageProvider` (`app/layout.js:46`) gets no `initialLocale`, so ur/ar users see **an English flash plus an LTR→RTL layout shift**.

  The fix:
  - Split into `storefront.<lc>.json` and `admin.<lc>.json`. `en.json` stays the fallback; split it with a script so the CLAUDE.md rule "add every new key to en.json" maps to the right namespace.
  - Read the `lang` cookie in `(user)/layout.js` and pass only the active namespace.
  - Set `<html lang dir>` on the server.
  - The admin layout already reads the cookie, but it inlines the whole dictionary (about 380 KB) into the HTML; serve the admin namespace as a cached static asset instead.
- [ ] **Admin opens about 4 WebSocket connections per tab.** `AdminLayoutClient.js:84`, `Navbar.js:28`, `Sidebar.js:95` and `hooks/admin/useAdminSocket.js:96` each call `io()`. The getters reuse a socket only when it is `.connected`, so connects and reconnects create more sockets, and the old ones keep their listeners.
  - Use **one** `getAdminSocket()` module singleton.
  - Storefront: connect the socket only when it is needed (logged in, chat open, or a page with live stock), not for every anonymous visitor (`UserLayoutClient.js:117`).
  - Load `SupportChatWidget` with `next/dynamic` on first open (`UserLayoutClient.js:19,184`). It currently imports `getAdminSocket`.
- [ ] **Render-blocking fonts.** `app/layout.js:31-37` loads 4 Arabic and Urdu families × 4 weights on every page through a blocking stylesheet, and the "media trick" the comment describes is not there. Meanwhile `Inter` (`globals.css:308`) is never loaded.
  - Use `next/font` (self-hosted, `display: swap`).
  - Load the RTL families only when the locale is ar or ur.
- [ ] **Cache server data per tenant.** `lib/serverStore.js` and `(user)/page.js` use `cache:"no-store"`, because the old cache was not keyed by host.
  - Next 16 `'use cache'` keys on function arguments (`01-directives/use-cache.md:76-99`). Pass `storeHost` as an argument, add `cacheLife` and `cacheTag("store:<id>:theme")`, enable `cacheComponents`, and call `revalidateTag` from admin saves (through a small authenticated route handler the backend calls after writes).
  - Hydrate React Query from that server data (`initialData`). Today `storeInfo` is fetched again in `UserLayoutClient.js:138`, `Header.js:332`, `Footer.js:152` and `product/[id]/page.js:694`, and `Header.js:338-353` fetches all categories, all brands and the global facets on every page.
- [ ] **Proxy store lookup** (`proxy.js:16-34`). It is cached, but in an unbounded per-instance Map with no in-flight dedupe, so concurrent cold hits stampede `/store/resolve`. A backend hiccup rewrites a real store to `/store-not-found`.
  - Use an LRU cap, a pending-promise map (single flight), and **stale-while-error** (serve the last known value). Also apply the §9.1 fixes.
- [ ] **Server-render the storefront pages.** 107 of 136 `app/` files are `"use client"`. `product/[id]` (1,410 lines, data loaded after hydration, so LCP waits on a waterfall), `brand/[id]`, `brands`, `deals/[id]`, `bundles` and `search` should become Server Components that pass DTOs to small client islands (add to cart, variant picker, gallery). Home server-renders only the banners; `HomeClient.js` fetches the rest on the client.

**P2, bundle and structure:**
- [ ] Lazy-load the remaining heavy editors and charts with `next/dynamic`:
  - [ ] `RichTextEditor` in `admin/terms-conditions/page.js:9` (the tiptap chunk is 430 KB)
  - [ ] `QuoteTemplateDesigner` in invoices/quotes `new` and `[id]`
  - [ ] recharts in `admin/dashboard:49` and the super-admin dashboard
  - [ ] `ColorPicker` (`fields.js:30`, `ElementPanel.js:15`)
  - [ ] `VariantForm`

  jspdf, html2canvas, leaflet, the VisualEditor and the section registry are already lazy, which is good.
- [ ] Use `libphonenumber-js/min` instead of `/max` (`AddressForm.js:7`): 84 KB vs 157 KB.
- [ ] **Remove Redux.** It is one slice (`redux/slices/storeInfoSlice.js`) mirroring server data, loaded on every storefront page through `providers.js:6`. Use the React Query `storeInfo` key instead, and drop `@reduxjs/toolkit`, `react-redux` and the root Provider. Keep Zustand for the store editor only.
- [ ] Remove unused dependencies: `react-select` and `next-themes` (no imports). Replace the 3 `react-icons` uses with lucide or inline SVG, and drop that package too.
- [ ] One `src/lib/queryKeys.js` factory. There are about 150 distinct key heads today, and the store document alone is cached under 4 keys (`storeInfo`, `store`, `admin-store-info`, `store-public`), so invalidations miss some. `setQueryData(["products"], arr)` writes an orphan key (`useUserSocketSync.js:76`).
- [ ] Axios: add a default `timeout` (for example 15s) to `axios.create`. Today only the refresh call has one, so a hung backend leaves spinners forever.
- [ ] Split the giant files, starting with the most-edited ones:
  - `admin/products/[id]/page.js` (3,816 lines, 38 `useState`, 7 queries): extract `VariantDetailsDrawer`, `ImageGalleryModal`, `AllAttributesModal` and `SearchableSelectField`
  - `admin/employees/[id]` (2,384)
  - `(user)/checkout` (2,279; desktop and mobile markup duplicated, `AddressForm` rendered twice)
  - `admin/categories` (1,974), `admin/products` (1,951), `admin/store-info` (1,731), `admin/banners` (1,731)
  - `CartContext.js` (911) and `Header.js` (902)
- [ ] Shared UI: move the local helpers (`Spinner` defined 12×, `StatusBadge` 13×, `StatCard` 5×, `Avatar` 7×) into `components/ui`.
- [ ] Global CSS: one 307 KB raw / 44 KB gz chunk on every page (`globals.css` plus `user.css` both imported in the root layout). Import `user.css` from the `(user)` layout only, and purge the unused rules.
- [ ] `public/` is 19 MB:
  - `public/banners/*.png` (9.8 MB) is not referenced in `src`. Confirm the backend seeds don't use it, then delete it.
  - `landing/hero-bg.mp4` is 4.7 MB; compress it, and add a poster image.
  - Convert the 1.7–1.8 MB PNG backgrounds to AVIF/WebP.
  - Add immutable `Cache-Control` for hashed and static media through `headers()`.
- [ ] `next.config.mjs`: add `poweredByHeader: false`, the `images` block, `cacheComponents`, and `headers()` (§9.1). Make `@next/next/no-img-element` an ESLint error.
- [ ] Delete dead files (never imported):
  - `hooks/useEmployeeSocket.js` (919 lines)
  - `hooks/useSocket.js` (174)
  - `components/user/Showcase.js` (360), `BrandSection.js` (111), `TrustBar.js` (95), `CategoryBar.js` (87), `BundlesSection.js` (68)
  - `components/superadmin/PlanModulesPanel.js` (173), `Topbar.js` (115), `ui/index.js` (15)
  - `components/admin/CalculationSummaryCard.js` (41)
  - the stale react-select comment block at `admin/store-info/page.js:202`

**Frontend performance budget (enforce in CI with `next build` output and Lighthouse CI):**
- [ ] Storefront route JS at most **150 KB gzipped** (home today: 259 KB; order detail: 2,538 KB).
- [ ] Storefront LCP under 2.5s and CLS under 0.1 on mobile 4G (no locale/RTL shift).
- [ ] Each storefront page makes at most **4 API requests** on first load, with no request repeated within `staleTime`.
- [ ] No API response on a storefront page over **50 KB**, and no field outside the page's DTO (contract tests, §9.2).

## 10. Suggested order (sprints)

| # | Sprint | Contents |
|---|---|---|
| 1 | **Safety net + P0** | pino logger, `app.js` split, supertest plus `MongoMemoryReplSet` setup, permission matrix test; every §2 item; frontend P0 (§9.1 SVG + proxy spoofing; the §9.2/§9.3 P0 leaks: product detail, profile populate, socket payloads + admin/public rooms, password `select:false`) |
| 2 | **DB foundation** | replica set wired in code (`?replicaSet=rs0`, `withTx`, delete the `supportsTx`/manual rollbacks, §3.1), `config/db.js` options, counters (§3.2), `is_deleted` backfills, Variant.is_deleted, Address.storeId, the index rebuild (§3.3) with `explain()` before and after |
| 3 | **Money and stock ledger** | `utils/money.js` + `*_minor` migration, `payments`, `returns`, `ledger_entries`, `account_balances`, `stock_levels`, `stock_movements`, `stock_reservations` (§3.9); `services/stock.js`, `services/pricing.js`, transactional `placeOrder` with idempotency, POS/invoice/PO in transactions, reconciliation jobs |
| 4 | **Shared reference data + read models** | `roles`, `payment methods`, `tax_classes`, `document_templates`, `attribute_templates`, `translation_memory`, `media`, Store split (§3.10); Product summary fields, `audit_events` migration, `store_daily_stats`; rewrites of dashboard, finance and facets |
| 5 | **API contracts** | backend `dto/` + contract tests; storefront DTOs (§9.2) and admin option/picker endpoints (§9.3); locale-sliced translations; socket `{_id}` payloads; split admin vs public product detail; remove legacy no-limit modes |
| 6 | **Frontend speed** | geo import, socket connect storm + polling, images config, i18n split + server locale, single admin socket, fonts, `'use cache'` per host + hydration, server-rendered product/brand/deal pages, remove Redux, lazy editors/charts, security headers + CSP (§9.1, §9.4) |
| 7 | **Architecture** | central error handler, zod validation, `requirePermission`, auth service merge, image upload factory, thin controllers for product, order, user and superAdmin |
| 8 | **Scale** | Redis cache and store cache, Socket.IO adapter, BullMQ (translation, email, audit), scheduler lock, object storage, change streams |
| 9 | **People model + cleanup** | Customer↔User link, Lead↔Customer ref, SellerApplication trim, stop translating names, avatars to files, timestamp/ref conventions, dead code (backend and frontend), shared helpers, giant-file splits, API naming |

## 11. Definition of done (targets)

- [ ] Every hot query in §3.3 shows `IXSCAN` with no in-memory `SORT` in `explain()`.
- [ ] No endpoint reads more than `limit` documents from a collection that grows with traffic (no full-collection `find` in any request path).
- [ ] p95 under 150ms for storefront list and detail and under 300ms for admin lists, on a seeded store with 50k products, 200k orders and 100 stores.
- [ ] Zero oversell in the concurrency test; zero duplicate document numbers.
- [ ] The permission matrix and cross-store isolation tests pass in CI.
- [ ] Two backend instances behind a load balancer: chat, admin sync, cache invalidation and schedulers all behave correctly.
- [ ] No `res.status(500)` in controllers, and every error is logged with `reqId` and `storeId`.
- [ ] Every money and stock change is a row in `payments`/`ledger_entries`/`stock_movements`; the nightly reconciliation reports zero drift; no float money fields remain.
- [ ] The app refuses to boot unless MongoDB is a replica set; no manual-rollback code remains.
- [ ] No storefront or socket response contains `cost_price`, staff emails, password hashes, `activity` logs, `domainVerifyToken`, bank details or another customer's data (contract tests).
- [ ] Frontend meets the §9.4 performance budget, and securityheaders.com grades the admin and storefront A.
