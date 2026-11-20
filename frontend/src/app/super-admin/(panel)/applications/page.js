"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, Eye, Pencil, Trash2, MapPin, Loader2 } from "lucide-react";
import { PageHeader, Card, CardToolbar, Tabs, SearchInput, DataTable, EntityCell, Pagination, Avatar, StatusBadge, Alert, DropdownMenu, ConfirmDialog } from "@/components/superadmin/ui";
import EditRequestDialog from "@/components/superadmin/EditRequestDialog";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate, timeAgo, assetUrl } from "@/lib/superadminFormat";

const TABS = [
  { value: "pending", label: "Pending", countKey: "pending" },
  { value: "approved", label: "Approved", countKey: "approved" },
  { value: "rejected", label: "Rejected", countKey: "rejected" },
  { value: "", label: "All", countKey: "all" },
];
const PAGE_SIZE = 20;

export default function ApplicationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState(null); // { tone, text }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
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
      qc.invalidateQueries({ queryKey: ["superadmin-dashboard"] });
    },
    onError: (err) => {
      setDeleteTarget(null);
      setNotice({ tone: "danger", text: err?.response?.data?.message || "Failed to delete the request." });
    },
  });

  const items = useMemo(() => data?.data?.items || [], [data]);
  const pages = data?.data?.pages || 1;
  const total = data?.data?.total || 0;
  const counts = data?.data?.counts || {};

  const columns = [
    { key: "seller", header: "Seller", cell: (r) => <EntityCell avatar={<Avatar name={r.name} />} primary={r.name} secondary={r.email} /> },
    { key: "store", header: "Store", cell: (r) => <EntityCell avatar={<Avatar name={r.store_name} shape="square" src={r.logo?.img_url ? assetUrl(r.logo.img_url) : undefined} />} primary={r.store_name || "—"} secondary={r.business_category || "No category"} maxWidth={220} /> },
    {
      key: "location", header: "Location", className: "whitespace-nowrap",
      cell: (r) => (r.city || r.country ? <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-[var(--text-muted)]" aria-hidden="true" />{[r.city, r.country].filter(Boolean).join(", ")}</span> : <span className="text-[var(--text-muted)]">—</span>),
    },
    {
      key: "created", header: "Submitted", className: "whitespace-nowrap",
      cell: (r) => (<><p className="font-medium text-[var(--text-primary)]">{formatDate(r.created_at)}</p><p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{timeAgo(r.created_at)}</p></>),
    },
    { key: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, align: "end", width: 56, stopRowClick: true,
      cell: (r) => (
        <DropdownMenu
          label={`Actions for ${r.name}`}
          items={[
            { label: "View request", icon: Eye, href: `/super-admin/applications/${r._id}` },
            { label: "Edit details", icon: Pencil, disabled: r.status !== "pending", hint: "Only pending requests can be edited", onClick: () => setEditTarget(r) },
            { separator: true },
            { label: "Delete request", icon: Trash2, tone: "danger", disabled: r.status === "approved", hint: "Approved sellers are managed from Stores", onClick: () => { setNotice(null); setDeleteTarget(r); } },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Signup Requests" description="Review new seller applications and decide who can open a store." />

      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

      <Card>
        <Tabs
          label="Filter by status"
          value={status}
          onChange={(v) => { setStatus(v); setPage(1); }}
          items={TABS.map((t) => ({ value: t.value, label: t.label, count: counts[t.countKey] }))}
        />
        <CardToolbar>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name, email, store, phone or city…" label="Search signup requests" />
          <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} aria-label="Sort" className="sa-input w-auto font-medium">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          {isFetching && !isLoading && <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" aria-label="Refreshing" />}
        </CardToolbar>

        <DataTable
          columns={columns}
          rows={items}
          loading={isLoading}
          error={isError ? { title: "Couldn't load signup requests", description: "Check your connection and try again.", action: <button type="button" className="sa-btn sa-btn--secondary sa-btn--sm" onClick={() => refetch()}>Retry</button> } : null}
          empty={{ icon: Inbox, title: debounced ? "No requests match your search" : status === "pending" ? "You're all caught up" : "No signup requests here", description: debounced ? "Try a different name, email or store." : status === "pending" ? "New seller applications will appear here as they come in." : undefined }}
          onRowClick={(r) => router.push(`/super-admin/applications/${r._id}`)}
        />
        <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onChange={setPage} itemLabel="requests" />
      </Card>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this signup request?"
        message={deleteTarget ? `“${deleteTarget.store_name}” by ${deleteTarget.name} will be removed permanently, together with the unused store and the seller's pending login. ${deleteTarget.email} will be able to sign up again.` : ""}
        confirmLabel="Delete request"
        confirmTone="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteMut.mutate(deleteTarget._id)}
        loading={deleteMut.isPending}
      />

      {editTarget && <EditRequestDialog item={editTarget} onClose={() => setEditTarget(null)} onSaved={(res) => setNotice({ tone: "success", text: res?.message || "Request updated." })} />}
    </div>
  );
}
