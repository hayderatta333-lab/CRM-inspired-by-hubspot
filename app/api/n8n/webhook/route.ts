import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import crypto from "crypto";

function hashKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-n8n-secret");
    if (!secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createAdminClient();
    const keyHash = hashKey(secret);

    const { data: apiKey, error: keyError } = await supabase
      .from("api_keys")
      .select("id, org_id, created_by, revoked_at")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .single();

    if (keyError || !apiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { first_name, last_name, email, phone } = body;

    if (!first_name && !email && !phone) {
      return NextResponse.json(
        { error: "At least one of first_name, email, or phone is required" },
        { status: 400 }
      );
    }

    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        org_id: apiKey.org_id,
        first_name: first_name ?? "Unknown",
        last_name: last_name ?? "",
        email: email ?? null,
        phone: phone ?? null,
        created_by: apiKey.created_by,
        owner_id: apiKey.created_by,
        source: "n8n",
      })
      .select()
      .single();

    if (error) {
      console.error("N8N WEBHOOK ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", apiKey.id)
      .then(() => {});

    return NextResponse.json({ success: true, contact });
  } catch (err) {
    console.error("N8N WEBHOOK ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
