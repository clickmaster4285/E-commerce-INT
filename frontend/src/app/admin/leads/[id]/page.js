"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadApi } from "@/apis/admin/leadApi";
import { addLeadAsCustomer } from "@/lib/addLeadAsCustomer";
<<<<<<< HEAD
import LeadFormModal from "@/components/admin/LeadFormModal";
=======
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";
>>>>>>> 2e3f0d01943d374997bd89fc3c0e0f7e0754f66e
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Building2, CalendarDays, CheckCircle2, FilePlus2,
  ChevronRight, ContactRound, Eye, History, Mail, MapPin, Pencil, Phone,
  RotateCcw, StickyNote, Tag, UserRound, Users,
} from "lucide-react";

<<<<<<< HEAD
const nextStatuses = { New: ["Contacted"], Contacted: ["Qualified", "Lost"] };
const previousStatus = { Contacted: "New", Qualified: "Contacted" };
const statusTone = {
  New: "bg-[var(--accent-soft)] text-[var(--accent)]",
  Contacted: "bg-blue-100 text-blue-700",
  Qualified: "bg-amber-100 text-amber-800",
  Customer: "bg-[var(--success-soft)] text-[var(--success-text)]",
  Converted: "bg-[var(--success-soft)] text-[var(--success-text)]",
  Lost: "bg-[var(--danger-soft)] text-[var(--danger-text)]",
};
const dateOnly = (value) => value && !Number.isNaN(new Date(value).getTime())
  ? new Date(value).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })
  : "—";
const dateTime = (value) => value && !Number.isNaN(new Date(value).getTime())
  ? new Date(value).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  : "—";

const money = (value) => `Rs. ${(Number(value) || 0).toLocaleString()}`;
=======
const activityTypes = ["Call", "WhatsApp", "Email", "Meeting", "Other"];
const nextStatuses = { New: ["Contacted"], Contacted: ["Qualified"], Qualified: ["Converted", "Lost"], Converted: ["Lost"] };
const previousStatus = { Contacted: "New", Qualified: "Contacted", Converted: "Qualified" };
const statusTone = { New: "bg-[var(--accent-soft)] text-[var(--accent)]", Contacted: "bg-blue-100 text-blue-700", Qualified: "bg-amber-100 text-amber-800", Converted: "bg-[var(--success-soft)] text-[var(--success-text)]", Lost: "bg-[var(--danger-soft)] text-[var(--danger-text)]" };
const leadValueKey = (value) => `admin.leads.value.${String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
const leadValueLabel = (value, t) => { const key = leadValueKey(value); const label = t(key); return label === key ? (String(value || "").replaceAll("_", " ") || t("common.notProvided")) : label; };
const activityValueKey = (value) => `admin.leads.activity.${String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
const activityLabel = (value, t) => { const key = activityValueKey(value); const label = t(key); return label === key ? (String(value || "").replaceAll("_", " ") || t("common.notProvided")) : label; };
const dateOnly = (value, locale, t) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }) : t("common.notProvided");
const dateTime = (value, locale, t) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : t("common.notProvided");
const currency = (value, locale, t) => value == null ? t("admin.leads.ui.notEstimated") : `Rs. ${Number(value).toLocaleString(locale)}`;
>>>>>>> 2e3f0d01943d374997bd89fc3c0e0f7e0754f66e

