# 15 — OTP System (complete guide)

OTP (One-Time Password) email verification + password reset. Store-scoped via tenant context.

---

## 1. Purpose
- Verify customer email before account creation (no unverified `User` row).
- Password reset via email OTP + short-lived reset token.
- Seller application OTP (platform) and resend flows.

---

## 2. Files & folders

### Backend
| File | Role |
|---|---|
| `backend/controllers/otpController.js` | All OTP handlers + `issueOtp`/`verifyOtpCode` shared helpers |
| `backend/utils/sendEmail.js` | Nodemailer transport, SMTP config, `sendOtpEmail`, `verifySmtpConnection` |
| `backend/services/emailService.js` | Generic email sender + `sendApplicationReceivedEmail` |
| `backend/services/emailLayout.js` | Shared HTML email template (hero, code box, footer) |
| `backend/models/Otp.js` | OTP record (email, purpose, code_hash, expires_at, attempts, verified, consumed) |
| `backend/models/PendingRegistration.js` | Seller/customer signup pending state (holds otpHash) |
| `backend/models/User.js` | `emailVerified` flag |
| `backend/routes/userRoutes.js` | OTP endpoints mounted under `/users` |
| `backend/scripts/testEmail.js` | SMTP diagnostic CLI |
| `backend/test/sellerPendingEmail.test.js`, `emailTransport.test.js` | Tests |

### Frontend
| File | Role |
|---|---|
| `frontend/src/apis/user/authApi.js` | `sendEmailOtp`, `verifyEmailOtp`, `sendForgotOtp`, `verifyResetOtp`, `resetPassword` |
| `frontend/src/app/landing/signup/page.js` | Seller signup → OTP step |
| `frontend/src/app/(user)/...` forgot-password UI | Password reset flow |
| `frontend/src/components/user/LoginModal.js` | Customer login/register OTP |

---

## 3. Configuration (env)
- `EMAIL_USER` / `EMAIL_PASS` (or `SMTP_USER`/`SMTP_PASS`): SMTP credentials. Gmail requires 16-char App Password.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_FROM`: explicit SMTP (optional; defaults to `smtp.gmail.com:587` if only creds given).
- `EMAIL_OTP_EXPIRE_MINUTES`, `EMAIL_OTP_MAX_ATTEMPTS`, `EMAIL_OTP_RESEND_SECONDS`, `OTP_LENGTH`.
- `RESET_TOKEN_EXPIRE_MINUTES`.
- `NODE_ENV`: dev enables console OTP fallback; prod never exposes OTP.

---

## 4. Data model

### Otp
```
email, purpose ("email_verification" | "password_reset"),
code_hash (bcrypt), expires_at, attempts, verified, consumed,
created_at, storeId (tenant)
```
- Unique-ish: latest OTP per email+purpose; old codes deleted on resend.
- `consumed` marks used; `verified` for reset flow.

### PendingRegistration
Holds signup data + `otpHash`, `expiresAt`, `attempts`, `lastSentAt`, `referralCode`, store fields. User/Employee created only after OTP verify.

---

## 5. Flows

### A. Email verification (register)
1. Frontend `POST /users/register` → `createUser` (customerAuthController) creates `PendingRegistration` + OTP hash + sends email.
2. If SMTP fails in dev → `debugOtp` returned; OTP printed to backend console.
3. Frontend shows OTP input; user enters code.
4. `POST /users/verify-email-otp` → `verifyEmailVerificationOtp`:
   - Validates OTP against `PendingRegistration.otpHash`.
   - Enforces expiry + max attempts (deletes pending on exceed).
   - On success: creates `User`/`Employee` (seller) based on `storeId`, awards loyalty welcome bonus, processes referral, sets auth cookies, deletes pending.
5. `POST /users/send-email-otp` (resend) → `sendVerificationOtpForEmail` → new OTP (throttled).

### B. Password reset
1. `POST /users/forgot-password` → `sendForgotPasswordOtp` → `issueOtp(purpose="password_reset")`.
2. `POST /users/verify-reset-otp` → `verifyForgotPasswordOtp` → verifies code, marks `verified=true`, returns short-lived JWT reset token (expires in `RESET_TOKEN_EXPIRE_MINUTES`, storeId-bound).
3. `POST /users/reset-password` → `resetPasswordWithOtp` → validates reset token + OTP, sets new password, revokes other sessions.

### C. Seller application email
- `sendApplicationReceivedEmail` (emailService) after seller apply.

---

## 6. Security
- OTP code hashed with bcrypt (never stored plaintext).
- Expiry (`EMAIL_OTP_EXPIRE_MINUTES`).
- Max attempts (`EMAIL_OTP_MAX_ATTEMPTS`) → pending deleted on exceed.
- Resend throttle (`OTP_RESEND_SECONDS`) → 429 with `retryAfter`.
- Single-use: old OTPs deleted on resend; `consumed` flag.
- Reset token: JWT signed with `JWT_SECRET`, short expiry, storeId-bound, requires verified OTP.
- Production never exposes `debugOtp`.
- SMTP failures in prod delete the OTP record so user can retry.

---

## 7. Dev fallback
- If SMTP not configured/throws, dev mode prints OTP to backend console and returns `debugOtp` in response. Frontend (landing signup) proceeds to OTP step. Production returns 503 + friendly error.

---

## 8. APIs
| Method | Path | Handler |
|---|---|---|
| POST | `/users/send-email-otp` | sendEmailVerificationOtp |
| POST | `/users/verify-email-otp` | verifyEmailVerificationOtp |
| POST | `/users/forgot-password` | sendForgotPasswordOtp |
| POST | `/users/verify-reset-otp` | verifyForgotPasswordOtp |
| POST | `/users/reset-password` | resetPasswordWithOtp |

---

## 9. Integration points
- `customerAuthController.createUser` → PendingRegistration + OTP (seller/customer signup).
- `otpController` → User/Employee creation on verify.
- `loyalty.awardSignupBonus`, `referrals.processSignupReferral` on verify.
- `authMiddleware` / tokens → session cookies after verify.

---

## 10. Known issues / notes
- `SMTP_HOST/PORT/SECURE/FROM` missing in `.env` defaults to Gmail; invalid App Password causes EAUTH.
- `OTP_EXPIRE_MINUTES` etc. must be set (no defaults).
- `logger.js` is no-op; use console for OTP debugging.
- Frontend should surface `res.message`/`debugOtp` properly (recently fixed landing signup).
