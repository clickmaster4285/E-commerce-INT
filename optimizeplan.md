# Backend and Database Optimization Plan

Scope: `backend/` (Express 5 + Mongoose 9) and the MongoDB data model, aimed at 100+ stores on one deployment.
Based on a full read of the backend at commit `1092d8d` (branch `optimizing_v1`), about 38.7k lines: 46 models, 37 controllers, 36 routes, 17 middleware files, 38 utils, scripts and tests.
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

## 0. Current state in numbers

- MongoDB runs as a **standalone** `mongod` (`MONGO_URI=mongodb://localhost:27017/...`). It is not a replica set, so **multi-document transactions are impossible**. Only one place tries one (`purchaseOrderController.js:442`, behind a feature check).
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
- [ ] Public `GET /products` (the no-limit branch) returns full variants with **`cost_price`**, populates `createdby`/`updatedby` **name and email**, and honours `?status=` from the query, so inactive products are public too (`productController.js:919-935`, `routes/productRoutes.js:39`). Add a public projection, force `status:"active"`, remove the creator populates, and require pagination.
- [ ] Public `GET /banners` and `GET /banners/:id` run the **admin** handler, which returns every status plus creator and updater emails (`routes/bannerRoutes.js:17,21`, `bannerController.js:148-152`).
- [ ] Public `GET /products/:id` and `GET /brands/:id/details` expose creator emails.
- [ ] `getPublicStoreInfo` returns the whole Store, **including the `activity` log** (`storeController.js:182-184`). Return an explicit public field list.
- [ ] `createEmployee` deletes the password only from `result.userId`, so **`result.password` (the bcrypt hash) is returned and broadcast to the store room** (`employeeController.js:498-509`). `updateEmployee` and `toggleStatus` broadcast the full doc too (`:721-732`, `:909-923`).
- [ ] **Every socket on a store host, including anonymous storefront visitors, joins `store:<id>`** (`utils/socket.js:444`). `io.emit` therefore sends full orders (address and phone), vendors (bank details), POs and discounts to the public. Split rooms into `store:<id>:admin` (staff only) and `store:<id>:public` (storefront-safe events), and audit every `req.io.emit`.
- [ ] Remove the client relay events. Any socket, guests included, can emit `productCreated` or `employeeRelay*` to the whole store (`utils/socket.js:1026-1032`). Only the server should emit.
- [ ] `sellerApplyStatus` is public and unthrottled, so anyone can look up an email's application status (`sellerApplicationController.js:138`).
- [ ] 500 responses return raw `error.message`, which leaks Mongo internals. The central error handler (§5.2) fixes this.

### 2.2 Money and trust
- [ ] **Checkout trusts client prices.** `displayPrice`, `savings`, `freeItems`, `payableItems`, `dealSavings` and the shipping `brandId`/`categoryId` all come from the request body (`orderController.js:235-246,320,406`). Recompute price, deal, bundle, tax and shipping on the server from DB data. The client sends only `{variant_id, qty}`.
- [ ] Remove the raw card number and CVV handling (`orderController.js:44-47`). Nothing is charged, and receiving them puts you in PCI scope. Use a payment provider's token flow when card payments are added.
- [ ] Mass assignment: `...req.body` is spread into
  - [ ] Deal (`dealController.js:143-149,452`): can set `usedCount` and `createdBy`
  - [ ] Vendor (`vendorController.js:349,525`): can set `balance_payable` and `is_deleted`
  - [ ] Brand (`brandController.js:105,295`)
  - [ ] Category `$set: req.body` (`categoryController.js:590-696`)
  - [ ] Banner (`bannerController.js:263,312`)

  Whitelist fields per endpoint (validation schemas in §5.3).
- [ ] A store admin can reopen a store the super admin closed (`storeController.js:81`). `store_status` should be writable by the super admin only.

