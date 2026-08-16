import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, message } = body;

    if (!phone || !message) {
      return NextResponse.json(
        { success: false, error: "phone and message are required" },
        { status: 400 }
      );
    }

    const result = await sendWhatsAppMessage(phone, message);

    const supabase = await createAdminClient();

    await supabase.from("whatsapp_messages").insert({
      phone,
      message_text: message,
      direction: "outbound",
      raw_payload: result,
    });

    await supabase
      .from("whatsapp_leads")
      .update({ last_message_at: new Date().toISOString() })
      .eq("phone", phone);

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error("WhatsApp send error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
