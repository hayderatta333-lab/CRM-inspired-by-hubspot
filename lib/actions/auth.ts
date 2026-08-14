"use server";

/**
 * lib/actions/auth.ts
 *
 * signUp/signIn intentionally return ActionResult<T> rather than calling
 * next/navigation's redirect() themselves — redirect() throws a special
 * digest error that must propagate undisturbed, and toActionError()
 * catches errors generically, so the two don't mix safely in the same
 * try/catch. The login/signup forms call router.push() on success
 * instead, matching every other form in this app. signOut() has no data
 * to return, so it's the one action here that redirects directly.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ok, fail, toActionError, type ActionResult } from "@/lib/actions/action-result";
import { signUpSchema, signInSchema, type SignUpInput, type SignInInput } from "@/lib/validations/auth";

export async function signUp(input: SignUpInput): Promise<ActionResult<{ needsEmailConfirmation: boolean }>> {
  try {
    const parsed = signUpSchema.parse(input);
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email: parsed.email,
      password: parsed.password,
      options: {
        data: { full_name: parsed.fullName },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        return fail("An account with that email already exists. Try signing in instead.");
      }
      throw error;
    }

    // If email confirmation is off, Supabase returns a session immediately.
    return ok({ needsEmailConfirmation: !data.session });
  } catch (err) {
    return toActionError(err);
  }
}

export async function signIn(input: SignInInput): Promise<ActionResult<{ signedIn: true }>> {
  try {
    const parsed = signInSchema.parse(input);
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (error) {
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        return fail("Incorrect email or password.");
      }
      throw error;
    }

    return ok({ signedIn: true });
  } catch (err) {
    return toActionError(err);
  }
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
