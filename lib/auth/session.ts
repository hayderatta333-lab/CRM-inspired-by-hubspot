/**
 * lib/auth/session.ts
 *
 * Server-only helpers for resolving "who is calling, and in which
 * organization, with what role". Every Server Action and protected
 * Server Component should go through getOrgContext()/requireOrgContext()
 * rather than querying organization_members directly, so the "which org
 * is active" logic (currently: cookie override -> first active
 * membership) lives in exactly one place.
 */

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { OrgRole, Profile } from "@/types/crm";

const ACTIVE_ORG_COOKIE = "crm_active_org_id";

export interface OrgContext {
  userId: string;
  profile: Profile;
  orgId: string;
  orgName: string;
  role: OrgRole;
}

/** Returns the authenticated Supabase user, or null. Does not redirect. */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

/**
 * Resolves the full org context (user + profile + active org + role) for
 * the current request. Returns null if the user isn't signed in or isn't
 * an active member of any organization — callers decide how to handle
 * that (redirect, onboarding flow, etc).
 */
export async function getOrgContext(): Promise<OrgContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) return null;

  const cookieStore = await cookies();
  const preferredOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  let membershipQuery = supabase
    .from("organization_members")
    .select("org_id, role, organizations!inner(name)")
    .eq("user_id", user.id)
    .eq("status", "active");

  const { data: memberships, error: membershipsError } = await membershipQuery;

  if (membershipsError || !memberships || memberships.length === 0) return null;

  const active =
    memberships.find((m) => m.org_id === preferredOrgId) ?? memberships[0];

  return {
    userId: user.id,
    profile,
    orgId: active.org_id,
    orgName: (active.organizations as unknown as { name: string }).name,
    role: active.role,
  };
}

/** Same as getOrgContext(), but redirects to /login (or /onboarding) instead of returning null. */
export async function requireOrgContext(): Promise<OrgContext> {
  const ctx = await getOrgContext();

  if (!ctx) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    redirect("/onboarding"); // authenticated but no active org membership yet
  }

  return ctx;
}

/**
 * Requires the caller to hold one of `allowedRoles` in their active org.
 * Redirects to /dashboard with an ?error= query param if not — pages
 * should call this at the top of the Server Component, before rendering
 * any admin/manager-only UI. This is a UX guard only; the RLS policies
 * in supabase/schema.sql are the actual enforcement boundary.
 */
export async function requireRole(allowedRoles: OrgRole[]): Promise<OrgContext> {
  const ctx = await requireOrgContext();

  if (!allowedRoles.includes(ctx.role)) {
    redirect("/dashboard?error=insufficient_permissions");
  }

  return ctx;
}

export function setActiveOrgCookie(orgId: string) {
  // Called from a Server Action (e.g. the org switcher) — cookies() is
  // mutable there, unlike in a plain Server Component render.
  cookies().then((store) =>
    store.set(ACTIVE_ORG_COOKIE, orgId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
  );
}
