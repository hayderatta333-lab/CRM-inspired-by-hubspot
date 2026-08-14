"use client";

import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useTransition } from "react";
import { organizationSchema, type OrganizationFormInput } from "@/lib/validations/organization";
import { createOrganization } from "@/lib/actions/organizations";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function OnboardingForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors },
  } = useForm<OrganizationFormInput>({ resolver: zodResolver(organizationSchema) });

  const name = useWatch({ control, name: "name" });

  useEffect(() => {
    if (name) setValue("slug", slugify(name), { shouldValidate: true });
  }, [name, setValue]);

  function onSubmit(values: OrganizationFormInput) {
    startTransition(async () => {
      const result = await createOrganization(values);
      if (result.success) {
        router.push("/dashboard");
        router.refresh();
      } else if (result.fieldErrors) {
        for (const [field, messages] of Object.entries(result.fieldErrors)) {
          setError(field as keyof OrganizationFormInput, { message: messages[0] });
        }
      } else {
        setError("root", { message: result.error });
      }
    });
  }

  return (
    <div>
      <h1 className="mb-1 text-base font-semibold text-zinc-900">Create your organization</h1>
      <p className="mb-4 text-sm text-zinc-500">This is your team's workspace in the CRM.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        {errors.root && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.root.message}
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Organization name</span>
          <input {...register("name")} placeholder="Acme Inc" className={inputClass} />
          {errors.name && <span className="text-xs text-red-600">{errors.name.message}</span>}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Slug</span>
          <input {...register("slug")} className={inputClass} />
          {errors.slug && <span className="text-xs text-red-600">{errors.slug.message}</span>}
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="mt-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create organization"}
        </button>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400";
