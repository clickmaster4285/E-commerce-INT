"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Modal, Button, Alert, TextInput, FormSection } from "@/components/superadmin/ui";
import { PasswordInput } from "@/components/superadmin/TeamMemberDialog";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

const FIELDS = ["name", "username", "email", "phone"];
const PASSWORD_MIN = 8;

/** Edit a customer/seller account — sirf badle hue fields bhejta hai.
    Password khali chhoro to purana hi rehta hai (hash hai, dikh nahi sakta). */
export default function EditUserDialog({ user, onClose, onSaved, focus }) {
  const qc = useQueryClient();
  const canPassword = user?.provider !== "google";
  const initial = Object.fromEntries(FIELDS.map((k) => [k, user?.[k] || ""]));
  const [form, setForm] = useState(initial);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const changes = Object.fromEntries(FIELDS.filter((k) => String(form[k]).trim() !== String(initial[k]).trim()).map((k) => [k, String(form[k]).trim()]));
  const detailsDirty = Object.keys(changes).length > 0;
  const passwordDirty = canPassword && password.length > 0;
  const count = Object.keys(changes).length + (passwordDirty ? 1 : 0);
  const dirty = count > 0;
  const set = (k) => (e) => { setForm((p) => ({ ...p, [k]: e.target.value })); setErrors((p) => ({ ...p, [k]: "" })); };

  const mutation = useMutation({
    mutationFn: async () => {
      const messages = [];
      if (detailsDirty) messages.push((await superAdminApi.updateUser(user.id, changes))?.message || "Details updated.");
      if (passwordDirty) messages.push((await superAdminApi.setUserPassword(user.id, password))?.message || "Password updated.");
      return { message: messages.join(" ") };
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["superadmin-users"] });
      qc.invalidateQueries({ queryKey: ["superadmin-user", String(user.id)] });
      onSaved?.(res);
      onClose();
    },
    onError: (err) => {
      const d = err?.response?.data || {};
      setErrors(d.errors || {});
      setFormError(d.message || "Could not save changes.");
      // details save ho chuke hon to list refresh kar do
      qc.invalidateQueries({ queryKey: ["superadmin-user", String(user.id)] });
    },
  });

  const submit = (e) => {
    e.preventDefault();
    setFormError("");
    const next = {};
    if (form.name.trim().length < 2) next.name = "Name must be at least 2 characters.";
    if (!/^[a-z0-9._]{3,30}$/i.test(form.username.trim())) next.username = "3–30 characters: letters, numbers, dots or underscores.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.phone.trim() && !/^\d{10,16}$/.test(form.phone.trim())) next.phone = "Phone must be 10–16 digits.";
    if (passwordDirty) {
      if (password.length < PASSWORD_MIN) next.password = `Password must be at least ${PASSWORD_MIN} characters.`;
      else if (confirm !== password) next.confirm = "Passwords do not match.";
    }
    setErrors(next);
    if (Object.keys(next).length || !dirty) return;
    mutation.mutate();
  };

  const isSeller = user.type === "Seller";
  return (
    <Modal
      open
      onClose={onClose}
      as="form"
      onSubmit={submit}
      size="lg"
      icon={Pencil}
      title={`Edit ${user.name}`}
      description={isSeller ? "Changes to name, email, phone and password are also applied to their store admin login." : "Update this customer's account details."}
      busy={mutation.isPending}
      footer={
        <>
          <span className="me-auto text-[12.5px] text-[var(--text-muted)]">{dirty ? `${count} unsaved change${count === 1 ? "" : "s"}` : "No changes yet"}</span>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" variant="primary" disabled={!dirty} loading={mutation.isPending}>Save changes</Button>
        </>
      }
    >
      <div className="space-y-6 pt-1">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <FormSection title="Profile">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <TextInput label="Full name" required value={form.name} onChange={set("name")} error={errors.name} autoFocus={focus !== "password"} />
            <TextInput label="Username" required value={form.username} onChange={set("username")} error={errors.username} hint={!errors.username ? "Shown as @username" : undefined} />
          </div>
        </FormSection>
        <FormSection title="Contact">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <TextInput label="Email" type="email" required value={form.email} onChange={set("email")} error={errors.email} hint={!errors.email ? "Used to sign in" : undefined} />
            <TextInput label="Phone" value={form.phone} onChange={set("phone")} error={errors.phone} inputMode="numeric" placeholder="03001234567" />
          </div>
        </FormSection>
        {canPassword && (
          <FormSection title="Password">
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <PasswordInput
                label="New password"
                required={false}
                value={password}
                onChange={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: "", confirm: "" })); }}
                error={errors.password}
                hint={!errors.password ? `Leave blank to keep the current password · min ${PASSWORD_MIN} characters` : undefined}
                placeholder="Leave blank to keep current"
                autoFocus={focus === "password"}
              />
              {password.length > 0 && (
                <PasswordInput label="Confirm new password" value={confirm} onChange={(v) => { setConfirm(v); setErrors((p) => ({ ...p, confirm: "" })); }} error={errors.confirm} />
              )}
            </div>
            <p className="text-[12px] text-[var(--text-muted)]">The current password is encrypted and can&apos;t be shown. Share the new one with {user.name} directly — no email is sent.</p>
          </FormSection>
        )}
      </div>
    </Modal>
  );
}
