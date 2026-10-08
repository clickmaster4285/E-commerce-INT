"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { vendorApi } from "@/apis/admin/vendorApi";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import VendorFormModal, { emptyVendorForm, toVendorForm, toVendorPayload } from "@/components/admin/VendorFormModal";
import {
  Users, UserCheck, UserX, DollarSign, Star, Plus, Search,
  MoreHorizontal, ChevronLeft, ChevronRight,
} from "lucide-react";

// Same tokens as Brands/Products pages — no new design system.
const cardStyle = { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" };
const inputStyle = { backgroundColor: "var(--bg-tertiary)", border: "1px solid var(--border-color)", color: "var(--text-primary)" };
const accentBtn = { backgroundColor: "var(--accent)", color: "var(--accent-text)" };

const money = (n) => `Rs. ${(Math.max(0, Number(n) || 0)).toLocaleString()}`;

function StatCard({ icon: Icon, tint, label, value, delta }) {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3" style={cardStyle}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: tint }}>
        <Icon size={18} style={{ color: "var(--accent)" }} />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium truncate" style={{ color: "var(--text-muted)" }}>{label}</p>
        <p className="text-[20px] font-bold leading-tight">{value}</p>
        {delta && <p className="text-[11px]" style={{ color: "var(--success-text)" }}>{delta}</p>}
      </div>
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
function VendorRowMenu({ v, onView, onEdit, onToggle, onDelete }) {
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const openMenu = () => {
    const rect = btnRef.current.getBoundingClientRect();
    const menuW = 170, menuH = 180;
    const flipUp = window.innerHeight - rect.bottom < menuH;
    const left = Math.min(Math.max(8, rect.right - menuW), window.innerWidth - menuW - 8);
    setPos({ top: flipUp ? rect.top - menuH - 4 : rect.bottom + 4, left });
    setOpen(true);
  };
  useRowMenuClose(open, menuRef, btnRef, () => setOpen(false));
  const itemClass = "w-full px-3 py-2 text-[13px] text-left transition-colors duration-150";
  const run = (fn) => (e) => { e.stopPropagation(); setOpen(false); fn(); };
  const menuItems = [
    ["View details", () => onView(v), "var(--text-primary)"],
    ["Edit", () => onEdit(v), "var(--text-primary)"],
    [v.is_active ? "Deactivate" : "Activate", () => onToggle(v), "var(--text-primary)"],
    ["Delete", () => onDelete(v), "var(--danger-text)"],
  ];
  return (
    <>
      <button ref={btnRef} onClick={(e) => { e.stopPropagation(); open ? setOpen(false) : openMenu(); }} className="p-1.5 rounded-md transition hover:opacity-70" style={{ color: "var(--text-muted)" }} aria-label="More actions" aria-haspopup="true" aria-expanded={open}>
        <MoreHorizontal size={16} />
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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [city, setCity] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyVendorForm);
  const PAGE_SIZE = 10;

  const { data: vendorsRaw, isLoading } = useQuery({ queryKey: ["vendors"], queryFn: () => vendorApi.getAll() });
  const vendors = useMemo(() => {
    const arr = Array.isArray(vendorsRaw) ? vendorsRaw : vendorsRaw?.data || [];
    return arr.filter((v) => !v.is_deleted);
  }, [vendorsRaw]);

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

  const resetFilters = () => { setSearch(""); setStatus("all"); setCity("all"); setPage(1); };
  const invalidate = () => { qc.invalidateQueries({ queryKey: ["vendors"] }); };

  const saveMutation = useMutation({
    mutationFn: () => (editing ? vendorApi.update(editing._id, toVendorPayload(form)) : vendorApi.create(toVendorPayload(form))),
    onSuccess: () => { toast.success(editing ? "Vendor updated" : "Vendor created"); setShowModal(false); setEditing(null); setForm(emptyVendorForm); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Save failed"),
  });
  const toggleMutation = useMutation({
    mutationFn: (v) => vendorApi.update(v._id, { is_active: !v.is_active }),
    onSuccess: (_, v) => { toast.success(v.is_active ? "Vendor deactivated" : "Vendor activated"); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed"),
  });
  const deleteMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map((id) => vendorApi.delete(id))),
    onSuccess: () => { toast.success("Vendor deleted"); setSelected([]); invalidate(); },
    onError: (e) => toast.error(e?.response?.data?.message || "Delete failed"),
  });

  const openCreate = () => { setEditing(null); setForm({ ...emptyVendorForm, country: "Pakistan", state: "", city: "" }); setShowModal(true); };
  const openEdit = (v) => { setEditing(v); setForm(toVendorForm(v)); setShowModal(true); };

  const allOnPage = rows.length > 0 && rows.every((r) => selected.includes(r._id));
  const toggleOne = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Vendors</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Manage your suppliers and track their performance</p>
        </div>
        <button onClick={openCreate} className="h-9 px-4 rounded-lg text-[13px] font-semibold flex items-center gap-2 transition hover:opacity-90" style={accentBtn}>
          <Plus size={15} /> Add Vendor
        </button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={Users} tint="color-mix(in srgb, var(--accent) 14%, transparent)" label="Total Vendors" value={stats.total} delta={stats.fresh ? `↑ ${stats.fresh} this month` : "— no change"} />
        <StatCard icon={UserCheck} tint="var(--success-soft)" label="Active Vendors" value={stats.active} delta={stats.freshActive ? `↑ ${stats.freshActive} this month` : "— no change"} />
        <StatCard icon={UserX} tint="var(--danger-soft)" label="Inactive Vendors" value={stats.inactive} delta="— no change" />
        <StatCard icon={DollarSign} tint="color-mix(in srgb, #f59e0b 16%, transparent)" label="Total Purchase Value" value={money(stats.purchase)} delta="lifetime purchase value" />
      </div>

      <div className="rounded-xl overflow-hidden min-w-0" style={cardStyle}>
        <div className="p-3 grid sm:grid-cols-2 lg:grid-cols-[1fr_140px_140px_auto] gap-2" style={{ borderBottom: "1px solid var(--border-color)" }}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }}><Search size={14} /></span>
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by vendor code, name, company..." className="w-full h-9 pl-9 pr-3 rounded-md text-sm outline-none" style={inputStyle} />
            </div>
            <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-9 px-2 rounded-md text-sm outline-none" style={inputStyle}>
              <option value="all">Status: All</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
            <select value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }} className="h-9 px-2 rounded-md text-sm outline-none" style={inputStyle}>
              <option value="all">City: All</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={resetFilters} className="h-9 px-3 rounded-md text-[13px] font-semibold transition hover:opacity-80" style={{ ...cardStyle, borderRadius: "8px" }}>Reset</button>
          </div>

          {selected.length > 0 && (
            <div className="px-4 py-2 flex items-center justify-between text-[13px]" style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
              <span>{selected.length} selected</span>
              <button onClick={() => { if (confirm(`Delete ${selected.length} vendors?`)) deleteMutation.mutate(selected); }} className="underline font-semibold" style={{ color: "var(--danger-text)" }}>Delete selected</button>
            </div>
          )}

          {isLoading ? <p className="p-6 text-sm text-center" style={{ color: "var(--text-muted)" }}>Loading vendors...</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead style={{ backgroundColor: "var(--bg-tertiary)", borderBottom: "1px solid var(--border-color)" }}>
                  <tr>
                    <th className="px-4 py-3 w-10"><input type="checkbox" checked={allOnPage} onChange={() => setSelected(allOnPage ? selected.filter((id) => !rows.some((r) => r._id === id)) : [...new Set([...selected, ...rows.map((r) => r._id)])])} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></th>
                    {["Vendor Code", "Name", "Company", "City", "Rating", "Balance Payable", "Status"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[12px] font-semibold uppercase tracking-wide whitespace-nowrap" style={{ color: "var(--text-muted)" }}>{h}</th>
                    ))}
                    <th className="px-4 py-3 text-right text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((v) => (
                    <tr key={v._id} onClick={() => router.push(`/admin/vendors/${v._id}`)} className="transition cursor-pointer" style={{ borderBottom: "1px solid var(--border-color)" }} onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-row-hover)")} onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                      <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.includes(v._id)} onChange={() => toggleOne(v._id)} className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: "var(--accent)" }} /></td>
                      <td className="px-4 py-2.5 font-mono text-[12px]" style={{ color: "var(--text-secondary)" }}>{v.vendor_code}</td>
                      <td className="px-4 py-2.5 font-medium">{v.name}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>{v.company_name || "—"}</td>
                      <td className="px-4 py-2.5" style={{ color: "var(--text-secondary)" }}>{v.city || "—"}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><span className="inline-flex items-center gap-1"><Star size={12} style={{ color: "#f59e0b" }} />{(Number(v.rating) || 0).toFixed(1)}</span></td>
                      <td className="px-4 py-2.5 font-semibold">{money(v.balance_payable)}</td>
                      <td className="px-4 py-2.5"><Pill tone={v.is_active ? "active" : "inactive"}>{v.is_active ? "Active" : "Inactive"}</Pill></td>
                      <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <VendorRowMenu
                          v={v}
                          onView={(row) => router.push(`/admin/vendors/${row._id}`)}
                          onEdit={(row) => openEdit(row)}
                          onToggle={(row) => toggleMutation.mutate(row)}
                          onDelete={(row) => { if (confirm("Delete vendor?")) deleteMutation.mutate([row._id]); }}
                        />
                      </td>
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={10} className="p-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>No vendors match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-[13px]" style={{ color: "var(--text-muted)" }}>
            <span>Showing {(safePage - 1) * PAGE_SIZE + (rows.length ? 1 : 0)}–{(safePage - 1) * PAGE_SIZE + rows.length} of {filtered.length} vendors</span>
            <div className="flex items-center gap-1">
              <button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-40" style={cardStyle}><ChevronLeft size={14} /></button>
              {Array.from({ length: pages }, (_, i) => i + 1).slice(Math.max(0, safePage - 2), safePage + 1).map((p) => (
                <button key={p} onClick={() => setPage(p)} className="h-8 w-8 rounded-md text-[13px] font-bold transition" style={p === safePage ? accentBtn : cardStyle}>{p}</button>
              ))}
              <button disabled={safePage >= pages} onClick={() => setPage(safePage + 1)} className="h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-40" style={cardStyle}><ChevronRight size={14} /></button>
            </div>
          </div>
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
