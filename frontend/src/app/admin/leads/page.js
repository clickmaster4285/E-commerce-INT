"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { leadApi } from "@/apis/admin/leadApi";
import { addLeadAsCustomer } from "@/lib/addLeadAsCustomer";
import { employeeApi } from "@/apis/admin/employeeApi";
import LeadFormModal from "@/components/admin/LeadFormModal";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";
import { useTranslation } from "@/i18n/LanguageProvider";
import { localizedStrictField } from "@/i18n/localize";
import { usePageTranslations } from "@/hooks/admin/usePageTranslations";
import { toast } from "sonner";
import { BadgeCheck, CalendarClock, CalendarPlus, Check, ChevronDown, ChevronLeft, ChevronRight, Eye, MoreVertical, Pencil, Plus, Search, Users, X } from "lucide-react";

const emptyForm = { lead_type: "Individual", name: "", phone: "", email: "", company_name: "", business_type: "", business_address: "", city: "", source: "Other", status: "New", assigned_employee_id: "", estimated_deal_value: "", expected_purchase_date: "", next_follow_up_date: "", products: [], custom_requirements: "", notes: "" };
const date = (v, locale, t) => v ? new Date(v).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" }) : t("common.notProvided");
const statusTone = { New: "bg-[var(--accent-soft)] text-[var(--accent)]", Contacted: "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]", Qualified: "bg-[var(--warning-soft)] text-[var(--warning-text)]", Converted: "bg-[var(--success-soft)] text-[var(--success-text)]", Lost: "bg-[var(--danger-soft)] text-[var(--danger-text)]" };
const nextLeadStatuses = { New: ["Contacted"], Contacted: ["Qualified"], Qualified: ["Converted", "Lost"] };
const previousLeadStatus = { Contacted: "New", Qualified: "Contacted", Converted: "Qualified" };
const leadValueKey = (value) => `admin.leads.value.${String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "")}`;
const leadValueLabel = (value, t) => { const key = leadValueKey(value); const label = t(key); return label === key ? (String(value || "").replaceAll("_", " ") || t("common.notProvided")) : label; };

// ✅ Sortable column header — brands/vendors/po page ka SortHeader ka pattern
// (module level — render ke andar component define karne se state reset hoti hai)
function SortHeader({ label, sortKey, sortConfig, onSort }) {
  return (
    <th className="whitespace-nowrap px-4 py-3 text-start" onClick={() => onSort(sortKey)} style={{ cursor: "pointer", color: sortConfig.key === sortKey ? "var(--text-primary)" : "var(--text-muted)" }}>
      <span className="font-semibold uppercase tracking-wider text-[12px]">{label}</span>
      <ChevronDown size={12} className={`ml-1 transition-transform ${sortConfig.key === sortKey && sortConfig.direction === "asc" ? "rotate-180" : ""}`} style={{ opacity: sortConfig.key === sortKey ? 0.7 : 0.35 }} />
    </th>
  );
}

