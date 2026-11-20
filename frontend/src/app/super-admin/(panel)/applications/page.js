"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/superadmin/PageHeader";
import StatusBadge from "@/components/superadmin/StatusBadge";
import StatCard from "@/components/superadmin/StatCard";
import ConfirmDialog from "@/components/superadmin/ConfirmDialog";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { Search, ChevronLeft, ChevronRight, Filter, Inbox, ClipboardList, CheckCircle2, XCircle, Eye, Trash2 } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

export default function ApplicationsPage() {
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [debounced, setDebounced] = useState("");
  const [actionError, setActionError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const qc = useQueryClient();

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["superadmin-requests", status, debounced, page],
    queryFn: () => superAdminApi.listRequests({ status, search: debounced, page, limit: 10 }),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const { data: statsData } = useQuery({
    queryKey: ["superadmin-stats"],
    queryFn: superAdminApi.getDashboard,
    retry: 1,
    staleTime: 30000,
  });

  const deleteMut = useMutation({
    mutationFn: (id) => superAdminApi.deleteRequest(id),
    onSuccess: () => {
      setDeleteTarget(null);
      setActionError("");
      qc.invalidateQueries({ queryKey: ["superadmin-requests"] });
    },
    onError: (err) => setActionError(err?.response?.data?.message || "Failed to delete the request."),
  });

  const items = useMemo(() => data?.data?.items || [], [data]);
  const pages = useMemo(() => data?.data?.pages || 1, [data]);
  const total = useMemo(() => data?.data?.total || 0, [data]);

  const totals = statsData?.data?.totals || {};
  const statCards = [
    { label: "Total", value: (totals.pendingApplications ?? 0) + (totals.approvedApplications ?? 0) + (totals.rejectedApplications ?? 0), icon: ClipboardList, tone: "accent" },
    { label: "Pending", value: totals.pendingApplications ?? 0, icon: ClipboardList, tone: "warning" },
    { label: "Approved", value: totals.approvedApplications ?? 0, icon: CheckCircle2, tone: "success" },
    { label: "Rejected", value: totals.rejectedApplications ?? 0, icon: XCircle, tone: "danger" },
  ];

  const isDeletable = (item) => !item.store_id && !item.user_id;

  if (isLoading) return <div className="card p-10 text-center text-sm text-[var(--text-muted)]">Loading…</div>;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Signup Requests"
        description="Approve seller applications to provision their store and account."
        breadcrumbs={[{ label: "Super Admin" }, { label: "Signup Requests" }]}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} loading={!statsData} />
        ))}
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border px-3 py-2.5 text-xs font-semibold"
          style={{ background: "var(--danger-soft)", color: "var(--danger-text)", borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)" }}
        >
          {actionError}
        </div>
      )}

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, email or store..." className="h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] ps-9 pe-3 text-sm outline-none focus:border-[var(--accent)]" aria-label="Search applications" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-[var(--text-muted)]" aria-hidden="true" />
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 text-sm font-semibold text-[var(--text-primary)]" aria-label="Filter by status">
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table min-w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--bg-tertiary)] text-left">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Applicant</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Store</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Email</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Phone</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Submitted</th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isError ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[var(--danger-text)]">Failed to load applications.</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center"><span className="flex flex-col items-center gap-2 text-sm text-[var(--text-muted)]"><Inbox size={22} aria-hidden="true" />No applications match this filter.</span></td></tr>
              ) : items.map((item) => (
                <tr key={item._id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-row-hover)]">
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{item.name}</td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">
                    {item.store_name || <span className="italic text-[var(--text-muted)]">Not finished yet</span>}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{item.email}</td>
                  <td className="px-4 py-3 tabular-nums text-[var(--text-muted)]">{item.phone || "—"}</td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{new Date(item.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><StatusBadge value={item.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/super-admin/applications/${item._id}`}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-card-alt)] px-3 text-[11px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        <Eye size={14} aria-hidden="true" /> Read
                      </Link>
                      {isDeletable(item) && (
                        <button
                          type="button"
                          onClick={() => { setActionError(""); setDeleteTarget(item._id); }}
                          disabled={deleteMut.isPending && deleteTarget === item._id}
                          className="btn-danger h-9 px-3 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 size={14} aria-hidden="true" /> Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border-color)] px-4 py-3">
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">Page {page} of {pages} · {total} total</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-md p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={16} aria-hidden="true" /></button>
              <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="rounded-md p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] disabled:opacity-40" aria-label="Next page"><ChevronRight size={16} aria-hidden="true" /></button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete signup request?"
        message="This permanently deletes the application from the review queue. No store or account was provisioned yet, so nothing else is affected."
        confirmLabel="Delete request"
        confirmTone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteMut.mutate(deleteTarget)}
        loading={deleteMut.isPending}
      />
    </div>
  );
}
