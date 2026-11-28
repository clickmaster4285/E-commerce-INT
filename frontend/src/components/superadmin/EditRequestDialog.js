"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Modal, Button, Alert, TextInput, TextArea, SelectInput, FormSection } from "@/components/superadmin/ui";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

const BUSINESS_CATEGORIES = ["Electronics", "Fashion & Apparel", "Home & Kitchen", "Beauty & Personal Care", "Sports & Outdoors", "Grocery & Food", "Baby & Kids", "Automotive", "Health & Wellness", "Books & Stationery", "Services", "Other"];
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
  const changeCount = Object.keys(changes).length;
  const dirty = changeCount > 0;

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

  const categories = form.business_category && !BUSINESS_CATEGORIES.includes(form.business_category) ? [form.business_category, ...BUSINESS_CATEGORIES] : BUSINESS_CATEGORIES;

  return (
    <Modal
      open
      onClose={onClose}
      as="form"
      onSubmit={submit}
      size="lg"
      icon={Pencil}
      title="Edit signup request"
      description="Changes also update the seller's store profile. The login email can't be changed."
      busy={mutation.isPending}
      footer={
        <>
          <span className="me-auto text-[12.5px] text-[var(--text-muted)]">{dirty ? `${changeCount} unsaved change${changeCount === 1 ? "" : "s"}` : "No changes yet"}</span>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!dirty} loading={mutation.isPending}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-6 pt-1">
        {formError && <Alert tone="danger">{formError}</Alert>}

        <FormSection title="Seller">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <TextInput label="Full name" value={form.name} onChange={set("name")} error={errors.name} autoFocus />
            <TextInput label="Phone" value={form.phone} onChange={set("phone")} error={errors.phone} inputMode="numeric" placeholder="03001234567" />
          </div>
          <TextInput label="Email" value={item.email} disabled hint="Login email — cannot be changed." />
        </FormSection>

        <FormSection title="Store">
          <TextInput label="Store name" value={form.store_name} onChange={set("store_name")} error={errors.store_name} />
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <SelectInput label="Business category" value={form.business_category} onChange={set("business_category")}>
              <option value="">Select a category</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectInput>
            <SelectInput label="Business type" value={form.business_type || "individual"} onChange={set("business_type")}>
              <option value="individual">Individual</option>
              <option value="registered_business">Registered business</option>
            </SelectInput>
          </div>
          <TextArea label="Description" value={form.store_description} onChange={set("store_description")} rows={3} maxLength={2000} />
        </FormSection>

        <FormSection title="Location">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <TextInput label="Country" value={form.country} onChange={set("country")} />
            <TextInput label="City" value={form.city} onChange={set("city")} />
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_140px]">
            <TextInput label="Street address" value={form.address} onChange={set("address")} />
            <TextInput label="ZIP code" value={form.zip_code} onChange={set("zip_code")} />
          </div>
        </FormSection>
      </div>
    </Modal>
  );
}
