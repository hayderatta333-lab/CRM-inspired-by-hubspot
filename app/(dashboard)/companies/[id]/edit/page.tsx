import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/session";
import { getCompany } from "@/lib/actions/companies";
import { listOrgMembers } from "@/lib/actions/organizations";
import { CompanyForm } from "@/components/companies/company-form";

export default async function EditCompanyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOrgContext();
  const { id } = await params;

  const [companyResult, membersResult] = await Promise.all([getCompany(id), listOrgMembers()]);

  if (!companyResult.success) notFound();

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-900">Edit {companyResult.data.name}</h1>
      </div>
      <CompanyForm company={companyResult.data} members={membersResult.success ? membersResult.data : []} />
    </div>
  );
}
