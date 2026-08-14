"use server";

/**
 * lib/actions/deals.ts
 *
 * Mirrors the conventions in contacts.ts/companies.ts. Two extra
 * concerns specific to deals:
 *   - getPipelineBoard(): a single query shaped for the Kanban board
 *     (all open deals in a pipeline, grouped by stage, with per-column
 *     totals) rather than the generic paginated list.
 *   - moveDealStage(): the minimal-payload mutation the drag-and-drop
 *     board calls on every drop. Deliberately narrow (just id + new
 *     stage) so it's cheap to call optimistically and the DB trigger
 *     (sync_deal_status_from_stage in schema.sql) derives status/
 *     actual_close_date automatically — this action never sets those.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/auth/session";
import { ok, fail, toActionError, type ActionResult } from "@/lib/actions/action-result";
import {
  dealSchema,
  dealUpdateSchema,
  dealFiltersSchema,
  dealStageMoveSchema,
  type DealFormInput,
  type DealUpdateInput,
  type DealFiltersInput,
  type DealStageMoveInput,
} from "@/lib/validations/deal";
import { canEditRecord, canDeleteRecords } from "@/types/crm";
import type { DealWithRelations, PaginatedResult, PipelineBoard, KanbanColumn } from "@/types/crm";
import { listPipelines } from "@/lib/actions/pipelines";

const DEAL_SELECT = `
  *,
  stage:pipeline_stages ( * ),
  company:companies ( id, name ),
  primary_contact:contacts!deals_primary_contact_id_fkey ( id, first_name, last_name ),
  owner:profiles!deals_owner_id_fkey ( id, full_name, email, avatar_url )
`;

export async function listDeals(
  rawFilters: Partial<DealFiltersInput>
): Promise<ActionResult<PaginatedResult<DealWithRelations>>> {
  try {
    const ctx = await requireOrgContext();
    const filters = dealFiltersSchema.parse(rawFilters);
    const supabase = await createClient();

    const from = (filters.page - 1) * filters.pageSize;
    const to = from + filters.pageSize - 1;

    let query = supabase
      .from("deals")
      .select(DEAL_SELECT, { count: "exact" })
      .eq("org_id", ctx.orgId)
      .is("deleted_at", null);

    if (filters.search) {
      const term = filters.search.replace(/[%_]/g, "\\$&");
      query = query.ilike("name", `%${term}%`);
    }
    if (filters.pipelineId) query = query.eq("pipeline_id", filters.pipelineId);
    if (filters.stageId?.length) query = query.in("stage_id", filters.stageId);
    if (filters.ownerId) query = query.eq("owner_id", filters.ownerId);
    if (filters.status?.length) query = query.in("status", filters.status);
    if (filters.companyId) query = query.eq("company_id", filters.companyId);
    if (filters.minAmount !== undefined) query = query.gte("amount", filters.minAmount);
    if (filters.maxAmount !== undefined) query = query.lte("amount", filters.maxAmount);
    if (filters.expectedCloseAfter) query = query.gte("expected_close_date", filters.expectedCloseAfter);
    if (filters.expectedCloseBefore) query = query.lte("expected_close_date", filters.expectedCloseBefore);

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const totalCount = count ?? 0;

    return ok({
      data: (data ?? []) as unknown as DealWithRelations[],
      page: filters.page,
      pageSize: filters.pageSize,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / filters.pageSize)),
    });
  } catch (err) {
    return toActionError(err);
  }
}

export async function getDeal(id: string): Promise<ActionResult<DealWithRelations>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("deals")
      .select(DEAL_SELECT)
      .eq("org_id", ctx.orgId)
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) throw error;
    if (!data) return fail("Deal not found.");

    return ok(data as unknown as DealWithRelations);
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Shapes all open deals in a pipeline into columns keyed by stage, for the
 * Kanban board. One query for deals, grouped client-side by stage_id —
 * cheaper than one query per column, and keeps column ordering (by
 * pipeline_stages.position) authoritative from a single source.
 */
export async function getPipelineBoard(pipelineId?: string): Promise<ActionResult<PipelineBoard>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();

    const pipelinesResult = await listPipelines();
    if (!pipelinesResult.success) return pipelinesResult;

    const pipeline = pipelineId
      ? pipelinesResult.data.find((p) => p.id === pipelineId)
      : pipelinesResult.data.find((p) => p.is_default) ?? pipelinesResult.data[0];

    if (!pipeline) return fail("Pipeline not found.");

    const { data: deals, error } = await supabase
      .from("deals")
      .select(DEAL_SELECT)
      .eq("org_id", ctx.orgId)
      .eq("pipeline_id", pipeline.id)
      .eq("status", "open")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const dealsByStage = new Map<string, DealWithRelations[]>();
    for (const deal of (deals ?? []) as unknown as DealWithRelations[]) {
      const list = dealsByStage.get(deal.stage_id) ?? [];
      list.push(deal);
      dealsByStage.set(deal.stage_id, list);
    }

    const columns: KanbanColumn[] = pipeline.stages
      .filter((s) => !s.is_won_stage && !s.is_lost_stage) // won/lost deals leave the active board
      .map((stage) => {
        const stageDeals = dealsByStage.get(stage.id) ?? [];
        return {
          stage,
          deals: stageDeals,
          dealCount: stageDeals.length,
          totalValue: stageDeals.reduce((sum, d) => sum + Number(d.amount), 0),
        };
      });

    const totalPipelineValue = columns.reduce((sum, c) => sum + c.totalValue, 0);

    return ok({ pipeline, columns, totalPipelineValue });
  } catch (err) {
    return toActionError(err);
  }
}

