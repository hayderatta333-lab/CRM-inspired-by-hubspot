"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { companySchema, type CompanyFormInput } from "@/lib/validations/company";
import { createCompany, updateCompany } from "@/lib/actions/companies";
import type { CompanyWithOwner, UserSummary } from "@/types/crm";

interface CompanyFormProps {
  company?: CompanyWithOwner;
  members: UserSummary[];
}

export function CompanyForm({ company, members }: CompanyFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CompanyFormInput>({
    resolver: zodResolver(companySchema),
    defaultValues: company
      ? {
          name: company.name,
          domain: company.domain ?? undefined,
          industry: company.industry ?? undefined,
          phone: company.phone ?? undefined,
          website: company.website ?? undefined,
          size: company.size ?? undefined,
          annual_revenue: company.annual_revenue ?? undefined,
          address_line1: company.address_line1 ?? undefined,
          city: company.city ?? undefined,
          state: company.state ?? undefined,
          postal_code: company.postal_code ?? undefined,
          country: company.country ?? undefined,
          description: company.description ?? undefined,
          owner_id: company.owner?.id ?? undefined,
        }
      : undefined,
  });

  function onSubmit(values: CompanyFormInput) {
    startTransition(async () => {
      const result = company
        ? await updateCompany({ id: company.id, ...values })
        : await createCompany(values);

      if (result.success) {
        router.push(`/companies/${result.data.id}`);
        router.refresh();
        return;
      }

      if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof CompanyFormInput, { message: messages[0] });
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

      <Field label="Company name" error={errors.name?.message}>
        <input {...register("name")} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Domain" error={errors.domain?.message}>
          <input {...register("domain")} placeholder="acme.com" className={inputClass} />
        </Field>
        <Field label="Website" error={errors.website?.message}>
          <input {...register("website")} placeholder="https://acme.com" className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Industry" error={errors.industry?.message}>
          <input {...register("industry")} className={inputClass} />
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          <input {...register("phone")} className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Company size" error={errors.size?.message}>
          <select {...register("size")} className={inputClass}>
            <option value="">Unknown</option>
            {["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"].map((s) => (
              <option key={s} value={s}>
                {s} employees
              </option>
            ))}
          </select>
        </Field>
        <Field label="Annual revenue" error={errors.annual_revenue?.message}>
          <input type="number" step="1000" {...register("annual_revenue")} className={inputClass} />
        </Field>
      </div>

      <Field label="Address" error={errors.address_line1?.message}>
        <input {...register("address_line1")} className={inputClass} />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="City" error={errors.city?.message}>
          <input {...register("city")} className={inputClass} />
        </Field>
        <Field label="State" error={errors.state?.message}>
          <input {...register("state")} className={inputClass} />
        </Field>
        <Field label="Postal code" error={errors.postal_code?.message}>
          <input {...register("postal_code")} className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Country" error={errors.country?.message}>
          <input {...register("country")} className={inputClass} />
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

      <Field label="Description" error={errors.description?.message}>
        <textarea {...register("description")} rows={3} className={inputClass} />
      </Field>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? "Saving…" : company ? "Save changes" : "Create company"}
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
