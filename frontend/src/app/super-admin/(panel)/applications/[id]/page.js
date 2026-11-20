"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2, XCircle, Mail, Phone, Store as StoreIcon, User, MapPin, Building2, FileText, MessageSquare,
  Pencil, Trash2, ExternalLink, AtSign, Tag, Briefcase, Hash, CalendarClock, ShieldCheck, KeyRound, Loader2, Globe, LayoutDashboard,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/superadmin/PageHeader";
import StatusBadge from "@/components/superadmin/StatusBadge";
import ConfirmDialog from "@/components/superadmin/ConfirmDialog";
import EditRequestDialog from "@/components/superadmin/EditRequestDialog";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDateTime, timeAgo, initials, assetUrl } from "@/lib/superadminFormat";

const errorBox = { background: "var(--danger-soft)", color: "var(--danger-text)", borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)" };

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

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
    qc.invalidateQueries({ queryKey: ["superadmin-stats"] });
  };

  const approveMut = useMutation({
    mutationFn: () => superAdminApi.approveRequest(id),
    onSuccess: (res) => { refresh(); setApproveOpen(false); setNotice(res?.message || "Seller approved."); },
    onError: (err) => { setActionError(err?.response?.data?.message || "Failed to approve"); setApproveOpen(false); },
  });
  const rejectMut = useMutation({
    mutationFn: () => superAdminApi.rejectRequest(id, reason.trim()),
    onSuccess: (res) => { refresh(); setRejectOpen(false); setReason(""); setNotice(res?.message || "Application rejected."); },
    onError: (err) => { setActionError(err?.response?.data?.message || "Failed to reject"); setRejectOpen(false); },
  });
  const infoMut = useMutation({
    mutationFn: () => superAdminApi.requestInfo(id, infoMessage.trim()),
    onSuccess: (res) => { refresh(); setInfoOpen(false); setInfoMessage(""); setNotice(res?.message || "Information request sent."); },
    onError: (err) => { setActionError(err?.response?.data?.message || "Failed to send request"); },
  });
  const deleteMut = useMutation({
    mutationFn: () => superAdminApi.deleteRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["superadmin-requests"] });
      qc.invalidateQueries({ queryKey: ["superadmin-stats"] });
      qc.removeQueries({ queryKey: ["superadmin-application", String(id)] });
      router.push("/super-admin/applications");
    },
    onError: (err) => { setActionError(err?.response?.data?.message || "Failed to delete the request."); setDeleteOpen(false); },
  });

  const doApprove = () => { setActionError(""); approveMut.mutate(); };
  const doReject = () => {
    setActionError("");
    if (!reason.trim()) { setActionError("A rejection reason is required."); return; }
    rejectMut.mutate();
  };
  const doRequestInfo = () => {
    setActionError("");
    if (!infoMessage.trim()) { setActionError("A message is required."); return; }
    infoMut.mutate();
  };

  if (isLoading) {
    return (
      <div className="card flex items-center justify-center gap-2 p-10 text-sm text-[var(--text-muted)]">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Loading signup request…
      </div>
    );
  }
  if (isError || !item) {
    return (
      <div className="space-y-4">
        <PageHeader title="Signup request" breadcrumbs={[{ label: "Super Admin" }, { label: "Signup Requests", href: "/super-admin/applications" }, { label: "Not found" }]} />
        <div className="card p-6 text-sm text-[var(--danger-text)]">This signup request was not found. It may have been deleted.</div>
      </div>
    );
  }

  const isPending = item.status === "pending";
  const canDelete = item.status !== "approved";
  const timeline = buildTimeline(item);

  return (
    <div className="space-y-5">
      <PageHeader
        title={item.store_name || item.name}
        description={`Signup request from ${item.name}`}
        breadcrumbs={[{ label: "Super Admin" }, { label: "Signup Requests", href: "/super-admin/applications" }, { label: item.store_name || item.name }]}
        badge={<StatusBadge value={item.status} />}
        actions={
          <>
            <button type="button" onClick={() => { setActionError(""); setEditOpen(true); }} disabled={!isPending} title={isPending ? "Edit request" : "Only pending requests can be edited"} className="btn-secondary h-10 px-4 disabled:cursor-not-allowed disabled:opacity-50">
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
            <button type="button" onClick={() => { setActionError(""); setDeleteOpen(true); }} disabled={!canDelete} title={canDelete ? "Delete request" : "Approved sellers are managed from Store Management"} className="btn-danger h-10 px-4 disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 size={15} aria-hidden="true" /> Delete
            </button>
          </>
        }
      />

      {notice && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-[13px] font-medium" style={{ background: "var(--success-soft, rgba(16,185,129,0.1))", color: "var(--success-text, #047857)", borderColor: "color-mix(in srgb, var(--success, #10b981) 35%, transparent)" }}>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} className="text-[12px] font-semibold underline-offset-2 hover:underline">Dismiss</button>
        </div>
      )}

      {/* Summary */}
      <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] text-lg font-bold text-[var(--accent)]">
          {item.logo?.img_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={assetUrl(item.logo.img_url)} alt="Store logo" className="h-full w-full object-contain" />
          ) : initials(item.store_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold text-[var(--text-primary)]">{item.store_name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--text-muted)]">
            <span className="inline-flex items-center gap-1.5"><User size={13} aria-hidden="true" />{item.name}</span>
            <a href={`mailto:${item.email}`} className="inline-flex items-center gap-1.5 hover:text-[var(--accent)]"><Mail size={13} aria-hidden="true" />{item.email}</a>
            {item.business_category && <span className="inline-flex items-center gap-1.5"><Tag size={13} aria-hidden="true" />{item.business_category}</span>}
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] px-4 py-2.5 sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Registered</p>
          <p className="mt-0.5 text-[13.5px] font-semibold text-[var(--text-primary)]">{formatDateTime(item.created_at)}</p>
          <p className="text-[12px] text-[var(--text-muted)]">{timeAgo(item.created_at)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* LEFT — details */}
        <div className="space-y-5 lg:col-span-7 xl:col-span-8">
          <Section title="Seller details" description="Contact and login information provided at signup.">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Detail icon={User} label="Full name" value={item.name} />
              <Detail icon={Mail} label="Email" value={<a href={`mailto:${item.email}`} className="hover:text-[var(--accent)]">{item.email}</a>} />
              <Detail icon={Phone} label="Phone" value={item.phone ? <a href={`tel:${item.phone}`} className="tabular-nums hover:text-[var(--accent)]">{item.phone}</a> : "—"} />
              <Detail icon={AtSign} label="Username" value={item.username || "—"} />
            </dl>
          </Section>

          <Section title="Store details" description="How the store will appear to buyers.">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Detail icon={StoreIcon} label="Store name" value={item.store_name || "—"} />
              <Detail icon={Tag} label="Category" value={item.business_category || "—"} />
              <Detail icon={Briefcase} label="Business type" value={item.business_type === "registered_business" ? "Registered business" : "Individual"} />
            </dl>
            <div className="mt-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Description</p>
              <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-6 text-[var(--text-secondary)]">{item.store_description || "No description provided."}</p>
            </div>
          </Section>

          <Section title="Business location">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <Detail icon={MapPin} label="Country" value={item.country || "—"} />
              <Detail icon={Building2} label="City" value={item.city || "—"} />
              <Detail icon={MapPin} label="Street address" value={item.address || "—"} />
              <Detail icon={Hash} label="ZIP code" value={item.zip_code || "—"} />
            </dl>
          </Section>

          {item.documents?.length ? (
            <Section title="Verification documents">
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {item.documents.map((doc, idx) => (
                  <li key={`${doc.url}-${idx}`}>
                    <a href={assetUrl(doc.url)} target="_blank" rel="noreferrer" title={doc.name} className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-alt)] px-3 py-2 transition hover:border-[var(--accent)]">
                      <FileText size={15} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                      <span className="min-w-0 truncate text-[12px] font-semibold text-[var(--text-primary)]">{doc.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {item.info_request_message ? (
            <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">Information requested · {formatDateTime(item.info_requested_at)}</p>
              <p className="mt-1.5 text-sm leading-6 text-amber-900">{item.info_request_message}</p>
            </div>
          ) : null}

          {item.status === "rejected" && item.rejection_reason && (
            <div className="rounded-xl border p-4" style={{ background: "var(--danger-soft)", borderColor: "color-mix(in srgb, var(--danger) 32%, transparent)" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--danger-text)]">Rejection reason</p>
              <p className="mt-1 text-sm leading-6 text-[var(--danger-text)]">{item.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* RIGHT — actions, access, timeline */}
        <div className="space-y-5 lg:col-span-5 xl:col-span-4">
          <Section title="Review">
            {actionError && <div role="alert" className="mb-3 rounded-lg border px-3 py-2 text-xs font-semibold" style={errorBox}>{actionError}</div>}
            {isPending ? (
              <div className="flex flex-col gap-2.5">
                <button type="button" onClick={() => setApproveOpen(true)} disabled={approveMut.isPending} className="btn-primary h-11 disabled:cursor-not-allowed disabled:opacity-50">
                  <CheckCircle2 size={17} aria-hidden="true" /> Approve seller
                </button>
                <button type="button" onClick={() => { setInfoOpen((v) => !v); setRejectOpen(false); setActionError(""); }} disabled={infoMut.isPending} className="btn-secondary h-11">
                  <MessageSquare size={17} aria-hidden="true" /> {infoOpen ? "Hide request form" : "Request information"}
                </button>
                <button type="button" onClick={() => { setRejectOpen((v) => !v); setInfoOpen(false); setActionError(""); }} disabled={rejectMut.isPending} className="btn-danger h-11">
                  <XCircle size={17} aria-hidden="true" /> {rejectOpen ? "Hide reject form" : "Reject"}
                </button>
                <p className="pt-1 text-[12px] leading-5 text-[var(--text-muted)]">
                  Approving opens the seller&apos;s store, unlocks their admin panel and sends an approval email.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] p-4 text-[13px] text-[var(--text-secondary)]">
                  <p className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">Review complete <StatusBadge value={item.status} /></p>
                  {item.reviewed_at && <p className="mt-1 text-[12px] text-[var(--text-muted)]">{formatDateTime(item.reviewed_at)} · {timeAgo(item.reviewed_at)}</p>}
                </div>

                {/* Approved → store live: customer storefront + seller admin panel (naye tab me) */}
                {item.status === "approved" && item.store?.url ? (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Store is live</p>
                    <StoreLink
                      href={item.store.url}
                      icon={Globe}
                      title="Visit storefront"
                      subtitle="Open the store as a customer sees it"
                      primary
                    />
                    <StoreLink
                      href={`${item.store.url}/admin`}
                      icon={LayoutDashboard}
                      title="Open admin panel"
                      subtitle="Seller dashboard — sign-in required"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </Section>

          <Section title="Store & access">
            <ul className="space-y-3 text-[13px]">
              <AccessRow icon={StoreIcon} label="Store">
                {item.store ? <StatusBadge value={item.store.store_status} /> : <span className="text-[var(--text-muted)]">Not created</span>}
              </AccessRow>
              {item.store?.url && (
                <AccessRow icon={ExternalLink} label="Store URL">
                  <a href={item.store.url} target="_blank" rel="noreferrer" className="max-w-[180px] truncate font-medium text-[var(--accent)] hover:underline">
                    {item.store.url.replace(/^https?:\/\//, "")}
                  </a>
                </AccessRow>
              )}
              <AccessRow icon={KeyRound} label="Admin panel">
                {item.account?.adminAccess ? (
                  item.account.adminAccess.status === "inactive" ? <StatusBadge value="inactive" />
                    : item.account.adminAccess.pending ? <span className="badge badge-warning">View-only</span>
                      : <span className="badge badge-success">Full access</span>
                ) : <span className="text-[var(--text-muted)]">—</span>}
              </AccessRow>
              <AccessRow icon={ShieldCheck} label="Seller account">
                {item.account?.user ? <StatusBadge value={item.account.user.status} /> : <span className="text-[var(--text-muted)]">—</span>}
              </AccessRow>
            </ul>
          </Section>

          <Section title="Activity">
            <ol className="relative space-y-4 border-s border-[var(--border-color)] ps-5">
              {timeline.map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="relative">
                  <span className={`absolute -start-[25px] top-1 flex h-2.5 w-2.5 rounded-full ring-4 ring-[var(--bg-card)] ${entry.dot}`} aria-hidden="true" />
                  <p className="text-[13px] font-medium leading-5 text-[var(--text-primary)]">{entry.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
                    <CalendarClock size={12} aria-hidden="true" />
                    <span title={formatDateTime(entry.at)}>{formatDateTime(entry.at)}</span>
                    {entry.by ? <span>· {entry.by}</span> : null}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
        </div>
      </div>

      {infoOpen && isPending && (
        <div className="card space-y-3 p-5 sm:p-6">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Request additional information</h2>
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">The seller receives this message by email with a link to update their request.</p>
          </div>
          <textarea autoFocus value={infoMessage} onChange={(e) => setInfoMessage(e.target.value)} rows={4} maxLength={2000} placeholder="What additional details do you need?" aria-label="Information request" className="input-field w-full" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] tabular-nums text-[var(--text-muted)]">{infoMessage.length}/2000</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setInfoOpen(false); setInfoMessage(""); setActionError(""); }} className="btn-secondary h-10 px-4">Cancel</button>
              <button type="button" onClick={doRequestInfo} disabled={!infoMessage.trim() || infoMut.isPending} className="btn-primary h-10 px-4 disabled:opacity-50">{infoMut.isPending ? "Sending…" : "Send request"}</button>
            </div>
          </div>
        </div>
      )}

      {rejectOpen && isPending && (
        <div className="card space-y-3 p-5 sm:p-6">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Reject signup request</h2>
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">The seller receives this reason by email. It is required.</p>
          </div>
          <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={500} placeholder="Tell the seller why their request was rejected…" aria-label="Rejection reason" className="input-field w-full" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] tabular-nums text-[var(--text-muted)]">{reason.length}/500</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setRejectOpen(false); setReason(""); setActionError(""); }} className="btn-secondary h-10 px-4">Cancel</button>
              <button type="button" onClick={doReject} disabled={!reason.trim() || rejectMut.isPending} className="btn-danger h-10 px-4 disabled:opacity-50">{rejectMut.isPending ? "Rejecting…" : "Reject request"}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={approveOpen}
        title="Approve this seller?"
        message={`${item.store_name} will open, ${item.name}'s admin panel will be unlocked, and an approval email will be sent to ${item.email}.`}
        confirmLabel="Approve seller"
        confirmTone="success"
        loading={approveMut.isPending}
        onCancel={() => setApproveOpen(false)}
        onConfirm={doApprove}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Delete this signup request?"
        message={`“${item.store_name}” by ${item.name} will be removed permanently, together with the unused store and the seller's pending login. ${item.email} will be able to sign up again.`}
        confirmLabel="Delete request"
        confirmTone="danger"
        loading={deleteMut.isPending}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => deleteMut.mutate()}
      />
      {editOpen && <EditRequestDialog item={item} onClose={() => setEditOpen(false)} onSaved={(res) => setNotice(res?.message || "Request updated.")} />}
    </div>
  );
}

/* Submitted + super admin actions (audit log) + review — newest first */
function buildTimeline(item) {
  const entries = [{ title: "Signed up and verified email", at: item.created_at, dot: "bg-[var(--accent)]" }];
  for (const a of item.activity || []) {
    const action = String(a.action || "");
    const dot = /approved/i.test(action) ? "bg-emerald-500" : /rejected|deleted/i.test(action) ? "bg-red-500" : /info/i.test(action) ? "bg-amber-500" : "bg-slate-400";
    entries.push({ title: action.replace(/\s—\s.*$/, ""), at: a.created_at, by: a.actor?.name, dot });
  }
  // Purane records jinke liye audit log nahi bana
  if (item.reviewed_at && !(item.activity || []).some((a) => /approved|rejected/i.test(a.action))) {
    entries.push({ title: item.status === "approved" ? "Seller approved" : "Seller rejected", at: item.reviewed_at, dot: item.status === "approved" ? "bg-emerald-500" : "bg-red-500" });
  }
  return entries.sort((a, b) => new Date(b.at) - new Date(a.at));
}

function Section({ title, description, children }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{title}</h2>
        {description && <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</dt>
        <dd className="mt-0.5 break-words text-[13.5px] font-semibold text-[var(--text-primary)]">{value}</dd>
      </div>
    </div>
  );
}

function StoreLink({ href, icon: Icon, title, subtitle, primary = false }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
        primary
          ? "border-transparent bg-[var(--accent)] text-white hover:brightness-110"
          : "border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-primary)] hover:border-[var(--accent)]"
      }`}
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${primary ? "bg-white/15" : "bg-[var(--bg-tertiary)] text-[var(--accent)]"}`}>
        <Icon size={17} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold">{title}</span>
        <span className={`block truncate text-[12px] ${primary ? "text-white/80" : "text-[var(--text-muted)]"}`}>{subtitle}</span>
      </span>
      <ExternalLink size={15} className={`shrink-0 transition-transform group-hover:translate-x-0.5 ${primary ? "text-white/80" : "text-[var(--text-muted)]"}`} aria-hidden="true" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

function AccessRow({ icon: Icon, label, children }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-[var(--text-muted)]"><Icon size={15} aria-hidden="true" />{label}</span>
      <span className="flex min-w-0 justify-end">{children}</span>
    </li>
  );
}