export async function createDeal(input: DealFormInput): Promise<ActionResult<DealWithRelations>> {
  try {
    const ctx = await requireOrgContext();
    const parsed = dealSchema.parse(input);
    const supabase = await createClient();

    const { contact_ids, ...dealFields } = parsed;

    const { data, error } = await supabase
      .from("deals")
      .insert({
        org_id: ctx.orgId,
        created_by: ctx.userId,
        owner_id: parsed.owner_id ?? ctx.userId,
        name: dealFields.name,
        pipeline_id: dealFields.pipeline_id,
        stage_id: dealFields.stage_id,
        company_id: dealFields.company_id ?? null,
        primary_contact_id: dealFields.primary_contact_id ?? null,
        amount: dealFields.amount,
        currency: dealFields.currency,
        is_recurring: dealFields.is_recurring,
        recurring_amount: dealFields.recurring_amount ?? null,
        billing_frequency: dealFields.billing_frequency,
        expected_close_date: dealFields.expected_close_date ?? null,
      })
      .select(DEAL_SELECT)
      .single();

    if (error) throw error;

    if (contact_ids?.length) {
      const rows = contact_ids.map((contactId) => ({
        org_id: ctx.orgId,
        deal_id: data.id,
        contact_id: contactId,
      }));
      const { error: linkError } = await supabase.from("deal_contacts").insert(rows);
      if (linkError) throw linkError;
    }

    revalidatePath("/dashboard/deals");
    return ok(data as unknown as DealWithRelations);
  } catch (err) {
    return toActionError(err);
  }
}

export async function updateDeal(input: DealUpdateInput): Promise<ActionResult<DealWithRelations>> {
  try {
    const ctx = await requireOrgContext();
    const parsed = dealUpdateSchema.parse(input);
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from("deals")
      .select("id, owner_id, created_by")
      .eq("org_id", ctx.orgId)
      .eq("id", parsed.id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existing) return fail("Deal not found.");

    if (!canEditRecord(ctx.role, ctx.userId, existing)) {
      return fail("You don't have permission to edit this deal.");
    }

    const { id, ...updates } = parsed;

    const { data, error } = await supabase
      .from("deals")
      .update(updates)
      .eq("id", id)
      .eq("org_id", ctx.orgId)
      .select(DEAL_SELECT)
      .single();

    if (error) throw error;

    revalidatePath("/dashboard/deals");
    revalidatePath(`/dashboard/deals/${id}`);
    return ok(data as unknown as DealWithRelations);
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * The Kanban board's drag-and-drop drop handler. Deliberately the
 * smallest possible mutation — status/actual_close_date are derived by
 * the sync_deal_status_from_stage DB trigger, not set here, so this
 * action and the trigger can never disagree.
 */
export async function moveDealStage(
  input: DealStageMoveInput
): Promise<ActionResult<DealWithRelations>> {
  try {
    const ctx = await requireOrgContext();
    const { dealId, stageId } = dealStageMoveSchema.parse(input);
    const supabase = await createClient();

    const { data: existing, error: fetchError } = await supabase
      .from("deals")
      .select("id, owner_id, created_by, pipeline_id")
      .eq("org_id", ctx.orgId)
      .eq("id", dealId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existing) return fail("Deal not found.");

    if (!canEditRecord(ctx.role, ctx.userId, existing)) {
      return fail("You don't have permission to move this deal.");
    }

    const { data: stage, error: stageError } = await supabase
      .from("pipeline_stages")
      .select("id, pipeline_id")
      .eq("id", stageId)
      .eq("org_id", ctx.orgId)
      .single();

    if (stageError || !stage) return fail("Stage not found.");
    if (stage.pipeline_id !== existing.pipeline_id) {
      return fail("Can't move a deal to a stage in a different pipeline.");
    }

    const { data, error } = await supabase
      .from("deals")
      .update({ stage_id: stageId })
      .eq("id", dealId)
      .eq("org_id", ctx.orgId)
      .select(DEAL_SELECT)
      .single();

    if (error) throw error;

    revalidatePath("/dashboard/deals");
    return ok(data as unknown as DealWithRelations);
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteDeal(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireOrgContext();

    if (!canDeleteRecords(ctx.role)) {
      return fail("Only admins and sales managers can delete deals.");
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("deals")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", ctx.orgId);

    if (error) throw error;

    revalidatePath("/dashboard/deals");
    return ok({ id });
  } catch (err) {
    return toActionError(err);
  }
}
