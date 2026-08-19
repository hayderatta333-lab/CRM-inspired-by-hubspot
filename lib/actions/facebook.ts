"use server";

/**
 * lib/actions/facebook.ts
 *
 * Per-org Facebook Page connections. Admin pastes a Page Access Token
 * (generated in Meta App dashboard) and Page ID; we store it and use
 * it to send Messenger replies and fetch Lead Ads leads for that org.
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ok, fail, toActionError, type ActionResult } from "@/lib/actions/action-result";
import { z } from "zod";

export interface FacebookConnectionSummary {
  id: string;
  page_id: string;
  page_name: string | null;
  created_at: string;
  revoked_at: string | null;
}

export async function listFacebookConnections(): Promise<ActionResult<FacebookConnectionSummary[]>> {
  try {
    const ctx = await requireRole(["admin"]);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("facebook_connections")
      .select("id, page_id, page_name, created_at, revoked_at")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return ok(data ?? []);
  } catch (err) {
    return toActionError(err);
  }
}

const connectSchema = z.object({
  pageId: z.string().trim().min(1, "Page ID is required."),
  pageName: z.string().trim().max(255).optional(),
  pageAccessToken: z.string().trim().min(1, "Page Access Token is required."),
});

export async function connectFacebookPage(
  input: z.infer<typeof connectSchema>
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireRole(["admin"]);
    const parsed = connectSchema.parse(input);
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("facebook_connections")
      .select("id")
      .eq("page_id", parsed.pageId)
      .maybeSingle();

    if (existing) {
      return fail("This Facebook Page is already connected to a CRM account.");
    }

    const { data, error } = await supabase
      .from("facebook_connections")
      .insert({
        org_id: ctx.orgId,
        page_id: parsed.pageId,
        page_name: parsed.pageName ?? null,
        page_access_token: parsed.pageAccessToken,
        connected_by: ctx.userId,
      })
      .select("id")
      .single();

    if (error) throw error;

    revalidatePath("/settings/integrations");
    return ok({ id: data.id });
  } catch (err) {
    return toActionError(err);
  }
}

export async function disconnectFacebookPage(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireRole(["admin"]);
    const supabase = await createClient();

    const { error } = await supabase
      .from("facebook_connections")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", ctx.orgId);

    if (error) throw error;

    revalidatePath("/settings/integrations");
    return ok({ id });
  } catch (err) {
    return toActionError(err);
  }
}
