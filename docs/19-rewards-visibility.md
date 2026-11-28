# 19 - Rewards Visibility (admin off switch)

Ye doc batata hai ke jab admin **Rewards** ya **Referrals** band karta hai to storefront par
reward-related UI kaise chhup jati hai, ye kis file me hai, aur kaise kaam karta hai.

---

## 1. Purpose / kyun banaya

Pehle admin se program band karne par bhi:
- header me points badge (e.g. `100`) dikhta reh jata tha,
- account sidebar me **Rewards** aur **Refer a Friend** rehte the,
- referral page / setup page direct URL se khul jate the.

Ab **Rewards master switch off** ho to reward UI mukammal chhup jati hai — header, account menu,
reward popups, aur referral entry sab. Isse customer ko aisi cheez nazar nahi aati jo admin ne
band ki ho.

> Note: Backend logic me koi tabdeeli nahi ki gayi. Sirf frontend visibility gate hui hai.

---

## 2. Source of truth (admin switches)

Do alag per-store settings hain:

| Concept | Model | Field | Admin endpoint |
|---|---|---|---|
| Rewards / loyalty master switch | `backend/models/LoyaltySettings.js` | `enabled` | `PUT /loyalty/admin/settings` |
| Referral program switch | `backend/models/ReferralProgram.js` | `enabled` | `PUT /loyalty/admin/referrals` |

Customer-side status in endpoints se aata hai:

| Endpoint | Kya deta hai |
|---|---|
| `GET /loyalty/program` | `enabled`, earn/signup/redeem rules (public) |
| `GET /loyalty/me` | `program.enabled` + account balance + transactions |
| `GET /loyalty/referrals/me` | referral `enabled`, code, shareUrl, stats |

---

## 3. Visibility rules

`rewardsEnabled` = loyalty program `enabled`
`referralEnabled` = `rewardsEnabled && referral program enabled`

| State | Header badge | Header drawer Rewards tile | Account "Rewards" | Account "Refer a Friend" | `/referrals` page | Reward popup | Signup → referral setup |
|---|---|---|---|---|---|---|---|
| Rewards OFF | hidden | hidden | hidden | hidden | off state | hidden | nahi |
| Rewards ON, Referrals OFF | shown | shown | shown | hidden | off state | signup only | nahi |
| Rewards ON, Referrals ON | shown | shown | shown | shown | shown | signup + referral | haan |

Key point: **Refer a Friend tab master Rewards switch ke bina kabhi nahi dikhta.** Rewards off
hone par referral points credit ho jate hain lekin UI me kuch nazar nahi aata.

---

## 4. How it works (flow)

1. Admin admin panel se switch off karta hai → `LoyaltySettings.enabled = false` /
   `ReferralProgram.enabled = false`.
2. Frontend public endpoint `GET /loyalty/program` (ya logged-in `GET /loyalty/me`) se
   `enabled` parhta hai. TanStack Query cache keys:
   - `["loyaltyProgram"]` — public program rules
   - `["myRewards", "header"]` — header badge balance + program flag
   - `["my-referrals"]` — referral status/summary
3. Components isi flag se apni entry point hide karte hain:
   - `Header` badge/tile `rewardsEnabled` par.
   - `account/page.js` sidebar items `rewardsEnabled` / `referralEnabled` par.
   - Hidden tab par direct aane wala user (`?tab=rewards` / `?tab=referrals`) `activeTab`
     ke zariye **Profile** par fallback hota hai aur URL bhi `?tab=profile` ho jata hai.
4. `ReferralProgramView` bhi loyalty flag check karta hai, is liye direct `/referrals`
   ya `/referrals/setup` khule to off-state dikhta hai.
5. Signup ke baad referral setup par redirect sirf tab hota hai jab dono programs on hon.

Stale data se bachne ke liye caches chhoti hain (`staleTime` 60s for program/header, 5min
product/login). Admin toggle ke baad customer ko maximum ~1 minute me naya state dikhta hai
(hard reload par foran).

---

## 5. Files banayi / badli

### Naya file

| File | Purpose |
|---|---|
| `frontend/src/hooks/user/useRewardPrograms.js` | Shared hook. `GET /loyalty/program` + `GET /loyalty/referrals/me` se `rewardsEnabled`, `referralEnabled`, `isLoading` deta hai. Referral query sirf tab chalti hai jab rewards on ho aur user logged-in ho. |

### Modified files

| File | Kya change hua |
|---|---|
| `frontend/src/components/user/Header.js` | Badge ab sirf `program.enabled` par dikhta hai (pehle `balance > 0` par bhi dikhta tha). Mobile drawer ka **Rewards** tile `rewardsEnabled` par wrap hai. |
| `frontend/src/app/(user)/account/page.js` | `useRewardPrograms` se sidebar `NAV_ITEMS` filter hote hain. `SidebarNav` / `MobileMenu` ko `items` prop pass hota hai. Hidden tab `activeTab = "profile"` par fallback + URL replace. Rewards/referral view render bhi flag par guarded. |
| `frontend/src/components/user/ReferralProgramView.js` | `programOn` ab `loyaltyEnabled && referralEnabled` hai. Loading state dono queries ko cover karti hai, is liye off-state flash nahi hoti. |
| `frontend/src/components/user/WelcomeRewardModal.js` | Signup aur referral reward popups dono `program.enabled` par gated hain. |
| `frontend/src/app/login/page.js` | Signup ke baad `/referrals/setup` redirect sirf tab jab referral **aur** rewards dono enabled hon. |
| `frontend/src/components/user/LoginModal.js` | Wahi redirect guard modal login/OTP flow me. |

### Backend

Koi change nahi. `LoyaltySettings` aur `ReferralProgram` models aur unke admin/customer
endpoints pehle se maujood hain aur source of truth hain.

---

## 6. Testing checklist

1. Admin → Rewards (`/admin/loyalty`) → program switch **OFF** → Save.
2. Customer storefront hard reload karo:
   - header me points badge nahi hona chahiye,
   - mobile drawer me Rewards tile nahi hona chahiye.
3. Customer `/account` kholo:
   - sidebar me **Rewards** aur **Refer a Friend** nahi hone chahiye,
   - direct `/account?tab=rewards` kholo → Profile khule aur URL `?tab=profile` ho jaye.
4. `/referrals` aur `/referrals/setup` direct kholo → off-state dikhe.
5. Admin se Rewards ON + Referrals ON karo → dono entries wapas aa jayen.
6. Rewards ON + Referrals OFF → sirf **Refer a Friend** ghayab ho, baqi rewards normal chale.
