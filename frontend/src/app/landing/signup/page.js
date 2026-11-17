"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  LogIn,
  Truck,
  Zap,
  ShoppingCart,
  Store,
  ShoppingBag,
  Check,
} from "lucide-react";
import LazyGoogleLogin from "@/components/user/LazyGoogleLogin";
import { storeApi } from "@/apis/user/storeApi";
import { authApi, getApiErrorMessage, isValidEmail } from "@/apis/user/authApi";
import OtpVerifyCard from "@/components/user/OtpVerifyCard";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export default function SignupPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [step, setStep] = useState("form"); // form | otp | welcome
  const [role, setRole] = useState("sell"); // "shop" | "sell" — matches reference design
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [nextPath, setNextPath] = useState("/");

  const { data: store = null } = useQuery({
    queryKey: ["storeInfo"],
    queryFn: storeApi.getPublic,
    staleTime: 5 * 60 * 1000,
  });
  const storeName = store?.store_name || "Click Master";

  const inputCls = (field) =>
    `w-full h-11 rounded-xl border-[1px] bg-[#f7f7f8] pl-11 pr-4 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition ${
      errors[field]
        ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
        : "border-[#e5e5e7] focus:border-[#f57224] focus:ring-2 focus:ring-[#f57224]/15"
    }`;

  const renderFieldError = (field) => {
    if (!errors[field]) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1.5 px-1">
        <AlertCircle size={12} className="text-red-500 shrink-0" />
        <p className="text-[0.6875rem] font-semibold text-red-600">{errors[field]}</p>
      </div>
    );
  };

  const parseBackendError = (err) => {
    const responseData = err?.response?.data || {};
    const message =
      responseData?.message || responseData?.error || responseData?.msg || err?.message || "";
    const raw = responseData?.errors || responseData?.fieldErrors || responseData?.details || {};
    const nextErrors = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      Object.entries(raw).forEach(([field, msg]) => {
        nextErrors[field] = Array.isArray(msg) ? String(msg[0]) : String(msg);
      });
    }
    setErrors((prev) => ({ ...prev, ...nextErrors }));
    setGeneralError(Object.keys(nextErrors).length === 0 && message ? message : "");
  };

  const validate = () => {
    const next = {};
    if (!name.trim() || name.trim().length < 2) next.name = t("auth.signup.nameRequired");
    if (!isValidEmail(email)) next.email = t("auth.login.invalidEmail");
    if (!password || password.length < 6) next.password = t("auth.signup.passwordMin");
    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setGeneralError("");
    if (Object.keys(nextErrors).length > 0) return;
    const cleanEmail = email.trim().toLowerCase();
    const successPath = role === "sell" ? "/seller/apply" : "/";
    setNextPath(successPath);
    setLoading(true);
    try {
      const res = await authApi.register({
        name: name.trim(),
        email: cleanEmail,
        password,
      });
      const target = res?.email || cleanEmail;
      setOtpEmail(target);
      setStep("otp");
      toast.success(t("auth.login.verificationSent", { email: target }));
      setLoading(false);
    } catch (err) {
      const data = err?.response?.data || {};
      if (data.requireVerification || data.needsVerification) {
        setOtpEmail(data.email || cleanEmail);
        setStep("otp");
        toast.info(getApiErrorMessage(err, t("auth.login.verifyEmail")));
        setLoading(false);
        return;
      }
      parseBackendError(err);
      toast.error(getApiErrorMessage(err, t("auth.login.registrationFailed")));
      setLoading(false);
    }
  };

  const handleGoogle = async (credential) => {
    setLoading(true);
    try {
      await authApi.googleCustomerLogin(credential);
      window.location.href = role === "sell" ? "/seller/apply" : "/";
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("auth.login.googleFailed")));
      setLoading(false);
    }
  };

  const handleVerify = async (otp) => {
    await authApi.verifyEmailOtp(otpEmail, otp);
    setStep("welcome");
  };

  const handleResend = async () => {
    await authApi.sendEmailOtp(otpEmail);
    toast.success(t("auth.login.verificationResent"));
  };

  useEffect(() => {
    if (step !== "welcome") return undefined;
    const id = window.setTimeout(() => {
      window.location.assign(nextPath || "/");
    }, 2800);
    return () => window.clearTimeout(id);
  }, [step, nextPath]);

  /* ═══════════ WELCOME / REDIRECTING OVERLAY ═══════════ */
  if (step === "welcome") {
    return (
      <main
        role="dialog"
        aria-modal="true"
        aria-label={t("auth.signup.successTitle")}
        className="user-theme fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#05070b] px-6 text-center"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,106,31,0.16)_0%,transparent_60%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />

        <motion.svg
          viewBox="0 0 120 120"
          className="relative h-28 w-28 sm:h-32 sm:w-32"
          fill="none"
          aria-hidden="true"
        >
          <motion.circle
            cx="60"
            cy="60"
            r="52"
            stroke="#FF6A1F"
            strokeWidth="6"
            strokeLinecap="round"
            initial={{ pathLength: 0, rotate: -90 }}
            animate={{ pathLength: 1, rotate: 0 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "center" }}
          />
          <motion.path
            d="M38 62 L54 78 L84 44"
            stroke="#22C55E"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6, ease: "easeOut" }}
          />
        </motion.svg>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.5, ease: "easeOut" }}
          className="relative mt-8 max-w-xl text-3xl font-black leading-tight text-white sm:text-4xl"
        >
          {t("auth.signup.successTitle")}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05, duration: 0.5, ease: "easeOut" }}
          className="relative mt-3 max-w-md text-sm leading-6 text-white/70 sm:text-base"
        >
          {t("auth.signup.successSubtitle")}
        </motion.p>

        <div className="relative mt-8 h-1.5 w-56 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-[#FF6A1F] to-[#FFB25E]"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ delay: 0.4, duration: 2.1, ease: "easeInOut" }}
          />
        </div>
        <p className="relative mt-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-orange-200/80">
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
          {t("auth.signup.redirecting")}
        </p>
      </main>
    );
  }

  /* ═══════════ SIGNUP PAGE ═══════════ */
  return (
    <main className="user-theme flex min-h-screen bg-[#f4f4f6]">
      {/* ═══════════ LEFT — PHOTO BRAND PANEL ═══════════ */}
      <div className="relative hidden lg:flex lg:w-[50%] xl:w-[54%] flex-col justify-between overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-right bg-no-repeat"
          style={{ backgroundImage: "url(/landing/fulfillment-hub.png)" }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/5" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/35" />

        {/* Logo top-left */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="relative flex w-max cursor-pointer items-center gap-2.5 transition hover:opacity-85"
          aria-label={`${storeName} home page`}
        >
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f57224] shadow-[0_4px_14px_rgba(245,114,36,0.4)]"
          >
            <ShoppingBag size={20} strokeWidth={2.25} className="text-white" />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[17px] font-extrabold tracking-tight text-white">
              ClickMaster
            </span>
            <span className="block text-[8.5px] font-bold uppercase tracking-[0.22em] text-orange-400">
              Marketplace
            </span>
          </span>
        </button>

        {/* Headline + trust badges */}
        <div className="relative max-w-lg">
          <h1 className="text-[34px] font-black leading-[1.08] tracking-tight text-white xl:text-[42px]">
            One marketplace.
            <br />
            <span className="bg-gradient-to-r from-[#ff7a1a] to-[#ffb25e] bg-clip-text text-transparent">
              Endless possibilities.
            </span>
          </h1>
          <p className="mt-4 max-w-md text-[13.5px] leading-6 text-white/80">
            Discover products, build your store, and grow with confidence.
          </p>

          <ul className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3">
            {[
              { icon: ShieldCheck, label: "Secure\nshopping" },
              { icon: Store, label: "Seller\ntools" },
              { icon: Truck, label: "Reliable\ndelivery" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-white/20 bg-white/10 text-orange-300"
                >
                  <Icon size={16} strokeWidth={2} />
                </span>
                <span className="whitespace-pre-line text-[9.5px] font-bold leading-[1.15] text-white/85">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ═══════════ RIGHT — WHITE CARD ═══════════ */}
      <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
        <div className="w-full max-w-[380px] rounded-[22px] border border-black/5 bg-white px-5 py-6 shadow-[0_25px_60px_rgba(15,23,42,0.22)]">
          {/* Card header */}
          <div className="text-center">
            <h2 className="text-[22px] font-extrabold leading-tight tracking-tight text-slate-900">
              Create your account
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-slate-500">
              Join the marketplace in a few simple steps.
            </p>
          </div>

          {/* Role chooser */}
          <div
            role="radiogroup"
            aria-label="What do you want to do?"
            className="mt-4 grid grid-cols-2 gap-3"
          >
            {[
              {
                value: "shop",
                icon: ShoppingCart,
                title: "I’m here to shop",
                caption: "Find great products at the best prices",
              },
              {
                value: "sell",
                icon: Store,
                title: "I want to sell",
                caption: "Start your own store and grow your business",
              },
            ].map(({ value, icon: Icon, title, caption }) => {
              const selected = role === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setRole(value)}
                  className={`relative flex flex-col items-center gap-1.5 rounded-2xl border bg-white px-3 pb-3 pt-4 text-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f57224] ${
                    selected
                      ? "border-[#f57224] shadow-[0_8px_24px_rgba(245,114,36,0.18)]"
                      : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                  }`}
                >
                  {selected && (
                    <span
                      aria-hidden="true"
                      className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#f57224] text-white"
                    >
                      <Check size={12} strokeWidth={3.25} />
                    </span>
                  )}
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f57224]/12 text-[#f57224]"
                  >
                    <Icon size={21} strokeWidth={1.9} />
                  </span>
                  <span className="text-[12px] font-extrabold leading-tight text-slate-900">
                    {title}
                  </span>
                  <span className="text-[9px] leading-[1.25] text-slate-500">
                    {caption}
                  </span>
                </button>
              );
            })}
          </div>

          {generalError && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
              <p className="text-sm text-red-600">{generalError}</p>
            </div>
          )}

          {/* ═══ STEP: OTP ═══ */}
          {step === "otp" && (
            <div className="mt-5">
              <OtpVerifyCard
                email={otpEmail}
                title={t("auth.signup.title")}
                onVerify={handleVerify}
                onResend={handleResend}
                onBack={() => setStep("form")}
                backLabel={t("auth.signup.title")}
              />
            </div>
          )}

          {/* ═══ STEP: FORM ═══ */}
          {step === "form" && (
            <form onSubmit={handleSubmit} className="mt-5 space-y-3" noValidate>
              {/* Full name */}
              <div>
                <label htmlFor="su-name" className="mb-1 block text-[10.5px] font-extrabold text-slate-700">Full name</label>
                <div className="relative">
                  <User size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="su-name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
                    placeholder="Enter your full name"
                    aria-label={t("auth.login.fullName")}
                    className={`${inputCls("name")} !pl-10`}
                  />
                </div>
                {renderFieldError("name")}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="su-email" className="mb-1 block text-[10.5px] font-extrabold text-slate-700">Email address</label>
                <div className="relative">
                  <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="su-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
                    placeholder="Enter your email address"
                    aria-label="Email"
                    className={`${inputCls("email")} !pl-10`}
                  />
                </div>
                {renderFieldError("email")}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="su-password" className="mb-1 block text-[10.5px] font-extrabold text-slate-700">Password</label>
                <div className="relative">
                  <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="su-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "" })); }}
                    placeholder="Create a strong password"
                    aria-label={t("auth.login.password")}
                    className={`${inputCls("password")} !pl-10 !pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
                {renderFieldError("password")}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-extrabold text-white shadow-[0_8px_20px_rgba(245,114,36,0.35)] transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f57224] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "linear-gradient(180deg,#ff8a3d 0%,#f57224 55%,#e2641b 100%)" }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    {t("auth.signup.signingUp")}
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight size={16} aria-hidden="true" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-0.5" aria-hidden="true">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[10px] font-medium text-slate-400">or continue with</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Google continue */}
              {GOOGLE_CLIENT_ID ? (
                <div className="flex flex-col items-center gap-2">
                  <LazyGoogleLogin
                    clientId={GOOGLE_CLIENT_ID}
                    onSuccess={(res) => handleGoogle(res.credential)}
                    onError={() => toast.error(t("auth.login.googleFailed"))}
                    theme="outline"
                    size="medium"
                    text="continue_with"
                    shape="pill"
                    width="320"
                  />
                </div>
              ) : (
                <p className="text-center text-[11px] text-slate-400">{t("auth.login.googleUnavailable")}</p>
              )}

              {/* Sign-in link */}
              <p className="pt-1 text-center text-[12px] text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="font-extrabold text-[#f57224] hover:underline"
                >
                  Sign in
                </button>
              </p>

              <p className="flex items-center justify-center gap-1.5 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-400">
                <ShieldCheck size={11} aria-hidden="true" />
                Your information is secure
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
