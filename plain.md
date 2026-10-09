# Vendor & Purchase Order Plan — Admin Panel (Detailed + Necessity Check)

> File: `E-commerce-INT/plan.md` (root, next to `backend/` + `frontend/`)
> Status: IMPLEMENTED + TESTED (was plan only).
> Source spec: user 20-section spec (Vendor + PO) validated against current codebase.

## 0. TL;DR — What Is Necessary

| # | Your spec item | Necessary? | Project reality / decision |
|---|---|---|---|
| 1 | Vendor model with VND-XXXXX, soft-delete, audit | **Yes** | Clone `backend/models/brand.js` pattern: `vendor_code + is_deleted` unique, `createdby/updatedby/deletedby -> Employee`, `created_at/updated_at`. Pad 5 (`VND-00001`) like `ORD-00001`, not Brand's pad 3. |
| 2 | PO model PO-00001, snapshot, server totals | **Yes** | Clone `Order.js` numbering + snapshot pattern (`orderController.js:268-319`). Never trust frontend totals. Preserve `cost_price` per line. |
| 3 | Status `draft→sent→confirmed→partially_received→received→closed` + `cancelled` | **Yes, use `closed` not `completed`** | Old draft used `completed`. Standardize to `closed` per your spec. `closed` = view-only, all qty received (payment may still be partial — see §6). |
| 4 | Receive = ONLY auto stock-in | **Yes** | `Variant.quantity += qty` + `StockHistory` + `stockUpdated` socket (same as `stockController.js:428-440`). No change to manual adjust or customer `placeOrder` decrement. |
| 5 | Atomic receiving via transaction/session | **Yes with fallback** | Mongoose `9.9.1` supports tx, but `backend/config/db.js` is plain `mongoose.connect(MONGO_URI)` — standalone MongoDB **does not** support tx. Plan: try session; if `MONGO_URI` is standalone, fallback to ordered atomic `$inc` + over-receive guard + idempotency key. Must test both. Cannot assume tx works. |
| 6 | Payment separate from receiving, `unpaid/partial/paid` | **Yes** | Do NOT embed single payment object like `Order.payment`. Separate `PurchasePayment` model is **necessary** (not optional) because acceptance requires multiple partial payments without corrupting `Vendor.balance_payable`. |
| 7 | Supplier invoice no + date + explanation on receive | **Yes** | Store in PO `receivings[]` + copy to `StockHistory.explanation` (`reason:"purchase"`). `StockHistory.reason` is free String today, no schema migration needed. `explanation` required (same rule as `adjustStock`). |
| 8 | Backend files `models/controllers/routes` + mount `/api/vendors`, `/api/purchase-orders` | **Yes** | Follow `brandRoutes.js:35-38`, `orderRoutes.js:29-33`, `stockRoutes.js:16-35` + mount in `server.js:156-175`. |
| 9-10 | Vendor + PO APIs as listed | **Yes + 1 addition** | Add `POST /vendors/:id/restore` — Brand has no restore route (only `softDelete()` method), so Vendor needs explicit restore endpoint. Otherwise lists as spec'd. |
| 11 | Permissions `vendors`, `purchaseOrders` | **Yes, 5 places** | `models/Employee.js:32-51` + `controllers/employeeController.js: fixPermissions:114-130, requiredKeys:148-165, permissionKeys:625-629` + `server.js:242-247` seed + `Sidebar.js` + `layout.js`. Miss one = legacy `undefined` = allow (see `checkPermission.js:22-27`) → security hole. |
| 12-17 | Frontend pages + sidebar PURCHASING + receive modal | **Yes** | `/admin/vendors`, `/admin/vendors/[id]`, `/admin/purchase-orders`, `/admin/purchase-orders/new`, `/admin/purchase-orders/[id]` + `vendorApi.js` + `purchaseOrderApi.js` via `adminHttp`. |
| 18 | Inventory rules (PO create/sent/confirmed = no stock) | **Yes** | Enforce in controller, not just UI. |
| 19-20 | E2E flow + staged order | **Yes** | Keep your 8 stages. Do not one-shot. |
| — | `supplied_product_ids` on Vendor as source of truth | **No — omit V1** | Agree with your spec: PO history (`PurchaseOrder.vendor_id`) is source. Optional denormalized cache only, or skip. |
| — | Public vendor/storefront APIs | **No** | Admin-only. No `publicCache`, no user shop change. |

