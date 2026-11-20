"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStoreAdminUrl } from "@/apis/storeHandoff";
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

/* ═══════════ SHARED DESIGN SYSTEM (dono steps same tokens use karte hain) ═══════════ */
const INPUT_BASE =
  "w-full h-12 rounded-xl border bg-white pl-11 pr-4 text-[14px] text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.04)] outline-none transition-[border-color,box-shadow,background-color] duration-150 disabled:cursor-not-allowed disabled:bg-slate-50";
const inputState = (hasError) =>
  hasError
    ? "border-red-300 bg-red-50/40 focus:border-red-400 focus:ring-4 focus:ring-red-500/10"
    : "border-slate-200 hover:border-slate-300 focus:border-[#f57224] focus:ring-4 focus:ring-[#f57224]/15";

const PRIMARY_BTN =
  "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f57224] px-5 text-[14.5px] font-semibold text-white shadow-[0_1px_2px_rgba(15,23,42,0.08),0_10px_24px_-8px_rgba(245,114,36,0.6)] transition hover:bg-[#e8651a] active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f57224]/30 disabled:cursor-not-allowed disabled:bg-[#f57224]/55 disabled:shadow-none disabled:active:translate-y-0";
const SECONDARY_BTN =
  "inline-flex h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-[14px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50";

/* Field wrapper — label, icon, hint, error ek jaisi spacing ke saath.
   Component bahar define hai taake re-render par input focus na khoye. */
