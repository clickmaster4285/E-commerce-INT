# 01 — Architecture Overview

## 1. Big picture

Ek deployment = bohat saare stores. Store **Host header** se pehchana jata hai.

```
                        ┌─────────────────────────────────────────────┐
                        │              One Deployment                  │
                        │                                             │
  Platform Host ───────►│  landing, seller signup, store-setup,       │
  (ROOT_DOMAIN)         │  super-admin panel                          │
                        │                                             │
  Store Host ──────────►│  storefront (/), admin panel (/admin)       │
  (<sub>.<root> /       │  — sirf usi store ka data                   │
   custom domain)       │                                             │
                        └─────────────────────────────────────────────┘
                                        │
                          ┌─────────────┴─────────────┐
                          │       MongoDB (shared)      │
                          │  har store-owned doc me     │
                          │  storeId field              │
                          └─────────────────────────────┘
```

- **Platform host**: `ROOT_DOMAIN` / `NEXT_PUBLIC_ROOT_DOMAIN` (dev me e.g. `192.168.88.35.nip.io`).
- **Store host**: `<subdomain>.<root>` ya registered custom domain.
- **Store resolution** dono taraf hoti hai:
  - Frontend `src/proxy.js` (Next middleware) → page routing/rewrite.
  - Backend `middleware/resolveStore.js` → API tenant isolation.

---

## 2. Request lifecycle (API call)

```
Browser (store host: alistore.<root>:3000)
   │
   │  axiosInstance → alignBackendUrl → alistore.<root>:5000/api/...
   │  (same hostname, sirf port alag → HttpOnly cookies chalti hain)
   ▼
Backend server.js
   │
   ├─ cors (platform family + registered custom domains)
   ├─ compression (JSON only)
   ├─ express.json / urlencoded / cookieParser
   │
   ├─ app.use(API_PREFIX, resolveStore)      ◄── yahan tenant resolve hota hai
   │     • Host → parseTenantHost → platform / subdomain / custom
   │     • Store.findOne({subdomain|domain}) (60s cache)
   │     • req.tenant, req.store set
   │     • store host par → runWithStore(store._id, next)
   │        (AsyncLocalStorage me storeId chala jata hai)
   │
   ├─ global rate limiter
   ├─ router (e.g. /products)
   │     • authMiddleware (agar chahiye)
   │     • checkPermission
   │     • controller
   │         └─ Mongoose query → tenantScope plugin khud `storeId` filter/stamp karta hai
   │
   └─ response
```

**Ahem baat:** `resolveStore` ke baad jo bhi async kaam hota hai, wo `runWithStore` ke andar
chalta hai. Isi liye controllers/models ko storeId manually pass karne ki zaroorat nahi.

---

## 3. Frontend request lifecycle (page)

```
Browser → alistore.<root>:3000/products
   │
   ▼
frontend/src/proxy.js  (Next 16 middleware; naam `proxy.js` hai, `middleware.js` nahi)
   │
   ├─ parseTenantHost(host) → subdomain
   ├─ storeExists(host)? → backend GET /store/resolve
   │     (x-store-host + x-internal-proxy-secret headers ke saath)
   ├─ request headers set: x-tenant-type, x-store-host, x-store-subdomain
   ├─ /admin/* → admin session cookie (a_at/a_sess) check, warna /admin/login
   ├─ platform-only pages store host par → /store-not-found
   └─ pass / rewrite / redirect
   ▼
Next page render (server component)
   │
   ├─ server-side fetch ho to `x-store-host` forward karna ZAROORI hai
   └─ client components → TanStack Query → axiosInstance → backend API
```

---

## 4. Platform vs Store — kya kahan chalta hai

| Cheez | Platform host | Store host |
|---|---|---|
| Landing page | ✅ | ❌ (`/store-not-found`) |
| Seller signup `/landing/signup` | ✅ | ❌ |
| `/store-setup` | ✅ | ❌ |
| `/super-admin/*` | ✅ | ❌ |
| Storefront `/` | ❌ (redirect landing) | ✅ |
| `/admin/*` | ❌ (redirect landing) | ✅ (login zaroori) |
| Store-owned APIs (products, orders…) | ❌ 404 `STORE_REQUIRED` | ✅ |
| Super-admin APIs | ✅ | ❌ 404 |
| `/health`, `/store/resolve` | ✅ | ✅ |

Backend rule: platform host par sirf whitelisted APIs khuli hain (`PLATFORM_EXACT` +
`PLATFORM_PREFIXES` in `middleware/resolveStore.js`). Baaki sab `404 STORE_REQUIRED`.
Ye zaroori hai warna platform par tenant scope na lagne se **saare stores ka data** aa jata.

---

## 5. Data isolation model

- Har store-owned model par `schema.plugin(tenantScope)`.
- Request context me `storeId` hota hai → plugin automatically:
  - `find/findOne/count/update/delete/distinct` me `storeId` add karta hai,
  - `aggregate` pipeline me `$match` add karta hai (aur `$lookup`/`$unionWith` bhi scope karta hai),
  - naye document par `storeId` stamp karta hai,
  - cross-store write ko block karta hai.
- Unique indexes compound hote hain `{ storeId, ... }` (e.g. `{storeId, sku}`, `{storeId, order_number}`).
- `Store` khud `_id` par scope hota hai, is liye `Store.findOne()` current store deta hai.

Details: [04-multi-tenancy.md](04-multi-tenancy.md).

---

## 6. Realtime (Socket.IO)

- `io` ek **tenant-aware Proxy** hai (`utils/socket.js`):
  - Store context me `io.emit(...)` sirf us store ke room `store:<id>` par jata hai.
  - `io.to("chat:admins")` → `chat:admins:<id>`.
  - Platform context me global rehta hai.
- Har socket handshake par Host se store resolve hota hai, phir har packet `runWithStore` me chalta hai.
- Frontend admin panel `use*SocketSync` hooks se React Query cache invalidate karta hai.

---

## 7. Authentication audiences

Teen alag audiences, har ek ke apne cookies aur secrets:

| Audience | Kaun | Cookies | Access lifetime |
|---|---|---|---|
| `user` | Storefront customer | `u_at` / `u_rt` / `u_sess` | 7 days (default) |
| `admin` | Store staff/owner | `a_at` / `a_rt` / `a_sess` | 60 min (default) |
| `superadmin` | Platform admin | `sa_at` / `sa_rt` / `sa_sess` | 60 min (default) |

Frontend `X-Auth-Aud` header batata hai kaun sa session use karna hai. Details:
[05-auth-security.md](05-auth-security.md).

---

## 8. External services

| Service | Kaam | Optional? |
|---|---|---|
| MongoDB | Primary DB | ❌ required |
| Redis | Shared rate-limit + one-time tokens | ✅ fallback memory/Mongo |
| LibreTranslate / Argos | Content translation | ✅ off ho to English dikhta hai |
| SMTP | OTP + seller emails | ✅ dev me console fallback |
| Google OAuth | Sign in with Google | ✅ optional |

---

## 9. Deployment topology (production)

- Frontend (Next) + backend (Express) usually reverse proxy (nginx) ke peeche.
- `NEXT_INTERNAL_API_URL` = internal backend URL (server-side fetch ke liye).
- `NEXT_PUBLIC_SERVERURL` = public API URL (browser ke liye).
- `INTERNAL_PROXY_SECRET` dono `.env` me same hona chahiye — backend `x-store-host` sirf isi
  secret ke saath trust karta hai.
- Cookies host-only + Secure (`NODE_ENV=production`).
