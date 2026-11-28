"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeDollarSign, Plus, Pencil, Ban, CircleCheck, Trash2, Loader2, Eye } from "lucide-react";
import { PageHeader, Card, CardToolbar, Tabs, SearchInput, DataTable, EntityCell, StatusBadge, Badge, Alert, Button, DropdownMenu, ConfirmDialog } from "@/components/superadmin/ui";
import { LIMIT_FIELDS } from "@/components/superadmin/PlanForm";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate } from "@/lib/superadminFormat";
import { formatPlanPrice } from "@/lib/planModules";

/** Limits ek line me — sirf capped wale dikhate hain, baaki "unlimited". */
function LimitsSummary({ limits }) {
  const capped = LIMIT_FIELDS.filter(({ key }) => limits?.[key] != null);
  if (!capped.length) return <span className="text-[var(--text-muted)]">All unlimited</span>;
  const shown = capped.slice(0, 3);
  const rest = capped.length - shown.length;
  return (
    <span
      className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[var(--text-secondary)]"
      title={LIMIT_FIELDS.map(({ key, label }) => `${label}: ${limits?.[key] ?? "Unlimited"}`).join("\n")}
    >
      {shown.map(({ key, label }) => (
        <span key={key} className="whitespace-nowrap">
          <span className="font-medium tabular-nums text-[var(--text-primary)]">{Number(limits[key]).toLocaleString()}</span> {label.toLowerCase()}
        </span>
      ))}
      {rest > 0 && <span className="text-[var(--text-muted)]">+{rest} more</span>}
    </span>
  );
}

