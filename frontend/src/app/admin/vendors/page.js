"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "@/i18n/LanguageProvider";
import { vendorApi } from "@/apis/admin/vendorApi";
import { usePageTranslations } from "@/hooks/admin/usePageTranslations";
import { localizedStrictField } from "@/i18n/localize";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import VendorFormModal, { emptyVendorForm, toVendorForm, toVendorPayload } from "@/components/admin/VendorFormModal";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";
import {
  Star, Plus, Search,
  MoreVertical, ChevronDown, ChevronLeft, ChevronRight,
} from "lucide-react";

// Same tokens as Brands/Products pages — no new design system.
const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
const inputStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
const accentBtn = { backgroundColor: "var(--accent)", color: "var(--accent-text)" };

const money = (n, locale = "en") => `Rs. ${new Intl.NumberFormat(locale === "ur" ? "ur-PK" : locale === "ar" ? "ar" : locale === "hi" ? "hi-IN" : locale === "en" ? "en-PK" : locale).format(Math.max(0, Number(n) || 0))}`;

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
    active: { backgroundColor: "var(--success-soft)", color: "var(--success-text)" },
    inactive: { backgroundColor: "var(--danger-soft)", color: "var(--danger-text)" },
    terms: { backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)", color: "var(--accent)" },
  };
  return (
    <span className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap" style={{ ...(map[tone] || map.terms), border: "1px solid transparent" }}>
      {children}
    </span>
  );
}

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

