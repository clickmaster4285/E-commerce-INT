# 14 — Referral System (complete guide)

Referral = customer apna link share kare → friend signup + email verify → dono ko points.
Plus: delivered order par referrer ko bonus points (sale referral). Admin program settings.

---

## 1. Files involved

### Backend
| File | Role |
|---|---|
| `backend/utils/referralService.js` | Core logic: code generation, signup processing, summary, sale rewards, reverse/restore |
| `backend/controllers/referralController.js` | HTTP handlers: `getMine`, `getAdmin`, `saveAdmin` |
| `backend/controllers/userController.js` | Google signup calls `processSignupReferral` + `ensureReferralCode` (line ~1187-1194) |
| `backend/controllers/otpController.js` | Email-OTP signup calls same after `User.create` (line ~409-416) |
| `backend/utils/loyaltyService.js` | `onOrderStatusChange` / `onOrderDeleted` call `rewardReferralSale` / `reverseReferralSale` / `restoreReferralSale` |
| `backend/models/User.js` | `referralCode` (unique per store), `referredByCode` |
| `backend/models/Referral.js` | Referral record (referrer, referred, code, points, status) |
| `backend/models/ReferralProgram.js` | Per-store program settings (enabled, points, headline, saleReferrerPoints) |
| `backend/routes/loyaltyRoutes.js` | `/loyalty/referrals/me`, `/loyalty/admin/referrals` (GET/PUT) |
| `backend/test/referralModels.test.js` | Model/service tests |

### Frontend
| File | Role |
|---|---|
| `frontend/src/app/(user)/referrals/page.js` | Customer referral page |
| `frontend/src/app/(user)/referrals/setup/page.js` | Onboarding setup view |
| `frontend/src/components/user/ReferralProgramView.js` | Main UI (share link, copy, stats) |
| `frontend/src/components/user/WelcomeRewardModal.js` | Welcome modal CTA → `/referrals/setup` |
| `frontend/src/app/login/page.js` | Reads `?ref=` query → `referralCode` on register/Google login |
| `frontend/src/components/user/LoginModal.js` | Same `?ref=` handling |
| `frontend/src/app/admin/referrals/page.js` | Admin program settings + stats |
| `frontend/src/apis/user/loyaltyApi.js` | `referrals()` → GET `/loyalty/referrals/me` |
| `frontend/src/apis/admin/loyaltyApi.js` | `referrals()` / `saveReferrals()` |
| `frontend/src/lib/adminModules.js` | Nav entry "Referrals" (permissionKey: loyalty) |

---

## 2. Data model

### User (relevant fields)
- `referralCode`: String, uppercase, unique per store `{storeId, referralCode}` partial index.
- `referredByCode`: String, uppercase, default "" — stores the code used at signup (for lazy processing).

### Referral
```
referrerId, referredUserId, referralCode,
referrerPoints, friendPoints,
status: "pending" | "rewarded" | "ineligible"
storeId, created_at, updated_at
```
Unique index: `{storeId, referredUserId}` (one referral per referred user per store).

### ReferralProgram (one per store)
```
enabled, referrerPoints, friendPoints, saleReferrerPoints, headline
storeId (unique)
```

---

## 3. End-to-end flow

### A. Friend gets link
1. Customer opens `/referrals` → `loyaltyApi.referrals()` → `GET /loyalty/referrals/me`.
2. `getReferralSummary(user)`:
   - If `user.referredByCode` present → `processSignupReferral` (lazy).
   - `rewardPendingReferrals(user._id)` (catch-up).
   - `ensureReferralCode(user)` → generates random 10-char hex uppercase code if missing (retry 4x on collision).
   - Builds `shareUrl`: `http(s)://<subdomain>.<ROOT_DOMAIN>[:port]/login?mode=register&ref=<CODE>`.
3. UI shows link + copy button + stats (successful referrals, points earned, recent).

### B. Friend signs up via link
1. Friend opens link → `/login?mode=register&ref=CODE`.
2. `login/page.js` / `LoginModal.js` read `ref` query → `referralCode`.
3. On register submit → `POST /users/register` with `referralCode` (OTP flow) OR `POST /users/google-customer-login` with `referralCode`.
4. **OTP flow** (`otpController`): creates `PendingRegistration` with `referralCode`; on OTP verify creates `User` with `referredByCode = referralCode`; calls `processSignupReferral(customer, referralCode)` + `ensureReferralCode`.
5. **Google flow** (`userController.googleCustomerLogin`): creates `User` with `referredByCode`; calls `processSignupReferral` + `ensureReferralCode`.

