"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerApi } from "@/apis/admin/customerApi";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarDays, Check, ChevronRight, CreditCard, Mail, MapPin,
  Eye, FilePlus2, Pencil, Phone, Tag, Trash2, UserRound, Users, X,
} from "lucide-react";

const emptyForm = { name: "", phone: "", email: "", address: "", notes: "" };
const money = (amount) => `Rs. ${(Number(amount) || 0).toLocaleString()}`;
const dateTime = (value) => value ? new Date(value).toLocaleString([], { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "C";

export default function CustomerDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState("pos");
  const [form, setForm] = useState(emptyForm);
  const { data: customer, isLoading, isError } = useQuery({ queryKey: ["customer-detail", id], queryFn: () => customerApi.getById(id) });

  const updateMutation = useMutation({
    mutationFn: (payload) => customerApi.update(id, payload),
    onSuccess: () => {
      toast.success("Customer updated");
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["customer-detail", id] });
      qc.invalidateQueries({ queryKey: ["customers-admin"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Customer update failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: () => customerApi.delete(id),
    onSuccess: () => {
      toast.success("Customer deleted");
      qc.invalidateQueries({ queryKey: ["customers-admin"] });
      router.push("/admin/customers");
    },
    onError: (error) => toast.error(error?.response?.data?.message || "Delete failed"),
  });

  const openEdit = () => {
    setForm({ name: customer.name || "", phone: customer.phone || "", email: customer.email || "", address: customer.address || "", notes: customer.notes || "" });
    setEditOpen(true);
  };
  const submitEdit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return toast.error("Customer name is required");
    updateMutation.mutate(form);
  };

  if (isLoading) return <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-muted)]">Loading customer details…</div>;
  if (isError || !customer) return <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center"><p className="text-sm font-semibold">Customer not found</p><Link href="/admin/customers" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"><ArrowLeft size={14} /> Back to customers</Link></div>;

  const facts = [
    { label: "Phone", value: customer.phone || "Not provided", Icon: Phone },
    { label: "Email", value: customer.email || "Not provided", Icon: Mail },
    { label: "Address", value: customer.address || "Not provided", Icon: MapPin },
    { label: "Added On", value: dateTime(customer.created_at), Icon: CalendarDays },
  ];

  return <div className="space-y-4 text-[var(--text-primary)]">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="mb-2 flex items-center gap-1.5 text-xs text-[var(--text-muted)]"><Link href="/admin/customers" className="inline-flex items-center gap-1 transition hover:text-[var(--accent)]"><ArrowLeft size={14} /> Customers</Link><ChevronRight size={13} /><span>{customer.name}</span></div>
        <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Users size={22} /></span><div><h1 className="text-xl font-bold tracking-tight sm:text-2xl">{customer.name}</h1><p className="mt-0.5 text-xs text-[var(--text-muted)]">Customer profile and purchase information</p></div></div>
      </div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => router.push(`/admin/quotes/new?customer=${customer._id}`)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-xs font-semibold text-blue-700 transition-all hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-md"><FilePlus2 size={14} /> Create Quote</button><button type="button" onClick={() => router.push(`/admin/invoices/new?customer=${customer._id}`)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><FilePlus2 size={14} /> Create Invoice</button><button type="button" onClick={openEdit} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 text-xs font-semibold text-[var(--text-secondary)] transition-all hover:-translate-y-0.5 hover:border-[var(--accent)] hover:text-[var(--accent)] hover:shadow-md"><Pencil size={14} /> Edit Customer</button><button type="button" onClick={() => { if (window.confirm(`Delete ${customer.name}?`)) deleteMutation.mutate(); }} disabled={deleteMutation.isPending} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--danger)]/30 bg-[var(--bg-card)] px-4 text-xs font-semibold text-[var(--danger-text)] transition-all hover:-translate-y-0.5 hover:bg-[var(--danger-soft)] hover:shadow-md disabled:opacity-50"><Trash2 size={14} /> Delete</button></div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={CreditCard} label="Total Purchases" value={String(customer.total_sales || 0)} />
      <Metric icon={Tag} label="Total Spent" value={money(customer.total_spent)} />
      <Metric icon={CalendarDays} label="Customer Since" value={customer.created_at ? new Date(customer.created_at).toLocaleDateString() : "—"} />
      <Metric icon={UserRound} label="Customer Type" value={customer.total_sales > 0 ? "Returning" : "New Customer"} />
    </section>

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
      <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
        <PanelHeader icon={UserRound} title="Customer Information" />
        <div className="grid gap-x-8 gap-y-1 p-4 sm:grid-cols-2 sm:p-5">
          {facts.map(({ label, value, Icon }) => <Fact key={label} icon={Icon} label={label} value={value} />)}
          <Fact icon={CalendarDays} label="Last Updated" value={dateTime(customer.updated_at)} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
        <PanelHeader icon={Tag} title="Customer Notes" />
        <div className="min-h-36 p-4 sm:p-5"><p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{customer.notes || "No notes have been added for this customer."}</p></div>
      </section>
    </div>

    <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-sm">
      <PanelHeader icon={CreditCard} title="Customer History" trailing={<span className="text-[10px] text-[var(--text-muted)]">{(customer.total_sales || 0) + (customer.quote_count || 0) + (customer.invoice_count || 0)} total records</span>} />
      <div className="border-b border-[var(--border-color)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Customer history type">
          {[
            { id: "pos", label: "POS", count: customer.total_sales || 0 },
            { id: "quotes", label: "Quotes", count: customer.quote_count || 0 },
            { id: "invoices", label: "Invoices", count: customer.invoice_count || 0 },
          ].map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={historyTab === tab.id} onClick={() => setHistoryTab(tab.id)} className={`rounded-full px-4 py-2 text-xs font-medium transition-all ${historyTab === tab.id ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            {tab.label} <span className={historyTab === tab.id ? "ml-1 text-blue-100" : "ml-1 text-slate-500"}>({tab.count})</span>
          </button>)}
        </div>
      </div>
      {historyTab === "pos" && <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left">
        <thead className="bg-[var(--bg-tertiary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]"><tr><th className="px-4 py-3">POS Number</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Payment Method</th><th className="px-4 py-3 text-right">Total</th><th className="w-14 px-4 py-3 text-right">View</th></tr></thead>
        <tbody>{(customer.recent_sales || []).map((sale) => <tr key={sale._id} className="border-t border-[var(--border-color)] transition-colors hover:bg-[var(--bg-row-hover)]"><td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{sale.sale_number || `POS-${String(sale._id).slice(-6)}`}</td><td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{dateTime(sale.created_at)}</td><td className="px-4 py-3 text-xs capitalize text-[var(--text-secondary)]">{String(sale.payment?.method || "—").replaceAll("_", " ")}</td><td className="px-4 py-3 text-right text-xs font-bold">{money(sale.total)}</td><td className="px-4 py-3 text-right"><Link href={`/admin/pos/history/${sale._id}`} aria-label={`View POS sale ${sale.sale_number || "details"}`} title="View sale details" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"><Eye size={15} /></Link></td></tr>)}
          {!(customer.recent_sales || []).length && <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-[var(--text-muted)]">No purchases recorded for this customer yet.</td></tr>}
        </tbody>
      </table></div>}
      {historyTab === "quotes" && <DocumentHistory records={customer.quote_history || []} numberKey="quote_number" dateKey="quote_date" hrefBase="/admin/quotes" emptyText="No quotes recorded for this customer yet." />}
      {historyTab === "invoices" && <DocumentHistory records={customer.invoice_history || []} numberKey="invoice_number" dateKey="invoice_date" hrefBase="/admin/invoices" emptyText="No invoices recorded for this customer yet." />}
    </section>

    {editOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-[fadeIn_180ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditOpen(false); }}>
      <form onSubmit={submitEdit} className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl animate-[modalIn_220ms_cubic-bezier(0.16,1,0.3,1)]">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-gradient-to-r from-[var(--bg-card-alt)] to-[var(--accent-soft)] px-5 py-4"><div><h2 className="text-base font-bold">Edit Customer</h2><p className="mt-0.5 text-xs text-[var(--text-muted)]">Name is required; phone and address are optional.</p></div><button type="button" onClick={() => setEditOpen(false)} className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-card)]" aria-label="Close"><X size={17} /></button></div>
        <div className="grid gap-3 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><EditField label="Name" required value={form.name} onChange={(value) => setForm({ ...form, name: value })} /></div><EditField label="Phone" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><EditField label="Email" type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><div className="sm:col-span-2"><EditField label="Address" value={form.address} onChange={(value) => setForm({ ...form, address: value })} /></div><label className="space-y-1.5 text-xs font-semibold text-[var(--text-secondary)] sm:col-span-2">Notes<textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm font-normal text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]" /></label></div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-color)] px-5 py-3"><button type="button" onClick={() => setEditOpen(false)} className="h-10 rounded-xl border border-[var(--border-color)] px-4 text-xs font-semibold text-[var(--text-secondary)]">Cancel</button><button type="submit" disabled={updateMutation.isPending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 text-xs font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"><Check size={14} />{updateMutation.isPending ? "Saving…" : "Save Changes"}</button></div>
      </form>
    </div>}

  </div>;
}

function Metric({ icon: Icon, label, value }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Icon size={17} /></span><div className="min-w-0"><p className="text-[10px] font-semibold text-[var(--text-muted)]">{label}</p><p className="mt-1 truncate text-sm font-bold">{value}</p></div></div>;
}
function DocumentHistory({ records, numberKey, dateKey, hrefBase, emptyText }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left">
      <thead className="bg-[var(--bg-tertiary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-muted)]"><tr><th className="px-4 py-3">Number</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Total</th><th className="w-14 px-4 py-3 text-right">View</th></tr></thead>
      <tbody>{records.map((record) => <tr key={record._id} className="border-t border-[var(--border-color)] transition-colors hover:bg-[var(--bg-row-hover)]">
        <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-700">{record[numberKey] || "—"}</td>
        <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--text-secondary)]">{dateTime(record[dateKey] || record.created_at)}</td>
        <td className="px-4 py-3"><span className="inline-flex rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent)]">{record.status || "—"}</span></td>
        <td className="whitespace-nowrap px-4 py-3 text-right text-xs font-bold">{money(record.total)}</td>
        <td className="px-4 py-3 text-right"><Link href={`${hrefBase}/${record._id}`} aria-label={`View ${record[numberKey] || "record"}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"><Eye size={15} /></Link></td>
      </tr>)}
        {!records.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-[var(--text-muted)]">{emptyText}</td></tr>}
      </tbody>
    </table></div>;
}
function PanelHeader({ icon: Icon, title, trailing }) {
  return <div className="flex items-center gap-2.5 border-b border-[var(--border-color)] bg-[var(--bg-card-alt)] px-4 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm"><Icon size={15} /></span><h2 className="text-sm font-bold">{title}</h2><div className="ml-auto">{trailing}</div></div>;
}
function Fact({ icon: Icon, label, value }) {
  return <div className="group flex min-w-0 items-start gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-[var(--bg-row-hover)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors group-hover:text-[var(--accent)]"><Icon size={15} /></span><div className="min-w-0"><p className="text-[10px] font-medium text-[var(--text-muted)]">{label}</p><p className="mt-1 break-words text-xs font-semibold">{value}</p></div></div>;
}
function EditField({ label, value, onChange, type = "text", required = false }) {
  return <label className="space-y-1.5 text-xs font-semibold text-[var(--text-secondary)]">{label}{required && <span className="text-[var(--danger-text)]"> *</span>}<input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 text-sm font-normal text-[var(--text-primary)] outline-none transition hover:shadow-sm focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]" /></label>;
}
