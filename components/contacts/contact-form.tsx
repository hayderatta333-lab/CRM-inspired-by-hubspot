"use client";

/**
 * components/contacts/contact-form.tsx
 *
 * One form drives both create and edit: if `contact` is passed, it
 * submits to updateContact; otherwise createContact. Server-side
 * fieldErrors from the ActionResult are mapped onto RHF's error state
 * via setError, so a uniqueness violation on email (caught by the DB's
 * `uq_contacts_org_email` constraint) surfaces under the email field
 * exactly like a client-side Zod error would.
 */

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { contactSchema, type ContactFormInput } from "@/lib/validations/contact";
import { createContact, updateContact } from "@/lib/actions/contacts";
import type { ContactWithRelations, UserSummary } from "@/types/crm";
import type { Company } from "@/types/crm";

interface ContactFormProps {
  contact?: ContactWithRelations;
  companies: Pick<Company, "id" | "name">[];
  members: UserSummary[];
}

export function ContactForm({ contact, companies, members }: ContactFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ContactFormInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: contact
      ? {
          first_name: contact.first_name,
          last_name: contact.last_name ?? undefined,
          email: contact.email ?? undefined,
          phone: contact.phone ?? undefined,
          job_title: contact.job_title ?? undefined,
          company_id: contact.company?.id ?? undefined,
          lifecycle_stage: contact.lifecycle_stage,
          lead_status: contact.lead_status,
          source: contact.source ?? undefined,
          linkedin_url: contact.linkedin_url ?? undefined,
          owner_id: contact.owner?.id ?? undefined,
        }
      : { lifecycle_stage: "lead", lead_status: "new" },
  });

  function onSubmit(values: ContactFormInput) {
    startTransition(async () => {
      const result = contact
        ? await updateContact({ id: contact.id, ...values })
        : await createContact(values);

      if (result.success) {
        router.push(`/contacts/${result.data.id}`);
        router.refresh();
        return;
      }

      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof ContactFormInput, { message: messages[0] });
        }
      } else {
        setError("root", { message: result.error });
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-w-xl">
      {errors.root && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errors.root.message}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" error={errors.first_name?.message}>
          <input {...register("first_name")} className={inputClass} />
        </Field>
        <Field label="Last name" error={errors.last_name?.message}>
          <input {...register("last_name")} className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Email" error={errors.email?.message}>
          <input type="email" {...register("email")} className={inputClass} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <input {...register("phone")} className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Job title" error={errors.job_title?.message}>
          <input {...register("job_title")} className={inputClass} />
        </Field>
        <Field label="Company" error={errors.company_id?.message}>
          <select {...register("company_id")} className={inputClass}>
            <option value="">No company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Lifecycle stage" error={errors.lifecycle_stage?.message}>
          <select {...register("lifecycle_stage")} className={inputClass}>
            <option value="subscriber">Subscriber</option>
            <option value="lead">Lead</option>
            <option value="marketing_qualified_lead">MQL</option>
            <option value="sales_qualified_lead">SQL</option>
            <option value="opportunity">Opportunity</option>
            <option value="customer">Customer</option>
            <option value="evangelist">Evangelist</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Lead status" error={errors.lead_status?.message}>
          <select {...register("lead_status")} className={inputClass}>
            <option value="new">New</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="connected">Connected</option>
            <option value="attempted_to_contact">Attempted to contact</option>
            <option value="unqualified">Unqualified</option>
            <option value="bad_timing">Bad timing</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Source" error={errors.source?.message}>
          <input {...register("source")} placeholder="e.g. Website, Referral" className={inputClass} />
        </Field>
        <Field label="Owner" error={errors.owner_id?.message}>
          <select {...register("owner_id")} className={inputClass}>
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name ?? m.email}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="LinkedIn URL" error={errors.linkedin_url?.message}>
        <input {...register("linkedin_url")} className={inputClass} />
      </Field>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? "Saving…" : contact ? "Save changes" : "Create contact"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  );
}
