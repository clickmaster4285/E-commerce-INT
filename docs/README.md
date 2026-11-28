# Ecommerce Platform â€” Complete Documentation

Ye folder is project ki **complete technical documentation** hai. Yahan bataya gaya hai ke
project kya hai, kaise kaam karta hai, konsa module kya karta hai, aur data kaise flow hota hai.

> Note: Code ke comments zyada tar Roman Urdu/Hindi me hain. Ye docs bhi usi style me likhe
> gaye hain taake team ke liye natural lage.

---

## 1. Project ek nazar me

Ye ek **multi-tenant (multi-store) e-commerce platform** hai. Ek hi deployment par bohat saare
stores chalte hain. Konsa store khulna hai, ye **Host header** (URL ka domain) se decide hota hai.

- **Platform host** (root domain): landing page, seller signup, store setup, super-admin panel.
- **Store host** (`<subdomain>.<root>` ya custom domain): us store ka storefront + `/admin` panel.

Tech stack:

| Layer | Technology |
|---|---|
| Backend | Node.js, Express 5, Mongoose 9 (MongoDB), CommonJS |
| Realtime | Socket.IO (tenant-aware rooms) |
| Cache / Rate-limit | Redis (optional, `REDIS_URL`), warna in-memory |
| Email | Nodemailer + SMTP (OTP, seller notifications) |
| Images | Sharp â†’ WebP compression |
| Frontend | Next.js 16 (App Router, plain JS), React 19 |
| UI | Tailwind 4, shadcn/radix, lucide-react, framer-motion |
| Data (client) | TanStack Query + Redux Toolkit + React Context |
| i18n | Custom JSON dictionaries (`src/i18n/locales/*.json`), `lang` cookie |
| Auth | JWT (3 audiences), HttpOnly cookies, refresh-token rotation |

> Project me do alag npm projects hain: `backend/` aur `frontend/`. Root par `package.json` nahi.
> Har command apne folder ke andar se chalao.

---

## 2. Documentation map

| File | Kya cover karta hai |
|---|---|
| [01-architecture.md](01-architecture.md) | Big picture, request lifecycle, host routing |
| [02-backend.md](02-backend.md) | Backend folder structure, startup, middleware, routes |
| [03-frontend.md](03-frontend.md) | Next.js app router, components, state, hooks, i18n |
| [04-multi-tenancy.md](04-multi-tenancy.md) | Tenant context, scope plugin, uploads, socket rooms, handoff |
| [05-auth-security.md](05-auth-security.md) | Tokens, sessions, OTP, Google, seller flow, permissions, rate-limit |
| [06-models.md](06-models.md) | Saare Mongoose models ka reference |
| [07-api-reference.md](07-api-reference.md) | Har module ke endpoints |
| [08-features.md](08-features.md) | Translation, email, loyalty, referral, POS, finance, invoices, quotes, PO, chat |
| [09-configuration-and-ops.md](09-configuration-and-ops.md) | Env vars, commands, production checklist, scripts, tests |
| [10-notes-and-issues.md](10-notes-and-issues.md) | Jo bugs/gaps mile, observations aur suggestions |`n| [11-controllers.md](11-controllers.md) | Har controller ka function-by-function reference |`n| [12-routes.md](12-routes.md) | Har endpoint (method + path + handler + middleware) |`n| [13-models.md](13-models.md) | Har Mongoose model ka schema field reference |`n| [14-referral-system.md](14-referral-system.md) | Referral system complete guide (files, flow, APIs) |`n| [15-otp-system.md](15-otp-system.md) | OTP system complete guide (email verification + password reset) |`n| [16-server-js.md](16-server-js.md) | server.js entry point complete guide (startup, middleware, routes, seeding) |`n| [17-postman-testing.md](17-postman-testing.md) | Postman testing guide + `postman_collection.json` (317 requests) |
| [18-admin-referrals-redesign.md](18-admin-referrals-redesign.md) | Admin referral two-page redesign, related signup/reward/sidebar changes, controller aur file-by-file guide |
| [19-rewards-visibility.md](19-rewards-visibility.md) | Rewards/Referrals off switch — header badge, account menu, referral pages aur popups ki visibility, files aur flow |

---

## 3. Quick start

Backend:
```powershell
cd backend
# backend/.env banao (dekho 09-configuration-and-ops.md)
npm install
npm run dev        # nodemon server.js
```

Frontend:
```powershell
cd frontend
# frontend/.env banao
npm install
npm run dev        # next dev --webpack
```

Zaroori: `.env` values ke baghair server start nahi hota / API fail hoti hai. Koi hard-coded
fallback nahi hai. Details `09-configuration-and-ops.md` me.

---

## 4. High-level flow (ek line me)

```
Browser â†’ Host header â†’ Next proxy.js (tenant) â†’ page render
   â†’ API call (same hostname, backend port) â†’ resolveStore middleware
   â†’ runWithStore(storeId) â†’ tenantScope plugin (auto storeId filter)
   â†’ controller â†’ Mongo/Socket/Email â†’ response
```

Har request par store automatically resolve hota hai aur uske baad saari DB queries khud
`storeId` se filter ho jati hain â€” controllers ko manually kuch nahi karna padta.





