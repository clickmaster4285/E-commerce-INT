"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2, XCircle, Mail, Phone, Store as StoreIcon, User, MapPin, Building2, FileText, MessageSquare,
  Pencil, Trash2, ExternalLink, AtSign, Tag, Briefcase, Hash, ShieldCheck, KeyRound, Globe, LayoutDashboard, Clock, MoreHorizontal,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader, Card, CardHeader, CardBody, Button, StatusBadge, Badge, Avatar, Alert, Skeleton, DropdownMenu, ConfirmDialog, Modal, TextArea, EmptyState } from "@/components/superadmin/ui";
import EditRequestDialog from "@/components/superadmin/EditRequestDialog";
import useOpenStoreAdmin from "@/components/superadmin/useOpenStoreAdmin";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
// KYC document links assetUrl se — page ke host par backend (lib/superadminFormat.js),
// taake private /uploads/documents ke saath super admin ka sa_at cookie jaye
import { formatDateTime, timeAgo, assetUrl } from "@/lib/superadminFormat";

const LIST = "/super-admin/applications";

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null); // approve | reject | info | delete | edit
  const [reason, setReason] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [notice, setNotice] = useState(null); // { tone, text }
  const { openStoreAdmin, openingId } = useOpenStoreAdmin({ onError: (text) => setNotice({ tone: "danger", text }) });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["superadmin-application", String(id)],
    queryFn: () => superAdminApi.getRequest(id),
    retry: 1,
    enabled: !!id,
  });
  const item = data?.data || null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["superadmin-application", String(id)] });
    qc.invalidateQueries({ queryKey: ["superadmin-requests"] });
    qc.invalidateQueries({ queryKey: ["superadmin-dashboard"] });
  };
  const fail = (fallback) => (err) => { setDialog(null); setNotice({ tone: "danger", text: err?.response?.data?.message || fallback }); };
  const done = (fallback) => (res) => { refresh(); setDialog(null); setReason(""); setInfoMessage(""); setNotice({ tone: "success", text: res?.message || fallback }); };

  const approveMut = useMutation({ mutationFn: () => superAdminApi.approveRequest(id), onSuccess: done("Seller approved."), onError: fail("Failed to approve the request.") });
  const rejectMut = useMutation({ mutationFn: () => superAdminApi.rejectRequest(id, reason.trim()), onSuccess: done("Request rejected."), onError: fail("Failed to reject the request.") });
  const infoMut = useMutation({ mutationFn: () => superAdminApi.requestInfo(id, infoMessage.trim()), onSuccess: done("Information request sent."), onError: fail("Failed to send the request.") });
  const deleteMut = useMutation({
    mutationFn: () => superAdminApi.deleteRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-requests"] });
      qc.invalidateQueries({ queryKey: ["superadmin-dashboard"] });
      qc.removeQueries({ queryKey: ["superadmin-application", String(id)] });
      router.push(LIST);
    },
    onError: fail("Failed to delete the request."),
  });

  if (isLoading) return <DetailSkeleton />;
  if (isError || !item) {
    return (
      <div className="space-y-6">
        <PageHeader title="Signup request" backHref={LIST} backLabel="Back to signup requests" />
        <Card><EmptyState icon={XCircle} title="This signup request was not found" description="It may have been deleted." action={<Button variant="secondary" href={LIST}>Back to signup requests</Button>} /></Card>
      </div>
    );
  }

  const isPending = item.status === "pending";
  const canDelete = item.status !== "approved";
  const timeline = buildTimeline(item);
  const location = [item.address, item.city, item.country].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.store_name || item.name}
        description={`Seller signup request · submitted ${timeAgo(item.created_at)}`}
        badge={<StatusBadge value={item.status} />}
        backHref={LIST}
        backLabel="Back to signup requests"
        actions={
          <>
            {isPending && (
              <>
                <Button variant="danger-outline" icon={XCircle} onClick={() => setDialog("reject")}>Reject</Button>
                <Button variant="success" icon={CheckCircle2} onClick={() => setDialog("approve")}>Approve seller</Button>
              </>
            )}
            <DropdownMenu
              label="More actions"
              icon={MoreHorizontal}
              variant="outline"
              size="md"
              items={[
                { label: "Request information", icon: MessageSquare, disabled: !isPending, hint: "Only for pending requests", onClick: () => setDialog("info") },
                { label: "Edit details", icon: Pencil, disabled: !isPending, hint: "Only pending requests can be edited", onClick: () => setDialog("edit") },
                { separator: true },
                { label: "Delete request", icon: Trash2, tone: "danger", disabled: !canDelete, hint: "Approved sellers are managed from Stores", onClick: () => setDialog("delete") },
              ]}
            />
          </>
        }
      />

      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

      {item.info_request_message && isPending && (
        <Alert tone="warning" title={`Information requested · ${formatDateTime(item.info_requested_at)}`}>{item.info_request_message}</Alert>
      )}
      {item.status === "rejected" && item.rejection_reason && (
        <Alert tone="danger" title="Rejection reason">{item.rejection_reason}</Alert>
      )}
      {item.status === "approved" && item.store?.url && (
        <Alert tone="success" title="Store is live" action={<div className="flex gap-2"><Button size="sm" variant="secondary" icon={LayoutDashboard} loading={openingId === String(item.store._id)} onClick={() => openStoreAdmin(item.store._id)}>Admin panel</Button><Button size="sm" variant="primary" icon={Globe} href={item.store.url} external>Visit storefront</Button></div>}>
          {item.store.url.replace(/^https?:\/\//, "")}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* LEFT — details */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Avatar name={item.store_name} shape="square" size="xl" src={item.logo?.img_url ? assetUrl(item.logo.img_url) : undefined} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-semibold text-fg">{item.store_name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-fg-muted">
                  <span className="inline-flex items-center gap-1.5"><Tag size={13} aria-hidden="true" />{item.business_category || "No category"}</span>
                  <span className="inline-flex items-center gap-1.5"><Briefcase size={13} aria-hidden="true" />{item.business_type === "registered_business" ? "Registered business" : "Individual"}</span>
                  {location && <span className="inline-flex items-center gap-1.5"><MapPin size={13} aria-hidden="true" />{[item.city, item.country].filter(Boolean).join(", ")}</span>}
                </p>
              </div>
            </CardBody>
            {item.store_description && (
              <div className="border-t border-line px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">About the store</p>
                <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-6 text-fg-secondary">{item.store_description}</p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Seller" description="Contact and login details provided at signup." icon={User} />
            <CardBody className="py-4">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                <Detail label="Full name" value={item.name} />
                <Detail label="Username" value={item.username ? `@${item.username}` : "—"} />
                <Detail label="Email" value={<a href={`mailto:${item.email}`} className="inline-flex items-center gap-1.5 hover:text-accent"><Mail size={13} aria-hidden="true" />{item.email}</a>} />
                <Detail label="Phone" value={item.phone ? <a href={`tel:${item.phone}`} className="inline-flex items-center gap-1.5 tabular-nums hover:text-accent"><Phone size={13} aria-hidden="true" />{item.phone}</a> : "—"} />
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Business location" icon={Building2} />
            <CardBody className="py-4">
              <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                <Detail label="Country" value={item.country || "—"} />
                <Detail label="City" value={item.city || "—"} />
                <Detail label="Street address" value={item.address || "—"} />
                <Detail label="ZIP code" value={item.zip_code || "—"} />
              </dl>
            </CardBody>
          </Card>

          {item.documents?.length ? (
            <Card>
              <CardHeader title="Verification documents" description={`${item.documents.length} file${item.documents.length === 1 ? "" : "s"} uploaded`} icon={FileText} />
              <CardBody className="py-4">
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {item.documents.map((doc, idx) => (
                    <li key={`${doc.url}-${idx}`}>
                      <a href={assetUrl(doc.url)} target="_blank" rel="noreferrer" title={doc.name} className="group flex items-center gap-3 rounded-lg border border-line px-3 py-2.5 transition-colors hover:border-accent hover:bg-accent-soft">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-subtle text-fg-muted group-hover:text-accent"><FileText size={15} aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg">{doc.name}</span>
                        <ExternalLink size={14} className="shrink-0 text-fg-muted" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}
        </div>

        {/* RIGHT — access + timeline */}
        <div className="space-y-4">
          {isPending && (
            <Card className="border-[color-mix(in_srgb,var(--warning)_45%,var(--border-card))]">
              <CardHeader title="Awaiting your decision" icon={Clock} divider={false} />
              <CardBody className="space-y-2.5 pt-0">
                <Button variant="success" icon={CheckCircle2} fullWidth size="lg" onClick={() => setDialog("approve")}>Approve seller</Button>
                <Button variant="secondary" icon={MessageSquare} fullWidth onClick={() => setDialog("info")}>Request information</Button>
                <Button variant="danger-outline" icon={XCircle} fullWidth onClick={() => setDialog("reject")}>Reject request</Button>
                <p className="pt-1 text-[12px] leading-5 text-fg-muted">Approving opens the store, unlocks the seller&apos;s admin panel and emails them a confirmation.</p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Store & access" icon={KeyRound} />
            <ul className="divide-y divide-line">
              <AccessRow icon={StoreIcon} label="Store">{item.store ? <StatusBadge value={item.store.store_status} /> : <span className="text-[13px] text-fg-muted">Not created</span>}</AccessRow>
              {item.store?.url && (
                <AccessRow icon={Globe} label="Store URL">
                  <a href={item.store.url} target="_blank" rel="noreferrer" className="inline-flex max-w-[180px] items-center gap-1 truncate text-[13px] font-medium text-accent hover:underline">
                    <span className="truncate">{item.store.url.replace(/^https?:\/\//, "")}</span><ExternalLink size={12} className="shrink-0" aria-hidden="true" />
                  </a>
                </AccessRow>
              )}
              <AccessRow icon={LayoutDashboard} label="Admin panel">
                {item.account?.adminAccess ? (
                  item.account.adminAccess.status === "inactive" ? <StatusBadge value="inactive" /> : item.account.adminAccess.pending ? <Badge tone="warning">View-only</Badge> : <Badge tone="success">Full access</Badge>
                ) : <span className="text-[13px] text-fg-muted">—</span>}
              </AccessRow>
              <AccessRow icon={ShieldCheck} label="Seller account">{item.account?.user ? <StatusBadge value={item.account.user.status} /> : <span className="text-[13px] text-fg-muted">—</span>}</AccessRow>
            </ul>
          </Card>

          <Card>
            <CardHeader title="Timeline" icon={Hash} />
            <CardBody className="py-4">
              <ol className="relative space-y-4 border-s border-line ps-5">
                {timeline.map((entry, i) => (
                  <li key={`${entry.at}-${i}`} className="relative">
                    <span className="absolute -start-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-card" style={{ background: entry.color }} aria-hidden="true" />
                    <p className="text-[13px] font-medium leading-5 text-fg">{entry.title}</p>
                    <p className="mt-0.5 text-[12px] text-fg-muted">{formatDateTime(entry.at)}{entry.by ? ` · ${entry.by}` : ""}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={dialog === "approve"}
        title="Approve this seller?"
        message={`${item.store_name} will open, ${item.name}'s admin panel will be unlocked, and an approval email will be sent to ${item.email}.`}
        confirmLabel="Approve seller"
        confirmTone="success"
        loading={approveMut.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={() => approveMut.mutate()}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title="Delete this signup request?"
        message={`“${item.store_name}” by ${item.name} will be removed permanently, together with the unused store and the seller's pending login. ${item.email} will be able to sign up again.`}
        confirmLabel="Delete request"
        confirmTone="danger"
        loading={deleteMut.isPending}
        onCancel={() => setDialog(null)}
        onConfirm={() => deleteMut.mutate()}
      />
      <Modal
        open={dialog === "reject"}
        onClose={() => { setDialog(null); setReason(""); }}
        as="form"
        onSubmit={(e) => { e.preventDefault(); if (reason.trim()) rejectMut.mutate(); }}
        icon={XCircle}
        iconTone="danger"
        title="Reject signup request"
        description="The seller receives this reason by email. Be specific so they can fix the issue and reapply."
        busy={rejectMut.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDialog(null); setReason(""); }} disabled={rejectMut.isPending}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={!reason.trim()} loading={rejectMut.isPending}>Reject request</Button>
          </>
        }
      >
        <TextArea label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={500} placeholder="Tell the seller why their request was rejected…" hint={`${reason.length}/500`} autoFocus />
      </Modal>
      <Modal
        open={dialog === "info"}
        onClose={() => { setDialog(null); setInfoMessage(""); }}
        as="form"
        onSubmit={(e) => { e.preventDefault(); if (infoMessage.trim()) infoMut.mutate(); }}
        icon={MessageSquare}
        title="Request additional information"
        description="The seller receives this message by email with a link to update their request."
        busy={infoMut.isPending}
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDialog(null); setInfoMessage(""); }} disabled={infoMut.isPending}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!infoMessage.trim()} loading={infoMut.isPending}>Send request</Button>
          </>
        }
      >
        <TextArea label="Message" required value={infoMessage} onChange={(e) => setInfoMessage(e.target.value)} rows={4} maxLength={2000} placeholder="What additional details do you need?" hint={`${infoMessage.length}/2000`} autoFocus />
      </Modal>
      {dialog === "edit" && <EditRequestDialog item={item} onClose={() => setDialog(null)} onSaved={(res) => setNotice({ tone: "success", text: res?.message || "Request updated." })} />}
    </div>
  );
}

/* Request ki apni dates se timeline (signup → review) — newest first */
function buildTimeline(item) {
  const entries = [{ title: "Signed up and verified email", at: item.created_at, color: "var(--accent)" }];
  if (item.reviewed_at && ["approved", "rejected"].includes(item.status)) {
    entries.push({ title: item.status === "approved" ? "Seller approved" : "Seller rejected", at: item.reviewed_at, color: item.status === "approved" ? "var(--success)" : "var(--danger)" });
  }
  return entries.sort((a, b) => new Date(b.at) - new Date(a.at));
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{label}</dt>
      <dd className="mt-1 break-words text-[13.5px] font-medium text-fg">{value}</dd>
    </div>
  );
}

function AccessRow({ icon: Icon, label, children }) {
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-3">
      <span className="inline-flex items-center gap-2.5 text-[13px] text-fg-secondary"><Icon size={15} className="text-fg-muted" aria-hidden="true" />{label}</span>
      <span className="flex min-w-0 justify-end">{children}</span>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading signup request">
      <div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-lg" /><div className="space-y-2"><Skeleton className="h-6 w-56" /><Skeleton className="h-3.5 w-40" /></div></div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-44 rounded-xl" /><Skeleton className="h-44 rounded-xl" /></div>
        <div className="space-y-4"><Skeleton className="h-52 rounded-xl" /><Skeleton className="h-56 rounded-xl" /></div>
      </div>
    </div>
  );
}
