"use client";

/* ==========================================================
   ADMIN · CONTACT MESSAGES (/admin/messages)
   Store editor ke "Contact form" section se aaye messages.
   Kholne par "read", archive / delete, reply = mailto.
   ========================================================== */

import { useDeferredValue, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, ChevronDown, Inbox, Loader2, Mail, Phone, Reply, Trash2 } from "lucide-react";
import { contactApi } from "@/apis/admin/contactApi";

const TABS = [
  { id: "new", label: "New" },
  { id: "read", label: "Read" },
  { id: "archived", label: "Archived" },
  { id: "all", label: "All" },
];

const errMsg = (e) => e?.response?.data?.message || e?.message || "Request failed";

export default function MessagesPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("new");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const deferredSearch = useDeferredValue(search.trim());

  const query = useQuery({
    queryKey: ["contactMessages", { status, page, search: deferredSearch }],
    queryFn: () => contactApi.list({ status, page, search: deferredSearch }),
    placeholderData: keepPreviousData,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["contactMessages"] });
  const statusMutation = useMutation({
    mutationFn: ({ id, next }) => contactApi.setStatus(id, next),
    onSuccess: refresh,
    onError: (e) => toast.error(errMsg(e)),
  });
  const removeMutation = useMutation({
    mutationFn: contactApi.remove,
    onSuccess: () => {
      refresh();
      toast.success("Message deleted");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const items = query.data?.data || [];
  const pagination = query.data?.pagination;

  const toggleOpen = (m) => {
    const next = openId === m._id ? null : m._id;
    setOpenId(next);
    if (next && m.status === "new") statusMutation.mutate({ id: m._id, next: "read" });
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold text-fg">Messages</h1>
        <p className="text-sm text-fg-muted">
          From the contact form on your store
          {query.data?.counts ? ` · ${query.data.counts.unread} new` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-subtle p-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatus(tab.id);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition ${status === tab.id ? "bg-card text-fg shadow-sm" : "text-fg-muted hover:text-fg"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search name, email or text…"
          className="h-9 w-full max-w-xs rounded-lg border border-line bg-input px-3 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent"
        />
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
            <Inbox size={22} />
            No messages here. Add a Contact form section in the store editor to receive messages.
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((m) => {
              const open = openId === m._id;
              return (
                <li key={m._id}>
                  <button type="button" onClick={() => toggleOpen(m)} className="flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-row-hover">
                    {m.status === "new" ? <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="New" /> : <span className="h-2 w-2 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm ${m.status === "new" ? "font-bold text-fg" : "font-medium text-fg-secondary"}`}>
                        {m.name} <span className="font-normal text-fg-muted">· {m.email}</span>
                      </p>
                      <p className="truncate text-xs text-fg-muted">{m.message}</p>
                    </div>
                    <span className="shrink-0 text-xs text-fg-muted">{new Date(m.createdAt).toLocaleDateString()}</span>
                    <ChevronDown size={15} className={`shrink-0 text-fg-muted transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open ? (
                    <div className="space-y-3 border-t border-line bg-card-alt px-4 py-4 sm:ps-9">
                      <p className="whitespace-pre-line text-sm leading-relaxed text-fg">{m.message}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                        <span className="inline-flex items-center gap-1">
                          <Mail size={12} /> {m.email}
                        </span>
                        {m.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone size={12} /> {m.phone}
                          </span>
                        ) : null}
                        <span>{new Date(m.createdAt).toLocaleString()}</span>
                        {m.page ? <span>from {m.page}</span> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={`mailto:${m.email}?subject=${encodeURIComponent("Re: your message")}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-fg hover:bg-accent-hover"
                        >
                          <Reply size={13} /> Reply by email
                        </a>
                        <button
                          type="button"
                          onClick={() => statusMutation.mutate({ id: m._id, next: m.status === "archived" ? "read" : "archived" })}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-semibold text-fg-secondary hover:bg-subtle"
                        >
                          <Archive size={13} /> {m.status === "archived" ? "Unarchive" : "Archive"}
                        </button>
                        <button
                          type="button"
                          onClick={() => window.confirm("Delete this message?") && removeMutation.mutate(m._id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-xs font-semibold text-danger hover:bg-danger-soft"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pagination && pagination.pages > 1 ? (
        <div className="flex items-center justify-between text-sm text-fg-muted">
          <span>
            Page {pagination.page} of {pagination.pages}
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