// Row action menu (module level, like Brands page): open-state and position
// live inside the menu itself, so parent re-renders never wipe the
// coordinates (that bug put the menu at the top-left). Rendered in a
// portal so the table scroll container can never clip it.
function VendorRowMenu({ v, onView, onEdit, onToggle, onDelete, onCreatePurchaseOrder }) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const { t: __t } = useTranslation();
  const t = (k, p) => __t("admin.vendors.page.actions." + k, p);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const openMenu = () => {
    const rect = btnRef.current.getBoundingClientRect();
    const menuW = 170, menuH = v.is_active ? 220 : 180;
    const flipUp = window.innerHeight - rect.bottom < menuH;
    const left = Math.min(Math.max(8, rect.right - menuW), window.innerWidth - menuW - 8);
    setPos({ top: flipUp ? rect.top - menuH - 4 : rect.bottom + 4, left });
    setOpen(true);
  };
  useRowMenuClose(open, menuRef, btnRef, () => setOpen(false));
  const itemClass = "w-full px-3 py-2 text-[13px] text-left transition-colors duration-150";
  const run = (fn) => (e) => { e.stopPropagation(); setOpen(false); fn(); };
  const menuItems = [
    [t("viewDetails"), () => onView(v), "var(--text-primary)"],
    [t("edit"), () => onEdit(v), "var(--text-primary)"],
    ...(v.is_active ? [[t("createPO"), () => onCreatePurchaseOrder(v), "var(--accent)"]] : []),
    [v.is_active ? t("deactivate") : t("activate"), () => onToggle(v), "var(--text-primary)"],
    [t("delete"), () => onDelete(v), "var(--danger-text)"],
  ];
  return (
    <>
      <button ref={btnRef} onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu(); }} className="inline-flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 hover:bg-[var(--bg-row-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" style={{ color: "var(--text-secondary)" }} aria-label={t("more")} aria-haspopup="true" aria-expanded={open}>
        <MoreVertical size={18} />
      </button>
      {open && createPortal(
        <div ref={menuRef} className="fixed z-[9999] w-[170px] rounded-lg py-1" style={{ top: pos.top, left: pos.left, ...cardStyle, boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}>
          {menuItems.map(([label, fn, color]) => (
            <button key={label} onClick={run(fn)} className={itemClass} style={{ color }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>{label}</button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export default function VendorsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const { t: __t, locale } = useTranslation();
  const t = (k, p) => __t("admin.vendors.page." + k, p);
  const tToast = (k, p) => __t("admin.vendors.toast." + k, p);
  const tShared = (k, p) => __t("admin.shared." + k, p);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [city, setCity] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyVendorForm);
  const PAGE_SIZE = 20;

  const { data: vendorsRaw, isLoading } = useQuery({ queryKey: ["vendors"], queryFn: () => vendorApi.getAll() });
  const vendors = useMemo(() => {
    const arr = Array.isArray(vendorsRaw) ? vendorsRaw : vendorsRaw?.data || [];
    return arr.filter((v) => !v.is_deleted);
  }, [vendorsRaw]);
  usePageTranslations({ model: "Vendor", records: vendors, locale, ready: !isLoading, queryKey: ["vendors"], queryClient: qc });

  const monthStart = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; }, []);
  const stats = useMemo(() => {
    const total = vendors.length;
    const active = vendors.filter((v) => v.is_active).length;
    const fresh = vendors.filter((v) => v.created_at && new Date(v.created_at) >= monthStart).length;
    const freshActive = vendors.filter((v) => v.is_active && v.created_at && new Date(v.created_at) >= monthStart).length;
    const purchase = vendors.reduce((s, v) => s + (Number(v.total_purchased) || 0), 0);
    return { total, active, inactive: total - active, fresh, freshActive, purchase };
  }, [vendors, monthStart]);

  const cities = useMemo(() => [...new Set(vendors.map((v) => v.city).filter(Boolean))].sort(), [vendors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (status === "active" && !v.is_active) return false;
      if (status === "inactive" && v.is_active) return false;
      if (city !== "all" && v.city !== city) return false;
      if (q && ![v.name, v.vendor_code, v.company_name].filter(Boolean).join(" ").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [vendors, search, status, city]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const invalidate = () => { qc.invalidateQueries({ queryKey: ["vendors"] }); };

  const saveMutation = useMutation({
    mutationFn: () => (editing ? vendorApi.update(editing._id, toVendorPayload(form)) : vendorApi.create(toVendorPayload(form))),
    onSuccess: () => { toast.success(editing ? tToast("updated") : tToast("created")); setShowModal(false); setEditing(null); setForm(emptyVendorForm); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || tToast("saveFailed")),
  });
  const toggleMutation = useMutation({
    mutationFn: (v) => vendorApi.update(v._id, { is_active: !v.is_active }),
    onSuccess: (_, v) => { toast.success(v.is_active ? tToast("deactivated") : tToast("activated")); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || tToast("failed")),
  });
  const deleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => vendorApi.delete(id))),
    onSuccess: () => { toast.success(tToast("deleted")); setSelected([]); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || tToast("deleteFailed")),
  });

  const openCreate = () => { setEditing(null); setForm({ ...emptyVendorForm, country: "Pakistan", state: "", city: "" }); setShowModal(true); };
  const openEdit = (v) => { setEditing(v); setForm(toVendorForm(v)); setShowModal(true); };

  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r._id));
  const toggleOne = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-4">
      <AdminPageHeader title={t("title")} subtitle={t("subtitle")} actions={<button onClick={openCreate} className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90" style={accentBtn}>
        <Plus size={15} /> {t("addVendor")}
      </button>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        <StatCard label={t("totalVendors")} value={new Intl.NumberFormat(locale).format(stats.total)} />
        <StatCard label={t("activeVendors")} value={new Intl.NumberFormat(locale).format(stats.active)} valueColor="var(--success-text)" />
        <StatCard label={t("inactiveVendors")} value={new Intl.NumberFormat(locale).format(stats.inactive)} valueColor="var(--warning-text)" />
        <StatCard label={t("totalPurchaseValue")} value={money(stats.purchase, locale)} valueColor="var(--accent)" />
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="relative w-full md:w-[400px]">
            <span className="absolute start-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><Search size={14} /></span>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t("searchPlaceholder")} className="w-full h-9 ps-9 pe-3 rounded-lg text-[13px] outline-none" style={inputStyle} />
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="appearance-none h-9 w-full sm:w-[140px] ps-3 pe-8 rounded-lg text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-[var(--accent)]/30" style={inputStyle}>
                <option value="all">{t("statusAll")}</option><option value="active">{tShared("status.active")}</option><option value="inactive">{tShared("status.inactive")}</option>
              </select>
              <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><ChevronDown size={14} /></span>
            </div>
            <div className="relative min-w-0 flex-1 sm:flex-none">
              <select value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} className="appearance-none h-9 w-full sm:w-[140px] ps-3 pe-8 rounded-lg text-[13px] outline-none cursor-pointer transition focus:ring-1 focus:ring-[var(--accent)]/30" style={inputStyle}>
                <option value="all">{t("cityAll")}</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><ChevronDown size={14} /></span>
            </div>
          </div>
        </div>

          {selected.length > 0 && (
            <div className="px-4 py-2 flex items-center justify-between text-[13px]" style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
              <span>{tShared("bulk.selected", { count: selected.length })}</span>
              <button onClick={() => { if (confirm(t("deleteConfirm", { count: selected.length }))) deleteMutation.mutate(selected); }} className="underline font-semibold" style={{ color: "var(--danger-text)" }}>{t("deleteSelected")}</button>
            </div>
          )}

          <div className="rounded-lg overflow-hidden" style={cardStyle}>
          {isLoading ? <p className="p-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>{t("loading")}</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-4 py-3 w-10"><input type="checkbox" checked={allOnPage} onChange={() => setSelected(allOnPage ? selected.filter((id) => !rows.some((r) => r._id === id)) : [...new Set([...selected, ...rows.map((r) => r._id)])])} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></th>
                    {[t("table.vendorCode"), t("table.name"), t("table.company"), t("table.city"), t("table.rating"), t("table.balancePayable"), t("table.status")].map((h) => (
                      <th key={h} className="px-4 py-3 text-start text-[12px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                    <th className="min-w-20 whitespace-nowrap px-2 py-3 text-end text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>{tShared("label.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v._id} onClick={() => router.push(`/admin/vendors/${v._id}`)} className="transition cursor-pointer" style={{ borderBottom: "1px solid var(--border-color)" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(v._id)} onChange={() => toggleOne(v._id)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></td>
                      <td className="px-4 py-2.5 font-mono text-[12px]" style={{ color: "var(--text-secondary)" }}>{v.vendor_code}</td>
                      <td className="px-4 py-2.5 font-medium">{localizedStrictField(v.name, v.translations?.name, locale)}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>{localizedStrictField(v.company_name, v.translations?.company_name, locale) || "—"}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>{localizedStrictField(v.city, v.translations?.city, locale) || "—"}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><span className="inline-flex items-center gap-1"><Star size={12} style={{ color: "#f59e0b" }} />{(Number(v.rating) || 0).toFixed(1)}</span></td>
                      <td className="px-4 py-2.5 font-semibold">{money(v.balance_payable, locale)}</td>
                      <td className="px-4 py-2.5"><Pill tone={v.is_active ? "active" : "inactive"}>{v.is_active ? tShared("status.active") : tShared("status.inactive")}</Pill></td>
                      <td className="min-w-20 px-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <VendorRowMenu
                          v={v}
                          onView={(row) => router.push(`/admin/vendors/${row._id}`)}
                          onEdit={(row) => openEdit(row)}
                          onToggle={(row) => toggleMutation.mutate(row)}
                          onCreatePurchaseOrder={(row) => router.push(`/admin/purchase-orders/new?vendor=${encodeURIComponent(row._id)}`)}
                          onDelete={(row) => { if (confirm(t("deleteTitle"))) deleteMutation.mutate([row._id]); }}
                        />
                      </td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={10} className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>{t("noMatch")}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          </div>

          {filtered.length > PAGE_SIZE && <footer className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3 text-[13px]" style={{ ...cardStyle, color: "var(--text-secondary)" }}>
            <span>{t("showingRange", { from: (safePage - 1) * PAGE_SIZE + (rows.length ? 1 : 0), to: (safePage - 1) * PAGE_SIZE + rows.length, total: filtered.length })}</span>
            <div className="flex items-center gap-1">
              <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-40" style={cardStyle}><ChevronLeft size={14} /></button>
              {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, safePage - 2), safePage + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className="h-8 w-8 rounded-md text-[13px] font-bold transition" style={p === safePage ? accentBtn : cardStyle}>{p}</button>
              ))}
              <button disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-40" style={cardStyle}><ChevronRight size={14} /></button>
            </div>
          </footer>}
        </div>


      <VendorFormModal
        open={showModal}
        form={form}
        setForm={setForm}
        editing={!!editing}
        isPending={saveMutation.isPending}
        onSave={() => saveMutation.mutate()}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}
