"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { purchaseOrderApi } from "@/apis/admin/purchaseOrderApi";
import { vendorApi } from "@/apis/admin/vendorApi";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useLocalized } from "@/i18n/localize";
import { usePageTranslations } from "@/hooks/admin/usePageTranslations";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";
import { localizedStrictField } from "@/i18n/localize";
import { createPortal } from "react-dom";
import {
  Plus, Search, ChevronDown, ChevronLeft, ChevronRight, MoreVertical,
} from "lucide-react";

// Same tokens as Vendors/Brands pages — no new design system.
const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
const accentBtn = { backgroundColor: "var(--accent)", color: "var(--accent-text)" };
const intlLocale = (locale = "en") => locale === "ur" ? "ur-PK" : locale === "ar" ? "ar" : locale === "hi" ? "hi-IN" : locale === "en" ? "en-PK" : locale;
const money = (n, locale = "en") => new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(Math.max(0, Number(n) || 0));
const fmtDate = (d, locale = "en") => (d ? new Intl.DateTimeFormat(intlLocale(locale), { year: "numeric", month: "short", day: "numeric" }).format(new Date(d)) : "—");

const STATUSES = ["pending", "confirmed", "delivered", "closed", "cancelled"];
const PAY_STATUSES = ["unpaid", "partial", "paid"];
const RANGES = [["all", "All time"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"]];
const PAGE_SIZE = 20;

function StatCard({ label, value, valueColor }) {
  return (
    <div className="rounded-lg p-3 sm:p-4" style={cardStyle}>
      <p className="truncate text-[11px] font-medium sm:text-xs" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-1 truncate text-lg font-bold leading-tight sm:text-xl" style={{ color: valueColor || "var(--text-primary)" }}>{value}</p>
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
function PORowMenu({ p, onView, onOpen, onConfirm, onDeliver, onPay, onViewReceiving, onCancel }) {
  const { t } = useTranslation();
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
      <button ref={btnRef} onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu(); }} className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 hover:bg-[var(--bg-row-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" style={{ color: "var(--text-secondary)" }} aria-label={t("admin.purchaseOrders.list.moreActions")} aria-haspopup="true" aria-expanded={open}>
        <MoreVertical size={18} />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="fixed z-[9999] w-[180px] rounded-lg py-1" style={{ top: pos.top, left: pos.left, ...cardStyle, boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}>
          <button onClick={run(onView)} className={itemClass} style={{ color: "var(--text-primary)" }} {...hov}>{t("admin.purchaseOrders.list.viewDetails")}</button>
          {p.status === "pending" && <button onClick={run(onConfirm)} className={itemClass} style={{ color: "var(--text-primary)" }} {...hov}>{t("admin.purchaseOrders.list.confirm")}</button>}
          {p.status === "pending" && <button onClick={run(onOpen)} className={itemClass} style={{ color: "var(--text-primary)" }} {...hov}>{t("admin.purchaseOrders.list.edit")}</button>}
          {p.status === "confirmed" && <button onClick={run(onDeliver)} className={itemClass} style={{ color: "var(--text-primary)" }} {...hov}>{t("admin.purchaseOrders.list.receive")}</button>}
          {p.status === "delivered" && <button onClick={run(onPay)} className={itemClass} style={{ color: "var(--text-primary)" }} {...hov}>{t("admin.purchaseOrders.list.pay")}</button>}
          {p.status === "delivered" && <button onClick={run(onViewReceiving)} className={itemClass} style={{ color: "var(--text-primary)" }} {...hov}>{t("admin.purchaseOrders.list.receivingDetails")}</button>}
          {["pending", "confirmed"].includes(p.status) && <button onClick={(e) => { e.stopPropagation(); setOpen(false); onCancel(); }} className={itemClass} style={{ color: "var(--danger-text)" }} {...hov}>{t("admin.purchaseOrders.list.cancel")}</button>}
        </div>,
        document.body
      )}
    </>
  );
}

export default function PurchaseOrdersPage() {
  const { t, locale } = useTranslation();
  const { productNameOf } = useLocalized();
  const router = useRouter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState({ search: "", status: "all", vendor: "all", range: "all", payment: "all" });
  const [applied, setApplied] = useState(draft);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const updateFilter = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setApplied((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

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
  usePageTranslations({ model: "Vendor", records: vendorList, locale, ready: !isLoading && !!vendorsRaw, queryKey: ["vendors-all"], queryClient: qc });
  const vendorById = useMemo(() => new Map(vendorList.map((vendor) => [String(vendor._id), vendor])), [vendorList]);

  const DAY = 86400000;
  const stats = useMemo(() => {
    const pending = allPOs.filter((p) => ["pending", "confirmed"].includes(p.status)).length;
    const received = allPOs.filter((p) => ["delivered", "closed"].includes(p.status)).length;
    const value = allPOs.reduce((s, p) => s + (Number(p.total) || 0), 0);
    return {
      total: allPOs.length, pending, received, value,
    };
  }, [allPOs]);

  const filtered = useMemo(() => {
    const q = applied.search.trim().toLowerCase();
    const cutoff = applied.range === "all" ? 0 : Date.now() - Number(applied.range) * DAY;
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
  usePageTranslations({ model: "PurchaseOrder", records: rows, locale, ready: !isLoading, queryKey: ["pos-all"], queryClient: qc });
  const poProducts = useMemo(() => rows.flatMap((po) => (po.items || []).map((item) => item.product_id).filter((product) => product && typeof product === "object" && product._id)), [rows]);
  usePageTranslations({ model: "Product", records: poProducts, locale, ready: !isLoading, queryKey: ["pos-all"], queryClient: qc });
  const poVariants = useMemo(() => rows.flatMap((po) => (po.items || []).map((item) => item.variant_id).filter((variant) => variant && typeof variant === "object" && variant._id)), [rows]);
  usePageTranslations({ model: "Variant", records: poVariants, locale, ready: !isLoading, queryKey: ["pos-all"], queryClient: qc });

  const refresh = () => { qc.invalidateQueries({ queryKey: ["pos-all"] }); qc.invalidateQueries({ queryKey: ["po"] }); };
  const useActionMutation = (fn, ok) => useMutation({
    mutationFn: fn,
    onSuccess: () => { toast.success(ok); refresh(); },
    onError: () => toast.error(t("admin.purchaseOrders.toast.updateFailed")),
  });
  const confirmM = useActionMutation((id) => purchaseOrderApi.confirm(id), t("admin.purchaseOrders.toast.confirmed"));
  const cancelM = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => purchaseOrderApi.cancel(id, "Bulk cancel from list"))),
    onSuccess: () => { toast.success(t("admin.purchaseOrders.toast.cancelledMany")); setSelected([]); refresh(); },
    onError: () => toast.error(t("admin.purchaseOrders.toast.cancelFailed")),
  });

  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r._id));
  const toggleOne = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const cancelWithReason = (id) => {
    const reason = prompt(t("admin.purchaseOrders.toast.cancelReasonPrompt"));
    if (reason?.trim()) purchaseOrderApi.cancel(id, reason.trim()).then(() => { toast.success(t("admin.purchaseOrders.toast.cancelled")); refresh(); }).catch(() => toast.error(t("admin.purchaseOrders.toast.cancelFailed")));
  };

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("admin.purchaseOrders.page.title")} subtitle={t("admin.purchaseOrders.page.subtitle")} actions={<button onClick={() => router.push("/admin/purchase-orders/new")} className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90" style={accentBtn}>
        <Plus size={16} /> {t("admin.purchaseOrders.list.create")}
      </button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <StatCard label={t("admin.purchaseOrders.list.totalPOs")} value={new Intl.NumberFormat(intlLocale(locale)).format(stats.total)} />
        <StatCard label={t("admin.purchaseOrders.list.pending")} value={new Intl.NumberFormat(intlLocale(locale)).format(stats.pending)} valueColor="var(--warning-text)" />
        <StatCard label={t("admin.purchaseOrders.list.received")} value={new Intl.NumberFormat(intlLocale(locale)).format(stats.received)} valueColor="var(--success-text)" />
        <StatCard label={t("admin.purchaseOrders.list.totalValue")} value={money(stats.value, locale)} valueColor="var(--accent)" />
      </div>

      <div className="min-w-0 space-y-3">
          <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:w-[400px] xl:shrink-0">
              <span className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><Search size={14} /></span>
              <input value={draft.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder={t("admin.purchaseOrders.list.searchPlaceholder")} className="h-9 w-full rounded-lg ps-9 pe-3 text-[13px] outline-none transition focus:ring-1 focus:ring-[var(--accent)]/30" style={inputStyle} />
            </div>
            <div className="grid w-full min-w-0 grid-cols-2 gap-2 xl:flex xl:w-auto xl:shrink-0 xl:gap-2">
            <div className="relative min-w-0"><select value={draft.status} onChange={(e) => updateFilter("status", e.target.value)} className="h-9 w-full min-w-0 appearance-none rounded-lg ps-3 pe-8 text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-[var(--accent)]/30 xl:w-[140px]" style={inputStyle}>
              <option value="all">{t("admin.purchaseOrders.list.statusAll")}</option>{STATUSES.map((s) => <option key={s} value={s}>{t(`admin.purchaseOrders.status.${s}`)}</option>)}
            </select><ChevronDown size={14} className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} /></div>
            <div className="relative min-w-0"><select value={draft.vendor} onChange={(e) => updateFilter("vendor", e.target.value)} className="h-9 w-full min-w-0 appearance-none rounded-lg ps-3 pe-8 text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-[var(--accent)]/30 xl:w-[140px]" style={inputStyle}>
              <option value="all">{t("admin.purchaseOrders.list.vendorAll")}</option>{vendorList.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
            </select><ChevronDown size={14} className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} /></div>
            <div className="relative min-w-0"><select value={draft.range} onChange={(e) => updateFilter("range", e.target.value)} className="h-9 w-full min-w-0 appearance-none rounded-lg ps-3 pe-8 text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-[var(--accent)]/30 xl:w-[140px]" style={inputStyle}>
              {RANGES.map(([value]) => <option key={value} value={value}>{t(`admin.purchaseOrders.list.range.${value}`)}</option>)}
            </select><ChevronDown size={14} className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} /></div>
            <div className="relative min-w-0"><select value={draft.payment} onChange={(e) => updateFilter("payment", e.target.value)} className="h-9 w-full min-w-0 appearance-none rounded-lg ps-3 pe-8 text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-[var(--accent)]/30 xl:w-[140px]" style={inputStyle}>
              <option value="all">{t("admin.purchaseOrders.list.paymentAll")}</option>{PAY_STATUSES.map((s) => <option key={s} value={s}>{t(`admin.purchaseOrders.status.${s}`)}</option>)}
            </select><ChevronDown size={14} className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} /></div>
            </div>
          </div>

          {selected.length > 0 && (
            <div className="px-4 py-2 flex items-center justify-between text-[13px]" style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
              <span>{t("admin.purchaseOrders.list.selected", { count: new Intl.NumberFormat(intlLocale(locale)).format(selected.length) })}</span>
              <button onClick={() => { if (confirm(t("admin.purchaseOrders.list.confirmCancelMany", { count: new Intl.NumberFormat(intlLocale(locale)).format(selected.length) }))) cancelM.mutate(selected); }} className="underline font-semibold" style={{ color: "var(--danger-text)" }}>{t("admin.purchaseOrders.list.cancelSelected")}</button>
            </div>
          )}

          <div className="overflow-hidden rounded-lg" style={{ ...cardStyle, boxShadow: "var(--shadow-sm)" }}>
          {isLoading ? <p className="p-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.list.loading")}</p> : (
            <div className="w-full min-w-0 overflow-x-auto">
              <table className="w-full min-w-[1050px] table-fixed text-[13px] xl:min-w-0">
                <colgroup><col className="w-[4%]"/><col className="w-[10%]"/><col className="w-[14%]"/><col className="w-[9%]"/><col className="w-[13%]"/><col className="w-[12%]"/><col className="w-[13%]"/><col className="w-[10%]"/><col className="w-[8%]"/><col className="w-[7%]"/></colgroup>
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-2 py-3 text-center"><input type="checkbox" checked={allOnPage} onChange={() => setSelected(allOnPage ? selected.filter((id) => !rows.some((r) => r._id === id)) : [...new Set([...selected, ...rows.map((r) => r._id)])])} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></th>
                    {[["admin.purchaseOrders.list.poNumber"], ["admin.purchaseOrders.list.vendor"], ["admin.purchaseOrders.list.status"], ["admin.purchaseOrders.list.paymentStatus"], ["admin.purchaseOrders.list.totalAmount"], ["admin.purchaseOrders.list.received"], ["admin.purchaseOrders.list.expectedDate"], ["admin.purchaseOrders.list.createdAt"]].map(([key]) => (
                      <th key={key} className="px-2 py-3 text-start text-[12px] font-semibold uppercase tracking-wide leading-tight" style={{ color: "var(--text-muted)" }}>{t(key)}</th>
                    ))}
                    <th className="whitespace-nowrap px-2 py-3 text-end text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.page.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const r = receivedOf(p);
                    return (
                      <tr key={p._id} onClick={() => router.push(`/admin/purchase-orders/${p._id}`)} className="cursor-pointer transition" style={{ borderBottom: "1px solid var(--border-color)", backgroundColor: "var(--bg-card)" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}>
                        <td className="px-2 py-2.5 text-center align-middle" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(p._id)} onChange={() => toggleOne(p._id)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></td>
                        <td className="px-2 py-2.5 text-start align-middle font-mono text-[12px] break-words" style={{ color: "var(--accent)" }}>{p.po_number}</td>
                        <td className="px-2 py-2.5 text-start align-middle"><div className="font-medium break-words">{localizedStrictField(vendorById.get(String(p.vendor_id?._id || p.vendor_id))?.name || p.vendor_snapshot?.name || p.vendor_id?.name, vendorById.get(String(p.vendor_id?._id || p.vendor_id))?.translations?.name || p.vendor_id?.translations?.name, locale)}</div><div className="font-mono text-[11px] break-words" style={{ color: "var(--text-muted)" }}>{p.vendor_id?.vendor_code || ""}</div></td>
                        <td className="px-2 py-2.5 text-start align-middle"><Pill tone={statusTone(p.status)}>{t(`admin.purchaseOrders.status.${p.status}`)}</Pill></td>
                        <td className="px-2 py-2.5 text-start align-middle"><Pill tone={statusTone(p.payment_status)}>{t(`admin.purchaseOrders.status.${p.payment_status}`)}</Pill></td>
                        <td className="px-2 py-2.5 text-start align-middle font-semibold">{money(p.total, locale)}</td>
                        <td className="px-2 py-2.5 text-start align-middle break-words" style={{ color: "var(--text-secondary)" }}>{new Intl.NumberFormat(intlLocale(locale)).format(r.pct)}% ({new Intl.NumberFormat(intlLocale(locale)).format(r.received)}/{new Intl.NumberFormat(intlLocale(locale)).format(r.ordered)})</td>
                        <td className="px-2 py-2.5 text-start align-middle" style={{ color: "var(--text-secondary)" }}>{fmtDate(p.expected_date, locale)}</td>
                        <td className="px-2 py-2.5 text-start align-middle" style={{ color: "var(--text-secondary)" }}>{fmtDate(p.created_at, locale)}</td>
                        <td className="px-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          <PORowMenu
                            p={p}
                            onView={() => router.push(`/admin/purchase-orders/${p._id}`)}
                            onOpen={() => router.push("/admin/purchase-orders/new?edit=" + p._id)}
                            onConfirm={() => confirmM.mutate(p._id)}
                            onDeliver={() => router.push(`/admin/purchase-orders/${p._id}`)}
                            onPay={() => router.push(`/admin/purchase-orders/${p._id}`)}
                            onViewReceiving={() => router.push(`/admin/purchase-orders/${p._id}`)}
                            onCancel={() => cancelWithReason(p._id)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {!rows.length && <tr><td colSpan={10} className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>{t("admin.purchaseOrders.list.noMatches")}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          </div>

          {filtered.length > PAGE_SIZE && <footer className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3 text-[13px]" style={{ ...cardStyle, color: "var(--text-secondary)" }}>
            <span>{t("admin.purchaseOrders.list.showing", { from: new Intl.NumberFormat(intlLocale(locale)).format(filtered.length ? (safePage - 1) * PAGE_SIZE + 1 : 0), to: new Intl.NumberFormat(intlLocale(locale)).format((safePage - 1) * PAGE_SIZE + rows.length), total: new Intl.NumberFormat(intlLocale(locale)).format(filtered.length) })}</span>
            <div className="flex items-center gap-1">
              <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-40" style={cardStyle}><ChevronLeft size={14} /></button>
              {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, safePage - 3), safePage + 2).map((pg) => (
                <button key={pg} onClick={() => setPage(pg)} className="h-8 w-8 rounded-md text-[13px] font-bold transition" style={pg === safePage ? accentBtn : cardStyle}>{pg}</button>
              ))}
              <button disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-40" style={cardStyle}><ChevronRight size={14} /></button>
            </div>
          </footer>}
      </div>
    </div>
  );
}
