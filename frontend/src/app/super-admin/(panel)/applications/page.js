"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/superadmin/PageHeader";
import StatusBadge from "@/components/superadmin/StatusBadge";
import ConfirmDialog from "@/components/superadmin/ConfirmDialog";
import EditRequestDialog from "@/components/superadmin/EditRequestDialog";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate, formatTime, timeAgo, initials, assetUrl } from "@/lib/superadminFormat";
import { Search, ChevronLeft, ChevronRight, Inbox, Eye, Pencil, Trash2, MapPin, ArrowDownUp, Loader2 } from "lucide-react";

const TABS = [
  { value: "", label: "All", countKey: "all" },
  { value: "pending", label: "Pending", countKey: "pending" },
  { value: "approved", label: "Approved", countKey: "approved" },
  { value: "rejected", label: "Rejected", countKey: "rejected" },
];
const PAGE_SIZE = 10;

export default function ApplicationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState(null); // { tone: "success" | "error", text }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ["superadmin-requests", status, debounced, sort, page],
    queryFn: () => superAdminApi.listRequests({ status, search: debounced, sort, page, limit: PAGE_SIZE }),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => superAdminApi.deleteRequest(id),
    onSuccess: (res) => {
      setDeleteTarget(null);
      setNotice({ tone: "success", text: res?.message || "Signup request deleted." });
      qc.invalidateQueries({ queryKey: ["superadmin-requests"] });
      qc.invalidateQueries({ queryKey: ["superadmin-stats"] });
    },
    onError: (err) => {
      setDeleteTarget(null);
      setNotice({ tone: "error", text: err?.response?.data?.message || "Failed to delete the request." });
    },
  });

  const items = useMemo(() => data?.data?.items || [], [data]);
  const pages = data?.data?.pages || 1;
  const total = data?.data?.total || 0;
  const counts = data?.data?.counts || {};
  const from = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, total);

  const changeTab = (value) => { setStatus(value); setPage(1); };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Signup Requests"
        description="Review, approve and manage new seller signups."
        breadcrumbs={[{ label: "Super Admin" }, { label: "Signup Requests" }]}
      />

      {notice && (
        <div
          role={notice.tone === "error" ? "alert" : "status"}
          className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-[13px] font-medium"
          style={notice.tone === "error"
            ? { background: "var(--danger-soft)", color: "var(--danger-text)", borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)" }
            : { background: "var(--success-soft, rgba(16,185,129,0.1))", color: "var(--success-text, #047857)", borderColor: "color-mix(in srgb, var(--success, #10b981) 35%, transparent)" }}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-[12px] font-semibold underline-offset-2 hover:underline">Dismiss</button>
        </div>
      )}

      <div className="card overflow-hidden">
        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-[var(--border-color)] px-3 pt-2" role="tablist" aria-label="Filter by status">
          {TABS.map((tab) => {
            const active = status === tab.value;
            return (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => changeTab(tab.value)}
                className={`relative flex shrink-0 items-center gap-2 rounded-t-lg px-3.5 py-2.5 text-[13px] font-semibold transition-colors ${
                  active ? "text-[var(--accent)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.label}
                <span className={`min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-[11px] tabular-nums ${active ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"}`}>
                  {counts[tab.countKey] ?? "–"}
                </span>
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-color)] p-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, email, store, phone or city…"
              className="h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] ps-9 pe-3 text-sm outline-none focus:border-[var(--accent)]"
              aria-label="Search signup requests"
            />
          </div>
          <label className="flex items-center gap-2">
            <ArrowDownUp size={15} className="text-[var(--text-muted)]" aria-hidden="true" />
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="h-10 rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 text-sm font-semibold text-[var(--text-primary)]">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
          {isFetching && !isLoading && <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" aria-label="Refreshing" />}
        </div>

        <div className="overflow-x-auto">
          <table className="admin-table min-w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--bg-tertiary)] text-left">
                {["Seller", "Store", "Location", "Registered", "Status"].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{h}</th>
                ))}
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-t border-[var(--border-color)]">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-4"><span className="block h-3.5 w-24 animate-pulse rounded bg-[var(--bg-tertiary)]" /></td>
                    ))}
                  </tr>
                ))
              ) : isError ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--danger-text)]">Failed to load signup requests. Please refresh.</td></tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center">
                    <span className="flex flex-col items-center gap-2 text-sm text-[var(--text-muted)]">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-tertiary)]"><Inbox size={22} aria-hidden="true" /></span>
                      <span className="font-semibold text-[var(--text-primary)]">No signup requests found</span>
                      <span>{debounced ? "Try a different search term." : "New seller signups will appear here."}</span>
                    </span>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const canDelete = item.status !== "approved";
                  const canEdit = item.status === "pending";
                  return (
                    <tr
                      key={item._id}
                      onClick={() => router.push(`/super-admin/applications/${item._id}`)}
                      className="cursor-pointer border-t border-[var(--border-color)] transition-colors hover:bg-[var(--bg-row-hover)]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[12px] font-bold text-[var(--accent)]">{initials(item.name)}</span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--text-primary)]">{item.name}</p>
                            <p className="truncate text-[12px] text-[var(--text-muted)]">{item.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-alt)] text-[11px] font-bold text-[var(--text-secondary)]">
                            {item.logo?.img_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={assetUrl(item.logo.img_url)} alt="" className="h-full w-full object-contain" />
                            ) : initials(item.store_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="max-w-[200px] truncate font-medium text-[var(--text-primary)]">{item.store_name || "—"}</p>
                            <p className="truncate text-[12px] text-[var(--text-muted)]">{item.business_category || "No category"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">
                        {item.city || item.country ? (
                          <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-[var(--text-muted)]" aria-hidden="true" />{[item.city, item.country].filter(Boolean).join(", ")}</span>
                        ) : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <p className="font-medium text-[var(--text-primary)]" title={new Date(item.created_at).toString()}>{formatDate(item.created_at)}</p>
                        <p className="text-[12px] text-[var(--text-muted)]">{formatTime(item.created_at)} · {timeAgo(item.created_at)}</p>
                      </td>
                      <td className="px-4 py-3"><StatusBadge value={item.status} /></td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/super-admin/applications/${item._id}`}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-card-alt)] px-2.5 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          >
                            <Eye size={14} aria-hidden="true" /> View
                          </Link>
                          <IconAction label="Edit request" disabled={!canEdit} disabledHint="Only pending requests can be edited" onClick={() => setEditTarget(item)}>
                            <Pencil size={15} aria-hidden="true" />
                          </IconAction>
                          <IconAction label="Delete request" tone="danger" disabled={!canDelete} disabledHint="Approved sellers are managed from Store Management" onClick={() => { setNotice(null); setDeleteTarget(item); }}>
                            <Trash2 size={15} aria-hidden="true" />
                          </IconAction>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-color)] px-4 py-3">
            <span className="text-[12px] text-[var(--text-muted)]">
              Showing <strong className="font-semibold text-[var(--text-primary)]">{from}–{to}</strong> of <strong className="font-semibold text-[var(--text-primary)]">{total}</strong>
            </span>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={16} aria-hidden="true" /></button>
              <span className="px-2 text-[12px] font-semibold tabular-nums text-[var(--text-secondary)]">{page} / {pages}</span>
              <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="rounded-md p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40" aria-label="Next page"><ChevronRight size={16} aria-hidden="true" /></button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this signup request?"
        message={deleteTarget
          ? `“${deleteTarget.store_name}” by ${deleteTarget.name} will be removed permanently, together with the unused store and the seller's pending login. ${deleteTarget.email} will be able to sign up again.`
          : ""}
        confirmLabel="Delete request"
        confirmTone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteMut.mutate(deleteTarget._id)}
        loading={deleteMut.isPending}
      />

      {editTarget && (
        <EditRequestDialog
          item={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(res) => setNotice({ tone: "success", text: res?.message || "Request updated." })}
        />
      )}
    </div>
  );
}

function IconAction({ label, tone, disabled, disabledHint, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={disabled ? disabledHint : label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        tone === "danger"
          ? "text-[var(--danger-text)] hover:enabled:border-[var(--danger)]/30 hover:enabled:bg-[var(--danger-soft)]"
          : "text-[var(--text-secondary)] hover:enabled:border-[var(--border-color)] hover:enabled:bg-[var(--bg-tertiary)] hover:enabled:text-[var(--accent)]"
      }`}
    >
      {children}
    </button>
  );
}
