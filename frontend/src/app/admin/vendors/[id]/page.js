"use client";
import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vendorApi } from "@/apis/admin/vendorApi";
import { purchaseOrderApi } from "@/apis/admin/purchaseOrderApi";
import { toast } from "sonner";
import VendorFormModal, { emptyVendorForm, toVendorForm, toVendorPayload } from "@/components/admin/VendorFormModal";
import {
  ArrowLeft, Mail, Phone, MessageCircle, Star, Pencil, FileText,
  Wallet, ShoppingCart, Building2, MapPin, CalendarDays, ChevronRight,
} from "lucide-react";

const edge = { border: "1px solid #dce8f8" };
const cardStyle = { ...edge, background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", borderRadius: 14, boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)" };
const muted = { color: "#64748b" };
const primary = { color: "#0f172a" };
const accent = { color: "#2563eb" };
const accentBtn = { background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "#fff" };
const money = (n) => `Rs. ${(Math.max(0, Number(n) || 0)).toLocaleString()}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const STATUS_LABEL = { pending: "Pending", confirmed: "Confirmed", delivered: "Received", closed: "Closed", cancelled: "Cancelled" };

function Panel({ title, icon: Icon, trailing, children, className = "" }) {
  return <section className={`min-w-0 overflow-hidden rounded-2xl shadow-lg ${className}`} style={cardStyle}>
    <div className="flex min-h-10 items-center gap-2.5 border-b px-5 py-3" style={{ borderColor: "#e2e8f0", background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)" }}>
      {Icon && <div className="flex h-8 w-8 items-center justify-center rounded-lg shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}><Icon size={15} strokeWidth={2.5} color="#fff" /></div>}
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
    <div className="grid grid-cols-[minmax(92px,.7fr)_minmax(0,1.3fr)] items-center gap-2 border-b py-2 text-[13px] last:border-0" style={{ borderColor: "#eaf0f8" }}>
      <div className="inline-flex items-center gap-1.5" style={muted}>{Icon && <Icon size={13} />}{label}</div>
      <div className={`min-w-0 break-words font-medium ${mono ? "font-mono" : ""}`} style={primary}>{value || "—"}</div>
    </div>
  );
}

export default function VendorDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState("purchases");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyVendorForm);
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: detail, isLoading } = useQuery({ queryKey: ["vendor", id], queryFn: () => vendorApi.getWithPOs(id) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["vendor", id] }); qc.invalidateQueries({ queryKey: ["vendors"] }); };

  const saveMutation = useMutation({
    mutationFn: () => vendorApi.update(id, toVendorPayload(form)),
    onSuccess: () => { toast.success("Vendor updated"); setShowModal(false); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Save failed"),
  });
  const toggleMutation = useMutation({
    mutationFn: () => vendorApi.update(id, { is_active: !detail?.is_active }),
    onSuccess: () => { toast.success(detail?.is_active ? "Vendor deactivated" : "Vendor activated"); setMenuOpen(false); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: () => vendorApi.delete(id),
    onSuccess: () => { toast.success("Vendor deleted"); router.push("/admin/vendors"); },
    onError: (e) => toast.error(e?.response?.data?.message || "Delete failed"),
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
      ev.push({ t: p.created_at, label: `${p.po_number} created`, sub: `${(p.items || []).length} lines · ${money(p.total)}` });
      for (const r of p.receivings || []) {
        const invoice = r.invoice_no ? ` · Invoice ${r.invoice_no}` : "";
        const receiver = r.received_by_name ? ` · ${r.received_by_name}` : "";
        ev.push({ t: r.received_at, label: `${p.po_number} received`, sub: `${(r.items || []).reduce((s, x) => s + (x.qty || 0), 0)} units${invoice}${receiver}` });
      }
    }
    for (const pay of paymentsByPo || []) ev.push({ t: pay.paid_at || pay.created_at, label: `Payment of ${money(pay.amount)} received`, sub: pay.po_number || "" });
    return ev.sort((a, b) => new Date(b.t) - new Date(a.t));
  }, [detail, paymentsByPo]);

  if (isLoading) return <p className="text-sm p-6 text-center" style={{ color: "var(--text-muted)" }}>Loading vendor...</p>;
  if (!detail) return <p className="text-sm p-6">Vendor not found. <Link className="underline" href="/admin/vendors">Back to vendors</Link></p>;

  const recentPOs = (detail.purchaseOrders || []).slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-1.5 text-sm" style={muted}>
            <Link href="/admin/vendors" className="inline-flex items-center gap-1 hover:text-blue-700"><ArrowLeft size={14} />Vendors</Link>
            <ChevronRight size={13} />
            <span className="truncate" style={primary}>{detail.name}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border bg-white" style={{ borderColor: "#cfe0f8", color: "#2878f0" }}><Building2 size={18} /></div>
            <h1 className="text-xl font-bold" style={primary}>{detail.name}</h1>
            <Pill tone={detail.is_active ? "green" : "red"}>{detail.is_active ? "Active" : "Inactive"}</Pill>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 pl-11 text-xs" style={muted}>
            <span className="font-mono">Vendor Code: {detail.vendor_code || "—"}</span>
            {detail.company_name && <span>{detail.company_name}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => router.push(`/admin/purchase-orders/new?vendor=${detail._id}`)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold transition hover:opacity-90" style={accentBtn}><ShoppingCart size={14} /> Create PO</button>
          <button onClick={() => { setForm(toVendorForm(detail)); setShowModal(true); }} className="h-9 px-3.5 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition hover:opacity-90" style={{ ...cardStyle, color: "#2563eb" }}><Pencil size={14} /> Edit</button>
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} className="h-9 px-3 rounded-lg text-[13px] font-semibold transition hover:opacity-80" style={{ ...cardStyle, color: "#334155" }}>More ▾</button>
            {menuOpen && (
              <div className="absolute right-0 top-10 z-30 w-44 overflow-hidden rounded-xl shadow-xl" style={cardStyle}>
                <button onClick={() => toggleMutation.mutate()} disabled={toggleMutation.isPending} className="w-full px-3 py-2.5 text-left text-[13px] transition hover:bg-slate-50 disabled:opacity-50">{detail.is_active ? "Deactivate vendor" : "Activate vendor"}</button>
                <button onClick={() => { setMenuOpen(false); if (confirm("Delete this vendor?")) deleteMutation.mutate(); }} disabled={deleteMutation.isPending} className="w-full px-3 py-2.5 text-left text-[13px] transition hover:bg-red-50" style={{ color: "#cf3348" }}>Delete vendor</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <main className="min-w-0 space-y-4 lg:col-span-8">
          <Panel title="Vendor Information" icon={Building2} trailing={<div className="flex items-center gap-1.5"><Stars value={detail.rating} /><span className="text-xs font-bold" style={primary}>{(Number(detail.rating) || 0).toFixed(1)} / 5</span></div>}>
            <div className="grid gap-4 p-4 md:grid-cols-2">
              <div className="space-y-0.5">
                <Dl label="Vendor Name" value={detail.name} />
                <Dl label="Company" value={detail.company_name} />
                <Dl label="Contact Person" value={detail.contact_person} />
                <Dl label="Vendor Code" value={detail.vendor_code} mono />
                <Dl label="Tax ID" value={detail.tax_id} />
                <Dl label="Lead Time" value={`${Number(detail.lead_time_days) || 0} days`} icon={CalendarDays} />
              </div>
              <div className="space-y-0.5">
                <Dl label="Email" value={detail.email} icon={Mail} />
                <Dl label="Phone" value={detail.phone} icon={Phone} />
                <Dl label="WhatsApp" value={detail.whatsapp} icon={MessageCircle} />
                <Dl label="Address" value={detail.address} icon={MapPin} />
                <Dl label="City / State" value={[detail.city, detail.state].filter(Boolean).join(", ")} />
                <Dl label="Country / ZIP" value={[detail.country, detail.zip_code].filter(Boolean).join(" · ")} />
              </div>
            </div>
            {(detail.bank_details?.bank || detail.bank_details?.account_title || detail.bank_details?.account_no) && (
              <div className="border-t px-4 py-3" style={{ borderColor: "#eaf0f8" }}>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={muted}>Bank Details</p>
                <div className="grid gap-x-4 sm:grid-cols-3">
                  <Dl label="Bank" value={detail.bank_details?.bank} />
                  <Dl label="Account Title" value={detail.bank_details?.account_title} />
                  <Dl label="Account No" value={detail.bank_details?.account_no} mono />
                </div>
              </div>
            )}
          </Panel>

          {/* tabs */}
          <div className="overflow-hidden rounded-2xl shadow-lg" style={cardStyle}>
            <div className="flex px-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--border-color)" }}>
              {[["purchases", "Purchase Orders"], ["payments", "Payments"], ["activity", "Activity"]].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className="px-4 py-2.5 text-[13px] font-semibold transition whitespace-nowrap" style={tab === k ? { color: "var(--accent)", borderBottom: "2px solid var(--accent)" } : { color: "var(--text-muted)" }}>{label}</button>
              ))}
            </div>
            <div className="p-4">
              {tab === "purchases" && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                      <tr>{["PO Number", "Date", "Lines", "Total", "Paid", "Status"].map((h) => <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {(detail.purchaseOrders || []).map((p) => (
                        <tr key={p._id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                          <td className="px-3 py-2"><Link href={`/admin/purchase-orders/${p._id}`} className="font-mono underline" style={{ color: "var(--accent)" }}>{p.po_number}</Link></td>
                          <td className="px-3 py-2" style={{ color: "var(--text-secondary)" }}>{fmtDate(p.created_at)}</td>
                          <td className="px-3 py-2">{p.items?.length || 0}</td>
                          <td className="px-3 py-2 font-semibold">{money(p.total)}</td>
                          <td className="px-3 py-2">{money(p.paid_amount)}</td>
                          <td className="px-3 py-2"><Pill tone={statusTone(p.status)}>{STATUS_LABEL[p.status] || p.status}</Pill></td>
                        </tr>
                      ))}
                      {!(detail.purchaseOrders || []).length && <tr><td colSpan={6} className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No purchase orders yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              {tab === "payments" && (
                paymentsError ? <div className="py-8 text-center"><p className="text-sm" style={{ color: "#cf3348" }}>Could not load payment history.</p><button onClick={() => refetchPayments()} className="mt-2 text-sm font-semibold hover:underline" style={accent}>Try again</button></div> :
                paymentsLoading ? <p className="py-8 text-center text-sm" style={muted}>Loading payments...</p> :
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-[13px]">
                      <thead style={{ background: "#f8fbff", color: "#627b9f" }}><tr>{["Purchase Order", "Paid At", "Amount"].map((label) => <th key={label} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">{label}</th>)}</tr></thead>
                      <tbody>
                        {(paymentsByPo || []).map((payment, index) => (
                          <tr key={payment._id || `${payment.po_id}-${index}`} className="border-t" style={{ borderColor: "#eaf0f8" }}>
                            <td className="px-3 py-2.5"><Link href={`/admin/purchase-orders/${payment.po_id}`} className="font-mono font-semibold hover:underline" style={accent}>{payment.po_number || "View PO"}</Link></td>
                            <td className="px-3 py-2.5" style={muted}>{fmtDate(payment.paid_at || payment.created_at)}</td>
                            <td className="px-3 py-2.5 font-bold" style={primary}>{money(payment.amount)}</td>
                          </tr>
                        ))}
                        {!(paymentsByPo || []).length && <tr><td colSpan={3} className="p-8 text-center text-sm" style={muted}>No payments recorded yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
              )}
              {tab === "activity" && (
                <div className="space-y-1">
                  {events.map((e, i) => (
                    <div key={i} className="flex gap-3 py-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "var(--accent)" }} />
                      <div className="text-[13px]"><div className="font-semibold">{e.label}</div>
                        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{e.sub}{e.sub ? " · " : ""}{e.t ? new Date(e.t).toLocaleString() : ""}</div>
                      </div>
                    </div>
                  ))}
                  {!events.length && <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>No activity yet.</p>}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* sidebar */}
        <aside className="space-y-4 lg:col-span-4">
          <Panel title="Business Summary" icon={Wallet}>
            <div className="grid grid-cols-3 divide-x p-4 text-center" style={{ borderColor: "#eaf0f8" }}>
              {[["Purchased", detail.total_purchased, "#2563eb"], ["Paid", detail.total_paid, "#079878"], ["Balance", detail.balance_payable, "#cf3348"]].map(([label, amount, color]) => (
                <div key={label} className="min-w-0 px-1">
                  <div className="text-[11px]" style={muted}>{label}</div>
                  <div className="mt-1 break-words text-[13px] font-extrabold" style={{ color }}>{money(amount)}</div>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Recent Purchase Orders" icon={FileText} trailing={<button onClick={() => setTab("purchases")} className="text-xs font-semibold hover:underline" style={accent}>View all</button>}>
            <div className="space-y-2 p-3">
              {recentPOs.map((p) => (
                <Link key={p._id} href={`/admin/purchase-orders/${p._id}`} className="flex items-center justify-between gap-2 rounded-xl border p-3 transition hover:border-blue-200 hover:bg-blue-50/40" style={{ borderColor: "#eaf0f8" }}>
                  <div className="min-w-0 text-[12px]"><div className="truncate font-mono font-bold" style={primary}>{p.po_number}</div><div className="mt-0.5" style={muted}>{fmtDate(p.created_at)}</div></div>
                  <Pill tone={statusTone(p.status)}>{STATUS_LABEL[p.status] || p.status}</Pill>
                  <b className="whitespace-nowrap text-[12px]" style={primary}>{money(p.total)}</b>
                </Link>
              ))}
              {!recentPOs.length && <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>No orders yet.</p>}
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