### 2.3 Auth and abuse
- [ ] **Rate limiters `register`, `sendEmailOtp` and `verifyEmailOtp` are defined but never mounted** (`routes/userRoutes.js:47,73-74`). This allows email bombing and OTP guessing.
- [ ] OTP attempt counters are read, incremented and saved non-atomically, so parallel guesses get past the limit (`otpController.js:127-128,301-302`). Use `findOneAndUpdate({attempts: {$lt: max}}, {$inc: {attempts: 1}})`.
- [ ] Customer login, forgot-password and reset on the **platform host** use `User.findOne({email})` with no store, which picks an arbitrary store's customer (`userController.js:432`, `otpController.js:169,598,720`). Require store context, or refuse.
- [ ] Legacy `Store.findOne()` fallbacks with no store context can edit an arbitrary store (`userController.js:704,856,976`, `employeeController.js:461`). Remove them.
- [ ] Missing permission checks:
  - [ ] discount CRUD (`routes/discountRoutes.js:33-43`)
  - [ ] tags (check commented out, `routes/tagRoutes.js:7`)
  - [ ] `GET /employees` (`employeeRoutes.js:19-21`)
  - [ ] the `next-code` endpoints (brand, vendor, PO)
  - [ ] `GET /categories/admin/all` (`categoryRoutes.js:162`)
  - [ ] dashboard (`dashboardRoutes.js:10`)
  - [ ] the variants route, which has no permission key
- [ ] `requireSuperAdminRole` is never used, so super-admin team management has no route-level role gate (`superAdminAuth.js:57`).
- [ ] Unescaped user input goes into `RegExp` (injection and ReDoS) in:
  - [ ] `employeeController.js:212`
  - [ ] `orderController.js:527`
  - [ ] `discountController.js:352`
  - [ ] `bundleController.js:247`
  - [ ] `attributeController.js:188`
  - [ ] `tagController.js:74,130`

  Use one shared `escapeRegex` (§8).

### 2.4 Uploads
- [ ] SVG and any `image/*` are stored **with the client's extension** and served from the API origin, which is stored XSS (`routes/storeRoutes.js:32-37`, `dealImageMiddleware.js:19-22`). Re-encode everything through sharp to webp, whitelist `jpeg|png|webp|gif`, and add `X-Content-Type-Options: nosniff` (helmet).
- [ ] Review upload: 50MB memory storage × 6 files, about 300MB of RAM per request, and it runs **before** the rate limiter (`reviewUploadMiddleware.js:41-49`, `reviewRoutes.js:57-59`). Rate-limit first, then cap images at about 8MB and use disk or stream storage for video.
- [ ] Store logos and KYC documents bypass `uploadDirFor` and go to global folders (`userController.js:48`, `sellerApplicationController.js:18,292`).

### 2.5 Code that crashes or silently does nothing
- [ ] `approveRequest` calls `uniqueUsername`, which is not in scope (it is only required inside `createSellerStore`, `superAdminController.js:525` vs `:815`). The call throws **after** the application is marked approved.
- [ ] `utils/translationService.js:200` uses `izedName`, which is undefined (should be `localizedName`), so it throws a ReferenceError.
- [ ] `reviewController.js` calls `log.error` 6 times but never requires `log`, so every catch block throws again.
- [ ] `getActiveDeals` paginated mode uses `page`, which is never defined, so it always throws (`dealController.js:627`).
- [ ] `require("../models/Brand")` but the file is `models/brand.js`, which crashes on Linux (`dealController.js:409`; the `loadBrandModel` hack in `productController.js:18-34`). Rename the file to `Brand.js` and fix every import.
- [ ] Duplicate `PUT /users/profile` (`userRoutes.js:88` and `:111`), so the second handler can never run.
- [ ] Fields written or read that **are not in the schema** (strict mode drops them silently):
  - [ ] **Variant `is_deleted`**: missing entirely. Every `is_deleted:{$ne:true}` filter on Variant does nothing, and `deleteProduct` never soft-deletes variants (`productController.js:2388-2400`). Add the field and backfill it.
  - [ ] Discount `priceMin`, `priceMax`, `maxDiscountAmount`, `priority`, `usageCount`: price-range discounts and `max_discount` never work.
  - [ ] Deal `priority` and `code` are sorted and searched but do not exist.
  - [ ] PosSale `customer_snapshot.email/address/notes`; PurchaseOrder item `topup`.
  - [ ] Category `category_type`, `image_url`, `sort_order` (the sort on `sort_order` does nothing); Attribute `filterable`/`searchable`/`visible`; Tag `deleted_at`; Banner `altText`, `backgroundColor`, `displayRules`.
  - [ ] `pushGlobalActivity` queries `User.role in [admin, staff, manager]`, but User.role only allows `"user"`. It scans the whole collection on **every** login and mutation, and pushes to a field that does not exist (`utils/activityHelper.js:44-61`). **Delete it.** §3.5 replaces it.