## 1. Current Project (verified)

Backend: Express 5 + Mongoose 9 + Socket.io, `API_PREFIX` from `.env`.
- Model pattern: `brand.js:5-79` (code, `is_active`, `is_deleted/deleted_at`, `createdby/updatedby/deletedby`, `created_at/updated_at`), unique `{brand_code:1,is_deleted:1}`, `findActive/softDelete/restore`.
- Code gen: `brandController.js:14-26 generateNextBrandCode()` scans `BRD-###` + `normalizeBrandCode`. Reuse for `VND-` and `PO-`.
- Order numbering: `orderController.js:269-280 getNextOrderNumber()` → `ORD-00005`, retry 5× on 11000. Reuse for `PO-`.
- Stock: `Variant.quantity` (`Variant.js:64-68`), `StockHistory` (`StockHistory.js:3-83`: `variant_id required, product_id, sku, previous/new/change, adjustment_type add|remove|set, reason String, explanation String`). `adjustStock` requires `explanation` (`stockController.js:286-291`), emits `stockAdjusted` + `stockUpdated`.
- Customer Order: `Order.js:5 order_number unique`, items snapshot, `placeOrder` decrements `Variant` (`orderController.js:208-213`), cancel restores (`527-542`), emits `stockUpdated` + `order:created/updated`.
- Auth: `authMiddleware.js` (Bearer or `accessToken` cookie, `type: employee|user`, `is_deleted/status` checks). Permission: `checkPermission.js:7-31` (admin bypass, else only explicit `false` blocks).
- Employee perms: `Employee.js:32-51` + `employeeController.js: fixPermissions + needsPermissionMigration + updateEmployee permissionKeys`. Must update all three + seed.

Frontend (Next.js, `frontend/src`):
- Admin pages: `src/app/admin/<brands|categories|products|manage-stock|orders|employees|...>/`. Guard: `src/app/admin/layout.js:18-36 ROUTE_PERMISSIONS`. Sidebar: `src/components/adminComponents/Sidebar.js:98-153 sections + allMenuItems`, filter `442-456`.
- APIs: `src/apis/admin/*Api.js` via `adminHttp` (`src/apis/adminHttp.js`, refresh `/users/admin/refresh-token`). `brandApi.getAllPaginated` + `orderApi.getAll/getById/updateStatus/updatePayment` are copy templates.
- No vendor/PO code exists today.

## 2. Where In Admin Panel

New section between OPERATIONS and STORE:

```
OVERVIEW: Dashboard
CATALOG: Brands, Categories, Attributes, Products, Featured Products, Reviews
SALES & MARKETING: Discounts, Deals, Banners
OPERATIONS: Manage Stock, Orders, Shipping
PURCHASING: Vendors, Purchase Orders   <- NEW
STORE: Store Info
TEAM & ACCOUNT: Employees, Profile
```

Routes + guard (`layout.js`):
```js
'/admin/vendors': 'vendors',
'/admin/purchase-orders': 'purchaseOrders',
```
Sidebar (`Sidebar.js`): `Vendors (Factory icon, permissionKey: vendors)`, `Purchase Orders (ClipboardList icon, permissionKey: purchaseOrders)`.
Employees UI: add 2 toggles. Admin seed (`server.js:242-247`) gets `vendors:true, purchaseOrders:true`.

## 3. Backend — Vendor (Stage 1-2)

File: `backend/models/Vendor.js` — follow `brand.js` exactly.

```js
vendor_code: String required, trim, index {vendor_code:1, is_deleted:1} unique
name: String required trim
company_name, contact_person: String default ""
email: lowercase trim default "", phone, whatsapp: String default ""
address, city, state, country, zip_code: String default ""
tax_id: String default "" // NTN
bank_details: { bank, account_title, account_no } all String default ""
lead_time_days: Number default 0 min 0
rating: Number default 0 min 0 max 5
is_active: Boolean default true
balance_payable: Number default 0 // store owes vendor; updated only via PurchasePayment
total_purchased: Number default 0, total_paid: Number default 0
is_deleted: Boolean default false index, deleted_at: Date default null
createdby/updatedby/deletedby: ObjectId Employee default null
timestamps { createdAt: created_at, updatedAt: updated_at }
+ statics findActive(), methods softDelete/restore (copy Brand)
```

