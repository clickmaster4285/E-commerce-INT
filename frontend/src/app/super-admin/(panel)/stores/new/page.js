"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserRound, Store as StoreIcon, MapPin, Globe, Link2, CheckCircle2, Loader2, ExternalLink, LayoutDashboard, Plus,
  ShieldCheck, Mail, Sparkles, CircleAlert,
} from "lucide-react";
import { PageHeader, Card, CardHeader, CardBody, Button, Alert, TextInput, TextArea, SelectInput, Field } from "@/components/superadmin/ui";
import { PasswordInput } from "@/components/superadmin/TeamMemberDialog";
import SearchCombobox, { COMBO_THEME_ADMIN } from "@/components/common/SearchCombobox";
import useOpenStoreAdmin from "@/components/superadmin/useOpenStoreAdmin";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { authApi } from "@/apis/user/authApi";
import { BUSINESS_CATEGORIES, STORE_DESCRIPTION_MAX, DEFAULT_COUNTRY, STORE_ADDRESS_MAX } from "@/lib/storeOptions";
import { ROOT_DOMAIN } from "@/lib/tenantHost";

const LIST = "/super-admin/stores";
const PASSWORD_MIN = 8;
const EMPTY = {
  name: "", username: "", phone: "", email: "", password: "", confirm: "",
  storeName: "", businessCategory: "", subdomain: "", storeDescription: "",
  country: DEFAULT_COUNTRY, city: "", address: "", zipCode: "",
};

