"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { organizationSchema, type OrganizationFormInput } from "@/lib/validations/organization";
import { updateOrganization } from "@/lib/actions/organizations";
import type { Organization } from "@/types/crm";

export function OrganizationForm({ organization }: { organization: Organization }) {
  const [isPending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<OrganizationFormInput>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { name: organization.name, slug: organization.slug },
  });

  function onSubmit(values: OrganizationFormInput) {
    startTransition(async () => {
      const result = await updateOrganization(values);
      if (!result.success) {
        if (result.fieldErrors) {
          for (const [field, messages] of Object.entries(result.fieldErrors)) {
            setError(field as keyof OrganizationFormInput, { message: messages[0] });
          }
        } else {
          setError("root", { message: result.error });
        }
      }
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex max-w-md flex-col gap-4">
      {errors.root && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errors.root.message}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">Organization name</span>
        <input {...register("name")} className={inputClass} />
        {errors.name && <span className="text-xs text-red-600">{errors.name.message}</span>}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-600">Slug</span>
        <input {...register("slug")} className={inputClass} />
        {errors.slug && <span className="text-xs text-red-600">{errors.slug.message}</span>}
      </label>

      <div>
        <button
          type="submit"
          disabled={isPending || !isDirty}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400";
