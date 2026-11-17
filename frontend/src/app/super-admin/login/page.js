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
  Loader2,
  ArrowRight,
  Users,
  Store,
  ClipboardList,
  ScrollText,
} from "lucide-react";
import FallbackImage from "@/components/common/FallbackImage";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PANEL_FEATURES = [
  { icon: ClipboardList, title: "Seller signup approvals", desc: "Review and approve new stores" },
  { icon: Store, title: "Store management", desc: "Suspend or reactivate any store" },
  { icon: Users, title: "User management", desc: "Customers and sellers, everywhere" },
  { icon: ScrollText, title: "Audit logs", desc: "Every action, fully recorded" },
];

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });

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
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full">
      {/* ============ LEFT - BRAND PANEL ============ */}
      <aside className="relative z-20 hidden shrink-0 flex-col overflow-hidden px-8 py-7 text-white lg:flex lg:w-[48%] xl:w-[52%] xl:px-14 xl:py-10">
        {/* Background artwork + legibility overlays */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url(/images/ecommerce-dashboard-bg.png)" }}
        />
        <div aria-hidden="true" className="absolute inset-0 z-0 bg-slate-950/35" />
        <div aria-hidden="true" className="absolute inset-0 z-0 bg-gradient-to-r from-slate-950/70 via-slate-950/20 to-transparent" />
        <div aria-hidden="true" className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950/60 via-transparent to-slate-950/10" />

        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="space-y-8">
            {/* Brand */}
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 ring-1 ring-white/25 shadow-xl shadow-black/30">
                <FallbackImage
                  src="/images/click-master-logo.webp"
                  alt="Click Master"
                  className="h-full w-full object-contain"
                />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[18px] font-semibold tracking-tight text-white">
                  Click Master
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-blue-200/90">
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                  Super Admin
                </p>
              </div>
            </div>

            {/* Hero Text */}
            <div className="max-w-[440px]">
              <h1 className="text-[29px] font-semibold leading-[1.15] tracking-tight text-white drop-shadow-[0_2px_10px_rgba(2,6,23,0.6)] xl:text-[34px]">
                Manage every store<br />with confidence
              </h1>
              <p className="mt-3 text-[12.5px] leading-[1.6] text-blue-100/85">
                One control panel for the whole platform — stores, sellers, users and approvals.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-3">
              {PANEL_FEATURES.map((feature) => {
                const FeatureIcon = feature.icon;
                return (
                  <div key={feature.title} className="flex items-center gap-3.5">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg backdrop-blur-sm"
                      style={{
                        background: "rgba(255, 255, 255, 0.14)",
                        border: "1px solid rgba(255, 255, 255, 0.18)",
                      }}
                    >
                      <FeatureIcon size={14} className="text-blue-300" aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-[11px] font-medium text-white/95">{feature.title}</span>
                      <span className="block text-[9px] text-indigo-200/60">{feature.desc}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* ============ RIGHT - LOGIN FORM PANEL ============ */}
      <main className="relative flex min-w-0 flex-1 items-center justify-center overflow-hidden bg-[var(--bg-primary)] px-6 py-10">
        {/* Soft decorative blobs */}
        <div aria-hidden="true" className="pointer-events-none absolute -end-28 -top-28 h-96 w-96 rounded-full" style={{ background: "radial-gradient(circle, rgba(37, 99, 235, 0.10), transparent 65%)" }} />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -start-24 h-80 w-80 rounded-full" style={{ background: "radial-gradient(circle, rgba(37, 99, 235, 0.06), transparent 65%)" }} />

        {/* Portal context */}
        <div className="absolute end-5 top-5 z-30 flex items-center gap-2 md:end-7 md:top-6">
          <div className="hidden items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-card)]/90 px-3.5 py-2 text-[12px] font-medium text-[var(--text-secondary)] shadow-sm backdrop-blur-sm md:flex">
            <Lock size={14} className="text-[var(--accent)]" aria-hidden="true" />
            Super Admin portal
          </div>
        </div>

        <div className="relative w-full max-w-[360px]">
          {/* Brand */}
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-1 ring-1 ring-black/10 shadow-sm">
                <FallbackImage
                  src="/images/click-master-logo.webp"
                  alt="Click Master"
                  className="h-full w-full object-contain"
                />
              </span>
              <span className="text-start">
                <span className="block text-[19px] font-semibold leading-tight tracking-tight text-[var(--text-secondary)]">
                  Click Master
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                  Super Admin
                </span>
              </span>
            </div>

            <h2 className="mt-7 text-[26px] font-medium tracking-tight text-[var(--text-secondary)]">Welcome back</h2>
            <p className="mt-1.5 text-[13.5px] text-[var(--text-muted)]">Sign in to the platform control panel</p>
          </div>

          {/* Server error */}
          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-[13px]"
              style={{
                background: "var(--danger-soft)",
                color: "var(--danger-text)",
                borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)",
              }}
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit} noValidate className="mt-6 space-y-3.5">
            {/* Email Input */}
            <div>
              <div className={`flex items-start gap-3 rounded-xl border bg-[var(--bg-card)] px-3.5 py-2.5 transition-all ${fieldErrors.email ? "border-[var(--danger)] ring-2 ring-[var(--danger-soft)]" : "border-[var(--border-card)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]"}`}>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <Mail size={15} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <label htmlFor="sa-email" className="block cursor-text text-[12px] font-medium text-[var(--text-secondary)]">Email</label>
                  <input
                    id="sa-email"
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
                    className="w-full bg-transparent pt-0.5 text-[13px] font-normal text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                  />
                </span>
              </div>
              {fieldErrors.email && <p role="alert" className="mt-1.5 text-xs font-medium text-[var(--danger-text)]">{fieldErrors.email}</p>}
            </div>

            {/* Password Input */}
            <div>
              <div className={`flex items-start gap-3 rounded-xl border bg-[var(--bg-card)] px-3.5 py-2.5 transition-all ${fieldErrors.password ? "border-[var(--danger)] ring-2 ring-[var(--danger-soft)]" : "border-[var(--border-card)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]"}`}>
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <Lock size={15} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <label htmlFor="sa-password" className="block cursor-text text-[12px] font-medium text-[var(--text-secondary)]">Password</label>
                  <span className="relative block">
                    <input
                      id="sa-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={handlePasswordChange}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      required
                      aria-invalid={Boolean(fieldErrors.password)}
                      className="w-full bg-transparent pt-0.5 pe-8 text-[13px] font-normal text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute end-0 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-[var(--text-muted)] transition-colors hover:text-[var(--accent)] focus-visible:outline-none"
                    >
                      {showPassword ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
                    </button>
                  </span>
                </span>
              </div>
              {fieldErrors.password && <p role="alert" className="mt-1.5 text-xs font-medium text-[var(--danger-text)]">{fieldErrors.password}</p>}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-medium text-[var(--accent-text)] transition-all hover:opacity-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--info))", boxShadow: "0 10px 24px rgba(37, 99, 235, 0.30)" }}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn size={15} aria-hidden="true" />
                  Sign In
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </form>

          {/* Secure Footer */}
          <p className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] font-normal text-[var(--text-muted)]">
            <Lock size={11} aria-hidden="true" />
            Secure login · Your data is protected
          </p>
        </div>
      </main>
    </div>
  );
}
