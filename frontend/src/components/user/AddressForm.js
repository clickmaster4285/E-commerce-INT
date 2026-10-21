"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Country, State, City } from "country-state-city";
import { addressApi } from "@/apis/user/addressApi";
import { useCurrentLocation } from "../../hooks/user/useCurrentLocation";
import { MapPin, ChevronDown, Loader2, Check, X } from "lucide-react";
import { userHttp } from "@/apis/axiosInstance"
import { isValidPhone, normalizePhone, PHONE_MAX, PHONE_MIN } from "@/utils/phoneValidator";
import { useTranslation } from "@/i18n/LanguageProvider";
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

export default function AddressForm({ initialAddress, onSuccess, onCancel }) {
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
  const [detectedCountry, setDetectedCountry] = useState("");
  const [pendingCityCandidates, setPendingCityCandidates] = useState(null);

  useEffect(() => {
    if (!initialAddress) {
      fetch("https://ipapi.co/country_name/")
        .then((r) => r.text())
        .then((name) => {
          if (name) setDetectedCountry(name.trim());
        })
        .catch(() => {});
    }
  }, [initialAddress]);

  useEffect(() => {
    if (!initialAddress && detectedCountry && !form.country) {
      setForm((f) => ({ ...f, country: detectedCountry }));
    }
  }, [detectedCountry, initialAddress, form.country]);

  useEffect(() => {
    if (!initialAddress && user) {
      setForm((f) => ({
        ...f,
        full_name: f.full_name || user.name || "",
        phone: f.phone || normalizePhone(user.phone || ""),
      }));
    }
  }, [user, initialAddress]);

  const allCountries = useMemo(() => Country.getAllCountries(), []);
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
    setForm((f) => ({ ...f, state: "", city: "" }));
    setPendingCityCandidates(null);
  }, [form.country]);

  useEffect(() => {
    setForm((f) => ({ ...f, city: "" }));
    if (!locationFillingRef.current) setPendingCityCandidates(null);
  }, [form.state]);

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
        setForm((f) => ({ ...f, city: found.name }));
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
    if (!f.phone) return toast.error(t("checkout.phone.required"));
    if (!isValidPhone(f.phone)) {
      return toast.error(
        f.phone.length < PHONE_MIN
          ? t("checkout.phone.minDigits", { min: PHONE_MIN })
          : t("checkout.phone.maxDigits", { max: PHONE_MAX }),
      );
    }
    if (
      !f.country ||
      !f.full_name.trim() ||
      !f.street_address1.trim() ||
      !f.state.trim() ||
      !f.city.trim()
    ) {
      return toast.error(t("checkout.address.requiredFields"));
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
    "w-full h-12 px-4 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--user-accent)]/30 focus:border-[var(--user-accent)] bg-[var(--user-bg-input)] border-2 border-[var(--user-border)] text-[var(--user-text)] placeholder:text-[var(--user-text-subtle)] hover:border-[var(--user-accent)]/40";
  const labelCls =
    "block text-xs font-bold text-[var(--user-text-secondary)] mb-2 uppercase tracking-wider";
  const textareaCls =
    "w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 focus:ring-2 focus:ring-[var(--user-accent)]/30 focus:border-[var(--user-accent)] bg-[var(--user-bg-input)] border-2 border-[var(--user-border)] text-[var(--user-text)] resize-none hover:border-[var(--user-accent)]/40";
  const accentBtn =
    "bg-[var(--user-accent)] text-[var(--user-accent-text)] hover:opacity-90 active:scale-[0.98] transition";
  const ghostBtn =
    "border-2 border-[var(--user-border)] text-[var(--user-text-secondary)] hover:text-[var(--user-text)] hover:border-[var(--user-accent)]/40 transition";

  return (
    <>
      <style>{`
        @keyframes modalUp { from { opacity: 0; transform: translateY(30px) scale(.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      <div
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4"
        onClick={onCancel}
        style={{ animation: "fadeIn 0.2s ease-out" }}
      >
        <div
          className="w-full sm:max-w-lg max-h-[92vh] sm:max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[var(--user-bg-elevated)] border-t-2 sm:border-2 border-[var(--user-border)] shadow-2xl"
          style={{ animation: "modalUp .3s ease-out" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b-2 border-[var(--user-border)] bg-[var(--user-bg-elevated)]/95 backdrop-blur-sm">
            <h3 className="text-sm font-black text-[var(--user-text)]">
              {initialAddress ? t("checkout.address.editTitle") : t("checkout.address.addTitle")}
            </h3>
            <button
              onClick={onCancel}
              className="p-2 rounded-xl border-2 border-[var(--user-border)] text-[var(--user-text-muted)] hover:text-[var(--user-text)] hover:bg-[var(--user-bg-hover)] transition"
            >
              <X size={16} />
            </button>
          </div>
          <div className="p-5 sm:p-6 space-y-4">
            <button
              type="button"
              onClick={fillLocationFromCurrent}
              disabled={locLoading}
              className="w-full h-10 rounded-xl border-2 border-[var(--user-border)] text-sm font-bold text-[var(--user-text-secondary)] hover:text-[var(--user-accent)] hover:border-[var(--user-accent)]/40 hover:bg-[var(--user-accent)]/5 transition flex items-center justify-center gap-2 disabled:opacity-60"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t("checkout.address.fullName")}</label>
                <input
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                  placeholder={t("checkout.address.fullNamePlaceholder")}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{t("checkout.phone.label")}</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  maxLength={PHONE_MAX}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, PHONE_MAX);
                    setForm({ ...form, phone: val });
                  }}
                  placeholder={t("checkout.phone.placeholder")}
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-[var(--user-text-muted)]">{t("checkout.phone.digitCount", { current: form.phone.length, max: PHONE_MAX })}</p>
              </div>
            </div>
            <div>
              <label className={labelCls}>{t("checkout.address.countryRegion")}</label>
              <div className="relative">
                <select
                  value={form.country}
                  onChange={(e) =>
                    setForm({ ...form, country: e.target.value })
                  }
                  className={
                    inputCls + " appearance-none pr-10 cursor-pointer"
                  }
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
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>{t("checkout.address.state")}</label>
                <div className="relative">
                  <select
                    value={form.state}
                    onChange={(e) =>
                      setForm({ ...form, state: e.target.value })
                    }
                    disabled={!form.country}
                    className={
                      inputCls +
                      " appearance-none pr-10 cursor-pointer disabled:opacity-50"
                    }
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t("checkout.address.city")}</label>
                <div className="relative">
                  <select
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
                    disabled={!form.state}
                    className={
                      inputCls +
                      " appearance-none pr-10 cursor-pointer disabled:opacity-50"
                    }
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
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--user-text-muted)] pointer-events-none"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>{t("checkout.address.zipCode")}</label>
                <input
                  value={form.zip_code}
                  onChange={(e) =>
                    setForm({ ...form, zip_code: e.target.value })
                  }
                  placeholder={t("checkout.address.zipPlaceholder")}
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t("checkout.address.streetAddress")}</label>
              <textarea
                value={form.street_address1}
                onChange={(e) =>
                  setForm({ ...form, street_address1: e.target.value })
                }
                rows="2"
                placeholder={t("checkout.address.streetPlaceholder")}
                className={textareaCls}
              />
            </div>
            <div>
              <label className={labelCls}>
                {t("checkout.address.deliveryInstructions")}
              </label>
              <textarea
                value={form.delivery_instructions}
                onChange={(e) =>
                  setForm({
                    ...form,
                    delivery_instructions: e.target.value,
                  })
                }
                rows="2"
                placeholder={t("checkout.address.instructionsPlaceholder")}
                className={textareaCls}
              />
            </div>
            <label className="flex items-center gap-3 p-3 rounded-xl bg-[var(--user-bg-hover)] border-2 border-[var(--user-border)] cursor-pointer hover:border-[var(--user-accent)]/40 transition">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) =>
                  setForm({ ...form, is_default: e.target.checked })
                }
                className="w-4 h-4 rounded"
                style={{ accentColor: "var(--user-accent)" }}
              />
              <span className="text-sm font-semibold text-[var(--user-text)]">
                {t("checkout.address.makeDefault")}
              </span>
            </label>
            <div className="pt-4 flex items-center justify-between gap-3 border-t-2 border-[var(--user-border)]">
              <button
                onClick={onCancel}
                className={`h-12 px-6 rounded-xl text-sm font-bold ${ghostBtn}`}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className={`h-12 px-8 rounded-xl text-sm font-black flex items-center gap-2 disabled:opacity-50 ${accentBtn}`}
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
