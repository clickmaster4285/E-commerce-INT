"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadApi } from "@/apis/admin/leadApi";
import { addLeadAsCustomer } from "@/lib/addLeadAsCustomer";
import { useTranslation } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import {
  Activity, ArrowLeft, ArrowRight, Building2, CalendarDays, CheckCircle2,
  Clock3, ContactRound, Mail, MapPin, Phone, Plus, Tag, UserRound, Users,
} from "lucide-react";

const activityTypes = ["Call", "WhatsApp", "Email", "Meeting", "Other"];
const nextStatuses = { New: ["Contacted"], Contacted: ["Qualified"], Qualified: ["Converted", "Lost"], Converted: ["Lost"] };
const statusTone = { New: "bg-[var(--accent-soft)] text-[var(--accent)]", Contacted: "bg-blue-100 text-blue-700", Qualified: "bg-amber-100 text-amber-800", Converted: "bg-[var(--success-soft)] text-[var(--success-text)]", Lost: "bg-[var(--danger-soft)] text-[var(--danger-text)]" };
const leadValueKey = (value) => `admin.leads.value.${String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
const leadValueLabel = (value, t) => { const key = leadValueKey(value); const label = t(key); return label === key ? (String(value || "").replaceAll("_", " ") || t("common.notProvided")) : label; };
const activityValueKey = (value) => `admin.leads.activity.${String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
const activityLabel = (value, t) => { const key = activityValueKey(value); const label = t(key); return label === key ? (String(value || "").replaceAll("_", " ") || t("common.notProvided")) : label; };
const dateOnly = (value, locale, t) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }) : t("common.notProvided");
const dateTime = (value, locale, t) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : t("common.notProvided");
export default function LeadDetailPage({ params }) {
  const { t, locale, dir } = useTranslation();
  const { id } = use(params);
  const qc = useQueryClient();
  const [activity, setActivity] = useState({ type: "Call", notes: "", follow_up_date: "" });
  const [lostReasonOpen, setLostReasonOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
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
  if (isLoading) return <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-muted)]">{t("admin.leads.ui.loadingLeadDetails")}</div>;
  if (isError || !lead) return <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center"><p className="text-sm font-semibold">{error?.response?.data?.message || t("admin.leads.ui.leadNotFound")}</p><Link href="/admin/leads" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"><ArrowLeft size={14} /> {t("admin.leads.ui.backToLeads")}</Link></div>;

  const recordActivity = (event) => {
    event.preventDefault();
    if (!activity.notes.trim()) return;
    activityMutation.mutate({ ...activity, notes: activity.notes.trim(), follow_up_date: activity.follow_up_date || null });
  };
  const changeStatus = (status) => {
    if (status === "Lost") { setLostReason(lead.lost_reason || ""); setLostReasonOpen(true); return; }
    statusMutation.mutate({ status });
  };
  const submitLostReason = (event) => {
    event.preventDefault();
    const reason = lostReason.trim();
    if (!reason) return;
    statusMutation.mutate({ status: "Lost", lost_reason: reason });
  };
  const next = nextStatuses[lead.status] || [];
  const timeline = [
    ...(lead.history || []).map((entry) => ({ ...entry, key: `history-${entry._id}`, kind: "change" })),
    ...(lead.activities || []).map((entry) => ({ ...entry, key: `activity-${entry._id}`, kind: "activity" })),
  ].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return <div dir={dir} className="space-y-4 text-[var(--text-primary)] sm:space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><ContactRound size={23} /></span><div><h1 className="text-xl font-bold tracking-tight sm:text-2xl">{lead.lead_type === "Business" && lead.company_name ? lead.company_name : lead.name}</h1><p className="mt-0.5 text-xs text-[var(--text-muted)]">{lead.lead_number} <span className="px-1">·</span> {leadValueLabel(lead.lead_type, t)} {t("admin.leads.ui.lead")}{lead.lead_type === "Business" ? ` · ${t("admin.leads.ui.contactName", { name: lead.name })}` : ""}</p></div></div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className={`rounded-full px-2.5 py-1.5 text-xs font-bold ${statusTone[lead.status] || statusTone.New}`}>{leadValueLabel(lead.status, t)}</span>
        {next.map((status) => <button key={status} type="button" disabled={statusMutation.isPending} onClick={() => changeStatus(status)} className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition disabled:opacity-50 ${status === "Lost" ? "border border-[var(--danger)]/25 text-[var(--danger-text)] hover:bg-[var(--danger-soft)]" : "bg-[var(--accent-soft)] text-[var(--accent)] hover:brightness-95"}`}>{leadValueLabel(status, t)}<ArrowRight size={14} /></button>)}
        {lead.status === "Converted" && (lead.customer_added ? <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--success-soft)] px-3 text-xs font-semibold text-[var(--success-text)]"><CheckCircle2 size={14} /> {t("admin.leads.ui.addedToCustomers")}</span> : <button type="button" disabled={customerMutation.isPending} onClick={() => customerMutation.mutate(lead)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-text)] transition hover:brightness-95 disabled:opacity-50"><Users size={14} />{customerMutation.isPending ? t("admin.leads.ui.addingCustomer") : t("admin.leads.ui.addAsCustomer")}</button>)}
        <Link href="/admin/leads" className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"><ArrowLeft size={14} /> {t("admin.leads.ui.backToLeads")}</Link>
      </div>
    </header>

    <section className="grid gap-3 sm:grid-cols-3">
      <Metric icon={Users} label={t("admin.leads.ui.assignedEmployee")} value={lead.assigned_employee_id?.name || t("admin.leads.value.unassigned")} />
      <Metric icon={Activity} label={t("admin.leads.ui.leadSource")} value={lead.source ? leadValueLabel(lead.source, t) : t("common.notProvided")} />
      <Metric icon={CalendarDays} label={t("admin.leads.ui.nextFollowUp")} value={dateOnly(lead.next_follow_up_date, locale, t)} />
    </section>

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={UserRound} title={t("admin.leads.ui.contactInformation")} />
          <div className="grid gap-x-8 gap-y-1 p-4 sm:grid-cols-2 sm:p-5">
            <Fact icon={UserRound} label={t("admin.leads.ui.contactPerson")} value={lead.name} />
            <Fact icon={Phone} label={t("common.phone")} value={lead.phone} />
            <Fact icon={Mail} label={t("common.email")} value={lead.email || t("common.notProvided")} />
            <Fact icon={CalendarDays} label={t("admin.leads.ui.created")} value={dateTime(lead.created_at, locale, t)} />
          </div>
        </section>

        {lead.lead_type === "Business" && <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={Building2} title={t("admin.leads.ui.businessInformation")} />
          <div className="grid gap-x-8 gap-y-1 p-4 sm:grid-cols-2 sm:p-5">
            <Fact icon={Building2} label={t("admin.leads.ui.company")} value={lead.company_name} />
            <Fact icon={Tag} label={t("admin.leads.ui.businessType")} value={lead.business_type} />
            <Fact icon={MapPin} label={t("admin.leads.ui.businessAddress")} value={lead.business_address} />
          </div>
        </section>}

        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={Clock3} title={t("admin.leads.ui.notes")} />
          <p className="min-h-20 whitespace-pre-wrap p-4 text-sm leading-6 text-[var(--text-secondary)] sm:p-5">{lead.notes || t("admin.leads.ui.noNotesHaveBeenAdded")}</p>
        </section>
        {lead.lost_reason && <section className="overflow-hidden rounded-2xl border border-[var(--danger)]/20 bg-[var(--danger-soft)] shadow-sm">
          <PanelHeader icon={Activity} title={t("admin.leads.ui.lostReason")} />
          <p className="whitespace-pre-wrap p-4 text-sm leading-6 text-[var(--danger-text)] sm:p-5">{lead.lost_reason}</p>
        </section>}
      </div>

      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={Activity} title={t("admin.leads.ui.activityHistory")} trailing={<span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent)]">{timeline.length}</span>} />
          <form onSubmit={recordActivity} className="space-y-3 border-b border-[var(--border-color)] bg-[var(--bg-card-alt)] p-4">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">{t("admin.leads.ui.recordActivity")}</p>
            <div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-semibold text-[var(--text-muted)]">{t("admin.leads.ui.type")}<select value={activity.type} onChange={(event) => setActivity({ ...activity, type: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-2 text-xs">{activityTypes.map((type) => <option key={type} value={type}>{activityLabel(type, t)}</option>)}</select></label><label className="text-[10px] font-semibold text-[var(--text-muted)]">{t("admin.leads.ui.followUpDate")}<input type="date" value={activity.follow_up_date} onChange={(event) => setActivity({ ...activity, follow_up_date: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-2 text-xs" /></label></div>
            <label className="block text-[10px] font-semibold text-[var(--text-muted)]">{t("admin.leads.ui.notesOrOutcome")}<textarea required maxLength={3000} rows={3} value={activity.notes} onChange={(event) => setActivity({ ...activity, notes: event.target.value })} className="mt-1 w-full resize-y rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] p-2.5 text-xs outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
            <button type="submit" disabled={activityMutation.isPending || !activity.notes.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-text)] transition hover:brightness-95 disabled:opacity-50"><Plus size={13} />{activityMutation.isPending ? t("admin.leads.ui.saving") : t("admin.leads.ui.recordActivity")}</button>
          </form>
          <div className="max-h-[680px] space-y-0 overflow-y-auto p-4">
            {timeline.length ? timeline.map((entry, index) => <div key={entry.key} className="relative border-s border-[var(--border-color)] pb-5 ps-5 last:border-0 last:pb-0">
              <span className={`absolute -start-[6px] top-1 flex h-3 w-3 items-center justify-center rounded-full ring-4 ring-[var(--bg-card)] ${entry.kind === "activity" ? "bg-[var(--accent)]" : "bg-[var(--text-muted)]"}`} />
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-semibold">{entry.kind === "activity" ? `${activityLabel(entry.type, t)} · ${entry.employee_id?.name || entry.employee_name || t("admin.leads.ui.staff")}` : entry.summary}</p><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{entry.employee_id?.name || entry.employee_name || t("admin.leads.ui.staff")}</p></div><time className="shrink-0 text-[10px] text-[var(--text-muted)]">{dateTime(entry.created_at, locale, t)}</time></div>
              {entry.kind === "activity" && entry.notes && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-[var(--bg-card-alt)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">{entry.notes}</p>}
              {entry.kind === "activity" && entry.follow_up_date && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-medium text-[var(--accent)]"><CalendarDays size={12} />{t("admin.leads.ui.followUpDateValue", { date: dateOnly(entry.follow_up_date, locale, t) })}</p>}
              {entry.kind === "change" && entry.changes?.length > 0 && <div className="mt-2 space-y-1 rounded-lg bg-[var(--bg-card-alt)] px-3 py-2">{entry.changes.map((change, changeIndex) => <p key={`${entry.key}-${changeIndex}`} className="text-[10px] leading-4 text-[var(--text-secondary)]"><span className="font-semibold">{change.field}:</span> {change.from || "—"} <span aria-hidden="true">→</span> {change.to || "—"}</p>)}</div>}
            </div>) : <div className="flex flex-col items-center px-4 py-8 text-center"><span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-[var(--text-muted)]"><Activity size={18} /></span><p className="text-xs font-semibold">{t("admin.leads.ui.noInteractionsRecordedYet")}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{t("admin.leads.ui.activityHistoryHint")}</p></div>}
          </div>
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
