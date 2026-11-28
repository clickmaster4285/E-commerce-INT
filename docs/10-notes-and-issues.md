# 10 — Notes, Findings & Issues

Ye section analysis ke doran milne wali ahem baaton, bugs aur suggestions ko list karta hai.
Ye code ka hissa nahi — sirf documentation/findings hain.

## 1. Ahem bugs / defects (priority)

### 🔴 `userController.createUser` early return — customer registration dead code
**File:** `backend/controllers/userController.js:168`

```js
const referralCode = String(req.body?.referralCode || "").trim().toUpperCase().slice(0, 24);
return res.send(referralCode);        // ← ye line baaki poora signup short-circuit karti hai
const email = normalizeEmail(rawEmail);
...
```

- Effect: `/users/register` (customer signup) sirf `referralCode` string return karta hai,
  `User` create nahi hota.
- Ye likely leftover debug code hai. Agar customer registration abhi bhi kaam kar rahi hai to
  shayad OTP flow (`PendingRegistration` + `/users/verify-email-otp`) use ho raha hai, aur ye
  direct-register endpoint dead hai.
- **Fix:** line 168 hatao (ya conditionally debug-only karo) aur test karo.

### 🟠 Duplicate `PUT /users/profile` route
**File:** `backend/routes/userRoutes.js`

- `PUT /profile` do baar declare hai. Pehla (`authMiddleware` + `checkPermission("profile")` →
  `updateProfile`) hamesha match karta hai, is liye doosra (`requireUser` → `updateProfileREST`)
  unreachable hai.
- **Fix:** duplicates me se ek hatao, ya paths alag karo.

### 🟡 Super-admin dashboard "Customers" KPI dead link
**File:** `frontend/src/app/super-admin/(panel)/dashboard`

- KPI `/super-admin/users` par link karta hai, lekin `app/super-admin/.../users` route exist nahi
  karta. Click par 404.
- **Fix:** route banao ya link hatao.

### 🟡 Inconsistent permission gates
Kuch admin routes sirf `requireAdmin` use karte hain, `checkPermission` nahi:

- `discounts` router (poora)
- `tags` router
- `categories/admin/all`
- `brands/next-code`, `vendors/next-code`, `purchase-orders/next-code`
- `store GET /`
- `dashboard/stats`

- Kuch jagah ye intentional ho sakta hai, lekin intended permission matrix ke against confirm
  karna chahiye (staff ko discounts/tags edit karne se rokna hai ya nahi?).

## 2. Architecture observations

- **Zustand dependency** `package.json` me hai lekin code me kahin use nahi hota. State =
  TanStack Query + Redux (sirf `storeInfo`) + React Context.
- **`DiscountContext.js`** naam context jaisa hai lekin actually hook (`useDiscounts`) export karta hai.
- **`frontend/src/app/seller/`** folder khali hai; seller signup `/landing/signup` par hai.
- **`utils/logger.js`** jaan boojh kar no-op hai. Debug ke liye `console.*` temporarily use karo.
- **`Order` pricing** frontend item snapshot par trust karta hai (server price recalculate nahi karta).
  Security/integrity ke liye server-side price validation consider karo.
- **`Address` model** tenant-scoped nahi hai (sirf `user_id`). Agar addresses store-specific
  chahiye to `tenantScope` add karna padega.
- **`Wishlist`** one-doc-per-user index se enforce nahi hota.
- **`ShippingConfig`** singleton per store index se enforce nahi hota (race possible).
- Bade admin pages single files me hain (e.g. `admin/products/page.js` ~1951 lines,
  `admin/categories/page.js` ~1974 lines). Maintainability ke liye components me split karna behtar.

## 3. Security notes (already implemented — verify karo)

- HttpOnly cookies + store binding + refresh rotation + reuse detection ✅
- `x-store-host` sirf `INTERNAL_PROXY_SECRET` ke saath ✅
- KYC documents sirf super-admin ✅
- Upload path traversal + cross-store delete guards ✅
- Pending seller read-only mode ✅
- Socket fresh permission checks ✅

**Dhyan rakho:**
- `.env` files me real secrets hain — inhe git me commit na karo (`.gitignore` verify karo).
- Production me 6 JWT secrets alag aur random hone chahiye.
- `TRUST_PROXY` sirf trusted proxy ke peeche set karo.
- Rate-limit whitelist IPs (`RATE_LIMIT_WHITELIST_IPS`) carefully rakho.

## 4. Data / consistency suggestions

- Order create par server-side totals recompute (discounts/loyalty/deals) — client trust kam karo.
- `estimatedDocumentCount` store context me mana hai (achi baat) — `countDocuments` use karo.
- Cross-store queries ke liye hamesha `.setOptions({ skipTenantScope: true })` — accidental
  cross-store leak se bacho.
- Naya store-owned model banate waqt **`schema.plugin(tenantScope)` zaroor** lagao, warna data leak.

## 5. Naya feature add karte waqt checklist

Backend:
1. Model banao → `schema.plugin(tenantScope)` + compound unique index `{storeId, ...}`.
2. `scripts/migrateTenantIndexes.js` me register karo (agar index change).
3. Route banao → `requireAdmin`/`requireUser` + `checkPermission(...)`.
4. Controller me public cache invalidate + translation queue (agar content).
5. Socket event chahiye to `req.io.emit` (tenant-aware) use karo.

Frontend:
1. `apis/<aud>/<name>Api.js` banao.
2. `hooks/<aud>/use*` (TanStack Query).
3. Socket sync hook (agar realtime).
4. `lib/adminModules.js` me module add karo (sidebar + plan).
5. i18n keys `en.json` + baaki locales me add karo.

## 6. Test gaps (optional improvements)

Maujooda tests achi coverage dete hain (tenant isolation, auth, loyalty, uploads, socket auth).
Consider adding:

- `createUser` / registration regression test (bug ke baad).
- Order create totals validation test.
- Invoice return edge cases.
- POS return/edit rollback.
- Permission matrix tests (har module ka expected gate).

## 7. Documentation maintenance

- Ye docs analysis date par based hain. Code change hone par relevant file update karo.
- Authoritative sources:
  - Routes/endpoints → `backend/routes/*.js`
  - Models → `backend/models/*.js`
  - Tenant logic → `middleware/resolveStore.js`, `utils/tenantScopePlugin.js`
  - Frontend routing → `frontend/src/proxy.js`, `src/lib/tenantHost.js`
