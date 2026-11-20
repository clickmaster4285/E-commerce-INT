"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Store as StoreIcon, Loader2, ImagePlus, Upload, X } from "lucide-react";
import { Modal, Button, IconButton, Alert, TextInput, TextArea, SelectInput, FormSection, Field } from "@/components/superadmin/ui";
import SearchCombobox, { COMBO_THEME_ADMIN } from "@/components/common/SearchCombobox";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { BUSINESS_CATEGORIES, STORE_DESCRIPTION_MAX, DEFAULT_COUNTRY } from "@/lib/storeOptions";
import { compressImage } from "@/utils/compressImage";
import { assetUrl } from "@/lib/superadminFormat";

const STATUS_OPTIONS = [{ value: "open", label: "Open" }, { value: "maintenance", label: "Maintenance" }, { value: "closed", label: "Suspended" }];
const EMPTY_FORM = { store_name: "", email: "", phone: "", description: "", business_category: "", country: DEFAULT_COUNTRY, city: "", address: "", zip_code: "", logo_url: "", store_status: "open" };

// Signup jaisa hi store form — same fields, same rules (identity, description, location, branding)
export default function StoreFormDialog({ store, onClose, onSaved }) {
  const editing = Boolean(store);
  const [form, setForm] = useState(() => {
    if (!editing) return EMPTY_FORM;
    const f = { ...EMPTY_FORM };
    for (const k of Object.keys(EMPTY_FORM)) if (store[k] != null && store[k] !== "") f[k] = store[k];
    f.store_status = store.status || "open"; // list row me status "status" naam se aata hai
    return f;
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [logoBusy, setLogoBusy] = useState(false);
  const [geo, setGeo] = useState(null);

  // Country + city list signup wali library se — dialog khulne par lazy load
  useEffect(() => {
    let alive = true;
    import("country-state-city").then((m) => {
      if (!alive) return;
      setGeo(m);
      // Purane stores me country "PK" (ISO code) saved hai — naam me badal do
      setForm((p) => {
        const byCode = m.Country.getAllCountries().find((c) => c.isoCode === String(p.country).toUpperCase());
        return byCode && byCode.name !== p.country ? { ...p, country: byCode.name } : p;
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const allCountries = useMemo(() => (geo ? geo.Country.getAllCountries() : []), [geo]);
  const countryOptions = useMemo(() => (allCountries.length ? allCountries.map((c) => c.name) : [form.country].filter(Boolean)), [allCountries, form.country]);
  const cityOptions = useMemo(() => {
    if (!geo) return [];
    const match = allCountries.find((c) => c.name === form.country);
    if (!match) return [];
    return [...new Set(geo.City.getCitiesOfCountry(match.isoCode).map((c) => c.name))].sort((a, b) => a.localeCompare(b));
  }, [geo, allCountries, form.country]);
  // Purani free-text category bhi option me rahe
  const categories = form.business_category && !BUSINESS_CATEGORIES.includes(form.business_category) ? [...BUSINESS_CATEGORIES, form.business_category] : BUSINESS_CATEGORIES;

  const mutation = useMutation({
    mutationFn: (payload) => (editing ? superAdminApi.updateStore(store.id, payload) : superAdminApi.createStore(payload)),
    onSuccess: onSaved,
    onError: (e) => setError(e?.response?.data?.message || "Could not save this store."),
  });
  const update = (key, value) => { setForm((c) => ({ ...c, [key]: value })); setErrors((p) => ({ ...p, [key]: "" })); };
  const set = (key) => (e) => update(key, e.target.value);

  const pickLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) { setErrors((p) => ({ ...p, logo_url: "Logo must be a JPG, PNG or WEBP image." })); return; }
    if (file.size > 15 * 1024 * 1024) { setErrors((p) => ({ ...p, logo_url: "Image is too large — please pick one under 15MB." })); return; }
    setLogoBusy(true);
    try { update("logo_url", await compressImage(file, { maxSize: 512, quality: 0.82 })); }
    catch { setErrors((p) => ({ ...p, logo_url: "Logo could not be processed. Please try another image." })); }
    finally { setLogoBusy(false); }
  };

  const submit = (e) => {
    e.preventDefault();
    setError("");
    const next = {};
    if (!form.store_name.trim()) next.store_name = "Please enter the store name.";
    if (!form.business_category) next.business_category = "Please select a business category.";
    if (!form.description.trim()) next.description = "Please describe the store.";
    if (!form.country) next.country = "Please select a country.";
    if (form.city.trim().length < 2) next.city = "Please enter the city.";
    if (form.address.trim().length < 5) next.address = "Please enter a complete store address.";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.phone.trim() && !/^\+?[\d\s-]{7,20}$/.test(form.phone.trim())) next.phone = "Enter a valid phone number.";
    setErrors(next);
    if (Object.keys(next).length) { setError("Please fix the highlighted fields."); return; }
    mutation.mutate({
      ...form,
      store_name: form.store_name.trim(),
      description: form.description.trim(),
      city: form.city.trim(),
      address: form.address.trim(),
      zip_code: form.zip_code.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      // update endpoint subdomain khali milne par hata deta hai — existing wapas bhejo
      ...(editing ? { subdomain: store.subdomain || "", business_type: store.business_type } : {}),
    });
  };

  const logoSrc = form.logo_url ? (form.logo_url.startsWith("data:") ? form.logo_url : assetUrl(form.logo_url)) : "";
  return (
    <Modal
      open
      onClose={onClose}
      as="form"
      onSubmit={submit}
      size="lg"
      icon={StoreIcon}
      title={editing ? `Edit ${store.store_name}` : "Add a new store"}
      description={editing ? "Keep the storefront identity, location and branding up to date." : "The same store details a seller fills in on the signup page."}
      busy={mutation.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" variant="primary" loading={mutation.isPending} disabled={logoBusy}>{editing ? "Save changes" : "Create store"}</Button>
        </>
      }
    >
      <div className="space-y-6 pt-1">
        {error && <Alert tone="danger">{error}</Alert>}

        <FormSection title="Store identity">
          <TextInput label="Store name" required value={form.store_name} onChange={set("store_name")} error={errors.store_name} placeholder="e.g. Ahmed Electronics" autoComplete="organization" autoFocus />
          <div className={`grid grid-cols-1 gap-3.5 ${editing ? "sm:grid-cols-2" : ""}`}>
            <SelectInput label="Business category" value={form.business_category} onChange={set("business_category")} error={errors.business_category}>
              <option value="">Select a category</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
            {editing && (
              <SelectInput label="Store status" value={form.store_status} onChange={set("store_status")}>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </SelectInput>
            )}
          </div>
        </FormSection>

        <FormSection title="Business description">
          <TextArea
            label="What will this store sell?"
            required
            rows={3}
            maxLength={STORE_DESCRIPTION_MAX}
            value={form.description}
            onChange={set("description")}
            error={errors.description}
            hint={`${form.description.length}/${STORE_DESCRIPTION_MAX} characters`}
            placeholder="e.g. Affordable smartphones, accessories and gadgets with nationwide delivery."
          />
        </FormSection>

        <FormSection title="Location">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Field label="Country" required error={errors.country} htmlFor="sa-store-country">
              <div className="relative">
                <SearchCombobox
                  id="sa-store-country"
                  itemLabel="country"
                  value={form.country}
                  onChange={(v) => { setForm((p) => ({ ...p, country: v, city: "" })); setErrors((p) => ({ ...p, country: "", city: "" })); }}
                  options={countryOptions}
                  loading={!geo}
                  allowCustom={false}
                  pinned={[DEFAULT_COUNTRY]}
                  invalid={!!errors.country}
                  inputClassName="sa-input pe-10"
                  theme={COMBO_THEME_ADMIN}
                />
              </div>
            </Field>
            <Field label="City" required error={errors.city} htmlFor="sa-store-city">
              <div className="relative">
                <SearchCombobox
                  id="sa-store-city"
                  itemLabel="city"
                  value={form.city}
                  onChange={(v) => update("city", v)}
                  options={cityOptions}
                  loading={!geo}
                  invalid={!!errors.city}
                  inputClassName="sa-input pe-10"
                  theme={COMBO_THEME_ADMIN}
                />
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_140px]">
            <TextInput label="Street address" required value={form.address} onChange={set("address")} error={errors.address} placeholder="Shop no., street, area" autoComplete="street-address" />
            <TextInput label="ZIP code" value={form.zip_code} onChange={set("zip_code")} inputMode="numeric" maxLength={20} placeholder="54000" hint="Optional" />
          </div>
        </FormSection>

        <FormSection title="Store branding">
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3.5">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoSrc} alt="Store logo preview" className="h-16 w-16 shrink-0 rounded-lg border border-[var(--border-color)] bg-white object-contain" />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)]"><ImagePlus size={20} aria-hidden="true" /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">{logoSrc ? "Store logo" : "No logo yet"}</p>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">JPG, PNG or WEBP · optional, can be added any time</p>
              {errors.logo_url && <p className="mt-1 text-[12px] font-medium text-[var(--danger-text)]">{errors.logo_url}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <label className={`sa-btn sa-btn--secondary sa-btn--sm cursor-pointer ${logoBusy ? "pointer-events-none opacity-60" : ""}`}>
                {logoBusy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                {logoSrc ? "Change" : "Upload logo"}
                <input type="file" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={pickLogo} className="sr-only" disabled={logoBusy} />
              </label>
              {logoSrc && <IconButton icon={X} label="Remove logo" size="sm" onClick={() => update("logo_url", "")} />}
            </div>
          </div>
        </FormSection>

        <FormSection title="Contact">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <TextInput label="Store email" type="email" value={form.email} onChange={set("email")} error={errors.email} placeholder="owner@store.com" />
            <TextInput label="Phone" value={form.phone} onChange={set("phone")} error={errors.phone} inputMode="tel" placeholder="03001234567" />
          </div>
        </FormSection>
      </div>
    </Modal>
  );
}

