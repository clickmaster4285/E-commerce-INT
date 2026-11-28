# 07 — API Reference

Sab routes `${API_PREFIX}` ke neeche mount hain (default `/api`). Har request par
`resolveStore` chalta hai. Auth legend:

- **Public** — koi auth nahi
- **User** — `requireUser` (customer `u_at`)
- **Admin** — `requireAdmin` (employee `a_at`)
- **SA** — super admin (`sa_at`)
- `+perm(x)` — `checkPermission(x)` bhi lagta hai

> Endpoints badalte rahe to `backend/routes/*.js` authoritative source hai.

## Auth / Users — `/users`

| Method | Path | Auth | Kaam |
|---|---|---|---|
| POST | `/register` | Public | Customer registration |
| POST | `/register/check` | Public | Email/username/phone/address availability |
| POST | `/login` | Public | Customer login |
| POST | `/admin/login` | Public | Admin/seller login |
| POST | `/refresh-token` | Public | Customer refresh |
| POST | `/admin/refresh-token` | Public | Admin refresh |
| POST | `/admin/handoff` | Admin | Store handoff token banao |
| POST | `/admin/handoff/exchange` | Public | Store host par handoff exchange |
| POST | `/logout` | Public | Logout |
| POST | `/google-login` | Public | Admin Google login |
| POST | `/google-customer-login` | Public | Customer Google login |
| GET | `/email-health` | Public | SMTP health |
| POST | `/send-email-otp` | Public | OTP bhejo |
| POST | `/verify-email-otp` | Public | OTP verify |
| POST | `/forgot-password` | Public | Reset OTP |
| POST | `/verify-reset-otp` | Public | Reset OTP verify |
| POST | `/reset-password` | Public | Password reset |
| GET | `/me` | Auth | Current identity |
| GET | `/profile` | Auth | Profile |
| PUT | `/profile` | Auth + perm(profile) | Profile update |
| PUT | `/password` | Auth + perm(profile) | Password change |
| PUT | `/phone` | User | Phone update |
| POST/GET/PUT/DELETE | `/checkout-drafts...` | User | Checkout drafts |
| GET | `/wishlist` | User | Wishlist |
| PUT | `/wishlist/toggle` | User | Wishlist toggle |

## Store — `/store`

| Method | Path | Auth |
|---|---|---|
| GET | `/public` | Public (60s cache) |
| GET | `/resolve` | Public |
| GET | `/check-subdomain` | Public |
| PUT | `/domain` | Admin + perm(store) |
| GET | `/` | Admin |
| PUT | `/` | Admin + perm(store) |

## Catalog

### Categories — `/categories`
Public: `GET /public`. Admin: `GET /admin/options`, `/admin/all`, `/next-code`, `/`, `/:id`,
`/:id/attributes`, `/:id/attributes-hierarchy`, `POST /`, `PUT /:id`, `PUT /:id/attributes`,
`DELETE /:id` (`+perm(products)`).

### Brands — `/brands`
Public: `GET /`, `GET /:id`, `GET /:id/details`. Admin: `GET /next-code`, `/admin/all`,
`POST /` (logo), `PUT /:id`, `DELETE /:id` (`+perm(brands)`).

### Products — `/products`
Public: `GET /`, `/stats`, `/facets`, `/category-tiles`, `/:id`. Admin: `GET /admin/:id/history`,
`POST /`, `PUT /:id`, `DELETE /:id`, `PATCH /:id/toggle-status` (`+perm(products)`),
`PATCH /bulk-featured`, `PATCH /:id/toggle-featured` (`+perm(featuredProducts)`).

### Variants — `/variants`
Admin (`requireAdmin` + staff gate): `POST /`, `GET /next-sku`, `PUT /:id`, `DELETE /:id`,
`GET /`, `GET /:id`.

### Attributes — `/attributes`
Admin `+perm(attribute)`: `GET /`, `/stats`, `POST /`, `GET/PUT /:id/categories`, `GET/PUT/DELETE /:id`.

### Tags — `/tags`
Admin: `GET /`, `POST /`, `PUT /:id`, `DELETE /:id`.

### Bundles — `/bundles`
Public: `GET /active`. Admin `+perm(bundles)`: `GET /`, `/:id`, `POST /`, `PUT /:id`,
`DELETE /:id`, `PATCH /:id/toggle-status`.

## Promotions

### Discounts — `/discounts`
Public: `GET /public`. Admin (requireAdmin): `POST /`, `GET /`, `GET /:id/targets`, `GET /:id`,
`PUT /:id`, `DELETE /:id`.

