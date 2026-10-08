"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { purchaseOrderApi } from "@/apis/admin/purchaseOrderApi";
import { vendorApi } from "@/apis/admin/vendorApi";
import { toast } from "sonner";
import { createPortal } from "react-dom";
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

const STATUSES = ["pending", "confirmed", "delivered", "closed", "cancelled"];
const STATUS_LABEL = { pending: "Pending", confirmed: "Confirmed", delivered: "Delivered", closed: "Closed", cancelled: "Cancelled" };
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
const statusTone = (s) => ({ delivered: "green", closed: "green", paid: "green", pending: "amber", confirmed: "blue", cancelled: "red", unpaid: "red", partial: "amber" }[s] || "gray");

const receivedOf = (po) => {
  const items = po.items || [];
  const ordered = items.reduce((s, i) => s + (Number(i.qty_ordered) || 0), 0);
  const received = items.reduce((s, i) => s + (Number(i.received_qty) || 0), 0);
  return { ordered, received, pct: ordered ? Math.round((received / ordered) * 100) : 0 };
};

function useRowMenuClose(open, menuRef, btnRef, onClose) {
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) && btnRef.current && !btnRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [open, menuRef, btnRef, onClose]);
}

// Portal row menu (module level, like Brands page): open-state and position
// live inside the menu itself so parent re-renders never reset them.
function PORowMenu({ p, onView, onOpen, onConfirm, onDeliver, onPay, onViewReceiving, onClosePo, onCancel }) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const openMenu = () => {
    const rect = btnRef.current.getBoundingClientRect();
    const menuW = 180, menuH = 230;
    const flipUp = window.innerHeight - rect.bottom < menuH;
    const left = Math.min(Math.max(8, rect.right - menuW), window.innerWidth - menuW - 8);
    setPos({ top: flipUp ? rect.top - menuH - 4 : rect.bottom + 4, left });
    setOpen(true);
  };
  useRowMenuClose(open, menuRef, btnRef, () => setOpen(false));
  const itemClass = "w-full px-3 py-2 text-[13px] text-left transition-colors duration-150";
  const hov = {
    onMouseEnter: (e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)"),
    onMouseLeave: (e) => (e.currentTarget.style.backgroundColor = "transparent"),
  };
  const run = (fn) => (e) => { e.stopPropagation(); setOpen(false); fn(); };
  return (
    <>
      <button ref={btnRef} onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu(); }} className="p-1.5 rounded-md transition hover:opacity-70" style={{ color: "var(--text-muted)" }} aria-label="More actions" aria-haspopup="true" aria-expanded={open}>
        <MoreHorizontal size={16} />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="fixed z-[9999] w-[180px] rounded-lg py-1" style={{ top: pos.top, left: pos.left, ...cardStyle, boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}>
          <button onClick={run(onView)} className={itemClass} style={{ color: "var(--text-primary)" }} {...hov}>View details</button>
          {p.status === "pending" && <button onClick={run(onConfirm)} className={itemClass} style={{ color: "var(--text-primary)" }} {...hov}>Confirm</button>}
          {p.status === "pending" && <button onClick={run(onOpen)} className={itemClass} style={{ color: "var(--text-primary)" }} {...hov}>Edit</button>}
          {p.status === "confirmed" && <button onClick={run(onDeliver)} className={itemClass} style={{ color: "var(--text-primary)" }} {...hov}>Delivered</button>}
          {p.status === "delivered" && <button onClick={run(onPay)} className={itemClass} style={{ color: "var(--text-primary)" }} {...hov}>Pay</button>}
          {p.status === "delivered" && <button onClick={run(onViewReceiving)} className={itemClass} style={{ color: "var(--text-primary)" }} {...hov}>View receiving details</button>}
          {p.status === "delivered" && <button onClick={run(onClosePo)} className={itemClass} style={{ color: "var(--text-primary)" }} {...hov}>Close</button>}
          {["pending", "confirmed"].includes(p.status) && <button onClick={(e) => { e.stopPropagation(); setOpen(false); onCancel(); }} className={itemClass} style={{ color: "var(--danger-text)" }} {...hov}>Cancel</button>}
        </div>,
        document.body
      )}
    </>
  );
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ search: "", status: "all", vendor: "all", range: "all", payment: "all" });
  const [applied, setApplied] = useState(draft);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);

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
    const pending = (l) => l.filter((p) => ["pending", "confirmed"].includes(p.status)).length;
    const received = (l) => l.filter((p) => ["delivered", "closed"].includes(p.status)).length;
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
    onSuccess: () => { toast.success(ok); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed"),
  });
  const confirmM = act((id) => purchaseOrderApi.confirm(id), "PO confirmed");
  const closeM = act((id) => purchaseOrderApi.close(id), "PO closed");
  const cancelM = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => purchaseOrderApi.cancel(id, "Bulk cancel from list"))),
    onSuccess: () => { toast.success("Selected POs cancelled"); setSelected([]); refresh(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Bulk cancel failed (only pending/confirmed can be cancelled)"),
  });

  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r._id));
  const toggleOne = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const cancelWithReason = (id) => {
    const reason = prompt("Cancel reason (required):");
    if (reason?.trim()) purchaseOrderApi.cancel(id, reason.trim()).then(() => { toast.success("PO cancelled"); refresh(); }).catch((err) => toast.error(err?.response?.data?.message || "Failed"));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium" style={{ color: "#94a3b8" }}>Operations › Purchase Orders</p>
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ color: "#0f172a" }}>Purchase Orders</h1>
          <p className="text-xs mt-1 font-medium" style={{ color: "#64748b" }}>Manage and track all your purchase orders</p>
        </div>
        <button onClick={() => router.push("/admin/purchase-orders/new")} className="h-10 px-5 rounded-2xl text-[13px] font-extrabold flex items-center gap-2 transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98] shadow-lg" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "#fff", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}>
          <Plus size={16} strokeWidth={2.5} /> Create Purchase Order
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 shadow-md transition hover:shadow-xl hover:-translate-y-0.5" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0" }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)" }}>
              <ClipboardList size={20} color="#fff" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-wider truncate" style={{ color: "#94a3b8" }}>Total POs</p>
              <p className="text-xl font-extrabold leading-tight" style={{ color: "#0f172a" }}>{stats.total} <span className="text-[11px] font-bold" style={{ color: stats.totalDelta?.includes("↓") ? "#dc2626" : "#059669" }}>{stats.totalDelta}</span></p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-4 shadow-md transition hover:shadow-xl hover:-translate-y-0.5" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0" }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}>
              <Hourglass size={20} color="#fff" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-wider truncate" style={{ color: "#94a3b8" }}>Pending</p>
              <p className="text-xl font-extrabold leading-tight" style={{ color: "#0f172a" }}>{stats.pending} <span className="text-[11px] font-bold" style={{ color: stats.pendingDown ? "#dc2626" : "#059669" }}>{stats.pendingDelta}</span></p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-4 shadow-md transition hover:shadow-xl hover:-translate-y-0.5" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0" }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)" }}>
              <CheckCircle2 size={20} color="#fff" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-wider truncate" style={{ color: "#94a3b8" }}>Delivered</p>
              <p className="text-xl font-extrabold leading-tight" style={{ color: "#0f172a" }}>{stats.received} <span className="text-[11px] font-bold" style={{ color: stats.receivedDown ? "#dc2626" : "#059669" }}>{stats.receivedDelta}</span></p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-4 shadow-md transition hover:shadow-xl hover:-translate-y-0.5" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0" }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md" style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)" }}>
              <DollarSign size={20} color="#fff" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold uppercase tracking-wider truncate" style={{ color: "#94a3b8" }}>Total Purchase Value</p>
              <p className="text-xl font-extrabold leading-tight truncate" style={{ color: "#0f172a" }}>{money(stats.value)} <span className="text-[11px] font-bold" style={{ color: stats.valueDelta?.includes("↓") ? "#dc2626" : "#059669" }}>{stats.valueDelta}</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 items-start">
        <div className="rounded-2xl overflow-hidden shadow-lg" style={{ background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)", border: "1px solid #e2e8f0", boxShadow: "0 10px 30px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.04)" }}>
          <div className="p-3 grid sm:grid-cols-2 lg:grid-cols-[1fr_130px_150px_130px_140px_auto_auto] gap-2" style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#94a3b8" }}><Search size={14} /></span>
              <input value={draft.search} onChange={(e) => setDraft({ ...draft, search: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { setApplied(draft); setPage(1); } }} placeholder="Search by PO number, vendor, or status..." className="w-full h-10 pl-10 pr-4 rounded-2xl text-sm outline-none font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }} />
            </div>
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className="h-10 px-3 rounded-2xl text-sm outline-none font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }}>
              <option value="all">Status: All</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <select value={draft.vendor} onChange={(e) => setDraft({ ...draft, vendor: e.target.value })} className="h-10 px-3 rounded-2xl text-sm outline-none font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }}>
              <option value="all">Vendor: All</option>{vendorList.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
            </select>
            <select value={draft.range} onChange={(e) => setDraft({ ...draft, range: e.target.value })} className="h-10 px-3 rounded-2xl text-sm outline-none font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }}>
              {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={draft.payment} onChange={(e) => setDraft({ ...draft, payment: e.target.value })} className="h-10 px-3 rounded-2xl text-sm outline-none font-medium shadow-sm transition-all duration-200 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-blue-200" style={{ backgroundColor: "#fff", border: "1.5px solid #e2e8f0", color: "#0f172a" }}>
              <option value="all">Payment: All</option>{PAY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => { const r = { search: "", status: "all", vendor: "all", range: "all", payment: "all" }; setDraft(r); setApplied(r); setPage(1); }} className="h-10 px-4 rounded-2xl text-[13px] font-extrabold transition-all duration-200 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]" style={{ background: "#fff", border: "1.5px solid #e2e8f0", color: "#64748b" }}>Reset</button>
            <button onClick={() => { setApplied(draft); setPage(1); }} className="h-10 px-5 rounded-2xl text-[13px] font-extrabold transition-all duration-200 hover:scale-[1.03] hover:shadow-xl active:scale-[0.98] shadow-lg" style={{ background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", color: "#fff", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}>Search</button>
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
                      <tr key={p._id} onClick={() => router.push(`/admin/purchase-orders/${p._id}`)} className="transition cursor-pointer" style={{ borderBottom: "1px solid var(--border-color)" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(p._id)} onChange={() => toggleOne(p._id)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></td>
                        <td className="px-4 py-2.5 font-mono text-[12px] whitespace-nowrap" style={{ color: "var(--accent)" }}>{p.po_number}</td>
                        <td className="px-4 py-2.5"><div className="font-medium">{p.vendor_snapshot?.name || p.vendor_id?.name}</div><div className="font-mono text-[11px]" style={{ color: "var(--text-muted)" }}>{p.vendor_id?.vendor_code || ""}</div></td>
                        <td className="px-4 py-2.5"><Pill tone={statusTone(p.status)}>{STATUS_LABEL[p.status] || p.status}</Pill></td>
                        <td className="px-4 py-2.5"><Pill tone={statusTone(p.payment_status)}>{p.payment_status}</Pill></td>
                        <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{money(p.total)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{r.pct}% ({r.received}/{r.ordered})</td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtDate(p.expected_date)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{fmtDate(p.created_at)}</td>
                        <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <PORowMenu
                            p={p}
                            onView={() => router.push(`/admin/purchase-orders/${p._id}`)}
                            onOpen={() => router.push(`/admin/purchase-orders/${p._id}`)}
                            onConfirm={() => confirmM.mutate(p._id)}
                            onDeliver={() => router.push(`/admin/purchase-orders/${p._id}`)}
                            onPay={() => router.push(`/admin/purchase-orders/${p._id}`)}
                            onViewReceiving={() => router.push(`/admin/purchase-orders/${p._id}`)}
                            onClosePo={() => closeM.mutate(p._id)}
                            onCancel={() => cancelWithReason(p._id)}
                          />
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

      </div>
    </div>
  );
}