Validation (server, never only client):
- `vendor_code` normalize like `normalizeBrandCode`; auto-generate `VND-00001` (pad 5, scan max numeric like Brand).
- `email` format if present, `phone` via existing `phoneValidator` (see `employeeController.js:367`).
- `rating 0-5`, `lead_time_days >=0`, `balance` never negative via direct write (only via payments).
- Inactive vendor (`is_active:false` or `is_deleted`) → block new PO creation, allow old PO view/receive.

File: `backend/controllers/vendorController.js` — copy `brandController.js`:
- `generateNextVendorCode (VND- pad 5)`, `getNextVendorCode`
- `createVendor` (normalize code, dup check `is_deleted:false`, `createdby:req.user._id`, `pushGlobalActivity category:"Vendor Management"`, emit `vendorCreated`)
- `getVendorsAdmin` — support `page/limit/search(status/city)` + legacy full list when no pagination (same as `getBrandsAdmin:392-490`): return `{data, counts:{total,active,inactive}, cities[], pagination}`. Search on `name/vendor_code/company_name/phone` with escaped regex.
- `getVendorById`, `getVendorWithPOs` (= vendor + last N POs + aggregates `total_purchased/total_paid/balance_payable` recomputed from PO+payments, not trusted stored value)
- `updateVendor` (never overwrite `vendor_code` with junk; track `getChanges`; emit `vendorUpdated`)
- `deleteVendor` (soft via `softDelete`), `restoreVendor` (new — Brand lacks route, Vendor needs it), `toggleActive`

File: `backend/routes/vendorRoutes.js`:
```text
GET  /vendors/next-code            auth
GET  /vendors/admin/all            auth + vendors
GET  /vendors/:id/details          auth + vendors
GET  /vendors/:id                  auth + vendors
POST /vendors                      auth + vendors
PUT  /vendors/:id                  auth + vendors
DELETE /vendors/:id                auth + vendors (soft)
POST /vendors/:id/restore          auth + vendors (NEW vs Brand)
```

## 4. Backend — PurchaseOrder + PurchasePayment (Stage 3-5)

File: `backend/models/PurchaseOrder.js`:

```js
po_number: String unique required // PO-00001 pad 5
vendor_id: ObjectId Vendor required index
vendor_snapshot: { name, company_name, phone, email, address, city } // frozen at create
items: [{
  product_id: ObjectId Product required,
  variant_id: ObjectId Variant required,
  name: String required, sku: String default "", variantTitle: String default "", image: String default "",
  cost_price: Number required min 0,      // historical, never auto-update
  qty_ordered: Number required min 1,     // immutable after draft
  received_qty: Number default 0 min 0,   // only via receive
  line_total: Number required min 0,      // cost_price * qty_ordered, server-computed
  tax_rate: Number default 0 min 0 max 100,
  mfg_date: Date default null, expiry_date: Date default null, batch_no: String default ""
}]
subtotal, tax, shipping, discount, total: Number required min 0 // server-computed
status: enum [draft, sent, confirmed, partially_received, received, closed, cancelled] default draft index
payment_status: enum [unpaid, partial, paid] default unpaid // derived from payments, not manual
paid_amount: Number default 0, due_amount: Number default total (recomputed)
expected_date: Date default null, due_date: Date default null
notes: String default "", cancel_reason: String default ""
receivings: [{ received_at: Date default now, invoice_no: String required, explanation: String required,
  items: [{ variant_id, product_id, qty }], received_by: ObjectId Employee, received_by_name: String }]
payments_summary: { paid_amount, due_amount } // mirror of PurchasePayment sum, updated transactionally
is_deleted: Boolean default false, deleted_at: Date default null
createdby/updatedby: ObjectId Employee
timestamps created_at/updated_at
indexes: { po_number:1 } unique, { vendor_id:1, status:1, created_at:-1 }, { status:1, created_at:-1 }
```

File: `backend/models/PurchasePayment.js` (**necessary**, not optional):
```js
po_id: ObjectId PurchaseOrder required index
vendor_id: ObjectId Vendor required index
amount: Number required min >0
method: enum [bank, cash, cod, credit, advance_adjust] required
reference: String default "" // bank txn / cheque
paid_at: Date default now
notes: String default ""
createdby: ObjectId Employee
timestamps
```
Why separate: multiple partial payments per PO; `PO.paid_amount/payment_status` + `Vendor.balance_payable` are recomputed from sum, never hand-edited.

