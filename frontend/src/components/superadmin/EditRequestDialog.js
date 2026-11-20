"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, X } from "lucide-react";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

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

const FIELDS = ["name", "phone", "store_name", "business_category", "business_type", "store_description", "country", "city", "address", "zip_code"];

const pick = (item) => Object.fromEntries(FIELDS.map((key) => [key, item?.[key] ?? ""]));

/* Pending signup request edit — sirf badle hue fields bhejta hai */
export default function EditRequestDialog({ item, onClose, onSaved }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => pick(item));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const initial = pick(item);
  const changes = Object.fromEntries(FIELDS.filter((key) => String(form[key]) !== String(initial[key])).map((key) => [key, form[key]]));
  const dirty = Object.keys(changes).length > 0;

  const mutation = useMutation({
    mutationFn: () => superAdminApi.updateRequest(item._id, changes),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["superadmin-requests"] });
      qc.invalidateQueries({ queryKey: ["superadmin-application", String(item._id)] });
      onSaved?.(res);
      onClose();
    },
    onError: (err) => {
      const data = err?.response?.data || {};
      setErrors(data.errors || {});
      setFormError(data.message || "Could not save changes. Please try again.");
    },
  });

  const set = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const submit = (e) => {
    e.preventDefault();
    setFormError("");
    const next = {};
    if (form.name.trim().length < 2) next.name = "Name must be at least 2 characters.";
    if (!form.store_name.trim()) next.store_name = "Store name is required.";
    if (form.phone && !/^\d{10,16}$/.test(form.phone.trim())) next.phone = "Phone must be 10–16 digits.";
    setErrors(next);
    if (Object.keys(next).length || !dirty) return;
    mutation.mutate();
  };

  const categories = form.business_category && !BUSINESS_CATEGORIES.includes(form.business_category)
    ? [form.business_category, ...BUSINESS_CATEGORIES]
    : BUSINESS_CATEGORIES;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-request-title"
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)] shadow-[var(--shadow-lg)]"
        noValidate
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft,rgba(37,99,235,0.1))] text-[var(--accent)]">
              <Pencil size={18} aria-hidden="true" />
            </span>
            <div>
              <h2 id="edit-request-title" className="text-[16px] font-semibold text-[var(--text-primary)]">Edit signup request</h2>
              <p className="text-[12px] text-[var(--text-muted)]">Changes also update the seller&apos;s store profile. Email can&apos;t be changed.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {formError && (
            <p role="alert" className="rounded-lg border px-3 py-2.5 text-xs font-semibold" style={{ background: "var(--danger-soft)", color: "var(--danger-text)", borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)" }}>
              {formError}
            </p>
          )}

          <fieldset className="space-y-3">
            <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Seller</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Full name" value={form.name} onChange={set("name")} error={errors.name} autoFocus />
              <Input label="Phone" value={form.phone} onChange={set("phone")} error={errors.phone} inputMode="numeric" placeholder="03001234567" />
            </div>
            <Input label="Email" value={item.email} disabled hint="Login email — cannot be changed." />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Store</legend>
            <Input label="Store name" value={form.store_name} onChange={set("store_name")} error={errors.store_name} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select label="Business category" value={form.business_category} onChange={set("business_category")}>
                <option value="">Select a category</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Select label="Business type" value={form.business_type || "individual"} onChange={set("business_type")}>
                <option value="individual">Individual</option>
                <option value="registered_business">Registered business</option>
              </Select>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-semibold text-[var(--text-secondary)]">Description</span>
              <textarea value={form.store_description} onChange={set("store_description")} rows={3} maxLength={2000} className="input-field w-full" />
            </label>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Location</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input label="Country" value={form.country} onChange={set("country")} />
              <Input label="City" value={form.city} onChange={set("city")} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
              <Input label="Street address" value={form.address} onChange={set("address")} />
              <Input label="ZIP code" value={form.zip_code} onChange={set("zip_code")} />
            </div>
          </fieldset>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--border-color)] bg-[var(--bg-card-alt)] px-6 py-3.5">
          <span className="text-[12px] text-[var(--text-muted)]">
            {dirty ? `${Object.keys(changes).length} unsaved change${Object.keys(changes).length === 1 ? "" : "s"}` : "No changes yet"}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary h-10 px-4">Cancel</button>
            <button type="submit" disabled={!dirty || mutation.isPending} className="btn-primary h-10 px-5 disabled:cursor-not-allowed disabled:opacity-50">
              {mutation.isPending ? <><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Saving…</> : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Input({ label, error, hint, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-[var(--text-secondary)]">{label}</span>
      <input {...props} aria-invalid={error ? "true" : undefined} className={`input-field h-10 w-full ${error ? "!border-[var(--danger)]" : ""} disabled:opacity-60`} />
      {error ? <span className="mt-1 block text-[11.5px] font-medium text-[var(--danger-text)]">{error}</span> : hint ? <span className="mt-1 block text-[11.5px] text-[var(--text-muted)]">{hint}</span> : null}
    </label>
  );
}

function Select({ label, children, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-[var(--text-secondary)]">{label}</span>
      <select {...props} className="input-field h-10 w-full">{children}</select>
    </label>
  );
}
