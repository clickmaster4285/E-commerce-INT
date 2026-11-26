# 17 — Postman Testing Guide

Collection file: `docs/postman_collection.json` (317 requests, 34 folders).
Import it in Postman: **Import → File → postman_collection.json**.

---

## 1. Collection variables

| Variable | Default | Purpose |
|---|---|---|
| `baseUrl` | `http://localhost:5000` | Backend origin (no trailing slash) |
| `apiPrefix` | `/api` | Must match backend `API_PREFIX` |
| `storeHost` | `192.168.88.35.nip.io` | Used as `Host` header for store/tenant testing |

Postman sends cookies automatically for the backend host. For tenant testing, add a `Host` header override in the request (Postman → Headers → `Host: <subdomain>.<root>`).

---

## 2. How to test a tenant (multi-store)

1. Create a store via seller signup or Super Admin.
2. In Postman, set request header `Host: <subdomain>.192.168.88.35.nip.io` (or custom domain).
3. Backend `resolveStore` reads Host → sets tenant context. All queries auto-scope to that store.

Without `Host`, requests hit the platform host (no store context) — useful for `/super-admin`, `/seller/apply`, `/store/resolve`.

---

## 3. Auth flow (cookies)

Postman's cookie jar stores `u_at/u_rt/u_sess` (customer) and `a_at/a_rt/a_sess` (admin) per host.

1. **Customer signup**: `POST /users/register` → returns `requireVerification:true` + `debugOtp` (dev). Then `POST /users/verify-email-otp` → sets customer cookies.
2. **Customer login**: `POST /users/login` → sets cookies.
3. **Admin login**: `POST /users/admin/login` → sets admin cookies.
4. **Super admin**: `POST /super-admin/auth/login` → sets `sa_at/sa_rt/sa_sess`.
5. Subsequent requests: cookies sent automatically; also send `X-Auth-Aud: admin` or `user` header (collection default `admin`).

To test as a different audience, change the `X-Auth-Aud` header per request.

---

## 4. Standard response shape

Success:
```json
{ "success": true, "message": "...", "data": { ... } }
```
Error:
```json
{ "success": false, "message": "...", "errors": { "field": "..." } }
```
HTTP status codes: 200/201 success, 400 validation, 401 unauth, 403 forbidden/pending-seller, 404 not found, 429 rate-limited (with `retryAfter`), 500 server error, 503 SMTP failure.

---

## 5. Key test scenarios

### A. Seller signup (pending approval)
1. `POST /users/register` with `wantsStore:true`, storeName (≥3 chars), subdomain, email, password.
2. `POST /users/verify-email-otp` with email + OTP (dev: use `debugOtp` or console).
   → Response: `pendingApproval:true`, `handoffUrl` (store subdomain `/admin-handoff#token=...`).
3. Open `handoffUrl` in browser → auto-login to store admin (read-only).
4. `GET /users/profile` → `seller_pending:true`.
5. Try `POST /products` → 403 `SELLER_PENDING`.

### B. Super Admin approves seller
1. `POST /super-admin/auth/login`.
2. `GET /super-admin/requests` → find pending application.
3. `POST /super-admin/requests/:id/approve`.
4. Seller refreshes → `seller_pending:false`, full access.

### C. Customer flow on a store
1. Set `Host: <subdomain>.nip.io`.
2. `POST /users/register` (no wantsStore) → OTP → verify → customer cookies.
3. `GET /products`, `GET /products/:id`, `POST /orders`, `GET /orders/my`.

### D. OTP / password reset
1. `POST /users/forgot-password` → `debugOtp` (dev).
2. `POST /users/verify-reset-otp` → `resetToken`.
3. `POST /users/reset-password` with email, resetToken, newPassword.

### E. Multi-tenant isolation
1. Create store A and store B.
2. As store A admin, `GET /products` → only A's products.
3. Same request with store B Host → only B's products.
4. Cross-store access token → 401 (storeId mismatch).

---

## 6. Testing tips

- **Cookies**: Postman → Settings → "Send cookies automatically" ON. Use the same host for all requests in a flow.
- **Tenant header**: For store-scoped requests, add `Host` header manually (Postman doesn't auto-set for `baseUrl` origin). Alternatively use `x-store-host` + `x-internal-proxy-secret` for internal testing.
- **Rate limits**: Login/OTP endpoints are rate-limited; wait or use different IPs.
- **Dev OTP**: Backend prints OTP to console when SMTP is off; response includes `debugOtp`.
- **File uploads**: Use `form-data` body for image endpoints (`productImagesUpload`, etc.), not raw JSON.
- **Socket.IO**: Not testable via Postman REST; use a socket client.

---

## 7. Common pitfalls

- Missing `X-Auth-Aud` header → backend defaults to admin for `authMiddleware` (may cause confusion).
- Calling store endpoints without `Host` → platform context, no store → 404/empty.
- Using production `NODE_ENV` without SMTP → OTP returns 503.
- Forgetting `credentials: true` equivalent — Postman handles cookies, but browser fetch needs `withCredentials`.
- Rate limit 429 → wait `retryAfter` seconds.

---

## 8. Request body examples

Product create:
```json
{ "name": "Test Product", "category_id": "<id>", "brand_id": "<id>", "has_variants": false, "description": "..." }
```
Order:
```json
{ "items": [{ "product_id": "<id>", "variant_id": "<id>", "quantity": 1 }], "address_id": "<id>", "shipping_method": "standard" }
```
Discount:
```json
{ "code": "SAVE10", "name": "10% off", "type": "percentage", "value": 10, "applyTo": "all", "startDate": "2026-01-01", "endDate": "2026-12-31" }
```
