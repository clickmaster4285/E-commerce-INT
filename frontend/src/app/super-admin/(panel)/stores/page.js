"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Store as StoreIcon, Plus, Pencil, Trash2, ExternalLink, Ban, CircleCheck, Loader2, LayoutDashboard, UserCog } from "lucide-react";
import { PageHeader, Card, CardToolbar, Tabs, SearchInput, DataTable, EntityCell, Pagination, Avatar, StatusBadge, Alert, Button, DropdownMenu, ConfirmDialog } from "@/components/superadmin/ui";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate, timeAgo, assetUrl } from "@/lib/superadminFormat";
import { storeUrl } from "@/lib/tenantHost";
import useOpenStoreAdmin from "@/components/superadmin/useOpenStoreAdmin";
import StoreFormDialog from "@/components/superadmin/StoreFormDialog";

// Storefront / admin links subdomain se banao (same helper jo handoff use karta hai) — backend `url` sirf fallback
const storefrontUrl = (s, path = "/") => (s.subdomain ? storeUrl(s.subdomain, path) : s.url ? `${s.url}${path === "/" ? "" : path}` : null);
const hostOf = (url) => (url ? url.replace(/^https?:\/\//, "").replace(/\/$/, "") : "");

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "maintenance", label: "Maintenance" },
  { value: "closed", label: "Suspended" },
];
const PAGE_SIZE = 20;

export default function StoresPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [formStore, setFormStore] = useState(null); // "new" | store
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [notice, setNotice] = useState(null);
  const { openStoreAdmin } = useOpenStoreAdmin({ onError: (text) => setNotice({ tone: "danger", text }) });

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["superadmin-stores", status, debounced, page],
    queryFn: () => superAdminApi.listStores({ status, search: debounced, page, limit: PAGE_SIZE }),
    retry: 1,
    placeholderData: (prev) => prev,
  });
  const items = data?.data?.items || [];
  const pages = data?.data?.pages || 1;
  const total = data?.data?.total || 0;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["superadmin-stores"] });
    qc.invalidateQueries({ queryKey: ["superadmin-dashboard"] });
  };
  const onError = (fallback) => (err) => { setNotice({ tone: "danger", text: err?.response?.data?.message || fallback }); setDeleteTarget(null); setStatusTarget(null); };

  const statusMutation = useMutation({
    mutationFn: ({ id, status: next }) => superAdminApi.setStoreStatus(id, next),
    onSuccess: (res, vars) => { invalidate(); setStatusTarget(null); setNotice({ tone: "success", text: res?.message || (vars.status === "open" ? "Store activated." : "Store suspended.") }); },
    onError: onError("Could not update the store status."),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => superAdminApi.deleteStore(id),
    onSuccess: (res) => { invalidate(); setDeleteTarget(null); setNotice({ tone: "success", text: res?.message || "Store deleted." }); },
    onError: onError("Could not delete the store."),
  });

  const columns = [
    { key: "store", header: "Store", cell: (s) => <EntityCell avatar={<Avatar name={s.store_name} shape="square" src={s.logo_url ? assetUrl(s.logo_url) : undefined} />} primary={s.store_name} secondary={hostOf(storefrontUrl(s)) || s.business_category || "No subdomain yet"} maxWidth={320} /> },
    { key: "owner", header: "Owner", cell: (s) => s.owner_name ? <EntityCell avatar={<Avatar name={s.owner_name} size="sm" />} primary={s.owner_name} secondary={s.owner_email} maxWidth={260} /> : <span className="text-[var(--text-muted)]">No owner</span> },
    { key: "created", header: "Created", className: "whitespace-nowrap", cell: (s) => (<><p className="font-medium text-[var(--text-primary)]">{formatDate(s.createdAt)}</p><p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{timeAgo(s.createdAt)}</p></>) },
    { key: "status", header: "Status", cell: (s) => <StatusBadge value={s.status} /> },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, align: "end", width: 56,
      cell: (s) => (
        <DropdownMenu
          label={`Actions for ${s.store_name}`}
          items={[
            { label: "Visit storefront", icon: ExternalLink, href: storefrontUrl(s), external: true, disabled: !storefrontUrl(s), hint: "This store has no subdomain yet" },
            { label: "Open admin panel", icon: LayoutDashboard, onClick: () => openStoreAdmin(s.id), disabled: !storefrontUrl(s), hint: "This store has no subdomain yet" },
            { separator: true },
            { label: "Manage owner", icon: UserCog, href: s.owner_id ? `/super-admin/users/${s.owner_id}` : undefined, disabled: !s.owner_id, hint: "This store has no owner account" },
            { label: "Edit store", icon: Pencil, onClick: () => setFormStore(s) },
            s.status === "closed"
              ? { label: "Activate store", icon: CircleCheck, onClick: () => setStatusTarget({ ...s, next: "open" }) }
              : { label: "Suspend store", icon: Ban, onClick: () => setStatusTarget({ ...s, next: "closed" }) },
            { separator: true },
            { label: "Delete store", icon: Trash2, tone: "danger", onClick: () => setDeleteTarget(s) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stores"
        description={isLoading ? "Every storefront on the platform." : `${total.toLocaleString()} storefront${total === 1 ? "" : "s"} on the platform.`}
        actions={<Button variant="primary" icon={Plus} href="/super-admin/stores/new">Add store</Button>}
      />

      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

      <Card>
        <Tabs label="Filter by status" value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={STATUS_TABS} />
        <CardToolbar>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by store name or email…" label="Search stores" />
          {isFetching && !isLoading && <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" aria-label="Refreshing" />}
        </CardToolbar>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(s) => s.id}
          loading={isLoading}
          error={isError ? { title: "Couldn't load stores", action: <Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button> } : null}
          empty={{ icon: StoreIcon, title: debounced ? "No stores match your search" : "No stores yet", description: debounced ? "Try a different store name or email." : "Approve a seller request or add a store manually.", action: !debounced && <Button size="sm" variant="primary" icon={Plus} href="/super-admin/stores/new">Add store</Button> }}
        />
        <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onChange={setPage} itemLabel="stores" />
      </Card>

      {formStore && <StoreFormDialog store={formStore === "new" ? null : formStore} onClose={() => setFormStore(null)} onSaved={(res) => { invalidate(); setFormStore(null); setNotice({ tone: "success", text: res?.message || "Store saved." }); }} />}

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget ? `${statusTarget.next === "open" ? "Activate" : "Suspend"} ${statusTarget.store_name}?` : ""}
        message={statusTarget?.next === "open" ? "The storefront goes back online and the seller can sign in again." : "The storefront goes offline and the seller is locked out until you activate it again."}
        confirmLabel={statusTarget?.next === "open" ? "Activate store" : "Suspend store"}
        confirmTone={statusTarget?.next === "open" ? "success" : "danger"}
        loading={statusMutation.isPending}
        onCancel={() => setStatusTarget(null)}
        onConfirm={() => statusMutation.mutate({ id: statusTarget.id, status: statusTarget.next })}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Delete ${deleteTarget.store_name}?` : ""}
        message="This permanently removes the storefront and deactivates its linked seller accounts. This cannot be undone."
        confirmLabel="Delete store"
        confirmTone="danger"
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