/* Signup jaise saare fields — store + owner ek saath, seedha approved aur open */
export default function AddStorePage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [notify, setNotify] = useState(false);
  const [subCheck, setSubCheck] = useState({ state: "idle", value: "", suggestion: "" });
  const [subdomainTouched, setSubdomainTouched] = useState(false);
  const [created, setCreated] = useState(null);
  const [geo, setGeo] = useState(null);
  const { openStoreAdmin, openingId } = useOpenStoreAdmin({ onError: (text) => setFormError(text) });

  // Country + city list (signup wali library) — lazy
  useEffect(() => {
    let alive = true;
    import("country-state-city").then((m) => { if (alive) setGeo(m); }).catch(() => { if (alive) setGeo({ failed: true }); });
    return () => { alive = false; };
  }, []);
  const countries = useMemo(() => (geo?.Country ? geo.Country.getAllCountries() : []), [geo]);
  const countryOptions = useMemo(() => (countries.length ? countries.map((c) => c.name) : [form.country]), [countries, form.country]);
  const cityOptions = useMemo(() => {
    if (!geo?.City) return [];
    const match = countries.find((c) => c.name === form.country);
    return match ? [...new Set(geo.City.getCitiesOfCountry(match.isoCode).map((c) => c.name))].sort((a, b) => a.localeCompare(b)) : [];
  }, [geo, countries, form.country]);

  const update = (key, value) => { setForm((p) => ({ ...p, [key]: value })); setErrors((p) => ({ ...p, [key]: "" })); };
  const set = (key) => (e) => update(key, e.target.value);
  const changeStoreName = (value) => {
    update("storeName", value);
    if (!subdomainTouched) update("subdomain", value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, STORE_ADDRESS_MAX));
  };
  const changeSubdomain = (value) => {
    setSubdomainTouched(true);
    update("subdomain", String(value).toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").slice(0, STORE_ADDRESS_MAX));
  };

  // Web address ki live availability (400ms debounce)
  useEffect(() => {
    const value = form.subdomain.trim();
    if (value.length < 3) return undefined;
    const id = window.setTimeout(async () => {
      setSubCheck({ state: "checking", value, suggestion: "" });
      try {
        const res = await authApi.checkRegistration({ subdomain: value });
        const error = res?.errors?.subdomain;
        setSubCheck({ state: error ? "taken" : "available", value, suggestion: res?.subdomainSuggestion || "" });
        setErrors((p) => ({ ...p, subdomain: error || "" }));
      } catch {
        setSubCheck({ state: "idle", value, suggestion: "" });
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [form.subdomain]);

  const mutation = useMutation({
    mutationFn: () => {
      const { confirm: _confirm, ...payload } = form;
      return superAdminApi.createSellerStore({ ...payload, notify });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["superadmin-stores"] });
      qc.invalidateQueries({ queryKey: ["superadmin-dashboard"] });
      setCreated({ ...res?.data, message: res?.message, storeName: form.storeName.trim(), owner: form.name.trim(), email: form.email.trim().toLowerCase() });
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (err) => {
      const d = err?.response?.data || {};
      setErrors((p) => ({ ...p, ...(d.errors || {}) }));
      setFormError(d.message || "Could not create the store. Please try again.");
    },
  });

  const validate = () => {
    const e = {};
    const f = form;
    if (f.name.trim().length < 2) e.name = "Name must be at least 2 characters.";
    if (f.username.trim() && !/^[A-Za-z0-9_]{3,30}$/.test(f.username.trim())) e.username = "3–30 characters: letters, numbers or underscores.";
    const digits = f.phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 16) e.phone = "Phone must be 10–16 digits.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) e.email = "Enter a valid email address.";
    if (f.password.length < PASSWORD_MIN) e.password = `Password must be at least ${PASSWORD_MIN} characters.`;
    else if (f.confirm !== f.password) e.confirm = "Passwords do not match.";
    if (!f.storeName.trim()) e.storeName = "Please enter the store name.";
    if (!f.businessCategory) e.businessCategory = "Please select a business category.";
    const sub = f.subdomain.trim();
    if (!sub) e.subdomain = "Please choose the store web address.";
    else if (sub.length < 3) e.subdomain = "Store address must be at least 3 characters.";
    else if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(sub)) e.subdomain = "Use only lowercase letters, numbers and hyphens (not at the start or end).";
    else if (subCheck.value === sub && subCheck.state === "taken") e.subdomain = errors.subdomain || "This store address is already taken.";
    if (!f.storeDescription.trim()) e.storeDescription = "Please describe the store.";
    if (!f.country) e.country = "Please select a country.";
    if (f.city.trim().length < 2) e.city = "Please enter the city.";
    if (f.address.trim().length < 5) e.address = "Please enter a complete store address.";
    return e;
  };

  const submit = (ev) => {
    ev.preventDefault();
    setFormError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      setFormError("Please fix the highlighted fields.");
      // pehle ghalat field par le jao
      const first = document.querySelector("[aria-invalid='true']");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      first?.focus?.({ preventScroll: true });
      return;
    }
    mutation.mutate();
  };

  const addAnother = () => {
    setCreated(null); setForm(EMPTY); setErrors({}); setFormError(""); setNotify(false);
    setSubCheck({ state: "idle", value: "", suggestion: "" }); setSubdomainTouched(false);
  };

  /* ── Success state ── */
  if (created) {
    return (
      <div className="space-y-6">
        <PageHeader title="Add store" backHref={LIST} backLabel="Back to stores" />
        <Card className="mx-auto max-w-2xl">
          <CardBody className="flex flex-col items-center px-6 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-bg,rgba(16,185,129,0.12))] text-[var(--success-text)]"><CheckCircle2 size={28} aria-hidden="true" /></span>
            <h2 className="mt-4 text-[20px] font-semibold text-[var(--text-primary)]">{created.storeName} is live</h2>
            <p className="mt-1.5 max-w-md text-[13.5px] leading-6 text-[var(--text-secondary)]">
              {created.owner} can sign in to the store admin panel with <span className="font-medium text-[var(--text-primary)]">{created.email}</span> and the password you set.
            </p>
            {created.url && (
              <a href={created.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--bg-tertiary)] px-3 py-1.5 font-mono text-[12.5px] text-[var(--accent)] hover:underline">
                {created.url.replace(/^https?:\/\//, "")} <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              <Button variant="primary" icon={LayoutDashboard} loading={openingId === String(created.storeId)} onClick={() => openStoreAdmin(created.storeId)}>Open admin panel</Button>
              <Button variant="secondary" icon={Plus} onClick={addAnother}>Add another store</Button>
              <Button variant="ghost" href={LIST}>Back to stores</Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const sub = form.subdomain.trim();
  const subState = subCheck.value === sub ? subCheck.state : "idle";
  const previewUrl = sub ? `${sub}.${ROOT_DOMAIN}` : `your-store.${ROOT_DOMAIN}`;

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <PageHeader
        title="Add store"
        description="Create a store and its owner account — the same details a seller gives at signup. The store opens immediately."
        backHref={LIST}
        backLabel="Back to stores"
        actions={
          <>
            <Button variant="secondary" onClick={() => router.push(LIST)} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" variant="primary" icon={StoreIcon} loading={mutation.isPending}>Create store</Button>
          </>
        }
      />

      {formError && <Alert tone="danger" onDismiss={() => setFormError("")}>{formError}</Alert>}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* ── MAIN ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Owner account" description="The seller's login for the store admin panel" icon={UserRound} />
            <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <TextInput label="Full name" required value={form.name} onChange={set("name")} error={errors.name} placeholder="e.g. Ahmed Khan" autoComplete="off" autoFocus />
              <TextInput label="Username" value={form.username} onChange={set("username")} error={errors.username} hint={!errors.username ? "Optional — created from the name if left blank" : undefined} placeholder="ahmed_khan" autoComplete="off" />
              <TextInput label="Phone number" required value={form.phone} onChange={(e) => update("phone", e.target.value.replace(/[^\d+\s-]/g, ""))} error={errors.phone} inputMode="tel" placeholder="0300 1234567" hint={!errors.phone ? "10–16 digits" : undefined} autoComplete="off" />
              <TextInput label="Email address" required type="email" value={form.email} onChange={set("email")} error={errors.email} placeholder="owner@example.com" hint={!errors.email ? "Used to sign in" : undefined} autoComplete="off" />
              <PasswordInput label="Password" value={form.password} onChange={(v) => { update("password", v); setErrors((p) => ({ ...p, confirm: "" })); }} error={errors.password} hint={!errors.password ? `At least ${PASSWORD_MIN} characters` : undefined} />
              <PasswordInput label="Confirm password" value={form.confirm} onChange={(v) => update("confirm", v)} error={errors.confirm} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Store details" description="Name, category, web address and what the store sells" icon={StoreIcon} />
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TextInput label="Store name" required value={form.storeName} onChange={(e) => changeStoreName(e.target.value)} error={errors.storeName} placeholder="e.g. Ahmed Electronics" autoComplete="off" />
                <SelectInput label="Business category" value={form.businessCategory} onChange={set("businessCategory")} error={errors.businessCategory}>
                  <option value="">Select a category</option>
                  {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </SelectInput>
              </div>

              <Field label="Store web address" required htmlFor="sa-new-subdomain" error={errors.subdomain}>
                <div className="flex items-stretch overflow-hidden rounded-[var(--radius-input,8px)] border border-[var(--border-input,var(--border-color))] bg-[var(--bg-input,var(--bg-card))] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-soft)]" data-invalid={errors.subdomain ? "true" : undefined}>
                  <span className="flex items-center ps-3 text-[var(--text-muted)]"><Link2 size={15} aria-hidden="true" /></span>
                  <input
                    id="sa-new-subdomain"
                    value={form.subdomain}
                    onChange={(e) => changeSubdomain(e.target.value)}
                    aria-invalid={errors.subdomain ? "true" : undefined}
                    placeholder="your-store"
                    autoComplete="off"
                    data-lpignore="true"
                    data-1p-ignore
                    data-bwignore
                    spellCheck={false}
                    maxLength={STORE_ADDRESS_MAX}
                    className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-[13.5px] font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                  />
                  <span className="flex max-w-[55%] items-center truncate border-s border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 text-[12.5px] text-[var(--text-muted)]">.{ROOT_DOMAIN}</span>
                </div>
              </Field>
              {!errors.subdomain && (
                <p className="-mt-2 flex items-center gap-1.5 text-[12px]" aria-live="polite">
                  <span className={`order-last ms-auto tabular-nums ${sub.length >= STORE_ADDRESS_MAX ? "font-medium text-[var(--warning-text,#c2410c)]" : "text-[var(--text-muted)]"}`}>{form.subdomain.length}/{STORE_ADDRESS_MAX}</span>
                  {sub.length < 3 ? (
                    <span className="text-[var(--text-muted)]">Lowercase letters, numbers and hyphens · 3–{STORE_ADDRESS_MAX} characters.</span>
                  ) : subState === "checking" ? (
                    <><Loader2 size={12} className="animate-spin text-[var(--text-muted)]" aria-hidden="true" /><span className="text-[var(--text-muted)]">Checking availability…</span></>
                  ) : subState === "available" ? (
                    <><CheckCircle2 size={13} className="text-[var(--success-text)]" aria-hidden="true" /><span className="font-medium text-[var(--success-text)]">{sub}.{ROOT_DOMAIN} is available</span></>
                  ) : null}
                </p>
              )}
              {errors.subdomain && subCheck.suggestion && subCheck.value === sub && (
                <button type="button" onClick={() => changeSubdomain(subCheck.suggestion)} className="-mt-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2.5 py-1 text-[12px] font-semibold text-[var(--accent)] hover:border-[var(--accent)]">
                  Use {subCheck.suggestion}.{ROOT_DOMAIN}
                </button>
              )}

              <TextArea
                label="What will the store sell?"
                required
                rows={3}
                maxLength={STORE_DESCRIPTION_MAX}
                value={form.storeDescription}
                onChange={set("storeDescription")}
                error={errors.storeDescription}
                hint={!errors.storeDescription ? `${form.storeDescription.length}/${STORE_DESCRIPTION_MAX} characters` : undefined}
                placeholder="e.g. Affordable smartphones, accessories and gadgets with nationwide delivery."
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Business location" description="Used for shipping and tax settings" icon={MapPin} />
            <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Country" required error={errors.country} htmlFor="sa-new-country">
                <div className="relative">
                  <SearchCombobox
                    id="sa-new-country"
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
              <Field label="City" required error={errors.city} htmlFor="sa-new-city">
                <div className="relative">
                  <SearchCombobox
                    id="sa-new-city"
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
              <TextInput label="Street address" required value={form.address} onChange={set("address")} error={errors.address} placeholder="Shop no., street, area" autoComplete="off" />
              <TextInput label="ZIP code" value={form.zipCode} onChange={set("zipCode")} inputMode="numeric" maxLength={20} placeholder="54000" hint="Optional" autoComplete="off" />
            </CardBody>
          </Card>
        </div>

        {/* ── SIDEBAR ── */}
        <aside className="space-y-4 xl:sticky xl:top-4">
          <Card>
            <CardHeader title="Summary" icon={Sparkles} />
            <ul className="divide-y divide-[var(--border-color)]">
              <SummaryRow icon={StoreIcon} label="Store">{form.storeName.trim() || <Muted>Not set</Muted>}</SummaryRow>
              <SummaryRow icon={Globe} label="Web address">
                <span className={`block truncate font-mono text-[12px] ${sub ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`} title={previewUrl}>{previewUrl}</span>
              </SummaryRow>
              <SummaryRow icon={UserRound} label="Owner">{form.name.trim() || <Muted>Not set</Muted>}</SummaryRow>
              <SummaryRow icon={Mail} label="Sign-in email"><span className="block truncate" title={form.email}>{form.email.trim() || <Muted>Not set</Muted>}</span></SummaryRow>
              <SummaryRow icon={MapPin} label="Location">{[form.city.trim(), form.country].filter(Boolean).join(", ") || <Muted>Not set</Muted>}</SummaryRow>
            </ul>
            <div className="space-y-3 border-t border-[var(--border-color)] px-5 py-4">
              <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-[var(--text-secondary)]">
                <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
                <span>
                  <span className="font-medium text-[var(--text-primary)]">Email the owner</span>
                  <span className="block text-[12px] text-[var(--text-muted)]">Send a confirmation with the store link. The password is never emailed.</span>
                </span>
              </label>
              <Button type="submit" variant="primary" icon={StoreIcon} fullWidth loading={mutation.isPending}>Create store</Button>
            </div>
          </Card>

          <Card>
            <CardBody className="space-y-2.5 py-4">
              <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"><ShieldCheck size={14} aria-hidden="true" /> What happens</p>
              {[
                "The store opens right away at its web address.",
                "The owner can sign in to the store admin panel with the email and password above.",
                "It appears under Stores and as an approved request in Signup Requests.",
              ].map((t) => (
                <p key={t} className="flex items-start gap-2 text-[12.5px] leading-5 text-[var(--text-secondary)]"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--success-text)]" aria-hidden="true" />{t}</p>
              ))}
              <p className="flex items-start gap-2 pt-1 text-[12px] leading-5 text-[var(--text-muted)]"><CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />Share the password with the owner directly.</p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </form>
  );
}

function SummaryRow({ icon: Icon, label, children }) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
      <span className="inline-flex shrink-0 items-center gap-2 text-[var(--text-muted)]"><Icon size={14} aria-hidden="true" />{label}</span>
      <span className="min-w-0 max-w-[60%] text-end font-medium text-[var(--text-primary)]">{children}</span>
    </li>
  );
}

function Muted({ children }) {
  return <span className="font-normal text-[var(--text-muted)]">{children}</span>;
}
