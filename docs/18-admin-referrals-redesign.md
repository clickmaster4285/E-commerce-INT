# 18 — Admin Referral Redesign & Related Session Changes

Ye document un changes ko record karta hai jo referral feature, customer signup flow, sidebar theme aur admin referral pages me kiye gaye. Roman Urdu me likha gaya hai taake existing docs (`docs/README.md`) ke style se match kare.

---

## 1. Execution summary

| Area | Kya hua |
|---|---|
| Admin referral UI | Ek page ko do pages me split kiya gaya: overview (`/admin/referrals`) aur settings (`/admin/referrals/settings`) |
| Data/API | Koi naya endpoint nahi. Existing `GET/PUT /loyalty/admin/referrals` hi use hote hain |
| Validation | Backend validation bilkul waisi rakhi gayi (points `0..1,000,000`, headline `5..100`) |
| Referral business logic | `referralService.js` / `loyaltyService.js` me koi change nahi |
| New customer flow | Verify ya Google signup ke baad referral program on ho to customer `/referrals/setup` par jata hai |
| Rewards off + referral on | Customer ko referral points dikhte hain aur popup bhi claim flow ke saath aata hai |
| Sidebar | Super-admin jaisa dark navy theme admin sidebar par; parent ko double highlight nahi |
| Theme | Light/dark dono mode global CSS tokens se chalte hain; nayi files me hardcoded hex/rgb nahi |

---

## 2. New files

| File | Kya karta hai |
|---|---|
| `frontend/src/app/admin/referrals/settings/page.js` | Naya **Program settings** route. Existing settings UI (headline, signup rewards, completed-sale reward, How it works, At a glance, Save/Discard) yahan move kiya gaya. Back link, two-column layout, sticky footer action bar, saving spinner, success/error toast aur unsaved-changes guard bhi isi file me hai. |
| `frontend/src/app/admin/referrals/_components/ui.js` | Referral pages ke liye chhota local UI kit: `Card`, `CardHead`, `Pill`, `Avatar`, `EmptyRow`, `SearchInput`, `SelectInput`, `TableSkeleton`, `TableError`, `TablePager`, `Explain`, `SettingSection`, `RewardField`, `Switch` aur table class constants. Sab colors CSS variables se aate hain. `formatNumber`, `formatDate`, `initials` helpers bhi yahin hain. |
| `docs/18-admin-referrals-redesign.md` | Ye documentation file. |

---

## 3. Modified files (jo kaam in files me hua)

