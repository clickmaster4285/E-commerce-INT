"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  LogIn,
  ArrowRight,
} from "lucide-react";
import FallbackImage from "@/components/common/FallbackImage";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  // Already signed in? Jump straight to dashboard
  useEffect(() => {
    superAdminApi
      .me()
      .then(() => router.replace("/super-admin/dashboard"))
      .catch(() => {});
  }, [router]);

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: "" }));
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: "" }));
  };

  const checkCapsLock = (e) => {
    if (e.getModifierState) setCapsLockOn(e.getModifierState("CapsLock"));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (loading) return;

    const trimmedEmail = email.trim();
    const errors = {
      email: !trimmedEmail
        ? "Email is required."
        : !EMAIL_PATTERN.test(trimmedEmail)
          ? "Enter a valid email address."
          : "",
      password: !password ? "Password is required." : "",
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    setLoading(true);
    try {
      await superAdminApi.login({ email: trimmedEmail, password });
      router.replace("/super-admin/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Invalid email or password.");
      setShakeKey((k) => k + 1);
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-6 sm:px-6 lg:justify-end lg:pe-[clamp(24px,8vw,140px)]">
      {/* Full-screen background artwork — exactly as before */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/images/ecommerce-dashboard-bg.png)" }}
      />
      <div aria-hidden="true" className="absolute inset-0 bg-slate-950/15" />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(2,6,23,0) 55%, rgba(2,6,23,0.42) 100%)" }}
      />

      {/* Slow floating light glow behind the card (10s loop) */}
      <div aria-hidden="true" className="super-login-glow-position">
        <div className="super-login-glow" />
      </div>

      {/* Frosted white glass card */}
      <div key={shakeKey} className={`super-login-card relative z-10 ${shakeKey > 0 ? "super-login-shake" : ""}`}>
        {/* Header block */}
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-[0_10px_28px_rgba(2,6,23,0.35),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-white/40">
            <FallbackImage
              src="/images/click-master-logo.webp"
              alt="Click Master"
              className="h-full w-full object-contain"
            />
          </span>

          <p className="super-login-brand mt-4">Click Master</p>
          <span className="super-login-pill mt-1.5">Super Admin</span>

          <h2 className="super-login-title mt-6">Welcome back</h2>
          <p className="super-login-subtitle">Sign in to the platform control panel</p>
        </div>

        {/* Server error — fades in, announced politely */}
        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-5 flex items-start gap-2 rounded-xl border border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-[color-mix(in_srgb,var(--danger)_22%,transparent)] px-3.5 py-3 text-[13px] text-[#fecaca]"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={submit} noValidate className="mt-5 space-y-3.5">
          {/* Email */}
          <div className="super-login-field-wrap" style={{ animationDelay: "0.12s" }}>
            <label htmlFor="sa-email" className="super-login-label">Email</label>
            <div className="super-login-field" data-error={Boolean(fieldErrors.email)}>
              <span className="super-login-icon">
                <Mail size={17} aria-hidden="true" />
              </span>
              <input
                id="sa-email"
                name="email"
                type="email"
                inputMode="email"
                spellCheck={false}
                value={email}
                onChange={handleEmailChange}
                placeholder="you@company.com"
                autoComplete="username"
                required
                autoFocus
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? "sa-email-error" : undefined}
                className="super-login-input"
              />
            </div>
            {fieldErrors.email && (
              <p id="sa-email-error" role="alert" className="super-login-error">
                <AlertCircle size={12} aria-hidden="true" />
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="super-login-field-wrap" style={{ animationDelay: "0.18s" }}>
            <label htmlFor="sa-password" className="super-login-label">Password</label>
            <div className="super-login-field" data-error={Boolean(fieldErrors.password)}>
              <span className="super-login-icon">
                <Lock size={17} aria-hidden="true" />
              </span>
              <input
                id="sa-password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={handlePasswordChange}
                onKeyDown={checkCapsLock}
                onKeyUp={checkCapsLock}
                onBlur={() => setCapsLockOn(false)}
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "sa-password-error" : capsLockOn ? "sa-capslock" : undefined}
                className="super-login-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="super-login-toggle"
              >
                {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
              </button>
            </div>
            {fieldErrors.password && (
              <p id="sa-password-error" role="alert" className="super-login-error">
                <AlertCircle size={12} aria-hidden="true" />
                {fieldErrors.password}
              </p>
            )}
            {capsLockOn && !fieldErrors.password && (
              <p id="sa-capslock" role="status" className="super-login-caps">
                <AlertCircle size={12} aria-hidden="true" />
                Caps Lock is on
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="super-login-field-wrap" style={{ animationDelay: "0.24s" }}>
            <button type="submit" disabled={loading} className="super-login-button">
              {loading ? (
                <>
                  <span className="spinner super-login-btn-spinner" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn size={16} aria-hidden="true" />
                  Sign In
                  <ArrowRight size={17} aria-hidden="true" className="super-login-arrow" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Secure footer — unchanged text */}
        <p className="super-login-note mt-5">
          <Lock size={12} aria-hidden="true" />
          Secure login · Your data is protected
        </p>
      </div>
    </main>
  );
}
