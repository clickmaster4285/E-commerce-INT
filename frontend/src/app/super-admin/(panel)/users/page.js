"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users as UsersIcon, Ban, CircleCheck, Loader2 } from "lucide-react";
import { PageHeader, Card, CardToolbar, Tabs, SearchInput, DataTable, EntityCell, Pagination, Avatar, StatusBadge, Alert, Button, ConfirmDialog } from "@/components/superadmin/ui";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate, timeAgo } from "@/lib/superadminFormat";

const FILTERS = [
  { value: "", label: "All" },
  { value: "customer", label: "Customers" },
  { value: "seller", label: "Sellers" },
  { value: "blocked", label: "Blocked" },
];
const PAGE_SIZE = 20;

export default function UsersPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const type = filter === "customer" || filter === "seller" ? filter : "";
  const queryStatus = filter === "blocked" ? "blocked" : "";

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["superadmin-users", type, queryStatus, debounced, page],
    queryFn: () => superAdminApi.listUsers({ type, status: queryStatus, search: debounced, page, limit: PAGE_SIZE }),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const items = data?.data?.items || [];
  const pages = data?.data?.pages || 1;
  const total = data?.data?.total || 0;

  const statusMutation = useMutation({
    mutationFn: ({ id, to }) => superAdminApi.setUserStatus(id, to),
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ["superadmin-users"] });
      setNotice({ tone: "success", text: res?.message || (vars.to === "blocked" ? "Account blocked." : "Account unblocked.") });
      setTarget(null);
    },
    onError: (err) => { setNotice({ tone: "danger", text: err?.response?.data?.message || "Could not update the account." }); setTarget(null); },
  });

  const columns = [
    { key: "user", header: "User", cell: (u) => <EntityCell avatar={<Avatar name={u.name} />} primary={u.name} secondary={u.username ? `@${u.username}` : null} /> },
    { key: "email", header: "Email", cell: (u) => <span className="text-[var(--text-secondary)]">{u.email}</span> },
    { key: "type", header: "Type", cell: (u) => <StatusBadge value={u.type === "Seller" ? "seller" : "customer"} dot={false} /> },
    { key: "status", header: "Status", cell: (u) => <StatusBadge value={u.status} /> },
    { key: "joined", header: "Joined", className: "whitespace-nowrap", cell: (u) => (<><p className="font-medium text-[var(--text-primary)]">{formatDate(u.created_at)}</p><p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{timeAgo(u.created_at)}</p></>) },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, align: "end", width: 120,
      cell: (u) => u.status === "blocked"
        ? <Button size="sm" variant="secondary" icon={CircleCheck} onClick={() => setTarget({ id: u.id, name: u.name, action: "unblock" })}>Unblock</Button>
        : <Button size="sm" variant="danger-outline" icon={Ban} onClick={() => setTarget({ id: u.id, name: u.name, action: "block" })}>Block</Button>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Users" description={isLoading ? "Every customer and seller account on the platform." : `${total.toLocaleString()} account${total === 1 ? "" : "s"} across the platform.`} />

      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

      <Card>
        <Tabs label="Filter users" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} items={FILTERS} />
        <CardToolbar>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name, email or username…" label="Search users" />
          {isFetching && !isLoading && <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" aria-label="Refreshing" />}
        </CardToolbar>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(u) => u.id}
          loading={isLoading}
          error={isError ? { title: "Couldn't load users", action: <Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button> } : null}
          empty={{ icon: UsersIcon, title: debounced ? "No users match your search" : "No users found", description: debounced ? "Try a different name, email or username." : undefined }}
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
    </div>
  );
}
