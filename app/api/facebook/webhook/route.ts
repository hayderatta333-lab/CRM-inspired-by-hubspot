import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { generateAIReply } from "@/lib/gemini/reply";

const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;

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

async function sendMessengerReply(pageAccessToken: string, psid: string, text: string) {
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: psid },
      message: { text },
    }),
  });
}

async function handleMessagingEvent(supabase: any, pageId: string, messagingEvent: any) {
  const { data: connection } = await supabase
    .from("facebook_connections")
    .select("org_id, page_access_token, connected_by")
    .eq("page_id", pageId)
    .is("revoked_at", null)
    .single();

  if (!connection) return;

  const psid = messagingEvent.sender?.id;
  const text = messagingEvent.message?.text;
  if (!psid || !text) return;

  await supabase.from("facebook_messages").insert({
    page_id: pageId,
    psid,
    message_text: text,
    direction: "inbound",
    raw_payload: messagingEvent,
  });

  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .eq("org_id", connection.org_id)
    .eq("facebook_psid", psid)
    .maybeSingle();

  if (!existingContact) {
    await supabase.from("contacts").insert({
      org_id: connection.org_id,
      created_by: connection.connected_by,
      owner_id: connection.connected_by,
      first_name: "Facebook",
      last_name: "User",
      facebook_psid: psid,
      lifecycle_stage: "lead",
      lead_status: "new",
      source: "facebook_messenger",
    });
  }

  const reply = await generateAIReply(text);

  await sendMessengerReply(connection.page_access_token, psid, reply);

  await supabase.from("facebook_messages").insert({
    page_id: pageId,
    psid,
    message_text: reply,
    direction: "outbound",
  });
}

async function handleLeadgenEvent(supabase: any, pageId: string, change: any) {
  const { data: connection } = await supabase
    .from("facebook_connections")
    .select("org_id, page_access_token, connected_by")
    .eq("page_id", pageId)
    .is("revoked_at", null)
    .single();

  if (!connection) return;

  const leadgenId = change.value?.leadgen_id;
  if (!leadgenId) return;

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${connection.page_access_token}`
  );
  const leadData = await res.json();

  const fieldData: Record<string, string> = {};
  for (const f of leadData.field_data ?? []) {
    fieldData[f.name] = f.values?.[0] ?? "";
  }

  await supabase.from("contacts").insert({
    org_id: connection.org_id,
    created_by: connection.connected_by,
    owner_id: connection.connected_by,
    first_name: fieldData.first_name || fieldData.full_name || "Facebook",
    last_name: fieldData.last_name || "",
    email: fieldData.email || null,
    phone: fieldData.phone_number || null,
    lifecycle_stage: "lead",
    lead_status: "new",
    source: "facebook_leads",
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const supabase = await createAdminClient();

    for (const entry of body.entry ?? []) {
      const pageId = entry.id;

      for (const messagingEvent of entry.messaging ?? []) {
        await handleMessagingEvent(supabase, pageId, messagingEvent);
      }

      for (const change of entry.changes ?? []) {
        if (change.field === "leadgen") {
          await handleLeadgenEvent(supabase, pageId, change);
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("FACEBOOK WEBHOOK ERROR:", err);
    return NextResponse.json({ status: "ok" });
  }
}