- [ ] `editOrder` recalculates tax from `item.tax`, which order items never store, so tax becomes 0. It also changes quantities with no stock adjustment (`orderController.js:1086-1106`).
- [ ] `deleteStore` hard-deletes the store and its employees, but orphans every product, order and other store document (`superAdminController.js:1019-1021`). Replace it with soft delete plus an offline purge job (§3.7).
- [ ] Dashboard day buckets use server-local `setHours` but group by UTC `$dateToString` (`dashboardController.js:72-75,104`). Use the store's timezone in both.

---

## 3. P1/P2: Database

### 3.1 Infrastructure (P1, blocks the transactions work)
- [ ] Run MongoDB as a **replica set** (a single-node `rs0` is fine for dev; use 3 nodes, or Atlas, in prod). This enables transactions, change streams and retryable writes.
- [ ] Remove the forced `retryWrites=false` from `config/db.js` (it was only needed for a MongoDB-compatible host that rejects retryable writes).
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
- [ ] New collection `counters { storeId, key, seq }` with unique `{storeId, key}`.
- [ ] `utils/counter.js`: `next(key)` = `findOneAndUpdate({storeId, key}, {$inc:{seq:1}}, {upsert:true, new:true})`, formatted as `ORD-000123`.
- [ ] A migration seeds each counter from the current max per store.
- [ ] Delete `QuoteNumberReservation`, or give it a TTL (`Quote.js:63`).

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
- [ ] **Wishlist**: ✚ unique `{storeId, user_id}`. **ShippingConfig**: ✚ unique `{storeId}` (concurrent `getConfig()` calls currently create duplicates).
- [ ] **Otp**: ✖ `{email}` (covered by `{email, purpose, created_at}`)
- [ ] Soft-delete unique indexes `{storeId, code, is_deleted}` on Attribute, Category, Brand and Vendor fail with E11000 the second time the same code is deleted. Convert them to a **partial unique index on `is_deleted:false`**.
- [ ] **Plugin change**: stop auto-adding the single `storeId` index when the schema already declares a compound index starting with `storeId` (an option such as `tenantScope(schema, { index: false })`). It is pure write overhead.
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
- [ ] Add `Lead.customer_id` as the real link, and drop `syncLeadCustomer`'s regex lookup and the **write-on-read** (`customerController.js:14-18` re-syncs every converted lead on every list request).
- [ ] `SellerApplication`: keep application-only fields (KYC, status, reviewer, reason) plus `store_id`/`employee_id` refs. Remove the copies of store profile fields and `passwordHash` once the employee exists.
- [ ] `PendingRegistration`: scope it by store (`{storeId, email}` unique instead of a global `email`), and add the tenant plugin or an explicit storeId filter.
- [ ] `Address`: add `tenantScope` and backfill `storeId` from the user. It currently has no `storeId` at all.
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
- [ ] Store deletion: `store.status = "deleted"`, then an offline `scripts/purgeStore.js` that deletes every store-owned collection by `storeId` and the `uploads/stores/<id>` folder.
- [ ] Store suspension: `resolveStore` should check `store_status` (closed, suspended, maintenance) **once**, instead of looping over every user and employee to block them (`superAdminController.js:780-786`). The current approach also wrongly unblocks individually blocked accounts.
- [ ] Retention TTLs:
  - RefreshSession: on revoke, set `expiresAt` to now plus grace (today revoked sessions live 30 days, about 720 docs per admin per month)
  - abandoned guest chats
  - archived contact messages
  - SuperAdminActivity

### 3.8 Migration process
- [ ] `scripts/migrations/NNN-name.js` with `up()`, a dry-run by default, `--apply`, and a `migrations` collection that records what ran.
- [ ] Archive the one-off scripts that already ran (`renameAuthCollections.js`, `backfillSubdomains.js`, `migrateAttributesPerStore.js`) into `scripts/migrations/archive/`. Note: `renameAuthCollections` drops `superadmin_activities`, which is still in use.
- [ ] Order: **backups → field backfills (`is_deleted:false`, Variant.is_deleted, Address.storeId) → counters seed → new indexes (built online) → read-model backfill → audit move → drop old indexes and fields**.

---

## 4. P1/P3: Data integrity and query performance per module

