"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Store as StoreIcon, Globe, ExternalLink, MapPin, Mail, Phone, CalendarDays, Pencil, LayoutDashboard, CirclePause, FileText, History } from "lucide-react";
import { Alert, Avatar, Badge, Button, Card, CardBody, CardHeader, EmptyState, PageHeader, Skeleton, StatusBadge } from "@/components/superadmin/ui";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { assetUrl, formatDateTime, timeAgo } from "@/lib/superadminFormat";
import useOpenStoreAdmin from "@/components/superadmin/useOpenStoreAdmin";
import StoreFormDialog from "@/components/superadmin/StoreFormDialog";

export default function StoreDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(false);
  const { openStoreAdmin, openingId } = useOpenStoreAdmin({ onError: (text) => setNotice({ tone: "danger", text }) });
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["superadmin-store", String(id)],
    queryFn: () => superAdminApi.getStore(id),
    enabled: !!id,
    retry: 1,
  });
  const store = data?.data;
  const statusMutation = useMutation({
    mutationFn: (status) => superAdminApi.setStoreStatus(id, status),
    onSuccess: async (res) => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["superadmin-store", String(id)] }), qc.invalidateQueries({ queryKey: ["superadmin-stores"] }), qc.invalidateQueries({ queryKey: ["superadmin-dashboard"] })]);
      setNotice({ tone: "success", text: res?.message || "Store status updated." });
    },
    onError: (err) => setNotice({ tone: "danger", text: err?.response?.data?.message || "Could not update the store status." }),
  });
  const onSaved = (res) => {
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["superadmin-store", String(id)] });
    qc.invalidateQueries({ queryKey: ["superadmin-stores"] });
    setNotice({ tone: "success", text: res?.message || "Store details saved." });
  };

  if (isLoading) return <StoreDetailSkeleton />;
  if (isError || !store) return <div className="space-y-5"><PageHeader title="Store details" backHref="/super-admin/stores" backLabel="Back to stores" /><Card><EmptyState icon={StoreIcon} title="Store could not be found" description="It may have been removed or the link may be invalid." action={<Button variant="secondary" onClick={() => isError ? refetch() : router.push("/super-admin/stores")}>{isError ? "Try again" : "Back to stores"}</Button>} /></Card></div>;

  const status = store.status || store.store_status || "open";
  const location = [store.address, store.city, store.state, store.zip_code, store.country].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <PageHeader
        title={store.store_name || "Store details"}
        description={`Store profile · Created ${timeAgo(store.createdAt) || "date unavailable"}`}
        badge={<StatusBadge value={store.approvalStatus === "pending" ? "pending" : status} />}
        backHref="/super-admin/stores"
        backLabel="Back to stores"
        actions={<>
          <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>Edit details</Button>
          {status !== "closed" && <Button variant="danger-outline" icon={CirclePause} loading={statusMutation.isPending} onClick={() => statusMutation.mutate("closed")}>Suspend store</Button>}
        </>}
      />
      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 bg-subtle p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={store.store_name} shape="square" size="lg" src={store.logo_url ? assetUrl(store.logo_url) : undefined} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-xl font-semibold text-fg">{store.store_name}</h2><StatusBadge value={store.approvalStatus === "pending" ? "pending" : status} /></div>
              <p className="mt-1 text-sm text-fg-secondary">{store.tagline || store.business_category || "Store profile"}</p>
              <p className="mt-1 flex min-w-0 items-start gap-1.5 break-all text-xs text-fg-muted"><MapPin size={13} className="mt-0.5 shrink-0" />{location || "Location not provided"}</p>
              {store.url && <a href={store.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full min-w-0 items-start gap-1.5 break-all text-xs font-medium text-accent hover:underline"><Globe size={13} className="mt-0.5 shrink-0" />{hostFromUrl(store.url)}<ExternalLink size={12} className="mt-0.5 shrink-0" /></a>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={LayoutDashboard} loading={openingId === String(id)} onClick={() => openStoreAdmin(id)}>Open admin panel</Button>
            <Button variant="primary" icon={ExternalLink} href={store.url || undefined} external disabled={!store.url}>Visit storefront</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 divide-y divide-line border-t border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Summary icon={CalendarDays} label="Created" value={formatDateTime(store.createdAt)} />
          <Summary icon={MapPin} label="Location" value={[store.city, store.country].filter(Boolean).join(", ") || "Not specified"} />
          <Summary icon={Mail} label="Contact" value={store.email || store.phone || "Not specified"} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="space-y-5 xl:col-span-2">
          <Card><CardHeader title="Store profile" description="Business identity and contact information" icon={StoreIcon} /><CardBody className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <Detail icon={StoreIcon} label="Business category" value={store.business_category} />
            <Detail icon={Mail} label="Store email" value={store.email} href={store.email ? `mailto:${store.email}` : null} />
            <Detail icon={Phone} label="Store phone" value={store.phone} href={store.phone ? `tel:${store.phone}` : null} />
            <div className="sm:col-span-2"><Detail icon={FileText} label="Description" value={store.description} multiline /></div>
          </CardBody></Card>

          <Card><CardHeader title="Location" description="Store address provided during setup" icon={MapPin} /><CardBody className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Detail icon={MapPin} label="Address" value={location} multiline /></div>
            <Detail icon={MapPin} label="Country" value={store.country} />
            <Detail icon={MapPin} label="City" value={store.city} />
            <Detail icon={MapPin} label="ZIP code" value={store.zip_code} />
          </CardBody></Card>
          <Card><CardHeader title="Recent activity" description="Actions performed by Super Admin and store employees" icon={History} /><CardBody>
            {store.activity?.length ? <ol className="relative space-y-4 border-s border-line ps-5">{store.activity.slice(0, 20).map((entry, index) => <li key={`${entry.at}-${index}`} className="relative"><span className="absolute -start-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-card" /><p className="text-[13px] font-medium text-fg">{entry.summary || entry.action}</p><p className="mt-0.5 text-[12px] text-fg-muted">{entry.actorName || "System"} · {entry.actorType === "superadmin" ? "Super Admin" : entry.actorType === "employee" ? "Employee" : "System"} · {formatDateTime(entry.at)}</p>{entry.details?.changes?.length ? <ul className="mt-2 space-y-1.5">{entry.details.changes.map((change, changeIndex) => <li key={`${change.field}-${changeIndex}`} className="text-[12px] leading-5 text-fg-secondary"><span className="font-semibold text-fg">{formatField(change.field)}:</span> {displayValue(change.oldValue ?? change.before)} <span className="px-1 text-fg-muted">→</span> {displayValue(change.newValue ?? change.after)}</li>)}</ul> : entry.details?.from !== undefined ? <p className="mt-2 text-[12px] text-fg-secondary"><span className="font-semibold text-fg">Status:</span> {entry.details.from} <span className="px-1 text-fg-muted">→</span> {entry.details.to}</p> : null}</li>)}</ol> : <p className="text-sm text-fg-muted">No activity recorded yet.</p>}
          </CardBody></Card>
        </div>
        <aside className="space-y-5">
          <Card><CardHeader title="Store status" description="Manage storefront availability" icon={CirclePause} /><CardBody className="space-y-4"><div className="flex items-center justify-between gap-2"><span className="text-sm text-fg-secondary">Current status</span><StatusBadge value={status} /></div><p className="text-xs leading-5 text-fg-muted">Use the action above to activate or suspend this storefront.</p></CardBody></Card>
          {store.maintenance_message && <Card><CardHeader title="Maintenance notice" icon={CirclePause} /><CardBody><p className="whitespace-pre-wrap text-sm leading-6 text-fg-secondary">{store.maintenance_message}</p></CardBody></Card>}
        </aside>
      </div>
      {editing && <StoreFormDialog store={{ ...store, id: String(store.id || store._id), logo_url: store.logo_url }} onClose={() => setEditing(false)} onSaved={onSaved} />}
    </div>
  );
}

