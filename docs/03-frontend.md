# 03 — Frontend (Next.js 16 App Router)

Root: `frontend/`

> ⚠️ Next.js 16 me breaking changes hain. Middleware file ka naam **`src/proxy.js`** hai
> (export `proxy`), `middleware.js` nahi. Next-specific code likhne se pehle
> `node_modules/next/dist/docs/` me relevant guide parhna zaroori hai.

## 1. Folder structure

```
frontend/
├─ next.config.mjs        # allowedDevOrigins, redirects, typescript ignore
├─ src/
│  ├─ proxy.js            # tenant routing middleware (Next 16)
│  ├─ app/
│  │  ├─ layout.js        # root shell + theme scripts
│  │  ├─ providers.js     # QueryClient + Redux + Toaster
│  │  ├─ (user)/          # storefront
│  │  ├─ admin/           # store admin panel
│  │  ├─ super-admin/     # platform admin
│  │  ├─ landing/         # platform landing + signup
│  │  ├─ login/           # customer login
│  │  ├─ seller/          # (khali; signup /landing/signup hai)
│  │  ├─ store-setup/     # seller store setup
│  │  ├─ admin-handoff/   # platform → store handoff
│  │  └─ store-not-found/
│  ├─ apis/               # axios clients + per-audience API modules
│  ├─ components/         # admin, adminComponents, user, superadmin, chat, common, landing
│  ├─ hooks/              # admin/user socket sync + data hooks
│  ├─ i18n/               # config, LanguageProvider, locales/*.json
│  ├─ lib/                # tenantHost, authSession, roles, adminModules, planModules…
│  ├─ redux/              # storeInfo slice
│  └─ utils/              # dealCalculator, bundleCalculator, homeCatalog, compressImage…
```

## 2. Host routing — `src/proxy.js`

- `parseTenantHost(host)` → `platform` / `subdomain` / `custom` / `unknown`.
- Store existence backend `GET /store/resolve` se (60s cache, `x-store-host` +
  `x-internal-proxy-secret`).
- Request headers forward: `x-tenant-type`, `x-store-host`, `x-store-subdomain`.
- Rules:
  - Platform host: `/` → `/landing`; `/landing` → `/`.
  - Platform-only pages (`/landing`, `/super-admin`, `/store-setup`, `/seller/apply`) store host par
    → `/store-not-found`.
  - `/admin/*` store host par → admin session (`a_at`/`a_sess`) warna `/admin/login`.
  - Store missing → `/store-not-found`.
- `/_next`, `/api`, static files (extension wali) bypass.

## 3. App areas

### Storefront `app/(user)`
Layout: `UserLayoutClient` (Header, Footer, CartDrawer, QuickBuy, Wishlist, SupportChatWidget,
WelcomeRewardModal, MobileNav, user socket sync). Pages:

`/` (home), `/shop`, `/search`, `/filtering-product`, `/product/[id]`, `/brand/[id]`, `/brands`,
`/bundles`, `/deals/[id]`, `/cart`, `/checkout`, `/account`, `/wishlist`, `/orders`,
`/orders/[id]`, `/orders/[id]/chat`, `/chats`, `/chats/[conversationId]`, `/chats/guest`,
`/referrals`, `/referrals/setup`.

### Admin `app/admin`
Layout: `AdminLayoutClient` — `isAdminRole` gate, Sidebar, Navbar, store/order/shipping socket
sync, `ROUTE_PERMISSIONS` map (dashboard, products, order, brands, categories, attributes,
featuredProducts, reviews, store, discounts, deals, banners, etc.).

Modules (`lib/adminModules.js` — single source of truth):
- Overview: dashboard
- Catalog: brands, categories, attributes, products, featured-products, reviews
- Sales & Marketing: discounts, deals, banners, referrals
- Operations: manage-stock, orders, chats, shipping
- Purchasing: vendors, purchase-orders
- POS & Customers: pos, customers, leads, quotes, invoices
- Finance: finance
- Store: store-info, terms-conditions
- Team & Account: employees, profile, loyalty

### Super-admin `app/super-admin`
`(panel)` layout → `SuperAdminShell`. Pages: dashboard, applications, stores, store-admins, plans,
team, activity. `superAdminApi` separate `sa_at` cookies use karta hai.

### Platform pages
- `landing` — marketing page.
- `landing/signup` — multi-step seller/store signup + OTP.
- `login` — customer login (Google + OTP + reset).
- `store-setup` — approved seller store details + documents.
- `admin-handoff` — URL hash se 2-min token exchange karke `/admin/dashboard` par le jata hai
  (deliberately `/admin` ke bahar, taake guard block na kare).
