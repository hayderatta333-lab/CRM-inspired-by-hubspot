import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const DEFAULT_ORG_ID = "304206e2-c776-4034-b4b3-6f65a2e5b2af";
const DEFAULT_USER_ID = "9325b9ed-2060-44fa-a2ba-fc1b2320bcc8";

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-n8n-secret");
    if (!secret || secret !== process.env.N8N_WEBHOOK_SECRET) {
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

    const supabase = await createAdminClient();

    const { data: contact, error } = await supabase
      .from("contacts")
      .insert({
        org_id: DEFAULT_ORG_ID,
        first_name: first_name ?? "Unknown",
        last_name: last_name ?? "",
        email: email ?? null,
        phone: phone ?? null,
        created_by: DEFAULT_USER_ID,
        owner_id: DEFAULT_USER_ID,
        source: "n8n",
      })
      .select()
      .single();

    if (error) {
      console.error("N8N WEBHOOK ERROR:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, contact });
  } catch (err) {
    console.error("N8N WEBHOOK ERROR:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
