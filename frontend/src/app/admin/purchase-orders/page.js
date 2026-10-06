"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { purchaseOrderApi } from "@/apis/admin/purchaseOrderApi";
import { vendorApi } from "@/apis/admin/vendorApi";
import { toast } from "sonner";
import {
  ClipboardList, Hourglass, CheckCircle2, DollarSign, Plus, Search,
  X, ChevronLeft, ChevronRight, MoreHorizontal, Printer,
} from "lucide-react";

// Same tokens as Vendors/Brands pages — no new design system.
const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
const accentBtn = { backgroundColor: "var(--accent)", color: "var(--accent-text)" };
const money = (n) => `Rs. ${(Math.max(0, Number(n) || 0)).toLocaleString()}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : "—");

const STATUSES = ["draft", "sent", "confirmed", "partially_received", "received", "closed", "cancelled"];
const STATUS_LABEL = { draft: "Draft", sent: "Sent", confirmed: "Confirmed", partially_received: "Partially Received", received: "Received", closed: "Closed", cancelled: "Cancelled" };
const PAY_STATUSES = ["unpaid", "partial", "paid"];
const RANGES = [["all", "All time"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"]];
const PAGE_SIZE = 8;

function StatCard({ icon: Icon, tint, label, value, delta, down }) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3" style={cardStyle}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: tint }}>
        <Icon size={18} style={{ color: "var(--accent)" }} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-[20px] font-bold leading-tight">{value} {delta && <span className="text-[11px] font-semibold" style={{ color: down ? "var(--danger-text)" : "var(--success-text)" }}>{delta}</span>}</p>
      </div>
    </div>
  );
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
const statusTone = (s) => ({ received: "green", closed: "green", paid: "green", draft: "gray", sent: "blue", confirmed: "blue", cancelled: "red", unpaid: "red", partial: "amber", partially_received: "amber" }[s] || "gray");

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-[13px]" style={{ borderBottom: "1px solid var(--border-color)" }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span className="font-medium text-right break-all">{value || "—"}</span>
    </div>
  );
}

const receivedOf = (po) => {
  const items = po.items || [];
  const ordered = items.reduce((s, i) => s + (Number(i.qty_ordered) || 0), 0);
  const received = items.reduce((s, i) => s + (Number(i.received_qty) || 0), 0);
  return { ordered, received, pct: ordered ? Math.round((received / ordered) * 100) : 0 };
};

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ search: "", status: "all", vendor: "all", range: "all", payment: "all" });
  const [applied, setApplied] = useState(draft);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [detailId, setDetailId] = useState(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [menuId, setMenuId] = useState(null);

  // All POs (looped pages, limit 100) so stats + filters are exact without backend changes.
  const { data: allPOs = [], isLoading } = useQuery({
    queryKey: ["pos-all"],
    queryFn: async () => {
      const out = [];
      let p = 1;
      for (;;) {
        const res = await purchaseOrderApi.getAll({ page: p, limit: 100 });
        out.push(...(res?.data || []));
        const pg = res?.pagination || {};
        if (!pg.totalPages || p >= pg.totalPages) break;
        p += 1;
      }
      return out;
    },
  });
  const { data: vendorsRaw } = useQuery({ queryKey: ["vendors-all"], queryFn: () => vendorApi.getAll() });
  const vendorList = useMemo(() => {
    const arr = Array.isArray(vendorsRaw) ? vendorsRaw : vendorsRaw?.data || [];
    return arr.filter((v) => !v.is_deleted);
  }, [vendorsRaw]);

  const now = Date.now(), DAY = 86400000;
  const pctChange = (cur, prev) => {
    if (!prev) return cur ? "↑ 100%" : null;
    const d = Math.round(((cur - prev) / prev) * 100);
    return `${d < 0 ? "↓" : "↑"} ${Math.abs(d)}%`;
  };
  const stats = useMemo(() => {
    const inWin = (d, days) => d && d >= now - days * DAY;
    const cur = allPOs.filter((p) => inWin(new Date(p.created_at).getTime(), 30));
    const prev = allPOs.filter((p) => { const t = new Date(p.created_at).getTime(); return t < now - 30 * DAY && t >= now - 60 * DAY; });
    const pending = (l) => l.filter((p) => ["draft", "sent", "confirmed", "partially_received"].includes(p.status)).length;
    const received = (l) => l.filter((p) => ["received", "closed"].includes(p.status)).length;
    const value = (l) => l.reduce((s, p) => s + (Number(p.total) || 0), 0);
    return {
      total: allPOs.length, totalDelta: pctChange(cur.length, prev.length),
      pending: pending(allPOs), pendingDelta: pctChange(pending(cur), pending(prev)), pendingDown: pending(cur) < pending(prev),
      received: received(allPOs), receivedDelta: pctChange(received(cur), received(prev)), receivedDown: received(cur) < received(prev),
      value: value(allPOs), valueDelta: pctChange(value(cur), value(prev)),
    };
  }, [allPOs]);

  const filtered = useMemo(() => {
    const q = applied.search.trim().toLowerCase();
    const cutoff = applied.range === "all" ? 0 : now - Number(applied.range) * DAY;
    return allPOs.filter((p) => {
      if (applied.status !== "all" && p.status !== applied.status) return false;
      if (applied.payment !== "all" && p.payment_status !== applied.payment) return false;
      if (applied.vendor !== "all" && String(p.vendor_id?._id || p.vendor_id) !== applied.vendor) return false;
      if (cutoff && new Date(p.created_at).getTime() < cutoff) return false;
      if (q && ![p.po_number, p.vendor_snapshot?.name, p.status].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [allPOs, applied]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["pos-all"] }); qc.invalidateQueries({ queryKey: ["po"] }); };
  const act = (fn, ok) => useMutation({
    mutationFn: fn,
    onSuccess: () => { toast.success(ok); setMenuId(null); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed"),
  });
  const sendM = act((id) => purchaseOrderApi.send(id), "PO sent");
  const confirmM = act((id) => purchaseOrderApi.confirm(id), "PO confirmed");
  const closeM = act((id) => purchaseOrderApi.close(id), "PO closed");
  const cancelM = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => purchaseOrderApi.cancel(id, "Bulk cancel from list"))),
    onSuccess: () => { toast.success("Selected POs cancelled"); setSelected([]); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Bulk cancel failed (only draft/sent/confirmed/partially-received can be cancelled)"),
  });

  const { data: detailRes } = useQuery({ queryKey: ["po", detailId], queryFn: () => purchaseOrderApi.getById(detailId), enabled: !!detailId });
  const po = detailRes?.data || null;
  const vendorIdOf = po && (po.vendor_id?._id || po.vendor_id);
  const { data: vendorDetail } = useQuery({ queryKey: ["vendor", vendorIdOf], queryFn: () => vendorApi.getById(vendorIdOf), enabled: !!po && !!vendorIdOf });

  const history = useMemo(() => {
    if (!po) return [];
    const ev = [{ t: po.created_at, label: `Created as draft${po.po_number ? ` (${po.po_number})` : ""}` }];
    for (const r of po.receivings || []) ev.push({ t: r.received_at, label: `Received ${(r.items || []).reduce((s, x) => s + (x.qty || 0), 0)} units · Inv ${r.invoice_no}` });
    for (const pay of po.payments || []) ev.push({ t: pay.paid_at || pay.created_at, label: `Payment Rs. ${Number(pay.amount || 0).toLocaleString()} via ${pay.method}` });
    if (po.status === "cancelled") ev.push({ t: po.updated_at, label: `Cancelled${po.cancel_reason ? `: ${po.cancel_reason}` : ""}` });
    if (po.status === "closed") ev.push({ t: po.updated_at, label: "Closed" });
    return ev.sort((a, b) => new Date(b.t) - new Date(a.t));
  }, [po]);

  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r._id));
  const toggleOne = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Operations › Purchase Orders</p>
          <h1 className="text-xl font-bold">Purchase Orders</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Manage and track all your purchase orders</p>
        </div>
        <button onClick={() => router.push("/admin/purchase-orders/new")} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={accentBtn}>
          <Plus size={15} /> Create Purchase Order
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={ClipboardList} tint="color-mix(in srgb, var(--accent) 14%, transparent)" label="Total POs" value={stats.total} delta={stats.totalDelta} />
        <StatCard icon={Hourglass} tint="var(--success-soft)" label="Pending" value={stats.pending} delta={stats.pendingDelta} down={stats.pendingDown} />
        <StatCard icon={CheckCircle2} tint="color-mix(in srgb, #f59e0b 16%, transparent)" label="Received" value={stats.received} delta={stats.receivedDelta} down={stats.receivedDown} />
        <StatCard icon={DollarSign} tint="color-mix(in srgb, #8b5cf6 16%, transparent)" label="Total Purchase Value" value={money(stats.value)} delta={stats.valueDelta} />
      </div>

      <div className={`grid gap-4 items-start ${detailId ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <div className="rounded-xl overflow-hidden min-w-0" style={cardStyle}>
          <div className="p-3 grid sm:grid-cols-2 lg:grid-cols-[1fr_130px_150px_130px_140px_auto_auto] gap-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><Search size={14} /></span>
              <input value={draft.search} onChange={(e) => setDraft({ ...draft, search: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { setApplied(draft); setPage(1); } }} placeholder="Search by PO number, vendor, or status..." className="w-full h-9 pl-9 pr-3 rounded-md text-sm outline-none" style={inputStyle} />
            </div>
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="h-9 px-2 rounded-md text-sm outline-none" style={inputStyle}>
              <option value="all">Status: All</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <select value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} className="h-9 px-2 rounded-md text-sm outline-none" style={inputStyle}>
              <option value="all">Vendor: All</option>{vendorList.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
            </select>
            <select value={draft.range} onChange={(e) => setDraft({ ...draft, range: e.target.value })} className="h-9 px-2 rounded-md text-sm outline-none" style={inputStyle}>
              {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={draft.payment} onChange={(e) => setDraft({ ...draft, payment: e.target.value })} className="h-9 px-2 rounded-md text-sm outline-none" style={inputStyle}>
              <option value="all">Payment: All</option>{PAY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => { const r = { search: "", status: "all", vendor: "all", range: "all", payment: "all" }; setDraft(r); setApplied(r); setPage(1); }} className="h-9 px-3 rounded-md text-[13px] font-semibold transition hover:opacity-80" style={{ ...cardStyle, borderRadius: "8px" }}>Reset</button>
            <button onClick={() => { setApplied(draft); setPage(1); }} className="h-9 px-4 rounded-md text-[13px] font-semibold transition hover:opacity-90" style={accentBtn}>Search</button>
          </div>

          {selected.length > 0 && (
            <div className="px-4 py-2 flex items-center justify-between text-[13px]" style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
              <span>{selected.length} selected</span>
              <button onClick={() => { if (confirm(`Cancel ${selected.length} POs?`)) cancelM.mutate(selected); }} className="underline font-semibold" style={{ color: "var(--danger-text)" }}>Cancel selected</button>
            </div>
          )}

          {isLoading ? <p className="p-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>Loading purchase orders...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-4 py-3 w-10"><input type="checkbox" checked={allOnPage} onChange={() => setSelected(allOnPage ? selected.filter((id) => !rows.some((r) => r._id === id)) : [...new Set([...selected, ...rows.map((r) => r._id)])])} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></th>
                    {["PO Number", "Vendor", "Status", "Payment Status", "Total Amount", "Received", "Expected Date", "Created At"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const r = receivedOf(p);
                    return (
                      <tr key={p._id} onClick={() => { setDetailId(p._id); setDetailTab("overview"); }} className="transition cursor-pointer" style={{ borderBottom: "1px solid var(--border-color)" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(p._id)} onChange={() => toggleOne(p._id)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></td>
                        <td className="px-4 py-2.5 font-mono text-[12px] whitespace-nowrap" style={{ color: "var(--accent)" }}>{p.po_number}</td>
                        <td className="px-4 py-2.5"><div className="font-medium">{p.vendor_snapshot?.name || p.vendor_id?.name}</div><div className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{p.vendor_id?.vendor_code || ""}</div></td>
                        <td className="px-4 py-2.5"><Pill tone={statusTone(p.status)}>{STATUS_LABEL[p.status] || p.status}</Pill></td>
                        <td className="px-4 py-2.5"><Pill tone={statusTone(p.payment_status)}>{p.payment_status}</Pill></td>
                        <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{money(p.total)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{r.pct}% ({r.received}/{r.ordered})</td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtDate(p.expected_date)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtDate(p.created_at)}</td>
                        <td className="px-4 py-2.5 text-right relative" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setMenuId(menuId === p._id ? null : p._id)} className="p-1.5 rounded-md transition hover:opacity-70" style={{ color: "var(--text-muted)" }}><MoreHorizontal size={16} /></button>
                          {menuId === p._id && (
                            <div className="absolute right-2 top-9 z-30 w-44 rounded-lg overflow-hidden shadow-xl text-left" style={cardStyle}>
                              <button onClick={() => { setDetailId(p._id); setDetailTab("overview"); setMenuId(null); }} className="w-full px-3 py-2 text-[13px] text-left transition hover:opacity-80">View details</button>
                              <button onClick={() => { setMenuId(null); router.push(`/admin/purchase-orders/${p._id}`); }} className="w-full px-3 py-2 text-[13px] text-left transition hover:opacity-80">Open full page</button>
                              {p.status === "draft" && <button onClick={() => sendM.mutate(p._id)} className="w-full px-3 py-2 text-[13px] text-left transition hover:opacity-80">Send</button>}
                              {p.status === "sent" && <button onClick={() => confirmM.mutate(p._id)} className="w-full px-3 py-2 text-[13px] text-left transition hover:opacity-80">Confirm</button>}
                              {p.status === "received" && <button onClick={() => closeM.mutate(p._id)} className="w-full px-3 py-2 text-[13px] text-left transition hover:opacity-80">Close</button>}
                              {["draft", "sent", "confirmed", "partially_received"].includes(p.status) && <button onClick={() => { setMenuId(null); const reason = prompt("Cancel reason (required):"); if (reason?.trim()) purchaseOrderApi.cancel(p._id, reason.trim()).then(() => { toast.success("PO cancelled"); refresh(); }).catch((e) => toast.error(e?.response?.data?.message || "Failed")); }} className="w-full px-3 py-2 text-[13px] text-left transition hover:opacity-80" style={{ color: "var(--danger-text)" }}>Cancel</button>}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {!rows.length && <tr><td colSpan={10} className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No purchase orders match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
            <span>Showing {filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0} to {(safePage - 1) * PAGE_SIZE + rows.length} of {filtered.length} purchase orders</span>
            <div className="flex items-center gap-1">
              <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-40" style={cardStyle}><ChevronLeft size={14} /></button>
              {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, safePage - 3), safePage + 2).map((pg) => (
                <button key={pg} onClick={() => setPage(pg)} className="h-8 w-8 rounded-md text-[13px] font-bold transition" style={pg === safePage ? accentBtn : cardStyle}>{pg}</button>
              ))}
              <button disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-40" style={cardStyle}><ChevronRight size={14} /></button>
            </div>
          </div>
        </div>

        {detailId && (
          <aside className="rounded-xl overflow-hidden xl:sticky xl:top-4 max-h-[calc(100vh-120px)] overflow-y-auto" style={cardStyle}>
            {!po ? <p className="p-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>Loading...</p> : (
              <>
                <div className="p-4" style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><b className="font-mono">{po.po_number}</b><Pill tone={statusTone(po.status)}>{STATUS_LABEL[po.status]}</Pill></div>
                    <button onClick={() => setDetailId(null)} className="p-1 rounded transition hover:opacity-70" style={{ color: "var(--text-muted)" }}><X size={16} /></button>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold shrink-0" style={{ backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" }}>
                      {(po.vendor_snapshot?.name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <b className="truncate block">{po.vendor_snapshot?.name}</b>
                      <div className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{po.vendor_id?.vendor_code || ""}</div>
                    </div>
                    <span className="text-[13px] font-bold whitespace-nowrap" style={{ color: "#f59e0b" }}>★ {(Number(vendorDetail?.rating) || 0).toFixed(1)}</span>
                  </div>
                </div>
                <div className="flex px-2 overflow-x-auto" style={{ borderBottom: "1px solid var(--border-color)" }}>
                  {[["overview", "Overview"], ["items", "Items"], ["receivings", "Receivings"], ["payments", "Payments"], ["history", "History"]].map(([k, label]) => (
                    <button key={k} onClick={() => setDetailTab(k)} className="px-3 py-2.5 text-[13px] font-semibold transition whitespace-nowrap" style={detailTab === k ? { color: "var(--accent)", borderBottom: "2px solid var(--accent)" } : { color: "var(--text-muted)" }}>{label}</button>
                  ))}
                </div>
                <div className="p-4">
                  {detailTab === "overview" && (
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Purchase Order Details</p>
                          <button onClick={() => router.push(`/admin/purchase-orders/${po._id}`)} className="text-[12px] underline" style={{ color: "var(--accent)" }}>Edit</button>
                        </div>
                        <InfoRow label="PO Number" value={po.po_number} />
                        <InfoRow label="Vendor" value={`${po.vendor_snapshot?.name || ""}${po.vendor_id?.vendor_code ? ` (${po.vendor_id.vendor_code})` : ""}`} />
                        <InfoRow label="Vendor Contact" value={vendorDetail?.contact_person} />
                        <InfoRow label="Email" value={po.vendor_snapshot?.email} />
                        <InfoRow label="Phone" value={po.vendor_snapshot?.phone} />
                        <InfoRow label="Company" value={po.vendor_snapshot?.company_name} />
                        <InfoRow label="Address" value={[po.vendor_snapshot?.address, po.vendor_snapshot?.city].filter(Boolean).join(", ")} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Financial Summary</p>
                        <InfoRow label="Subtotal" value={money(po.subtotal)} />
                        <InfoRow label="Tax" value={money(po.tax)} />
                        <InfoRow label="Shipping" value={money(po.shipping)} />
                        <InfoRow label="Discount" value={money(po.discount)} />
                        <div className="flex justify-between py-1.5 font-bold">Total <span>{money(po.total)}</span></div>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: "var(--text-muted)" }}>Status & Dates</p>
                        <InfoRow label="Status" value={STATUS_LABEL[po.status]} />
                        <InfoRow label="Payment Status" value={po.payment_status} />
                        <InfoRow label="Expected Date" value={fmtDate(po.expected_date)} />
                        <InfoRow label="Due Date" value={fmtDate(po.due_date)} />
                      </div>
                      {po.notes && <div className="rounded-lg p-3 text-[13px]" style={{ backgroundColor: "var(--bg-tertiary)" }}><b>Notes</b><div className="mt-1" style={{ color: "var(--text-secondary)" }}>{po.notes}</div></div>}
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => router.push(`/admin/purchase-orders/${po._id}`)} className="h-9 px-4 rounded-lg text-[13px] font-semibold transition hover:opacity-90 flex-1" style={accentBtn}>Edit</button>
                        <button onClick={() => window.print()} className="h-9 px-4 rounded-lg text-[13px] font-semibold transition hover:opacity-80 flex-1" style={{ ...cardStyle, borderRadius: "8px" }}><Printer size={14} className="inline mr-1" />Print</button>
                        <Link href={`/admin/purchase-orders/${po._id}`} className="h-9 px-4 rounded-lg text-[13px] font-semibold transition hover:opacity-80 inline-flex items-center" style={{ ...cardStyle, borderRadius: "8px" }}>More</Link>
                      </div>
                    </div>
                  )}
                  {detailTab === "items" && (
                    <div className="space-y-2">
                      {(po.items || []).map((i, idx) => (
                        <div key={idx} className="rounded-lg p-3 text-[13px]" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                          <div className="flex justify-between gap-2"><b className="truncate">{i.name} ({i.variantTitle})</b><b>{money(i.line_total)}</b></div>
                          <div className="mt-1 font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{i.sku}</div>
                          <div className="mt-1" style={{ color: "var(--text-secondary)" }}>Ordered {i.qty_ordered} · Received {i.received_qty} · Cost {money(i.cost_price)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {detailTab === "receivings" && (
                    <div className="space-y-2">
                      {(po.receivings || []).map((r, idx) => (
                        <div key={idx} className="rounded-lg p-3 text-[13px]" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                          <div className="flex justify-between"><b className="font-mono">{r.invoice_no}</b><span style={{ color: "var(--text-muted)" }}>{fmtDate(r.received_at)}</span></div>
                          <div className="mt-1" style={{ color: "var(--text-secondary)" }}>{(r.items || []).reduce((s, x) => s + (x.qty || 0), 0)} units · by {r.received_by_name || "—"}</div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{r.explanation}</div>
                        </div>
                      ))}
                      {!(po.receivings || []).length && <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>Nothing received yet.</p>}
                    </div>
                  )}
                  {detailTab === "payments" && (
                    <div className="space-y-2">
                      {(po.payments || []).map((p) => (
                        <div key={p._id} className="rounded-lg p-3 text-[13px]" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                          <div className="flex justify-between"><b>{money(p.amount)}</b><Pill tone="terms">{p.method}</Pill></div>
                          <div className="mt-1" style={{ color: "var(--text-secondary)" }}>{p.reference || "No reference"} · {fmtDate(p.paid_at)}</div>
                          {p.notes && <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{p.notes}</div>}
                        </div>
                      ))}
                      {!(po.payments || []).length && <p className="text-sm text-center py-6" style={{ color: "var(--text-muted)" }}>No payments recorded. Paid {money(po.paid_amount)} of {money(po.total)}.</p>}
                    </div>
                  )}
                  {detailTab === "history" && (
                    <div className="space-y-2">
                      {history.map((h, idx) => (
                        <div key={idx} className="rounded-lg p-3 text-[13px] flex gap-3" style={{ backgroundColor: "var(--bg-tertiary)" }}>
                          <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: "var(--accent)" }} />
                          <div><div>{h.label}</div><div className="text-xs" style={{ color: "var(--text-muted)" }}>{h.t ? new Date(h.t).toLocaleString() : ""}</div></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
