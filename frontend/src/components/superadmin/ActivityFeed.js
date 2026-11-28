"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, ClipboardList, Store, Users, UserCog, LogIn, LogOut, Settings, Loader2, ArrowUpRight, BadgeDollarSign } from "lucide-react";
import { Card, CardHeader, CardToolbar, SearchInput, Pagination, Badge, Button, EmptyState, Skeleton } from "@/components/superadmin/ui";
import { formatDate, formatTime, formatDateTime, timeAgo } from "@/lib/superadminFormat";

const PAGE_SIZE = 20;
const ENTITY = {
  seller_application: { icon: ClipboardList, href: (id) => `/super-admin/applications/${id}` },
  store: { icon: Store, href: () => "/super-admin/stores" },
  user: { icon: Users, href: null },
  superadmin: { icon: UserCog, href: (id) => `/super-admin/team/${id}` },
  plan: { icon: BadgeDollarSign, href: (id) => `/super-admin/plans/${id}` },
  auth: { icon: LogIn, href: null },
  settings: { icon: Settings, href: null },
  system: { icon: Settings, href: null },
};
// Title se tone — approved/activated green, rejected/removed/blocked red
const titleTone = (title) => (/signed in|logged in/i.test(title) ? "info" : /approved|activated|unblock|added|created|restored/i.test(title) ? "success" : /rejected|removed|deleted|blocked|deactivated|suspend/i.test(title) ? "danger" : /info|request/i.test(title) ? "warning" : "neutral");
const isSignOut = (a) => a.entityType === "auth" && /signed out|logged out/i.test(a.title);

// Din ke hisaab se group — Today / Yesterday / 18 Nov 2026
const dayLabel = (iso) => {
  const d = new Date(iso); const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : formatDate(iso);
};

/**
 * Activity timeline (search + day groups + pagination).
 * `fetcher(params)` → { data: { items, counts, total, pages, stats } }
 * `onStats(stats)` optional — parent stat cards ke liye.
 */
export default function ActivityFeed({ queryKey, fetcher, title, description, who = "you", onStats, className, hideLinks = false }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: [...queryKey, debounced, page],
    queryFn: () => fetcher({ search: debounced, page, limit: PAGE_SIZE }),
    retry: 1,
    placeholderData: (prev) => prev,
    refetchInterval: 5 * 60 * 1000,
  });
  const items = useMemo(() => data?.data?.items || [], [data]);
  const total = data?.data?.total || 0;
  const pages = data?.data?.pages || 1;
  const stats = data?.data?.stats;

  useEffect(() => { if (stats && onStats) onStats(stats); }, [stats, onStats]);

  const groups = useMemo(() => {
    const map = new Map();
    for (const a of items) { const k = dayLabel(a.at); if (!map.has(k)) map.set(k, []); map.get(k).push(a); }
    return [...map.entries()];
  }, [items]);

  const filtered = Boolean(debounced);
  return (
    <Card className={`flex flex-col ${className || ""}`}>
      {title && <CardHeader title={title} description={description} icon={Activity} />}
      <CardToolbar>
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search activity…" label="Search activity" />
        {isFetching && !isLoading && <Loader2 size={16} className="animate-spin text-fg-muted" aria-label="Refreshing" />}
      </CardToolbar>

      {/* List area grows — pagination hamesha neeche */}
      <div className="flex-1">
      {isLoading ? (
        <ul className="divide-y divide-line">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="flex items-start gap-3 px-5 py-3.5"><Skeleton className="h-9 w-9 rounded-lg" /><span className="flex-1 space-y-2"><Skeleton className="h-3.5 w-56" /><Skeleton className="h-3 w-80 max-w-full" /></span><Skeleton className="h-3 w-16" /></li>
          ))}
        </ul>
      ) : isError ? (
        <EmptyState icon={Activity} title="Couldn't load activity" action={<Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Activity}
          title={filtered ? "Nothing matches" : "No activity yet"}
          description={filtered ? "Try a different search." : `Sign-ins, approvals, edits and status changes by ${who} will appear here with the time and details.`}
        />
      ) : (
        <div>
          {groups.map(([day, rows]) => (
            <section key={day}>
              <h3 className="border-y border-line bg-table px-5 py-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted first:border-t-0">{day}</h3>
              <ol className="divide-y divide-line">
                {rows.map((a) => {
                  const meta = ENTITY[a.entityType] || ENTITY.system;
                  const Icon = isSignOut(a) ? LogOut : meta.icon;
                  const href = !hideLinks && meta.href && a.entityId ? meta.href(a.entityId) : null;
                  return (
                    <li key={a.id} className="flex items-start gap-3.5 px-5 py-3.5">
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-subtle text-fg-muted"><Icon size={16} aria-hidden="true" /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-[13.5px] font-semibold leading-5 text-fg">{a.title}</p>
                          <Badge tone={titleTone(a.title)} dot={false}>{a.entityLabel}</Badge>
                        </div>
                        {a.subject && <p className="mt-0.5 text-[13px] text-fg-secondary">{a.subject}</p>}
                        {a.description && <p className="mt-1 text-[12.5px] leading-5 text-fg-muted">{a.description}</p>}
                        {href && (
                          <Link href={href} className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:underline">Open {a.entityLabel.toLowerCase()} <ArrowUpRight size={12} aria-hidden="true" /></Link>
                        )}
                      </div>
                      <div className="shrink-0 text-end" title={formatDateTime(a.at)}>
                        <p className="text-[13px] font-medium tabular-nums text-fg">{formatTime(a.at)}</p>
                        <p className="mt-0.5 text-[12px] text-fg-muted">{timeAgo(a.at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
      </div>
      <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onChange={setPage} itemLabel="entries" />
    </Card>
  );
}
