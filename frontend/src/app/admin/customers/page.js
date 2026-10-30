"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customerApi } from "@/apis/admin/customerApi";
import CustomerFormModal from "@/components/admin/CustomerFormModal";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";
import { useTranslation } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import {
  CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, ContactRound, Eye, FilePlus2, Mail, MoreVertical, Pencil, Phone, Plus, Search,
  Trash2, Users, X,
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
    { title: t("admin.customers.stats.total"), value: customers.length },
    { title: t("admin.customers.stats.newThisMonth"), value: thisMonthCount, valueColor: "var(--success-text)" },
    { title: t("admin.customers.stats.withPhone"), value: phoneCount, valueColor: "var(--accent)" },
    { title: t("admin.customers.stats.withEmail"), value: emailCount, valueClass: "text-purple-500 dark:text-purple-300" },
  ];

  return (
    <div dir={dir} className="admin-customers-page min-h-full space-y-4 text-[var(--text-primary)]">
      <AdminPageHeader title={t("admin.customers.title")} subtitle={t("admin.customers.subtitle")} actions={<button type="button" onClick={openCreate} className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}><Plus size={15} /> {t("admin.customers.add")}</button>} />

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4" aria-label={t("admin.customers.statistics")}>
        {statCards.map(({ title, value, valueColor, valueClass }) => (
          <div key={title} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:p-4">
            <p className="truncate text-[11px] font-medium text-[var(--text-muted)] sm:text-xs">{title}</p>
            <p className={`mt-1 truncate text-lg font-bold leading-tight sm:text-xl ${valueClass || ""}`} style={{ color: valueColor }}>{value.toLocaleString(locale)}</p>
          </div>
        ))}
      </section>

      <div className="min-w-0 space-y-4">
        <div className="flex min-w-0 flex-col items-start justify-between gap-3 md:flex-row md:items-center">
          <label className="relative block w-full min-w-0 md:w-[400px]">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input value={search} onChange={(event) => { setPage(1); setSearch(event.target.value); }} placeholder={t("admin.customers.search.placeholder")} aria-label={t("admin.customers.search.aria")} className="h-9 min-w-0 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] ps-9 pe-3 text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent)]/40" />
          </label>
          <div className="flex w-full items-center gap-3 md:w-auto">
            <CustomerSelect className="w-full sm:w-[140px]" value={filter} onChange={(value) => { setPage(1); setFilter(value); }} ariaLabel={t("admin.customers.filters.aria")}>
              <option value="all">{t("admin.customers.filters.all")}</option><option value="phone">{t("admin.customers.filters.withPhone")}</option><option value="email">{t("admin.customers.filters.withEmail")}</option>
            </CustomerSelect>
            <CustomerSelect className="w-full sm:w-[140px]" value={sort} onChange={(value) => { setPage(1); setSort(value); }} ariaLabel={t("admin.customers.sort.aria")}>
              <option value="newest">{t("admin.customers.sort.newest")}</option><option value="oldest">{t("admin.customers.sort.oldest")}</option>
            </CustomerSelect>
          </div>
        </div>

        <section className="min-w-0 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] table-fixed text-start text-[13px]">
              <colgroup><col className="w-[22%]"/><col className="w-[15%]"/><col className="w-[22%]"/><col className="w-[14%]"/><col className="w-[18%]"/><col className="w-[9%]"/></colgroup>
              <thead className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                <tr><th className="px-4 py-3 text-start">{t("admin.customers.table.customer")}</th><th className="px-4 py-3 text-start">{t("common.phone")}</th><th className="px-4 py-3 text-start">{t("common.email")}</th><th className="px-4 py-3 text-start">{t("admin.customers.table.address")}</th><th className="px-4 py-3 text-start">{t("admin.customers.table.addedOn")}</th><th className="whitespace-nowrap px-2 py-3 text-end">{t("admin.shared.label.actions")}</th></tr>
              </thead>
              <tbody>
                {isLoading ? <tr><td colSpan={6} className="px-3 py-9 text-center text-sm text-[var(--text-muted)]">{t("admin.customers.loading")}</td></tr>
                  : isError ? <tr><td colSpan={6} className="px-3 py-9 text-center text-sm text-[var(--danger-text)]">{error?.response?.data?.message || t("admin.customers.loadFailed")} <button type="button" onClick={() => qc.invalidateQueries({ queryKey: ["customers-admin"] })} className="ms-2 underline">{t("common.retry")}</button></td></tr>
                  : customerList.length === 0 ? <tr><td colSpan={6} className="px-3 py-7"><div className="flex flex-col items-center justify-center text-center"><span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Users size={18} /></span><p className="text-xs font-semibold text-[var(--text-primary)]">{search ? t("admin.customers.empty.searchTitle") : t("admin.customers.empty.title")}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{search ? t("admin.customers.empty.searchDescription") : t("admin.customers.empty.description")}</p><button type="button" onClick={() => search ? (setPage(1), setSearch("")) : openCreate()} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3 text-[10px] font-semibold text-[var(--accent)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">{search ? <><X size={12} /> {t("admin.customers.search.clear")}</> : <><Plus size={12} /> {t("admin.customers.add")}</>}</button></div></td></tr>
                    : pageCustomers.map((customer) => (
                      <tr key={customer._id} onClick={() => router.push(`/admin/customers/${customer._id}`)} className="cursor-pointer border-b border-[var(--border-color)] transition-colors duration-150 hover:bg-[var(--bg-row-hover)]">
                        <td className="px-4 py-2.5 text-start"><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] font-bold text-[var(--accent)]">{initials(customer.name)}</span><div className="min-w-0"><p className="max-w-40 truncate text-[13px] font-semibold text-[var(--text-primary)]">{customer.name}</p></div></div></td>
                        <td className="px-4 py-2.5 text-start text-xs text-[var(--text-secondary)]">{customer.phone || "—"}</td>
                        <td className="px-4 py-2.5 text-start text-xs text-[var(--text-secondary)]"><span className="block max-w-48 truncate">{customer.email || "—"}</span></td>
                        <td className="px-4 py-2.5 text-start text-xs text-[var(--text-secondary)]"><span className="block max-w-40 truncate">{customer.address || "—"}</span></td>
                        <td className="px-4 py-2.5 text-start text-xs text-[var(--text-secondary)]">{dateTime(customer.created_at, locale, t)}</td>
                        <td className="px-2 py-2.5"><div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
                          <CustomerRowMenu dir={dir} customer={customer} onView={(record) => router.push(`/admin/customers/${record._id}`)} onEdit={openEdit} onDelete={(record) => { if (window.confirm(`Delete ${record.name}?`)) deleteMutation.mutate(record._id); }} onCreateQuote={(record) => router.push(`/admin/quotes/new?customer=${record._id}`)} onCreateInvoice={(record) => router.push(`/admin/invoices/new?customer=${record._id}`)} />
                        </div></td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {customerList.length > pageSize && <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-color)] px-4 py-3 text-[13px] text-[var(--text-muted)]">
            <span>Showing {customerList.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, customerList.length)} of {customerList.length} customers</span>
            <div className="flex items-center gap-1"><button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-[var(--border-color)] p-1.5 text-[var(--text-muted)] disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={13} /></button>{Array.from({ length: pageCount }, (_, index) => index + 1).slice(Math.max(0, page - 3), page + 2).map((pageNumber) => <button key={pageNumber} type="button" onClick={() => setPage(pageNumber)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${pageNumber === page ? "bg-[var(--accent)] text-[var(--accent-text)]" : "border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}>{pageNumber}</button>)}<button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-[var(--border-color)] p-1.5 text-[var(--text-muted)] disabled:opacity-40" aria-label="Next page"><ChevronRight size={13} /></button></div>
          </footer>}
        </section>

      </div>

      <CustomerFormModal open={formOpen} form={form} setForm={setForm} editing={!!editingId} isPending={saveMutation.isPending} onSave={submitForm} onClose={() => setFormOpen(false)} />
    </div>
  );
}

function CustomerRowMenu({ dir = "ltr", customer, onView, onEdit, onDelete, onCreateQuote, onCreateInvoice }) {
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
    const maxTop = Math.max(8, window.innerHeight - menuHeight - 8);
    const flipUp = window.innerHeight - rect.bottom < menuHeight + 8;
    const top = Math.min(maxTop, Math.max(8, flipUp ? rect.top - menuHeight - 4 : rect.bottom + 4));
    const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
    const preferredLeft = dir === "rtl" ? rect.left : rect.right - menuWidth;
    const left = Math.min(maxLeft, Math.max(8, preferredLeft));
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
    <button ref={buttonRef} type="button" onClick={toggleMenu} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--bg-row-hover)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" aria-label={`Actions for ${customer.name}`} aria-haspopup="true" aria-expanded={open}><MoreVertical size={18} /></button>
    {open && createPortal(<div ref={menuRef} className="fixed z-[9999] w-44 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] py-1 shadow-md" style={{ top: position.top, left: position.left }}>
      <button type="button" onClick={run(onView)} className={`${menuItem} text-[var(--text-secondary)]`} {...hover}><Eye size={14} />View details</button>
      <button type="button" onClick={run(onCreateQuote)} className={`${menuItem} text-[var(--text-secondary)]`} {...hover}><ContactRound size={14} />Create quote</button>
      <button type="button" onClick={run(onCreateInvoice)} className={`${menuItem} text-[var(--text-secondary)]`} {...hover}><FilePlus2 size={14} />Create invoice</button>
      <button type="button" onClick={run(onEdit)} className={`${menuItem} text-[var(--text-secondary)]`} {...hover}><Pencil size={14} />Edit</button>
      <button type="button" onClick={run(onDelete)} className={`${menuItem} text-[var(--danger-text)]`} {...hover}><Trash2 size={14} />Delete</button>
    </div>, document.body)}
  </>;
}

function CustomerSelect({ className = "", value, onChange, ariaLabel, children }) {
  return <label className={`relative block min-w-0 ${className}`}>
    <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={ariaLabel} className="h-9 w-full appearance-none rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] ps-3 pe-8 text-[13px] text-[var(--text-primary)] outline-none transition focus:ring-1 focus:ring-[var(--accent)]/40">
      {children}
    </select>
    <ChevronDown size={14} className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
  </label>;
}
