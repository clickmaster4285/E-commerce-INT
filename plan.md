# Phase 2: Plugin Platform Foundation (Plugin Manager)

## Context
The roadmap (`Plugin_Based_Ecommerce_Platform_Architecture_and_Roadmap.docx`) defines five phases: 0 discovery, 1 multi-tenancy (done: ALS `runWithStore`, `tenantScope`, `tenantMulter`, tenant socket rooms, per-audience auth), **2 Plugin Manager**, 3 events and integration infrastructure, 4 the five business plugins (Order Printer, Loyalty, Cashback, Affiliate, WhatsApp), and 5 hardening.

Phase 2 builds one consistent way to add a feature as a plugin that each store can install, configure, activate, pause, update or uninstall without touching other stores. The core never hard-codes a plugin. There is no existing feature-flag, settings, event bus, queue or audit system to build on (verified), so Phase 2 creates them.

**Exit gate (from the doc):** a plugin can be installed, configured, activated, paused, updated and uninstalled for Store A while Store B is unaffected.

## The scalability flow (how plugins plug in)
```
plugins/<key>/manifest.js  ──startup──▶ Registry (in-memory, validated)
                                          │ syncPluginCatalog()
                                          ▼
                               PluginCatalog (platform, super admin controls)
                                          │ store admin installs
                                          ▼
                      PluginInstallation (per store, tenantScope) ── lifecycle + audit
                                          │ cached active set (Redis/memory)
             ┌────────────────────────────┼─────────────────────────────┐
     plugin API routes            admin nav + settings UI        storefront slots
  /plugins/<key>/* behind      (frontend registry, catch-all     (<PluginSlot name=…/>)
  requirePluginActive(key)       /admin/plugins/[key] route)
             │
     plugin code receives a PluginContext (only the core services its
     granted permissions allow) and never imports core models directly.
     Event subscriptions are declared now; Phase 3 delivers them reliably.
```
Rules that keep it scalable:
1. The manifest is the contract. Core code reads manifests and never imports plugin internals.
2. The servers stay stateless. Install state lives in Mongo, and the active-plugin set per store is cached in Redis (`plugins:active:<storeId>`, invalidated on every lifecycle change, with a memory fallback when there's no `REDIS_URL`). Any number of backend instances can serve any store.
3. Plugins reach core only through `PluginContext`, which is permission-gated. That makes it possible to move plugins out of process later (third-party sandbox) without rewriting them.
4. Plugin data is always tenant-scoped (`schema.plugin(tenantScope)`), with collection names prefixed `plugin_<key>_*`.

## Backend (`backend/`)

**New: `plugins/` folder**
- `plugins/core/manifestSchema.js`: validates the manifest fields: `key`, `name`, `version` (semver), `platform` (semver range), `category`, `permissions[]` (scopes such as `orders:read`, `customers:read`, `notifications:send`), `settings` (field definitions: type, default, required, `secret`, `public`), `subscribes[]` (event names), `adminNav[]`, `storefrontSlots[]`, `routes(router, ctx)`, and lifecycle hooks `onInstall/onActivate/onPause/onUninstall/onUpdate`.
- `plugins/core/registry.js`: loads `plugins/*/manifest.js` at startup, validates them, and fails fast on duplicates. Exposes `get(key)` and `list()`.
- `plugins/core/pluginManager.js`: the state machine `available → installed → active ⇄ paused`, plus `update_pending` and `uninstalled`. Each transition validates, calls the hook, writes the installation and an audit row, invalidates the cache, and emits the socket event `plugins:changed` to the store room through `getIO()`. Compatibility is checked with `semver.satisfies(PLATFORM_VERSION, manifest.platform)`.
- `plugins/core/context.js`: `createPluginContext(installation)` returns `{ storeId, settings, secrets, log, services }`. `services` exposes only the core APIs the granted scopes allow (Phase 2 ships `orders.read` and `customers.read` wrappers).
- `plugins/core/activeCache.js`: `getActivePlugins(storeId)` with Redis and a memory fallback. Reuse `getRedisClient()` from `middleware/rateLimit.js`, the same way `utils/oneTimeToken.js` does.
- `plugins/core/guards.js`: `requirePluginActive(key)` (returns 404 `PLUGIN_NOT_ACTIVE` on store hosts where the plugin isn't active) and `requirePluginScope(scope)`.
- `plugins/core/mountPluginRoutes.js`: for each registry entry, mounts `${API_PREFIX}/plugins/x/<key>` → `requirePluginActive` → the plugin's router. It's called in `server.js` before the 404 catch-all (around L282).
- `plugins/sample-notice/`: a minimal first-party plugin (a storefront announcement bar with settings and one admin page) used only to prove the gate. Phase 4 plugins follow the same template.

**New models** (both use `tenantScope` and are registered in `migrateTenantIndexes.js`)
- `models/PluginCatalog.js` (platform-level, no tenantScope): `key` (unique), `name`, `version`, `status` (`available|hidden|deprecated|disabled`), `allowedStoreIds[]` (optional allowlist), and a snapshot of the manifest metadata. It is upserted from the registry by `syncPluginCatalog()` in `seedDefaultData()` after `seedAttributes()` (server.js ~L300–345).
- `models/PluginInstallation.js`: `storeId`, `pluginKey`, `status`, `version`, `grantedPermissions[]`, `settings` (Mixed, validated against the manifest), `secrets` (encrypted strings), `installedBy`, `lastError`, `pausedReason`, and a unique `{storeId, pluginKey}`. It uses an atomic `findOneAndUpdate` upsert to avoid the duplicate-singleton race that `ShippingConfig` has.
- `models/PluginAuditLog.js`: `pluginKey`, `action`, `actor{type,id}`, `diff` (reuse `utils/auditHistory.js`), `reason`, and a timestamp.

**New utilities**
- `utils/secretBox.js`: AES-256-GCM encrypt and decrypt using a new env var `PLUGIN_SECRETS_KEY`. Add it to the CLAUDE.md production checklist. Secrets are never returned to the browser; the API returns them masked (`••••1234`).

**Routes**
- `routes/pluginRoutes.js`, mounted at `${API_PREFIX}/plugins`. Admin routes use `requireAdmin` + `checkPermission("plugins")`:
  - `GET /catalog` (filtered by catalog status, allowlist and compatibility)
  - `GET /installed`
  - `POST /:key/install {grantedPermissions}` (must match the manifest's required scopes)
  - `POST /:key/activate|pause|resume|update`
  - `DELETE /:key` (uninstall: soft, with data retained under the retention policy)
  - `GET|PUT /:key/settings`
  - `GET /:key/activity`
  - Public: `GET /storefront`, which returns the active plugins' slots and their `public` settings only.
- `routes/superAdminRoutes.js` additions:
  - `GET /plugins`
  - `PATCH /plugins/:key` (status or allowlist)
  - `GET /plugins/:key/installations` (cross-store, using `skipTenantScope`)
  - `POST /plugins/:key/kill` (force-pause on every store: the kill switch)
  - Each of these calls `logActivity`, and `"plugin"` is added to the `SuperAdminActivity.entityType` enum.

**Permissions**
- Add a `plugins` key to the `Employee.permissions` schema (`models/Employee.js` L42–71) and to the default list in `utils/socket.js` ~L171–187, defaulting to `false` for non-admins.
- Plugin admin routes use `checkPermission("plugin:<key>")`. Because the current semantics allow unknown keys, admins pass, and staff can be denied per plugin later.

**Event contract only (delivery is Phase 3)**
- `plugins/core/hooks.js`: `dispatch(event, payload)` finds the active plugins that subscribe to the event for the current store and calls their handlers in-process, with try/catch and an audit entry on failure.
- Wire it once in `controllers/orderController.js` `emitOrderEvent` (L14–19). Phase 3 replaces the inside of `dispatch` with an outbox plus a queue, and plugin code doesn't change.

## Frontend (`frontend/src/`)
- `apis/admin/pluginApi.js`, `apis/user/pluginApi.js`, and new methods in `apis/superadmin/superAdminApi.js`, following the `adminBrandApi` pattern.
- `plugins/registry.js` (frontend): `pluginKey → { adminPages: { [slug]: dynamic(() => import(...)) }, slots: { [slotName]: dynamic(...) } }`. Each plugin's UI lives in `plugins/<key>/`.
- Admin pages:
  - `app/admin/plugins/page.js`: Catalog and Installed tabs, with an install dialog that lists the permissions requested.
  - `app/admin/plugins/[key]/[[...slug]]/page.js`: a single catch-all route. Its default view is a settings form auto-generated from the manifest's settings definitions, plus Activity and Lifecycle controls. Other slugs render the plugin's own pages from the registry.
- Nav:
  - In `components/adminComponents/Sidebar.js`, add an "APPS" section with a "Plugins" item, then append the active plugins' `adminNav` items from `useQuery(["adminPlugins","installed"])`.
  - In `app/admin/AdminLayoutClient.js`, add `/admin/plugins` to `KNOWN_ADMIN_ROUTE_PREFIXES` and `ROUTE_PERMISSIONS: 'plugins'`.
- `hooks/admin/usePluginSocketSync.js`: on `plugins:changed`, invalidate `["adminPlugins"]`, using the same key the pages use. Don't repeat the brand hook's key mismatch.
- Storefront:
  - `components/plugins/PluginProvider.js` (fetches `/plugins/storefront`, wrapped in `UserLayoutClient.js` L144–165).
  - `<PluginSlot name="…"/>` placed at `global.widgets` (next to `SupportChatWidget`), `home.sections` (`HomeClient.js` list), `account.tabs` (`account/page.js` `NAV_ITEMS`), and `product.belowBuyBox`.
  - Server-side fetches forward `x-store-host`.
- Super admin: `app/super-admin/(panel)/plugins/page.js` (catalog status, installs per store, kill switch) and a `NAV` entry in `components/superadmin/Sidebar.js`.
- i18n: add `admin.nav.section.apps`, `admin.nav.item.plugins`, and the plugin UI strings in `i18n/translations.source.mjs`.

## Build order (about 1–2 weeks)
1. Manifest schema, registry, `secretBox`, the models, and the migration (`node scripts/migrateTenantIndexes.js`, then `--apply`).
2. `pluginManager` state machine, audit log, active cache, guards, and unit tests.
3. Store admin and super admin routes, and the `plugins` permission key.
4. The `sample-notice` plugin, route mounting, and the hooks `dispatch` contract.
5. Frontend: the API layer, the plugins catalog and installed pages, the catch-all settings page, the sidebar, and socket sync.
6. Storefront `PluginProvider` and slots, plus the super admin plugins page.
7. Run the gate on two stores.

## Verification
- `cd backend && npm test`, with new `node:test` files following the existing capture and fake-injection style:
  - `pluginManager.test.js`: allowed and forbidden transitions, idempotent install, and uninstall keeping the audit trail.
  - `pluginTenantIsolation.test.js`: `PluginInstallation` queries inside `runWithStore(A)` never match B, following the `test/tenantIsolation.test.js` pattern.
  - `secretBox.test.js`: round trip, tamper detection, and masking.
  - `pluginGuard.test.js`: a paused or uninstalled plugin returns 404, and an active one passes.
  - Manifest validation and semver compatibility rejection.
- Manual gate with the Postman CLI or a browser on two store hosts (`a.<root>`, `b.<root>`):
  - Install, configure, activate, pause, resume, update and uninstall `sample-notice` on A.
  - Confirm that B's `/plugins/installed` and storefront show nothing.
  - Confirm that `/api/plugins/x/sample-notice/*` returns 404 on B and on A while paused.
  - Confirm that the super admin kill switch pauses it everywhere.
  - Confirm that secrets never appear in responses.
- `cd frontend && npm run lint && npm run build`.

## Out of scope / decisions to confirm later
- Reliable event delivery (outbox, BullMQ, retries, dead-letter queue) is Phase 3. Billing and plans are a future phase. A third-party plugin sandbox is future work.
- Retention after uninstall: the default is soft uninstall that keeps the data. Leadership needs to set the purge window.
- `utils/bannerScheduler.js` now exports `start()`; new plugin schedulers should follow the same `start()` + `runWithStore` pattern (Phase 3).
