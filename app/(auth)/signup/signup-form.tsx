"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signUpSchema, type SignUpInput } from "@/lib/validations/auth";
import { signUp } from "@/lib/actions/auth";

export function SignUpForm() {
  const [isPending, startTransition] = useTransition();
  const [confirmationSent, setConfirmationSent] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignUpInput>({ resolver: zodResolver(signUpSchema) });

  function onSubmit(values: SignUpInput) {
    startTransition(async () => {
      const result = await signUp(values);
      if (result.success) {
        if (result.data.needsEmailConfirmation) {
          setConfirmationSent(true);
        } else {
          window.location.href = "/onboarding";
        }
      } else {
        setError("root", { message: result.error });
      }
    });
  }

  if (confirmationSent) {
    return (
      <div className="text-center">
        <h1 className="mb-2 text-base font-semibold text-zinc-900">Check your email</h1>
        <p className="text-sm text-zinc-500">
          We sent a confirmation link — click it to finish setting up your account.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-base font-semibold text-zinc-900">Create an account</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        {errors.root && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.root.message}
          </div>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Full name</span>
          <input {...register("fullName")} className={inputClass} />
          {errors.fullName && <span className="text-xs text-red-600">{errors.fullName.message}</span>}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Email</span>
          <input type="email" {...register("email")} className={inputClass} />
          {errors.email && <span className="text-xs text-red-600">{errors.email.message}</span>}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600">Password</span>
          <input type="password" {...register("password")} className={inputClass} />
          {errors.password && <span className="text-xs text-red-600">{errors.password.message}</span>}
        </label>

        <button
          type="submit"
          disabled={isPending}
          className="mt-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-zinc-900 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400";
