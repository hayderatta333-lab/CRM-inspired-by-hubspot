import { requireOrgContext } from "@/lib/auth/session";
import { listContacts } from "@/lib/actions/contacts";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { canDeleteRecords } from "@/types/crm";

export default async function ContactsPage() {
  const ctx = await requireOrgContext();
  const result = await listContacts({ page: 1, pageSize: 25 });

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-900">Contacts</h1>
        <p className="text-sm text-zinc-500">People associated with your deals and companies</p>
      </div>

      {result.success ? (
        <ContactsTable initialData={result.data} canDelete={canDeleteRecords(ctx.role)} />
      ) : (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {result.error}
        </div>
      )}
    </div>
  );
}
