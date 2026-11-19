"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  User,
  AtSign,
  Phone,
  Mail,
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  Truck,
  Store,
  ShoppingBag,
  ShoppingCart,
  Check,
} from "lucide-react";
import { storeApi } from "@/apis/user/storeApi";
import { authApi, getApiErrorMessage, isValidEmail } from "@/apis/user/authApi";
import { isValidPhone, normalizePhone, PHONE_MIN, PHONE_MAX } from "@/utils/phoneValidator";
import OtpVerifyCard from "@/components/user/OtpVerifyCard";
import LazyGoogleLogin from "@/components/user/LazyGoogleLogin";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function StoreLogo({ store, sizeClass = "w-10 h-10" }) {
  const logoUrl = store?.logo?.img_url
    ? store.logo.img_url.startsWith("http")
      ? store.logo.img_url
      : `${API_ORIGIN}/${store.logo.img_url}`
    : null;

  return logoUrl ? (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={logoUrl} alt="Store logo" className={`${sizeClass} object-contain rounded-xl`} />
  ) : (
    <div className={`${sizeClass} rounded-xl bg-[var(--user-accent)] flex items-center justify-center text-[var(--user-accent-text)] font-black`}>
      {store?.store_name?.[0] || "C"}
    </div>
  );
}

/* Mirrors the backend register rules exactly:
   name required + ≥2, username optional ≥3 and letters/numbers/underscores only,
   phone optional 10–16 digits, email valid, password ≥6 */
const scorePassword = (pw) => {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
};

