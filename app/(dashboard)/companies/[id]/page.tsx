import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Globe, Phone, MapPin, Users } from "lucide-react";
import { requireOrgContext } from "@/lib/auth/session";
import { getCompany } from "@/lib/actions/companies";
import { getTimeline } from "@/lib/actions/activities";
import { listContacts } from "@/lib/actions/contacts";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOrgContext();
  const { id } = await params;

  const [companyResult, timelineResult, contactsResult] = await Promise.all([
    getCompany(id),
    getTimeline("company", id),
    listContacts({ companyId: id, page: 1, pageSize: 10 }),
  ]);

  if (!companyResult.success) notFound();
  const company = companyResult.data;

  return (
    <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-1">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <h1 className="text-base font-semibold text-zinc-900">{company.name}</h1>
            <Link
              href={`/companies/${company.id}/edit`}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Edit company"
            >
              <Pencil className="size-4" />
            </Link>
          </div>
          {company.industry && <p className="text-xs text-zinc-500">{company.industry}</p>}

          <dl className="mt-4 flex flex-col gap-2.5 text-sm">
            {company.website && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Globe className="size-3.5 text-zinc-400" />
                <a href={company.website} target="_blank" rel="noreferrer" className="hover:underline">
                  {company.website}
                </a>
              </div>
            )}
            {company.phone && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Phone className="size-3.5 text-zinc-400" />
                {company.phone}
              </div>
            )}
            {(company.city || company.country) && (
              <div className="flex items-center gap-2 text-zinc-600">
                <MapPin className="size-3.5 text-zinc-400" />
                {[company.city, company.state, company.country].filter(Boolean).join(", ")}
              </div>
            )}
            {company.size && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Users className="size-3.5 text-zinc-400" />
                {company.size} employees
              </div>
            )}
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-xs">
            <div>
              <p className="text-zinc-400">Open deals</p>
              <p className="mt-0.5 font-medium tabular-nums text-zinc-700">
                {company.open_deal_count} · {formatCurrency(company.open_deal_value)}
              </p>
            </div>
            <div>
              <p className="text-zinc-400">Owner</p>
              <p className="mt-0.5 font-medium text-zinc-700">
                {company.owner?.full_name ?? company.owner?.email ?? "Unassigned"}
              </p>
            </div>
            <div>
              <p className="text-zinc-400">Contacts</p>
              <p className="mt-0.5 font-medium tabular-nums text-zinc-700">{company.contact_count}</p>
            </div>
            <div>
              <p className="text-zinc-400">Created</p>
              <p className="mt-0.5 font-medium text-zinc-700">{formatDate(company.created_at)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-zinc-900">Contacts</h2>
          <ul className="mt-2 flex flex-col divide-y divide-zinc-50">
            {contactsResult.success &&
              contactsResult.data.data.map((contact) => (
                <li key={contact.id} className="py-2">
                  <Link href={`/contacts/${contact.id}`} className="text-sm text-zinc-800 hover:underline">
                    {contact.first_name} {contact.last_name ?? ""}
                  </Link>
                  {contact.job_title && <p className="text-xs text-zinc-400">{contact.job_title}</p>}
                </li>
              ))}
            {contactsResult.success && contactsResult.data.data.length === 0 && (
              <li className="py-4 text-center text-xs text-zinc-400">No contacts yet.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="lg:col-span-2">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900">Activity</h2>
        <ActivityTimeline
          parent="company"
          parentId={company.id}
          initialEntries={timelineResult.success ? timelineResult.data : []}
        />
      </div>
    </div>
  );
}
