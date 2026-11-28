# 09 — Configuration & Operations

## 1. Commands

### Backend (`cd backend`)
| Command | Kaam |
|---|---|
| `npm run dev` | nodemon server.js |
| `npm start` | node server.js |
| `npm test` | node --test (all test/) |
| `node --test test/chatModels.test.js` | ek file |
| `node --test --test-name-pattern="partial unique" test/` | naam se filter |
| `node scripts/migrateTenantIndexes.js` | index migration (dry run; `--apply`) |
| `node scripts/migrateAttributesPerStore.js --apply` | legacy attributes → per store |
| `npm run backfillSubdomains` | subdomain backfill |
| `npm run backfill:translations` | translation backfill |
| `npm run translation:check` | translation preflight |
| `npm run argos:serve` | local translation server |

### Frontend (`cd frontend`)
| Command | Kaam |
|---|---|
| `npm run dev` | next dev --webpack |
| `npm run build` | production build |
| `npm start` | production server |
| `npm run lint` | ESLint 9 |

## 2. Backend env variables (`backend/.env`)

> Secrets ko repo/commit me kabhi na daalo. Values sirf `.env` me.

### Core
`NODE_ENV`, `HOST`, `PORT`, `API_PREFIX`, `TRUST_PROXY`, `SERVER_STARTUP_MESSAGE`,
`CLIENT_URL`, `ALLOWED_ORIGINS`, `AUTH_COOKIE_SAME_SITE`, `ROOT_DOMAIN`, `PUBLIC_STORE_PROTOCOL`,
`PUBLIC_STORE_PORT`, `PLATFORM_NAME`, `PLATFORM_SUPPORT_EMAIL`.

### Database / cache
`MONGO_URI`, `REDIS_URL` (optional), `BCRYPT_SALT_ROUNDS`.

### JWT / auth
`JWT_SECRET` (short-lived purpose tokens: handoff/reset/setup),
`JWT_ACCESS_TOKEN_EXPIREE_MINUTES`, `JWT_REFRESH_TOKEN_EXPIREE_DAYS`,
`JWT_USER_ACCESS_TOKEN_EXPIREE_DAYS`,
`JWT_USER_ACCESS_SECRET`, `JWT_USER_REFRESH_SECRET`,
`JWT_ADMIN_ACCESS_SECRET`, `JWT_ADMIN_REFRESH_SECRET`,
`JWT_SA_ACCESS_SECRET`, `JWT_SA_REFRESH_SECRET`,
`INTERNAL_PROXY_SECRET`, `GOOGLE_CLIENT_ID`.

