# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Layout

Two independent npm projects, no root `package.json`. Run commands from inside each folder.

- `backend/`: Express 5 + Mongoose 9 (CommonJS), Socket.IO, Redis (rate limiting), Nodemailer.
- `frontend/`: Next.js 16 (App Router, `src/`, plain JS), React 19, Tailwind 4 + shadcn/radix, TanStack Query, Redux Toolkit / Zustand, socket.io-client.

Code comments are often in Roman Urdu/Hindi. Keep that style when editing nearby code.

## Commands

Backend (`cd backend`):
- `npm run dev`: nodemon `server.js`. `npm start` runs it without nodemon.
- `npm test`: runs all tests with `node --test` (files in `test/`). Run one file with `node --test test/chatModels.test.js`; filter by name with `node --test --test-name-pattern="partial unique" test/`.
- `node scripts/migrateTenantIndexes.js`: run after changing model indexes (dry run; add `--apply`).
- `node scripts/migrateAttributesPerStore.js --apply`: copies legacy global attributes into every store (run after `migrateTenantIndexes.js --apply`).- `npm run backfillSubdomains`, `npm run backfill:translations`, `npm run translation:check`: one-off data scripts.
- `npm run argos:serve`: local translation server (needs `uv`). The default target is `LIBRETRANSLATE_URL`.

Frontend (`cd frontend`):
- `npm run dev`: uses `next dev --webpack`. `npm run build`, `npm run lint` (ESLint 9, `eslint-config-next`).
- UI strings live in `src/i18n/locales/<code>.json` (one file per language). Edit those directly and add every new key to `en.json`, which is the fallback.

Production checklist (multi-tenant security):
- `NODE_ENV=production`: auth cookies get `Secure`.
- `REDIS_URL` set: shared rate limits and single-use handoff links across servers. Without it, the handoff check falls back to MongoDB.
- `INTERNAL_PROXY_SECRET`: the same value in both `.env` files. The backend trusts `x-store-host` only with it.
- `JWT_USER_*`, `JWT_ADMIN_*`, `JWT_SA_*` access/refresh secrets: six different random values, not the dev ones. `JWT_SECRET` signs only short-lived purpose tokens (handoff, password reset, seller setup links).
- `PUBLIC_STORE_PROTOCOL=https`.
- `GOOGLE_CLIENT_ID` (backend) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (frontend) set to the same value, with the store hosts added as authorized origins in the Google console.

Configuration comes entirely from `backend/.env` and `frontend/.env`. Server code reads `PORT`, `API_PREFIX`, `UPLOAD_DIR`, and similar values with no defaults, so a missing variable breaks startup or requests. The frontend calls the API through `NEXT_PUBLIC_SERVERURL` and has no fallback.

## Next.js 16 caveat (from `frontend/AGENTS.md`)

This Next.js version has breaking changes compared with older versions. Read the relevant guide in `frontend/node_modules/next/dist/docs/` before writing Next-specific code. One example: middleware lives in `src/proxy.js` (export `proxy`), not `middleware.js`.

## Multi-tenant architecture (the big picture)

One deployment serves many stores, and the store is chosen by the **Host header**.

- **Platform host** (`ROOT_DOMAIN` / `NEXT_PUBLIC_ROOT_DOMAIN`, for example `192.168.88.35.nip.io` in dev): landing page, seller signup (`/seller/apply`), `/store-setup`, and `/super-admin`.
- **Store host** (`<subdomain>.<root>` or a registered custom domain): that store's storefront plus `/admin`. Platform-only pages return 404 on store hosts.

Frontend routing: [frontend/src/proxy.js](frontend/src/proxy.js) parses the host using `src/lib/tenantHost.js`. It checks that the store exists through backend `/store/resolve` and rewrites or redirects. It also forwards `x-tenant-type`, `x-store-host`, and `x-store-subdomain` headers. **Server-side fetches in Next must forward `x-store-host`.** In the browser, `src/apis/axiosInstance.js` uses `alignBackendUrl` to point API calls at the page's own hostname on the backend port, so host-only auth cookies and tenant detection keep working.

