"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStoreAdminUrl } from "@/apis/storeHandoff";
import SearchCombobox from "@/components/common/SearchCombobox";
import { ROOT_DOMAIN } from "@/lib/tenantHost";
import { BUSINESS_CATEGORIES, STORE_ADDRESS_MAX } from "@/lib/storeOptions";
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
  Store,
  ShoppingBag,
  ShoppingCart,
  Check,
  Building2,
  FileText,
  Globe,
  MapPin,
  Building,
  ChevronDown,
  ImagePlus,
  Trash2,
  RefreshCw,
  Hash,
  UserRound,
  BadgeCheck,
  LayoutDashboard,
  Link2,
  CheckCircle2,
} from "lucide-react";
import { authApi, getApiErrorMessage, isValidEmail } from "@/apis/user/authApi";
import { isValidPhone, normalizePhone, PHONE_MIN, PHONE_MAX } from "@/utils/phoneValidator";
import OtpVerifyCard from "@/components/user/OtpVerifyCard";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

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

/* ═══════════ SHARED DESIGN SYSTEM (dono steps same tokens use karte hain) ═══════════ */
const INPUT_BASE =
  "w-full h-11 rounded-xl border bg-white pl-11 pr-4 text-[14px] text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-[border-color,box-shadow,background-color] duration-150 disabled:cursor-not-allowed disabled:bg-slate-50";
const inputState = (hasError) =>
  hasError
    ? "border-red-300 bg-red-50/40 focus:border-red-400 focus:ring-4 focus:ring-red-500/10"
    : "border-slate-200 hover:border-slate-300 focus:border-[#f57224] focus:ring-4 focus:ring-[#f57224]/15";

/* Wizard card (Shopify/Stripe style) — white card on soft gray, actions footer bar me */
const CARD_SHELL = "mt-5 [@media(max-height:820px)]:mt-4 rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.14)]";
const CARD = "p-5 sm:p-6 [@media(max-height:820px)]:sm:p-5";
const CARD_FOOTER = "-mx-5 -mb-5 mt-2 flex rounded-b-2xl flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 sm:-mx-6 sm:-mb-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 [@media(max-height:820px)]:py-3 [@media(max-height:820px)]:sm:-mx-5 [@media(max-height:820px)]:sm:-mb-5 [@media(max-height:820px)]:sm:px-5";

