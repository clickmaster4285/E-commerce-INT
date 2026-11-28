# 05 — Auth, Sessions & Security

## 1. Teen audiences

`utils/tokens.js`:

| Audience | Cookies | Secrets (env) | Access TTL |
|---|---|---|---|
| `user` (customer) | `u_at` / `u_rt` / `u_sess` | `JWT_USER_ACCESS_SECRET`, `JWT_USER_REFRESH_SECRET` | `JWT_USER_ACCESS_TOKEN_EXPIREE_DAYS` (7) |
| `admin` (employee) | `a_at` / `a_rt` / `a_sess` | `JWT_ADMIN_ACCESS_SECRET`, `JWT_ADMIN_REFRESH_SECRET` | `JWT_ACCESS_TOKEN_EXPIREE_MINUTES` (60) |
| `superadmin` | `sa_at` / `sa_rt` / `sa_sess` | `JWT_SA_ACCESS_SECRET`, `JWT_SA_REFRESH_SECRET` | `JWT_ACCESS_TOKEN_EXPIREE_MINUTES` (60) |

- Har audience ka alag secret + JWT `aud` + `typ` — customer token admin API par nahi chalta.
- Payload: `{ userId, role, type, storeId, sid/typ }` + `aud`/`sub`.
- `*_sess` = JS-readable marker (`"1"`), koi token nahi — sirf "session hai" batane ke liye.

## 2. Refresh token rotation

`utils/tokens.js` + `models/RefreshSession.js`:

- Har refresh token ka `jti` + `familyId` (login chain) DB me sha256 hash ke saath.
- Refresh par naya token (rotation); purana `revokedAt` set.
- Purana token dobara aaya → **poori family revoke** (token chori detection).
- 30s grace: do tabs ek saath refresh karein to galti se reuse na samjha jaye.
- Refresh cookie ka path sirf refresh route tak — normal API/socket requests ke saath nahi jata.
- Store binding: store A ka session store B par refresh nahi hoga.
- Logout → family revoke. Password change/reset → saare sessions revoke.

## 3. Login / Register flows

### Customer
- `POST /users/register` (ya OTP flow) → `User` + `issueSession("user")`.
- `POST /users/login` — role `user` hona zaroori; inactive/blocked/deleted block.
- Google: `POST /users/google-customer-login` (`utils/googleAuth.js`).

### Admin (seller/staff)
- `POST /users/admin/login` — platform host par seller login → handoff.
- `POST /users/admin/refresh-token` — admin refresh.
- Google admin: `POST /users/google-login`.

### Super admin
- `POST /super-admin/auth/login` → `sa_at` cookies.
- Separate auth middleware (`middleware/superAdminAuth.js`).

## 4. OTP flow (`controllers/otpController.js`)

- Config: `EMAIL_OTP_EXPIRE_MINUTES`, `EMAIL_OTP_MAX_ATTEMPTS`, `EMAIL_OTP_RESEND_SECONDS`,
  `OTP_LENGTH`, `RESET_TOKEN_EXPIRE_MINUTES`.
- Code bcrypt hash ke saath `Otp` model me; TTL index expiry par delete.
- Resend throttle; purane codes delete; email fail par OTP delete (production).
- Signup: `PendingRegistration` me data rakha jata hai; **`User` sirf OTP verify ke baad banta hai**.
- Password reset: OTP verify → short-lived `JWT_SECRET` reset token → `reset-password`.
- Dev me SMTP na ho to OTP console par print hota hai (non-production only).

## 5. Google login (`utils/googleAuth.js`)

- `verifyGoogleIdToken` Google `tokeninfo` se verify karta hai.
- Checks: `aud === GOOGLE_CLIENT_ID`, issuer Google, `exp`, `email_verified`, email.
- Frontend `NEXT_PUBLIC_GOOGLE_CLIENT_ID` backend `GOOGLE_CLIENT_ID` ke barabar hona chahiye;
  store hosts Google console me authorized origins me add karo.

## 6. Seller onboarding flow

