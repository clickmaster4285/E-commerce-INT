import { userHttp } from "../axiosInstance";
// ==========================================
// 🔐 AUTH / OTP API
// ==========================================
// Email verification aur forgot-password ke saare public endpoints
// yahan centralize hain taake UI components clean rahein.

export const authApi = {
  // 🔑 Login / Register
  login: (data) => userHttp.post("/users/login", data).then((res) => res.data),
  // Registration ko artificial client timeout mat do — slow network / email
  // par signup fail ho jata tha ("timeout of 15000ms exceeded"). Backend apne
  // SMTP timeouts khud manage karta hai, is liye yahan default (no timeout) sahi hai.
  register: (data) =>
    userHttp.post("/users/register", data).then((res) => res.data),
  // Signup step 1 — email/username/phone already taken? → { available, errors: { email?, username?, phone? }, code? }
  checkRegistration: (data) => userHttp.post("/users/register/check", data).then((res) => res.data),
  googleCustomerLogin: (credential, referralCode = "") =>
    userHttp.post("/users/google-customer-login", { credential, referralCode }).then((res) => res.data),

  // 📧 EMAIL VERIFICATION (OTP — 5 min expiry)
  sendEmailOtp: (email) =>
    userHttp.post("/users/send-email-otp", { email }).then((res) => res.data),
  verifyEmailOtp: (email, otp) =>
    userHttp.post("/users/verify-email-otp", { email, otp }).then((res) => res.data),

  // 🔐 FORGOT PASSWORD (OTP — 5 min expiry)
  sendForgotOtp: (email) =>
    userHttp.post("/users/forgot-password", { email }).then((res) => res.data),
  verifyResetOtp: (email, otp) =>
    userHttp.post("/users/verify-reset-otp", { email, otp }).then((res) => res.data),
  resetPassword: (data) =>
    userHttp.post("/users/reset-password", data).then((res) => res.data),
};

// ✅ Backend ke friendly error message nikaalne ke liye
export const getApiErrorMessage = (err, fallback = "Something went wrong. Please try again.") => {
  if (err?.code === "ECONNABORTED" || /timeout|timed out/i.test(err?.message || "")) {
    return "The request took too long. Please check your connection and try again.";
  }
  if (!err?.response && /network|failed to fetch/i.test(err?.message || "")) {
    return "Network error. Please check your connection and try again.";
  }
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
};

// ✅ Resend button ke cooldown ke liye (backend 429 + retryAfter bhejta hai)
export const getApiRetryAfter = (err) => {
  const value = err?.response?.data?.retryAfter;
  return Number.isFinite(Number(value)) ? Number(value) : null;
};

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