| File | Kya change hua |
|---|---|
| `frontend/src/app/admin/referrals/page.js` | Purana combined page ab **overview** page hai. Isme header (status badge + `Program settings` button), 4 stat cards, searchable/filterable **Recent referrals** table aur status-filter wali **Recent sale rewards** table hai. Skeleto loaders, error + Retry, empty states, "Showing x–y of z" footer pagination aur mobile par horizontal table scroll bhi yahin hai. Button label ek constant `SETTINGS_ACTION_KEY` se aata hai. |
| `frontend/src/app/admin/referrals/settings/page.js` | Naya route (upar new files me detail). |
| `frontend/src/app/admin/referrals/_components/ui.js` | Naya local UI kit (upar detail). |
| `frontend/src/app/globals.css` | (a) `.admin-panel` scope me aliases add kiye gaye: `--primary`, `--card`, `--background`, `--border`, `--foreground`, `--muted`, `--muted-foreground`, `--ring` — ye existing admin tokens (`--accent`, `--bg-card`, `--bg-primary`, `--border-color`, `--text-primary`, `--bg-tertiary`, `--text-muted`) ko reference karte hain. Is se nayi files shadcn-style names use kar sakti hain aur dark mode automatically follow hota hai. (b) Admin sidebar ke dark-navy tokens aur dark-mode overrides bhi isi file me the. (c) Focus ring sirf `--ring` se. |
| `frontend/src/i18n/locales/en.json` | `admin.referrals.*` keys add kiye gaye (page, stats, tables, filters, settings, save bar, toasts, leave confirm). English fallback hai; baaki locales automatically fallback karte hain. |
| `backend/controllers/referralController.js` | `getAdmin` ke `recentSales` mapping me `order.id` add kiya gaya (`row.order_id._id`). Is se overview page par Order column `/admin/orders/[id]` ka link bana saka. Baaki response waisa hi rakha gaya. |
| `frontend/src/components/user/Header.js` | Rewards program off ho aur balance > 0 ho to bhi header coin badge dikhta hai (`select` me `balance > 0` condition). Pehle badge hide ho jata tha. |
| `frontend/src/components/user/RewardsView.js` | Program off par bhi points aur transaction history dikhate hain. Redeem/earn rules sirf tab dikhne dete hain jab program on ho. `rewards.type.referral` ke liye `Users` icon add kiya. |
| `frontend/src/components/user/WelcomeRewardModal.js` | Referral points ka bhi existing jaisa **"You got X → Claim"** popup dikhata hai. Referral mode me server `claimWelcome` call nahi hota (points pehle se credited hote hain), lekin UI claim animation + success screen same rakha gaya. |
| `frontend/src/app/login/page.js` | Email OTP verify aur Google signup ke baad `loyaltyApi.referrals()` check karta hai. Referral program enabled ho to `/referrals/setup` par bhejta hai, warna `/` par. |
| `frontend/src/components/user/LoginModal.js` | Header modal se register/verify aur Google signup ke baad bhi yahi referral-on check + `router.push("/referrals/setup")` logic. |
| `frontend/src/apis/user/authApi.js` | Register par hard-coded `timeout: 15000` hata diya gaya (timeout error yahin se aata tha). `getApiErrorMessage` me timeout/network ke liye friendly messages add kiye. |
| `backend/controllers/customerAuthController.js` | Google login response me `isNewUser` add kiya gaya (`const isNewUser = !user` se). Frontend isi flag se sirf naye user ko referral setup page par bhejta hai; purana userlogin par normal flow rakhta hai. |
| `frontend/src/components/adminComponents/Sidebar.js` | Super-admin style dark navy theme (flat surface, rgba-white hover/border, soft active fill, indigo indicator bar). Parent section ka active fill hata diya gaya taake double highlight na ho; child item hi active dikhta hai. |
| `frontend/src/app/admin/AdminLayoutClient.js` | Mobile overlay/visibility ke `md` breakpoints `lg` kiye gaye aur overlay color token se aata hai. |
| `frontend/src/components/adminComponents/AdminPageHeader.js` | existing shared header reuse kiya gaya; title 24px/600 ke liye `titleClassName="!font-semibold"` pass kiya gaya. |

---

## 4. Controllers — exact changes

### `backend/controllers/customerAuthController.js`
- `googleCustomerLogin` me user lookup ke turant baad `const isNewUser = !user;` rakha gaya.
- Response JSON me `isNewUser` field add kiya gaya.
- Kisi bhi validation ya token/session logic ko touch nahi kiya gaya. Ye sirf frontend ko ye batata hai ke user naya ban gaya ya existing login hua.

### `backend/controllers/referralController.js`
- `exports.getAdmin` ke `recentSales` map me `id: row.order_id._id` add kiya gaya.
- Is ke alava `settings`, `stats`, `recent` aur saare pehle wale fields waise hi hain.
- `exports.saveAdmin` (validation + `ReferralProgram.findOneAndUpdate`) bilkul unchanged hai.

### Controllers jinhe **change nahi** kiya gaya
- `backend/utils/referralService.js` (`processSignupReferral`, `getReferralSummary`, `rewardReferralSale`, reverse/restore)
- `backend/utils/loyaltyService.js` (`credit`, signup bonus, order earn/redeem)
- `backend/controllers/otpController.js`
- `backend/controllers/loyaltyController.js`

Matlab: points credit hona, idempotency, enabled flags aur sale reward rules wahi hain.

---

## 5. API/data flow

### Admin dono pages ek hi query use karti hain
```
loyaltyApi.referrals()  →  GET /loyalty/admin/referrals
queryKey: ["admin-referrals"]
```

- `/admin/referrals` is query se `stats`, `recent`, `recentSales` aur `settings.enabled` / `settings.saleReferrerPoints` padhta hai.
- `/admin/referrals/settings` usi query ke `settings` ko draft me load karta hai.
- Save:
```
loyaltyApi.saveReferrals(values)  →  PUT /loyalty/admin/referrals
```
Backend validation wahi hai: `referrerPoints`, `friendPoints`, `saleReferrerPoints` integer `0..1,000,000`; `headline` `5..100` chars. Save ke baad `setQueryData` + `invalidateQueries` dono pages ko update rakhte hain.

### Customer signup → referral setup
```
/login?mode=register&ref=CODE
  → POST /users/register  (OTP)  OR  POST /users/google-customer-login
  → verify OTP / Google session
  → GET /loyalty/referrals/me   (loyaltyApi.referrals)
  → data.enabled === true  →  /referrals/setup
  → false / API error     →  /
```
`isNewUser` sirf Google flow me check hota hai taake purana customer har login par setup page par na jaye.

