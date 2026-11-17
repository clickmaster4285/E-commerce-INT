"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StatusBadge from "@/components/superadmin/StatusBadge";
import ConfirmDialog from "@/components/superadmin/ConfirmDialog";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { Search, ChevronLeft, ChevronRight, Store as StoreIcon, ExternalLink } from "lucide-react";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "closed", label: "Suspended" },
  { value: "maintenance", label: "Maintenance" },
];

export default function StoresPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["superadmin-stores", status, debounced, page],
    queryFn: () => superAdminApi.listStores({ status, search: debounced, page, limit: 10 }),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const items = data?.data?.items || [];
  const pages = data?.data?.pages || 1;

  const mutation = useMutation({
    mutationFn: ({ id, to }) => superAdminApi.setStoreStatus(id, to),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-stores"] }); setTarget(null); },
    onError: () => setTarget(null),
  });

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Store Management"
        subtitle="Activate, suspend and inspect tenant stores."
      />

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
          <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search store name or email..." className="h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] ps-9 pe-3 text-sm outline-none focus:border-[var(--accent)]" aria-label="Search stores" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 rounded-lg border border-[var(--border-color)] bg-[var(--bg-input)] px-3 text-sm font-semibold text-[var(--text-primary)]" aria-label="Filter by status">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {isError && (
        <div role="alert" className="rounded-lg border px-4 py-2 text-sm font-medium" style={{ background: "var(--danger-soft)", color: "var(--danger-text)", borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)" }}>
          Failed to load stores.
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table min-w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--bg-tertiary)] text-left">
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Store</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Owner</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Created</th>
                <th className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Status</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <tr key={i} className="animate-pulse"><td colSpan={5} className="px-4 py-4"><div className="h-4 w-full rounded bg-[var(--bg-tertiary)]" /></td></tr>)
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-[var(--text-muted)]">No stores found.</td></tr>
              ) : items.map((s) => (
                <tr key={s.id} className="border-t border-[var(--border-color)] hover:bg-[var(--bg-row-hover)]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><StoreIcon size={16} aria-hidden="true" /></span>
                      <a href={s.url} className="inline-flex items-center gap-1 font-bold text-[var(--text-primary)] hover:underline" target="_blank" rel="noreferrer">{s.store_name}<ExternalLink size={12} aria-hidden="true" /></a>
                    </div>
                  </td>
                  <td className="px-4 py-3"><span className="font-semibold text-[var(--text-secondary)]">{s.owner_name}</span><br /><span className="text-[11px] text-[var(--text-muted)]">{s.owner_email}</span></td>
                  <td className="px-4 py-3 text-[var(--text-muted)]">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><StatusBadge value={s.status} /></td>
                  <td className="px-4 py-3 text-right">
                    {s.status === "closed" ? (
                      <button type="button" onClick={() => setTarget({ id: s.id, name: s.store_name, action: "activate" })} className="text-[12px] font-semibold text-[var(--success-text)] hover:underline">Activate</button>
                    ) : (
                      <button type="button" onClick={() => setTarget({ id: s.id, name: s.store_name, action: "suspend" })} className="text-[12px] font-semibold text-[var(--danger-text)] hover:underline">Suspend</button>
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
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} aria-label="Previous page" className="rounded-md p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16} aria-hidden="true" /></button>
              <button type="button" onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} aria-label="Next page" className="rounded-md p-2 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={16} aria-hidden="true" /></button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!target}
        title={target ? (target.action === "suspend" ? `Suspend ${target.name}?` : `Reactivate ${target.name}?`) : ""}
        message={target ? (target.action === "suspend" ? "Seller login will be blocked and the store will be marked closed." : "Seller login will be restored and the store will be marked open.") : ""}
        confirmLabel={target?.action === "suspend" ? "Suspend" : "Reactivate"}
        confirmTone={target?.action === "suspend" ? "danger" : "success"}
        loading={mutation.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={() => mutation.mutate({ id: target.id, to: target.action === "suspend" ? "closed" : "open" })}
      />
    </div>
  );
}