function Summary({ icon: Icon, label, value }) { return <div className="flex items-center gap-3 px-5 py-4"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon size={16} /></span><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted">{label}</p><p className="mt-0.5 break-words text-sm font-medium text-fg">{value || "Not specified"}</p></div></div>; }
function Detail({ icon: Icon, label, value, href, external, multiline, badge }) {
  return <div className="min-w-0"><dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-fg-muted"><Icon size={13} />{label}</dt><dd className={`mt-1.5 min-w-0 break-words text-[13px] font-medium text-fg ${multiline ? "whitespace-pre-wrap leading-5" : ""}`}>{value ? href ? <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="inline-flex max-w-full min-w-0 items-start gap-1 break-all text-accent hover:underline">{value}{external && <ExternalLink size={12} className="mt-0.5 shrink-0" />}</a> : badge !== null && badge !== undefined ? <Badge tone={badge ? "success" : "warning"}>{value}</Badge> : value : <span className="font-normal text-fg-muted">Not provided</span>}</dd></div>;
}
function Setting({ label, children }) { return <div className="flex items-center justify-between gap-3 px-5 py-3"><span className="text-[12px] text-fg-muted">{label}</span><span className="text-right text-[12px] font-medium text-fg">{children}</span></div>; }
function formatField(value) { return String(value || "Field").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function displayValue(value) { return value === "" || value === null || value === undefined ? "empty" : String(value); }
function hostFromUrl(value) { return value?.replace(/^https?:\/\//i, "").replace(/\/$/, "") || ""; }
function StoreDetailSkeleton() { return <div className="space-y-5" aria-busy="true" aria-label="Loading store details"><div className="space-y-2"><Skeleton className="h-7 w-64" /><Skeleton className="h-4 w-48" /></div><Skeleton className="h-52 rounded-xl" /><div className="grid grid-cols-1 gap-5 xl:grid-cols-3"><div className="space-y-5 xl:col-span-2"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div><Skeleton className="h-80 rounded-xl" /></div></div>; }
