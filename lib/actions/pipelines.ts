"use server";

/**
 * lib/actions/pipelines.ts
 *
 * Pipelines/stages are configuration data: every org member can read
 * them (needed to render the Kanban board and deal forms), but only
 * admins/sales_managers can create, reorder, or delete them — enforced
 * both here (friendly error) and by RLS (real enforcement).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext, requireRole } from "@/lib/auth/session";
import { ok, fail, toActionError, type ActionResult } from "@/lib/actions/action-result";
import type { Pipeline, PipelineStage } from "@/types/crm";
import { z } from "zod";

export interface PipelineWithStages extends Pipeline {
  stages: PipelineStage[];
}

export async function listPipelines(): Promise<ActionResult<PipelineWithStages[]>> {
  try {
    const ctx = await requireOrgContext();
    const supabase = await createClient();

    const { data: pipelines, error: pipelinesError } = await supabase
      .from("pipelines")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("position", { ascending: true });

    if (pipelinesError) throw pipelinesError;

    const { data: stages, error: stagesError } = await supabase
      .from("pipeline_stages")
      .select("*")
      .eq("org_id", ctx.orgId)
      .order("position", { ascending: true });

    if (stagesError) throw stagesError;

    const result: PipelineWithStages[] = (pipelines ?? []).map((p) => ({
      ...p,
      stages: (stages ?? []).filter((s) => s.pipeline_id === p.id),
    }));

    return ok(result);
  } catch (err) {
    return toActionError(err);
  }
}

export async function getDefaultPipeline(): Promise<ActionResult<PipelineWithStages>> {
  try {
    const result = await listPipelines();
    if (!result.success) return result;

    const defaultPipeline = result.data.find((p) => p.is_default) ?? result.data[0];
    if (!defaultPipeline) return fail("This organization has no pipelines configured yet.");

    return ok(defaultPipeline);
  } catch (err) {
    return toActionError(err);
  }
}

const pipelineSchema = z.object({
  name: z.string().trim().min(1, "Pipeline name is required.").max(255),
});

export async function createPipeline(
  input: z.infer<typeof pipelineSchema>
): Promise<ActionResult<Pipeline>> {
  try {
    const ctx = await requireRole(["admin", "sales_manager"]);
    const parsed = pipelineSchema.parse(input);
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("pipelines")
      .select("position")
      .eq("org_id", ctx.orgId)
      .order("position", { ascending: false })
      .limit(1);

    const nextPosition = (existing?.[0]?.position ?? -1) + 1;

    const { data, error } = await supabase
      .from("pipelines")
      .insert({ org_id: ctx.orgId, name: parsed.name, position: nextPosition, is_default: false })
      .select("*")
      .single();

    if (error) throw error;

    revalidatePath("/dashboard/deals");
    revalidatePath("/dashboard/settings/pipelines");
    return ok(data);
  } catch (err) {
    return toActionError(err);
  }
}

const stageSchema = z.object({
  pipeline_id: z.string().uuid(),
  name: z.string().trim().min(1, "Stage name is required.").max(255),
  probability: z.coerce.number().min(0).max(100).default(0),
  is_won_stage: z.boolean().default(false),
  is_lost_stage: z.boolean().default(false),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#6366f1"),
});

export async function createStage(
  input: z.infer<typeof stageSchema>
): Promise<ActionResult<PipelineStage>> {
  try {
    const ctx = await requireRole(["admin", "sales_manager"]);
    const parsed = stageSchema.parse(input);
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("pipeline_stages")
      .select("position")
      .eq("pipeline_id", parsed.pipeline_id)
      .order("position", { ascending: false })
      .limit(1);

    const nextPosition = (existing?.[0]?.position ?? -1) + 1;

    const { data, error } = await supabase
      .from("pipeline_stages")
      .insert({ org_id: ctx.orgId, ...parsed, position: nextPosition })
      .select("*")
      .single();

    if (error) throw error;

    revalidatePath("/dashboard/deals");
    revalidatePath("/dashboard/settings/pipelines");
    return ok(data);
  } catch (err) {
    return toActionError(err);
  }
}

const reorderStagesSchema = z.object({
  pipelineId: z.string().uuid(),
  orderedStageIds: z.array(z.string().uuid()).min(1),
});

/** Persists a new stage order after a manager drags columns in the pipeline settings UI. */
export async function reorderStages(
  input: z.infer<typeof reorderStagesSchema>
): Promise<ActionResult<{ updated: number }>> {
  try {
    const ctx = await requireRole(["admin", "sales_manager"]);
    const { pipelineId, orderedStageIds } = reorderStagesSchema.parse(input);
    const supabase = await createClient();

    const updates = orderedStageIds.map((stageId, index) =>
      supabase
        .from("pipeline_stages")
        .update({ position: index })
        .eq("id", stageId)
        .eq("pipeline_id", pipelineId)
        .eq("org_id", ctx.orgId)
    );

    const results = await Promise.all(updates);
    const errored = results.find((r) => r.error);
    if (errored?.error) throw errored.error;

    revalidatePath("/dashboard/deals");
    revalidatePath("/dashboard/settings/pipelines");
    return ok({ updated: orderedStageIds.length });
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteStage(stageId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireRole(["admin", "sales_manager"]);
    const supabase = await createClient();

    const { count } = await supabase
      .from("deals")
      .select("id", { count: "exact", head: true })
      .eq("stage_id", stageId)
      .is("deleted_at", null);

    if (count && count > 0) {
      return fail(`Can't delete this stage — ${count} deal(s) are still in it. Move them first.`);
    }

    const { error } = await supabase
      .from("pipeline_stages")
      .delete()
      .eq("id", stageId)
      .eq("org_id", ctx.orgId);

    if (error) throw error;

    revalidatePath("/dashboard/deals");
    revalidatePath("/dashboard/settings/pipelines");
    return ok({ id: stageId });
  } catch (err) {
    return toActionError(err);
  }
}
