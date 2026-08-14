import { requireOrgContext } from "@/lib/auth/session";
import { listCompanies } from "@/lib/actions/companies";
import { CompaniesTable } from "@/components/companies/companies-table";
import { canDeleteRecords } from "@/types/crm";

export default async function CompaniesPage() {
  const ctx = await requireOrgContext();
  const result = await listCompanies({ page: 1, pageSize: 25 });

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-900">Companies</h1>
        <p className="text-sm text-zinc-500">Organizations you sell to</p>
      </div>

      {result.success ? (
        <CompaniesTable initialData={result.data} canDelete={canDeleteRecords(ctx.role)} />
      ) : (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {result.error}
        </div>
      )}
    </div>
  );
}
