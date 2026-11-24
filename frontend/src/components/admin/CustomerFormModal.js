"use client";

import { Check, Users, X } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { createPortal } from "react-dom";

export default function CustomerFormModal({ open, form, setForm, editing = false, isPending = false, onSave, onClose }) {
  const { t } = useTranslation();
  if (!open) return null;
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updatePhone = (value) => {
    let digitCount = 0;
    const limited = [...value].filter((character) => {
      if (!/\d/.test(character)) return true;
      digitCount += 1;
      return digitCount <= 15;
    }).join("");
    update("phone", limited);
  };
  const field = (label, key, type = "text", required = false, className = "") => (
    <label key={key} className={`space-y-1.5 text-xs font-semibold text-fg-secondary ${className}`}>
      {label}{required && <span className="text-danger"> *</span>}
      <input type={type} inputMode={key === "phone" ? "tel" : undefined} maxLength={key === "phone" ? 32 : undefined} required={required} value={form[key] || ""} onChange={(event) => key === "phone" ? updatePhone(event.target.value) : update(key, event.target.value)} className="h-10 w-full rounded-xl border border-line bg-input px-3.5 text-sm font-normal text-fg outline-none transition-all duration-200 placeholder:text-fg-muted hover:border-accent/50 hover:bg-card hover:shadow-sm focus:border-accent focus:bg-card focus:shadow-md focus:ring-4 focus:ring-accent-soft" />
    </label>
  );

  return createPortal(<div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-[fadeIn_180ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form onSubmit={(event) => { event.preventDefault(); onSave(); }} className="max-h-[90vh] w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-card shadow-[0_24px_70px_rgba(15,23,42,0.3)] animate-[modalIn_220ms_cubic-bezier(0.16,1,0.3,1)]">
      <div className="flex items-center justify-between border-b border-line bg-gradient-to-r from-card-alt to-accent-soft px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md"><Users size={18} /></span><div><h2 className="text-base font-bold tracking-tight">{editing ? t("admin.customers.modal.edit") : t("admin.customers.modal.add")}</h2><p className="mt-0.5 text-xs text-fg-muted">{t("admin.customers.modal.subtitle")}</p></div></div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-fg-muted transition duration-200 hover:rotate-90 hover:bg-card hover:text-fg" aria-label={t("admin.customers.modal.close")}><X size={18} /></button>
      </div>
      <div className="max-h-[calc(90vh-120px)] overflow-y-auto bg-page-alt/50 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3">
          {field(t("admin.customers.modal.name"), "name", "text", true)}
          {field(t("admin.customers.modal.phone"), "phone", "tel")}
          {field(t("admin.customers.modal.email"), "email", "email")}
          {field(t("admin.customers.modal.address"), "address")}
          <label className="space-y-1.5 text-xs font-semibold text-fg-secondary">{t("admin.customers.modal.notes")}<textarea value={form.notes || ""} onChange={(event) => update("notes", event.target.value)} rows={3} className="w-full resize-y rounded-xl border border-line bg-input px-3.5 py-2.5 text-sm font-normal text-fg outline-none transition-all duration-200 placeholder:text-fg-muted hover:border-accent/50 hover:bg-card hover:shadow-sm focus:border-accent focus:bg-card focus:shadow-md focus:ring-4 focus:ring-accent-soft" /></label>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-line bg-card px-4 py-3 sm:px-5">
        <button type="button" onClick={onClose} className="h-10 rounded-xl border border-line bg-card px-4 text-[13px] font-semibold text-fg-secondary transition-all duration-200 hover:-translate-y-0.5 hover:bg-card-alt hover:shadow-sm active:translate-y-0">{t("admin.customers.modal.cancel")}</button>
        <button type="submit" disabled={isPending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"><Check size={15} />{isPending ? t("admin.customers.modal.saving") : editing ? t("admin.customers.modal.saveChanges") : t("admin.customers.modal.add")}</button>
      </div>
    </form>
  </div>, document.body);
}