File: `backend/controllers/purchaseOrderController.js`:
- `generateNextPONumber()` (scan `PO-\\d+`, pad 5) + `getNextPONumber`; create retry 5× on 11000 like Order.
- `createPO`: body `{vendor_id, items:[{variant_id, qty_ordered, cost_price, tax_rate?, batch?}], shipping, discount, tax?, expected_date, notes}`. Steps: vendor exists + `is_active && !is_deleted` else 400; each `variant_id` exists + product not deleted (populate like `stockController adjustStock:293-307`); `qty>=1 int`, `cost>=0`; lookup `product_id` server-side (do NOT trust client `product_id`); compute `line_total/subtotal/tax/total` server-side; freeze `name/sku/variantTitle/image` snapshot; `status=draft`, `received_qty=0`, `vendor_snapshot` copy; emit `po:created`.
- `getAllPOs`: `page/limit/status/vendor/search(po_number/vendor name)/payment_status/date_from/date_to`, populate `vendor_id name vendor_code`, return `{data, counts by status, pagination}`.
- `getPOByIdAdmin`: populate vendor + items + `receivings.received_by` + payments list.
- `updatePO`: **only `draft`** editable (lines, costs, charges). `sent+` → 400 "Only draft POs can be edited". Recompute totals. Changing `cost_price` after draft is forbidden (history rule).
- `sendPO (draft→sent)`, `confirmPO (sent→confirmed)`, `cancelPO (draft/sent/confirmed/partially_received→cancelled, cancel_reason required)`. `received/closed/cancelled` are terminal (no transitions). Cancel never decrements stock. Partially-received cancel keeps received stock.
- `closePO (received→closed)`: only when `received_qty==qty_ordered` for all lines. Payment may still be unpaid (valid per spec).
- `receivePO (POST /admin/:id/receive)` — see §5. Permission: chain `checkPermission("purchaseOrders")` + `checkPermission("manageStock")` (Express allows stacked middleware). Body: `{ items:[{variant_id, qty}], invoice_no required, explanation required, received_at? }`.
- `recordPOPayment (PATCH /admin/:id/payment)`: body `{amount>0, method, reference?, paid_at?, notes?}` → create `PurchasePayment`, recompute `PO.paid_amount/payment_status/due_amount` + `Vendor.balance_payable/total_paid` in same session. `paid` when `paid_amount>=total`. No over-pay (400 if exceeds due unless explicitly allowed as advance — V1 block over-pay).
- All mutations: `pushGlobalActivity` + socket emits `po:updated`, `po:received`, `po:paymentUpdated` + `stockUpdated` on receive.

File: `backend/routes/purchaseOrderRoutes.js`:
```text
GET   /purchase-orders/admin/all       auth + purchaseOrders
POST  /purchase-orders                 auth + purchaseOrders
GET   /purchase-orders/admin/:id       auth + purchaseOrders
PUT   /purchase-orders/:id             auth + purchaseOrders (draft only, enforced in controller)
PATCH /purchase-orders/admin/:id/send    auth + purchaseOrders
PATCH /purchase-orders/admin/:id/confirm auth + purchaseOrders
PATCH /purchase-orders/admin/:id/cancel  auth + purchaseOrders
PATCH /purchase-orders/admin/:id/close   auth + purchaseOrders
POST  /purchase-orders/admin/:id/receive auth + purchaseOrders + manageStock
PATCH /purchase-orders/admin/:id/payment auth + purchaseOrders
GET   /purchase-orders/next-code       auth
```
Mount in `server.js`:
```js
app.use(`${API_PREFIX}/vendors`, vendorRoutes);
app.use(`${API_PREFIX}/purchase-orders`, purchaseOrderRoutes);
```

## 5. Receiving — Atomicity Detail (Stage 4, critical)

Per receive request (one invoice = one atomic unit):

