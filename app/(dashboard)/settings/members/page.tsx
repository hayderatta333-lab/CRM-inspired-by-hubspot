import { requireRole } from "@/lib/auth/session";
import { listMembersWithProfiles } from "@/lib/actions/organizations";
import { MembersTable } from "@/components/settings/members-table";

export default async function MembersSettingsPage() {
  const ctx = await requireRole(["admin"]);
  const result = await listMembersWithProfiles();

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-900">Members</h1>
        <p className="text-sm text-zinc-500">Invite teammates and manage roles</p>
      </div>

      {result.success ? (
        <MembersTable members={result.data} currentUserId={ctx.userId} />
      ) : (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {result.error}
        </div>
      )}
    </div>
  );
}
