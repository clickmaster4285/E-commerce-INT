"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Loader2, Eye, ExternalLink, Pencil, Store as StoreIcon, Phone, Mail } from "lucide-react";
import { PageHeader, Card, CardToolbar, Tabs, SearchInput, DataTable, EntityCell, Pagination, Avatar, StatusBadge, Badge, Alert, Button, DropdownMenu, Modal, TextInput, SelectInput } from "@/components/superadmin/ui";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate, timeAgo } from "@/lib/superadminFormat";
import { PasswordInput } from "@/components/superadmin/TeamMemberDialog";

// Store admins = admin_users me owner/admin role wale accounts (customer nahi).
const FILTERS = [
  { value: "", label: "All", countKey: "all" },
  { value: "active", label: "Active", countKey: "active" },
  { value: "inactive", label: "Inactive", countKey: "inactive" },
];
const PAGE_SIZE = 20;

export default function StoreAdminsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState(null);
  const [editAdmin, setEditAdmin] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", status: "active", password: "", confirmPassword: "" });

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["superadmin-store-admins", filter, debounced, page],
    queryFn: () => superAdminApi.listStoreAdmins({ status: filter, search: debounced, page, limit: PAGE_SIZE }),
    retry: 1,
    placeholderData: (prev) => prev,
  });

  const items = data?.data?.items || [];
  const pages = data?.data?.pages || 1;
  const total = data?.data?.total || 0;
  const counts = data?.data?.counts || {};
  const editMutation = useMutation({
    mutationFn: () => superAdminApi.updateStoreAdmin(editAdmin.id, editForm),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ["superadmin-store-admins"] }); setEditAdmin(null); setNotice({ tone: "success", text: res?.message || "Store admin updated." }); },
    onError: (err) => setNotice({ tone: "danger", text: err?.response?.data?.message || "Could not update the store admin." }),
  });

  const columns = [
    {
      key: "admin", header: "Store admin",
      cell: (a) => <EntityCell avatar={<Avatar name={a.name} />} primary={a.name} secondary={a.username ? `@${a.username}` : null} maxWidth={220} />,
    },
    {
      key: "contact", header: "Contact",
      cell: (a) => (
        <div className="min-w-0 space-y-0.5 text-[12.5px]">
          <p className="flex items-center gap-1.5 truncate text-fg"><Mail size={12} className="shrink-0 text-fg-muted" aria-hidden="true" />{a.email}</p>
          <p className="flex items-center gap-1.5 text-fg-muted"><Phone size={12} className="shrink-0" aria-hidden="true" />{a.phone ? <span className="tabular-nums">{a.phone}</span> : "No phone"}</p>
        </div>
      ),
    },
    {
      key: "store", header: "Store",
      cell: (a) => a.store ? (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><StoreIcon size={14} aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-fg">{a.store.name}</p>
            <p className="truncate text-[12px] text-fg-muted">{a.store.subdomain ? `${a.store.subdomain}.…` : "No subdomain"}</p>
            {a.sellerPending && <Badge tone="warning" dot={false} className="mt-1 !h-[18px] !px-1.5 !text-[10px]">Pending approval</Badge>}
          </div>
        </div>
      ) : <span className="text-fg-muted">—</span>,
    },
    {
      key: "role", header: "Role",
      cell: (a) => (
        <span className="inline-flex items-center rounded-md bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
          {a.role === "storehandler" ? "Owner" : "Admin"}
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (a) => <StatusBadge value={a.sellerPending ? "pending" : a.status} /> },
    {
      key: "joined", header: "Joined", className: "whitespace-nowrap",
      cell: (a) => (<><p className="font-medium text-fg">{formatDate(a.created_at)}</p><p className="mt-0.5 text-[12px] text-fg-muted">{timeAgo(a.created_at)}</p></>),
    },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, align: "end", width: 56, stopRowClick: true,
      cell: (a) => (
        <DropdownMenu
          label={`Actions for ${a.name}`}
          items={[
            { label: "View profile", icon: Eye, href: `/super-admin/store-admins/${a.id}` },
            { label: "Edit profile", icon: Pencil, onClick: () => { setEditAdmin(a); setEditForm({ name: a.name || "", email: a.email || "", phone: a.phone || "", status: a.status || "active", password: "", confirmPassword: "" }); } },
            ...(a.store?.url ? [{ separator: true }, { label: "Visit storefront", icon: ExternalLink, href: a.store.url, external: true }] : []),
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Store Admins"
        description={isLoading ? "Store owners and admins across every store." : `${total.toLocaleString()} store admin${total === 1 ? "" : "s"} across every store.`}
      />

      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

      <Card>
        <Tabs label="Filter store admins" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} items={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts[f.countKey] }))} />
        <CardToolbar>
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search by name, email or username..." label="Search store admins" />
          {isFetching && !isLoading && <Loader2 size={16} className="animate-spin text-fg-muted" aria-label="Refreshing" />}
        </CardToolbar>
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(a) => a.id}
          loading={isLoading}
          onRowClick={(a) => router.push(`/super-admin/store-admins/${a.id}`)}
          error={isError ? { title: "Couldn't load store admins", action: <Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button> } : null}
          empty={{ icon: ShieldCheck, title: debounced ? "No store admins match your search" : filter === "inactive" ? "No inactive store admins" : "No store admins yet", description: debounced ? "Try a different name, email or username." : filter ? undefined : "Store owners appear here when they create a store." }}
        />
        <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onChange={setPage} itemLabel="store admins" />
      </Card>
      <Modal open={Boolean(editAdmin)} onClose={() => setEditAdmin(null)} as="form" onSubmit={(event) => { event.preventDefault(); editMutation.mutate(); }} title={editAdmin ? `Edit ${editAdmin.name}` : "Edit store admin"} icon={Pencil} busy={editMutation.isPending} footer={<><Button variant="secondary" onClick={() => setEditAdmin(null)}>Cancel</Button><Button type="submit" variant="primary" loading={editMutation.isPending}>Save changes</Button></>}>
        <div className="space-y-4">
          <TextInput label="Full name" required value={editForm.name} onChange={(event) => setEditForm((form) => ({ ...form, name: event.target.value }))} />
          <TextInput label="Email" type="email" required value={editForm.email} onChange={(event) => setEditForm((form) => ({ ...form, email: event.target.value }))} />
          <TextInput label="Phone" value={editForm.phone} onChange={(event) => setEditForm((form) => ({ ...form, phone: event.target.value }))} />
          <SelectInput label="Account status" value={editForm.status} onChange={(event) => setEditForm((form) => ({ ...form, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></SelectInput>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><PasswordInput label="New password" value={editForm.password} onChange={(value) => setEditForm((form) => ({ ...form, password: value }))} required={false} placeholder="Leave blank to keep current" /><PasswordInput label="Confirm password" value={editForm.confirmPassword} onChange={(value) => setEditForm((form) => ({ ...form, confirmPassword: value }))} required={false} /></div>
        </div>
      </Modal>
    </div>
  );
}
