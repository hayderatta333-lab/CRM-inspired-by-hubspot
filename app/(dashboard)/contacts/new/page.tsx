import { requireOrgContext } from "@/lib/auth/session";
import { listCompanyOptions } from "@/lib/actions/companies";
import { listOrgMembers } from "@/lib/actions/organizations";
import { ContactForm } from "@/components/contacts/contact-form";

export default async function NewContactPage() {
  await requireOrgContext();

  const [companiesResult, membersResult] = await Promise.all([
    listCompanyOptions(),
    listOrgMembers(),
  ]);

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-900">New contact</h1>
      </div>
      <ContactForm
        companies={companiesResult.success ? companiesResult.data : []}
        members={membersResult.success ? membersResult.data : []}
      />
    </div>
  );
}
