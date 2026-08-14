"use client";

import { useState, useTransition } from "react";
import { UserPlus, Trash2, AlertCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { inviteMemberSchema, type InviteMemberInput } from "@/lib/validations/organization";
import { inviteMember, updateMemberRole, removeMember } from "@/lib/actions/organizations";
import { initials } from "@/lib/utils";
import { ROLE_LABELS, ORG_ROLES } from "@/types/crm";
import type { OrganizationMemberWithProfile, OrgRole } from "@/types/crm";

interface MembersTableProps {
  members: OrganizationMemberWithProfile[];
  currentUserId: string;
}

export function MembersTable({ members: initialMembers, currentUserId }: MembersTableProps) {
  const [members, setMembers] = useState(initialMembers);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError: setFormError,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { role: "sales_rep" },
  });

  async function onInvite(values: InviteMemberInput) {
    const result = await inviteMember(values);
    if (result.success) {
      reset({ email: "", role: "sales_rep" });
      // Membership list is revalidated server-side; a full reload of this
      // table's data would need a refetch action — simplest is a page
      // refresh, left to the browser's next navigation for now.
      setError(null);
      alert(`Invite sent to ${result.data.email}.`);
    } else if (result.fieldErrors) {
      for (const [field, messages] of Object.entries(result.fieldErrors)) {
        setFormError(field as keyof InviteMemberInput, { message: messages[0] });
      }
    } else {
      setError(result.error);
    }
  }

  async function handleRoleChange(membershipId: string, role: OrgRole) {
    setPendingId(membershipId);
    const result = await updateMemberRole({ membershipId, role });
    setPendingId(null);
    if (result.success) {
      setMembers((prev) => prev.map((m) => (m.id === membershipId ? { ...m, role } : m)));
    } else {
      setError(result.error);
    }
  }

  async function handleRemove(membershipId: string) {
    if (!confirm("Remove this member from the organization?")) return;
    setPendingId(membershipId);
    const result = await removeMember(membershipId);
    setPendingId(null);
    if (result.success) {
      setMembers((prev) => prev.filter((m) => m.id !== membershipId));
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleSubmit(onInvite)}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-zinc-200 bg-white p-3"
      >
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Email</span>
          <input
            type="email"
            {...register("email")}
            placeholder="teammate@company.com"
            className="w-64 rounded-md border border-zinc-200 px-3 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
          />
          {errors.email && <span className="text-xs text-red-600">{errors.email.message}</span>}
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Role</span>
          <select
            {...register("role")}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm focus:border-zinc-400 focus:outline-none"
          >
            {ORG_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          <UserPlus className="size-4" />
          Invite
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/60 text-left text-xs text-zinc-500">
              <th className="px-3 py-2.5 font-medium">Member</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Role</th>
              <th className="px-3 py-2.5 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-zinc-50 last:border-0">
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-medium text-white">
                      {initials(member.profile.full_name ?? member.profile.email)}
                    </span>
                    <div>
                      <p className="text-zinc-800">{member.profile.full_name ?? member.profile.email}</p>
                      <p className="text-xs text-zinc-400">{member.profile.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-zinc-500 capitalize">{member.status}</td>
                <td className="px-3 py-2.5">
                  <select
                    value={member.role}
                    disabled={pendingId === member.id}
                    onChange={(e) => handleRoleChange(member.id, e.target.value as OrgRole)}
                    className="rounded-md border border-zinc-200 px-2 py-1 text-xs focus:border-zinc-400 focus:outline-none disabled:opacity-50"
                  >
                    {ORG_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {member.user_id !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => handleRemove(member.id)}
                      disabled={pendingId === member.id}
                      className="rounded-md p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      aria-label="Remove member"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
