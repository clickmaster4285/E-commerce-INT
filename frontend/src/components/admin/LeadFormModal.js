"use client";

import { Building2, Check, ChevronDown, ContactRound, Mail, MapPin, Phone, StickyNote, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { employeeApi } from "@/apis/admin/employeeApi";
import { useTranslation } from "@/i18n/LanguageProvider";

const sources = ["Walk-in", "Phone Call", "WhatsApp", "Referral", "Email", "Social Media", "Other"];
const optionLabel = (value, t) => { const key = `admin.leads.value.${String(value).toLowerCase().replace(/[^a-z0-9]/g, "")}`; const label = t(key); return label === key ? String(value).replaceAll("_", " ") : label; };
const modalStyle = { border: "1px solid #dce8f8", background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)", boxShadow: "0 24px 70px rgba(15,23,42,0.25)" };
const inputStyle = { backgroundColor: "#fff", border: "1px solid #dbe5f1", color: "#0f172a", boxShadow: "0 1px 2px rgba(15,23,42,0.03)" };
const primaryButtonStyle = { background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "#fff", boxShadow: "0 4px 10px rgba(37,99,235,0.2)" };

export default function LeadFormModal({ open, form, setForm, editing = false, isPending = false, onSave, onClose }) {
  const { t } = useTranslation();
  const { data: employeesRaw = [] } = useQuery({ queryKey: ["lead-form-employees"], queryFn: () => employeeApi.getAll(), enabled: open });
  const employees = Array.isArray(employeesRaw) ? employeesRaw : employeesRaw?.data || employeesRaw?.items || [];
  if (!open) return null;
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const updatePhone = (value) => update("phone", value.replace(/\D/g, "").slice(0, 15));
  const field = (label, key, type = "text", required = false, Icon = null, className = "") => (
    <label key={key} className={className}>
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}{required && <span className="ms-1 text-rose-500">*</span>}</span>
      <span className="relative block">
        {Icon && <Icon size={15} className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400" />}
        <input type={type} inputMode={type === "tel" ? "numeric" : undefined} maxLength={key === "phone" ? 15 : undefined} pattern={key === "phone" ? "[0-9]{7,15}" : undefined} required={required} value={form[key] || ""} onChange={(event) => key === "phone" ? updatePhone(event.target.value) : update(key, event.target.value)} className={`h-10 w-full rounded-xl px-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100 ${Icon ? "ps-10" : ""}`} style={inputStyle} />
      </span>
    </label>
  );
  const sectionHeading = (Icon, title, description) => (
    <div className="mb-4 flex items-start gap-2.5">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><Icon size={16} /></span>
      <span><span className="block text-[13px] font-bold text-slate-800">{title}</span><span className="mt-0.5 block text-[11px] text-slate-500">{description}</span></span>
    </div>
  );
  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !isPending) onClose(); }}>
    <form onSubmit={onSave} className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl" style={modalStyle}>
      <header className="flex items-center justify-between border-b px-5 py-4 sm:px-6" style={{ borderColor: "#e5eef9", background: "linear-gradient(135deg, #f8fbff 0%, #eff6ff 100%)" }}>
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}><ContactRound size={18} color="#fff" /></span>
          <span className="min-w-0"><span className="block text-base font-extrabold tracking-tight text-slate-900">{editing ? t("admin.leads.ui.editLead") : t("admin.leads.ui.addLead")}</span><span className="mt-0.5 block text-xs text-slate-500">{t("admin.leads.ui.saveContactDetailsAndKeepYourLeadListOrganized")}</span></span>
        </div>
        <button type="button" onClick={onClose} disabled={isPending} aria-label={t("admin.leads.ui.closeLeadForm")} className="ms-3 rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:opacity-50"><X size={17} /></button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/70 p-4 sm:p-6">
        <section className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "#e5edf7" }}>
          {sectionHeading(UserRound, t("admin.leads.ui.contactInformation"), t("admin.leads.ui.mainDetailsToReachLead"))}
          <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
            <div><span className="mb-1.5 block text-xs font-semibold text-slate-600">{t("admin.leads.ui.leadType")}<span className="ms-1 text-rose-500">*</span></span><LeadDropdown value={form.lead_type || "Individual"} onChange={(value) => update("lead_type", value)} ariaLabel={t("admin.leads.ui.leadType")} options={[{ value: "Individual", label: t("admin.leads.value.individual") }, { value: "Business", label: t("admin.leads.value.business") }]} /></div>
            {field(t("admin.leads.ui.contactPerson"), "name", "text", true, null)}
            {field(t("common.phone"), "phone", "tel", true, Phone)}
            {field(t("common.email"), "email", "email", false, Mail)}
            {form.lead_type === "Business" && <>
              {field(t("admin.leads.ui.companyName"), "company_name", "text", true, Building2)}
              {field(t("admin.leads.ui.businessType"), "business_type", "text", false, null)}
              {field(t("admin.leads.ui.businessAddress"), "business_address", "text", false, MapPin, "sm:col-span-2")}
            </>}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "#e5edf7" }}>
          {sectionHeading(ContactRound, t("admin.leads.ui.leadDetails"), t("admin.leads.ui.setSourceProgressOwnerAndFollowUp"))}
          <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 sm:grid-cols-2">
            <div><span className="mb-1.5 block text-xs font-semibold text-slate-600">{t("admin.leads.ui.source")}</span><LeadDropdown value={form.source || "Other"} onChange={(value) => update("source", value)} ariaLabel={t("admin.leads.ui.leadSource")} options={sources.map((source) => ({ value: source, label: optionLabel(source, t) }))} /></div>
            <div><span className="mb-1.5 block text-xs font-semibold text-slate-600">{t("admin.leads.ui.status")}</span><LeadDropdown value={form.status || "New"} onChange={(value) => update("status", value)} ariaLabel={t("admin.leads.ui.leadStatus")} options={["New", "Contacted", "Qualified", "Converted", "Lost"].map((status) => ({ value: status, label: optionLabel(status, t) }))} /></div>
            <div><span className="mb-1.5 block text-xs font-semibold text-slate-600">{t("admin.leads.ui.assignedEmployee")}</span><LeadDropdown value={form.assigned_employee_id?._id || form.assigned_employee_id || ""} onChange={(value) => update("assigned_employee_id", value)} ariaLabel={t("admin.leads.ui.assignedEmployee")} options={[{ value: "", label: t("admin.leads.value.unassigned") }, ...employees.filter((employee) => (employee.role !== "admin" && employee.status === "active" && !employee.is_deleted) || String(employee._id) === String(form.assigned_employee_id?._id || form.assigned_employee_id || "")).map((employee) => ({ value: employee._id, label: employee.name }))]} /></div>
            {field(t("admin.leads.ui.nextFollowUp"), "next_follow_up_date", "date", false, null)}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: "#e5edf7" }}>
          {sectionHeading(StickyNote, t("admin.leads.ui.notes"), t("admin.leads.ui.addContextForNextConversation"))}
          <textarea rows={4} value={form.notes || ""} onChange={(event) => update("notes", event.target.value)} placeholder={t("admin.leads.ui.writeAShortNoteAboutThisLead")} className="w-full resize-y rounded-xl px-3.5 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100" style={inputStyle} />
        </section>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t bg-white px-5 py-3.5 sm:px-6" style={{ borderColor: "#e5eef9" }}>
        <p className="hidden text-xs text-slate-500 sm:block"><span className="text-rose-500">*</span> {t("admin.leads.ui.requiredField")}</p>
        <div className="ms-auto flex gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className="h-10 rounded-xl border px-4 text-[13px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50" style={{ borderColor: "#dbe5f1" }}>{t("admin.leads.ui.cancel")}</button>
          <button type="submit" disabled={isPending || !form.name?.trim() || !form.phone?.trim() || (form.lead_type === "Business" && !form.company_name?.trim())} className="h-10 rounded-xl px-5 text-[13px] font-bold transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50" style={primaryButtonStyle}>{isPending ? t("admin.leads.ui.saving") : editing ? t("common.saveChanges") : t("admin.leads.ui.saveLead")}</button>
        </div>
      </footer>
    </form>
  </div>;
}

