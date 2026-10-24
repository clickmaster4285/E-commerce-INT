"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadApi } from "@/apis/admin/leadApi";
import { addLeadAsCustomer } from "@/lib/addLeadAsCustomer";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";
import { toast } from "sonner";
import {
  Activity, ArrowLeft, ArrowRight, BadgeDollarSign, Building2, CalendarDays, CheckCircle2, FilePlus2,
  ChevronRight, Clock3, ContactRound, Eye, History, Mail, MapPin, Pencil, Phone,
  Package, Plus, RotateCcw, StickyNote, Tag, UserRound, Users,
} from "lucide-react";

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
  const [activity, setActivity] = useState({ type: "Call", notes: "", follow_up_date: "" });
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

  const products = Array.isArray(lead.products) ? lead.products : [];
  const recordActivity = (event) => {
    event.preventDefault();
    if (!activity.notes.trim()) return;
    activityMutation.mutate({ ...activity, notes: activity.notes.trim(), follow_up_date: activity.follow_up_date || null });
  };
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
function Metric({ icon: Icon, label, value }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={17} /></span>
    <div className="min-w-0"><p className="truncate text-[11px] font-medium text-[var(--text-muted)]">{label}</p><p className="mt-1 break-words text-sm font-semibold text-[var(--text-primary)]">{value}</p></div>
  </div>;
}
function Fact({ icon: Icon, label, value }) {
  const { t } = useTranslation();
  return <div className="group flex min-w-0 items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[var(--bg-row-hover)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors group-hover:text-[var(--accent)]"><Icon size={15} /></span><div className="min-w-0"><p className="text-[10px] font-medium text-[var(--text-muted)]">{label}</p><p className="mt-1 break-words text-xs font-semibold">{value || t("common.notProvided")}</p></div></div>;
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