Backend isolation:
- `middleware/resolveStore.js` runs on every request under `API_PREFIX`. It resolves the store from the host and wraps the request in `runWithStore()` (`utils/tenantContext.js`, which uses AsyncLocalStorage).
- `utils/tenantScopePlugin.js` is applied to store-owned models. It automatically filters queries by `storeId` and stamps it on writes. Any new store-owned model needs `schema.plugin(tenantScope)`. The `Store` model scopes on its own `_id`, so `Store.findOne()` returns the current store. For intentional cross-store queries, use `.setOptions({ skipTenantScope: true })`.
- Unique indexes are compound with `storeId`, for example `{ storeId, sku }`.
- Always use `utils/tenantMulter` for uploads, never plain `multer`, because plain multer loses the AsyncLocalStorage context.
- Upload folders and URLs come from `utils/uploadPaths.js`: `uploadDirFor(req, kind, ...)` → `uploads/stores/<storeId>/<kind>/...`, `uploadUrlFor(savedPath)` for the URL, `localPathForUrl(req, url)` before deleting (refuses other stores' files). KYC files in `uploads/documents` are served only to a super admin session.
- Auth: each audience has its own tokens and cookies (`utils/tokens.js`: customer `u_at`/`u_rt`, admin `a_at`/`a_rt`, super admin `sa_at`/`sa_rt`). Admin routers use `authMiddleware.requireAdmin`, customer routes `requireUser`; the frontend sends `X-Auth-Aud`.
- Socket.IO (`utils/socket.js`): `io` is a tenant-aware Proxy. Verified employee sockets join `store:<id>:admin`; everyone else (guests, customers) joins `store:<id>`. In store context `io.emit` sends the full payload to the admin room only; events listed in `PUBLIC_EVENTS` also go to the public room as `{_id}` / `{changed:true}`, and order events go to the owner (`customer:<userId>`) as `{_id}`. Add a new storefront event to `PUBLIC_EVENTS`, never emit full documents publicly. `chat:admins` maps to `chat:admins:<id>`. Use `relayToStore(socket)` instead of `socket.broadcast`. Controllers reach `io` through `req.io`. On the frontend, `hooks/admin/use*SocketSync.js` invalidate React Query caches when socket events arrive; `hooks/user/useUserSocketSync.js` invalidates by id.
- Cookies are host-only. After a seller logs in on the platform host, a one-time handoff takes them to their store: `/users/admin/handoff`, then frontend `/admin-handoff#token=...`.

## Backend structure and conventions

- `app.js` builds the Express app (middleware, every router under `API_PREFIX`, then the central `middleware/errorHandler.js`) and is what tests load with supertest. `server.js` creates the HTTP server and Socket.IO (`app.set("io", io)`), connects the DB, seeds only the Super Admin (from `SUPER_ADMIN_*` env vars), starts `bannerScheduler` and the theme jobs, listens, and handles graceful shutdown.
- Auth: `middleware/authMiddleware.js` accepts a JWT from a Bearer header or the `accessToken` cookie. The token `type` is `user` or `employee` (separate `User` and `Employee` models). `checkPermission(key)` always lets `admin` through, and it blocks other roles only when `permissions[key] === false`. Super admin has its own auth (`superAdminAuth.js`, `SuperAdmin` model). `requireApprovedSeller` blocks stores that haven't been approved yet.
- `utils/logger.js` is pino behind the `log.error/warn/info/debug` interface. Level comes from `LOG_LEVEL`; the default is `warn` in development, `info` in production and silent under `node --test`. Set `LOG_LEVEL=debug` to see more while debugging. Requests carry `req.id` (`X-Request-Id`), and error responses include it as `requestId`. Startup status lines go directly to `console`.
- Content translation (`utils/translationService.js`): English fields stay the source of truth. Translations are stored in `translations.<field>.<locale>` with an md5 staleness hash in `translation_source.<field>`, and they're generated asynchronously through LibreTranslate. If the service is down, the English text is shown. Controllers for products, categories, brands, deals, discounts, banners, attributes, and reviews trigger translation.
- Image uploads go through middleware in `middleware/*ImageMiddleware.js` and `saveProductImages.js`, use sharp/webp, and are served from `/uploads` with immutable caching. Filenames must stay unique, never overwritten.

## Frontend structure

- `src/app/(user)`: storefront. `src/app/admin`: store admin panel, including POS. `src/app/super-admin`: platform admin. Also `landing`, `store-setup`, `admin-handoff`, and `store-not-found`.
- API calls are grouped by audience in `src/apis/{admin,user,superadmin}/*Api.js` on top of the shared `axiosInstance`. Hooks wrapping them live in `src/hooks/{admin,user}`.
- Rewards visibility: `src/hooks/user/useRewardPrograms.js` is the single gate for reward UI. Admin loyalty `enabled` off ho to header points badge, account Rewards/Refer a Friend tabs, reward popups, aur referral pages sab hide/off-state ho jate hain (details: `docs/19-rewards-visibility.md`).
- i18n: `src/i18n/config.js` defines the locales (en default/fallback, plus `ur` and `ar` as RTL). The language is stored in the `lang` cookie and provided by `LanguageProvider`. Admin and storefront use separate theme cookies (`theme` and `user-theme`).
