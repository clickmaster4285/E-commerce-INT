# 04 — Multi-Tenancy (Store Isolation)

Ye project ka sab se important design hai. Achi tarah samajhna zaroori hai.

## 1. Store kaise pehchana jata hai (Host)

`utils/tenantHost.js` (`parseTenantHost`) host ko 4 categories me classify karta hai:

| Type | Condition | Matlab |
|---|---|---|
| `platform` | no dot / IPv4 / `ROOT_DOMAIN` / `www.ROOT_DOMAIN` | platform pages |
| `subdomain` | `<one-label>.ROOT_DOMAIN` | store subdomain |
| `custom` | koi bhi aur dotted host | custom domain store |
| `unknown` | nested `a.b.ROOT_DOMAIN` | invalid |

Reserved subdomains (`www`, `api`, `admin`, `super-admin`, `shop`, `login`, `test`, `dev`…) kabhi
store ko nahi milte. `slugifySubdomain` aur `validateSubdomain` store address validate karte hain
(new store address 3–30 chars).

## 2. Backend resolution — `middleware/resolveStore.js`

Har API request par chalta hai (`app.use(API_PREFIX, resolveStore)`):

1. `hostFromRequest(req)`:
   - normally `Host` header,
   - Next server SSR ke liye `x-store-host` — **sirf** tab jab request platform host par ho
     **aur** `x-internal-proxy-secret` timing-safe match kare.
2. `resolveStoreByHost(host)`:
   - subdomain → `Store.findOne({ subdomain })`,
   - custom → `Store.findOne({ customDomain, domainVerified:true })` (prod me verified zaroori),
   - 60s in-memory cache.
3. `req.tenant`, `req.store`, `req.storeMissing` set.
4. Rules:
   - Platform host: sirf `PLATFORM_EXACT` / `PLATFORM_PREFIXES` allowed, warna `404 STORE_REQUIRED`.
   - Store host: `/super-admin/*` → 404.
   - Store missing: `/health` aur `/store/resolve` chhod kar `404 STORE_NOT_FOUND`.
5. `runWithStore(store._id, next)` — baaki request tenant context me.

## 3. Tenant context — `utils/tenantContext.js`

`AsyncLocalStorage` par bana:

- `runWithStore(storeId, fn)` — is store me chalao.
- `getStoreId()` — current storeId ya `null` (platform/script).
- `runUnscoped(fn)` — jaan boojh kar saare stores.
- `bindToContext(fn)` — stream libraries (multer/busboy) ke callbacks ko context wapas deta hai.

## 4. Auto-scoping — `utils/tenantScopePlugin.js`

Har store-owned schema par `schema.plugin(tenantScope)`:

| Operation | Kya hota hai |
|---|---|
| find/findOne/count/update/delete/distinct | filter me `storeId` add |
| aggregate | pipeline start me `{ $match: { storeId } }` |
| `$lookup` / `$unionWith` / `$graphLookup` | store-owned collection me bhi `storeId` match |
| create/save/insertMany | naye doc par `storeId` stamp |
| update via query | `storeId` badalna ignore; upsert par `$setOnInsert` |
| bulkWrite | har op par scope |
| `estimatedDocumentCount` | store context me mana (countDocuments use karo) |
| cross-store write | error throw (`Cross-store write blocked`) |

`Store` model special: `plugin(tenantScope, { field: "_id", stamp: false })` — is liye
`Store.findOne()` current store deta hai.

Intentional cross-store query ke liye: `.setOptions({ skipTenantScope: true })`
(e.g. super-admin, migrations).

## 5. Unique indexes

Compound `{ storeId, ... }`:

- `{storeId, sku}` (Variant)
- `{storeId, order_number}` (Order)
- `{storeId, email}` / `{storeId, username}` (User, Employee)
- `{storeId, code}` (Discount, ShippingMethod)
- `{storeId, name}` (Tag)
- `{storeId, user_id}` (Cart, CheckoutDraft, LoyaltyAccount)
- etc.

Isi liye do different stores same SKU/order number use kar sakte hain.

## 6. Uploads — `utils/uploadPaths.js` + `utils/tenantMulter.js`

- Store context → `uploads/stores/<storeId>/<kind>/...`
- Platform → `uploads/<kind>/...`
- `uploadUrlFor(savedPath)` → public URL
- `localPathForUrl(req, url)` → delete se pehle path; **dusre store ki file refuse** karta hai.
- `assertSegment` path traversal (`..`, `/`, `\`) block karta hai.
- Naye filenames hamesha unique (`Date.now`/uuid) — overwrite kabhi nahi.
- **Plain `multer` kabhi use na karo** — context kho jata hai. `utils/tenantMulter` use karo.

Kinds: products, variants, brands, banners, bundles, deals, reviews, store logo, documents (KYC).

KYC (`uploads/documents`) sirf super-admin session ko serve hota hai (server.js guard).

## 7. Sockets — tenant rooms

`utils/socket.js`:

- `io` Proxy: store context me `emit` → room `store:<id>`.
- `chat:admins` → `chat:admins:<id>`.
- Handshake: Host → store resolve; phir identity (`utils/socketAuth.js`) — token ka storeId match
  karna zaroori, warna guest.
- Har connection aur packet `runWithStore` me.
- `relayToStore(socket)` = `socket.broadcast` ka store-safe version.

Rooms:
- `store:<id>` — store ke saare clients
- `employee:<id>` — specific staff
- `chat:admins:<id>` — store admins inbox
- `chat:conversation:<id>` — ek conversation
- `chat:customer:<userId>` — customer-specific notices
- `chat:guest:<tokenHash>` — guest chat

## 8. Frontend tenant handling

- `src/proxy.js` — page routing (dekho 03-frontend.md).
- `src/lib/tenantHost.js`:
  - `parseTenantHost`, `platformUrl`, `storeUrl`
  - `alignBackendUrl` — browser me API ko page hostname par le aata hai
  - `getBackendOrigin` — socket origin
- `src/apis/axiosInstance.js` — aligned base URL + cookies.

**Rule:** server-side fetch me `x-store-host` forward karna zaroori hai, warna backend platform
host samajh kar `404 STORE_REQUIRED` dega ya galat store resolve karega.

## 9. Store lifecycle

1. Seller `/landing/signup` par apply karta hai → `SellerApplication` (pending).
2. Super-admin approve karta hai → `Store` (open) + `Employee` (owner `storehandler`,
   `seller_pending:false`) create/activate.
3. Store ka subdomain auto-generate hota hai (`Store.generateUniqueSubdomain`).
4. Naye store par default attributes async seed hote hain (`post("save")` hook).
5. Store host live ho jata hai.

Reject hone par store closed + employee inactive ho jata hai.

## 10. Handoff (platform login → store)

Cookies host-only hain, is liye platform par seller login karne ke baad store par session nahi hota.
Solution:

1. Platform host par `/users/admin/login` → admin session + ek 2-minute one-time `store_handoff`
   JWT (`jti`).
2. Frontend `/admin-handoff#token=...` par jata hai (hash me token).
3. Store host par `POST /users/admin/handoff/exchange` → `claimOnce("handoff", jti)` (Redis/Mongo)
   → store admin session set.

Details: [05-auth-security.md](05-auth-security.md).