### C. processSignupReferral (the core)
```
- normalize code, check storeId
- find referrer User by referralCode (role user, not deleted); reject self
- read ReferralProgram → enabled? points (0 if disabled)
- create Referral doc (status "pending" if enabled else "ineligible")
  - duplicate referredUserId → 11000 → reuse existing; if not pending return
- if pending:
    credit referrer (type "referral", sourceKey referral:<id>:referrer)
    credit friend   (type "referral", sourceKey referral:<id>:friend)
    status → "rewarded"
```
Idempotent via unique index + status guard + sourceKey dedup in loyalty credit.

### D. Sale referral (delivered order)
1. Admin changes order status → `delivered` → `loyaltyService.onOrderStatusChange`.
2. `rewardReferralSale(order)`:
   - order must be delivered, has user_id, storeId present
   - find Referral where `referredUserId == order.user_id` and status "rewarded"
   - if program enabled and saleReferrerPoints > 0 → credit referrer (sourceKey `referral-sale:<order._id>:referrer`)
3. On cancel → `reverseReferralSale` → reverses available credit.
4. On restore → `restoreReferralSale` (if already reversed) else re-reward.

### E. Admin management
- `/admin/referrals` page → `loyaltyApi.referrals()` → `GET /loyalty/admin/referrals` → `referralController.getAdmin`:
  - program settings + stats (total/rewarded/pending/saleRewards/saleRewardPoints) + recent referrals + recent sale rewards.
- Save → `PUT /loyalty/admin/referrals` → `saveAdmin` (validates 0..1,000,000 points, headline 5..100 chars).

---

## 4. APIs

| Method | Path | Handler | Auth |
|---|---|---|---|
| GET | `/loyalty/referrals/me` | referralController.getMine | user |
| GET | `/loyalty/admin/referrals` | referralController.getAdmin | admin + perm(loyalty) |
| PUT | `/loyalty/admin/referrals` | referralController.saveAdmin | admin + perm(loyalty) |

---

## 5. Key logic & guards
- Code generation: `crypto.randomBytes(5).toString("hex").toUpperCase()` = 10 hex chars.
- Uniqueness: retry 4 attempts; DB unique index `{storeId, referralCode}` catches collisions.
- Self-referral blocked (`referrer._id === user._id`).
- One referral per referred user per store (unique index).
- Points only credited when program enabled; otherwise status "ineligible" (no credit).
- `rewardPendingReferrals` catches up missed credits (e.g. program enabled later).
- Sale reward only for delivered orders of referred users.
- Reverse/restore use sourceKey for idempotency.

---

## 6. Frontend user flow
- `/login?mode=register&ref=CODE` → referralCode state → passed to register/google login.
- After signup + email verify → customer can open `/referrals` or `/referrals/setup`.
- `ReferralProgramView` shows link, copy button, enabled/disabled banner, stats.
- `WelcomeRewardModal` CTA → `/referrals/setup`.
- Visibility: rewards master switc off hho to account menu se Refer a Friend hat jata hai aur
  `/referrals` off-state dikhata hai — dekho [19-rewards-visibility.md](19-rewards-visibility.md).

## 7. Admin flow
- Sidebar → Sales → Referrals (`/admin/referrals`).
- Toggle enable, set referrerPoints, friendPoints, saleReferrerPoints, headline.
- Stats: total referrals, rewarded, pending, sale rewards count + points.
- Recent referrals list + recent sale rewards.

---

## 8. Tests
- `backend/test/referralModels.test.js`: code format, program defaults, model validation, loyalty transaction type enum "referral".

## 9. Known issues / notes
- Normal email/password `createUser` (userController) is currently broken by `return res.send(referralCode)` at line ~168 → referral signup via OTP path still works through otpController (PendingRegistration). Google signup works.
- `ReferralProgram` has no `tenantScope`? It does (scoped) — one program per store.
- Sale referral points only credit referrer (not friend).
- `getReferralSummary` lazily processes `referredByCode` — if missed at signup, first `/referrals/me` call repairs.
