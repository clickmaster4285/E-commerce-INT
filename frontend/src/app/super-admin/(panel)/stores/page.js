"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Store as StoreIcon, Plus, Pencil, Trash2, ExternalLink, Ban, CircleCheck, Loader2, LayoutDashboard } from "lucide-react";
import { PageHeader, Card, CardToolbar, Tabs, SearchInput, DataTable, EntityCell, Pagination, Avatar, StatusBadge, Alert, Button, DropdownMenu, ConfirmDialog, Modal, TextInput, TextArea, SelectInput, FormSection } from "@/components/superadmin/ui";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate, timeAgo, assetUrl } from "@/lib/superadminFormat";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "maintenance", label: "Maintenance" },
  { value: "closed", label: "Suspended" },
];
const STATUS_OPTIONS = [{ value: "open", label: "Open" }, { value: "maintenance", label: "Maintenance" }, { value: "closed", label: "Suspended" }];
const EMPTY_FORM = { store_name: "", email: "", phone: "", description: "", business_category: "", business_type: "individual", country: "PK", city: "", address: "", zip_code: "", logo_url: "", store_status: "open" };
const PAGE_SIZE = 20;

function StoreFormDialog({ store, onClose, onSaved }) {
  const editing = Boolean(store);
  const [form, setForm] = useState(editing ? { ...EMPTY_FORM, ...store } : EMPTY_FORM);
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: (payload) => (editing ? superAdminApi.updateStore(store.id, payload) : superAdminApi.createStore(payload)),
    onSuccess: onSaved,
    onError: (e) => setError(e?.response?.data?.message || "Could not save this store."),
  });
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }));
  const setLogo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((c) => ({ ...c, logo_url: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };
  const submit = (e) => { e.preventDefault(); setError(""); mutation.mutate(form); };

  return (
    <Modal
      open
      onClose={onClose}
      as="form"
      onSubmit={submit}
      size="lg"
      icon={StoreIcon}
      title={editing ? `Edit ${store.store_name}` : "Add a new store"}
      description={editing ? "Keep the storefront identity and contact details up to date." : "Create a storefront directly without a seller application."}
      busy={mutation.isPending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={mutation.isPending}>Cancel</Button>
          <Button type="submit" variant="primary" loading={mutation.isPending}>{editing ? "Save changes" : "Create store"}</Button>
        </>
      }
    >
      <div className="space-y-6 pt-1">
        {error && <Alert tone="danger">{error}</Alert>}
        <FormSection title="Store">
          <TextInput label="Store name" required value={form.store_name} onChange={set("store_name")} placeholder="e.g. Northstar Electronics" autoFocus />
          <TextArea label="Description" value={form.description} onChange={set("description")} placeholder="What does this store sell?" />
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <TextInput label="Business category" value={form.business_category} onChange={set("business_category")} placeholder="Fashion, electronics…" />
            <SelectInput label="Business type" value={form.business_type} onChange={set("business_type")}>
              <option value="individual">Individual</option>
              <option value="registered_business">Registered business</option>
            </SelectInput>
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <SelectInput label="Store status" value={form.store_status} onChange={set("store_status")}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </SelectInput>
            <TextInput label="Store logo" type="file" accept="image/png,image/jpeg,image/webp" onChange={setLogo} />
          </div>
        </FormSection>
        <FormSection title="Contact">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <TextInput label="Store email" type="email" value={form.email} onChange={set("email")} placeholder="owner@store.com" />
            <TextInput label="Phone" value={form.phone} onChange={set("phone")} placeholder="+92 300 0000000" />
          </div>
        </FormSection>
        <FormSection title="Location">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <TextInput label="Country" value={form.country} onChange={set("country")} placeholder="PK" />
            <TextInput label="City" value={form.city} onChange={set("city")} placeholder="Lahore" />
          </div>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[1fr_140px]">
            <TextInput label="Address" value={form.address} onChange={set("address")} placeholder="Complete store address" />
            <TextInput label="ZIP code" value={form.zip_code} onChange={set("zip_code")} placeholder="54000" />
          </div>
        </FormSection>
      </div>
    </Modal>
  );
}

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
    { key: "store", header: "Store", cell: (s) => <EntityCell avatar={<Avatar name={s.store_name} shape="square" src={s.logo_url ? assetUrl(s.logo_url) : undefined} />} primary={s.store_name} secondary={s.business_category || (s.business_type === "registered_business" ? "Registered business" : "Individual seller")} maxWidth={300} /> },
    { key: "owner", header: "Owner", cell: (s) => s.owner_name ? <EntityCell avatar={<Avatar name={s.owner_name} size="sm" />} primary={s.owner_name} secondary={s.owner_email} maxWidth={260} /> : <span className="text-[var(--text-muted)]">No owner</span> },
    { key: "created", header: "Created", className: "whitespace-nowrap", cell: (s) => (<><p className="font-medium text-[var(--text-primary)]">{formatDate(s.createdAt)}</p><p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{timeAgo(s.createdAt)}</p></>) },
    { key: "status", header: "Status", cell: (s) => <StatusBadge value={s.status} /> },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, align: "end", width: 56,
      cell: (s) => (
        <DropdownMenu
          label={`Actions for ${s.store_name}`}
          items={[
            { label: "Visit storefront", icon: ExternalLink, href: s.url, external: true, disabled: !s.url },
            { label: "Open admin panel", icon: LayoutDashboard, href: s.url ? `${s.url}/admin` : undefined, external: true, disabled: !s.url },
            { separator: true },
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
        actions={<Button variant="primary" icon={Plus} onClick={() => setFormStore("new")}>Add store</Button>}
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
          empty={{ icon: StoreIcon, title: debounced ? "No stores match your search" : "No stores yet", description: debounced ? "Try a different store name or email." : "Approve a seller request or add a store manually.", action: !debounced && <Button size="sm" variant="primary" icon={Plus} onClick={() => setFormStore("new")}>Add store</Button> }}
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
