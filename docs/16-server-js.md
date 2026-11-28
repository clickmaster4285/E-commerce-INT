# 16 — server.js (entry point) complete guide

`backend/server.js` is the single HTTP + Socket.IO entry point. It loads env, connects DB, mounts middleware/routes, seeds data, and starts listening.

---

## 1. Startup sequence

1. `dotenv.config({ path: backend/.env })` — all config from env (no defaults).
2. Require Express, http, cors, compression, cookieParser, bcrypt, os, connectDB, models, socket init, resolveStore, tenantHost.
3. Require all route modules.
4. Create `app` + `http.Server`.
5. Read env: `PORT`, `HOST`, `CLIENT_URL`, `API_PREFIX`, `NODE_ENV`, `SALT_ROUNDS`, `REQUEST_SIZE_LIMIT`, `UPLOAD_CACHE_MAX_AGE`, `UPLOAD_DIR`, `STORE_UPLOAD_SUBDIR`, `BUNDLE_UPLOAD_SUBDIR`, `REVIEW_UPLOAD_SUBDIR`, `STARTUP_MESSAGE`, `TRUST_PROXY`.
6. If `TRUST_PROXY` set → `app.set("trust proxy", ...)`.
7. CORS middleware (origin allowlist + multi-tenant store host resolution).
8. compression (skip `/uploads`, `/socket.io`).
9. `express.json` / `express.urlencoded` (limit `REQUEST_SIZE_LIMIT`).
10. `cookieParser`.
11. `app.use(API_PREFIX, resolveStore)` — tenant resolution (Host → store) for all API requests.
12. Upload static handling + KYC document guard.
13. `express.static("/uploads")` (immutable 1y cache).
14. Socket.IO init (`initSocket(server)`) — status tracked; failure doesn't kill server.
15. `req.io = io` middleware.
16. Global rate limiter on `API_PREFIX` (skip `/health`, `/chats`).
17. Mount all routers under `API_PREFIX`.
18. `GET /` → `STARTUP_MESSAGE`; `GET API_PREFIX/health`.
19. 404 handler.
20. `startServer()`:
    - `connectDB()`
    - `ChatConversation.ensureChatIndexes()`
    - `createUploadDirectories()`
    - `seedDefaultData()` (Super Admin only)
    - `bannerScheduler()`
    - port availability check
    - `server.listen(PORT, HOST, cb)` → console logs + SMTP verify (non-blocking)

---

## 2. Middleware order (why this order matters)

- CORS first → preflight handled before anything.
- compression before routes → smaller responses.
- body parsers before routes → `req.body` available.
- `resolveStore` on `API_PREFIX` → tenant context before controllers.
- Upload static after KYC guard → private docs protected.
- Socket init before `req.io` middleware → controllers can emit.
- Global rate limit before routes → abuse protection.
- Routes last → controllers run in correct context.

---

## 3. Tenant resolution

`resolveStore` middleware runs on every request under `API_PREFIX`. It resolves store from Host header (via `resolveStoreByHost`) and wraps request in `runWithStore(storeId)` (AsyncLocalStorage). All store-owned model queries auto-filter by `storeId` via `tenantScope` plugin. `Store` model scopes on its own `_id`.

---

## 4. CORS (multi-tenant)

Allowed origins:
- `CLIENT_URL` + `ALLOWED_ORIGINS` (comma list).
- Dev: localhost / 127.0.0.1; private IPs if `ALLOW_LOCAL_NETWORK=true`.
- Platform family hosts (`isPlatformFamilyHost`) — root + all store subdomains.
- Registered custom domains (`resolveStoreByHost`).

`credentials: true` (cookies). Origin check async for store hosts.

---

## 5. Uploads & static serving

- Upload root: `UPLOAD_DIR` (default `uploads`).
- Subdirs: `STORE_UPLOAD_SUBDIR`, `BUNDLE_UPLOAD_SUBDIR`, `REVIEW_UPLOAD_SUBDIR`, `documents` (KYC).
- `/uploads/documents/*` → `requireSuperAdmin` guard (sa_at cookie); path normalized to prevent traversal.
- Other `/uploads/*` → `express.static` with `maxAge=UPLOAD_CACHE_MAX_AGE`, `immutable: true`, `etag`.
- Filenames are unique (timestamp/uuid) — never overwritten.

---

## 6. Socket.IO

- `initSocket(server)` creates Socket.IO server.
- Status stored in `socketStatus` for startup log.
- Failure is non-fatal (API still runs).
- `io` passed to controllers via `req.io`.
- Tenant-aware Proxy (`utils/socket.js`): `emit` → room `store:<id>`; `chat:admins` → `chat:admins:<id>`.

---

## 7. Rate limiting

- Global limiter on `API_PREFIX` (skips `/health`, `/chats`).
- Chat has dedicated limiter.
- Per-route limiters (login, register, OTP, etc.) defined in `middleware/rateLimit.js`.
- Redis (`REDIS_URL`) for shared limits across servers; in-memory fallback.

---

## 8. Seeding (seedDefaultData)

- **No default store/store-admin** (multi-tenant: stores created via seller signup + Super Admin approval).
- **Super Admin**: seeded from `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_PASSWORD` if not present. In production, password must meet `SUPER_ADMIN_MIN_PASSWORD_LENGTH` or seeding is refused.
- Attributes are seeded per-store on store creation (not at startup).

---

## 9. Upload directories created at startup

`createUploadDirectories()` ensures `uploads/`, `uploads/<STORE_UPLOAD_SUBDIR>/`, `uploads/<BUNDLE_UPLOAD_SUBDIR>/`, `uploads/<REVIEW_UPLOAD_SUBDIR>/` exist.

---

## 10. Port availability

`checkPortAvailable(PORT)` probes with a net server. If `EADDRINUSE`, logs error and `process.exit(1)`.

---

## 11. 404 & error handling

- `app.use((req,res) => res.status(404).json({ success:false, message:"Route not found", path }))` — catches unmatched routes.
- Global error handlers not explicitly defined; controllers use try/catch and return JSON. Unhandled promise rejections may crash — keep controllers safe.

---

## 12. Environment variables required

All from `backend/.env`, no defaults. Key: `PORT`, `HOST`, `API_PREFIX`, `MONGO_URI`, `JWT_*` (6 secrets + `JWT_SECRET`), `SUPER_ADMIN_*`, `UPLOAD_DIR`, `STORE_UPLOAD_SUBDIR`, etc. Missing → startup failure or request errors. See `docs/09-configuration-and-ops.md`.

---

## 13. Related files

- `backend/config/db.js` — MongoDB connection.
- `backend/middleware/resolveStore.js` — tenant resolution.
- `backend/utils/socket.js` — tenant-aware Socket.IO proxy.
- `backend/middleware/rateLimit.js` — limiters.
- `backend/utils/tenantContext.js` — AsyncLocalStorage.
- `backend/utils/tenantScopePlugin.js` — auto storeId scoping.
- `backend/utils/uploadPaths.js` — upload folder/URL helpers.
- `backend/utils/bannerScheduler.js` — banner scheduling.
