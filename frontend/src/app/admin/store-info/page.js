"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDispatch } from "react-redux";
import { setStoreInfo } from "@/redux/slices/storeInfoSlice";
import { toast } from "sonner";

import {
  Save,
  UploadCloud,
  Loader2,
  Store,
  Mail,
  ImageIcon,
  MapPin,
  Briefcase,
  Share2,
  ShieldCheck,
  Globe,
  Building2,
  Coins,
  Phone,
  Pencil,
  Check,
  ExternalLink,
  CalendarDays,
  Users,
  MapPinned,
  Tag,
  ArrowLeft,
  Trash2,
  Search,
  ChevronDown,
  Plus,
  X,
} from "lucide-react";

import { useSocket } from "@/hooks/useSocket";
import { useQuery } from "@tanstack/react-query";
import adminHttp from "@/apis/adminHttp"
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

import { Country, State, City } from "country-state-city";
import cc from "currency-codes";

// ======================================================
// CONFIG
// ======================================================

const getServerUrl = () => {
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "")
  );
};

const API_BASE_URL = getServerUrl();

// ======================================================
// EMPTY FORM
// ======================================================

const EMPTY_FORM = {
  store_name: "",
  tagline: "",
  email: "",
  phone: "",
  support_email: "",
  support_phone: "",
  country: "",
  city: "",
  state: "",
  zip_code: "",
  address: "",
  currency: "",
  tax_rate: "",
  weight_unit: "kg",
  business_type: "",
  total_employees: "",
  year_established: "",
  store_status: "open",
  maintenance_message: "",
  meta_title: "",
  meta_description: "",
  meta_keywords: "",
  return_policy: "",
  privacy_policy: "",
  terms_conditions: "",
  social_links: {
    facebook: "",
    instagram: "",
    twitter: "",
    linkedin: "",
    youtube: "",
  },
};

// ======================================================
// SOCIAL SVG ICONS
// ======================================================

const IconFacebook = ({ size = 15, className, style }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
    <path d="M24 12.073C24 5.446 18.627.073 12 .073S0 5.446 0 12.073c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953h-1.515c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073Z" />
  </svg>
);

const IconInstagram = ({ size = 15, className, style }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
    <rect width="20" height="20" x="2" y="2" rx="5" />
    <path d="M16 11.37a4 4 0 1 1-3.37-3.37A4 4 0 0 1 16 11.37Z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const IconTwitter = ({ size = 15, className, style }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231z" />
  </svg>
);

const IconLinkedin = ({ size = 15, className, style }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125ZM7.119 20.452H3.555V9h3.564z" />
  </svg>
);

const IconYoutube = ({ size = 15, className, style }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136C4.495 18.319 12 18.319 12 18.319s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
  </svg>
);

// ======================================================
// 🛠️ LOGO URL HELPER (FIXED FOR ABSOLUTE FILE PATHS)
// ======================================================

const getLogoUrl = (storeData) => {
  if (!storeData) return "";
  
  // Check if logo exists and has img_url
  if (storeData?.logo?.img_url) {
    const imgUrl = storeData.logo.img_url;
    // 1. If it's already a proper URL or Base64
    if (imgUrl.startsWith("http://") || imgUrl.startsWith("https://") || imgUrl.startsWith("data:image")) {
      return imgUrl;
    }

    const serverUrl = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") || process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ;

    // 2. FIX: Agar "/home/...", "/Users/..." ya koi absolute system path hai
    if ((imgUrl.startsWith("/") && !imgUrl.startsWith("/uploads"))) {
      // Agar path mein "/uploads/store/" zaroor hai, toh uska baad ka hissa nikaal lo
      if (imgUrl.includes("/uploads/store/")) {
        const fileName = imgUrl.split("/uploads/store/")[1];
        if (fileName) return `${serverUrl}/uploads/store/${fileName}`;
      } else {
        // Agar nahi hai, toh bas last slash ke baad wala filename le lo
        const fileName = imgUrl.split("/").pop();
        if (fileName) return `${serverUrl}/uploads/store/${fileName}`;
      }
    }

    // 3. Normal relative path handle karna
    const cleanPath = imgUrl.startsWith("/") ? imgUrl : `/${imgUrl}`;
    return `${serverUrl}${cleanPath}`;
  }
  
  if (storeData?.logo && typeof storeData.logo === 'object') {
    const possibleUrl = storeData.logo.url || storeData.logo.path || storeData.logo.fileUrl;
    if (possibleUrl) {
      if (possibleUrl.startsWith("http://") || possibleUrl.startsWith("https://") || possibleUrl.startsWith("data:image")) {
        return possibleUrl;
      }
      
      const serverUrl = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "") || process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ;
      
      // Apply the same absolute path FIX for fallback properties
      if ((possibleUrl.startsWith("/") && !possibleUrl.startsWith("/uploads")) && possibleUrl.includes("/uploads/store/")) {
        const fileName = possibleUrl.split("/uploads/store/")[1];
        if (fileName) return `${serverUrl}/uploads/store/${fileName}`;
      }
      
      const cleanPath = possibleUrl.startsWith("/") ? possibleUrl : `/${possibleUrl}`;
      return `${serverUrl}${cleanPath}`;
    }
  }
  return "";
};

// ======================================================
// SEARCHABLE SELECT — Location / Currency dropdowns
// ======================================================
// ✅ KYUN CUSTOM (react-select ki jagah):
//   1) react-select ka menu control ke ANDAR render hota tha, aur Location /
//      Business cards par `overflow-hidden` laga hai — is liye list kat jati thi
//      aur neeche wale options par click hi nahi ho sakta tha. Ab list portal se
//      document.body par `position: fixed` ke saath khulti hai, is liye koi card
//      use clip nahi kar sakta.
//   2) Dropdown ke andar VISIBLE search field (top par pinned) + result count +
//      "no results" state — lambi lists ke liye zaroori (e.g. England = 2,919
//      cities, aur India ke states me 574 tak cities).
//   3) Kuch regions ka city data dataset me hi nahi hota (58 countries + kuch US
//      territories) — allowCustom se wahan apna city type karke select ho jata
//      hai, warna wo dropdown khaali + disabled hi reh jata tha.
//   4) Baaki form fields jaisa hi look (same theme tokens, h-10/md:h-9, 13px).
const MAX_VISIBLE_OPTIONS = 300;

