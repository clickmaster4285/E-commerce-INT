"use client";

import FallbackImage from "@/components/common/FallbackImage";
import { useEffect, useMemo, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { userHttp } from "@/apis/axiosInstance";
import { addressApi } from "@/apis/user/addressApi";
import dynamic from "next/dynamic";
// ✅ country-state-city wala form alag chunk me (home bundle se bahar) — behavior same
let addressFormModulePromise;
const preloadAddressForm = () => {
  if (!addressFormModulePromise) {
    addressFormModulePromise = import("@/components/user/AddressForm").catch((error) => {
      addressFormModulePromise = null;
      throw error;
    });
  }
  return addressFormModulePromise;
};
const warmAddressForm = () => preloadAddressForm().catch(() => {});
const AddressForm = dynamic(() => preloadAddressForm(), {
  loading: () => null,
});
import { orderApi } from "@/apis/user/orderApi";
import {
  calculateFreeItems,
  calculatePayableItems,
  calculateBuyXGetYSavings,
  formatDealRequirementIssue,
  getDealRequirementIssues,
  isDealActive,
  hasFreeShippingDeal,
  isFreeShippingApplicable,
  getDefaultShippingMethod,
  matchShippingRule,
} from "@/utils/dealCalculator";
import { shippingApi } from "@/apis/user/shippingApi";
import { useCart } from "@/components/user/CartContext";
import { useDiscounts } from "@/components/user/DiscountContext";
import { useLocalized } from "@/i18n/localize";
import { useTranslation } from "@/i18n/LanguageProvider";
import { isValidPhone, normalizePhone, PHONE_MAX, PHONE_MIN } from "@/utils/phoneValidator";
import {
  ArrowLeft, ArrowRight, Check, Lock, Map, MapPin, Phone, CreditCard,
  Banknote, Landmark, Package, PackageCheck, Plus, Minus, ShieldCheck,
  Truck, Loader2, ChevronDown, Zap, ShoppingBag, X, Pencil, Trash2, Tag,
  TrendingUp, Gift, BadgePercent, Sparkles,
} from "lucide-react";

function PrimaryButton({
  children,
  icon: Icon,
  iconEnd: IconEnd,
  loading = false,
  loadingText,
  disabled = false,
  className = "",
  type = "button",
  ...buttonProps
}) {
  const isDisabled = disabled || loading;
  const widthClass = className.split(/\s+/).includes("w-auto") ? "" : "w-full";

  return (
    <button
      {...buttonProps}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`primary-btn inline-flex ${widthClass} items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`.trim()}
    >
      {loading ? (
        <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />
      ) : Icon ? (
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
      ) : null}
      <span>{loading && loadingText ? loadingText : children}</span>
      {!loading && IconEnd ? (
        <IconEnd aria-hidden="true" className="h-4 w-4 shrink-0" />
      ) : null}
    </button>
  );
}

const API_ORIGIN = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
const getPhoneValidationError = (value, t) => {
  if (!value) return t("checkout.phone.required");
  if (value.length < PHONE_MIN) return t("checkout.phone.minDigits", { min: PHONE_MIN });
  if (!isValidPhone(value)) return t("checkout.phone.maxDigits", { max: PHONE_MAX });
  return "";
};
const getImgUrl = (img) => {
  const raw = typeof img === "string" ? img : img?.img_url;
  if (!raw) return null;
  if (raw.startsWith("http")) return raw;
  return `${API_ORIGIN}${raw.startsWith("/") ? raw : `/${raw}`}`;
};

const DEFAULT_SHIP_CONFIG = {
  standard: { fee: 200, min_days: 2, max_days: 4 },
  express: { fee: 500, min_days: 1, max_days: 2 },
  free_shipping_over: 0,
};

const ItemThumb = ({ item, size = "w-14 h-14" }) =>
  getImgUrl(item.image) ? (
    <div className={`${size} rounded-xl overflow-hidden border-2 border-[var(--user-border)] shrink-0 shadow-sm bg-[var(--user-bg-hover)]`}>
      <FallbackImage src={getImgUrl(item.image)} alt="" className="w-full h-full object-cover" />
    </div>
  ) : (
    <div className={`${size} rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-border)] flex items-center justify-center shrink-0`}>
      <Package size={18} className="text-[var(--user-accent)]" />
    </div>
  );

// 🏦 BANK DETAILS — filhal hardcoded, baad mein admin/settings se ayengi
const BANK_DETAILS = {
  title: "ClickMasters Store",
  bank: "Meezan Bank",
  accountNumber: "0000 1234 5678 9012",
  iban: "PK00 MEZN 0000 1234 5678 9012",
};

