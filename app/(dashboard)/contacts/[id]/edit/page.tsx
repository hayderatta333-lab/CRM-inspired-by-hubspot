import { notFound } from "next/navigation";
import { requireOrgContext } from "@/lib/auth/session";
import { getContact } from "@/lib/actions/contacts";
import { listCompanyOptions } from "@/lib/actions/companies";
import { listOrgMembers } from "@/lib/actions/organizations";
import { ContactForm } from "@/components/contacts/contact-form";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOrgContext();
  const { id } = await params;

  const [contactResult, companiesResult, membersResult] = await Promise.all([
    getContact(id),
    listCompanyOptions(),
    listOrgMembers(),
  ]);

  if (!contactResult.success) notFound();

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-zinc-900">
          Edit {contactResult.data.first_name} {contactResult.data.last_name ?? ""}
        </h1>
      </div>
      <ContactForm
        contact={contactResult.data}
        companies={companiesResult.success ? companiesResult.data : []}
        members={membersResult.success ? membersResult.data : []}
      />
    </div>
  );
}
