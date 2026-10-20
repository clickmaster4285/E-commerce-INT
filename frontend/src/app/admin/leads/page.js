"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadApi } from "@/apis/admin/leadApi";
import { addLeadAsCustomer } from "@/lib/addLeadAsCustomer";
import { employeeApi } from "@/apis/admin/employeeApi";
import LeadFormModal from "@/components/admin/LeadFormModal";
import { toast } from "sonner";
import { CalendarClock, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ContactRound, Eye, MoreHorizontal, Pencil, Plus, Search, Users, X } from "lucide-react";

const emptyForm = { lead_type: "Individual", name: "", phone: "", email: "", company_name: "", business_type: "", business_address: "", city: "", source: "Other", status: "New", assigned_employee_id: "", estimated_deal_value: "", expected_purchase_date: "", next_follow_up_date: "", products: [], custom_requirements: "", notes: "" };
const PAGE_SIZE = 20;
const date = (v) => v ? new Date(v).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "—";
const statusTone = { New: "bg-[var(--accent-soft)] text-[var(--accent)]", Contacted: "bg-blue-100 text-blue-700", Qualified: "bg-amber-100 text-amber-800", Customer: "bg-[var(--success-soft)] text-[var(--success-text)]", Converted: "bg-[var(--success-soft)] text-[var(--success-text)]", Lost: "bg-[var(--danger-soft)] text-[var(--danger-text)]" };
const nextLeadStatuses = { New: ["Contacted"], Contacted: ["Qualified", "Lost"] };
const previousLeadStatus = { Contacted: "New", Qualified: "Contacted" };

