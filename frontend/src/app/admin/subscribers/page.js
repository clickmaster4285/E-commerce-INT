"use client";

/* ==========================================================
   ADMIN · NEWSLETTER SUBSCRIBERS (/admin/subscribers)
   Store editor ke newsletter section se aaye emails — search,
   status filter, unsubscribe / delete, CSV export.
   ========================================================== */

import { useDeferredValue, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2, Mail, Trash2, UserMinus, UserPlus } from "lucide-react";
import { subscriberApi } from "@/apis/admin/subscriberApi";

const STATUSES = [
  { id: "all", label: "All" },
  { id: "subscribed", label: "Subscribed" },
  { id: "unsubscribed", label: "Unsubscribed" },
];

const errMsg = (e) => e?.response?.data?.message || e?.message || "Request failed";

export default function SubscribersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());

  const query = useQuery({
    queryKey: ["subscribers", { page, status, search: deferredSearch }],
    queryFn: () => subscriberApi.list({ page, status, search: deferredSearch }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["subscribers"] });
  const statusMutation = useMutation({
    mutationFn: ({ id, next }) => subscriberApi.setStatus(id, next),
    onSuccess: refresh,
    onError: (e) => toast.error(errMsg(e)),
  });
  const removeMutation = useMutation({
    mutationFn: subscriberApi.remove,
    onSuccess: () => {
      refresh();
      toast.success("Subscriber deleted");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const items = query.data?.data || [];
  const pagination = query.data?.pagination;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-fg">Subscribers</h1>
          <p className="text-sm text-fg-muted">
            Emails from your storefront newsletter section
            {query.data?.counts ? ` · ${query.data.counts.subscribed} subscribed` : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={exporting}
          onClick={async () => {
            setExporting(true);
            try {
              await subscriberApi.exportCsv({ search: deferredSearch, status });
            } catch (e) {
              toast.error(errMsg(e));
            } finally {
              setExporting(false);
            }
          }}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-card px-4 text-sm font-semibold text-fg-secondary hover:bg-subtle disabled:opacity-50"
        >
          {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search email…"
          className="h-9 w-full max-w-xs rounded-lg border border-line bg-input px-3 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent"
        />
        <div className="flex rounded-lg bg-subtle p-1">
          {STATUSES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setStatus(s.id);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${status === s.id ? "bg-card text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-line-card bg-card">
        {query.isLoading ? (
          <div className="flex justify-center py-12 text-fg-muted">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : query.error ? (
          <p className="py-12 text-center text-sm text-danger">{errMsg(query.error)}</p>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-fg-muted">
            <Mail size={22} />
            No subscribers yet. Add a Newsletter section in the store editor to collect emails.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((s) => (
              <li key={s._id} className="flex items-center gap-3 px-4 py-3 hover:bg-row-hover">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">{s.email}</p>
                  <p className="text-xs text-fg-muted">
                    {new Date(s.createdAt).toLocaleDateString()} · {String(s.locale || "en").toUpperCase()}
                    {s.source === "popup" ? " · via popup" : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    s.status === "subscribed" ? "bg-success-soft text-success" : "bg-subtle text-fg-muted"
                  }`}
                >
                  {s.status === "subscribed" ? "Subscribed" : "Unsubscribed"}
                </span>
                <button
                  type="button"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate({ id: s._id, next: s.status === "subscribed" ? "unsubscribed" : "subscribed" })}
                  className="rounded-md p-1.5 text-fg-muted hover:bg-subtle hover:text-fg"
                  title={s.status === "subscribed" ? "Unsubscribe" : "Resubscribe"}
                >
                  {s.status === "subscribed" ? <UserMinus size={15} /> : <UserPlus size={15} />}
                </button>
                <button
                  type="button"
                  disabled={removeMutation.isPending}
                  onClick={() => window.confirm(`Delete ${s.email}?`) && removeMutation.mutate(s._id)}
                  className="rounded-md p-1.5 text-fg-muted hover:bg-danger-soft hover:text-danger"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pagination && pagination.pages > 1 ? (
        <div className="flex items-center justify-between text-sm text-fg-muted">
          <span>
            Page {pagination.page} of {pagination.pages} · {pagination.total} total
          </span>
          <div className="flex gap-2">
            <button type="button" disabled={!pagination.hasPrev} onClick={() => setPage((p) => p - 1)} className="h-8 rounded-lg border border-line px-3 font-semibold disabled:opacity-40">
              Previous
            </button>
            <button type="button" disabled={!pagination.hasNext} onClick={() => setPage((p) => p + 1)} className="h-8 rounded-lg border border-line px-3 font-semibold disabled:opacity-40">
              Next
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
