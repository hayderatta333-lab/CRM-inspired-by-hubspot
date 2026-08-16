import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  console.log("WEBHOOK BODY:", JSON.stringify(body));

  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      console.log("NO MESSAGE FOUND - probably a status update, skipping");
      return NextResponse.json({ status: "ok" });
    }

    const fromPhone = message.from;
    const text = message.text?.body ?? "";
    const contactName = value?.contacts?.[0]?.profile?.name ?? "Unknown";
    const nowIso = new Date().toISOString();

    console.log("PROCESSING MESSAGE FROM:", fromPhone, "TEXT:", text);

    const supabase = await createAdminClient();
    console.log("SUPABASE CLIENT CREATED");

    const { error: msgError } = await supabase.from("whatsapp_messages").insert({
      phone: fromPhone,
      contact_name: contactName,
      message_text: text,
      direction: "inbound",
      raw_payload: message,
    });
    console.log("MESSAGE INSERT ERROR:", msgError);

    const { data: matchedContactId, error: rpcError } = await supabase.rpc(
      "match_contact_by_phone",
      { p_phone: fromPhone }
    );
    console.log("RPC RESULT:", matchedContactId, "RPC ERROR:", rpcError);

    const { data: existingLead, error: selectError } = await supabase
      .from("whatsapp_leads")
      .select("id")
      .eq("phone", fromPhone)
      .maybeSingle();
    console.log("EXISTING LEAD:", existingLead, "SELECT ERROR:", selectError);

    const leadPayload = {
      phone: fromPhone,
      contact_name: contactName,
      last_message_at: nowIso,
      status: matchedContactId ? "assigned" : "new",
      contact_id: matchedContactId ?? null,
    };

    if (existingLead) {
      const { error: updateError } = await supabase
        .from("whatsapp_leads")
        .update(leadPayload)
        .eq("id", existingLead.id);
      console.log("UPDATE ERROR:", updateError);
    } else {
      const { error: insertError } = await supabase.from("whatsapp_leads").insert({
        ...leadPayload,
        first_message_at: nowIso,
      });
      console.log("INSERT ERROR:", insertError);
    }

    console.log("DONE PROCESSING");
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("WHATSAPP WEBHOOK CRASH:", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
