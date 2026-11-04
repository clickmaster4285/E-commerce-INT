"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Country, State, City } from "country-state-city";
import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { addressApi } from "@/apis/user/addressApi";
import { useCurrentLocation } from "../../hooks/user/useCurrentLocation";
import { MapPin, ChevronDown, Loader2, Check, X } from "lucide-react";
import { userHttp } from "@/apis/axiosInstance";
import { normalizePhone, PHONE_MAX } from "@/utils/phoneValidator";
import { useTranslation } from "@/i18n/LanguageProvider";
const ALL_COUNTRIES = Country.getAllCountries();
const normalizeStateName = (s) => {
  if (!s) return "";
  return s
    .trim()
    .toLowerCase()
    .replace(
      /[\s,.'-]*(province|territory|capital territory|division|region|state)$/i,
      "",
    )
    .trim();
};
const normalizeCityName = (c) => {
  if (!c) return "";
  return c
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[\s,.'-]*(city|district|tehsil)$/i, "")
    .trim();
};
const POSTAL_CODE_REQUIRED_COUNTRIES = new Set([
  "AR", "AT", "AU", "BD", "BE", "BR", "CA", "CH", "CL", "CN", "CO", "CZ", "DE", "DK", "EG", "ES", "FI", "FR", "GB", "GR", "HU", "ID", "IE", "IL", "IN", "IT", "JP", "KR", "MX", "MY", "NG", "NL", "NO", "NZ", "PH", "PK", "PL", "PT", "RO", "SA", "SE", "SG", "TH", "TR", "UA", "US", "VN", "ZA",
]);

export default function AddressForm({ initialAddress, onSuccess, onCancel, inline = false, fresh = false }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { loading: locLoading, fetchLocation } = useCurrentLocation();
  const locationFillingRef = useRef(false);
  const { data: user } = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const res = await userHttp.get("/users/profile");
      return res.data?.user || res.data;
    },
    retry: false,
    staleTime: 60_000,
  });

  const [form, setForm] = useState(() => {
    if (initialAddress) {
      return {
        country: initialAddress.country || "",
        full_name: initialAddress.full_name || "",
        street_address1: initialAddress.street_address1 || "",
        street_address2: initialAddress.street_address2 || "",
        city: initialAddress.city || "",
        state: initialAddress.state || "",
        zip_code: initialAddress.zip_code || "",
        phone: normalizePhone(initialAddress.phone || ""),
        is_default: !!initialAddress.is_default,
        delivery_instructions: initialAddress.delivery_instructions || "",
      };
    }
    return {
      country: "",
      full_name: "",
      street_address1: "",
      street_address2: "",
      city: "",
      state: "",
      zip_code: "",
      phone: "",
      is_default: true,
      delivery_instructions: "",
    };
  });

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [detectedCountry, setDetectedCountry] = useState("");
  const [pendingCityCandidates, setPendingCityCandidates] = useState(null);
  const fieldRefs = useRef({});

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const valid = field === "phone" ? isPhoneValidForCountry(value, form.country) : Boolean(String(value).trim());
      if (!valid) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  useEffect(() => {
    if (!initialAddress && !fresh) {
      fetch("https://ipapi.co/country_name/")
        .then((r) => r.text())
        .then((name) => { if (name) setDetectedCountry(name.trim()); })
        .catch(() => {});
    }
  }, [initialAddress, fresh]);

  useEffect(() => {
    if (!initialAddress && !fresh && detectedCountry && !form.country) {
      setForm((current) => ({ ...current, country: detectedCountry }));
    }
  }, [detectedCountry, initialAddress, fresh, form.country]);

  useEffect(() => {
    if (!initialAddress && !fresh && user) {
      setForm((current) => ({
        ...current,
        full_name: current.full_name || user.name || "",
        phone: current.phone || normalizePhone(user.phone || ""),
      }));
    }
  }, [user, initialAddress, fresh]);

  const allCountries = ALL_COUNTRIES;
  const isPhoneValidForCountry = (value, countryName) => {
    const country = allCountries.find((item) => item.name === countryName);
    if (!country || !value) return false;
    const digits = normalizePhone(value);
    const nationalNumber = parsePhoneNumberFromString(digits, country.isoCode);
    if (nationalNumber?.isValid()) return true;
    if (digits.startsWith(country.phonecode)) {
      return !!parsePhoneNumberFromString(`+${digits}`)?.isValid();
    }
    return false;
  };
  const allStates = useMemo(() => {
    const c = allCountries.find((x) => x.name === form.country);
    return c ? State.getStatesOfCountry(c.isoCode) : [];
  }, [allCountries, form.country]);
  const allCities = useMemo(() => {
    const c = allCountries.find((x) => x.name === form.country);
    const s = allStates.find((x) => x.name === form.state);
    return c && s ? City.getCitiesOfState(c.isoCode, s.isoCode) : [];
  }, [allCountries, allStates, form.country, form.state]);

  useEffect(() => {
    if (!pendingCityCandidates?.length || !allCities.length) return;
    for (const candidate of pendingCityCandidates) {
      const want = normalizeCityName(candidate);
      if (!want) continue;
      let found = allCities.find((c) => normalizeCityName(c.name) === want);
      if (!found)
        found = allCities.find((c) => {
          const n = normalizeCityName(c.name);
          return n.startsWith(want) || want.startsWith(n);
        });
      if (!found)
        found = allCities.find((c) => {
          const n = normalizeCityName(c.name);
          return n.includes(want) || want.includes(n);
        });
      if (found) {
        updateField("city", found.name);
        setPendingCityCandidates(null);
        toast(`📍 ${t("checkout.address.locationFilled")}`);
        return;
      }
    }
    setPendingCityCandidates(null);
    toast(`⚠️ ${t("checkout.address.locationPartial")}`);
  }, [allCities, pendingCityCandidates, t]);

  const fillLocationFromCurrent = async () => {
    const res = await fetchLocation();
    if (!res?.ok) {
      const r = res?.reason;
      const msg =
        r === "insecure"
          ? `⚠️ ${t("checkout.address.locationNotFound")}`
          : r === "denied"
            ? `⚠️ ${t("checkout.address.locationDenied")}`
            : `⚠️ ${t("checkout.address.locationUnavailable")}`;
      toast(msg);
      return;
    }
    const loc = res.data;

    let countryName = "";
    if (loc.countryName) {
      const want = loc.countryName.trim().toLowerCase();
      const cMatch = allCountries.find(
        (c) => c.name.trim().toLowerCase() === want,
      );
      if (cMatch) countryName = cMatch.name;
      else {
        const cPartial = allCountries.find(
          (c) =>
            c.name.trim().toLowerCase().includes(want) ||
            want.includes(c.name.trim().toLowerCase()),
        );
        if (cPartial) countryName = cPartial.name;
      }
    }

    let matchedState = "";
    if (loc.stateName && countryName) {
      const cObj = allCountries.find((c) => c.name === countryName);
      const states = cObj ? State.getStatesOfCountry(cObj.isoCode) : [];
      const want = normalizeStateName(loc.stateName);
      let sMatch = states.find((s) => normalizeStateName(s.name) === want);
      if (!sMatch)
        sMatch = states.find((s) => {
          const n = normalizeStateName(s.name);
          return n.startsWith(want) || want.startsWith(n);
        });
      if (!sMatch)
        sMatch = states.find((s) => {
          const n = normalizeStateName(s.name);
          return n.includes(want) || want.includes(n);
        });
      if (sMatch) matchedState = sMatch.name;
    }

    const street = loc.street || "";
    const postal = loc.postal || "";

    locationFillingRef.current = true;

    setForm((f) => ({
      ...f,
      country: countryName || f.country,
      state: matchedState || f.state,
      zip_code: postal || f.zip_code,
      street_address1: street || f.street_address1,
    }));
    setErrors((current) => {
      const next = { ...current };
      if (countryName) delete next.country;
      if (matchedState) delete next.state;
      if (postal) delete next.zip_code;
      if (street) delete next.street_address1;
      return next;
    });

    if (loc.cityCandidates?.length && countryName && matchedState) {
      setPendingCityCandidates(loc.cityCandidates);
    } else {
      const filled = matchedState || postal || street;
      toast(
        filled
          ? `⚠️ ${t("checkout.address.locationPartial")}`
          : `⚠️ ${t("checkout.address.locationUnavailable")}`,
      );
    }

    setTimeout(() => {
      locationFillingRef.current = false;
    }, 0);
  };

  const handleSave = async () => {
    const f = form;
    const nextErrors = {};
    const required = [
      ["full_name", f.full_name],
      ["phone", f.phone],
      ["country", f.country],
      ["state", f.state],
      ["city", f.city],
      ["street_address1", f.street_address1],
    ];
    const selectedCountry = allCountries.find((country) => country.name === f.country);
    if (selectedCountry && POSTAL_CODE_REQUIRED_COUNTRIES.has(selectedCountry.isoCode)) {
      required.push(["zip_code", f.zip_code]);
    }
    required.forEach(([field, value]) => {
      if (!String(value || "").trim()) {
        nextErrors[field] = field === "phone" ? t("checkout.phone.required") : t("checkout.address.requiredFields");
      }
    });
    if (f.phone && !isPhoneValidForCountry(f.phone, f.country)) {
      nextErrors.phone = t("admin.shared.validation.invalidPhone");
    }
    setErrors(nextErrors);
    const firstInvalid = required.find(([field]) => nextErrors[field])?.[0];
    if (firstInvalid) {
      fieldRefs.current[firstInvalid]?.focus?.({ preventScroll: true });
      fieldRefs.current[firstInvalid]?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    try {
      let result;
      if (initialAddress) {
        result = await addressApi.update(initialAddress._id, f);
        toast.success(t("checkout.address.updated"));
      } else {
        result = await addressApi.create(f);
        toast.success(t("checkout.address.saved"));
      }
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      onSuccess(result);
    } catch (e) {
      toast.error(e.response?.data?.message || t("checkout.address.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    `w-full ${inline ? "h-11 px-3.5 text-sm" : "h-12 px-4 text-sm"} rounded-lg outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--user-accent)]/20 focus:border-[var(--user-accent)] bg-[var(--user-bg-input)] border border-[var(--user-border)] text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] hover:border-[var(--user-accent)]/40`;
  const labelCls =
    `block text-xs font-semibold leading-snug text-start text-[var(--user-text-secondary)] ${inline ? "mb-1" : "mb-2"}`;
  const textareaCls =
    `w-full ${inline ? "px-3.5 py-2.5 text-sm" : "px-4 py-3 text-sm"} rounded-lg outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--user-accent)]/20 focus:border-[var(--user-accent)] bg-[var(--user-bg-input)] border border-[var(--user-border)] text-[var(--user-text)] resize-none hover:border-[var(--user-accent)]/40`;
  const accentBtn = "primary-btn";
  const ghostBtn =
    "border border-[var(--user-border)] text-[var(--user-text-secondary)] hover:text-[var(--user-text)] hover:border-[var(--user-accent)]/40 transition";
  const fieldInputCls = (field) =>
    `${inputCls} ${errors[field] ? "!border-red-500 focus:!border-red-500 focus:ring-red-500/20" : ""}`;
  const renderFieldError = (field) => errors[field] ? (
    <p role="alert" className="mt-1 text-xs text-red-600">{errors[field]}</p>
  ) : null;

  return (
    <>
      <style>{`
        @keyframes modalUp { from { opacity: 0; transform: translateY(30px) scale(.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <div
        className={inline ? "w-full min-w-0" : "fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"}
        onClick={inline ? undefined : onCancel}
        style={inline ? undefined : { animation: "fadeIn 0.2s ease-out" }}
      >
        <div
          className={inline
            ? "w-full rounded-xl bg-[var(--user-bg-card)] border border-[var(--user-border)] shadow-sm"
            : "w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[var(--user-bg-elevated)] border-t-2 sm:border-2 border-[var(--user-border)] shadow-2xl"}
          style={inline ? undefined : { animation: "modalUp .3s ease-out" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={inline
            ? "flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--user-border)]"
            : "sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b-2 border-[var(--user-border)] bg-[var(--user-bg-elevated)]/95 backdrop-blur-sm"}>
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--user-accent)]/20 bg-[var(--user-accent)]/5 text-[var(--user-accent)]">
                <MapPin size={17} />
              </span>
              <h3 className="text-sm font-bold text-[var(--user-text)]">
                {initialAddress ? t("checkout.address.editTitle") : t("checkout.address.addTitle")}
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label={t("common.cancel")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--user-border)] p-0 text-[var(--user-text-muted)] hover:text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition"
            >
              <X size={16} />
            </button>
          </div>
          <div className={inline ? "space-y-3.5 p-4 sm:p-5" : "p-5 sm:p-6 space-y-4"}>
            <button
              type="button"
              onClick={fillLocationFromCurrent}
              disabled={locLoading}
              className={`address-form-location w-full h-10 text-sm rounded-lg border border-[var(--user-accent)]/20 bg-[var(--user-accent)]/5 font-semibold text-[var(--user-accent)] hover:border-[var(--user-accent)]/40 hover:bg-[var(--user-accent)]/10 transition flex items-center justify-center gap-2 disabled:opacity-60`}
            >
              {locLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> {t("checkout.address.locating")}
                </>
              ) : (
                <>
                  <MapPin size={14} /> {t("checkout.address.useCurrentLocation")}
                </>
              )}
            </button>
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${inline ? "gap-3" : "gap-4"}`}>
              <div>
                <label className={labelCls}>{t("checkout.address.fullName")}</label>
                <input
                  ref={(node) => { fieldRefs.current.full_name = node; }}
                  value={form.full_name}
                  onChange={(e) => updateField("full_name", e.target.value)}
                  placeholder={t("checkout.address.fullNamePlaceholder")}
                  className={fieldInputCls("full_name")}
                />
                {renderFieldError("full_name")}
              </div>
              <div>
                <label className={labelCls}>{t("checkout.phone.label")}</label>
                <input
                  ref={(node) => { fieldRefs.current.phone = node; }}
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  maxLength={PHONE_MAX}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, PHONE_MAX);
                    updateField("phone", val);
                  }}
                  placeholder={t("checkout.phone.placeholder")}
                  className={fieldInputCls("phone")}
                />
                <p className="mt-1 text-xs text-[var(--user-text-muted)]">{t("checkout.phone.digitCount", { current: form.phone.length, max: PHONE_MAX })}</p>
                {renderFieldError("phone")}
              </div>
            </div>
            <div>
              <label className={labelCls}>{t("checkout.address.countryRegion")}</label>
              <div className="relative">
                <select
                  ref={(node) => { fieldRefs.current.country = node; }}
                  value={form.country}
                  onChange={(e) => {
                    const country = e.target.value;
                    updateField("country", country);
                    setForm((current) => ({ ...current, country, state: "", city: "" }));
                    setPendingCityCandidates(null);
                    setErrors((current) => {
                      const next = { ...current };
                      if (form.phone) {
                        if (isPhoneValidForCountry(form.phone, country)) delete next.phone;
                        else next.phone = t("admin.shared.validation.invalidPhone");
                      }
                      return next;
                    });
                  }}
                  className={`${fieldInputCls("country")} appearance-none pr-10 cursor-pointer`}
                >
                  <option value="">{t("checkout.address.selectCountry")}</option>
                  {allCountries.map((c) => (
                    <option key={c.isoCode} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute end-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none"
                />
              </div>
              {renderFieldError("country")}
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-2 ${inline ? "gap-3" : "md:grid-cols-3 gap-4"}`}>
              <div>
                <label className={labelCls}>{t("checkout.address.state")}</label>
                <div className="relative">
                  <select
                    ref={(node) => { fieldRefs.current.state = node; }}
                    value={form.state}
                    onChange={(e) => {
                      updateField("state", e.target.value);
                      setForm((current) => ({ ...current, state: e.target.value, city: "" }));
                    }}
                    disabled={!form.country}
                    className={`${fieldInputCls("state")} appearance-none pr-10 cursor-pointer disabled:opacity-50`}
                  >
                    <option value="">{t("checkout.address.select")}</option>
                    {allStates.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute end-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none"
                  />
                </div>
                {renderFieldError("state")}
              </div>
              <div>
                <label className={labelCls}>{t("checkout.address.city")}</label>
                <div className="relative">
                  <select
                    ref={(node) => { fieldRefs.current.city = node; }}
                    value={form.city}
                    onChange={(e) => updateField("city", e.target.value)}
                    disabled={!form.state}
                    className={`${fieldInputCls("city")} appearance-none pr-10 cursor-pointer disabled:opacity-50`}
                  >
                    <option value="">{t("checkout.address.select")}</option>
                    {allCities.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute end-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none"
                  />
                </div>
                {renderFieldError("city")}
              </div>
            </div>
            <div className={`grid grid-cols-1 sm:grid-cols-3 ${inline ? "gap-3" : "gap-4"}`}>
              <div>
                <label className={labelCls}>{t("checkout.address.zipCode")}</label>
                <input
                  ref={(node) => { fieldRefs.current.zip_code = node; }}
                  value={form.zip_code}
                  onChange={(e) => updateField("zip_code", e.target.value)}
                  placeholder={t("checkout.address.zipPlaceholder")}
                  className={fieldInputCls("zip_code")}
                />
                {renderFieldError("zip_code")}
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>{t("checkout.address.streetAddress")}</label>
                <textarea
                  ref={(node) => { fieldRefs.current.street_address1 = node; }}
                  value={form.street_address1}
                  onChange={(e) => updateField("street_address1", e.target.value)}
                  rows="2"
                  placeholder={t("checkout.address.streetPlaceholder")}
                  className={`${textareaCls} ${errors.street_address1 ? "!border-red-500 focus:!border-red-500 focus:ring-red-500/20" : ""}`}
                />
                {renderFieldError("street_address1")}
              </div>
            </div>
            <div>
              <label className={labelCls}>
                {t("checkout.address.deliveryInstructions")}
              </label>
              <textarea
                value={form.delivery_instructions}
                onChange={(e) => updateField("delivery_instructions", e.target.value)}
                rows="2"
                placeholder={t("checkout.address.instructionsPlaceholder")}
                className={textareaCls}
              />
            </div>
            <label className={`flex min-h-10 items-center gap-2.5 ${inline ? "px-1" : "p-2.5"} rounded-lg ${inline ? "" : "border border-[var(--user-border)]"} cursor-pointer transition`}>
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) =>
                  setForm({ ...form, is_default: e.target.checked })
                }
                className="h-4 w-4 rounded accent-[var(--user-accent)]"
                style={{ accentColor: "var(--user-accent)" }}
              />
              <span className={`${inline ? "text-xs" : "text-sm"} font-semibold text-[var(--user-text)]`}>
                {t("checkout.address.makeDefault")}
              </span>
            </label>
            <div className={`${inline ? "pt-3" : "pt-4"} flex items-center justify-end gap-2 border-t border-[var(--user-border)]`}>
              <button
                onClick={onCancel}
                className={`${inline ? "h-10" : "h-12"} w-24 justify-center rounded-lg text-sm font-semibold ${ghostBtn}`}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`${inline ? "h-10" : "h-12"} flex w-24 items-center justify-center gap-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${accentBtn}`}
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {initialAddress ? t("checkout.address.update") : t("checkout.address.save")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