- `store-not-found` — missing/disabled store.

## 4. API layer — `src/apis`

- `axiosInstance.js`:
  - `API_BASE_URL` = `NEXT_PUBLIC_SERVERURL` (no fallback).
  - `alignBackendUrl` browser me API ko page ke hostname par le aata hai (sirf port alag) —
    is se HttpOnly cookies chalti hain aur backend Host se store pehchanta hai.
  - `X-Auth-Aud` header (`admin`/`user`).
  - 401 par single-flight refresh (`/users/admin/refresh-token` ya `/users/refresh-token`),
    phir original request retry.
  - `SELLER_PENDING` 403 → toast; 429 → retry-after toast.
  - `userHttp` guest par user-only paths (cart/profile/wishlist…) network hi nahi bhejta.
- `superadmin/superAdminApi.js` — alag `superAdminHttp` (sa cookies).
- Per-audience modules: `apis/admin/*Api.js`, `apis/user/*Api.js`, `apis/superadmin/*Api.js`.

## 5. State management

- **TanStack Query**: primary data layer (staleTime 60s, gcTime 5min, retry 1).
- **Redux Toolkit**: sirf `storeInfo` slice (admin sidebar/login/store-info).
- **React Context**:
  - `CartContext` — localStorage cart (`cm_cart`), deal/bundle pricing.
  - `WishlistContext` — DB-backed wishlist.
  - `QuickBuyContext` — "Choose Options" drawer.
  - `DiscountContext.js` — actually hook `useDiscounts` (naming misleading).
- **Zustand**: install hai dependency me lekin code me use **nahi** hota.
- **Cookies**: `lang`, `theme` (admin), `user-theme` (storefront), `super-admin-sidebar-collapsed`.

## 6. Hooks

### Socket sync (admin)
Har hook event par matching React Query keys invalidate karta hai:

| Hook | Invalidates |
|---|---|
| useOrderSocketSync | admin-orders, admin-orders-count, admin-order/:id |
| useProductSocketSync | product list/detail (status patch) |
| useStockSocketSync | stock, stock-history |
| useAttributeSocketSync | attributes, category-attributes |
| useBannerSocket | adminBanners |
| useBrandSocketSync | brands, brand/:id |
| useCategorySocketSync | categories, admin-categories |
| useDealSocketSync | deals, activeDeals |
| useDiscountSocketSync | discounts |
| useReviewSocketSync | adminReviews |
| useShippingSocketSync | shipping config/rules/methods |
| useStoreSocketSync | storeInfo, store |

### Storefront
- `useUserSocketSync` — reconnect par catalog/store caches invalidate.
- `useHomeCatalog`, `useShopProducts`, `useCurrentLocation`, `useScrollFade`.

### Connections
- `useAdminSocket` (aud `admin`), `useUserSocket` (aud `user`), `useSocket` (global singleton).
- `lib/socketAuthSync.js` — access token refresh par socket reconnect + `auth:refresh-needed` handle.

## 7. i18n

- `i18n/config.js`: `en` default/fallback; `ur` + `ar` RTL; plus es, fr, de, hi, zh, pt, tr.
- `LanguageProvider`: `lang` cookie, `t()` via `useTranslation()`.
- `i18n/localize.js`: DB content localization — `translations.<field>.<locale>`, English fallback.
- UI strings: `src/i18n/locales/<code>.json`. Naya key hamesha `en.json` me bhi add karo.

## 8. Components

| Group | Kya |
|---|---|
| `components/admin` | Heavy forms/dialogs (product, category, brand, vendor, invoice, quote designer…) |
| `components/adminComponents` | Sidebar, Navbar, headers, stat cards |
| `components/user` | Storefront UI (header/footer, product cards, cart drawer, banners, reviews, loyalty…) |
| `components/superadmin` | Shell, sidebar, topbar, forms + `ui/` kit |
| `components/chat` | ChatThread, SupportChatWidget, inquiry picker |
| `components/landing` | Landing sections |
| `components/common` | SearchCombobox, NotFoundPage, LanguageTransition, FallbackImage |

## 9. Data flow summary

1. Host → `proxy.js` tenant resolve → page.
2. Client fetch → `axiosInstance` (aligned host, `X-Auth-Aud`) → backend.
3. TanStack Query cache; admin sockets invalidate on realtime events.
4. Mutations invalidate keys; `storeUpdated` Redux `storeInfo` + `["storeInfo"]` update.
5. Render-time localization via `useLocalized`; UI strings via `useTranslation`.
