"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, UserCog, Store as StoreIcon, LogIn, Settings, ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import AdminPageHeader from "@/components/adminComponents/AdminPageHeader";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

const TYPE_ICONS = { seller_application: StoreIcon, store: StoreIcon, user: UserCog, auth: LogIn, settings: Settings, system: ShieldCheck };
const TYPES = ["", "seller_application", "store", "user", "auth", "settings", "system"];

export default function ActivityPage() {
  const [entityType, setEntityType] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["superadmin-activity", entityType, page],
    queryFn: () => superAdminApi.listActivity({ entityType, page, limit: 20 }),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const items = data?.data?.items || [];
  const pages = data?.data?.pages || 1;

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Activity Logs"
        subtitle="Audit trail of every Super Admin action on the platform."
      />

      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button key={t || "all"} type="button" onClick={() => { setEntityType(t); setPage(1); }} aria-pressed={entityType === t} className={`h-9 rounded-full px-4 text-[12px] font-semibold transition-colors ${entityType === t ? "bg-[var(--accent)] text-[var(--accent-text)]" : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-row-hover)]"}`}>
            {t ? t.replace(/_/g, " ") : "All"}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <ul className="divide-y divide-[var(--border-color)]">
          {isError ? (
            <li role="alert" className="px-6 py-8 text-center text-sm text-[var(--danger-text)]">Failed to load activity logs.</li>
          ) : isLoading ? (
            <li className="px-6 py-10 text-center text-sm text-[var(--text-muted)]">Loading…</li>
          ) : items.length === 0 ? (
            <li className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <ScrollText size={22} className="text-[var(--text-muted)]" aria-hidden="true" />
              <span className="text-sm text-[var(--text-muted)]">No activity recorded yet.</span>
            </li>
          ) : items.map((a) => {
            const Icon = TYPE_ICONS[a.entityType] || ShieldCheck;
            return (
              <li key={a._id} className="flex items-start gap-3 px-5 py-4 hover:bg-[var(--bg-row-hover)]">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-tertiary)] text-[var(--accent)]"><Icon size={17} aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold leading-5 text-[var(--text-primary)]">{a.action}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{a.entityType?.replace(/_/g, " ")} · {a.actor?.name || a.actor?.email || "unknown"} · {new Date(a.created_at).toLocaleString()}</p>
                </div>
              </li>
            );
          })}
        </ul>
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
    </div>
  );
}
