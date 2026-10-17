"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { brandApi } from "../../../../apis/admin/brandApi";
import { productApi } from "../../../../apis/admin/productApi";
import { useBrandSocketSync } from "@/hooks/admin/useBrandSocketSync";
import { useLocalized } from "@/i18n/localize";
import { useTranslation } from "@/i18n/LanguageProvider";
import { Country } from "country-state-city";
import { toast } from "sonner";

/* =========================================================
   ICONS & HELPERS
========================================================= */
function Ico({ d, className = "w-4 h-4", sw = 1.8 }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d={d} />
    </svg>
  );
}

const D = {
  back: "M15 19l-7-7 7-7",
  edit: "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3",
  close: "M6 18L18 6M6 6l12 12",
  link: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  check: "M5 13l4 4L19 7",
  globe: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  plus: "M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z",
  pencil: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
  warn: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  box: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  chevron: "M9 5l7 7-7 7",
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  tag: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  image: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  minus: "M20 12H4",
  upload: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
};

function ini(name) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

function logoUrl(brand) {
  if (brand?.logo?.img_url) {
    if (brand.logo.img_url.startsWith("http")) return brand.logo.img_url;
    const serverUrl = process.env.NEXT_PUBLIC_SERVERURL?.replace(/\/api\/?$/, "");
    return `${serverUrl}/${brand.logo.img_url.replace(/^\//, "")}`;
  }
  return "";
}

function formatDateTime(date, locale = "en") {
  if (!date) return "—";
  const intlLocale = locale === "ur" ? "ur-PK" : locale;
  return new Intl.DateTimeFormat(intlLocale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    numberingSystem: locale === "ur" ? "latn" : undefined,
  }).format(new Date(date));
}

function formatNumber(value, locale = "en") {
  const safe = Number(value || 0);
  const intlLocale = locale === "ur" ? "ur-PK" : locale;
  return new Intl.NumberFormat(intlLocale, {
    maximumFractionDigits: 2,
    numberingSystem: locale === "ur" ? "latn" : undefined,
  }).format(safe);
}

function fileSize(bytes, locale = "en") {
  if (!bytes) return "—";
  if (bytes < 1024) return `${formatNumber(bytes, locale)} B`;
  if (bytes < 1048576) return `${formatNumber(bytes / 1024, locale)} KB`;
  return `${formatNumber(bytes / 1048576, locale)} MB`;
}

/* =========================================================
   UI COMPONENTS
========================================================= */
function StatusPill({ active, t }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
      style={{
        backgroundColor: active ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)",
        color: active ? "var(--success-text)" : "var(--danger-text)",
        border: `1px solid ${active ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)"}`,
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: active ? "var(--success-text)" : "var(--danger-text)" }}
      />
      {active ? t("common.active") : t("common.inactive")}
    </span>
  );
}

function Button({
  children,
  onClick,
  danger = false,
  primary = false,
  disabled = false,
  type = "button",
  className = "",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-[12px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      style={{
        backgroundColor: primary
          ? "var(--accent)"
          : danger
          ? "rgba(239,68,68,.08)"
          : "transparent",
        color: primary
          ? "var(--accent-text)"
          : danger
          ? "var(--danger)"
          : "var(--text-primary)",
        border: primary
          ? "none"
          : danger
          ? "1px solid rgba(239,68,68,.25)"
          : "1px solid var(--border-color)",
      }}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div
      className={`overflow-hidden rounded-lg ${className}`}
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-color)",
      }}
    >
      {children}
    </div>
  );
}

function CardHeader({ icon, title, action }) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5"
      style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-tertiary)" }}
    >
      <div className="flex items-center gap-2">
        {icon && <span style={{ color: "var(--accent)" }}>{icon}</span>}
        <h3 className="text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </h3>
      </div>
      {action}
    </div>
  );
}

function InfoRow({ label, value, green = false, mono = false, isLast = false, compact = false, dir = "auto" }) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-0.5 ${compact ? "py-1.5" : "py-2"}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--text-muted)", unicodeBidi: "plaintext" }}>
        {label}
      </span>
      <span
        className={`max-w-full break-words text-[12px] font-medium ${mono ? "font-mono" : ""}`}
        style={{ color: green ? "var(--success-text)" : "var(--text-primary)", unicodeBidi: "plaintext", direction: dir, letterSpacing: dir === "ltr" ? "0.01em" : undefined }}
      >
        {value || "—"}
      </span>
    </div>
  );
}