### Deals — `/deals`
Public: `GET /active`, `/active/:id`. Admin `+perm(deals)`: `POST /upload-image`, `GET /`,
`GET /:id/targets`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`, `PATCH /:id/toggle-status`.

### Banners — `/banners`
Public: `GET /`, `/active`, `/:id`. Admin `+perm(banners)`: `GET /admin/all`, `POST /`,
`PUT /:id`, `PATCH /:id/toggle`, `POST /:id/duplicate`, `DELETE /:id`.

### Reviews — `/reviews`
Public: `GET /product/:productId`. Customer: `GET /my`, `POST /`, `PUT /:id`, `DELETE /:id`.
Admin `+perm(reviews)`: `GET /admin/all`, `/admin/:id`, `PATCH /:id/status`,
`PATCH /:id/response`, `DELETE /:id/response`.

## Orders & Cart

### Orders — `/orders`
Customer: `POST /` (rate-limited), `GET /my`, `GET /:id`, `PUT /:id/edit`, `DELETE /:id`.
Admin `+perm(order)`: `GET /admin/all`, `GET /admin/product-summary`, `GET /admin/:id`,
`PATCH /admin/:id/status`, `PATCH /admin/:id/payment`.

### Cart — `/cart`
User: `GET /`, `PUT /`.

### Addresses — `/addresses`
User: `GET /`, `POST /`, `PUT /:id/default`, `PUT /:id`, `DELETE /:id`.

## Inventory & purchasing

### Stock — `/stock`
Admin `+perm(manageStock)`: `GET /`, `POST /adjust`, `GET /history`.

### Vendors — `/vendors`
Admin: `GET /next-code`; `+perm(vendors)`: `GET /admin/all`, `/:id/details`, `/:id`, `POST /`,
`PUT /:id`, `DELETE /:id`, `POST /:id/restore`.

### Purchase Orders — `/purchase-orders`
Admin: `GET /next-code`; `+perm(purchaseOrders)`: `GET /admin/all`, `POST /`, `GET /admin/:id`,
`PUT /:id`, `PATCH /admin/:id/confirm|cancel|close`, `PATCH /admin/:id/payment`;
deliver/receive additionally `+perm(manageStock)`.

## POS & finance

### POS — `/pos`
Admin `+perm(pos)`: `GET /products`, `GET /sales`, `GET /returns`, `GET /sales/:id`,
`GET /customers/:customerId/history`, `POST /sales`, `PUT /sales/:id`,
`POST /sales/:id/returns`.

### Invoices — `/invoices`
Admin `+perm(invoices)`: `GET /`, `GET /next-number`, `POST /`, `PUT /:id`, `GET /:id`,
`POST /:id/send`, `POST /:id/payments`, `POST /:id/returns`.

### Quotes — `/quotes`
Admin `+perm(quotes)`: `GET /`, `POST /reserve-number`, `POST /`, `GET /:id`, `PUT /:id`,
`PATCH /:id/status`.

### Finance — `/finance`
Admin + finance permission: `GET /overview?period=...`.

## CRM

### Customers — `/customers`
Admin `+perm(customers)`: `GET /admin/all`, `GET /search`, `GET /:id`, `POST /`, `PUT /:id`,
`DELETE /:id`.

### Leads — `/leads`
Admin `+perm(leads)`: `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `PATCH /:id/status`,
`POST /:id/activities`, `DELETE /:id`.

## Shipping — `/shipping`
Public: `GET /config`, `/rules`, `/methods`. Auth: `POST /quote`.
Admin `+perm(shipping)`: `PUT /admin/config`, `GET/POST /admin/rules`, `PUT/DELETE /admin/rules/:id`,
`PATCH /admin/rules/:id/toggle`, `GET/POST /admin/methods`, `PUT/DELETE /admin/methods/:id`,
`PATCH /admin/methods/:id/toggle`.

## Loyalty — `/loyalty`
Public: `GET /program`. User: `GET /me`, `/me/notices`, `POST /me/notices/seen`,
`POST /me/welcome/claim`, `GET /referrals/me`. Admin `+perm(loyalty)`: `GET /admin/overview`,
`GET/PUT /admin/settings`, `GET /admin/members`, `GET /admin/members/:userId`,
`POST /admin/members/:userId/adjust`, `GET /admin/transactions`, `GET/PUT /admin/referrals`.

## Employees — `/employees`
Admin: `GET /`, `GET /:id/activities`, `GET /:id`; writes `+perm(employees)`: `POST /`,
`PUT /:id`, `DELETE /:id`, `PATCH /:id/toggle-status`.

## Dashboard — `/dashboard`
Admin: `GET /stats?range=7d|30d|3m|6m|1y`.

## Chat — `/chats`
Guest: `POST /guest/start`, `GET /guest/mine`, `/guest/:id`, `PATCH /guest/:id/context`,
`GET/POST /guest/:id/messages`, `PATCH /guest/:id/read`.
Customer: `POST /general`, `POST /order/:orderId`, `GET /mine`.
Staff (`+perm(order)`): `GET /admin/unread-count`, `/admin/conversations`,
`PATCH /admin/:id/status`.
Common: `GET /:id`, `GET /:id/messages`, `POST /:id/messages`, `PATCH /:id/read`,
`PATCH /:id/context`.

## Translations — `/translations`
Admin: `POST /page` (`{model, ids(≤50), locale}`).

## Seller — `/seller`
Public: `POST /apply`, `GET /apply/status`, `GET /apply/setup`, `POST /apply/complete-setup`.
Auth: `GET /status`. Approved seller: `GET /dashboard`, `GET/PATCH /store`.

## Super Admin — `/super-admin`
Public: `POST /auth/login`, `/auth/refresh-token`, `/auth/logout`.
SA: `GET /auth/me`, `GET /dashboard`, `GET /activity/me`,
requests (`GET /requests`, `/requests/:id`, `PATCH/DELETE`, `POST /:id/approve|reject|request-info`),
stores (`GET/POST /stores`, `/stores/:id`, `PATCH/DELETE`, `PATCH /stores/:id/status`,
`POST /stores/with-owner`, `POST /stores/:id/admin-access`),
store-admins (`GET /store-admins`, `/store-admins/:id`, `PATCH`, `POST /:id/password`,
`PATCH /:id/status`),
users (`GET /users`, `/users/:id`, `PATCH/DELETE`, `POST /users/:id/password`,
`PATCH /users/:id/status`),
team (`GET/POST /team`, `/team/:id`, `/team/:id/activity`, `PATCH`, `PATCH /:id/status`,
`POST /:id/password`, `DELETE`),
plans (`GET/POST /plans`, `/plans/:id/activity`, `/plans/:id`, `PATCH`, `PATCH /:id/status`,
`DELETE`).