const PRIMARY_BTN =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f57224] px-5 text-[14.5px] font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_6px_14px_-6px_rgba(245,114,36,0.45)] transition hover:bg-[#e8651a] active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f57224]/30 disabled:cursor-not-allowed disabled:bg-[#f57224]/55 disabled:shadow-none disabled:active:translate-y-0";
const SECONDARY_BTN =
  "inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50";

/* Field wrapper — label, icon, hint, error ek jaisi spacing ke saath.
   Component bahar define hai taake re-render par input focus na khoye. */
function Field({ id, label, optional, hint, error, icon: Icon, iconTop = false, counter, trailing, below, className = "", children }) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[12.5px] font-semibold text-slate-700">
          {label}
          {optional && <span className="ml-1 font-normal text-slate-400">(optional)</span>}
        </label>
        {counter}
      </div>
      <div className="group relative">
        {Icon && (
          <Icon
            size={16}
            aria-hidden="true"
            className={`pointer-events-none absolute left-3.5 z-[1] transition-colors ${
              iconTop ? "top-[15px]" : "top-1/2 -translate-y-1/2"
            } ${error ? "text-red-400" : "text-slate-400 group-focus-within:text-[#f57224]"}`}
          />
        )}
        {children}
        {trailing}
      </div>
      {below}
      {error ? (
        <p id={`${id}-error`} role="alert" data-tone="error" className="flex pt-1.5 items-start gap-1.5 text-[12px] font-medium leading-4 text-red-600">
          <AlertCircle size={13} className="mt-px shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="pt-1.5 text-[11.5px] leading-4 text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

const fieldA11y = (id, error, hasHint = false) => ({
  id,
  "aria-invalid": error ? "true" : undefined,
  "aria-describedby": error ? `${id}-error` : hasHint ? `${id}-hint` : undefined,
});

function SectionHeading({ icon: Icon, title, description }) {
  return (
    /* Compact heading — group saaf dikhe lekin vertical jagah kam le */
    <div className="mb-3 flex items-center gap-2.5">
      <span data-tone="accent" aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f57224]/10 text-[#f57224]">
        <Icon size={15} strokeWidth={2} />
      </span>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
        <h3 className="text-[14px] font-semibold leading-5 text-slate-900">{title}</h3>
        <p className="text-[11.5px] leading-4 text-slate-400">{description}</p>
      </div>
    </div>
  );
}

/* Connected stepper — ek compact row (node + label, beech me connector).
   done / active / upcoming teeno states alag dikhte hain; dono steps par same. */
const SIGNUP_STEPS = [
  { label: "Account details", short: "Account", sub: "Login & location", desc: "Your login details and business location", icon: UserRound },
  { label: "Store setup", short: "Store", sub: "Details & web address", desc: "Your store name, web address and what you sell", icon: Store },
];


function SignupStepper({ currentIndex }) {
  const current = SIGNUP_STEPS[currentIndex] || SIGNUP_STEPS[0];
  const CurrentIcon = current.icon;
  // Card header: left icon tile + step title/desc · right numbered step chips (① Account — ② Store)
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 items-center gap-3.5">
        <span data-tone="accent" aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f57224]/10 text-[#f57224] ring-1 ring-[#f57224]/15">
          <CurrentIcon size={20} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-semibold leading-6 text-slate-900">{current.label}</h3>
          <p className="truncate text-[12.5px] leading-5 text-slate-500">{current.desc}</p>
        </div>
      </div>
      <nav aria-label="Signup progress" className="shrink-0">
        <ol className="flex items-center gap-2">
          {SIGNUP_STEPS.map((step, i) => {
            const status = i < currentIndex ? "done" : i === currentIndex ? "active" : "upcoming";
            return (
              <li key={step.label} aria-current={status === "active" ? "step" : undefined} className="flex items-center gap-2">
                {i > 0 && <span aria-hidden="true" className={`h-px w-6 ${status === "upcoming" ? "bg-slate-200" : "bg-[#f57224]/50"}`} />}
                <span
                  data-tone="accent"
                  className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-[12.5px] font-semibold ring-1 transition-colors ${
                    status === "active"
                      ? "bg-[#f57224]/10 text-[#c2541a] ring-[#f57224]/25"
                      : status === "done"
                        ? "bg-white text-slate-700 ring-slate-200"
                        : "bg-white text-slate-400 ring-slate-200"
                  }`}
                >
                  <span
                    data-tone="accent"
                    aria-hidden="true"
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                      status === "upcoming" ? "bg-slate-100 text-slate-400" : status === "done" ? "bg-emerald-500 text-white" : "bg-[#f57224] text-white"
                    }`}
                  >
                    {status === "done" ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  {step.short}
                  <span className="sr-only"> — {status === "done" ? "completed" : status === "active" ? "current step" : "upcoming"}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

function BrandMark({ size = "lg" }) {
  const big = size === "lg";
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className={`flex items-center justify-center rounded-xl bg-[#f57224] shadow-[0_8px_20px_-4px_rgba(245,114,36,0.55)] ${big ? "h-11 w-11" : "h-9 w-9"}`}
      >
        <ShoppingBag size={big ? 22 : 18} strokeWidth={2.25} className="text-white" />
      </span>
      <span className="text-left leading-tight">
        <span className={`block font-bold tracking-tight ${big ? "text-[20px] text-white" : "text-[16px] text-slate-900"}`}>ClickMaster</span>
        <span data-tone="accent" className={`block font-bold uppercase tracking-[0.22em] text-[#f57224] ${big ? "text-[10px]" : "text-[9px]"}`}>Marketplace</span>
      </span>
    </div>
  );
}

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
  const [checking, setChecking] = useState(false); // step 1 → server par email/username/phone availability
  const [emailPending, setEmailPending] = useState(false); // email ki application already under review
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
  // Store web address — seller khud likhta hai (live availability check)
  const [subdomain, setSubdomain] = useState("");
  const [subdomainCheck, setSubdomainCheck] = useState({ state: "idle", value: "", suggestion: "" }); // idle | checking | available | taken


  /* Desktop par window scroll nahi hota — step badalne par right panel ko top par le jao */
  const formPanelRef = useRef(null);
  useEffect(() => {
    formPanelRef.current?.scrollTo?.({ top: 0 });
  }, [step]);

  /* Countries + cities dono country-state-city library se. Library account step par
     ek baar lazy load hoti hai (~8MB city data signup ke initial bundle me nahi aata). */
  const [geo, setGeo] = useState(null); // { Country, City } | { failed: true }
  useEffect(() => {
    if (step !== "account" || geo) return undefined;
    let cancelled = false;
    import("country-state-city")
      .then(({ Country, City }) => { if (!cancelled) setGeo({ Country, City }); })
      .catch(() => { if (!cancelled) setGeo({ failed: true }); }); // fail ho to free text chalta rahe
    return () => { cancelled = true; };
  }, [step, geo]);

  const allCountries = useMemo(() => (geo?.Country ? geo.Country.getAllCountries() : []), [geo]);
  // Load hone tak selected country hi option rahe (select khali na dikhe).
  // Flag emoji nahi — Windows Chrome unhe "PK" jaise letters me dikhata hai.
  const countryOptions = useMemo(
    () => (allCountries.length ? allCountries.map((c) => c.name) : [country]),
    [allCountries, country]
  );
  const cityOptions = useMemo(() => {
    if (!geo?.City) return [];
    const match = allCountries.find((c) => c.name === country);
    const list = match ? geo.City.getCitiesOfCountry(match.isoCode) || [] : [];
    // Library me ek naam kai states me repeat hota hai — unique + A–Z
    return [...new Set(list.map((c) => c.name))].sort((a, b) => a.localeCompare(b));
  }, [geo, allCountries, country]);
  const citiesLoading = step === "account" && !geo;

  /* Web address ki live availability (400ms debounce) — server format + reserved + taken check karta hai */
  useEffect(() => {
    const value = subdomain.trim();
    if (step !== "store" || value.length < 3) return undefined;
    const id = window.setTimeout(async () => {
      setSubdomainCheck({ state: "checking", value, suggestion: "" });
      try {
        const res = await authApi.checkRegistration({ subdomain: value, ...(isValidEmail(email) ? { email: email.trim().toLowerCase() } : {}) });
        const error = res?.errors?.subdomain;
        setSubdomainCheck({ state: error ? "taken" : "available", value, suggestion: res?.subdomainSuggestion || "" });
        setErrors((p) => ({ ...p, subdomain: error || "" }));
      } catch {
        setSubdomainCheck({ state: "idle", value, suggestion: "" }); // network fail — submit par dobara check hota hai
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [subdomain, step, email]);

  // Web address seller khud likhta hai — store naam se auto-fill nahi
  const changeStoreName = (value) => {
    setStoreName(value);
    setErrors((p) => ({ ...p, storeName: "" }));
  };
  const changeSubdomain = (value) => {
    // Sirf a-z 0-9 aur hyphen — type karte waqt hi saaf
    const clean = String(value).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, STORE_ADDRESS_MAX);
    setSubdomain(clean);
    setErrors((p) => ({ ...p, subdomain: "" }));
    setSubdomainCheck({ state: "idle", value: "", suggestion: "" });
  };

  const fieldCls = (field, withToggle = false) =>
    `${INPUT_BASE} ${withToggle ? "!pr-11" : ""} ${inputState(!!errors[field])}`;

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
    for (const key of ["name", "username", "phone", "email", "password", "storeName", "subdomain", "storeDescription", "businessCategory", "country", "city", "address", "zipCode"]) {
      if (fieldErrors[key]) nextErrors[key] = String(fieldErrors[key]);
    }
    setErrors((prev) => ({ ...prev, ...nextErrors }));
    setGeneralError(Object.keys(nextErrors).length === 0 && message ? message : "");
    goToErrorStep(nextErrors);
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

  /* Store info ab do wizard steps me hai — rules bilkul wahi, sirf split kiye hain */
  const validateStoreDetails = () => {
    const next = {};
    if (!storeName.trim()) next.storeName = "Please enter your store name.";
    if (!storeDescription.trim()) next.storeDescription = "Please describe your store.";
    if (!businessCategory) next.businessCategory = "Please select a business category.";
    const sub = subdomain.trim();
    if (!sub) next.subdomain = "Please choose your store web address.";
    else if (sub.length < 3) next.subdomain = "Store address must be at least 3 characters.";
    else if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(sub)) next.subdomain = "Use only lowercase letters, numbers and hyphens (not at the start or end).";
    else if (subdomainCheck.value === sub && subdomainCheck.state === "taken") next.subdomain = errors.subdomain || "This store address is already taken.";
    return next;
  };

  const validateLocation = () => {
    const next = {};
    if (!country) next.country = "Please select a country.";
    if (!city.trim() || city.trim().length < 2) next.city = "Please enter your city.";
    if (!address.trim() || address.trim().length < 5) next.address = "Please enter a complete store address.";
    return next;
  };

  const validateStore = () => ({ ...validateStoreDetails(), ...validateLocation() });

  const validate = () => ({ ...validateAccount(), ...validateStore() });

  /* Step 1 (account + location) ke fields — store step par inka error aaye to banner wapas bhejta hai */
  const ACCOUNT_FIELD_KEYS = ["name", "username", "phone", "email", "password", "confirmPassword", "country", "city", "address", "zipCode"];
  const goToErrorStep = () => {}; // store aakhri step hai — account errors ke liye banner "Go to account step"

  /* Server se poochho: email / username / phone pehle se registered to nahi?
     Network fail ho to block nahi karte — final submit waise bhi dobara check karta hai. */
  const checkAvailability = async (fields) => {
    try {
      const res = await authApi.checkRegistration(fields);
      const found = res?.errors || {};
      setEmailPending(res?.code === "SELLER_PENDING");
      if (Object.keys(found).length) setErrors((p) => ({ ...p, ...found }));
      return found;
    } catch {
      return {};
    }
  };

  const checkFieldOnBlur = (field, value) => {
    const clean = String(value || "").trim();
    if (!clean || errors[field]) return;
    if (field === "email" && !isValidEmail(clean)) return;
    if (field === "username" && !/^[A-Za-z0-9_]{3,30}$/.test(clean)) return;
    checkAvailability({ [field]: clean });
  };

  const handleNext = async () => {
    const nextErrors = { ...validateAccount(), ...validateLocation() };
    setErrors(nextErrors);
    setGeneralError("");
    if (Object.keys(nextErrors).length > 0) return;
    // Step 1 se aage tabhi jab server bhi keh de ke email/username/phone free hain
    setChecking(true);
    const taken = await checkAvailability({ name: name.trim(), email: email.trim().toLowerCase(), username: username.trim(), phone });
    setChecking(false);
    if (Object.keys(taken).length > 0) return;
    setErrors({});
    setStep("store");
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    setGeneralError("");
    if (Object.keys(nextErrors).length > 0) {
      goToErrorStep(nextErrors);
      return;
    }
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
        subdomain: subdomain.trim(),
        storeDescription: storeDescription.trim(),
        businessCategory,
        country,
        city: city.trim(),
        address: address.trim(),
        zipCode: zipCode.trim(),
      });
        if (res?.pendingApproval) {
          // Same email + password as the pending application → welcome, then /admin (read-only)
          setPendingApproval(true);
          // Multi-tenant: admin sirf store subdomain par → one-time sign-in link
          setWelcomeTarget((await getStoreAdminUrl()) || "/");
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
      // Generic "Registration failed" ke bajaye asli field error dikhao (e.g. "This email is already registered")
      const firstFieldError = Object.values(err?.response?.data?.errors || {}).find((m) => typeof m === "string" && m.trim());
      toast.error(firstFieldError || getApiErrorMessage(err, t("auth.login.registrationFailed")));
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
      // Multi-tenant: admin sirf store subdomain par → one-time sign-in link
          setWelcomeTarget((await getStoreAdminUrl()) || "/");
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
  const isWizardStep = step === "account" || step === "store";
  const stepIndex = step === "account" ? 0 : 1;
  const accountHasErrors = step === "store" && ACCOUNT_FIELD_KEYS.some((k) => errors[k]);

  const HEADERS = {
    account: { title: "Create your seller account", subtitle: "Start selling on ClickMaster in two quick steps." },
    store: { title: "Set up your store", subtitle: "Your store name, web address and what you sell." },
    otp: { title: "Verify your email", subtitle: "Enter the code we sent to finish creating your account." },
  };
  const header = HEADERS[step] || HEADERS.account;

  return (
    /* Desktop (lg+): main exactly viewport height — window scroll nahi hota,
       sirf right panel apne andar scroll karta hai. Mobile/tablet: natural page scroll. */
    <main className="user-theme signup-reference-page flex min-h-dvh bg-white lg:h-dvh lg:min-h-0">
      {/* ═══════════ LEFT — NAVY BRAND PANEL (lg+, stationary) ═══════════ */}
      <div className="relative hidden h-full shrink-0 overflow-hidden bg-[#0b1430] text-white lg:flex lg:w-[42%] xl:w-[44%] 2xl:w-[46%]">
        {/* Background layers: navy gradient + orange glow + faded artwork + dot grid */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: "linear-gradient(155deg, #0d1834 0%, #0a1229 55%, #070d1f 100%)" }}
        />
        <div
          aria-hidden="true"
          className="absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(245,114,36,0.20) 0%, transparent 62%)" }}
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -left-24 h-[480px] w-[480px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(59,91,219,0.16) 0%, transparent 65%)" }}
        />
        {/* Warehouse artwork — sirf neeche-daayen halki texture, text ke peeche nahi */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center opacity-[0.18]"
          style={{
            backgroundImage: "url(/landing/fulfillment-hub.png)",
            maskImage: "linear-gradient(to top left, black 0%, transparent 60%)",
            WebkitMaskImage: "linear-gradient(to top left, black 0%, transparent 60%)",
          }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "linear-gradient(to bottom, black 0%, transparent 85%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 85%)",
          }}
        />

        {/* Simple: logo top · message center · footer bottom */}
        <div className="relative flex min-h-0 w-full flex-col px-10 py-10 xl:px-14 xl:py-12 [@media(max-height:700px)]:py-7">
          <BrandMark />

          <div className="my-auto w-full max-w-[440px] py-8">
            <h1 className="text-[clamp(30px,2.6vw,40px)] font-bold leading-[1.15] tracking-[-0.02em] text-white">
              Launch your store.
              <span className="block text-[#ff9a4d]">Grow with confidence.</span>
            </h1>
            <p className="pt-4 text-[15px] leading-[1.65] text-slate-300">
              Create your seller account and manage your storefront, orders and POS from one dashboard.
            </p>

            <ul className="mt-9 space-y-5 [@media(max-height:700px)]:mt-7 [@media(max-height:700px)]:space-y-4">
              {[
                { icon: Store, text: "Your own branded storefront" },
                { icon: LayoutDashboard, text: "Admin panel and POS in one place" },
                { icon: ShieldCheck, text: "Secure, verified seller accounts" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3.5">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-[#ff9a4d]"
                  >
                    <Icon size={17} />
                  </span>
                  <span className="text-[14.5px] font-medium text-slate-200">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[12px] text-slate-500">© {new Date().getFullYear()} ClickMaster Marketplace</p>
        </div>
      </div>

      {/* ═══════════ RIGHT — FORM ═══════════ */}
      {/* Desktop par yahi independent scroll container hai. justify-center ki jagah
          auto margins (mt-auto / mb-auto) — content lamba ho to top clip nahi hota. */}
      {/* "Full panel" layout (Shopify/Stripe style): poora right side white page,
          form bina card ke beech me; top (Sign in) aur bottom (footer) anchored. */}
      <div
        ref={formPanelRef}
        className="flex min-w-0 flex-1 flex-col items-center bg-white px-5 lg:bg-slate-50 sm:px-10 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:[scrollbar-gutter:stable_both-edges] xl:px-14"
      >
        {/* Top bar — sirf mobile par brand ("Sign in" ab card ke neeche) */}
        <header className="flex w-full shrink-0 items-center py-4 lg:hidden">
          <BrandMark size="sm" />
        </header>

        {/* Form — box nahi, sirf controlled width; my-auto = space ho to vertically center */}
        {/* Wizard steps wide (multi-column, desktop par scroll nahi); OTP card narrow */}
        <div className={`my-auto w-full shrink-0 py-4 ${isWizardStep ? "max-w-[760px]" : "max-w-[460px] 2xl:max-w-[500px]"}`}>
          {/* Step number stepper me already hai — alag eyebrow pill ki zaroorat nahi */}
          <div className="text-center">
            <h2 className="[@media(max-height:820px)]:text-[22px] text-[26px] font-bold leading-tight tracking-[-0.02em] text-slate-900 2xl:text-[30px]">{header.title}</h2>
            <p className="pt-1.5 text-[14px] leading-5 text-slate-500">{header.subtitle}</p>
          </div>

          {/* Ek hi card: upar steps ki strip, phir form, neeche actions */}
          <div className={isWizardStep ? CARD_SHELL : ""}>
          {isWizardStep && (
            <div className="rounded-t-2xl border-b border-slate-100 px-5 py-4 sm:px-6">
              <SignupStepper currentIndex={stepIndex} />
            </div>
          )}

          {generalError && (
            <div role="alert" data-tone="error" className="mx-5 mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 sm:mx-6">
              <AlertCircle size={18} className="mt-px shrink-0 text-red-500" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-red-800">Something needs your attention</p>
                <p className="pt-0.5 text-[12.5px] leading-5 text-red-700">{generalError}</p>
              </div>
            </div>
          )}

          {/* Store step par account field ka backend error — user ko wapas le jao */}
          {accountHasErrors && (
            <div role="alert" data-tone="error" className="mx-5 mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:mx-6">
              <AlertCircle size={18} className="mt-px shrink-0 text-amber-600" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-amber-900">Please review your account details</p>
                <p className="pt-0.5 text-[12.5px] leading-5 text-amber-800">
                  {ACCOUNT_FIELD_KEYS.map((k) => errors[k]).find(Boolean)}
                </p>
                <button
                  type="button"
                  onClick={() => { setStep("account"); setGeneralError(""); }}
                  className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-semibold text-amber-900 underline-offset-2 hover:underline"
                >
                  <ArrowLeft size={13} aria-hidden="true" />
                  Go to account step
                </button>
              </div>
            </div>
          )}

          {/* ═══ STEP: OTP ═══ */}
          {step === "otp" && (
            <div className="mt-6">
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
            <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className={`${CARD} grid grid-cols-1 items-start gap-x-4 gap-y-3 md:grid-cols-2`} noValidate>
              {/* Har row me do fields: naam · username / phone · email / password · confirm */}
              <Field id="su-name" label="Full name" icon={User} error={errors.name}>
                <input
                  {...fieldA11y("su-name", errors.name)}
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: "" })); }}
                  placeholder="Enter your full name"
                  className={fieldCls("name")}
                />
              </Field>

              <div className="contents">
                <Field
                 
                  id="su-username"
                  label="Username"
                  optional
                  icon={AtSign}
                  error={errors.username}
                >
                  <input
                    {...fieldA11y("su-username", errors.username)}
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setErrors((p) => ({ ...p, username: "" })); }}
                    onBlur={(e) => checkFieldOnBlur("username", e.target.value)}
                    placeholder={t("auth.login.username")}
                    className={fieldCls("username")}
                  />
                </Field>

                <Field id="su-phone" label="Phone number" icon={Phone} error={errors.phone} counter={<span id="su-phone-hint" className="text-[11px] font-medium text-slate-400">{PHONE_MIN}–{PHONE_MAX} digits</span>}>
                  <input
                    {...fieldA11y("su-phone", errors.phone, true)}
                    type="tel"
                    required
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={PHONE_MAX}
                    value={phone}
                    onChange={(e) => { setPhone(normalizePhone(e.target.value)); setErrors((p) => ({ ...p, phone: "" })); }}
                    placeholder="0300 1234567"
                    className={fieldCls("phone")}
                  />
                </Field>
              </div>

                            <Field id="su-email" label="Email address" icon={Mail} error={errors.email}>
                {/* suppressHydrationWarning: temp-mail jaisi browser extensions is input par
                    attributes inject karti hain → dev overlay me false hydration "issue" */}
                <input
                  {...fieldA11y("su-email", errors.email)}
                  suppressHydrationWarning
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailPending(false); setErrors((p) => ({ ...p, email: "" })); }}
                  onBlur={(e) => checkFieldOnBlur("email", e.target.value)}
                  placeholder="you@example.com"
                  className={fieldCls("email")}
                />
              </Field>
              {/* Pending application wale email ke liye: error ke neeche sign-in shortcut */}
              {emailPending && errors.email ? (
                <button type="button" onClick={() => router.push("/admin/login")} className="-mt-1 inline-flex items-center gap-1 justify-self-start text-[12.5px] font-semibold text-[#f57224] hover:underline md:order-last md:col-span-2">
                  Sign in to continue your application <ArrowRight size={13} aria-hidden="true" />
                </button>
              ) : null}

              {/* Password + confirm ek row me (sm+) — 48px inputs, kam vertical height */}
              <div className="contents">
              <Field
               
                id="su-password"
                label="Password"
                icon={Lock}
                error={errors.password}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f57224]/40"
                  >
                    {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                }
                below={
                  password ? (
                    <div className="mt-2 flex items-center gap-3" aria-live="polite">
                      <div className="flex flex-1 gap-1" aria-hidden="true">
                        {[1, 2, 3, 4].map((i) => (
                          <span
                            key={i}
                            data-tone="accent"
                            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${strength >= i ? strengthColors[strength] : "bg-slate-200"}`}
                          />
                        ))}
                      </div>
                      <span className="min-w-[44px] text-right text-[11px] font-semibold text-slate-500">{strengthLabels[strength]}</span>
                    </div>
                  ) : null
                }
              >
                <input
                  {...fieldA11y("su-password", errors.password)}
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: "", confirmPassword: "" })); }}
                  placeholder="At least 6 characters"
                  className={fieldCls("password", true)}
                />
              </Field>

              <Field
               
                id="su-confirm"
                label="Confirm password"
                icon={ShieldCheck}
                error={errors.confirmPassword}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f57224]/40"
                  >
                    {showConfirm ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                }
              >
                <input
                  {...fieldA11y("su-confirm", errors.confirmPassword)}
                  type={showConfirm ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setErrors((p) => ({ ...p, confirmPassword: "" })); }}
                  placeholder={t("auth.signup.confirmPasswordPlaceholder")}
                  className={fieldCls("confirmPassword", true)}
                />
              </Field>
              </div>

              <div className="space-y-3 border-t border-slate-100 pt-4 md:col-span-2">
              {/* Group 3 — Location — desktop par ek hi row */}
              <section aria-labelledby="su-sec-location">
                <SectionHeading icon={MapPin} title={<span id="su-sec-location">Business location</span>} description="Used for shipping and tax settings" />
                <div className="grid grid-cols-1 items-start gap-x-4 gap-y-3 sm:grid-cols-2">
                    <Field
                      id="su-country"
                      label="Country"
                      icon={Globe}
                      error={errors.country}
                    >
                      {/* Searchable list (native select 250 items ka poora-screen popup kholta tha) */}
                      <SearchCombobox
                        id="su-country"
                        value={country}
                        onChange={(v) => {
                          setCountry(v);
                          setCity(""); // purani city doosre country ki hai
                          setErrors((p) => ({ ...p, country: "", city: "" }));
                        }}
                        options={countryOptions}
                        loading={step === "account" && !geo}
                        invalid={!!errors.country}
                        describedBy={errors.country ? "su-country-error" : undefined}
                        inputClassName={fieldCls("country", true)}
                        itemLabel="country"
                        allowCustom={false}
                        pinned={["Pakistan"]}
                      />
                    </Field>

                    <Field id="su-city" label="City" icon={Building2} error={errors.city}>
                      <SearchCombobox
                        id="su-city"
                        itemLabel="city"
                        value={city}
                        onChange={(v) => { setCity(v); setErrors((p) => ({ ...p, city: "" })); }}
                        options={cityOptions}
                        loading={citiesLoading}
                        invalid={!!errors.city}
                        describedBy={errors.city ? "su-city-error" : undefined}
                        inputClassName={fieldCls("city", true)}
                      />
                    </Field>
                    <Field id="su-address" label="Street address" icon={MapPin} error={errors.address}>
                      <input
                        {...fieldA11y("su-address", errors.address)}
                        type="text"
                        autoComplete="street-address"
                        value={address}
                        onChange={(e) => { setAddress(e.target.value); setErrors((p) => ({ ...p, address: "" })); }}
                        placeholder="Shop no., street, area"
                        className={fieldCls("address")}
                      />
                    </Field>

                    <Field id="su-zip" label="ZIP code" optional icon={Hash} error={errors.zipCode}>
                      <input
                        {...fieldA11y("su-zip", errors.zipCode)}
                        type="text"
                        inputMode="numeric"
                        autoComplete="postal-code"
                        maxLength={20}
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        placeholder="54000"
                        className={fieldCls("zipCode")}
                      />
                    </Field>
                </div>
              </section>
              </div>

              <div className={`${CARD_FOOTER} md:col-span-2`}>
              <p className="text-center text-[13px] text-slate-500 sm:text-left">
                Already have an account?{" "}
                <button type="button" onClick={() => router.push("/admin/login")} className="font-semibold text-[#e2641b] underline-offset-2 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f57224]/30">
                  Sign in
                </button>
              </p>
              <button type="submit" disabled={checking} className={`${PRIMARY_BTN} w-full sm:w-auto sm:min-w-[260px]`}>
                {checking ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Checking details…</> : "Continue to store details"}
                <ArrowRight size={17} aria-hidden="true" />
              </button>
              </div>
            </form>
          )}

          {/* ═══ STEP 2: STORE DETAILS + WEB ADDRESS (final) ═══ */}
          {step === "store" && (
            <form onSubmit={handleSubmit} className={`${CARD} space-y-5`} noValidate aria-busy={loading}>
              {/* Group 1 — Store identity */}
              <section aria-labelledby="su-sec-identity">
                <SectionHeading icon={Store} title={<span id="su-sec-identity">Store identity</span>} description="Your store name and what kind of business it is" />
                <div className="grid grid-cols-1 items-start gap-x-4 gap-y-3.5 md:grid-cols-2">
                  <Field id="su-store-name" label="Store name" icon={Store} error={errors.storeName}>
                    <input
                      {...fieldA11y("su-store-name", errors.storeName)}
                      type="text"
                      autoComplete="organization"
                      value={storeName}
                      onChange={(e) => changeStoreName(e.target.value)}
                      placeholder="e.g. Ahmed Electronics"
                      className={fieldCls("storeName")}
                    />
                  </Field>

                  <Field
                    id="su-business-category"
                    label="Business category"
                    icon={Building}
                    error={errors.businessCategory}
                    trailing={<ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />}
                  >
                    <select
                      {...fieldA11y("su-business-category", errors.businessCategory)}
                      value={businessCategory}
                      onChange={(e) => { setBusinessCategory(e.target.value); setErrors((p) => ({ ...p, businessCategory: "" })); }}
                      className={`${fieldCls("businessCategory", true)} cursor-pointer appearance-none ${businessCategory ? "" : "!text-slate-400"}`}
                    >
                      <option value="">Select a category</option>
                      {BUSINESS_CATEGORIES.map((c) => (
                        <option key={c} value={c} className="text-slate-900">{c}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </section>

              {/* Web address + description — desktop par side by side (bina scroll fit) */}
              <div className="grid grid-cols-1 items-start gap-x-6 gap-y-4 md:grid-cols-2">
              {/* Group 2 — Store web address (required) */}
              <section aria-labelledby="su-sec-web" className="min-w-0">
                <SectionHeading icon={Globe} title={<span id="su-sec-web">Store web address</span>} description="Where customers will find your store" />
                <Field
                  id="su-subdomain"
                  label="Web address"
                  counter={<span className={`text-[11px] font-medium tabular-nums ${subdomain.length >= STORE_ADDRESS_MAX ? "text-[#e2641b]" : "text-slate-400"}`}>{subdomain.length}/{STORE_ADDRESS_MAX}</span>}
                  icon={Link2}
                  error={errors.subdomain}
                  below={!errors.subdomain && (
                    <p id="su-subdomain-hint" className="flex items-center gap-1.5 pt-1.5 text-[11.5px] leading-4" aria-live="polite">
                      {subdomain.trim().length < 3 ? (
                        <span className="text-slate-500">Lowercase letters, numbers and hyphens · 3–{STORE_ADDRESS_MAX} characters</span>
                      ) : subdomainCheck.value === subdomain.trim() && subdomainCheck.state === "checking" ? (
                        <><Loader2 size={12} className="animate-spin text-slate-400" aria-hidden="true" /><span className="text-slate-500">Checking availability…</span></>
                      ) : subdomainCheck.value === subdomain.trim() && subdomainCheck.state === "available" ? (
                        <><CheckCircle2 size={13} className="text-emerald-500" aria-hidden="true" /><span className="font-medium text-emerald-700">{subdomain.trim()}.{ROOT_DOMAIN} is available</span></>
                      ) : (
                        <span className="text-slate-500">You can connect your own domain later from the store settings.</span>
                      )}
                    </p>
                  )}
                  trailing={
                    <span className="pointer-events-none absolute right-3.5 top-1/2 max-w-[55%] -translate-y-1/2 truncate text-[13px] font-medium text-slate-400">.{ROOT_DOMAIN}</span>
                  }
                >
                  <input
                    {...fieldA11y("su-subdomain", errors.subdomain, true)}
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore
                    data-bwignore
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={STORE_ADDRESS_MAX}
                    value={subdomain}
                    onChange={(e) => changeSubdomain(e.target.value)}
                    placeholder="your-store"
                    className={`${fieldCls("subdomain")} pr-[calc(55%+1rem)] font-medium`}
                  />
                </Field>
                {errors.subdomain && subdomainCheck.suggestion && subdomainCheck.value === subdomain.trim() && (
                  <button
                    type="button"
                    onClick={() => { changeSubdomain(subdomainCheck.suggestion); }}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[#f57224]/30 bg-[#f57224]/[0.06] px-2.5 py-1.5 text-[12px] font-semibold text-[#c2541a] transition hover:bg-[#f57224]/[0.12]"
                  >
                    Use {subdomainCheck.suggestion}.{ROOT_DOMAIN}
                  </button>
                )}
              </section>

              {/* Group 3 — Business description */}
              <section aria-labelledby="su-sec-desc" className="min-w-0">
                <SectionHeading icon={FileText} title={<span id="su-sec-desc">Business description</span>} description="Tell buyers what you sell and why they should choose you" />
                <div className="space-y-4">
                  <Field
                    id="su-store-desc"
                    label="What will you sell?"
                    icon={FileText}
                    iconTop
                    error={errors.storeDescription}
                    counter={
                      <span
                        id="su-store-desc-hint"
                        data-tone="accent"
                        className="text-[11px] font-medium tabular-nums text-slate-400"
                      >
                        {storeDescription.length}/2000
                      </span>
                    }
                  >
                    <textarea
                      {...fieldA11y("su-store-desc", errors.storeDescription, true)}
                      rows={2}
                      maxLength={2000}
                      value={storeDescription}
                      onChange={(e) => { setStoreDescription(e.target.value); setErrors((p) => ({ ...p, storeDescription: "" })); }}
                      placeholder="e.g. Affordable smartphones, accessories and gadgets with nationwide delivery."
                      className={`${fieldCls("storeDescription")} !h-auto min-h-[76px] resize-y py-3 leading-[1.5]`}
                    />
                  </Field>
                </div>
              </section>
              </div>

              {/* Back + Create account — card footer */}
              <div className={CARD_FOOTER}>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => { setStep("account"); setErrors({}); setGeneralError(""); }}
                  className={`${SECONDARY_BTN} sm:w-auto`}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back
                </button>
                <button type="submit" disabled={loading} className={`${PRIMARY_BTN} w-full sm:w-auto sm:min-w-[260px]`}>
                  {loading ? (
                    <>
                      <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                      {t("auth.signup.signingUp")}
                    </>
                  ) : (
                    <>
                      {t("auth.login.createAccount")}
                      <ArrowRight size={17} aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
          </div>

        </div>

        {/* Bottom anchor — trust + help (© left panel me hai; mobile par yahan) */}
        <footer className="flex w-full shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-slate-100 py-4 text-[12px] text-slate-400 [@media(max-height:820px)]:py-2.5">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck size={13} aria-hidden="true" />
            Secure, encrypted signup
            <span className="lg:hidden">· © {new Date().getFullYear()} ClickMaster</span>
          </span>
          {SUPPORT_EMAIL ? (
            <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-slate-500 transition hover:text-slate-800">
              Need help? Contact support
            </a>
          ) : null}
        </footer>
      </div>
    </main>
  );
}