// 🏦 Bank Transfer Panel — mobile + desktop dono ke liye (compact = mobile)
const BankTransferPanel = ({ bankForm, setBankForm, bankFormErrors, setBankFormErrors, t, compact = false }) => {
  const [copied, setCopied] = useState("");
  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success(t("checkout.bank.copied"));
      setTimeout(() => setCopied(""), 1500);
    } catch {
      toast.error(t("checkout.bank.copyFailed"));
    }
  };
  const inp = compact
    ? "w-full h-10 px-3 rounded-lg text-[0.75rem] outline-none border-2 bg-[var(--user-bg-input)] text-[var(--user-text)] transition"
    : "w-full h-12 px-4 rounded-xl text-sm outline-none border-2 bg-[var(--user-bg-input)] text-[var(--user-text)] transition";
  const lbl = compact
    ? "block text-[0.625rem] font-bold text-[var(--user-text-secondary)] mb-1 uppercase tracking-wider"
    : "block text-xs font-bold text-[var(--user-text-secondary)] mb-2 uppercase tracking-wider";
  const errCls = compact ? "text-[0.625rem] text-red-600 dark:text-red-400 mt-1 font-medium" : "text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium";

  const handleSenderNameChange = (e) => {
    setBankForm({ ...bankForm, senderName: e.target.value });
    if (bankFormErrors.senderName) {
      setBankFormErrors({ ...bankFormErrors, senderName: "" });
    }
  };

  const handleTransactionRefChange = (e) => {
    setBankForm({ ...bankForm, transactionRef: e.target.value });
    if (bankFormErrors.transactionRef) {
      setBankFormErrors({ ...bankFormErrors, transactionRef: "" });
    }
  };

  return (
    <div className={`rounded-xl border-2 border-[var(--user-border)] bg-[var(--user-bg-hover)] overflow-hidden ${compact ? "" : "mt-4"}`}>
      {/* ✅ Bank card visual */}
      <div className="relative p-4 sm:p-5" style={{ background: "linear-gradient(135deg, #06281c 0%, #065f46 60%, #047857 130%)" }}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.625rem] uppercase tracking-widest font-black text-emerald-200/80">{t("checkout.bank.payTo")}</p>
            <p className="text-sm sm:text-base font-black text-white truncate">{BANK_DETAILS.title}</p>
            <p className="text-[0.6875rem] sm:text-xs text-emerald-100/80 font-semibold mt-0.5">{BANK_DETAILS.bank}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
            <Landmark size={18} className="text-white" />
          </div>
        </div>
        <div className="relative mt-4 space-y-2">
          <button type="button" onClick={() => copy(BANK_DETAILS.accountNumber.replace(/\s/g, ""), "acc")} className="w-full flex items-center justify-between gap-2 rounded-lg bg-black/25 border border-white/10 px-3 py-2 text-left hover:bg-black/40 transition active:scale-[0.99]">
            <span className="min-w-0">
              <span className="block text-[0.5625rem] uppercase tracking-widest font-bold text-emerald-200/70">{t("checkout.bank.accountNumber")}</span>
              <span className="block font-mono text-[0.75rem] sm:text-[0.8125rem] font-bold text-white truncate">{BANK_DETAILS.accountNumber}</span>
            </span>
            <span className="text-[0.5625rem] font-black uppercase text-emerald-200 shrink-0">{copied === "acc" ? t("checkout.bank.copied") : t("checkout.bank.copy")}</span>
          </button>
          <button type="button" onClick={() => copy(BANK_DETAILS.iban.replace(/\s/g, ""), "iban")} className="w-full flex items-center justify-between gap-2 rounded-lg bg-black/25 border border-white/10 px-3 py-2 text-left hover:bg-black/40 transition active:scale-[0.99]">
            <span className="min-w-0">
              <span className="block text-[0.5625rem] uppercase tracking-widest font-bold text-emerald-200/70">{t("checkout.bank.iban")}</span>
              <span className="block font-mono text-[0.6875rem] sm:text-[0.75rem] font-bold text-white truncate">{BANK_DETAILS.iban}</span>
            </span>
            <span className="text-[0.5625rem] font-black uppercase text-emerald-200 shrink-0">{copied === "iban" ? t("checkout.bank.copied") : t("checkout.bank.copy")}</span>
          </button>
        </div>
      </div>

      {/* ✅ Steps + fillable fields */}
      <div className={`${compact ? "p-3" : "p-4 sm:p-5"} space-y-3`}>
        <ol className={`space-y-1.5 text-[var(--user-text-muted)] ${compact ? "text-[0.6875rem]" : "text-xs"}`}>
          <li className="flex gap-2"><span className="font-black text-[var(--user-accent)] shrink-0">1.</span> {t("checkout.bank.instruction.transfer")}</li>
          <li className="flex gap-2"><span className="font-black text-[var(--user-accent)] shrink-0">2.</span> {t("checkout.bank.instruction.reference")}</li>
          <li className="flex gap-2"><span className="font-black text-[var(--user-accent)] shrink-0">3.</span> {t("checkout.bank.instruction.confirm")}</li>
        </ol>
        <div className="pt-3 border-t border-[var(--user-border)] space-y-3">
          <div>
            <label className={lbl}>{t("checkout.bank.senderName")}</label>
            <input 
              value={bankForm.senderName} 
              onChange={handleSenderNameChange}
              placeholder={t("checkout.bank.senderPlaceholder")}
              className={`${inp} ${bankFormErrors.senderName ? "border-red-500 focus:border-red-500" : "border-[var(--user-border)] focus:border-[var(--user-accent)]"}`}
            />
            {bankFormErrors.senderName && <p className={errCls}>{bankFormErrors.senderName}</p>}
          </div>
          <div>
            <label className={lbl}>{t("checkout.bank.transactionReference")}</label>
            <input 
              value={bankForm.transactionRef} 
              onChange={handleTransactionRefChange}
              placeholder={t("checkout.bank.referencePlaceholder")}
              className={`${inp} ${bankFormErrors.transactionRef ? "border-red-500 focus:border-red-500" : "border-[var(--user-border)] focus:border-[var(--user-accent)]"}`}
            />
            {bankFormErrors.transactionRef && <p className={errCls}>{bankFormErrors.transactionRef}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

// ✅ Card validation helper function
const validateCardDetails = (cardData, t) => {
  const trimmedName = String(cardData.name || "").trim();
  const cleanNumber = String(cardData.number || "").replace(/\s/g, "");
  const cleanExpiry = String(cardData.expiry || "").trim();

  // 1. Card Number validation
  if (!cleanNumber) {
    return { valid: false, field: "number", message: t("checkout.card.numberRequired") };
  }
  if (!/^\d+$/.test(cleanNumber)) {
    return { valid: false, field: "number", message: t("checkout.card.numberDigitsOnly") };
  }

  const brand = getCardBrand(cleanNumber);
  const supportedLengths = {
    VISA: [13, 16, 19],
    Mastercard: [16],
    AMEX: [15],
  };
  const brandName = {
    VISA: "Visa",
    Mastercard: "Mastercard",
    AMEX: "American Express",
  }[brand];

  if (!brandName) {
    return {
      valid: false,
      field: "number",
      message: t("checkout.card.unsupportedBrand"),
    };
  }
  if (!supportedLengths[brand].includes(cleanNumber.length)) {
    const lengths = supportedLengths[brand].join(", ");
    return {
      valid: false,
      field: "number",
      message: t("checkout.card.numberLength", { brand: brandName, lengths }),
    };
  }

  // Luhn algorithm check
  let sum = 0;
  let isEven = false;
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  if (sum % 10 !== 0) {
    return { valid: false, field: "number", message: t("checkout.card.numberInvalid", { brand: brandName }) };
  }

  // 2. Card Holder Name validation
  if (!trimmedName) {
    return { valid: false, field: "name", message: t("checkout.card.holderRequired") };
  }
  if (trimmedName.length < 3) {
    return { valid: false, field: "name", message: t("checkout.card.holderInvalid") };
  }
  if (!/^[a-zA-Z\s.\-']+$/.test(trimmedName)) {
    return { valid: false, field: "name", message: t("checkout.card.holderInvalid") };
  }

  // 3. Expiry validation
  if (!cleanExpiry) {
    return { valid: false, field: "expiry", message: t("checkout.card.expiryRequired") };
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(cleanExpiry)) {
    return { valid: false, field: "expiry", message: t("checkout.card.expiryInvalid") };
  }
  const [datePart, timePart] = cleanExpiry.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const expiryDate = new Date(year, month - 1, day, hour, minute);
  if (
    expiryDate.getFullYear() !== year ||
    expiryDate.getMonth() !== month - 1 ||
    expiryDate.getDate() !== day ||
    expiryDate.getHours() !== hour ||
    expiryDate.getMinutes() !== minute
  ) {
    return { valid: false, field: "expiry", message: t("checkout.card.expiryInvalid") };
  }
  const now = new Date();
  now.setSeconds(0, 0);
  if (expiryDate < now) {
    return { valid: false, field: "expiry", message: t("checkout.card.expired") };
  }

  return { valid: true };
};

const formatPreviewExpiry = (expiry) => {
  const match = String(expiry || "").match(/^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}$/);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : "MM/DD/YYYY";
};

const getCardBrand = (number) => {
  const digits = String(number || "").replace(/\D/g, "");
  if (digits.startsWith("4")) return "VISA";
  const firstFourDigits = Number(digits.slice(0, 4));
  if (/^5[1-5]/.test(digits) || (firstFourDigits >= 2221 && firstFourDigits <= 2720)) {
    return "Mastercard";
  }
  if (/^3[47]/.test(digits)) return "AMEX";
  return "CARD";
};

// 💳 Card Preview — intentionally dark (credit-card look), white text OK
const CardPreview = ({ number, name, expiry, t }) => (
  <div className="relative w-full max-w-[22.5rem] h-[12.5rem] rounded-3xl mx-auto mb-6 overflow-hidden shadow-2xl"
    style={{ background: "linear-gradient(135deg, #0b1220 0%, #16213e 55%, #065f46 130%)" }}>
    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
    <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white/10 blur-3xl" />
    <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-white/10 blur-3xl" />
    <div className="relative p-6 h-full flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="w-12 h-9 rounded-lg bg-gradient-to-br from-amber-300 to-amber-500 shadow-lg" />
        <span className="text-white/90 text-sm font-black italic tracking-wider">
          {getCardBrand(number)}
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-white/60 text-[0.625rem] uppercase tracking-widest font-semibold">{t("checkout.card.number")}</p>
        <p className="text-white font-mono text-lg tracking-[0.18em] font-bold">{number || "•••• •••• •••• ••••"}</p>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[0.5625rem] uppercase tracking-widest text-white/60 font-semibold">{t("checkout.card.holder")}</p>
          <p className="text-white text-sm font-bold uppercase tracking-wider">{name.trim() || t("checkout.card.yourName")}</p>
        </div>
        <div>
          <p className="text-[0.5625rem] uppercase tracking-widest text-white/60 font-semibold">{t("checkout.card.expires")}</p>
          <p className="text-white text-sm font-bold">{formatPreviewExpiry(expiry)}</p>
        </div>
      </div>
    </div>
  </div>
);

function CheckoutContent() {
  const router = useRouter();
  const { text } = useLocalized();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const urlDraftId = searchParams.get("draftId");
  const [currentDraftId, setCurrentDraftId] = useState(null);

  const { cart, removeItems, updateQty, restoreItems, selectedItems } = useCart();
  const { calculateProductDiscount, deals: dealsList = [] } = useDiscounts();
  const [step, setStep] = useState(1);
  const [draftReady, setDraftReady] = useState(false);
  const draftRestored = useRef(false);
  const saveTimer = useRef(null);
  const [draftItems, setDraftItems] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const addressSelectionLocked = useRef(false);
  const [addressFormView, setAddressFormView] = useState(null);
  const [mobileAddressSheet, setMobileAddressSheet] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [shippingMethod, setShippingMethod] = useState(() => getDefaultShippingMethod(null));
  const [userSelectedShipping, setUserSelectedShipping] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const bankDetailsDesktopRef = useRef(null);
  const bankDetailsMobileRef = useRef(null);
  const [cardForm, setCardForm] = useState({ number: "", name: "", expiry: "" });
  const [cardFormErrors, setCardFormErrors] = useState({ number: "", name: "", expiry: "" });
  const [bankForm, setBankForm] = useState({ senderName: "", transactionRef: "" });
  const [bankFormErrors, setBankFormErrors] = useState({ senderName: "", transactionRef: "" });
  const [placing, setPlacing] = useState(false);
  const [orderReviewOpen, setOrderReviewOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [phoneSubmitted, setPhoneSubmitted] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const savingPhoneRef = useRef(false);
  const draftCreateInFlight = useRef(false);
  const placingRef = useRef(false);
  const phoneValidationError = getPhoneValidationError(phone, t);
  const phoneError = phoneTouched || phoneSubmitted ? phoneValidationError : "";
  const phoneIsValid = !phoneValidationError;

  const selectPaymentMethod = (method) => {
    setPaymentMethod(method);
    if (method !== "bank") return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const bankDetails = [bankDetailsDesktopRef.current, bankDetailsMobileRef.current]
          .find((element) => element?.getClientRects().length);
        if (!bankDetails) return;
        const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
        bankDetails.scrollIntoView({ behavior, block: "start" });
      });
    });
  };

  // Warm the address form chunk in the background so opening it never waits on
  // the large country/state/city data dependency.
  useEffect(() => {
    warmAddressForm();
  }, []);

  const { data: user = null, isLoading: userLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await userHttp.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
  });

  useEffect(() => {
    if (!userLoading && !user) router.replace("/login?redirect=/checkout");
  }, [user, userLoading, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (urlDraftId) {
        try {
          const res = await userHttp.get(`/users/checkout-drafts/${urlDraftId}`);
          const d = res.data?.draft;
          if (cancelled || !d) {
            setSelectedKeys(cart.map((i) => i.key));
            if (!cancelled) { draftRestored.current = true; setDraftReady(true); }
            return;
          }
          setCurrentDraftId(urlDraftId);
          if (typeof d.step === "number" && d.step >= 1 && d.step <= 3) setStep(d.step);
          if (Array.isArray(d.items) && d.items.length) setDraftItems(d.items);
          if (Array.isArray(d.selectedKeys) && d.selectedKeys.length > 0) setSelectedKeys(d.selectedKeys);
          else setSelectedKeys(cart.map((i) => i.key));
          if (d.selectedAddressId) setSelectedAddressId(d.selectedAddressId);
          if (d.shippingMethod) setShippingMethod(d.shippingMethod);
          if (d.paymentMethod) setPaymentMethod(d.paymentMethod);
        } catch {
          setSelectedKeys(cart.map((i) => i.key));
        }
        if (!cancelled) { draftRestored.current = true; setDraftReady(true); }
        return;
      }
      setSelectedKeys(cart.map((i) => i.key));
      if (!cancelled) { draftRestored.current = true; setDraftReady(true); }
    })();
    return () => { cancelled = true; };
  }, [cart, urlDraftId]);

  const { data: addresses = [] } = useQuery({
    queryKey: ["addresses"],
    queryFn: addressApi.getAll,
    enabled: !!user,
  });

  useEffect(() => {
    if (!draftReady) return;
    if (addressSelectionLocked.current) return;
    if (!selectedAddressId && addresses.length) {
      const def = addresses.find((a) => a.is_default) || addresses[0];
      setSelectedAddressId(def._id);
    }
  }, [addresses, selectedAddressId, draftReady]);

  const showCardValidationError = (validation) => {
    setCardFormErrors({
      number: validation.field === "number" ? validation.message : "",
      name: validation.field === "name" ? validation.message : "",
      expiry: validation.field === "expiry" ? validation.message : "",
    });
    if (validation.field === "number") toast.error(validation.message);
    setOrderReviewOpen(false);
    if (step === 3) setStep(2);

    setTimeout(() => {
      const fields = document.querySelectorAll(`input[name="card-${validation.field}"]`);
      const input = Array.from(fields).find((field) => field.getClientRects().length > 0);
      if (input) {
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        input.focus();
      }
    }, 100);
  };

  const goToStep = async (n) => {
    // ✅ Validate card fields when moving from step 2 to step 3
    if (n === 3 && paymentMethod === "card") {
      const validation = validateCardDetails(cardForm, t);
      if (!validation.valid) {
        showCardValidationError(validation);
        return;
      }
      // Clear any previous errors
      setCardFormErrors({ number: "", name: "", expiry: "" });
    }

    // ✅ Validate bank transfer fields when moving from step 2 to step 3
    if (n === 3 && paymentMethod === "bank") {
      const trimmedSenderName = bankForm.senderName.trim();
      const trimmedTransactionRef = bankForm.transactionRef.trim();
      const errors = { senderName: "", transactionRef: "" };
      let hasError = false;

      if (!trimmedSenderName) {
        errors.senderName = t("checkout.bank.senderNameRequired");
        hasError = true;
      }
      if (!trimmedTransactionRef) {
        errors.transactionRef = t("checkout.bank.referenceRequired");
        hasError = true;
      }

      if (hasError) {
        setBankFormErrors(errors);
        toast.error(t("checkout.bank.fieldsRequired"));
        return;
      }

      // ✅ Update bankForm with trimmed values
      setBankForm({ senderName: trimmedSenderName, transactionRef: trimmedTransactionRef });
    }

    if (currentDraftId) {
      try {
        await userHttp.put(`/users/checkout-drafts/${currentDraftId}`, {
          step: n, selectedKeys: selectedKeys || [], selectedAddressId: selectedAddressId || null,
          shippingMethod, paymentMethod, saved: false, items: itemsWithDiscounts,
          subtotal: draftSubtotal, shipping, tax, discount: draftDiscount,
          estimatedTotal: draftEstimatedTotal,
        });
      } catch {}
    }
    setStep(n);
  };

  const proceedToStep2 = async () => {
    if (draftCreateInFlight.current) return;
    if (!selectedCartItems.length) return toast.error(t("checkout.items.selectAtLeastOne"));
    const dealIssue = getDealRequirementIssues(selectedCartItems)[0];
    if (dealIssue) return toast.error(formatDealRequirementIssue(dealIssue, { t, localizedName: text(dealIssue.item?.name, dealIssue.item?.translations?.name) }));

    draftCreateInFlight.current = true;
    const snap = selectedCartItems.map((i) => ({ ...i }));
    setDraftItems(snap);
    removeItems(snap.map((i) => i.key));
    setSelectedKeys([]);
    try {
      let draftId = currentDraftId;
      if (!draftId) {
        const createRes = await userHttp.post("/users/checkout-drafts", {
          step: 2, selectedKeys: [], selectedAddressId: selectedAddressId || null,
          shippingMethod, paymentMethod, items: itemsWithDiscounts,
          subtotal: draftSubtotal, shipping, tax, discount: draftDiscount,
          estimatedTotal: draftEstimatedTotal,
        });
        draftId = createRes.data?.draft?._id;
        setCurrentDraftId(draftId);
        if (draftId) router.replace(`/checkout?draftId=${draftId}`, { scroll: false });
      } else {
        await userHttp.put(`/users/checkout-drafts/${draftId}`, {
          step: 2, selectedKeys: [], selectedAddressId: selectedAddressId || null,
          shippingMethod, paymentMethod, items: itemsWithDiscounts,
          subtotal: draftSubtotal, shipping, tax, discount: draftDiscount,
          estimatedTotal: draftEstimatedTotal,
        });
      }
    } catch (e) {
      console.error("proceedToStep2 error:", e);
      restoreItems(snap);
      setDraftItems([]);
      setSelectedKeys(snap.map((item) => item.key));
      toast.error(e.response?.data?.message || t("checkout.draft.saveFailed"));
      return;
    } finally {
      draftCreateInFlight.current = false;
    }
    setStep(2);
  };

  const removeCheckoutItem = (itemKey) => {
    const originalItem = cart.find((cartItem) => cartItem.key === itemKey);
    removeItems([itemKey]);
    toast.success("Item deleted", { action: { label: "Undo", onClick: () => originalItem && restoreItems([originalItem]) } });
  };

  const backToStep1 = async () => {
    if (draftItems.length) restoreItems(draftItems);
    setDraftItems([]);
    if (currentDraftId) {
      try { await userHttp.delete(`/users/checkout-drafts/${currentDraftId}`); } catch {}
      setCurrentDraftId(null);
      router.replace("/checkout", { scroll: false });
    }
    setStep(1);
  };

  useEffect(() => { if (user?.phone) setPhone((p) => p || normalizePhone(user.phone)); }, [user]);

  const handlePhoneChange = (event) => {
    setPhone(event.target.value.replace(/\D/g, "").slice(0, PHONE_MAX));
  };
  const handlePhonePaste = (event) => {
    event.preventDefault();
    setPhone(event.clipboardData.getData("text").replace(/\D/g, "").slice(0, PHONE_MAX));
  };
  const handlePhoneKeyDown = (event) => {
    if (event.ctrlKey || event.metaKey || event.key.length !== 1) return;
    if (!/\d/.test(event.key)) event.preventDefault();
  };

  // ✅ If the user arrives at /checkout with 0 selected items (and cart has items),
  //    send them back to /cart so they can pick what to buy.
  useEffect(() => {
    if (!draftReady || placing) return;
    if (cart.length > 0 && selectedItems.length === 0) {
      router.replace("/cart");
    }
  }, [cart.length, selectedItems.length, draftReady, placing, router]);

  // ✅ Items to checkout = CartContext selection (persists in localStorage).
  //    On draft restore, the local `selectedKeys` seed is used only as a one-shot
  //    import into CartContext (handled in the draft-restore effect above).
  const selectedCartItems = useMemo(() => selectedItems, [selectedItems]);
  const activeItems = step === 1 ? selectedCartItems : draftItems;
  useEffect(() => {
    if (!draftReady || placing || step !== 1 || activeItems.length === 0) return;
    const dealIssue = getDealRequirementIssues(activeItems)[0];
    if (dealIssue) {
      toast.error(formatDealRequirementIssue(dealIssue, { t, localizedName: text(dealIssue.item?.name, dealIssue.item?.translations?.name) }));
      router.replace("/cart");
    }
  }, [activeItems, draftReady, placing, router, step]);

  // ✅ Shared helper — single source of truth for free-shipping qualification.
  const freeShippingByActiveItems = hasFreeShippingDeal(activeItems);
  // ✅ Identify the active free-shipping deal (first match) so we can derive
  //    the default shipping method (e.g. express-only => pre-select express).
  //    Memoized so the useEffect below doesn't re-fire on every render and
  //    accidentally clobber a user's manual method selection.
  const activeFreeShippingDeal = useMemo(
    () => (freeShippingByActiveItems ? dealsList.find((d) => d.type === "free_shipping") : null),
    [freeShippingByActiveItems, dealsList]
  );

  // ✅ Sync `shippingMethod` to the deal-derived default on initial load only.
  //    Once the user has manually selected a method, don't override their choice.
  useEffect(() => {
    if (userSelectedShipping) return;
    const next = getDefaultShippingMethod(activeFreeShippingDeal);
    setShippingMethod((prev) => (prev !== next ? next : prev));
  }, [activeFreeShippingDeal, userSelectedShipping]);

  const itemsWithDiscounts = activeItems.map((i) => {
    const qty = Number(i.qty) || 1;
    let price = Number(i.price) || 0;
    const regularPrice = Number(i.regularPrice ?? i.price ?? 0);
    const dealActive = isDealActive({ ...i, qty });
    let regularDiscountSavings = 0;

    // ✅ Apply admin-applied regular discount on non-deal lines.
    //    Bundle lines SKIP this — unka price pehle se bundle deal ka split hai.
    if (!dealActive && !i.bundleId) {
      const fakeProduct = {
        _id: i.productId || i.id,
        category_id: i.categoryId ? String(i.categoryId) : null,
        brand_id: i.brandId ? String(i.brandId) : null,
        discount: i.productDiscountPct || 0,
      };
      // ✅ Regular checkout line: includeDeals=false so any active deal
      // is IGNORED and ONLY the regular admin discount is applied.
      const disc = calculateProductDiscount(fakeProduct, regularPrice, false);
      if (disc && disc.hasDiscount && disc.discountedPrice < regularPrice) {
        price = Number(disc.discountedPrice) || price;
        regularDiscountSavings = Math.max(0, regularPrice - price);
      }
    }

    let freeItems = 0, payableItems = qty, dealSavings = 0;
    let effectiveDealSavings = 0;
    if (dealActive && i.dealType === "buy_x_get_y" && i.dealBuyQuantity && i.dealGetQuantity) {
      freeItems = calculateFreeItems(qty, Number(i.dealBuyQuantity), Number(i.dealGetQuantity));
      payableItems = calculatePayableItems(qty, Number(i.dealBuyQuantity), Number(i.dealGetQuantity));
      dealSavings = calculateBuyXGetYSavings(qty, regularPrice, Number(i.dealBuyQuantity), Number(i.dealGetQuantity));
      effectiveDealSavings = dealSavings;
    } else if (dealActive && (i.dealType === "percentage" || i.dealType === "fixed_amount")) {
      effectiveDealSavings = Math.max(0, (regularPrice - price) * qty);
    }
    const lineTotal = (i.dealType === "buy_x_get_y" && i.dealBuyQuantity && i.dealGetQuantity)
      ? Number(payableItems * price) || 0
      : qty * price;
    return {
      ...i, qty, displayPrice: price, originalPrice: regularPrice,
      hasDiscount: (regularPrice > price),
      savings: regularDiscountSavings, dealSavings: effectiveDealSavings,
      freeItems: dealActive ? freeItems : 0,
      payableItems: dealActive ? payableItems : qty,
      lineTotal, dealActive,
    };
  });

  const subtotal = itemsWithDiscounts.reduce((s, i) => s + i.lineTotal, 0);
  // ✅ No double counting:
  // - Deal lines contribute `dealSavings` (deal section price drop + free items)
  // - Regular lines contribute `savings * qty` (regular-discount drop only)
  const totalSavings = itemsWithDiscounts.reduce((s, i) => s + (i.dealActive ? i.dealSavings : i.savings * i.qty), 0);

  const { data: shipConfig } = useQuery({ queryKey: ["shippingConfig"], queryFn: shippingApi.getConfig, staleTime: 60 * 1000 });
  const cfg = shipConfig || DEFAULT_SHIP_CONFIG;

  // ✅ Admin ke custom shipping methods (public, active only)
  const { data: customShippingMethods = [] } = useQuery({
    queryKey: ["shippingMethods"],
    queryFn: shippingApi.getMethods,
    staleTime: 60 * 1000,
    retry: false,
  });

  // ✅ Active shipping rules (brand/category/product/all — free or fixed).
  const { data: shippingRules = [] } = useQuery({
    queryKey: ["shippingRules"],
    queryFn: shippingApi.getRules,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: shipQuote } = useQuery({
    queryKey: ["shippingQuote", shippingMethod, Math.round(subtotal), activeItems.map((i) => i.productId || i.id).join(",")],
    queryFn: () => shippingApi.quote({
      items: activeItems.map((i) => ({ productId: i.productId || i.id, brandId: i.brandId, categoryId: i.categoryId })),
      method: shippingMethod, subtotal,
    }),
    enabled: activeItems.length > 0,
  });

  // ✅ Per-method gating using the single helper (no duplicated logic).
  // A free-shipping deal must apply to the SELECTED method to zero it out.
  const freeShippingDealsForMethod = (method) =>
    dealsList.some((d) => d.type === "free_shipping" && isFreeShippingApplicable(d, method));
  const isFreeForCurrentMethod = freeShippingByActiveItems && freeShippingDealsForMethod(shippingMethod);

  // ✅ Match admin shipping rules against the checkout items (single source of truth).
  const matchedRule = matchShippingRule(
    activeItems.map((i) => ({
      productId: i.productId || i.product_id || i.id,
      categoryId: i.categoryId || i.category_id,
      brandId: i.brandId || i.brand_id,
    })),
    shippingRules
  );
  const ruleFree = matchedRule?.shipping_type === "free";
  const ruleFixedFee = matchedRule?.shipping_type === "fixed" ? Number(matchedRule.fee) || 0 : null;

  // ✅ Combine: deal (method-gated) | rule | threshold.
  //    Fixed rule overrides the method fee.
  let shipping;
  if (isFreeForCurrentMethod || ruleFree) {
    shipping = 0;
  } else if (ruleFixedFee != null) {
    shipping = ruleFixedFee;
  } else {
    // ✅ Custom method fee fallback: selected method custom ho to uska fee
    const customSelected = (customShippingMethods || []).find((m) => m.code === shippingMethod);
    shipping = shipQuote?.fee ?? (customSelected ? Number(customSelected.fee ?? 0) : shippingMethod === "express" ? cfg.express.fee : cfg.standard.fee);
  }
  const shippingReason = isFreeForCurrentMethod
    ? t("checkout.shipping.freeViaDeal")
    : ruleFree
    ? t("checkout.shipping.freeRule", { rule: matchedRule.rule_type })
    : (shipQuote?.reason || "");

  const tax = Math.round(itemsWithDiscounts.reduce((s, i) => s + i.displayPrice * i.payableItems * (Number(i.tax || 0) / 100), 0));
  const grandTotal = Math.round(subtotal + shipping + tax);
  const draftDiscount = itemsWithDiscounts.reduce((sum, item) => {
    const originalPrice = Number(item.originalPrice) || 0;
    const salePrice = Number(item.displayPrice) || 0;
    const qty = Number(item.qty) || 1;
    return sum + Math.max(0, originalPrice - salePrice) * qty;
  }, 0);
  const draftSubtotal = subtotal + draftDiscount;
  const draftEstimatedTotal = Math.round(draftSubtotal + shipping + tax - draftDiscount);

  useEffect(() => {
    if (!user || !draftRestored.current || !currentDraftId || placing) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      userHttp.put(`/users/checkout-drafts/${currentDraftId}`, {
        step, selectedKeys: selectedKeys || [], selectedAddressId: selectedAddressId || null,
        shippingMethod, paymentMethod, saved: false, items: itemsWithDiscounts,
        subtotal: draftSubtotal, shipping, tax, discount: draftDiscount,
        estimatedTotal: draftEstimatedTotal,
      }).catch(() => {});
    }, 800);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [selectedKeys, selectedAddressId, shippingMethod, paymentMethod, user, step, draftItems, currentDraftId, placing, draftSubtotal, shipping, tax, draftDiscount, draftEstimatedTotal]);

  const selectedAddress = addresses.find((a) => a._id === selectedAddressId);
  const deliveryAddress = selectedAddress || null;
  const needsPhone = !!user && !user.phone;

  const savePhone = async () => {
    setPhoneSubmitted(true);
    const normalizedPhone = normalizePhone(phone);
    const validationError = getPhoneValidationError(normalizedPhone, t);
    if (validationError) {
      setPhone(normalizedPhone);
      return;
    }
    if (savingPhoneRef.current) return;
    savingPhoneRef.current = true;
    setSavingPhone(true);
    try {
      await userHttp.put("/users/phone", { phone: normalizedPhone });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      toast.success(t("checkout.phone.saved"));
    } catch (e) { toast.error(e.response?.data?.message || t("checkout.phone.saveFailed")); }
    finally { savingPhoneRef.current = false; setSavingPhone(false); }
  };

  const openAddressForm = (view, address = null) => {
    if (!address) addressSelectionLocked.current = true;
    setEditingAddressId(address?._id || null);
    setAddressFormView(view);
    setMobileAddressSheet(false);
  };

  const closeAddressForm = () => {
    setAddressFormView(null);
    setEditingAddressId(null);
  };

  const handleAddressFormSuccess = (saved) => {
    const isNewAddress = !editingAddressId;
    closeAddressForm();
    if (saved?._id) {
      if (isNewAddress) {
        addressSelectionLocked.current = true;
        setSelectedAddressId(saved._id);
      }
      queryClient.setQueryData(["addresses"], (current = []) => {
        const remaining = current.filter((address) => address._id !== saved._id);
        const preservedDefaults = saved.is_default
          ? remaining.map((address) => ({ ...address, is_default: false }))
          : remaining;
        return [...preservedDefaults, saved];
      });
    }
    queryClient.invalidateQueries({ queryKey: ["addresses"] });
  };

  const deleteAddress = async (id) => {
    try {
      await addressApi.remove(id);
      queryClient.setQueryData(["addresses"], (current = []) => current.filter((address) => address._id !== id));
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      if (selectedAddressId === id) setSelectedAddressId(null);
      toast.success(t("checkout.address.deleted"));
    } catch (e) { toast.error(e.response?.data?.message || t("checkout.address.deleteFailed")); }
  };

  const placeOrder = async () => {
    if (placingRef.current) return;
    if (!activeItems.length) return toast.error(t("checkout.items.noneSelected"));
    if (!selectedAddressId) return toast.error(t("checkout.address.selectRequired"));
    
    // ✅ Validate card fields for card payment
    if (paymentMethod === "card") {
      const validation = validateCardDetails(cardForm, t);
      if (!validation.valid) {
        showCardValidationError(validation);
        return;
      }
      // Clear any previous errors
      setCardFormErrors({ number: "", name: "", expiry: "" });
    }
    
    if (paymentMethod === "bank") {
      const trimmedSenderName = bankForm.senderName.trim();
      const trimmedTransactionRef = bankForm.transactionRef.trim();
      if (!trimmedSenderName) {
        return toast.error(t("checkout.bank.senderNameRequired"));
      }
      if (!trimmedTransactionRef) {
        return toast.error(t("checkout.bank.referenceRequired"));
      }
      // ✅ Update bankForm with trimmed values for order submission
      setBankForm({ senderName: trimmedSenderName, transactionRef: trimmedTransactionRef });
    }
    const dealIssue = getDealRequirementIssues(itemsWithDiscounts)[0];
    if (dealIssue) return toast.error(formatDealRequirementIssue(dealIssue, { t, localizedName: text(dealIssue.item?.name, dealIssue.item?.translations?.name) }));
    placingRef.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setPlacing(true);
    try {
      await orderApi.place({
        items: itemsWithDiscounts,
        address_id: selectedAddressId,
        payment_method: paymentMethod,
        shipping_method: shippingMethod,
        shipping,
        checkout_draft_id: currentDraftId || null,
        bank_sender_name: paymentMethod === "bank" ? bankForm.senderName.trim() : null,
        bank_transaction_ref: paymentMethod === "bank" ? bankForm.transactionRef.trim() : null,
      });
      queryClient.invalidateQueries({ queryKey: ["myOrders"] });
      if (currentDraftId) {
        queryClient.setQueryData(["checkoutDrafts"], (drafts = []) =>
          drafts.filter((draft) => String(draft._id) !== String(currentDraftId)),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["checkoutDrafts"] });
      // ✅ Remove ONLY the selected lines from the cart; the save() helper in
//    CartContext auto-prunes the selection for the removed keys. Leave any
//    unselected lines and their (still-selected or unselected) state untouched.
      const orderedKeys = itemsWithDiscounts.map((i) => i.key);
      removeItems(orderedKeys);
      setDraftItems([]);
      setCurrentDraftId(null);
      router.push("/orders");
    } catch (e) {
      toast.error(e.response?.data?.message || t("checkout.order.placeFailed"));
      placingRef.current = false;
      setPlacing(false);
    }
  };

  if (userLoading || !draftReady || (!user && !needsPhone)) {
    return (
      <div className="flex h-[60vh] items-center justify-center" aria-label={t("checkout.loading")}>
        <Loader2 className="animate-spin text-[var(--user-accent)]" size={28} />
        <span className="sr-only">{t("checkout.loading")}</span>
      </div>
    );
  }
  if (!user) return null;

  if (step === 1 && cart.length === 0 && !placing) {
    return (
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[37.5rem] flex-col items-center justify-center px-4 py-10 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-[var(--user-bg-card)] border-2 border-[var(--user-border)] flex items-center justify-center mb-6">
          <Package size={34} className="text-[var(--user-accent)]" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-[var(--user-text)] mb-3">{t("cart.empty")}</h1>
        <p className="text-xs sm:text-sm text-[var(--user-text-muted)] mb-8 max-w-md mx-auto">{t("checkout.empty.message")}</p>
        <button onClick={() => router.push("/")} className="inline-flex items-center gap-2 bg-[var(--user-accent)] text-[var(--user-accent-text)] px-7 py-3 rounded-xl text-sm font-black hover:opacity-90 active:scale-[0.98] transition">
          <ShoppingBag size={17} /> {t("checkout.startShopping")}
        </button>
      </div>
    );
  }

  // ✅ THEME-SAFE classes — no hardcoded white/black on accent
  const inputCls = "w-full h-12 px-4 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--user-accent)]/30 focus:border-[var(--user-accent)] bg-[var(--user-bg-input)] border-2 border-[var(--user-border)] text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] hover:border-[var(--user-accent)]/40";
  const phoneInputCls = `w-full h-11 rounded-lg border bg-[var(--user-bg-card)] px-3.5 text-sm text-[var(--user-text)] outline-none transition-colors ${
    phoneError
      ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
      : "border-[var(--user-border)] focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
  }`;
  const labelCls = "block text-xs font-bold leading-snug text-start text-[var(--user-text-secondary)] mb-2";
  const cardCls = "rounded-2xl border-2 border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-sm";
  const textareaCls = "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--user-accent)]/30 focus:border-[var(--user-accent)] bg-[var(--user-bg-input)] border-2 border-[var(--user-border)] text-[var(--user-text)] resize-none hover:border-[var(--user-accent)]/40";
  // ✅ Secondary buttons — outline style, glow nahi (shared PrimaryButton sirf primary CTAs ke liye)
  const ghostBtn = "border-2 border-[var(--user-border)] text-[var(--user-text-secondary)] hover:text-[var(--user-text)] hover:border-[var(--user-accent)]/40 transition";

  const SummaryPanel = ({ footer, showItems = true, review = false }) => (
    <div className={`checkout-summary-panel ${showItems ? "checkout-summary-panel-with-items" : ""} ${review ? "checkout-summary-panel-review" : ""} h-auto w-full min-w-0 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 shadow-sm sm:p-5 lg:sticky lg:top-[4.5rem]`}>
      <div className={`checkout-summary-header flex shrink-0 items-center gap-3 ${review ? "mb-3 border-b border-[var(--user-border)] pb-3" : "mb-4"}`}>
        <span className={`checkout-summary-icon flex shrink-0 items-center justify-center border text-[var(--user-accent)] ${review ? "h-9 w-9 rounded-lg" : "h-10 w-10 rounded-xl"}`}>
          <ShoppingBag size={review ? 16 : 17} />
        </span>
        <h2 className={`${review ? "text-sm" : "text-base"} font-semibold text-[var(--user-text)]`}>{t("checkout.summary.title")}</h2>
      </div>

      {showItems && <div className="checkout-summary-products mt-4 mb-0 space-y-2 pr-1">
        {itemsWithDiscounts.map((i) => (
          <div key={i.key} className="flex items-start gap-3">
            <ItemThumb item={i} size="w-14 h-14" />
            <div className="flex-1 min-w-0">
              <p className="text-[0.8125rem] font-bold text-[var(--user-text)] leading-snug line-clamp-2">{text(i.name, i.translations?.name)}</p>
              {i.variantTitle && <p className="text-xs text-[var(--user-text-muted)] mt-0.5 truncate">{text(i.variantTitle, i.variantTranslations?.title)}</p>}
              {i.dealActive && i.dealId && (
                <span className="inline-flex items-center gap-1 text-[0.625rem] font-bold text-[var(--user-accent)] mt-1">
                  <Tag size={10} /> {t("checkout.item.deal")}
                </span>
              )}
              <p className="text-xs text-[var(--user-text-muted)] mt-0.5">{t("checkout.item.quantity", { count: i.qty })}{i.freeItems > 0 ? ` (${t("checkout.item.paidCount", { count: i.payableItems })})` : ""}</p>
            </div>
            <div className="text-right shrink-0">
              {i.hasDiscount && i.originalPrice * i.qty > i.lineTotal && (
                <p className="text-[0.625rem] text-[var(--user-text-subtle)] line-through">Rs. {(i.originalPrice * i.qty).toLocaleString()}</p>
              )}
              <p className="text-[0.8125rem] font-black text-[var(--user-text)]">Rs. {i.lineTotal.toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>}

      <div className={`checkout-summary-totals shrink-0 space-y-2 ${review ? "text-xs" : "text-sm"} ${showItems ? "pt-3 border-t border-[var(--user-border)]" : ""}`}>
        <div className="flex justify-between">
          <span className="text-[var(--user-text)] font-medium">{t("cart.subtotal")} ({t("cart.itemsCount", { count: itemsWithDiscounts.reduce((count, item) => count + item.qty, 0) })})</span>
          <span className="text-[var(--user-text)] font-bold">Rs. {subtotal.toLocaleString()}</span>
        </div>
        {totalSavings > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--user-text)] font-medium">{t("checkout.summary.youSave")}</span>
            <span className="text-[var(--user-success)] font-bold">– Rs. {totalSavings.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-[var(--user-text)] font-medium">{t("cart.shipping")}</span>
          <span className={`font-bold ${shipping === 0 ? "text-[var(--user-success)]" : "text-[var(--user-text)]"}`}>{shipping === 0 ? t("checkout.summary.free") : `Rs. ${shipping}`}</span>
        </div>
        {tax > 0 && (
          <div className="flex justify-between">
            <span className="text-[var(--user-text)] font-medium">{t("cart.tax")}</span>
            <span className="text-[var(--user-text)] font-bold">Rs. {tax.toLocaleString()}</span>
          </div>
        )}
        <div className="checkout-summary-total-row flex justify-between items-center pt-3 border-t border-[var(--user-border)]">
          <span className={`${review ? "text-sm" : "text-base"} font-black text-[var(--user-text)]`}>{t("cart.total")}</span>
          <p className={`${review ? "text-lg" : "text-xl"} checkout-summary-total-value font-black text-[var(--user-accent)]`}>Rs. {grandTotal.toLocaleString()}</p>
        </div>
      </div>
      <div className="checkout-summary-footer mt-4 shrink-0">{footer}</div>
    </div>
  );

  const shippingMethods = [
    { id: "standard", titleKey: "checkout.shipping.standard", time: t("checkout.shipping.days", { min: cfg.standard.min_days, max: cfg.standard.max_days }), rateDescriptionKey: "checkout.shipping.standardRate", icon: Truck, badge: t("checkout.shipping.popular") },
    { id: "express", titleKey: "checkout.shipping.express", time: t("checkout.shipping.days", { min: cfg.express.min_days, max: cfg.express.max_days }), rateDescriptionKey: "checkout.shipping.expressRate", icon: Zap, badge: t("checkout.shipping.fast") },
    // ✅ Admin ke custom shipping methods (Add New se bane hue)
    ...(customShippingMethods || []).map((m) => ({
      id: m.code,
      title: text(m.name, m.translations?.name),
      time: t("checkout.shipping.days", { min: m.min_days, max: m.max_days }),
      rateDescriptionKey: "checkout.shipping.deliveryRate",
      icon: Package,
      custom: true,
      fee: Number(m.fee ?? 0),
    })),
  ];
  const shippingMethodName = (id) => {
    const method = shippingMethods.find((item) => item.id === id);
    return method?.titleKey ? t(method.titleKey) : method?.title;
  };

  return (
    <>
    {/* ============= DESKTOP CHECKOUT ============= */}
    <div className="checkout-premium hidden lg:block">
    <main className="checkout-main w-full min-w-0 max-w-none mx-auto px-3 sm:px-4 lg:px-7 py-5 sm:py-6 lg:py-8 pb-24 sm:pb-28 md:pb-10">
      <style>{`
        @keyframes modalUp { from { opacity: 0; transform: translateY(30px) scale(.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: var(--user-bg-hover); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--user-accent); border-radius: 10px; }
      `}</style>

      {needsPhone ? (
        <div className="max-w-[31.25rem] mx-auto mt-8 sm:mt-12">
          <div className={`${cardCls} checkout-phone-required p-6 sm:p-8`}>
            <div className="w-14 h-14 rounded-2xl bg-[var(--user-accent)] flex items-center justify-center mb-5">
              <Phone size={24} className="text-[var(--user-accent-text)]" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-semibold tracking-tight text-[var(--user-text)]">{t("checkout.phone.requiredTitle")}</h2>
              <p className="text-sm text-[var(--user-text-muted)]">{t("checkout.phone.requiredMessage")}</p>
            </div>
            <label htmlFor="checkout-phone-desktop" className="mt-5 block text-sm font-medium text-[var(--user-text-secondary)]">{t("checkout.phone.label")}</label>
            <input
              id="checkout-phone-desktop"
              dir="auto"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={PHONE_MAX}
              pattern="[0-9]*"
              required
              aria-invalid={phoneError ? "true" : undefined}
              aria-describedby={phoneError ? "checkout-phone-helper-desktop checkout-phone-error-desktop" : "checkout-phone-helper-desktop"}
              value={phone}
              onChange={handlePhoneChange}
              onPaste={handlePhonePaste}
              onKeyDown={handlePhoneKeyDown}
              onBlur={() => setPhoneTouched(true)}
              placeholder={t("checkout.phone.placeholder")}
              className={phoneInputCls}
            />
            <div className="mt-1.5 flex min-h-4 items-center justify-between gap-3">
              {phoneError ? <p id="checkout-phone-error-desktop" className="text-xs text-red-600">{phoneError}</p> : <span />}
              <p id="checkout-phone-helper-desktop" className="shrink-0 text-xs text-[var(--user-text-muted)]">{t("checkout.phone.digitCount", { current: phone.length, max: PHONE_MAX })}</p>
            </div>
            <PrimaryButton
              onClick={savePhone}
              disabled={!phoneIsValid}
              loading={savingPhone}
              loadingText={t("checkout.phone.saving")}
              iconEnd={ArrowRight}
              className="mt-6 h-12"
            >
              {t("checkout.phone.saveContinue")}
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <>
                   {/* ============ STEP 1 — Cart (right card tak height, phir scroll) ============ */}
          {step === 1 && (
            <div className="grid items-start lg:grid-cols-[minmax(0,1fr)_19rem] gap-4 sm:gap-5">
              {/* LEFT: Your Cart */}
              <div className="min-w-0">
                <div className={`${cardCls} overflow-hidden`}>
                  <div className="flex items-end justify-between gap-3 px-5 sm:px-6 py-5 border-b border-[var(--user-border)]">
                    <h2 className="text-3xl font-normal text-[var(--user-text)]">{t("cart.title")}</h2>
                    <span className="text-xs text-[var(--user-text-muted)]">{t("common.price")}</span>
                  </div>

                  {/* ✅ LIST — shows ONLY selected items (selection managed on /cart page) */}
                  <div className="divide-y divide-[var(--user-border)]">
                    {itemsWithDiscounts.map((item) => (
                        <div key={item.key} className="checkout-cart-item flex items-center gap-5 sm:gap-6 px-4 sm:px-6 py-5 sm:py-6">
                          <div className="checkout-item-thumb relative shrink-0">
                            <ItemThumb item={item} size="w-36 h-36 sm:w-40 sm:h-40" />
                          </div>
                          <div className="flex-1 min-w-0 self-center flex flex-col items-start py-1">
                            <p className="text-lg font-normal text-[var(--user-text)] line-clamp-2">{text(item.name, item.translations?.name)}</p>
                            {item.brand && <p className="checkout-item-brand mt-1 text-[0.6875rem] uppercase tracking-wide">{text(item.brand, item.brandTranslations?.name)}</p>}
                            {item.variantTitle && <p className="checkout-item-variant mt-0.5 text-xs">{text(item.variantTitle, item.variantTranslations?.title)}</p>}
                            <p className="checkout-item-stock mt-1 text-xs">{t("product.inStock")}</p>
                            {item.freeItems > 0 ? (
                              <p className="checkout-item-savings mt-1 text-xs">{t("checkout.item.freeQuantitySummary", { paid: item.payableItems, free: item.freeItems })}</p>
                            ) : item.savings + item.dealSavings > 0 ? (
                              <p className="checkout-item-savings mt-1 text-xs">{t("checkout.summary.youSave")}: Rs. {(item.savings * item.qty + item.dealSavings).toLocaleString()}</p>
                            ) : null}
                            {item.dealId && (
                              <span className="checkout-item-deal inline-flex items-center gap-1 text-[0.625rem] mt-1.5">
                                <Tag size={10} /> {t("checkout.item.deal")}
                              </span>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-3">
                              <div className="flex items-center rounded-full border-2 border-[var(--user-border)] bg-[var(--user-bg-card)]">
                                <button
                                  type="button"
                                  aria-label={item.qty === 1 ? t("cart.remove") : t("checkout.item.decreaseQuantity")}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (item.qty === 1) removeCheckoutItem(item.key);
                                    else updateQty(item.key, item.qty - 1);
                                  }}
                                  className="px-3 py-1.5 text-sm text-[var(--user-text)] hover:text-[var(--user-accent)] transition"
                                >
                                  {item.qty === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                                </button>
                                <span className="text-sm font-semibold text-[var(--user-text)] w-8 text-center">{item.qty}</span>
                                <button type="button" aria-label={t("checkout.item.increaseQuantity")} onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateQty(item.key, item.qty + 1); }} className="px-3 py-1.5 text-sm text-[var(--user-text)] hover:text-[var(--user-accent)] transition">
                                  <Plus size={14} />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeCheckoutItem(item.key)}
                                className="checkout-delete-link inline-flex items-center border-l border-[var(--user-border)] pl-3 text-xs hover:underline"
                              >
                                {t("common.delete")}
                              </button>
                            </div>
                          </div>
                          <div className="shrink-0 self-start flex flex-col items-end gap-1 min-w-24">
                            {item.hasDiscount && item.originalPrice * item.qty > item.lineTotal && <p className="text-xs text-[var(--user-text-subtle)] line-through">Rs. {(item.originalPrice * item.qty).toLocaleString()}</p>}
                            <p className="text-base font-semibold text-[var(--user-text)]">Rs. {item.lineTotal.toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* RIGHT: Summary with Proceed button */}
              <SummaryPanel showItems={false} footer={
                <div className="space-y-3">
                  <PrimaryButton
                    onClick={proceedToStep2}
                    disabled={!selectedCartItems.length}
                    iconEnd={ArrowRight}
                    className="h-12"
                  >
                    {t("checkout.proceedDelivery")}
                  </PrimaryButton>
                  <div className="flex items-center justify-center gap-2 text-xs text-[var(--user-text-muted)]">
                    <ShieldCheck size={14} className="text-[var(--user-success)]" />
                    <span className="font-semibold">{t("checkout.secureSsl")}</span>
                  </div>
                </div>
              } />
            </div>
          )}
          {/* Mobile sticky Proceed bar (step 1) */}
          {step === 1 && (
            <div className="fixed bottom-16 left-0 right-0 z-40 md:hidden bg-[var(--user-bg-elevated)]/95 backdrop-blur-md border-t-2 border-[var(--user-border)] px-4 py-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[0.625rem] text-[var(--user-text-muted)] font-semibold">{t("checkout.cart.selectedCount", { count: selectedCartItems.length })}</p>
                  <p className="text-base font-black text-[var(--user-accent)]">Rs. {subtotal.toLocaleString()}</p>
                </div>
                <PrimaryButton
                  onClick={proceedToStep2}
                  disabled={!selectedCartItems.length}
                  iconEnd={ArrowRight}
                    className="h-11 w-auto shrink-0 px-5"
                >
                  {t("checkout.proceed")}
                </PrimaryButton>
              </div>
            </div>
          )}

          {/* ============ STEP 2 ============ */}
          {step === 2 && (
            <div className="checkout-step-two-grid grid w-full min-w-0 grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,72fr)_minmax(0,28fr)]">
              <div className="space-y-4 sm:space-y-5">
                <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center gap-3 border-b border-[var(--user-border)] pb-4">
                    <div className="checkout-address-section-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border">
                      <MapPin size={18} className="text-[var(--user-accent)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold leading-5 text-[var(--user-text)]">{t("checkout.address.title")}</h2>
                      <p className="mt-0.5 text-xs leading-4 text-[var(--user-text-muted)]">{t("checkout.address.subtitle")}</p>
                    </div>
                  </div>
                  {addressFormView === "desktop" ? (
                    <AddressForm
                      inline
                      fresh={!editingAddressId}
                      initialAddress={editingAddressId ? addresses.find((a) => a._id === editingAddressId) : null}
                      onSuccess={handleAddressFormSuccess}
                      onCancel={closeAddressForm}
                    />
                  ) : addressFormView ? null : (
                    <div className="grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {addresses.length ? addresses.map((address) => {
                        const isSelected = selectedAddressId === address._id;
                        return <div key={address._id} onClick={() => setSelectedAddressId(address._id)} className={`checkout-selection-card flex h-full min-h-[10rem] w-full min-w-0 flex-col text-left rounded-xl border p-4 transition-all duration-200 cursor-pointer ${isSelected ? "is-selected" : ""}`}>
                          <div className="flex items-start gap-3">
                            <span className={`checkout-address-indicator mt-0.5 shrink-0 ${isSelected ? "is-selected" : ""}`}>
                              {isSelected && <span className="checkout-address-indicator-dot" />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-[var(--user-text)] truncate">{address.full_name}</p>
                              </div>
                              <p className="text-xs text-[var(--user-text-muted)] leading-relaxed mt-1">
                                {address.street_address1}{address.street_address2 ? `, ${address.street_address2}` : ""}, {address.city}, {address.state}
                              </p>
                              <p className="text-xs text-[var(--user-text-secondary)] font-semibold mt-1">{address.phone}</p>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); openAddressForm("desktop", address); }} aria-label={t("checkout.address.edit")} className="text-[var(--user-text-muted)] hover:text-[var(--user-accent)] transition shrink-0">
                              <Pencil size={15} />
                            </button>
                          </div>
                          <div className="mt-auto flex items-center gap-2 pt-2 border-t border-[var(--user-border)]">
                            <button onClick={(e) => { e.stopPropagation(); openAddressForm("desktop", address); }} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[var(--user-text-muted)] hover:text-[var(--user-accent)] hover:bg-[var(--user-accent)]/10 transition text-xs font-semibold">
                              <Pencil size={11} /> {t("checkout.address.edit")}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); deleteAddress(address._id); }} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[var(--user-text-muted)] hover:text-[var(--user-danger)] hover:bg-[var(--user-danger)]/10 transition text-xs font-semibold">
                              <Trash2 size={11} /> {t("common.delete")}
                            </button>
                          </div>
                        </div>;
                      }) : (
                        <div className="checkout-address-empty-state col-span-full flex min-h-[13.5rem] flex-col items-center justify-center gap-2.5 rounded-xl border border-dashed border-[var(--user-border)] bg-[var(--user-bg-card)] px-4 py-6 text-center">
                          <span className="checkout-address-empty-illustration relative mb-0 flex h-24 w-28 items-center justify-center">
                            <Map className="checkout-address-empty-map absolute bottom-0 left-1/2 h-14 w-[5.5rem] -translate-x-1/2" preserveAspectRatio="none" strokeWidth={1.1} />
                            <MapPin size={44} strokeWidth={1.25} className="checkout-address-empty-pin absolute left-1/2 top-5 -translate-x-1/2" />
                            <Sparkles size={14} strokeWidth={1.4} className="checkout-address-empty-sparkle absolute left-1 top-8" />
                            <Sparkles size={14} strokeWidth={1.4} className="checkout-address-empty-sparkle absolute right-1 top-7" />
                          </span>
                          <p className="text-sm font-semibold text-[var(--user-text)]">{t("checkout.address.noneSaved")}</p>
                          <p className="text-xs text-[var(--user-text-muted)]">{t("checkout.address.addToContinue")}</p>
                        </div>
                      )}
                      <button onPointerEnter={warmAddressForm} onFocus={warmAddressForm} onPointerDown={warmAddressForm} onClick={() => openAddressForm("desktop")} className="checkout-address-add-button col-span-full flex h-12 min-h-0 w-full items-center justify-center gap-2 rounded-xl border bg-[var(--user-bg-card)] px-4 text-sm font-semibold transition active:scale-[0.99]">
                        <Plus size={16} strokeWidth={2} /> {t("checkout.address.add")}
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-2">
                <div className="min-w-0 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center gap-3 border-b border-[var(--user-border)] pb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--user-accent)]/15 bg-[var(--user-accent)]/10">
                      <Truck size={18} className="text-[var(--user-accent)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold leading-5 text-[var(--user-text)]">{t("checkout.shipping.title")}</h2>
                      <p className="mt-0.5 text-xs leading-4 text-[var(--user-text-muted)]">{t("checkout.shipping.subtitle")}</p>
                    </div>
                  </div>
                  {cfg.free_shipping_over > 0 && (
                    <div className="mb-4 p-3 rounded-xl bg-[var(--user-success)]/10 border border-[var(--user-success)]/20">
                      <p className="text-xs text-[var(--user-success)] font-bold flex items-center gap-2"><Gift size={14} /> {t("checkout.shipping.freeOver", { amount: `Rs. ${cfg.free_shipping_over.toLocaleString()}` })}</p>
                    </div>
                  )}
                  <div className="grid auto-rows-fr grid-cols-1 gap-3">
                    {shippingMethods.map((m) => {
                      const active = shippingMethod === m.id;
                      const IconComp = m.icon;
                      // ✅ Custom method => uska apna fee; warna standard/express config fee
                      const baseFee = m.custom ? m.fee : (m.id === "express" ? cfg.express.fee : cfg.standard.fee);
                      // ✅ FREE only if active free-shipping deal covers THIS method
                      const isFreeForThisMethod = freeShippingByActiveItems && freeShippingDealsForMethod(m.id);
                      // ✅ For the SELECTED method, also reflect the server-side quote
                      //    (e.g. subtotal freeOver promotion or method quote). For
                      //    non-selected methods, show their normal base fee.
                      const displayFee = active ? shipping : baseFee;
                      const isFree = active ? (isFreeForCurrentMethod || shipping === 0) : isFreeForThisMethod;
                      const rateDescription = t(m.rateDescriptionKey || "checkout.shipping.deliveryRate");
                      const showRateDescription = !(active && shippingReason && rateDescription.trim().toLocaleLowerCase() === shippingReason.trim().toLocaleLowerCase());
                      // ✅ Show hint on any method NOT covered by the deal (only when a deal exists).
                      const showNotApplicableHint = freeShippingByActiveItems && !isFreeForThisMethod;
                      return (
                        <button key={m.id} aria-pressed={active} onClick={() => { setShippingMethod(m.id); setUserSelectedShipping(true); }} className={`checkout-selection-card flex h-full min-h-[5.75rem] w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all duration-150 hover:border-[var(--user-accent)]/40 sm:gap-4 sm:p-4 ${active ? "is-selected" : ""}`}>
                          <span className={`checkout-option-indicator ${active ? "is-selected" : ""}`}>
                            {active && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
                          </span>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-hover)]/60">
                            <IconComp size={18} className={active ? "text-[var(--user-accent)]" : "text-[var(--user-text-muted)]"} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold leading-5 text-[var(--user-text)]">{m.titleKey ? t(m.titleKey) : m.title}</p>
                            <p className="mt-0.5 text-xs leading-4 text-[var(--user-text-muted)]">{m.time}</p>
                            {showRateDescription && <p className="text-[0.625rem] leading-4 text-[var(--user-text-muted)]">{rateDescription}</p>}
                            <div className="mt-1 min-h-4">
                              {active && shippingReason && <p className="text-[0.625rem] leading-4 text-[var(--user-success)] font-medium">{shippingReason}</p>}
                            {/* ✅ Non-covered method hint (only when a deal exists AND it's not covering this method) */}
                            {showNotApplicableHint && (
                              <p className="text-[0.625rem] leading-4 text-[var(--user-text-muted)] font-medium italic">
                                {t("checkout.shipping.freeNotApplicable")}
                              </p>
                            )}
                            </div>
                          </div>
                          <span className={`min-w-[5.5rem] shrink-0 text-right text-sm font-semibold ${isFree ? "text-[var(--user-success)]" : "text-[var(--user-text)]"}`}>{isFree ? t("checkout.summary.free") : `Rs. ${displayFee.toLocaleString()}`}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="min-w-0 rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 shadow-sm sm:p-5">
                  <div className="mb-4 flex items-center gap-3 border-b border-[var(--user-border)] pb-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--user-accent)]/15 bg-[var(--user-accent)]/10">
                      <CreditCard size={18} className="text-[var(--user-accent)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold leading-5 text-[var(--user-text)]">{t("checkout.payment.title")}</h2>
                      <p className="mt-0.5 text-xs leading-4 text-[var(--user-text-muted)]">{t("checkout.payment.subtitle")}</p>
                    </div>
                  </div>
                  <div className="grid auto-rows-fr grid-cols-1 gap-3">
                    {[
                      { id: "cod", icon: Banknote, titleKey: "checkout.payment.cod", subKey: "checkout.payment.codDescription" },
                      { id: "bank", icon: Landmark, titleKey: "checkout.payment.bank", subKey: "checkout.payment.bankDescription" },
                      { id: "card", icon: CreditCard, titleKey: "checkout.payment.card", subKey: "checkout.payment.cardDescription" },
                    ].map((m) => (
                      <button key={m.id} aria-pressed={paymentMethod === m.id} onClick={() => selectPaymentMethod(m.id)} className={`checkout-selection-card flex h-full min-h-[4.75rem] w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all duration-150 hover:border-[var(--user-accent)]/40 sm:gap-4 sm:p-4 ${paymentMethod === m.id ? "is-selected" : ""}`}>
                        <span className={`checkout-option-indicator ${paymentMethod === m.id ? "is-selected" : ""}`}>
                          {paymentMethod === m.id && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold leading-5 text-[var(--user-text)]">{t(m.titleKey)}</p>
                          <p className="mt-0.5 text-xs leading-4 text-[var(--user-text-muted)]">{t(m.subKey)}</p>
                        </div>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-hover)]/60">
                          <m.icon size={18} className={paymentMethod === m.id ? "text-[var(--user-accent)]" : "text-[var(--user-text-muted)]"} />
                        </span>
                      </button>
                    ))}
                  </div>
                                   {paymentMethod === "bank" && (
                    <div ref={bankDetailsDesktopRef} className="checkout-bank-details mt-4 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-border)] p-4 space-y-3">
                      <p className="text-xs font-bold text-[var(--user-text)]">{t("checkout.bank.details")}</p>
                      <div className="space-y-1 text-xs text-[var(--user-text-muted)]">
                        <p>{t("checkout.bank.account")}: <span className="font-bold text-[var(--user-text)]">{BANK_DETAILS.title}</span></p>
                        <p>{t("checkout.bank.bank")}: <span className="font-bold text-[var(--user-text)]">{BANK_DETAILS.bank}</span></p>
                        <p>{t("checkout.bank.iban")}: <span className="font-mono font-bold text-[var(--user-text)]">{BANK_DETAILS.iban}</span></p>
                      </div>
                      <div className="pt-3 border-t border-[var(--user-border)] space-y-3">
                        <div>
                          <label className={labelCls}>{t("checkout.bank.senderName")}</label>
                          <input 
                            value={bankForm.senderName} 
                            onChange={(e) => {
                              setBankForm({ ...bankForm, senderName: e.target.value });
                              if (bankFormErrors.senderName) setBankFormErrors({ ...bankFormErrors, senderName: "" });
                            }}
                            placeholder={t("checkout.bank.senderPlaceholder")}
                            className={`${inputCls} ${bankFormErrors.senderName ? "!border-red-500 focus:!border-red-500" : ""}`}
                          />
                          {bankFormErrors.senderName && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">{bankFormErrors.senderName}</p>}
                        </div>
                        <div>
                          <label className={labelCls}>{t("checkout.bank.transactionReference")}</label>
                          <input 
                            value={bankForm.transactionRef} 
                            onChange={(e) => {
                              setBankForm({ ...bankForm, transactionRef: e.target.value });
                              if (bankFormErrors.transactionRef) setBankFormErrors({ ...bankFormErrors, transactionRef: "" });
                            }}
                            placeholder={t("checkout.bank.referencePlaceholder")}
                            className={`${inputCls} ${bankFormErrors.transactionRef ? "!border-red-500 focus:!border-red-500" : ""}`}
                          />
                          {bankFormErrors.transactionRef && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">{bankFormErrors.transactionRef}</p>}
                        </div>
                        <p className="text-[0.625rem] text-[var(--user-text-muted)]">{t("checkout.bank.verificationHint")}</p>
                      </div>
                    </div>
                  )}
                  {paymentMethod === "card" && (
                    <div className="mt-5">
                      <CardPreview number={cardForm.number} name={cardForm.name} expiry={cardForm.expiry} t={t} />
                      <div className="space-y-3 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-border)] p-4">
                        <div><label className={labelCls}>{t("checkout.card.number")}</label>
                          <input name="card-number" value={cardForm.number} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 19); setCardForm({ ...cardForm, number: v.replace(/(\d{4})(?=\d)/g, "$1 ") }); if (cardFormErrors.number) setCardFormErrors({ ...cardFormErrors, number: "" }); }} placeholder="1234 5678 9012 3456" className={`${inputCls} ${cardFormErrors.number ? "!border-red-500 focus:!border-red-500" : ""}`} />
                          {cardFormErrors.number && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">{cardFormErrors.number}</p>}
                        </div>
                        <div><label className={labelCls}>{t("checkout.card.holder")}</label>
                          <input name="card-name" value={cardForm.name} onChange={(e) => { setCardForm({ ...cardForm, name: e.target.value }); if (cardFormErrors.name) setCardFormErrors({ ...cardFormErrors, name: "" }); }} placeholder={t("checkout.card.holderPlaceholder")} className={`${inputCls} ${cardFormErrors.name ? "!border-red-500 focus:!border-red-500" : ""}`} />
                          {cardFormErrors.name && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">{cardFormErrors.name}</p>}
                        </div>
                        <div>
                          <label className={labelCls}>{t("checkout.card.expiryDate")}</label>
                          <input name="card-expiry" type="datetime-local" value={cardForm.expiry} onChange={(e) => { setCardForm({ ...cardForm, expiry: e.target.value }); if (cardFormErrors.expiry) setCardFormErrors({ ...cardFormErrors, expiry: "" }); }} className={`${inputCls} ${cardFormErrors.expiry ? "!border-red-500 focus:!border-red-500" : ""}`} />
                          {cardFormErrors.expiry && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5 font-medium">{cardFormErrors.expiry}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </div>

              <SummaryPanel footer={
                <div className="space-y-3">
                  <PrimaryButton
                    onClick={() => selectedAddressId ? goToStep(3) : toast.error(t("checkout.address.selectOrAdd"))}
                    iconEnd={ArrowRight}
                    className="h-12"
                  >
                    {t("checkout.reviewOrder")}
                  </PrimaryButton>
                  <button onClick={backToStep1} className={`w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${ghostBtn}`}>
                    <ArrowLeft size={14} /> {t("checkout.backToCart")}
                  </button>
                </div>
              } />
            </div>
          )}

          {/* ============ STEP 3 ============ */}
          {step === 3 && (
            <div className="grid lg:grid-cols-[1fr_400px] gap-4 sm:gap-6 items-start">
              <div className="space-y-4 sm:space-y-5">
                <div className={`${cardCls} p-6`}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-[var(--user-accent)] flex items-center justify-center">
                      <ShieldCheck size={18} className="text-[var(--user-accent-text)]" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-[var(--user-text)]">{t("checkout.review.title")}</h2>
                      <p className="text-xs text-[var(--user-text-muted)]">{t("checkout.review.subtitle")}</p>
                    </div>
                  </div>
                  <div className="mb-4 grid items-stretch gap-3 sm:grid-cols-2 sm:gap-4 sm:mb-5">
                    <div className="flex h-full flex-col rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)]/50 p-3 sm:p-3.5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--user-text)]">{t("checkout.address.title")}</p>
                        <button onClick={() => goToStep(2)} className="shrink-0 text-xs font-semibold text-[var(--user-accent)] hover:opacity-80">{t("checkout.change")}</button>
                      </div>
                      {selectedAddress && (
                        <div className="space-y-1">
                          <p className="text-sm font-semibold leading-5 text-[var(--user-text)]">{selectedAddress.full_name}</p>
                          <p className="text-[13px] leading-5 text-[var(--user-text-muted)]">
                            {selectedAddress.street_address1}{selectedAddress.street_address2 ? `, ${selectedAddress.street_address2}` : ""}<br />
                            {selectedAddress.city}, {selectedAddress.state}, {selectedAddress.country}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-[var(--user-text-secondary)]"><Phone size={12} /> {selectedAddress.phone}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex h-full flex-col rounded-xl border border-[var(--user-border)] bg-[var(--user-bg-hover)]/50 p-3 sm:p-3.5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--user-text)]">{t("checkout.shippingPayment")}</p>
                        <button onClick={() => goToStep(2)} className="shrink-0 text-xs font-semibold text-[var(--user-accent)] hover:opacity-80">{t("checkout.change")}</button>
                      </div>
                      <div className="space-y-1.5 text-[13px] text-[var(--user-text-muted)]">
                        <div className="flex items-center gap-2">
                          <Truck size={14} className="shrink-0 text-[var(--user-accent)]" />
                          <span className="font-medium text-[var(--user-text)]">{shippingMethodName(shippingMethod)}</span>
                        </div>
                        <p className="pl-[22px] text-xs leading-4">{shippingMethods.find((m) => m.id === shippingMethod)?.time}</p>
                        {shippingReason && <p className="pl-[22px] text-xs font-medium text-[var(--user-success)]">{shippingReason}</p>}
                        <div className="mt-1 flex items-center gap-2 border-t border-[var(--user-border)] pt-2">
                          {paymentMethod === "cod" ? <Banknote size={14} className="shrink-0 text-[var(--user-accent)]" /> : paymentMethod === "bank" ? <Landmark size={14} className="shrink-0 text-[var(--user-accent)]" /> : <CreditCard size={14} className="shrink-0 text-[var(--user-accent)]" />}
                          <span className="font-medium text-[var(--user-text)]">
                            {paymentMethod === "cod" ? t("checkout.payment.cod") : paymentMethod === "bank" ? t("checkout.payment.bank") : t("checkout.payment.debitCreditCard")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border-2 border-[var(--user-border)] p-4 space-y-5">
                    <p className="text-xs font-black text-[var(--user-text)] uppercase tracking-wider">{t("checkout.review.items", { count: itemsWithDiscounts.length })}</p>
                    <div className="divide-y divide-[var(--user-border)]">
                      {itemsWithDiscounts.map((i) => (
                        <div key={i.key} className="flex items-start gap-4 py-1.5 first:pt-0 last:pb-0">
                          <ItemThumb item={i} size="w-14 h-14" />
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <p className="text-xs sm:text-sm font-bold text-[var(--user-text)] line-clamp-2">{text(i.name, i.translations?.name)}</p>
{i.dealActive && i.dealId && (
                              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                <span className="inline-flex items-center gap-1 text-[0.5625rem] sm:text-[0.625rem] font-black text-[var(--user-accent)] bg-[var(--user-accent)]/10 border border-[var(--user-accent)]/20 px-2 py-1 rounded-full">
                                  <Gift size={9} />
                                  {i.dealType === 'buy_x_get_y' ? t("checkout.item.buyGetFree", { buy: i.dealBuyQuantity, get: i.dealGetQuantity }) : text(i.dealName, i.dealTranslations?.name) || t("checkout.item.activeDeal")}
                                </span>
                              </div>
                            )}
                            <p className="text-[0.625rem] sm:text-xs text-[var(--user-text-muted)]">{t("checkout.item.quantity", { count: i.qty })} {i.freeItems > 0 && `(${t("checkout.item.freeQuantitySummary", { paid: i.payableItems, free: i.freeItems })})`}</p>
                          </div>
                          <p className="text-xs sm:text-sm font-black text-[var(--user-text)]">Rs. {Number(i.lineTotal || 0).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <SummaryPanel showItems={false} review footer={
                <div className="space-y-3">
                  <PrimaryButton
                    onClick={placeOrder}
                    loading={placing}
                    loadingText={t("checkout.order.placing")}
                    icon={Lock}
                    className="h-12"
                  >
                    {t("checkout.order.place")}
                  </PrimaryButton>
                  <button onClick={() => goToStep(2)} className={`w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 ${ghostBtn}`}>
                    <ArrowLeft size={14} /> {t("checkout.back")}
                  </button>
                  <div className="flex items-center justify-center gap-2 pt-4 border-t border-[var(--user-border)]">
                    <ShieldCheck size={14} className="text-[var(--user-success)]" />
                    <span className="text-xs text-[var(--user-text-muted)] font-semibold">{t("checkout.payment.secureMessage")}</span>
                  </div>
                </div>
              } />
            </div>
          )}
        </>
      )}

      </main>
    </div>

    {/* ============= MOBILE (Daraz-style single-scroll) — lg:hidden ============= */}
    {(() => {
      // Early-out: loading / empty / needs-phone states render their compact mobile equivalents.
      if (userLoading || !draftReady || (!user && !needsPhone)) {
        return (
          <div className="checkout-premium lg:hidden min-h-[60vh] flex items-center justify-center bg-[var(--user-bg)]" aria-label={t("checkout.loading")}>
            <Loader2 className="animate-spin text-[var(--user-accent)]" size={28} />
            <span className="sr-only">{t("checkout.loading")}</span>
          </div>
        );
      }
      if (!user) return null;

      // Empty cart on step 1 (mobile)
      if (step === 1 && cart.length === 0 && !placing) {
        return (
          <div className="checkout-premium lg:hidden bg-[var(--user-bg)] min-h-[60vh]">
            <div
              className="sticky top-0 z-30 bg-[var(--user-bg-elevated)]/90 backdrop-blur-md border-b border-[var(--user-border)]"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="flex items-center gap-2 px-3 h-12">
                <button type="button" onClick={() => router.push("/")} aria-label={t("checkout.back")} className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] active:scale-90 transition">
                  <ArrowLeft size={20} />
                </button>
                <p className="text-[0.9375rem] font-black text-[var(--user-text)]">{t("cart.checkout")}</p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center pt-16 pb-8 px-4 text-center">
              <div className="w-20 h-20 rounded-full bg-[var(--user-bg-card)] border-2 border-[var(--user-border)] flex items-center justify-center mb-5">
                <Package size={36} className="text-[var(--user-accent)]" />
              </div>
              <h2 className="text-lg font-black text-[var(--user-text)] mb-1.5">{t("cart.empty")}</h2>
              <p className="text-xs text-[var(--user-text-muted)] mb-10 max-w-[17.5rem]">{t("checkout.empty.mobileMessage")}</p>
              <button onClick={() => router.push("/")} className="w-full max-w-xs h-11 rounded-xl bg-[var(--user-accent)] text-[var(--user-accent-text)] text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition">
                <ShoppingBag size={16} /> {t("checkout.startShopping")}
              </button>
            </div>
          </div>
        );
      }

      // needsPhone state — use the same compact card style
      if (needsPhone) {
        return (
          <div className="checkout-premium lg:hidden bg-[var(--user-bg)] min-h-[60vh]">
            <div
              className="sticky top-0 z-30 bg-[var(--user-bg-elevated)]/90 backdrop-blur-md border-b border-[var(--user-border)]"
              style={{ paddingTop: "env(safe-area-inset-top)" }}
            >
              <div className="flex items-center gap-2 px-3 h-12">
                <button type="button" onClick={() => router.push("/")} aria-label={t("checkout.back")} className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] active:scale-90 transition">
                  <ArrowLeft size={20} />
                </button>
                <p className="text-[0.9375rem] font-black text-[var(--user-text)]">{t("cart.checkout")}</p>
              </div>
            </div>
            <div className="px-4 pt-6 pb-8 max-w-[30rem] mx-auto">
              <div className="checkout-phone-required bg-[var(--user-bg-card)] rounded-2xl border-2 border-[var(--user-border)] p-6">
                <div className="w-12 h-12 rounded-2xl bg-[var(--user-accent)] flex items-center justify-center mb-4">
                  <Phone size={22} className="text-[var(--user-accent-text)]" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xl font-semibold tracking-tight text-[var(--user-text)]">{t("checkout.phone.requiredTitle")}</h2>
                  <p className="text-sm text-[var(--user-text-muted)]">{t("checkout.phone.requiredMessage")}</p>
                </div>
                <label htmlFor="checkout-phone-mobile" className="mt-5 block text-sm font-medium text-[var(--user-text-secondary)]">{t("checkout.phone.label")}</label>
                <input
                  id="checkout-phone-mobile"
                  dir="auto"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={PHONE_MAX}
                  pattern="[0-9]*"
                  required
                  aria-invalid={phoneError ? "true" : undefined}
                  aria-describedby={phoneError ? "checkout-phone-helper-mobile checkout-phone-error-mobile" : "checkout-phone-helper-mobile"}
                  value={phone}
                  onChange={handlePhoneChange}
                  onPaste={handlePhonePaste}
                  onKeyDown={handlePhoneKeyDown}
                  onBlur={() => setPhoneTouched(true)}
                  placeholder={t("checkout.phone.placeholder")}
                  className={phoneInputCls}
                />
                <div className="mt-1.5 flex min-h-4 items-center justify-between gap-3">
                  {phoneError ? <p id="checkout-phone-error-mobile" className="text-xs text-red-600">{phoneError}</p> : <span />}
                  <p id="checkout-phone-helper-mobile" className="shrink-0 text-xs text-[var(--user-text-muted)]">{t("checkout.phone.digitCount", { current: phone.length, max: PHONE_MAX })}</p>
                </div>
                <PrimaryButton
                  onClick={savePhone}
                  disabled={!phoneIsValid}
                  loading={savingPhone}
                  loadingText={t("checkout.phone.saving")}
                  iconEnd={ArrowRight}
                  className="mt-5 h-12"
                >
                  {t("checkout.phone.saveContinue")}
                </PrimaryButton>
              </div>
            </div>
          </div>
        );
      }

      // ✅ Main mobile checkout: single-scroll, all cards visible at once.
      const shippingMethodsMob = [
        { id: "standard", titleKey: "checkout.shipping.standard", time: t("checkout.shipping.days", { min: cfg.standard.min_days, max: cfg.standard.max_days }), rateDescriptionKey: "checkout.shipping.standardRate", icon: Truck },
        { id: "express", titleKey: "checkout.shipping.express", time: t("checkout.shipping.days", { min: cfg.express.min_days, max: cfg.express.max_days }), rateDescriptionKey: "checkout.shipping.expressRate", icon: Zap },
        // ✅ Admin ke custom shipping methods (Add New se bane hue)
        ...(customShippingMethods || []).map((m) => ({
          id: m.code,
          title: text(m.name, m.translations?.name),
          time: t("checkout.shipping.days", { min: m.min_days, max: m.max_days }),
          rateDescriptionKey: "checkout.shipping.deliveryRate",
          icon: Package,
          custom: true,
          fee: Number(m.fee ?? 0),
        })),
      ];

      return (
        <div className="checkout-premium lg:hidden bg-[var(--user-bg)]">
          {/* Sticky top app bar */}
          <div
            className="sticky top-0 z-30 bg-[var(--user-bg-elevated)]/90 backdrop-blur-md border-b border-[var(--user-border)]"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <div className="flex items-center gap-2 px-3 h-12">
              <button type="button" onClick={() => router.push("/cart")} aria-label={t("checkout.back")} className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] active:scale-90 transition">
                <ArrowLeft size={20} />
              </button>
              <p className="text-[0.9375rem] font-black text-[var(--user-text)]">{t("cart.checkout")}</p>
            </div>
          </div>

          <div className="px-3 pt-3 pb-28 space-y-3">
            {/* Card 1: Shipping Address — standalone card with header (tappable) */}
            <div className="overflow-hidden rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] shadow-sm">
              <div className="flex items-center gap-3 px-3 pb-2 pt-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--user-accent)]/15 bg-[var(--user-accent)]/10">
                  <MapPin size={17} className="text-[var(--user-accent)]" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold leading-5 text-[var(--user-text)]">{t("checkout.address.title")}</h2>
                  <p className="text-xs leading-4 text-[var(--user-text-muted)]">{t("checkout.address.subtitle")}</p>
                </div>
              </div>
              {addressFormView === "mobile" ? (
                <div className="px-3 pb-3">
                  <AddressForm
                    inline
                    fresh={!editingAddressId}
                    initialAddress={editingAddressId ? addresses.find((a) => a._id === editingAddressId) : null}
                    onSuccess={handleAddressFormSuccess}
                    onCancel={closeAddressForm}
                  />
                </div>
              ) : (
                <div className="px-3 pb-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setEditingAddressId(null); setMobileAddressSheet(true); }}
                    aria-label={t("checkout.address.changeDelivery")}
                    className="flex w-full touch-manipulation items-center gap-3 text-left transition active:scale-[0.99]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--user-accent)]/10">
                      <MapPin size={18} className="text-[var(--user-accent)]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {deliveryAddress ? (
                        <>
                          <p className="truncate text-[0.8125rem] font-black text-[var(--user-text)]">
                            {deliveryAddress.full_name} <span className="font-semibold text-[var(--user-text-muted)]">· {deliveryAddress.phone}</span>
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-[0.6875rem] text-[var(--user-text-muted)]">
                            {deliveryAddress.street_address1}{deliveryAddress.street_address2 ? `, ${deliveryAddress.street_address2}` : ""}, {deliveryAddress.city}, {deliveryAddress.state}
                          </p>
                        </>
                      ) : (
                        <p className="text-[0.75rem] text-[var(--user-text-muted)]">{t("checkout.address.tapToSelect")}</p>
                      )}
                    </div>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--user-text-muted)]">
                      <ChevronDown size={18} />
                    </span>
                  </button>
                  <button
                    type="button"
                    onPointerDown={warmAddressForm}
                    onClick={() => openAddressForm("mobile")}
                    className="mt-2 flex h-10 w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-[var(--user-accent)]/30 bg-[var(--user-accent)]/5 px-3 text-xs font-semibold text-[var(--user-accent)] transition hover:bg-[var(--user-accent)]/10"
                  >
                    <Plus size={15} /> {t("checkout.address.add")}
                  </button>
                </div>
              )}
            </div>

            {/* Card 2: Items (only) */}
            <div className="rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] p-3 space-y-3">
              <p className="text-[0.6875rem] font-black uppercase tracking-wider text-[var(--user-text-muted)] flex items-center gap-1.5">
                <Package size={13} /> {t("checkout.step.items")}
              </p>

              {/* Compact item rows */}
              <div className="space-y-2 pr-1">
                {itemsWithDiscounts.map((i) => (
                  <div key={i.key} className="checkout-cart-item checkout-cart-item-mobile flex items-center gap-2.5 rounded-lg p-1.5">
                    <div className="checkout-item-thumb relative shrink-0">
                      <ItemThumb item={i} size="w-12 h-12" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.75rem] font-bold text-[var(--user-text)] line-clamp-1">{text(i.name, i.translations?.name)}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {i.variantTitle && <p className="text-[0.625rem] text-[var(--user-text-muted)] truncate">{text(i.variantTitle, i.variantTranslations?.title)}</p>}
                        <p className="text-[0.625rem] text-[var(--user-text-muted)]">×{i.qty}{i.freeItems > 0 ? ` (${t("checkout.item.paidCount", { count: i.payableItems })})` : ""}</p>
                      </div>
                    </div>
                    <p className="text-[0.75rem] font-black text-[var(--user-text)] shrink-0">Rs. {i.lineTotal.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Free shipping threshold banner (matches desktop) */}
              {cfg.free_shipping_over > 0 && (
                <p className="text-[0.625rem] font-bold text-[var(--user-success)] bg-[var(--user-success)]/10 border border-[var(--user-success)]/20 rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                  <Gift size={11} /> {t("checkout.shipping.freeOver", { amount: `Rs. ${cfg.free_shipping_over.toLocaleString()}` })}
                </p>
              )}
            </div>

            {/* Card 3: Delivery Method (standalone) */}
            <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-3 border-b border-[var(--user-border)] pb-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--user-accent)]/15 bg-[var(--user-accent)]/10">
                  <Truck size={17} className="text-[var(--user-accent)]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold leading-5 text-[var(--user-text)]">{t("checkout.shipping.title")}</h2>
                  <p className="text-xs leading-4 text-[var(--user-text-muted)]">{t("checkout.shipping.subtitle")}</p>
                </div>
              </div>
              <div className="grid auto-rows-fr grid-cols-1 gap-2">
                  {shippingMethodsMob.map((m) => {
                  const active = shippingMethod === m.id;
                  const IconComp = m.icon;
                  // ✅ Custom method => uska apna fee; warna standard/express config fee
                  const baseFee = m.custom ? m.fee : (m.id === "express" ? cfg.express.fee : cfg.standard.fee);
                  const displayFee = active ? shipping : baseFee;
                  const isFreeForThisMethod = freeShippingByActiveItems && freeShippingDealsForMethod(m.id);
                  const isFree = active ? (isFreeForCurrentMethod || shipping === 0) : isFreeForThisMethod;
                  return (
                    <label
                      key={m.id}
                      className={`checkout-selection-card flex h-full min-h-[4.5rem] items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-150 hover:border-[var(--user-accent)]/40 ${active ? "is-selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="shipping-method-mobile"
                        checked={active}
                        onChange={() => { setShippingMethod(m.id); setUserSelectedShipping(true); }}
                        className="sr-only"
                      />
                      <span className={`checkout-option-indicator ${active ? "is-selected" : ""}`}>
                        {active && <Check size={12} strokeWidth={2.5} aria-hidden="true" />}
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-hover)]/60">
                        <IconComp size={17} className={active ? "text-[var(--user-accent)]" : "text-[var(--user-text-muted)]"} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8125rem] font-semibold leading-5 text-[var(--user-text)]">{m.titleKey ? t(m.titleKey) : m.title}</p>
                        <p className="text-xs leading-4 text-[var(--user-text-muted)]">{m.time}</p>
                        <p className="text-[0.625rem] leading-4 text-[var(--user-text-muted)]">{t(m.rateDescriptionKey || "checkout.shipping.deliveryRate")}</p>
                      </div>
                      <span className={`min-w-[4.75rem] shrink-0 text-right text-xs font-semibold ${isFree ? "text-[var(--user-success)]" : "text-[var(--user-text)]"}`}>
                        {isFree ? t("checkout.summary.free") : `Rs. ${displayFee.toLocaleString()}`}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Card 4: Payment (compact icon chips — equal-width grid) */}
            <div className="rounded-2xl border border-[var(--user-border)] bg-[var(--user-bg-card)] p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-3 border-b border-[var(--user-border)] pb-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--user-accent)]/15 bg-[var(--user-accent)]/10">
                  <CreditCard size={17} className="text-[var(--user-accent)]" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold leading-5 text-[var(--user-text)]">{t("checkout.payment.title")}</h2>
                  <p className="text-xs leading-4 text-[var(--user-text-muted)]">{t("checkout.payment.subtitle")}</p>
                </div>
              </div>
              <div className="grid auto-rows-fr grid-cols-1 gap-2">
                {[
                  { id: "cod", icon: Banknote, titleKey: "checkout.payment.cod", subKey: "checkout.payment.codDescription" },
                  { id: "bank", icon: Landmark, titleKey: "checkout.payment.bank", subKey: "checkout.payment.bankDescription" },
                  { id: "card", icon: CreditCard, titleKey: "checkout.payment.card", subKey: "checkout.payment.cardDescription" },
                ].map((m) => {
                  const active = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => selectPaymentMethod(m.id)}
                      aria-pressed={active}
                      className={`checkout-selection-card flex h-full min-h-[4.5rem] w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-150 hover:border-[var(--user-accent)]/40 ${
                        active ? "is-selected" : "bg-[var(--user-bg-card)] text-[var(--user-text-secondary)]"
                      }`}
                    >
                      <span className={`checkout-option-indicator checkout-option-indicator--compact ${active ? "is-selected" : ""}`}>
                        {active && <Check size={10} strokeWidth={2.5} aria-hidden="true" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.8125rem] font-semibold leading-5 text-[var(--user-text)]">{t(m.titleKey)}</p>
                        <p className="text-xs leading-4 text-[var(--user-text-muted)]">{t(m.subKey)}</p>
                      </div>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--user-border)] bg-[var(--user-bg-hover)]/60">
                        <m.icon size={17} className={active ? "text-[var(--user-accent)]" : "text-[var(--user-text-muted)]"} />
                      </span>
                    </button>
                  );
                             })}
              </div>

              {/* ✅ Mobile: Bank transfer info + fillable fields */}
              {paymentMethod === "bank" && (
                <div ref={bankDetailsMobileRef} className="checkout-bank-details rounded-lg bg-[var(--user-bg-hover)]/60 border border-[var(--user-border)] p-3 space-y-2.5">
                  <p className="text-[0.6875rem] font-bold text-[var(--user-text)]">{t("checkout.bank.details")}</p>
                  <div className="space-y-1 text-[0.6875rem] text-[var(--user-text-muted)]">
                    <p>{t("checkout.bank.account")}: <span className="font-bold text-[var(--user-text)]">{BANK_DETAILS.title}</span></p>
                    <p>{t("checkout.bank.bank")}: <span className="font-bold text-[var(--user-text)]">{BANK_DETAILS.bank}</span></p>
                    <p>{t("checkout.bank.iban")}: <span className="font-mono font-bold text-[var(--user-text)]">{BANK_DETAILS.iban}</span></p>
                  </div>
                  <div className="pt-2 border-t border-[var(--user-border)] space-y-2.5">
                    <div>
                      <label className="block text-[0.625rem] font-bold text-[var(--user-text-secondary)] mb-1 uppercase tracking-wider">{t("checkout.bank.senderName")}</label>
                      <input 
                        value={bankForm.senderName} 
                        onChange={(e) => {
                          setBankForm({ ...bankForm, senderName: e.target.value });
                          if (bankFormErrors.senderName) setBankFormErrors({ ...bankFormErrors, senderName: "" });
                        }}
                        placeholder={t("checkout.bank.senderPlaceholder")}
                        className={`w-full h-10 px-3 rounded-lg text-[0.75rem] outline-none border-2 bg-[var(--user-bg-input)] text-[var(--user-text)] transition ${bankFormErrors.senderName ? "border-red-500 focus:border-red-500" : "border-[var(--user-border)] focus:border-[var(--user-accent)]"}`}
                      />
                      {bankFormErrors.senderName && <p className="text-[0.625rem] text-red-600 dark:text-red-400 mt-1 font-medium">{bankFormErrors.senderName}</p>}
                    </div>
                    <div>
                      <label className="block text-[0.625rem] font-bold text-[var(--user-text-secondary)] mb-1 uppercase tracking-wider">{t("checkout.bank.transactionId")}</label>
                      <input 
                        value={bankForm.transactionRef} 
                        onChange={(e) => {
                          setBankForm({ ...bankForm, transactionRef: e.target.value });
                          if (bankFormErrors.transactionRef) setBankFormErrors({ ...bankFormErrors, transactionRef: "" });
                        }}
                        placeholder={t("checkout.bank.referencePlaceholder")}
                        className={`w-full h-10 px-3 rounded-lg text-[0.75rem] outline-none border-2 bg-[var(--user-bg-input)] text-[var(--user-text)] transition ${bankFormErrors.transactionRef ? "border-red-500 focus:border-red-500" : "border-[var(--user-border)] focus:border-[var(--user-accent)]"}`}
                      />
                      {bankFormErrors.transactionRef && <p className="text-[0.625rem] text-red-600 dark:text-red-400 mt-1 font-medium">{bankFormErrors.transactionRef}</p>}
                    </div>
                  </div>
                </div>
              )}

              {/* ✅ Mobile: Card form */}
              {paymentMethod === "card" && (
                <div className="rounded-lg bg-[var(--user-bg-hover)]/60 border border-[var(--user-border)] p-3 space-y-2.5">
                  <div>
                    <label className="block text-[0.625rem] font-bold text-[var(--user-text-secondary)] mb-1 uppercase tracking-wider">{t("checkout.card.number")}</label>
                    <input 
                      name="card-number"
                      value={cardForm.number} 
                      onChange={(e) => { 
                        const v = e.target.value.replace(/\D/g, "").slice(0, 19); 
                        setCardForm({ ...cardForm, number: v.replace(/(\d{4})(?=\d)/g, "$1 ") }); 
                        if (cardFormErrors.number) setCardFormErrors({ ...cardFormErrors, number: "" });
                      }} 
                      placeholder="1234 5678 9012 3456" 
                      className={`w-full h-10 px-3 rounded-lg text-[0.75rem] outline-none border-2 bg-[var(--user-bg-input)] text-[var(--user-text)] transition ${cardFormErrors.number ? "border-red-500 focus:border-red-500" : "border-[var(--user-border)] focus:border-[var(--user-accent)]"}`} 
                    />
                    {cardFormErrors.number && <p className="text-[0.625rem] text-red-600 dark:text-red-400 mt-1 font-medium">{cardFormErrors.number}</p>}
                  </div>
                  <div>
                    <label className="block text-[0.625rem] font-bold text-[var(--user-text-secondary)] mb-1 uppercase tracking-wider">{t("checkout.card.holder")}</label>
                    <input 
                      name="card-name"
                      value={cardForm.name} 
                      onChange={(e) => {
                        setCardForm({ ...cardForm, name: e.target.value });
                        if (cardFormErrors.name) setCardFormErrors({ ...cardFormErrors, name: "" });
                      }} 
                      placeholder={t("checkout.card.holderPlaceholder")}
                      className={`w-full h-10 px-3 rounded-lg text-[0.75rem] outline-none border-2 bg-[var(--user-bg-input)] text-[var(--user-text)] transition ${cardFormErrors.name ? "border-red-500 focus:border-red-500" : "border-[var(--user-border)] focus:border-[var(--user-accent)]"}`} 
                    />
                    {cardFormErrors.name && <p className="text-[0.625rem] text-red-600 dark:text-red-400 mt-1 font-medium">{cardFormErrors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-[0.625rem] font-bold text-[var(--user-text-secondary)] mb-1 uppercase tracking-wider">{t("checkout.card.expiryDate")}</label>
                    <input
                      name="card-expiry"
                      type="datetime-local"
                      value={cardForm.expiry}
                      onChange={(e) => {
                        setCardForm({ ...cardForm, expiry: e.target.value });
                        if (cardFormErrors.expiry) setCardFormErrors({ ...cardFormErrors, expiry: "" });
                      }}
                      className={`w-full h-10 px-3 rounded-lg text-[0.75rem] outline-none border-2 bg-[var(--user-bg-input)] text-[var(--user-text)] transition ${cardFormErrors.expiry ? "border-red-500 focus:border-red-500" : "border-[var(--user-border)] focus:border-[var(--user-accent)]"}`}
                    />
                    {cardFormErrors.expiry && <p className="text-[0.625rem] text-red-600 dark:text-red-400 mt-1 font-medium">{cardFormErrors.expiry}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Card 4: Order summary */}
            <div className="rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] p-3 space-y-2">
              <p className="text-[0.6875rem] font-black uppercase tracking-wider text-[var(--user-text-muted)] flex items-center gap-1.5">
                <PackageCheck size={13} /> {t("checkout.summary.title")}
              </p>
              <div className="space-y-1.5 text-[0.75rem]">
                <div className="flex justify-between text-[var(--user-text-muted)]">
                  <span>{t("checkout.summary.itemsTotal", { count: itemsWithDiscounts.length })}</span>
                  <span className="font-bold text-[var(--user-text)]">Rs. {subtotal.toLocaleString()}</span>
                </div>
                {totalSavings > 0 && (
                  <div className="flex justify-between text-[var(--user-success)]">
                    <span className="font-bold">{t("checkout.summary.youSave")}</span>
                    <span className="font-black">-Rs. {totalSavings.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-[var(--user-text-muted)]">
                  <span>{t("checkout.summary.shippingFee")}</span>
                  <span className={`font-bold ${shipping === 0 ? "text-[var(--user-success)]" : "text-[var(--user-text)]"}`}>
                    {shipping === 0 ? t("checkout.summary.free") : `Rs. ${shipping.toLocaleString()}`}
                  </span>
                </div>
                {tax > 0 && (
                  <div className="flex justify-between text-[var(--user-text-muted)]">
                    <span>{t("cart.tax")}</span>
                    <span className="font-bold text-[var(--user-text)]">Rs. {tax.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-[var(--user-border)]">
                  <span className="text-[0.8125rem] font-black text-[var(--user-text)]">{t("cart.total")}</span>
                  <span className="text-lg font-black text-[var(--user-accent)]">Rs. {grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky bottom bar — direct child of lg:hidden page root, fixed bottom-0 z-50 */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--user-bg-elevated)]/95 backdrop-blur-md border-t border-[var(--user-border)]"
            style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
          >
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-[0.625rem] text-[var(--user-text-muted)] font-bold uppercase tracking-wider">
                  {t("cart.total")}
                  <span className={`ml-1 ${shipping === 0 ? "text-[var(--user-success)]" : "text-[var(--user-text-muted)]"}`}>
                    {shipping === 0 ? t("checkout.summary.freeShipping") : t("checkout.summary.includingShipping")}
                  </span>
                </p>
                <p className="text-base font-black text-[var(--user-accent)] leading-none mt-0.5">Rs. {grandTotal.toLocaleString()}</p>
              </div>
              <PrimaryButton
                onClick={() => setOrderReviewOpen(true)}
                loading={placing}
                loadingText={t("checkout.order.placing")}
                icon={Lock}
                className="h-11 w-auto shrink-0 px-6"
              >
                {t("checkout.order.place")}
              </PrimaryButton>
            </div>
          </div>

          {/* Mobile Address Selector Sheet (Daraz-style) */}
          {mobileAddressSheet && (
            <div
              className="fixed inset-0 z-[60] flex items-end bg-black/70 backdrop-blur-sm"
                onClick={() => { setMobileAddressSheet(false); setEditingAddressId(null); }}
                style={{ animation: "fadeIn 0.2s ease-out" }}
            >
              <div
                className="w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-[var(--user-bg-card)] border-t-2 border-[var(--user-border)] shadow-2xl"
                style={{ animation: "modalUp .3s ease-out", paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Sheet header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--user-border)] bg-[var(--user-bg-card)]/95 backdrop-blur-sm">
                  <h3 className="text-[0.9375rem] font-black text-[var(--user-text)]">
                    {t("checkout.address.title")}
                  </h3>
                  <button
                    type="button"
                    onClick={() => { setMobileAddressSheet(false); setEditingAddressId(null); }}
                    aria-label={t("common.close")}
                    className="h-8 w-8 flex items-center justify-center rounded-full text-[var(--user-text-muted)] hover:bg-[var(--user-bg-hover)] active:scale-90 transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Current address and address actions */}
                <div className="p-3 space-y-2">
                    {addresses.length === 0 && (
                      <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--user-accent)]/10 text-[var(--user-accent)]">
                          <MapPin size={22} />
                        </div>
                        <p className="text-sm font-medium text-[var(--user-text-secondary)]">{t("checkout.address.noneSaved")}</p>
                      </div>
                    )}
                  {addresses.map((a) => {
                      const isSel = selectedAddressId === a._id;
                      return (
                        <div
                          key={a._id}
                          className={`checkout-selection-card w-full text-left rounded-xl border-2 p-3 transition-colors duration-150 ${isSel ? "is-selected" : ""}`}
                        >
                          <button
                            type="button"
                            onClick={() => { setSelectedAddressId(a._id); setMobileAddressSheet(false); setEditingAddressId(null); }}
                            className="w-full text-left"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-[0.8125rem] font-black text-[var(--user-text)] truncate">{a.full_name}</p>
                              <span className="text-[0.6875rem] text-[var(--user-text-muted)] font-semibold">· {a.phone}</span>
                              {isSel && <Check size={14} className="checkout-selection-check ml-auto shrink-0" />}
                            </div>
                            <p className="text-[0.6875rem] text-[var(--user-text-muted)] line-clamp-2 leading-snug">
                              {a.street_address1}{a.street_address2 ? `, ${a.street_address2}` : ""}, {a.city}, {a.state}
                            </p>
                          </button>
                          <div className="flex items-center gap-2 pt-2 mt-2 border-t border-[var(--user-border)]">
                            <button
                              type="button"
                              onClick={() => openAddressForm("mobile", a)}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[var(--user-text-muted)] hover:text-[var(--user-accent)] hover:bg-[var(--user-accent)]/10 transition text-[0.6875rem] font-semibold"
                            >
                              <Pencil size={11} /> {t("checkout.address.edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => { if (window.confirm(t("checkout.address.deleteConfirmation"))) deleteAddress(a._id); }}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[var(--user-text-muted)] hover:text-[var(--user-danger)] hover:bg-[var(--user-danger)]/10 transition text-[0.6875rem] font-semibold"
                            >
                              <Trash2 size={11} /> {t("common.delete")}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onPointerEnter={warmAddressForm}
                      onFocus={warmAddressForm}
                      onPointerDown={warmAddressForm}
                      onClick={() => openAddressForm("mobile")}
                      className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--user-accent)] bg-[var(--user-accent)] px-4 text-[0.75rem] font-semibold text-[var(--user-accent-text)] transition hover:opacity-90 active:scale-[0.99]"
                    >
                      <Plus size={14} /> {t("checkout.address.add")}
                    </button>
                </div>

                {/* Summary */}
                <div className="px-4 py-3 border-t border-[var(--user-border)] space-y-2 text-[0.75rem]">
                  <div className="flex justify-between">
                    <span className="text-[var(--user-text-muted)]">{t("checkout.summary.itemsTotal", { count: itemsWithDiscounts.length })}</span>
                    <span className="font-bold text-[var(--user-text)]">Rs. {subtotal.toLocaleString()}</span>
                  </div>
                  {totalSavings > 0 && (
                    <div className="flex justify-between">
                      <span className="font-bold text-[var(--user-success)]">{t("checkout.summary.youSave")}</span>
                      <span className="font-black text-[var(--user-success)]">-Rs. {totalSavings.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-[var(--user-text-muted)]">{t("checkout.summary.shippingFee")}</span>
                    <span className={`font-bold ${shipping === 0 ? "text-[var(--user-success)]" : "text-[var(--user-text)]"}`}>
                      {shipping === 0 ? t("checkout.summary.free") : `Rs. ${shipping.toLocaleString()}`}
                    </span>
                  </div>
                  {tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[var(--user-text-muted)]">{t("cart.tax")}</span>
                      <span className="font-bold text-[var(--user-text)]">Rs. {tax.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-baseline pt-2 mt-1 border-t border-[var(--user-border)]">
                    <span className="text-[0.8125rem] font-black text-[var(--user-text)]">{t("cart.total")}</span>
                    <span className="text-lg font-black text-[var(--user-text)]">Rs. {grandTotal.toLocaleString()}</span>
                  </div>
                </div>

                {/* Confirm button — calls EXISTING submit handler */}
                <div className="px-4 pt-2 pb-1">
                  <PrimaryButton
                    onClick={placeOrder}
                    loading={placing}
                    loadingText={t("checkout.order.placing")}
                    icon={Lock}
                    className="h-12"
                  >
                    {t("checkout.order.confirmPlace")}
                  </PrimaryButton>
                </div>
              </div>
            </div>
                )}

          {/* ✅ Mobile Order Review Sheet (Daraz-style) */}
          {orderReviewOpen && (
            <div className="fixed inset-0 z-[70] flex items-end bg-black/70 backdrop-blur-sm" onClick={() => setOrderReviewOpen(false)} style={{ animation: "fadeIn 0.2s ease-out" }}>
              <div className="w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-[var(--user-bg-card)] border-t-2 border-[var(--user-border)] shadow-2xl" style={{ animation: "modalUp .3s ease-out", paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-[var(--user-border)] bg-[var(--user-bg-card)]/95 backdrop-blur-sm">
                  <h3 className="text-[0.9375rem] font-black text-[var(--user-text)]">{t("checkout.review.orderReview")}</h3>
                  <button type="button" onClick={() => setOrderReviewOpen(false)} aria-label={t("common.close")} className="h-8 w-8 flex items-center justify-center rounded-full text-[var(--user-text-muted)] hover:bg-[var(--user-bg-hover)] active:scale-90 transition"><X size={18} /></button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="divide-y divide-[var(--user-border)]">
                  {itemsWithDiscounts.map((i) => (
                    <div key={i.key} className="flex items-center gap-4 py-1.5 first:pt-0 last:pb-0">
                      <ItemThumb item={i} size="w-12 h-12" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[0.75rem] font-bold text-[var(--user-text)] line-clamp-1">{text(i.name, i.translations?.name)}</p>
                        <p className="text-[0.625rem] text-[var(--user-text-muted)]">×{i.qty}{i.freeItems > 0 ? ` (${t("checkout.item.paidCount", { count: i.payableItems })})` : ""}</p>
                      </div>
                      <p className="text-[0.75rem] font-black text-[var(--user-text)]">Rs. {i.lineTotal.toLocaleString()}</p>
                    </div>
                  ))}
                  </div>
                  <div className="rounded-lg bg-[var(--user-bg-hover)]/50 border border-[var(--user-border)] p-3 text-[0.6875rem] space-y-1.5">
                    <p className="font-bold text-[var(--user-text)] flex items-center gap-1.5"><MapPin size={12} className="text-[var(--user-accent)]" /> {selectedAddress ? `${selectedAddress.full_name} · ${selectedAddress.phone}` : t("checkout.address.noneSelected")}</p>
                    {selectedAddress && <p className="text-[var(--user-text-muted)] line-clamp-2">{selectedAddress.street_address1}, {selectedAddress.city}, {selectedAddress.state}</p>}
                    <p className="font-bold text-[var(--user-text)] flex items-center gap-1.5 pt-1 border-t border-[var(--user-border)]"><CreditCard size={12} className="text-[var(--user-accent)]" /> {paymentMethod === "cod" ? t("checkout.payment.cod") : paymentMethod === "bank" ? t("checkout.payment.bank") : t("checkout.payment.debitCreditCard")}</p>
                  </div>
                  <div className="space-y-2.5 text-[0.75rem] pt-3">
                    <div className="flex justify-between text-[var(--user-text-muted)]"><span>{t("checkout.summary.itemsTotal", { count: itemsWithDiscounts.length })}</span><span className="font-bold text-[var(--user-text)]">Rs. {subtotal.toLocaleString()}</span></div>
                    {totalSavings > 0 && <div className="flex justify-between text-[var(--user-success)]"><span className="font-bold">{t("checkout.summary.youSave")}</span><span className="font-black">-Rs. {totalSavings.toLocaleString()}</span></div>}
                    <div className="flex justify-between text-[var(--user-text-muted)]"><span>{t("cart.shipping")}</span><span className="font-bold">{shipping === 0 ? t("checkout.summary.free") : `Rs. ${shipping.toLocaleString()}`}</span></div>
                    <div className="flex justify-between items-baseline pt-3 border-t border-[var(--user-border)]"><span className="text-[0.8125rem] font-black text-[var(--user-text)]">{t("cart.total")}</span><span className="text-lg font-black text-[var(--user-accent)]">Rs. {grandTotal.toLocaleString()}</span></div>
                  </div>
                </div>
                <div className="px-4 pt-3 pb-1">
                  <PrimaryButton
                    onClick={placeOrder}
                    loading={placing}
                    loadingText={t("checkout.order.placing")}
                    icon={Lock}
                    className="h-12"
                  >
                    {t("checkout.order.confirmPlace")}
                  </PrimaryButton>
                </div>
              </div>
            </div>
          )}
        </div>

      );
    })()}
    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="flex h-[60vh] items-center justify-center"><div className="w-16 h-16 rounded-full border-4 border-[var(--user-border)] border-t-[var(--user-accent)] animate-spin" /></div>}>
      <CheckoutContent />
    </Suspense>
  );
}