1. Load PO (with session if tx) + validate `status in [confirmed, partially_received]` (also allow `sent`? No — must `confirm` first per lifecycle; enforce).
2. Validate `invoice_no` non-empty, `explanation` non-empty (else 400 like `adjustStock`).
3. For each line: `variant = Variant.findById + populate product (match not deleted)`; `remaining = qty_ordered - received_qty`; require `0 < qty <= remaining` int; else 400 over-receive.
4. With session (if replica set):
```js
const session = await mongoose.startSession();
session.startTransaction();
try {
  for each line:
    prev = variant.quantity
    await Variant.updateOne({_id}, {$inc:{quantity: qty}}, {session});
    await StockHistory.create([{ variant_id, product_id, product_name, sku, variant_title,
      previous_quantity: prev, new_quantity: prev+qty, change_quantity: +qty,
      adjustment_type: "add", reason: "purchase",
      explanation: `${explanation} | PO ${po_number} | Inv ${invoice_no}`,
      performed_by, performed_by_name }], {session});
  PO items received_qty += qty; push receivings entry; recompute status
    (all full → received else partially_received);
  await po.save({session});
  await session.commitTransaction();
} catch { await session.abortTransaction(); throw; } finally { session.endSession(); }
```
5. Fallback (standalone Mongo, no tx): pre-validate all lines, then sequential `$inc` + `StockHistory.create` + PO save; on mid-failure return 500 with `partial:true` + already-applied list so admin can reconcile via Manage Stock (documented, plus idempotency key `invoice_no + po_id` unique to prevent double-submit).
6. After commit: `emit stockUpdated {variants:[{variant_id, change}], source:"po_received"}` + `po:received/po:updated` (same helper as `orderController emitStockEvent`).
7. Concurrency: rely on atomic `$inc` + `remaining` re-check inside tx; add `PO.version` optimistic check (`save` with versionKey) or unique `receivings.invoice_no per PO` to block double-click. Frontend disables Receive button while pending.
8. Index: add `StockHistory.index({variant_id:1, created_at:-1})` + `{reason:1}` for receipt audit (check if exists; add if missing).

## 6. Payments Detail (Stage 5)

- `payment_status` derived: `paid_amount==0 → unpaid`, `0<paid<total → partial`, `paid>=total → paid`.
- Each `recordPOPayment` creates `PurchasePayment` row; then `PO.paid_amount = sum(payments)`, `due = total - paid`; `Vendor.balance_payable` = sum over open POs (`total - paid`) OR incremental `+= (total - paid)` on PO create and `-= amount` on payment — prefer recompute on read + incremental cached with tx to avoid drift; nightly reconcile endpoint optional V2.
- Never gate `receive/close` on payment (spec §6 valid state `Received + Unpaid`).
- Over-pay blocked V1; vendor advance handled V2.

## 7. Frontend (Stage 2, 6-7)

New clients (copy `brandApi.js` / `orderApi.js` via `adminHttp`):
- `src/apis/admin/vendorApi.js`: `getAllPaginated({page,limit,search,status,city})`, `getAll`, `getById`, `getWithPOs`, `getNextCode`, `create`, `update`, `delete`, `restore`, `toggleActive`.
- `src/apis/admin/purchaseOrderApi.js`: `getAll(params)`, `getById`, `getNextCode`, `create`, `update`, `send`, `confirm`, `cancel(reason)`, `close`, `receive({items, invoice_no, explanation})`, `recordPayment({amount, method, reference, notes})`, `listPayments`.

Pages:
- `src/app/admin/vendors/page.js`: cards (total/active/payable), search + status + city filter, table (code, name, phone, city, payable, active, actions), create/edit modal (validate email/phone/cost, toast errors not cards per `bugs.txt`), delete/restore.
- `src/app/admin/vendors/[id]/page.js`: tabs Overview (profile + bank + terms) | Purchase Orders (PO history table) | Products (distinct products from POs, computed — NOT vendor.supplied array).
- `src/app/admin/purchase-orders/page.js`: chips `all/draft/sent/confirmed/partially_received/received/closed/cancelled` + vendor select + search PO no + payment filter; table (PO no, vendor, lines, total, paid/due, PO status, payment badge, expected date); New PO button.
- `src/app/admin/purchase-orders/new/page.js`: vendor selector (react-select, block inactive), variant search (reuse manage-stock SKU/title lookup: `GET /stock?search=`), qty + cost inputs (`>=0`, int qty), live subtotal (display only — server recomputes), Save Draft.
- `src/app/admin/purchase-orders/[id]/page.js`: header (vendor, PO no, dates), status timeline, lines table (SKU, ordered, received, remaining, cost, line total + progress bar), totals, payments list + Record Payment modal, Receive Goods modal (per-line `Receive Now <= remaining`, `invoice_no*`, `explanation*`), action bar by status:
```text
draft: Edit / Send / Cancel
sent: Confirm / Cancel
confirmed: Receive / Cancel
partially_received: Receive Remaining / Cancel
received: Record Payment / Close
closed/cancelled: view only (+ payments view)
```