```
/landing/signup (platform)
   → POST /seller/apply                     → SellerApplication (pending)
   → email "application received"
        │
   Super Admin panel: approve / reject / request-info
        │
   request-info → signed setup link → /store-setup?token=...
        → POST /seller/apply/complete-setup (documents + logo)
        │
   approve → Store (open) + Employee (owner, seller_pending:false) + email
        │
   seller login (platform) → handoff → store admin panel
```

- `SellerApplication` fields: identity, store info, documents, status, provisioned `store_id`/`user_id`.
- `utils/sellerSetupToken.js` — signed token (`type:"seller_setup"`, `JWT_SECRET`, default 7 days).
- `utils/sellerOwnership.js` — "one seller email = one store".
- `requireApprovedSeller` — approved + active + store open.
- `allowPendingSeller` — pending seller ko selected non-write routes allow.

### Pending seller (read-only mode)
`authMiddleware` pending seller (`seller_pending`) ke liye sirf GET/HEAD/OPTIONS allow karta hai;
writes `403 SELLER_PENDING` dete hain. Frontend toast dikhata hai.

## 7. Handoff (platform → store)

- `POST /users/admin/handoff` — employee-only, 2-min JWT (`type:"store_handoff"`, `jti`).
- Token URL `#fragment` me (server logs me na aaye).
- `POST /users/admin/handoff/exchange` (store host, public) — `claimOnce("handoff", jti)`:
  - Redis: `SET key 1 EX ttl NX`
  - warna Mongo `UsedToken` (duplicate key = already used)
- Phir store admin session issue.

`utils/oneTimeToken.js` `claimOnce(purpose, id, ttl)` — first use only.

## 8. Permissions & roles

Roles (`utils/roles.js`): `storehandler` (owner), `admin`, `manager`, `staff`.

`checkPermission(key)`:
- non-employee → sirf `profile` allow, baaki 403.
- `storehandler`/`admin` → bypass.
- staff → sirf `permissions[key] === false` block (undefined = allow legacy).

Socket par **fresh DB permissions** har event par check hote hain (`requireSocketPermission`).

## 9. Security measures

- HttpOnly cookies, `Secure` in production, SameSite default `lax`.
- Host-only cookies (per-store isolation).
- Refresh cookie path-restricted; access token short-lived.
- Store binding on every token (cross-store token 401).
- `x-store-host` sirf `INTERNAL_PROXY_SECRET` ke saath (timing-safe compare).
- KYC documents sirf super-admin.
- Path traversal guards in uploads.
- `utils/logger.js` no-op (secrets accidental log na hon) — lekin debug ke liye console use karo.
- Rate limiting (dekho neeche).
- CORS: platform family + registered custom domains only.

## 10. Rate limiting (`middleware/rateLimit.js`)

- `express-rate-limit` + optional Redis (`rate-limit-redis`) jab `REDIS_URL` set ho.
- Saare limits env se (`RATE_LIMIT_*`).
- Role-based multipliers (`RATE_LIMIT_USER_MULTIPLIER`, `RATE_LIMIT_ADMIN_MULTIPLIER`);
  multiplier ≤ 0 = unlimited.
- Key strategies: IP, email, IP+email, user.
- Chat messages: Redis Lua atomic INCR/PEXPIRE (30 msg / 60s default), memory fallback.
- 429 response: `Retry-After` + `{message, retryAfter}`.
- Prebuilt limiters: global, login, adminLogin, register, registerCheck, sendEmailOtp,
  verifyEmailOtp, forgotPassword, verifyResetOtp, resetPassword, googleLogin, sellerApply,
  orderCreate, reviewCreate, chat.

## 11. Production checklist

- `NODE_ENV=production` → cookies `Secure`.
- `REDIS_URL` set → shared limits + one-time tokens across servers.
- `INTERNAL_PROXY_SECRET` dono `.env` me same.
- 6 different JWT secrets (user/admin/sa access+refresh) — dev values nahi.
- `PUBLIC_STORE_PROTOCOL=https`.
- `GOOGLE_CLIENT_ID` = `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, store hosts authorized.
- Strong `SUPER_ADMIN_PASSWORD` + `SUPER_ADMIN_MIN_PASSWORD_LENGTH`.
