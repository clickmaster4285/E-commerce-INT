"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadApi } from "@/apis/admin/leadApi";
import { addLeadAsCustomer } from "@/lib/addLeadAsCustomer";
import { toast } from "sonner";
import {
  Activity, ArrowLeft, ArrowRight, BadgeDollarSign, Building2, CalendarDays,
  CheckCircle2, ChevronRight, Clock3, ContactRound, Mail, MapPin,
  Package, Phone, Plus, RotateCcw, Tag, UserRound, Users, X,
} from "lucide-react";

const activityTypes = ["Call", "WhatsApp", "Email", "Meeting", "Other"];
const nextStatuses = { New: ["Contacted"], Contacted: ["Qualified"], Qualified: ["Converted", "Lost"], Converted: ["Lost"] };
const previousStatus = { Contacted: "New", Qualified: "Contacted", Converted: "Qualified" };
const statusTone = { New: "bg-[var(--accent-soft)] text-[var(--accent)]", Contacted: "bg-blue-100 text-blue-700", Qualified: "bg-amber-100 text-amber-800", Converted: "bg-[var(--success-soft)] text-[var(--success-text)]", Lost: "bg-[var(--danger-soft)] text-[var(--danger-text)]" };
const dateOnly = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" }) : "—";
const dateTime = (value) => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const currency = (value) => value == null ? "Not estimated" : `Rs. ${Number(value).toLocaleString()}`;