### Super admin seed
`SUPER_ADMIN_NAME`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_MIN_PASSWORD_LENGTH`.

### Email / OTP
`EMAIL_USER`, `EMAIL_PASS` (ya `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_SECURE`),
`OTP_LENGTH`, `EMAIL_OTP_EXPIRE_MINUTES`, `EMAIL_OTP_MAX_ATTEMPTS`, `EMAIL_OTP_RESEND_SECONDS`,
`RESET_TOKEN_EXPIRE_MINUTES`.

### Uploads
`UPLOAD_DIR`, `STORE_UPLOAD_SUBDIR`, `BUNDLE_UPLOAD_SUBDIR`, `REVIEW_UPLOAD_SUBDIR`,
`UPLOAD_CACHE_MAX_AGE`, `REQUEST_SIZE_LIMIT`, `MAX_UPLOAD_SIZE_MB`, `BANNER_UPLOAD_MAX_MB`,
`SOCKET_MAX_BUFFER_MB`.

### Translation
`LIBRETRANSLATE_URL`, `LIBRETRANSLATE_API_KEY`, `TRANSLATE_SOURCE_LANG`,
`TRANSLATE_TARGET_LOCALES`, `TRANSLATE_TIMEOUT_MS`, `TRANSLATE_MAX_RETRIES`,
`TRANSLATE_BATCH_SIZE`, `TRANSLATE_RETRY_BASE_DELAY_MS`.

### Rate limit
`RATE_LIMIT_WINDOW_MINUTES`, `RATE_LIMIT_WHITELIST_IPS`, `RATE_LIMIT_USER_MULTIPLIER`,
`RATE_LIMIT_ADMIN_MULTIPLIER`, `RATE_LIMIT_GLOBAL_MAX`, `RATE_LIMIT_LOGIN_MAX`,
`RATE_LIMIT_ADMIN_LOGIN_MAX`, `RATE_LIMIT_GOOGLE_LOGIN_MAX`, `RATE_LIMIT_REGISTER_MAX`,
`RATE_LIMIT_SEND_EMAIL_OTP_MAX`, `RATE_LIMIT_VERIFY_EMAIL_OTP_MAX`,
`RATE_LIMIT_FORGOT_PASSWORD_MAX`, `RATE_LIMIT_VERIFY_RESET_OTP_MAX`,
`RATE_LIMIT_RESET_PASSWORD_MAX`, `RATE_LIMIT_ORDER_CREATE_MAX`,
`RATE_LIMIT_REVIEW_CREATE_MAX`, `RATE_LIMIT_CHAT_MAX`, `RATE_LIMIT_SELLER_APPLY_MAX`.

## 3. Frontend env variables (`frontend/.env`)

| Variable | Kaam |
|---|---|
| `NEXT_PUBLIC_SERVERURL` | Public API URL (e.g. `http://host:5000/api`) — koi fallback nahi |
| `NEXT_PUBLIC_SERVER_PORT` | Backend port (alignBackendUrl ke liye) |
| `NEXT_PUBLIC_SOCKET_URL` | Socket origin (optional) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google login |
| `NEXT_PUBLIC_SUPPORT_EMAIL` | Support email display |
| `NEXT_PUBLIC_ROOT_DOMAIN` | Platform domain (port ke saath) |
| `INTERNAL_PROXY_SECRET` | Backend `x-store-host` trust — backend ke saath same |
| `NEXT_INTERNAL_API_URL` | Server-side fetch ke liye internal backend URL |

> Missing `NEXT_PUBLIC_SERVERURL` → API requests fail (clear console error). Koi guessed fallback nahi.

## 4. Development host setup (nip.io)

Dev me aksar `192.168.88.35.nip.io` use hota hai:

- Platform: `192.168.88.35.nip.io:3000`
- Store: `alistore.192.168.88.35.nip.io:3000`
- API: same host, port `5000`.

`alignBackendUrl` browser me API ko page ke hostname par le aata hai (sirf port alag), is se
HttpOnly host-only cookies chalti hain. Custom domains ke liye `*.test` + hosts file.

## 5. Production checklist

- [ ] `NODE_ENV=production` → Secure cookies.
- [ ] `REDIS_URL` set (shared rate-limit + one-time tokens).
- [ ] `INTERNAL_PROXY_SECRET` dono `.env` me same.
- [ ] 6 different JWT secrets (user/admin/sa access+refresh) — dev values nahi.
- [ ] `PUBLIC_STORE_PROTOCOL=https`.
- [ ] `GOOGLE_CLIENT_ID` = `NEXT_PUBLIC_GOOGLE_CLIENT_ID`; store hosts authorized.
- [ ] Strong `SUPER_ADMIN_PASSWORD` + `SUPER_ADMIN_MIN_PASSWORD_LENGTH`.
- [ ] `NEXT_PUBLIC_SERVERURL` public HTTPS API; `NEXT_INTERNAL_API_URL` internal.
- [ ] Custom domains `domainVerified:true`.
- [ ] Reverse proxy (nginx) me `X-Forwarded-*` + `TRUST_PROXY` sahi set.
- [ ] Mongo backups + uploads folder backup.

## 6. Migrations (deploy ke baad)

1. `node scripts/migrateTenantIndexes.js` (dry run dekhlo) → `--apply`.
2. `node scripts/migrateAttributesPerStore.js --apply`.
3. `npm run backfillSubdomains` (agar purane stores bina subdomain).
4. `npm run translation:check` → `npm run backfill:translations`.

## 7. Debugging tips

- `utils/logger.js` **no-op** hai — `log.*` kuch print nahi karta. Debug ke liye `console.*`
  temporarily use karo.
- Startup status lines seedha `console` se aati hain (server.js).
- Port busy ho to server exit karta hai (`checkPortAvailable`).
- Socket fail ho to server chalta rehta hai — sirf socket status "not connected".