export default function LeadDetailPage({ params }) {
  const { t, locale, dir } = useTranslation();
  const { productNameOf } = useLocalized();
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [lostReasonOpen, setLostReasonOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [historyTab, setHistoryTab] = useState("overview");
  const { data: lead, isLoading, isError, error } = useQuery({
    queryKey: ["lead-detail", id],
    queryFn: () => leadApi.getById(id),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["lead-detail", id] });
    qc.invalidateQueries({ queryKey: ["leads-admin"] });
    qc.invalidateQueries({ queryKey: ["customers-admin"] });
  };
  const statusMutation = useMutation({
    mutationFn: (payload) => leadApi.updateStatus(id, payload),
<<<<<<< HEAD
    onSuccess: () => {
      toast.success("Lead status updated");
      setLostReasonOpen(false);
      setLostReason("");
      refresh();
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Status update failed"),
  });
  const customerMutation = useMutation({
    mutationFn: addLeadAsCustomer,
    onSuccess: ({ alreadyExists }) => {
      toast.success(alreadyExists ? "Customer details updated" : "Lead added to Customers");
      refresh();
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Could not add lead as a customer"),
=======
    onSuccess: () => { toast.success(t("admin.leads.toast.statusUpdated")); setLostReasonOpen(false); setLostReason(""); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message || t("admin.leads.toast.statusFailed")),
  });
  const activityMutation = useMutation({
    mutationFn: (payload) => leadApi.addActivity(id, payload),
    onSuccess: () => { toast.success(t("admin.leads.toast.activityRecorded")); setActivity({ type: "Call", notes: "", follow_up_date: "" }); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message || t("admin.leads.toast.activityFailed")),
  });
  const customerMutation = useMutation({
    mutationFn: addLeadAsCustomer,
    onSuccess: ({ alreadyExists }) => { toast.success(t(alreadyExists ? "admin.leads.toast.customerUpdated" : "admin.leads.toast.addedToCustomers")); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message || t("admin.leads.toast.addCustomerFailed")),
>>>>>>> 2e3f0d01943d374997bd89fc3c0e0f7e0754f66e
  });
  const editMutation = useMutation({
    mutationFn: (payload) => leadApi.update(id, payload),
    onSuccess: () => {
      toast.success("Lead updated");
      setEditOpen(false);
      refresh();
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Lead could not be updated"),
  });

  if (isLoading) return <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-muted)]">{t("admin.leads.ui.loadingLeadDetails")}</div>;
  if (isError || !lead) return <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center"><p className="text-sm font-semibold">{error?.response?.data?.message || t("admin.leads.ui.leadNotFound")}</p><Link href="/admin/leads" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"><ArrowLeft size={14} /> {t("admin.leads.ui.backToLeads")}</Link></div>;

  const changeStatus = (status) => {
    if (status === "Lost") {
      setLostReason(lead.lost_reason || "");
      setLostReasonOpen(true);
      return;
    }
    statusMutation.mutate({ status });
  };
  const submitLostReason = (event) => {
    event.preventDefault();
    if (!lostReason.trim()) return;
    statusMutation.mutate({ status: "Lost", lost_reason: lostReason.trim() });
  };
  const openEdit = () => {
    setEditForm({
      ...lead,
      status: lead.status === "Converted" ? "Customer" : lead.status,
      phone: String(lead.phone || "").replace(/\D/g, "").slice(0, 15),
      category_id: lead.category_id?._id || lead.category_id || "",
      assigned_employee_id: lead.assigned_employee_id?._id || lead.assigned_employee_id || "",
      expected_purchase_date: lead.expected_purchase_date?.slice(0, 10) || "",
      next_follow_up_date: lead.next_follow_up_date?.slice(0, 10) || "",
      products: (lead.products || []).map((item) => ({
        product_id: item.product_id?._id || item.product_id,
        variant_id: item.variant_id?._id || item.variant_id || "",
        quantity: item.quantity,
      })),
    });
    setEditOpen(true);
  };
  const saveEdit = (event) => {
    event.preventDefault();
    const payload = {
      ...editForm,
      category_id: editForm.category_id || null,
      estimated_deal_value: editForm.estimated_deal_value === "" ? null : Number(editForm.estimated_deal_value),
      assigned_employee_id: editForm.assigned_employee_id || null,
      next_follow_up_date: editForm.next_follow_up_date || null,
      expected_purchase_date: editForm.expected_purchase_date || null,
      products: (editForm.products || []).filter((item) => item.product_id).map((item) => ({ ...item, variant_id: item.variant_id || null })),
    };
    if (payload.lead_type === "Individual") {
      payload.company_name = "";
      payload.business_type = "";
      payload.business_address = "";
      payload.city = "";
    }
    editMutation.mutate(payload);
  };

  const status = lead.status === "Converted" ? "Customer" : lead.status;
  const isCustomer = status === "Customer" && Boolean(lead.customer_id);
  const journeyStages = ["New", "Contacted", "Qualified", "Customer"];
  const journeyIndex = status === "Lost" ? 1 : Math.max(0, journeyStages.indexOf(status));
  const next = nextStatuses[lead.status] || [];
  const previous = previousStatus[lead.status];
  const displayName = lead.lead_type === "Business" && lead.company_name ? lead.company_name : lead.name;
  const historyItems = [
    ...(lead.history || []).map((entry) => ({ ...entry, key: `history-${entry._id}`, details: "" })),
    ...(lead.activities || []).map((entry) => ({
      key: `activity-${entry._id}`,
      action: "activity",
      summary: `${entry.type} activity recorded`,
      details: entry.notes,
      employee_id: entry.employee_id,
      employee_name: entry.employee_name,
      created_at: entry.created_at,
      changes: entry.follow_up_date ? [{ field: "Follow-up date", from: "—", to: dateOnly(entry.follow_up_date) }] : [],
    })),
  ];
  if (!historyItems.some((entry) => entry.action === "created")) {
    historyItems.push({
      key: "history-created-fallback",
      action: "created",
      summary: "Lead created",
      employee_name: "System record",
      created_at: lead.created_at,
      changes: [],
    });
  }
  historyItems.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

<<<<<<< HEAD
  return <div className="min-h-full w-full space-y-4 p-1 pb-6 text-[var(--text-primary)] sm:space-y-5 sm:p-2 lg:p-3">
    <header className="overflow-hidden rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
      <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500" />
      <div className="flex flex-wrap items-center justify-between gap-5 p-5 sm:p-7">
        <div className="min-w-0">
          <Link href="/admin/leads" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--accent)]"><ArrowLeft size={14} /> All leads</Link>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><ContactRound size={23} /></span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{displayName}</h1>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]"><span>{lead.lead_number}</span><span aria-hidden="true">·</span><span>{lead.lead_type} lead</span>{lead.lead_type === "Business" && lead.company_name ? <><span aria-hidden="true">·</span><span>Contact: {lead.name}</span></> : null}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${statusTone[status] || statusTone.New}`}>{status}</span>
          {status !== "Customer" && <button type="button" onClick={openEdit} className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"><Pencil size={14} /> Edit lead</button>}
          {next.map((nextStatus) => <button key={nextStatus} type="button" disabled={statusMutation.isPending} onClick={() => changeStatus(nextStatus)} className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition disabled:opacity-50 ${nextStatus === "Lost" ? "border border-[var(--danger)]/25 text-[var(--danger-text)] hover:bg-[var(--danger-soft)]" : "bg-[var(--accent-soft)] text-[var(--accent)] hover:brightness-95"}`}>{nextStatus}<ArrowRight size={14} /></button>)}
          {previous && <button type="button" disabled={statusMutation.isPending} onClick={() => changeStatus(previous)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-color)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-[var(--bg-tertiary)] disabled:opacity-50"><RotateCcw size={14} /> Revert to {previous}</button>}
          {lead.status === "Qualified" && !lead.customer_added && <button type="button" disabled={customerMutation.isPending} onClick={() => customerMutation.mutate(lead)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-text)] transition hover:brightness-95 disabled:opacity-50"><Users size={14} />{customerMutation.isPending ? "Converting…" : "Convert to customer"}</button>}
          {status === "Customer" && <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--success-soft)] px-3 text-xs font-semibold text-[var(--success-text)]"><CheckCircle2 size={14} /> Saved to Customers</span>}
          {status === "Customer" && lead.customer_id && <>
            <button type="button" onClick={() => router.push(`/admin/quotes/new?customer=${lead.customer_id?._id || lead.customer_id}`)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-3 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><FilePlus2 size={14} /> Create Quote</button>
            <button type="button" onClick={() => router.push(`/admin/invoices/new?customer=${lead.customer_id?._id || lead.customer_id}`)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"><FilePlus2 size={14} /> Create Invoice</button>
          </>}
        </div>
      </div>
    </header>

    <div className="grid items-stretch gap-4 lg:grid-cols-2">
      <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
        <SectionHeader icon={UserRound} title="Contact information" />
        <div className="grid gap-1 p-3 sm:grid-cols-2 sm:p-5">
          <DetailField icon={UserRound} label="Contact person" value={lead.name} />
          <DetailField icon={Tag} label="Lead type" value={lead.lead_type} />
          <DetailField icon={Phone} label="Phone" value={lead.phone} />
          <DetailField icon={Mail} label="Email" value={lead.email || "Not provided"} />
        </div>
      </section>

      {lead.lead_type === "Business" && <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
        <SectionHeader icon={Building2} title="Business information" />
        <div className="grid gap-1 p-3 sm:grid-cols-2 sm:p-5">
          <DetailField icon={Building2} label="Company" value={lead.company_name} />
          <DetailField icon={Tag} label="Business type" value={lead.business_type} />
          <DetailField icon={MapPin} label="Business address" value={lead.business_address} />
        </div>
      </section>}

      <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
        <SectionHeader icon={StickyNote} title="Notes" />
        <div className="whitespace-pre-wrap p-4 text-sm leading-6 text-[var(--text-secondary)] sm:p-5">{lead.notes || <span className="text-[var(--text-muted)]">No notes added.</span>}</div>
      </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
        <SectionHeader icon={CalendarDays} title="Lead details" />
        <div className="grid gap-1 p-3 pb-5 sm:grid-cols-2 sm:p-5 sm:pb-7">
          <DetailField icon={Tag} label="Source" value={lead.source || "Other"} />
          <DetailField icon={Users} label="Assigned employee" value={lead.assigned_employee_id?.name || "Unassigned"} />
          <DetailField icon={CalendarDays} label="Next follow-up" value={dateOnly(lead.next_follow_up_date)} />
          <DetailField icon={CalendarDays} label="Created" value={dateTime(lead.created_at)} />
          <DetailField icon={CalendarDays} label="Last updated" value={dateTime(lead.updated_at)} />
        </div>
      </section>

      {lead.status === "Lost" && lead.lost_reason && <section className="overflow-hidden rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] shadow-sm lg:col-span-2">
        <div className="px-4 py-3 text-xs font-bold text-[var(--danger-text)]">Lost reason</div>
        <p className="whitespace-pre-wrap px-4 pb-4 text-sm leading-6 text-[var(--text-secondary)]">{lead.lost_reason}</p>
      </section>}
    </div>

    <section className="w-full overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
      <SectionHeader icon={History} title="History" />
      <div className="border-b border-[var(--border-color)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Lead history type">
          {[
            { id: "overview", label: "Overview", count: historyItems.length },
            ...(isCustomer ? [
              { id: "pos", label: "POS", count: lead.customer_history?.pos?.length || 0 },
              { id: "quotes", label: "Quotes", count: lead.customer_history?.quotes?.length || 0 },
              { id: "invoices", label: "Invoices", count: lead.customer_history?.invoices?.length || 0 },
            ] : []),
          ].map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={historyTab === tab.id} onClick={() => setHistoryTab(tab.id)} className={`rounded-full px-4 py-2 text-xs font-medium transition-all ${historyTab === tab.id ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {tab.label} <span className={historyTab === tab.id ? "ml-1 text-blue-100" : "ml-1 text-slate-500"}>({tab.count})</span>
          </button>)}
        </div>
      </div>
      {historyTab === "overview" && <div className="space-y-5 p-4 sm:p-6">
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Lead journey</p><h3 className="mt-1 text-sm font-bold text-slate-900">Progress overview</h3></div>
            <span className={`rounded-full px-3 py-1.5 text-[11px] font-bold ${statusTone[status] || statusTone.New}`}>{status === "Lost" ? "Lost lead" : `Current stage · ${status}`}</span>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-4">
            {journeyStages.map((stage, index) => <div key={stage} className="relative">
              {index < journeyStages.length - 1 && <span className={`absolute left-1/2 top-[11px] h-0.5 w-full ${index < journeyIndex ? "bg-blue-500" : "bg-blue-100"}`} aria-hidden="true" />}
              <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-bold ${index <= journeyIndex ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-blue-200 bg-white text-blue-300"}`}>{index < journeyIndex ? "✓" : index + 1}</span>
              <p className={`mt-2 text-[10px] font-semibold sm:text-xs ${index <= journeyIndex ? "text-blue-800" : "text-slate-400"}`}>{stage}</p>
            </div>)}
          </div>
          <div className="mt-5 grid gap-3 border-t border-blue-100 pt-4 sm:grid-cols-3">
            <JourneyFact label="Created" value={dateOnly(lead.created_at)} />
            <JourneyFact label="Last activity" value={historyItems[0] ? dateTime(historyItems[0].created_at) : "No activity yet"} />
            <JourneyFact label="Updates recorded" value={String(historyItems.length)} />
          </div>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="text-sm font-bold">Activity timeline</h3><p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Lead status changes, notes and follow-ups in date order.</p></div><span className="rounded-full bg-[var(--bg-tertiary)] px-2.5 py-1 text-[10px] font-semibold text-[var(--text-secondary)]">{historyItems.length} events</span></div>
        {historyItems.length ? <ol className="space-y-0">
          {historyItems.map((entry, index) => <li key={entry.key} className="relative flex gap-3 pb-4 last:pb-0 sm:gap-4">
            {index < historyItems.length - 1 && <span className="absolute bottom-0 left-[15px] top-8 w-px bg-gradient-to-b from-blue-200 to-slate-100" aria-hidden="true" />}
            <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-[var(--bg-card)] ${entry.action === "status" ? "bg-blue-100 text-blue-700" : entry.action === "created" ? "bg-emerald-100 text-emerald-700" : entry.action === "deleted" ? "bg-red-100 text-red-700" : entry.action === "customer" ? "bg-violet-100 text-violet-700" : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"}`}><History size={15} /></span>
            <div className="min-w-0 flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 shadow-[0_2px_8px_rgba(15,23,42,0.035)] transition hover:border-blue-200 hover:shadow-sm sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2"><div className="min-w-0"><p className="text-sm font-bold leading-5">{entry.summary}</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">Updated by {entry.employee_id?.name || entry.employee_name || "Staff"}</p></div><time className="rounded-lg bg-[var(--bg-tertiary)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--text-secondary)]">{dateTime(entry.created_at)}</time></div>
              {entry.details && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-[var(--bg-tertiary)] p-3 text-sm leading-5 text-[var(--text-secondary)]">{entry.details}</p>}
              {entry.changes?.length > 0 && <div className="mt-3 space-y-2 border-t border-[var(--border-color)] pt-3">{entry.changes.map((change, changeIndex) => <div key={`${entry.key}-change-${changeIndex}`} className="grid gap-1 text-xs sm:grid-cols-[minmax(120px,.6fr)_1fr] sm:gap-3"><span className="font-semibold text-[var(--text-secondary)]">{change.field}</span><span className="break-words text-[var(--text-muted)]"><span>{change.from || "—"}</span><span className="px-2 text-[var(--accent)]">→</span><span className="text-[var(--text-primary)]">{change.to || "—"}</span></span></div>)}</div>}
            </div>
          </li>)}
        </ol> : <p className="py-10 text-center text-sm text-[var(--text-muted)]">No lead history recorded yet.</p>}
      </div>}
      {isCustomer && historyTab === "pos" && <CustomerPOSHistory records={lead.customer_history?.pos || []} />}
      {isCustomer && historyTab === "quotes" && <CustomerDocumentHistory records={lead.customer_history?.quotes || []} numberKey="quote_number" dateKey="quote_date" hrefBase="/admin/quotes" emptyText="No quotes recorded for this customer yet." />}
      {isCustomer && historyTab === "invoices" && <CustomerDocumentHistory records={lead.customer_history?.invoices || []} numberKey="invoice_number" dateKey="invoice_date" hrefBase="/admin/invoices" emptyText="No invoices recorded for this customer yet." />}
    </section>

    {lostReasonOpen && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !statusMutation.isPending) setLostReasonOpen(false); }}><form onSubmit={submitLostReason} className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-2xl"><div className="mb-4"><h2 className="text-base font-bold">Mark lead as lost</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Add a reason before changing this lead’s status.</p></div><label className="block text-xs font-semibold text-[var(--text-secondary)]">Lost reason <span className="text-[var(--danger-text)]">*</span><textarea autoFocus required maxLength={1000} value={lostReason} onChange={(event) => setLostReason(event.target.value)} placeholder="Why was this lead lost?" rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={statusMutation.isPending} onClick={() => setLostReasonOpen(false)} className="h-9 rounded-xl border border-[var(--border-color)] px-4 text-xs font-semibold disabled:opacity-50">Cancel</button><button type="submit" disabled={!lostReason.trim() || statusMutation.isPending} className="h-9 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{statusMutation.isPending ? "Saving..." : "Confirm lost"}</button></div></form></div>}
    {editOpen && editForm && <LeadFormModal open={editOpen} form={editForm} setForm={setEditForm} editing isPending={editMutation.isPending} onSave={saveEdit} onClose={() => setEditOpen(false)} />}
  </div>;
}

