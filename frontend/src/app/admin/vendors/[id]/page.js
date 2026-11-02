"use client";
import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n/LanguageProvider";
import { vendorApi } from "@/apis/admin/vendorApi";
import { usePageTranslations } from "@/hooks/admin/usePageTranslations";
import { localizedStrictField } from "@/i18n/localize";
import { purchaseOrderApi } from "@/apis/admin/purchaseOrderApi";
import ActivityTimeline from "@/components/admin/ActivityTimeline";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";
import { toast } from "sonner";
import VendorFormModal, { emptyVendorForm, toVendorForm, toVendorPayload } from "@/components/admin/VendorFormModal";
import {
  ArrowLeft, Mail, Phone, MessageCircle, Star, Pencil, FileText,
  Wallet, ShoppingCart, Building2, MapPin, CalendarDays,
} from "lucide-react";

const edge = { border: "1px solid var(--border-color)" };
const cardStyle = { ...edge, background: "var(--bg-card)", borderRadius: 10, boxShadow: "var(--shadow-sm)" };
const muted = { color: "var(--text-secondary)" };
const primary = { color: "var(--text-primary)" };
const accent = { color: "var(--accent)" };
const accentBtn = { background: "var(--accent)", color: "var(--accent-text)" };
const intlLocale = (locale = "en") => locale === "ur" ? "ur-PK" : locale === "ar" ? "ar" : locale === "hi" ? "hi-IN" : locale === "en" ? "en-PK" : locale;
const money = (n, locale = "en") => `Rs. ${new Intl.NumberFormat(intlLocale(locale)).format(Math.max(0, Number(n) || 0))}`;
const fmtDate = (d, locale = "en") => (d ? new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" }).format(new Date(d)) : "—");

function getStatusLabels(tDetail) {
  return {
    pending: tDetail("statusLabels.pending"),
    confirmed: tDetail("statusLabels.confirmed"),
    received: tDetail("statusLabels.received"),
    closed: tDetail("statusLabels.closed"),
    cancelled: tDetail("statusLabels.cancelled"),
  };
}

function Panel({ title, icon: Icon, trailing, children, className = "" }) {
  return <section className={`min-w-0 overflow-hidden rounded-lg shadow-sm ${className}`} style={cardStyle}>
    <div className="flex min-h-10 items-center gap-2.5 border-b px-5 py-3" style={{ borderColor: "var(--border-color)", background: "var(--bg-tertiary)" }}>
      {Icon && <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)" }}><Icon size={15} strokeWidth={2} color="var(--accent)" /></div>}
      <h2 className="text-sm font-extrabold tracking-tight" style={primary}>{title}</h2>
      <div className="ml-auto">{trailing}</div>
    </div>
    {children}
  </section>;
}

function Pill({ tone, children }) {
  const map = {
    green: { backgroundColor: "var(--success-soft)", color: "var(--success-text)" },
    red: { backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" },
    amber: { backgroundColor: "color-mix(in srgb, #f59e0b 14%, transparent)", color: "#b45309" },
    blue: { backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" },
    gray: { backgroundColor: "var(--bg-tertiary)", color: "var(--text-muted)" },
  };
  return <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={map[tone] || map.gray}>{children}</span>;
}
const statusTone = (s) => ({ delivered: "green", closed: "green", paid: "green", pending: "amber", confirmed: "blue", cancelled: "red", unpaid: "red", partial: "amber" }[s] || "gray");

function Stars({ value }) {
  const r = Math.round(Number(value) || 0);
  return <span className="inline-flex items-center gap-0.5">{[1, 2, 3, 4, 5].map((s) => <Star key={s} size={13} style={{ color: s <= r ? "#f59e0b" : "var(--border-color)" }} />)}</span>;
}

function Dl({ label, value, mono, icon: Icon }) {
  return (
    <div className="grid grid-cols-[minmax(92px,.7fr)_minmax(0,1.3fr)] items-center gap-2 border-b py-2 text-[13px] last:border-0" style={{ borderColor: "var(--border-color)" }}>
      <div className="inline-flex items-center gap-1.5" style={muted}>{Icon && <Icon size={13} />}{label}</div>
      <div className={`min-w-0 break-words font-medium ${mono ? "font-mono" : ""}`} style={primary}>{value || "—"}</div>
    </div>
  );
}

export default function VendorDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { t: __t, locale } = useTranslation();
  const t = (k, p) => __t("admin.vendors." + k, p);
  const tDetail = (k, p) => __t("admin.vendors.detail." + k, p);
  const tToast = (k, p) => __t("admin.vendors.toast." + k, p);
  const tShared = (k, p) => __t("admin.shared." + k, p);
  
  const STATUS_LABEL = getStatusLabels(tDetail);
  
  const [tab, setTab] = useState("purchases");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyVendorForm);

  const { data: detail, isLoading } = useQuery({ queryKey: ["vendor", id], queryFn: () => vendorApi.getWithPOs(id) });
  usePageTranslations({ model: "Vendor", records: detail ? [detail] : [], locale, ready: !!detail && !isLoading, queryKey: ["vendor", id], queryClient: qc });
  const vendorText = (field) => localizedStrictField(detail?.[field], detail?.translations?.[field], locale);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["vendor", id] }); qc.invalidateQueries({ queryKey: ["vendors"] }); };

  const saveMutation = useMutation({
    mutationFn: () => vendorApi.update(id, toVendorPayload(form)),
    onSuccess: () => { toast.success(tToast("updated")); setShowModal(false); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || tToast("saveFailed")),
  });
  // Payments of recent POs for the activity timeline + payments tab (existing detail endpoint).
  const recentIds = useMemo(() => (detail?.purchaseOrders || []).slice(0, 10).map((p) => p._id), [detail]);
  const { data: paymentsByPo, isLoading: paymentsLoading, isError: paymentsError, refetch: refetchPayments } = useQuery({
    queryKey: ["vendor-po-payments", id],
    queryFn: async () => {
      const results = await Promise.all(recentIds.map(async (poId) => {
        const res = await purchaseOrderApi.getById(poId);
        return (res?.data?.payments || []).map((payment) => ({ ...payment, po_id: poId, po_number: res?.data?.po_number }));
      }));
      return results.flat().sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at));
    },
    enabled: !!detail && recentIds.length > 0,
  });

  const events = useMemo(() => {
    if (!detail) return [];
    const ev = [];
    for (const p of detail.purchaseOrders || []) {
      if (p.activity?.length) {
        ev.push(...p.activity.map((event) => ({ ...event, at: event.at || p.created_at, summary: `PO ${p.po_number} · ${String(event.type || "activity").replaceAll("_", " ")}` })));
      } else {
        ev.push({ type: "created", at: p.created_at, actor_name: p.createdby?.name || "Staff", summary: tDetail("events.poCreated", { number: p.po_number }), changes: [{ field: "Total", before: "—", after: money(p.total, locale) }] });
        for (const r of p.receivings || []) {
          const invoice = r.invoice_no ? tDetail("events.invoice", { invoice: r.invoice_no }) : "";
          const receiver = r.received_by_name ? tDetail("events.receivedBy", { name: r.received_by_name }) : "";
          ev.push({ type: "received", at: r.received_at, actor_name: r.received_by_name || "Staff", summary: tDetail("events.poReceived", { number: p.po_number }), changes: [{ field: "Receiving", before: "—", after: tDetail("events.receivingSummary", { count: new Intl.NumberFormat(intlLocale(locale)).format((r.items || []).reduce((s, x) => s + (x.qty || 0), 0)), units: tShared("label.units"), invoice: invoice ? ` · ${invoice}` : "", receiver: receiver ? ` · ${receiver}` : "" }) }] });
        }
      }
    }
    for (const pay of paymentsByPo || []) {
      const po = (detail.purchaseOrders || []).find((item) => String(item._id) === String(pay.po_id));
      const alreadyRecorded = po?.activity?.some((event) => event.type === "payment" && event.changes?.some((change) => Number(String(change.after || "").split(" · ")[1]) === Number(pay.amount)));
      if (!alreadyRecorded) ev.push({ type: "payment", at: pay.paid_at || pay.created_at, actor_name: "Staff", summary: tDetail("events.paymentReceived", { amount: money(pay.amount, locale) }), changes: [{ field: "Payment", before: "—", after: `${money(pay.amount, locale)} · ${pay.po_number || ""}` }] });
    }
    ev.push(...(detail.activity || []));
    if (!detail.activity?.length) ev.push({ type: "created", at: detail.created_at, actor_name: detail.createdby?.name || "Staff", summary: "Vendor created", changes: [{ field: "Vendor", before: "—", after: detail.name || "Vendor" }] });
    return ev;
  }, [detail, paymentsByPo, locale, tDetail, tShared]);

  if (isLoading) return <p className="text-sm p-6 text-center" style={{ color: "var(--text-muted)" }}>{tDetail("states.loading")}</p>;
  if (!detail) return <p className="text-sm p-6">{tDetail("states.notFound")} <Link className="underline" href="/admin/vendors">{tDetail("backTo")}</Link></p>;

  const recentPOs = (detail.purchaseOrders || []).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 items-start gap-3">
        <Link href="/admin/vendors" aria-label={t("page.title")} title={t("page.title")} className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition hover:bg-[var(--bg-row-hover)]" style={{ borderColor: "var(--border-color)", color: "var(--text-secondary)" }}><ArrowLeft size={16} /></Link>
        <div className="min-w-0 flex-1">
          <AdminPageHeader
            title={tDetail("pageTitle")}
            actions={<>
          <button onClick={() => router.push(`/admin/purchase-orders/new?vendor=${detail._id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold transition hover:opacity-90" style={accentBtn}><ShoppingCart size={14} /> {tDetail("createPO")}</button>
          <button onClick={() => { setForm(toVendorForm(detail)); setShowModal(true); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-semibold transition hover:bg-[var(--bg-row-hover)]" style={{ borderColor: "var(--border-color)", color: "var(--text-primary)" }}><Pencil size={14} /> {tDetail("edit")}</button>
            </>}
          />
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <main className="min-w-0 space-y-4 lg:col-span-8">
          <Panel title={tDetail("vendorInformation")} icon={Building2} trailing={<div className="flex items-center gap-2"><Pill tone={detail.is_active ? "green" : "red"}>{detail.is_active ? tShared("status.active") : tShared("status.inactive")}</Pill><span className="flex items-center gap-1.5"><Stars value={detail.rating} /><span className="text-xs font-bold" style={primary}>{(Number(detail.rating) || 0).toFixed(1)} / 5</span></span></div>}>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div className="space-y-0.5">
                <Dl label={tDetail("labels.vendorName")} value={vendorText("name")} />
                <Dl label={tDetail("labels.company")} value={vendorText("company_name")} />
                <Dl label={tDetail("labels.contactPerson")} value={detail.contact_person} />
                <Dl label={tDetail("vendorCode")} value={detail.vendor_code} mono />
                <Dl label={tDetail("labels.taxId")} value={detail.tax_id} />
                <Dl label={tDetail("labels.leadTime")} value={`${Number(detail.lead_time_days) || 0} ${tDetail("labels.days")}`} icon={CalendarDays} />
              </div>
              <div className="space-y-0.5">
                <Dl label={tDetail("labels.email")} value={detail.email} icon={Mail} />
                <Dl label={tDetail("labels.phone")} value={detail.phone} icon={Phone} />
                <Dl label={tDetail("labels.whatsapp")} value={detail.whatsapp} icon={MessageCircle} />
                <Dl label={tDetail("labels.address")} value={vendorText("address")} icon={MapPin} />
                <Dl label={tDetail("labels.cityState")} value={[vendorText("city"), vendorText("state")].filter(Boolean).join(", ")} />
                <Dl label={tDetail("labels.countryZIP")} value={[vendorText("country"), detail.zip_code].filter(Boolean).join(" · ")} />
              </div>
            </div>
            {(detail.bank_details?.bank || detail.bank_details?.account_title || detail.bank_details?.account_no) && (
              <div className="border-t px-4 py-3" style={{ borderColor: "var(--border-color)" }}>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={muted}>{tDetail("bankDetails")}</p>
                <div className="grid gap-x-4 sm:grid-cols-3">
                  <Dl label={tDetail("bank")} value={detail.bank_details?.bank} />
                  <Dl label={tDetail("accountTitle")} value={detail.bank_details?.account_title} />
                  <Dl label={tDetail("accountNo")} value={detail.bank_details?.account_no} mono />
                </div>
              </div>
            )}
          </Panel>

          {/* tabs */}
          <div className="overflow-hidden rounded-lg shadow-sm" style={cardStyle}>
            <div className="flex px-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--border-color)" }}>
              {[["purchases", tDetail("tabs.purchaseOrders")], ["payments", tDetail("tabs.payments")], ["activity", tDetail("tabs.activity")]].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className="px-4 py-2.5 text-[13px] font-semibold transition whitespace-nowrap" style={tab === k ? { color: "var(--accent)", borderBottom: "2px solid var(--accent)" } : { color: "var(--text-muted)" }}>{label}</button>
              ))}
            </div>
            <div className="p-4">
              {tab === "purchases" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                      <tr>{[tDetail("poTable.poNumber"), tDetail("poTable.date"), tDetail("poTable.lines"), tDetail("poTable.total"), tDetail("poTable.paid"), tDetail("poTable.status")].map((h) => <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(detail.purchaseOrders || []).map((p) => (
                        <tr key={p._id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <td className="px-3 py-2"><Link href={`/admin/purchase-orders/${p._id}`} className="font-mono underline" style={{ color: "var(--accent)" }}>{p.po_number}</Link></td>
                          <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>{fmtDate(p.created_at, locale)}</td>
                          <td className="px-3 py-2">{p.items?.length || 0}</td>
                          <td className="px-3 py-2 font-semibold">{money(p.total, locale)}</td>
                          <td className="px-3 py-2">{money(p.paid_amount, locale)}</td>
                          <td className="px-3 py-2"><Pill tone={statusTone(p.status)}>{STATUS_LABEL[p.status] || p.status}</Pill></td>
                        </tr>
                      ))}
                      {!(detail.purchaseOrders || []).length && <tr><td colSpan={6} className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>{tDetail("states.noPurchaseOrders")}</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              {tab === "payments" && (
                paymentsError ? <div className="py-8 text-center"><p className="text-sm" style={{ color: "var(--danger-text)" }}>{tDetail("states.loadPaymentsFailed")}</p><button onClick={() => refetchPayments()} className="mt-2 text-sm font-semibold hover:underline" style={accent}>{tDetail("states.tryAgain")}</button></div> :
                paymentsLoading ? <p className="py-8 text-center text-sm" style={muted}>{tDetail("states.loadingPayments")}</p> :
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-[13px]">
                      <thead style={{ background: "var(--bg-tertiary)", color: "var(--text-muted)" }}><tr>{[tDetail("paymentTable.purchaseOrder"), tDetail("paymentTable.paidAt"), tDetail("paymentTable.amount")].map((label) => <th key={label} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">{label}</th>)}</tr></thead>
                      <tbody>
                        {(paymentsByPo || []).map((payment, index) => (
                          <tr key={payment._id || `${payment.po_id}-${index}`} className="border-t" style={{ borderColor: "var(--border-color)" }}>
                            <td className="px-3 py-2.5"><Link href={`/admin/purchase-orders/${payment.po_id}`} className="font-mono font-semibold hover:underline" style={accent}>{payment.po_number || tDetail("viewPO")}</Link></td>
                            <td className="px-3 py-2.5" style={muted}>{fmtDate(payment.paid_at || payment.created_at, locale)}</td>
                            <td className="px-3 py-2.5 font-bold" style={primary}>{money(payment.amount, locale)}</td>
                          </tr>
                        ))}
                        {!(paymentsByPo || []).length && <tr><td colSpan={3} className="p-8 text-center text-sm" style={muted}>{tDetail("states.noPayments")}</td></tr>}
                      </tbody>
                    </table>
                  </div>
              )}
              {tab === "activity" && <ActivityTimeline events={events} title="Vendor activity" emptyText={tDetail("states.noActivity")} />}
            </div>
          </div>
        </main>

        {/* sidebar */}
        <aside className="space-y-4 lg:col-span-4">
          <Panel title={tDetail("businessSummary")} icon={Wallet}>
            <div className="grid grid-cols-3 divide-x p-4 text-center" style={{ borderColor: "var(--border-color)" }}>
              {[[tDetail("summary.purchased"), detail.total_purchased, "var(--accent)"], [tDetail("summary.paid"), detail.total_paid, "var(--success-text)"], [tDetail("summary.balance"), detail.balance_payable, "var(--danger-text)"]].map(([label, amount, color]) => (
                <div key={label} className="min-w-0 px-1">
                  <div className="text-[11px]" style={muted}>{label}</div>
                  <div className="mt-1 break-words text-[13px] font-extrabold" style={{ color }}>{money(amount, locale)}</div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title={tDetail("recentPurchaseOrders")} icon={FileText} trailing={<button onClick={() => setTab("purchases")} className="text-xs font-semibold hover:underline" style={accent}>{tDetail("viewAll")}</button>}>
            <div className="space-y-2 p-3">
              {recentPOs.map((p) => (
                <Link key={p._id} href={`/admin/purchase-orders/${p._id}`} className="flex items-center justify-between gap-2 rounded-xl border p-3 transition hover:border-blue-200 hover:bg-blue-50/40" style={{ borderColor: "var(--border-color)" }}>
                  <div className="min-w-0 text-[12px]"><div className="truncate font-mono font-bold" style={primary}>{p.po_number}</div><div className="mt-0.5" style={muted}>{fmtDate(p.created_at, locale)}</div></div>
                  <Pill tone={statusTone(p.status)}>{STATUS_LABEL[p.status] || p.status}</Pill>
                  <b className="whitespace-nowrap text-[12px]" style={primary}>{money(p.total, locale)}</b>
                </Link>
              ))}
              {!recentPOs.length && <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>{tDetail("states.noOrders")}</p>}
            </div>
          </Panel>
        </aside>
      </div>

      <VendorFormModal
        open={showModal}
        form={form}
        setForm={setForm}
        editing
        isPending={saveMutation.isPending}
        onSave={() => saveMutation.mutate()}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}
