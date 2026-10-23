"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerApi } from "@/apis/admin/customerApi";
import CustomerFormModal from "@/components/admin/CustomerFormModal";
import { useTranslation } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, ContactRound, Eye, FilePlus2, Mail, MoreHorizontal, Pencil, Plus, Search,
  SlidersHorizontal, Smartphone, Trash2, Users, X,
} from "lucide-react";

const emptyForm = { name: "", phone: "", email: "", address: "", notes: "" };
const dateTime = (value, locale, t) => value ? new Date(value).toLocaleString(locale, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : t("common.notProvided");
const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "C";

export default function CustomersPage() {
  const { t, locale, dir } = useTranslation();
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data: customers = [], isLoading, isError, error } = useQuery({
    queryKey: ["customers-admin", search],
    queryFn: () => customerApi.getAll({ search }),
  });
  const customerList = useMemo(() => {
    const filtered = (customers || []).filter((customer) => {
      if (filter === "phone") return Boolean(customer.phone?.trim());
      if (filter === "email") return Boolean(customer.email?.trim());
      return true;
    });
    return [...filtered].sort((a, b) => {
      const direction = sort === "oldest" ? 1 : -1;
      return direction * (new Date(a.created_at || 0) - new Date(b.created_at || 0));
    });
  }, [customers, filter, sort]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(customerList.length / pageSize));
  const pageCustomers = customerList.slice((page - 1) * pageSize, page * pageSize);

  const saveMutation = useMutation({
    mutationFn: (payload) => editingId ? customerApi.update(editingId, payload) : customerApi.create(payload),
    onSuccess: (response) => {
      const saved = response?.data || response;
      toast.success(t(editingId ? "admin.customers.toast.updated" : "admin.customers.toast.created"));
      setForm(emptyForm);
      setEditingId(null);
      setFormOpen(false);
      if (saved?._id) router.push(`/admin/customers/${saved._id}`);
      qc.invalidateQueries({ queryKey: ["customers-admin"] });
      qc.invalidateQueries({ queryKey: ["customer-detail"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || t("admin.customers.toast.saveFailed")),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => customerApi.delete(id),
    onSuccess: () => {
      toast.success(t("admin.customers.toast.deleted"));
      qc.invalidateQueries({ queryKey: ["customers-admin"] });
      qc.invalidateQueries({ queryKey: ["customer-detail"] });
    },
    onError: (error) => toast.error(error?.response?.data?.message || t("admin.customers.toast.deleteFailed")),
  });

  const thisMonthCount = customers.filter((customer) => {
    const created = new Date(customer.created_at);
    const now = new Date();
    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
  }).length;
  const phoneCount = customers.filter((customer) => customer.phone?.trim()).length;
  const emailCount = customers.filter((customer) => customer.email?.trim()).length;
  const percent = (count) => customers.length ? Math.round(count * 100 / customers.length) : 0;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };
  const openEdit = (customer) => {
    setEditingId(customer._id);
    setForm({ name: customer.name || "", phone: customer.phone || "", email: customer.email || "", address: customer.address || "", notes: customer.notes || "" });
    setFormOpen(true);
  };
  const submitForm = () => {
    if (!form.name.trim()) return toast.error(t("admin.customers.validation.nameRequired"));
    saveMutation.mutate(form);
  };

  const statCards = [
    { title: t("admin.customers.stats.total"), value: customers.length.toLocaleString(locale), meta: t("admin.customers.stats.allRegistered"), Icon: Users, tone: "accent" },
    { title: t("admin.customers.stats.newThisMonth"), value: thisMonthCount.toLocaleString(locale), meta: t("admin.customers.stats.addedThisMonth"), Icon: Plus, tone: "blue" },
    { title: t("admin.customers.stats.withPhone"), value: phoneCount.toLocaleString(locale), meta: t("admin.customers.stats.percentOfCustomers", { percent: percent(phoneCount) }), Icon: Smartphone, tone: "green" },
    { title: t("admin.customers.stats.withEmail"), value: emailCount.toLocaleString(locale), meta: t("admin.customers.stats.percentOfCustomers", { percent: percent(emailCount) }), Icon: Mail, tone: "blue" },
  ];

  return (
    <div dir={dir} className="admin-customers-page min-h-full space-y-4 p-1 text-[var(--text-primary)] sm:space-y-5 sm:p-2 lg:p-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]"><Users size={23} /></span>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{t("admin.customers.title")}</h1>
            <p className="mt-0.5 text-xs text-[var(--text-muted)] sm:text-sm">{t("admin.customers.subtitle")}</p>
          </div>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(37,99,235,0.22)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0">
          <Plus size={16} /> {t("admin.customers.add")}
        </button>
      </header>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("admin.customers.statistics")}>
        {statCards.map(({ title, value, meta, Icon, tone }) => (
          <div key={title} className="group flex min-w-0 items-center gap-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--accent)]/30 hover:shadow-lg sm:p-5">
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform duration-200 group-hover:scale-105 ${tone === "green" ? "bg-[var(--success-soft)] text-[var(--success-text)]" : "bg-[var(--accent-soft)] text-[var(--accent)]"}`}><Icon size={19} /></span>
            <div className="min-w-0"><p className="truncate text-xs font-semibold text-[var(--text-muted)]">{title}</p><div className="mt-1 flex flex-wrap items-baseline gap-x-2.5"><span className="text-2xl font-extrabold leading-none tracking-tight text-[var(--text-primary)]">{value}</span><span className="text-[10px] font-medium text-[var(--text-muted)]">{meta}</span></div></div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 items-start gap-4">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-lg shadow-slate-900/5">
          <div className="grid gap-2 border-b border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(220px,1fr)_150px_170px_40px]">
            <label className="relative block">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder="Search by name, phone, or email..." aria-label="Search customers" className="h-10 w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-900 outline-none shadow-sm transition-all placeholder:text-slate-400 hover:shadow-md focus:shadow-lg focus:ring-2 focus:ring-blue-200" />
            </label>
            <select value={filter} onChange={(event) => { setPage(1); setFilter(event.target.value); }} aria-label="Filter customers" className="h-10 rounded-2xl border-[1.5px] border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none shadow-sm transition-all hover:shadow-md focus:ring-2 focus:ring-blue-200">
              <option value="all">All Customers</option><option value="phone">With Phone</option><option value="email">With Email</option>
            </select>
            <select value={sort} onChange={(event) => { setPage(1); setSort(event.target.value); }} aria-label="Sort customers" className="h-10 rounded-2xl border-[1.5px] border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none shadow-sm transition-all hover:shadow-md focus:ring-2 focus:ring-blue-200">
              <option value="newest">Newest First</option><option value="oldest">Oldest First</option>
            </select>
            <span className="hidden h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 sm:flex" title="Customer filters"><SlidersHorizontal size={15} /></span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-[13px]">
              <thead className="border-b border-slate-200 bg-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Address</th><th className="px-4 py-3">Added On</th><th className="px-4 py-3 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan={6} className="px-3 py-9 text-center text-sm text-[var(--text-muted)]">{t("admin.customers.loading")}</td></tr>
                  : isError ? <tr><td colSpan={6} className="px-3 py-9 text-center text-sm text-[var(--danger-text)]">{error?.response?.data?.message || t("admin.customers.loadFailed")} <button type="button" onClick={() => qc.invalidateQueries({ queryKey: ["customers-admin"] })} className="ms-2 underline">{t("common.retry")}</button></td></tr>
                  : customerList.length === 0 ? <tr><td colSpan={6} className="px-3 py-7"><div className="flex flex-col items-center justify-center text-center"><span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Users size={18} /></span><p className="text-xs font-semibold text-[var(--text-primary)]">{search ? t("admin.customers.empty.searchTitle") : t("admin.customers.empty.title")}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{search ? t("admin.customers.empty.searchDescription") : t("admin.customers.empty.description")}</p><button type="button" onClick={() => search ? (setPage(1), setSearch("")) : openCreate()} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3 text-[10px] font-semibold text-[var(--accent)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">{search ? <><X size={12} /> {t("admin.customers.search.clear")}</> : <><Plus size={12} /> {t("admin.customers.add")}</>}</button></div></td></tr>
                    : pageCustomers.map((customer) => (
                      <tr key={customer._id} onClick={() => router.push(`/admin/customers/${customer._id}`)} className="cursor-pointer border-b border-slate-200 transition-colors duration-150 hover:bg-blue-50/60">
                        <td className="px-4 py-2.5"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">{initials(customer.name)}</span><div className="min-w-0"><p className="max-w-40 truncate text-[13px] font-semibold text-slate-900">{customer.name}</p><span className="mt-0.5 inline-flex rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">Customer</span></div></div></td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{customer.phone || "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600"><span className="block max-w-48 truncate">{customer.email || "—"}</span></td>
                        <td className="px-4 py-2.5 text-xs text-slate-600"><span className="block max-w-40 truncate">{customer.address || "—"}</span></td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{dateTime(customer.created_at)}</td>
                        <td className="px-4 py-2.5"><div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
                          <CustomerRowMenu customer={customer} onView={(record) => router.push(`/admin/customers/${record._id}`)} onEdit={openEdit} onDelete={(record) => { if (window.confirm(`Delete ${record.name}?`)) deleteMutation.mutate(record._id); }} onCreateQuote={(record) => router.push(`/admin/quotes/new?customer=${record._id}`)} onCreateInvoice={(record) => router.push(`/admin/invoices/new?customer=${record._id}`)} />
                        </div></td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {customerList.length > pageSize && <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-3 text-[13px] text-slate-500">
            <span>Showing {customerList.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, customerList.length)} of {customerList.length} customers</span>
            <div className="flex items-center gap-1"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[var(--border-color)] p-1.5 text-[var(--text-muted)] disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={13} /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).slice(Math.max(0, page - 3), page + 2).map((pageNumber) => <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${pageNumber === page ? "bg-[var(--accent)] text-[var(--accent-text)]" : "border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}>{pageNumber}</button>)}<button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[var(--border-color)] p-1.5 text-[var(--text-muted)] disabled:opacity-40" aria-label="Next page"><ChevronRight size={13} /></button></div>
          </footer>}
        </section>

      </div>

      <CustomerFormModal open={formOpen} form={form} setForm={setForm} editing={!!editingId} isPending={saveMutation.isPending} onSave={submitForm} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function CustomerRowMenu({ customer, onView, onEdit, onDelete, onCreateQuote, onCreateInvoice }) {
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const handleOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) close();
    };
    const handleKeyDown = (event) => { if (event.key === "Escape") close(); };
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const toggleMenu = (event) => {
    event.stopPropagation();
    if (open) return close();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 180;
    const menuHeight = 220;
    const flipUp = window.innerHeight - rect.bottom < menuHeight;
    const top = flipUp
      ? Math.max(8, rect.top - menuHeight - 4)
      : Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8);
    const left = dir === "rtl" ? Math.min(Math.max(8, rect.left), window.innerWidth - menuWidth - 8) : Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    setPosition({ top, left });
    setOpen(true);
  };
  const run = (callback) => (event) => {
    event.stopPropagation();
    close();
    callback(customer);
  };
  const menuItem = "flex w-full items-center gap-2.5 px-3 py-2 text-start text-[13px] transition-colors duration-150";
  const hover = {
    onMouseEnter: (event) => { event.currentTarget.style.backgroundColor = "var(--bg-row-hover)"; },
    onMouseLeave: (event) => { event.currentTarget.style.backgroundColor = "transparent"; },
  };

  return <>
    <button ref={buttonRef} type="button" onClick={toggleMenu} className="rounded-md p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-row-hover)] hover:text-[var(--text-primary)]" aria-label={`Actions for ${customer.name}`} aria-haspopup="true" aria-expanded={open}><MoreHorizontal size={16} /></button>
    {open && createPortal(<div ref={menuRef} className="fixed z-[9999] w-44 overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] py-1 shadow-[0_8px_28px_rgba(15,23,42,0.2)]" style={{ top: position.top, left: position.left }}>
      <button type="button" onClick={run(onView)} className={`${menuItem} text-[var(--text-secondary)]`} {...hover}><Eye size={14} />View details</button>
      <button type="button" onClick={run(onCreateQuote)} className={`${menuItem} text-[var(--text-secondary)]`} {...hover}><ContactRound size={14} />Create quote</button>
      <button type="button" onClick={run(onCreateInvoice)} className={`${menuItem} text-[var(--text-secondary)]`} {...hover}><FilePlus2 size={14} />Create invoice</button>
      <button type="button" onClick={run(onEdit)} className={`${menuItem} text-[var(--text-secondary)]`} {...hover}><Pencil size={14} />Edit</button>
      <button type="button" onClick={run(onDelete)} className={`${menuItem} text-[var(--danger-text)]`} {...hover}><Trash2 size={14} />Delete</button>
    </div>, document.body)}
  </>;
}
