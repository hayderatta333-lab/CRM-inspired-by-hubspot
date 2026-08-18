import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateAIReplyWithBooking } from "@/lib/gemini/reply";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { tryHandleFlowMessage } from "@/lib/flows/engine";

const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
const DEFAULT_ORG_ID = "304206e2-c776-4034-b4b3-6f65a2e5b2af";
const DEFAULT_USER_ID = "9325b9ed-2060-44fa-a2ba-fc1b2320bcc8";

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

  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return NextResponse.json({ status: "ok" });
    }

    const fromPhone = message.from;
    const text = message.text?.body ?? "";
    const contactName = value?.contacts?.[0]?.profile?.name ?? "Unknown";
    const nowIso = new Date().toISOString();

    const supabase = await createAdminClient();

    const { error: msgError } = await supabase.from("whatsapp_messages").insert({
      phone: fromPhone,
      contact_name: contactName,
      message_text: text,
      direction: "inbound",
      raw_payload: message,
    });
    if (msgError) console.error("MESSAGE INSERT ERROR:", msgError);

    const { data: matchedContactId, error: rpcError } = await supabase.rpc(
      "match_contact_by_phone",
      { p_phone: fromPhone }
    );
    if (rpcError) console.error("RPC ERROR:", rpcError);

    let finalContactId = matchedContactId ?? null;

    if (!finalContactId) {
      const nameParts = contactName.trim().split(" ");
      const firstName = nameParts[0] || "WhatsApp";
      const lastName = nameParts.slice(1).join(" ") || null;

      const { data: newContact, error: createError } = await supabase
        .from("contacts")
        .insert({
          org_id: DEFAULT_ORG_ID,
          created_by: DEFAULT_USER_ID,
          owner_id: DEFAULT_USER_ID,
          first_name: firstName,
          last_name: lastName,
          phone: fromPhone,
          lifecycle_stage: "lead",
          lead_status: "new",
          source: "whatsapp",
        })
        .select("id")
        .single();

      if (createError) {
        console.error("AUTO-CREATE CONTACT ERROR:", createError);
      } else {
        finalContactId = newContact.id;
      }
    }

    const { data: existingLead, error: selectError } = await supabase
      .from("whatsapp_leads")
      .select("id")
      .eq("phone", fromPhone)
      .maybeSingle();
    if (selectError) console.error("SELECT ERROR:", selectError);

    const leadPayload = {
      phone: fromPhone,
      contact_name: contactName,
      last_message_at: nowIso,
      status: "assigned",
      contact_id: finalContactId,
    };

    if (existingLead) {
      const { error: updateError } = await supabase
        .from("whatsapp_leads")
        .update(leadPayload)
        .eq("id", existingLead.id);
      if (updateError) console.error("UPDATE ERROR:", updateError);
    } else {
      const { error: insertError } = await supabase.from("whatsapp_leads").insert({
        ...leadPayload,
        first_message_at: nowIso,
      });
      if (insertError) console.error("INSERT ERROR:", insertError);
    }

    // --- Flow engine check (runs before AI auto-reply) ---
    let handledByFlow = false;
    try {
      handledByFlow = await tryHandleFlowMessage({
        orgId: DEFAULT_ORG_ID,
        fromPhone,
        text,
      });
    } catch (flowErr) {
      console.error("FLOW ENGINE ERROR:", flowErr);
    }

    // --- AI auto-reply (skipped if a flow already handled this message) ---
    if (!handledByFlow) {
      try {
        const aiReplyText = await generateAIReplyWithBooking(text, contactName, fromPhone);
        const sendResult = await sendWhatsAppMessage(fromPhone, aiReplyText);

        await supabase.from("whatsapp_messages").insert({
          phone: fromPhone,
          contact_name: contactName,
          message_text: aiReplyText,
          direction: "outbound",
          raw_payload: sendResult,
        });

        await supabase
          .from("whatsapp_leads")
          .update({ last_message_at: new Date().toISOString() })
          .eq("phone", fromPhone);
      } catch (aiErr) {
        console.error("AI REPLY ERROR:", aiErr);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("WHATSAPP WEBHOOK CRASH:", err);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
