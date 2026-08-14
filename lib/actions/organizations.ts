"use server";

/**
 * lib/actions/organizations.ts
 *
 * Read-only member lookups used to populate "Owner" selects on the
 * Contact/Company/Deal forms, plus the org context needed by settings
 * pages built in Step 5. Mutating org/member actions (invite, role
 * change) also live here — see Step 5.
 */

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { requireOrgContext, requireRole, getCurrentUser } from "@/lib/auth/session";
import { ok, fail, toActionError, type ActionResult } from "@/lib/actions/action-result";
import {
  organizationSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  type OrganizationFormInput,
  type InviteMemberInput,
  type UpdateMemberRoleInput,
} from "@/lib/validations/organization";
import type { Organization, OrganizationMemberWithProfile, UserSummary } from "@/types/crm";

/**
 * Onboarding-only: creates the first organization for a freshly signed-up
 * user, makes them its admin, and seeds a default pipeline. Deliberately
 * does NOT go through requireOrgContext() (the caller has no org yet by
 * definition) — just requires an authenticated user.
 */
export async function createOrganization(
  input: OrganizationFormInput
): Promise<ActionResult<{ orgId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("You must be signed in.");

    const parsed = organizationSchema.parse(input);
    const supabase = await createClient();

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: parsed.name, slug: parsed.slug, owner_id: user.id })
      .select("id")
      .single();

    if (orgError) throw orgError;

    const { error: memberError } = await supabase.from("organization_members").insert({
      org_id: org.id,
      user_id: user.id,
      role: "admin",
      status: "active",
    });

    if (memberError) throw memberError;

    const { error: pipelineError } = await supabase.rpc("create_default_pipeline", {
      p_org_id: org.id,
    });

    if (pipelineError) throw pipelineError;

    revalidatePath("/dashboard");
    return ok({ orgId: org.id });
  } catch (err) {
    return toActionError(err);
  }
}

export async function listOrgMembers(): Promise<ActionResult<UserSummary[]>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("organization_members")
      .select("profiles ( id, full_name, email, avatar_url )")
      .eq("org_id", ctx.orgId)
      .eq("status", "active");

    if (error) throw error;

    const members: UserSummary[] = (data ?? [])
      .map((row) => row.profiles as unknown as UserSummary)
      .filter(Boolean)
      .sort((a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email));

    return ok(members);
  } catch (err) {
    return toActionError(err);
  }
}

/** Full membership list (any status) with profile + role — powers the Settings > Members table. Admin only. */
export async function listMembersWithProfiles(): Promise<ActionResult<OrganizationMemberWithProfile[]>> {
  try {
    const ctx = await requireRole(["admin"]);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("organization_members")
      .select("*, profile:profiles ( id, full_name, email, avatar_url )")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: true });

    if (error) throw error;

    return ok((data ?? []) as unknown as OrganizationMemberWithProfile[]);
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateOrganization(
  input: OrganizationFormInput
): Promise<ActionResult<Organization>> {
  try {
    const ctx = await requireRole(["admin"]);
    const parsed = organizationSchema.parse(input);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("organizations")
      .update({ name: parsed.name, slug: parsed.slug })
      .eq("id", ctx.orgId)
      .select("*")
      .single();

    if (error) throw error;

    revalidatePath("/dashboard/settings/organization");
    return ok(data);
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Invites a new member by email. Uses the admin client's
 * inviteUserByEmail (sends Supabase's built-in invite email, creating
 * an auth.users row in an unconfirmed state if one doesn't already
 * exist) and then creates the organization_members row with
 * status='invited'. If the person already has an account, they're
 * added directly with status='active' instead of re-inviting them.
 */
export async function inviteMember(input: InviteMemberInput): Promise<ActionResult<{ email: string }>> {
  try {
    const ctx = await requireRole(["admin"]);
    const parsed = inviteMemberSchema.parse(input);
    const supabase = await createClient();
    const admin = await createAdminClient();

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", parsed.email)
      .maybeSingle();

    let userId = existingProfile?.id;
    let status: "invited" | "active" = "active";

    if (!userId) {
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        parsed.email,
        { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/onboarding` }
      );
      if (inviteError) throw inviteError;
      userId = invited.user.id;
      status = "invited";
    }

    const { error: memberError } = await supabase.from("organization_members").insert({
      org_id: ctx.orgId,
      user_id: userId,
      role: parsed.role,
      status,
      invited_by: ctx.userId,
    });

    if (memberError) throw memberError;

    revalidatePath("/dashboard/settings/members");
    return ok({ email: parsed.email });
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateMemberRole(
  input: UpdateMemberRoleInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireRole(["admin"]);
    const { membershipId, role } = updateMemberRoleSchema.parse(input);
    const supabase = await createClient();

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id, org_id")
      .eq("id", membershipId)
      .single();

    if (membership?.user_id === ctx.userId && role !== "admin") {
      const { count } = await supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("org_id", ctx.orgId)
        .eq("role", "admin")
        .eq("status", "active");

      if ((count ?? 0) <= 1) {
        return fail("You're the only admin — promote someone else before stepping down.");
      }
    }

    const { error } = await supabase
      .from("organization_members")
      .update({ role })
      .eq("id", membershipId)
      .eq("org_id", ctx.orgId);

    if (error) throw error;

    revalidatePath("/dashboard/settings/members");
    return ok({ id: membershipId });
  } catch (err) {
    return toActionError(err);
  }
}

export async function removeMember(membershipId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireRole(["admin"]);
    const supabase = await createClient();

    const { data: membership } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("id", membershipId)
      .single();

    if (membership?.user_id === ctx.userId) {
      return fail("You can't remove yourself from the organization.");
    }

    const { error } = await supabase
      .from("organization_members")
      .delete()
      .eq("id", membershipId)
      .eq("org_id", ctx.orgId);

    if (error) throw error;

    revalidatePath("/dashboard/settings/members");
    return ok({ id: membershipId });
  } catch (err) {
    return toActionError(err);
  }
}
