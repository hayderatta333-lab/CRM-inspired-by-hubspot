"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { signInSchema, type SignInInput } from "@/lib/validations/auth";
import { signIn } from "@/lib/actions/auth";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignInInput>({ resolver: zodResolver(signInSchema) });

  function onSubmit(values: SignInInput) {
    startTransition(async () => {
      const result = await signIn(values);
      if (result.success) {
        router.push(searchParams.get("redirectTo") ?? "/dashboard");
        router.refresh();
      } else {
        setError("root", { message: result.error });
      }
    });
  }

  return (
    <div>
      <h1 className="mb-4 text-base font-semibold text-zinc-900">Sign in</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        {errors.root && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.root.message}
          </div>
        )}

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
          {isPending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-zinc-500">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-zinc-900 hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400";
