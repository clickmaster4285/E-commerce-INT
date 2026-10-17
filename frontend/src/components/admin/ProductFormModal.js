"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Country } from "country-state-city";
import { toast } from "sonner";
import { Check, ChevronDown, Clock3, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { productApi } from "@/apis/admin/productApi";
import { categoryApi } from "@/apis/admin/categoryApi";
import { brandApi } from "@/apis/admin/brandApi";
import CategoryFormModal from "@/components/admin/CategoryFormModal";

function handlePermissionError(error, defaultMessage, resource = "resource", t = null) {
  const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || "";
  const normalized = String(message).toLowerCase();
  if (normalized.includes("permission") || normalized.includes("access denied") || normalized.includes("forbidden") || error?.response?.status === 403) {
    const title = t ? t("errors.noPermission", { resource }) : `You don't have permission to modify this ${resource}.`;
    const description = t ? t("errors.contactAdmin") : "Contact an administrator to grant you access.";
    toast.error(title, { duration: 6000, description });
    return;
  }
  toast.error(message || defaultMessage);
}

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "object") {
    if (value.$oid) return String(value.$oid);
    if (value._id) return String(value._id);
    if (value.id) return String(value.id);
    return "";
  }
  return String(value);
}

function Field({ label, children }) {
  return <div className="space-y-1"><label className="block text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</label>{children}</div>;
}
function Dropdown({ children, maxHeight = "max-h-48" }) {
  return <div className={`absolute z-[100] mt-1 w-full overflow-y-auto rounded-lg border shadow-lg ${maxHeight}`} style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-color)" }}>{children}</div>;
}
function ModalOverlay({ children, zIndex }) {
  return <div className={`fixed inset-0 ${zIndex} flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm`}>{children}</div>;
}

