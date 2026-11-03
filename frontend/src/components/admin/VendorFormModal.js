"use client";

import { useMemo } from "react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { Country, State, City } from "country-state-city";
import { Building2, Landmark, MapPin, Phone, Star, X } from "lucide-react";

export const emptyVendorForm = {
  name: "", company_name: "", contact_person: "", email: "", phone: "", whatsapp: "",
  address: "", city: "", state: "", country: "", zip_code: "",
  tax_id: "", lead_time_days: 0, rating: 0, is_active: true,
  bank_bank: "", bank_account_title: "", bank_account_no: "",
};

export const toVendorForm = (vendor) => ({
  ...emptyVendorForm,
  ...Object.fromEntries(Object.entries(vendor || {}).filter(([key]) => key in emptyVendorForm)),
  bank_bank: vendor?.bank_details?.bank || "",
  bank_account_title: vendor?.bank_details?.account_title || "",
  bank_account_no: vendor?.bank_details?.account_no || "",
});

export const toVendorPayload = (form) => ({
  name: form.name, company_name: form.company_name, contact_person: form.contact_person,
  email: form.email, phone: form.phone, whatsapp: form.whatsapp, address: form.address, city: form.city,
  state: form.state, country: form.country, zip_code: form.zip_code,
  tax_id: form.tax_id, lead_time_days: Math.max(0, Number(form.lead_time_days) || 0),
  rating: Math.min(5, Math.max(0, Number(form.rating) || 0)), is_active: !!form.is_active,
  bank_details: { bank: form.bank_bank, account_title: form.bank_account_title, account_no: form.bank_account_no },
});

