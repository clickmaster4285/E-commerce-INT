"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadApi } from "@/apis/admin/leadApi";
import { addLeadAsCustomer } from "@/lib/addLeadAsCustomer";
import { employeeApi } from "@/apis/admin/employeeApi";
import LeadFormModal from "@/components/admin/LeadFormModal";
import { useTranslation } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { CalendarClock, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Eye, MoreVertical, Pencil, Plus, Search, Users, X } from "lucide-react";

const emptyForm = { lead_type: "Individual", name: "", phone: "", email: "", company_name: "", business_type: "", business_address: "", city: "", source: "Other", status: "New", assigned_employee_id: "", estimated_deal_value: "", expected_purchase_date: "", next_follow_up_date: "", products: [], custom_requirements: "", notes: "" };
const PAGE_SIZE = 10;
const date = (v, locale, t) => v ? new Date(v).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }) : t("common.notProvided");
const statusTone = { New: "bg-[var(--accent-soft)] text-[var(--accent)]", Contacted: "bg-blue-100 text-blue-700", Qualified: "bg-amber-100 text-amber-800", Converted: "bg-[var(--success-soft)] text-[var(--success-text)]", Lost: "bg-[var(--danger-soft)] text-[var(--danger-text)]" };
const nextLeadStatuses = { New: ["Contacted"], Contacted: ["Qualified"], Qualified: ["Converted", "Lost"] };
const previousLeadStatus = { Contacted: "New", Qualified: "Contacted", Converted: "Qualified" };
const leadValueKey = (value) => `admin.leads.value.${String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
const leadValueLabel = (value, t) => { const key = leadValueKey(value); const label = t(key); return label === key ? (String(value || "").replaceAll("_", " ") || t("common.notProvided")) : label; };

export default function LeadsPage() {
  const { t, locale, dir } = useTranslation();
  const router = useRouter(); const qc = useQueryClient();
  const [search, setSearch] = useState(""); const [filters, setFilters] = useState({ status: "", lead_type: "", source: "", assigned_employee_id: "" }); const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm); const [editingId, setEditingId] = useState(null); const [formOpen, setFormOpen] = useState(false);
  const [lostReasonLead, setLostReasonLead] = useState(null); const [lostReason, setLostReason] = useState("");
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["leads-admin", search, filters, page], queryFn: () => leadApi.list({ search, ...filters, page, limit: 10 }), keepPreviousData: true });
  const { data: employeeData } = useQuery({ queryKey: ["lead-list-employees"], queryFn: () => employeeApi.getAll() });
  const employees = Array.isArray(employeeData) ? employeeData : employeeData?.data || employeeData?.items || [];
  const leads = data?.data || []; const stats = data?.stats || {}; const pagination = data?.pagination || { total: 0, pages: 1, page: 1 };
  const saveMutation = useMutation({ mutationFn: (payload) => editingId ? leadApi.update(editingId, payload) : leadApi.create(payload), onSuccess: () => { toast.success(t(editingId ? "admin.leads.toast.updated" : "admin.leads.toast.created")); setFormOpen(false); setForm(emptyForm); setEditingId(null); qc.invalidateQueries({ queryKey: ["leads-admin"] }); qc.invalidateQueries({ queryKey: ["lead-detail"] }); }, onError: (e) => toast.error(e?.response?.data?.message || e.message || t("admin.leads.toast.saveFailed")) });
  const statusMutation = useMutation({ mutationFn: ({ id, payload }) => leadApi.updateStatus(id, payload), onSuccess: () => { toast.success(t("admin.leads.toast.statusUpdated")); setLostReasonLead(null); setLostReason(""); qc.invalidateQueries({ queryKey: ["leads-admin"] }); }, onError: (e) => toast.error(e?.response?.data?.message || t("admin.leads.toast.statusFailed")) });
  const convertCustomerMutation = useMutation({ mutationFn: addLeadAsCustomer, onSuccess: ({ alreadyExists }) => { toast.success(t(alreadyExists ? "admin.leads.toast.customerUpdated" : "admin.leads.toast.addedToCustomers")); qc.invalidateQueries({ queryKey: ["leads-admin"] }); qc.invalidateQueries({ queryKey: ["customers-admin"] }); }, onError: (e) => toast.error(e?.response?.data?.message || t("admin.leads.toast.addCustomerFailed")) });
  const openCreate = () => { setEditingId(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (lead) => { setEditingId(lead._id); setForm({ ...emptyForm, ...lead, phone: String(lead.phone || "").replace(/\D/g, "").slice(0, 15), category_id: lead.category_id?._id || lead.category_id || "", assigned_employee_id: lead.assigned_employee_id?._id || lead.assigned_employee_id || "", expected_purchase_date: lead.expected_purchase_date?.slice(0, 10) || "", next_follow_up_date: lead.next_follow_up_date?.slice(0, 10) || "", products: (lead.products || []).map((p) => ({ product_id: p.product_id?._id || p.product_id, variant_id: p.variant_id?._id || p.variant_id || "", quantity: p.quantity })) }); setFormOpen(true); };
  const save = (event) => { event.preventDefault(); const payload = { ...form, category_id: form.category_id || null, estimated_deal_value: form.estimated_deal_value === "" ? null : Number(form.estimated_deal_value), assigned_employee_id: form.assigned_employee_id || null, next_follow_up_date: form.next_follow_up_date || null, products: form.products.filter((p) => p.product_id).map((p) => ({ ...p, variant_id: p.variant_id || null })) }; if (payload.lead_type === "Individual") { payload.company_name = ""; payload.business_type = ""; payload.business_address = ""; payload.city = ""; } saveMutation.mutate(payload); };
  const clearFilters = () => { setSearch(""); setFilters({ status: "", lead_type: "", source: "", assigned_employee_id: "" }); setPage(1); };
  const setFilter = (key, value) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })); };
  const changeSearch = (value) => { setPage(1); setSearch(value); };
  const submitLostReason = (event) => { event.preventDefault(); const reason = lostReason.trim(); if (!lostReasonLead || !reason) return; statusMutation.mutate({ id: lostReasonLead._id, payload: { status: "Lost", lost_reason: reason } }); };

  return <div dir={dir} className="admin-leads-page space-y-4 pb-6 text-[var(--text-primary)]">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t("admin.leads.title")}</h1><p className="mt-1 text-xs font-medium text-slate-500">{t("admin.leads.subtitle")}</p></div><button type="button" onClick={openCreate} style={{ marginInlineStart: "auto" }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"><Plus size={16} strokeWidth={2.5} /> {t("admin.leads.add")}</button></header>
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label={t("admin.leads.statistics")}>
      <Stat label={t("admin.leads.stats.total")} value={stats.total || 0} meta={t("admin.leads.stats.allActive")} Icon={Users} tint="bg-blue-100 text-blue-600" />
      <Stat label={t("admin.leads.stats.newThisMonth")} value={stats.newThisMonth || 0} meta={t("admin.leads.stats.recentlyAdded")} Icon={Plus} tint="bg-orange-100 text-orange-500" />
      <Stat label={t("admin.leads.value.qualified")} value={stats.qualified || 0} meta={t("admin.leads.stats.readyForNextStep")} Icon={CheckCircle2} tint="bg-emerald-100 text-emerald-600" />
      <Stat label={t("admin.leads.stats.followUpsDue")} value={stats.followUpsDue || 0} meta={t("admin.leads.stats.needsAttention")} Icon={CalendarClock} tint="bg-rose-100 text-rose-600" />
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="mb-0 grid min-w-0 grid-cols-1 gap-2 border-b border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(220px,1fr)_150px_170px_160px_160px_auto]"><label className="relative"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => changeSearch(e.target.value)} placeholder={t("admin.leads.search.placeholder")} aria-label={t("admin.leads.search.aria")} className="h-10 w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all duration-200 placeholder:font-normal placeholder:text-slate-400 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-blue-200" /></label>
        <FilterDropdown ariaLabel={t("admin.leads.filters.status")} value={filters.status} onChange={(value) => setFilter("status", value)} options={[{ value: "", label: t("admin.leads.filters.statusAll") }, ...["New", "Contacted", "Qualified", "Converted", "Lost"].map((value) => ({ value, label: leadValueLabel(value, t) }))]} />
        <FilterDropdown ariaLabel={t("admin.leads.filters.type")} value={filters.lead_type} onChange={(value) => setFilter("lead_type", value)} options={[{ value: "", label: t("admin.leads.filters.typeAll") }, { value: "Individual", label: leadValueLabel("Individual", t) }, { value: "Business", label: leadValueLabel("Business", t) }]} />
        <FilterDropdown ariaLabel={t("admin.leads.filters.source")} value={filters.source} onChange={(value) => setFilter("source", value)} options={[{ value: "", label: t("admin.leads.filters.sourceAll") }, ...["Walk-in", "Phone Call", "WhatsApp", "Referral", "Email", "Social Media", "Other"].map((value) => ({ value, label: leadValueLabel(value, t) }))]} />
        <FilterDropdown ariaLabel={t("admin.leads.filters.employee")} value={filters.assigned_employee_id} onChange={(value) => setFilter("assigned_employee_id", value)} options={[{ value: "", label: t("admin.leads.filters.employeeAll") }, ...employees.filter((emp) => emp.role !== "admin" && !emp.is_deleted).map((emp) => ({ value: emp._id, label: emp.name }))]} />
        <button type="button" onClick={clearFilters} className="h-10 whitespace-nowrap rounded-2xl border-[1.5px] border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-500 transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]">{t("admin.leads.filters.reset")}</button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-start"><thead className="border-b border-slate-200 bg-slate-100 text-start text-[11px] font-semibold uppercase tracking-wide text-slate-500"><tr>{["Lead", "Type / Company", "Phone", "Source", "Assigned to", "Status", "Next follow-up", "Created", ""].map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-3 text-start">{h ? t(`admin.leads.table.${["lead", "typeCompany", "phone", "source", "assignedTo", "status", "nextFollowUp", "created", "actions"][i]}`) : null}</th>)}</tr></thead><tbody className="divide-y divide-slate-200">
        {isLoading ? <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">{t("admin.leads.loading")}</td></tr> : isError ? <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-[var(--danger-text)]">{error?.response?.data?.message || t("admin.leads.loadFailed")}<button onClick={() => qc.invalidateQueries({ queryKey: ["leads-admin"] })} className="ms-2 underline">{t("common.retry")}</button></td></tr> : !leads.length ? <tr><td colSpan={9} className="px-3 py-12"><div className="flex flex-col items-center justify-center text-center"><span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Users size={18} /></span><p className="text-xs font-semibold">{search || Object.values(filters).some(Boolean) ? t("admin.leads.empty.searchTitle") : t("admin.leads.empty.title")}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{search || Object.values(filters).some(Boolean) ? t("admin.leads.empty.searchDescription") : t("admin.leads.empty.description")}</p><button type="button" onClick={search || Object.values(filters).some(Boolean) ? clearFilters : openCreate} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3 text-[10px] font-semibold text-[var(--accent)] transition-all hover:-translate-y-0.5 hover:shadow-md">{search || Object.values(filters).some(Boolean) ? <><X size={12} /> {t("admin.leads.filters.clear")}</> : <><Plus size={12} /> {t("admin.leads.add")}</>}</button></div></td></tr> : leads.map((lead) => <tr key={lead._id} onClick={() => router.push(`/admin/leads/${lead._id}`)} className="cursor-pointer border-b border-slate-200 transition-colors duration-150 hover:bg-blue-50/60"><td className="px-4 py-2.5"><p className="text-xs font-semibold">{lead.name}</p><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{lead.lead_number}</p></td><td className="px-4 py-2.5 text-xs">{leadValueLabel(lead.lead_type, t)}<span className="block max-w-32 truncate text-[10px] text-[var(--text-muted)]">{lead.company_name || t("common.notProvided")}</span></td><td className="px-4 py-2.5 text-xs">{lead.phone}<span className="block max-w-36 truncate text-[10px] text-[var(--text-muted)]">{lead.email || ""}</span></td><td className="px-4 py-2.5 text-xs">{leadValueLabel(lead.source, t)}</td><td className="px-4 py-2.5 text-xs">{lead.assigned_employee_id?.name || t("admin.leads.value.unassigned")}</td><td className="px-4 py-2.5"><span className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusTone[lead.status] || statusTone.New}`}>{leadValueLabel(lead.status, t)}</span></td><td className="px-4 py-2.5 text-xs">{date(lead.next_follow_up_date, locale, t)}</td><td className="px-4 py-2.5 text-xs">{date(lead.created_at, locale, t)}</td><td className="w-12 whitespace-nowrap px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}><div className="flex justify-end"><RowActions lead={lead} onView={() => router.push(`/admin/leads/${lead._id}`)} onEdit={() => openEdit(lead)} onStatusChange={(status) => { if (status === "Lost") { setLostReasonLead(lead); setLostReason(""); return; } statusMutation.mutate({ id: lead._id, payload: { status } }); }} onAddCustomer={() => convertCustomerMutation.mutate(lead)} isConvertingCustomer={convertCustomerMutation.isPending && convertCustomerMutation.variables?._id === lead._id} /></div></td></tr>)}</tbody></table></div>
      {pagination.total > 20 && <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] text-slate-500"><span>{t("admin.leads.pagination.showing", { from: pagination.total ? (pagination.page - 1) * pagination.limit + 1 : 0, to: Math.min(pagination.page * pagination.limit, pagination.total), total: pagination.total })}</span><div className="flex items-center gap-1"><button disabled={!pagination.hasPrev} onClick={() => setPage((p) => p - 1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-40" aria-label={t("admin.leads.pagination.previous")}><ChevronLeft size={14} /></button><span className="px-2">{t("admin.leads.pagination.page", { page: pagination.page || page, pages: Math.max(1, pagination.pages || 1) })}</span><button disabled={!pagination.hasNext} onClick={() => setPage((p) => p + 1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-40" aria-label={t("admin.leads.pagination.next")}><ChevronRight size={14} /></button></div></div>}
    </section><LeadFormModal open={formOpen} form={form} setForm={setForm} editing={!!editingId} isPending={saveMutation.isPending} onSave={save} onClose={() => setFormOpen(false)} />
    {lostReasonLead && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !statusMutation.isPending) setLostReasonLead(null); }}><form onSubmit={submitLostReason} className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-2xl"><div className="mb-4"><h2 className="text-base font-bold text-[var(--text-primary)]">{t("admin.leads.lost.title")}</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{t("admin.leads.lost.description", { name: lostReasonLead.name })}</p></div><label className="block text-xs font-semibold text-[var(--text-secondary)]">{t("admin.leads.lost.reason")} <span className="text-[var(--danger-text)]">*</span><textarea autoFocus required maxLength={1000} value={lostReason} onChange={(event) => setLostReason(event.target.value)} placeholder={t("admin.leads.lost.placeholder")} rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={statusMutation.isPending} onClick={() => setLostReasonLead(null)} className="h-9 rounded-xl border border-[var(--border-color)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50">{t("common.cancel")}</button><button type="submit" disabled={!lostReason.trim() || statusMutation.isPending} className="h-9 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{statusMutation.isPending ? t("admin.leads.modal.saving") : t("admin.leads.lost.confirm")}</button></div></form></div>}
  </div>;
}

