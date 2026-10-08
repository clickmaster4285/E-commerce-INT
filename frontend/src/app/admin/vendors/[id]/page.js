"use client";
import { use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vendorApi } from "@/apis/admin/vendorApi";
import { purchaseOrderApi } from "@/apis/admin/purchaseOrderApi";
import { toast } from "sonner";
import { Country, State, City } from "country-state-city";
import {
  ArrowLeft, Mail, Phone, MessageCircle, Star, Pencil, Trash2,
  FileText, Wallet, ShoppingCart,
} from "lucide-react";

const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
const accentBtn = { backgroundColor: "var(--accent)", color: "var(--accent-text)" };
const money = (n) => `Rs. ${(Math.max(0, Number(n) || 0)).toLocaleString()}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");
const STATUS_LABEL = { pending: "Pending", confirmed: "Confirmed", delivered: "Delivered", closed: "Closed", cancelled: "Cancelled" };

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

function Dl({ label, value, mono }) {
  return (
    <div className="py-1.5" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className={`text-[13px] font-medium mt-0.5 break-all ${mono ? "font-mono" : ""}`}>{value || "—"}</div>
    </div>
  );
}

const emptyForm = {
  name: "", company_name: "", contact_person: "", email: "", phone: "", whatsapp: "",
  address: "", city: "", state: "", country: "", zip_code: "",
  tax_id: "", lead_time_days: 0, rating: 0, is_active: true,
  bank_bank: "", bank_account_title: "", bank_account_no: "",
};
const toForm = (v) => ({
  ...emptyForm, ...Object.fromEntries(Object.entries(v || {}).filter(([k]) => k in emptyForm)),
  bank_bank: v?.bank_details?.bank || "", bank_account_title: v?.bank_details?.account_title || "",
  bank_account_no: v?.bank_details?.account_no || "",
});
const toPayload = (f) => ({
  name: f.name, company_name: f.company_name, contact_person: f.contact_person,
  email: f.email, phone: f.phone, whatsapp: f.whatsapp, address: f.address, city: f.city,
  state: f.state, country: f.country, zip_code: f.zip_code,
  tax_id: f.tax_id, lead_time_days: Math.max(0, Number(f.lead_time_days) || 0),
  rating: Math.min(5, Math.max(0, Number(f.rating) || 0)), is_active: !!f.is_active,
  bank_details: { bank: f.bank_bank, account_title: f.bank_account_title, account_no: f.bank_account_no },
});

export default function VendorDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState("overview");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: detail, isLoading } = useQuery({ queryKey: ["vendor", id], queryFn: () => vendorApi.getWithPOs(id) });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["vendor", id] }); qc.invalidateQueries({ queryKey: ["vendors"] }); };

  const saveMutation = useMutation({
    mutationFn: () => vendorApi.update(id, toPayload(form)),
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
  const { data: paymentsByPo } = useQuery({
    queryKey: ["vendor-po-payments", id],
    queryFn: async () => {
      const out = [];
      for (const pid of recentIds) {
        try {
          const res = await purchaseOrderApi.getById(pid);
          for (const pay of res?.data?.payments || []) out.push({ ...pay, po_id: pid, po_number: res?.data?.po_number });
        } catch {}
      }
      return out.sort((a, b) => new Date(b.paid_at || b.created_at) - new Date(a.paid_at || a.created_at));
    },
    enabled: !!detail && recentIds.length > 0,
  });

  const events = useMemo(() => {
    if (!detail) return [];
    const ev = [];
    for (const p of detail.purchaseOrders || []) {
      ev.push({ t: p.created_at, label: `${p.po_number} created`, sub: `${(p.items || []).length} lines · ${money(p.total)}` });
      for (const r of p.receivings || []) ev.push({ t: r.received_at, label: `${p.po_number} received`, sub: `${(r.items || []).reduce((s, x) => s + (x.qty || 0), 0)} units · Inv ${r.invoice_no}${r.received_by_name ? ` · ${r.received_by_name}` : ""}` });
    }
    for (const pay of paymentsByPo || []) ev.push({ t: pay.paid_at || pay.created_at, label: `Payment of ${money(pay.amount)} received`, sub: `${pay.po_number || ""} · ${pay.method || ""}`.trim() });
    return ev.sort((a, b) => new Date(b.t) - new Date(a.t));
  }, [detail, paymentsByPo]);

  const allCountries = useMemo(() => Country.getAllCountries(), []);
  const countryCode = useMemo(() => allCountries.find((c) => c.name === form.country)?.isoCode || "", [allCountries, form.country]);
  const stateOptions = useMemo(() => (countryCode ? State.getStatesOfCountry(countryCode) : []), [countryCode]);
  const stateCode = useMemo(() => stateOptions.find((s) => s.name === form.state)?.isoCode || "", [stateOptions, form.state]);
  const cityOptions = useMemo(() => (countryCode && stateCode ? City.getCitiesOfState(countryCode, stateCode).map((c) => c.name) : []), [countryCode, stateCode]);

  if (isLoading) return <p className="text-sm p-6 text-center" style={{ color: "var(--text-muted)" }}>Loading vendor...</p>;
  if (!detail) return <p className="text-sm p-6">Vendor not found. <Link className="underline" href="/admin/vendors">Back to vendors</Link></p>;

  const initials = (detail.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const recentPOs = (detail.purchaseOrders || []).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/admin/vendors")} className="h-9 w-9 rounded-lg flex items-center justify-center transition hover:opacity-80" style={cardStyle}><ArrowLeft size={16} /></button>
          <div>
            <div className="flex items-center gap-2"><h1 className="text-xl font-bold">{detail.name}</h1><Pill tone={detail.is_active ? "green" : "red"}>{detail.is_active ? "Active" : "Inactive"}</Pill></div>
            <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Vendor Code: {detail.vendor_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setForm(toForm(detail)); setShowModal(true); }} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition hover:opacity-90" style={accentBtn}><Pencil size={14} /> Edit</button>
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} className="h-9 px-4 rounded-lg text-[13px] font-semibold transition hover:opacity-80" style={{ ...cardStyle, borderRadius: "8px" }}>More ▾</button>
            {menuOpen && (
              <div className="absolute right-0 top-10 z-30 w-44 rounded-lg overflow-hidden shadow-xl" style={cardStyle}>
                <button onClick={() => toggleMutation.mutate()} className="w-full px-3 py-2 text-[13px] text-left transition hover:opacity-80">{detail.is_active ? "Deactivate" : "Activate"}</button>
                <button onClick={() => { setMenuOpen(false); router.push(`/admin/purchase-orders/new?vendor=${detail._id}`); }} className="w-full px-3 py-2 text-[13px] text-left transition hover:opacity-80">New Purchase Order</button>
              </div>
            )}
          </div>
          <button onClick={() => { if (confirm("Delete this vendor?")) deleteMutation.mutate(); }} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-1.5 transition hover:opacity-80" style={{ border: "1px solid var(--danger-text)", color: "var(--danger-text)", borderRadius: "8px" }}><Trash2 size={14} /> Delete</button>
        </div>
      </div>

      <div className="grid gap-4 items-start xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4 min-w-0">
          {/* profile */}
          <section className="rounded-xl p-4 flex flex-wrap items-center gap-4" style={cardStyle}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg shrink-0" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>{initials}</div>
            <div className="min-w-0 flex-1">
              <b>{detail.name}</b>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{detail.company_name || "—"}</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {detail.email && <span className="flex items-center gap-1"><Mail size={12} /> {detail.email}</span>}
                {detail.phone && <span className="flex items-center gap-1"><Phone size={12} /> {detail.phone}</span>}
                {detail.whatsapp && <span className="flex items-center gap-1"><MessageCircle size={12} /> {detail.whatsapp}</span>}
              </div>
            </div>
            <div className="text-right text-sm">
              <div><Stars value={detail.rating} /> <b>{(Number(detail.rating) || 0).toFixed(1)}</b></div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Total Paid</div>
              <b>{money(detail.total_paid)}</b>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Balance Payable</div>
              <b style={{ color: "var(--danger-text)" }}>{money(detail.balance_payable)}</b>
            </div>
          </section>

          {/* tabs */}
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <div className="flex px-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--border-color)" }}>
              {[["overview", "Overview"], ["business", "Business Details"], ["purchases", "Purchase History"], ["payments", "Payments"], ["activity", "Activity Log"]].map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className="px-4 py-2.5 text-[13px] font-semibold transition whitespace-nowrap" style={tab === k ? { color: "var(--accent)", borderBottom: "2px solid var(--accent)" } : { color: "var(--text-muted)" }}>{label}</button>
              ))}
            </div>
            <div className="p-4">
              {tab === "overview" && (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-[minmax(0,1fr)_220px] gap-4">
                    <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Basic Information</p>
                      <div className="grid grid-cols-2 gap-x-4">
                        <Dl label="Vendor Code" value={detail.vendor_code} mono />
                        <Dl label="Phone" value={detail.phone} />
                        <Dl label="Vendor Name" value={detail.name} />
                        <Dl label="WhatsApp" value={detail.whatsapp} />
                        <Dl label="Company Name" value={detail.company_name} />
                        <Dl label="Contact Person" value={detail.contact_person} />
                        <Dl label="Tax ID" value={detail.tax_id} />
                        <Dl label="Email" value={detail.email} />
                        <Dl label="Lead Time (Days)" value={detail.lead_time_days} />
                        <Dl label="Rating" value={`${(Number(detail.rating) || 0).toFixed(1)} / 5`} />
                      </div>
                    </div>
                    <div className="rounded-lg p-4 text-center h-fit" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center font-bold text-lg" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>{initials}</div>
                      <b className="block mt-2 text-sm">{detail.name}</b>
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{detail.company_name || "—"}</div>
                      <div className="mt-1"><Pill tone={detail.is_active ? "green" : "red"}>{detail.is_active ? "Active" : "Inactive"}</Pill></div>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Address</p>
                      <Dl label="Address" value={detail.address} />
                      <div className="grid grid-cols-2 gap-x-4">
                        <Dl label="City" value={detail.city} />
                        <Dl label="State" value={detail.state} />
                        <Dl label="Country" value={detail.country} />
                        <Dl label="Zip Code" value={detail.zip_code} />
                      </div>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Bank Details</p>
                      <Dl label="Bank" value={detail.bank_details?.bank} />
                      <Dl label="Account Title" value={detail.bank_details?.account_title} />
                      <Dl label="Account No" value={detail.bank_details?.account_no} />
                    </div>
                  </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "var(--text-muted)" }}>Business Summary</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        {[["Total Purchased", detail.total_purchased, "var(--accent)"], ["Total Paid", detail.total_paid, "var(--success-text)"], ["Balance Payable", detail.balance_payable, "var(--danger-text)"]].map(([l, val, color]) => (
                          <div key={l}><div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{l}</div><div className="font-bold text-[13px]" style={{ color }}>{money(val)}</div></div>
                        ))}
                      </div>
                    </div>
                </div>
              )}
              {tab === "business" && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Contact</p>
                    <Dl label="Contact Person" value={detail.contact_person} />
                    <Dl label="Email" value={detail.email} />
                    <Dl label="Phone" value={detail.phone} />
                    <Dl label="WhatsApp" value={detail.whatsapp} />
                    <Dl label="Address" value={`${detail.address || ""}${detail.city ? `, ${detail.city}` : ""}${detail.state ? `, ${detail.state}` : ""}${detail.country ? `, ${detail.country}` : ""}${detail.zip_code ? ` ${detail.zip_code}` : ""}`} />
                  </div>
                  <div className="rounded-lg p-3" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                    <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Business</p>
                    <Dl label="Tax ID" value={detail.tax_id} />
                    <Dl label="Bank" value={detail.bank_details?.bank} />
                    <Dl label="Account Title" value={detail.bank_details?.account_title} />
                    <Dl label="Account No" value={detail.bank_details?.account_no} />
                    <Dl label="Lead Time (Days)" value={detail.lead_time_days} />
                    <Dl label="Rating" value={`${(Number(detail.rating) || 0).toFixed(1)} / 5`} />
                  </div>
                </div>
              )}
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
                <div className="space-y-2">
                  {(detail.purchaseOrders || []).filter((p) => (Number(p.paid_amount) || 0) > 0 || (Number(p.total) || 0) > (Number(p.paid_amount) || 0)).map((p) => (
                    <div key={p._id} className="rounded-lg p-3 text-[13px] flex items-center justify-between gap-3" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                      <div><Link href={`/admin/purchase-orders/${p._id}`} className="font-mono font-bold underline" style={{ color: "var(--accent)" }}>{p.po_number}</Link>
                        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>Paid {money(p.paid_amount)} of {money(p.total)} · Due {money((p.total || 0) - (p.paid_amount || 0))}</div>
                      </div>
                      <Pill tone={statusTone(p.payment_status)}>{p.payment_status}</Pill>
                    </div>
                  ))}
                  {!(detail.purchaseOrders || []).length && <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>No payments recorded.</p>}
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
        </div>

        {/* sidebar */}
        <aside className="space-y-4 xl:sticky xl:top-4">
          <section className="rounded-xl p-4" style={cardStyle}>
            <p className="text-[13px] font-bold mb-2">Quick Actions</p>
            <div className="space-y-2">
              <button onClick={() => router.push(`/admin/purchase-orders/new?vendor=${detail._id}`)} className="w-full h-9 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={accentBtn}><ShoppingCart size={14} /> Create Purchase Order</button>
              {[["View Purchase History", FileText, () => setTab("purchases")], ["View Payments", Wallet, () => setTab("payments")]].map(([label, Icon, fn]) => (
                <button key={label} onClick={fn} className="w-full h-9 px-3 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-80" style={{ ...cardStyle, borderRadius: "8px" }}><Icon size={14} /> {label}</button>
              ))}
            </div>
          </section>
          <section className="rounded-xl p-4" style={cardStyle}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-bold">Recent Purchase Orders</p>
              <button onClick={() => setTab("purchases")} className="text-[12px] underline" style={{ color: "var(--accent)" }}>View All</button>
            </div>
            <div className="space-y-2">
              {recentPOs.map((p) => (
                <Link key={p._id} href={`/admin/purchase-orders/${p._id}`} className="flex items-center justify-between gap-2 rounded-lg p-2 transition hover:opacity-80" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                  <div className="text-[12px]"><div className="font-mono font-bold">{p.po_number}</div><div style={{ color: "var(--text-muted)" }}>{fmtDate(p.created_at)}</div></div>
                  <Pill tone={statusTone(p.status)}>{STATUS_LABEL[p.status] || p.status}</Pill>
                  <b className="text-[12px]">{money(p.total)}</b>
                </Link>
              ))}
              {!recentPOs.length && <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>No orders yet.</p>}
            </div>
          </section>
          <section className="rounded-xl p-4" style={cardStyle}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-bold">Recent Activity</p>
              <button onClick={() => setTab("activity")} className="text-[12px] underline" style={{ color: "var(--accent)" }}>View All</button>
            </div>
            <div className="space-y-2.5">
              {events.slice(0, 5).map((e, i) => (
                <div key={i} className="flex gap-2.5 text-[12px]">
                  <div className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ backgroundColor: "var(--accent)" }} />
                  <div><div className="font-semibold">{e.label}</div><div style={{ color: "var(--text-muted)" }}>{e.t ? new Date(e.t).toLocaleDateString() : ""}</div></div>
                </div>
              ))}
              {!events.length && <p className="text-xs text-center py-4" style={{ color: "var(--text-muted)" }}>No activity yet.</p>}
            </div>
          </section>
        </aside>
      </div>

      {/* edit modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-xl" style={cardStyle} onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }}>
              <h3 className="text-base font-semibold">Edit Vendor</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded transition hover:opacity-70 text-lg leading-none" style={{ color: "var(--text-muted)" }}>×</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4 overflow-y-auto">
              <div className="col-span-2"><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Vendor Name *</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Company</label><input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Contact Person</label><input value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <div className="col-span-2"><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>WhatsApp</label><input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <div className="col-span-2"><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Country</label>
                <select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value, state: "", city: "" })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle}>
                  <option value="">Select Country</option>
                  {allCountries.map((c) => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>State</label>
                <select value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value, city: "" })} disabled={!countryCode} className="w-full h-9 px-3 rounded-md text-sm outline-none disabled:opacity-50" style={inputStyle}>
                  <option value="">{countryCode ? "Select State" : "Select country first"}</option>
                  {(form.state && !stateOptions.some((s) => s.name === form.state) ? [form.state, ...stateOptions.map((s) => s.name)] : stateOptions.map((s) => s.name)).map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>City</label>
                <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} disabled={!stateCode} className="w-full h-9 px-3 rounded-md text-sm outline-none disabled:opacity-50" style={inputStyle}>
                  <option value="">{stateCode ? "Select City" : "Select state first"}</option>
                  {(form.city && !cityOptions.includes(form.city) ? [form.city, ...cityOptions] : cityOptions).map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Zip Code</label><input value={form.zip_code} onChange={(e) => setForm({ ...form, zip_code: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Tax ID</label><input value={form.tax_id} onChange={(e) => setForm({ ...form, tax_id: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Lead Time (days)</label><input type="number" min={0} value={form.lead_time_days} onChange={(e) => setForm({ ...form, lead_time_days: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Rating (0–5)</label><input type="number" min={0} max={5} step={0.5} value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Bank</label><input value={form.bank_bank} onChange={(e) => setForm({ ...form, bank_bank: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Account Title</label><input value={form.bank_account_title} onChange={(e) => setForm({ ...form, bank_account_title: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Account No</label><input value={form.bank_account_no} onChange={(e) => setForm({ ...form, bank_account_no: e.target.value })} className="w-full h-9 px-3 rounded-md text-sm outline-none" style={inputStyle} /></div>
              <label className="col-span-2 text-sm flex items-center gap-2"><input type="checkbox" checked={!!form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /> Active</label>
            </div>
            <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: "1px solid var(--border-color)" }}>
              <button onClick={() => setShowModal(false)} className="h-9 px-4 rounded-lg text-[13px] font-semibold transition hover:opacity-80" style={{ ...cardStyle, borderRadius: "8px" }}>Cancel</button>
              <button disabled={saveMutation.isPending || !form.name.trim()} onClick={() => saveMutation.mutate()} className="h-9 px-4 rounded-lg text-[13px] font-semibold transition hover:opacity-90 disabled:opacity-50" style={accentBtn}>{saveMutation.isPending ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
