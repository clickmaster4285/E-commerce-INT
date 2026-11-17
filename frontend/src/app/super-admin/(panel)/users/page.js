"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StatusBadge from "@/components/superadmin/StatusBadge";
import ConfirmDialog from "@/components/superadmin/ConfirmDialog";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

const FILTERS = [
  { value: "", label: "All users" },
  { value: "customer", label: "Customers" },
  { value: "seller", label: "Sellers" },
  { value: "blocked", label: "Blocked" },
];

export default function UsersPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const type = filter === "customer" ? "customer" : filter === "seller" ? "seller" : "";
  const queryStatus = filter === "blocked" ? "blocked" : "";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["superadmin-users", type, queryStatus, debounced, page],
    queryFn: () => superAdminApi.listUsers({ type, status: queryStatus, search: debounced, page, limit: 10 }),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const items = data?.data?.items || [];
  const pages = data?.data?.pages || 1;
  const total = data?.data?.total || 0;

  const statusMutation = useMutation({
    mutationFn: ({ id, to }) => superAdminApi.setUserStatus(id, to),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-users"] }); setTarget(null); },
    onError: () => setTarget(null),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">User Management</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">{total} registered accounts across the platform.</p>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, email or username..." className="h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] pl-9 pr-3 text-sm outline-none" aria-label="Search users" />
        </div>
        <div className="flex gap-2">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" onClick={() => { setFilter(f.value); setPage(1); }} aria-pressed={filter === f.value} className={`h-9 rounded-full px-3.5 text-[11px] font-bold uppercase tracking-wider transition ${filter === f.value ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)]"}`}>{f.label}</button>
          ))}
        </div>
      </div>

      {isError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">Failed to load users.</div>}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table min-w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--bg-tertiary)] text-left">
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Name</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Email</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Type</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Joined</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={6} className="px-4 py-4"><div className="h-4 w-full rounded bg-[var(--bg-tertiary)]" /></td></tr>)
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">No users found.</td></tr>
              ) : items.map((u) => (
                <tr key={u.id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-row-hover)]">
                  <td className="px-4 py-3 font-semibold text-[var(--text-primary)]">{u.name}<br /><span className="text-[10px] font-mono text-[var(--text-muted)]">@{u.username}</span></td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{u.email}</td>
                  <td className="px-4 py-3"><StatusBadge value={u.type === "Seller" ? "seller" : "customer"} /></td>
                  <td className="px-4 py-3"><StatusBadge value={u.status} /></td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{new Date(u.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {u.status === "blocked" ? (
                      <button type="button" onClick={() => setTarget({ id: u.id, name: u.name, action: "unblock" })} className="text-[11px] font-bold text-emerald-600 hover:underline">Unblock</button>
                    ) : (
                      <button type="button" onClick={() => setTarget({ id: u.id, name: u.name, action: "block" })} className="text-[11px] font-bold text-red-600 hover:underline">Block</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-[var(--border-color)] px-4 py-3">
            <span className="text-[11px] font-semibold text-[var(--text-muted)]">{page} of {pages}</span>
            <div className="flex gap-1">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} aria-label="Next page"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!target}
        title={target ? `${target.action === "block" ? "Block" : "Unblock"} ${target.name}?` : ""}
        message={target ? (target.action === "block" ? "The account will not be able to sign in until unblocked." : "The account will be able to sign in again.") : ""}
        confirmLabel={target?.action === "block" ? "Block account" : "Unblock"}
        confirmTone={target?.action === "block" ? "danger" : "success"}
        loading={statusMutation.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={() => statusMutation.mutate({ id: target.id, to: target.action === "block" ? "blocked" : "active" })}
      />
    </div>
  );
}