### Rewards off + referral on
- `credit()` loyalty program ke `enabled` flag ko check nahi karta; sirf `ReferralProgram.enabled` referral credit ko gate karta hai.
- Isliye referral points DB me credit hote hain chahe Rewards program off ho.
- Pehle UI un points ko chhupa deta tha; ab header badge, RewardsView aur popup unhe dikhate hain.

---

## 6. Page 1 — `/admin/referrals` detail

- **Header:** title/subtitle, status badge (`Program enabled` / `Program disabled`), primary `Program settings` button → `/admin/referrals/settings`. Label ek constant me hai (`SETTINGS_ACTION_KEY`), agar "Create" likhna ho to sirf yahi badlega.
- **Stats:** Total referrals (`x rewarded · y pending`), Signup rewards issued, Awaiting verification, Sale reward points issued. 1/2/4 column responsive grid.
- **Recent referrals:** search (customer/referrer name ya email), status filter (All, Pending, Verified, Rewarded), columns: Invited customer, Invited by, Status, Signup reward, Date. Empty state + pagination.
- **Recent sale rewards:** status filter (All, Credited, Reversed), columns: Order (link), Inviter, Referred customer, Order total, Points credited, Status, Date. Empty state + pagination.
- **Sale off banner:** agar `saleReferrerPoints === 0`, card ke upar info banner + settings link.
- **Table style:** header muted bg + 12px uppercase tracking, rows 56px, bottom border `var(--border)`, hover `color-mix(...)`, status pills soft tinted. Mobile par table apne card me horizontally scroll karti hai, page sideways scroll nahi karta.
- **Loading/error:** `TableSkeleton`, `TableError` + Retry button.

---

## 7. Page 2 — `/admin/referrals/settings` detail

- Back link: `← Referral program` → `/admin/referrals`.
- Two-column desktop layout (`minmax(0,2fr)` form + `minmax(280px,1fr)` sidebar), mobile par single column.
- Left card:
  1. Customer-facing headline: input (max 100), counter `x/100`, live preview gradient (`--primary`).
  2. Signup rewards: Inviter reward + New customer reward number inputs, "points" suffix, summary line.
  3. Completed-sale reward: inviter reward per delivered order input; `0` par amber warning.
- Right column (sticky `top: 24px`): How it works (3 steps) + At a glance (status, inviter signup, friend signup, per delivered order).
- Footer: sticky action bar — saved/unsaved indicator, Discard, Save settings (disabled jab tak dirty na ho), spinner while saving, success toast.
- Unsaved guard: `beforeunload` + internal anchor click par `window.confirm`. Save ke baad draft clear ho jata hai, isliye navigation block nahi hota.
- Save ke baad page par hi rehta hai (purana behavior preserved), toast dikh jata hai.

---

## 8. Sidebar

- Koi nayi sidebar change is redesign me nahi ki gayi.
- `adminModules.js` me "Referrals" entry ka path `/admin/referrals` hai.
- Sidebar active check `pathname.startsWith(item.path)` ki wajah se `/admin/referrals/settings` bhi **Referrals** ko active rakhta hai.
- Parent section highlight isliye hata diya gaya tha taake active child + active parent ka double highlight na dikhe.

---

## 9. Operational note (DB)

Registration ka "Network error" code issue nahi tha. Browser host `hamzastoreee.192.168.88.53.nip.io` tha, lekin DB me store `hamzastoree` tha. Store subdomain (aur store_name) ko `hamzastoreee` kiya gaya (store id `6b09586509b7b18296e83a24`). Backend resolve cache 60 sec ka hai, isliye thodi der baad verify kiya gaya:
- `GET /store/resolve` → `found: true`
- `POST /users/register/check` → `200`

Ye DB change file me track nahi hota; environment ka data fix hai.

---

## 10. Verification

| Check | Result |
|---|---|
| `npx eslint src/app/admin/referrals` | Pass |
| `npm run build` (frontend) | Pass; `.next/server/app-paths-manifest.json` me dono routes hain |
| `npm test` (backend) | 134/134 pass |
| New files me hex/rgb literals | Nahi mile (sirf CSS variables/color-mix) |
| i18n keys | `t()` se use hone wale saare `admin.referrals.*` keys `en.json` me maujood hain |

> Repo-wide lint me pehle se maujood errors hain (un related files me). Is task ki files par lint clean hai.

> Site `next start` (production build) se chal rahi hai. Naye routes/design dikhne ke liye build ke baad server restart zaroori hai.