function SearchSelect({
  value = "",
  options = [],
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled = false,
  allowCustom = false,
  customPrefix = "Use",
  emptyText = "No results found",
  hint = "",
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [rect, setRect] = useState(null);

  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const listRef = useRef(null);

  // ⚠️ Legacy data: DB me aisa state/city ho sakta hai jo dataset me na ho
  // (pehle haath se type kiya gaya ho) — usko bhi trigger par dikhana zaroori hai,
  // warna saved value gayab lagti hai. Is liye raw value ka fallback rakha hai.
  const selected = options.find((o) => String(o.value) === String(value)) || null;
  const displayLabel = selected ? selected.label : value ? String(value) : "";
  const term = search.trim().toLowerCase();
  const filtered = term ? options.filter((o) => String(o.label).toLowerCase().includes(term)) : options;
  const visible = filtered.slice(0, MAX_VISIBLE_OPTIONS);
  const hiddenCount = filtered.length - visible.length;
  const canAddCustom =
    allowCustom && term.length > 0 && !filtered.some((o) => String(o.label).toLowerCase() === term);

  const closePanel = () => { setOpen(false); setSearch(""); setHighlight(0); };

  // ✅ rect click handler me nikalti hai (event handler) — is liye kisi effect me
  //    synchronous setState nahi hota.
  const openPanel = () => {
    if (disabled) return;
    const r = triggerRef.current?.getBoundingClientRect();
    if (!r) return;
    setRect(r);
    setSearch("");
    setHighlight(0);
    setOpen(true);
  };

  const pick = (val) => {
    if (val === undefined || val === null || val === "") return;
    onChange?.(String(val));
    closePanel();
  };
  // Outside click par close + scroll/resize par panel ko trigger ke saath rakho
  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const r = triggerRef.current?.getBoundingClientRect();
      if (r) setRect(r);
    };
    const onDocMouseDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  // Arrow keys se navigate karte waqt highlighted option ko view me rakho
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector('[data-highlighted="true"]');
    if (el && typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  const onSearchKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, visible.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = visible[highlight];
      if (opt) pick(opt.value);
      else if (canAddCustom) pick(search.trim());
    } else if (e.key === "Escape") {
      e.preventDefault();
      closePanel();
    } else if (e.key === "Tab") {
      closePanel();
    }
  };

  // Panel ki position/size — neeche jagah kam ho to upar flip karo.
  // (rect sirf client par set hota hai, is liye SSR par window access nahi hota.)
  const panelWidth = rect ? Math.max(rect.width, 240) : 240;
  const spaceBelow = rect ? window.innerHeight - rect.bottom : 0;
  const openUp = rect ? spaceBelow < 260 && rect.top > spaceBelow : false;
  const panelMaxHeight = rect ? Math.max(200, Math.min(340, openUp ? rect.top - 16 : spaceBelow - 16)) : 320;
  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => (open ? closePanel() : openPanel())}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={placeholder}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-[16px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60 md:h-9 md:text-[13px]"
        style={{
          backgroundColor: "var(--bg-card)",
          border: `1px solid ${open ? "var(--accent)" : "var(--border-color)"}`,
          color: "var(--text-primary)",
        }}
      >
        <span className="truncate" style={{ color: displayLabel ? "var(--text-primary)" : "var(--text-muted)" }}>
          {displayLabel || placeholder}
        </span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 transition-transform"
          style={{ color: "var(--text-muted)", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && rect && createPortal(
        <div
          ref={panelRef}
          role="listbox"
          aria-label={placeholder}
          className="flex flex-col overflow-hidden"
          style={{
            position: "fixed",
            left: rect.left,
            width: panelWidth,
            top: openUp ? undefined : rect.bottom + 6,
            bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
            maxHeight: panelMaxHeight,
            zIndex: 9999,
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            boxShadow: "0 14px 32px rgba(0,0,0,0.22)",
          }}
        >
          {/* Search field — list ke top par pinned */}
          <div className="shrink-0 p-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: "var(--text-muted)" }}
              />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setHighlight(0); }}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-9 w-full rounded-md pl-8 pr-8 text-[16px] outline-none md:text-[13px]"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  border: "1px solid var(--border-color)",
                  color: "var(--text-primary)",
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(""); setHighlight(0); }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2 px-0.5">
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                {filtered.length} {filtered.length === 1 ? "result" : "results"}
              </span>
              {hint ? (
                <span className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{hint}</span>
              ) : null}
            </div>
          </div>
          {/* Options list */}
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1">
            {visible.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>
                {allowCustom ? "No match — apna naam type karke Enter / Add dabayein" : emptyText}
              </p>
            ) : (
              visible.map((o, i) => {
                const isSelected = !!selected && String(o.value) === String(selected.value);
                return (
                  <button
                    key={String(o.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-highlighted={i === highlight ? "true" : undefined}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => pick(o.value)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px]"
                    style={{
                      backgroundColor: i === highlight ? "var(--bg-tertiary)" : "transparent",
                      color: isSelected ? "var(--accent)" : "var(--text-primary)",
                    }}
                  >
                    <span className="truncate">{o.label}</span>
                    {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                  </button>
                );
              })
            )}
          </div>

          {/* Custom value (jab dataset me option hi na ho) */}
          {canAddCustom ? (
            <button
              type="button"
              onClick={() => pick(search.trim())}
              className="flex shrink-0 items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold"
              style={{
                borderTop: "1px solid var(--border-color)",
                color: "var(--accent)",
                backgroundColor: "var(--bg-card)",
              }}
            >
              <Plus className="h-3.5 w-3.5" /> {customPrefix} &quot;{search.trim()}&quot;
            </button>
          ) : null}

          {/* Long list ka notice */}
          {hiddenCount > 0 ? (
            <p
              className="shrink-0 px-3 py-2 text-[11px]"
              style={{ borderTop: "1px solid var(--border-color)", color: "var(--text-muted)" }}
            >
              Showing first {MAX_VISIBLE_OPTIONS} of {filtered.length} — type karke list chhoti karein
            </p>
          ) : null}
        </div>,
        document.body
      )}
    </>
  );
}