function Field({ id, label, optional, hint, error, icon: Icon, iconTop = false, counter, trailing, below, children }) {
  return (
    <div>
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
/* Searchable city dropdown (combobox). Options country-state-city library se aate hain.
   Type karo → filter; ↑ ↓ Enter Esc keyboard; list me na ho to typed naam bhi chalega. */
const CITY_RENDER_LIMIT = 80;
function CityCombobox({ id, value, onChange, options, loading, inputClassName, describedBy, invalid }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listRef = useRef(null);
  const query = value.trim().toLowerCase();

  // "starts with" pehle, phir "contains"; render limit taake 20k cities par bhi smooth rahe
  const { matches, total } = useMemo(() => {
    if (!options.length) return { matches: [], total: 0 };
    if (!query) return { matches: options.slice(0, CITY_RENDER_LIMIT), total: options.length };
    const starts = [];
    const contains = [];
    for (const o of options) {
      const l = o.toLowerCase();
      if (l.startsWith(query)) starts.push(o);
      else if (l.includes(query)) contains.push(o);
    }
    const all = starts.concat(contains);
    return { matches: all.slice(0, CITY_RENDER_LIMIT), total: all.length };
  }, [options, query]);

  const exactMatch = options.some((o) => o.toLowerCase() === query);
  const listId = `${id}-listbox`;

  useEffect(() => {
    if (active < 0 || !listRef.current) return;
    listRef.current.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (name) => {
    onChange(name);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && active >= 0 && matches[active]) {
      e.preventDefault(); // form submit na ho — sirf city select ho
      choose(matches[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  const placeholder = loading ? "Loading cities…" : options.length ? "Search or select a city" : "Enter your city";

  return (
    <>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${id}-opt-${active}` : undefined}
        aria-invalid={invalid ? "true" : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className={inputClassName}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={open ? "Close city list" : "Open city list"}
        onMouseDown={(e) => { e.preventDefault(); document.getElementById(id)?.focus(); setOpen((o) => !o); }}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
      >
        {loading ? (
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        ) : (
          <ChevronDown size={16} aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && !loading && (matches.length > 0 || query) && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Cities"
          className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-60 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1.5 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.25)]"
        >
          {matches.map((name, i) => (
            <li
              key={name}
              id={`${id}-opt-${i}`}
              data-index={i}
              role="option"
              aria-selected={name === value}
              // mousedown + preventDefault: input blur se pehle select ho jaye
              onMouseDown={(e) => { e.preventDefault(); choose(name); }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-[13.5px] ${
                i === active ? "bg-[#f57224]/[0.08] text-slate-900" : "text-slate-700"
              }`}
            >
              <span className="truncate">{name}</span>
              {name === value && <Check size={14} className="shrink-0 text-[#f57224]" aria-hidden="true" />}
            </li>
          ))}
          {total > matches.length && (
            <li role="presentation" className="px-3.5 pb-1 pt-2 text-[11.5px] text-slate-400">
              Showing {matches.length} of {total.toLocaleString()} — type to narrow down
            </li>
          )}
          {query && !exactMatch && matches.length === 0 && (
            <li role="presentation" className="px-3.5 py-1.5 text-[12px] text-slate-500">
              No match found — <span className="font-semibold text-slate-700">“{value.trim()}”</span> will be used as your city.
            </li>
          )}
        </ul>
      )}
    </>
  );
}

const SIGNUP_STEPS = [
  { label: "Account", sub: "Login details", icon: UserRound },
  { label: "Store", sub: "Business info", icon: Store },
  { label: "Location", sub: "& branding", icon: MapPin },
];

function SignupStepper({ currentIndex }) {
  const total = SIGNUP_STEPS.length;
  const renderStep = (s, i) => {
    const status = i < currentIndex ? "done" : i === currentIndex ? "active" : "upcoming";
    const Icon = s.icon;
    return (
      <li key={s.label} aria-current={status === "active" ? "step" : undefined} className="flex shrink-0 items-center gap-2">
        <span
          data-tone="accent"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            status === "done"
              ? "bg-[#f57224] text-white shadow-[0_6px_14px_-4px_rgba(245,114,36,0.6)]"
              : status === "active"
                ? "border-2 border-[#f57224] bg-white text-[#f57224] shadow-[0_0_0_4px_rgba(245,114,36,0.14)]"
                : "border-2 border-slate-200 bg-slate-50 text-slate-400"
          }`}
        >
          {status === "done" ? <Check size={17} strokeWidth={3} aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
        </span>
        {/* Mobile par sirf active step ka text — baaki sirf icon (tang jagah) */}
        <span className={`min-w-0 flex-col ${status === "active" ? "flex" : "hidden sm:flex"}`}>
          <span data-tone="accent" className={`truncate text-[13px] font-semibold leading-4 ${status === "upcoming" ? "text-slate-400" : "text-slate-900"}`}>
            {s.label}
          </span>
          <span
            data-tone="accent"
            className={`truncate pt-0.5 text-[11px] font-medium leading-4 ${
              status === "done" ? "text-emerald-600" : status === "active" ? "text-[#e2641b]" : "text-slate-400"
            }`}
          >
            {status === "done" ? "Completed" : status === "active" ? `Step ${i + 1} of ${total}` : s.sub}
          </span>
        </span>
        <span className="sr-only">{status === "done" ? "(completed)" : status === "active" ? "(current step)" : "(upcoming)"}</span>
      </li>
    );
  };
  return (
    <nav aria-label="Signup progress" className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:px-4">
      <ol className="flex items-center gap-2 sm:gap-2.5">
        {SIGNUP_STEPS.map((s, i) => [
          i > 0 && (
            <li key={`c${i}`} aria-hidden="true" className="relative h-[3px] min-w-4 flex-1 overflow-hidden rounded-full bg-slate-200">
              <span
                data-tone="accent"
                className="absolute inset-y-0 left-0 rounded-full bg-[#f57224] transition-[width] duration-500 ease-out"
                style={{ width: currentIndex >= i ? "100%" : "0%" }}
              />
            </li>
          ),
          renderStep(s, i),
        ])}
      </ol>
    </nav>
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

  const [step, setStep] = useState("account"); // account | store | location | otp | welcome
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

  const [logoBusy, setLogoBusy] = useState(false);

  /* Desktop par window scroll nahi hota — step badalne par right panel ko top par le jao */
  const formPanelRef = useRef(null);
  useEffect(() => {
    formPanelRef.current?.scrollTo?.({ top: 0 });
  }, [step]);
  const [logoDragActive, setLogoDragActive] = useState(false);

  /* Selected country ki cities — country-state-city library sirf Location step par
     lazy load hoti hai (~8MB city data signup ke initial bundle me nahi aata) */
  // cityData.country = jis country ki list load ho chuki; mismatch = abhi loading
  const [cityData, setCityData] = useState({ country: null, options: [] });
  useEffect(() => {
    if (step !== "location" || cityData.country === country) return undefined;
    let cancelled = false;
    import("country-state-city")
      .then(({ Country, City }) => {
        if (cancelled) return;
        const match = Country.getAllCountries().find((c) => c.name === country);
        const list = match ? City.getCitiesOfCountry(match.isoCode) || [] : [];
        // Library me ek naam kai states me repeat hota hai — unique + A–Z
        const options = [...new Set(list.map((c) => c.name))].sort((a, b) => a.localeCompare(b));
        setCityData({ country, options });
      })
      .catch(() => { if (!cancelled) setCityData({ country, options: [] }); }); // fail ho to free text chalta rahe
    return () => { cancelled = true; };
  }, [step, country, cityData.country]);
  const citiesLoading = step === "location" && cityData.country !== country;
  const cityOptions = cityData.country === country ? cityData.options : [];

  const fieldCls = (field, withToggle = false) =>
    `${INPUT_BASE} ${withToggle ? "!pr-11" : ""} ${inputState(!!errors[field])}`;

  /* File input aur drag-and-drop dono isi validation se guzarte hain */
  const processLogo = async (file) => {
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Logo must be a JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Image is too large — please pick one under 15MB.");
      return;
    }
    setLogoBusy(true);
    try {
      const compressed = await compressImage(file, { maxSize: 512, quality: 0.82 });
      setStoreLogo(compressed);
    } catch {
      toast.error("Logo could not be processed. Please try another image.");
    } finally {
      setLogoBusy(false);
    }
  };

  const pickLogo = async (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;
    e.target.value = "";
    await processLogo(file);
  };

  const onLogoDrop = (e) => {
    e.preventDefault();
    setLogoDragActive(false);
    processLogo(e.dataTransfer?.files?.[0] || null);
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

  /* Error wale field ka step kholo (account errors ke liye banner already hai) */
  const STORE_DETAIL_FIELDS = ["storeName", "storeDescription", "businessCategory"];
  const ACCOUNT_FIELD_KEYS = ["name", "username", "phone", "email", "password", "confirmPassword"];
  const goToErrorStep = (errs) => {
    if (ACCOUNT_FIELD_KEYS.some((k) => errs[k])) return; // banner "Go to account step" dikhata hai
    if (STORE_DETAIL_FIELDS.some((k) => errs[k])) setStep("store");
  };

  const handleStoreNext = () => {
    const nextErrors = validateStoreDetails();
    setErrors(nextErrors);
    setGeneralError("");
    if (Object.keys(nextErrors).length > 0) return;
    setErrors({});
    setStep("location");
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

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
  const isWizardStep = step === "account" || step === "store" || step === "location";
  const stepIndex = step === "account" ? 0 : step === "store" ? 1 : 2;
  const accountHasErrors = (step === "store" || step === "location") && ACCOUNT_FIELD_KEYS.some((k) => errors[k]);

  const HEADERS = {
    account: { title: "Create your seller account", subtitle: "Start selling on ClickMaster in three quick steps." },
    store: { title: "Tell us about your store", subtitle: "Your store name and what you sell. You can edit these later." },
    location: { title: "Location & branding", subtitle: "Where you operate and how your store looks. The logo is optional." },
    otp: { title: "Verify your email", subtitle: "Enter the code we sent to finish creating your account." },
  };
  const header = HEADERS[step] || HEADERS.account;

  return (
    /* Desktop (lg+): main exactly viewport height — window scroll nahi hota,
       sirf right panel apne andar scroll karta hai. Mobile/tablet: natural page scroll. */
    <main className="user-theme signup-reference-page flex min-h-dvh bg-[#f3f4f7] lg:h-dvh lg:min-h-0">
      {/* ═══════════ LEFT — NAVY BRAND PANEL (lg+, stationary) ═══════════ */}
      <div className="relative hidden h-full shrink-0 overflow-hidden bg-[#0b1430] text-white lg:flex lg:w-[44%] xl:w-[46%]">
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
      <div
        ref={formPanelRef}
        className="flex min-w-0 flex-1 flex-col items-center px-4 py-6 sm:px-8 sm:py-10 lg:h-full lg:overflow-y-auto lg:overscroll-contain lg:px-10 lg:py-6 lg:[scrollbar-gutter:stable_both-edges] xl:px-14"
      >
        {/* Mobile / tablet brand header */}
        <header className="mb-6 mt-auto flex w-full max-w-[520px] shrink-0 items-center justify-between lg:hidden">
          <BrandMark size="sm" />
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500">
            <ShieldCheck size={13} aria-hidden="true" />
            Secure signup
          </span>
        </header>

        <div className="w-full max-w-[520px] shrink-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_56px_-16px_rgba(15,23,42,0.18)] sm:p-7 lg:mt-auto xl:p-8">
          {/* Card header */}
          {/* Step number stepper me already hai — alag eyebrow pill ki zaroorat nahi */}
          <div>
            <h2 className="text-[24px] font-bold leading-tight tracking-[-0.02em] text-slate-900">{header.title}</h2>
            <p className="pt-1 text-[13.5px] leading-5 text-slate-500">{header.subtitle}</p>
          </div>

          {isWizardStep && <SignupStepper currentIndex={stepIndex} />}

          {generalError && (
            <div role="alert" data-tone="error" className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle size={18} className="mt-px shrink-0 text-red-500" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-red-800">Something needs your attention</p>
                <p className="pt-0.5 text-[12.5px] leading-5 text-red-700">{generalError}</p>
              </div>
            </div>
          )}

          {/* Store step par account field ka backend error — user ko wapas le jao */}
          {accountHasErrors && (
            <div role="alert" data-tone="error" className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
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
            <form onSubmit={(e) => { e.preventDefault(); handleNext(); }} className="mt-5 space-y-4" noValidate>
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="su-username" label="Username" optional icon={AtSign} error={errors.username}>
                  <input
                    {...fieldA11y("su-username", errors.username)}
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); setErrors((p) => ({ ...p, username: "" })); }}
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
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: "" })); }}
                  placeholder="you@example.com"
                  className={fieldCls("email")}
                />
              </Field>

              {/* Password + confirm ek row me (sm+) — 48px inputs, kam vertical height */}
              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
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

              <button type="submit" className={`${PRIMARY_BTN} !mt-6 w-full`}>
                Continue to store details
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </form>
          )}

          {/* ═══ STEP 2: STORE DETAILS ═══ */}
          {step === "store" && (
            <form onSubmit={(e) => { e.preventDefault(); handleStoreNext(); }} className="mt-5 space-y-5" noValidate>
              {/* Group 1 — Store identity */}
              <section aria-labelledby="su-sec-identity">
                <SectionHeading icon={Store} title={<span id="su-sec-identity">Store identity</span>} description="Your store name and what kind of business it is" />
                <div className="space-y-4">
                  <Field id="su-store-name" label="Store name" icon={Store} error={errors.storeName}>
                    <input
                      {...fieldA11y("su-store-name", errors.storeName)}
                      type="text"
                      autoComplete="organization"
                      value={storeName}
                      onChange={(e) => { setStoreName(e.target.value); setErrors((p) => ({ ...p, storeName: "" })); }}
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

              {/* Group 2 — Business description */}
              <section aria-labelledby="su-sec-desc">
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

              {/* Back + Continue */}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => { setStep("account"); setErrors({}); setGeneralError(""); }}
                  className={`${SECONDARY_BTN} sm:w-auto`}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back
                </button>
                <button type="submit" className={`${PRIMARY_BTN} w-full sm:w-auto sm:flex-1`}>
                  Continue
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              </div>
            </form>
          )}

          {/* ═══ STEP 3: LOCATION & BRANDING ═══ */}
          {step === "location" && (
            <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate aria-busy={loading}>
              {/* Group 3 — Location */}
              <section aria-labelledby="su-sec-location">
                <SectionHeading icon={MapPin} title={<span id="su-sec-location">Business location</span>} description="Used for shipping and tax settings" />
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field
                      id="su-country"
                      label="Country"
                      icon={Globe}
                      error={errors.country}
                      trailing={<ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />}
                    >
                      <select
                        {...fieldA11y("su-country", errors.country)}
                        value={country}
                        onChange={(e) => {
                          setCountry(e.target.value);
                          setCity(""); // purani city doosre country ki hai
                          setErrors((p) => ({ ...p, country: "", city: "" }));
                        }}
                        className={`${fieldCls("country", true)} cursor-pointer appearance-none`}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </Field>

                    <Field id="su-city" label="City" icon={Building2} error={errors.city}>
                      <CityCombobox
                        id="su-city"
                        value={city}
                        onChange={(v) => { setCity(v); setErrors((p) => ({ ...p, city: "" })); }}
                        options={cityOptions}
                        loading={citiesLoading}
                        invalid={!!errors.city}
                        describedBy={errors.city ? "su-city-error" : undefined}
                        inputClassName={fieldCls("city", true)}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_132px]">
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
                </div>
              </section>

              {/* Group 4 — Branding / logo upload */}
              {/* relative: sr-only file input (absolute) isi section ke andar rahe —
                  warna woh scroll panel se bahar nikal kar poore page ko scroll karwata hai */}
              <section aria-labelledby="su-sec-brand" className="relative">
                <SectionHeading icon={ImagePlus} title={<span id="su-sec-brand">Store branding</span>} description="Optional — add or change it any time" />
                <input
                  id="su-store-logo"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={pickLogo}
                  disabled={logoBusy || loading}
                  className="peer sr-only"
                />
                {storeLogo ? (
                  <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                    <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={storeLogo} alt="Store logo preview" className="h-full w-full object-contain" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">
                        <BadgeCheck size={15} className="shrink-0 text-emerald-500" aria-hidden="true" />
                        Logo ready
                      </p>
                      <p className="pt-0.5 text-[12px] leading-4 text-slate-500">Optimized for fast loading on your store.</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        <label
                          htmlFor="su-store-logo"
                          className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 ${logoBusy ? "pointer-events-none opacity-60" : ""}`}
                        >
                          {logoBusy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />}
                          Replace
                        </label>
                        <button
                          type="button"
                          onClick={() => setStoreLogo("")}
                          disabled={logoBusy || loading}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <label
                    htmlFor="su-store-logo"
                    onDragOver={(e) => { e.preventDefault(); if (!logoDragActive) setLogoDragActive(true); }}
                    onDragLeave={() => setLogoDragActive(false)}
                    onDrop={onLogoDrop}
                    className={`flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed px-4 py-3.5 transition-colors peer-focus-visible:border-[#f57224] peer-focus-visible:ring-4 peer-focus-visible:ring-[#f57224]/15 ${
                      logoDragActive
                        ? "border-[#f57224] bg-[#f57224]/[0.06]"
                        : "border-slate-200 bg-slate-50/60 hover:border-[#f57224]/50 hover:bg-[#f57224]/[0.03]"
                    } ${logoBusy ? "pointer-events-none" : ""}`}
                  >
                    <span
                      data-tone="accent"
                      aria-hidden="true"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#f57224] shadow-sm ring-1 ring-slate-200"
                    >
                      {logoBusy ? <Loader2 size={19} className="animate-spin" /> : <ImagePlus size={19} />}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[13px] font-medium text-slate-700">
                        {logoBusy ? (
                          "Optimizing your logo…"
                        ) : (
                          <>
                            <span data-tone="accent" className="font-semibold text-[#e2641b]">Click to upload</span> or drag and drop
                          </>
                        )}
                      </span>
                      <span className="pt-0.5 text-[11.5px] text-slate-500">JPG, PNG or WEBP · up to 15MB · square works best</span>
                    </span>
                  </label>
                )}
              </section>

              {/* Back + Create account */}
              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => { setStep("store"); setErrors({}); setGeneralError(""); }}
                  className={`${SECONDARY_BTN} sm:w-auto`}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back
                </button>
                <button type="submit" disabled={loading || logoBusy} className={`${PRIMARY_BTN} w-full sm:w-auto sm:flex-1`}>
                  {loading ? (
                    <>
                      <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                      {t("auth.signup.signingUp")}
                    </>
                  ) : logoBusy ? (
                    <>
                      <Loader2 size={17} className="animate-spin" aria-hidden="true" />
                      Processing logo…
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

          {/* Google sirf account step par */}
          {step === "account" && (
            <div className="mt-5">
              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-[11.5px] font-medium text-slate-400">or sign up with</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="mt-3 flex justify-center">
                {GOOGLE_CLIENT_ID ? (
                  <LazyGoogleLogin
                    clientId={GOOGLE_CLIENT_ID}
                    onSuccess={(res) => handleGoogle(res.credential)}
                    onError={() => toast.error(t("auth.login.googleFailed"))}
                    theme="outline"
                    size="large"
                    text="continue_with"
                    shape="rectangular"
                    width="300"
                  />
                ) : (
                  <p className="text-center text-[12px] text-slate-400">{t("auth.login.googleUnavailable")}</p>
                )}
              </div>
            </div>
          )}

          {isWizardStep && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <p className="text-center text-[13px] text-slate-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="font-semibold text-[#e2641b] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline"
                >
                  Sign in
                </button>
              </p>
            </div>
          )}
        </div>

        {/* <footer> (p nahi) — globals.css ka unlayered `p { margin: 0 }` mb-auto ko override kar deta */}
        <footer className="mb-auto mt-4 flex shrink-0 items-center justify-center gap-1.5 pb-1 text-center text-[11.5px] text-slate-400">
          <ShieldCheck size={13} aria-hidden="true" />
          Your information is encrypted and secure · ClickMaster Marketplace
        </footer>
      </div>
    </main>
  );
}