### 4.1 Stock: one service, atomic writes (P1)
Today stock is changed in about 8 copy-pasted places (order, cancel, delete, POS sale/edit/return, invoice create/edit/return, PO delivery, manual adjust, product/variant update). Most do read → check → set → save, so **concurrent orders oversell**. The order flow decrements before `Order.create` and never rolls back (`orderController.js:312,356,434`), and order flows write no StockHistory.
- [ ] `services/stock.js`:
  - `reserve(items, session)` = `findOneAndUpdate({_id, quantity: {$gte: n}}, {$inc: {quantity: -n}})`, failing on the first miss
  - `release(items, session)`
  - `set(variantId, qty, reason, session)`

  Every call writes a `StockHistory` row and calls `productSummary.refresh` in the **same transaction**.
- [ ] Replace every direct `quantity` write in controllers, including `updateVariant`/`updateProduct` (`variantController.js:170-177`, `productController.js:1860,2137`), which overwrite quantity with no history.
- [ ] Order cancel and delete: use a conditional status transition, `findOneAndUpdate({_id, status: {$ne: "cancelled"}}, ...)`, so two concurrent cancels cannot restore stock twice (`orderController.js:1016-1048,1183-1198`).
- [ ] PO delivery: do the status transition plus stock in one transaction, so it is idempotent (`purchaseOrderController.js:411-482`).
- [ ] POS returns: do the return-quantity check plus stock inside one transaction (`posController.js:311-349`).

### 4.2 Checkout and pricing (P1)
- [ ] `services/pricing.js`: **one** implementation of line pricing, discounts, deals (BOGO), bundles, tax, rounding and shipping. Today it is written 6 times, each slightly differently: `placeOrder`, `editOrder`, `buildInvoice`, `buildQuote` (no flat discount, different rounding, so quote → invoice totals can differ), `savePosSale` and PO `buildItems`. Discount math is triplicated inside `productController` (`:418-457,534,561`).
- [ ] `placeOrder` as one transaction:
  1. load variants, products, deals and bundles with **`$in` (no N+1)**
  2. compute prices on the server
  3. `stock.reserve`
  4. enforce deal `usageLimit`/`perUserLimit` and increment `usedCount` atomically (today never enforced)
  5. record discount usage (today never recorded)
  6. `counter.next("order")`
  7. `Order.create`
  8. complete the draft
- [ ] Idempotency: a unique partial `{storeId, checkout_draft_id}` or an `Idempotency-Key` header, so a double-click cannot create two orders.
- [ ] Split `placeOrder` (470 lines, 100 of them card validation), `savePosSale` (310), `recordReturn` (185) and `getFinanceOverview` (190) into service functions.
- [ ] Invoice `recordPayment` and `recordPOPayment`: use a conditional `$inc` on `amount_paid` with `remaining_balance >= amount`, inside a transaction (today concurrent payments can overpay).
- [ ] Shipping config and active rules: cache per store (Redis, invalidated on write), since every quote currently re-reads them (`shippingController.js:14,40`). Remove `supportsTx()`'s `admin.hello()` call on every PO delivery.

### 4.3 Dashboard, finance and stats (P3)
- [ ] Dashboard: `Order.find({})`, `Product.find({})`, `Discount.find({})` and `Brand.find({})` load **whole collections** to show 10 recent activities (`dashboardController.js:271-276`). Read them from `audit_events` with `{storeId, at:-1}` and `limit 10`.
- [ ] Dashboard: about 20 aggregations per load (`:97-253`). Read `store_daily_stats` for the range, and cache for 60s in Redis by `{storeId, range}`.
- [ ] Finance overview loads **5 entire collections** (with items, activity, returns and payments) and then filters, searches and pages in JS. It also runs `purchaseOrders.find` inside the payments loop, which is O(P×PO) (`financeController.js:96-274`). Replace this with a `ledger_entries {storeId, at, type, refType, refId, amount, method}` collection written by order, POS, invoice and PO payments, queried with an indexed `$match` on a date range. The sort parameter is currently ignored.
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
- [ ] Remove the remaining unbounded "legacy mode" lists, or put a hard cap of 50 on them:
  - [ ] `getMyOrders`
  - [ ] `listInvoices` (also ignores filters)
  - [ ] `getDiscounts`
  - [ ] `getActiveDeals`
  - [ ] `listQuotes`
  - [ ] `getVendorsAdmin`
  - [ ] `getShippingRules`
  - [ ] `getCustomerPosHistory`
  - [ ] `getVariants`
  - [ ] `getCategories`
  - [ ] chat `listMine`
  - [ ] `getMyReviews`
  - [ ] customer and lead history (PosSale, Quote, Invoice with no limit)
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
- [ ] Split `app.js` from `server.js`. Today `server.js` calls `listen` on import, so the app cannot be tested.
- [ ] Move all route-file logic into controllers or services: `categoryRoutes.js:38-256` (about 220 lines of handlers), `variantRoutes.js:41-59`, and the multer config in `storeRoutes.js:18-53`.
- [ ] Move `scripts/seedAttributes.js` (required at runtime by `models/Store.js:134`) into `services/`.
- [ ] `socket.js` (1050 lines) re-implements REST controllers using fake req/res objects, in 4 different variants. Keep sockets for **push notifications and chat only**, and move writes back to REST. Remove the permission migration that runs inside `getProfile`.