export default function SignupPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { nameOf } = useLocalized();

  const [step, setStep] = useState("form"); // form | otp | welcome
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [otpEmail, setOtpEmail] = useState("");

  const { data: store = null } = useQuery({
    queryKey: ["storeInfo"],
    queryFn: storeApi.getPublic,
    staleTime: 5 * 60 * 1000,
  });
  const storeName = store?.store_name || "Click Master Store";
  const storeNameDisplay = nameOf ? nameOf(store, "store_name") : storeName;

  const inputBase =
    "w-full h-11 rounded-xl bg-[#f5f5f6] border pl-11 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition";
  const fieldCls = (field, withToggle = false) =>
    `${inputBase} ${withToggle ? "pr-10" : "pr-4"} ${
      errors[field]
        ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
        : "border-[#e5e5e7] focus:border-[#f57224] focus:ring-2 focus:ring-[#f57224]/15"
    }`;

  const renderFieldError = (field) => {
    if (!errors[field]) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1 px-1">
        <AlertCircle size={12} className="text-red-500 shrink-0" />
        <p className="text-[0.6875rem] font-semibold text-red-600">{errors[field]}</p>
      </div>
    );
  };

  /* Backend field errors ko form par map karo (email/password/name/username/phone) */
  const parseBackendError = (err) => {
    const responseData = err?.response?.data || {};
    const message =
      responseData?.message || responseData?.error || responseData?.msg || err?.message || "";
    const raw = responseData?.errors || responseData?.fieldErrors || responseData?.details || {};
    const fieldErrors = {};
    if (Array.isArray(raw)) {
      raw.forEach((item) => {
        if (item?.field) fieldErrors[String(item.field)] = item.message || String(item);
      });
    } else if (raw && typeof raw === "object") {
      Object.entries(raw).forEach(([field, msg]) => {
        fieldErrors[field] = Array.isArray(msg) ? String(msg[0]) : String(msg);
      });
    }
    const nextErrors = {};
    for (const key of ["name", "username", "phone", "email", "password"]) {
      if (fieldErrors[key]) nextErrors[key] = String(fieldErrors[key]);
    }
    setErrors((prev) => ({ ...prev, ...nextErrors }));
    setGeneralError(Object.keys(nextErrors).length === 0 && message ? message : "");
  };

  const validate = () => {
    const next = {};
    if (!name.trim() || name.trim().length < 2) next.name = t("auth.signup.nameRequired");
    if (username.trim() && !/^[A-Za-z0-9_]{3,30}$/.test(username.trim())) {
      next.username = t("auth.signup.usernameInvalid");
    }
    if (!isValidPhone(phone)) {
      next.phone = !phone
        ? t("auth.login.phoneRequired")
        : phone.length < PHONE_MIN
          ? t("auth.login.phoneMin", { count: PHONE_MIN })
          : t("auth.login.phoneMax", { count: PHONE_MAX });
    }
    if (!isValidEmail(email)) next.email = t("auth.login.invalidEmail");
    if (!password || password.length < 6) next.password = t("auth.signup.passwordMin");
    if (confirmPassword !== password) next.confirmPassword = t("auth.signup.passwordMismatch");
    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setGeneralError("");
    if (Object.keys(nextErrors).length > 0) return;
    setLoading(true);
    try {
      const res = await authApi.register({
        name: name.trim(),
        username: username.trim(),
        phone,
        email: email.trim().toLowerCase(),
        password,
      });
        const target = res?.email || email.trim().toLowerCase();
        if (!res?.delivered) {
          setGeneralError(res?.message || "Verification code could not be sent. Please try again later.");
          setLoading(false);
          return;
        }
        setOtpEmail(target);
        setStep("otp");
        toast.success(t("auth.login.verificationSent", { email: target }));
      setLoading(false);
    } catch (err) {
      const data = err?.response?.data || {};
      if (data.requireVerification || data.needsVerification) {
        setOtpEmail(data.email || email.trim().toLowerCase());
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
      window.location.href = "/";
    } catch (err) {
      toast.error(getApiErrorMessage(err, t("auth.login.googleFailed")));
      setLoading(false);
    }
  };

  const handleVerify = async (otp) => {
    const res = await authApi.verifyEmailOtp(otpEmail, otp);

    if (res?.pendingApproval) {
      window.location.assign(`/pending-approval?email=${encodeURIComponent(otpEmail)}`);
      return;
    }

    setStep("welcome");
  };

  const handleResend = async () => {
    await authApi.sendEmailOtp(otpEmail);
    toast.success(t("auth.login.verificationResent"));
  };

  useEffect(() => {
    if (step !== "welcome") return undefined;
    const id = window.setTimeout(() => {
      window.location.assign("/");
    }, 2800);
    return () => window.clearTimeout(id);
  }, [step]);

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

  const strength = scorePassword(password);
  const strengthLabels = [
    "",
    t("auth.signup.passwordStrengthWeak"),
    t("auth.signup.passwordStrengthFair"),
    t("auth.signup.passwordStrengthGood"),
    t("auth.signup.passwordStrengthStrong"),
  ];
  const strengthColors = ["", "bg-red-400", "bg-amber-400", "bg-lime-400", "bg-emerald-500"];

  /* ═══════════ SIGNUP PAGE ═══════════ */
  return (
    <main className="user-theme signup-reference-page flex min-h-[100dvh] bg-[#f4f4f6]">
      {/* ═══════════ LEFT — HERO ARTWORK + OVERLAY ═══════════ */}
      <div className="relative hidden shrink-0 overflow-hidden lg:flex lg:flex-col lg:w-[44%] xl:w-[48%] p-6 xl:p-10">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url(/landing/fulfillment-hub.png)", backgroundColor: "#050a14" }}
        />
        {/* Readability overlay — strong contrast on the left, artwork visible right */}
        <div aria-hidden="true" className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(5,10,25,0.85) 0%, rgba(5,10,25,0.45) 55%, transparent 100%)" }} />

        {/* Content overlay — not clickable */}
        <div className="relative flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f57224] shadow-[0_6px_16px_rgba(245,114,36,0.4)]"
          >
            <ShoppingBag size={22} strokeWidth={2.25} className="text-white" />
          </span>
          <span className="text-left leading-tight" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
            <span className="block text-[22px] font-bold tracking-tight text-white">
              ClickMaster
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff9a4d]">
              Marketplace
            </span>
          </span>
        </div>

        <div className="relative mt-8 max-w-[420px]">
          <h1
            className="block font-extrabold text-white"
            style={{
              fontSize: "clamp(28px, 3vw, 44px)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              textShadow: "0 2px 20px rgba(0,0,0,0.35)",
            }}
          >
            <span className="block min-[640px]:whitespace-nowrap">One marketplace.</span>
            <span
              className="block min-[640px]:whitespace-nowrap bg-gradient-to-r from-[#ff9a4d] to-[#f57224] bg-clip-text text-transparent"
              style={{ textShadow: "none" }}
            >
              Endless possibilities.
            </span>
          </h1>
          <p
            className="mt-3 max-w-[420px] leading-[1.55] text-white/80"
            style={{
              fontSize: "clamp(14px, 1.1vw, 16px)",
              textShadow: "0 2px 16px rgba(0,0,0,0.45)",
            }}
          >
            Discover products, build your store, and grow with confidence.
          </p>

          <ul className="mt-6 flex flex-col items-start gap-2.5">
            {[
              { icon: ShieldCheck, label: "Secure shopping" },
              { icon: Store, label: "Seller tools" },
              { icon: Truck, label: "Reliable delivery" },
            ].map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2.5 whitespace-nowrap py-1"
              >
                <span
                  aria-hidden="true"
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-[#f57224]/15 text-[#ff9a4d]"
                >
                  <Icon size={16} strokeWidth={2} />
                </span>
                <span className="whitespace-nowrap text-[13px] font-medium tracking-[0.01em] text-white/90">{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ═══════════ RIGHT — FORM CARD ═══════════ */}
      <div className="flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
        <div className="w-full max-w-[440px] rounded-2xl border border-black/5 bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.16)] sm:p-6">
          {/* Mobile logo */}
          <div className="mb-4 flex lg:hidden items-center gap-2" aria-label="Click Master">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-md bg-[#f57224]"
            >
              <ShoppingBag size={16} className="text-white" />
            </span>
            <span className="text-[14px] font-extrabold tracking-tight text-slate-900">ClickMaster</span>
          </div>

          {/* Card header */}
          <div className="text-center">
            <h2 className="text-[23px] font-semibold leading-tight tracking-[-0.01em] text-slate-900">
              Create your account
            </h2>
            <p className="mt-1.5 text-[12.5px] leading-5 text-slate-500">
              Join the marketplace in a few simple steps.
            </p>
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
            <form onSubmit={handleSubmit} className="mt-3 space-y-2" noValidate>
              {/* Name */}
              <div>
                <label htmlFor="su-name" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">Full name</label>
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
                    className={`${fieldCls("name")} !pl-11`}
                  />
                </div>
                {renderFieldError("name")}
              </div>

              {/* Username */}
              <div>
                <label htmlFor="su-username" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">Username <span className="font-medium text-slate-400">(optional)</span></label>
                <div className="relative">
                  <AtSign size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="su-username"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setErrors((p) => ({ ...p, username: "" })); }}
                    placeholder={t("auth.login.username")}
                    aria-label={t("auth.login.username")}
                    className={`${fieldCls("username")} !pl-11`}
                  />
                </div>
                {renderFieldError("username")}
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="su-phone" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">Phone number</label>
                <div className="relative">
                  <Phone size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="su-phone"
                    type="tel"
                    required
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={PHONE_MAX}
                    value={phone}
                    onChange={(e) => { setPhone(normalizePhone(e.target.value)); setErrors((p) => ({ ...p, phone: "" })); }}
                    placeholder={t("auth.login.phoneNumber")}
                    aria-label={t("auth.login.phoneNumber")}
                    className={`${fieldCls("phone")} !pl-11`}
                  />
                </div>
                {renderFieldError("phone")}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="su-email" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">Email address</label>
                <div className="relative">
                  <Mail size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="su-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
                    placeholder="you@example.com"
                    aria-label="Email"
                    className={`${fieldCls("email")} !pl-11`}
                  />
                </div>
                {renderFieldError("email")}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="su-password" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">Password</label>
                <div className="relative">
                  <Lock size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="su-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "", confirmPassword: "" })); }}
                    placeholder={t("auth.login.password")}
                    aria-label={t("auth.login.password")}
                    className={`${fieldCls("password", true)} !pl-11 !pr-11`}
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
                {password && (
                  <div className="mt-1 flex items-center gap-2 px-1" aria-hidden="true">
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            strength >= i ? strengthColors[strength] : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="w-11 text-right text-[9.5px] font-bold uppercase tracking-wider text-slate-500">
                      {strengthLabels[strength]}
                    </span>
                  </div>
                )}
                {renderFieldError("password")}
              </div>

              {/* Confirm password */}
              <div>
                <label htmlFor="su-confirm" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">Confirm password</label>
                <div className="relative">
                  <ShieldCheck size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="su-confirm"
                    type={showConfirm ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: "" })); }}
                    placeholder={t("auth.signup.confirmPasswordPlaceholder")}
                    aria-label={t("auth.signup.confirmPassword")}
                    className={`${fieldCls("confirmPassword", true)} !pl-11 !pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                  >
                    {showConfirm ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
                {renderFieldError("confirmPassword")}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-extrabold text-white transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f57224] disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "linear-gradient(180deg,#ff8a3d 0%,#f57224 55%,#e2641b 100%)" }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    {t("auth.signup.signingUp")}
                  </>
                ) : (
                  <>
                    {t("auth.login.createAccount")}
                    <ArrowRight size={16} aria-hidden="true" />
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-2.5 py-0.5" aria-hidden="true">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[9px] font-medium text-slate-400">or continue with</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Google continue */}
              {GOOGLE_CLIENT_ID ? (
                <div className="flex flex-col items-center gap-1.5">
                  <LazyGoogleLogin
                    clientId={GOOGLE_CLIENT_ID}
                    onSuccess={(res) => handleGoogle(res.credential)}
                    onError={() => toast.error(t("auth.login.googleFailed"))}
                    theme="outline"
                    size="medium"
                    text="continue_with"
                    shape="pill"
                    width="300"
                  />
                </div>
              ) : (
                <p className="text-center text-[10.5px] text-slate-400">{t("auth.login.googleUnavailable")}</p>
              )}

              {/* Secure + sign-in */}
              <p className="flex items-center justify-center gap-1.5 text-[9.5px] font-medium text-slate-400">
                <ShieldCheck size={11} aria-hidden="true" />
                Your information is secure
              </p>
              <p className="text-center text-[11px] text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="font-extrabold text-[#f57224] hover:underline"
                >
                  Sign in
                </button>
              </p>
            </form>

          )}
        </div>
      </div>
    </main>
  );
}
