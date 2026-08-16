import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Mail, Phone, Briefcase, Building2 } from "lucide-react";
import { requireOrgContext } from "@/lib/auth/session";
import { getContact } from "@/lib/actions/contacts";
import { getTimeline } from "@/lib/actions/activities";
import { getWhatsAppThread } from "@/lib/actions/whatsapp";
import { ActivityTimeline } from "@/components/shared/activity-timeline";
import { WhatsAppPanel } from "@/components/shared/whatsapp-panel";
import { formatDate, initials } from "@/lib/utils";

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOrgContext();
  const { id } = await params;

  const contactResult = await getContact(id);
  if (!contactResult.success) notFound();
  const contact = contactResult.data;

  const [timelineResult, whatsappResult] = await Promise.all([
    getTimeline("contact", id),
    getWhatsAppThread(contact.phone ?? ""),
  ]);

  return (
    <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="rounded-lg border border-zinc-200 bg-white p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium text-white">
                {initials(`${contact.first_name} ${contact.last_name ?? ""}`)}
              </span>
              <div>
                <h1 className="text-base font-semibold text-zinc-900">
                  {contact.first_name} {contact.last_name ?? ""}
                </h1>
                {contact.job_title && <p className="text-xs text-zinc-500">{contact.job_title}</p>}
              </div>
            </div>
            <Link
              href={`/contacts/${contact.id}/edit`}
              className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
              aria-label="Edit contact"
            >
              <Pencil className="size-4" />
            </Link>
          </div>

          <dl className="mt-4 flex flex-col gap-2.5 text-sm">
            {contact.email && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Mail className="size-3.5 text-zinc-400" />
                <a href={`mailto:${contact.email}`} className="hover:underline">
                  {contact.email}
                </a>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Phone className="size-3.5 text-zinc-400" />
                {contact.phone}
              </div>
            )}
            {contact.company && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Building2 className="size-3.5 text-zinc-400" />
                <Link href={`/companies/${contact.company.id}`} className="hover:underline">
                  {contact.company.name}
                </Link>
              </div>
            )}
            {contact.source && (
              <div className="flex items-center gap-2 text-zinc-600">
                <Briefcase className="size-3.5 text-zinc-400" />
                {contact.source}
              </div>
            )}
          </dl>

          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-zinc-100 pt-3 text-xs">
            <div>
              <p className="text-zinc-400">Lifecycle stage</p>
              <p className="mt-0.5 font-medium text-zinc-700">{contact.lifecycle_stage.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-zinc-400">Lead status</p>
              <p className="mt-0.5 font-medium text-zinc-700">{contact.lead_status.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-zinc-400">Owner</p>
              <p className="mt-0.5 font-medium text-zinc-700">
                {contact.owner?.full_name ?? contact.owner?.email ?? "Unassigned"}
              </p>
            </div>
            <div>
              <p className="text-zinc-400">Created</p>
              <p className="mt-0.5 font-medium text-zinc-700">{formatDate(contact.created_at)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-2 flex flex-col gap-6">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">WhatsApp</h2>
          <WhatsAppPanel
            phone={contact.phone}
            initialMessages={whatsappResult.success ? whatsappResult.data : []}
          />
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900">Activity</h2>
          <ActivityTimeline
            parent="contact"
            parentId={contact.id}
            initialEntries={timelineResult.success ? timelineResult.data : []}
          />
        </div>
      </div>
    </div>
  );
}
