# 02 — Backend (Express + Mongoose)

Root: `backend/`

## 1. Folder structure

```
backend/
├─ server.js              # entry point: app setup, middleware, routes, startup
├─ config/
│  ├─ db.js               # MongoDB connect (retryWrites=false force)
│  └─ uploadConfig.js     # multer memory config
├─ middleware/
│  ├─ resolveStore.js     # Host → tenant/store + runWithStore
│  ├─ authMiddleware.js   # audience-aware JWT auth
│  ├─ checkPermission.js  # role/permission gates
│  ├─ superAdminAuth.js   # sa_at auth
│  ├─ requireApprovedSeller.js / allowPendingSeller.js
│  ├─ rateLimit.js        # Redis/in-memory limiters
│  └─ *ImageMiddleware.js / saveProductImages.js / uploadMiddleware.js
├─ models/                # 47 Mongoose models (dekho 06-models.md)
├─ routes/                # 33 routers
├─ controllers/           # 34 controllers
├─ utils/                 # helpers (tenant, tokens, socket, translation, email…)
├─ services/emailService.js
├─ scripts/               # migrations, seeds, backfills
├─ templates/emails/      # email HTML layout
├─ test/                  # node --test files
├─ uploads/               # uploaded files (stores/<storeId>/...)
└─ .env
```

## 2. Startup (`server.js`)

Startup steps (`startServer()`):

1. `connectDB()` — Mongo connect (URI me `retryWrites=false` force hota hai).
2. `ChatConversation.ensureChatIndexes()` — chat indexes manually ensure.
3. `createUploadDirectories()` — uploads folders banao.
4. `seedDefaultData()` — sirf **Super Admin** seed (env se). Store/admin auto-seed hata diya
   gaya hai; stores sirf seller signup → super-admin approval se bante hain.
5. `bannerScheduler()` — scheduled banners publish karne wala cron.
6. `checkPortAvailable()` → `server.listen(PORT, HOST)`.
7. SMTP verify (async, HTTP server start hone ke baad — slow mail provider startup block na kare).

Socket init try/catch me hota hai — Socket fail ho to server nahi marta.

### Middleware order (ahem)

```
cors → compression → json/urlencoded → cookieParser
   → resolveStore (API_PREFIX par)
   → /uploads privacy guard (documents)
   → /uploads static
   → req.io inject
   → global rate limit (API_PREFIX, health/chat skip)
   → routes
   → 404 fallback
```

`/uploads/documents` (KYC) sirf **super admin session** ko serve hota hai, baaki `/uploads`
public + immutable cache.

## 3. Routes mounting

`server.js` har router ko `${API_PREFIX}/<name>` par mount karta hai. Example:

```js
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/orders`, orderRoutes);
app.use(`${API_PREFIX}/super-admin`, superAdminRoutes);
app.use(`${API_PREFIX}/seller`, sellerApplicationRoutes);
```

Public endpoints:

- `GET /` → startup message
- `GET ${API_PREFIX}/health` → health JSON

## 4. Common route conventions

- **Auth**: `authMiddleware.requireAdmin` (employee), `.requireUser` (customer), bare
  `authMiddleware` (dono; `X-Auth-Aud` hint).
- **Permission**: `checkPermission("products")` etc. Admin role bypass; sirf explicit `false` block.
  Customer sirf `profile` key allowed.
- **Soft delete**: `is_deleted` + `deleted_at` + `deletedby`.
- **Pagination**: `?page=&limit=` optional; kuch legacy endpoints bina page ke full list dete hain.
- **Locale**: `?locale=xx` (`/^[a-z]{2}$/`, `en` = source).
- **Cache**: `utils/publicCache` (`publicCache(ms)` + `invalidate(namespace)`) public GETs par.
- **Activity**: `utils/activityHelper` se audit trail.
- **Translations**: content write par `queueTranslationSync(...)` fire-and-forget.

## 5. Auth middleware behavior

`middleware/authMiddleware.js`:

1. Bearer header ya audience cookie se token.
2. Audience secret + `aud` + `typ=access` verify.
3. **Store binding**: token ka `storeId` === `req.store._id` (warna 401).
4. DB se fresh entity (tenant-scoped `findById`) — deleted/inactive/blocked block.
5. `req.user`, `req.userType` (`user`/`employee`), `req.authAud`, `req.sessionId` set.
6. Pending seller (`seller_pending`) ke liye sirf GET/HEAD/OPTIONS allow; baaki `403 SELLER_PENDING`
   (jab tak route `allowPendingSeller` se opt-out na kare).

## 6. Roles

`utils/roles.js`:

| Role | Matlab |
|---|---|
| `storehandler` | Store owner (seller signup se). Full access, delete/demote nahi ho sakta |
| `admin` | Owner ka banaya full-access staff |
| `manager` | Permission-based |
| `staff` | Permission-based |

`isAdminRole()` = owner + admin (full access).

## 7. Permission model

`middleware/checkPermission.js`:

- `checkPermission(key)`: admin role bypass; staff ka sirf `permissions[key] === false` block;
  non-employee sirf `profile` key.
- `staffPermissionCheck`: role gate (admin/manager/staff).
- `adminMiddleware`: admin ya koi bhi permission `true` ho.

## 8. Socket layer

`utils/socket.js` — 1000+ lines. Highlights:

- Tenant-aware `io` Proxy (`emit` → `store:<id>`).
- Handshake me Host → store; phir guest-friendly auth (`utils/socketAuth.js`).
- Per-event permission check **fresh DB se** (`requireSocketPermission`).
- Chat rooms: `chat:admins:<storeId>`, `chat:conversation:<id>`, `chat:customer:<userId>`,
  guest `chat:guest:<tokenHash>`.
- Store/employee/profile/shipping/discount/deal/product events controllers ko reuse karte hain.
- `relayToStore(socket)` = `socket.broadcast` ka store-safe version.
- Logo/avatar helpers: `compressAndSaveLogo`, `processEmployeeAvatar` (sharp webp).

## 9. Utils (ahem files)

| File | Kaam |
|---|---|
| `tenantContext.js` | `runWithStore`, `getStoreId`, `runUnscoped`, `bindToContext` |
| `tenantScopePlugin.js` | Mongoose auto storeId filter/stamp |
| `tenantHost.js` | Host parse + subdomain validation |
| `tenantMulter.js` | Context-safe multer |
| `uploadPaths.js` | Per-store upload paths + URL safety |
| `tokens.js` | 3-audience JWT + refresh rotation |
| `socketAuth.js` | Socket identity resolve |
| `translationService.js` / `libreTranslate.js` | Content translation |
| `sendEmail.js` / `emailLayout.js` | SMTP + email templates |
| `loyaltyService.js` / `loyaltyMath.js` | Loyalty points ledger |
| `referralService.js` | Referral codes/rewards |
| `planLimits.js` | Plan product/staff caps |
| `oneTimeToken.js` | Handoff/one-time tokens (Redis/Mongo) |
| `publicCache.js` | Public GET caching |
| `bannerScheduler.js` | Scheduled banner publish |
| `logger.js` | **Deliberate no-op** — `log.*` kuch print nahi karta |

> Debug karte waqt `console.*` temporarily use karo, kyunke `logger.js` jaan boojh kar silent hai.

## 10. Scripts

| Script | Kaam |
|---|---|
| `migrateTenantIndexes.js` | Model indexes ko tenant-aware banao (dry run; `--apply`) |
| `migrateAttributesPerStore.js` | Legacy global attributes → har store me copy |
| `backfillSubdomains.js` | Purane stores ke subdomain bharo |
| `backfillTranslations.js` | Missing translations bharo (`--check` preflight) |
| `seedAttributes.js` | Per-store default attributes |
| `seedAllData.js` | Sample/demo data |
| `fixSellerOwnerRole.js` | Seller owner role fix |
| `renameAuthCollections.js` | Auth collections rename migration |
| `argosTranslateServer.py` | Local translation server (uv) |
| `testEmail.js` | SMTP test |

## 11. Tests

`npm test` → `node --test` (`test/*.test.js`). Coverage areas:

- tenant isolation, resolveStore, uploadPaths
- tokens, authMiddleware pending seller, socketAuth
- loyaltyMath, referral models
- googleAuth, email transport
- seller setup/ownership/handoff, superAdmin requests
- chat models/context/rate-limit, publicCache

Ek file: `node --test test/chatModels.test.js`
Naam se filter: `node --test --test-name-pattern="partial unique" test/`
