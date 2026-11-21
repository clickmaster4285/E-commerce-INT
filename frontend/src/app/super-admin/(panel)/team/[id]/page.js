"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Phone, Pencil, KeyRound, Ban, CircleCheck, Trash2, ShieldCheck, UserCog, Clock, CalendarPlus, Activity, LogIn, Hash, ClipboardList, Store, Users, Settings, MoreHorizontal, Check, Wifi, History } from "lucide-react";
import { PageHeader, Card, CardHeader, CardBody, Button, StatusBadge, Badge, Avatar, Alert, Skeleton, DropdownMenu, ConfirmDialog, EmptyState, StatCard } from "@/components/superadmin/ui";
import TeamMemberDialog, { ResetPasswordDialog } from "@/components/superadmin/TeamMemberDialog";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDateTime, timeAgo } from "@/lib/superadminFormat";

const LIST = "/super-admin/team";
const STAFF_CAN = ["Dashboard and reports", "Seller signup requests — review, approve, reject", "Stores — create, edit, suspend", "Users — block and unblock"];

export default function TeamMemberPage() {
  const { id } = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(null); // edit | password | status | delete
  const [notice, setNotice] = useState(null);

  // har minute refresh — Online / Last seen up to date rahe
  const { data, isLoading, isError } = useQuery({ queryKey: ["superadmin-team-member", String(id)], queryFn: () => superAdminApi.getTeamMember(id), enabled: !!id, retry: 1, refetchInterval: 60 * 1000 });
  const member = data?.data?.member || null;

  const refresh = () => { qc.invalidateQueries({ queryKey: ["superadmin-team-member", String(id)] }); qc.invalidateQueries({ queryKey: ["superadmin-team"] }); };
  const close = () => setDialog(null);
  const ok = (fallback) => (res) => { refresh(); close(); setNotice({ tone: "success", text: res?.message || fallback }); };
  const fail = (fallback) => (err) => { close(); setNotice({ tone: "danger", text: err?.response?.data?.message || fallback }); };
  const statusMut = useMutation({ mutationFn: (status) => superAdminApi.setTeamMemberStatus(id, status), onSuccess: ok("Status updated."), onError: fail("Could not update the status.") });
  const deleteMut = useMutation({
    mutationFn: () => superAdminApi.deleteTeamMember(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["superadmin-team"] }); qc.removeQueries({ queryKey: ["superadmin-team-member", String(id)] }); router.push(LIST); },
    onError: fail("Could not remove the team member."),
  });

  if (isLoading) return <DetailSkeleton />;
  if (isError || !member) {
    return (
      <div className="space-y-6">
        <PageHeader title="Team member" backHref={LIST} backLabel="Back to team" />
        <Card><EmptyState icon={Users} title="This team member was not found" description="They may have been removed." action={<Button variant="secondary" href={LIST}>Back to team</Button>} /></Card>
      </div>
    );
  }

  const isSuper = member.role === "superadmin";
  // canManage backend se: staff → apna account nahi, super admin accounts nahi
  const locked = !member.canManage;
  const lockHint = member.isSelf ? "You cannot change your own account" : "Only super admins can change this account";
  const protectedAcct = locked || member.isSelf || member.isSeed;
  const hint = locked ? lockHint : member.isSelf ? "You cannot do this to your own account" : "The primary super admin account is protected";
  const inactive = member.status === "inactive";

  return (
    <div className="space-y-6">
      <PageHeader
        title={member.name}
        description={member.email}
        badge={<span className="inline-flex items-center gap-2"><StatusBadge value={member.status} />{member.isSelf && <Badge tone="accent" dot={false}>You</Badge>}</span>}
        backHref={LIST}
        backLabel="Back to team"
        actions={
          <>
            <Button variant="secondary" icon={KeyRound} disabled={locked} title={locked ? lockHint : undefined} onClick={() => setDialog("password")}>Reset password</Button>
            <Button variant="primary" icon={Pencil} disabled={locked} title={locked ? lockHint : undefined} onClick={() => setDialog("edit")}>Edit details</Button>
            <DropdownMenu
              label="More actions"
              icon={MoreHorizontal}
              variant="outline"
              size="md"
              items={[
                inactive
                  ? { label: "Activate account", icon: CircleCheck, disabled: locked, hint: lockHint, onClick: () => setDialog("status") }
                  : { label: "Deactivate account", icon: Ban, disabled: protectedAcct, hint, onClick: () => setDialog("status") },
                { separator: true },
                { label: "Remove from team", icon: Trash2, tone: "danger", disabled: protectedAcct, hint, onClick: () => setDialog("delete") },
              ]}
            />
          </>
        }
      />

      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}
      {inactive && <Alert tone="warning" title="This account is deactivated" action={!locked && <Button size="sm" variant="primary" icon={CircleCheck} onClick={() => setDialog("status")}>Activate</Button>}>{member.name} cannot sign in to the Super Admin panel until the account is activated again.</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Status" value={member.online ? "Online now" : member.lastActiveAt ? "Offline" : "Never active"} icon={Wifi} tone={member.online ? "success" : "neutral"} hint={member.online ? "Active in the last 5 minutes" : member.lastActiveAt ? `Last seen ${timeAgo(member.lastActiveAt)}` : "Has never signed in"} />
        <StatCard label="Last sign-in" value={member.lastLoginAt ? timeAgo(member.lastLoginAt) : "Never"} icon={LogIn} tone="info" hint={member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Has never signed in"} />
        <StatCard label="Member since" value={member.created_at ? timeAgo(member.created_at).replace(/ ago$/, "") : "—"} icon={CalendarPlus} tone="neutral" hint={member.created_at ? formatDateTime(member.created_at) : undefined} />
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {/* Profile + access */}
        <div className="contents">
          <Card>
            <CardBody className="flex flex-col items-center text-center">
              <Avatar name={member.name} size="xl" />
              <p className="mt-3 text-[17px] font-semibold text-[var(--text-primary)]">{member.name}</p>
              <Badge tone={isSuper ? "accent" : "neutral"} dot={false} className="mt-2">
                {isSuper ? <ShieldCheck size={12} aria-hidden="true" /> : <UserCog size={12} aria-hidden="true" />}
                {isSuper ? "Super admin" : "Staff"}
              </Badge>
              {member.isSeed && <p className="mt-2 text-[12px] text-[var(--text-muted)]">Primary account from server config</p>}
            </CardBody>
            <ul className="divide-y divide-[var(--border-color)] border-t border-[var(--border-color)]">
              <Row icon={Mail} label="Email"><a href={`mailto:${member.email}`} className="truncate font-medium text-[var(--text-primary)] hover:text-[var(--accent)]">{member.email}</a></Row>
              <Row icon={Phone} label="Phone">{member.phone ? <a href={`tel:${member.phone}`} className="font-medium tabular-nums text-[var(--text-primary)] hover:text-[var(--accent)]">{member.phone}</a> : <span className="text-[var(--text-muted)]">Not set</span>}</Row>
              <Row icon={Wifi} label="Status">{member.online ? <span className="inline-flex items-center gap-1.5 font-medium text-[var(--success-text)]"><span className="h-2 w-2 rounded-full bg-[var(--success-text)]" aria-hidden="true" />Online now</span> : <span className="font-medium text-[var(--text-primary)]" title={member.lastActiveAt ? formatDateTime(member.lastActiveAt) : undefined}>{member.lastActiveAt ? `Last seen ${timeAgo(member.lastActiveAt)}` : "Never active"}</span>}</Row>
              <Row icon={Clock} label="Last sign-in">{member.lastLoginAt ? <span title={formatDateTime(member.lastLoginAt)} className="font-medium text-[var(--text-primary)]">{timeAgo(member.lastLoginAt)}</span> : <span className="text-[var(--text-muted)]">Never</span>}</Row>
              <Row icon={CalendarPlus} label="Member since"><span className="font-medium text-[var(--text-primary)]" title={member.created_at ? formatDateTime(member.created_at) : undefined}>{member.created_at ? timeAgo(member.created_at) : "—"}</span></Row>
              <Row icon={CalendarPlus} label="Added by">{member.createdBy?.name ? <span className="font-medium text-[var(--text-primary)]">{member.createdBy.name}</span> : <span className="text-[var(--text-muted)]">{member.isSeed ? "Server config" : "—"}</span>}</Row>
            </ul>
          </Card>

          <Card>
            <CardHeader title="Access" description={isSuper ? "Full control of the platform" : "Full access; manages other staff only"} icon={isSuper ? ShieldCheck : UserCog} />
            <CardBody className="py-4">
              <ul className="space-y-2">
                {STAFF_CAN.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13px] text-[var(--text-secondary)]"><Check size={14} className="mt-0.5 shrink-0 text-[var(--success-text)]" aria-hidden="true" />{item}</li>
                ))}
                <li className="flex items-start gap-2 text-[13px] text-[var(--text-secondary)]">
                  <Check size={14} className="mt-0.5 shrink-0 text-[var(--success-text)]" aria-hidden="true" />
                  {isSuper ? "Team — add, edit and remove any member" : "Team — add and manage other staff"}
                </li>
                {!isSuper && (
                  <li className="flex items-start gap-2 text-[13px] text-[var(--text-muted)]">
                    <Ban size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                    Cannot change their own account or any super admin
                  </li>
                )}
              </ul>
            </CardBody>
          </Card>
        </div>

      </div>

      <Card>
        <CardHeader title="Recent activity" description="Actions performed by this Super Admin employee" icon={History} />
        <CardBody>
          {member.activities?.length ? <ol className="relative space-y-4 border-s border-[var(--border-color)] ps-5">{member.activities.slice(0, 30).map((entry, index) => <li key={`${entry.timestamp}-${index}`} className="relative"><span className="absolute -start-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-4 ring-[var(--bg-card)]" /><p className="text-[13px] font-medium text-[var(--text-primary)]">{entry.action}</p><p className="mt-0.5 text-[12px] text-[var(--text-muted)]">{entry.category || "System"} · {formatDateTime(entry.timestamp)}</p></li>)}</ol> : <p className="text-sm text-[var(--text-muted)]">No activity recorded yet.</p>}
        </CardBody>
      </Card>

      {dialog === "edit" && <TeamMemberDialog member={member} onClose={close} onSaved={ok("Team member updated.")} />}
      {dialog === "password" && <ResetPasswordDialog member={member} onClose={close} onSaved={ok("Password updated.")} />}
      <ConfirmDialog
        open={dialog === "status"}
        title={`${inactive ? "Activate" : "Deactivate"} ${member.name}?`}
        message={inactive ? "They will be able to sign in to the Super Admin panel again." : "They will be signed out on their next request and won't be able to sign in until reactivated."}
        confirmLabel={inactive ? "Activate" : "Deactivate"}
        confirmTone={inactive ? "success" : "danger"}
        loading={statusMut.isPending}
        onCancel={close}
        onConfirm={() => statusMut.mutate(inactive ? "active" : "inactive")}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        title={`Remove ${member.name} from the team?`}
        message="Their Super Admin login is deleted permanently."
        confirmLabel="Remove member"
        confirmTone="danger"
        loading={deleteMut.isPending}
        onCancel={close}
        onConfirm={() => deleteMut.mutate()}
      />
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
    <div className="space-y-6" aria-busy="true" aria-label="Loading team member">
      <div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-lg" /><div className="space-y-2"><Skeleton className="h-6 w-48" /><Skeleton className="h-3.5 w-56" /></div></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3"><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /><Skeleton className="h-28 rounded-xl" /></div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4"><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
        <div className="space-y-4 lg:col-span-2"><Skeleton className="h-72 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>
      </div>
    </div>
  );
}