export default function LeadDetailPage({ params }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const [activity, setActivity] = useState({ type: "Call", notes: "", follow_up_date: "" });
  const [lostReasonOpen, setLostReasonOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const { data: lead, isLoading, isError, error } = useQuery({ queryKey: ["lead-detail", id], queryFn: () => leadApi.getById(id) });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["lead-detail", id] });
    qc.invalidateQueries({ queryKey: ["leads-admin"] });
    qc.invalidateQueries({ queryKey: ["customers-admin"] });
  };
  const statusMutation = useMutation({
    mutationFn: (payload) => leadApi.updateStatus(id, payload),
    onSuccess: () => { toast.success("Lead status updated"); setLostReasonOpen(false); setLostReason(""); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Status update failed"),
  });
  const activityMutation = useMutation({
    mutationFn: (payload) => leadApi.addActivity(id, payload),
    onSuccess: () => { toast.success("Activity recorded"); setActivity({ type: "Call", notes: "", follow_up_date: "" }); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Activity could not be saved"),
  });
  const customerMutation = useMutation({
    mutationFn: addLeadAsCustomer,
    onSuccess: ({ alreadyExists }) => { toast.success(alreadyExists ? "Customer details updated" : "Lead added to Customers"); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Could not add lead as a customer"),
  });

  if (isLoading) return <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-muted)]">Loading lead details…</div>;
  if (isError || !lead) return <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center"><p className="text-sm font-semibold">{error?.response?.data?.message || "Lead not found"}</p><Link href="/admin/leads" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"><ArrowLeft size={14} /> Back to leads</Link></div>;

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
  const recordActivity = (event) => {
    event.preventDefault();
    activityMutation.mutate({ ...activity, follow_up_date: activity.follow_up_date || null });
  };
  const next = nextStatuses[lead.status] || [];
  const previous = previousStatus[lead.status];
  const products = lead.products || [];

  return <div className="space-y-4 text-[var(--text-primary)] sm:space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Link href="/admin/leads" className="inline-flex items-center gap-1 transition hover:text-[var(--accent)]"><ArrowLeft size={14} /> Leads</Link><ChevronRight size={13} /><span>{lead.lead_number}</span></div>
        <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><ContactRound size={23} /></span><div><h1 className="text-xl font-bold tracking-tight sm:text-2xl">{lead.lead_type === "Business" && lead.company_name ? lead.company_name : lead.name}</h1><p className="mt-0.5 text-xs text-[var(--text-muted)]">{lead.lead_number} <span className="px-1">·</span> {lead.lead_type} lead{lead.lead_type === "Business" ? ` · Contact: ${lead.name}` : ""}</p></div></div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className={`rounded-full px-2.5 py-1.5 text-xs font-bold ${statusTone[lead.status] || statusTone.New}`}>{lead.status}</span>
        {next.map((status) => <button key={status} type="button" disabled={statusMutation.isPending} onClick={() => changeStatus(status)} className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition disabled:opacity-50 ${status === "Lost" ? "border border-[var(--danger)]/25 text-[var(--danger-text)] hover:bg-[var(--danger-soft)]" : "bg-[var(--accent-soft)] text-[var(--accent)] hover:brightness-95"}`}>{status}<ArrowRight size={14} /></button>)}
        {previous && <button type="button" disabled={statusMutation.isPending} onClick={() => changeStatus(previous)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--danger)]/25 px-3 text-xs font-semibold text-[var(--danger-text)] transition hover:bg-[var(--danger-soft)] disabled:opacity-50"><RotateCcw size={14} /> Revert to {previous}</button>}
        {lead.status === "Converted" && (lead.customer_added ? <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[var(--success-soft)] px-3 text-xs font-semibold text-[var(--success-text)]"><CheckCircle2 size={14} /> Added to Customers</span> : <button type="button" disabled={customerMutation.isPending} onClick={() => customerMutation.mutate(lead)} className="inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-text)] transition hover:brightness-95 disabled:opacity-50"><Users size={14} />{customerMutation.isPending ? "Adding customer…" : "Add as customer"}</button>)}
        <Link href="/admin/leads" className="inline-flex h-9 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"><ArrowLeft size={14} /> Back to leads</Link>
      </div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={Users} label="Assigned employee" value={lead.assigned_employee_id?.name || "Unassigned"} />
      <Metric icon={BadgeDollarSign} label="Estimated value" value={currency(lead.estimated_deal_value)} />
      <Metric icon={CalendarDays} label="Next follow-up" value={dateOnly(lead.next_follow_up_date)} />
      <Metric icon={Tag} label="Lead source" value={lead.source || "Not provided"} />
    </section>

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={UserRound} title="Contact information" />
          <div className="grid gap-x-8 gap-y-1 p-4 sm:grid-cols-2 sm:p-5">
            <Fact icon={UserRound} label="Contact person" value={lead.name} />
            <Fact icon={Phone} label="Phone" value={lead.phone} />
            <Fact icon={Mail} label="Email" value={lead.email || "Not provided"} />
            <Fact icon={Tag} label="Lead source" value={lead.source} />
            <Fact icon={CalendarDays} label="Created" value={dateTime(lead.created_at)} />
            <Fact icon={Clock3} label="Last updated" value={dateTime(lead.updated_at)} />
          </div>
        </section>

        {lead.lead_type === "Business" && <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={Building2} title="Business information" />
          <div className="grid gap-x-8 gap-y-1 p-4 sm:grid-cols-2 sm:p-5">
            <Fact icon={Building2} label="Company" value={lead.company_name} />
            <Fact icon={Tag} label="Business type" value={lead.business_type} />
            <Fact icon={MapPin} label="Business address" value={lead.business_address} />
            <Fact icon={MapPin} label="City" value={lead.city} />
          </div>
        </section>}

        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={CalendarDays} title="Lead timeline" />
          <div className="grid gap-x-8 gap-y-1 p-4 sm:grid-cols-2 sm:p-5">
            <Fact icon={CalendarDays} label="Expected purchase" value={dateOnly(lead.expected_purchase_date)} />
            <Fact icon={CalendarDays} label="Next follow-up" value={dateOnly(lead.next_follow_up_date)} />
            <Fact icon={BadgeDollarSign} label="Estimated deal value" value={currency(lead.estimated_deal_value)} />
            {lead.lost_reason && <Fact icon={X} label="Lost reason" value={lead.lost_reason} />}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={Package} title="Product interest" trailing={<span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[10px] font-semibold text-[var(--accent)]">{products.length} items</span>} />
          <div className="space-y-3 p-4 sm:p-5">
            {lead.product_interest && <p className="rounded-xl bg-[var(--bg-card-alt)] p-3 text-sm text-[var(--text-secondary)]">{lead.product_interest}</p>}
            {products.length ? <div className="space-y-2">{products.map((item, index) => <div key={item._id || index} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-color)] p-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Package size={16} /></span><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.product_id?.name || "Product unavailable"}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{item.variant_id?.title || "No variant"}{item.variant_id?.sku ? ` · ${item.variant_id.sku}` : ""}</p></div></div><span className="rounded-lg bg-[var(--bg-tertiary)] px-2.5 py-1 text-xs font-semibold">Qty {item.quantity}</span></div>)}</div> : !lead.product_interest && <p className="text-sm text-[var(--text-muted)]">No product interest recorded.</p>}
            <div className="border-t border-[var(--border-color)] pt-3"><p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]">Custom requirements</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{lead.custom_requirements || "No custom requirements recorded."}</p></div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={Activity} title="Notes" />
          <p className="min-h-20 whitespace-pre-wrap p-4 text-sm leading-6 text-[var(--text-secondary)] sm:p-5">{lead.notes || "No notes have been added."}</p>
        </section>
      </div>

      <div className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
          <PanelHeader icon={Activity} title="Follow-up history" trailing={<span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent)]">{lead.activities?.length || 0}</span>} />
          <form onSubmit={recordActivity} className="space-y-2 border-b border-[var(--border-color)] p-4">
            <div className="grid grid-cols-2 gap-2"><label className="text-[10px] font-semibold text-[var(--text-muted)]">Type<select value={activity.type} onChange={(event) => setActivity({ ...activity, type: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-2 text-xs">{activityTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="text-[10px] font-semibold text-[var(--text-muted)]">Follow-up date<input type="date" value={activity.follow_up_date} onChange={(event) => setActivity({ ...activity, follow_up_date: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-2 text-xs" /></label></div>
            <label className="block text-[10px] font-semibold text-[var(--text-muted)]">Notes or outcome<textarea required rows={3} value={activity.notes} onChange={(event) => setActivity({ ...activity, notes: event.target.value })} className="mt-1 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] p-2 text-xs" /></label>
            <button type="submit" disabled={activityMutation.isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-text)] disabled:opacity-50"><Plus size={13} />{activityMutation.isPending ? "Saving…" : "Record activity"}</button>
          </form>
          <div className="max-h-[440px] space-y-0 overflow-y-auto p-4">{lead.activities?.length ? [...lead.activities].reverse().map((entry, index) => <div key={entry._id || index} className="relative border-l border-[var(--border-color)] pb-5 pl-4 last:border-0 last:pb-0"><span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-4 ring-[var(--bg-card)]" /><p className="text-xs font-semibold">{entry.type} · {entry.employee_id?.name || entry.employee_name || "Staff"}</p><p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[var(--text-secondary)]">{entry.notes}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{dateTime(entry.created_at)}{entry.follow_up_date ? ` · Follow-up ${dateOnly(entry.follow_up_date)}` : ""}</p></div>) : <p className="py-4 text-center text-xs text-[var(--text-muted)]">No interactions recorded yet.</p>}</div>
        </section>
      </div>
    </div>

    {lostReasonOpen && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !statusMutation.isPending) setLostReasonOpen(false); }}><form onSubmit={submitLostReason} className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-2xl"><div className="mb-4"><h2 className="text-base font-bold">Mark lead as lost</h2><p className="mt-1 text-xs text-[var(--text-muted)]">Add a reason before changing this lead’s status.</p></div><label className="block text-xs font-semibold text-[var(--text-secondary)]">Lost reason <span className="text-[var(--danger-text)]">*</span><textarea autoFocus required maxLength={1000} value={lostReason} onChange={(event) => setLostReason(event.target.value)} placeholder="Why was this lead lost?" rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={statusMutation.isPending} onClick={() => setLostReasonOpen(false)} className="h-9 rounded-xl border border-[var(--border-color)] px-4 text-xs font-semibold disabled:opacity-50">Cancel</button><button type="submit" disabled={!lostReason.trim() || statusMutation.isPending} className="h-9 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{statusMutation.isPending ? "Saving…" : "Confirm lost"}</button></div></form></div>}
  </div>;
}

function PanelHeader({ icon: Icon, title, trailing }) {
  return <div className="flex items-center gap-2.5 border-b border-[var(--border-color)] bg-[var(--bg-card-alt)] px-4 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm"><Icon size={15} /></span><h2 className="text-sm font-bold">{title}</h2><div className="ml-auto">{trailing}</div></div>;
}
function Fact({ icon: Icon, label, value }) {
  return <div className="group flex min-w-0 items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[var(--bg-row-hover)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors group-hover:text-[var(--accent)]"><Icon size={15} /></span><div className="min-w-0"><p className="text-[10px] font-medium text-[var(--text-muted)]">{label}</p><p className="mt-1 break-words text-xs font-semibold">{value || "—"}</p></div></div>;
}
function Metric({ icon: Icon, label, value, tone }) {
  return <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={17} /></span><div className="min-w-0"><p className="text-[10px] font-semibold text-[var(--text-muted)]">{label}</p><p className="mt-1 truncate text-sm font-bold text-[var(--text-primary)]">{tone ? <span className={`rounded-full px-2 py-1 text-[10px] ${tone}`}>{value}</span> : value}</p></div></div>;
}
