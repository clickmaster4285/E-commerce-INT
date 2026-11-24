"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Pencil, KeyRound, Eye, EyeOff } from "lucide-react";
import { Modal, Button, IconButton, Alert, TextInput, Field, FormSection } from "@/components/superadmin/ui";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

const PASSWORD_MIN = 8;

/** Password input with show/hide toggle (no generator — admin types it) */
export function PasswordInput({ label, value, onChange, error, hint, autoFocus, autoComplete = "new-password", required = true, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} required={required} error={error} hint={hint}>
      <div className="relative">
        <input type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} aria-invalid={error ? "true" : undefined} className="sa-input pe-10" autoFocus={autoFocus} placeholder={placeholder} />
        <IconButton icon={show ? EyeOff : Eye} label={show ? "Hide password" : "Show password"} size="sm" className="absolute end-1 top-1/2 -translate-y-1/2" onClick={() => setShow((v) => !v)} />
      </div>
    </Field>
  );
}

/** Password + confirm pair — create aur reset dono dialogs me */
function PasswordPair({ password, confirm, onPassword, onConfirm, errors, autoFocus }) {
  return (
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
      <PasswordInput label="Password" value={password} onChange={onPassword} error={errors.password} hint={!errors.password ? `At least ${PASSWORD_MIN} characters` : undefined} autoFocus={autoFocus} />
      <PasswordInput label="Confirm password" value={confirm} onChange={onConfirm} error={errors.confirm} />
    </div>
  );
}

const validatePasswords = (password, confirm) => {
  const next = {};
  if (password.length < PASSWORD_MIN) next.password = `Password must be at least ${PASSWORD_MIN} characters.`;
  else if (confirm !== password) next.confirm = "Passwords do not match.";
  return next;
};

/** Add / edit a staff member. `member` null = create. Role is always "staff". */
export default function TeamMemberDialog({ member, onClose, onSaved }) {
  const qc = useQueryClient();
  const editing = Boolean(member);
  const [form, setForm] = useState({ name: member?.name || "", email: member?.email || "", phone: member?.phone || "", password: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const set = (key) => (e) => { setForm((p) => ({ ...p, [key]: e.target.value })); setErrors((p) => ({ ...p, [key]: "", ...(key === "password" ? { confirm: "" } : {}) })); };

  const mutation = useMutation({
    mutationFn: () => editing
      ? superAdminApi.updateTeamMember(member.id, { name: form.name.trim(), phone: form.phone.trim() })
      : superAdminApi.createTeamMember({ name: form.name.trim(), email: form.email.trim().toLowerCase(), phone: form.phone.trim(), role: "staff", password: form.password }),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["superadmin-team"] }); onSaved?.(res); onClose(); },
    onError: (err) => { const d = err?.response?.data || {}; setErrors(d.errors || {}); setFormError(d.message || "Could not save. Please try again."); },
  });

  const submit = (e) => {
    e.preventDefault();
    setFormError("");
    const next = {};
    if (form.name.trim().length < 2) next.name = "Name must be at least 2 characters.";
    if (!editing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (form.phone && !/^\d{7,16}$/.test(form.phone.trim())) next.phone = "Phone must be 7–16 digits.";
    if (!editing) Object.assign(next, validatePasswords(form.password, form.confirm));
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  return (
    <Modal
      open
      onClose={onClose}
      as="form"
      onSubmit={submit}
      size="lg"
      icon={editing ? Pencil : UserPlus}
      title={editing ? `Edit ${member.name}` : "Add staff member"}
      description={editing ? "Update the member's contact details." : "Give a colleague their own Super Admin login instead of sharing yours."}
      busy={mutation.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" variant="primary" loading={mutation.isPending}>{editing ? "Save changes" : "Add staff member"}</Button>
        </>
      }
    >
      <div className="space-y-6 pt-1">
        {formError && <Alert tone="danger">{formError}</Alert>}

        <FormSection title="Details">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <TextInput label="Full name" required value={form.name} onChange={set("name")} error={errors.name} autoFocus={!editing} placeholder="e.g. Ayesha Khan" />
            <TextInput label="Phone" value={form.phone} onChange={(e) => { const value = e.target.value.replace(/\D/g, "").slice(0, 16); setForm((p) => ({ ...p, phone: value })); setErrors((p) => ({ ...p, phone: "" })); }} error={errors.phone} inputMode="numeric" pattern="[0-9]*" maxLength={16} placeholder="03001234567" />
          </div>
          <TextInput label="Email" type="email" required value={form.email} onChange={set("email")} error={errors.email} disabled={editing} hint={editing ? "Login email — cannot be changed." : "They sign in with this email."} placeholder="name@company.com" autoComplete="off" />
        </FormSection>

        {!editing && (
          <FormSection title="Login">
            <PasswordPair password={form.password} confirm={form.confirm} onPassword={(v) => set("password")({ target: { value: v } })} onConfirm={(v) => set("confirm")({ target: { value: v } })} errors={errors} />
            <p className="text-[12px] text-fg-muted">Share the password with them directly — no email is sent. They can ask you to reset it later.</p>
          </FormSection>
        )}
      </div>
    </Modal>
  );
}

/** Set a new password for a member (no email is sent — share it directly). */
// `save(password)` dene par kisi bhi account ke liye — default team member
export function ResetPasswordDialog({ member, onClose, onSaved, save, description }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const mutation = useMutation({
    mutationFn: () => (save ? save(password) : superAdminApi.resetTeamMemberPassword(member.id, password)),
    onSuccess: (res) => { onSaved?.(res); onClose(); },
    onError: (err) => setFormError(err?.response?.data?.message || "Could not reset the password."),
  });
  const submit = (e) => {
    e.preventDefault();
    setFormError("");
    const next = validatePasswords(password, confirm);
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };
  return (
    <Modal
      open
      onClose={onClose}
      as="form"
      onSubmit={submit}
      size="lg"
      icon={KeyRound}
      iconTone="warning"
      title={`Reset password for ${member.name}`}
      description={description || (member.isSelf ? "You will use the new password the next time you sign in." : "Share the new password with them directly — no email is sent.")}
      busy={mutation.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" variant="primary" loading={mutation.isPending}>Set new password</Button>
        </>
      }
    >
      <div className="space-y-4 pt-1">
        {formError && <Alert tone="danger">{formError}</Alert>}
        <PasswordPair password={password} confirm={confirm} onPassword={(v) => { setPassword(v); setErrors({}); }} onConfirm={(v) => { setConfirm(v); setErrors((p) => ({ ...p, confirm: "" })); }} errors={errors} autoFocus />
      </div>
    </Modal>
  );
}
