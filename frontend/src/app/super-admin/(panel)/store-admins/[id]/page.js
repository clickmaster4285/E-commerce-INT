"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AtSign, Ban, Building2, CalendarPlus, CircleCheck, Clock, ExternalLink, History, Pencil,
  KeyRound, LayoutDashboard, Mail, MapPin, MoreHorizontal, Phone, ShieldCheck,
  Store as StoreIcon,
} from "lucide-react";
import {
  PageHeader, Card, CardHeader, CardBody, Button, StatusBadge, Badge, Avatar,
  Alert, Skeleton, DropdownMenu, ConfirmDialog, EmptyState, StatCard, Modal, TextInput,
} from "@/components/superadmin/ui";
import { PasswordInput, ResetPasswordDialog } from "@/components/superadmin/TeamMemberDialog";
import useOpenStoreAdmin from "@/components/superadmin/useOpenStoreAdmin";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate, formatDateTime, timeAgo } from "@/lib/superadminFormat";

const LIST = "/super-admin/store-admins";

function Row({ icon: Icon, label, children }) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
      <span className="inline-flex shrink-0 items-center gap-2.5 text-[var(--text-muted)]"><Icon size={15} aria-hidden="true" />{label}</span>
      <span className="flex min-w-0 justify-end text-end">{children}</span>
    </li>
  );
}