Permissions/UI: update `Sidebar.js`, `layout.js ROUTE_PERMISSIONS`, Employees form toggles. Socket: reuse `useOrderSocketSync`-style hook or extend to listen `po:updated + stockUpdated` to refresh lists without reload.

## 8. Inventory Rules (enforced server-side)

```text
Customer Order place → Variant.quantity -= (qty + free_items)
Customer Order cancel/delete (pending) → Variant.quantity += same
PO create/sent/confirmed → no change
PO receive → Variant.quantity += received qty (per line, atomic)
PO cancel → never auto-decrement (even if partially received)
Manual adjust (Manage Stock) → unchanged, still requires explanation
```

## 9. Testing (Stage 8) — exact flow + edge cases

Happy path (must pass in order):
```text
Create Vendor → Create PO → Save Draft → Edit Draft (change qty/cost, verify totals recompute)
→ Send → Confirm → Receive partial (check Variant.quantity +=, StockHistory add/purchase + explanation + PO/invoice ref)
→ Receive remaining → PO=received → Partial payment → payment_status=partial
→ Full payment → payment_status=paid → Close → PO=closed
→ Manage Stock live update (stockUpdated received, no manual refresh)
→ Vendor detail payable decreases correctly
```

Negative/edge (each must return clean 400/403/404 toast, no partial write):
- over-receive (> remaining), zero/negative qty, negative cost, invalid variant, deleted product variant, inactive/deleted vendor on create, edit non-draft, send already-sent, confirm without sent, receive without confirmed, cancel received/closed, duplicate PO number (11000 retry), duplicate vendor_code, unauthorized (no `vendors/purchaseOrders` → 403 + access-denied UI + hidden menu), concurrent double receive (second blocked), tx abort mid-batch (no Variant/History/PO drift), over-payment, missing invoice_no/explanation.

## 10. Build Order (do not one-shot)

1. Vendor backend (model/controller/routes/mount/perms) + Postman `GET /api/vendors/admin/all`.
2. Vendor frontend (api + list + detail).
3. PO backend CRUD + send/confirm/cancel/close (no stock yet).
4. Receiving + StockHistory + tx/fallback + sockets.
5. Payments (`PurchasePayment` + balances).
6. PO frontend (list/new/detail/receive/pay).
7. Sidebar/layout/employees perms.
8. Full E2E + edge matrix above.

## 11. Acceptance (feature done only when all true)

- [ ] Vendor CRUD + auto `VND-00001` + active toggle + soft delete/restore.
- [ ] Draft PO editable, `sent+` locked, `cost_price` frozen history.
- [ ] Every receipt `+qty` exact to `Variant.quantity` + one `StockHistory` per line (`add/purchase` + explanation + PO/invoice).
- [ ] Over-receive impossible; partial receive sets `partially_received`; full sets `received`; `closed` only from `received`.
- [ ] Cancel never removes stock; partially-received cancel keeps stock.
- [ ] Invoice no + explanation stored and visible in PO + Stock History.
- [ ] Payment independent; multiple payments sum correctly; `Received+Unpaid` allowed.
- [ ] No-permission employee: hidden menu + `access-denied` on URL + 403 API.
- [ ] Manage Stock live-updates on receive; customer order flow unchanged.
- [ ] Server recomputes all totals; client totals display-only.
- [ ] Receiving atomic (tx or guarded fallback); concurrent receive safe.

## 12. Risks / Open Decisions

1. **Transactions**: verify `MONGO_URI` — Atlas/replica set → full tx; local standalone → fallback path + add replica-set note to README. (Necessary check before Stage 4.)
2. **`closed` vs `completed`**: this plan uses `closed` per your spec — update any old `completed` references.
3. **Receive permission**: chained `purchaseOrders + manageStock` (strict). If single-role staff must receive, grant both keys.
4. **Vendor balance**: cached `balance_payable` can drift; add reconcile-on-read in `getVendorWithPOs` V1, background job V2.
5. **No vendor portal / returns / multi-currency / GRN print** — explicitly out of scope.
