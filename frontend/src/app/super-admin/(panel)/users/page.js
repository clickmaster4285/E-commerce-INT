"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users as UsersIcon, Ban, CircleCheck, Loader2, Eye, ExternalLink, Store as StoreIcon, Phone, Mail, Pencil, Trash2 } from "lucide-react";
import { PageHeader, Card, CardToolbar, Tabs, SearchInput, DataTable, EntityCell, Pagination, Avatar, StatusBadge, Badge, Alert, Button, DropdownMenu, ConfirmDialog } from "@/components/superadmin/ui";
import EditUserDialog from "@/components/superadmin/EditUserDialog";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate, timeAgo } from "@/lib/superadminFormat";

// Users = sirf customers (sellers Stores page par — owner)
const FILTERS = [
  { value: "", label: "All", countKey: "all" },
  { value: "active", label: "Active", countKey: "active" },
  { value: "blocked", label: "Blocked", countKey: "blocked" },
];
const PAGE_SIZE = 20;
const money = (n) => `Rs ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;

export default function UsersPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const [notice, setNotice] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const queryStatus = filter;

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["superadmin-users", queryStatus, debounced, page],
    queryFn: () => superAdminApi.listUsers({ status: queryStatus, search: debounced, page, limit: PAGE_SIZE }),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const items = data?.data?.items || [];
  const pages = data?.data?.pages || 1;
  const total = data?.data?.total || 0;
  const counts = data?.data?.counts || {};

  const statusMutation = useMutation({
    mutationFn: ({ id, to }) => superAdminApi.setUserStatus(id, to),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["superadmin-users"] });
      qc.invalidateQueries({ queryKey: ["superadmin-user", String(vars.id)] });
      setNotice({ tone: "success", text: res?.message || (vars.to === "blocked" ? "Account blocked." : "Account unblocked.") });
      setTarget(null);
    },
    onError: (err) => { setNotice({ tone: "danger", text: err?.response?.data?.message || "Could not update the account." }); setTarget(null); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => superAdminApi.deleteUser(id),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["superadmin-users"] }); setDeleteTarget(null); setNotice({ tone: "success", text: res?.message || "Account deleted." }); },
    onError: (err) => { setDeleteTarget(null); setNotice({ tone: "danger", text: err?.response?.data?.message || "Could not delete the account." }); },
  });

  const columns = [
    {
      key: "user", header: "Customer",
      cell: (u) => <EntityCell avatar={<Avatar name={u.name} />} primary={u.name} secondary={u.username ? `@${u.username}` : null} maxWidth={240} />,
    },
    {
      key: "contact", header: "Contact",
      cell: (u) => (
        <div className="min-w-0 space-y-0.5 text-[12.5px]">
          <p className="flex items-center gap-1.5 truncate text-[var(--text-primary)]"><Mail size={12} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />{u.email}{u.emailVerified && <Badge tone="success" dot={false} className="!h-[18px] !px-1.5 !text-[10px]">Verified</Badge>}</p>
          <p className="flex items-center gap-1.5 text-[var(--text-muted)]"><Phone size={12} className="shrink-0" aria-hidden="true" />{u.phone ? <span className="tabular-nums">{u.phone}</span> : "No phone"}</p>
        </div>
      ),
    },
    {
      // Customer ne kis store par account banaya
      key: "store", header: "Shops at",
      cell: (u) => u.store ? (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><StoreIcon size={14} aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">{u.store.name}</p>
            <p className="truncate text-[12px] text-[var(--text-muted)]">{u.store.subdomain ? `${u.store.subdomain}.…` : "No subdomain"}</p>
          </div>
        </div>
      ) : <span className="text-[var(--text-muted)]">—</span>,
    },
    {
      key: "orders", header: "Orders", className: "whitespace-nowrap",
      cell: (u) => u.orders?.count ? (
        <><p className="font-medium tabular-nums text-[var(--text-primary)]">{u.orders.count} order{u.orders.count === 1 ? "" : "s"}</p><p className="mt-0.5 text-[12px] tabular-nums text-[var(--text-muted)]">{money(u.orders.total)}</p></>
      ) : <span className="text-[var(--text-muted)]">None yet</span>,
    },
    { key: "status", header: "Status", cell: (u) => <StatusBadge value={u.status} /> },
    { key: "joined", header: "Joined", className: "whitespace-nowrap", cell: (u) => (<><p className="font-medium text-[var(--text-primary)]">{formatDate(u.created_at)}</p><p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{timeAgo(u.created_at)}</p></>) },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, align: "end", width: 56, stopRowClick: true,
      cell: (u) => (
        <DropdownMenu
          label={`Actions for ${u.name}`}
          items={[
            { label: "View profile", icon: Eye, href: `/super-admin/users/${u.id}` },
            { label: "Edit details", icon: Pencil, onClick: () => setEditTarget(u) },
            ...(u.store?.url ? [
              { separator: true },
              { label: "Visit store", icon: ExternalLink, href: u.store.url, external: true },
            ] : []),
            { separator: true },
            u.status === "blocked"
              ? { label: "Unblock account", icon: CircleCheck, onClick: () => setTarget({ id: u.id, name: u.name, action: "unblock" }) }
              : { label: "Block account", icon: Ban, onClick: () => setTarget({ id: u.id, name: u.name, action: "block" }) },
            { label: "Delete account", icon: Trash2, tone: "danger", onClick: () => setDeleteTarget(u) },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description={isLoading ? "Customer accounts across every store. Sellers are managed from Stores." : `${total.toLocaleString()} customer${total === 1 ? "" : "s"} across every store · sellers are managed from Stores.`} />

      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

      <Card>
        <Tabs label="Filter users" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} items={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts[f.countKey] }))} />
        <CardToolbar>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name, email or username…" label="Search users" />
          {isFetching && !isLoading && <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" aria-label="Refreshing" />}
        </CardToolbar>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(u) => u.id}
          loading={isLoading}
          onRowClick={(u) => router.push(`/super-admin/users/${u.id}`)}
          error={isError ? { title: "Couldn't load users", action: <Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button> } : null}
          empty={{ icon: UsersIcon, title: debounced ? "No customers match your search" : filter === "blocked" ? "No blocked customers" : "No customers yet", description: debounced ? "Try a different name, email or username." : filter ? undefined : "Customers appear here when they create an account on any store." }}
        />
        <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onChange={setPage} itemLabel="users" />
      </Card>

      <ConfirmDialog
        open={!!target}
        title={target ? `${target.action === "block" ? "Block" : "Unblock"} ${target.name}?` : ""}
        message={target?.action === "block" ? "They won't be able to sign in until you unblock them. Existing orders are not affected." : "They will be able to sign in again right away."}
        confirmLabel={target?.action === "block" ? "Block account" : "Unblock account"}
        confirmTone={target?.action === "block" ? "danger" : "success"}
        loading={statusMutation.isPending}
        onCancel={() => setTarget(null)}
        onConfirm={() => statusMutation.mutate({ id: target.id, to: target.action === "block" ? "blocked" : "active" })}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete ${deleteTarget.name}'s account?` : ""}
        message="They can no longer sign in. Their past orders are kept for your records."
        confirmLabel="Delete account"
        confirmTone="danger"
        loading={deleteMutation.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
      />
      {editTarget && <EditUserDialog user={editTarget} onClose={() => setEditTarget(null)} onSaved={(res) => setNotice({ tone: "success", text: res?.message || "User updated." })} />}
    </div>
  );
}