function CustomerPOSHistory({ records }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left">
    <thead className="bg-[var(--bg-tertiary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]"><tr><th className="px-4 py-3">POS Number</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Payment Method</th><th className="px-4 py-3 text-right">Total</th><th className="w-14 px-4 py-3 text-right">View</th></tr></thead>
    <tbody>{records.map((sale) => <tr key={sale._id} className="border-t border-[var(--border-color)] transition-colors hover:bg-[var(--bg-row-hover)]"><td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{sale.sale_number || `POS-${String(sale._id).slice(-6)}`}</td><td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{dateTime(sale.created_at)}</td><td className="px-4 py-3 text-xs capitalize text-[var(--text-secondary)]">{String(sale.payment?.method || "—").replaceAll("_", " ")}</td><td className="px-4 py-3 text-right text-xs font-bold">{money(sale.total)}</td><td className="px-4 py-3 text-right"><Link href={`/admin/pos/history/${sale._id}`} aria-label={`View POS sale ${sale.sale_number || "details"}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"><Eye size={15} /></Link></td></tr>)}
      {!records.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-xs text-[var(--text-muted)]">No POS history recorded for this customer yet.</td></tr>}
    </tbody>
  </table></div>;
}

function CustomerDocumentHistory({ records, numberKey, dateKey, hrefBase, emptyText }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left">
    <thead className="bg-[var(--bg-tertiary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]"><tr><th className="px-4 py-3">Number</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Total</th><th className="w-14 px-4 py-3 text-right">View</th></tr></thead>
    <tbody>{records.map((record) => <tr key={record._id} className="border-t border-[var(--border-color)] transition-colors hover:bg-[var(--bg-row-hover)]"><td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{record[numberKey] || "—"}</td><td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{dateTime(record[dateKey] || record.created_at)}</td><td className="px-4 py-3 text-xs capitalize text-[var(--text-secondary)]">{record.status || "—"}</td><td className="px-4 py-3 text-right text-xs font-bold">{money(record.total)}</td><td className="px-4 py-3 text-right"><Link href={`${hrefBase}/${record._id}`} aria-label={`View ${record[numberKey] || "record"}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"><Eye size={15} /></Link></td></tr>)}
      {!records.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-xs text-[var(--text-muted)]">{emptyText}</td></tr>}
    </tbody>
  </table></div>;
=======
  return <div dir={dir} className="space-y-4 text-[var(--text-primary)] sm:space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Link href="/admin/leads" className="inline-flex items-center gap-1 transition hover:text-[var(--accent)]"><ArrowLeft size={14} /> {t("admin.leads.ui.leads")}</Link><ChevronRight size={13} /><span>{lead.lead_number}</span></div>
        <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><ContactRound size={23} /></span><div><h1 className="text-xl font-bold tracking-tight sm:text-2xl">{lead.lead_type === "Business" && lead.company_name ? lead.company_name : lead.name}</h1><p className="mt-0.5 text-xs text-[var(--text-muted)]">{lead.lead_number} <span className="px-1">·</span> {leadValueLabel(lead.lead_type, t)} {t("admin.leads.ui.lead")}{lead.lead_type === "Business" ? ` · ${t("admin.leads.ui.contactName", { name: lead.name })}` : ""}</p></div></div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className={`rounded-full px-2.5 py-1.5 text-xs font-bold ${statusTone[lead.status] || statusTone.New}`}>{leadValueLabel(lead.status, t)}</span>
        {next.map((status) => <button key={status} type="button" disabled={statusMutation.isPending} onClick={() => changeStatus(status)} className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition disabled:opacity-50 ${status === "Lost" ? "border border-[var(--danger)]/25 text-[var(--danger-text)] hover:bg-[var(--danger-soft)]" : "bg-[var(--accent-soft)] text-[var(--accent)] hover:brightness-95"}`}>{leadValueLabel(status, t)}<ArrowRight size={14} /></button>)}
        {previous && <button type="button" disabled={statusMutation.isPending} onClick={() => changeStatus(previous)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--danger)]/25 px-3 text-xs font-semibold text-[var(--danger-text)] transition hover:bg-[var(--danger-soft)] disabled:opacity-50"><RotateCcw size={14} /> {t("admin.leads.ui.revertTo", { status: leadValueLabel(previous, t) })}</button>}
        {lead.status === "Converted" && (lead.customer_added ? <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--success-soft)] px-3 text-xs font-semibold text-[var(--success-text)]"><CheckCircle2 size={14} /> {t("admin.leads.ui.addedToCustomers")}</span> : <button type="button" disabled={customerMutation.isPending} onClick={() => customerMutation.mutate(lead)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-text)] transition hover:brightness-95 disabled:opacity-50"><Users size={14} />{customerMutation.isPending ? t("admin.leads.ui.addingCustomer") : t("admin.leads.ui.addAsCustomer")}</button>)}
        <Link href="/admin/leads" className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"><ArrowLeft size={14} /> {t("admin.leads.ui.backToLeads")}</Link>
      </div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Users} label={t("admin.leads.ui.assignedEmployee")} value={lead.assigned_employee_id?.name || t("admin.leads.value.unassigned")} />
      <Metric icon={BadgeDollarSign} label={t("admin.leads.ui.estimatedValue")} value={currency(lead.estimated_deal_value, locale, t)} />
      <Metric icon={CalendarDays} label={t("admin.leads.ui.nextFollowUp")} value={dateOnly(lead.next_follow_up_date, locale, t)} />
      <Metric icon={Tag} label={t("admin.leads.ui.leadSource")} value={lead.source ? leadValueLabel(lead.source, t) : t("common.notProvided")} />
    </section>

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={UserRound} title={t("admin.leads.ui.contactInformation")} />
          <div className="grid gap-x-8 gap-y-1 p-4 sm:grid-cols-2 sm:p-5">
            <Fact icon={UserRound} label={t("admin.leads.ui.contactPerson")} value={lead.name} />
            <Fact icon={Phone} label={t("common.phone")} value={lead.phone} />
            <Fact icon={Mail} label={t("common.email")} value={lead.email || t("common.notProvided")} />
            <Fact icon={Tag} label={t("admin.leads.ui.leadSource")} value={lead.source ? leadValueLabel(lead.source, t) : t("common.notProvided")} />
            <Fact icon={CalendarDays} label={t("admin.leads.ui.created")} value={dateTime(lead.created_at, locale, t)} />
            <Fact icon={Clock3} label={t("admin.leads.ui.lastUpdated")} value={dateTime(lead.updated_at, locale, t)} />
          </div>
        </section>

        {lead.lead_type === "Business" && <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={Building2} title={t("admin.leads.ui.businessInformation")} />
          <div className="grid gap-x-8 gap-y-1 p-4 sm:grid-cols-2 sm:p-5">
            <Fact icon={Building2} label={t("admin.leads.ui.company")} value={lead.company_name} />
            <Fact icon={Tag} label={t("admin.leads.ui.businessType")} value={lead.business_type} />
            <Fact icon={MapPin} label={t("admin.leads.ui.businessAddress")} value={lead.business_address} />
            <Fact icon={MapPin} label={t("admin.leads.ui.city")} value={lead.city} />
          </div>
        </section>}

        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={CalendarDays} title={t("admin.leads.ui.leadTimeline")} />
          <div className="grid gap-x-8 gap-y-1 p-4 sm:grid-cols-2 sm:p-5">
            <Fact icon={CalendarDays} label={t("admin.leads.ui.expectedPurchase")} value={dateOnly(lead.expected_purchase_date, locale, t)} />
            <Fact icon={CalendarDays} label={t("admin.leads.ui.nextFollowUp")} value={dateOnly(lead.next_follow_up_date, locale, t)} />
            <Fact icon={BadgeDollarSign} label={t("admin.leads.ui.estimatedDealValue")} value={currency(lead.estimated_deal_value, locale, t)} />
            {lead.lost_reason && <Fact icon={X} label={t("admin.leads.ui.lostReason")} value={lead.lost_reason} />}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={Package} title={t("admin.leads.ui.productInterest")} trailing={<span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--accent)]">{products.length} {t("admin.leads.ui.items")}</span>} />
          <div className="space-y-3 p-4 sm:p-5">
            {lead.product_interest && <p className="rounded-xl bg-[var(--bg-card-alt)] p-3 text-sm text-[var(--text-secondary)]">{lead.product_interest}</p>}
            {products.length ? <div className="space-y-2">{products.map((item, index) => <div key={item._id || index} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-color)] p-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Package size={16} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{productNameOf(item.product_id) || t("admin.leads.ui.productUnavailable")}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{item.variant_id?.title || t("admin.leads.ui.noVariant")}{item.variant_id?.sku ? ` · SKU ${item.variant_id.sku}` : ""}</p></div></div><span className="rounded-lg bg-[var(--bg-tertiary)] px-2.5 py-1 text-xs font-semibold">{t("admin.leads.ui.qty")} {item.quantity}</span></div>)}</div> : !lead.product_interest && <p className="text-sm text-[var(--text-muted)]">{t("admin.leads.ui.noProductInterestRecorded")}</p>}
            <div className="border-t border-[var(--border-color)] pt-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">{t("admin.leads.ui.customRequirements")}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{lead.custom_requirements || t("admin.leads.ui.noCustomRequirementsRecorded")}</p></div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={Activity} title={t("admin.leads.ui.customerNotes")} />
          <p className="min-h-20 whitespace-pre-wrap p-4 text-sm leading-6 text-[var(--text-secondary)] sm:p-5">{lead.notes || t("admin.leads.ui.noNotesHaveBeenAdded")}</p>
        </section>
      </div>

      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={Activity} title={t("admin.leads.ui.followUpHistory")} trailing={<span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent)]">{lead.activities?.length || 0}</span>} />
          <form onSubmit={recordActivity} className="space-y-2 border-b border-[var(--border-color)] p-4">
            <div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-semibold text-[var(--text-muted)]">{t("admin.leads.ui.type")}<select value={activity.type} onChange={(event) => setActivity({ ...activity, type: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-2 text-xs">{activityTypes.map((type) => <option key={type} value={type}>{activityLabel(type, t)}</option>)}</select></label><label className="text-[10px] font-semibold text-[var(--text-muted)]">{t("admin.leads.ui.followUpDate")}<input type="date" value={activity.follow_up_date} onChange={(event) => setActivity({ ...activity, follow_up_date: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-2 text-xs" /></label></div>
            <label className="block text-[10px] font-semibold text-[var(--text-muted)]">{t("admin.leads.ui.notesOrOutcome")}<textarea required rows={3} value={activity.notes} onChange={(event) => setActivity({ ...activity, notes: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] p-2 text-xs" /></label>
            <button type="submit" disabled={activityMutation.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-text)] disabled:opacity-50"><Plus size={13} />{activityMutation.isPending ? t("admin.leads.ui.saving") : t("admin.leads.ui.recordActivity")}</button>
          </form>
          <div className="max-h-[440px] space-y-0 overflow-y-auto p-4">{lead.activities?.length ? [...lead.activities].reverse().map((entry, index) => <div key={entry._id || index} className="relative border-s border-[var(--border-color)] pb-5 ps-4 last:border-0 last:pb-0"><span className="absolute -start-[5px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-4 ring-[var(--bg-card)]" /><p className="text-xs font-semibold">{activityLabel(entry.type, t)} · {entry.employee_id?.name || entry.employee_name || t("admin.leads.ui.staff")}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[var(--text-secondary)]">{entry.notes}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{dateTime(entry.created_at, locale, t)}{entry.follow_up_date ? ` · ${t("admin.leads.ui.followUpDateValue", { date: dateOnly(entry.follow_up_date, locale, t) })}` : ""}</p></div>) : <p className="py-4 text-center text-xs text-[var(--text-muted)]">{t("admin.leads.ui.noInteractionsRecordedYet")}</p>}</div>
        </section>
      </div>
    </div>

    {lostReasonOpen && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !statusMutation.isPending) setLostReasonOpen(false); }}><form onSubmit={submitLostReason} className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-2xl"><div className="mb-4"><h2 className="text-base font-bold">{t("admin.leads.ui.markLeadAsLost")}</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{t("admin.leads.ui.addAReasonBeforeChangingThisLeadSStatus")}</p></div><label className="block text-xs font-semibold text-[var(--text-secondary)]">{t("admin.leads.ui.lostReason")} <span className="text-[var(--danger-text)]">*</span><textarea autoFocus required maxLength={1000} value={lostReason} onChange={(event) => setLostReason(event.target.value)} placeholder={t("admin.leads.ui.whyWasThisLeadLost")} rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={statusMutation.isPending} onClick={() => setLostReasonOpen(false)} className="h-9 rounded-xl border border-[var(--border-color)] px-4 text-xs font-semibold disabled:opacity-50">{t("admin.leads.ui.cancel")}</button><button type="submit" disabled={!lostReason.trim() || statusMutation.isPending} className="h-9 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{statusMutation.isPending ? t("admin.leads.ui.saving") : t("admin.leads.ui.confirmLost")}</button></div></form></div>}
  </div>;
}

function PanelHeader({ icon: Icon, title, trailing }) {
  return <div className="flex items-center gap-2.5 border-b border-[var(--border-color)] bg-[var(--bg-card-alt)] px-4 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm"><Icon size={15} /></span><h2 className="text-sm font-bold">{title}</h2><div className="ms-auto">{trailing}</div></div>;
}
function Fact({ icon: Icon, label, value }) {
  const { t } = useTranslation();
  return <div className="group flex min-w-0 items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[var(--bg-row-hover)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors group-hover:text-[var(--accent)]"><Icon size={15} /></span><div className="min-w-0"><p className="text-[10px] font-medium text-[var(--text-muted)]">{label}</p><p className="mt-1 break-words text-xs font-semibold">{value || t("common.notProvided")}</p></div></div>;
>>>>>>> 2e3f0d01943d374997bd89fc3c0e0f7e0754f66e
}

function JourneyFact({ label, value }) {
  return <div className="min-w-0 rounded-xl border border-blue-100/80 bg-white/75 px-3 py-2.5"><p className="text-[10px] font-medium text-slate-500">{label}</p><p className="mt-1 truncate text-xs font-bold text-slate-800">{value}</p></div>;
}

function SectionHeader({ icon: Icon, title }) {
  return <div className="flex items-center gap-2.5 border-b border-[var(--border-color)] bg-[var(--bg-card-alt)] px-4 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={15} /></span><h2 className="text-sm font-bold">{title}</h2></div>;
}

function DetailField({ icon: Icon, label, value }) {
  return <div className="flex min-w-0 items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[var(--bg-row-hover)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"><Icon size={15} /></span><div className="min-w-0"><p className="text-[10px] font-medium text-[var(--text-muted)]">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value || "—"}</p></div></div>;
}
