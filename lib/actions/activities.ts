"use server";

/**
 * lib/actions/activities.ts
 *
 * Activities cover notes/calls/emails/meetings/tasks in one table (see
 * schema.sql). getTimeline() is the query that powers the 360-degree
 * view on a contact/company/deal page: it fetches every activity linked
 * to that record and normalizes each into a single `occurredAt` instant
 * (completed_at, falling back to starts_at, then due_at, then
 * created_at) so the UI can render one chronological list regardless of
 * activity type.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/auth/session";
import { ok, fail, toActionError, type ActionResult } from "@/lib/actions/action-result";
import {
  activitySchema,
  activityUpdateSchema,
  activityCompleteSchema,
  type ActivityFormInput,
  type ActivityUpdateInput,
} from "@/lib/validations/activity";
import type { ActivityWithRelations, TimelineEntry } from "@/types/crm";

const ACTIVITY_SELECT = `
  *,
  owner:profiles!activities_owner_id_fkey ( id, full_name, email, avatar_url ),
  created_by_user:profiles!activities_created_by_fkey ( id, full_name, email, avatar_url ),
  contact:contacts ( id, first_name, last_name ),
  company:companies ( id, name ),
  deal:deals ( id, name )
`;

type TimelineParent = "contact" | "company" | "deal";

export async function getTimeline(
  parent: TimelineParent,
  parentId: string
): Promise<ActionResult<TimelineEntry[]>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();

    const column = `${parent}_id` as "contact_id" | "company_id" | "deal_id";

    const { data, error } = await supabase
      .from("activities")
      .select(ACTIVITY_SELECT)
      .eq("org_id", ctx.orgId)
      .eq(column, parentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const activities = (data ?? []) as unknown as ActivityWithRelations[];

    const timeline: TimelineEntry[] = activities.map((a) => ({
      id: a.id,
      type: a.type,
      subject: a.subject,
      body: a.body,
      status: a.status,
      occurredAt: a.completed_at ?? a.starts_at ?? a.due_at ?? a.created_at,
      actor: a.created_by_user,
      raw: a,
    }));

    timeline.sort((x, y) => new Date(y.occurredAt).getTime() - new Date(x.occurredAt).getTime());

    return ok(timeline);
  } catch (err) {
    return toActionError(err);
  }
}

/** Tasks due for the current user — powers the dashboard "My Tasks" widget. */
export async function listMyOpenTasks(limit = 10): Promise<ActionResult<ActivityWithRelations[]>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("activities")
      .select(ACTIVITY_SELECT)
      .eq("org_id", ctx.orgId)
      .eq("type", "task")
      .eq("status", "planned")
      .eq("owner_id", ctx.userId)
      .order("due_at", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) throw error;

    return ok((data ?? []) as unknown as ActivityWithRelations[]);
  } catch (err) {
    return toActionError(err);
  }
}

export async function createActivity(
  input: ActivityFormInput
): Promise<ActionResult<ActivityWithRelations>> {
  try {
    const ctx = await requireOrgContext();
    const parsed = activitySchema.parse(input);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("activities")
      .insert({
        org_id: ctx.orgId,
        created_by: ctx.userId,
        owner_id: parsed.owner_id ?? ctx.userId,
        type: parsed.type,
        subject: parsed.subject,
        body: parsed.body ?? null,
        status: parsed.status,
        contact_id: parsed.contact_id ?? null,
        company_id: parsed.company_id ?? null,
        deal_id: parsed.deal_id ?? null,
        due_at: parsed.due_at ?? null,
        priority: parsed.priority,
        call_outcome: parsed.call_outcome ?? null,
        duration_seconds: parsed.duration_seconds ?? null,
        starts_at: parsed.starts_at ?? null,
        ends_at: parsed.ends_at ?? null,
        location: parsed.location ?? null,
        completed_at: parsed.status === "completed" ? new Date().toISOString() : null,
      })
      .select(ACTIVITY_SELECT)
      .single();

    if (error) throw error;

    revalidateParentPaths(parsed.contact_id, parsed.company_id, parsed.deal_id);
    return ok(data as unknown as ActivityWithRelations);
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateActivity(
  input: ActivityUpdateInput
): Promise<ActionResult<ActivityWithRelations>> {
  try {
    const ctx = await requireOrgContext();
    const parsed = activityUpdateSchema.parse(input);
    const supabase = await createClient();

    const { id, ...updates } = parsed;

    const { data, error } = await supabase
      .from("activities")
      .update(updates)
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .select(ACTIVITY_SELECT)
      .single();

    if (error) throw error;
    if (!data) return fail("Activity not found.");

    revalidateParentPaths(data.contact_id, data.company_id, data.deal_id);
    return ok(data as unknown as ActivityWithRelations);
  } catch (err) {
    return toActionError(err);
  }
}

/** One-click "mark done" action used by the task list / timeline UI. */
export async function completeActivity(
  input: { id: string }
): Promise<ActionResult<ActivityWithRelations>> {
  try {
    const ctx = await requireOrgContext();
    const { id } = activityCompleteSchema.parse(input);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("activities")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .select(ACTIVITY_SELECT)
      .single();

    if (error) throw error;
    if (!data) return fail("Activity not found.");

    revalidateParentPaths(data.contact_id, data.company_id, data.deal_id);
    return ok(data as unknown as ActivityWithRelations);
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteActivity(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from("activities")
      .select("id, owner_id, created_by, contact_id, company_id, deal_id")
      .eq("org_id", ctx.orgId)
      .eq("id", id)
      .single();

    if (fetchError || !existing) return fail("Activity not found.");

    const canDelete =
      existing.owner_id === ctx.userId ||
      existing.created_by === ctx.userId ||
      ctx.role === "admin" ||
      ctx.role === "sales_manager";

    if (!canDelete) return fail("You don't have permission to delete this activity.");

    const { error } = await supabase.from("activities").delete().eq("id", id).eq("org_id", ctx.orgId);
    if (error) throw error;

    revalidateParentPaths(existing.contact_id, existing.company_id, existing.deal_id);
    return ok({ id });
  } catch (err) {
    return toActionError(err);
  }
}

function revalidateParentPaths(
  contactId?: string | null,
  companyId?: string | null,
  dealId?: string | null
) {
  if (contactId) revalidatePath(`/dashboard/contacts/${contactId}`);
  if (companyId) revalidatePath(`/dashboard/companies/${companyId}`);
  if (dealId) revalidatePath(`/dashboard/deals/${dealId}`);
  revalidatePath("/dashboard");
}