export default function LeadsPage() {
  const router = useRouter(); const qc = useQueryClient();
  const [search, setSearch] = useState(""); const [filters, setFilters] = useState({ status: "", lead_type: "", source: "", assigned_employee_id: "" }); const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm); const [editingId, setEditingId] = useState(null); const [formOpen, setFormOpen] = useState(false);
  const [lostReasonLead, setLostReasonLead] = useState(null); const [lostReason, setLostReason] = useState("");
  const { data, isLoading, isError, error } = useQuery({ queryKey: ["leads-admin", search, filters, page], queryFn: () => leadApi.list({ search, ...filters, page, limit: PAGE_SIZE }), keepPreviousData: true });
  const { data: employeeData } = useQuery({ queryKey: ["lead-list-employees"], queryFn: () => employeeApi.getAll() });
  const employees = Array.isArray(employeeData) ? employeeData : employeeData?.data || employeeData?.items || [];
  const leads = data?.data || []; const stats = data?.stats || {}; const pagination = data?.pagination || { total: 0, pages: 1, page: 1, limit: PAGE_SIZE };
  const totalPages = Math.max(1, pagination.pages || 1);
  const currentPage = Math.min(page, totalPages);
  const pageStart = Math.max(1, Math.min(currentPage - 1, totalPages - 3));
  const pageNumbers = Array.from({ length: Math.min(4, totalPages) }, (_, index) => pageStart + index);
  const saveMutation = useMutation({ mutationFn: (payload) => editingId ? leadApi.update(editingId, payload) : leadApi.create(payload), onSuccess: () => { toast.success(editingId ? "Lead updated" : "Lead created"); setFormOpen(false); setForm(emptyForm); setEditingId(null); qc.invalidateQueries({ queryKey: ["leads-admin"] }); qc.invalidateQueries({ queryKey: ["lead-detail"] }); }, onError: (e) => toast.error(e?.response?.data?.message || e.message || "Lead could not be saved") });
  const statusMutation = useMutation({ mutationFn: ({ id, payload }) => leadApi.updateStatus(id, payload), onSuccess: () => { toast.success("Lead status updated"); setLostReasonLead(null); setLostReason(""); qc.invalidateQueries({ queryKey: ["leads-admin"] }); }, onError: (e) => toast.error(e?.response?.data?.message || "Status update failed") });
  const convertCustomerMutation = useMutation({ mutationFn: addLeadAsCustomer, onSuccess: ({ alreadyExists }) => { toast.success(alreadyExists ? "Customer details updated" : "Lead added to Customers"); qc.invalidateQueries({ queryKey: ["leads-admin"] }); qc.invalidateQueries({ queryKey: ["customers-admin"] }); }, onError: (e) => toast.error(e?.response?.data?.message || "Could not add lead as a customer") });
  const openCreate = () => { setEditingId(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (lead) => { setEditingId(lead._id); setForm({ ...emptyForm, ...lead, status: lead.status === "Converted" ? "Customer" : lead.status, phone: String(lead.phone || "").replace(/\D/g, "").slice(0, 15), category_id: lead.category_id?._id || lead.category_id || "", assigned_employee_id: lead.assigned_employee_id?._id || lead.assigned_employee_id || "", expected_purchase_date: lead.expected_purchase_date?.slice(0, 10) || "", next_follow_up_date: lead.next_follow_up_date?.slice(0, 10) || "", products: (lead.products || []).map((p) => ({ product_id: p.product_id?._id || p.product_id, variant_id: p.variant_id?._id || p.variant_id || "", quantity: p.quantity })) }); setFormOpen(true); };
  const save = (event) => { event.preventDefault(); const payload = { ...form, category_id: form.category_id || null, estimated_deal_value: form.estimated_deal_value === "" ? null : Number(form.estimated_deal_value), assigned_employee_id: form.assigned_employee_id || null, next_follow_up_date: form.next_follow_up_date || null, products: form.products.filter((p) => p.product_id).map((p) => ({ ...p, variant_id: p.variant_id || null })) }; if (payload.lead_type === "Individual") { payload.company_name = ""; payload.business_type = ""; payload.business_address = ""; payload.city = ""; } saveMutation.mutate(payload); };
  const clearFilters = () => { setSearch(""); setFilters({ status: "", lead_type: "", source: "", assigned_employee_id: "" }); setPage(1); };
  const setFilter = (key, value) => { setPage(1); setFilters((current) => ({ ...current, [key]: value })); };
  const changeSearch = (value) => { setPage(1); setSearch(value); };
  const submitLostReason = (event) => { event.preventDefault(); const reason = lostReason.trim(); if (!lostReasonLead || !reason) return; statusMutation.mutate({ id: lostReasonLead._id, payload: { status: "Lost", lost_reason: reason } }); };

  return <div className="min-h-full space-y-4 p-1 text-[var(--text-primary)] sm:space-y-5 sm:p-2 lg:p-3">
    <header className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><ContactRound size={23} /></span><div><h1 className="text-xl font-bold tracking-tight sm:text-2xl">Leads</h1><p className="mt-0.5 text-xs text-[var(--text-muted)] sm:text-sm">Track prospective customers and their next steps.</p></div></div><button type="button" onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow transition-all hover:-translate-y-0.5"><Plus size={16} /> Add Lead</button></header>
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Lead statistics">
      <Stat label="Total Leads" value={stats.total || 0} meta="All active leads" Icon={Users} />
      <Stat label="New This Month" value={stats.newThisMonth || 0} meta="Recently added" Icon={Plus} />
      <Stat label="Qualified" value={stats.qualified || 0} meta="Ready for next step" Icon={CheckCircle2} />
      <Stat label="Follow-ups Due" value={stats.followUpsDue || 0} meta="Needs attention" Icon={CalendarClock} />
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-lg shadow-slate-900/5">
      <div className="grid gap-2 border-b border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(125px,1fr))_auto]"><label className="relative"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => changeSearch(e.target.value)} placeholder="Search name, phone, email, company…" aria-label="Search leads" className="h-10 w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-900 shadow-sm outline-none transition-all duration-200 placeholder:font-normal placeholder:text-slate-400 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-blue-200" /></label>
        <FilterDropdown ariaLabel="Filter status" value={filters.status} onChange={(value) => setFilter("status", value)} options={[{ value: "", label: "Status: All" }, ...["New", "Contacted", "Qualified", "Customer", "Lost"].map((value) => ({ value, label: value }))]} />
        <FilterDropdown ariaLabel="Filter lead type" value={filters.lead_type} onChange={(value) => setFilter("lead_type", value)} options={[{ value: "", label: "Type: All" }, { value: "Individual", label: "Individual" }, { value: "Business", label: "Business" }]} />
        <FilterDropdown ariaLabel="Filter source" value={filters.source} onChange={(value) => setFilter("source", value)} options={[{ value: "", label: "Source: All" }, ...["Walk-in", "Phone Call", "WhatsApp", "Referral", "Email", "Social Media", "Other"].map((value) => ({ value, label: value }))]} />
        <FilterDropdown ariaLabel="Filter assigned employee" value={filters.assigned_employee_id} onChange={(value) => setFilter("assigned_employee_id", value)} options={[{ value: "", label: "Employee: All" }, ...employees.filter((emp) => emp.role !== "admin" && !emp.is_deleted).map((emp) => ({ value: emp._id, label: emp.name }))]} />
        <button type="button" onClick={clearFilters} className="h-10 rounded-2xl border-[1.5px] border-[#e2e8f0] bg-white px-4 text-[13px] font-extrabold text-slate-500 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]">Reset</button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-[13px]"><thead className="border-b border-slate-200 bg-slate-100"><tr>{["Lead", "Type / Company", "Phone", "Source", "Assigned to", "Status", "Next follow-up", "Created", ""].map((h, i) => <th key={i} className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{h}</th>)}</tr></thead><tbody>
        {isLoading ? <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-[var(--text-muted)]">Loading leads…</td></tr> : isError ? <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-[var(--danger-text)]">{error?.response?.data?.message || "Could not load leads. Please try again."}<button onClick={() => qc.invalidateQueries({ queryKey: ["leads-admin"] })} className="ml-2 underline">Retry</button></td></tr> : !leads.length ? <tr><td colSpan={9} className="px-3 py-7"><div className="flex flex-col items-center justify-center text-center"><span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Users size={18} /></span><p className="text-xs font-semibold">{search || Object.values(filters).some(Boolean) ? "No matching leads" : "No leads yet"}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{search || Object.values(filters).some(Boolean) ? "Try another search or clear your filters." : "Add your first lead to start tracking potential customers."}</p><button type="button" onClick={search || Object.values(filters).some(Boolean) ? clearFilters : openCreate} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3 text-[10px] font-semibold text-[var(--accent)] transition-all hover:-translate-y-0.5 hover:shadow-md">{search || Object.values(filters).some(Boolean) ? <><X size={12} /> Clear filters</> : <><Plus size={12} /> Add Lead</>}</button></div></td></tr> : leads.map((lead) => { const displayStatus = lead.status === "Converted" ? "Customer" : lead.status; return <tr key={lead._id} onClick={() => router.push(`/admin/leads/${lead._id}`)} className="cursor-pointer border-t border-[var(--border-color)] hover:bg-[var(--bg-row-hover)]"><td className="px-3 py-3"><p className="text-xs font-semibold">{lead.name}</p><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{lead.lead_number}</p></td><td className="px-3 py-3 text-xs">{lead.lead_type}<span className="block max-w-32 truncate text-[10px] text-[var(--text-muted)]">{lead.company_name || "—"}</span></td><td className="px-3 py-3 text-xs">{lead.phone}<span className="block max-w-36 truncate text-[10px] text-[var(--text-muted)]">{lead.email || ""}</span></td><td className="px-3 py-3 text-xs">{lead.source}</td><td className="px-3 py-3 text-xs">{lead.assigned_employee_id?.name || "Unassigned"}</td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${statusTone[displayStatus] || statusTone.New}`}>{displayStatus}</span></td><td className="px-3 py-3 text-xs">{date(lead.next_follow_up_date)}</td><td className="px-3 py-3 text-xs">{date(lead.created_at)}</td><td className="px-3 py-3" onClick={(e) => e.stopPropagation()}><RowActions lead={lead} onView={() => router.push(`/admin/leads/${lead._id}`)} onEdit={() => openEdit(lead)} onStatusChange={(status) => { if (status === "Lost") { setLostReasonLead(lead); setLostReason(""); return; } statusMutation.mutate({ id: lead._id, payload: { status } }); }} onAddCustomer={() => convertCustomerMutation.mutate(lead)} isConvertingCustomer={convertCustomerMutation.isPending && convertCustomerMutation.variables?._id === lead._id} /></td></tr>; })}</tbody></table></div>
      {pagination.total > PAGE_SIZE && <footer className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px] text-slate-500"><span>Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, pagination.total)} of {pagination.total} leads</span><nav aria-label="Leads pagination" className="flex items-center gap-1"><button type="button" disabled={!pagination.hasPrev} onClick={() => setPage((value) => Math.max(1, value - 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={14} /></button>{pageNumbers.map((pageNumber) => <button key={pageNumber} type="button" aria-current={currentPage === pageNumber ? "page" : undefined} onClick={() => setPage(pageNumber)} className={`h-8 min-w-8 rounded-md border px-2 text-[13px] font-bold transition ${currentPage === pageNumber ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}>{pageNumber}</button>)}<button type="button" disabled={!pagination.hasNext} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white transition hover:border-blue-300 hover:text-blue-600 disabled:opacity-40" aria-label="Next page"><ChevronRight size={14} /></button></nav></footer>}
    </section><LeadFormModal open={formOpen} form={form} setForm={setForm} editing={!!editingId} isPending={saveMutation.isPending} onSave={save} onClose={() => setFormOpen(false)} />
    {lostReasonLead && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !statusMutation.isPending) setLostReasonLead(null); }}><form onSubmit={submitLostReason} className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-2xl"><div className="mb-4"><h2 className="text-base font-bold text-[var(--text-primary)]">Mark lead as lost</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Add a reason for {lostReasonLead.name} before changing the status.</p></div><label className="block text-xs font-semibold text-[var(--text-secondary)]">Lost reason <span className="text-[var(--danger-text)]">*</span><textarea autoFocus required maxLength={1000} value={lostReason} onChange={(event) => setLostReason(event.target.value)} placeholder="Why was this lead lost?" rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={statusMutation.isPending} onClick={() => setLostReasonLead(null)} className="h-9 rounded-xl border border-[var(--border-color)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50">Cancel</button><button type="submit" disabled={!lostReason.trim() || statusMutation.isPending} className="h-9 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{statusMutation.isPending ? "Saving…" : "Confirm lost"}</button></div></form></div>}
  </div>;
}

