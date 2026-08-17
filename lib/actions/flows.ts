"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrgContext } from "@/lib/auth/session";
import { ok, fail, toActionError, type ActionResult } from "@/lib/actions/action-result";

const createFlowSchema = z.object({
  name: z.string().min(1, "Flow name is required").max(100),
});

export type FlowListItem = {
  id: string;
  name: string;
  status: string;
  trigger_keywords: string[] | null;
  updated_at: string;
};

export async function getFlows(): Promise<ActionResult<FlowListItem[]>> {
  try {
    const { orgId } = await requireOrgContext();
    const supabase = createClient();

    const { data, error } = await supabase
      .from("flows")
      .select("id, name, status, trigger_keywords, updated_at")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return ok(data ?? []);
  } catch (err) {
    return toActionError(err);
  }
}

export async function createFlow(
  input: z.infer<typeof createFlowSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = createFlowSchema.parse(input);
    const { orgId } = await requireOrgContext();
    const supabase = createClient();

    const { data, error } = await supabase
      .from("flows")
      .insert({ org_id: orgId, name: parsed.name })
      .select("id")
      .single();

    if (error) throw error;

    revalidatePath("/flows");
    return ok({ id: data.id });
  } catch (err) {
    return toActionError(err);
  }
}

export async function deleteFlow(flowId: string): Promise<ActionResult<null>> {
  try {
    const { orgId } = await requireOrgContext();
    const supabase = createClient();

    const { error } = await supabase
      .from("flows")
      .delete()
      .eq("id", flowId)
      .eq("org_id", orgId);

    if (error) throw error;

    revalidatePath("/flows");
    return ok(null);
  } catch (err) {
    return toActionError(err);
  }
}
