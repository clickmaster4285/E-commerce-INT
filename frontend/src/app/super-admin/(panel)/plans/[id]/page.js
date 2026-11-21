"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  Pencil,
  Ban,
  CircleCheck,
  Trash2,
  MoreHorizontal,
  Store as StoreIcon,
  Activity,
  CalendarPlus,
  Clock,
  UserRound,
  Hash,
  Infinity as InfinityIcon,
  ShoppingCart,
  LayoutGrid,
  Check,
  X,
  ArrowUpRight,
} from "lucide-react";
import {
  PageHeader,
  Card,
  CardHeader,
  CardBody,
  Button,
  StatusBadge,
  Badge,
  Avatar,
  Alert,
  Skeleton,
  DropdownMenu,
  ConfirmDialog,
  EmptyState,
  StatCard,
} from "@/components/superadmin/ui";
import ActivityFeed from "@/components/superadmin/ActivityFeed";
import { BILLING_INTERVALS, LIMIT_FIELDS } from "@/components/superadmin/PlanForm";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate, formatDateTime, timeAgo, assetUrl } from "@/lib/superadminFormat";
import { formatPlanPrice, limitLabel } from "@/lib/planModules";

const LIST = "/super-admin/plans";

const intervalLabel = (v) => BILLING_INTERVALS.find((i) => i.value === v)?.label || v;