export default function LeadsPage() {
  const { t, locale, dir } = useTranslation();
  const router = useRouter(); const qc = useQueryClient();
  const [search, setSearch] = useState(""); const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState({ status: "", lead_type: "", source: "", assigned_employee_id: "" });
  const [sortConfig, setSortConfig] = useState({ key: "created", direction: "desc" });
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [form, setForm] = useState(emptyForm); const [editingId, setEditingId] = useState(null); const [formOpen, setFormOpen] = useState(false);
  const [lostReasonLead, setLostReasonLead] = useState(null); const [lostReason, setLostReason] = useState("");

  // ✅ Search debounce (300ms) + page reset — search ab server-side hai
  const searchTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(searchTimerRef.current), []);
  useEffect(() => {
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);

  // ✅ Filters — page reset (brands ka pattern). Selection nahi hai leads list par (row click se navigate hota hai).
  const changeFilter = (key, value) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };

  const handleSort = (key) => {
    // ✅ Server side sorting — sort badalne par pehle page par wapas (brands ka pattern)
    setSortConfig((prev) => ({ key, direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc" }));
    setPage(1);
  };

  // ✅ Server-side pagination + server-side search/filter/sort (brands ka pattern)
  const leadsQueryKey = ["leads", "paginated", locale, page, itemsPerPage, debouncedSearch, filters.status, filters.lead_type, filters.source, filters.assigned_employee_id, sortConfig.key, sortConfig.direction];
  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: leadsQueryKey,
    queryFn: () => leadApi.list({
      page,
      limit: itemsPerPage,
      search: debouncedSearch,
      status: filters.status,
      lead_type: filters.lead_type,
      source: filters.source,
      assigned_employee_id: filters.assigned_employee_id,
      sort: sortConfig.key || "",
      order: sortConfig.direction,
      locale,
    }),
    retry: false,
  });
  const { data: employeeData } = useQuery({ queryKey: ["lead-list-employees"], queryFn: () => employeeApi.getAll() });
  const employees = Array.isArray(employeeData) ? employeeData : employeeData?.data || employeeData?.items || [];
  const leads = Array.isArray(data?.data) ? data.data : [];
  const stats = data?.stats || {};
  const pagination = data?.pagination || { total: 0, page, limit: itemsPerPage, pages: 1, hasNext: false, hasPrev: false };
  const leadsAlreadyTranslated = locale === "en" || (leads.length > 0 && leads.every((lead) => ["name", "company_name"].every((field) => !lead[field]?.trim() || lead.translations?.[field]?.[locale]?.trim())));
  const leadTranslationsReady = usePageTranslations({ model: "Lead", records: leads, locale, ready: !isFetching && pagination.page === page, queryKey: leadsQueryKey, queryClient: qc, alreadyTranslated: leadsAlreadyTranslated, fallbackAfterRetries: true });
  const leadTranslationFields = leads.flatMap((lead) => ["name", "company_name"].filter((field) => lead[field]?.trim()).map((field) => Boolean(lead.translations?.[field]?.[locale]?.trim())));
  const untranslatedLeadFieldCount = leadTranslationFields.filter((translated) => !translated).length;
  const showLeadTranslationSkeletons = locale !== "en" && leadTranslationFields.length > 0 && untranslatedLeadFieldCount / leadTranslationFields.length >= 0.8 && !leadTranslationsReady;

  // ✅ Brand pagination jaisa number formatting (locale-aware, no grouping)
  const intlLocale = (locale = "en") => locale === "ur" ? "ur-PK" : locale === "ar" ? "ar" : locale === "hi" ? "hi-IN" : locale === "en" ? "en-PK" : locale;
  const pageFormatter = useMemo(() => new Intl.NumberFormat(intlLocale(locale), { useGrouping: false }), [locale]);
  const formatPageNumber = (value) => pageFormatter.format(value);

  const total = pagination.total || 0;
  const totalPages = pagination.pages || 1;
  const displayedPage = pagination.page || page;
  const rowLimit = pagination.limit || itemsPerPage;
  const startIndex = total > 0 ? (displayedPage - 1) * rowLimit + 1 : 0;
  const endIndex = Math.min(displayedPage * rowLimit, total);

  const renderPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      if (displayedPage <= 3) pages.push(1, 2, 3, 4, "...", totalPages);
      else if (displayedPage >= totalPages - 2) pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      else pages.push(1, "...", displayedPage - 1, displayedPage, displayedPage + 1, "...", totalPages);
    }
    return pages;
  };

  const goToPage = (target) => {
    const n = Number(target);
    if (Number.isFinite(n) && n >= 1 && n <= totalPages && n !== displayedPage) {
      setPage(n);
    }
  };
  const saveMutation = useMutation({ mutationFn: (payload) => editingId ? leadApi.update(editingId, payload) : leadApi.create(payload), onSuccess: () => { toast.success(t(editingId ? "admin.leads.toast.updated" : "admin.leads.toast.created")); setFormOpen(false); setForm(emptyForm); setEditingId(null); qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["lead"] }); }, onError: (e) => toast.error(e?.response?.data?.message || e.message || t("admin.leads.toast.saveFailed")) });
  const statusMutation = useMutation({ mutationFn: ({ id, payload }) => leadApi.updateStatus(id, payload), onSuccess: () => { toast.success(t("admin.leads.toast.statusUpdated")); setLostReasonLead(null); setLostReason(""); qc.invalidateQueries({ queryKey: ["leads"] }); }, onError: (e) => toast.error(e?.response?.data?.message || t("admin.leads.toast.statusFailed")) });
  const convertCustomerMutation = useMutation({ mutationFn: addLeadAsCustomer, onSuccess: ({ alreadyExists }) => { toast.success(t(alreadyExists ? "admin.leads.toast.customerUpdated" : "admin.leads.toast.addedToCustomers")); qc.invalidateQueries({ queryKey: ["leads"] }); qc.invalidateQueries({ queryKey: ["customers-admin"] }); }, onError: (e) => toast.error(e?.response?.data?.message || t("admin.leads.toast.addCustomerFailed")) });
  const openCreate = () => { setEditingId(null); setForm(emptyForm); setFormOpen(true); };
  const openEdit = (lead) => { setEditingId(lead._id); setForm({ ...emptyForm, ...lead, phone: String(lead.phone || "").replace(/\D/g, "").slice(0, 15), category_id: lead.category_id?._id || lead.category_id || "", assigned_employee_id: lead.assigned_employee_id?._id || lead.assigned_employee_id || "", expected_purchase_date: lead.expected_purchase_date?.slice(0, 10) || "", next_follow_up_date: lead.next_follow_up_date?.slice(0, 10) || "", products: (lead.products || []).map((p) => ({ product_id: p.product_id?._id || p.product_id, variant_id: p.variant_id?._id || p.variant_id || "", quantity: p.quantity })) }); setFormOpen(true); };
  const save = (event) => { event.preventDefault(); const payload = { ...form, category_id: form.category_id || null, estimated_deal_value: form.estimated_deal_value === "" ? null : Number(form.estimated_deal_value), assigned_employee_id: form.assigned_employee_id || null, next_follow_up_date: form.next_follow_up_date || null, products: form.products.filter((p) => p.product_id).map((p) => ({ ...p, variant_id: p.variant_id || null })) }; if (payload.lead_type === "Individual") { payload.company_name = ""; payload.business_type = ""; payload.business_address = ""; payload.city = ""; } saveMutation.mutate(payload); };
  const clearFilters = () => { setSearch(""); setDebouncedSearch(""); setFilters({ status: "", lead_type: "", source: "", assigned_employee_id: "" }); setPage(1); };
  const changeSearch = (value) => { setSearch(value); };
  const submitLostReason = (event) => { event.preventDefault(); const reason = lostReason.trim(); if (!lostReasonLead || !reason) return; statusMutation.mutate({ id: lostReasonLead._id, payload: { status: "Lost", lost_reason: reason } }); };

  return <div dir={dir} className="admin-leads-page space-y-4 pb-6 text-[var(--text-primary)]">
    <AdminPageHeader title={t("admin.leads.title")} subtitle={t("admin.leads.subtitle")} actions={<button type="button" onClick={openCreate} className="inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition hover:opacity-90" style={{ backgroundColor: "var(--accent)", color: "var(--accent-text)" }}><Plus size={15} /> {t("admin.leads.add")}</button>} />
    <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4" aria-label={t("admin.leads.statistics")}>
      <Stat label={t("admin.leads.stats.total")} value={formatPageNumber(stats.total)} />
      <Stat label={t("admin.leads.stats.newThisMonth")} value={formatPageNumber(stats.newThisMonth)} valueColor="var(--success-text)" />
      <Stat label={t("admin.leads.value.qualified")} value={formatPageNumber(stats.qualified)} valueColor="var(--accent)" />
      <Stat label={t("admin.leads.stats.followUpsDue")} value={formatPageNumber(stats.followUpsDue)} valueColor="var(--warning-text)" />
    </section>
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 flex-col items-stretch justify-between gap-3 xl:flex-row xl:items-center xl:gap-4">
        <label className="relative block w-full min-w-0 xl:w-[400px] xl:shrink-0"><Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" /><input value={search} onChange={(e) => changeSearch(e.target.value)} placeholder={t("admin.leads.search.placeholder")} aria-label={t("admin.leads.search.aria")} className="h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] ps-9 pe-3 text-[13px] text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:ring-1 focus:ring-[var(--accent)]/40" /></label>
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 xl:w-auto xl:flex-1 xl:grid-cols-[repeat(4,minmax(120px,140px))] xl:justify-end xl:gap-3">
          <FilterDropdown ariaLabel={t("admin.leads.filters.status")} value={filters.status} onChange={(value) => changeFilter("status", value)} options={[{ value: "", label: t("admin.leads.filters.statusAll") }, ...["New", "Contacted", "Qualified", "Converted", "Lost"].map((value) => ({ value, label: leadValueLabel(value, t) }))]} />
          <FilterDropdown ariaLabel={t("admin.leads.filters.type")} value={filters.lead_type} onChange={(value) => changeFilter("lead_type", value)} options={[{ value: "", label: t("admin.leads.filters.typeAll") }, { value: "Individual", label: leadValueLabel("Individual", t) }, { value: "Business", label: leadValueLabel("Business", t) }]} />
          <FilterDropdown ariaLabel={t("admin.leads.filters.source")} value={filters.source} onChange={(value) => changeFilter("source", value)} options={[{ value: "", label: t("admin.leads.filters.sourceAll") }, ...["Walk-in", "Phone Call", "WhatsApp", "Referral", "Email", "Social Media", "Other"].map((value) => ({ value, label: leadValueLabel(value, t) }))]} />
          <FilterDropdown ariaLabel={t("admin.leads.filters.employee")} value={filters.assigned_employee_id} onChange={(value) => changeFilter("assigned_employee_id", value)} options={[{ value: "", label: t("admin.leads.filters.employeeAll") }, ...employees.filter((emp) => emp.role !== "admin" && !emp.is_deleted).map((emp) => ({ value: emp._id, label: emp.name }))]} />
        </div>
      </div>
      <section className="min-w-0 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)]">
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-start"><thead className="border-b border-[var(--border-color)] bg-[var(--bg-tertiary)] text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]"><tr>
                      <SortHeader label={t("admin.leads.table.lead")} sortKey="lead_number" sortConfig={sortConfig} onSort={handleSort} />
                      <SortHeader label={t("admin.leads.table.typeCompany")} sortKey="name" sortConfig={sortConfig} onSort={handleSort} />
                      <SortHeader label={t("admin.leads.table.phone")} sortKey="phone" sortConfig={sortConfig} onSort={handleSort} />
                      <SortHeader label={t("admin.leads.table.source")} sortKey="source" sortConfig={sortConfig} onSort={handleSort} />
                      <SortHeader label={t("admin.leads.table.assignedTo")} sortKey="assigned" sortConfig={sortConfig} onSort={handleSort} />
                      <SortHeader label={t("admin.leads.table.status")} sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
                      <SortHeader label={t("admin.leads.table.nextFollowUp")} sortKey="followUp" sortConfig={sortConfig} onSort={handleSort} />
                      <SortHeader label={t("admin.leads.table.created")} sortKey="created" sortConfig={sortConfig} onSort={handleSort} />
                      <th className="whitespace-nowrap px-4 py-3 text-start"></th>
                    </tr></thead><tbody>
        {isLoading ? <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-[var(--text-muted)]">{t("admin.leads.loading")}</td></tr> : isError ? <tr><td colSpan={9} className="px-3 py-10 text-center text-sm text-[var(--danger-text)]">{error?.response?.data?.message || t("admin.leads.loadFailed")}<button onClick={() => qc.invalidateQueries({ queryKey: ["leads"] })} className="ms-2 underline">{t("common.retry")}</button></td></tr> : !leads.length ? <tr><td colSpan={9} className="px-3 py-12"><div className="flex flex-col items-center justify-center text-center"><span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]"><Users size={18} /></span><p className="text-xs font-semibold">{search || Object.values(filters).some(Boolean) ? t("admin.leads.empty.searchTitle") : t("admin.leads.empty.title")}</p><p className="mt-1 text-[10px] text-[var(--text-muted)]">{search || Object.values(filters).some(Boolean) ? t("admin.leads.empty.searchDescription") : t("admin.leads.empty.description")}</p><button type="button" onClick={search || Object.values(filters).some(Boolean) ? clearFilters : openCreate} className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3 text-[10px] font-semibold text-[var(--accent)] transition-all hover:-translate-y-0.5 hover:shadow-md">{search || Object.values(filters).some(Boolean) ? <><X size={12} /> {t("admin.leads.filters.clear")}</> : <><Plus size={12} /> {t("admin.leads.add")}</>}</button></div></td></tr> : leads.map((lead) => <tr key={lead._id} onClick={() => router.push(`/admin/leads/${lead._id}`)} className="cursor-pointer border-b border-[var(--border-color)] transition-colors duration-150 hover:bg-[var(--bg-row-hover)]"><td className="px-4 py-2.5"><p className="text-xs font-semibold">{showLeadTranslationSkeletons && lead.name?.trim() && !lead.translations?.name?.[locale]?.trim() ? <span className="inline-block h-3 w-24 rounded bg-[var(--bg-tertiary)] animate-pulse align-middle" aria-busy="true" /> : localizedStrictField(lead.name, lead.translations?.name, locale)}</p><p className="mt-0.5 text-[10px] text-[var(--text-muted)]">{lead.lead_number}</p></td><td className="px-4 py-2.5 text-xs">{leadValueLabel(lead.lead_type, t)}<span className="block max-w-32 truncate text-[10px] text-[var(--text-muted)]">{showLeadTranslationSkeletons && lead.company_name?.trim() && !lead.translations?.company_name?.[locale]?.trim() ? <span className="inline-block h-2.5 w-20 rounded bg-[var(--bg-tertiary)] animate-pulse align-middle" aria-busy="true" /> : localizedStrictField(lead.company_name, lead.translations?.company_name, locale) || t("common.notProvided")}</span></td><td className="px-4 py-2.5 text-xs">{lead.phone}<span className="block max-w-36 truncate text-[10px] text-[var(--text-muted)]">{lead.email || ""}</span></td><td className="px-4 py-2.5 text-xs">{leadValueLabel(lead.source, t)}</td><td className="px-4 py-2.5 text-xs">{lead.assigned_employee_id?.name || t("admin.leads.value.unassigned")}</td><td className="px-4 py-2.5"><span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone[lead.status] || statusTone.New}`}>{leadValueLabel(lead.status, t)}</span></td><td className="px-4 py-2.5 text-xs">{date(lead.next_follow_up_date, locale, t)}</td><td className="px-4 py-2.5 text-xs">{date(lead.created_at, locale, t)}</td><td className="w-12 whitespace-nowrap px-4 py-2.5 text-end" onClick={(e) => e.stopPropagation()}><div className="flex justify-end"><RowActions lead={lead} onView={() => router.push(`/admin/leads/${lead._id}`)} onEdit={() => openEdit(lead)} onStatusChange={(status) => { if (status === "Lost") { setLostReasonLead(lead); setLostReason(""); return; } statusMutation.mutate({ id: lead._id, payload: { status } }); }} onAddCustomer={() => convertCustomerMutation.mutate(lead)} isConvertingCustomer={convertCustomerMutation.isPending && convertCustomerMutation.variables?._id === lead._id} /></div></td></tr>)}</tbody></table></div>
      {total > 10 && (
        <footer className="flex flex-col xl:flex-row items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-[13px] text-[var(--text-muted)]">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <span>
              {t("admin.leads.pagination.showing", { from: formatPageNumber(startIndex), to: formatPageNumber(endIndex), total: formatPageNumber(total) })}
              {isFetching && !isLoading ? <span className="ms-2" style={{ color: "var(--accent)" }}>{t("admin.categories.page.updating")}</span> : null}
            </span>
            <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              <span>{t("admin.shared.pagination.rowsPerPage")}</span>
              <select
                value={itemsPerPage}
                onChange={(event) => { setItemsPerPage(Number(event.target.value)); setPage(1); }}
                className="h-8 w-[100px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-2 text-[13px] text-[var(--text-primary)] outline-none cursor-pointer"
              >
                {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{formatPageNumber(size)}</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => goToPage(displayedPage - 1)} disabled={displayedPage <= 1 || isFetching} aria-label={t("admin.shared.pagination.prev")} title={t("admin.shared.pagination.prev")} className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] transition hover:bg-[var(--bg-row-hover)] disabled:opacity-40" style={{ color: "var(--text-primary)" }}><ChevronLeft size={14} /></button>
            <span className="hidden sm:inline-flex items-center gap-1">
              {renderPageNumbers().map((pg, index) => (
                <Fragment key={index}>
                  {pg === "..." ? <span className="px-2 text-sm" style={{ color: "var(--text-muted)" }}>...</span> : (
                    <button onClick={() => goToPage(pg)} disabled={isFetching && displayedPage !== pg} aria-label={t("admin.brands.ui.goToPage", { page: formatPageNumber(pg) })} aria-current={displayedPage === pg ? "page" : undefined} className={`h-8 min-w-[32px] px-2 rounded-md text-[13px] font-bold transition hover:bg-[var(--bg-row-hover)] ${displayedPage === pg ? "bg-[var(--accent)] text-[var(--accent-text)]" : "bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-color)]"}`}>{formatPageNumber(pg)}</button>
                  )}
                </Fragment>
              ))}
            </span>
            <span className="sm:hidden text-xs whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>
              {t("admin.shared.pagination.pageOf", { page: formatPageNumber(displayedPage), total: formatPageNumber(totalPages) })}
            </span>
            <button onClick={() => goToPage(displayedPage + 1)} disabled={displayedPage >= totalPages || isFetching} aria-label={t("admin.shared.pagination.next")} title={t("admin.shared.pagination.next")} className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border-color)] bg-[var(--bg-card)] transition hover:bg-[var(--bg-row-hover)] disabled:opacity-40" style={{ color: "var(--text-primary)" }}><ChevronRight size={14} /></button>
          </div>
        </footer>
      )}
      {leads.length > 0 && total <= 10 && (
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {t("admin.shared.pagination.showingCount", { count: formatPageNumber(leads.length), total: formatPageNumber(total) })}
          {isFetching && !isLoading ? <span className="ms-2" style={{ color: "var(--accent)" }}>{t("admin.categories.page.updating")}</span> : null}
        </p>
      )}
      </section>
    </div><LeadFormModal open={formOpen} form={form} setForm={setForm} editing={!!editingId} isPending={saveMutation.isPending} onSave={save} onClose={() => setFormOpen(false)} />
    {lostReasonLead && <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !statusMutation.isPending) setLostReasonLead(null); }}><form onSubmit={submitLostReason} className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-2xl"><div className="mb-4"><h2 className="text-base font-bold text-[var(--text-primary)]">{t("admin.leads.lost.title")}</h2><p className="mt-1 text-xs text-[var(--text-muted)]">{t("admin.leads.lost.description", { name: lostReasonLead.name })}</p></div><label className="block text-xs font-semibold text-[var(--text-secondary)]">{t("admin.leads.lost.reason")} <span className="text-[var(--danger-text)]">*</span><textarea autoFocus required maxLength={1000} value={lostReason} onChange={(event) => setLostReason(event.target.value)} placeholder={t("admin.leads.lost.placeholder")} rows={4} className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={statusMutation.isPending} onClick={() => setLostReasonLead(null)} className="h-9 rounded-xl border border-[var(--border-color)] px-4 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-50">{t("common.cancel")}</button><button type="submit" disabled={!lostReason.trim() || statusMutation.isPending} className="h-9 rounded-xl bg-red-600 px-4 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50">{statusMutation.isPending ? t("admin.leads.modal.saving") : t("admin.leads.lost.confirm")}</button></div></form></div>}
  </div>;
}

