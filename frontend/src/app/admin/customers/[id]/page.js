"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerApi } from "@/apis/admin/customerApi";
import ActivityTimeline from "@/components/admin/ActivityTimeline";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";
import { useTranslation } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarDays, Check, CreditCard, Mail, MapPin,
  Eye, FilePlus2, Pencil, Phone, Tag, Trash2, UserRound, X,
} from "lucide-react";

const emptyForm = { name: "", phone: "", email: "", address: "", notes: "" };
const money = (amount, locale) => `Rs. ${(Number(amount) || 0).toLocaleString(locale)}`;
const dateTime = (value, locale, t) => value ? new Date(value).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : t("common.notProvided");
const paymentLabel = (method, t) => { const normalized = String(method || "").toLowerCase(); const key = { cash: "cash", card: "card", bank_transfer: "bankTransfer" }[normalized]; return normalized ? (key ? t(`admin.pos.payment.${key}`) : normalized.replaceAll("_", " ")) : t("common.notProvided"); };
const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "C";

export default function CustomerDetailPage({ params }) {
  const { t, locale, dir } = useTranslation();
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
      toast.success(t("admin.customers.toast.updated"));
      setEditOpen(false);
      qc.invalidateQueries({ queryKey: ["customer-detail", id] });
      qc.invalidateQueries({ queryKey: ["customers-admin"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || t("admin.customers.toast.updateFailed")),
  });
  const deleteMutation = useMutation({
    mutationFn: () => customerApi.delete(id),
    onSuccess: () => {
      toast.success(t("admin.customers.toast.deleted"));
      qc.invalidateQueries({ queryKey: ["customers-admin"] });
      router.push("/admin/customers");
    },
    onError: (error) => toast.error(error?.response?.data?.message || t("admin.customers.toast.deleteFailed")),
  });

  const openEdit = () => {
    setForm({ name: customer.name || "", phone: customer.phone || "", email: customer.email || "", address: customer.address || "", notes: customer.notes || "" });
    setEditOpen(true);
  };
  const submitEdit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return toast.error(t("admin.customers.validation.nameRequired"));
    updateMutation.mutate(form);
  };

  if (isLoading) return <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-10 text-center text-sm text-[var(--text-muted)]">{t("admin.customers.detail.loading")}</div>;
  if (isError || !customer) return <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center"><p className="text-sm font-semibold">{t("admin.customers.detail.notFound")}</p><Link href="/admin/customers" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline"><ArrowLeft size={14} /> {t("admin.customers.detail.back")}</Link></div>;

  const facts = [
    { label: t("common.phone"), value: customer.phone || t("common.notProvided"), Icon: Phone },
    { label: t("common.email"), value: customer.email || t("common.notProvided"), Icon: Mail },
    { label: t("admin.customers.table.address"), value: customer.address || t("common.notProvided"), Icon: MapPin },
    { label: t("admin.customers.table.addedOn"), value: customer.created_at ? new Date(customer.created_at).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : t("common.notProvided"), Icon: CalendarDays },
  ];

  return <div dir={dir} className="space-y-4 text-[var(--text-primary)]">
    <div className="flex min-w-0 items-start gap-3">
      <Link href="/admin/customers" aria-label={t("admin.customers.title")} title={t("admin.customers.title")} className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition hover:bg-[var(--bg-row-hover)]" style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}><ArrowLeft size={16} /></Link>
      <div className="min-w-0 flex-1"><AdminPageHeader title={t("admin.customers.detail.pageTitle")} subtitle={customer.name} actions={<>
        <button type="button" onClick={openEdit} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-semibold transition hover:bg-[var(--bg-row-hover)]" style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}><Pencil size={14} /> {t("admin.customers.detail.edit")}</button>
        <button type="button" onClick={() => { if (window.confirm(t("admin.customers.confirm.delete", { name: customer.name }))) deleteMutation.mutate(); }} disabled={deleteMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-semibold transition hover:bg-[var(--danger-soft)] disabled:opacity-50" style={{ borderColor: "var(--danger)", color: "var(--danger-text)" }}><Trash2 size={14} /> {t("common.delete")}</button>
      </>} /></div>
    </div>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={CreditCard} label={t("admin.customers.detail.totalPurchases")} value={String(customer.total_sales || 0)} />
      <Metric icon={Tag} label={t("admin.customers.detail.totalSpent")} value={money(customer.total_spent, locale)} />
      <Metric icon={CalendarDays} label={t("admin.customers.detail.customerSince")} value={customer.created_at ? new Date(customer.created_at).toLocaleDateString(locale) : "—"} />
      <Metric icon={UserRound} label={t("admin.customers.detail.customerType")} value={t(customer.total_sales > 0 ? "admin.customers.detail.returning" : "admin.customers.detail.new")} />
    </section>

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]">
      <section className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
        <PanelHeader icon={UserRound} title={t("admin.customers.detail.information")} />
        <div className="grid gap-x-6 gap-y-0 p-3 sm:grid-cols-2 sm:p-4">
          {facts.map(({ label, value, Icon }) => <Fact key={label} icon={Icon} label={label} value={value} />)}
          <Fact icon={CalendarDays} label={t("admin.customers.detail.lastUpdated")} value={dateTime(customer.updated_at, locale, t)} />
        </div>
      </section>

      <div className="space-y-4">
        <section className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
          <PanelHeader icon={Tag} title={t("admin.customers.detail.notes")} />
          <div className="p-4"><p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-secondary)]">{customer.notes || t("admin.customers.detail.noNotes")}</p></div>
        </section>
        <ActivityTimeline events={customer.activity?.length ? customer.activity : [{ type: "created", at: customer.created_at, actor_name: customer.createdby?.name || "Staff", changes: [] }]} title="Customer activity" variant="simple" />
      </div>
    </div>

    <section className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
      <PanelHeader icon={CreditCard} title={t("admin.customers.detail.purchaseHistory")} trailing={<span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-semibold text-[var(--accent)]">{t("admin.customers.detail.purchases", { count: customer.total_sales || 0 })}</span>} />
      <div className="flex gap-5 border-b border-[var(--border-color)] px-4">{[["pos", t("admin.customers.detail.purchaseHistory")], ["quotes", "Quotes"], ["invoices", "Invoices"]].map(([key, label]) => <button key={key} type="button" onClick={() => setHistoryTab(key)} className={`border-b-2 px-1 py-3 text-xs font-medium transition-colors ${historyTab === key ? "border-[var(--accent)] text-[var(--accent)]" : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"}`}>{label}</button>)}</div>
      {historyTab === "pos" && <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-start">
        <thead className="bg-[var(--bg-tertiary)] text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]"><tr><th className="px-4 py-3">{t("admin.customers.detail.posNumber")}</th><th className="px-4 py-3">{t("common.date")}</th><th className="px-4 py-3">{t("admin.pos.ui.paymentMethod")}</th><th className="px-4 py-3 text-end">{t("common.total")}</th><th className="w-14 px-4 py-3 text-end">{t("admin.customers.detail.view")}</th></tr></thead>
        <tbody>{(customer.recent_sales || []).map((sale) => <tr key={sale._id} className="border-t border-[var(--border-color)] transition-colors hover:bg-[var(--bg-row-hover)]"><td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--accent)]">{sale.sale_number || `POS-${String(sale._id).slice(-6)}`}</td><td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{dateTime(sale.created_at, locale, t)}</td><td className="px-4 py-3 text-xs capitalize text-[var(--text-secondary)]">{paymentLabel(sale.payment?.method, t)}</td><td className="px-4 py-3 text-end text-xs font-bold">{money(sale.total, locale)}</td><td className="px-4 py-3 text-end"><Link href={`/admin/pos/history/${sale._id}`} aria-label={t("admin.customers.detail.viewSale", { sale: sale.sale_number || t("admin.customers.detail.details") })} title={t("admin.customers.detail.viewSaleDetails")} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-color)] text-[var(--accent)] transition hover:bg-[var(--bg-row-hover)]"><Eye size={15} /></Link></td></tr>)}
          {!(customer.recent_sales || []).length && <tr><td colSpan={5} className="px-4 py-10 text-center text-xs text-[var(--text-muted)]">{t("admin.customers.detail.noPurchases")}</td></tr>}
        </tbody>
      </table></div>}
      {historyTab === "quotes" && <DocumentHistory records={customer.quote_history || []} numberKey="quote_number" dateKey="quote_date" hrefBase="/admin/quotes" emptyText="No quotes recorded for this customer yet." />}
      {historyTab === "invoices" && <DocumentHistory records={customer.invoice_history || []} numberKey="invoice_number" dateKey="invoice_date" hrefBase="/admin/invoices" emptyText="No invoices recorded for this customer yet." />}
    </section>

    {editOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-[fadeIn_180ms_ease-out]" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditOpen(false); }}>
      <form onSubmit={submitEdit} className="w-full max-w-xl overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-2xl animate-[modalIn_220ms_cubic-bezier(0.16,1,0.3,1)]">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-gradient-to-r from-[var(--bg-card-alt)] to-[var(--accent-soft)] px-5 py-4"><div><h2 className="text-base font-bold">{t("admin.customers.modal.edit")}</h2><p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("admin.customers.detail.editDescription")}</p></div><button type="button" onClick={() => setEditOpen(false)} className="rounded-lg p-2 text-[var(--text-muted)] transition hover:bg-[var(--bg-card)]" aria-label={t("common.close")}><X size={17} /></button></div>
        <div className="grid gap-3 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><EditField label={t("admin.customers.modal.name")} required value={form.name} onChange={(value) => setForm({ ...form, name: value })} /></div><EditField label={t("admin.customers.modal.phone")} value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} /><EditField label={t("admin.customers.modal.email")} type="email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} /><div className="sm:col-span-2"><EditField label={t("admin.customers.modal.address")} value={form.address} onChange={(value) => setForm({ ...form, address: value })} /></div><label className="space-y-1.5 text-xs font-semibold text-[var(--text-secondary)] sm:col-span-2">{t("admin.customers.modal.notes")}<textarea rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm font-normal text-[var(--text-primary)] outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]" /></label></div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-color)] px-5 py-3"><button type="button" onClick={() => setEditOpen(false)} className="h-10 rounded-xl border border-[var(--border-color)] px-4 text-xs font-semibold text-[var(--text-secondary)]">{t("common.cancel")}</button><button type="submit" disabled={updateMutation.isPending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-5 text-xs font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50"><Check size={14} />{updateMutation.isPending ? t("admin.customers.modal.saving") : t("admin.customers.modal.saveChanges")}</button></div>
      </form>
    </div>}

  </div>;
}

function Metric({ label, value }) {
  return <div className="min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:p-4"><p className="text-[11px] font-medium text-[var(--text-muted)]">{label}</p><p className="mt-1 truncate text-lg font-bold">{value}</p></div>;
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
  return <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-4 py-3"><Icon size={16} className="text-[var(--accent)]" /><h2 className="text-sm font-semibold">{title}</h2><div className="ms-auto">{trailing}</div></div>;
}
function Fact({ label, value }) {
  return <div className="min-w-0 border-b border-[var(--border-color)] px-1 py-3"><p className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-muted)]">{label}</p><p className="mt-1 break-words text-[13px] font-medium text-[var(--text-primary)]">{value}</p></div>;
}
function EditField({ label, value, onChange, type = "text", required = false }) {
  return <label className="space-y-1.5 text-xs font-semibold text-[var(--text-secondary)]">{label}{required && <span className="text-[var(--danger-text)]"> *</span>}<input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 text-sm font-normal text-[var(--text-primary)] outline-none transition hover:shadow-sm focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]" /></label>;
}
