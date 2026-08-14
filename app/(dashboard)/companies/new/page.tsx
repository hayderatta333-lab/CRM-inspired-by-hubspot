import { requireOrgContext } from "@/lib/auth/session";
import { listOrgMembers } from "@/lib/actions/organizations";
import { CompanyForm } from "@/components/companies/company-form";

export default async function NewCompanyPage() {
  await requireOrgContext();
  const membersResult = await listOrgMembers();

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-900">New company</h1>
      </div>
      <CompanyForm members={membersResult.success ? membersResult.data : []} />
    </div>
  );
}
