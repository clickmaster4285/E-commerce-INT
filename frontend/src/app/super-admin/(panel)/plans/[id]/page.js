"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  Pencil,
  CircleCheck,
  ArrowUpRight,
} from "lucide-react";
import {
  PageHeader,
  Card,
  Button,
  StatusBadge,
  Avatar,
  Alert,
  Skeleton,
  ConfirmDialog,
  EmptyState,
} from "@/components/superadmin/ui";
import ActivityFeed from "@/components/superadmin/ActivityFeed";
import { BILLING_INTERVALS, LIMIT_FIELDS, PlanLimitsGrid } from "@/components/superadmin/PlanForm";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate, formatDateTime, timeAgo, assetUrl } from "@/lib/superadminFormat";
import { formatPlanPrice } from "@/lib/planModules";

const LIST = "/super-admin/plans";

const intervalLabel = (v) => BILLING_INTERVALS.find((i) => i.value === v)?.label || v;

export default function PlanDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null); // status | delete
  const [notice, setNotice] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["superadmin-plan", String(id)],
    queryFn: () => superAdminApi.getPlan(id),
    enabled: !!id,
    retry: 1,
  });

  const plan = data?.data?.plan || null;
  const stores = data?.data?.stores || [];
  const stats = data?.data?.stats || {};

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["superadmin-plan", String(id)] });
    qc.invalidateQueries({ queryKey: ["superadmin-plans"] });
    qc.invalidateQueries({ queryKey: ["superadmin-plan-activity", String(id)] });
  };
  const close = () => setDialog(null);
  const ok = (fallback) => (res) => {
    refresh();
    close();
    setNotice({ tone: "success", text: res?.message || fallback });
  };
  const fail = (fallback) => (err) => {
    close();
    setNotice({ tone: "danger", text: err?.response?.data?.message || fallback });
  };

  const statusMut = useMutation({
    mutationFn: (status) => superAdminApi.setPlanStatus(id, status),
    onSuccess: ok("Plan status updated."),
    onError: fail("Could not update the plan status."),
  });

  if (isLoading) return <DetailSkeleton />;
  if (isError || !plan) {
    return (
      <div className="space-y-4">
        <PageHeader title="Plan" backHref={LIST} backLabel="Back to plans" />
        <Card>
          <EmptyState
            icon={BadgeDollarSign}
            title="This plan was not found"
            description="It may have been deleted."
            action={
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button>
                <Button size="sm" variant="primary" href={LIST}>Back to plans</Button>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  const inactive = plan.status === "inactive";
  const storeCount = stats.stores ?? plan.storeCount ?? 0;
  const pos = Boolean(plan.features?.pos);
  const creatorName = plan.createdBy?.name || null;
  const cappedCount = LIMIT_FIELDS.filter(({ key }) => plan.limits?.[key] != null).length;

  return (
    <div className="flex flex-col gap-4 xl:min-h-[calc(100dvh-7rem)]">
      <PageHeader
        title={plan.name}
        description={plan.description || "No description"}
        badge={<StatusBadge value={plan.status} />}
        backHref={LIST}
        backLabel="Back to plans"
        actions={<Button variant="primary" icon={Pencil} href={`/super-admin/plans/${plan.id}/edit`}>Edit plan</Button>}
      />

      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}
      {inactive && (
        <Alert
          tone="warning"
          title="This plan is inactive"
          action={<Button size="sm" variant="primary" icon={CircleCheck} onClick={() => setDialog("status")}>Activate</Button>}
        >
          Stores already on it keep the assignment; mark it active again when you want it as a preferred option.
        </Alert>
      )}

      <div className="grid flex-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-stretch">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="divide-y divide-[var(--border-color)]">
            {/* Key numbers — har cheez ek hi baar */}
            <dl className="grid grid-cols-2 sm:grid-cols-4">
              <Fact label="Price" value={formatPlanPrice(plan.price, plan.currency, plan.billingInterval)} sub={intervalLabel(plan.billingInterval)} />
              <Fact label="Stores on plan" value={storeCount} sub={storeCount ? "Assigned storefronts" : "None assigned"} />
              <Fact label="Activity" value={stats.activity ?? 0} sub={`${stats.activityWeek ?? 0} this week`} />
              <Fact
                label="Last updated"
                value={plan.updated_at ? timeAgo(plan.updated_at) : "—"}
                sub={plan.updated_at ? formatDate(plan.updated_at) : ""}
                title={plan.updated_at ? formatDateTime(plan.updated_at) : undefined}
              />
            </dl>
            <div className="space-y-3 px-4 pb-4 pt-3.5">
              <p className="flex min-h-7 items-center text-[12.5px] leading-5 text-[var(--text-muted)]">
                <span className="me-2 text-[14px] font-semibold text-[var(--text-primary)]">Limits &amp; features</span>
                {cappedCount ? `${cappedCount} of ${LIMIT_FIELDS.length} resources capped` : "Every resource is unlimited"}
              </p>
              <PlanLimitsGrid limits={plan.limits} pos={pos} />
            </div>
          </Card>

          <ActivityFeed
            className="flex-1"
            hideLinks
            queryKey={["superadmin-plan-activity", String(id)]}
            fetcher={(params) => superAdminApi.planActivity(id, params)}
            title="Activity"
            description="Creates, edits, status changes and deletions for this plan"
            who="the team"
          />
        </div>

        <aside className="flex flex-col gap-4">
          <Card>
            <p className="border-b border-[var(--border-color)] px-4 py-3 text-[14px] font-semibold text-[var(--text-primary)]">Details</p>
            <dl className="px-4 py-2 text-[12.5px]">
              <DetailRow label="Slug"><span className="font-mono">{plan.slug}</span></DetailRow>
              <DetailRow label="Billing">{intervalLabel(plan.billingInterval)}</DetailRow>
              <DetailRow label="Currency">{plan.currency}</DetailRow>
              <DetailRow label="Sort order">{plan.sortOrder ?? 0}</DetailRow>
              <DetailRow label="Created" title={plan.created_at ? formatDateTime(plan.created_at) : undefined}>
                {plan.created_at ? formatDate(plan.created_at) : "—"}
              </DetailRow>
              <DetailRow label="Created by" title={plan.createdBy?.email}>{creatorName || "Unknown"}</DetailRow>
            </dl>
          </Card>

          <Card className="flex flex-1 flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)] px-4 py-3">
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                Stores <span className="ms-1 text-[12.5px] font-normal tabular-nums text-[var(--text-muted)]">{storeCount}</span>
              </p>
              {storeCount > stores.length ? <Button variant="link" size="sm" href="/super-admin/stores" iconRight={ArrowUpRight}>All</Button> : null}
            </div>
            {stores.length === 0 ? (
              <p className="flex flex-1 items-center justify-center px-4 py-6 text-center text-[12.5px] text-[var(--text-muted)]">No stores on this plan yet.</p>
            ) : (
              <ul className="divide-y divide-[var(--border-color)]">
                {stores.map((s) => (
                  <li key={s.id}>
                    <Link href={`/super-admin/stores/${s.id}`} className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-[var(--bg-row-hover)]">
                      <Avatar name={s.store_name} shape="square" size="sm" src={s.logo_url ? assetUrl(s.logo_url) : undefined} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-[var(--text-primary)]">{s.store_name}</span>
                        <span className="block truncate text-[11.5px] text-[var(--text-muted)]">{s.subdomain || "No subdomain"}</span>
                      </span>
                      <StatusBadge value={s.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={dialog === "status"}
        title={`${inactive ? "Activate" : "Deactivate"} ${plan.name}?`}
        message={inactive ? "Stores can be assigned this plan again as a preferred option." : "Existing stores keep the plan; it will be marked inactive in the catalog."}
        confirmLabel={inactive ? "Activate" : "Deactivate"}
        confirmTone={inactive ? "success" : "danger"}
        loading={statusMut.isPending}
        onCancel={close}
        onConfirm={() => statusMut.mutate(inactive ? "active" : "inactive")}
      />
    </div>
  );
}

function Fact({ label, value, sub, title }) {
  return (
    <div className="min-w-0 border-[var(--border-color)] px-4 py-3 [&:not(:last-child)]:border-e max-sm:[&:nth-child(2)]:border-e-0 max-sm:[&:nth-child(-n+2)]:border-b" title={title}>
      <dt className="text-[12px] font-medium text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-0.5 truncate text-[18px] font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">{value}</dd>
      {sub ? <dd className="truncate text-[12px] text-[var(--text-muted)]">{sub}</dd> : null}
    </div>
  );
}

function DetailRow({ label, title, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5" title={title}>
      <dt className="shrink-0 text-[var(--text-muted)]">{label}</dt>
      <dd className="min-w-0 truncate text-end font-medium text-[var(--text-primary)]">{children}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading plan">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-64" /></div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4"><Skeleton className="h-72 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>
        <div className="space-y-4"><Skeleton className="h-56 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>
      </div>
    </div>
  );
}