function LeadDropdown({ value, options, onChange, ariaLabel }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options.find((option) => String(option.value) === String(value)) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => { if (!dropdownRef.current?.contains(event.target)) setOpen(false); };
    const closeOnEscape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  return <div ref={dropdownRef} className="relative min-w-0">
    <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className={`flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border px-3.5 text-start text-sm text-slate-900 shadow-sm outline-none transition ${open ? "border-blue-400 ring-4 ring-blue-100" : "border-[#dbe5f1] hover:border-blue-300 hover:bg-blue-50/30"}`}>
      <span className="min-w-0 flex-1 truncate">{selectedOption?.label || t("admin.leads.ui.selectAnOption")}</span>
      <ChevronDown size={15} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div className="absolute start-0 top-full z-[80] mt-2 min-w-full overflow-hidden rounded-xl border border-[#dbe5f1] bg-white p-1 shadow-xl shadow-slate-900/10 ring-1 ring-black/5">
      <div role="listbox" aria-label={ariaLabel} className="max-h-56 overflow-y-auto">{options.map((option) => {
        const selected = String(option.value) === String(value);
        return <button key={option.value || "unassigned"} type="button" role="option" aria-selected={selected} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-xs transition ${selected ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"}`}><span className="truncate">{option.label}</span>{selected && <Check size={14} className="shrink-0 text-blue-600" />}</button>;
      })}</div>
    </div>}
  </div>;
}