function Stat({ label, value, meta, Icon, tint = "bg-blue-100 text-blue-600" }) { const { locale } = useTranslation(); return <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${tint}`}><Icon size={20} /></span><div className="min-w-0"><p className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-0.5 text-xl font-semibold leading-tight text-slate-900">{value.toLocaleString(locale)}</p><p className="mt-1 truncate text-[10px] font-medium text-slate-500">{meta}</p></div></article>; }
function RowActions({ lead, onView, onEdit, onStatusChange, onAddCustomer, onOpenCustomer, isConvertingCustomer }) {
  const { t, dir } = useTranslation();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const toggle = (event) => {
    event.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 176;
    const menuHeight = 180;
    const top = window.innerHeight - rect.bottom < menuHeight + 8
      ? Math.max(8, rect.top - menuHeight - 4)
      : Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8);
    const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
    const left = dir === "rtl"
      ? Math.min(Math.max(8, rect.left), maxLeft)
      : Math.min(Math.max(8, rect.right - menuWidth), maxLeft);
    setPosition({ top, left });
    setOpen(true);
  };
  const runAction = (action) => (event) => { event.stopPropagation(); setOpen(false); action(); };

  return <>
    <button ref={buttonRef} type="button" onClick={toggle} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--bg-row-hover)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" aria-label={t("admin.leads.actions.for", { name: lead.name })} aria-haspopup="menu" aria-expanded={open}><MoreVertical size={18} /></button>
    {open && createPortal(<div ref={menuRef} role="menu" className="fixed z-[9999] w-44 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] py-1 shadow-xl shadow-slate-900/15" style={position}>
      <button type="button" role="menuitem" onClick={runAction(onView)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs hover:bg-[var(--bg-tertiary)]"><Eye size={13} /> {t("admin.leads.actions.viewDetails")}</button>
      {lead.status !== "Lost" && lead.status !== "Converted" && <button type="button" role="menuitem" onClick={runAction(onEdit)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs hover:bg-[var(--bg-tertiary)]"><Pencil size={13} /> {t("common.edit")}</button>}
      <div className="my-1 border-t border-[var(--border-color)]" />
      {(nextLeadStatuses[lead.status || "New"] || []).map((status) => <button key={status} type="button" role="menuitem" onClick={runAction(() => onStatusChange(status))} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--bg-tertiary)]"><span>{leadValueLabel(status, t)}</span><ChevronRight size={13} /></button>)}
      {lead.status === "Converted" && <button type="button" role="menuitem" onClick={runAction(() => onStatusChange("Lost"))} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-medium text-[var(--danger-text)] transition hover:bg-[var(--bg-tertiary)]">{leadValueLabel("Lost", t)}</button>}
      {lead.status === "Converted" && !lead.customer_added && <button type="button" role="menuitem" disabled={isConvertingCustomer} onClick={runAction(onAddCustomer)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--bg-tertiary)] disabled:opacity-60">{isConvertingCustomer ? t("admin.leads.actions.addingCustomer") : t("admin.leads.actions.addAsCustomer")}<ChevronRight size={13} className="ms-auto" /></button>}
      {lead.status !== "Converted" && previousLeadStatus[lead.status] && <button type="button" role="menuitem" onClick={runAction(() => onStatusChange(previousLeadStatus[lead.status]))} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs text-[var(--danger-text)] transition hover:bg-[var(--bg-tertiary)]"><span>{t("admin.leads.actions.revertTo", { status: leadValueLabel(previousLeadStatus[lead.status], t) })}</span></button>}
    </div>, document.body)}
  </>;
}

function FilterDropdown({ value, options, onChange, ariaLabel }) {
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

  return <div className="relative min-w-0" ref={dropdownRef}>
    <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex h-10 w-full min-w-0 items-center gap-2 rounded-2xl border-[1.5px] border-slate-200 bg-white px-3 text-start text-sm font-medium text-slate-700 shadow-sm outline-none transition-all hover:shadow-md focus:border-blue-400 focus:ring-2 focus:ring-blue-200">
      <span className="min-w-0 flex-1 truncate">{selectedOption?.label || t("admin.leads.ui.selectAnOption")}</span>
      <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div className="absolute start-0 top-full z-[70] mt-2 min-w-full overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1 shadow-xl shadow-slate-900/10 ring-1 ring-black/5">
      <div role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto">{options.map((option) => {
        const selected = String(option.value) === String(value);
        return <button key={option.value || "all"} type="button" role="option" aria-selected={selected} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-xs transition ${selected ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-card-alt)] hover:text-[var(--text-primary)]"}`}><span className="truncate">{option.label}</span>{selected && <Check size={14} className="shrink-0 text-blue-600" />}</button>;
      })}</div>
    </div>}
  </div>;
}
