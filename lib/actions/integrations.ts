"use server";

/**
 * lib/actions/integrations.ts
 *
 * Per-org API keys for external automation platforms (n8n, Zapier, etc).
 * Only admins can generate/revoke keys. The raw key is shown to the user
 * exactly once at creation time — only its SHA-256 hash and an 8-char
 * prefix (for identification in the UI) are ever persisted.
 */

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import { ok, fail, toActionError, type ActionResult } from "@/lib/actions/action-result";
import { z } from "zod";

export interface ApiKeySummary {
  id: string;
  name: string;
  service: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

function generateRawKey(): string {
  return "crm_" + crypto.randomBytes(24).toString("hex");
}

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export async function listApiKeys(): Promise<ActionResult<ApiKeySummary[]>> {
  try {
    const ctx = await requireRole(["admin"]);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, service, key_prefix, created_at, last_used_at, revoked_at")
      .eq("org_id", ctx.orgId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return ok(data ?? []);
  } catch (err) {
    return toActionError(err);
  }
}

const createKeySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(255),
  service: z.string().trim().min(1).max(50).default("n8n"),
});

export async function generateApiKey(
  input: z.infer<typeof createKeySchema>
): Promise<ActionResult<{ rawKey: string; id: string }>> {
  try {
    const ctx = await requireRole(["admin"]);
    const parsed = createKeySchema.parse(input);
    const supabase = await createClient();

    const rawKey = generateRawKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.slice(0, 12);

    const { data, error } = await supabase
      .from("api_keys")
      .insert({
        org_id: ctx.orgId,
        name: parsed.name,
        service: parsed.service,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        created_by: ctx.userId,
      })
      .select("id")
      .single();

    if (error) throw error;

    revalidatePath("/settings/integrations");
    return ok({ rawKey, id: data.id });
  } catch (err) {
    return toActionError(err);
  }
}

export async function revokeApiKey(keyId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const ctx = await requireRole(["admin"]);
    const supabase = await createClient();

    const { error } = await supabase
      .from("api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", keyId)
      .eq("org_id", ctx.orgId);

    if (error) throw error;

    revalidatePath("/settings/integrations");
    return ok({ id: keyId });
  } catch (err) {
    return toActionError(err);
  }
}
