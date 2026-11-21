"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeDollarSign, Plus, Pencil, Ban, CircleCheck, Trash2, Package, Users, Loader2, Eye } from "lucide-react";
import { PageHeader, Card, CardToolbar, SearchInput, DataTable, EntityCell, StatusBadge, Badge, Alert, Button, DropdownMenu, ConfirmDialog, StatCard } from "@/components/superadmin/ui";
import { BILLING_INTERVALS } from "@/components/superadmin/PlanForm";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate } from "@/lib/superadminFormat";

const INTERVAL_SHORT = {
  weekly: "/wk",
  biweekly: "/2wk",
  monthly: "/mo",
  quarterly: "/qtr",
  semiannual: "/6mo",
  yearly: "/yr",
  biennial: "/2yr",
  lifetime: " · lifetime",
  one_time: " · one-time",
  custom: "",
};

const formatMoney = (price, currency, interval) => {
  const amount = Number(price) || 0;
  const cur = currency || "PKR";
  const label = amount === 0 ? "Free" : `${cur} ${amount.toLocaleString()}`;
  if (amount === 0) return label;
  const suffix = INTERVAL_SHORT[interval] ?? "";
  const intervalLabel = BILLING_INTERVALS.find((i) => i.value === interval)?.label;
  if (interval === "custom" && intervalLabel) return `${label} · custom`;
  return `${label}${suffix}`;
};

const limitLabel = (n) => (n == null ? "Unlimited" : String(n));

export default function PlansPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
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
      if (!q) return true;
      return [p.name, p.slug, p.description].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [plans, search]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["superadmin-plans"] });
  const close = () => setDialog(null);
  const ok = (fallback) => (res) => { invalidate(); close(); setNotice({ tone: "success", text: res?.message || fallback }); };
  const fail = (fallback) => (err) => { close(); setNotice({ tone: "danger", text: err?.response?.data?.message || fallback }); };

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => superAdminApi.setPlanStatus(id, status),
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
      cell: (p) => (
        <EntityCell
          primary={p.name}
          secondary={p.description || p.slug}
          maxWidth={320}
        />
      ),
    },
    {
      key: "price",
      header: "Price",
      className: "whitespace-nowrap",
      cell: (p) => <span className="font-medium tabular-nums text-[var(--text-primary)]">{formatMoney(p.price, p.currency, p.billingInterval)}</span>,
    },
    {
      key: "limits",
      header: "Limits",
      cell: (p) => (
        <div className="space-y-1 text-[12.5px] text-[var(--text-secondary)]">
          <p className="inline-flex items-center gap-1.5"><Package size={13} className="text-[var(--text-muted)]" aria-hidden="true" />{limitLabel(p.limits?.maxProducts)} products · {limitLabel(p.limits?.maxOrders)} orders</p>
          <p className="inline-flex items-center gap-1.5"><Users size={13} className="text-[var(--text-muted)]" aria-hidden="true" />{limitLabel(p.limits?.maxStaffAccounts)} staff · {limitLabel(p.limits?.maxChats)} chats</p>
          <p className="text-[11.5px] text-[var(--text-muted)]">
            Leads {limitLabel(p.limits?.maxLeads)} · Quotes {limitLabel(p.limits?.maxQuotes)} · Invoices {limitLabel(p.limits?.maxInvoices)}
          </p>
        </div>
      ),
    },
    {
      key: "pos",
      header: "POS",
      cell: (p) => (p.features?.pos
        ? <Badge tone="accent" dot={false}>Included</Badge>
        : <span className="text-[var(--text-muted)]">Not included</span>),
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plans"
        description="Browse subscription plans, open a plan for full detail and activity, or create a new one."
        actions={<Button variant="primary" icon={Plus} href="/super-admin/plans/new">Create plan</Button>}
      />

      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="All plans" value={counts.all ?? 0} icon={BadgeDollarSign} tone="accent" hint="Platform catalog" loading={isLoading} />
        <StatCard label="Active" value={counts.active ?? 0} icon={CircleCheck} tone="success" hint="Assignable to stores" loading={isLoading} />
        <StatCard label="Inactive" value={counts.inactive ?? 0} icon={Ban} tone={counts.inactive ? "danger" : "neutral"} hint={counts.inactive ? "Hidden from preferred picks" : "None deactivated"} loading={isLoading} />
      </div>

      <Card>
        <CardToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name or description…" label="Search plans" />
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
            title: search ? "No plans match your search" : "No plans yet",
            description: search ? "Try a different name." : "Create a starter, growth or enterprise plan for your stores.",
            action: !search && <Button size="sm" variant="primary" icon={Plus} href="/super-admin/plans/new">Create plan</Button>,
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