const cardStyle = { border: "1px solid var(--border-color)", background: "var(--bg-card)", boxShadow: "var(--shadow-md)" };
const inputStyle = { backgroundColor: "var(--bg-input)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
const accentBtn = { background: "var(--accent)", color: "var(--accent-text)" };
const phoneValue = (value) => {
  const digits = value.replace(/\D/g, "").slice(0, 15);
  return value.trimStart().startsWith("+") ? `+${digits}` : digits;
};

export default function VendorFormModal({ open, form, setForm, editing = false, isPending = false, onSave, onClose }) {
  const { t } = useTranslation();
  const countries = useMemo(() => Country.getAllCountries(), []);
  const countryCode = countries.find((country) => country.name === form.country)?.isoCode || "";
  const states = useMemo(() => countryCode ? State.getStatesOfCountry(countryCode) : [], [countryCode]);
  const stateCode = states.find((state) => state.name === form.state)?.isoCode || "";
  const cities = useMemo(() => countryCode && stateCode ? City.getCitiesOfState(countryCode, stateCode).map((city) => city.name) : [], [countryCode, stateCode]);
  const stateOptions = useMemo(() => {
    const names = states.map((state) => state.name);
    return form.state && !names.includes(form.state) ? [form.state, ...names] : names;
  }, [states, form.state]);
  const cityOptions = useMemo(() => form.city && !cities.includes(form.city) ? [form.city, ...cities] : cities, [cities, form.city]);

  if (!open) return null;
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const textField = (label, key, className = "") => (
    <div className={className} key={key}>
      <label className="mb-1.5 block text-xs font-semibold" style={{ color: "#475569" }}>{label}</label>
      <input value={form[key]} onChange={(event) => update(key, event.target.value)} className="h-10 w-full rounded-xl px-3.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" style={inputStyle} />
    </div>
  );
  const sectionTitle = (Icon, title, description) => (
    <div className="mb-3 flex items-start gap-2.5">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><Icon size={16} /></div>
      <div><h4 className="text-[13px] font-bold text-slate-800">{title}</h4><p className="mt-0.5 text-[11px] text-slate-500">{description}</p></div>
    </div>
  );
  const selectClass = "h-10 w-full rounded-xl px-3.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl" style={cardStyle} onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--border-color)", background: "var(--bg-tertiary)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md" style={{ background: "var(--accent)" }}><Building2 size={18} color="var(--accent-text)" /></div>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold tracking-tight text-slate-900">{t(editing ? "admin.vendors.form.editTitle" : "admin.vendors.form.addTitle")}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{t("admin.vendors.form.description")}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("admin.vendors.form.closeForm")} className="ml-3 rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-800"><X size={17} /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
          <section className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "#e5edf7" }}>
            {sectionTitle(Phone, t("admin.vendors.form.contactInformation"), t("admin.vendors.form.contactInformationDescription"))}
            <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
              {textField(`${t("admin.vendors.form.vendorName")} *`, "name", "sm:col-span-2")}
              {textField(t("admin.vendors.form.companyName"), "company_name")}
              {textField(t("admin.vendors.form.contactPerson"), "contact_person")}
              {textField(t("admin.vendors.form.email"), "email")}
            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: "#475569" }}>{t("admin.vendors.form.phone")}</label>
              <input type="tel" inputMode="tel" maxLength={16} value={form.phone} onChange={(event) => update("phone", phoneValue(event.target.value))} className="h-10 w-full rounded-xl px-3.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" style={inputStyle} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: "#475569" }}>{t("admin.vendors.form.whatsApp")}</label>
              <input type="tel" inputMode="tel" maxLength={16} value={form.whatsapp} onChange={(event) => update("whatsapp", phoneValue(event.target.value))} className="h-10 w-full rounded-xl px-3.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" style={inputStyle} />
            </div>
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "#e5edf7" }}>
            {sectionTitle(MapPin, t("admin.vendors.form.location"), t("admin.vendors.form.locationDescription"))}
            <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
              <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: "#475569" }}>{t("admin.vendors.form.country")}</label>
              <select value={form.country} onChange={(event) => setForm((current) => ({ ...current, country: event.target.value, state: "", city: "" }))} className={selectClass} style={inputStyle}>
                <option value="">{t("admin.vendors.form.selectCountry")}</option>
                {countries.map((country) => <option key={country.isoCode} value={country.name}>{country.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: "#475569" }}>{t("admin.vendors.form.state")}</label>
              <select value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value, city: "" }))} disabled={!countryCode} className={selectClass} style={inputStyle}>
                <option value="">{countryCode ? t("admin.vendors.form.selectState") : t("admin.vendors.form.selectCountryFirst")}</option>
                {stateOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold" style={{ color: "#475569" }}>{t("admin.vendors.form.city")}</label>
              <select value={form.city} onChange={(event) => update("city", event.target.value)} disabled={!stateCode} className={selectClass} style={inputStyle}>
                <option value="">{stateCode ? t("admin.vendors.form.selectCity") : t("admin.vendors.form.selectStateFirst")}</option>
                {cityOptions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            {textField(t("admin.vendors.form.zipCode"), "zip_code")}
            {textField(t("admin.vendors.form.address"), "address", "sm:col-span-2")}
            </div>
          </section>
          <section className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "#e5edf7" }}>
            {sectionTitle(Landmark, t("admin.vendors.form.businessDetails"), t("admin.vendors.form.businessDetailsDescription"))}
            <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
              {textField(t("admin.vendors.form.taxId"), "tax_id")}
              <div><label className="mb-1.5 block text-xs font-semibold" style={{ color: "#475569" }}>{t("admin.vendors.form.leadTime")}</label><input type="number" min={0} max={30} value={form.lead_time_days} onChange={(event) => { const value = event.target.value; update("lead_time_days", value === "" ? "" : Math.min(30, Math.max(0, Number(value) || 0))); }} className="h-10 w-full rounded-xl px-3.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" style={inputStyle} /></div>
              <div><label className="mb-1.5 block text-xs font-semibold" style={{ color: "#475569" }}>{t("admin.vendors.form.rating")}</label><div className="relative"><Star size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#f59e0b" }} /><input type="number" min={0} max={5} step={0.5} value={form.rating} onChange={(event) => { const value = event.target.value; update("rating", value === "" ? "" : Math.min(5, Math.max(0, Number(value) || 0))); }} className="h-10 w-full rounded-xl pl-9 pr-3.5 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100" style={inputStyle} /></div></div>
              {textField(t("admin.vendors.form.bank"), "bank_bank")}
              {textField(t("admin.vendors.form.accountTitle"), "bank_account_title")}
              {textField(t("admin.vendors.form.accountNo"), "bank_account_no")}
            </div>
            <label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border p-3.5 transition hover:border-blue-200 hover:bg-blue-50/40" style={{ borderColor: "#e5edf7" }}>
              <span><span className="block text-sm font-semibold text-slate-800">{t("admin.vendors.form.active")}</span><span className="mt-0.5 block text-xs text-slate-500">{t("admin.vendors.form.activeHelp")}</span></span>
              <input type="checkbox" checked={!!form.is_active} onChange={(event) => update("is_active", event.target.checked)} className="h-4 w-4 cursor-pointer" style={{ accentColor: "var(--accent)" }} />
            </label>
          </section>
        </div>
        <div className="flex items-center justify-between gap-3 border-t px-5 py-3.5 sm:px-6" style={{ borderColor: "var(--border-color)", background: "var(--bg-card)" }}>
          <p className="hidden text-xs text-slate-500 sm:block"><span className="text-rose-500">*</span> {t("admin.vendors.form.requiredField")}</p>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={onClose} className="h-10 rounded-xl border px-4 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50" style={{ borderColor: "var(--border-color)" }}>{t("admin.vendors.form.cancel")}</button>
            <button type="button" disabled={isPending || !form.name.trim()} onClick={onSave} className="h-10 rounded-xl px-5 text-[13px] font-bold transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" style={accentBtn}>{isPending ? t("admin.vendors.form.saving") : t("admin.vendors.form.save")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
