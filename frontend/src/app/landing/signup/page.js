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
  LogIn,
  Truck,
  Languages,
  Zap,
} from "lucide-react";
import { storeApi } from "@/apis/user/storeApi";
import { authApi, getApiErrorMessage, isValidEmail } from "@/apis/user/authApi";
import { isValidPhone, normalizePhone, PHONE_MIN, PHONE_MAX } from "@/utils/phoneValidator";
import OtpVerifyCard from "@/components/user/OtpVerifyCard";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");

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
  const [agree, setAgree] = useState(false);
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
    "w-full h-12 rounded-xl bg-[var(--user-bg-input)] border pl-11 text-sm text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] outline-none transition";
  const fieldCls = (field, withToggle = false) =>
    `${inputBase} ${withToggle ? "pr-11" : "pr-4"} ${
      errors[field]
        ? "border-[var(--user-danger)] focus:border-[var(--user-danger)] focus:ring-2 focus:ring-[var(--user-danger)]/15"
        : "border-[var(--user-border)] focus:border-[var(--user-accent)] focus:ring-2 focus:ring-[var(--user-accent)]/15"
    }`;

  const renderFieldError = (field) => {
    if (!errors[field]) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1.5 px-1">
        <AlertCircle size={12} className="text-[var(--user-danger)] shrink-0" />
        <p className="text-[0.6875rem] font-semibold text-[var(--user-danger)]">{errors[field]}</p>
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
    if (!agree) next.agree = t("auth.login.termsNotice");
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
      setOtpEmail(target);
      setStep("otp");
      toast.success(t("auth.login.verificationSent", { email: target }));
      setLoading(false);
    } catch (err) {
      // Same "pending already exists / resend too early" path as the login page
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
      window.location.assign("/admin/dashboard");
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
    <main className="user-theme flex min-h-screen bg-[var(--user-bg)]">
      {/* ═══════════ LEFT — BRAND PANEL ═══════════ */}
      <div className="relative hidden lg:flex lg:w-[46%] xl:w-[52%] flex-col justify-between overflow-hidden border-r border-[var(--user-border)] bg-[var(--user-bg-elevated)] p-10 xl:p-14">
        <div aria-hidden="true" className="absolute -top-40 -left-40 h-[26rem] w-[26rem] rounded-full bg-[var(--user-accent)]/10 blur-3xl" />
        <div aria-hidden="true" className="absolute -bottom-44 -right-40 h-[26rem] w-[26rem] rounded-full bg-[var(--user-accent)]/10 blur-3xl" />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />

        {/* Logo */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="relative flex w-max cursor-pointer items-center gap-3 transition hover:opacity-80"
          aria-label={`${storeNameDisplay} home page`}
        >
          <StoreLogo store={store} sizeClass="w-11 h-11" />
          <span className="text-lg font-black tracking-wide text-[var(--user-text)]">{storeNameDisplay}</span>
        </button>

        {/* Middle content */}
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--user-accent)]/25 bg-[var(--user-accent)]/10 px-4 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[var(--user-accent)]">
            <Zap size={12} aria-hidden="true" />
            {t("auth.signup.freeLine")}
          </span>
          <h1 className="mt-6 max-w-lg text-4xl font-black leading-[1.08] tracking-tight text-[var(--user-text)] xl:text-5xl">
            Create your store
            <br />
            <span className="bg-gradient-to-r from-[var(--user-accent)] to-amber-300 bg-clip-text text-transparent">
              in minutes.
            </span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-[var(--user-text-muted)]">
            {t("auth.signup.subtitle")}
          </p>

          <ul className="mt-8 space-y-4">
            {[
              { icon: Truck, label: t("auth.signup.featureA") },
              { icon: Languages, label: t("auth.signup.featureB") },
              { icon: Zap, label: t("auth.signup.featureC") },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--user-accent)]/25 bg-[var(--user-accent)]/10 text-[var(--user-accent)]">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold leading-5 text-[var(--user-text-secondary)]">{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom — trusted line */}
        <div className="relative flex items-center gap-4">
          <div className="flex -space-x-2.5" aria-hidden="true">
            {["AK", "BS", "FN", "UT", "HB"].map((initials, i) => (
              <span
                key={i}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--user-bg-elevated)] text-[9px] font-extrabold text-white"
                style={{ background: ["#FF6A1F", "#0369A1", "#7C3AED", "#059669", "#DB2777"][i] }}
              >
                {initials}
              </span>
            ))}
          </div>
          <p className="text-xs font-semibold leading-4 text-[var(--user-text-muted)]">{t("auth.signup.trustedLine")}</p>
        </div>
      </div>

      {/* ═══════════ RIGHT — FORM ═══════════ */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:px-10">
        <div className="w-full max-w-[460px]">
          {/* Mobile logo */}
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mb-6 flex lg:hidden items-center gap-2 transition hover:opacity-80"
            aria-label={`${storeNameDisplay} home page`}
          >
            <StoreLogo store={store} sizeClass="w-9 h-9" />
            <span className="text-base font-black tracking-wide text-[var(--user-text)]">{storeNameDisplay}</span>
          </button>

          {/* Header */}
          <div className="mb-6">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={16} className="text-[var(--user-accent)]" aria-hidden="true" />
              <span className="text-[0.625rem] font-bold uppercase tracking-widest text-[var(--user-accent)]">
                {t("auth.login.createAccount")}
              </span>
            </div>
            <h2 className="text-2xl font-black leading-tight text-[var(--user-text)] sm:text-3xl">
              {t("auth.signup.title")}
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-[var(--user-text-muted)]">{t("auth.signup.subtitle")}</p>
          </div>

          {generalError && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-[var(--user-danger)]/30 bg-[var(--user-danger)]/10 px-4 py-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--user-danger)]" aria-hidden="true" />
              <p className="text-sm text-[var(--user-danger)]">{generalError}</p>
            </div>
          )}

          {/* ═══ STEP: OTP ═══ */}
          {step === "otp" && (
            <OtpVerifyCard
              email={otpEmail}
              title={t("auth.signup.title")}
              onVerify={handleVerify}
              onResend={handleResend}
              onBack={() => setStep("form")}
              backLabel={t("auth.signup.title")}
            />
          )}

          {/* ═══ STEP: FORM ═══ */}
          {step === "form" && (
            <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
              {/* Name + username */}
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <div className="relative">
                    <User size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" aria-hidden="true" />
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
                      placeholder={t("auth.login.fullName")}
                      aria-label={t("auth.login.fullName")}
                      className={fieldCls("name")}
                    />
                  </div>
                  {renderFieldError("name")}
                </div>
                <div>
                  <div className="relative">
                    <AtSign size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" aria-hidden="true" />
                    <input
                      type="text"
                      required
                      autoComplete="username"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setErrors((p) => ({ ...p, username: "" })); }}
                      placeholder={t("auth.login.username")}
                      aria-label={t("auth.login.username")}
                      className={fieldCls("username")}
                    />
                  </div>
                  {renderFieldError("username")}
                </div>
              </div>

              {/* Phone */}
              <div>
                <div className="relative">
                  <Phone size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" aria-hidden="true" />
                  <input
                    type="tel"
                    required
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={PHONE_MAX}
                    value={phone}
                    onChange={(e) => {
                      setPhone(normalizePhone(e.target.value));
                      setErrors((p) => ({ ...p, phone: "" }));
                    }}
                    placeholder={t("auth.login.phoneNumber")}
                    aria-label={t("auth.login.phoneNumber")}
                    className={fieldCls("phone")}
                  />
                </div>
                {renderFieldError("phone")}
              </div>

              {/* Email */}
              <div>
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" aria-hidden="true" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
                    placeholder="you@example.com"
                    aria-label="Email"
                    className={fieldCls("email")}
                  />
                </div>
                {renderFieldError("email")}
              </div>

              {/* Password */}
              <div>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" aria-hidden="true" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "", confirmPassword: "" })); }}
                    placeholder={t("auth.login.password")}
                    aria-label={t("auth.login.password")}
                    className={fieldCls("password", true)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-subtle)] transition hover:text-[var(--user-text)]"
                  >
                    {showPassword ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2 flex items-center gap-2 px-1" aria-hidden="true">
                    <div className="flex flex-1 gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            strength >= i ? strengthColors[strength] : "bg-[var(--user-border)]"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="w-11 text-right text-[10px] font-bold uppercase tracking-wider text-[var(--user-text-muted)]">
                      {strengthLabels[strength]}
                    </span>
                  </div>
                )}
                {renderFieldError("password")}
              </div>

              {/* Confirm password */}
              <div>
                <div className="relative">
                  <ShieldCheck size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--user-accent)]" aria-hidden="true" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: "" })); }}
                    placeholder={t("auth.signup.confirmPasswordPlaceholder")}
                    aria-label={t("auth.signup.confirmPassword")}
                    className={fieldCls("confirmPassword", true)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-subtle)] transition hover:text-[var(--user-text)]"
                  >
                    {showConfirm ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
                  </button>
                </div>
                {renderFieldError("confirmPassword")}
              </div>

              {/* Terms — checkbox with the store's existing notice text */}
              <div>
                <label className="flex cursor-pointer items-start gap-2.5 px-1 py-1.5 select-none">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => { setAgree(e.target.checked); setErrors((p) => ({ ...p, agree: "" })); }}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#FF6A1F]"
                  />
                  <span className="text-xs leading-5 text-[var(--user-text-muted)]">
                    {t("auth.login.termsNotice")}
                  </span>
                </label>
                {renderFieldError("agree")}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--user-accent)] text-sm font-extrabold uppercase tracking-wider text-[var(--user-accent-text)] shadow-[0_10px_28px_rgba(255,106,31,0.32)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--user-accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    {t("auth.signup.signingUp")}
                  </>
                ) : (
                  <>
                    {t("auth.login.createAccount")}
                    <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </>
                )}
              </button>

              {/* Sign-in link */}
              <p className="pt-1 text-center text-xs text-[var(--user-text-muted)]">
                {t("auth.login.haveAccount")}{" "}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="inline-flex items-center gap-1 font-extrabold text-[var(--user-accent)] hover:underline"
                >
                  {t("auth.login.login")}
                  <LogIn size={12} aria-hidden="true" />
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