function Stat({ label, value, meta, Icon }) { return <div className="group flex min-w-0 items-center gap-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/30 hover:shadow-lg sm:p-5"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm transition-transform duration-200 group-hover:scale-105"><Icon size={19} /></span><div className="min-w-0"><p className="truncate text-xs font-semibold text-[var(--text-muted)]">{label}</p><div className="mt-1 flex flex-wrap items-baseline gap-x-2.5"><span className="text-2xl font-extrabold leading-none tracking-tight">{value.toLocaleString()}</span><span className="text-[10px] font-medium text-[var(--text-muted)]">{meta}</span></div></div></div>; }
function RowActions({ lead, onView, onEdit, onStatusChange, onAddCustomer, onOpenCustomer, isConvertingCustomer }) {
  const router = useRouter();
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
    const menuHeight = 240;
    const top = window.innerHeight - rect.bottom < menuHeight + 8
      ? Math.max(8, rect.top - menuHeight - 4)
      : Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8);
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    setPosition({ top, left });
    setOpen(true);
  };
  const runAction = (action) => (event) => { event.stopPropagation(); setOpen(false); action(); };

  return <>
    <button ref={buttonRef} type="button" onClick={toggle} className="rounded-md p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-row-hover)]" aria-label={`Actions for ${lead.name}`} aria-haspopup="menu" aria-expanded={open}><MoreHorizontal size={16} /></button>
    {open && createPortal(<div ref={menuRef} role="menu" className="fixed z-[9999] w-44 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] py-1 shadow-xl shadow-slate-900/15" style={position}>
      <button type="button" role="menuitem" onClick={runAction(onView)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--bg-tertiary)]"><Eye size={13} /> View details</button>
      {(lead.status === "Customer" || lead.status === "Converted") && lead.customer_id && <>
        <button type="button" role="menuitem" onClick={runAction(() => router.push(`/admin/quotes/new?customer=${lead.customer_id?._id || lead.customer_id}`))} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--bg-tertiary)]"><ContactRound size={13} /> Create quote</button>
        <button type="button" role="menuitem" onClick={runAction(() => router.push(`/admin/invoices/new?customer=${lead.customer_id?._id || lead.customer_id}`))} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--bg-tertiary)]"><ContactRound size={13} /> Create invoice</button>
      </>}
      {lead.status !== "Lost" && lead.status !== "Customer" && lead.status !== "Converted" && <button type="button" role="menuitem" onClick={runAction(onEdit)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-[var(--bg-tertiary)]"><Pencil size={13} /> Edit</button>}
      <div className="my-1 border-t border-[var(--border-color)]" />
      {(nextLeadStatuses[lead.status || "New"] || []).map((status) => <button key={status} type="button" role="menuitem" onClick={runAction(() => onStatusChange(status))} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--bg-tertiary)]"><span>{status}</span><ChevronRight size={13} /></button>)}
      {lead.status === "Qualified" && !lead.customer_added && <button type="button" role="menuitem" disabled={isConvertingCustomer} onClick={runAction(onAddCustomer)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--bg-tertiary)] disabled:opacity-60">{isConvertingCustomer ? "Converting…" : "Convert to customer"}<ChevronRight size={13} className="ml-auto" /></button>}
      {previousLeadStatus[lead.status] && <button type="button" role="menuitem" onClick={runAction(() => onStatusChange(previousLeadStatus[lead.status]))} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-[var(--danger-text)] transition hover:bg-[var(--bg-tertiary)]"><span>Revert to {previousLeadStatus[lead.status]}</span></button>}
    </div>, document.body)}
  </>;
}

function FilterDropdown({ value, options, onChange, ariaLabel }) {
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
    <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-left text-xs font-medium text-[var(--text-primary)] shadow-sm outline-none transition hover:border-blue-300 hover:bg-[var(--bg-card-alt)] focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
      <span className="min-w-0 flex-1 truncate">{selectedOption?.label || "Select an option"}</span>
      <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div className="absolute left-0 top-full z-[70] mt-2 min-w-full overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-1 shadow-xl shadow-slate-900/10 ring-1 ring-black/5">
      <div role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto">{options.map((option) => {
        const selected = String(option.value) === String(value);
        return <button key={option.value || "all"} type="button" role="option" aria-selected={selected} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition ${selected ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-card-alt)] hover:text-[var(--text-primary)]"}`}><span className="truncate">{option.label}</span>{selected && <Check size={14} className="shrink-0 text-blue-600" />}</button>;
      })}</div>
    </div>}
  </div>;
}
