"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  ArrowLeft,
  Truck,
  Store,
  ShoppingBag,
  ShoppingCart,
  Check,
  Building2,
  FileText,
  Globe,
  MapPin,
  Building,
} from "lucide-react";
import { authApi, getApiErrorMessage, isValidEmail } from "@/apis/user/authApi";
import { isValidPhone, normalizePhone, PHONE_MIN, PHONE_MAX } from "@/utils/phoneValidator";
import { compressImage } from "@/utils/compressImage";
import OtpVerifyCard from "@/components/user/OtpVerifyCard";
import LazyGoogleLogin from "@/components/user/LazyGoogleLogin";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";

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
const BUSINESS_CATEGORIES = [
  "Electronics",
  "Fashion & Apparel",
  "Home & Kitchen",
  "Beauty & Personal Care",
  "Sports & Outdoors",
  "Grocery & Food",
  "Baby & Kids",
  "Automotive",
  "Health & Wellness",
  "Books & Stationery",
  "Services",
  "Other",
];

const COUNTRIES = [
  "Pakistan",
  "India",
  "Bangladesh",
  "Sri Lanka",
  "United Arab Emirates",
  "Saudi Arabia",
  "Qatar",
  "Oman",
  "Kuwait",
  "Bahrain",
  "United Kingdom",
  "United States",
  "Canada",
  "Germany",
  "France",
  "Australia",
  "Turkey",
  "Malaysia",
  "Singapore",
  "Egypt",
];

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

  const [step, setStep] = useState("account"); // account | store | otp | welcome
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

  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [businessCategory, setBusinessCategory] = useState("");
  const [country, setCountry] = useState("Pakistan");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [storeLogo, setStoreLogo] = useState("");

  const inputBase =
    "w-full h-11 rounded-xl bg-[#f5f5f6] border pl-11 text-[14px] text-slate-900 placeholder:text-slate-400 outline-none transition";
  const fieldCls = (field, withToggle = false) =>
    `${inputBase} ${withToggle ? "pr-10" : "pr-4"} ${
      errors[field]
        ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-100"
        : "border-[#e5e5e7] focus:border-[#f57224] focus:ring-2 focus:ring-[#f57224]/15"
    }`;

  const pickLogo = async (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    e.target.value = "";
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Logo must be a JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image is too large — please pick one under 15MB.");
      return;
    }
    try {
      const compressed = await compressImage(file, { maxSize: 512, quality: 0.82 });
      setStoreLogo(compressed);
    } catch {
      toast.error("Logo could not be processed. Please try another image.");
    }
  };

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
    for (const key of ["name", "username", "phone", "email", "password", "storeName", "storeDescription", "businessCategory", "country", "city", "address", "zipCode"]) {
      if (fieldErrors[key]) nextErrors[key] = String(fieldErrors[key]);
    }
    setErrors((prev) => ({ ...prev, ...nextErrors }));
    setGeneralError(Object.keys(nextErrors).length === 0 && message ? message : "");
  };

  const validateAccount = () => {
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

  const validateStore = () => {
    const next = {};
    if (!storeName.trim()) next.storeName = "Please enter your store name.";
    if (!storeDescription.trim() || storeDescription.trim().length < 10) next.storeDescription = "Please describe your store (at least 10 characters).";
    if (!businessCategory) next.businessCategory = "Please select a business category.";
    if (!country) next.country = "Please select a country.";
    if (!city.trim() || city.trim().length < 2) next.city = "Please enter your city.";
    if (!address.trim() || address.trim().length < 5) next.address = "Please enter a complete store address.";
    return next;
  };

  const validate = () => ({ ...validateAccount(), ...validateStore() });

  const handleNext = () => {
    const nextErrors = validateAccount();
    setErrors(nextErrors);
    setGeneralError("");
    if (Object.keys(nextErrors).length > 0) return;
    setErrors({});
    setStep("store");
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
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
        wantsStore: true,
        storeName: storeName.trim(),
        storeDescription: storeDescription.trim(),
        businessCategory,
        country,
        city: city.trim(),
        address: address.trim(),
        zipCode: zipCode.trim(),
        ...(storeLogo ? { storeLogo } : {}),
      });
        if (res?.pendingApproval) {
          // Same email + password as the pending application → welcome, then /admin (read-only)
          setPendingApproval(true);
          setWelcomeTarget("/admin");
          setStep("welcome");
          setLoading(false);
          return;
        }
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
      if (data?.code === "SELLER_PENDING") {
        // Yeh email pehle se apply kar chuka hai — form par hi bata do (approval par email aayegi)
        const msg = data?.message || "Your application is already under review. We will email you once it is approved.";
        toast.info(msg);
        setGeneralError(msg);
        setLoading(false);
        return;
      }
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

  const [welcomeTarget, setWelcomeTarget] = useState("/");
  const [pendingApproval, setPendingApproval] = useState(false);

  const handleVerify = async (otp) => {
    const res = await authApi.verifyEmailOtp(otpEmail, otp);

    if (res?.pendingApproval) {
      // Seller signed up — send them into the admin panel (read-only until approval)
      setPendingApproval(true);
      setWelcomeTarget("/admin");
    } else {
      setWelcomeTarget("/");
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
      window.location.assign(welcomeTarget);
    }, 2800);
    return () => window.clearTimeout(id);
  }, [step, welcomeTarget]);

  /* ═══════════ WELCOME / REDIRECTING OVERLAY ═══════════ */
  if (step === "welcome") {
    const title = pendingApproval ? t("auth.signup.pendingTitle") : t("auth.signup.successTitle");
    const subtitle = pendingApproval ? t("auth.signup.pendingSubtitle") : t("auth.signup.successSubtitle");
    return (
      <main
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#070b12] px-6 text-center text-white"
      >
        {/* Ambient background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse 90% 60% at 50% 42%, rgba(245,114,36,0.18) 0%, rgba(245,114,36,0.05) 38%, transparent 70%)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.055) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        {/* Horizon line accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/2 h-px w-[80%] -translate-x-1/2"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,154,77,0.45), transparent)" }}
        />

        {/* Brand row */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f57224] shadow-[0_8px_24px_rgba(245,114,36,0.35)]">
            <ShoppingBag size={17} strokeWidth={2.25} className="text-white" aria-hidden="true" />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[15px] font-extrabold tracking-tight text-white">ClickMaster</span>
            <span className="block text-[8px] font-bold uppercase tracking-[0.22em] text-[#ff9a4d]">Marketplace</span>
          </span>
        </div>

        {/* Success emblem — layered glow */}
        <div className="relative z-10 mt-8 flex items-center justify-center" aria-hidden="true">
          <span className="absolute h-36 w-36 rounded-full bg-emerald-400/[0.07] blur-2xl" />
          <span className="absolute h-28 w-28 rounded-full border border-emerald-400/15" />
          <span className="absolute h-24 w-24 rounded-full border border-emerald-400/25" />
          <motion.svg viewBox="0 0 96 96" className="relative h-24 w-24" fill="none">
            <motion.circle
              cx="48"
              cy="48"
              r="42"
              stroke="#34d399"
              strokeOpacity="0.9"
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ pathLength: 0, rotate: -90 }}
              animate={{ pathLength: 1, rotate: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: "center" }}
            />
            <motion.path
              d="M31 50 L43 62 L67 38"
              stroke="#34d399"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.65, duration: 0.55, ease: "easeOut" }}
            />
          </motion.svg>
        </div>

        {/* Status chip */}
        {pendingApproval ? (
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
            className="relative z-10 mt-6 inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 py-1 pl-1.5 pr-4 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300"
          >
            <ShieldCheck size={12} aria-hidden="true" />
            Pending approval
          </motion.span>
        ) : null}

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5, ease: "easeOut" }}
          className="relative z-10 mt-4 max-w-2xl text-balance text-[28px] font-extrabold leading-[1.15] tracking-tight text-white sm:text-4xl"
        >
          {title}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5, ease: "easeOut" }}
          className="relative z-10 mt-3 max-w-md text-[13.5px] leading-6 text-slate-400"
        >
          {subtitle}
        </motion.p>

        {/* What happens next — seller flow */}
        {pendingApproval ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.5, ease: "easeOut" }}
            className="relative z-10 mt-6 flex flex-col items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.04] px-6 py-4"
          >
            <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-slate-500">What happens next</p>
            <p className="max-w-[420px] text-[12px] leading-5 text-slate-300">
              Your store is submitted for review. Until the Super Admin approves it, the admin panel is
              <span className="font-semibold text-white"> view-only</span> — you can browse every page but cannot change anything.
            </p>
          </motion.div>
        ) : null}

        {/* Progress */}
        <div className="relative z-10 mt-8 flex h-1 w-56 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <motion.div
            className="h-full w-full rounded-full bg-gradient-to-r from-[#FF6A1F] via-[#FFB25E] to-[#FF6A1F]"
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ delay: 0.3, duration: 1.6, ease: "easeInOut", repeat: Infinity }}
            style={{ width: "55%" }}
          />
        </div>
        <p className="relative z-10 mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
          <Loader2 size={12} className="animate-spin text-[#ff9a4d]" aria-hidden="true" />
          Opening your {pendingApproval ? "admin panel" : "marketplace"}…
        </p>
        <p className="relative z-10 mt-6 flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.28em] text-slate-700">
          <ShieldCheck size={11} aria-hidden="true" />
          Secure · ClickMaster Marketplace
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
              {step === "store" ? "Tell us about your store" : "Create your account"}
            </h2>
            <p className="mt-1 text-[12.5px] leading-5 text-slate-500">
              {step === "store" ? "This takes under a minute." : "Join the marketplace in two quick steps."}
            </p>
          </div>

          {/* Step indicator */}
          {(step === "account" || step === "store") && (
            <ol className="mt-4 flex items-center justify-center gap-2" aria-label="Signup progress">
              {[
                { n: 1, label: "Account", active: step === "account", done: step === "store" },
                { n: 2, label: "Your store", active: step === "store", done: false },
              ].map((s, i) => (
                <li key={s.n} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden="true" className={`h-px w-8 sm:w-12 transition-colors ${step === "store" ? "bg-[#f57224]" : "bg-slate-200"}`} />}
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10.5px] font-extrabold transition-colors ${
                        s.done
                          ? "bg-[#f57224] text-white"
                          : s.active
                            ? "bg-[#f57224] text-white shadow-[0_0_0_4px_rgba(245,114,36,0.18)]"
                            : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {s.done ? <Check size={13} strokeWidth={3} /> : s.n}
                    </span>
                    <span className={`text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${s.active || s.done ? "text-slate-800" : "text-slate-400"}`}>
                      {s.label}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}

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
                onBack={() => setStep("account")}
                backLabel={t("auth.signup.title")}
              />
            </div>
          )}

          {/* ═══ STEP 1: ACCOUNT ═══ */}
          {step === "account" && (
            <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="mt-3 space-y-2" noValidate>
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
                    placeholder="0300 1234567"
                    aria-label={t("auth.login.phoneNumber")}
                    className={`${fieldCls("phone")} !pl-11`}
                  />
                </div>
                {renderFieldError("phone") || (
                  <p className="mt-1 px-1 text-[10px] font-medium text-slate-400">Digits only, 10–16 characters — used for delivery and order updates.</p>
                )}
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

              {/* Next */}
              <button
                type="submit"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[14px] font-extrabold text-white transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f57224]"
                style={{ background: "linear-gradient(180deg,#ff8a3d 0%,#f57224 55%,#e2641b 100%)" }}
              >
                Next
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </form>
          )}

          {/* ═══ STEP 2: YOUR STORE ═══ */}
          {step === "store" && (
            <form onSubmit={handleSubmit} className="mt-3 space-y-2" noValidate>

              {/* Store name */}
              <div>
                <label htmlFor="su-store-name" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">Store name</label>
                <div className="relative">
                  <Store size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="su-store-name"
                    type="text"
                    autoComplete="organization"
                    value={storeName}
                    onChange={(e) => { setStoreName(e.target.value); setErrors((p) => ({ ...p, storeName: "" })); }}
                    placeholder="e.g. Ahmed Electronics"
                    className={`${fieldCls("storeName")} !pl-11`}
                  />
                </div>
                {renderFieldError("storeName")}
              </div>

              {/* Store description */}
              <div>
                <label htmlFor="su-store-desc" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">What will you sell?</label>
                <div className="relative">
                  <FileText size={15} className="pointer-events-none absolute left-3.5 top-4 text-slate-400" aria-hidden="true" />
                  <textarea
                    id="su-store-desc"
                    rows={2}
                    maxLength={2000}
                    value={storeDescription}
                    onChange={(e) => { setStoreDescription(e.target.value); setErrors((p) => ({ ...p, storeDescription: "" })); }}
                    placeholder="Brief description of your store (at least 10 characters)"
                    className={`${fieldCls("storeDescription")} !pl-11 !h-auto py-3`}
                  />
                </div>
                {renderFieldError("storeDescription")}
              </div>

              {/* Category */}
              <div>
                <label htmlFor="su-business-category" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">Category</label>
                <div className="relative">
                  <Building size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <select
                    id="su-business-category"
                    value={businessCategory}
                    onChange={(e) => { setBusinessCategory(e.target.value); setErrors((p) => ({ ...p, businessCategory: "" })); }}
                    className={`${fieldCls("businessCategory")} appearance-none !pl-11`}
                  >
                    <option value="">Select category</option>
                    {BUSINESS_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                {renderFieldError("businessCategory")}
              </div>

              {/* Country + city + zip */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="su-country" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">Country</label>
                  <div className="relative">
                    <Globe size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <select
                      id="su-country"
                      value={country}
                      onChange={(e) => { setCountry(e.target.value); setErrors((p) => ({ ...p, country: "" })); }}
                      className={`${fieldCls("country")} appearance-none !pl-11`}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  {renderFieldError("country")}
                </div>
                <div className="grid grid-cols-[1fr_92px] gap-2">
                  <div>
                    <label htmlFor="su-city" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">City</label>
                    <div className="relative">
                      <MapPin size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                      <input
                        id="su-city"
                        type="text"
                        value={city}
                        onChange={(e) => { setCity(e.target.value); setErrors((p) => ({ ...p, city: "" })); }}
                        placeholder="Lahore"
                        className={`${fieldCls("city")} !pl-11`}
                      />
                    </div>
                    {renderFieldError("city")}
                  </div>
                  <div>
                    <label htmlFor="su-zip" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">ZIP</label>
                    <input
                      id="su-zip"
                      type="text"
                      inputMode="numeric"
                      maxLength={20}
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value)}
                      placeholder="54000"
                      className={fieldCls("zipCode")}
                      style={{ paddingLeft: "0.75rem" }}
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <label htmlFor="su-address" className="mb-1.5 block text-[11px] font-extrabold text-slate-700">Store address</label>
                <div className="relative">
                  <MapPin size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                  <input
                    id="su-address"
                    type="text"
                    autoComplete="street-address"
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); setErrors((p) => ({ ...p, address: "" })); }}
                    placeholder="Street, area, Lahore"
                    className={`${fieldCls("address")} !pl-11`}
                  />
                </div>
                {renderFieldError("address")}
              </div>

              {/* Store logo (optional) */}
              <div>
                <span className="mb-1.5 block text-[11px] font-extrabold text-slate-700">Store logo <span className="font-medium text-slate-400">(optional)</span></span>
                <div className="flex items-center gap-3">
                  <div
                    aria-hidden="true"
                    className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#e5e5e7] bg-[#f5f5f6] text-slate-400"
                  >
                    {storeLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={storeLogo} alt="Store logo preview" className="h-full w-full object-contain" />
                    ) : (
                      <Building2 size={20} />
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <label
                      htmlFor="su-store-logo"
                      className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#e5e5e7] bg-white px-3 text-[12px] font-bold text-slate-700 transition hover:border-[#f57224] hover:text-[#e2641b]"
                    >
                      {storeLogo ? "Change logo" : "Upload logo"}
                    </label>
                    <p className="text-[9.5px] text-slate-400">JPG, PNG or WEBP — any size, we optimize it</p>
                    {storeLogo && (
                      <button type="button" onClick={() => setStoreLogo("")} className="text-[10px] font-bold text-red-500 hover:underline">
                        Remove logo
                      </button>
                    )}
                  </div>
                  <input id="su-store-logo" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={pickLogo} className="sr-only" />
                </div>
              </div>

              {/* Back + Create account */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setStep("account"); setErrors({}); setGeneralError(""); }}
                  className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#e5e5e7] bg-white px-4 text-[13px] font-bold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[14px] font-extrabold text-white transition hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f57224] disabled:cursor-not-allowed disabled:opacity-60"
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
              </div>
            </form>
          )}

          {(step === "account" || step === "store") && (
            <div className="mt-3 space-y-2">
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
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