function Stat({ label, value, valueColor }) { return <article className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-3 sm:p-4"><p className="truncate text-[11px] font-medium text-[var(--text-muted)] sm:text-xs">{label}</p><p className="mt-1 truncate text-lg font-bold leading-tight sm:text-xl" style={{ color: valueColor || "var(--text-primary)" }}>{value}</p></article>; }
function RowActions({ lead, onView, onEdit, onStatusChange, onAddCustomer, onOpenCustomer, isConvertingCustomer }) {
  const { t, dir } = useTranslation();
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const toggle = (event) => {
    event.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuWidth = 176;
    const menuHeight = 180;
    const top = window.innerHeight - rect.bottom < menuHeight + 8
      ? Math.max(8, rect.top - menuHeight - 4)
      : Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 8);
    const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
    const left = dir === "rtl"
      ? Math.min(Math.max(8, rect.left), maxLeft)
      : Math.min(Math.max(8, rect.right - menuWidth), maxLeft);
    setPosition({ top, left });
    setOpen(true);
  };
  const runAction = (action) => (event) => { event.stopPropagation(); setOpen(false); action(); };

  return <>
    <button ref={buttonRef} type="button" onClick={toggle} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition hover:bg-[var(--bg-row-hover)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]" aria-label={t("admin.leads.actions.for", { name: lead.name })} aria-haspopup="menu" aria-expanded={open}><MoreVertical size={18} /></button>
    {open && createPortal(<div ref={menuRef} role="menu" className="fixed z-[9999] w-44 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] py-1 shadow-md" style={position}>
      <button type="button" role="menuitem" onClick={runAction(onView)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs hover:bg-[var(--bg-tertiary)]"><Eye size={13} /> {t("admin.leads.actions.viewDetails")}</button>
      {lead.status !== "Lost" && lead.status !== "Converted" && <button type="button" role="menuitem" onClick={runAction(onEdit)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs hover:bg-[var(--bg-tertiary)]"><Pencil size={13} /> {t("common.edit")}</button>}
      <div className="my-1 border-t border-[var(--border-color)]" />
      {(nextLeadStatuses[lead.status || "New"] || []).map((status) => <button key={status} type="button" role="menuitem" onClick={runAction(() => onStatusChange(status))} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--bg-tertiary)]"><span>{leadValueLabel(status, t)}</span><ChevronRight size={13} /></button>)}
      {lead.status === "Converted" && <button type="button" role="menuitem" onClick={runAction(() => onStatusChange("Lost"))} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-medium text-[var(--danger-text)] transition hover:bg-[var(--bg-tertiary)]">{leadValueLabel("Lost", t)}</button>}
      {lead.status === "Converted" && !lead.customer_added && <button type="button" role="menuitem" disabled={isConvertingCustomer} onClick={runAction(onAddCustomer)} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--bg-tertiary)] disabled:opacity-60">{isConvertingCustomer ? t("admin.leads.actions.addingCustomer") : t("admin.leads.actions.addAsCustomer")}<ChevronRight size={13} className="ms-auto" /></button>}
      {lead.status !== "Converted" && previousLeadStatus[lead.status] && <button type="button" role="menuitem" onClick={runAction(() => onStatusChange(previousLeadStatus[lead.status]))} className="flex w-full items-center gap-2 px-3 py-2 text-start text-xs text-[var(--danger-text)] transition hover:bg-[var(--bg-tertiary)]"><span>{t("admin.leads.actions.revertTo", { status: leadValueLabel(previousLeadStatus[lead.status], t) })}</span></button>}
    </div>, document.body)}
  </>;
}

function FilterDropdown({ value, options, onChange, ariaLabel }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedOption = options.find((option) => String(option.value) === String(value)) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => { if (!dropdownRef.current?.contains(event.target)) setOpen(false); };
    const closeOnEscape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeOutside); document.removeEventListener("keydown", closeOnEscape); };
  }, [open]);

  return <div className="relative min-w-0" ref={dropdownRef}>
    <button type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-start text-[13px] text-[var(--text-primary)] outline-none transition focus:ring-1 focus:ring-[var(--accent)]/40">
      <span className="min-w-0 flex-1 truncate">{selectedOption?.label || t("admin.leads.ui.selectAnOption")}</span>
      <ChevronDown size={14} className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div className="absolute start-0 top-full z-[70] mt-2 min-w-full overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-1 shadow-md">
      <div role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-y-auto">{options.map((option) => {
        const selected = String(option.value) === String(value);
        return <button key={option.value || "all"} type="button" role="option" aria-selected={selected} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex min-h-9 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-xs transition ${selected ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-card-alt)] hover:text-[var(--text-primary)]"}`}><span className="truncate">{option.label}</span>{selected && <Check size={14} className="shrink-0 text-[var(--accent)]" />}</button>;
      })}</div>
    </div>}
  </div>;
}