export default function PlansPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [dialog, setDialog] = useState(null); // { type: status|delete, plan?, next? }
  const [notice, setNotice] = useState(null);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["superadmin-plans"],
    queryFn: () => superAdminApi.listPlans(),
    retry: 1,
  });
  const plans = useMemo(() => data?.data?.items || [], [data]);
  const counts = data?.data?.counts || {};

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter((p) => {
      if (status && p.status !== status) return false;
      if (!q) return true;
      return [p.name, p.slug, p.description].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [plans, search, status]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["superadmin-plans"] });
  const close = () => setDialog(null);
  const ok = (fallback) => (res) => { invalidate(); close(); setNotice({ tone: "success", text: res?.message || fallback }); };
  const fail = (fallback) => (err) => { close(); setNotice({ tone: "danger", text: err?.response?.data?.message || fallback }); };

  const statusMut = useMutation({
    mutationFn: ({ id, status: next }) => superAdminApi.setPlanStatus(id, next),
    onSuccess: ok("Plan status updated."),
    onError: fail("Could not update the plan status."),
  });
  const deleteMut = useMutation({
    mutationFn: (id) => superAdminApi.deletePlan(id),
    onSuccess: ok("Plan deleted."),
    onError: fail("Could not delete the plan."),
  });

  const columns = [
    {
      key: "plan",
      header: "Plan",
      cell: (p) => <EntityCell primary={p.name} secondary={p.description || p.slug} maxWidth={300} />,
    },
    {
      key: "price",
      header: "Price",
      className: "whitespace-nowrap",
      cell: (p) => <span className="font-medium tabular-nums text-[var(--text-primary)]">{formatPlanPrice(p.price, p.currency, p.billingInterval)}</span>,
    },
    { key: "limits", header: "Limits", cell: (p) => <LimitsSummary limits={p.limits} /> },
    {
      key: "pos",
      header: "POS",
      cell: (p) => (p.features?.pos
        ? <Badge tone="accent" dot={false}>Included</Badge>
        : <span className="text-[var(--text-muted)]">—</span>),
    },
    {
      key: "stores",
      header: "Stores",
      className: "whitespace-nowrap",
      cell: (p) => <span className="tabular-nums text-[var(--text-secondary)]">{p.storeCount ?? 0}</span>,
    },
    { key: "status", header: "Status", cell: (p) => <StatusBadge value={p.status} /> },
    {
      key: "added",
      header: "Created",
      className: "whitespace-nowrap",
      cell: (p) => <span className="text-[var(--text-secondary)]">{formatDate(p.created_at)}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "end",
      width: 56,
      stopRowClick: true,
      cell: (p) => (
        <DropdownMenu
          label={`Actions for ${p.name}`}
          items={[
            { label: "View plan", icon: Eye, href: `/super-admin/plans/${p.id}` },
            { label: "Edit plan", icon: Pencil, href: `/super-admin/plans/${p.id}/edit` },
            { separator: true },
            p.status === "inactive"
              ? { label: "Activate", icon: CircleCheck, onClick: () => setDialog({ type: "status", plan: p, next: "active" }) }
              : { label: "Deactivate", icon: Ban, onClick: () => setDialog({ type: "status", plan: p, next: "inactive" }) },
            {
              label: "Delete plan",
              icon: Trash2,
              tone: "danger",
              disabled: (p.storeCount || 0) > 0,
              hint: (p.storeCount || 0) > 0 ? "Reassign stores on this plan first" : undefined,
              onClick: () => setDialog({ type: "delete", plan: p }),
            },
          ]}
        />
      ),
    },
  ];

  const filtered = Boolean(search || status);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Plans"
        description="Subscription plans stores can be assigned to."
        actions={<Button variant="primary" icon={Plus} href="/super-admin/plans/new">Create plan</Button>}
      />

      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

      <Card>
        <Tabs
          label="Filter plans by status"
          value={status}
          onChange={setStatus}
          items={[
            { value: "", label: "All", count: isLoading ? undefined : counts.all ?? 0 },
            { value: "active", label: "Active", count: isLoading ? undefined : counts.active ?? 0 },
            { value: "inactive", label: "Inactive", count: isLoading ? undefined : counts.inactive ?? 0 },
          ]}
        />
        <CardToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or description…" label="Search plans" className="max-w-md" />
          {isFetching && !isLoading && <Loader2 size={16} className="animate-spin text-[var(--text-muted)]" aria-label="Refreshing" />}
        </CardToolbar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(p) => p.id}
          loading={isLoading}
          skeletonRows={3}
          onRowClick={(p) => router.push(`/super-admin/plans/${p.id}`)}
          error={isError ? { title: "Couldn't load plans", action: <Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button> } : null}
          empty={{
            icon: BadgeDollarSign,
            title: filtered ? "No plans match" : "No plans yet",
            description: filtered ? "Try a different name or status." : "Create a starter, growth or enterprise plan for your stores.",
            action: !filtered && <Button size="sm" variant="primary" icon={Plus} href="/super-admin/plans/new">Create plan</Button>,
          }}
        />
      </Card>

      <ConfirmDialog
        open={dialog?.type === "status"}
        title={dialog?.type === "status" ? `${dialog.next === "active" ? "Activate" : "Deactivate"} ${dialog.plan.name}?` : ""}
        message={dialog?.next === "active" ? "Stores can be assigned this plan again." : "Existing stores keep the plan; new assignments stay allowed but the plan is marked inactive."}
        confirmLabel={dialog?.next === "active" ? "Activate" : "Deactivate"}
        confirmTone={dialog?.next === "active" ? "success" : "danger"}
        loading={statusMut.isPending}
        onCancel={close}
        onConfirm={() => statusMut.mutate({ id: dialog.plan.id, status: dialog.next })}
      />
      <ConfirmDialog
        open={dialog?.type === "delete"}
        title={dialog?.type === "delete" ? `Delete ${dialog.plan.name}?` : ""}
        message="This permanently removes the plan from the catalog. Stores must not be using it."
        confirmLabel="Delete plan"
        confirmTone="danger"
        loading={deleteMut.isPending}
        onCancel={close}
        onConfirm={() => deleteMut.mutate(dialog.plan.id)}
      />
    </div>
  );
}
