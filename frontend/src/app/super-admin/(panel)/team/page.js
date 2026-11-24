"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Pencil, KeyRound, Ban, CircleCheck, Trash2, Users, UserCheck, UserX, Loader2, Eye, Phone } from "lucide-react";
import { PageHeader, Card, CardToolbar, SearchInput, DataTable, EntityCell, Avatar, StatusBadge, Badge, Alert, Button, DropdownMenu, ConfirmDialog, StatCard } from "@/components/superadmin/ui";
import TeamMemberDialog, { ResetPasswordDialog } from "@/components/superadmin/TeamMemberDialog";
import { superAdminApi } from "@/apis/superadmin/superAdminApi";
import { formatDate, formatDateTime, timeAgo } from "@/lib/superadminFormat";

// Team = sirf staff accounts (super admin yahan list nahi hota)

export default function TeamPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState(null); // { type: "create" | "edit" | "password" | "status" | "delete", member? }
  const [notice, setNotice] = useState(null);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["superadmin-team"],
    queryFn: superAdminApi.listTeam,
    retry: 1,
  });
  const members = useMemo(() => data?.data?.items || [], [data]);
  const counts = data?.data?.counts || {};

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (!q) return true;
      return [m.name, m.email, m.phone].some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [members, search]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["superadmin-team"] });
  const close = () => setDialog(null);
  const ok = (fallback) => (res) => { invalidate(); close(); setNotice({ tone: "success", text: res?.message || fallback }); };
  const fail = (fallback) => (err) => { close(); setNotice({ tone: "danger", text: err?.response?.data?.message || fallback }); };

  const statusMut = useMutation({ mutationFn: ({ id, status }) => superAdminApi.setTeamMemberStatus(id, status), onSuccess: ok("Status updated."), onError: fail("Could not update the status.") });
  const deleteMut = useMutation({ mutationFn: (id) => superAdminApi.deleteTeamMember(id), onSuccess: ok("Team member removed."), onError: fail("Could not remove the team member.") });

  const columns = [
    {
      key: "member", header: "Member",
      cell: (m) => (
        <EntityCell
          avatar={<Avatar name={m.name} />}
          primary={<span className="inline-flex items-center gap-2">{m.name}{m.isSelf && <Badge tone="accent" dot={false}>You</Badge>}</span>}
          secondary={m.email}
          maxWidth={320}
        />
      ),
    },
    {
      key: "phone", header: "Phone", className: "whitespace-nowrap",
      cell: (m) => m.phone ? <span className="inline-flex items-center gap-1.5 tabular-nums text-fg-secondary"><Phone size={13} className="text-fg-muted" aria-hidden="true" />{m.phone}</span> : <span className="text-fg-muted">—</span>,
    },
    { key: "status", header: "Status", cell: (m) => <StatusBadge value={m.status} /> },
    {
      key: "lastLogin", header: "Last sign-in", className: "whitespace-nowrap",
      cell: (m) => m.lastLoginAt
        ? (<><p className="font-medium text-fg">{timeAgo(m.lastLoginAt)}</p><p className="mt-0.5 text-[12px] text-fg-muted">{formatDateTime(m.lastLoginAt)}</p></>)
        : <span className="text-fg-muted">Never</span>,
    },
    {
      key: "added", header: "Added", className: "whitespace-nowrap",
      cell: (m) => (<><p className="font-medium text-fg">{formatDate(m.created_at)}</p><p className="mt-0.5 text-[12px] text-fg-muted">{m.createdBy?.name ? `by ${m.createdBy.name}` : m.isSeed ? "from server config" : "—"}</p></>),
    },
    {
      key: "actions", header: <span className="sr-only">Actions</span>, align: "end", width: 56, stopRowClick: true,
      cell: (m) => {
        // canManage backend se aata hai: staff → apna account nahi, super admin accounts nahi
        const locked = !m.canManage;
        const lockHint = m.isSelf ? "You cannot change your own account" : "Only super admins can change this account";
        const destructiveLocked = locked || m.isSelf || m.isSeed;
        const destructiveHint = locked ? lockHint : m.isSelf ? "You cannot do this to your own account" : "The primary super admin account is protected";
        return (
          <DropdownMenu
            label={`Actions for ${m.name}`}
            items={[
              { label: "View profile", icon: Eye, href: `/super-admin/team/${m.id}` },
              { label: "Edit details", icon: Pencil, disabled: locked, hint: lockHint, onClick: () => setDialog({ type: "edit", member: m }) },
              { label: "Reset password", icon: KeyRound, disabled: locked, hint: lockHint, onClick: () => setDialog({ type: "password", member: m }) },
              { separator: true },
              m.status === "inactive"
                ? { label: "Activate", icon: CircleCheck, disabled: locked, hint: lockHint, onClick: () => setDialog({ type: "status", member: m, next: "active" }) }
                : { label: "Deactivate", icon: Ban, disabled: destructiveLocked, hint: destructiveHint, onClick: () => setDialog({ type: "status", member: m, next: "inactive" }) },
              { label: "Remove from team", icon: Trash2, tone: "danger", disabled: destructiveLocked, hint: destructiveHint, onClick: () => setDialog({ type: "delete", member: m }) },
            ]}
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Staff accounts that can sign in to the Super Admin panel."
        actions={<Button variant="primary" icon={UserPlus} onClick={() => setDialog({ type: "create" })}>Add staff member</Button>}
      />

      {notice && <Alert tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Staff members" value={counts.all ?? 0} icon={Users} tone="accent" hint="Full access; can manage other staff" loading={isLoading} />
        <StatCard label="Active" value={counts.active ?? 0} icon={UserCheck} tone="success" hint="Can sign in right now" loading={isLoading} />
        <StatCard label="Inactive" value={counts.inactive ?? 0} icon={UserX} tone={counts.inactive ? "danger" : "neutral"} hint={counts.inactive ? "Sign-in blocked until reactivated" : "Nobody is deactivated"} loading={isLoading} />
      </div>

      <Card>
        <CardToolbar>
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email or phone…" label="Search team" />
          {isFetching && !isLoading && <Loader2 size={16} className="animate-spin text-fg-muted" aria-label="Refreshing" />}
        </CardToolbar>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(m) => m.id}
          loading={isLoading}
          skeletonRows={3}
          onRowClick={(m) => router.push(`/super-admin/team/${m.id}`)}
          error={isError ? { title: "Couldn't load the team", action: <Button size="sm" variant="secondary" onClick={() => refetch()}>Retry</Button> } : null}
          empty={{ icon: Users, title: search ? "No staff match your search" : "No staff members yet", description: search ? "Try a different name or email." : "Add staff so you don't have to share your own login.", action: !search && <Button size="sm" variant="primary" icon={UserPlus} onClick={() => setDialog({ type: "create" })}>Add staff member</Button> }}
        />
      </Card>

      {dialog?.type === "create" && <TeamMemberDialog member={null} onClose={close} onSaved={ok("Team member added.")} />}
      {dialog?.type === "edit" && <TeamMemberDialog member={dialog.member} onClose={close} onSaved={ok("Team member updated.")} />}
      {dialog?.type === "password" && <ResetPasswordDialog member={dialog.member} onClose={close} onSaved={ok("Password updated.")} />}

      <ConfirmDialog
        open={dialog?.type === "status"}
        title={dialog?.type === "status" ? `${dialog.next === "active" ? "Activate" : "Deactivate"} ${dialog.member.name}?` : ""}
        message={dialog?.next === "active" ? "They will be able to sign in to the Super Admin panel again." : "They will be signed out on their next request and won't be able to sign in until reactivated."}
        confirmLabel={dialog?.next === "active" ? "Activate" : "Deactivate"}
        confirmTone={dialog?.next === "active" ? "success" : "danger"}
        loading={statusMut.isPending}
        onCancel={close}
        onConfirm={() => statusMut.mutate({ id: dialog.member.id, status: dialog.next })}
      />
      <ConfirmDialog
        open={dialog?.type === "delete"}
        title={dialog?.type === "delete" ? `Remove ${dialog.member.name} from the team?` : ""}
        message="Their Super Admin login is deleted permanently. Activity they performed stays in the log."
        confirmLabel="Remove member"
        confirmTone="danger"
        loading={deleteMut.isPending}
        onCancel={close}
        onConfirm={() => deleteMut.mutate(dialog.member.id)}
      />
    </div>
  );
}