// ======================================================
// MAIN COMPONENT
// ======================================================

export default function StoreInfoPage() {
  const dispatch = useDispatch();
  const { socket, isConnected } = useSocket();

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoError, setLogoError] = useState(false);
  const [isLogoDragOver, setIsLogoDragOver] = useState(false);

  // ✅ Current user — 'store' permission wala hi edit kar sakta hai (admin bypass)
  const { data: currentUserProfile } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await adminHttp.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const isCurrentAdmin = String(currentUserProfile?.role || "").toLowerCase() === "admin";
  const canEditStore = isCurrentAdmin || !!currentUserProfile?.permissions?.store;
  const denyStoreAccess = () =>
    toast.error("Access denied. You don't have 'store' permission.", {
      duration: 5000,
      description: "Contact an administrator or another staff member to grant you store access.",
    });

  // ====================================================
  // LOCATION / CURRENCY DATA
  // ====================================================

  // ✅ Alphabetical sorting: dataset apne order me aata hai (countries bhi sorted
  //    nahi hain) — dropdown me A→Z hona chahiye warna dhoondhna mushkil hota hai.
  const countryOptions = useMemo(
    () =>
      Country.getAllCountries()
        .map((c) => ({
          value: c.isoCode,
          label: c.name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    []
  );

  const stateOptions = useMemo(() => {
    if (!formData.country) return [];
    return State.getStatesOfCountry(formData.country)
      .map((s) => ({
        value: s.isoCode,
        label: s.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [formData.country]);

  // ✅ City list ka BUG FIX: pehle sirf selected state ki cities dikhti thi. Dataset
  //    me bahut jagah city data missing hai — UK ke 247 states/counties me se 243 ke
  //    liye 0 cities, US ke 14 territories ke liye 0, aur 58 countries ke liye poora
  //    city data hi nahi hai. Un sab me city dropdown khaali + disabled ho jata tha.
  //    Ab: state ki cities milein to wahi; warna poore country ki cities par fallback.
  const { cityOptions, cityFallbackToCountry } = useMemo(() => {
    if (!formData.country || !formData.state) {
      return { cityOptions: [], cityFallbackToCountry: false };
    }
    const inState = (City.getCitiesOfState(formData.country, formData.state) || []).map((c) => ({
      value: c.name,
      label: c.name,
    }));
    if (inState.length) {
      return {
        cityOptions: inState.sort((a, b) => a.label.localeCompare(b.label)),
        cityFallbackToCountry: false,
      };
    }
    const inCountry = (City.getCitiesOfCountry(formData.country) || []).map((c) => ({
      value: c.name,
      label: c.name,
    }));
    inCountry.sort((a, b) => a.label.localeCompare(b.label));
    return { cityOptions: inCountry, cityFallbackToCountry: inCountry.length > 0 };
  }, [formData.country, formData.state]);

  // Placeholders/hint — dataset me data hai ya nahi, uska saaf signal
  const statePlaceholder = !formData.country
    ? "Select country first"
    : stateOptions.length
    ? "Select state / province"
    : "Type your state / province";
  const cityPlaceholder = !formData.state
    ? "Select state first"
    : cityOptions.length
    ? "Select city"
    : "Type your city name";
  const cityFallbackHint = cityFallbackToCountry
    ? `No cities in this state — showing all cities of ${
        countryOptions.find((o) => o.value === formData.country)?.label || formData.country
      }`
    : "";

  const currencyOptions = useMemo(() => {
    return cc
      .codes()
      .map((code) => {
        const currency = cc.code(code);
        return { value: currency.code, label: `${currency.code} — ${currency.currency}` };
      })
      .filter((i) => i.value);
  }, []);

  // ====================================================
  // SOCKET — fetch + realtime update
  // ====================================================

  useEffect(() => {
    if (!socket || !isConnected) {
      if (!isConnected) setFetching(false);
      return;
    }

    socket.emit("getStoreInfo");

    const handleStoreData = (response) => {

      if (response?.success && response?.data) {
        const data = response.data;
        const updated = {
          ...EMPTY_FORM,
          ...data,
          social_links: { ...EMPTY_FORM.social_links, ...(data.social_links || {}) },
        };
        setFormData(updated);
        dispatch(setStoreInfo(data));

        const url = getLogoUrl(data);
        if (url) {
          setLogoPreview(url);
          setLogoError(false);
        } else {
          setLogoPreview("");
        }
      }
      setFetching(false);
    };

    const handleStoreUpdate = (d) => {

      setFormData((prev) => ({
        ...prev,
        ...d,
        social_links: { ...prev.social_links, ...(d.social_links || {}) },
      }));
      dispatch(setStoreInfo(d));

      const url = getLogoUrl(d);
      if (url) {
        setLogoPreview(url);
        setLogoError(false);
      } else {
        setLogoPreview("");
      }
    };

    socket.on("storeInfo", handleStoreData);
    socket.on("storeUpdated", handleStoreUpdate);

    return () => {
      socket.off("storeInfo", handleStoreData);
      socket.off("storeUpdated", handleStoreUpdate);
    };
  }, [socket, isConnected, dispatch]);

  // ====================================================
  // HELPERS
  // ====================================================

  const getCountryName = (code) =>
    !code ? "—" : countryOptions.find((i) => i.value === code)?.label || code;

  const getStateName = (code) =>
    !code ? "—" : stateOptions.find((i) => i.value === code)?.label || code;

  const getCurrencyName = (code) =>
    !code ? "—" : currencyOptions.find((i) => i.value === code)?.label || code;

  const dv = (v) => (v === undefined || v === null || v === "" ? "—" : v);

  // ====================================================
  // HANDLERS
  // ====================================================

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("social_")) {
      const key = name.replace("social_", "");
      setFormData((p) => ({ ...p, social_links: { ...p.social_links, [key]: value } }));
      return;
    }
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handlePhoneChange = (value, name) =>
    setFormData((p) => ({ ...p, [name]: value }));

  // ✅ SearchSelect plain string value deta hai (react-select jaisa option object
  //    nahi) — is liye alag chhote handlers. Country badalne par state/city reset
  //    (warna purani value naye country ke saath save ho jati), state badalne par
  //    city reset.
  const handleCountryChange = (val) =>
    setFormData((p) => ({ ...p, country: val, state: "", city: "" }));
  const handleStateChange = (val) => setFormData((p) => ({ ...p, state: val, city: "" }));
  const handleCityChange = (val) => setFormData((p) => ({ ...p, city: val }));
  const handleCurrencyChange = (val) => setFormData((p) => ({ ...p, currency: val }));

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processLogoFile(file);
    if (e.target) e.target.value = "";
  };

  const processLogoFile = (file) => {
    if (!file) return;
    
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload a PNG, JPG, SVG, or WEBP image");
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2MB");
      return;
    }
    
    setLogoFile(file);
    const previewUrl = URL.createObjectURL(file);
    setLogoPreview(previewUrl);
    setLogoError(false);
    toast.success("Logo selected successfully");
  };

  const handleLogoDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLogoDragOver(true);
  };

  const handleLogoDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLogoDragOver(false);
  };

  const handleLogoDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLogoDragOver(true);
  };

  const handleLogoDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLogoDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processLogoFile(file);
  };

  const handleRemoveLogo = () => {
    // ✅ 'store' permission ke baghair logo remove nahi
    if (!canEditStore) return denyStoreAccess();
    // Case 1: bas nayi file select ki hai (save nahi hui) — selection wapas le lo
    if (logoFile) {
      setLogoFile(null);
      const url = getLogoUrl(formData);
      setLogoPreview(url || "");
      setLogoError(false);
      toast.info("Selected file cleared");
      return;
    }

    // Case 2: saved logo server par hai — confirm kar ke delete karo
    const serverUrl = getLogoUrl(formData);
    if (!serverUrl && !logoPreview) return;
    if (!window.confirm("Remove store logo?")) return;

    socket.emit("deleteStoreLogo", null, (resp) => {
      if (resp?.success) {
        setLogoFile(null);
        setLogoPreview("");
        setLogoError(false);
        setFormData((p) => ({ ...p, logo: { img_url: "", public_id: "" } }));
        if (resp.data) dispatch(setStoreInfo(resp.data));
        toast.success("Store logo removed");
      } else {
        toast.error(resp?.message || "Failed to remove logo");
      }
    });
  };

  const handleEdit = () => {
    // ✅ 'store' permission ke baghair edit mode nahi
    if (!canEditStore) return denyStoreAccess();
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setLogoFile(null);
    setLogoError(false);
    const url = getLogoUrl(formData);
    if (url) {
      setLogoPreview(url);
    } else {
      setLogoPreview("");
    }
  };

  // ====================================================
  // SUBMIT — with connection check and button always clickable
  // ====================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ 'store' permission ke baghair save nahi
    if (!canEditStore) {
      denyStoreAccess();
      return;
    }

    // ✅ Check socket connection first
    if (!socket || !isConnected) {
      toast.error("Server connection lost. Please refresh and try again.");
      return;
    }

    setLoading(true);

    try {
      let logoBase64 = null;
      let logoFileName = null;
      let logoMimeType = null;

      if (logoFile) {
        logoFileName = logoFile.name;
        logoMimeType = logoFile.type;

        logoBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(logoFile);
        });

      }

      const dataToSend = {
        ...formData,
        logoBase64,
        logoFileName,
        logoMimeType,
      };

      socket.emit(
        "updateStoreInfo",
        dataToSend,
        (resp) => {

          // ✅ CHECK FOR PERMISSION ERROR
          if (resp?.success === false && resp?.message?.toLowerCase().includes("permission")) {
            toast.error(resp.message, {
              duration: 6000,
              description: "Contact an administrator or another staff member to grant you store access.",
            });
            setLoading(false);
            return;
          }

          if (resp?.success) {
            const saved = resp.data || formData;
            setFormData((p) => ({
              ...p,
              ...saved,
              social_links: { ...p.social_links, ...(saved.social_links || {}) },
            }));
            dispatch(setStoreInfo(saved));

            const url = getLogoUrl(saved);
            if (url) {
              setLogoPreview(url);
              setLogoError(false);
            } else {
              setLogoPreview("");
            }

            setLogoFile(null);
            setIsEditing(false);
            toast.success("Store updated successfully");
          } else {
            toast.error(resp?.message || "Store update failed");
          }
          setLoading(false);
        }
      );

      const timeoutId = setTimeout(() => {
        setLoading((prev) => {
          if (prev) {
            toast.error("Server response timeout. Please try again.");
            return false;
          }
          return prev;
        });
      }, 15000);

      return () => clearTimeout(timeoutId);
    } catch (err) {
      console.error("❌ Submit error:", err);
      toast.error(err.message || "Something went wrong while saving");
      setLoading(false);
    }
  };

  // ====================================================
  // SHARED STYLES
  // ====================================================

  const cardStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-color)",
  };

  const inputStyle = {
    backgroundColor: "var(--bg-card)",
    border: "1px solid var(--border-color)",
    color: "var(--text-primary)",
  };

  const phoneCountryCode = formData.country?.toLowerCase() || "pk";

  const phoneStyles = {
    containerStyle: { width: "100%" },
    inputStyle: {
      width: "100%",
      height: "36px",
      backgroundColor: "var(--bg-card)",
      border: "1px solid var(--border-color)",
      borderRadius: "8px",
      color: "var(--text-primary)",
      fontSize: "13px",
      paddingLeft: "44px",
    },
    buttonStyle: {
      backgroundColor: "transparent",
      border: "none",
      borderRight: "1px solid var(--border-color)",
      borderRadius: "8px 0 0 8px",
      width: "40px",
    },
    dropdownStyle: {
      backgroundColor: "var(--bg-card)",
      color: "var(--text-primary)",
      border: "1px solid var(--border-color)",
      zIndex: 9999,
    },
    searchStyle: {
      backgroundColor: "var(--bg-tertiary)",
      color: "var(--text-primary)",
      border: "1px solid var(--border-color)",
      borderRadius: "6px",
      margin: "4px",
    },
  };

  // ====================================================
  // LOADING
  // ====================================================

  if (fetching) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ color: "var(--text-primary)" }}>
        <Loader2 className="h-5 w-5 animate-spin text-emerald-500" />
      </div>
    );
  }

  // ====================================================
  // EDIT MODE
  // ====================================================

  if (isEditing) {
    return (
      <>
        <style jsx global>{`
          .react-tel-input .form-control {
            background-color: var(--bg-card) !important;
            color: var(--text-primary) !important;
            border-color: var(--border-color) !important;
          }
          .react-tel-input .form-control:focus {
            border-color: color-mix(in srgb, var(--success) 45%, transparent) !important;
          }
          .react-tel-input .flag-dropdown {
            background-color: transparent !important;
            border-color: var(--border-color) !important;
          }
          .react-tel-input .country-list {
            background-color: var(--bg-card) !important;
            color: var(--text-primary) !important;
          }
        `}</style>

        <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
          <div className="w-full space-y-4">

            {/* ── HEADER  */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCancel}
                  className="h-9 w-9 rounded-lg flex items-center justify-center transition hover:opacity-80"
                  style={cardStyle}
                >
                  <ArrowLeft size={16} style={{ color: "var(--text-muted)" }} />
                </button>
                <div>
                  <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
                    Edit Store
                  </h1>
                  <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Update your store details and preferences
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Connection status indicator */}
                <div className="flex items-center gap-1.5 text-sm">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                  />
                  <span style={{ color: "var(--text-muted)" }}>
                    {isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="h-9 px-4 rounded-lg text-[13px] font-medium transition hover:opacity-80"
                  style={{ ...cardStyle, color: "var(--text-primary)" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading} // only disabled when saving
                  className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}
                >
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {loading ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* ── ROW 1: BASIC + LOGO ── */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-lg overflow-hidden lg:col-span-2" style={cardStyle}>
                  <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--success-soft)" }}>
                      <Store size={16} style={{ color: "var(--success-text)" }} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Basic Information</h3>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Your store identity</p>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Store Name</label>
                      <input type="text" name="store_name" value={formData.store_name} onChange={handleChange}
                        className="h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] w-full outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                        style={inputStyle} placeholder="Enter store name" />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Tagline</label>
                      <input type="text" name="tagline" value={formData.tagline} onChange={handleChange}
                        className="h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] w-full outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                        style={inputStyle} placeholder="Enter store tagline" />
                    </div>
                  </div>
                </div>

                {/* Logo Card */}
                <div className="rounded-lg overflow-hidden" style={cardStyle}>
                  <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--warning-soft)" }}>
                      <ImageIcon size={16} style={{ color: "var(--warning-text)" }} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Store Logo</h3>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Brand image</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center px-4 py-5">
                    <div
                      className={`w-full rounded-xl border-2 border-dashed p-4 text-center transition-all duration-200 ${isLogoDragOver ? "border-[var(--accent)] bg-[var(--accent-soft)]/10 scale-[1.01]" : "border-[var(--border-color)] hover:border-[var(--accent)] hover:bg-[var(--bg-tertiary)]/30"}`}
                      onDragEnter={handleLogoDragEnter}
                      onDragOver={handleLogoDragOver}
                      onDragLeave={handleLogoDragLeave}
                      onDrop={handleLogoDrop}
                    >
                    <label className="flex flex-col items-center cursor-pointer">
                      <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoChange} className="hidden" />
                      <div className="relative">
                      <div className="w-28 h-28 rounded-xl flex items-center justify-center overflow-hidden"
                        style={{ backgroundColor: logoPreview && !logoError ? "#ffffff" : "var(--bg-tertiary)", border: "1px dashed var(--border-color)", boxShadow: logoPreview && !logoError ? "var(--shadow-sm)" : "none" }}>
                        {logoPreview && !logoError ? (
                          <img 
                            src={logoPreview} 
                            alt="Logo" 
                            className="w-full h-full object-contain p-1.5"
                            onError={(e) => { 
                              e.target.style.display = "none"; 
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = "flex";
                              }
                              setLogoError(true);
                            }}
                            onLoad={(e) => {
                              e.target.style.display = "block";
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = "none";
                              }
                              setLogoError(false);
                            }}
                          />
                        ) : null}
                        <div className="flex-col items-center gap-1.5" style={{ color: "var(--text-muted)", display: logoPreview && !logoError ? "none" : "flex" }}>
                          <Store size={28} />
                          <span className="text-[10px]">No Logo</span>
                        </div>
                      </div>
                      <span className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full flex items-center justify-center transition"
                        style={{ backgroundColor: "var(--accent)", border: "2px solid var(--bg-card)" }}>
                        <UploadCloud size={14} style={{ color: "var(--accent-text)" }} />
                      </span>
                    </div>
                      <div className="space-y-0.5 mt-4">
                        <p className="text-sm font-semibold" style={{ color: isLogoDragOver ? "var(--accent)" : "var(--text-secondary)" }}>
                          {isLogoDragOver ? "Drop logo here" : "Drag & drop your logo here"}
                        </p>
                        <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                          or click to browse
                        </p>
                      </div>
                      <p className="mt-2 text-[11px] leading-4 text-center" style={{ color: "var(--text-muted)" }}>
                        PNG, JPG, SVG or WEBP · Max 2MB · Square recommended
                      </p>
                    </label>
                    {logoPreview && !logoError && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition hover:opacity-80"
                        style={{
                          borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)",
                          color: "var(--danger-text)",
                          backgroundColor: "color-mix(in srgb, var(--danger) 8%, transparent)",
                        }}
                      >
                        <Trash2 size={13} />
                        {logoFile ? "Clear selected file" : "Remove logo"}
                      </button>
                    )}
                    {logoFile && (
                      <p className="mt-2 text-[11px] text-emerald-500">
                        ✓ New logo selected: {logoFile.name}
                      </p>
                    )}
                    </div>
                  </div>
                </div>
              </div>

              {/* ── ROW 2: CONTACT ── */}
              <div className="rounded-lg overflow-hidden" style={cardStyle}>
                <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--purple-soft)" }}>
                    <Mail size={16} style={{ color: "var(--purple-text)" }} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Contact Information</h3>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Store & support contacts</p>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email Address</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange}
                      className="h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] w-full outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                      style={inputStyle} placeholder="store@example.com" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Phone Number</label>
                    <PhoneInput country={phoneCountryCode} value={formData.phone}
                      onChange={(v) => handlePhoneChange(v, "phone")} inputProps={{ name: "phone" }}
                      enableSearch preferredCountries={["pk", "in", "us", "gb", "ae"]}
                      containerStyle={phoneStyles.containerStyle} inputStyle={phoneStyles.inputStyle}
                      buttonStyle={phoneStyles.buttonStyle} dropdownStyle={phoneStyles.dropdownStyle}
                      searchStyle={phoneStyles.searchStyle} />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Support Email</label>
                    <input type="email" name="support_email" value={formData.support_email} onChange={handleChange}
                      className="h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] w-full outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                      style={inputStyle} placeholder="support@example.com" />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Support Phone</label>
                    <PhoneInput country={phoneCountryCode} value={formData.support_phone}
                      onChange={(v) => handlePhoneChange(v, "support_phone")} inputProps={{ name: "support_phone" }}
                      enableSearch preferredCountries={["pk", "in", "us", "gb", "ae"]}
                      containerStyle={phoneStyles.containerStyle} inputStyle={phoneStyles.inputStyle}
                      buttonStyle={phoneStyles.buttonStyle} dropdownStyle={phoneStyles.dropdownStyle}
                      searchStyle={phoneStyles.searchStyle} />
                  </div>
                </div>
              </div>

              {/* ── ROW 3: LOCATION + BUSINESS ── */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg overflow-hidden" style={cardStyle}>
                  <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(244,63,94,0.1)" }}>
                      <MapPin size={16} style={{ color: "var(--rose)" }} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Location</h3>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Physical address</p>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Country</label>
                      <SearchSelect
                        value={formData.country}
                        options={countryOptions}
                        onChange={handleCountryChange}
                        placeholder="Select country"
                        searchPlaceholder="Search country..."
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>State / Province</label>
                      <SearchSelect
                        value={formData.state}
                        options={stateOptions}
                        onChange={handleStateChange}
                        placeholder={statePlaceholder}
                        searchPlaceholder="Search state / province..."
                        disabled={!formData.country}
                        allowCustom={stateOptions.length === 0}
                        customPrefix="Use state"
                        emptyText="Is country ka state data dataset me nahi hai — apna state type karein"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>City</label>
                      <SearchSelect
                        value={formData.city}
                        options={cityOptions}
                        onChange={handleCityChange}
                        placeholder={cityPlaceholder}
                        searchPlaceholder="Search city..."
                        disabled={!formData.state}
                        allowCustom
                        customPrefix="Use city"
                        emptyText="Is state ka city data nahi hai — apna city type karke Enter dabayein"
                        hint={cityFallbackHint}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Postal Code</label>
                      <input type="text" name="zip_code" value={formData.zip_code} onChange={handleChange}
                        className="h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] w-full outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                        style={inputStyle} placeholder="Postal code" />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Store Address</label>
                      <input type="text" name="address" value={formData.address} onChange={handleChange}
                        className="h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] w-full outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                        style={inputStyle} placeholder="Full store address" />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg overflow-hidden" style={cardStyle}>
                  <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(249,115,22,0.1)" }}>
                      <Briefcase size={16} style={{ color: "var(--orange)" }} />
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Business Details</h3>
                      <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Operational settings</p>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Business Type</label>
                      <input type="text" name="business_type" value={formData.business_type} onChange={handleChange}
                        className="h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] w-full outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                        style={inputStyle} placeholder="Private Limited" />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Total Employees</label>
                      <input type="text" name="total_employees" value={formData.total_employees} onChange={handleChange}
                        className="h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] w-full outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                        style={inputStyle} placeholder="25–50" />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Year Established</label>
                      <input type="text" name="year_established" value={formData.year_established} onChange={handleChange}
                        className="h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] w-full outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                        style={inputStyle} placeholder="2020" />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Currency</label>
                      <SearchSelect
                        value={formData.currency}
                        options={currencyOptions}
                        onChange={handleCurrencyChange}
                        placeholder="Select currency"
                        searchPlaceholder="Search currency (e.g. PKR, USD)..."
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Tax Rate (%)</label>
                      <input type="number" name="tax_rate" value={formData.tax_rate} onChange={handleChange}
                        className="h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] w-full outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                        style={inputStyle} placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Weight Unit</label>
                      <select name="weight_unit" value={formData.weight_unit} onChange={handleChange}
                        className="h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] w-full outline-none cursor-pointer transition focus:ring-1 focus:ring-emerald-500/40 appearance-none"
                        style={inputStyle}>
                        <option value="kg">Kilogram (kg)</option>
                        <option value="g">Gram (g)</option>
                        <option value="lbs">Pounds (lbs)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── ROW 4: SOCIAL ── */}
              <div className="rounded-lg overflow-hidden" style={cardStyle}>
                <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--info-soft)" }}>
                    <Share2 size={16} style={{ color: "var(--indigo-text)" }} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Social Profiles</h3>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Connected platforms</p>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                  {[
                    { key: "facebook", label: "Facebook", Icon: IconFacebook },
                    { key: "instagram", label: "Instagram", Icon: IconInstagram },
                    { key: "twitter", label: "Twitter", Icon: IconTwitter },
                    { key: "linkedin", label: "LinkedIn", Icon: IconLinkedin },
                    { key: "youtube", label: "YouTube", Icon: IconYoutube },
                  ].map(({ key, label, Icon }) => (
                    <div key={key}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Icon size={12} style={{ color: "var(--text-muted)" }} />
                        <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>{label}</span>
                      </div>
                      <input type="text" name={`social_${key}`} value={formData.social_links[key] || ""} onChange={handleChange}
                        className="h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] w-full outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                        style={inputStyle} placeholder={`${label} URL`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* ── ROW 5: SEO ── */}
              <div className="rounded-lg overflow-hidden" style={cardStyle}>
                <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(20,184,166,0.1)" }}>
                    <ShieldCheck size={16} style={{ color: "var(--teal)" }} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>SEO & Policies</h3>
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Search engine & legal info</p>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {[
                    { name: "meta_title", label: "Meta Title", placeholder: "Store meta title", type: "input" },
                    { name: "meta_keywords", label: "Meta Keywords", placeholder: "fashion, ecommerce, online store", type: "input" },
                    { name: "meta_description", label: "Meta Description", placeholder: "Describe your store…", type: "textarea" },
                    { name: "return_policy", label: "Return Policy", placeholder: "Your return policy…", type: "textarea" },
                    { name: "privacy_policy", label: "Privacy Policy", placeholder: "Your privacy policy…", type: "textarea" },
                    { name: "terms_conditions", label: "Terms & Conditions", placeholder: "Your terms and conditions…", type: "textarea" },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="block text-[12px] font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{field.label}</label>
                      {field.type === "input" ? (
                        <input type="text" name={field.name} value={formData[field.name]} onChange={handleChange}
                          className="h-10 md:h-9 px-3 rounded-lg text-[16px] md:text-[13px] w-full outline-none transition focus:ring-1 focus:ring-emerald-500/40"
                          style={inputStyle} placeholder={field.placeholder} />
                      ) : (
                        <textarea name={field.name} value={formData[field.name]} onChange={handleChange} rows={3}
                          className="px-3 py-2 rounded-lg text-[13px] w-full outline-none resize-none transition focus:ring-1 focus:ring-emerald-500/40"
                          style={inputStyle} placeholder={field.placeholder} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </form>
          </div>
        </div>
      </>
    );
  }

  // ====================================================
  // VIEW MODE
  // ====================================================

  const socialProfiles = [
    { key: "facebook", label: "Facebook", Icon: IconFacebook, color: "var(--info-text)", bg: "var(--info-soft)" },
    { key: "instagram", label: "Instagram", Icon: IconInstagram, color: "var(--pink)", bg: "rgba(236,72,153,0.1)" },
    { key: "twitter", label: "Twitter", Icon: IconTwitter, color: "#38bdf8", bg: "rgba(14,165,233,0.1)" },
    { key: "linkedin", label: "LinkedIn", Icon: IconLinkedin, color: "#93c5fd", bg: "rgba(37,99,235,0.1)" },
    { key: "youtube", label: "YouTube", Icon: IconYoutube, color: "var(--danger-text)", bg: "var(--danger-soft)" },
  ];

  return (
    <div className="w-full min-h-screen" style={{ color: "var(--text-primary)" }}>
      <div className="w-full space-y-4">

        {/* ── HEADER ─ */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-[24px] leading-7 font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Store Information
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "var(--text-muted)" }}>
              Manage and view your store information
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection status dot */}
            <div className="flex items-center gap-1.5 text-sm">
              <span
                className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span style={{ color: "var(--text-muted)" }}>
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <button onClick={handleEdit}
              className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
              <Pencil size={14} />
              Edit Store
            </button>
          </div>
        </div>

        {/* ── HERO CARD ── */}
        <div className="rounded-lg overflow-hidden" style={cardStyle}>
          <div className="p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
                style={{ backgroundColor: logoPreview && !logoError ? "#ffffff" : "var(--bg-tertiary)", border: "1px solid var(--border-color)", boxShadow: logoPreview && !logoError ? "var(--shadow-sm)" : "none" }}>
                {logoPreview && !logoError ? (
                  <img 
                    src={logoPreview} 
                    alt="Logo" 
                    className="w-full h-full object-contain p-1.5"
                    onError={(e) => { 
                      e.target.style.display = "none"; 
                      if (e.target.nextSibling) {
                        e.target.nextSibling.style.display = "flex";
                      }
                      setLogoError(true);
                    }}
                    onLoad={(e) => {
                      e.target.style.display = "block";
                      if (e.target.nextSibling) {
                        e.target.nextSibling.style.display = "none";
                      }
                      setLogoError(false);
                    }}
                  />
                ) : null}
                <div style={{ display: logoPreview && !logoError ? "none" : "flex", flexDirection: "column", alignItems: "center", gap: "4px", color: "var(--text-muted)" }}>
                  <Store size={32} />
                  <span style={{ fontSize: "10px" }}>No Logo</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
                    style={{ backgroundColor: "var(--success-soft)", color: "var(--success-text)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }}>
                    Store
                  </span>
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    <span className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: formData.store_status === "open" ? "var(--success-text)" : "var(--danger-text)" }} />
                    {formData.store_status === "open" ? "Open" : "Closed"}
                  </span>
                </div>
                <h2 className="text-[22px] font-bold leading-tight tracking-tight" style={{ color: "var(--text-primary)" }}>
                  {dv(formData.store_name)}
                </h2>
                <p className="text-[13px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  {dv(formData.tagline)}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Currency</p>
                <p className="text-[14px] font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{getCurrencyName(formData.currency)}</p>
              </div>
              <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Country</p>
                <p className="text-[14px] font-bold mt-0.5" style={{ color: "var(--text-primary)" }}>{getCountryName(formData.country)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── CONTACT + LOCATION ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--purple-soft)" }}>
                <Mail size={16} style={{ color: "var(--purple-text)" }} />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Contact Information</h3>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Store contact details</p>
              </div>
            </div>
            <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <InfoItem icon={Mail} label="Email Address" value={dv(formData.email)} />
              <InfoItem icon={Phone} label="Phone Number" value={dv(formData.phone)} />
              <InfoItem icon={Mail} label="Support Email" value={dv(formData.support_email)} />
              <InfoItem icon={Phone} label="Support Phone" value={dv(formData.support_phone)} />
            </div>
          </div>

          <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(244,63,94,0.1)" }}>
                <MapPin size={16} style={{ color: "var(--rose)" }} />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Location</h3>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Store location information</p>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <InfoItem icon={Globe} label="Country" value={getCountryName(formData.country)} />
              <InfoItem icon={MapPinned} label="State / Province" value={getStateName(formData.state)} />
              <InfoItem icon={Building2} label="City" value={dv(formData.city)} />
              <InfoItem icon={Tag} label="Postal Code" value={dv(formData.zip_code)} />
              <div className="col-span-2">
                <InfoItem icon={MapPin} label="Store Address" value={dv(formData.address)} />
              </div>
            </div>
          </div>
        </div>

        {/* ── BUSINESS + SETTINGS ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(249,115,22,0.1)" }}>
                <Briefcase size={16} style={{ color: "var(--orange)" }} />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Business Details</h3>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Business information</p>
              </div>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <InfoItem icon={Briefcase} label="Business Type" value={dv(formData.business_type)} />
              <InfoItem icon={Users} label="Employees" value={dv(formData.total_employees)} />
              <InfoItem icon={CalendarDays} label="Year Established" value={dv(formData.year_established)} />
              <InfoItem icon={Coins} label="Currency" value={getCurrencyName(formData.currency)} />
              <InfoItem icon={Tag} label="Tax Rate" value={formData.tax_rate !== "" ? `${formData.tax_rate}%` : "—"} />
              <InfoItem icon={Tag} label="Weight Unit" value={dv(formData.weight_unit)} />
            </div>
          </div>

          <div className="rounded-lg overflow-hidden" style={cardStyle}>
            <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--success-soft)" }}>
                <Store size={16} style={{ color: "var(--success-text)" }} />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Store Settings</h3>
                <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Current configuration</p>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between rounded-lg px-4 py-3.5"
                style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--success-soft)" }}>
                    <Check size={16} style={{ color: "var(--success-text)" }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>Store Status</p>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Current availability</p>
                  </div>
                </div>
                <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide"
                  style={formData.store_status === "open"
                    ? { backgroundColor: "var(--success-soft)", color: "var(--success-text)", border: "1px solid color-mix(in srgb, var(--success) 28%, transparent)" }
                    : { backgroundColor: "var(--danger-soft)", color: "var(--danger-text)", border: "1px solid color-mix(in srgb, var(--danger) 28%, transparent)" }}>
                  {formData.store_status || "—"}
                </span>
              </div>
              {formData.maintenance_message && (
                <div className="mt-4 rounded-lg px-4 py-3"
                  style={{ backgroundColor: "rgba(245,158,11,0.06)", border: "1px solid color-mix(in srgb, var(--warning) 28%, transparent)" }}>
                  <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--warning-text)" }}>Maintenance Message</p>
                  <p className="text-[12px] mt-1 leading-5" style={{ color: "var(--text-secondary)" }}>{formData.maintenance_message}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SOCIAL ── */}
        <div className="rounded-lg overflow-hidden" style={cardStyle}>
          <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--info-soft)" }}>
              <Share2 size={16} style={{ color: "var(--indigo-text)" }} />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Social Profiles</h3>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Connected social platforms</p>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            {socialProfiles.map(({ key, label, Icon, color, bg }) => {
              const url = formData.social_links?.[key];
              return (
                <div key={key} className="flex items-center justify-between rounded-lg px-3 py-2.5"
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: bg }}>
                      <Icon size={13} style={{ color }} />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>{label}</p>
                      <p className="text-[10px] mt-0.5 max-w-[100px] truncate" style={{ color: "var(--text-muted)" }}>{url || "Not connected"}</p>
                    </div>
                  </div>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="transition hover:opacity-70" style={{ color: "var(--text-muted)" }}>
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── SEO ─ */}
        <div className="rounded-lg overflow-hidden" style={cardStyle}>
          <div className="px-4 py-3 flex items-center gap-3" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(20,184,166,0.1)" }}>
              <ShieldCheck size={16} style={{ color: "var(--teal)" }} />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>SEO & Store Policies</h3>
              <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>Search engine & legal information</p>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <DetailBlock label="Meta Title" value={formData.meta_title} />
            <DetailBlock label="Meta Keywords" value={formData.meta_keywords} />
            <DetailBlock label="Meta Description" value={formData.meta_description} large />
            <DetailBlock label="Return Policy" value={formData.return_policy} large />
            <DetailBlock label="Privacy Policy" value={formData.privacy_policy} large />
            <DetailBlock label="Terms & Conditions" value={formData.terms_conditions} large />
          </div>
        </div>

      </div>
    </div>
  );
}

// ======================================================
// SUB COMPONENTS
// ======================================================

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} style={{ color: "var(--text-muted)" }} />
        <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
      </div>
      <p className="text-[13px] font-medium break-words" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function DetailBlock({ label, value, large = false }) {
  return (
    <div className={`rounded-lg px-4 py-3 ${large ? "min-h-[80px]" : ""}`}
      style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
      <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-[13px] mt-1.5 leading-5 whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>{value || "—"}</p>
    </div>
  );
}