function Spin({ className = "w-4 h-4" }) {
  return (
    <svg className={`${className} animate-spin`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/* =========================================================
   CUSTOM COUNTRY DROPDOWN (From Reference)
========================================================= */
const CountryDropdown = ({ value, onChange, disabled = false, allCountries = [] }) => {
  const { t: __t } = useTranslation();
  const t = (key, params) => __t("admin.brands.ui." + key, params);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const getFlagEmoji = (isoCode) => {
    if (!isoCode || isoCode.length !== 2) return "";
    return isoCode.toUpperCase().split("").map((char) => String.fromCodePoint(127397 + char.charCodeAt(0))).join("");
  };

  const filteredCountries = useMemo(() => {
    if (!searchTerm.trim()) return allCountries;
    const term = searchTerm.toLowerCase();
    return allCountries.filter((c) => c.name.toLowerCase().includes(term) || c.isoCode.toLowerCase().includes(term));
  }, [allCountries, searchTerm]);

  const selectedCountry = useMemo(() => allCountries.find((c) => c.name === value) || null, [allCountries, value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) setTimeout(() => searchInputRef.current?.focus(), 50);
    if (!isOpen) {
      const timer = setTimeout(() => setSearchTerm(""), 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSelect = (countryName) => {
    onChange(countryName);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button type="button" onClick={() => !disabled && setIsOpen(!isOpen)} disabled={disabled} className="h-9 w-full px-3 rounded-md text-sm flex items-center justify-between gap-2 outline-none transition disabled:opacity-50 cursor-pointer" style={{ backgroundColor: "var(--bg-tertiary)", border: isOpen ? "1px solid color-mix(in srgb, var(--success) 45%, transparent)" : "1px solid var(--border-color)", color: "var(--text-primary)" }}>
        <div className="flex items-center gap-2 min-w-0">
          {selectedCountry ? (
            <>
              <span className="text-base leading-none">{getFlagEmoji(selectedCountry.isoCode)}</span>
              <span className="truncate text-[13px]">{selectedCountry.name}</span>
            </>
          ) : (
            <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <Ico d={D.globe} className="w-3.5 h-3.5" />
              <span className="text-[13px]">{t("selectCountry")}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedCountry && (
            <span onClick={handleClear} className="p-0.5 rounded hover:bg-white/10 transition" style={{ color: "var(--text-muted)" }}>
              <Ico d={D.close} className="w-3 h-3" />
            </span>
          )}
          <Ico d={D.chevron} className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-50 bottom-full mb-1 w-full rounded-lg overflow-hidden shadow-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 -10px 40px rgba(0,0,0,0.5)" }}>
          <div className="px-3 py-1.5 text-center" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t("countryCount", { filtered: filteredCountries.length, total: allCountries.length })}</p>
          </div>
          <div className="max-h-[200px] overflow-y-auto py-1" style={{ scrollbarWidth: "thin" }}>
            {filteredCountries.length === 0 ? (
              <div className="px-3 py-4 text-center"><p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("noCountry")}</p></div>
            ) : (
              filteredCountries.map((country) => {
                const isSelected = country.name === value;
                return (
                  <button key={country.isoCode} type="button" onClick={() => handleSelect(country.name)} className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition" style={{ backgroundColor: isSelected ? "var(--success-soft)" : "transparent" }} onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "var(--bg-row-hover)"; }} onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base leading-none">{getFlagEmoji(country.isoCode)}</span>
                      <span className="truncate text-[13px]" style={{ color: isSelected ? "var(--success-text)" : "var(--text-primary)", fontWeight: isSelected ? 600 : 400 }}>{country.name}</span>
                    </div>
                    {isSelected && <Ico d={D.check} className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--success-text)" }} />}
                  </button>
                );
              })
            )}
          </div>
          <div className="p-2" style={{ borderTop: "1px solid var(--border-color)" }}>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><Ico d={D.search} className="w-3.5 h-3.5" /></span>
              <input ref={searchInputRef} type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t("searchCountry")} className="w-full h-10 md:h-8 pl-8 pr-3 rounded-md text-[16px] md:text-[12px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================================================
   MAIN PAGE
========================================================= */
export default function BrandDetailPage() {
  useBrandSocketSync();
  const { t: __t, locale, dir } = useTranslation();
  const t = (key, params) => __t(key.startsWith("common.") || key.startsWith("admin.") ? key : `admin.brands.${key}`, params);
  const { nameOf, descriptionOf } = useLocalized();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const brandId = params.id;
  const queryClient = useQueryClient();

  const backPath = pathname.substring(0, pathname.lastIndexOf("/")) || "/admin/brands";

  const [tab, setTab] = useState("overview");
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const localizedCountryName = (value) => {
    const country = Country.getAllCountries().find(
      (item) => item.name === value || item.isoCode === value
    );
    if (!country) return value;
    try {
      const countryLocale = locale === "ur" ? "ur-PK" : locale;
      return new Intl.DisplayNames([countryLocale], { type: "region" }).of(country.isoCode) || value;
    } catch {
      return value;
    }
  };

  // Form State for Edit Modal
  const [form, setForm] = useState({
    brand_code: "",
    name: "",
    description: "",
    country: "",
    is_active: true,
  });
  
  // Logo State
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [removeLogo, setRemoveLogo] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Country Data
  const allCountries = useMemo(() => Country.getAllCountries().map((c) => ({ name: c.name, isoCode: c.isoCode })), []);

  const { data: brand, isLoading: loading } = useQuery({
    queryKey: ["brand", brandId],
    queryFn: () => brandApi.getById(brandId),
    enabled: !!brandId,
  });

  const { data: brandProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ["brand-products", brandId],
    queryFn: () => productApi.getByBrand(brandId),
    enabled: !!brandId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => brandApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["brand", brandId]);
      queryClient.invalidateQueries(["brands"]);
      setLogoFile(null);
      setLogoPreview("");
      setRemoveLogo(false);
      setShowEdit(false);
      toast.success(t("admin.brands.toast.updated"));
    },
    onError: (err) => {
      toast.error(err.message || t("admin.brands.toast.saveFailed"));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => brandApi.delete(brandId),
    onSuccess: () => {
      queryClient.invalidateQueries(["brands"]);
      router.push(backPath);
      toast.success(t("admin.brands.toast.deleted"));
    },
  });

  /* --- Edit Modal Handlers --- */
  function openEdit() {
    if (!brand) return;
    setForm({
      brand_code: brand.brand_code || "",
      name: brand.name || "",
      description: brand.description || "",
      country: brand.country || "",
      is_active: brand.is_active !== undefined ? brand.is_active : true,
    });
    setLogoPreview(logoUrl(brand));
    setLogoFile(null);
    setRemoveLogo(false);
    setShowEdit(true);
  }

  function submitEdit(e) {
    e.preventDefault();
    const data = new FormData();
    data.append("brand_code", form.brand_code);
    data.append("name", form.name);
    data.append("description", form.description || "");
    data.append("country", form.country || "");
    data.append("is_active", form.is_active.toString());
    
    if (removeLogo) data.append("remove_logo", "true");
    if (logoFile) data.append("logo", logoFile);
    
    updateMutation.mutate({ id: brandId, data });
  }

  // Logo Handlers
  const handleLogoChange = (file) => {
    if (file) {
      if (file.size > 10 * 1024 * 1024) return toast.error(t("admin.brands.ui.imageTooLarge"));
      setLogoFile(file);
      setRemoveLogo(false);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith('image/')) return toast.error(t("admin.brands.ui.imageTypes"));
      handleLogoChange(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview("");
    setRemoveLogo(true);
  };

  const isRtl = dir === "rtl";
  const dynamicTextStyle = { unicodeBidi: "plaintext", direction: isRtl ? "auto" : "ltr" };
  const ltrTextStyle = { unicodeBidi: "plaintext", direction: "ltr" };

  const totalProducts = brandProducts.length;
  const activeProducts = brandProducts.filter((p) => p.status === "active").length;
  const inactiveProducts = totalProducts - activeProducts;
  const logoSrc = brand ? logoUrl(brand) : "";
  const hasLogo = Boolean(brand?.logo?.img_url) && !logoFailed;
  const hasUpdates = Boolean(brand?.updatedby);

  // ✅ Naya logo upload/update hone par error flag reset karo — warna purana
  // 404 set hone ke baad "No logo uploaded" chip atak jata tha.
  useEffect(() => {
    if (!logoSrc) {
      const timer = setTimeout(() => setLogoFailed(false), 0);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setLogoFailed(false), 0);
    return () => clearTimeout(timer);
  }, [logoSrc]);

  if (loading) {
    return (
      <div className="flex min-h-[500px] w-full items-center justify-center" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center gap-2">
          <Spin className="h-5 w-5" />
          <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            {t("common.loading")}
          </span>
        </div>
      </div>
    );
  }

  if (!brand) {
    return (
      <div className="flex min-h-[500px] w-full items-center justify-center" dir={isRtl ? "rtl" : "ltr"}>
        <Card className="max-w-sm p-8 text-center">
          <h2 className="mb-2 text-lg font-semibold">{t("admin.brands.page.noBrands")}</h2>
          <Button primary onClick={() => router.push(backPath)}>
            {t("admin.brands.detail.backToBrands")}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 pb-8" dir={isRtl ? "rtl" : "ltr"} style={{ color: "var(--text-primary)" }}>
      {/* ===== BREADCRUMB ===== */}
      <nav className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
        <button
          type="button"
          onClick={() => router.push(backPath)}
          className="transition-colors hover:text-[var(--text-primary)]"
        >
          {t("admin.brands.page.title")}
        </button>
        <Ico d={D.chevron} className="h-3 w-3" />
        <span className="font-medium" style={{ color: "var(--text-primary)" }}>
          {t("admin.brands.detail.pageTitle")}
        </span>
      </nav>

      {/* ===== HEADER: Back, Title + Actions ===== */}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={() => router.push(backPath)}
            className="mt-0.5 inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-[11px] font-semibold transition hover:bg-[var(--bg-tertiary)]"
            style={{ border: "1px solid var(--border-color)", color: "var(--text-secondary)" }}
            aria-label={t("admin.brands.detail.backToBrands")}
          >
            <Ico d={D.back} className="h-3.5 w-3.5" />
            <span>{t("admin.brands.detail.back")}</span>
          </button>
          <div className="min-w-0">
            <h1 className="text-[21px] leading-tight font-bold tracking-tight">{t("admin.brands.detail.pageTitle")}</h1>
            <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {t("admin.brands.detail.subtitle")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button primary onClick={openEdit}>
            <Ico d={D.edit} className="h-3.5 w-3.5" /> {t("common.edit")}
          </Button>
          <Button
            danger
            disabled={deleteMutation.isPending}
            onClick={() => setShowDelete(true)}
          >
            <Ico d={D.trash} className="h-3.5 w-3.5" /> {t("common.delete")}
          </Button>
        </div>
      </div>

      {/* ===== BRAND BANNER CARD ===== */}
      <Card className="p-3.5 md:p-4">
        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[1.4fr_0.8fr_0.95fr] xl:gap-0">
          {/* Logo */}
          <div className="flex min-w-0 items-start gap-3.5 xl:pr-5">
            {hasLogo ? (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
                <img src={logoSrc} alt={nameOf(brand)} onError={() => setLogoFailed(true)} className="max-h-full max-w-full object-contain p-1.5" />
              </div>
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px dashed var(--border-color)" }}>
                <Ico d={D.image} className="h-5 w-5 opacity-40" sw={1.4} />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-[17px] leading-tight font-bold">{nameOf(brand)}</h2>
                <StatusPill active={brand.is_active} t={t} />
              </div>
              <span className="mt-1.5 inline-flex rounded border px-1.5 py-0.5 font-mono text-[10px]" style={{ backgroundColor: "var(--bg-tertiary)", borderColor: "var(--border-color)" }}>
                {brand.brand_code || "—"}
              </span>
              {brand.description && <p className="mt-2 max-w-xl text-[12px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{descriptionOf(brand)}</p>}
              <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                <span><span className="mr-1" style={dynamicTextStyle}>{t("admin.brands.detail.country")}</span><strong style={{ ...dynamicTextStyle, color: "var(--text-primary)" }}>{localizedCountryName(brand.country) || "—"}</strong></span>
                <span><span className="mr-1" style={dynamicTextStyle}>{t("admin.brands.detail.createdAt")}</span><strong style={{ ...ltrTextStyle, color: "var(--text-primary)" }}>{formatDateTime(brand.created_at, locale)}</strong></span>
                <span><span className="mr-1" style={dynamicTextStyle}>{t("admin.brands.detail.createdBy")}</span><strong style={{ color: "var(--text-primary)" }}>{brand.createdby?.name || "—"}</strong></span>
              </div>
            </div>
          </div>

          {/* Status summary */}
          <div className="space-y-2.5 xl:border-l xl:border-r xl:px-4" style={{ borderColor: "var(--border-color)" }}>
            <div className="rounded-lg p-2.5" style={{ backgroundColor: "var(--accent-soft)", border: "1px solid var(--border-color)" }}>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: brand.is_active ? "rgba(16,185,129,.16)" : "rgba(239,68,68,.14)", color: brand.is_active ? "var(--accent)" : "var(--danger)" }}>
                  <Ico d={D.check} className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t("admin.brands.detail.brandStatus")}</p>
                  <p className="text-[13px] font-bold" style={{ color: brand.is_active ? "var(--accent)" : "var(--danger)" }}>{brand.is_active ? t("common.active") : t("common.inactive")}</p>
                </div>
              </div>
              <p className="mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>{brand.is_active ? t("admin.brands.detail.visibilityActive") : t("admin.brands.detail.visibilityInactive")}</p>
            </div>
            <div className="rounded-lg p-2.5" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t("admin.brands.detail.totalProducts")}</p>
              <p className="mt-1 text-[18px] font-bold" style={{ color: "var(--text-primary)" }}>{totalProducts}</p>
            </div>
          </div>

          {/* Quick information */}
          <div className="overflow-hidden rounded-lg xl:ml-4" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)" }}>
            <div className="border-b px-3 py-2.5" style={{ borderColor: "var(--border-color)" }}>
              <h3 className="text-[11px] font-bold" style={{ color: "var(--text-primary)" }}>{t("admin.brands.detail.quickInformation")}</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-3 px-3 py-1">
              <InfoRow label={t("admin.brands.detail.brandCode")} value={brand.brand_code} mono compact dir="ltr" />
              <InfoRow label={t("admin.brands.detail.country")} value={localizedCountryName(brand.country) || "—"} compact dir={isRtl ? "rtl" : "ltr"} />
              <InfoRow label={t("admin.brands.detail.logoSize")} value={fileSize(brand.logo?.img_size, locale)} compact dir="ltr" />
              <InfoRow label={t("admin.brands.detail.status")} value={brand.is_active ? t("common.active") : t("common.inactive")} green={brand.is_active} isLast compact dir={isRtl ? "rtl" : "ltr"} />
            </div>
          </div>
        </div>
      </Card>

      {/* ===== TABS ===== */}
      <div
        className="flex items-center gap-5 overflow-x-auto border-b"
        style={{ borderColor: "var(--border-color)" }}
      >
        {[
          { id: "overview", label: t("admin.brands.detail.brandInformation") },
          { id: "products", label: t("admin.brands.detail.products"), badge: totalProducts },
          { id: "activity", label: t("admin.brands.detail.history") },
        ].map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className="relative flex items-center gap-2 py-2 text-[11px] font-medium whitespace-nowrap transition-colors"
              style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
            >
              {item.label}
              {item.badge !== undefined && (
                <span
                  className="rounded-full px-1.5 py-0.5 text-[9px]"
                  style={{
                    backgroundColor: active ? "var(--success-soft)" : "var(--bg-tertiary)",
                    color: active ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {item.badge}
                </span>
              )}
              {active && (
                <span
                  className="absolute bottom-[-1px] left-0 right-0 h-[2px] rounded-full"
                  style={{ backgroundColor: "var(--accent)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ===== OVERVIEW TAB ===== */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-3">
          {/* LEFT COLUMN */}
          <div className="space-y-3 lg:col-span-2">
          
          {/* Reference-style two-column overview layout */}
            
            {/* 1. BRAND INFORMATION */}
            <Card>
              <CardHeader
                title={t("admin.brands.detail.brandInformation")}
                icon={<Ico d={D.tag} className="h-4 w-4" />}
              />
              <div className="px-4 pb-3">
                <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                  <InfoRow label={t("admin.brands.detail.brandCode")} value={brand.brand_code} mono dir="ltr" />
                  <InfoRow label={t("admin.brands.detail.brandName")} value={nameOf(brand)} dir={isRtl ? "rtl" : "ltr"} />
                  <InfoRow label={t("admin.brands.detail.country")} value={localizedCountryName(brand.country) || "—"} dir={isRtl ? "rtl" : "ltr"} />
                  <InfoRow
                    label={t("admin.brands.detail.status")}
                    value={brand.is_active ? t("common.active") : t("common.inactive")}
                    green={brand.is_active}
                    isLast
                    dir={isRtl ? "rtl" : "ltr"}
                  />
                </div>
                <div
                    className="mt-2 rounded-lg p-3"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <p
                    className="mb-1 text-[10px] font-bold uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("admin.brands.detail.description")}
                  </p>
                  {brand.description ? (
                    <p
                      className="whitespace-pre-wrap break-words text-[12px] leading-5"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {descriptionOf(brand)}
                    </p>
                  ) : (
                    <p className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                      {t("admin.brands.detail.noDescription")}
                    </p>
                  )}
                </div>
              </div>
            </Card>

            {/* 2. ADDITIONAL DETAILS */}
            <Card>
              <CardHeader
                title={t("admin.brands.detail.additionalDetails", "Additional Details")}
                icon={<Ico d={D.clock} className="h-4 w-4" />}
              />
              <div className="grid grid-cols-1 gap-x-8 px-4 pb-2 sm:grid-cols-2">
                <InfoRow label={t("admin.brands.detail.createdAt")} value={formatDateTime(brand.created_at, locale)} dir="ltr" />
                <InfoRow label={t("admin.brands.detail.createdBy")} value={brand.createdby?.name} dir={isRtl ? "rtl" : "ltr"} />
                <InfoRow
                  label={t("admin.brands.detail.updatedAt")}
                  value={hasUpdates ? formatDateTime(brand.updated_at, locale) : t("admin.brands.detail.never", "Never")}
                  dir="ltr"
                />
                <InfoRow
                  label={t("admin.brands.detail.updatedBy")}
                  value={hasUpdates ? brand.updatedby?.name : "—"}
                  isLast
                  dir={isRtl ? "rtl" : "ltr"}
                />
              </div>
            </Card>

            {/* 3. RECORD INFO BANNER */}
            <div
                className="flex items-start gap-3 rounded-lg px-4 py-2.5"
              style={{
                backgroundColor: "rgba(16,185,129,.08)",
                border: "1px solid rgba(16,185,129,.25)",
              }}
            >
              <span className="mt-0.5 shrink-0" style={{ color: "var(--accent)" }}>
                <Ico d={D.eye} className="h-4 w-4" />
              </span>
              <p className="text-[11px] leading-5" style={{ color: "var(--text-secondary)" }}>
                {t("admin.brands.detail.recordCreatedBy", { name: brand.createdby?.name || "—", date: formatDateTime(brand.created_at, locale) })}
                {hasUpdates ? (
                  <> {" • "}{t("admin.brands.detail.recordUpdatedBy", { name: brand.updatedby?.name || "—", date: formatDateTime(brand.updated_at, locale) })}</>
                ) : (
                  <> {" • "}{t("admin.brands.detail.noUpdates")}</>
                )}
                {" • "}{t("admin.brands.detail.linkedProducts", { count: totalProducts })}
              </p>
            </div>

            {/* 4. BRAND STATISTICS */}
            <div>
              <p
                className="mb-1.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "var(--text-muted)" }}
              >
                {t("admin.brands.detail.brandStatistics")}
              </p>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {[
                  { label: t("admin.brands.detail.totalProducts"), value: totalProducts, icon: D.box, color: "var(--accent)" },
                  { label: t("admin.brands.detail.activeProducts"), value: activeProducts, icon: D.check, color: "var(--success-text)" },
                  { label: t("admin.brands.detail.inactiveProducts"), value: inactiveProducts, icon: D.minus, color: "var(--danger-text)" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="flex items-center gap-3 rounded-lg px-3.5 py-2.5"
                    style={{
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                    }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: "var(--bg-tertiary)", color: stat.color }}
                    >
                      <Ico d={stat.icon} className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="text-[18px] font-bold leading-tight tabular-nums"
                        style={{ color: stat.color }}
                      >
                        {stat.value}
                      </p>
                      <p className="truncate text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {stat.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. RELATED PRODUCTS */}
            <Card>
              <CardHeader
                title={t("admin.brands.detail.relatedProducts")}
                icon={<Ico d={D.box} className="h-4 w-4" />}
                action={
                  productsLoading ? null : (
                    <button
                      type="button"
                      onClick={() => setTab("products")}
                      className="flex items-center gap-1 text-[11px] hover:underline"
                      style={{ color: "var(--accent)" }}
                    >
                      {t("admin.brands.detail.viewAll")} <Ico d={D.chevron} className="h-3 w-3" />
                    </button>
                  )
                }
              />
              {productsLoading ? (
                <div className="flex items-center justify-center gap-2 py-10">
                  <Spin />
                  <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                    {t("admin.brands.detail.loadingProducts")}
                  </span>
                </div>
              ) : brandProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div
                    className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
                    style={{ backgroundColor: "var(--bg-tertiary)" }}
                  >
                    <Ico d={D.box} className="h-4 w-4 opacity-50" sw={1.5} />
                  </div>
                  <p className="text-[12px] font-medium">{t("admin.brands.detail.noProductsLinked")}</p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {t("admin.brands.detail.linkProductsHint")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                  {brandProducts.slice(0, 4).map((product, index) => (
                    <div
                      key={product._id || index}
                      className="rounded-lg p-3"
                      style={{
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p
                            className="truncate text-[12px] font-semibold"
                            style={{ color: "var(--text-primary)" }}
                          >
                            {product.name || "—"}
                          </p>
                          <p
                            className="mt-0.5 truncate font-mono text-[10px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {product.product_code || product.sku || t("common.none")}
                          </p>
                        </div>
                        <span
                          className="inline-flex shrink-0 rounded-full px-2 py-0.5 text-[9px] font-medium"
                          style={{
                            backgroundColor:
                              product.status === "active"
                                ? "rgba(34,197,94,.10)"
                                : "var(--danger-soft)",
                            color:
                              product.status === "active" ? "var(--success)" : "var(--danger)",
                          }}
                        >
                          {product.status === "active" ? t("common.active") : t("common.inactive")}
                        </span>
                      </div>
                      <p className="mt-2 truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
                        {nameOf(product.category_id) || descriptionOf(product) || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* 6. RECENT ACTIVITY */}
            <Card>
              <CardHeader
                title={t("admin.dashboard.recentActivity.title")}
                icon={<Ico d={D.activity} className="h-4 w-4" />}
                action={
                  <button
                    type="button"
                    onClick={() => setTab("activity")}
                    className="flex items-center gap-1 text-[11px] hover:underline"
                    style={{ color: "var(--accent)" }}
                  >
                    {t("admin.brands.detail.viewAll")} <Ico d={D.chevron} className="h-3 w-3" />
                  </button>
                }
              />
              <div className="space-y-4 p-4">
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full"
                      style={{ backgroundColor: "var(--success-soft)", color: "var(--accent)" }}
                    >
                      <Ico d={D.plus} className="h-3.5 w-3.5" />
                    </div>
                    {hasUpdates && (
                      <div className="mt-1 h-full w-px" style={{ backgroundColor: "var(--border-color)" }} />
                    )}
                  </div>
                  <div className="pb-1">
                    <p className="text-[12px] font-medium">{t("admin.brands.detail.brandCreated")}</p>
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {t("admin.brands.detail.createdByLabel")}{" "}
                      <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                        {brand.createdby?.name || "—"}
                      </span>
                    </p>
                    <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>
                      {formatDateTime(brand.created_at, locale)}
                    </p>
                  </div>
                </div>

                {hasUpdates ? (
                  <div className="flex gap-3">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: "rgba(96,165,250,.12)", color: "var(--info-text)" }}
                    >
                      <Ico d={D.pencil} className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-[12px] font-medium">{t("admin.brands.detail.brandUpdated")}</p>
                      <p className="mt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {t("admin.brands.detail.updatedByLabel")}{" "}
                        <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                          {brand.updatedby?.name || "—"}
                        </span>
                      </p>
                      <p className="mt-1 font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>
                        {formatDateTime(brand.updated_at, locale)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div
                    className="ml-10 rounded-lg border px-3 py-2"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      borderColor: "var(--border-color)",
                    }}
                  >
                    <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {t("admin.brands.detail.noUpdates")}
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-4">
            {/* 7. BRAND LOGO */}
            <Card>
              <CardHeader
                title={t("admin.brands.detail.brandLogo")}
                icon={<Ico d={D.image} className="h-4 w-4" />}
              />
                <div className="p-4 flex flex-col">
                  {hasLogo ? (
                    <div className="flex flex-col">
                      <div
                        className="mb-3 flex items-center justify-center overflow-hidden rounded-lg"
                        style={{
                          backgroundColor: "var(--bg-tertiary)",
                          border: "1px solid var(--border-color)",
                          minHeight: "140px",
                          maxHeight: "200px"
                        }}
                      >
                        <img
                          src={logoSrc}
                          alt={nameOf(brand)}
                          onError={() => setLogoFailed(true)}
                          className="max-h-full max-w-full object-contain p-2"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium">
                            {brand.logo.img_url?.split("/").pop()}
                          </p>
                          <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {fileSize(brand.logo.img_size, locale)}
                          </p>
                        </div>
                        <a
                          href={logoSrc}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-[10px] hover:underline"
                          style={{ color: "var(--accent)" }}
                        >
                          {t("admin.brands.detail.view")} <Ico d={D.link} className="inline h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center rounded-lg py-8"
                      style={{
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px dashed var(--border-color)",
                      }}
                    >
                      <Ico d={D.image} className="mb-3 h-6 w-6 opacity-40" sw={1.4} />
                      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {t("admin.brands.detail.noLogoUploaded")}
                      </p>
                    </div>
                  )}
                </div>
              </Card>

            {/* 8. QUICK INFO */}
            <Card>
              <CardHeader
                title={t("admin.brands.detail.quickInfo")}
                icon={<Ico d={D.tag} className="h-4 w-4" />}
              />
              <div className="px-4 pb-4">
                <InfoRow label={t("admin.brands.detail.brandCode")} value={brand.brand_code} mono dir="ltr" />
                <InfoRow label={t("admin.brands.detail.country")} value={localizedCountryName(brand.country) || "—"} dir={isRtl ? "rtl" : "ltr"} />
                <InfoRow
                  label={t("admin.brands.detail.status")}
                  value={brand.is_active ? t("common.active") : t("common.inactive")}
                  green={brand.is_active}
                  dir={isRtl ? "rtl" : "ltr"}
                />
                <InfoRow label={t("admin.brands.detail.createdAt")} value={formatDateTime(brand.created_at, locale)} dir="ltr" />
                <InfoRow label={t("admin.brands.detail.createdBy")} value={brand.createdby?.name} dir={isRtl ? "rtl" : "ltr"} />
                <InfoRow
                  label={t("admin.brands.detail.updatedAt")}
                  value={hasUpdates ? formatDateTime(brand.updated_at, locale) : t("admin.brands.detail.never", "Never")}
                  dir="ltr"
                />
                <InfoRow
                  label={t("admin.brands.detail.updatedBy")}
                  value={hasUpdates ? brand.updatedby?.name : "—"}
                  isLast
                  dir={isRtl ? "rtl" : "ltr"}
                />
              </div>
            </Card>
          </div>

        </div>
      )}

      {/* ===== PRODUCTS TAB ===== */}
      {tab === "products" && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={t("admin.brands.detail.allProducts")}
              icon={<Ico d={D.box} className="h-4 w-4" />}
              action={
                <div className="relative">
                  <Ico
                    d={D.search}
                    className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2"
                    style={{ color: "var(--text-muted)" }}
                  />
                  <input
                    type="text"
                    placeholder={t("admin.brands.detail.searchProducts")}
                    className="h-8 w-[200px] rounded-md border pl-8 pr-3 text-[11px] outline-none"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      borderColor: "var(--border-color)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>
              }
            />
            {productsLoading ? (
              <div className="flex items-center justify-center gap-2 py-14">
                <Spin />
                <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>
                  {t("admin.brands.detail.loadingProducts")}
                </span>
              </div>
            ) : brandProducts.length === 0 ? (
              <div className="py-16 text-center">
                <Ico d={D.box} className="mx-auto mb-3 h-12 w-12 opacity-40" sw={1.4} />
                <p className="text-[12px] font-medium">{t("admin.brands.detail.noProductsYet")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead style={{ backgroundColor: "var(--bg-table)" }}>
                    <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <th
                        className="py-3 pl-4 pr-2 text-left text-[10px] font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t("admin.brands.detail.productTableProduct")}
                      </th>
                      <th
                        className="px-2 py-3 text-left text-[10px] font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t("admin.brands.detail.productTableDescription")}
                      </th>
                      <th
                        className="px-2 py-3 text-left text-[10px] font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t("admin.brands.detail.productTableCategory")}
                      </th>
                      <th
                        className="py-3 pr-4 text-center text-[10px] font-medium"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {t("admin.brands.detail.productTableStatus")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {brandProducts.map((product, index) => (
                      <tr
                        key={product._id || index}
                        style={{ borderBottom: "1px solid var(--border-color)" }}
                      >
                        <td className="align-top py-3 pl-4 pr-2">
                          <p className="font-semibold" style={{ color: "var(--text-primary)" }}>
                            {nameOf(product) || "—"}
                          </p>
                          <p
                            className="mt-1 font-mono text-[10px]"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {product.product_code || product.sku || t("admin.brands.detail.noCode")}
                          </p>
                        </td>
                        <td className="max-w-[280px] align-top px-2 py-3">
                          <p
                            className="line-clamp-2 text-[11px] leading-5"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {descriptionOf(product) || t("admin.brands.detail.noDescription")}
                          </p>
                        </td>
                        <td className="px-2 py-3" style={{ color: "var(--text-secondary)" }}>
                          {nameOf(product.category_id) || "—"}
                        </td>
                        <td className="py-3 pr-4 text-center">
                          <span
                            className="inline-flex rounded-full px-2 py-1 text-[10px] font-medium"
                            style={{
                              backgroundColor:
                                product.status === "active"
                                  ? "rgba(34,197,94,.10)"
                                  : "var(--danger-soft)",
                              color:
                                product.status === "active"
                                  ? "var(--success)"
                                  : "var(--danger)",
                            }}
                          >
                            {product.status === "active" ? t("common.active") : t("common.inactive")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ===== ACTIVITY TAB ===== */}
      {tab === "activity" && (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardHeader
              title={t("admin.brands.detail.fullActivityTimeline")}
              icon={<Ico d={D.activity} className="h-4 w-4" />}
            />
            <div className="space-y-5 p-4">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: "var(--success-soft)",
                      color: "var(--accent)",
                    }}
                  >
                    <Ico d={D.plus} className="h-3.5 w-3.5" />
                  </div>
                  {hasUpdates && (
                    <div
                      className="mt-1 h-full w-px"
                      style={{ backgroundColor: "var(--border-color)" }}
                    />
                  )}
                </div>
                <div className="pb-1">
                  <p className="text-[13px] font-medium">{t("admin.brands.detail.brandCreated")}</p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {t("admin.brands.detail.createdByLabel")}{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {brand.createdby?.name || "—"}
                    </span>
                    {brand.createdby?.email && (
                      <span className="block text-[10px] opacity-70">
                        {brand.createdby.email}
                      </span>
                    )}
                  </p>
                  <p
                    className="mt-2 font-mono text-[10px]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {formatDateTime(brand.created_at, locale)}
                  </p>
                </div>
              </div>

              {hasUpdates ? (
                <div className="flex gap-3">
                  <div>
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full"
                      style={{
                        backgroundColor: "rgba(96,165,250,.12)",
                        color: "var(--info-text)",
                      }}
                    >
                      <Ico d={D.pencil} className="h-3.5 w-3.5" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium">{t("admin.brands.detail.brandUpdated")}</p>
                    <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      {t("admin.brands.detail.updatedByLabel")}{" "}
                      <span className="font-semibold text-[var(--text-primary)]">
                        {brand.updatedby?.name || "—"}
                      </span>
                      {brand.updatedby?.email && (
                        <span className="block text-[10px] opacity-70">
                          {brand.updatedby.email}
                        </span>
                      )}
                    </p>
                    <p
                      className="mt-2 font-mono text-[10px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatDateTime(brand.updated_at, locale)}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className="ml-10 rounded-lg border px-3 py-2"
                  style={{
                    backgroundColor: "var(--bg-tertiary)",
                    borderColor: "var(--border-color)",
                  }}
                >
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                    {t("admin.brands.detail.noUpdates")}
                  </span>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title={t("admin.brands.detail.userDetails")}
              icon={<Ico d={D.user} className="h-4 w-4" />}
            />
            <div className="space-y-4 p-4">
              <div>
                <p
                  className="mb-2 text-[10px] uppercase tracking-wide"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t("admin.brands.detail.creator")}
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: "var(--bg-tertiary)",
                      border: "1px solid var(--border-color)",
                      color: "var(--accent)",
                    }}
                  >
                    {ini(brand.createdby?.name)}
                  </div>
                  <div>
                    <p className="text-[12px] font-medium">
                      {brand.createdby?.name || "—"}
                    </p>
                    <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {brand.createdby?.email || "—"}
                    </p>
                  </div>
                </div>
              </div>

              {hasUpdates && (
                <div className="border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                  <p
                    className="mb-2 text-[10px] uppercase tracking-wide"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {t("admin.brands.detail.lastEditor")}
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: "var(--bg-tertiary)",
                        border: "1px solid var(--border-color)",
                        color: "var(--accent)",
                      }}
                    >
                      {ini(brand.updatedby?.name)}
                    </div>
                    <div>
                      <p className="text-[12px] font-medium">
                        {brand.updatedby?.name || "—"}
                      </p>
                      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                        {brand.updatedby?.email || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ===== NEW EDIT MODAL ===== */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
            <div className="px-5 py-4 flex items-center justify-between rounded-t-xl" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              <h3 className="text-base font-semibold">{t("admin.brands.detail.editBrand")}</h3>
              <button onClick={() => { setShowEdit(false); }} disabled={updateMutation.isPending} className="p-1 rounded transition disabled:opacity-50 hover:opacity-70" style={{ color: "var(--text-muted)" }}><Ico d={D.close} /></button>
            </div>
            
            <form onSubmit={submitEdit} className="p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* ROW 1: Brand Code + Brand Name */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("admin.brands.detail.brandCode")}</label>
                  <input 
                    type="text" 
                    value={form.brand_code} 
                    readOnly
                    className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50 font-mono cursor-not-allowed" 
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} 
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("admin.brands.detail.brandNameRequired")}</label>
                  <input 
                    type="text" 
                    value={form.name} 
                    onChange={(e) => setForm({ ...form, name: e.target.value })} 
                    required 
                    disabled={updateMutation.isPending} 
                    className="h-9 px-3 rounded-md text-sm w-full outline-none disabled:opacity-50" 
                    style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} 
                    placeholder={t("admin.brands.ui.nameExample")}
                  />
                </div>
              </div>

              {/* ROW 2: Description */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("admin.brands.detail.description")}</label>
                <textarea 
                  value={form.description} 
                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                  rows="3" 
                  disabled={updateMutation.isPending} 
                  className="px-3 py-2 rounded-md text-sm w-full outline-none disabled:opacity-50 resize-none" 
                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} 
                  placeholder={t("admin.brands.ui.detailsPlaceholder")}
                />
              </div>

              {/* ROW 3: DRAG AND DROP LOGO UPLOAD */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("admin.brands.detail.brandLogo")}</label>
                
                {/* Hidden Input */}
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/png, image/jpeg, image/webp" 
                  className="hidden" 
                  onChange={(e) => handleLogoChange(e.target.files?.[0])} 
                  disabled={updateMutation.isPending} 
                />

                {/* Drop Zone Area */}
                <div 
                  onClick={() => !updateMutation.isPending && fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`
                    relative w-full h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200
                    ${isDragging ? "border-emerald-500 bg-emerald-500/10" : "border-gray-600 hover:border-emerald-500/50 hover:bg-white/5"}
                  `}
                  style={{ borderColor: isDragging ? undefined : "var(--border-color)" }}
                >
                  {logoPreview ? (
                    <div className="relative w-full h-full flex items-center justify-center p-2">
                       <img src={logoPreview} alt={t("detail.brandLogo")} className="max-h-full max-w-full object-contain rounded-md" />
                       {/* Remove Button Overlay */}
                       <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                        className="absolute top-2 right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition shadow-md"
                       >
                         <Ico d={D.close} className="w-3 h-3" />
                       </button>
                    </div>
                  ) : (
                    <>
                      <div className={`p-3 rounded-full ${isDragging ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-gray-400"}`}>
                        <Ico d={D.upload} className="w-6 h-6" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                          {isDragging ? t("admin.brands.detail.dropImageHere") : t("admin.brands.detail.dragImage")}
                        </p>
                        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{t("admin.brands.detail.imageFormats")}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ROW 4: Country + Active Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("admin.brands.detail.country")}</label>
                  <CountryDropdown value={form.country} onChange={(val) => setForm({ ...form, country: val })} disabled={updateMutation.isPending} allCountries={allCountries} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer h-9 mb-1">
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} disabled={updateMutation.isPending} className="w-4 h-4 rounded disabled:opacity-50" style={{ accentColor: "var(--accent)" }} />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{t("common.active")}</span>
                </label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 pt-4" style={{ borderTop: "1px solid var(--border-color)" }}>
                <button type="button" onClick={() => { setShowEdit(false); }} disabled={updateMutation.isPending} className="flex-1 h-10 sm:h-9 rounded-md text-sm font-medium transition disabled:opacity-50 hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>{t("common.cancel")}</button>
                <button type="submit" disabled={updateMutation.isPending} className="flex-1 h-10 sm:h-9 rounded-md text-sm font-semibold transition disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-1.5" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>
                  {updateMutation.isPending ? <><Spin className="w-3.5 h-3.5" /> {t("common.saving")}</> : t("admin.brands.detail.updateBrand")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== DELETE MODAL ===== */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div
            className="max-h-[90vh] w-full max-w-sm overflow-hidden rounded-xl p-5"
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              boxShadow: "0 20px 60px rgba(0,0,0,.4)",
            }}
          >
            <div className="flex gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" }}
              >
                <Ico d={D.warn} className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold">{t("admin.brands.ui.deleteOneTitle", { name: nameOf(brand) })}</h3>
                <p className="mt-1 text-[11px] leading-5" style={{ color: "var(--text-muted)" }}>
                  {t("admin.brands.ui.deleteWarning")}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button disabled={deleteMutation.isPending} onClick={() => setShowDelete(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                danger
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? (
                  <>
                    <Spin className="h-3.5 w-3.5" /> {t("admin.brands.ui.deleting")}
                  </>
                ) : (
                  <>
                    <Ico d={D.trash} className="h-3.5 w-3.5" /> {t("admin.brands.ui.delete")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}