export default function PlanDetailPage() {
  const { id } = useParams();
  const router = useRouter();
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
  const deleteMut = useMutation({
    mutationFn: () => superAdminApi.deletePlan(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-plans"] });
      qc.removeQueries({ queryKey: ["superadmin-plan", String(id)] });
      router.push(LIST);
    },
    onError: fail("Could not delete the plan."),
  });

  if (isLoading) return <DetailSkeleton />;
  if (isError || !plan) {
    return (
      <div className="space-y-6">
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
  const canDelete = storeCount === 0;
  const priceLabel = formatPlanPrice(plan.price, plan.currency, plan.billingInterval);
  const creatorName = plan.createdBy?.name || null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={plan.name}
        description={plan.description || plan.slug}
        badge={<StatusBadge value={plan.status} />}
        backHref={LIST}
        backLabel="Back to plans"
        actions={
          <>
            <Button variant="primary" icon={Pencil} href={`/super-admin/plans/${plan.id}/edit`}>Edit plan</Button>
            <DropdownMenu
              label="More actions"
              icon={MoreHorizontal}
              variant="outline"
              size="md"
              items={[
                inactive
                  ? { label: "Activate plan", icon: CircleCheck, onClick: () => setDialog("status") }
                  : { label: "Deactivate plan", icon: Ban, onClick: () => setDialog("status") },
                {
                  label: "Delete plan",
                  icon: Trash2,
                  tone: "danger",
                  disabled: !canDelete,
                  hint: canDelete ? undefined : "Reassign stores on this plan first",
                  onClick: () => setDialog("delete"),
                },
              ]}
            />
          </>
        }
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

      {/* Hero overview */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[var(--shadow-sm,0_1px_2px_rgb(0_0_0/0.04))]">
        <div className="relative isolate px-5 py-6 sm:px-7 sm:py-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(1200px_280px_at_0%_-20%,color-mix(in_oklab,var(--accent)_18%,transparent),transparent_55%),linear-gradient(180deg,color-mix(in_oklab,var(--bg-tertiary)_70%,transparent),transparent)]"
          />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--accent)_14%,var(--bg-card))] text-[var(--accent)] ring-1 ring-[color-mix(in_oklab,var(--accent)_22%,transparent)]">
                <BadgeDollarSign size={28} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">Subscription plan</p>
                <h2 className="mt-1 truncate text-[22px] font-semibold tracking-tight text-[var(--text-primary)] sm:text-[26px]">{plan.name}</h2>
                <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-[var(--text-secondary)]">
                  {plan.description || "No description yet — add one when you edit this plan."}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="accent" dot={false}>{priceLabel}</Badge>
                  <Badge tone="neutral" dot={false}>{intervalLabel(plan.billingInterval)}</Badge>
                  <Badge tone="neutral" dot={false}>{plan.currency}</Badge>
                  <Badge tone="neutral" dot={false}>#{plan.slug}</Badge>
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-xl lg:flex-1">
              <MiniStat label="Stores" value={String(storeCount)} />
              <MiniStat label="Activity" value={String(stats.activity ?? 0)} />
              <MiniStat label="This week" value={String(stats.activityWeek ?? 0)} />
              <MiniStat label="Sort" value={String(plan.sortOrder ?? 0)} />
            </dl>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Price" value={priceLabel} icon={BadgeDollarSign} tone="accent" hint={intervalLabel(plan.billingInterval)} />
        <StatCard label="Stores on plan" value={storeCount} icon={StoreIcon} tone={storeCount ? "info" : "neutral"} hint={storeCount ? "Assigned storefronts" : "No stores assigned yet"} />
        <StatCard label="Created" value={plan.created_at ? formatDate(plan.created_at) : "—"} icon={CalendarPlus} tone="neutral" hint={plan.created_at ? timeAgo(plan.created_at) : "Unknown"} />
        <StatCard label="Last updated" value={plan.updated_at ? formatDate(plan.updated_at) : "—"} icon={Clock} tone="neutral" hint={plan.updated_at ? timeAgo(plan.updated_at) : "—"} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* LEFT — meta + limits + features + stores */}
        <div className="space-y-4">
          <Card>
            <CardHeader title="Overview" description="Identity and ownership" icon={LayoutGrid} />
            <ul className="divide-y divide-[var(--border-color)]">
              <MetaRow icon={Hash} label="Slug"><span className="font-mono text-[12.5px] text-[var(--text-primary)]">{plan.slug}</span></MetaRow>
              <MetaRow icon={BadgeDollarSign} label="Billing"><span className="font-medium text-[var(--text-primary)]">{intervalLabel(plan.billingInterval)}</span></MetaRow>
              <MetaRow icon={CalendarPlus} label="Created">
                <span className="font-medium text-[var(--text-primary)]" title={plan.created_at ? formatDateTime(plan.created_at) : undefined}>
                  {plan.created_at ? formatDateTime(plan.created_at) : "—"}
                </span>
              </MetaRow>
              <MetaRow icon={UserRound} label="Created by">
                {creatorName ? (
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <Avatar name={creatorName} size="sm" />
                    <span className="min-w-0 text-end">
                      <span className="block truncate font-medium text-[var(--text-primary)]">{creatorName}</span>
                      {plan.createdBy?.email && <span className="block truncate text-[11.5px] text-[var(--text-muted)]">{plan.createdBy.email}</span>}
                    </span>
                  </span>
                ) : (
                  <span className="text-[var(--text-muted)]">Unknown</span>
                )}
              </MetaRow>
              <MetaRow icon={Clock} label="Updated">
                <span className="font-medium text-[var(--text-primary)]" title={plan.updated_at ? formatDateTime(plan.updated_at) : undefined}>
                  {plan.updated_at ? formatDateTime(plan.updated_at) : "—"}
                </span>
              </MetaRow>
            </ul>
          </Card>

          <Card>
            <CardHeader title="Limits" description="Caps for stores on this plan" icon={InfinityIcon} />
            <CardBody className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-1">
              {LIMIT_FIELDS.map(({ key, label, icon: Icon }) => {
                const value = plan.limits?.[key];
                const unlimited = value == null;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)]/50 px-3.5 py-3 transition-colors hover:bg-[var(--bg-tertiary)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-card)] text-[var(--text-muted)] ring-1 ring-[var(--border-color)]">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-medium text-[var(--text-muted)]">{label}</p>
                      <p className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">
                        {unlimited ? "Unlimited" : limitLabel(value)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Point of sale" description="In-store checkout for stores on this plan" icon={ShoppingCart} />
            <CardBody>
              <FeatureToggle label="POS access" on={Boolean(plan.features?.pos)} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Stores"
              description={storeCount ? `${storeCount} storefront${storeCount === 1 ? "" : "s"}` : "None assigned"}
              icon={StoreIcon}
              action={storeCount > 0 ? <Button variant="link" size="sm" href="/super-admin/stores" iconRight={ArrowUpRight}>All stores</Button> : null}
            />
            {stores.length === 0 ? (
              <CardBody>
                <EmptyState
                  compact
                  icon={StoreIcon}
                  title="No stores on this plan"
                  description="Assign a plan from the store edit form."
                />
              </CardBody>
            ) : (
              <ul className="divide-y divide-[var(--border-color)]">
                {stores.map((s) => (
                  <li key={s.id}>
                    <Link
                      href="/super-admin/stores"
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--bg-row-hover)]"
                    >
                      <Avatar name={s.store_name} shape="square" size="sm" src={s.logo_url ? assetUrl(s.logo_url) : undefined} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-[var(--text-primary)]">{s.store_name}</span>
                        <span className="block truncate text-[12px] text-[var(--text-muted)]">{s.subdomain || "No subdomain"}</span>
                      </span>
                      <StatusBadge value={s.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* RIGHT — activity */}
        <div className="lg:col-span-2">
          <ActivityFeed
            queryKey={["superadmin-plan-activity", String(id)]}
            fetcher={(params) => superAdminApi.planActivity(id, params)}
            title="Activity"
            description="Creates, edits, status changes and deletions for this plan — with who and when"
            who="the team"
          />
        </div>
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
      <ConfirmDialog
        open={dialog === "delete"}
        title={`Delete ${plan.name}?`}
        message="This permanently removes the plan from the catalog. Activity history for this plan stays in the log."
        confirmLabel="Delete plan"
        confirmTone="danger"
        loading={deleteMut.isPending}
        onCancel={close}
        onConfirm={() => deleteMut.mutate()}
      />
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)]/80 px-3.5 py-3 backdrop-blur-sm">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</dt>
      <dd className="mt-1 text-[18px] font-semibold tabular-nums tracking-tight text-[var(--text-primary)]">{value}</dd>
    </div>
  );
}

function MetaRow({ icon: Icon, label, children }) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
      <span className="inline-flex shrink-0 items-center gap-2.5 text-[var(--text-muted)]">
        <Icon size={15} aria-hidden="true" />
        {label}
      </span>
      <span className="flex min-w-0 justify-end text-end">{children}</span>
    </li>
  );
}

function FeatureToggle({ label, on }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-color)] px-3.5 py-2.5">
      <span className="text-[13px] text-[var(--text-secondary)]">{label}</span>
      <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${on ? "text-[var(--success-text)]" : "text-[var(--text-muted)]"}`}>
        {on ? <Check size={14} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
        {on ? "Included" : "Not included"}
      </span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading plan">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-64" /></div>
      </div>
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div>
        <div className="lg:col-span-2"><Skeleton className="h-[28rem] rounded-xl" /></div>
      </div>
    </div>
  );
}
