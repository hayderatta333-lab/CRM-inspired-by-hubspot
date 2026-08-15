import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

// Meta calls this once to verify the webhook URL
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

// Meta sends incoming WhatsApp messages here
export async function POST(req: NextRequest) {
  const body = await req.json();

  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (message) {
      const fromPhone = message.from;
      const text = message.text?.body ?? "";
      const contactName = value?.contacts?.[0]?.profile?.name ?? "Unknown";
      const nowIso = new Date().toISOString();

      const supabase = await createAdminClient();

      // 1. Always log the raw message for history
      await supabase.from("whatsapp_messages").insert({
        phone: fromPhone,
        contact_name: contactName,
        message_text: text,
        direction: "inbound",
        raw_payload: message,
      });

      // 2. Try to match this phone number to an existing CRM contact
      const { data: matchedContactId } = await supabase.rpc(
        "match_contact_by_phone",
        { p_phone: fromPhone }
      );

      // 3. Upsert whatsapp_leads so every conversation has one tracked row
      const { data: existingLead } = await supabase
        .from("whatsapp_leads")
        .select("id")
        .eq("phone", fromPhone)
        .maybeSingle();

      const leadPayload = {
        phone: fromPhone,
        contact_name: contactName,
        last_message_at: nowIso,
        status: matchedContactId ? "assigned" : "new",
        contact_id: matchedContactId ?? null,
      };

      if (existingLead) {
        await supabase
          .from("whatsapp_leads")
          .update(leadPayload)
          .eq("id", existingLead.id);
      } else {
        await supabase.from("whatsapp_leads").insert({
          ...leadPayload,
          first_message_at: nowIso,
        });
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("WhatsApp webhook error:", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
