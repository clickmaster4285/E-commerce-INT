"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Phone, Ban, CircleCheck, ShieldCheck, ShieldAlert, Store as StoreIcon, ExternalLink, LayoutDashboard, ShoppingBag, Wallet, CalendarPlus, Clock, History, ClipboardList, Globe, Cake, KeyRound, Users, Pencil, Trash2, MoreHorizontal } from "lucide-react";
import { PageHeader, Card, CardHeader, CardBody, Button, StatusBadge, Badge, Avatar, Alert, Skeleton, ConfirmDialog, EmptyState, StatCard, DropdownMenu } from "@/components/superadmin/ui";
import EditUserDialog from "@/components/superadmin/EditUserDialog";
import useOpenStoreAdmin from "@/components/superadmin/useOpenStoreAdmin";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate, formatDateTime, timeAgo, assetUrl } from "@/lib/superadminFormat";

const LIST = "/super-admin/users";
const money = (n) => `Rs ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
const ORDER_TONE = { delivered: "success", completed: "success", paid: "success", shipped: "info", processing: "info", pending: "warning", cancelled: "danger", canceled: "danger", returned: "danger", refunded: "neutral" };

export default function UserDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState(null);
  const { openStoreAdmin, openingId } = useOpenStoreAdmin({ onError: (text) => setNotice({ tone: "danger", text }) });
  const deleteMut = useMutation({
    mutationFn: () => superAdminApi.deleteUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-users"] }); qc.removeQueries({ queryKey: ["superadmin-user", String(id)] }); router.push(LIST); },
    onError: (err) => { setDeleting(false); setNotice({ tone: "danger", text: err?.response?.data?.message || "Could not delete the account." }); },
  });

  const { data, isLoading, isError } = useQuery({ queryKey: ["superadmin-user", String(id)], queryFn: () => superAdminApi.getUser(id), enabled: !!id, retry: 1 });
  const d = data?.data || null;
  const user = d?.user || null;

  const statusMut = useMutation({
    mutationFn: (to) => superAdminApi.setUserStatus(id, to),
    onSuccess: (res, to) => {
      qc.invalidateQueries({ queryKey: ["superadmin-user", String(id)] });
      qc.invalidateQueries({ queryKey: ["superadmin-users"] });
      setConfirm(false);
      setNotice({ tone: "success", text: res?.message || (to === "blocked" ? "Account blocked." : "Account unblocked.") });
    },
    onError: (err) => { setConfirm(false); setNotice({ tone: "danger", text: err?.response?.data?.message || "Could not update the account." }); },
  });

  if (isLoading) return <DetailSkeleton />;
  if (isError || !user) {
    return (
      <div className="space-y-6">
        <PageHeader title="User" backHref={LIST} backLabel="Back to users" />
        <Card><EmptyState icon={Users} title="This user was not found" description="The account may have been deleted." action={<Button variant="secondary" href={LIST}>Back to users</Button>} /></Card>
      </div>
    );
  }

  const blocked = user.status === "blocked";
  const isSeller = user.type === "Seller";
  const store = d.store;

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.name}
        description={`@${user.username} · ${user.email}`}
        badge={<span className="inline-flex items-center gap-2"><StatusBadge value={isSeller ? "seller" : "customer"} dot={false} /><StatusBadge value={user.status} /></span>}
        backHref={LIST}
        backLabel="Back to users"
        actions={
          <>
            {store?.url && <Button variant="secondary" icon={LayoutDashboard} loading={openingId === String(store.id)} onClick={() => openStoreAdmin(store.id)}>Admin panel</Button>}
            <Button variant="primary" icon={Pencil} onClick={() => setEditing(true)}>Edit details</Button>
            <DropdownMenu
              label="More actions"
              icon={MoreHorizontal}
              variant="outline"
              size="md"
              items={[
                ...(store?.url ? [{ label: "Visit storefront", icon: ExternalLink, href: store.url, external: true }, { separator: true }] : []),
                ...(user.provider !== "google" ? [{ label: "Change password", icon: KeyRound, onClick: () => setEditing("password") }] : []),
                blocked
                  ? { label: "Unblock account", icon: CircleCheck, onClick: () => setConfirm(true) }
                  : { label: "Block account", icon: Ban, onClick: () => setConfirm(true) },
                { label: "Delete account", icon: Trash2, tone: "danger", onClick: () => setDeleting(true) },
              ]}
            />
          </>
        }
      />

      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}
      {blocked && <Alert tone="danger" title="This account is blocked" action={<Button size="sm" variant="primary" icon={CircleCheck} onClick={() => setConfirm(true)}>Unblock</Button>}>{user.name} cannot sign in until the account is unblocked. Existing orders are unaffected.</Alert>}
      {!user.emailVerified && <Alert tone="warning" title="Email not verified">{user.name} has not completed email verification yet{user.provider === "google" ? "" : " — they may not be able to sign in"}.</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Orders" value={d.orders.count} icon={ShoppingBag} tone="accent" hint={d.orders.last_at ? `Last order ${timeAgo(d.orders.last_at)}` : "No orders yet"} />
        <StatCard label="Total spent" value={money(d.orders.total)} icon={Wallet} tone="success" hint="Across all stores" />
        {isSeller
          ? <StatCard label="Store" value={store ? (store.status === "open" ? "Open" : store.status === "closed" ? "Suspended" : "Maintenance") : "—"} icon={StoreIcon} tone={store?.status === "open" ? "success" : "danger"} hint={store?.name || "No store linked"} href={store?.url ? undefined : undefined} />
          : <StatCard label="Account" value={user.provider === "google" ? "Google" : "Email"} icon={KeyRound} tone="info" hint={user.emailVerified ? "Email verified" : "Email not verified"} />}
        <StatCard label="Member since" value={timeAgo(user.created_at).replace(/ ago$/, "")} icon={CalendarPlus} tone="neutral" hint={formatDateTime(user.created_at)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* LEFT — profile + store */}
        <div className="space-y-4">
          <Card>
            <CardBody className="flex flex-col items-center text-center">
              <Avatar name={user.name} size="xl" src={user.avatar ? assetUrl(user.avatar) : undefined} />
              <p className="mt-3 text-[17px] font-semibold text-[var(--text-primary)]">{user.name}</p>
              <p className="mt-0.5 font-mono text-[12.5px] text-[var(--text-muted)]">@{user.username}</p>
            </CardBody>
            <ul className="divide-y divide-[var(--border-color)] border-t border-[var(--border-color)]">
              <Row icon={Mail} label="Email"><a href={`mailto:${user.email}`} className="truncate font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">{user.email}</a></Row>
              <Row icon={user.emailVerified ? ShieldCheck : ShieldAlert} label="Verification">{user.emailVerified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}</Row>
              <Row icon={Phone} label="Phone">{user.phone ? <a href={`tel:${user.phone}`} className="font-medium tabular-nums text-[var(--text-primary)] hover:text-[var(--accent)]">{user.phone}</a> : <span className="text-[var(--text-muted)]">Not set</span>}</Row>
              <Row icon={KeyRound} label="Sign-in method"><span className="font-medium text-[var(--text-primary)]">{user.provider === "google" ? "Google" : "Email & password"}</span></Row>
              {user.provider !== "google" && (
                <Row icon={KeyRound} label="Password">
                  <span className="flex items-center gap-2.5">
                    <span className="text-[15px] font-semibold leading-none tracking-[0.12em] text-[var(--text-primary)]" title="Encrypted — can't be viewed, only changed">••••••••</span>
                    <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing("password")}>Change</Button>
                  </span>
                </Row>
              )}
              {user.dob && <Row icon={Cake} label="Date of birth"><span className="font-medium text-[var(--text-primary)]">{formatDate(user.dob)}</span></Row>}
              <Row icon={Clock} label="Last updated"><span className="font-medium text-[var(--text-primary)]" title={formatDateTime(user.updated_at)}>{timeAgo(user.updated_at)}</span></Row>
            </ul>
          </Card>

          {isSeller && (
            <Card>
              <CardHeader title="Store" description="The storefront this seller owns" icon={StoreIcon} />
              {store ? (
                <>
                  <CardBody className="flex items-center gap-3 py-4">
                    <Avatar name={store.name} shape="square" size="lg" src={store.logo ? assetUrl(store.logo) : undefined} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{store.name}</p>
                      <p className="truncate text-[12px] text-[var(--text-muted)]">{store.category || "No category"}{store.created_at ? ` · since ${formatDate(store.created_at)}` : ""}</p>
                    </div>
                    <StatusBadge value={store.status} />
                  </CardBody>
                  <ul className="divide-y divide-[var(--border-color)] border-t border-[var(--border-color)]">
                    <Row icon={Globe} label="Storefront">{store.url ? <a href={store.url} target="_blank" rel="noreferrer" className="inline-flex max-w-[190px] items-center gap-1 truncate text-[13px] font-medium text-[var(--accent)] hover:underline"><span className="truncate">{store.url.replace(/^https?:\/\//, "")}</span><ExternalLink size={12} className="shrink-0" aria-hidden="true" /></a> : <span className="text-[var(--text-muted)]">No subdomain</span>}</Row>
                    <Row icon={ClipboardList} label="Application">{d.application ? <StatusBadge value={d.application.status} /> : <span className="text-[var(--text-muted)]">—</span>}</Row>
                    <Row icon={LayoutDashboard} label="Admin panel">{d.adminAccess ? (d.adminAccess.status === "inactive" ? <StatusBadge value="inactive" /> : d.adminAccess.pending ? <Badge tone="warning">View-only</Badge> : <Badge tone="success">Full access</Badge>) : <span className="text-[var(--text-muted)]">—</span>}</Row>
                  </ul>
                  <div className="flex gap-2 border-t border-[var(--border-color)] px-5 py-3">
                    {d.application && <Button size="sm" variant="secondary" icon={ClipboardList} href={`/super-admin/applications/${d.application.id}`}>Signup request</Button>}
                    {store.url && <Button size="sm" variant="secondary" icon={LayoutDashboard} loading={openingId === String(store.id)} onClick={() => openStoreAdmin(store.id)}>Admin panel</Button>}
                  </div>
                </>
              ) : (
                <EmptyState icon={StoreIcon} title="No store linked" description={d.application ? `Signup request is ${d.application.status}.` : "This seller has no store record."} compact action={d.application && <Button size="sm" variant="secondary" href={`/super-admin/applications/${d.application.id}`}>View signup request</Button>} />
              )}
            </Card>
          )}
        </div>

        {/* RIGHT — orders + history */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Recent orders" description={d.orders.count ? `Latest ${d.recentOrders.length} of ${d.orders.count} orders · ${money(d.orders.total)} total` : "Orders placed by this user across all stores"} icon={ShoppingBag} />
            {d.recentOrders.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="No orders yet" description={`${user.name} hasn't placed an order on any store.`} compact />
            ) : (
              <ul className="divide-y divide-[var(--border-color)]">
                {d.recentOrders.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-muted)]"><ShoppingBag size={15} aria-hidden="true" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-[var(--text-primary)]">#{o.order_number}{o.store?.name ? <span className="font-normal text-[var(--text-muted)]"> · {o.store.name}</span> : null}</p>
                      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]" title={formatDateTime(o.created_at)}>{formatDateTime(o.created_at)} · {timeAgo(o.created_at)}</p>
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">{money(o.total)}</span>
                    <Badge tone={ORDER_TONE[String(o.status || "").toLowerCase()] || "neutral"} className="shrink-0 capitalize">{o.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Account history" description="Actions taken on this account by the Super Admin team" icon={History} />
            {d.history.length === 0 ? (
              <EmptyState icon={History} title="No actions recorded" description="Blocks and unblocks will be listed here." compact />
            ) : (
              <CardBody className="py-4">
                <ol className="relative space-y-4 border-s border-[var(--border-color)] ps-5">
                  {d.history.map((h) => (
                    <li key={h.id} className="relative">
                      <span className="absolute -start-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-4 ring-[var(--bg-card)]" aria-hidden="true" />
                      <p className="text-[13px] font-medium leading-5 text-[var(--text-primary)]">{h.title || h.action}</p>
                      {h.description && <p className="mt-0.5 text-[12.5px] leading-5 text-[var(--text-muted)]">{h.description}</p>}
                      <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{formatDateTime(h.at)}{h.by ? ` · by ${h.by}` : ""}</p>
                    </li>
                  ))}
                </ol>
              </CardBody>
            )}
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={`${blocked ? "Unblock" : "Block"} ${user.name}?`}
        message={blocked ? "They will be able to sign in again right away." : "They won't be able to sign in until you unblock them. Existing orders are not affected."}
        confirmLabel={blocked ? "Unblock account" : "Block account"}
        confirmTone={blocked ? "success" : "danger"}
        loading={statusMut.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => statusMut.mutate(blocked ? "active" : "blocked")}
      />
      <ConfirmDialog
        open={deleting}
        title={`Delete ${user.name}'s account?`}
        message={store ? `They can no longer sign in, and their admin login for “${store.name}” is deactivated. The store and its orders are kept — manage them from Stores.` : "They can no longer sign in. Their past orders are kept for your records."}
        confirmLabel="Delete account"
        confirmTone="danger"
        loading={deleteMut.isPending}
        onCancel={() => setDeleting(false)}
        onConfirm={() => deleteMut.mutate()}
      />
      {editing && <EditUserDialog user={user} focus={editing === "password" ? "password" : undefined} onClose={() => setEditing(false)} onSaved={(res) => setNotice({ tone: "success", text: res?.message || "User updated." })} />}
    </div>
  );
}

function Row({ icon: Icon, label, children }) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3 text-[13px]">
      <span className="inline-flex shrink-0 items-center gap-2.5 text-[var(--text-muted)]"><Icon size={15} aria-hidden="true" />{label}</span>
      <span className="flex min-w-0 justify-end text-end">{children}</span>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading user">
      <div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-lg" /><div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-64" /></div></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4"><Skeleton className="h-96 rounded-xl" /><Skeleton className="h-56 rounded-xl" /></div>
        <div className="space-y-4 lg:col-span-2"><Skeleton className="h-72 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
      </div>
    </div>
  );
}