export default function StoreAdminDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null); // password | status
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", status: "active", password: "", confirmPassword: "" });
  const [notice, setNotice] = useState(null);
  const { openStoreAdmin, openingId } = useOpenStoreAdmin({ onError: (text) => setNotice({ tone: "danger", text }) });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["superadmin-store-admin", String(id)],
    queryFn: () => superAdminApi.getStoreAdmin(id),
    enabled: !!id,
    retry: 1,
  });

  const admin = data?.data?.admin || null;
  const store = data?.data?.store || null;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["superadmin-store-admin", String(id)] });
    qc.invalidateQueries({ queryKey: ["superadmin-store-admins"] });
  };
  const close = () => setDialog(null);
  const ok = (fallback) => (res) => { refresh(); close(); setNotice({ tone: "success", text: res?.message || fallback }); };
  const fail = (fallback) => (err) => { close(); setNotice({ tone: "danger", text: err?.response?.data?.message || fallback }); };
  const statusMut = useMutation({
    mutationFn: (status) => superAdminApi.setStoreAdminStatus(id, status),
    onSuccess: ok("Status updated."),
    onError: fail("Could not update the status."),
  });
  const editMut = useMutation({ mutationFn: () => superAdminApi.updateStoreAdmin(id, editForm), onSuccess: ok("Store admin updated."), onError: fail("Could not update the store admin.") });

  if (isLoading) return <DetailSkeleton />;
  if (isError || !admin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Store admin" backHref={LIST} backLabel="Back to store admins" />
        <Card><EmptyState icon={ShieldCheck} title="This store admin was not found" description="The account may have been deleted." action={<Button variant="secondary" href={LIST}>Back to store admins</Button>} /></Card>
      </div>
    );
  }

  const inactive = admin.status === "inactive";
  const isOwner = admin.role === "storehandler";

  return (
    <div className="space-y-6">
      <PageHeader
        title={admin.name}
        description={`@${admin.username} · ${admin.email}`}
        badge={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={isOwner ? "accent" : "info"} dot={false}>{isOwner ? "Store owner" : "Admin"}</Badge>
            <StatusBadge value={admin.sellerPending ? "pending" : admin.status} />
          </span>
        }
        backHref={LIST}
        backLabel="Back to store admins"
        actions={
          <>
            <Button variant="secondary" icon={KeyRound} onClick={() => setDialog("password")}>Change password</Button>
            <Button variant="secondary" icon={Pencil} onClick={() => { setEditForm({ name: admin.name || "", email: admin.email || "", phone: admin.phone || "", status: admin.status || "active", password: "", confirmPassword: "" }); setDialog("edit"); }}>Edit profile</Button>
            <Button variant="primary" icon={LayoutDashboard} disabled={!store} loading={openingId === String(admin.id)} onClick={() => openStoreAdmin(store?.id)}>Open admin panel</Button>
            <DropdownMenu
              label="More actions"
              icon={MoreHorizontal}
              variant="outline"
              size="md"
              items={[
                inactive
                  ? { label: "Activate account", icon: CircleCheck, onClick: () => setDialog("status") }
                  : { label: "Deactivate account", icon: Ban, onClick: () => setDialog("status") },
                ...(store?.url ? [{ separator: true }, { label: "Visit storefront", icon: ExternalLink, href: store.url, external: true }] : []),
              ]}
            />
          </>
        }
      />

      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}
      {inactive && (
        <Alert tone="warning" title="This account is inactive" action={<Button size="sm" variant="primary" icon={CircleCheck} onClick={() => setDialog("status")}>Activate</Button>}>
          {admin.name} cannot sign in to the store admin panel until the account is activated again.
        </Alert>
      )}
      {admin.sellerPending && (
        <Alert tone="warning" title="Approval pending">
          {admin.name} can browse the admin panel in read-only mode until their signup request is approved.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Account status" value={admin.sellerPending ? "Pending" : inactive ? "Inactive" : "Active"} icon={ShieldCheck} tone={admin.sellerPending ? "neutral" : inactive ? "danger" : "success"} hint={admin.sellerPending ? "Approval pending" : isOwner ? "Full owner access" : "Admin access"} />
        <StatCard label="Store" value={store ? store.name : "No store"} icon={StoreIcon} tone="info" hint={!store ? "Not linked to a store" : admin.sellerPending ? "Pending approval" : `Store status: ${store.status}`} />
        <StatCard label="Member since" value={admin.created_at ? timeAgo(admin.created_at).replace(/ ago$/, "") : "—"} icon={CalendarPlus} tone="neutral" hint={admin.created_at ? formatDateTime(admin.created_at) : undefined} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Card>
          <CardBody className="flex flex-col items-center text-center">
            <Avatar name={admin.name} src={admin.avatar || undefined} size="xl" />
            <p className="mt-3 text-[17px] font-semibold text-[var(--text-primary)]">{admin.name}</p>
            <Badge tone={isOwner ? "accent" : "neutral"} dot={false} className="mt-2">{isOwner ? "Store owner" : "Admin"}</Badge>
          </CardBody>
          <ul className="divide-y divide-[var(--border-color)] border-t border-[var(--border-color)]">
            <Row icon={Mail} label="Email"><a href={`mailto:${admin.email}`} className="truncate font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">{admin.email}</a></Row>
            {admin.phone && <Row icon={Phone} label="Phone"><a href={`tel:${admin.phone}`} className="font-medium tabular-nums text-[var(--text-primary)] hover:text-[var(--accent)]">{admin.phone}</a></Row>}
            {admin.username && <Row icon={AtSign} label="Username"><span className="font-medium text-[var(--text-primary)]">@{admin.username}</span></Row>}
            {admin.created_at && <Row icon={CalendarPlus} label="Joined"><span className="font-medium text-[var(--text-primary)]" title={formatDateTime(admin.created_at)}>{formatDate(admin.created_at)}</span></Row>}
            {admin.updated_at && <Row icon={Clock} label="Last updated"><span className="font-medium text-[var(--text-primary)]" title={formatDateTime(admin.updated_at)}>{timeAgo(admin.updated_at)}</span></Row>}
          </ul>
        </Card>

        <div className="grid grid-cols-1 items-start gap-4 lg:col-span-2 md:grid-cols-2">
          <Card className="md:col-span-2">
            <CardHeader title="Store" description="The store this admin belongs to" icon={StoreIcon} />
            <CardBody>
              {store ? (
                <>
                  <div className="mb-4 flex items-center gap-3">
                    <Avatar name={store.name} src={store.logo || undefined} shape="square" size="lg" />
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-[var(--text-primary)]">{store.name}</p>
                      <p className="truncate text-[12px] text-[var(--text-muted)]">{store.subdomain ? `${store.subdomain}.…` : "No subdomain"}</p>
                    </div>
                  </div>
                  <ul className="divide-y divide-[var(--border-color)]">
                    <Row icon={ShieldCheck} label="Store status">{admin.sellerPending ? <Badge tone="warning">Pending approval</Badge> : <StatusBadge value={store.status} />}</Row>
                    {store.business_category && <Row icon={Building2} label="Category"><span className="font-medium text-[var(--text-primary)]">{store.business_category}</span></Row>}
                    {store.created_at && <Row icon={CalendarPlus} label="Created"><span className="font-medium text-[var(--text-primary)]">{formatDate(store.created_at)}</span></Row>}
                    {store.url && <Row icon={ExternalLink} label="Storefront"><a href={store.url} target="_blank" rel="noreferrer" title={store.url} className="flex max-w-[260px] min-w-0 items-start gap-1 break-all text-start font-medium text-[var(--accent)] hover:underline">{hostFromUrl(store.url)}<ExternalLink size={12} className="mt-0.5 shrink-0" /></a></Row>}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" icon={LayoutDashboard} loading={openingId === String(admin.id)} onClick={() => openStoreAdmin(store.id)}>Open admin panel</Button>
                    <Button size="sm" variant="ghost" icon={ExternalLink} href={store.url} external>Visit storefront</Button>
                  </div>
                </>
              ) : <EmptyState icon={StoreIcon} title="No store linked" description="This admin account is not linked to a store yet." />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Approval timeline" description="Store request and review history" icon={History} />
            <CardBody>
              {admin.approval ? <ol className="relative space-y-5 border-s border-[var(--border-color)] ps-5">
                <TimelineItem title="Store request submitted" date={admin.approval.requestedAt} detail="Seller sent the store application for review." />
                {admin.approval.reviewedAt ? <TimelineItem title={admin.approval.status === "approved" ? "Approved by Super Admin" : "Rejected by Super Admin"} date={admin.approval.reviewedAt} detail={admin.approval.reviewedBy?.name ? `Reviewed by ${admin.approval.reviewedBy.name}` : "Review decision recorded"} tone={admin.approval.status === "approved" ? "success" : "danger"} /> : <TimelineItem title="Awaiting approval" detail="A Super Admin has not recorded a decision yet." tone="warning" />}
              </ol> : <p className="text-sm text-[var(--text-muted)]">No approval request is linked to this admin.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Security" icon={KeyRound} />
            <CardBody className="flex items-center justify-between gap-4 py-4">
              <p className="text-sm font-medium text-[var(--text-primary)]">Password access</p>
              <Button size="sm" variant="primary" icon={KeyRound} onClick={() => setDialog("password")}>Change password</Button>
            </CardBody>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader title="Recent activity" description="Actions performed by this store admin" icon={History} />
            <CardBody>
              {admin.activities?.length ? <ol className="relative space-y-4 border-s border-[var(--border-color)] ps-5">{admin.activities.slice(0, 20).map((entry, index) => <li key={`${entry.timestamp}-${index}`} className="relative"><span className="absolute -start-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-4 ring-[var(--bg-card)]" /><p className="text-[13px] font-medium text-[var(--text-primary)]">{entry.action || "Activity recorded"}</p><p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{entry.category || "System"} · {formatDateTime(entry.timestamp)}</p>{entry.details?.changes?.length ? <ul className="mt-2 space-y-1.5">{entry.details.changes.map((change, changeIndex) => <li key={`${change.field}-${changeIndex}`} className="text-[12px] leading-5 text-[var(--text-secondary)]"><span className="font-semibold text-[var(--text-primary)]">{String(change.field || "Field").replace(/_/g, " ")}:</span> {String(change.oldValue ?? change.before ?? "empty")} <span className="px-1 text-[var(--text-muted)]">→</span> {String(change.newValue ?? change.after ?? "empty")}</li>)}</ul> : null}</li>)}</ol> : <p className="text-sm text-[var(--text-muted)]">No activity recorded yet.</p>}
            </CardBody>
          </Card>
        </div>
      </div>

      {dialog === "password" && (
        <ResetPasswordDialog
          member={{ id: admin.id, name: admin.name }}
          save={(password) => superAdminApi.resetStoreAdminPassword(admin.id, password)}
          onClose={close}
          onSaved={ok("Password updated.")}
          description="Share the new password with them directly — no email is sent. All their active sessions will be signed out."
        />
      )}
      <Modal open={dialog === "edit"} onClose={close} as="form" onSubmit={(event) => { event.preventDefault(); editMut.mutate(); }} title="Edit store admin" icon={Pencil} busy={editMut.isPending} footer={<><Button variant="secondary" onClick={close}>Cancel</Button><Button type="submit" variant="primary" loading={editMut.isPending}>Save changes</Button></>}>
        <div className="space-y-4"><TextInput label="Full name" required value={editForm.name} onChange={(event) => setEditForm((form) => ({ ...form, name: event.target.value }))} /><TextInput label="Email" type="email" required value={editForm.email} onChange={(event) => setEditForm((form) => ({ ...form, email: event.target.value }))} /><TextInput label="Phone" value={editForm.phone} onChange={(event) => setEditForm((form) => ({ ...form, phone: event.target.value }))} /><select className="sa-input" value={editForm.status} onChange={(event) => setEditForm((form) => ({ ...form, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select><div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><PasswordInput label="New password" value={editForm.password} onChange={(value) => setEditForm((form) => ({ ...form, password: value }))} required={false} placeholder="Leave blank to keep current" /><PasswordInput label="Confirm password" value={editForm.confirmPassword} onChange={(value) => setEditForm((form) => ({ ...form, confirmPassword: value }))} required={false} /></div></div>
      </Modal>

      <ConfirmDialog
        open={dialog === "status"}
        title={`${inactive ? "Activate" : "Deactivate"} ${admin.name}?`}
        message={inactive ? "They will be able to sign in to the store admin panel again." : "They will be signed out and won't be able to sign in until reactivated."}
        confirmLabel={inactive ? "Activate" : "Deactivate"}
        confirmTone={inactive ? "success" : "danger"}
        loading={statusMut.isPending}
        onCancel={close}
        onConfirm={() => statusMut.mutate(inactive ? "active" : "inactive")}
      />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading store admin">
      <div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-lg" /><div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-56" /></div></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /></div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl" />
        <div className="space-y-4 lg:col-span-2"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-40 rounded-xl" /></div>
      </div>
    </div>
  );
}

function TimelineItem({ title, date, detail, tone = "accent" }) {
  const color = tone === "success" ? "bg-[var(--success)]" : tone === "danger" ? "bg-[var(--danger)]" : tone === "warning" ? "bg-[var(--warning)]" : "bg-[var(--accent)]";
  return <li className="relative"><span className={`absolute -start-[25px] top-1.5 h-2.5 w-2.5 rounded-full ${color} ring-4 ring-[var(--bg-card)]`} /><p className="text-[13px] font-semibold text-[var(--text-primary)]">{title}</p>{date && <p className="mt-1 text-[12px] font-medium text-[var(--text-secondary)]">{formatDateTime(date)}</p>}<p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{detail}</p></li>;
}
function hostFromUrl(value) { return String(value || "").replace(/^https?:\/\//i, "").replace(/\/$/, ""); }
