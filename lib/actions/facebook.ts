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
import { requireRole, requireOrgContext } from "@/lib/auth/session";
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

export interface FacebookMessage {
  id: string;
  psid: string;
  contact_name: string | null;
  message_text: string;
  direction: "inbound" | "outbound";
  created_at: string;
}

/** Fetches the full message thread for a contact, matched by Facebook PSID. */
export async function getFacebookThread(
  psid: string
): Promise<ActionResult<FacebookMessage[]>> {
  try {
    await requireOrgContext();

    if (!psid) return ok([]);

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("facebook_messages")
      .select("id, psid, contact_name, message_text, direction, created_at")
      .eq("psid", psid)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return ok(((data ?? []) as FacebookMessage[]).reverse());
  } catch (err) {
    return toActionError(err);
  }
}

/** Sends an outbound Facebook Messenger message and logs it, from the Contact detail page. */
export async function sendFacebookToContact(
  psid: string,
  message: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireOrgContext();

    const trimmed = message.trim();
    if (!psid || !trimmed) {
      return fail("PSID and message are required.");
    }

    const supabase = await createClient();
    const { data: connection, error: connError } = await supabase
      .from("facebook_connections")
      .select("page_id, page_access_token")
      .eq("org_id", ctx.orgId)
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle();

    if (connError) throw connError;
    if (!connection) return fail("No connected Facebook Page found for this organization.");

    const res = await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${connection.page_access_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: psid },
          message: { text: trimmed },
        }),
      }
    );
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result?.error?.message || "Failed to send Facebook message");
    }

    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("facebook_messages")
      .insert({
        page_id: connection.page_id,
        psid,
        message_text: trimmed,
        direction: "outbound",
        raw_payload: result,
      })
      .select("id")
      .single();

    if (error) throw error;

    revalidatePath("/dashboard/contacts");
    return ok({ id: data.id });
  } catch (err) {
    return toActionError(err);
  }
}