### 5.2 Errors and responses
- [ ] `utils/asyncHandler.js` plus an `AppError(status, code, message)` class plus **one** error-handling middleware (4 arguments) at the end of `app.js`. It maps:
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
- [ ] Use consistent permission keys (`chat`, `categories`, `newsletter`) and migrate the existing Employee docs.
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
- [ ] Signup and seller approval: wrap Store → SellerApplication → Employee in a transaction. Today a failure partway leaves an orphaned Store that blocks the retry, `approveRequest` updates the employee twice, and `createSellerStore` does a manual rollback.

### 5.5 Config and server hardening
- [ ] `config/env.js`: validate every variable with zod at boot and fail fast with a clear message. Today a missing variable becomes `NaN`, for example in the limiter `max`/`WINDOW_MS` and `SOCKET_MAX_BUFFER_MB`. Remove the duplicate `TRANSLATION_MODEL_DOWNLOAD_CHUNK_BYTES` line in `.env`. Add a `.env.example`.
- [ ] Add `helmet()`, `app.disable("x-powered-by")`, and per-route body limits instead of one large global `REQUEST_SIZE_LIMIT` (which was raised only for base64 KYC; send KYC as multipart).
- [ ] Mount the global rate limiter **before** `resolveStore`, so unknown hosts cannot hit the DB unthrottled. Add limits for chat GET polling, staff sends and `/translation/page`.
- [ ] Graceful shutdown: on SIGTERM, `server.close()`, `io.close()`, drain the queues, `mongoose.disconnect()`. Add `unhandledRejection`/`uncaughtException` handlers that log and exit.
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
- [ ] Replace the no-op logger with **pino**: JSON logs with `reqId`, `storeId`, `userId`, route and duration, and `pino-http` for access logs. Keep the `log.*` interface so the 164 existing calls start working. Set the level per environment.
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

## 9. Suggested order (sprints)

| # | Sprint | Contents |
|---|---|---|
| 1 | **Safety net + P0** | pino logger, `app.js` split, supertest plus memory-server setup, permission matrix test; every §2 item |
| 2 | **DB foundation** | replica set, `config/db.js` options, counters (§3.2), `is_deleted` backfills, Variant.is_deleted, Address.storeId, the index rebuild (§3.3) with `explain()` before and after |
| 3 | **Integrity** | `services/stock.js`, `services/pricing.js`, transactional `placeOrder` with idempotency, POS/invoice/PO in transactions, atomic payments and OTP |
| 4 | **Read models** | Product summary fields, `audit_events` migration, `store_daily_stats`, `ledger_entries`, rewrites of dashboard, finance and facets |
| 5 | **Architecture** | central error handler, zod validation, `requirePermission`, auth service merge, image upload factory, thin controllers for product, order, user and superAdmin |
| 6 | **Scale** | Redis cache and store cache, Socket.IO adapter, admin/public rooms, BullMQ (translation, email, audit), scheduler lock, object storage |
| 7 | **People model + cleanup** | Customer↔User link, Lead↔Customer ref, SellerApplication trim, stop translating names, avatars to files, timestamp/ref conventions, dead code, shared helpers, API naming |

## 10. Definition of done (targets)

- [ ] Every hot query in §3.3 shows `IXSCAN` with no in-memory `SORT` in `explain()`.
- [ ] No endpoint reads more than `limit` documents from a collection that grows with traffic (no full-collection `find` in any request path).
- [ ] p95 under 150ms for storefront list and detail and under 300ms for admin lists, on a seeded store with 50k products, 200k orders and 100 stores.
- [ ] Zero oversell in the concurrency test; zero duplicate document numbers.
- [ ] The permission matrix and cross-store isolation tests pass in CI.
- [ ] Two backend instances behind a load balancer: chat, admin sync, cache invalidation and schedulers all behave correctly.
- [ ] No `res.status(500)` in controllers, and every error is logged with `reqId` and `storeId`.