const BrandCountryDropdown = ({ value, onChange, disabled = false, allCountries = [] }) => {
  const { t: __t } = useTranslation();
  const t = (k, p) => __t("admin.productForm." + k, p);
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
    if (!isOpen) setSearchTerm("");
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
      <button type="button" onClick={() => !disabled && setIsOpen(!isOpen)} disabled={disabled} className="h-9 w-full rounded-md px-3 text-sm flex items-center justify-between gap-2 outline-none transition disabled:opacity-50 cursor-pointer" style={{ backgroundColor: "var(--bg-tertiary)", border: isOpen ? "1px solid color-mix(in srgb, var(--success) 45%, transparent)" : "1px solid var(--border-color)", color: "var(--text-primary)" }}>
        <div className="flex items-center gap-2 min-w-0">
          {selectedCountry ? (
            <>
              <span className="text-base leading-none">{getFlagEmoji(selectedCountry.isoCode)}</span>
              <span className="truncate text-[13px]">{selectedCountry.name}</span>
            </>
          ) : (
            <span className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              {t("country.select")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selectedCountry && (
            <span onClick={handleClear} className="p-0.5 rounded hover:bg-white/10 transition" style={{ color: "var(--text-muted)" }}>
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>
      {isOpen && (
        <div className="absolute z-50 bottom-full mb-1 w-full rounded-lg overflow-hidden shadow-2xl" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "0 -10px 40px rgba(0,0,0,0.5)" }}>
          <div className="px-3 py-1.5 text-center" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{t("country.count", { count: filteredCountries.length, total: allCountries.length })}</p>
          </div>
          <div className="max-h-[200px] overflow-y-auto py-1" style={{ scrollbarWidth: "thin" }}>
            {filteredCountries.length === 0 ? (
              <div className="px-3 py-4 text-center"><p className="text-[12px]" style={{ color: "var(--text-muted)" }}>{t("country.noneFound")}</p></div>
            ) : (
              filteredCountries.map((country) => {
                const isSelected = country.name === value;
                return (
                  <button key={country.isoCode} type="button" onClick={() => handleSelect(country.name)} className="w-full px-3 py-2 flex items-center justify-between gap-2 text-start transition" style={{ backgroundColor: isSelected ? "var(--success-soft)" : "transparent" }} onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "var(--bg-row-hover)"; }} onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base leading-none">{getFlagEmoji(country.isoCode)}</span>
                      <span className="truncate text-[13px]" style={{ color: isSelected ? "var(--success-text)" : "var(--text-primary)", fontWeight: isSelected ? 600 : 400 }}>{country.name}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--success-text)" }} />}
                  </button>
                );
              })
            )}
          </div>
          <div className="p-2" style={{ borderTop: "1px solid var(--border-color)" }}>
            <div className="relative">
              <span className="absolute start-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><Search className="w-3.5 h-3.5" /></span>
              <input ref={searchInputRef} type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t("country.searchPlaceholder")} aria-label={t("country.searchPlaceholder")} className="w-full h-10 md:h-8 ps-8 pe-3 rounded-md text-[16px] md:text-[12px] outline-none transition focus:ring-1 focus:ring-emerald-500/40" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const blankForm = () => ({ category_id: "", brand_id: "", name: "", description: "", tax: "0", status: "active", tag_names: [], variants: [], topup: "0", isPerishable: false, expiryDuration: "", expiryUnit: "days" });

/* Shared product create/edit form used by the Products and Purchase Orders pages. */
export default function ProductFormModal({ open, initialProduct = null, onClose, onCreated, onUpdated, zIndex = "z-50" }) {
  // Admin-panel i18n. English is the fallback for any missing key.
  const { t: __t } = useTranslation();
  const t = (k, p) => __t("admin.productForm." + k, p);
  const ts = (k, p) => __t("admin.shared." + k, p);
  const queryClient = useQueryClient();
  const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
  const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };

  const [formData, setFormData] = useState(blankForm);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isBrandDropdownOpen, setIsBrandDropdownOpen] = useState(false);
  const [categoryDropdownSearch, setCategoryDropdownSearch] = useState("");
  const [brandDropdownSearch, setBrandDropdownSearch] = useState("");
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [showNewBrandModal, setShowNewBrandModal] = useState(false);
  const [brandFormData, setBrandFormData] = useState({ brand_code: "", name: "", description: "", country: "", is_active: true });
  const [brandLogoFile, setBrandLogoFile] = useState(null);
  const [brandLogoPreview, setBrandLogoPreview] = useState("");
  const [loadingBrandCode, setLoadingBrandCode] = useState(false);
  const [brandIsDragging, setBrandIsDragging] = useState(false);
  const brandFileInputRef = useRef(null);

  const allCountries = useMemo(() => Country.getAllCountries().map((c) => ({ name: c.name, isoCode: c.isoCode })), []);

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: categoryApi.getAll, retry: false, enabled: open });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: brandApi.getAll, retry: false, enabled: open });

  useEffect(() => {
    if (!open) return;
    if (initialProduct) {
      const currentTagNames = (initialProduct.tag_ids || []).map((t) => (typeof t === "object" ? t.name : t)).filter(Boolean);
      const isPerishable = initialProduct?.isPerishable === true;
      setFormData({
        category_id: normalizeId(initialProduct?.category_id), brand_id: normalizeId(initialProduct?.brand_id),
        name: initialProduct?.name || "", description: initialProduct?.description || "", tax: String(initialProduct?.tax ?? 0),
        status: initialProduct?.status || "active", tag_names: currentTagNames, variants: [],
        isPerishable,
        expiryDuration: isPerishable ? String(initialProduct?.expiryDuration ?? "") : "",
        expiryUnit: isPerishable ? initialProduct?.expiryUnit || "days" : "days",
      });
    } else {
      setFormData(blankForm());
    }
    setIsCategoryDropdownOpen(false);
    setIsBrandDropdownOpen(false);
  }, [open, initialProduct]);

  const filteredCategoryOptions = useMemo(() => {
    const term = categoryDropdownSearch.trim().toLowerCase();
    if (!term) return categories;
    return categories.filter((c) => String(c?.name || "").toLowerCase().includes(term));
  }, [categories, categoryDropdownSearch]);

  const filteredBrandOptions = useMemo(() => {
    const term = brandDropdownSearch.trim().toLowerCase();
    if (!term) return brands;
    return brands.filter((b) => String(b?.name || "").toLowerCase().includes(term));
  }, [brands, brandDropdownSearch]);

  const createMutation = useMutation({
    mutationFn: productApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onCreated?.(data);
    },
    onError: (e) => handlePermissionError(e, t("toast.createFailed"), t("entity.product"), t),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => productApi.update(id, data),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["products"] }); onUpdated?.(data); },
    onError: (e) => handlePermissionError(e, t("toast.updateFailed"), t("entity.product"), t),
  });
  const createBrandMutation = useMutation({
    mutationFn: (data) => brandApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["adminBrands"] });
      const nb = res?.data || res;
      if (nb?._id) { setFormData((p) => ({ ...p, brand_id: String(nb._id) })); toast.success(t("toast.brandCreatedSelected")); }
      else { toast.success(t("toast.brandCreated")); }
      setShowNewBrandModal(false);
      resetBrandForm();
    },
    onError: (e) => handlePermissionError(e, t("toast.brandCreateFailed"), t("entity.brand"), t),
  });

  const submitProductForm = () => {
    if (!formData.name.trim()) { toast.error(t("validation.nameRequired")); return; }
    if (formData.isPerishable && (!Number.isInteger(Number(formData.expiryDuration)) || Number(formData.expiryDuration) <= 0)) {
      toast.error(t("validation.expiryDuration"));
      return;
    }
    const data = new FormData();
    data.append("category_id", formData.category_id);
    data.append("brand_id", formData.brand_id);
    data.append("name", formData.name.trim());
    data.append("description", formData.description || "");
    data.append("tax", formData.tax || "0");
    data.append("status", formData.status);
    data.append("tag_names", JSON.stringify(formData.tag_names || []));
    data.append("isPerishable", String(formData.isPerishable));
    data.append("expiryDuration", formData.isPerishable ? String(formData.expiryDuration) : "0");
    data.append("expiryUnit", formData.isPerishable ? formData.expiryUnit : "days");
    if (initialProduct?._id) updateMutation.mutate({ id: initialProduct._id, data });
    else createMutation.mutate(data);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submitProductForm();
  };

  const handleOpenCategoryModal = () => { setShowNewCategoryModal(true); };

  const resetBrandForm = () => {
    if (brandLogoPreview?.startsWith("blob:")) URL.revokeObjectURL(brandLogoPreview);
    setBrandFormData({ brand_code: "", name: "", description: "", country: "", is_active: true });
    setBrandLogoFile(null);
    setBrandLogoPreview("");
  };
  const fetchNextBrandCode = async () => {
    try {
      setLoadingBrandCode(true);
      const res = await brandApi.getNextCode();
      const code = res?.nextCode || res?.data?.nextCode || res;
      if (typeof code === "string" && code.trim()) { setBrandFormData((p) => ({ ...p, brand_code: code })); return; }
      throw new Error("Invalid brand code");
    } catch (e) {
      const nums = brands.filter((b) => b?.brand_code && /^BRD-\d+$/i.test(b.brand_code)).map((b) => parseInt(b.brand_code.split("-")[1], 10)).filter(Number.isFinite);
      const next = nums.length ? Math.max(...nums) + 1 : 1;
      setBrandFormData((p) => ({ ...p, brand_code: `BRD-${String(next).padStart(3, "0")}` }));
    } finally { setLoadingBrandCode(false); }
  };
  const handleOpenBrandModal = () => { resetBrandForm(); setShowNewBrandModal(true); fetchNextBrandCode(); };
  const handleBrandLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error(t("validation.logoTooLarge")); e.target.value = ""; return; }
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { toast.error(t("validation.logoTypes")); e.target.value = ""; return; }
    if (brandLogoPreview?.startsWith("blob:")) URL.revokeObjectURL(brandLogoPreview);
    setBrandLogoFile(file);
    setBrandLogoPreview(URL.createObjectURL(file));
  };
  const handleBrandFileDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setBrandIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith("image/")) { toast.error(t("validation.dropImageFile")); return; }
      if (file.size > 10 * 1024 * 1024) { toast.error(t("validation.imageTooLarge")); return; }
      if (brandLogoPreview?.startsWith("blob:")) URL.revokeObjectURL(brandLogoPreview);
      setBrandLogoFile(file);
      setBrandLogoPreview(URL.createObjectURL(file));
    }
  };
  const handleBrandRemoveLogo = () => {
    if (brandLogoPreview?.startsWith("blob:")) URL.revokeObjectURL(brandLogoPreview);
    setBrandLogoFile(null);
    setBrandLogoPreview("");
  };
  const handleBrandSubmit = (e) => {
    e.preventDefault();
    if (!brandFormData.brand_code.trim()) { toast.error(t("validation.brandCodeRequired")); return; }
    if (!brandFormData.name.trim()) { toast.error(t("validation.brandNameRequired")); return; }
    const fd = new FormData();
    fd.append("brand_code", brandFormData.brand_code.trim());
    fd.append("name", brandFormData.name.trim());
    fd.append("description", brandFormData.description.trim());
    fd.append("country", brandFormData.country || "");
    fd.append("is_active", String(brandFormData.is_active));
    if (brandLogoFile) fd.append("logo", brandLogoFile);
    createBrandMutation.mutate(fd);
  };

  if (!open) return null;
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <ModalOverlay zIndex={zIndex}>
        <div className="max-h-[95vh] w-full max-w-[720px] overflow-y-auto rounded-xl shadow-2xl" style={cardStyle}>
          <div className="sticky top-0 z-20 flex items-center justify-between rounded-t-xl px-5 py-4" style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
            <div>
              <h3 className="text-base font-semibold">{initialProduct ? t("title.edit") : t("title.create")}</h3>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>{t("subtitle")}</p>
            </div>
            <button type="button" onClick={onClose} aria-label={ts("action.close")} title={ts("action.close")} className="rounded p-1 transition hover:opacity-70" style={{ color: "var(--text-muted)" }}><X className="h-5 w-5" /></button>
          </div>
          <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label={`${t("form.category")} *`}>
                      <div className="relative">
                        <button type="button" onClick={() => { setIsCategoryDropdownOpen(o => { if (!o) setCategoryDropdownSearch(""); return !o; }); setIsBrandDropdownOpen(false); }} className="flex h-9 w-full items-center justify-between rounded-md px-3 text-start text-sm" style={inputStyle}>
                          <span className="truncate">{formData.category_id ? categories.find(c => String(c._id) === String(formData.category_id))?.name || t("form.selectedCategory") : t("form.selectCategory")}</span>
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        </button>
                        {isCategoryDropdownOpen && (
                          <Dropdown>
                            <div className="sticky top-0 z-10 p-2" style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
                              <div className="relative">
                                <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                                <input
                                  autoFocus
                                  type="text"
                                  value={categoryDropdownSearch}
                                  onChange={(e) => setCategoryDropdownSearch(e.target.value)}
                                  placeholder={t("form.searchCategory")}
                                  aria-label={t("form.searchCategory")}
                                  className="h-9 w-full rounded-md ps-8 pe-2 text-[16px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 sm:h-8 sm:text-[12px]"
                                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                                />
                              </div>
                            </div>
                            {filteredCategoryOptions.length === 0 ? (
                              <p className="px-3 py-4 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>{t("form.noCategory")}</p>
                            ) : filteredCategoryOptions.map(c => <button type="button" key={c._id} onClick={() => { setFormData(p => ({ ...p, category_id: String(c._id) })); setIsCategoryDropdownOpen(false); setCategoryDropdownSearch(""); }} className="block w-full px-3 py-2 text-start text-sm hover:bg-black/5" style={{ color: String(formData.category_id) === String(c._id) ? "var(--accent)" : "var(--text-primary)" }}>{c.name}</button>)}
                            <button type="button" onClick={() => { setIsCategoryDropdownOpen(false); setCategoryDropdownSearch(""); handleOpenCategoryModal(); }} className="flex w-full items-center gap-2 border-t px-3 py-2 text-start text-sm font-semibold hover:bg-black/5 sticky bottom-0" style={{ borderColor: "var(--border-color)", color: "var(--accent)", backgroundColor: "var(--bg-card)" }}><Plus className="h-4 w-4" /> {t("form.createNewCategory")}</button>
                          </Dropdown>
                        )}
                      </div>
                    </Field>
                    <Field label={`${t("form.brand")} *`}>
                      <div className="relative">
                        <button type="button" onClick={() => { setIsBrandDropdownOpen(o => { if (!o) setBrandDropdownSearch(""); return !o; }); setIsCategoryDropdownOpen(false); }} className="flex h-9 w-full items-center justify-between rounded-md px-3 text-start text-sm" style={inputStyle}>
                          <span className="truncate">{formData.brand_id ? brands.find(b => String(b._id) === String(formData.brand_id))?.name || t("form.selectedBrand") : t("form.selectBrand")}</span>
                          <ChevronDown className="h-4 w-4 shrink-0" />
                        </button>
                        {isBrandDropdownOpen && (
                          <Dropdown>
                            <div className="sticky top-0 z-10 p-2" style={{ backgroundColor: "var(--bg-card)", borderBottom: "1px solid var(--border-color)" }}>
                              <div className="relative">
                                <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                                <input
                                  autoFocus
                                  type="text"
                                  value={brandDropdownSearch}
                                  onChange={(e) => setBrandDropdownSearch(e.target.value)}
                                  placeholder={t("form.searchBrand")}
                                  aria-label={t("form.searchBrand")}
                                  className="h-9 w-full rounded-md ps-8 pe-2 text-[16px] outline-none transition focus:ring-1 focus:ring-emerald-500/40 sm:h-8 sm:text-[12px]"
                                  style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
                                />
                              </div>
                            </div>
                            {filteredBrandOptions.length === 0 ? (
                              <p className="px-3 py-4 text-center text-sm" style={{ color: "var(--text-muted)" }}>{t("form.noBrand")}</p>
                            ) : filteredBrandOptions.map(b => <button type="button" key={b._id} onClick={() => { setFormData(p => ({ ...p, brand_id: String(b._id) })); setIsBrandDropdownOpen(false); setBrandDropdownSearch(""); }} className="block w-full px-3 py-2 text-start text-sm hover:bg-black/5" style={{ color: String(formData.brand_id) === String(b._id) ? "var(--accent)" : "var(--text-primary)" }}>{b.name}</button>)}
                            <button type="button" onClick={() => { setIsBrandDropdownOpen(false); setBrandDropdownSearch(""); handleOpenBrandModal(); }} className="flex w-full items-center gap-2 border-t px-3 py-2 text-start text-sm font-semibold hover:bg-black/5 sticky bottom-0" style={{ borderColor: "var(--border-color)", color: "var(--accent)", backgroundColor: "var(--bg-card)" }}><Plus className="h-4 w-4" /> {t("form.createNewBrand")}</button>
                          </Dropdown>
                        )}
                      </div>
                    </Field>
                  </div>
                  <Field label={`${t("form.name")} *`}><input required type="text" placeholder={t("form.namePlaceholder")} value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className="h-9 w-full rounded-md px-3 text-sm" style={inputStyle} /></Field>
                  <Field label={ts("label.description")}><textarea rows={3} placeholder={t("form.descriptionPlaceholder")} value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} className="w-full resize-none rounded-md px-3 py-2 text-sm" style={inputStyle} /></Field>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Field label={t("form.tax")}>
                      <input type="number" min="0" max="100" step="0.01" placeholder="%" value={formData.tax} onChange={e => { const v = e.target.value; if (v === "") { setFormData(p => ({ ...p, tax: "" })); return; } let n = Number(v); if (!Number.isFinite(n)) n = 0; n = Math.min(100, Math.max(0, n)); setFormData(p => ({ ...p, tax: String(n) })); }} className="h-9 w-full rounded-md px-3 text-sm" style={inputStyle} />
                    </Field>
                    <Field label={ts("label.status")}>
                      <select value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))} className="h-9 w-full appearance-none rounded-md px-3 text-sm outline-none" style={inputStyle}>
                        <option value="active">{ts("status.active")}</option>
                        <option value="inactive">{ts("status.inactive")}</option>
                      </select>
                    </Field>
                   </div>
                  <div>
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={formData.isPerishable}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setFormData((previous) => ({
                            ...previous,
                            isPerishable: checked,
                            expiryDuration: checked ? previous.expiryDuration : "",
                            expiryUnit: checked ? previous.expiryUnit : "days",
                          }));
                        }}
                        className="mt-0.5 h-4 w-4 rounded"
                        style={{ accentColor: "var(--accent)" }}
                      />
                      <span>
                        <span className="block text-xs font-medium" style={{ color: "var(--text-primary)" }}>{t("form.perishable")}</span>
                        <span className="mt-0.5 block text-[11px]" style={{ color: "var(--text-muted)" }}>
                          {t("form.perishableHint")}
                        </span>
                      </span>
                    </label>
                    <div
                      aria-hidden={!formData.isPerishable}
                      className={`overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-in-out ${formData.isPerishable ? "mt-4 max-h-64 opacity-100" : "mt-0 max-h-0 opacity-0"}`}
                    >
                      <div className="rounded-xl border p-4 sm:p-5" style={{ borderColor: "color-mix(in srgb, var(--accent) 22%, var(--border-color))", background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 5%, var(--bg-card)) 0%, var(--bg-card) 100%)" }}>
                        <div className="mb-3 flex items-start gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}>
                            <Clock3 size={16} />
                          </span>
                          <div className="min-w-0">
                            <label className="block text-xs font-bold" style={{ color: "var(--text-primary)" }}>
                              {t("form.expiryTitle")}
                            </label>
                            <p className="mt-0.5 text-[11px] leading-4" style={{ color: "var(--text-muted)" }}>
                              {t("form.expiryHint")}
                            </p>
                          </div>
                          <span className="ms-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" }}>{ts("label.required")}</span>
                        </div>
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(112px,0.65fr)] gap-2.5">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            inputMode="numeric"
                            aria-label={t("form.expiryDurationAria")}
                            placeholder={t("form.expiryDurationPlaceholder")}
                            required={formData.isPerishable}
                            disabled={!formData.isPerishable}
                            value={formData.expiryDuration}
                            onChange={(event) => setFormData((previous) => ({ ...previous, expiryDuration: event.target.value }))}
                            className="h-11 w-full rounded-lg px-3.5 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-50"
                            style={{ ...inputStyle, backgroundColor: "var(--bg-card)" }}
                          />
                          <select
                            value={formData.expiryUnit}
                            onChange={(event) => setFormData((previous) => ({ ...previous, expiryUnit: event.target.value }))}
                            aria-label={t("form.expiryUnitAria")}
                            disabled={!formData.isPerishable}
                            className="h-11 w-full rounded-lg px-3 text-sm font-medium outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 disabled:opacity-50"
                            style={{ ...inputStyle, backgroundColor: "var(--bg-card)" }}
                          >
                            <option value="days">{t("form.unitDays")}</option>
                            <option value="months">{t("form.unitMonths")}</option>
                            <option value="years">{t("form.unitYears")}</option>
                          </select>
                        </div>
                        <p className="mt-2 text-[10px] leading-4" style={{ color: "var(--text-muted)" }}>{t("form.expiryNote")}</p>
                      </div>
                    </div>
                  </div>
                </div>
              <div className="flex justify-end border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                <button type="submit" disabled={isSubmitting} className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>{isSubmitting ? ts("state.saving") : initialProduct ? t("form.update") : t("form.create")}<Check className="h-4 w-4" /></button>
              </div>
            </form>
        </div>
      </ModalOverlay>

      <CategoryFormModal
        open={showNewCategoryModal}
        onClose={() => setShowNewCategoryModal(false)}
        onCreated={(newCategory) => {
          queryClient.invalidateQueries({ queryKey: ["categories"] });
          if (newCategory?._id) {
            setFormData((p) => ({ ...p, category_id: String(newCategory._id) }));
            toast.success(t("toast.categoryCreatedSelected"));
          }
        }}
      />

      {showNewBrandModal && (
        <ModalOverlay zIndex="z-[60]">
          <div className="w-full max-w-lg overflow-visible rounded-xl shadow-2xl" style={cardStyle}>
            <div className="flex items-center justify-between rounded-t-xl px-5 py-4" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              <h3 className="text-base font-semibold">{t("brand.title")}</h3>
              <button type="button" onClick={() => { setShowNewBrandModal(false); resetBrandForm(); }} disabled={createBrandMutation.isPending} aria-label={ts("action.close")} title={ts("action.close")} className="rounded p-1 transition hover:opacity-70 disabled:opacity-50" style={{ color: "var(--text-muted)" }}><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleBrandSubmit} className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("brand.code")}</label>
                  <div className="relative">
                    <input type="text" value={brandFormData.brand_code} onChange={e => setBrandFormData(p => ({ ...p, brand_code: e.target.value }))} required disabled={createBrandMutation.isPending || loadingBrandCode} className="h-9 w-full rounded-md px-3 text-sm font-mono outline-none disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder={loadingBrandCode ? t("brand.generating") : "BRD-001"} />
                    {loadingBrandCode && <span className="absolute end-2.5 top-1/2 -translate-y-1/2"><div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /></span>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("brand.name")} *</label>
                  <input type="text" value={brandFormData.name} onChange={e => setBrandFormData(p => ({ ...p, name: e.target.value }))} required disabled={createBrandMutation.isPending} className="h-9 w-full rounded-md px-3 text-sm outline-none disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder="Nike" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{ts("label.description")}</label>
                <textarea value={brandFormData.description} onChange={e => setBrandFormData(p => ({ ...p, description: e.target.value }))} rows={2} disabled={createBrandMutation.isPending} className="w-full resize-none rounded-md px-3 py-2 text-sm outline-none disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }} placeholder={t("brand.descriptionPlaceholder")} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("brand.logo")}</label>
                <input ref={brandFileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleBrandLogoChange} disabled={createBrandMutation.isPending} />
                <div onClick={() => !createBrandMutation.isPending && brandFileInputRef.current?.click()} onDrop={handleBrandFileDrop} onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setBrandIsDragging(true); }} onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setBrandIsDragging(false); }} className={`relative w-full h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 ${brandIsDragging ? "border-emerald-500 bg-emerald-500/10" : "border-gray-600 hover:border-emerald-500/50 hover:bg-white/5"}`} style={{ borderColor: brandIsDragging ? undefined : "var(--border-color)" }}>
                  {brandLogoPreview ? (
                    <div className="relative w-full h-full flex items-center justify-center p-2">
                      <img src={brandLogoPreview} alt={t("brand.logoPreviewAlt")} className="max-h-full max-w-full object-contain rounded-md" />
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleBrandRemoveLogo(); }} aria-label={ts("media.remove")} title={ts("media.remove")} className="absolute top-2 end-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition shadow-md"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <>
                      <div className={`p-3 rounded-full ${brandIsDragging ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-gray-400"}`}><Upload className="w-6 h-6" /></div>
                      <div className="text-center">
                        <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{brandIsDragging ? t("brand.dropImage") : t("brand.clickOrDrag")}</p>
                        <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>{t("brand.logoFormats")}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 items-end gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>{t("brand.country")}</label>
                  <BrandCountryDropdown value={brandFormData.country} onChange={(val) => setBrandFormData(p => ({ ...p, country: val }))} disabled={createBrandMutation.isPending} allCountries={allCountries} />
                </div>
                <label className="flex h-9 cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={brandFormData.is_active} onChange={e => setBrandFormData(p => ({ ...p, is_active: e.target.checked }))} disabled={createBrandMutation.isPending} className="h-4 w-4 rounded" style={{ accentColor: "var(--accent)" }} />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{ts("status.active")}</span>
                </label>
              </div>
              <div className="flex gap-2 border-t pt-4" style={{ borderColor: "var(--border-color)" }}>
                <button type="button" onClick={() => { setShowNewBrandModal(false); resetBrandForm(); }} disabled={createBrandMutation.isPending} className="h-9 flex-1 rounded-md text-sm font-medium transition hover:opacity-80 disabled:opacity-50" style={{ backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}>{ts("action.cancel")}</button>
                <button type="submit" disabled={createBrandMutation.isPending || loadingBrandCode} className="h-9 flex-1 rounded-md text-sm font-semibold transition hover:opacity-90 disabled:opacity-50" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}>{createBrandMutation.isPending ? t("brand.creating") : t("brand.createAndSelect")}</button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
