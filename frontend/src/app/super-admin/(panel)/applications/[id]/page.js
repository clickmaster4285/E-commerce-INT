"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Shield, Mail, Phone, Store as StoreIcon, User } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PageHeader from "@/components/superadmin/PageHeader";
import StatusBadge from "@/components/superadmin/StatusBadge";
import ConfirmDialog from "@/components/superadmin/ConfirmDialog";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["superadmin-application", id],
    queryFn: () => superAdminApi.getRequest(id),
    retry: 1,
    enabled: !!id,
  });

  const item = data?.data || null;
  const approveMut = useMutation({
    mutationFn: () => superAdminApi.approveRequest(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-application", id] }); },
    onError: (err) => { setActionError(err?.response?.data?.message || "Failed to approve"); setApproveOpen(false); },
  });
  const rejectMut = useMutation({
    mutationFn: () => superAdminApi.rejectRequest(id, reason.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-application", id] }); setRejectOpen(false); setReason(""); },
    onError: (err) => { setActionError(err?.response?.data?.message || "Failed to reject"); setRejectOpen(false); },
  });

  const doApprove = () => { setActionError(""); approveMut.mutate(); };
  const doReject = () => {
    setActionError("");
    if (!reason.trim()) {
      setActionError("A rejection reason is required.");
      return;
    }
    rejectMut.mutate();
  };

  if (isLoading) {
    return <div className="card p-10 text-center text-sm text-[var(--text-muted)]">Loading application…</div>;
  }
  if (isError || !item) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Application"
          breadcrumbs={[{ label: "Super Admin" }, { label: "Signup Requests", href: "/super-admin/applications" }, { label: "Not found" }]}
        />
        <div className="card p-6 text-sm text-[var(--danger-text)]">{actionError || "Application not found."}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={item.name}
        description="Review the application and approve or reject it."
        breadcrumbs={[{ label: "Super Admin" }, { label: "Signup Requests", href: "/super-admin/applications" }, { label: item.name }]}
        badge={<StatusBadge value={item.status} />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="card lg:col-span-7 p-5 sm:p-6">
          <div className="border-b border-[var(--border-color)] pb-4">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Applicant details</h2>
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">What the seller told us when applying.</p>
          </div>

          <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <Detail icon={Mail} label="Email" value={item.email} />
            <Detail icon={Phone} label="Phone" value={item.phone || "—"} />
            <Detail icon={User} label="Username" value={item.username || "—"} />
            <Detail icon={StoreIcon} label="Requested store" value={item.store_name} />
            <Detail icon={Shield} label="Submitted" value={new Date(item.created_at).toLocaleString()} />
            <Detail icon={Shield} label="Reviewed" value={item.reviewed_at ? new Date(item.reviewed_at).toLocaleString() : "Not yet reviewed"} />
          </dl>

          {item.store_description && (
            <div className="mt-5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Store description</p>
              <p className="mt-1.5 text-sm leading-6 text-[var(--text-secondary)]">{item.store_description}</p>
            </div>
          )}

          {item.status === "rejected" && item.rejection_reason && (
            <div className="mt-4 rounded-xl border p-4" style={{ background: "var(--danger-soft)", borderColor: "color-mix(in srgb, var(--danger) 32%, transparent)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--danger-text)]">Rejection reason</p>
              <p className="mt-1 text-sm leading-6 text-[var(--danger-text)]">{item.rejection_reason}</p>
            </div>
          )}
        </div>

        <div className="card lg:col-span-5 p-5 sm:p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-muted)]">Review actions</h2>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Approved sellers are provisioned with a store and account instantly.</p>
          </div>

          {actionError && (
            <div
              role="alert"
              className="rounded-lg border px-3 py-2 text-xs font-semibold"
              style={{ background: "var(--danger-soft)", color: "var(--danger-text)", borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)" }}
            >
              {actionError}
            </div>
          )}

          {item.status === "pending" ? (
            <>
              <button type="button" onClick={() => setApproveOpen(true)} disabled={approveMut.isPending} className="btn-primary h-12">
                <CheckCircle2 size={18} aria-hidden="true" /> Approve & provision seller
              </button>
              <button type="button" onClick={() => { setRejectOpen((v) => !v); setActionError(""); }} disabled={rejectMut.isPending} className="btn-danger h-12">
                <XCircle size={18} aria-hidden="true" /> {rejectOpen ? "Hide reject form" : "Reject application"}
              </button>
            </>
          ) : (
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] p-4 text-sm text-[var(--text-secondary)]">
              <p className="font-bold text-[var(--text-primary)]">Review complete</p>
              <p className="mt-1">This application has been <StatusBadge value={item.status} />.</p>
            </div>
          )}

          <div className="mt-auto rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-alt)] p-4 text-[11px] leading-5 text-[var(--text-muted)]">
            <p className="font-bold text-[var(--text-primary)]">What happens on approval?</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>A tenant Store is created with the requested details.</li>
              <li>A seller account is created (customer login works immediately).</li>
              <li>The store status becomes <strong>Open</strong>; the seller signs in at <code>/login</code> and receives an approval email.</li>
            </ol>
          </div>
        </div>
      </div>

      {rejectOpen && item.status === "pending" && (
        <div className="card space-y-3 p-5 sm:p-6">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Reject application</h2>
            <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
              The applicant will receive this reason by email. It is required.
            </p>
          </div>
          <textarea
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Tell the applicant why their application was rejected…"
            aria-label="Rejection reason"
            className="input-field w-full"
          />
          <p className="text-[11px] tabular-nums text-[var(--text-muted)]">{reason.length}/500</p>
          {actionError && (
            <p role="alert" className="rounded-lg border px-3 py-2 text-xs font-medium" style={{ background: "var(--danger-soft)", color: "var(--danger-text)", borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)" }}>
              {actionError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => { setRejectOpen(false); setReason(""); setActionError(""); }} className="btn-secondary h-11">
              Cancel
            </button>
            <button type="button" onClick={doReject} disabled={!reason.trim() || rejectMut.isPending} className="btn-danger h-11">
              {rejectMut.isPending ? "Rejecting…" : "Reject application"}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog open={approveOpen} title="Approve & provision store?" message="This will create the tenant store and seller account now and email the applicant. This cannot be undone from here." confirmLabel="Approve seller" confirmTone="success" loading={approveMut.isPending} onCancel={() => setApproveOpen(false)} onConfirm={doApprove} />
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={16} className="mt-0.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">{label}</dt>
        <dd className="mt-0.5 break-words text-[13px] font-semibold text-[var(--text-primary)]">{value}</dd>
      </div>
    </div>
  );
}
