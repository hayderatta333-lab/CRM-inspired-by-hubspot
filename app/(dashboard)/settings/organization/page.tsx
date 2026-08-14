import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { OrganizationForm } from "@/components/settings/organization-form";
import { notFound } from "next/navigation";

export default async function OrganizationSettingsPage() {
  const ctx = await requireRole(["admin"]);
  const supabase = await createClient();

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", ctx.orgId)
    .single();

  if (error || !organization) notFound();

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-900">Organization settings</h1>
        <p className="text-sm text-zinc-500">Visible only to admins</p>
      </div>
      <OrganizationForm organization={organization} />
    </div>
  );
}
